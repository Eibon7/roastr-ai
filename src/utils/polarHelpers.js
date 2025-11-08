/**
 * Polar Helper Utilities
 * Maps Polar price IDs to internal plan names and provides validation
 *
 * Related: Issue #728 - Backend webhook business logic
 */

const { logger } = require('./logger');

// Price ID to plan mapping
// NOTE: Must match Polar dashboard price IDs configured in .env
// Frontend uses: starter/pro/plus
// Database uses: free/pro/creator_plus (CodeRabbit Review #3493981712)
// This mapping bridges the gap
const PRICE_ID_TO_PLAN = {
  [process.env.POLAR_STARTER_PRICE_ID]: 'starter_trial', // Maps starter → trial (matches DB schema)
  [process.env.POLAR_PRO_PRICE_ID]: 'pro',            // Direct mapping
  [process.env.POLAR_PLUS_PRICE_ID]: 'creator_plus',  // Maps plus → creator_plus
};

// Reverse mapping: plan to price ID
const PLAN_TO_PRICE_ID = Object.fromEntries(
  Object.entries(PRICE_ID_TO_PLAN).map(([k, v]) => [v, k])
);

/**
 * Get plan name from Polar price ID
 * @param {string} priceId - Polar price ID
 * @returns {string} - Plan name (free/pro/creator_plus)
 * @throws {Error} - If price ID unknown
 */
function getPlanFromPriceId(priceId) {
  const plan = PRICE_ID_TO_PLAN[priceId];
  if (!plan) {
    logger.error('[Polar Helpers] Unknown price_id', { priceId });
    throw new Error(`Unknown price_id: ${priceId}. Please check POLAR_*_PRICE_ID environment variables.`);
  }
  return plan;
}

/**
 * Get Polar price ID from plan name
 * @param {string} plan - Plan name (free/pro/creator_plus)
 * @returns {string} - Polar price ID
 * @throws {Error} - If plan unknown
 */
function getPriceIdFromPlan(plan) {
  const priceId = PLAN_TO_PRICE_ID[plan];
  if (!priceId) {
    logger.error('[Polar Helpers] Unknown plan', { plan });
    throw new Error(`Unknown plan: ${plan}`);
  }
  return priceId;
}

/**
 * Validate plan name against database constraints
 * @param {string} plan - Plan name to validate
 * @returns {boolean} - True if valid
 */
function isValidPlan(plan) {
  const validPlans = ['starter_trial', 'pro', 'creator_plus'];
  return validPlans.includes(plan);
}

/**
 * Get all configured price IDs
 * Useful for validation and debugging
 * @returns {string[]} - Array of configured price IDs
 */
function getConfiguredPriceIds() {
  return Object.keys(PRICE_ID_TO_PLAN).filter(Boolean);
}

module.exports = {
  getPlanFromPriceId,
  getPriceIdFromPlan,
  isValidPlan,
  getConfiguredPriceIds,
};
