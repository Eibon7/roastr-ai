/**
 * Centralized plan mapping configuration
 * Provides consistent plan ID handling across the application
 * 
 * Issue #1021 Follow-up: Migrated to use planConstants.js for single source of truth
 */

const { PLANS, LEGACY_PLAN_MAPPING, normalizePlanName: normalizePlan } = require('./planConstants');

// Plan ID constants (using centralized source)
const PLAN_IDS = {
  STARTER: PLANS.STARTER,  // Canonical name (was: starter_trial)
  PRO: PLANS.PRO,
  PLUS: PLANS.PLUS,
  // Legacy support
  STARTER_TRIAL: PLANS.STARTER,  // Maps to 'starter' via normalization
  CREATOR_PLUS: PLANS.PLUS, // Legacy alias for plus
  CUSTOM: 'custom'  // Custom plans still supported
};

// Valid plan arrays for different contexts
const VALID_PLANS = {
  ALL: ['starter', 'pro', 'plus', 'custom', 'starter_trial', 'creator_plus'], // Legacy names at end
  ADMIN_ASSIGNABLE: ['starter', 'pro', 'plus', 'creator_plus']
};

// TODO:Polar - Price lookup key to plan ID mapping (formerly Stripe)
const PLAN_MAPPINGS = {
  plan_starter: PLAN_IDS.STARTER,
  plan_pro: PLAN_IDS.PRO,
  plan_plus: PLAN_IDS.PLUS,
  plan_custom: PLAN_IDS.CUSTOM,
  
  // Legacy mappings (for backward compatibility)
  plan_starter_trial: PLAN_IDS.STARTER,  // Legacy → canonical
  plan_creator_plus: PLAN_IDS.PLUS,

  // Alternative formats
  starter: PLAN_IDS.STARTER,
  pro: PLAN_IDS.PRO,
  plus: PLAN_IDS.PLUS,
  custom: PLAN_IDS.CUSTOM,
  
  // Legacy direct mappings
  starter_trial: PLAN_IDS.STARTER,  // Legacy → canonical
  creator_plus: PLAN_IDS.PLUS
};

// Plan hierarchy for upgrades/downgrades
const PLAN_HIERARCHY = {
  [PLAN_IDS.STARTER]: 1,  // starter (previously starter_trial at 0)
  [PLAN_IDS.PRO]: 2,
  [PLAN_IDS.PLUS]: 3,
  [PLAN_IDS.CUSTOM]: 4
};

/**
 * Get plan ID from lookup key (TODO:Polar integration)
 * @param {string} lookupKey - Price lookup key
 * @returns {string} - Normalized plan ID
 */
function getPlanFromLookupKey(lookupKey) {
  if (!lookupKey || typeof lookupKey !== 'string') {
    return PLAN_IDS.STARTER;  // Default to starter
  }

  return PLAN_MAPPINGS[lookupKey.toLowerCase()] || PLAN_IDS.STARTER;
}

/**
 * Normalize plan ID to standard format
 * Uses planConstants.normalizePlanName for consistency
 * 
 * @param {string} planId - Input plan ID
 * @returns {string} - Normalized plan ID
 */
function normalizePlanId(planId) {
  // Delegate to centralized normalization logic
  return normalizePlan(planId);
}

/**
 * Check if plan is valid
 * @param {string} planId - Plan ID to validate
 * @param {string} type - Validation type ('all' or 'admin_assignable')
 * @returns {boolean} - True if valid
 */
function isValidPlan(planId, type = 'all') {
  if (type === 'admin_assignable') {
    return VALID_PLANS.ADMIN_ASSIGNABLE.includes(planId);
  }
  return VALID_PLANS.ALL.includes(planId);
}

/**
 * Get plan hierarchy level
 * @param {string} planId - Plan ID
 * @returns {number} - Hierarchy level (higher = better plan)
 */
function getPlanLevel(planId) {
  const normalized = normalizePlanId(planId);
  return PLAN_HIERARCHY[normalized] ?? 0;
}

/**
 * Compare two plans
 * @param {string} planA - First plan ID
 * @param {string} planB - Second plan ID
 * @returns {number} - -1 if A < B, 0 if equal, 1 if A > B
 */
function comparePlans(planA, planB) {
  const levelA = getPlanLevel(planA);
  const levelB = getPlanLevel(planB);

  if (levelA < levelB) return -1;
  if (levelA > levelB) return 1;
  return 0;
}

/**
 * Check if plan change is an upgrade
 * @param {string} currentPlan - Current plan ID
 * @param {string} newPlan - New plan ID
 * @returns {boolean} - True if upgrade
 */
function isUpgrade(currentPlan, newPlan) {
  return comparePlans(currentPlan, newPlan) < 0;
}

/**
 * Check if plan change is a downgrade
 * @param {string} currentPlan - Current plan ID
 * @param {string} newPlan - New plan ID
 * @returns {boolean} - True if downgrade
 */
function isDowngrade(currentPlan, newPlan) {
  return comparePlans(currentPlan, newPlan) > 0;
}

module.exports = {
  PLAN_IDS,
  VALID_PLANS,
  PLAN_MAPPINGS, // Renamed from STRIPE_PLAN_MAPPINGS
  PLAN_HIERARCHY,
  getPlanFromLookupKey, // Renamed from getPlanFromStripeLookupKey
  normalizePlanId,
  isValidPlan,
  getPlanLevel,
  comparePlans,
  isUpgrade,
  isDowngrade
};
