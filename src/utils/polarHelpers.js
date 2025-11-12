/**
 * Polar Helper Utilities
 * Maps Polar price IDs to internal plan names and provides validation
 *
 * Related: Issue #728 - Backend webhook business logic
 */

const { logger } = require('./logger');

// Product ID to plan mapping
// NOTE: Must match Polar dashboard product IDs configured in .env
// Frontend uses: starter/pro/plus
// Database uses: free/pro/creator_plus (CodeRabbit Review #3493981712)
// This mapping bridges the gap
const PRODUCT_ID_TO_PLAN = {
  [process.env.POLAR_STARTER_PRODUCT_ID]: 'starter_trial', // Maps starter → trial (matches DB schema)
  [process.env.POLAR_PRO_PRODUCT_ID]: 'pro',            // Direct mapping
  [process.env.POLAR_PLUS_PRODUCT_ID]: 'creator_plus',  // Maps plus → creator_plus
};

// Reverse mapping: plan to product ID
const PLAN_TO_PRODUCT_ID = Object.fromEntries(
  Object.entries(PRODUCT_ID_TO_PLAN).map(([k, v]) => [v, k])
);

/**
 * Get plan name from Polar product ID
 * @param {string} productId - Polar product ID
 * @returns {string} - Plan name (free/pro/creator_plus)
 * @throws {Error} - If product ID unknown
 */
function getPlanFromPriceId(productId) {
  const plan = PRODUCT_ID_TO_PLAN[productId];
  if (!plan) {
    logger.error('[Polar Helpers] Unknown product_id', { productId });
    throw new Error(`Unknown product_id: ${productId}. Please check POLAR_*_PRODUCT_ID environment variables.`);
  }
  return plan;
}

/**
 * Get Polar product ID from plan name
 * @param {string} plan - Plan name (free/pro/creator_plus)
 * @returns {string} - Polar product ID
 * @throws {Error} - If plan unknown
 */
function getPriceIdFromPlan(plan) {
  const productId = PLAN_TO_PRODUCT_ID[plan];
  if (!productId) {
    logger.error('[Polar Helpers] Unknown plan', { plan });
    throw new Error(`Unknown plan: ${plan}`);
  }
  return productId;
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
 * Get all configured product IDs
 * Useful for validation and debugging
 * @returns {string[]} - Array of configured product IDs
 */
function getConfiguredPriceIds() {
  return Object.keys(PRODUCT_ID_TO_PLAN).filter(Boolean);
}

module.exports = {
  getPlanFromPriceId,
  getPriceIdFromPlan,
  isValidPlan,
  getConfiguredPriceIds,
};
