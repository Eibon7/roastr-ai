/**
 * Tier Validation Service - SPEC 10
 * Runtime validation of subscription tiers with usage limits and feature gating
 *
 * Implements:
 * - Free: 100 análisis / 10 roasts, 1 cuenta por red, sin Shield/Original Tone
 * - Starter: 1,000 análisis / 100 roasts, 1 cuenta por red, Shield ON (Fixed Round 7)
 * - Pro: 10,000 análisis / 1,000 roasts, 2 cuentas por red, Shield + Original Tone
 * - Plus: 100,000 análisis / 5,000 roasts, 2 cuentas por red, Shield + Original Tone + Embedded Judge
 */

const { supabaseServiceClient } = require('../config/supabase');
const planLimitsService = require('./planLimitsService');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');
const {
  SENTRY_ENABLED,
  addBreadcrumb: sentryAddBreadcrumb,
  captureException: sentryCaptureException
} = require('../config/sentry'); // Issue #396 AC3
const {
  TIER_PRICING,
  UPGRADE_CONFIG,
  WARNING_THRESHOLDS,
  CACHE_CONFIG,
  SUPPORTED_PLATFORMS,
  FEATURE_MAPPINGS,
  SECURITY_CONFIG,
  VALIDATION_HELPERS,
  getUpgradeRecommendation,
  getPlanBenefits,
  getRequiredPlansForFeature,
  isSupportedPlatform
} = require('../config/tierConfig');

class TierValidationService {
  constructor() {
    // Enhanced cache for performance (CodeRabbit Round 6)
    this.usageCache = new Map();
    this.cacheTimeout = CACHE_CONFIG.timeouts.usage;
    this.requestScopedCache = new Map(); // Request-scoped validation cache

    // Use centralized configuration (CodeRabbit Round 6)
    this.warningThresholds = WARNING_THRESHOLDS;
    this.upgradeConfig = UPGRADE_CONFIG;
    this.tierPricing = TIER_PRICING;
    this.securityConfig = SECURITY_CONFIG;

    // Cache invalidation tracking for usage recording (CodeRabbit Round 6)
    this.pendingCacheInvalidations = new Set();
    this.cacheInvalidationTimer = null;

    // Metrics tracking (CodeRabbit Round 4)
    this.metrics = {
      validationCalls: 0,
      allowedActions: 0,
      blockedActions: 0,
      errors: 0,
      // Issue #396: Cache performance monitoring
      cacheHits: 0,
      cacheMisses: 0
    };

    /**
     * Issue #396: Error alerting configuration
     *
     * Concurrency Note (CodeRabbit Review #3445430342):
     * While Node.js is single-threaded, async operations can interleave.
     * Array operations (push, filter) on errorTimestamps are NOT async-safe
     * in high-concurrency scenarios.
     *
     * Current mitigation:
     * - Simple array operations (push, filter) are atomic at JS level
     * - No await/async between read-modify-write cycles
     * - Race conditions unlikely in current usage pattern
     *
     * Future optimization (if high concurrency issues occur):
     * - Replace array with circular buffer (O(1) operations)
     * - Periodic cleanup instead of per-error cleanup
     * - Use atomic operations or locks for critical sections
     */
    this.errorTimestamps = []; // Track errors for last hour
    this.lastAlertTime = null; // Prevent alert spam
    this.alertCooldownMs = 300000; // 5 min between alerts (300,000ms)
    this.errorRateThreshold = 5; // 5% error rate threshold
    this.errorCountThreshold = 100; // 100 errors per hour threshold

    // Use centralized platform configuration (CodeRabbit Round 7)
    this.SUPPORTED_PLATFORMS = SUPPORTED_PLATFORMS;
  }

  /**
   * Validate if user can perform an action based on their tier
   * @param {string} userId - User ID
   * @param {string} action - Action type (analysis, roast, platform_add)
   * @param {Object} options - Additional options (includes requestId for concurrency)
   * @returns {Object} { allowed: boolean, reason?: string, upgradeRequired?: string, currentUsage?: Object }
   */
  async validateAction(userId, action, options = {}) {
    // Enhanced input validation (CodeRabbit Round 8)
    if (!userId || typeof userId !== 'string') {
      return {
        allowed: false,
        reason: 'invalid_user_id',
        message: 'User ID is required and must be a valid string'
      };
    }

    if (!action || typeof action !== 'string') {
      return {
        allowed: false,
        reason: 'invalid_action_type',
        message: 'Action type is required and must be a valid string'
      };
    }

    const requestId = options.requestId || `${userId}-${action}-${Date.now()}`;

    // Issue #396 AC3: Sentry breadcrumb - validation start (level: info - default)
    this.addSentryBreadcrumb('validation_start', {
      userId,
      action,
      requestId,
      platform: options.platform
      // level defaults to 'info' for normal operation tracking
    });

    // Request-scoped caching to prevent duplicate validations (CodeRabbit Round 4)
    const cacheKey = `${requestId}-${userId}-${action}`;
    if (this.requestScopedCache.has(cacheKey)) {
      return this.requestScopedCache.get(cacheKey);
    }

    try {
      this.metrics.validationCalls++;

      // Enhanced parallelization for better performance (CodeRabbit Round 8)
      // Get all data in parallel when possible
      const startTime = Date.now();
      const userTier = await this.getUserTierWithUTC(userId);

      // Parallelize remaining calls that don't depend on each other
      const [currentUsage, tierLimits] = await Promise.all([
        this.getUserUsageDirectly(userId, userTier),
        planLimitsService.getPlanLimits(this.normalizePlanValue(userTier.plan))
      ]);

      // Performance monitoring (CodeRabbit Round 8)
      const validationTime = Date.now() - startTime;
      if (validationTime > 1000) {
        logger.warn('Slow validation performance detected', {
          userId,
          action,
          validationTimeMs: validationTime,
          timestamp: new Date().toISOString()
        });
      }

      // Enhanced metrics and logging (CodeRabbit Round 4)
      const validation = this.checkActionLimitsEnhanced(action, tierLimits, currentUsage, options);

      // Enhanced database error detection with fail-closed security (CodeRabbit Round 7)
      if (this.detectDatabaseErrors(userTier, currentUsage, tierLimits)) {
        // Issue #396: Use recordError() for alerting
        const dbError = new Error('Database validation error - failing closed');
        this.recordError(userId, action, dbError);
        logger.error('Database validation error - failing closed', {
          userId,
          action,
          userTierValid: !!userTier?.plan,
          currentUsageValid: !!currentUsage && !currentUsage.error,
          tierLimitsValid: !!tierLimits
        });
        // Fail closed for security - deny the action
        return {
          allowed: false,
          reason: 'validation_database_error',
          message: 'Unable to validate action due to database inconsistency',
          failedClosed: true
        };
      }

      const result = {
        ...validation,
        currentTier: userTier.plan,
        currentUsage: this.sanitizeUsageForResponse(currentUsage),
        warningStatus: this.calculateWarningStatus(tierLimits, currentUsage),
        upgradeRecommendation: validation.upgradeRequired
          ? this.getEnhancedUpgradeMessage(validation.upgradeRequired)
          : null
      };

      // Cache result for request scope
      this.requestScopedCache.set(cacheKey, result);

      if (!validation.allowed) {
        this.metrics.blockedActions++;
        // Enhanced logging with more context (CodeRabbit Round 4)
        logger.info('Action blocked by tier limits', {
          userId,
          tier: userTier.plan,
          action,
          reason: validation.reason,
          currentUsage: currentUsage,
          limits: tierLimits,
          requestId,
          timestamp: new Date().toISOString()
        });
      } else {
        this.metrics.allowedActions++;
      }

      // Issue #396 AC3: Sentry breadcrumb - validation complete (level: info - explicit)
      this.addSentryBreadcrumb('validation_complete', {
        userId,
        action,
        allowed: result.allowed,
        reason: result.reason,
        tier: result.currentTier,
        requestId,
        level: 'info' // Explicit: successful validation tracking
      });

      return result;
    } catch (error) {
      // Issue #396: Use recordError() for alerting
      this.recordError(userId, action, error);

      // Issue #396 AC3: Sentry breadcrumb + exception capture (level: error - explicit)
      this.addSentryBreadcrumb('validation_error', {
        level: 'error', // Explicit: error-level breadcrumb for exceptions
        userId,
        action,
        error: error.message,
        requestId
      });

      // Enhanced Sentry exception capture with full context
      if (SENTRY_ENABLED) {
        sentryCaptureException(error, {
          extra: {
            userId,
            action,
            options,
            requestId,
            metrics: this.getMetrics(),
            cachePerformance: this.getCachePerformanceMetrics()
          },
          tags: {
            service: 'tier_validation',
            action_type: action,
            environment: process.env.NODE_ENV
          },
          level: 'error'
        });
      }

      logger.error('Error validating tier action:', {
        error: error.message,
        stack: error.stack,
        userId,
        action,
        options,
        requestId,
        timestamp: new Date().toISOString()
      });

      // CodeRabbit Round 4 - Enhanced fail-closed security model with database error detection
      // Enhanced fail-closed security model (CodeRabbit Round 7)
      const isProductionOrSecure =
        process.env.NODE_ENV === 'production' ||
        process.env[SECURITY_CONFIG.failClosed.environmentVar] === 'true';

      // Always fail closed for critical database/connection errors
      if (
        SECURITY_CONFIG.errorCodes.database.includes(error.code) ||
        error.message?.includes('Connection') ||
        error.message?.includes('timeout') ||
        error.message?.includes('database') ||
        (SECURITY_CONFIG.failClosed.forceInProduction && isProductionOrSecure)
      ) {
        logger.error('Tier validation failing closed for security', {
          userId,
          action,
          requestId,
          errorType: error.code || 'unknown',
          isProduction: process.env.NODE_ENV === 'production',
          forceFailClosed: process.env.TIER_VALIDATION_FAIL_CLOSED === 'true'
        });

        return {
          allowed: false,
          reason: 'validation_error_fail_closed',
          message: 'Unable to validate action at this time - access denied for security',
          failedClosed: true,
          retryAfter: 300 // Suggest retry after 5 minutes
        };
      }

      // Only allow fail-open in development with explicit flag
      const allowFailOpen =
        process.env.NODE_ENV !== 'production' &&
        process.env[SECURITY_CONFIG.failClosed.developmentOverride] === 'true';

      if (allowFailOpen) {
        logger.warn('Tier validation failing open (development only)', {
          userId,
          action,
          requestId,
          warning: 'This should never happen in production'
        });
        return {
          allowed: true,
          reason: 'validation_error_fail_open_dev',
          fallback: true,
          developmentOnly: true
        };
      }

      // Default fail-closed behavior for security
      return {
        allowed: false,
        reason: 'validation_error_fail_closed_default',
        message: 'Validation service temporarily unavailable - access denied',
        failedClosed: true
      };
    } finally {
      // Cleanup request-scoped cache after a delay
      setTimeout(() => this.cleanupRequestCache(requestId), CACHE_CONFIG.cleanup.intervalMs);
    }
  }

  /**
   * Check if a feature is available for the user's tier
   * @param {string} userId - User ID
   * @param {string} feature - Feature name (shield, ENABLE_ORIGINAL_TONE, embedded_judge)
   * @returns {Object} { available: boolean, reason?: string }
   */
  async validateFeature(userId, feature) {
    try {
      const userTier = await this.getUserTier(userId);
      const tierLimits = await planLimitsService.getPlanLimits(userTier.plan);

      return this.checkFeatureAccess(feature, tierLimits, userTier.plan);
    } catch (error) {
      logger.error('Error validating tier feature - failing closed for security:', {
        error: error.message,
        userId,
        feature,
        stack: error.stack
      });

      // Always fail closed for feature validation (security-first)
      return {
        available: false,
        reason: 'feature_validation_error_fail_closed',
        message: 'Feature validation temporarily unavailable - access denied for security',
        failedClosed: true
      };
    }
  }

  /**
   * Check action limits against tier configuration
   * @private
   */
  checkActionLimits(action, tierLimits, currentUsage, options) {
    switch (action) {
      case 'analysis': {
        return this.checkAnalysisLimits(tierLimits, currentUsage);
      }

      case 'roast': {
        return this.checkRoastLimits(tierLimits, currentUsage);
      }

      case 'platform_add': {
        const { platform } = options;
        return this.checkPlatformLimits(tierLimits, currentUsage, platform);
      }

      default: {
        // CodeRabbit Round 3 - Deny unknown action types for security
        return {
          allowed: false,
          reason: 'unknown_action_type',
          message: `Action type '${action}' is not supported`
        };
      }
    }
  }

  /**
   * Check analysis limits (100 free, 1,000 starter, 10,000 pro, 100,000 plus)
   * @private
   */
  checkAnalysisLimits(tierLimits, currentUsage) {
    const monthlyLimit = tierLimits.monthlyAnalysisLimit;
    const currentAnalysis = currentUsage.analysisThisMonth || 0;

    if (monthlyLimit === -1) {
      return { allowed: true }; // Unlimited
    }

    if (currentAnalysis >= monthlyLimit) {
      return {
        allowed: false,
        reason: 'monthly_analysis_limit_exceeded',
        message: this.getAnalysisLimitMessage(monthlyLimit, currentAnalysis),
        upgradeRequired: this.getUpgradeRecommendation('analysis', monthlyLimit)
      };
    }

    return { allowed: true };
  }

  /**
   * Check roast limits (10 free, 100 starter, 1,000 pro, 5,000 plus)
   * @private
   */
  checkRoastLimits(tierLimits, currentUsage) {
    const monthlyLimit = tierLimits.monthlyResponsesLimit;
    const currentRoasts = currentUsage.roastsThisMonth || 0;

    if (monthlyLimit === -1) {
      return { allowed: true }; // Unlimited
    }

    if (currentRoasts >= monthlyLimit) {
      return {
        allowed: false,
        reason: 'monthly_roast_limit_exceeded',
        message: this.getRoastLimitMessage(monthlyLimit, currentRoasts),
        upgradeRequired: this.getUpgradeRecommendation('roast', monthlyLimit)
      };
    }

    return { allowed: true };
  }

  /**
   * Check platform limits (1 account per network for free/starter, 2 for pro/plus)
   * @private
   */
  checkPlatformLimits(tierLimits, currentUsage, platform) {
    // CodeRabbit Round 3 - Enhanced platform validation
    if (!platform || typeof platform !== 'string') {
      return {
        allowed: false,
        reason: 'invalid_platform_parameter',
        message: 'Platform parameter is required and must be a valid string'
      };
    }

    const normalizedPlatform = platform.toLowerCase().trim();
    if (!VALIDATION_HELPERS.isValidPlatform(normalizedPlatform)) {
      return {
        allowed: false,
        reason: 'unsupported_platform',
        message: `Platform '${platform}' is not supported. Supported platforms: ${SUPPORTED_PLATFORMS.join(', ')}`,
        supportedPlatforms: SUPPORTED_PLATFORMS
      };
    }

    const platformLimit = tierLimits.integrationsLimit;
    const currentAccounts = currentUsage.platformAccounts?.[normalizedPlatform] || 0;

    if (platformLimit === -1) {
      return { allowed: true }; // Unlimited
    }

    if (currentAccounts >= platformLimit) {
      return {
        allowed: false,
        reason: 'platform_account_limit_exceeded',
        message: this.getPlatformLimitMessage(normalizedPlatform, platformLimit, currentAccounts),
        upgradeRequired: this.getUpgradeRecommendation('platform', platformLimit)
      };
    }

    return { allowed: true };
  }

  /**
   * Check feature access based on tier
   * @private
   */
  checkFeatureAccess(feature, tierLimits, tierPlan) {
    // Use centralized feature mappings (CodeRabbit Round 7)
    const featureProperty = VALIDATION_HELPERS.getFeatureProperty(feature);

    if (!featureProperty) {
      // Fail-closed for unknown features (CodeRabbit Round 5 improvement)
      return {
        available: false,
        reason: 'unknown_feature',
        message: `Feature '${feature}' is not recognized`
      };
    }

    const hasAccess = Boolean(tierLimits[featureProperty]);

    if (hasAccess) {
      return { available: true };
    } else {
      return {
        available: false,
        reason: 'tier_limitation',
        message: `Feature '${feature}' requires a higher tier plan`,
        currentPlan: tierPlan,
        requiredPlans: VALIDATION_HELPERS.getRequiredPlans(feature)
      };
    }
  }

  /**
   * Get user tier information with UTC date handling (CodeRabbit Round 5)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User tier data with UTC handling
   */
  async getUserTierWithUTC(userId) {
    try {
      // Check cache first
      const cached = this.getCachedUserTier(userId);
      if (cached) {
        return cached;
      }

      // Fetch from database
      const { data, error } = await supabaseServiceClient
        .from('user_subscriptions')
        .select('plan, status, current_period_start, current_period_end, upgraded_at')
        .eq('user_id', userId)
        .single();

      if (error) {
        logger.warn('No subscription found for user, defaulting to free:', error);
        return this.getDefaultUserTier();
      }

      // Enhanced plan normalization (CodeRabbit Round 5 improvement)
      const normalizedPlan = this.normalizePlanValue(data.plan);

      const userTier = {
        plan: normalizedPlan,
        status: data.status || 'active',
        periodStart: data.current_period_start,
        periodEnd: data.current_period_end,
        upgradedAt: data.upgraded_at
      };

      // Cache the result
      this.setCachedUserTier(userId, userTier);

      return userTier;
    } catch (error) {
      logger.error('Error getting user tier:', error);
      return this.getDefaultUserTier();
    }
  }

  /**
   * Get user usage directly with provided tier data (prevents circular dependency)
   * @param {string} userId - User ID
   * @param {Object} userTier - User tier information
   * @returns {Promise<Object>} Usage data
   */
  async getUserUsageDirectly(userId, userTier) {
    // Check cache first
    const cached = this.getCachedUsage(userId);
    if (cached) {
      return cached;
    }

    // Compute effective cycle start using UTC (CodeRabbit Round 4)
    const effectiveCycleStart = await this.computeEffectiveCycleStart(userTier, userId);

    // Get usage from database with optimized queries
    const usage = await this.fetchUsageFromDatabaseOptimized(userId, effectiveCycleStart);

    // Cache the result with atomic operation
    this.setCachedUsageAtomic(userId, usage);

    return usage;
  }

  /**
   * Get user usage statistics for current billing cycle (CodeRabbit Round 5)
   * @param {string} userId - User ID
   * @param {Object} userTier - User tier information
   * @returns {Promise<Object>} Usage data
   */
  async getUserUsage(userId, userTier) {
    try {
      // Calculate effective cycle start (accounting for upgrades)
      const cycleStart = await this.computeEffectiveCycleStart(userTier, userId);
      const cycleEnd = new Date(userTier.periodEnd);

      // Get usage from database
      const { data, error } = await supabaseServiceClient
        .from('user_usage_tracking')
        .select('roasts_this_month, analysis_this_month, platform_accounts')
        .eq('user_id', userId)
        .gte('period_start', cycleStart.toISOString())
        .single();

      if (error || !data) {
        return this.getDefaultUsage();
      }

      return {
        roastsThisMonth: data.roasts_this_month || 0,
        analysisThisMonth: data.analysis_this_month || 0,
        platformAccounts: data.platform_accounts || {}
      };
    } catch (error) {
      logger.error('Error getting user usage:', error);
      return this.getDefaultUsage();
    }
  }

  /**
   * Get user's current tier information (legacy method)
   * @private
   */
  async getUserTier(userId) {
    return this.getUserTierWithUTC(userId);
  }

  /**
   * Get current usage for the billing cycle with UTC handling (CodeRabbit Round 4)
   * @private
   */
  async getCurrentUsageWithUTC(userId) {
    // Check cache first
    const cached = this.getCachedUsage(userId);
    if (cached) {
      return cached;
    }

    const userTier = await this.getUserTierWithUTC(userId);

    // Compute effective cycle start using UTC (CodeRabbit Round 4)
    const effectiveCycleStart = await this.computeEffectiveCycleStart(userTier, userId);

    // Get usage from database with optimized queries
    const usage = await this.fetchUsageFromDatabaseOptimized(userId, effectiveCycleStart);

    // Cache the result with atomic operation
    this.setCachedUsageAtomic(userId, usage);

    return usage;
  }

  /**
   * Get current usage for the billing cycle (legacy method)
   * @private
   */
  async getCurrentUsage(userId) {
    return this.getCurrentUsageWithUTC(userId);
  }

  /**
   * Fetch usage data from database (legacy method)
   * @private
   */
  async fetchUsageFromDatabase(userId, cycleStart) {
    return this.fetchUsageFromDatabaseOptimized(userId, cycleStart);
  }

  /**
   * Handle tier upgrade - reset limits immediately (legacy method)
   */
  async handleTierUpgrade(userId, newTier, oldTier) {
    return this.handleTierUpgradeEnhanced(userId, newTier, oldTier);
  }

  /**
   * Handle tier downgrade - apply in next cycle (legacy method)
   */
  async handleTierDowngrade(userId, newTier, oldTier) {
    return this.handleTierDowngradeEnhanced(userId, newTier, oldTier);
  }

  /**
   * Reset usage counters (for upgrades) - Legacy method
   * @private
   */
  async resetUsageCounters(userId) {
    return this.resetUsageCountersAtomic(userId);
  }

  /**
   * Get start of current month with UTC (CodeRabbit Round 4)
   * @private
   */
  getMonthStartUTC() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  /**
   * Get start of next billing cycle with UTC (CodeRabbit Round 4)
   * @private
   */
  // Enhanced UTC date handling (CodeRabbit Round 5)
  getNextCycleStartUTC(periodEndIso) {
    if (periodEndIso) {
      const periodEnd = new Date(periodEndIso);
      // Calculate next day at 00:00:00 UTC
      const nextDay = new Date(
        Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), periodEnd.getUTCDate() + 1)
      );
      return nextDay.toISOString();
    }
    // Default behavior - next month start
    const now = new Date();
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return nextMonth.toISOString();
  }

  /**
   * Legacy methods for backwards compatibility
   * @private
   */
  getMonthStart() {
    return this.getMonthStartUTC();
  }

  getNextCycleStart() {
    return this.getNextCycleStartUTC();
  }

  /**
   * Cache usage data (legacy method)
   * @private
   */
  setCachedUsage(userId, usage) {
    this.setCachedUsageAtomic(userId, usage);
  }

  /**
   * Get cached usage if valid (updated for atomic cache format)
   * @private
   *
   * Boundary checks (CodeRabbit Review #3445430342):
   * - Validates userId (null/undefined/wrong type → returns null + cache miss)
   * - Validates timestamp existence (corrupted entry → cleanup + cache miss)
   * - Validates timestamp type (corrupted entry → cleanup + cache miss)
   */
  getCachedUsage(userId) {
    // Boundary check: validate userId
    if (!userId || typeof userId !== 'string') {
      this.metrics.cacheMisses++; // Issue #396: Track cache miss
      logger.warn('getCachedUsage called with invalid userId', {
        userId: typeof userId,
        context: 'Returning null for safety'
      });
      return null;
    }

    // Don't return cached data if invalidation is pending
    if (this.pendingCacheInvalidations.has(userId)) {
      this.metrics.cacheMisses++; // Issue #396: Track cache miss
      return null;
    }

    const cached = this.usageCache.get(userId);

    // Boundary check: validate cached entry structure
    if (!cached || !cached.timestamp || typeof cached.timestamp !== 'number') {
      if (cached) {
        // Corrupted cache entry detected - clean it up
        logger.warn('Corrupted cache entry detected and removed', {
          userId,
          hasTimestamp: !!cached.timestamp,
          timestampType: typeof cached.timestamp,
          action: 'Entry removed from cache'
        });
        this.usageCache.delete(userId); // Cleanup corrupted entry
      }
      this.metrics.cacheMisses++; // Issue #396: Track cache miss
      return null;
    }

    // Standard cache expiry check
    if (Date.now() - cached.timestamp < this.cacheTimeout) {
      this.metrics.cacheHits++; // Issue #396: Track cache hit
      return cached.data;
    }

    this.metrics.cacheMisses++; // Issue #396: Track cache miss
    return null;
  }

  /**
   * Sanitize usage data for client response
   * @private
   */
  // Enhanced usage response (CodeRabbit Round 5)
  sanitizeUsageForResponse(usage) {
    if (!usage) {
      return {
        roastsThisMonth: 0,
        analysisThisMonth: 0,
        platformAccountsByPlatform: {},
        totalActivePlatformAccounts: 0,
        platformAccounts: 0 // Legacy field for backward compatibility
      };
    }

    const platformAccounts =
      usage.platformAccounts &&
      typeof usage.platformAccounts === 'object' &&
      !Array.isArray(usage.platformAccounts)
        ? usage.platformAccounts
        : {};
    const totalActivePlatformAccounts = Object.values(platformAccounts).reduce(
      (sum, count) => sum + count,
      0
    );

    return {
      roastsThisMonth: usage.roastsThisMonth || 0,
      analysisThisMonth: usage.analysisThisMonth || 0,
      platformAccountsByPlatform: platformAccounts,
      totalActivePlatformAccounts,
      platformAccounts: Object.keys(platformAccounts).length // Legacy field for backward compatibility
    };
  }

  /**
   * Generate user-friendly limit messages
   * @private
   */
  getAnalysisLimitMessage(limit, current) {
    return `Has alcanzado tu límite mensual de ${limit} análisis. Has usado ${current}/${limit}.`;
  }

  getRoastLimitMessage(limit, current) {
    return `Has alcanzado tu límite mensual de ${limit} roasts. Has usado ${current}/${limit}.`;
  }

  getPlatformLimitMessage(platform, limit, current) {
    return `Has alcanzado tu límite de ${limit} cuenta(s) para ${platform}. Tienes ${current}/${limit} activa(s).`;
  }

  /**
   * Get upgrade recommendation based on usage pattern (uses centralized config)
   * @private
   */
  getUpgradeRecommendation(usageType, currentLimit) {
    return getUpgradeRecommendation(usageType, currentLimit);
  }

  // ============================================================================
  // CODERABBIT ROUND 4 - HELPER METHODS
  // ============================================================================

  /**
   * Compute effective cycle start considering resets and upgrades (CodeRabbit Round 4)
   * @private
   */
  // Effective cycle start with upgrade resets (CodeRabbit Round 5)
  async computeEffectiveCycleStart(userTier, userId) {
    // Use billing period start if available, otherwise month start
    const billingPeriodStart = userTier.periodStart
      ? new Date(userTier.periodStart)
      : this.getMonthStartUTC();

    try {
      // Check for usage reset markers for tier upgrades
      const { data: resetData, error } = await supabaseServiceClient
        .from('usage_resets')
        .select('reset_timestamp')
        .eq('user_id', userId)
        .order('reset_timestamp', { ascending: false })
        .limit(1)
        .single();

      if (!error && resetData && resetData.reset_timestamp) {
        const resetTimestamp = new Date(resetData.reset_timestamp);
        // Use the most recent reset if it's after the billing period start
        return resetTimestamp > billingPeriodStart ? resetTimestamp : billingPeriodStart;
      }
    } catch (error) {
      // If error querying resets, fall back to billing period start
      logger.warn('Error checking usage resets, falling back to billing period start', {
        userId,
        error: error.message
      });
    }

    return billingPeriodStart;
  }

  /**
   * Normalize plan values to prevent downstream errors (CodeRabbit Round 4)
   * @private
   */
  // Enhanced plan normalization (CodeRabbit Round 5)
  normalizePlanValue(plan) {
    return VALIDATION_HELPERS.normalizePlan(plan);
  }

  /**
   * Calculate warning status for approaching limits (CodeRabbit Round 4)
   * @private
   */
  calculateWarningStatus(tierLimits, currentUsage) {
    const warnings = {};

    // Analysis warnings
    if (tierLimits.monthlyAnalysisLimit > 0) {
      const analysisPercentage =
        (currentUsage.analysisThisMonth || 0) / tierLimits.monthlyAnalysisLimit;
      if (analysisPercentage >= this.warningThresholds.analysis) {
        warnings.analysis = {
          percentage: Math.round(analysisPercentage * 100),
          remaining: tierLimits.monthlyAnalysisLimit - (currentUsage.analysisThisMonth || 0)
        };
      }
    }

    // Roast warnings
    if (tierLimits.monthlyResponsesLimit > 0) {
      const roastPercentage =
        (currentUsage.roastsThisMonth || 0) / tierLimits.monthlyResponsesLimit;
      if (roastPercentage >= this.warningThresholds.roast) {
        warnings.roast = {
          percentage: Math.round(roastPercentage * 100),
          remaining: tierLimits.monthlyResponsesLimit - (currentUsage.roastsThisMonth || 0)
        };
      }
    }

    return warnings;
  }

  /**
   * Enhanced action limits checking with better error handling (CodeRabbit Round 4)
   * @private
   */
  checkActionLimitsEnhanced(action, tierLimits, currentUsage, options) {
    return this.checkActionLimits(action, tierLimits, currentUsage, options);
  }

  /**
   * Get plan benefits for upgrade recommendations (uses centralized config)
   * @private
   */
  getPlanBenefits(plan) {
    return getPlanBenefits(plan);
  }

  // ============================================================================
  // OPTIMIZED DATABASE OPERATIONS (CodeRabbit Round 4)
  // ============================================================================

  /**
   * Fetch usage from database with count queries for performance (CodeRabbit Round 4)
   * @private
   */
  async fetchUsageFromDatabaseOptimized(userId, cycleStart) {
    try {
      // Use Promise.all for parallelized queries with count instead of full fetch
      const [roastResult, analysisResult, platformsResult] = await Promise.all([
        // Count roasts instead of fetching full records
        supabaseServiceClient
          .from('user_activities')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('activity_type', 'roast_generated')
          .gte('created_at', cycleStart.toISOString()),

        // Sum analysis quantities
        supabaseServiceClient
          .from('analysis_usage')
          .select('quantity')
          .eq('user_id', userId)
          .gte('created_at', cycleStart.toISOString()),

        // Get platform accounts (still need actual data for grouping)
        supabaseServiceClient
          .from('user_integrations')
          .select('platform, status')
          .eq('user_id', userId)
          .eq('status', 'active')
      ]);

      // Extract counts and handle errors gracefully
      const roastsThisMonth = roastResult.count || 0;
      const analysisThisMonth =
        analysisResult.data?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;

      // Group platform accounts
      const platformAccounts = {};
      platformsResult.data?.forEach((platform) => {
        if (platform.platform) {
          platformAccounts[platform.platform] = (platformAccounts[platform.platform] || 0) + 1;
        }
      });

      return {
        roastsThisMonth,
        analysisThisMonth,
        platformAccounts,
        cycleStart: cycleStart.toISOString(),
        fetchedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error fetching optimized usage from database:', {
        error: error.message,
        userId,
        cycleStart: cycleStart.toISOString()
      });

      // Return safe defaults on error
      return {
        roastsThisMonth: 0,
        analysisThisMonth: 0,
        platformAccounts: {},
        cycleStart: cycleStart.toISOString(),
        fetchedAt: new Date().toISOString(),
        error: true
      };
    }
  }

  // ============================================================================
  // ENHANCED CACHE MANAGEMENT (CodeRabbit Round 4)
  // ============================================================================

  /**
   * Atomic cache operation to prevent race conditions (CodeRabbit Round 4)
   * @private
   */
  setCachedUsageAtomic(userId, usage) {
    const cacheEntry = {
      data: usage,
      timestamp: Date.now(),
      version: Date.now() // Simple versioning for atomic updates
    };

    this.usageCache.set(userId, cacheEntry);
  }

  /**
   * Invalidate cache for user after actions that affect usage (CodeRabbit Round 7)
   * Enhanced to handle all cache entries and prevent race conditions
   * @private
   */
  invalidateUserCache(userId) {
    // Track invalidation to prevent race conditions
    this.pendingCacheInvalidations.add(userId);

    // Clear all cache entries for this user
    this.usageCache.delete(userId);
    this.usageCache.delete(`tier_${userId}`);
    this.usageCache.delete(`usage_${userId}`);

    // Also cleanup any request-scoped cache entries for this user
    for (const [key] of this.requestScopedCache) {
      if (key.includes(userId)) {
        this.requestScopedCache.delete(key);
      }
    }

    // Remove from pending after a brief delay to prevent immediate re-cache
    setTimeout(() => {
      this.pendingCacheInvalidations.delete(userId);
    }, CACHE_CONFIG.invalidation.delayMs);

    logger.debug('User cache invalidated', {
      userId,
      timestamp: new Date().toISOString(),
      cacheSize: this.usageCache.size
    });
  }

  /**
   * Cleanup request-scoped cache (CodeRabbit Round 4)
   * @private
   */
  cleanupRequestCache(requestId) {
    for (const [key] of this.requestScopedCache) {
      if (key.startsWith(requestId)) {
        this.requestScopedCache.delete(key);
      }
    }
  }

  // ============================================================================
  // ENHANCED TIER UPGRADE/DOWNGRADE HANDLING (CodeRabbit Round 4)
  // ============================================================================

  /**
   * Enhanced tier upgrade with immediate cache invalidation (CodeRabbit Round 4)
   */
  async handleTierUpgradeEnhanced(userId, newTier, oldTier) {
    try {
      logger.info('Processing enhanced tier upgrade:', {
        userId,
        oldTier,
        newTier,
        timestamp: new Date().toISOString()
      });

      // Invalidate cache immediately to prevent stale data
      this.invalidateUserCache(userId);

      // Reset usage counters with atomic operation
      await this.resetUsageCountersAtomic(userId);

      // Additional cache invalidation to ensure fresh data
      this.invalidateUserCache(userId);

      return {
        success: true,
        message: 'Límites reseteados inmediatamente tras upgrade',
        effectiveImmediately: true,
        cacheInvalidated: true
      };
    } catch (error) {
      logger.error('Error handling enhanced tier upgrade:', error);
      throw error;
    }
  }

  /**
   * Enhanced tier downgrade with dynamic effective dates (CodeRabbit Round 4)
   */
  async handleTierDowngradeEnhanced(userId, newTier, oldTier, options = {}) {
    try {
      const effectiveDate = options.effectiveDate || this.getNextCycleStartUTC();

      logger.info('Processing enhanced tier downgrade:', {
        userId,
        oldTier,
        newTier,
        effectiveDate,
        timestamp: new Date().toISOString()
      });

      // Store pending change with atomic upsert (prevent duplicates)
      const { data: upsertData, error: upsertError } = await supabaseServiceClient
        .from('pending_plan_changes')
        .upsert(
          {
            user_id: userId,
            current_plan: oldTier,
            new_plan: newTier,
            change_type: 'downgrade',
            effective_date: effectiveDate,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            onConflict: 'user_id,effective_date',
            ignoreDuplicates: false // Update existing records
          }
        );

      if (upsertError) {
        throw new Error(`Atomic upsert failed for downgrade: ${upsertError.message}`);
      }

      return {
        success: true,
        message: this.getDowngradeMessage(newTier, effectiveDate),
        effectiveDate,
        gracePeriod: true
      };
    } catch (error) {
      logger.error('Error handling enhanced tier downgrade:', error);
      throw error;
    }
  }

  /**
   * Atomic usage reset to prevent race conditions (CodeRabbit Round 4)
   * @private
   */
  async resetUsageCountersAtomic(userId) {
    const resetTimestamp = new Date().toISOString();

    // Use atomic upsert pattern for usage resets (prevent duplicates)
    const { data: resetData, error: resetError } = await supabaseServiceClient
      .from('usage_resets')
      .upsert(
        {
          user_id: userId,
          reset_type: 'tier_upgrade',
          reset_timestamp: resetTimestamp,
          reason: 'Tier upgrade - usage limits reset immediately',
          created_at: resetTimestamp
        },
        {
          onConflict: 'user_id,reset_type',
          ignoreDuplicates: false // Allow updating existing resets
        }
      );

    if (resetError) {
      throw new Error(`Atomic upsert failed for usage reset: ${resetError.message}`);
    }

    logger.info('Atomic usage reset applied', {
      userId,
      resetTimestamp,
      resetType: 'tier_upgrade'
    });
  }

  // ============================================================================
  // ENHANCED MESSAGING WITH PRICING (CodeRabbit Round 4)
  // ============================================================================

  /**
   * Enhanced upgrade message with pricing information (CodeRabbit Round 4)
   * @private
   */
  getEnhancedUpgradeMessage(targetPlan) {
    const planConfig = this.upgradeConfig.plans[targetPlan];
    if (!planConfig) {
      return `Considera actualizar a un plan superior para acceder a más funciones.`;
    }

    const benefits = this.getPlanBenefits(targetPlan);
    return {
      plan: targetPlan,
      price: planConfig.price,
      benefits: benefits,
      message: `Actualiza a ${targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1)} por ${planConfig.price} para obtener: ${benefits.join(', ')}`
    };
  }

  /**
   * Get downgrade message with timing information (CodeRabbit Round 4)
   * @private
   */
  getDowngradeMessage(newPlan, effectiveDate) {
    const effectiveDateTime = new Date(effectiveDate);
    const formattedDate = effectiveDateTime.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `Tu plan cambiará a ${newPlan.charAt(0).toUpperCase() + newPlan.slice(1)} el ${formattedDate}. Hasta entonces, mantienes todos los beneficios actuales.`;
  }

  // ============================================================================
  // ERROR DETECTION AND DIAGNOSTICS (CodeRabbit Round 4)
  // ============================================================================

  /**
   * Detect database errors in fetched data (CodeRabbit Round 4)
   * @private
   */
  detectDatabaseErrors(userTier, currentUsage, tierLimits) {
    // Check for obvious data corruption or missing critical data
    if (!userTier || !userTier.plan) {
      logger.warn('Database error: Missing user tier data');
      return true;
    }

    if (!currentUsage || currentUsage.error) {
      logger.warn('Database error: Invalid usage data');
      return true;
    }

    if (!tierLimits) {
      logger.warn('Database error: Missing tier limits');
      return true;
    }

    return false;
  }

  /**
   * Get service metrics for monitoring (CodeRabbit Round 4)
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.usageCache.size,
      requestCacheSize: this.requestScopedCache.size,
      cachePerformance: this.getCachePerformanceMetrics(),
      timestamp: new Date().toISOString()
    };
  }

  // ============================================================================
  // ISSUE #396 - PRODUCTION MONITORING & ENHANCEMENTS
  // ============================================================================

  /**
   * Get cache performance metrics (Issue #396 - AC1)
   * Tracks cache hit/miss rates and performance stats
   * @returns {Object} Cache performance metrics
   */
  getCachePerformanceMetrics() {
    const totalRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    const hitRate =
      totalRequests > 0 ? ((this.metrics.cacheHits / totalRequests) * 100).toFixed(2) : 0;

    return {
      hits: this.metrics.cacheHits,
      misses: this.metrics.cacheMisses,
      totalRequests,
      hitRate: `${hitRate}%`,
      cacheSize: this.usageCache.size,
      requestCacheSize: this.requestScopedCache.size,
      ttlMs: this.cacheTimeout,
      ttlMinutes: (this.cacheTimeout / 60000).toFixed(1),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Record error with alerting check (Issue #396 - AC2)
   * Replaces direct this.metrics.errors++ calls
   *
   * Concurrency handling (CodeRabbit Review #3445430342):
   * - Operations are synchronous (no await) to minimize race conditions
   * - Array.push() is atomic at JS level
   * - If high concurrency becomes an issue, consider:
   *   1. Circular buffer instead of array (O(1) operations)
   *   2. Periodic cleanup instead of per-error cleanup
   *   3. Batched metrics updates
   *
   * @param {string} userId - User ID
   * @param {string} action - Action type
   * @param {Error} error - Error object
   */
  recordError(userId, action, error) {
    // All operations are synchronous to prevent interleaving
    this.metrics.errors++;
    this.errorTimestamps.push(Date.now());
    this.pruneOldErrors();

    // Check if alert needed (HIGH PRIORITY - AC2)
    this.checkErrorThresholds(userId, action, error);
  }

  /**
   * Prune errors older than 1 hour (Issue #396 - AC2)
   * Maintains sliding window for error rate calculation
   *
   * Performance note (CodeRabbit Review #3445430342):
   * - filter() is O(n) and called on every error
   * - For high-error scenarios, consider periodic cleanup (e.g., every 100 errors)
   * - Alternative: circular buffer with O(1) operations
   *
   * @private
   */
  pruneOldErrors() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    // Atomic operation - creates new array, then replaces reference
    this.errorTimestamps = this.errorTimestamps.filter((t) => t > oneHourAgo);
  }

  /**
   * Check error thresholds and trigger alerts if exceeded (Issue #396 - AC2)
   * Threshold 1: Error rate >5%
   * Threshold 2: Absolute count >100 errors/hour
   * @param {string} userId - User ID
   * @param {string} action - Action type
   * @param {Error} error - Error object
   * @private
   */
  checkErrorThresholds(userId, action, error) {
    this.pruneOldErrors();

    const errorCount = this.errorTimestamps.length;
    const errorRate =
      this.metrics.validationCalls > 0
        ? (this.metrics.errors / this.metrics.validationCalls) * 100
        : 0;

    // Threshold 1: Error rate >5%
    const rateExceeded = errorRate > this.errorRateThreshold;

    // Threshold 2: Absolute count >100/hour
    const countExceeded = errorCount > this.errorCountThreshold;

    // Check cooldown to prevent alert spam
    const canAlert = !this.lastAlertTime || Date.now() - this.lastAlertTime > this.alertCooldownMs;

    if ((rateExceeded || countExceeded) && canAlert) {
      this.triggerAlert({
        userId,
        action,
        error: error.message,
        stack: error.stack,
        metrics: {
          errorRate: `${errorRate.toFixed(2)}%`,
          errorsLastHour: errorCount,
          totalErrors: this.metrics.errors,
          totalValidations: this.metrics.validationCalls,
          allowedActions: this.metrics.allowedActions,
          blockedActions: this.metrics.blockedActions
        },
        thresholds: {
          rateThreshold: `${this.errorRateThreshold}%`,
          countThreshold: this.errorCountThreshold,
          cooldownMinutes: this.alertCooldownMs / 60000
        },
        violations: {
          rateExceeded,
          countExceeded
        },
        cachePerformance: this.getCachePerformanceMetrics(),
        timestamp: new Date().toISOString()
      });

      this.lastAlertTime = Date.now();
    }
  }

  /**
   * Trigger alert for error threshold violation (Issue #396 - AC2)
   * Logs structured alert and optionally sends to external monitoring
   * @param {Object} alertData - Alert data object
   * @private
   */
  triggerAlert(alertData) {
    logger.error('🚨 TIER VALIDATION ALERT: Error threshold exceeded', {
      category: 'tier_validation_alert',
      severity: 'high',
      alertType: 'error_threshold_exceeded',
      ...alertData
    });

    // Optional: Send to external monitoring (webhook, Slack, PagerDuty)
    if (process.env.ALERT_WEBHOOK_URL) {
      // Guard: Check fetch availability (CodeRabbit Review #3447209994)
      // In Node <18, Jest, or environments without experimental fetch,
      // fetch() is not defined and would throw ReferenceError
      if (typeof fetch !== 'function') {
        logger.warn('Skipping alert webhook because fetch is not available in this runtime', {
          alertData,
          nodeVersion: process.version,
          hasGlobalFetch: typeof fetch,
          hint: 'Use Node.js ≥18 or enable --experimental-fetch flag'
        });
        return;
      }

      // Non-blocking webhook call
      fetch(process.env.ALERT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'tier_validation_service',
          alertType: 'error_threshold_exceeded',
          ...alertData
        })
      }).catch((webhookError) => {
        logger.error('Failed to send alert webhook', {
          webhookError: webhookError.message,
          originalAlert: alertData
        });
      });
    }
  }

  /**
   * Add Sentry breadcrumb (Issue #396 - AC3)
   * Enhanced error tracking with context breadcrumbs
   *
   * Breadcrumb levels (CodeRabbit Review #3445430342):
   * - 'info': Normal operations (validation_start, validation_complete) - DEFAULT
   * - 'warning': Degraded performance or potential issues
   * - 'error': Errors and exceptions (validation_error)
   *
   * @param {string} category - Breadcrumb category (e.g., 'validation_start')
   * @param {Object} data - Breadcrumb data
   * @param {string} [data.level='info'] - Breadcrumb level (info|warning|error)
   * @param {string} [data.message] - Optional message (defaults to category)
   * @private
   */
  addSentryBreadcrumb(category, data = {}) {
    if (!SENTRY_ENABLED) return;

    sentryAddBreadcrumb({
      category: `tier_validation.${category}`,
      message: data.message || category,
      level: data.level || 'info', // Default: 'info' for normal operations
      data: {
        ...data,
        service: 'tier_validation_service',
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Record usage action atomically with cache invalidation (CodeRabbit Round 8)
   * Enhanced with better input validation and race condition prevention
   * @param {string} userId - User ID
   * @param {string} actionType - Action type
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<boolean>} Success status
   */
  async recordUsageActionAtomic(userId, actionType, metadata = {}) {
    // Enhanced input validation (CodeRabbit Round 8)
    if (!userId || typeof userId !== 'string') {
      logger.error('Invalid userId in recordUsageActionAtomic', { userId, actionType });
      return false;
    }

    if (!actionType || typeof actionType !== 'string') {
      logger.error('Invalid actionType in recordUsageActionAtomic', { userId, actionType });
      return false;
    }

    return this.withRetry(async () => {
      // Use atomic UPSERT pattern for usage recording to prevent duplicates
      const recordTimestamp = new Date().toISOString();

      const { data, error } = await supabaseServiceClient.from('user_activities').upsert(
        {
          user_id: userId,
          activity_type: actionType,
          created_at: recordTimestamp,
          metadata: {
            ...metadata,
            service_version: 'tier_validation_v1.1', // Updated version
            recorded_at: recordTimestamp,
            request_id: `${userId}-${actionType}-${Date.now()}` // Prevent duplicates
          }
        },
        {
          onConflict: 'user_id,activity_type,created_at',
          ignoreDuplicates: true
        }
      );

      if (error) {
        logger.error('Failed to record usage action atomically', {
          userId,
          actionType,
          error: error.message,
          errorCode: error.code,
          timestamp: recordTimestamp
        });
        throw new Error(`Database operation failed: ${error.message}`);
      }

      // Critical: Invalidate cache immediately after recording usage (CodeRabbit Round 8)
      this.invalidateUserCache(userId);

      logger.debug('Usage recorded and cache invalidated', {
        userId,
        actionType,
        timestamp: recordTimestamp,
        cacheInvalidated: true
      });

      return true;
    }, `recordUsageActionAtomic(${userId}, ${actionType})`).catch((error) => {
      logger.error('Error in atomic usage recording after retries', {
        userId,
        actionType,
        error: error.message,
        stack: error.stack,
        isRetryError: true
      });
      return false;
    });
  }

  /**
   * Record batch usage actions atomically with cache invalidation (CodeRabbit Round 7)
   * @param {string} userId - User ID
   * @param {Array} actions - Array of action objects
   * @returns {Promise<Object>} Batch result
   */
  async recordUsageActionsBatch(userId, actions) {
    if (!actions || actions.length === 0) {
      return { success: 0, failed: 0 };
    }

    const batchTimestamp = new Date().toISOString();
    const batchId = `batch_${Date.now()}`;

    const batchInserts = actions.map((action, index) => ({
      user_id: userId,
      activity_type: action.actionType,
      created_at: batchTimestamp,
      metadata: {
        ...action.metadata,
        service_version: 'tier_validation_v1',
        batch_id: batchId,
        batch_index: index,
        recorded_at: batchTimestamp
      }
    }));

    try {
      // Use atomic UPSERT pattern for batch operations
      const { data, error } = await supabaseServiceClient
        .from('user_activities')
        .upsert(batchInserts, {
          onConflict: 'user_id,activity_type,created_at',
          ignoreDuplicates: true
        });

      if (error) {
        logger.error('Failed to record batch usage actions', {
          userId,
          batchSize: actions.length,
          batchId,
          error: error.message
        });
        return { success: 0, failed: actions.length };
      }

      // Critical: Invalidate cache immediately after batch recording
      this.invalidateUserCache(userId);

      logger.debug('Batch usage recorded and cache invalidated', {
        userId,
        batchSize: actions.length,
        batchId,
        timestamp: batchTimestamp
      });

      return { success: actions.length, failed: 0 };
    } catch (error) {
      logger.error('Error in batch usage recording', {
        userId,
        batchSize: actions.length,
        batchId,
        error: error.message,
        stack: error.stack
      });
      return { success: 0, failed: actions.length };
    }
  }

  /**
   * Enhanced tier downgrade handling (CodeRabbit Round 5)
   * @param {string} userId - User ID
   * @param {string} newPlan - New plan ID
   * @param {string} currentPlan - Current plan ID
   * @param {Object} options - Options object
   * @returns {Promise<Object>} Downgrade result
   */
  async handleTierDowngradeEnhanced(userId, newPlan, currentPlan, options = {}) {
    try {
      // Get actual billing period end date
      const { data: userTier, error: tierError } = await supabaseServiceClient
        .from('user_subscriptions')
        .select('current_period_end')
        .eq('user_id', userId)
        .single();

      if (tierError) {
        throw new Error(`Failed to get user tier data: ${tierError.message}`);
      }

      const billingPeriodEnd = userTier.current_period_end || userTier.periodEnd;

      // Schedule downgrade for end of billing period with atomic operation
      const { data, error } = await supabaseServiceClient.from('scheduled_plan_changes').upsert(
        {
          user_id: userId,
          current_plan: currentPlan,
          new_plan: newPlan,
          effective_date: billingPeriodEnd,
          change_type: 'downgrade',
          created_at: new Date().toISOString(),
          metadata: {
            triggered_by: 'tier_validation_service',
            ...options.metadata
          }
        },
        {
          onConflict: 'user_id,effective_date',
          ignoreDuplicates: false // Allow updating existing scheduled changes
        }
      );

      if (error) {
        throw new Error(`Failed to schedule tier downgrade: ${error.message}`);
      }

      return {
        success: true,
        billingPeriodEnd,
        effectiveDate: billingPeriodEnd,
        changeType: 'downgrade'
      };
    } catch (error) {
      logger.error('Error in enhanced tier downgrade', {
        userId,
        newPlan,
        currentPlan,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get default values (CodeRabbit Round 5)
   * @private
   */
  getDefaultUserTier() {
    return {
      plan: 'starter_trial',
      status: 'active',
      periodStart: new Date().toISOString(),
      periodEnd: this.getNextCycleStartUTC()
    };
  }

  getDefaultUsage() {
    return {
      roastsThisMonth: 0,
      analysisThisMonth: 0,
      platformAccounts: {}
    };
  }

  /**
   * Get required plans for a specific feature
   * @private
   */
  getRequiredPlansForFeature(feature) {
    const featureRequirements = {
      shield: ['starter', 'pro', 'plus'],
      custom_tones: ['pro', 'plus'],
      ENABLE_ORIGINAL_TONE: ['pro', 'plus'],
      embedded_judge: ['plus'],
      analytics: ['pro', 'plus'],
      api_access: ['plus'],
      priority_support: ['pro', 'plus']
    };

    return featureRequirements[feature] || [];
  }

  /**
   * Cache management methods (CodeRabbit Round 5)
   * @private
   */
  getCachedUserTier(userId) {
    // Don't return cached data if invalidation is pending
    if (this.pendingCacheInvalidations.has(userId)) {
      this.metrics.cacheMisses++; // Issue #396: Track cache miss
      return null;
    }

    if (this.lastCacheRefresh && Date.now() - this.lastCacheRefresh > this.cacheTimeout) {
      this.usageCache.clear();
      this.lastCacheRefresh = null;
    }

    const cached = this.usageCache.get(`tier_${userId}`);
    if (cached) {
      this.metrics.cacheHits++; // Issue #396: Track cache hit
    } else {
      this.metrics.cacheMisses++; // Issue #396: Track cache miss
    }
    return cached;
  }

  setCachedUserTier(userId, tierData) {
    // Don't cache if invalidation is pending
    if (this.pendingCacheInvalidations.has(userId)) {
      return;
    }

    this.usageCache.set(`tier_${userId}`, tierData);
    if (!this.lastCacheRefresh) {
      this.lastCacheRefresh = Date.now();
    }
  }

  /**
   * Clear cache (useful for testing and manual invalidation)
   */
  clearCache() {
    this.usageCache.clear();
    this.requestScopedCache.clear();
    this.pendingCacheInvalidations.clear();
    this.lastCacheRefresh = null;

    logger.debug('All caches cleared manually', {
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Retry database operations with exponential backoff (CodeRabbit Round 7)
   * @param {Function} operation - Database operation to retry
   * @param {string} operationName - Name of operation for logging
   * @returns {Promise} Operation result
   */
  async withRetry(operation, operationName) {
    const { maxRetries, baseDelayMs, backoffMultiplier } = SECURITY_CONFIG.retryPolicy;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const isRetryableError =
          SECURITY_CONFIG.errorCodes.database.includes(error.code) ||
          error.message?.includes('timeout') ||
          error.message?.includes('connection');

        if (isLastAttempt || !isRetryableError) {
          logger.error(`${operationName} failed after ${attempt} attempts`, {
            error: error.message,
            attempt,
            maxRetries,
            isRetryableError
          });
          throw error;
        }

        const delayMs = baseDelayMs * Math.pow(backoffMultiplier, attempt - 1);
        logger.warn(`${operationName} failed, retrying in ${delayMs}ms`, {
          error: error.message,
          attempt,
          maxRetries,
          delayMs
        });

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}

// Export singleton instance for production use
const instance = new TierValidationService();

// Export both instance (default) and class (for testing) - Issue #618
module.exports = instance;
module.exports.TierValidationService = TierValidationService;
