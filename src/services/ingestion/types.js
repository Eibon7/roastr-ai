/**
 * @fileoverview Type definitions for Ingestion Eligibility Gate (IG1) v2
 * @module services/ingestion/types
 * @since ROA-388
 */

/**
 * Policy evaluation result
 * All policies must return this contract
 *
 * @typedef {Object} PolicyResult
 * @property {boolean} allowed - Whether the policy allows ingestion
 * @property {string} [reason] - Snake_case slug explaining why it was blocked (if allowed is false)
 * @property {number} [retry_after_seconds] - Recommended time before retrying (if blocked and retryable)
 * @property {Record<string, unknown>} [metadata] - Additional debug/analytics data (never used for control flow)
 */

/**
 * Final result from Ingestion Eligibility Gate
 *
 * @typedef {Object} IngestionEligibilityResult
 * @property {boolean} allowed - Whether ingestion is allowed
 * @property {Object} [blocked_by] - Details about blocking policy (if allowed is false)
 * @property {string} blocked_by.policy - Name of the policy that blocked
 * @property {string} blocked_by.reason - Reason slug from the policy
 * @property {number} [blocked_by.retry_after_seconds] - Time before retry (if retryable)
 */

/**
 * Context passed to policies for evaluation
 *
 * @typedef {Object} EligibilityContext
 * @property {string} userId - User ID requesting ingestion
 * @property {string} accountId - Connected account ID
 * @property {string} platform - Platform ('x' | 'youtube')
 * @property {string} flow - Ingestion flow ('timeline' | 'mentions' | 'replies')
 * @property {string} requestId - Correlation ID for tracing
 */

module.exports = {
  // Types are exported via JSDoc, no runtime exports needed
};
