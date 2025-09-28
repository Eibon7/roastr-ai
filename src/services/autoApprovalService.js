/**
 * Auto-Approval Service - CodeRabbit Review #3275183530 Security Enhancements
 * Implements enhanced transparency validation, fail-closed policy validation,
 * robust rate limiting, and toxicity score hardening
 */

const { supabaseServiceClient } = require('../config/supabase');
const { logger } = require('../utils/logger');
const transparencyService = require('./transparencyService');
const planLimitsService = require('./planLimitsService');
const shieldService = require('./shieldService');

class AutoApprovalService {
  constructor() {
    this.config = {
      // Conservative toxicity thresholds (CodeRabbit Round 3+ fixes)
      maxToxicityScore: 0.6, // Reduced from 0.7
      maxToxicityIncrease: 0.15,
      
      // Rate limiting (per hour/day)
      maxHourlyApprovals: 50,
      maxDailyApprovals: 200,
      
      // Enhanced timeouts (CodeRabbit Round 4+ enhancements)
      healthCheckTimeout: 1000,
      queryTimeout: 3000,
      transparencyTimeout: 2000,
      
      // Security validation timeouts
      contentValidationTimeout: 5000,
      policyValidationTimeout: 2000
    };
    
    // Initialize shield service
    this.shieldService = new shieldService();
  }

  /**
   * ENHANCED TRANSPARENCY VALIDATION (CodeRabbit Critical Fix #1)
   * Ensures stored response exactly matches approved variant text
   * Blocks auto-publication if content mismatches
   */
  async validateContentIntegrity(storedResponse, approvedVariant, organizationId) {
    const validationId = `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Critical validation: stored response must exactly match approved variant
      if (!storedResponse || !approvedVariant) {
        logger.error('CRITICAL: Content integrity validation failed - missing data', {
          organizationId,
          validationId,
          hasStoredResponse: !!storedResponse,
          hasApprovedVariant: !!approvedVariant,
          reason: 'missing_content_data'
        });
        return { 
          isValid: false, 
          reason: 'missing_content_data',
          error: 'Either stored response or approved variant is missing'
        };
      }

      // Enhanced text normalization for comparison
      const normalizeText = (text) => {
        if (typeof text !== 'string') return '';
        return text.trim().replace(/\s+/g, ' ').toLowerCase();
      };

      const normalizedStored = normalizeText(storedResponse.text || storedResponse);
      const normalizedApproved = normalizeText(approvedVariant.text || approvedVariant);

      // CRITICAL SECURITY CHECK: Exact content match required
      if (normalizedStored !== normalizedApproved) {
        logger.error('CRITICAL: Content tampering detected - stored response does not match approved variant', {
          organizationId,
          validationId,
          storedLength: normalizedStored.length,
          approvedLength: normalizedApproved.length,
          textMatch: false,
          reason: 'content_mismatch',
          // Don't log actual content for security
          contentHash: {
            stored: this.hashContent(normalizedStored),
            approved: this.hashContent(normalizedApproved)
          }
        });
        return { 
          isValid: false, 
          reason: 'content_mismatch',
          error: 'Stored response does not match approved variant - possible tampering'
        };
      }

      // Additional security: verify metadata integrity
      if (storedResponse.id && approvedVariant.id && storedResponse.id !== approvedVariant.id) {
        logger.error('CRITICAL: Variant ID mismatch detected', {
          organizationId,
          validationId,
          storedId: storedResponse.id,
          approvedId: approvedVariant.id,
          reason: 'id_mismatch'
        });
        return { 
          isValid: false, 
          reason: 'id_mismatch',
          error: 'Variant IDs do not match'
        };
      }

      logger.info('Content integrity validation passed', {
        organizationId,
        validationId,
        contentLength: normalizedStored.length,
        metadataValid: true
      });

      return { 
        isValid: true, 
        validationId,
        contentHash: this.hashContent(normalizedStored)
      };

    } catch (error) {
      logger.error('CRITICAL: Content integrity validation system error - failing closed', {
        organizationId,
        validationId,
        error: error.message,
        stack: error.stack,
        reason: 'validation_system_error'
      });
      return { 
        isValid: false, 
        reason: 'validation_system_error',
        error: error.message
      };
    }
  }

  /**
   * Create content hash for security validation
   */
  hashContent(content) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * ENHANCED TRANSPARENCY ENFORCEMENT (CodeRabbit Critical Fix #1 continued)
   * Validates transparency for auto-published posts with enhanced security
   */
  async validateTransparencyForAutoPost(storedResponse, organizationId, language = 'es') {
    const validationId = `transparency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Enhanced timeout protection for transparency validation
      const transparencyResult = await Promise.race([
        this.performTransparencyValidation(storedResponse, organizationId, language),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transparency validation timeout')), this.config.transparencyTimeout)
        )
      ]);

      logger.info('Enhanced transparency validation completed', {
        organizationId,
        validationId,
        language,
        isValid: transparencyResult.isValid,
        indicatorsFound: transparencyResult.indicatorsFound || 0
      });

      return transparencyResult;

    } catch (error) {
      logger.error('CRITICAL: Transparency validation failed - failing closed for auto-publish', {
        organizationId,
        validationId,
        language,
        error: error.message,
        reason: 'transparency_validation_error'
      });
      return { 
        isValid: false, 
        error: error.message,
        reason: 'transparency_validation_error'
      };
    }
  }

  /**
   * Internal transparency validation logic
   */
  async performTransparencyValidation(storedResponse, organizationId, language) {
    const responseText = storedResponse.text || storedResponse;
    
    if (!responseText || typeof responseText !== 'string') {
      return { isValid: false, error: 'Invalid response text for transparency validation' };
    }

    // Enhanced transparency indicators (multilingual)
    const transparencyIndicators = {
      es: [
        '🤖', 'robot', 'bot', 'IA', 'inteligencia artificial', 
        'generado por', 'respuesta automática', 'algoritmo',
        'generado automáticamente', 'asistente virtual'
      ],
      en: [
        '🤖', 'robot', 'bot', 'AI', 'artificial intelligence',
        'generated by', 'automatic response', 'algorithm',
        'auto-generated', 'virtual assistant'
      ]
    };

    const indicators = transparencyIndicators[language] || transparencyIndicators.en;
    const lowerText = responseText.toLowerCase();
    
    let indicatorsFound = 0;
    const foundIndicators = [];

    indicators.forEach(indicator => {
      if (lowerText.includes(indicator.toLowerCase())) {
        indicatorsFound++;
        foundIndicators.push(indicator);
      }
    });

    // Enhanced validation: require at least one transparency indicator
    const hasValidTransparency = indicatorsFound > 0;

    return {
      isValid: hasValidTransparency,
      indicatorsFound,
      foundIndicators,
      reason: hasValidTransparency ? 'transparency_validated' : 'no_transparency_indicators'
    };
  }

  /**
   * FAIL-CLOSED POLICY VALIDATION (CodeRabbit Critical Fix #2)
   * Implements fail-closed error handling for organization policy validation
   * Automatically rejects approval on policy fetch failures
   */
  async validateOrganizationPolicy(variant, organizationId, timeout = this.config.policyValidationTimeout) {
    const validationId = `policy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Enhanced input validation
      if (!organizationId || typeof organizationId !== 'string' || organizationId.trim() === '') {
        logger.warn('Policy validation failed - invalid organization ID', {
          organizationId,
          validationId,
          reason: 'invalid_organization_id'
        });
        return false; // Fail closed
      }

      if (!variant || typeof variant !== 'object') {
        logger.warn('Policy validation failed - invalid variant object', {
          organizationId,
          validationId,
          variantType: typeof variant,
          reason: 'invalid_variant_object'
        });
        return false; // Fail closed
      }

      // Enhanced database query with timeout protection
      const policyQuery = await Promise.race([
        supabaseServiceClient
          .from('organization_policies')
          .select('id, type, enabled, config, prohibited_words, toxicity_threshold')
          .eq('organization_id', organizationId)
          .eq('enabled', true),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Policy query timeout')), timeout)
        )
      ]);

      // CRITICAL: Fail closed on any database error
      if (policyQuery.error) {
        logger.error('CRITICAL: Organization policy query failed - failing closed for security', {
          organizationId,
          validationId,
          error: policyQuery.error.message,
          errorCode: policyQuery.error.code || 'unknown',
          errorDetails: policyQuery.error.details || 'none',
          reason: 'policy_query_error'
        });
        return false; // Fail closed - deny approval
      }

      const policies = policyQuery.data || [];

      // If no policies found, log and allow (empty policies = default allow)
      if (policies.length === 0) {
        logger.info('No organization policies found - allowing by default', {
          organizationId,
          validationId,
          reason: 'no_policies_configured'
        });
        return true;
      }

      // Enhanced policy validation with fail-closed error handling
      const validationResults = await this.validateAgainstPolicies(variant, policies, organizationId, validationId);
      
      logger.debug('Organization policy validation completed', {
        organizationId,
        validationId,
        policiesChecked: policies.length,
        passed: validationResults.passed,
        failedPolicies: validationResults.failedPolicies || []
      });

      return validationResults.passed;

    } catch (error) {
      // CRITICAL: Any error in policy validation must fail closed
      logger.error('CRITICAL: Organization policy validation failed due to system error - failing closed', {
        organizationId,
        validationId,
        error: error.message,
        stack: error.stack,
        reason: 'policy_validation_system_error'
      });
      return false; // Fail closed - deny approval
    }
  }

  /**
   * Validate variant against organization policies
   */
  async validateAgainstPolicies(variant, policies, organizationId, validationId) {
    const results = {
      passed: true,
      failedPolicies: []
    };

    for (const policy of policies) {
      try {
        // Validate policy structure
        if (!policy || !policy.type) {
          logger.warn('Invalid policy structure detected - skipping', {
            organizationId,
            validationId,
            policyId: policy?.id || 'unknown',
            reason: 'invalid_policy_structure'
          });
          continue;
        }

        switch (policy.type) {
          case 'content_filter':
            const contentResult = await this.validateContentFilter(variant, policy, organizationId, validationId);
            if (!contentResult) {
              results.passed = false;
              results.failedPolicies.push({ type: 'content_filter', id: policy.id });
            }
            break;

          case 'toxicity_threshold':
            const toxicityResult = await this.validateToxicityPolicy(variant, policy, organizationId, validationId);
            if (!toxicityResult) {
              results.passed = false;
              results.failedPolicies.push({ type: 'toxicity_threshold', id: policy.id });
            }
            break;

          default:
            logger.debug('Unknown policy type - skipping', {
              organizationId,
              validationId,
              policyType: policy.type,
              policyId: policy.id
            });
        }
      } catch (policyError) {
        logger.error('Error validating individual policy - failing closed', {
          organizationId,
          validationId,
          policyId: policy.id,
          policyType: policy.type,
          error: policyError.message
        });
        results.passed = false;
        results.failedPolicies.push({ type: policy.type, id: policy.id, error: policyError.message });
      }
    }

    return results;
  }

  /**
   * Validate content filter policy
   */
  async validateContentFilter(variant, policy, organizationId, validationId) {
    try {
      const text = variant.text || variant;
      if (!text || typeof text !== 'string') {
        return false;
      }

      const prohibitedWords = policy.prohibited_words;
      
      // Enhanced validation for prohibited_words format
      if (!Array.isArray(prohibitedWords)) {
        logger.warn('Invalid prohibited_words format in policy - failing closed', {
          organizationId,
          validationId,
          policyId: policy.id,
          prohibitedWordsType: typeof prohibitedWords,
          reason: 'invalid_prohibited_words_format'
        });
        return false; // Fail closed
      }

      const lowerText = text.toLowerCase();
      for (const word of prohibitedWords) {
        if (typeof word === 'string' && word.trim() !== '' && lowerText.includes(word.toLowerCase())) {
          logger.info('Content filter policy violation detected', {
            organizationId,
            validationId,
            policyId: policy.id,
            violatedWord: word,
            reason: 'prohibited_word_found'
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('Error in content filter validation - failing closed', {
        organizationId,
        validationId,
        policyId: policy.id,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Validate toxicity threshold policy
   */
  async validateToxicityPolicy(variant, policy, organizationId, validationId) {
    try {
      const toxicityScore = variant.score || variant.toxicity_score;
      const threshold = policy.toxicity_threshold;

      if (typeof toxicityScore !== 'number' || typeof threshold !== 'number') {
        logger.warn('Invalid toxicity data for policy validation', {
          organizationId,
          validationId,
          policyId: policy.id,
          scoreType: typeof toxicityScore,
          thresholdType: typeof threshold
        });
        return false; // Fail closed
      }

      const normalizedScore = this.normalizeToxicityScore(toxicityScore);
      const normalizedThreshold = this.normalizeToxicityScore(threshold);

      if (normalizedScore > normalizedThreshold) {
        logger.info('Toxicity threshold policy violation detected', {
          organizationId,
          validationId,
          policyId: policy.id,
          score: normalizedScore,
          threshold: normalizedThreshold,
          reason: 'toxicity_threshold_exceeded'
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error in toxicity policy validation - failing closed', {
        organizationId,
        validationId,
        policyId: policy.id,
        error: error.message
      });
      return false;
    }
  }

  /**
   * ROBUST RATE LIMITING WITH DATABASE ERROR HANDLING (CodeRabbit Critical Fix #3)
   * Implements fail-closed rate limiting during database query errors
   * Automatically denies auto-approval on database failures
   */
  async checkRateLimits(organizationId) {
    const rateLimitId = `rate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Enhanced input validation (CodeRabbit feedback)
    if (!organizationId || typeof organizationId !== 'string' || organizationId.trim() === '') {
      return {
        allowed: false,
        error: 'invalid_input',
        reason: 'Invalid organization ID provided',
        rateLimitId
      };
    }

    try {
      // CRITICAL: Enhanced pre-flight connectivity check with absolute fail-closed
      const healthCheckResult = await this.performDatabaseHealthCheck(rateLimitId, organizationId);
      if (!healthCheckResult.healthy) {
        return {
          allowed: false,
          error: 'database_connectivity_failed',
          reason: 'Cannot verify database connectivity - failing closed for security',
          rateLimitId,
          healthCheckDetails: healthCheckResult
        };
      }

      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Enhanced query execution with timeout protection and error handling
      const [hourlyResult, dailyResult] = await Promise.all([
        this.executeRateLimitQuery('hourly', organizationId, hourAgo, rateLimitId),
        this.executeRateLimitQuery('daily', organizationId, dayAgo, rateLimitId)
      ]);

      // CRITICAL: Fail closed if any query failed
      if (!hourlyResult.success || !dailyResult.success) {
        logger.error('CRITICAL: Rate limit queries failed - failing closed', {
          organizationId,
          rateLimitId,
          hourlyError: hourlyResult.error,
          dailyError: dailyResult.error,
          reason: 'rate_limit_query_failed'
        });
        return {
          allowed: false,
          error: 'rate_limit_check_failed',
          reason: 'Cannot verify rate limits - failing closed for security',
          rateLimitId
        };
      }

      // Enhanced count validation with safe number handling
      const hourlyCount = this.validateAndNormalizeCount(hourlyResult.count, 'hourly', organizationId, rateLimitId);
      const dailyCount = this.validateAndNormalizeCount(dailyResult.count, 'daily', organizationId, rateLimitId);

      // Check if count validation failed
      if (hourlyCount === null || dailyCount === null) {
        return {
          allowed: false,
          error: 'rate_limit_validation_failed',
          reason: 'Rate limit count validation failed - failing closed for security',
          rateLimitId
        };
      }

      // Get plan-specific limits with validation
      const planLimits = await this.getPlanSpecificLimits(organizationId, rateLimitId);
      const maxHourly = Math.min(this.config.maxHourlyApprovals, planLimits.hourly);
      const maxDaily = Math.min(this.config.maxDailyApprovals, planLimits.daily);

      const allowed = hourlyCount < maxHourly && dailyCount < maxDaily;

      // Comprehensive rate limit status logging
      logger.info('Rate limit check completed successfully', {
        organizationId,
        rateLimitId,
        hourlyCount,
        dailyCount,
        maxHourly,
        maxDaily,
        allowed,
        planTier: planLimits.plan,
        remainingHourly: Math.max(0, maxHourly - hourlyCount),
        remainingDaily: Math.max(0, maxDaily - dailyCount)
      });

      return {
        allowed,
        hourlyCount,
        dailyCount,
        maxHourly,
        maxDaily,
        rateLimitId,
        reason: allowed ? 'within_limits' : 'rate_limit_exceeded',
        remaining: {
          hourly: Math.max(0, maxHourly - hourlyCount),
          daily: Math.max(0, maxDaily - dailyCount)
        }
      };

    } catch (error) {
      // CRITICAL: Enhanced error logging with full context
      logger.error('CRITICAL: Rate limit check system error - failing closed', {
        organizationId,
        rateLimitId,
        error: error.message,
        stack: error.stack,
        reason: 'rate_limit_system_error'
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
   * Enhanced database health check with comprehensive validation
   */
  async performDatabaseHealthCheck(rateLimitId, organizationId) {
    try {
      const healthCheckStart = Date.now();
      
      const healthCheck = await Promise.race([
        supabaseServiceClient.from('roast_approvals').select('id').limit(1),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), this.config.healthCheckTimeout)
        )
      ]);
      
      const healthCheckDuration = Date.now() - healthCheckStart;

      // Enhanced health check validation
      if (healthCheck.error) {
        logger.error('CRITICAL: Database health check query failed', {
          organizationId,
          rateLimitId,
          healthCheckDuration,
          error: healthCheck.error.message,
          errorCode: healthCheck.error.code || 'unknown',
          errorDetails: healthCheck.error.details || 'none',
          reason: 'health_check_query_error'
        });
        return { healthy: false, reason: 'query_error', duration: healthCheckDuration };
      }

      // Validate response structure (CodeRabbit feedback)
      if (healthCheck.data && !Array.isArray(healthCheck.data)) {
        logger.error('CRITICAL: Database health check returned invalid response structure', {
          organizationId,
          rateLimitId,
          responseType: typeof healthCheck.data,
          expectedType: 'array',
          healthCheckDuration,
          reason: 'invalid_health_check_response'
        });
        return { healthy: false, reason: 'invalid_response_structure', duration: healthCheckDuration };
      }

      logger.debug('Database health check passed', {
        organizationId,
        rateLimitId,
        healthCheckDuration,
        responseLength: healthCheck.data?.length || 0
      });

      return { healthy: true, duration: healthCheckDuration };

    } catch (healthError) {
      const healthCheckDuration = Date.now() - Date.now(); // Approximate
      logger.error('CRITICAL: Database health check failed with exception', {
        organizationId,
        rateLimitId,
        error: healthError.message,
        healthCheckDuration,
        reason: 'health_check_exception'
      });
      return { healthy: false, reason: 'exception', error: healthError.message, duration: healthCheckDuration };
    }
  }

  /**
   * Execute rate limit query with enhanced error handling
   */
  async executeRateLimitQuery(type, organizationId, timeThreshold, rateLimitId) {
    try {
      const result = await Promise.race([
        supabaseServiceClient
          .from('roast_approvals')
          .select('id', { count: 'exact' })
          .eq('organization_id', organizationId)
          .gte('created_at', timeThreshold.toISOString()),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`${type} rate limit query timeout`)), this.config.queryTimeout)
        )
      ]);

      if (result.error) {
        logger.error(`${type} rate limit query failed`, {
          organizationId,
          rateLimitId,
          error: result.error.message,
          errorCode: result.error.code || 'unknown',
          timeThreshold: timeThreshold.toISOString(),
          reason: `${type}_query_error`
        });
        return { success: false, error: result.error.message };
      }

      return { success: true, count: result.count };

    } catch (queryError) {
      logger.error(`${type} rate limit query timeout or exception`, {
        organizationId,
        rateLimitId,
        error: queryError.message,
        timeThreshold: timeThreshold.toISOString(),
        reason: `${type}_query_timeout`
      });
      return { success: false, error: queryError.message };
    }
  }

  /**
   * ENHANCED COUNT VALIDATION WITH SAFE NUMBER HANDLING (CodeRabbit feedback)
   */
  validateAndNormalizeCount(count, type, organizationId, rateLimitId) {
    // Handle null/undefined
    if (count === null || count === undefined) {
      logger.warn('Rate limit count is null/undefined - treating as 0', {
        organizationId,
        rateLimitId,
        type,
        originalCount: count
      });
      return 0;
    }

    // Handle string numbers
    if (typeof count === 'string') {
      const parsed = parseInt(count, 10);
      if (isNaN(parsed)) {
        logger.warn('Rate limit count is non-numeric string - failing closed', {
          organizationId,
          rateLimitId,
          type,
          originalCount: count
        });
        return null; // Signal validation failure
      }
      return Math.max(0, parsed);
    }

    // Handle invalid types
    if (typeof count !== 'number' || isNaN(count)) {
      logger.warn('Rate limit count is invalid type - failing closed', {
        organizationId,
        rateLimitId,
        type,
        originalCount: count,
        countType: typeof count
      });
      return null; // Signal validation failure
    }

    // Handle negative numbers
    if (count < 0) {
      logger.warn('Rate limit count is negative - normalizing to 0', {
        organizationId,
        rateLimitId,
        type,
        originalCount: count
      });
      return 0;
    }

    return Math.floor(count); // Ensure integer
  }

  /**
   * Get plan-specific limits with validation
   */
  async getPlanSpecificLimits(organizationId, rateLimitId) {
    try {
      const limits = await planLimitsService.getDailyAutoApprovalLimits(organizationId);
      return {
        hourly: limits.hourly || this.config.maxHourlyApprovals,
        daily: limits.daily || this.config.maxDailyApprovals,
        plan: limits.plan || 'unknown'
      };
    } catch (error) {
      logger.warn('Failed to get plan-specific limits - using defaults', {
        organizationId,
        rateLimitId,
        error: error.message
      });
      return {
        hourly: this.config.maxHourlyApprovals,
        daily: this.config.maxDailyApprovals,
        plan: 'default'
      };
    }
  }

  /**
   * TOXICITY SCORE VALIDATION HARDENING (CodeRabbit Critical Fix #4)
   * Enhanced validation for null/undefined scenarios
   * Conservative fallbacks and score normalization
   */
  validateToxicityScore(variantScore, originalScore) {
    try {
      // Enhanced null/undefined handling (CodeRabbit feedback)
      if ((variantScore === null || variantScore === undefined) && 
          (originalScore === null || originalScore === undefined)) {
        logger.warn('Both toxicity scores unavailable - failing closed for safety', {
          variantScore,
          originalScore,
          reason: 'no_scores_available'
        });
        return false; // Fail closed when both scores unavailable
      }

      // Conservative defaults for missing scores
      let normalizedVariant = variantScore;
      let normalizedOriginal = originalScore;

      if (variantScore === null || variantScore === undefined) {
        normalizedVariant = 0.5; // Conservative default
        logger.warn('Variant toxicity score missing - using default for safety', {
          variantScore,
          defaultUsed: 0.5,
          reason: 'variant_score_missing'
        });
      }

      if (originalScore === null || originalScore === undefined) {
        normalizedOriginal = 0.3; // Conservative default
        logger.warn('Original toxicity score missing - using default for safety', {
          originalScore,
          defaultUsed: 0.3,
          reason: 'original_score_missing'
        });
      }

      // Enhanced score normalization
      normalizedVariant = this.normalizeToxicityScore(normalizedVariant);
      normalizedOriginal = this.normalizeToxicityScore(normalizedOriginal);

      // Fail closed for invalid normalized scores
      if (normalizedVariant === null || normalizedOriginal === null) {
        logger.warn('Toxicity score normalization failed - failing closed', {
          originalVariant: variantScore,
          originalOriginal: originalScore,
          reason: 'normalization_failed'
        });
        return false;
      }

      // Dynamic threshold calculation based on original toxicity
      const maxAllowedIncrease = this.calculateMaxAllowedIncrease(normalizedOriginal);
      const actualIncrease = normalizedVariant - normalizedOriginal;
      const maxAllowed = normalizedOriginal + maxAllowedIncrease;

      // Conservative validation
      const passed = normalizedVariant <= this.config.maxToxicityScore && 
                    actualIncrease <= maxAllowedIncrease;

      // Enhanced logging for transparency
      logger.info('Toxicity validation details', {
        variantScore: normalizedVariant,
        originalScore: normalizedOriginal,
        maxAllowedIncrease,
        actualIncrease,
        maxAllowed,
        passed,
        conservativeThreshold: this.config.maxToxicityScore
      });

      return passed;

    } catch (error) {
      logger.error('Toxicity validation error - failing closed for safety', {
        variantScore,
        originalScore,
        error: error.message,
        reason: 'validation_error'
      });
      return false; // Fail closed on any error
    }
  }

  /**
   * Calculate maximum allowed toxicity increase based on original score
   */
  calculateMaxAllowedIncrease(originalScore) {
    if (originalScore <= 0.2) {
      return 0.4; // Allow higher increase for very low toxicity
    } else if (originalScore <= 0.5) {
      return 0.3; // Medium increase for medium toxicity
    } else {
      return 0.2; // Minimal increase for high toxicity
    }
  }

  /**
   * ENHANCED TOXICITY SCORE NORMALIZATION (CodeRabbit feedback)
   * Support score normalization across different scales
   */
  normalizeToxicityScore(score) {
    try {
      // Handle null/undefined
      if (score === null || score === undefined) {
        return null;
      }

      // Handle boolean values
      if (typeof score === 'boolean') {
        return score ? 1.0 : 0.0;
      }

      // Handle string conversion
      if (typeof score === 'string') {
        const parsed = parseFloat(score);
        if (isNaN(parsed)) {
          return null; // Invalid string
        }
        score = parsed;
      }

      // Handle non-numeric values
      if (typeof score !== 'number' || isNaN(score)) {
        return null;
      }

      // Handle negative values
      if (score < 0) {
        return 0.0;
      }

      // Normalize different scales
      if (score > 1.0) {
        // Assume 0-100 scale, normalize to 0-1
        const normalized = Math.min(score / 100.0, 1.0);
        return Math.round(normalized * 1000) / 1000; // Round to 3 decimal places
      }

      // Already in 0-1 scale
      return Math.min(Math.round(score * 1000) / 1000, 1.0);

    } catch (error) {
      logger.warn('Score normalization error - returning null', {
        score,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Check auto-approval eligibility with enhanced validation
   */
  async checkAutoApprovalEligibility(organizationId) {
    // Enhanced input validation (CodeRabbit feedback)
    if (!organizationId || typeof organizationId !== 'string' || organizationId.trim() === '') {
      logger.warn('Auto-approval eligibility check failed: Invalid organization ID', {
        organizationId,
        reason: 'invalid_input'
      });
      return { eligible: false, reason: 'invalid_input' };
    }

    try {
      // Enhanced database connectivity check with timeout
      const healthCheckStart = Date.now();
      const healthCheck = await this.performDatabaseHealthCheck(`eligibility_${Date.now()}`, organizationId);
      
      if (!healthCheck.healthy) {
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

      // Enhanced error handling (CodeRabbit feedback)
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
      
      // Enhanced validation (CodeRabbit feedback)
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

      // Plan-specific limits validation (CodeRabbit feedback)
      const planLimits = await planLimitsService.getPlanLimits(organization.plan);
      const hasAutoApprovalCapability = planLimits.features?.autoApproval;

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
      // Enhanced error logging with context (CodeRabbit feedback)
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
}

module.exports = AutoApprovalService;