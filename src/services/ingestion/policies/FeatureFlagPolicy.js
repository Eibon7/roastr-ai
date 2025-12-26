/**
 * @fileoverview Feature Flag Policy - Verifies ingestion feature flag is enabled
 * @module services/ingestion/policies/FeatureFlagPolicy
 * @since ROA-388
 */

const featureFlagService = require('../../featureFlagService');
const logger = require('../../../utils/logger');

/**
 * @typedef {import('../types').PolicyResult} PolicyResult
 * @typedef {import('../types').EligibilityContext} EligibilityContext
 */

class FeatureFlagPolicy {
  constructor() {
    this.name = 'FeatureFlagPolicy';
  }

  /**
   * Evaluates if ingestion feature flag is enabled
   *
   * @param {EligibilityContext} context - Evaluation context
   * @returns {Promise<PolicyResult>}
   */
  async evaluate(context) {
    try {
      const { userId, accountId } = context;

      // Check global ingestion flag (admin level)
      const globalFlag = await featureFlagService.isEnabled('ingestion_enabled', {
        scope: 'admin'
      });

      if (!globalFlag) {
        logger.info('FeatureFlagPolicy: Global ingestion disabled', {
          requestId: context.requestId
        });
        return {
          allowed: false,
          reason: 'feature_disabled',
          metadata: {
            scope: 'global',
            flag: 'ingestion_enabled',
            value: false
          }
        };
      }

      // Check account-level ingestion flag
      const accountFlag = await featureFlagService.isEnabled('ingestion_enabled', {
        scope: 'account',
        accountId
      });

      if (!accountFlag) {
        logger.info('FeatureFlagPolicy: Account ingestion disabled', {
          accountId,
          requestId: context.requestId
        });
        return {
          allowed: false,
          reason: 'feature_disabled',
          metadata: {
            scope: 'account',
            flag: 'ingestion_enabled',
            value: false
          }
        };
      }

      return {
        allowed: true,
        metadata: {
          ingestion_enabled: true
        }
      };

    } catch (err) {
      logger.error('FeatureFlagPolicy: Unexpected error', {
        error: err.message,
        requestId: context.requestId
      });
      // Fail-safe: block on unexpected errors
      return {
        allowed: false,
        reason: 'feature_flag_error',
        metadata: { error: err.message }
      };
    }
  }
}

module.exports = FeatureFlagPolicy;
