/**
 * Plan mappings configuration
 * Temporary file to resolve import issues
 */

const PLAN_IDS = {
  free: 'plan_free',
  pro: 'plan_pro',
  plus: 'plan_plus',
  creator_plus: 'plan_creator_plus'
};

const VALID_PLANS = ['free', 'pro', 'plus', 'creator_plus'];

const isValidPlan = (plan) => {
  return VALID_PLANS.includes(plan);
};

const normalizePlanId = (plan) => {
  if (!plan) return 'free';
  const normalizedPlan = plan.toLowerCase().trim();
  return isValidPlan(normalizedPlan) ? normalizedPlan : 'free';
};

const getPlanFromStripeLookupKey = (lookupKey) => {
  const lookupMap = {
    'plan_pro': 'pro',
    'plan_creator_plus': 'creator_plus',
    'plan_plus': 'plus'
  };
  return lookupMap[lookupKey] || 'free';
};

module.exports = {
  PLAN_IDS,
  VALID_PLANS,
  isValidPlan,
  normalizePlanId,
  getPlanFromStripeLookupKey
};