/**
 * @fileoverview Trial Policy - Verifies trial is active or not applicable
 * @module services/ingestion/policies/TrialPolicy
 * @since ROA-388
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../../../config');
const logger = require('../../../utils/logger');

/**
 * @typedef {import('../types').PolicyResult} PolicyResult
 * @typedef {import('../types').EligibilityContext} EligibilityContext
 */

class TrialPolicy {
  constructor() {
    this.name = 'TrialPolicy';
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  }

  /**
   * Evaluates if trial is active or not applicable
   *
   * Trial is considered "not applicable" if:
   * - User has an active subscription
   * - User's plan doesn't have trial (e.g., Plus)
   *
   * Trial is expired if:
   * - trial_ends_at is in the past
   * - AND user doesn't have active subscription
   *
   * @param {EligibilityContext} context - Evaluation context
   * @returns {Promise<PolicyResult>}
   */
  async evaluate(context) {
    try {
      const { userId } = context;

      // Get user's current plan and trial status
      const { data: profile, error: profileError } = await this.supabase
        .from('profiles')
        .select('current_plan, trial_ends_at')
        .eq('user_id', userId)
        .single();

      if (profileError) {
        logger.error('TrialPolicy: Error fetching user profile', {
          userId,
          error: profileError.message,
          requestId: context.requestId
        });
        // Fail-safe: block if we can't verify trial status
        return {
          allowed: false,
          reason: 'trial_verification_error',
          metadata: { error: profileError.message }
        };
      }

      // Check if user has active subscription (overrides trial)
      const { data: subscription } = await this.supabase
        .from('polar_subscriptions')
        .select('status')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      // If user has active subscription, trial is not applicable
      if (subscription && subscription.status === 'active') {
        return {
          allowed: true,
          metadata: {
            trial_applicable: false,
            reason: 'active_subscription'
          }
        };
      }

      // If no trial_ends_at, user never had trial or plan doesn't support trial
      if (!profile.trial_ends_at) {
        // This is acceptable for plans without trial (e.g., Plus)
        return {
          allowed: true,
          metadata: {
            trial_applicable: false,
            reason: 'no_trial_configured'
          }
        };
      }

      // Check if trial is still active
      const now = new Date();
      const trialEndsAt = new Date(profile.trial_ends_at);

      if (now < trialEndsAt) {
        // Trial is still active
        return {
          allowed: true,
          metadata: {
            trial_active: true,
            trial_ends_at: profile.trial_ends_at
          }
        };
      } else {
        // Trial has expired
        logger.info('TrialPolicy: Trial expired', {
          userId,
          trial_ends_at: profile.trial_ends_at,
          requestId: context.requestId
        });
        return {
          allowed: false,
          reason: 'trial_expired',
          metadata: {
            trial_ended_at: profile.trial_ends_at
          }
        };
      }

    } catch (err) {
      logger.error('TrialPolicy: Unexpected error', {
        error: err.message,
        requestId: context.requestId
      });
      // Fail-safe: block on unexpected errors
      return {
        allowed: false,
        reason: 'trial_policy_error',
        metadata: { error: err.message }
      };
    }
  }
}

module.exports = TrialPolicy;
