/**
 * @fileoverview User Status Policy - Verifies user is active and not suspended
 * @module services/ingestion/policies/UserStatusPolicy
 * @since ROA-388
 */

const { supabaseServiceClient } = require('../../../config/supabase');
const logger = require('../../../utils/logger');

/**
 * @typedef {import('../types').PolicyResult} PolicyResult
 * @typedef {import('../types').EligibilityContext} EligibilityContext
 */

class UserStatusPolicy {
  constructor() {
    this.name = 'UserStatusPolicy';
    this.supabase = supabaseServiceClient;
  }

  /**
   * Evaluates if user is active and not suspended
   *
   * @param {EligibilityContext} context - Evaluation context
   * @returns {Promise<PolicyResult>}
   */
  async evaluate(context) {
    try {
      const { userId } = context;

      const { data: profile, error } = await this.supabase
        .from('profiles')
        .select('is_suspended, deleted_at')
        .eq('user_id', userId)
        .single();

      if (error) {
        logger.error('UserStatusPolicy: Error fetching user profile', {
          userId,
          error: error.message,
          requestId: context.requestId
        });
        // Fail-safe: block if we can't verify status
        return {
          allowed: false,
          reason: 'user_status_unknown',
          metadata: { error: error.message }
        };
      }

      // Check if user is deleted
      if (profile.deleted_at) {
        return {
          allowed: false,
          reason: 'user_deleted',
          metadata: { deleted_at: profile.deleted_at }
        };
      }

      // Check if user is suspended
      if (profile.is_suspended) {
        return {
          allowed: false,
          reason: 'user_suspended',
          metadata: { is_suspended: true }
        };
      }

      return {
        allowed: true,
        metadata: { status: 'active' }
      };

    } catch (err) {
      logger.error('UserStatusPolicy: Unexpected error', {
        error: err.message,
        requestId: context.requestId
      });
      // Fail-safe: block on unexpected errors
      return {
        allowed: false,
        reason: 'user_status_error',
        metadata: { error: err.message }
      };
    }
  }
}

module.exports = UserStatusPolicy;
