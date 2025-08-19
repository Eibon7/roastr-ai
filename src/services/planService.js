// const { logger } = require('../utils/logger');
// const { flags } = require('../config/flags');

/**
 * Plan feature definitions
 */
const PLAN_FEATURES = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'eur',
    limits: {
      roastsPerMonth: 100,
      commentsPerMonth: 500,
      platformIntegrations: 1
    },
    features: {
      basicSupport: true,
      prioritySupport: false,
      advancedAnalytics: false,
      teamCollaboration: false,
      customTones: false,
      apiAccess: false,
      shield: false,
      styleProfile: false
    }
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 2000, // €20.00 in cents
    currency: 'eur',
    limits: {
      roastsPerMonth: 1000,
      commentsPerMonth: 5000,
      platformIntegrations: 5
    },
    features: {
      basicSupport: true,
      prioritySupport: true,
      advancedAnalytics: true,
      teamCollaboration: false,
      customTones: false,
      apiAccess: false,
      shield: true,
      styleProfile: false
    }
  },
  creator_plus: {
    id: 'creator_plus',
    name: 'Creator+',
    price: 5000, // €50.00 in cents
    currency: 'eur',
    limits: {
      roastsPerMonth: -1, // Unlimited
      commentsPerMonth: -1, // Unlimited
      platformIntegrations: 9
    },
    features: {
      basicSupport: true,
      prioritySupport: true,
      advancedAnalytics: true,
      teamCollaboration: true,
      customTones: true,
      apiAccess: true,
      shield: true,
      styleProfile: true
    }
  }
};

/**
 * Get plan features by plan ID
 * @param {string} planId - Plan ID (free, pro, creator_plus)
 * @returns {Object|null} Plan features or null if not found
 */
function getPlanFeatures(planId) {
  return PLAN_FEATURES[planId] || null;
}

/**
 * Get all available plans
 * @returns {Object} All plan features
 */
function getAllPlans() {
  return PLAN_FEATURES;
}

/**
 * Check if a feature is available in a plan
 * @param {string} planId - Plan ID
 * @param {string} featureName - Feature name
 * @returns {boolean} Whether the feature is available
 */
function hasFeature(planId, featureName) {
  const plan = getPlanFeatures(planId);
  if (!plan) return false;
  
  return plan.features[featureName] === true;
}

/**
 * Check if usage is within plan limits
 * @param {string} planId - Plan ID
 * @param {Object} usage - Current usage object
 * @returns {Object} { withinLimits: boolean, exceeded: Object }
 */
function checkPlanLimits(planId, usage = {}) {
  const plan = getPlanFeatures(planId);
  if (!plan) {
    return { withinLimits: false, exceeded: { error: 'Invalid plan' } };
  }

  const exceeded = {};
  let withinLimits = true;

  // Check roasts limit
  if (plan.limits.roastsPerMonth !== -1 && usage.roastsThisMonth > plan.limits.roastsPerMonth) {
    exceeded.roasts = {
      current: usage.roastsThisMonth,
      limit: plan.limits.roastsPerMonth
    };
    withinLimits = false;
  }

  // Check comments limit
  if (plan.limits.commentsPerMonth !== -1 && usage.commentsThisMonth > plan.limits.commentsPerMonth) {
    exceeded.comments = {
      current: usage.commentsThisMonth,
      limit: plan.limits.commentsPerMonth
    };
    withinLimits = false;
  }

  // Check platform integrations
  if (usage.activeIntegrations > plan.limits.platformIntegrations) {
    exceeded.integrations = {
      current: usage.activeIntegrations,
      limit: plan.limits.platformIntegrations
    };
    withinLimits = false;
  }

  return { withinLimits, exceeded };
}

/**
 * Get plan by Stripe lookup key
 * @param {string} lookupKey - Stripe price lookup key
 * @returns {string|null} Plan ID or null
 */
function getPlanByLookupKey(lookupKey) {
  const lookupMap = {
    [process.env.STRIPE_PRICE_LOOKUP_PRO || 'pro_monthly']: 'pro',
    [process.env.STRIPE_PRICE_LOOKUP_CREATOR || 'creator_plus_monthly']: 'creator_plus'
  };
  
  return lookupMap[lookupKey] || null;
}

module.exports = {
  getPlanFeatures,
  getAllPlans,
  hasFeature,
  checkPlanLimits,
  getPlanByLookupKey,
  PLAN_FEATURES
};