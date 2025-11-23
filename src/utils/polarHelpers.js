/**
 * Polar Helper Utilities
 * Maps Polar product IDs to internal plan names and provides validation
 *
 * Related: Issue #728 - Backend webhook business logic
 * Updated: Issue #808 - Changed from PRICE_ID (Stripe) to PRODUCT_ID (Polar)
 */

const { logger } = require('./logger');

// Product ID to plan mapping
// NOTE: Must match Polar dashboard product IDs configured in .env
// Frontend uses: starter/pro/plus
// Database uses: starter_trial/starter/pro/plus
const PRODUCT_ID_TO_PLAN = {
  [process.env.POLAR_STARTER_PRODUCT_ID]: 'starter_trial', // Maps starter → trial (matches DB schema)
  [process.env.POLAR_PRO_PRODUCT_ID]: 'pro', // Direct mapping
  [process.env.POLAR_PLUS_PRODUCT_ID]: 'plus' // Maps plus → plus
};

// Reverse mapping: plan to product ID
const PLAN_TO_PRODUCT_ID = Object.fromEntries(
  Object.entries(PRODUCT_ID_TO_PLAN).map(([k, v]) => [v, k])
);

/**
 * Get plan name from Polar product ID
 * @param {string} productId - Polar product ID
 * @returns {string} - Plan name (starter_trial/starter/pro/plus)
 * @throws {Error} - If product ID unknown
 */
function getPlanFromProductId(productId) {
  const plan = PRODUCT_ID_TO_PLAN[productId];
  if (!plan) {
    logger.error('[Polar Helpers] Unknown product_id', { productId });
    throw new Error(
      `Unknown product_id: ${productId}. Please check POLAR_*_PRODUCT_ID environment variables.`
    );
  }
  return plan;
}

/**
 * Get Polar product ID from plan name
 * @param {string} plan - Plan name (starter_trial/starter/pro/plus)
 * @returns {string} - Polar product ID
 * @throws {Error} - If plan unknown
 */
function getProductIdFromPlan(plan) {
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
  const validPlans = ['starter_trial', 'starter', 'pro', 'plus'];
  return validPlans.includes(plan);
}

/**
 * Get all configured product IDs
 * Useful for validation and debugging
 * @returns {string[]} - Array of configured product IDs
 */
function getConfiguredProductIds() {
  return Object.keys(PRODUCT_ID_TO_PLAN).filter(Boolean);
}

// Legacy aliases for backward compatibility during migration
// TODO: Remove after Issue #808 migration is complete
function getPlanFromPriceId(priceId) {
  logger.warn('[Polar Helpers] getPlanFromPriceId is deprecated, use getPlanFromProductId', {
    priceId
  });
  return getPlanFromProductId(priceId);
}

function getPriceIdFromPlan(plan) {
  logger.warn('[Polar Helpers] getPriceIdFromPlan is deprecated, use getProductIdFromPlan', {
    plan
  });
  return getProductIdFromPlan(plan);
}

function getConfiguredPriceIds() {
  logger.warn('[Polar Helpers] getConfiguredPriceIds is deprecated, use getConfiguredProductIds');
  return getConfiguredProductIds();
}

module.exports = {
  // New API (Polar uses product_id)
  getPlanFromProductId,
  getProductIdFromPlan,
  getConfiguredProductIds,
  // Legacy API (for backward compatibility)
  getPlanFromPriceId,
  getPriceIdFromPlan,
  getConfiguredPriceIds,
  // Common utilities
  isValidPlan
};
