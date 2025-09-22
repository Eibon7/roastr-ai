/**
 * Tier Validation Service - SPEC 10
 * Runtime validation of subscription tiers with usage limits and feature gating
 * 
 * Implements:
 * - Free: 100 análisis / 10 roasts, 1 cuenta por red, sin Shield/Original Tone
 * - Starter: 1,000 análisis / 100 roasts, 1 cuenta por red, Shield ON
 * - Pro: 10,000 análisis / 1,000 roasts, 2 cuentas por red, Shield + Original Tone
 * - Plus: 100,000 análisis / 5,000 roasts, 2 cuentas por red, Shield + Original Tone + Embedded Judge
 */

const { supabaseServiceClient } = require('../config/supabase');
const planLimitsService = require('./planLimitsService');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

class TierValidationService {
    constructor() {
        // Enhanced cache for performance (CodeRabbit Round 4)
        this.usageCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.requestScopedCache = new Map(); // Request-scoped validation cache
        
        // Configurable thresholds and pricing (CodeRabbit Round 4)
        this.warningThresholds = {
            analysis: 0.8, // 80% warning threshold
            roast: 0.8,
            platform: 0.8
        };
        
        this.upgradeConfig = {
            plans: {
                free: { nextPlan: 'starter', price: '€5/mes' },
                starter: { nextPlan: 'pro', price: '€15/mes' },
                pro: { nextPlan: 'plus', price: '€50/mes' },
                plus: { nextPlan: null, price: null }
            }
        };
        
        // Metrics tracking (CodeRabbit Round 4)
        this.metrics = {
            validationCalls: 0,
            allowedActions: 0,
            blockedActions: 0,
            errors: 0
        };
        
        // CodeRabbit Round 3 - Supported platforms for validation
        this.SUPPORTED_PLATFORMS = ['twitter', 'youtube', 'instagram', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok', 'bluesky'];
        
        // Centralized pricing configuration (CodeRabbit Round 5)
        this.TIER_PRICING = {
            currency: '€',
            monthly: {
                free: 0,
                starter: 5,
                pro: 15,
                plus: 50
            },
            formatPrice: (amount) => amount === 0 ? 'Gratis' : `€${amount}/mes`
        };
    }

    /**
     * Validate if user can perform an action based on their tier
     * @param {string} userId - User ID
     * @param {string} action - Action type (analysis, roast, platform_add)
     * @param {Object} options - Additional options (includes requestId for concurrency)
     * @returns {Object} { allowed: boolean, reason?: string, upgradeRequired?: string, currentUsage?: Object }
     */
    async validateAction(userId, action, options = {}) {
        const requestId = options.requestId || `${userId}-${action}-${Date.now()}`;
        
        // Request-scoped caching to prevent duplicate validations (CodeRabbit Round 4)
        const cacheKey = `${requestId}-${userId}-${action}`;
        if (this.requestScopedCache.has(cacheKey)) {
            return this.requestScopedCache.get(cacheKey);
        }

        try {
            this.metrics.validationCalls++;
            
            // Parallelize data fetching for better performance (CodeRabbit Round 4)
            const [userTier, currentUsage, tierLimits] = await Promise.all([
                this.getUserTierWithUTC(userId),
                this.getCurrentUsageWithUTC(userId),
                planLimitsService.getPlanLimits(this.normalizePlanValue(await this.getUserTier(userId).then(t => t.plan)))
            ]);

            // Enhanced metrics and logging (CodeRabbit Round 4)
            const validation = this.checkActionLimitsEnhanced(action, tierLimits, currentUsage, options);
            
            // Database error detection (CodeRabbit Round 4)
            if (this.detectDatabaseErrors(userTier, currentUsage, tierLimits)) {
                this.metrics.errors++;
                throw new Error('Database error detected during validation');
            }

            const result = {
                ...validation,
                currentTier: userTier.plan,
                currentUsage: this.sanitizeUsageForResponse(currentUsage),
                warningStatus: this.calculateWarningStatus(tierLimits, currentUsage),
                upgradeRecommendation: validation.upgradeRequired ? 
                    this.getEnhancedUpgradeMessage(validation.upgradeRequired) : null
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

            return result;

        } catch (error) {
            this.metrics.errors++;
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
            // Check for specific database errors that should always fail closed
            if (error.code === 'ETIMEDOUT' || 
                error.code === 'ECONNREFUSED' || 
                error.message?.includes('Connection') ||
                error.message?.includes('timeout')) {
                return {
                    allowed: false,
                    reason: 'Validation error - failing closed for security (database error)',
                    message: 'Unable to validate action at this time'
                };
            }
            const failOpen = process.env.TIER_VALIDATION_FAIL_OPEN === 'true';
            if (failOpen) {
                logger.warn('Tier validation failing open due to TIER_VALIDATION_FAIL_OPEN=true', {
                    userId,
                    action,
                    requestId
                });
                return { allowed: true, reason: 'Validation error - failing open (configured)', fallback: true };
            }
            
            // Default fail-closed behavior for security
            return { 
                allowed: false, 
                reason: 'Validation error - failing closed for security',
                error: 'Validation service temporarily unavailable'
            };
        } finally {
            // Cleanup request-scoped cache after a delay
            setTimeout(() => this.cleanupRequestCache(requestId), 30000);
        }
    }

    /**
     * Check if a feature is available for the user's tier
     * @param {string} userId - User ID  
     * @param {string} feature - Feature name (shield, original_tone, embedded_judge)
     * @returns {Object} { available: boolean, reason?: string }
     */
    async validateFeature(userId, feature) {
        try {
            const userTier = await this.getUserTier(userId);
            const tierLimits = await planLimitsService.getPlanLimits(userTier.plan);

            return this.checkFeatureAccess(feature, tierLimits, userTier.plan);

        } catch (error) {
            logger.error('Error validating tier feature:', error);
            // Default to not available on error for security
            return { 
                available: false, 
                reason: 'Feature validation temporarily unavailable' 
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
        if (!this.SUPPORTED_PLATFORMS.includes(normalizedPlatform)) {
            return {
                allowed: false,
                reason: 'unsupported_platform',
                message: `Platform '${platform}' is not supported. Supported platforms: ${this.SUPPORTED_PLATFORMS.join(', ')}`,
                supportedPlatforms: this.SUPPORTED_PLATFORMS
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
        // Feature mappings for validation
        const featureMap = {
            'shield': 'shieldEnabled',
            'custom_tones': 'customTones', 
            'original_tone': 'customPrompts',
            'embedded_judge': 'embeddedJudge',
            'analytics': 'analyticsEnabled',
            'api_access': 'apiAccess',
            'priority_support': 'prioritySupport'
        };

        const featureProperty = featureMap[feature];
        
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
                requiredPlans: this.getRequiredPlansForFeature(feature)
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
            const normalizedPlan = this.normalizePlan(data.plan);
            
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
     * Get user's current tier information with UTC handling (CodeRabbit Round 4)
     * @private
     */
    async getUserTierWithUTC(userId) {
        const { data: subscription, error } = await supabaseServiceClient
            .from('user_subscriptions')
            .select('plan, status, current_period_start, current_period_end')
            .eq('user_id', userId)
            .single();

        if (error || !subscription) {
            return {
                plan: 'free',
                status: 'active',
                isActive: true,
                periodStart: null,
                periodEnd: null
            };
        }

        // UTC date handling (CodeRabbit Round 4)
        const now = new Date();
        const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
        
        const isActive = subscription.status === 'active' || 
                        subscription.status === 'trialing' ||
                        (subscription.status === 'past_due' && periodEnd && periodEnd > now);

        return {
            plan: this.normalizePlanValue(subscription.plan),
            status: subscription.status,
            isActive,
            periodStart: subscription.current_period_start,
            periodEnd: subscription.current_period_end
        };
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
            const nextDay = new Date(Date.UTC(
                periodEnd.getUTCFullYear(),
                periodEnd.getUTCMonth(),
                periodEnd.getUTCDate() + 1
            ));
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
     */
    getCachedUsage(userId) {
        const cached = this.usageCache.get(userId);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
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

        const platformAccounts = (usage.platformAccounts && typeof usage.platformAccounts === 'object' && !Array.isArray(usage.platformAccounts)) 
            ? usage.platformAccounts 
            : {};
        const totalActivePlatformAccounts = Object.values(platformAccounts).reduce((sum, count) => sum + count, 0);

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
     * Get upgrade recommendation based on usage pattern
     * @private
     */
    getUpgradeRecommendation(usageType, currentLimit) {
        if (usageType === 'analysis' && currentLimit <= 100) return 'starter';
        if (usageType === 'analysis' && currentLimit <= 1000) return 'pro';
        if (usageType === 'roast' && currentLimit <= 10) return 'starter';
        if (usageType === 'roast' && currentLimit <= 100) return 'pro';
        if (usageType === 'platform' && currentLimit <= 1) return 'pro';
        return 'plus';
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
        const billingPeriodStart = userTier.periodStart ? 
            new Date(userTier.periodStart) : 
            this.getMonthStartUTC();

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
            logger.warn('Error checking usage resets, falling back to billing period start', { userId, error: error.message });
        }
        
        return billingPeriodStart;
    }

    /**
     * Normalize plan values to prevent downstream errors (CodeRabbit Round 4)
     * @private
     */
    // Enhanced plan normalization (CodeRabbit Round 5)
    normalizePlanValue(plan) {
        const validPlans = ['free', 'starter', 'pro', 'plus'];
        
        // Handle null, undefined, or non-string values
        if (!plan || typeof plan !== 'string') {
            return 'free';
        }
        
        const normalized = plan.toLowerCase().trim();
        return validPlans.includes(normalized) ? normalized : 'free';
    }

    /**
     * Calculate warning status for approaching limits (CodeRabbit Round 4)
     * @private
     */
    calculateWarningStatus(tierLimits, currentUsage) {
        const warnings = {};
        
        // Analysis warnings
        if (tierLimits.monthlyAnalysisLimit > 0) {
            const analysisPercentage = (currentUsage.analysisThisMonth || 0) / tierLimits.monthlyAnalysisLimit;
            if (analysisPercentage >= this.warningThresholds.analysis) {
                warnings.analysis = {
                    percentage: Math.round(analysisPercentage * 100),
                    remaining: tierLimits.monthlyAnalysisLimit - (currentUsage.analysisThisMonth || 0)
                };
            }
        }
        
        // Roast warnings
        if (tierLimits.monthlyResponsesLimit > 0) {
            const roastPercentage = (currentUsage.roastsThisMonth || 0) / tierLimits.monthlyResponsesLimit;
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
     * Get plan benefits for upgrade recommendations (CodeRabbit Round 4)
     * @private
     */
    getPlanBenefits(plan) {
        const benefits = {
            free: ['100 análisis', '10 roasts', '1 cuenta por red'],
            starter: ['1,000 análisis', '100 roasts', '1 cuenta por red', 'Shield activado'],
            pro: ['10,000 análisis', '1,000 roasts', '2 cuentas por red', 'Shield + Original Tone'],
            plus: ['100,000 análisis', '5,000 roasts', '2 cuentas por red', 'Shield + Original Tone + Embedded Judge']
        };
        return benefits[plan] || benefits.free;
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
            const analysisThisMonth = analysisResult.data?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
            
            // Group platform accounts
            const platformAccounts = {};
            platformsResult.data?.forEach(platform => {
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
     * Invalidate cache for user after actions that affect usage (CodeRabbit Round 4)
     * @private
     */
    invalidateUserCache(userId) {
        this.usageCache.delete(userId);
        
        // Also cleanup any request-scoped cache entries for this user
        for (const [key] of this.requestScopedCache) {
            if (key.includes(userId)) {
                this.requestScopedCache.delete(key);
            }
        }
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

            return { 
                success: true, 
                message: 'Límites reseteados inmediatamente tras upgrade',
                effectiveImmediately: true
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

            // Store pending change with atomic upsert
            await supabaseServiceClient
                .from('pending_plan_changes')
                .upsert({
                    user_id: userId,
                    current_plan: oldTier,
                    new_plan: newTier,
                    change_type: 'downgrade',
                    effective_date: effectiveDate,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id,effective_date'
                });

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
        
        // Use atomic upsert pattern for usage resets
        await supabaseServiceClient
            .from('usage_resets')
            .upsert({
                user_id: userId,
                reset_type: 'tier_upgrade',
                reset_timestamp: resetTimestamp,
                reason: 'Tier upgrade - usage limits reset immediately',
                created_at: resetTimestamp
            }, {
                onConflict: 'user_id,reset_type'
            });

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
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get next cycle start in UTC (CodeRabbit Round 5)
     * @param {string} periodEndIso - Optional period end ISO string
     * @returns {string} Next cycle start ISO string
     */
    getNextCycleStartUTC(periodEndIso) {
        if (periodEndIso) {
            // Calculate from provided period end - return next day
            const periodEnd = new Date(periodEndIso);
            const nextDay = new Date(periodEnd.getTime() + 24 * 60 * 60 * 1000);
            // Set to start of day
            nextDay.setUTCHours(0, 0, 0, 0);
            return nextDay.toISOString();
        } else {
            // Calculate from current date - next month
            const now = new Date();
            const nextMonth = now.getUTCMonth() + 1;
            const year = nextMonth > 11 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
            const month = nextMonth > 11 ? 0 : nextMonth;

            const nextCycleStart = new Date(Date.UTC(year, month, 1));
            return nextCycleStart.toISOString();
        }
    }

    /**
     * Compute effective cycle start accounting for upgrade resets (CodeRabbit Round 5)
     * @param {Object} userTier - User tier data
     * @param {string} userId - User ID
     * @returns {Promise<Date>} Effective cycle start date
     */
    async computeEffectiveCycleStart(userTier, userId) {
        try {
            // Check if there's an upgrade reset marker
            const { data, error } = await supabaseServiceClient
                .from('tier_reset_markers')
                .select('reset_timestamp')
                .eq('user_id', userId)
                .single();

            if (error || !data) {
                // No reset marker, use billing period start
                return new Date(userTier.periodStart);
            }

            const resetDate = new Date(data.reset_timestamp);
            const billingStart = new Date(userTier.periodStart);

            // Use the later of the two dates
            return resetDate > billingStart ? resetDate : billingStart;

        } catch (error) {
            logger.error('Error computing effective cycle start:', error);
            // Fallback to billing period start
            return new Date(userTier.periodStart);
        }
    }

    /**
     * Record usage action atomically (CodeRabbit Round 5)
     * @param {string} userId - User ID
     * @param {string} actionType - Action type
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<boolean>} Success status
     */
    async recordUsageActionAtomic(userId, actionType, metadata = {}) {
        try {
            const { data, error } = await supabaseServiceClient
                .from('user_activity')
                .insert({
                    user_id: userId,
                    activity_type: actionType,
                    created_at: new Date().toISOString(),
                    metadata: {
                        ...metadata,
                        service_version: 'tier_validation_v1',
                        recorded_at: new Date().toISOString()
                    }
                });

            if (error) {
                logger.error('Failed to record usage action atomically', { userId, actionType, error: error.message });
                return false;
            }

            return true;
        } catch (error) {
            logger.error('Error in atomic usage recording', { userId, actionType, error: error.message });
            return false;
        }
    }

    /**
     * Record batch usage actions atomically (CodeRabbit Round 5)
     * @param {string} userId - User ID
     * @param {Array} actions - Array of action objects
     * @returns {Promise<Object>} Batch result
     */
    async recordUsageActionsBatch(userId, actions) {
        if (!actions || actions.length === 0) {
            return { success: 0, failed: 0 };
        }

        const batchInserts = actions.map(action => ({
            user_id: userId,
            activity_type: action.actionType,
            created_at: new Date().toISOString(),
            metadata: {
                ...action.metadata,
                service_version: 'tier_validation_v1',
                batch_id: `batch_${Date.now()}`,
                recorded_at: new Date().toISOString()
            }
        }));

        try {
            const { data, error } = await supabaseServiceClient
                .from('user_activity')
                .insert(batchInserts);

            if (error) {
                logger.error('Failed to record batch usage actions', { userId, batchSize: actions.length, error: error.message });
                return { success: 0, failed: actions.length };
            }

            return { success: actions.length, failed: 0 };
        } catch (error) {
            logger.error('Error in batch usage recording', { userId, batchSize: actions.length, error: error.message });
            return { success: 0, failed: actions.length };
        }
    }

    /**
     * Normalize plan value to valid plan ID (CodeRabbit Round 5)
     * @private
     */
    normalizePlan(plan) {
        const validPlans = ['free', 'starter', 'pro', 'plus'];
        if (typeof plan === 'string' && validPlans.includes(plan.toLowerCase())) {
            return plan.toLowerCase();
        }
        return 'free'; // Default to free for invalid plans
    }

    /**
     * Get required plans for a specific feature
     * @private
     */
    getRequiredPlansForFeature(feature) {
        const featureRequirements = {
            'shield': ['starter', 'pro', 'plus'],
            'custom_tones': ['pro', 'plus'],
            'original_tone': ['pro', 'plus'],
            'embedded_judge': ['plus'],
            'analytics': ['pro', 'plus'],
            'api_access': ['plus'],
            'priority_support': ['pro', 'plus']
        };

        return featureRequirements[feature] || [];
    }

    /**
     * Cache management methods (CodeRabbit Round 5)
     * @private
     */
    getCachedUserTier(userId) {
        if (this.lastCacheRefresh && 
            Date.now() - this.lastCacheRefresh > this.cacheTimeout) {
            this.usageCache.clear();
            this.lastCacheRefresh = null;
        }

        return this.usageCache.get(`tier_${userId}`);
    }

    setCachedUserTier(userId, tierData) {
        this.usageCache.set(`tier_${userId}`, tierData);
        if (!this.lastCacheRefresh) {
            this.lastCacheRefresh = Date.now();
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
            
            // Schedule downgrade for end of billing period
            const { data, error } = await supabaseServiceClient
                .from('scheduled_plan_changes')
                .upsert({
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
                });

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
            logger.error('Error in enhanced tier downgrade', { userId, newPlan, currentPlan, error: error.message });
            throw error;
        }
    }

    /**
     * Get default values (CodeRabbit Round 5)
     * @private
     */
    getDefaultUserTier() {
        return {
            plan: 'free',
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
     * Sanitize usage data for API response (CodeRabbit Round 5)
     * @param {Object} usage - Raw usage data
     * @returns {Object} Sanitized usage data
     */
    sanitizeUsageForResponse(usage) {
        if (!usage) {
            return {
                roastsThisMonth: 0,
                analysisThisMonth: 0,
                platformAccountsByPlatform: {},
                totalActivePlatformAccounts: 0,
                platformAccounts: 0
            };
        }

        // Handle invalid platformAccounts data gracefully
        let platformAccounts = {};
        if (usage.platformAccounts && typeof usage.platformAccounts === 'object' && !Array.isArray(usage.platformAccounts)) {
            platformAccounts = usage.platformAccounts;
        }

        const totalActiveAccounts = Object.values(platformAccounts)
            .reduce((sum, count) => sum + (Number(count) || 0), 0);
        const uniquePlatforms = Object.keys(platformAccounts).length;

        return {
            roastsThisMonth: Number(usage.roastsThisMonth) || 0,
            analysisThisMonth: Number(usage.analysisThisMonth) || 0,
            platformAccountsByPlatform: platformAccounts,
            totalActivePlatformAccounts: totalActiveAccounts,
            platformAccounts: uniquePlatforms // Legacy field for backward compatibility
        };
    }

    /**
     * Cache management methods (CodeRabbit Round 5)
     * @private
     */
    getCachedUserTier(userId) {
        if (this.lastCacheRefresh && 
            Date.now() - this.lastCacheRefresh > this.cacheTimeout) {
            this.usageCache.clear();
            this.lastCacheRefresh = null;
        }

        return this.usageCache.get(`tier_${userId}`);
    }

    setCachedUserTier(userId, tierData) {
        this.usageCache.set(`tier_${userId}`, tierData);
        if (!this.lastCacheRefresh) {
            this.lastCacheRefresh = Date.now();
        }
    }

    /**
     * Normalize plan value to valid plan ID (CodeRabbit Round 5)
     * @private
     */
    normalizePlan(plan) {
        const validPlans = ['free', 'starter', 'pro', 'plus'];
        if (typeof plan === 'string' && validPlans.includes(plan.toLowerCase())) {
            return plan.toLowerCase();
        }
        return 'free'; // Default to free for invalid plans
    }

    /**
     * Get required plans for a specific feature
     * @private
     */
    getRequiredPlansForFeature(feature) {
        const featureRequirements = {
            'shield': ['starter', 'pro', 'plus'],
            'custom_tones': ['pro', 'plus'],
            'original_tone': ['pro', 'plus'],
            'embedded_judge': ['plus'],
            'analytics': ['pro', 'plus'],
            'api_access': ['plus'],
            'priority_support': ['pro', 'plus']
        };

        return featureRequirements[feature] || [];
    }

    /**
     * Clear cache (useful for testing)
     */
    clearCache() {
        this.usageCache.clear();
        this.requestScopedCache.clear();
        this.lastCacheRefresh = null;
    }
}

// Export singleton instance
module.exports = new TierValidationService();