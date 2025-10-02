const { logger } = require('../utils/logger');
const ShieldDecisionEngine = require('./shieldDecisionEngine');
const CostControlService = require('./costControl');
const planLimitsService = require('./planLimitsService');
const AnalyzeToxicityWorker = require('../workers/AnalyzeToxicityWorker');
const crypto = require('crypto');

/**
 * Triage Service - Deterministic comment routing system
 * 
 * Routes comments to appropriate destinations: block/roast/publish
 * Based on toxicity analysis, plan configuration, and Shield decisions
 * 
 * Integration with existing services:
 * - Uses ShieldDecisionEngine for complex moderation decisions
 * - Leverages AnalyzeToxicityWorker for consistent analysis
 * - Respects CostControlService plan limits and permissions
 * - Follows same caching and idempotency patterns as Shield system
 */
class TriageService {
  constructor() {
    this.shieldDecisionEngine = new ShieldDecisionEngine();
    this.costControl = new CostControlService();
    this.planLimits = planLimitsService;
    this.toxicityWorker = new AnalyzeToxicityWorker();
    
    // Decision matrix - integrates with existing Shield thresholds
    this.decisionMatrix = {
      // Block threshold - aligns with Shield critical level
      BLOCK_THRESHOLD: 0.85,
      
      // Plan-specific roast thresholds - business logic layer
      ROAST_THRESHOLDS: {
        free: 0.30,      // More restrictive for free users
        starter: 0.30,   // Same as free
        pro: 0.25,       // Pro users get more sensitive detection
        plus: 0.20,      // Plus users get most sensitive
        creator_plus: 0.20
      },
      
      // Shield integration thresholds
      SHIELD_ENABLED_PLANS: ['starter', 'pro', 'plus', 'creator_plus'],
      
      // Cache configuration - matches Shield patterns
      CACHE_TTL_MS: 300000, // 5 minutes
      MAX_CACHE_SIZE: 1000
    };
    
    // Decision cache with same patterns as ShieldDecisionEngine
    this.decisionCache = new Map();
    this.cacheStats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Main triage analysis and routing function
   * 
   * @param {Object} comment - Comment data to analyze
   * @param {Object} organization - Organization context with plan info
   * @param {Object} user - User context (optional)
   * @param {Object} options - Additional options for analysis
   * @returns {Promise<Object>} Triage decision with routing information
   */
  async analyzeAndRoute(comment, organization, user = null, options = {}) {
    const startTime = Date.now();
    const correlationId = options.correlation_id || this.generateCorrelationId();
    
    logger.info('Starting triage analysis', {
      correlation_id: correlationId,
      organization_id: organization.id,
      comment_id: comment.id,
      plan: organization.plan,
      user_id: user?.id
    });

    try {
      // Check for cached decision first
      const cacheKey = this.generateCacheKey(comment, organization, user);
      const cachedDecision = this.getCachedDecision(cacheKey);
      if (cachedDecision) {
        logger.debug('Returning cached triage decision', {
          correlation_id: correlationId,
          cache_hit: true
        });
        return this.enrichDecisionWithMetadata(cachedDecision, correlationId, startTime);
      }

      // Input validation with security checks
      const validationResult = this.validateInput(comment, organization);
      if (!validationResult.isValid) {
        const decision = this.createDecision('skip', 'validation_failed', {
          validation_errors: validationResult.errors,
          correlation_id: correlationId
        });
        return this.cacheAndReturn(cacheKey, decision, correlationId, startTime);
      }

      // Check plan permissions and limits
      const permissionCheck = await this.checkPlanPermissions(organization, correlationId);
      if (!permissionCheck.allowed) {
        const decision = this.createDecision('defer', 'plan_limit_exceeded', {
          limit_info: permissionCheck,
          correlation_id: correlationId
        });
        return this.cacheAndReturn(cacheKey, decision, correlationId, startTime);
      }

      // Perform toxicity analysis using existing worker
      const toxicityAnalysis = await this.analyzeToxicity(comment, organization, correlationId);
      
      // Make routing decision based on analysis
      const decision = await this.makeRoutingDecision(
        comment,
        organization,
        toxicityAnalysis,
        user,
        correlationId
      );

      // Cache the decision and return
      return this.cacheAndReturn(cacheKey, decision, correlationId, startTime);

    } catch (error) {
      logger.error('Triage analysis failed', {
        correlation_id: correlationId,
        organization_id: organization.id,
        comment_id: comment.id,
        error: error.message,
        stack: error.stack
      });

      const decision = this.createDecision('error', 'triage_failed', {
        error: error.message,
        correlation_id: correlationId
      });
      return this.enrichDecisionWithMetadata(decision, correlationId, startTime);
    }
  }

  /**
   * Validate input with security checks
   * Follows same patterns as ShieldDecisionEngine
   */
  validateInput(comment, organization) {
    const errors = [];

    // Basic validation
    if (!comment || !comment.content || typeof comment.content !== 'string') {
      errors.push('invalid_comment_content');
    }

    if (!organization || !organization.id || !organization.plan) {
      errors.push('invalid_organization');
    }

    // Content length validation
    if (comment.content && comment.content.length > 10000) {
      errors.push('content_too_long');
    }

    // Security checks - prompt injection detection
    if (comment.content) {
      const securityPatterns = [
        /\{\{.*\}\}/, // Template injection
        /\$\{.*\}/, // Variable injection
        /<script.*>/i, // XSS attempts
        /javascript:/i, // Protocol injection
        /data:.*base64/i // Data URI injection
      ];

      for (const pattern of securityPatterns) {
        if (pattern.test(comment.content)) {
          logger.warn('Security pattern detected in comment', {
            comment_id: comment.id,
            organization_id: organization.id,
            security_flag: 'potential_injection'
          });
          errors.push('security_pattern_detected');
          break;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check plan permissions and limits
   * Integrates with existing CostControlService
   */
  async checkPlanPermissions(organization, correlationId) {
    try {
      // Check if organization can perform triage operations
      const canOperate = await this.costControl.canPerformOperation(
        organization.id,
        'triage_analysis',
        1,
        'internal'
      );

      if (!canOperate.allowed) {
        logger.warn('Plan limit exceeded for triage', {
          correlation_id: correlationId,
          organization_id: organization.id,
          plan: organization.plan,
          limit_type: canOperate.limitType
        });
      }

      return canOperate;

    } catch (error) {
      logger.error('Failed to check plan permissions', {
        correlation_id: correlationId,
        organization_id: organization.id,
        error: error.message
      });

      // Fail-closed: deny on error
      return {
        allowed: false,
        reason: 'permission_check_failed'
      };
    }
  }

  /**
   * Perform toxicity analysis using existing worker
   * Leverages AnalyzeToxicityWorker for consistency
   */
  async analyzeToxicity(comment, organization, correlationId) {
    const startTime = Date.now();

    try {
      // Use existing toxicity worker for consistent analysis
      const analysis = await this.toxicityWorker.analyzeToxicity(comment.content);
      
      logger.debug('Toxicity analysis completed', {
        correlation_id: correlationId,
        toxicity_score: analysis.toxicity,
        categories: analysis.categories,
        analysis_time_ms: Date.now() - startTime
      });

      return {
        ...analysis,
        analysis_time_ms: Date.now() - startTime,
        correlation_id: correlationId
      };

    } catch (error) {
      logger.error('Toxicity analysis failed', {
        correlation_id: correlationId,
        error: error.message
      });

      // Fallback to conservative analysis
      return {
        toxicity: 0.5, // Conservative middle ground
        categories: ['TOXICITY'],
        confidence: 0.1,
        fallback_used: true,
        analysis_time_ms: Date.now() - startTime
      };
    }
  }

  /**
   * Make routing decision based on analysis
   * Core business logic for triage routing
   */
  async makeRoutingDecision(comment, organization, toxicityAnalysis, user, correlationId) {
    const decisionStartTime = Date.now();
    const plan = organization.plan;
    const toxicityScore = toxicityAnalysis.toxicity;
    
    // Get plan-specific threshold
    const roastThreshold = this.decisionMatrix.ROAST_THRESHOLDS[plan] || 
                          this.decisionMatrix.ROAST_THRESHOLDS.free;

    let action = 'publish';
    let reasoning = 'content_safe_for_publication';
    let shieldDecision = null;

    // Decision logic based on toxicity levels
    if (toxicityScore >= this.decisionMatrix.BLOCK_THRESHOLD) {
      action = 'block';
      reasoning = 'high_toxicity_threshold_exceeded';

      // Integrate with Shield system for paid plans
      if (this.decisionMatrix.SHIELD_ENABLED_PLANS.includes(plan)) {
        shieldDecision = await this.getShieldDecision(comment, organization, toxicityAnalysis, correlationId);
      }

    } else if (toxicityScore >= roastThreshold) {
      action = 'roast';
      reasoning = 'toxicity_suitable_for_roasting';
      
      // Check roast generation limits
      const canRoast = await this.checkRoastCapacity(organization, correlationId);
      if (!canRoast.allowed) {
        action = 'defer';
        reasoning = 'roast_capacity_exceeded';
      }
    }

    // Create comprehensive decision object
    const decision = this.createDecision(action, reasoning, {
      correlation_id: correlationId,
      toxicity_score: toxicityScore,
      toxicity_categories: toxicityAnalysis.categories,
      confidence: toxicityAnalysis.confidence,
      plan: plan,
      plan_threshold: roastThreshold,
      shield_decision: shieldDecision,
      user_id: user?.id,
      user_preferences: user?.preferences,
      decision_time_ms: Date.now() - decisionStartTime,
      fallback_used: toxicityAnalysis.fallback_used || false
    });

    // Log decision for audit trail
    this.logDecision(decision, comment, organization, user);

    return decision;
  }

  /**
   * Get Shield decision for toxic content
   * Integrates with existing ShieldDecisionEngine
   */
  async getShieldDecision(comment, organization, toxicityAnalysis, correlationId) {
    try {
      const shieldInput = {
        organizationId: organization.id,
        platform: comment.platform || 'unknown',
        accountRef: comment.account_ref || 'triage_system',
        externalCommentId: comment.id,
        externalAuthorId: comment.author_id || 'unknown',
        externalAuthorUsername: comment.author || 'unknown',
        originalText: comment.content,
        toxicityAnalysis: toxicityAnalysis,
        metadata: {
          triage_source: true,
          correlation_id: correlationId
        }
      };

      const shieldDecision = await this.shieldDecisionEngine.makeDecision(shieldInput);
      
      logger.info('Shield decision obtained', {
        correlation_id: correlationId,
        shield_action: shieldDecision.action,
        shield_severity: shieldDecision.severity
      });

      return shieldDecision;

    } catch (error) {
      logger.error('Shield decision failed', {
        correlation_id: correlationId,
        error: error.message
      });

      return null; // Continue without Shield if it fails
    }
  }

  /**
   * Check roast generation capacity
   * Uses existing cost control for consistent limiting
   */
  async checkRoastCapacity(organization, correlationId) {
    try {
      const canRoast = await this.costControl.canPerformOperation(
        organization.id,
        'roast_generation',
        1,
        'internal'
      );

      if (!canRoast.allowed) {
        logger.warn('Roast capacity exceeded', {
          correlation_id: correlationId,
          organization_id: organization.id,
          limit_type: canRoast.limitType
        });
      }

      return canRoast;

    } catch (error) {
      logger.error('Failed to check roast capacity', {
        correlation_id: correlationId,
        error: error.message
      });

      // Fail-open for roast checking (less critical than security)
      return { allowed: true };
    }
  }

  /**
   * Generate cache key for decision caching
   * Uses same HMAC approach as ShieldDecisionEngine
   */
  generateCacheKey(comment, organization, user) {
    const keyData = {
      content: comment.content,
      organization_id: organization.id,
      plan: organization.plan,
      user_id: user?.id,
      preferences: user?.preferences
    };

    const keyString = JSON.stringify(keyData);
    return crypto.createHmac('sha256', 'triage_cache_key')
                 .update(keyString)
                 .digest('hex');
  }

  /**
   * Get cached decision if available and valid
   */
  getCachedDecision(cacheKey) {
    const cached = this.decisionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.decisionMatrix.CACHE_TTL_MS) {
      this.cacheStats.hits++;
      return cached.decision;
    }

    if (cached) {
      this.decisionCache.delete(cacheKey); // Remove expired entry
    }

    this.cacheStats.misses++;
    return null;
  }

  /**
   * Cache decision and return with metadata
   */
  cacheAndReturn(cacheKey, decision, correlationId, startTime) {
    // Cache the decision
    this.decisionCache.set(cacheKey, {
      decision: decision,
      timestamp: Date.now()
    });

    // Evict old entries if cache is too large
    if (this.decisionCache.size > this.decisionMatrix.MAX_CACHE_SIZE) {
      const firstKey = this.decisionCache.keys().next().value;
      this.decisionCache.delete(firstKey);
      this.cacheStats.evictions++;
    }

    return this.enrichDecisionWithMetadata(decision, correlationId, startTime);
  }

  /**
   * Enrich decision with timing and cache metadata
   */
  enrichDecisionWithMetadata(decision, correlationId, startTime) {
    return {
      ...decision,
      correlation_id: correlationId,
      total_time_ms: Date.now() - startTime,
      cache_stats: {
        hits: this.cacheStats.hits,
        misses: this.cacheStats.misses,
        hit_ratio: (this.cacheStats.hits + this.cacheStats.misses) > 0
          ? this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses)
          : 0
      }
    };
  }

  /**
   * Create standardized decision object
   */
  createDecision(action, reasoning, metadata = {}) {
    return {
      action,
      reasoning,
      timestamp: new Date().toISOString(),
      ...metadata
    };
  }

  /**
   * Generate correlation ID for request tracing
   */
  generateCorrelationId() {
    return `triage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log decision for audit trail and monitoring
   */
  logDecision(decision, comment, organization, user) {
    logger.info('Triage decision completed', {
      ...decision,
      organization_id: organization.id,
      comment_id: comment.id,
      audit_trail: {
        timestamp: decision.timestamp,
        user_id: user?.id,
        organization_id: organization.id,
        action_type: 'triage_decision',
        data_processed: {
          content_length: comment.content.length,
          toxicity_score: decision.toxicity_score,
          decision: decision.action
        }
      }
    });
  }

  /**
   * Get triage statistics for monitoring and analytics
   */
  async getTriageStats(organizationId, timeRange = '1h') {
    // This would query from database in production
    // For now, return cache statistics and basic metrics
    return {
      cache_performance: {
        hits: this.cacheStats.hits,
        misses: this.cacheStats.misses,
        hit_ratio: (this.cacheStats.hits + this.cacheStats.misses) > 0 
          ? this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses)
          : 0,
        cache_size: this.decisionCache.size
      },
      thresholds: {
        block_threshold: this.decisionMatrix.BLOCK_THRESHOLD,
        roast_thresholds: this.decisionMatrix.ROAST_THRESHOLDS
      },
      time_range: timeRange,
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Clear cache - useful for testing and configuration changes
   */
  clearCache() {
    this.decisionCache.clear();
    this.cacheStats = { hits: 0, misses: 0, evictions: 0 };
    logger.info('Triage decision cache cleared');
  }
}

module.exports = new TriageService();