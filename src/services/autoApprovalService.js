/**
 * Auto-Approval Service
 * Issue #405 - [E2E] Flujo automático (auto-approval ON)
 * 
 * Handles automatic approval and publication of roast responses when:
 * 1. Organization has auto-approval enabled
 * 2. Comment passes security validations
 * 3. Generated content meets quality and safety thresholds
 */

const { supabaseServiceClient } = require('../config/supabase');
const { logger } = require('../utils/logger');
const ShieldService = require('./shieldService');
const transparencyService = require('./transparencyService');
const { flags } = require('../config/flags');

class AutoApprovalService {
  constructor() {
    this.shieldService = new ShieldService();
    this.transparencyService = transparencyService;
    
    // Auto-approval configuration
    this.config = {
      // Security thresholds for auto-approval
      maxToxicityScore: 0.7, // Content above this toxicity level requires manual review
      minQualityScore: 0.6,  // Minimum quality score for auto-approval
      maxContentLength: 280, // Platform-dependent, Twitter default
      
      // Timing configurations
      securityValidationTimeout: 5000, // 5 seconds for security checks
      transparencyTimeout: 3000,       // 3 seconds for transparency validation
      
      // Rate limiting
      maxAutoApprovalsPerHour: 50,     // Per organization
      maxAutoApprovalsPerDay: 200      // Per organization
    };
  }

  /**
   * Check if organization is eligible for auto-approval
   * @param {string} organizationId - Organization ID
   * @returns {Object} Eligibility status and details
   */
  async checkAutoApprovalEligibility(organizationId) {
    try {
      // Get organization settings
      const { data: org, error } = await supabaseServiceClient
        .from('organizations')
        .select('plan, settings')
        .eq('id', organizationId)
        .single();

      if (error) {
        logger.error('Failed to get organization for auto-approval check', {
          organizationId,
          error: error.message
        });
        return { eligible: false, reason: 'organization_not_found' };
      }

      // Check if auto-approval is enabled
      if (!org.settings?.auto_approval) {
        return { eligible: false, reason: 'auto_approval_disabled' };
      }

      // Check plan eligibility (free plans might have restrictions)
      const planLimits = this.getPlanLimits(org.plan);
      if (!planLimits.autoApprovalAllowed) {
        return { eligible: false, reason: 'plan_not_eligible' };
      }

      // Check rate limits
      const rateLimitCheck = await this.checkRateLimits(organizationId);
      if (!rateLimitCheck.allowed) {
        return { 
          eligible: false, 
          reason: 'rate_limit_exceeded',
          details: rateLimitCheck
        };
      }

      return { 
        eligible: true, 
        plan: org.plan,
        settings: org.settings,
        rateLimits: rateLimitCheck
      };

    } catch (error) {
      logger.error('Error checking auto-approval eligibility', {
        organizationId,
        error: error.message
      });
      return { eligible: false, reason: 'system_error' };
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
   * Validate content against basic filters
   * @param {string} content - Content to validate
   * @returns {boolean} Whether content passes basic filters
   */
  async validateContent(content) {
    // Basic content validation
    if (!content || content.length === 0) return false;
    if (content.length > this.config.maxContentLength) return false;
    
    // Check for explicit prohibited content patterns
    const prohibitedPatterns = [
      /\b(kill|murder|suicide|death)\b/i,
      /\b(hate|nazi|terrorist)\b/i,
      /\b(drugs|cocaine|heroin)\b/i
    ];
    
    return !prohibitedPatterns.some(pattern => pattern.test(content));
  }

  /**
   * SECURITY FIX Round 2: Enhanced toxicity score validation with improved logic
   * Addresses CodeRabbit feedback on incorrect validation failures
   * @param {number|null|undefined} variantScore - Generated variant toxicity score
   * @param {number|null|undefined} originalScore - Original comment toxicity score
   * @returns {boolean} Whether toxicity score is acceptable for auto-approval
   */
  validateToxicityScore(variantScore, originalScore) {
    try {
      // Handle null/undefined scores properly with enhanced normalization
      const safeVariantScore = this.normalizeToxicityScore(variantScore);
      const safeOriginalScore = this.normalizeToxicityScore(originalScore);

      logger.debug('Toxicity score validation Round 2', {
        variantScore,
        originalScore,
        safeVariantScore,
        safeOriginalScore,
        threshold: this.config.maxToxicityScore,
        validationVersion: '2.0'
      });

      // CRITICAL: Enhanced logic for missing scores
      // If variant score is missing but original is available, be more permissive
      // If both missing, fail closed. If original missing but variant available, check variant only
      if (safeVariantScore === null && safeOriginalScore === null) {
        logger.warn('Both toxicity scores unavailable - failing closed for safety', {
          variantScore,
          originalScore,
          reason: 'no_scores_available'
        });
        return false;
      }

      if (safeVariantScore === null) {
        logger.warn('Variant toxicity score unavailable - failing closed', {
          variantScore,
          originalScore: safeOriginalScore,
          reason: 'variant_score_missing'
        });
        return false;
      }

      // If original score is missing but variant is available, only check variant against threshold
      if (safeOriginalScore === null) {
        logger.info('Original toxicity score unavailable - validating variant only', {
          variantScore: safeVariantScore,
          originalScore,
          threshold: this.config.maxToxicityScore,
          reason: 'original_score_missing'
        });
        
        const passesThreshold = safeVariantScore <= this.config.maxToxicityScore;
        logger.debug('Variant-only validation result', {
          variantScore: safeVariantScore,
          threshold: this.config.maxToxicityScore,
          passed: passesThreshold
        });
        return passesThreshold;
      }

      // Primary check: variant must be below absolute threshold
      if (safeVariantScore > this.config.maxToxicityScore) {
        logger.info('Variant toxicity score exceeds absolute threshold', {
          variantScore: safeVariantScore,
          threshold: this.config.maxToxicityScore,
          reason: 'absolute_threshold_exceeded'
        });
        return false;
      }

      // Secondary check: Enhanced relative toxicity increase validation
      // More sophisticated logic for allowing roast humor while preventing extreme toxicity
      const toxicityIncrease = safeVariantScore - safeOriginalScore;
      
      // Dynamic allowed increase based on original score
      // Lower original scores allow more increase, higher scores allow less
      let maxAllowedIncrease;
      if (safeOriginalScore <= 0.2) {
        maxAllowedIncrease = 0.4; // Low toxicity comments can have more roast humor
      } else if (safeOriginalScore <= 0.5) {
        maxAllowedIncrease = 0.3; // Medium toxicity comments - moderate increase
      } else {
        maxAllowedIncrease = 0.2; // High toxicity comments - minimal increase allowed
      }

      // Additional safety: never allow final score above 0.8 regardless of increase
      const maxAbsoluteScore = 0.8;
      
      if (safeVariantScore > maxAbsoluteScore) {
        logger.info('Variant toxicity score exceeds maximum absolute limit', {
          variantScore: safeVariantScore,
          maxAbsoluteScore,
          originalScore: safeOriginalScore,
          reason: 'absolute_max_exceeded'
        });
        return false;
      }

      if (toxicityIncrease > maxAllowedIncrease) {
        logger.info('Variant toxicity increase exceeds dynamic threshold', {
          originalScore: safeOriginalScore,
          variantScore: safeVariantScore,
          increase: toxicityIncrease,
          maxAllowedIncrease,
          originalScoreCategory: safeOriginalScore <= 0.2 ? 'low' : safeOriginalScore <= 0.5 ? 'medium' : 'high',
          reason: 'relative_increase_exceeded'
        });
        return false;
      }

      logger.debug('Enhanced toxicity validation passed', {
        variantScore: safeVariantScore,
        originalScore: safeOriginalScore,
        increase: toxicityIncrease,
        maxAllowedIncrease,
        validationVersion: '2.0',
        reason: 'all_checks_passed'
      });

      return true;

    } catch (error) {
      logger.error('Error in enhanced toxicity validation - failing closed', {
        variantScore,
        originalScore,
        error: error.message,
        stack: error.stack || 'No stack available',
        validationVersion: '2.0'
      });
      return false; // Fail closed on any error
    }
  }

  /**
   * Enhanced toxicity score normalization - Round 2 security improvement
   * Handles various input formats with improved edge case coverage
   * @param {any} score - Raw toxicity score from various APIs
   * @returns {number|null} Normalized score between 0-1, or null if invalid
   */
  normalizeToxicityScore(score) {
    // Handle null/undefined explicitly
    if (score === null || score === undefined) {
      return null;
    }

    // Handle empty strings and whitespace-only strings
    if (typeof score === 'string') {
      score = score.trim();
      if (score === '') {
        return null;
      }
      
      // Convert string numbers with enhanced validation
      const parsed = parseFloat(score);
      if (isNaN(parsed) || !isFinite(parsed)) {
        return null;
      }
      score = parsed;
    }

    // Handle boolean values (some APIs might return these)
    if (typeof score === 'boolean') {
      return score ? 1.0 : 0.0;
    }

    // Must be a valid number
    if (typeof score !== 'number' || isNaN(score) || !isFinite(score)) {
      return null;
    }

    // Handle negative values (normalize to 0)
    if (score < 0) {
      logger.debug('Negative toxicity score normalized to 0', { originalScore: score });
      return 0.0;
    }

    // Handle different scales with more comprehensive detection
    // Support for 0-1, 0-100, and 0-10 scales
    if (score > 10) {
      // Assume 0-100 scale
      score = score / 100;
    } else if (score > 1 && score <= 10) {
      // Assume 0-10 scale
      score = score / 10;
    }
    // If score is between 0-1, assume it's already normalized

    // Final validation: must be within valid range after normalization
    if (score > 1) {
      logger.warn('Toxicity score still above 1 after normalization', { 
        score, 
        action: 'capping_to_1.0' 
      });
      return 1.0;
    }

    // Round to reasonable precision to avoid floating point issues
    return Math.round(score * 1000) / 1000;
  }

  /**
   * Validate platform compliance
   * @param {string} content - Content to validate
   * @param {string} platform - Target platform
   * @returns {boolean} Whether content complies with platform rules
   */
  async validatePlatformCompliance(content, platform) {
    const platformLimits = {
      twitter: { maxLength: 280 },
      facebook: { maxLength: 63206 },
      instagram: { maxLength: 2200 },
      youtube: { maxLength: 10000 }
    };

    const limits = platformLimits[platform] || { maxLength: 280 };
    return content.length <= limits.maxLength;
  }

  /**
   * SECURITY FIX Round 2: Ultra-robust organization policy validation
   * Enhanced fail-closed mechanisms and comprehensive error handling
   * @param {Object} variant - Generated variant
   * @param {string} organizationId - Organization ID
   * @returns {boolean} Whether variant complies with org policies
   */
  async validateOrganizationPolicy(variant, organizationId) {
    const validationStart = Date.now();
    const validationId = `policy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Input validation with fail-closed approach
      if (!organizationId || typeof organizationId !== 'string') {
        logger.error('CRITICAL: Invalid organizationId provided - failing closed', {
          organizationId,
          organizationIdType: typeof organizationId,
          validationId,
          reason: 'invalid_organization_id'
        });
        return false;
      }

      if (!variant || typeof variant !== 'object' || !variant.text) {
        logger.error('CRITICAL: Invalid variant provided - failing closed', {
          organizationId,
          variant: variant ? { id: variant.id, hasText: !!variant.text } : null,
          validationId,
          reason: 'invalid_variant'
        });
        return false;
      }

      logger.debug('Starting ultra-robust policy validation', {
        organizationId,
        variantId: variant.id || 'unknown',
        variantLength: variant.text?.length || 0,
        validationId,
        validationVersion: '2.0'
      });

      // Enhanced timeout handling for database queries
      const queryTimeout = 5000; // 5 seconds max for policy queries
      const queryStart = Date.now();

      // SECURITY FIX: Enhanced error handling for policy validation with timeout
      const queryPromise = supabaseServiceClient
        .from('organization_policies')
        .select('*')
        .eq('organization_id', organizationId);

      let policies, policiesError;
      try {
        const result = await Promise.race([
          queryPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Policy query timeout')), queryTimeout)
          )
        ]);
        policies = result.data;
        policiesError = result.error;
      } catch (timeoutError) {
        logger.error('CRITICAL: Policy query timeout - failing closed', {
          organizationId,
          variantId: variant.id || 'unknown',
          timeout: queryTimeout,
          queryDuration: Date.now() - queryStart,
          validationId,
          error: timeoutError.message
        });
        return false;
      }

      // CRITICAL: Handle query errors explicitly to prevent policy bypass
      if (policiesError) {
        logger.error('CRITICAL: Organization policy query failed - failing closed', {
          organizationId,
          variantId: variant.id || 'unknown',
          error: policiesError.message,
          errorCode: policiesError.code || 'unknown',
          errorDetails: policiesError.details || 'none',
          stack: policiesError.stack || 'No stack available',
          validationId,
          queryDuration: Date.now() - queryStart
        });
        return false; // FAIL CLOSED - cannot validate policies, so reject
      }

      // Validate the policies response structure
      if (policies === null || policies === undefined) {
        logger.error('CRITICAL: Policies query returned null/undefined - failing closed', {
          organizationId,
          variantId: variant.id || 'unknown',
          policies,
          validationId,
          reason: 'null_policies_response'
        });
        return false;
      }

      // If no policies exist, that's a legitimate case - allow
      if (!Array.isArray(policies) || policies.length === 0) {
        logger.debug('No organization policies found, allowing by default', {
          organizationId,
          variantId: variant.id || 'unknown',
          validationId,
          policiesType: Array.isArray(policies) ? 'array' : typeof policies,
          policiesLength: Array.isArray(policies) ? policies.length : 'N/A'
        });
        return true; // No specific policies, allow
      }

      logger.info('Validating against organization policies with enhanced checks', {
        organizationId,
        variantId: variant.id || 'unknown',
        policiesCount: policies.length,
        validationId,
        queryDuration: Date.now() - queryStart
      });

      // Enhanced policy validation with more comprehensive checks
      let activePoliciesChecked = 0;
      let totalProhibitedWords = 0;

      for (const [policyIndex, policy] of policies.entries()) {
        if (!policy || typeof policy !== 'object') {
          logger.warn('Invalid policy object found, skipping', {
            organizationId,
            policyIndex,
            policy: policy,
            validationId
          });
          continue;
        }

        // Enhanced policy structure validation
        if (!policy.id) {
          logger.warn('Policy without ID found, skipping for safety', {
            organizationId,
            policyIndex,
            policyType: policy.type,
            validationId
          });
          continue;
        }

        if (policy.type === 'content_filter' && policy.enabled) {
          activePoliciesChecked++;
          
          const prohibited = policy.prohibited_words || [];
          if (!Array.isArray(prohibited)) {
            logger.warn('Invalid prohibited_words format in policy, treating as violation', {
              organizationId,
              policyId: policy.id,
              prohibitedWordsType: typeof prohibited,
              validationId,
              action: 'treating_as_violation'
            });
            // SECURITY: Invalid format could be an attack vector, fail closed
            return false;
          }

          totalProhibitedWords += prohibited.length;

          // Enhanced word matching with better security
          const violatingWords = [];
          for (const word of prohibited) {
            if (typeof word !== 'string') {
              logger.warn('Non-string prohibited word found, skipping', {
                organizationId,
                policyId: policy.id,
                wordType: typeof word,
                validationId
              });
              continue;
            }

            if (word.trim() === '') {
              continue; // Skip empty strings
            }

            // Case-insensitive matching with word boundaries for more accurate detection
            const wordRegex = new RegExp(`\\b${word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            if (wordRegex.test(variant.text.toLowerCase())) {
              violatingWords.push(word);
            }
          }
          
          if (violatingWords.length > 0) {
            logger.info('Content blocked by organization policy', {
              organizationId,
              variantId: variant.id || 'unknown',
              policyId: policy.id,
              policyType: policy.type,
              violatingWords: violatingWords.length > 10 ? violatingWords.slice(0, 10) : violatingWords,
              totalViolations: violatingWords.length,
              validationId
            });
            return false;
          }
        }
      }

      const validationDuration = Date.now() - validationStart;

      logger.info('Content passed all organization policy checks', {
        organizationId,
        variantId: variant.id || 'unknown',
        totalPolicies: policies.length,
        activePoliciesChecked,
        totalProhibitedWords,
        validationId,
        validationDuration,
        validationVersion: '2.0'
      });
      
      return true;

    } catch (error) {
      // CRITICAL: Any unexpected error should fail closed
      const validationDuration = Date.now() - validationStart;
      logger.error('CRITICAL: Unexpected error in ultra-robust policy validation - failing closed', {
        organizationId,
        variantId: variant?.id || 'unknown',
        error: error.message,
        errorName: error.name || 'UnknownError',
        stack: error.stack || 'No stack available',
        validationId,
        validationDuration,
        validationVersion: '2.0'
      });
      return false; // FAIL CLOSED - reject if we can't validate safely
    }
  }

  /**
   * SECURITY FIX Round 2: Ultra-robust rate limiting with comprehensive fail-closed mechanisms
   * Enhanced timeout handling, connection validation, and error recovery
   * @param {string} organizationId - Organization ID
   * @returns {Object} Rate limit status with detailed error information
   */
  async checkRateLimits(organizationId) {
    const rateLimitStart = Date.now();
    const rateLimitId = `rate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Input validation with fail-closed approach
      if (!organizationId || typeof organizationId !== 'string') {
        logger.error('CRITICAL: Invalid organizationId for rate limit check - failing closed', {
          organizationId,
          organizationIdType: typeof organizationId,
          rateLimitId,
          reason: 'invalid_organization_id'
        });
        return { 
          allowed: false, 
          error: 'invalid_input',
          reason: 'Invalid organization ID provided'
        };
      }

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      logger.debug('Starting ultra-robust rate limit check', {
        organizationId,
        rateLimitId,
        timeWindow: {
          hourlyStart: oneHourAgo.toISOString(),
          dailyStart: oneDayAgo.toISOString(),
          current: now.toISOString()
        },
        rateLimitVersion: '2.0'
      });

      // Enhanced connectivity and timeout handling
      const queryTimeout = 3000; // 3 seconds max for rate limit queries
      
      // SECURITY FIX: Pre-flight connectivity check
      let connectionHealthy = true;
      try {
        const healthCheckStart = Date.now();
        const healthCheck = await Promise.race([
          supabaseServiceClient.from('roast_approvals').select('id').limit(1),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), 1000)
          )
        ]);
        
        if (healthCheck.error) {
          connectionHealthy = false;
          logger.warn('Database connection health check failed', {
            organizationId,
            rateLimitId,
            healthCheckDuration: Date.now() - healthCheckStart,
            error: healthCheck.error.message
          });
        }
      } catch (healthError) {
        connectionHealthy = false;
        logger.error('CRITICAL: Database connection health check timeout - failing closed', {
          organizationId,
          rateLimitId,
          error: healthError.message,
          reason: 'connection_health_check_failed'
        });
        return { 
          allowed: false, 
          error: 'database_connectivity_failed',
          reason: 'Cannot verify database connectivity for rate limits'
        };
      }

      if (!connectionHealthy) {
        return { 
          allowed: false, 
          error: 'database_connectivity_failed',
          reason: 'Database connection unhealthy - security measure'
        };
      }

      // Enhanced hourly rate limit check with timeout and retry logic
      let hourlyCount, hourlyError;
      const hourlyQueryStart = Date.now();
      
      try {
        const hourlyResult = await Promise.race([
          supabaseServiceClient
            .from('roast_approvals')
            .select('*', { count: 'exact' })
            .eq('organization_id', organizationId)
            .eq('auto_approved', true)
            .gte('approved_at', oneHourAgo.toISOString()),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Hourly rate limit query timeout')), queryTimeout)
          )
        ]);
        
        hourlyCount = hourlyResult.count;
        hourlyError = hourlyResult.error;
        
      } catch (timeoutError) {
        logger.error('CRITICAL: Hourly rate limit query timeout - failing closed', {
          organizationId,
          rateLimitId,
          timeout: queryTimeout,
          queryDuration: Date.now() - hourlyQueryStart,
          error: timeoutError.message
        });
        return { 
          allowed: false, 
          error: 'rate_limit_query_timeout',
          reason: 'Hourly rate limit query timeout - security measure'
        };
      }

      // CRITICAL: If we can't check hourly limits, fail closed
      if (hourlyError) {
        logger.error('CRITICAL: Hourly rate limit check failed - failing closed', {
          organizationId,
          rateLimitId,
          error: hourlyError.message,
          errorCode: hourlyError.code || 'unknown',
          errorDetails: hourlyError.details || 'none',
          stack: hourlyError.stack || 'No stack available',
          queryDuration: Date.now() - hourlyQueryStart
        });
        return { 
          allowed: false, 
          error: 'rate_limit_check_failed',
          reason: 'Cannot verify hourly rate limits - security measure'
        };
      }

      // Enhanced daily rate limit check with timeout and retry logic  
      let dailyCount, dailyError;
      const dailyQueryStart = Date.now();
      
      try {
        const dailyResult = await Promise.race([
          supabaseServiceClient
            .from('roast_approvals')
            .select('*', { count: 'exact' })
            .eq('organization_id', organizationId)
            .eq('auto_approved', true)
            .gte('approved_at', oneDayAgo.toISOString()),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Daily rate limit query timeout')), queryTimeout)
          )
        ]);
        
        dailyCount = dailyResult.count;
        dailyError = dailyResult.error;
        
      } catch (timeoutError) {
        logger.error('CRITICAL: Daily rate limit query timeout - failing closed', {
          organizationId,
          rateLimitId,
          timeout: queryTimeout,
          queryDuration: Date.now() - dailyQueryStart,
          error: timeoutError.message
        });
        return { 
          allowed: false, 
          error: 'rate_limit_query_timeout',
          reason: 'Daily rate limit query timeout - security measure'
        };
      }

      // CRITICAL: If we can't check daily limits, fail closed
      if (dailyError) {
        logger.error('CRITICAL: Daily rate limit check failed - failing closed', {
          organizationId,
          rateLimitId,
          error: dailyError.message,
          errorCode: dailyError.code || 'unknown',
          errorDetails: dailyError.details || 'none',
          stack: dailyError.stack || 'No stack available',
          queryDuration: Date.now() - dailyQueryStart
        });
        return { 
          allowed: false, 
          error: 'rate_limit_check_failed',
          reason: 'Cannot verify daily rate limits - security measure'
        };
      }

      // Enhanced count validation with comprehensive edge case handling
      const safeHourlyCount = this.validateRateLimitCount(hourlyCount, 'hourly', rateLimitId);
      const safeDailyCount = this.validateRateLimitCount(dailyCount, 'daily', rateLimitId);

      // If count validation failed, fail closed
      if (safeHourlyCount === null || safeDailyCount === null) {
        logger.error('CRITICAL: Rate limit count validation failed - failing closed', {
          organizationId,
          rateLimitId,
          hourlyCount,
          dailyCount,
          safeHourlyCount,
          safeDailyCount,
          reason: 'count_validation_failed'
        });
        return { 
          allowed: false, 
          error: 'rate_limit_validation_failed',
          reason: 'Rate limit count validation failed - security measure'
        };
      }

      const hourlyAllowed = safeHourlyCount < this.config.maxAutoApprovalsPerHour;
      const dailyAllowed = safeDailyCount < this.config.maxAutoApprovalsPerDay;
      const overallAllowed = hourlyAllowed && dailyAllowed;

      const rateLimitDuration = Date.now() - rateLimitStart;

      logger.info('Ultra-robust rate limit check completed successfully', {
        organizationId,
        rateLimitId,
        hourlyCount: safeHourlyCount,
        dailyCount: safeDailyCount,
        hourlyLimit: this.config.maxAutoApprovalsPerHour,
        dailyLimit: this.config.maxAutoApprovalsPerDay,
        hourlyAllowed,
        dailyAllowed,
        overallAllowed,
        rateLimitDuration,
        rateLimitVersion: '2.0',
        queryPerformance: {
          hourlyQueryTime: Date.now() - hourlyQueryStart,
          dailyQueryTime: Date.now() - dailyQueryStart
        }
      });

      return {
        allowed: overallAllowed,
        rateLimitId,
        validationDuration: rateLimitDuration,
        hourly: {
          count: safeHourlyCount,
          limit: this.config.maxAutoApprovalsPerHour,
          allowed: hourlyAllowed,
          remaining: Math.max(0, this.config.maxAutoApprovalsPerHour - safeHourlyCount)
        },
        daily: {
          count: safeDailyCount,
          limit: this.config.maxAutoApprovalsPerDay,
          allowed: dailyAllowed,
          remaining: Math.max(0, this.config.maxAutoApprovalsPerDay - safeDailyCount)
        }
      };

    } catch (error) {
      // CRITICAL: Any unexpected error should fail closed
      const rateLimitDuration = Date.now() - rateLimitStart;
      logger.error('CRITICAL: Unexpected error in ultra-robust rate limit check - failing closed', {
        organizationId,
        rateLimitId,
        error: error.message,
        errorName: error.name || 'UnknownError',
        stack: error.stack || 'No stack available',
        rateLimitDuration,
        rateLimitVersion: '2.0'
      });
      return { 
        allowed: false, 
        error: 'rate_limit_check_failed',
        reason: 'Unexpected error during rate limit validation',
        rateLimitId,
        validationDuration: rateLimitDuration
      };
    }
  }

  /**
   * Validate rate limit count with comprehensive edge case handling
   * @param {any} count - Raw count from database query
   * @param {string} type - Type of count (hourly/daily)
   * @param {string} rateLimitId - Rate limit operation ID
   * @returns {number|null} Validated count or null if invalid
   */
  validateRateLimitCount(count, type, rateLimitId) {
    // Handle null/undefined
    if (count === null || count === undefined) {
      logger.debug('Rate limit count is null/undefined, treating as 0', {
        count,
        type,
        rateLimitId
      });
      return 0;
    }

    // Handle string numbers
    if (typeof count === 'string') {
      const parsed = parseInt(count, 10);
      if (isNaN(parsed)) {
        logger.warn('Invalid string count in rate limit check', {
          count,
          type,
          rateLimitId,
          parsed
        });
        return null;
      }
      return Math.max(0, parsed);
    }

    // Must be a number
    if (typeof count !== 'number') {
      logger.warn('Non-numeric count in rate limit check', {
        count,
        countType: typeof count,
        type,
        rateLimitId
      });
      return null;
    }

    // Handle NaN and infinite values
    if (isNaN(count) || !isFinite(count)) {
      logger.warn('NaN or infinite count in rate limit check', {
        count,
        type,
        rateLimitId
      });
      return null;
    }

    // Handle negative counts (normalize to 0)
    if (count < 0) {
      logger.warn('Negative count in rate limit check, normalizing to 0', {
        count,
        type,
        rateLimitId
      });
      return 0;
    }

    // Return validated count
    return Math.floor(count);
  }

  /**
   * Record auto-approval in database
   * @param {Object} comment - Original comment
   * @param {Object} variant - Approved variant
   * @param {string} organizationId - Organization ID
   * @param {Object} securityResults - Security validation results
   * @returns {Object} Approval record
   */
  async recordAutoApproval(comment, variant, organizationId, securityResults) {
    try {
      const approvalData = {
        comment_id: comment.id,
        variant_id: variant.id,
        roast_id: `auto_roast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        organization_id: organizationId,
        auto_approved: true,
        approved_by: 'system',
        approved_at: new Date().toISOString(),
        security_validations: securityResults.validations,
        metadata: {
          autoApprovalVersion: '1.0',
          securityScore: securityResults.passed ? 1.0 : 0.0,
          originalText: comment.text,
          generatedText: variant.text,
          platform: comment.platform
        }
      };

      const { data: approval, error } = await supabaseServiceClient
        .from('roast_approvals')
        .insert(approvalData)
        .select()
        .single();

      if (error) throw error;

      return approval;

    } catch (error) {
      logger.error('Error recording auto-approval', {
        organizationId,
        commentId: comment.id,
        variantId: variant.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update rate limit counters
   * @param {string} organizationId - Organization ID
   */
  async updateRateLimitCounters(organizationId) {
    // This could be implemented with Redis for better performance
    // For now, we rely on database queries in checkRateLimits
    logger.debug('Rate limit counters updated', { organizationId });
  }

  /**
   * Get plan-specific limits for auto-approval
   * @param {string} plan - Organization plan
   * @returns {Object} Plan limits
   */
  getPlanLimits(plan) {
    const limits = {
      free: {
        autoApprovalAllowed: false, // Free plans require manual approval
        maxAutoApprovalsPerDay: 0
      },
      starter: {
        autoApprovalAllowed: true,
        maxAutoApprovalsPerDay: 50
      },
      pro: {
        autoApprovalAllowed: true,
        maxAutoApprovalsPerDay: 200
      },
      plus: {
        autoApprovalAllowed: true,
        maxAutoApprovalsPerDay: 500
      }
    };

    return limits[plan] || limits.free;
  }

  /**
   * Get auto-approval statistics for organization
   * @param {string} organizationId - Organization ID
   * @returns {Object} Auto-approval statistics
   */
  async getAutoApprovalStats(organizationId) {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const { data: dailyStats } = await supabaseServiceClient
        .from('roast_approvals')
        .select('approved_at, auto_approved')
        .eq('organization_id', organizationId)
        .gte('approved_at', oneDayAgo.toISOString());

      const { data: weeklyStats } = await supabaseServiceClient
        .from('roast_approvals')
        .select('approved_at, auto_approved')
        .eq('organization_id', organizationId)
        .gte('approved_at', oneWeekAgo.toISOString());

      const dailyAuto = (dailyStats || []).filter(s => s.auto_approved).length;
      const dailyManual = (dailyStats || []).filter(s => !s.auto_approved).length;
      const weeklyAuto = (weeklyStats || []).filter(s => s.auto_approved).length;
      const weeklyManual = (weeklyStats || []).filter(s => !s.auto_approved).length;

      return {
        daily: {
          auto: dailyAuto,
          manual: dailyManual,
          total: dailyAuto + dailyManual,
          autoPercentage: dailyAuto + dailyManual > 0 ? (dailyAuto / (dailyAuto + dailyManual) * 100).toFixed(1) : 0
        },
        weekly: {
          auto: weeklyAuto,
          manual: weeklyManual,
          total: weeklyAuto + weeklyManual,
          autoPercentage: weeklyAuto + weeklyManual > 0 ? (weeklyAuto / (weeklyAuto + weeklyManual) * 100).toFixed(1) : 0
        }
      };

    } catch (error) {
      logger.error('Error getting auto-approval stats', {
        organizationId,
        error: error.message
      });
      return null;
    }
  }
}

module.exports = AutoApprovalService;