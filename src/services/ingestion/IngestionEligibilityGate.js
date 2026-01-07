/**
 * @fileoverview Ingestion Eligibility Gate (IG1) - Orchestrates pre-ingestion eligibility checks
 * @module services/ingestion/IngestionEligibilityGate
 * @since ROA-388
 *
 * IG1 is the mandatory gate before any ingestion process.
 * It evaluates a set of independent policies to determine if a user
 * is authorized to ingest comments at the current moment.
 *
 * Design Principles:
 * - Deterministic: Same input → Same output
 * - Auditable: All decisions are logged and tracked
 * - No side effects: Only reads, never writes
 * - Fail-fast: First blocking policy stops evaluation
 * - Observable: Emits events for all blocks
 */

const UserStatusPolicy = require('./policies/UserStatusPolicy');
const AccountStatusPolicy = require('./policies/AccountStatusPolicy');
const SubscriptionPolicy = require('./policies/SubscriptionPolicy');
const TrialPolicy = require('./policies/TrialPolicy');
const CreditPolicy = require('./policies/CreditPolicy');
const FeatureFlagPolicy = require('./policies/FeatureFlagPolicy');
const RateLimitPolicy = require('./policies/RateLimitPolicy');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * @typedef {import('./types').PolicyResult} PolicyResult
 * @typedef {import('./types').IngestionEligibilityResult} IngestionEligibilityResult
 * @typedef {import('./types').EligibilityContext} EligibilityContext
 */

class IngestionEligibilityGate {
  constructor() {
    // Initialize policies in evaluation order (optimized for fail-fast)
    this.policies = [
      new UserStatusPolicy(),      // 1. User must be active
      new AccountStatusPolicy(),   // 2. Connected account must be valid
      new SubscriptionPolicy(),    // 3. Account state
      new TrialPolicy(),           // 4. Trial state
      new CreditPolicy(),          // 5. Usage limits
      new FeatureFlagPolicy(),     // 6. Global configuration
      new RateLimitPolicy()        // 7. Infrastructure limits
    ];
  }

  /**
   * Evaluates if ingestion is allowed for the given context
   *
   * Evaluation order is deterministic and optimized for fail-fast:
   * 1. UserStatusPolicy - Check if user is active (most critical)
   * 2. AccountStatusPolicy - Check if connected account is valid
   * 3. SubscriptionPolicy - Check subscription state
   * 4. TrialPolicy - Check trial validity
   * 5. CreditPolicy - Check remaining credits
   * 6. FeatureFlagPolicy - Check feature flags
   * 7. RateLimitPolicy - Check rate limits
   *
   * The first policy that returns `allowed: false` stops the evaluation
   * and determines the final result.
   *
   * @param {Object} input - Input parameters
   * @param {string} input.userId - User ID requesting ingestion
   * @param {string} input.accountId - Connected account ID
   * @param {string} input.platform - Platform ('x' | 'youtube')
   * @param {string} input.flow - Ingestion flow ('timeline' | 'mentions' | 'replies')
   * @param {string} [input.requestId] - Optional request ID for tracing
   * @returns {Promise<IngestionEligibilityResult>}
   */
  async evaluate({ userId, accountId, platform, flow, requestId }) {
    const correlationId = requestId || uuidv4();

    /** @type {EligibilityContext} */
    const context = {
      userId,
      accountId,
      platform,
      flow,
      requestId: correlationId
    };

    logger.info('IG1: Starting eligibility evaluation', {
      userId,
      accountId,
      platform,
      flow,
      requestId: correlationId
    });

    try {
      // Evaluate policies in order
      for (const policy of this.policies) {
        const startTime = Date.now();

        logger.debug(`IG1: Evaluating ${policy.name}`, {
          requestId: correlationId
        });

        const result = await policy.evaluate(context);
        const duration = Date.now() - startTime;

        logger.debug(`IG1: ${policy.name} completed`, {
          allowed: result.allowed,
          reason: result.reason,
          duration_ms: duration,
          requestId: correlationId
        });

        // If policy blocks, stop evaluation and return
        if (!result.allowed) {
          logger.info(`IG1: Ingestion blocked by ${policy.name}`, {
            policy: policy.name,
            reason: result.reason,
            retry_after_seconds: result.retry_after_seconds,
            requestId: correlationId
          });

          // Emit blocked event for observability
          await this._emitBlockedEvent({
            userId,
            accountId,
            platform,
            flow,
            policy: policy.name,
            reason: result.reason,
            retry_after_seconds: result.retry_after_seconds,
            metadata: result.metadata,
            requestId: correlationId
          });

          return {
            allowed: false,
            blocked_by: {
              policy: policy.name,
              reason: result.reason,
              retry_after_seconds: result.retry_after_seconds
            }
          };
        }
      }

      // All policies passed
      logger.info('IG1: Ingestion allowed', {
        userId,
        accountId,
        platform,
        flow,
        requestId: correlationId
      });

      return {
        allowed: true
      };

    } catch (error) {
      logger.error('IG1: Unexpected error during evaluation', {
        error: error.message,
        stack: error.stack,
        requestId: correlationId
      });

      // Fail-safe: block on unexpected errors
      return {
        allowed: false,
        blocked_by: {
          policy: 'IngestionEligibilityGate',
          reason: 'evaluation_error'
        }
      };
    }
  }

  /**
   * Emits ingestion_blocked event for observability
   *
   * @private
   * @param {Object} eventData - Event data
   */
  async _emitBlockedEvent(eventData) {
    try {
      // Get additional context for analytics
      const { createClient } = require('@supabase/supabase-js');
      const config = require('../../config');
      const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);

      // Get user plan
      const { data: profile } = await supabase
        .from('profiles')
        .select('current_plan')
        .eq('user_id', eventData.userId)
        .single();

      // Get feature flag state
      const featureFlagService = require('../featureFlagService');
      const ingestionEnabled = await featureFlagService.isEnabled('ingestion_enabled', {
        scope: 'account',
        accountId: eventData.accountId
      });

      // Construct full event
      const event = {
        event: 'ingestion_blocked',
        timestamp: Date.now(),
        user_id: eventData.userId,
        account_id: eventData.accountId,
        platform: eventData.platform,
        flow: eventData.flow,
        policy: eventData.policy,
        reason: eventData.reason,
        retryable: !!eventData.retry_after_seconds,
        user_plan: profile?.current_plan || 'unknown',
        is_trial: false, // TODO: Determine from subscription
        feature_flag_state: {
          ingestion_enabled: ingestionEnabled
        },
        metadata: eventData.metadata || {},
        request_id: eventData.requestId
      };

      // Emit event (integrate with existing analytics service)
      const analyticsService = require('../analyticsService');
      await analyticsService.track(event);

      logger.info('IG1: ingestion_blocked event emitted', {
        requestId: eventData.requestId
      });

    } catch (error) {
      // Don't throw - event emission failure shouldn't block the gate
      logger.error('IG1: Failed to emit ingestion_blocked event', {
        error: error.message,
        requestId: eventData.requestId
      });
    }
  }
}

// Export singleton instance
module.exports = new IngestionEligibilityGate();
