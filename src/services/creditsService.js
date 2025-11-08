/**
 * Credits Service v2 - Dual Credit System
 * 
 * Manages analysis and roast credits with atomic consumption,
 * billing period tracking, and comprehensive audit logging.
 * 
 * Features:
 * - Dual credit types (analysis + roast)
 * - Atomic consumption with race condition protection
 * - Stripe billing cycle integration
 * - Comprehensive audit logging
 * - Feature flag support
 * 
 * @author Roastr.ai Team
 * @version 2.0.0
 */

const { createUserClient } = require('../config/supabase');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');
const planService = require('./planService');

class CreditsService {
  constructor() {
    this.isEnabled = () => flags.isEnabled('ENABLE_CREDITS_V2');
  }

  /**
   * Get or create active billing period for user
   * @param {string} userId - User ID
   * @param {Object} options - Optional plan limits override
   * @returns {Promise<Object>} Active period with credit status
   */
  async getOrCreateActivePeriod(userId, options = {}) {
    if (!this.isEnabled()) {
      return this._getFallbackPeriod(userId);
    }

    try {
      const userClient = createUserClient();
      
      // Use database function for atomic operation
      const { data, error } = await userClient.rpc('get_or_create_active_period', {
        p_user_id: userId,
        p_analysis_limit: options.analysisLimit || null,
        p_roast_limit: options.roastLimit || null
      });

      if (error) {
        logger.error('Failed to get/create active period', {
          userId,
          error: error.message
        });
        throw error;
      }

      return this._formatPeriodResponse(data);

    } catch (error) {
      logger.error('Credits service error in getOrCreateActivePeriod', {
        userId,
        error: error.message
      });
      
      // Fallback to legacy system
      return this._getFallbackPeriod(userId);
    }
  }

  /**
   * Check if user can consume specified credits
   * @param {string} userId - User ID
   * @param {string} creditType - 'analysis' or 'roast'
   * @param {number} amount - Amount to check (default: 1)
   * @returns {Promise<Object>} Availability status
   */
  async canConsume(userId, creditType, amount = 1) {
    if (!this.isEnabled()) {
      return { canConsume: true, reason: 'credits_v2_disabled' };
    }

    try {
      const period = await this.getOrCreateActivePeriod(userId);
      const creditInfo = period[creditType];

      if (!creditInfo) {
        throw new Error(`Invalid credit type: ${creditType}`);
      }

      const canConsume = creditInfo.remaining >= amount;
      
      return {
        canConsume,
        remaining: creditInfo.remaining,
        limit: creditInfo.limit,
        used: creditInfo.used,
        reason: canConsume ? null : 'insufficient_credits',
        periodEnd: period.period_end
      };

    } catch (error) {
      logger.error('Failed to check credit availability', {
        userId,
        creditType,
        amount,
        error: error.message
      });
      
      // Fail open for availability checks
      return { canConsume: true, reason: 'check_failed' };
    }
  }

  /**
   * Atomically consume credits with limit checking
   * @param {string} userId - User ID
   * @param {string} creditType - 'analysis' or 'roast'
   * @param {Object} options - Consumption options
   * @returns {Promise<boolean>} Success status
   */
  async consume(userId, creditType, options = {}) {
    const {
      amount = 1,
      actionType = 'unknown',
      platform = null,
      metadata = {}
    } = options;

    if (!this.isEnabled()) {
      logger.debug('Credits v2 disabled, allowing consumption', {
        userId,
        creditType,
        amount
      });
      return true;
    }

    try {
      const userClient = createUserClient();
      
      // Use database function for atomic consumption
      const { data: success, error } = await userClient.rpc('consume_credits', {
        p_user_id: userId,
        p_credit_type: creditType,
        p_amount: amount,
        p_action_type: actionType,
        p_platform: platform,
        p_metadata: metadata
      });

      if (error) {
        logger.error('Failed to consume credits', {
          userId,
          creditType,
          amount,
          actionType,
          error: error.message
        });
        return false;
      }

      if (success) {
        logger.debug('Credits consumed successfully', {
          userId,
          creditType,
          amount,
          actionType,
          platform
        });
      } else {
        logger.warn('Credit consumption failed - insufficient credits', {
          userId,
          creditType,
          amount,
          actionType
        });
      }

      return success;

    } catch (error) {
      logger.error('Credits service error in consume', {
        userId,
        creditType,
        amount,
        error: error.message
      });
      
      // Fail open for consumption errors to prevent blocking
      return true;
    }
  }

  /**
   * Get comprehensive credit status for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Complete credit status
   */
  async getCreditStatus(userId) {
    if (!this.isEnabled()) {
      return this._getFallbackStatus(userId);
    }

    try {
      const userClient = createUserClient();
      
      const { data, error } = await userClient.rpc('check_credit_availability', {
        p_user_id: userId
      });

      if (error) {
        throw error;
      }

      return {
        ...data,
        creditsV2Enabled: true,
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to get credit status', {
        userId,
        error: error.message
      });
      
      return this._getFallbackStatus(userId);
    }
  }

  /**
   * Reset credits for new billing period (called by Stripe webhooks)
   * @param {string} userId - User ID
   * @param {Object} billingPeriod - New billing period info
   * @returns {Promise<boolean>} Success status
   */
  async resetCreditsForNewPeriod(userId, billingPeriod) {
    if (!this.isEnabled()) {
      logger.debug('Credits v2 disabled, skipping reset', { userId });
      return true;
    }

    try {
      const userClient = createUserClient();
      
      // Get user's plan limits
      const planLimits = await this._getUserPlanLimits(userId);
      
      // Create new period
      const { error } = await userClient
        .from('usage_counters')
        .insert({
          user_id: userId,
          period_start: billingPeriod.start,
          period_end: billingPeriod.end,
          analysis_used: 0,
          analysis_limit: planLimits.analysisLimit,
          roast_used: 0,
          roast_limit: planLimits.roastLimit,
          stripe_customer_id: billingPeriod.stripeCustomerId
        });

      if (error) {
        throw error;
      }

      logger.info('Credits reset for new billing period', {
        userId,
        periodStart: billingPeriod.start,
        periodEnd: billingPeriod.end,
        analysisLimit: planLimits.analysisLimit,
        roastLimit: planLimits.roastLimit
      });

      return true;

    } catch (error) {
      logger.error('Failed to reset credits for new period', {
        userId,
        billingPeriod,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get credit consumption history
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Consumption history
   */
  async getConsumptionHistory(userId, options = {}) {
    const {
      creditType = null,
      limit = 50,
      offset = 0,
      startDate = null,
      endDate = null
    } = options;

    if (!this.isEnabled()) {
      return [];
    }

    try {
      const userClient = createUserClient();
      
      let query = userClient
        .from('credit_consumption_log')
        .select('*')
        .eq('user_id', userId)
        .order('consumed_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (creditType) {
        query = query.eq('credit_type', creditType);
      }

      if (startDate) {
        query = query.gte('consumed_at', startDate);
      }

      if (endDate) {
        query = query.lte('consumed_at', endDate);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];

    } catch (error) {
      logger.error('Failed to get consumption history', {
        userId,
        options,
        error: error.message
      });
      return [];
    }
  }

  // Private helper methods

  async _getUserPlanLimits(userId) {
    try {
      const userPlan = await planService.getUserPlan(userId);
      return this._mapPlanToLimits(userPlan);
    } catch (error) {
      logger.warn('Failed to get user plan, using free limits', {
        userId,
        error: error.message
      });
      return this._mapPlanToLimits('starter_trial');
    }
  }

  _mapPlanToLimits(planName) {
    const planLimits = {
      free: { analysisLimit: 100, roastLimit: 10 },
      starter: { analysisLimit: 1000, roastLimit: 10 },
      pro: { analysisLimit: 10000, roastLimit: 1000 },
      plus: { analysisLimit: 100000, roastLimit: 5000 },
      creator_plus: { analysisLimit: 100000, roastLimit: 5000 }
    };

    return planLimits[planName] || planLimits.free;
  }

  _formatPeriodResponse(data) {
    return {
      period_start: data.period_start,
      period_end: data.period_end,
      analysis: {
        used: data.analysis_used,
        limit: data.analysis_limit,
        remaining: data.analysis_limit - data.analysis_used
      },
      roast: {
        used: data.roast_used,
        limit: data.roast_limit,
        remaining: data.roast_limit - data.roast_used
      }
    };
  }

  async _getFallbackPeriod(userId) {
    // Legacy system fallback
    const planLimits = await this._getUserPlanLimits(userId);
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return {
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      analysis: {
        used: 0,
        limit: planLimits.analysisLimit,
        remaining: planLimits.analysisLimit
      },
      roast: {
        used: 0,
        limit: planLimits.roastLimit,
        remaining: planLimits.roastLimit
      },
      fallback: true
    };
  }

  async _getFallbackStatus(userId) {
    const period = await this._getFallbackPeriod(userId);
    return {
      ...period,
      creditsV2Enabled: false,
      lastUpdated: new Date().toISOString()
    };
  }
}

// Export singleton instance
module.exports = new CreditsService();
