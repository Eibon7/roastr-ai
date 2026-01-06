/**
 * @fileoverview Account Status Policy - Verifies connected account is active and has valid OAuth
 * @module services/ingestion/policies/AccountStatusPolicy
 * @since ROA-394
 */

const { supabaseServiceClient } = require('../../../config/supabase');
const logger = require('../../../utils/logger');

/**
 * @typedef {import('../types').PolicyResult} PolicyResult
 * @typedef {import('../types').EligibilityContext} EligibilityContext
 */

class AccountStatusPolicy {
  constructor() {
    this.name = 'AccountStatusPolicy';
    this.supabase = supabaseServiceClient;
  }

  /**
   * Evaluates if connected account is active and has valid OAuth tokens
   *
   * @param {EligibilityContext} context - Evaluation context
   * @returns {Promise<PolicyResult>}
   */
  async evaluate(context) {
    try {
      const { userId, accountId, platform } = context;

      // Validate required context fields
      if (!accountId || !platform) {
        logger.error('AccountStatusPolicy: Missing required context fields', {
          userId,
          accountId,
          platform,
          requestId: context.requestId
        });
        // Fail-safe: block if we can't identify the account
        return {
          allowed: false,
          reason: 'account_context_missing',
          metadata: { missing: !accountId ? 'accountId' : 'platform' }
        };
      }

      const { data: account, error } = await this.supabase
        .from('connected_accounts')
        .select('connection_status, oauth_error')
        .eq('user_id', userId)
        .eq('account_id', accountId)
        .eq('platform', platform)
        .single();

      if (error) {
        // Account not found is expected if never connected
        if (error.code === 'PGRST116') {
          return {
            allowed: false,
            reason: 'account_not_found',
            metadata: { accountId, platform }
          };
        }

        logger.error('AccountStatusPolicy: Error fetching connected account', {
          userId,
          accountId,
          platform,
          error: error.message,
          requestId: context.requestId
        });
        // Fail-safe: block if we can't verify status
        return {
          allowed: false,
          reason: 'account_status_unknown',
          metadata: { error: error.message }
        };
      }

      // Check connection status
      if (account.connection_status !== 'connected') {
        return {
          allowed: false,
          reason: 'account_disconnected',
          metadata: {
            connection_status: account.connection_status,
            accountId,
            platform
          }
        };
      }

      // Check OAuth errors
      if (account.oauth_error) {
        return {
          allowed: false,
          reason: 'account_oauth_error',
          metadata: {
            oauth_error_type: typeof account.oauth_error === 'object'
              ? account.oauth_error.type
              : 'unknown',
            accountId,
            platform
          }
        };
      }

      return {
        allowed: true,
        metadata: { connection_status: 'connected', accountId, platform }
      };

    } catch (err) {
      logger.error('AccountStatusPolicy: Unexpected error', {
        error: err.message,
        requestId: context.requestId
      });
      // Fail-safe: block on unexpected errors
      return {
        allowed: false,
        reason: 'account_status_error',
        metadata: { error: err.message }
      };
    }
  }
}

module.exports = AccountStatusPolicy;

