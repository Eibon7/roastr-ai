/**
 * Centralized plan mapping configuration
 * Provides consistent plan ID handling across the application
 */

// Plan ID constants
const PLAN_IDS = {
  FREE: 'free',
  BASIC: 'basic', // Legacy alias for free
  STARTER: 'starter',
  PRO: 'pro',
  PLUS: 'plus',
  CREATOR_PLUS: 'creator_plus', // Legacy alias for plus
  CUSTOM: 'custom'
};

// Valid plan arrays for different contexts
const VALID_PLANS = {
  ALL: ['free', 'basic', 'starter', 'pro', 'plus', 'creator_plus', 'custom'],
  ADMIN_ASSIGNABLE: ['free', 'basic', 'pro', 'plus', 'creator_plus']
};

// Stripe price lookup key to plan ID mapping
const STRIPE_PLAN_MAPPINGS = {
  'plan_free': PLAN_IDS.FREE,
  'plan_basic': PLAN_IDS.FREE, // Legacy mapping
  'plan_starter': PLAN_IDS.STARTER,
  'plan_pro': PLAN_IDS.PRO,
  'plan_plus': PLAN_IDS.PLUS,
  'plan_creator_plus': PLAN_IDS.PLUS, // Legacy mapping
  'plan_custom': PLAN_IDS.CUSTOM,
  
  // Alternative formats
  'starter': PLAN_IDS.STARTER,
  'pro': PLAN_IDS.PRO,
  'plus': PLAN_IDS.PLUS,
  'creator_plus': PLAN_IDS.PLUS,
  'custom': PLAN_IDS.CUSTOM
};

// Plan hierarchy for upgrades/downgrades
const PLAN_HIERARCHY = {
  [PLAN_IDS.FREE]: 0,
  [PLAN_IDS.STARTER]: 1,
  [PLAN_IDS.PRO]: 2,
  [PLAN_IDS.PLUS]: 3,
  [PLAN_IDS.CUSTOM]: 4
};

/**
 * Get plan ID from Stripe lookup key
 * @param {string} lookupKey - Stripe price lookup key
 * @returns {string} - Normalized plan ID
 */
function getPlanFromStripeLookupKey(lookupKey) {
  if (!lookupKey || typeof lookupKey !== 'string') {
    return PLAN_IDS.FREE;
  }
  
  return STRIPE_PLAN_MAPPINGS[lookupKey.toLowerCase()] || PLAN_IDS.FREE;
}

/**
 * Normalize plan ID to standard format
 * @param {string} planId - Input plan ID
 * @returns {string} - Normalized plan ID
 */
function normalizePlanId(planId) {
  if (!planId || typeof planId !== 'string') {
    return PLAN_IDS.FREE;
  }
  
  const normalized = planId.toLowerCase().trim();
  
  // Handle variations
  switch (normalized) {
    case 'free':
    case 'gratuito':
      return PLAN_IDS.FREE;
    case 'starter':
    case 'starter_plan':
      return PLAN_IDS.STARTER;
    case 'pro':
    case 'professional':
      return PLAN_IDS.PRO;
    case 'plus':
    case 'premium':
      return PLAN_IDS.PLUS;
    case 'creator_plus':
    case 'creator':
    case 'creatorplus':
      return PLAN_IDS.CREATOR_PLUS;
    case 'basic':
    case 'basico':
      return PLAN_IDS.BASIC;
    default:
      return PLAN_IDS.FREE;
  }
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
  STRIPE_PLAN_MAPPINGS,
  PLAN_HIERARCHY,
  getPlanFromStripeLookupKey,
  normalizePlanId,
  isValidPlan,
  getPlanLevel,
  comparePlans,
  isUpgrade,
  isDowngrade
};