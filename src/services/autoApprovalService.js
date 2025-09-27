/**
 * Auto-Approval Service - Round 4 Security Enhancements
 * Implements fail-closed security patterns, rate limiting, and transparency enforcement
 */

const { supabaseServiceClient } = require('../config/supabase');
const { logger } = require('../utils/logger');
const transparencyService = require('./transparencyService');
const planLimitsService = require('./planLimitsService');

class AutoApprovalService {
  constructor() {
    this.config = {
      // Conservative toxicity thresholds (Round 3 fix)
      maxToxicityScore: 0.6, // Reduced from 0.7
      maxToxicityIncrease: 0.15,
      
      // Rate limiting (per hour/day)
      maxHourlyApprovals: 50,
      maxDailyApprovals: 200,
      
      // Timeouts (Round 4 enhancement)
      healthCheckTimeout: 1000,
      queryTimeout: 3000,
      transparencyTimeout: 2000,
    };
  }

  /**
   * Check if organization is eligible for auto-approval
   * SECURITY: Fail-closed pattern - any error denies approval
   */
  async checkAutoApprovalEligibility(organizationId) {
    // ROUND 4 FIX: Enhanced input validation
    if (!organizationId || typeof organizationId !== 'string' || organizationId.trim() === '') {
      logger.warn('Auto-approval eligibility check failed: Invalid organization ID', {
        organizationId,
        reason: 'invalid_input'
      });
      return { eligible: false, reason: 'invalid_input' };
    }

    try {
      // ROUND 4 FIX: Enhanced database connectivity check with timeout
      const healthCheckStart = Date.now();
      let connectionHealthy = true;
      
      try {
        const healthCheck = await Promise.race([
          supabaseServiceClient.from('organizations').select('id').limit(1),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), this.config.healthCheckTimeout)
          )
        ]);
        
        if (healthCheck.error) {
          connectionHealthy = false;
          logger.error('CRITICAL: Database health check failed during eligibility check', {
            organizationId,
            healthCheckDuration: Date.now() - healthCheckStart,
            error: healthCheck.error.message,
            errorCode: healthCheck.error.code || 'unknown',
            reason: 'health_check_query_error'
          });
        }
      } catch (healthError) {
        connectionHealthy = false;
        logger.error('CRITICAL: Database health check timeout during eligibility check', {
          organizationId,
          healthCheckDuration: Date.now() - healthCheckStart,
          error: healthError.message,
          reason: 'health_check_timeout'
        });
      }

      // ROUND 4 FIX: Fail closed if database is unhealthy
      if (!connectionHealthy) {
        return { 
          eligible: false, 
          reason: 'system_error',
          error: 'Database connectivity verification failed'
        };
      }

      // Query organization with timeout protection
      const orgQuery = await Promise.race([
        supabaseServiceClient
          .from('organizations')
          .select('plan, settings')
          .eq('id', organizationId)
          .single(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Organization query timeout')), this.config.queryTimeout)
        )
      ]);

      // ROUND 4 FIX: Enhanced error handling
      if (orgQuery.error) {
        logger.error('Failed to get organization for auto-approval eligibility', {
          organizationId,
          error: orgQuery.error.message,
          errorCode: orgQuery.error.code || 'unknown',
          reason: 'organization_query_error'
        });
        return { eligible: false, reason: 'organization_not_found' };
      }

      const organization = orgQuery.data;
      
      // ROUND 4 FIX: Enhanced validation
      if (!organization || !organization.plan) {
        logger.error('Organization data incomplete for auto-approval eligibility', {
          organizationId,
          hasData: !!organization,
          hasPlan: !!(organization && organization.plan),
          reason: 'incomplete_organization_data'
        });
        return { eligible: false, reason: 'organization_not_found' };
      }

      // Check plan eligibility
      const planEligible = ['pro', 'plus', 'creator_plus'].includes(organization.plan);
      const settingsEnabled = organization.settings?.auto_approval === true;

      // ROUND 4 FIX: Plan-specific limits validation
      const planLimits = await planLimitsService.getPlanLimits(organization.plan);
      const hasAutoApprovalCapability = planLimits.features.autoApproval;

      logger.info('Auto-approval eligibility check completed', {
        organizationId,
        plan: organization.plan,
        planEligible,
        settingsEnabled,
        hasAutoApprovalCapability,
        eligible: planEligible && settingsEnabled && hasAutoApprovalCapability
      });

      return {
        eligible: planEligible && settingsEnabled && hasAutoApprovalCapability,
        reason: planEligible && settingsEnabled && hasAutoApprovalCapability ? 'eligible' : 'not_eligible',
        plan: organization.plan,
        settings: organization.settings
      };

    } catch (error) {
      // ROUND 4 FIX: Enhanced error logging with context
      logger.error('Error checking auto-approval eligibility - failing closed', {
        organizationId,
        error: error.message,
        stack: error.stack,
        reason: 'system_error'
      });
      return { 
        eligible: false, 
        reason: 'system_error',
        error: error.message 
      };
    }
  }

  /**
   * Perform security validations for auto-approval
   * @param {Object} comment - Original comment data
   * @param {Object} generatedVariant - Generated roast variant
   * @param {string} organizationId - Organization ID
   * @returns {Object} Security validation results
   */
  async performSecurityValidations(comment, generatedVariant, organizationId) {
    try {
      const validations = {
        contentFilter: false,
        toxicityThreshold: false,
        platformCompliance: false,
        organizationPolicy: false,
        shieldApproval: false
      };

      // 1. Content filtering check
      validations.contentFilter = await this.validateContent(generatedVariant.text);

      // 2. Toxicity threshold check with proper null/undefined handling
      validations.toxicityThreshold = this.validateToxicityScore(
        generatedVariant.score, 
        comment.toxicity_score
      );

      // 3. Platform compliance check
      validations.platformCompliance = await this.validatePlatformCompliance(
        generatedVariant.text, 
        comment.platform
      );

      // 4. Organization policy check
      validations.organizationPolicy = await this.validateOrganizationPolicy(
        generatedVariant,
        organizationId
      );

      // 5. Shield service approval
      const shieldResult = await this.shieldService.analyzeContent(
        generatedVariant.text,
        organizationId
      );
      validations.shieldApproval = shieldResult.action === 'allow';

      const allPassed = Object.values(validations).every(v => v === true);

      logger.info('Auto-approval security validations completed', {
        organizationId,
        commentId: comment.id,
        variantId: generatedVariant.id,
        validations,
        allPassed
      });

      return {
        passed: allPassed,
        validations,
        shieldResult
      };

    } catch (error) {
      logger.error('Error performing security validations', {
        organizationId,
        commentId: comment.id,
        error: error.message
      });
      return { passed: false, error: error.message };
    }
  }

  /**
   * Process auto-approval for a generated variant
   * @param {Object} comment - Original comment
   * @param {Object} variant - Generated variant
   * @param {string} organizationId - Organization ID
   * @returns {Object} Auto-approval result
   */
  async processAutoApproval(comment, variant, organizationId) {
    try {
      logger.info('Starting auto-approval process', {
        organizationId,
        commentId: comment.id,
        variantId: variant.id
      });

      // 1. Check eligibility
      const eligibility = await this.checkAutoApprovalEligibility(organizationId);
      if (!eligibility.eligible) {
        return {
          approved: false,
          reason: eligibility.reason,
          requiresManualReview: true
        };
      }

      // 2. Perform security validations
      const securityCheck = await this.performSecurityValidations(
        comment, 
        variant, 
        organizationId
      );
      
      if (!securityCheck.passed) {
        return {
          approved: false,
          reason: 'security_validation_failed',
          securityResults: securityCheck,
          requiresManualReview: true
        };
      }

      // 3. Apply transparency if required
      let finalVariant = variant;
      if (await this.transparencyService.isTransparencyRequired(organizationId)) {
        finalVariant = await this.transparencyService.applyTransparency(
          variant,
          organizationId
        );
      }

      // 4. Record auto-approval
      const approvalRecord = await this.recordAutoApproval(
        comment,
        finalVariant,
        organizationId,
        securityCheck
      );

      // 5. Update rate limit counters
      await this.updateRateLimitCounters(organizationId);

      logger.info('Auto-approval process completed successfully', {
        organizationId,
        commentId: comment.id,
        variantId: variant.id,
        approvalId: approvalRecord.id
      });

      return {
        approved: true,
        variant: finalVariant,
        approvalRecord,
        securityResults: securityCheck,
        autoPublish: eligibility.settings?.auto_publish === true
      };

    } catch (error) {
      logger.error('Error in auto-approval process', {
        organizationId,
        commentId: comment.id,
        variantId: variant.id,
        error: error.message
      });
      return {
        approved: false,
        reason: 'system_error',
        error: error.message,
        requiresManualReview: true
      };
    }
  }

  /**
   * Check rate limits for auto-approval
   * SECURITY: Fail-closed during database errors
   */
  async checkRateLimits(organizationId) {
    const rateLimitId = `rate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // ROUND 4 FIX: Enhanced input validation
    if (!organizationId || typeof organizationId !== 'string' || organizationId.trim() === '') {
      return {
        allowed: false,
        error: 'invalid_input',
        reason: 'Invalid organization ID provided',
        rateLimitId
      };
    }

    try {
      // ROUND 4 FIX: Enhanced pre-flight connectivity check with absolute fail-closed
      let connectionHealthy = true;
      try {
        const healthCheckStart = Date.now();
        const healthCheck = await Promise.race([
          supabaseServiceClient.from('roast_approvals').select('id').limit(1),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), this.config.healthCheckTimeout)
          )
        ]);
        
        // CRITICAL: Any error in health check means fail closed
        if (healthCheck.error) {
          connectionHealthy = false;
          logger.error('CRITICAL: Database connection health check failed - failing closed', {
            organizationId,
            rateLimitId,
            healthCheckDuration: Date.now() - healthCheckStart,
            error: healthCheck.error.message,
            errorCode: healthCheck.error.code || 'unknown',
            errorDetails: healthCheck.error.details || 'none',
            reason: 'health_check_query_error'
          });
        }

        // ROUND 4 FIX: Validate health check response structure
        if (healthCheck.data && !Array.isArray(healthCheck.data)) {
          connectionHealthy = false;
          logger.error('CRITICAL: Database health check returned invalid response structure', {
            organizationId,
            rateLimitId,
            responseType: typeof healthCheck.data,
            expectedType: 'array',
            reason: 'invalid_health_check_response'
          });
        }
      } catch (healthError) {
        connectionHealthy = false;
        logger.error('CRITICAL: Database health check timeout - failing closed', {
          organizationId,
          rateLimitId,
          error: healthError.message,
          reason: 'health_check_timeout'
        });
      }

      // ROUND 4 FIX: Fail closed if connection is unhealthy
      if (!connectionHealthy) {
        return {
          allowed: false,
          error: 'database_connectivity_failed',
          reason: 'Cannot verify database connectivity - failing closed for security',
          rateLimitId
        };
      }

      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Get hourly and daily counts with timeout protection
      const [hourlyResult, dailyResult] = await Promise.all([
        Promise.race([
          supabaseServiceClient
            .from('roast_approvals')
            .select('id', { count: 'exact' })
            .eq('organization_id', organizationId)
            .gte('created_at', hourAgo.toISOString()),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Hourly count query timeout')), this.config.queryTimeout)
          )
        ]),
        Promise.race([
          supabaseServiceClient
            .from('roast_approvals')
            .select('id', { count: 'exact' })
            .eq('organization_id', organizationId)
            .gte('created_at', dayAgo.toISOString()),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Daily count query timeout')), this.config.queryTimeout)
          )
        ])
      ]);

      // ROUND 4 FIX: Enhanced error handling for rate limit queries
      if (hourlyResult.error || dailyResult.error) {
        logger.error('CRITICAL: Rate limit query failed - failing closed', {
          organizationId,
          rateLimitId,
          hourlyError: hourlyResult.error?.message,
          dailyError: dailyResult.error?.message,
          reason: 'rate_limit_query_error'
        });
        return {
          allowed: false,
          error: 'rate_limit_check_failed',
          reason: 'Cannot verify rate limits - failing closed for security',
          rateLimitId
        };
      }

      // ROUND 4 FIX: Validate count values and handle edge cases
      const hourlyCount = this.validateCount(hourlyResult.count, 'hourly', organizationId, rateLimitId);
      const dailyCount = this.validateCount(dailyResult.count, 'daily', organizationId, rateLimitId);

      // ROUND 4 FIX: Get plan-specific limits
      const planLimits = await planLimitsService.getDailyAutoApprovalLimits(organizationId);
      const maxHourly = Math.min(this.config.maxHourlyApprovals, planLimits.hourly);
      const maxDaily = Math.min(this.config.maxDailyApprovals, planLimits.daily);

      const allowed = hourlyCount < maxHourly && dailyCount < maxDaily;

      logger.info('Rate limit check completed', {
        organizationId,
        rateLimitId,
        hourlyCount,
        dailyCount,
        maxHourly,
        maxDaily,
        allowed,
        planLimits: planLimits.plan
      });

      return {
        allowed,
        hourlyCount,
        dailyCount,
        maxHourly,
        maxDaily,
        rateLimitId,
        reason: allowed ? 'within_limits' : 'rate_limit_exceeded'
      };

    } catch (error) {
      // ROUND 4 FIX: Enhanced error logging
      logger.error('Error checking rate limits - failing closed', {
        organizationId,
        rateLimitId,
        error: error.message,
        stack: error.stack,
        reason: 'system_error'
      });
      return {
        allowed: false,
        error: 'system_error',
        reason: error.message,
        rateLimitId
      };
    }
  }

  /**
   * ROUND 4 FIX: Enhanced count validation
   */
  validateCount(count, type, organizationId, rateLimitId) {
    if (count === null || count === undefined) {
      logger.warn('Rate limit count is null/undefined - treating as 0', {
        organizationId,
        rateLimitId,
        type,
        originalCount: count
      });
      return 0;
    }

    if (typeof count === 'string') {
      const parsed = parseInt(count, 10);
      if (isNaN(parsed)) {
        logger.warn('Rate limit count is non-numeric string - treating as 0', {
          organizationId,
          rateLimitId,
          type,
          originalCount: count
        });
        return 0;
      }
      return Math.max(0, parsed);
    }

    if (typeof count !== 'number' || isNaN(count)) {
      logger.warn('Rate limit count is invalid type - treating as 0', {
        organizationId,
        rateLimitId,
        type,
        originalCount: count,
        countType: typeof count
      });
      return 0;
    }

    return Math.max(0, Math.floor(count));
  }

  /**
   * Process auto-approval with enhanced security
   * ROUND 4 FIX: Enhanced transparency enforcement
   */
  async processAutoApproval(comment, variant, organizationId) {
    const validationId = `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Step 1: Check eligibility
      const eligibility = await this.checkAutoApprovalEligibility(organizationId);
      if (!eligibility.eligible) {
        logger.info('Auto-approval denied - organization not eligible', {
          organizationId,
          validationId,
          reason: eligibility.reason
        });
        return {
          approved: false,
          reason: eligibility.reason,
          requiresManualReview: true,
          validationId
        };
      }

      // Step 2: Check rate limits
      const rateLimits = await this.checkRateLimits(organizationId);
      if (!rateLimits.allowed) {
        logger.info('Auto-approval denied - rate limit exceeded', {
          organizationId,
          validationId,
          rateLimitId: rateLimits.rateLimitId,
          reason: 'rate_limit_exceeded'
        });
        return {
          approved: false,
          reason: 'rate_limit_exceeded',
          requiresManualReview: true,
          rateLimitInfo: rateLimits,
          validationId
        };
      }

      // Step 3: Validate toxicity scores
      if (!this.validateToxicityScore(variant.score, comment.originalScore)) {
        logger.info('Auto-approval denied - toxicity validation failed', {
          organizationId,
          validationId,
          variantScore: variant.score,
          originalScore: comment.originalScore,
          reason: 'toxicity_threshold_exceeded'
        });
        return {
          approved: false,
          reason: 'toxicity_threshold_exceeded',
          requiresManualReview: true,
          validationId
        };
      }

      // ROUND 4 FIX: Enhanced transparency enforcement
      try {
        const transparencyRequired = await Promise.race([
          transparencyService.isTransparencyRequired(organizationId),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Transparency check timeout')), this.config.transparencyTimeout)
          )
        ]);

        if (transparencyRequired) {
          const transparentVariant = await Promise.race([
            transparencyService.applyTransparency(variant, organizationId),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Transparency application timeout')), this.config.transparencyTimeout)
            )
          ]);

          // ROUND 4 FIX: Enhanced transparency validation
          if (!transparentVariant || !transparentVariant.text || transparentVariant.text === variant.text) {
            logger.error('Transparency required but not applied - failing closed', {
              organizationId,
              validationId,
              originalText: variant.text,
              transparentText: transparentVariant?.text,
              reason: 'transparency_enforcement_failed'
            });
            return {
              approved: false,
              reason: 'transparency_enforcement_failed',
              requiresManualReview: true,
              error: 'Required transparency was not applied',
              validationId
            };
          }

          // ROUND 4 FIX: Validate transparency indicators
          const hasTransparencyIndicator = this.validateTransparencyIndicators(transparentVariant.text);
          if (!hasTransparencyIndicator) {
            logger.error('Transparency validation failed - no valid indicators found', {
              organizationId,
              validationId,
              text: transparentVariant.text,
              reason: 'transparency_validation_failed'
            });
            return {
              approved: false,
              reason: 'transparency_validation_failed',
              requiresManualReview: true,
              error: 'Transparency indicators not detected',
              validationId
            };
          }

          variant = transparentVariant;
          logger.info('Transparency successfully applied and validated', {
            organizationId,
            validationId,
            hasIndicator: hasTransparencyIndicator
          });
        }
      } catch (transparencyError) {
        logger.error('Error in transparency enforcement - failing closed', {
          organizationId,
          validationId,
          error: transparencyError.message,
          reason: 'transparency_system_error'
        });
        return {
          approved: false,
          reason: 'transparency_system_error',
          requiresManualReview: true,
          error: transparencyError.message,
          validationId
        };
      }

      // Step 4: Record approval
      const approvalRecord = {
        organization_id: organizationId,
        comment_id: comment.id,
        variant_id: variant.id,
        approved_at: new Date().toISOString(),
        metadata: {
          validationId,
          rateLimitId: rateLimits.rateLimitId,
          originalText: comment.text,
          generatedText: variant.text,
          toxicityScore: variant.score
        }
      };

      const recordResult = await supabaseServiceClient
        .from('roast_approvals')
        .insert(approvalRecord);

      if (recordResult.error) {
        logger.error('Failed to record auto-approval', {
          organizationId,
          validationId,
          error: recordResult.error.message
        });
        return {
          approved: false,
          reason: 'record_creation_failed',
          requiresManualReview: true,
          validationId
        };
      }

      logger.info('Auto-approval successful', {
        organizationId,
        validationId,
        commentId: comment.id,
        variantId: variant.id
      });

      return {
        approved: true,
        variant,
        approvalId: recordResult.data.id,
        validationId,
        rateLimitInfo: rateLimits
      };

    } catch (error) {
      logger.error('Error in auto-approval process - failing closed', {
        organizationId,
        validationId,
        error: error.message,
        stack: error.stack
      });
      return {
        approved: false,
        reason: 'system_error',
        requiresManualReview: true,
        error: error.message,
        validationId
      };
    }
  }

  /**
   * ROUND 4 FIX: Enhanced transparency indicator validation
   */
  validateTransparencyIndicators(text) {
    if (!text || typeof text !== 'string') {
      return false;
    }

    const indicators = [
      '🤖', // Robot emoji
      /\bAI\b/i, // "AI" as whole word
      /\bartificial intelligence\b/i,
      /\bgenerated by\b/i,
      /\bbot\b/i,
      /\bautomated\b/i,
      /\balgorithm\b/i
    ];

    return indicators.some(indicator => {
      if (typeof indicator === 'string') {
        return text.includes(indicator);
      } else {
        return indicator.test(text);
      }
    });
  }

  /**
   * Validate toxicity scores (Round 3 fix with conservative thresholds)
   */
  validateToxicityScore(variantScore, originalScore) {
    // Fail closed for invalid scores
    if (variantScore === null || variantScore === undefined || 
        originalScore === null || originalScore === undefined ||
        variantScore === '' || originalScore === '') {
      return false;
    }

    // Convert to numbers if needed
    const variant = parseFloat(variantScore);
    const original = parseFloat(originalScore);

    if (isNaN(variant) || isNaN(original)) {
      return false;
    }

    // Conservative thresholds
    if (variant > this.config.maxToxicityScore) {
      return false;
    }

    const increase = variant - original;
    if (increase > this.config.maxToxicityIncrease) {
      return false;
    }

    return true;
  }
}

module.exports = AutoApprovalService;