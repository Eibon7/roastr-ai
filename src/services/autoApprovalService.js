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

      // 2. Toxicity threshold check
      validations.toxicityThreshold = generatedVariant.score <= this.config.maxToxicityScore;

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
   * Validate against organization-specific policies
   * @param {Object} variant - Generated variant
   * @param {string} organizationId - Organization ID
   * @returns {boolean} Whether variant complies with org policies
   */
  async validateOrganizationPolicy(variant, organizationId) {
    try {
      // Get organization-specific policies
      const { data: policies } = await supabaseServiceClient
        .from('organization_policies')
        .select('*')
        .eq('organization_id', organizationId);

      if (!policies || policies.length === 0) {
        return true; // No specific policies, allow
      }

      // Check against each policy
      for (const policy of policies) {
        if (policy.type === 'content_filter' && policy.enabled) {
          const prohibited = policy.prohibited_words || [];
          const hasProhibited = prohibited.some(word => 
            variant.text.toLowerCase().includes(word.toLowerCase())
          );
          if (hasProhibited) return false;
        }
      }

      return true;

    } catch (error) {
      logger.error('Error validating organization policy', {
        organizationId,
        variantId: variant.id,
        error: error.message
      });
      return false; // Fail safe - reject if we can't validate
    }
  }

  /**
   * Check rate limits for auto-approval
   * @param {string} organizationId - Organization ID
   * @returns {Object} Rate limit status
   */
  async checkRateLimits(organizationId) {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Count auto-approvals in the last hour
      const { count: hourlyCount } = await supabaseServiceClient
        .from('roast_approvals')
        .select('*', { count: 'exact' })
        .eq('organization_id', organizationId)
        .eq('auto_approved', true)
        .gte('approved_at', oneHourAgo.toISOString());

      // Count auto-approvals in the last day
      const { count: dailyCount } = await supabaseServiceClient
        .from('roast_approvals')
        .select('*', { count: 'exact' })
        .eq('organization_id', organizationId)
        .eq('auto_approved', true)
        .gte('approved_at', oneDayAgo.toISOString());

      const hourlyAllowed = (hourlyCount || 0) < this.config.maxAutoApprovalsPerHour;
      const dailyAllowed = (dailyCount || 0) < this.config.maxAutoApprovalsPerDay;

      return {
        allowed: hourlyAllowed && dailyAllowed,
        hourly: {
          count: hourlyCount || 0,
          limit: this.config.maxAutoApprovalsPerHour,
          allowed: hourlyAllowed
        },
        daily: {
          count: dailyCount || 0,
          limit: this.config.maxAutoApprovalsPerDay,
          allowed: dailyAllowed
        }
      };

    } catch (error) {
      logger.error('Error checking rate limits', {
        organizationId,
        error: error.message
      });
      return { allowed: false, error: error.message };
    }
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