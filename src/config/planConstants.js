/**
 * Plan Constants - Single Source of Truth
 *
 * Centralized plan naming to prevent inconsistencies across the codebase.
 * Issue #1021 Follow-up: Unify plan naming (starter_trial → starter)
 *
 * @module config/planConstants
 */

/**
 * Official plan tier names
 * Use these constants throughout the codebase instead of hardcoded strings
 */
const PLANS = {
  FREE: 'free',
  STARTER: 'starter',
  PRO: 'pro',
  PLUS: 'plus'
};

/**
 * Legacy plan name mappings for backward compatibility
 * Maps old plan names to new canonical names
 *
 * Use during migration period or when handling legacy data
 */
const LEGACY_PLAN_MAPPING = {
  starter_trial: 'starter', // Old name → New name
  free: 'free', // No change
  pro: 'pro', // No change
  plus: 'plus' // No change
};

/**
 * Normalize a plan name to its canonical form
 * Handles legacy plan names and returns the official name
 *
 * @param {string} planName - Plan name to normalize (can be legacy or current)
 * @returns {string} Canonical plan name
 *
 * @example
 * normalizePlanName('starter_trial') // Returns: 'starter'
 * normalizePlanName('starter')       // Returns: 'starter'
 * normalizePlanName('pro')           // Returns: 'pro'
 */
function normalizePlanName(planName) {
  if (!planName) {
    return PLANS.FREE; // Default to free if no plan specified
  }

  const normalized = planName.toLowerCase().trim();

  // Check if it's a legacy name that needs mapping
  if (LEGACY_PLAN_MAPPING[normalized]) {
    return LEGACY_PLAN_MAPPING[normalized];
  }

  // Check if it's already a valid canonical name
  const validPlans = Object.values(PLANS);
  if (validPlans.includes(normalized)) {
    return normalized;
  }

  // If unrecognized, log warning and default to free
  console.warn(`[planConstants] Unrecognized plan name: "${planName}". Defaulting to "free".`);
  return PLANS.FREE;
}

/**
 * Check if a plan name is valid (canonical or legacy)
 *
 * @param {string} planName - Plan name to validate
 * @returns {boolean} True if valid plan name
 *
 * @example
 * isValidPlan('starter')       // true
 * isValidPlan('starter_trial') // true (legacy)
 * isValidPlan('invalid')       // false
 */
function isValidPlan(planName) {
  if (!planName) return false;

  const normalized = planName.toLowerCase().trim();
  const validPlans = Object.values(PLANS);
  const legacyPlans = Object.keys(LEGACY_PLAN_MAPPING);

  return validPlans.includes(normalized) || legacyPlans.includes(normalized);
}

/**
 * Get all valid plan names (canonical only, not legacy)
 *
 * @returns {string[]} Array of valid plan names
 */
function getAllPlans() {
  return Object.values(PLANS);
}

/**
 * Check if a plan name is a legacy name that needs migration
 *
 * @param {string} planName - Plan name to check
 * @returns {boolean} True if legacy plan name
 */
function isLegacyPlan(planName) {
  if (!planName) return false;

  const normalized = planName.toLowerCase().trim();
  return normalized in LEGACY_PLAN_MAPPING && normalized !== LEGACY_PLAN_MAPPING[normalized];
}

/**
 * Plan tier hierarchy (for upgrade/downgrade logic)
 * Higher number = higher tier
 */
const PLAN_HIERARCHY = {
  [PLANS.FREE]: 0,
  [PLANS.STARTER]: 1,
  [PLANS.PRO]: 2,
  [PLANS.PLUS]: 3
};

/**
 * Compare two plan tiers
 *
 * @param {string} planA - First plan name
 * @param {string} planB - Second plan name
 * @returns {number} Negative if planA < planB, 0 if equal, positive if planA > planB
 *
 * @example
 * comparePlans('starter', 'pro')  // Returns: -1 (starter < pro)
 * comparePlans('pro', 'starter')  // Returns: 1 (pro > starter)
 * comparePlans('pro', 'pro')      // Returns: 0 (equal)
 */
function comparePlans(planA, planB) {
  const normalizedA = normalizePlanName(planA);
  const normalizedB = normalizePlanName(planB);

  const tierA = PLAN_HIERARCHY[normalizedA] ?? 0;
  const tierB = PLAN_HIERARCHY[normalizedB] ?? 0;

  return tierA - tierB;
}

/**
 * Check if planA is higher tier than planB
 *
 * @param {string} planA - Plan to check
 * @param {string} planB - Plan to compare against
 * @returns {boolean} True if planA > planB
 */
function isHigherTier(planA, planB) {
  return comparePlans(planA, planB) > 0;
}

/**
 * Check if planA is lower tier than planB
 *
 * @param {string} planA - Plan to check
 * @param {string} planB - Plan to compare against
 * @returns {boolean} True if planA < planB
 */
function isLowerTier(planA, planB) {
  return comparePlans(planA, planB) < 0;
}

module.exports = {
  // Constants
  PLANS,
  LEGACY_PLAN_MAPPING,
  PLAN_HIERARCHY,

  // Functions
  normalizePlanName,
  isValidPlan,
  getAllPlans,
  isLegacyPlan,
  comparePlans,
  isHigherTier,
  isLowerTier
};
