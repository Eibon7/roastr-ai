/**
 * @fileoverview Credit Policy - Verifies user has analysis credits remaining
 * @module services/ingestion/policies/CreditPolicy
 * @since ROA-388
 */

const costControl = require('../../costControl');
const logger = require('../../../utils/logger');

/**
 * @typedef {import('../types').PolicyResult} PolicyResult
 * @typedef {import('../types').EligibilityContext} EligibilityContext
 */

class CreditPolicy {
  constructor() {
    this.name = 'CreditPolicy';
  }

  /**
   * Evaluates if user has analysis credits remaining
   *
   * @param {EligibilityContext} context - Evaluation context
   * @returns {Promise<PolicyResult>}
   */
  async evaluate(context) {
    try {
      const { userId } = context;

      // Get current usage for user
      const usage = await costControl.getUsage(userId);

      if (!usage) {
        logger.error('CreditPolicy: Unable to fetch usage', {
          userId,
          requestId: context.requestId
        });
        // Fail-safe: block if we can't verify credits
        return {
          allowed: false,
          reason: 'credit_verification_error',
          metadata: { error: 'Unable to fetch usage' }
        };
      }

      const remaining = usage.analysis_remaining || 0;

      if (remaining <= 0) {
        logger.info('CreditPolicy: Analysis credits exhausted', {
          userId,
          remaining,
          requestId: context.requestId
        });
        return {
          allowed: false,
          reason: 'credit_exhausted',
          metadata: {
            remaining: 0,
            limit: usage.analysis_limit,
            used: usage.analysis_used
          }
        };
      }

      return {
        allowed: true,
        metadata: {
          remaining,
          limit: usage.analysis_limit
        }
      };

    } catch (err) {
      logger.error('CreditPolicy: Unexpected error', {
        error: err.message,
        requestId: context.requestId
      });
      // Fail-safe: block on unexpected errors
      return {
        allowed: false,
        reason: 'credit_policy_error',
        metadata: { error: err.message }
      };
    }
  }
}

module.exports = CreditPolicy;
