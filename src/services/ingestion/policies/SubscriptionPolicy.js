/**
 * @fileoverview Subscription Policy - Verifies subscription is active
 * @module services/ingestion/policies/SubscriptionPolicy
 * @since ROA-388
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../../../config');
const logger = require('../../../utils/logger');

/**
 * @typedef {import('../types').PolicyResult} PolicyResult
 * @typedef {import('../types').EligibilityContext} EligibilityContext
 */

class SubscriptionPolicy {
  constructor() {
    this.name = 'SubscriptionPolicy';
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  }

  /**
   * Evaluates if subscription is active
   *
   * States that allow ingestion:
   * - 'active': Active subscription
   * - 'trialing': Trial period
   * - 'canceled_pending': Canceled but still within paid period
   *
   * States that block ingestion:
   * - 'paused': Service paused
   * - 'expired_trial_pending_payment': Trial expired, waiting payment
   * - 'payment_retry': Payment failed, retry in progress
   *
   * @param {EligibilityContext} context - Evaluation context
   * @returns {Promise<PolicyResult>}
   */
  async evaluate(context) {
    try {
      const { userId } = context;

      const { data: subscription, error } = await this.supabase
        .from('polar_subscriptions')
        .select('status, current_period_end')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error) {
        // If no subscription found, check if user is on a free/trial plan
        if (error.code === 'PGRST116') {
          logger.warn('SubscriptionPolicy: No active subscription found', {
            userId,
            requestId: context.requestId
          });
          // Allow ingestion for users without subscription (could be trial or free tier)
          // This will be caught by TrialPolicy if trial is expired
          return {
            allowed: true,
            metadata: { status: 'no_subscription' }
          };
        }

        logger.error('SubscriptionPolicy: Error fetching subscription', {
          userId,
          error: error.message,
          errorCode: error.code,
          requestId: context.requestId
        });
        // Fail-safe: block if we can't verify subscription
        return {
          allowed: false,
          reason: 'subscription_verification_error',
          metadata: { error: error.message, code: error.code }
        };
      }

      const status = subscription.status;

      // Active states
      if (status === 'active' || status === 'trialing') {
        return {
          allowed: true,
          metadata: { status }
        };
      }

      // Canceled but still within paid period
      if (status === 'canceled_pending') {
        const now = new Date();
        const periodEnd = new Date(subscription.current_period_end);

        if (now < periodEnd) {
          // Still within paid period
          return {
            allowed: true,
            metadata: {
              status,
              period_ends: subscription.current_period_end
            }
          };
        } else {
          // Past period end
          return {
            allowed: false,
            reason: 'subscription_inactive',
            metadata: {
              status,
              period_ended: subscription.current_period_end
            }
          };
        }
      }

      // Inactive states
      if (['paused', 'expired_trial_pending_payment', 'payment_retry'].includes(status)) {
        return {
          allowed: false,
          reason: 'subscription_inactive',
          metadata: { status }
        };
      }

      // Unknown status - fail-safe to block
      logger.warn('SubscriptionPolicy: Unknown subscription status', {
        userId,
        status,
        requestId: context.requestId
      });
      return {
        allowed: false,
        reason: 'subscription_status_unknown',
        metadata: { status }
      };

    } catch (err) {
      logger.error('SubscriptionPolicy: Unexpected error', {
        error: err.message,
        requestId: context.requestId
      });
      // Fail-safe: block on unexpected errors
      return {
        allowed: false,
        reason: 'subscription_policy_error',
        metadata: { error: err.message }
      };
    }
  }
}

module.exports = SubscriptionPolicy;
