// const { logger } = require('../utils/logger');
// const { flags } = require('../config/flags');

/**
 * Plan feature definitions
 * Enhanced with configurable duration (Issue #125)
 * 
 * Business Policy for Platform Integrations (Issue #110):
 * - Free plan: 1 integration per social network (for basic individual usage)
 * - Pro plan: 2 integrations per social network (for creators with multiple personal accounts)
 * - Creator+ plan: 2 integrations per social network (for professionals managing higher volume, not agencies)
 * - Custom plan: 2 integrations per social network (with other plan aspects configurable)
 * 
 * This policy ensures no plan can be abused by agencies to manage multiple client accounts
 */
const PLAN_FEATURES = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'eur',
    duration: {
      days: 30,
      type: 'rolling', // rolling, fixed
      renewalType: 'automatic' // automatic, manual
    },
    limits: {
      roastsPerMonth: 50,
      commentsPerMonth: 100,
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
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 500, // €5.00 in cents
    currency: 'eur',
    duration: {
      days: 30,
      type: 'rolling',
      renewalType: 'automatic'
    },
    limits: {
      roastsPerMonth: 100,
      commentsPerMonth: 1000,
      platformIntegrations: 2
    },
    features: {
      basicSupport: true,
      prioritySupport: false,
      advancedAnalytics: false,
      teamCollaboration: false,
      customTones: false,
      apiAccess: false,
      shield: true,
      styleProfile: false
    }
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 1500, // €15.00 in cents
    currency: 'eur',
    duration: {
      days: 30,
      type: 'rolling',
      renewalType: 'automatic',
      trialDays: 7 // Pro plan includes 7-day trial
    },
    limits: {
      roastsPerMonth: 1000,
      commentsPerMonth: 10000,
      platformIntegrations: 2 // 2 accounts per social network as per business policy
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
  plus: {
    id: 'plus',
    name: 'Plus',
    price: 5000, // €50.00 in cents
    currency: 'eur',
    duration: {
      days: 30,
      type: 'rolling',
      renewalType: 'automatic',
      trialDays: 14, // Plus plan includes 14-day trial
      gracePeriod: 7 // Extra grace period for premium users
    },
    limits: {
      roastsPerMonth: 5000,
      commentsPerMonth: 100000,
      platformIntegrations: 2 // 2 integrations per social network as per business policy
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
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    price: 0, // Negotiable
    currency: 'eur',
    duration: {
      days: 90, // Quarterly billing for custom plans
      type: 'fixed',
      renewalType: 'manual',
      customizable: true
    },
    limits: {
      roastsPerMonth: -1, // Unlimited
      commentsPerMonth: -1, // Unlimited
      platformIntegrations: 2 // 2 integrations per social network as per business policy
    },
    features: {
      basicSupport: true,
      prioritySupport: true,
      advancedAnalytics: true,
      teamCollaboration: true,
      customTones: true,
      apiAccess: true,
      shield: true,
      styleProfile: true,
      customIntegrations: true,
      dedicatedSupport: true
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
    [process.env.STRIPE_PRICE_LOOKUP_CREATOR || 'plus_monthly']: 'plus',
    'plus_monthly': 'plus',
    'creator_plus_monthly': 'plus'
  };
  
  return lookupMap[lookupKey] || null;
}

/**
 * Get plan duration configuration (Issue #125)
 * @param {string} planId - Plan ID
 * @returns {Object|null} Duration configuration or null
 */
function getPlanDuration(planId) {
  const plan = getPlanFeatures(planId);
  return plan?.duration || null;
}

/**
 * Calculate plan end date based on duration configuration
 * @param {string} planId - Plan ID
 * @param {Date} startDate - Plan start date (default: now)
 * @returns {Date} Plan end date
 */
function calculatePlanEndDate(planId, startDate = new Date()) {
  const duration = getPlanDuration(planId);
  if (!duration) {
    // Default to 30 days if no duration configured
    return new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  
  const endDate = new Date(startDate.getTime() + duration.days * 24 * 60 * 60 * 1000);
  
  // Add grace period if configured
  if (duration.gracePeriod) {
    endDate.setTime(endDate.getTime() + duration.gracePeriod * 24 * 60 * 60 * 1000);
  }
  
  return endDate;
}

/**
 * Check if plan supports custom duration
 * @param {string} planId - Plan ID
 * @returns {boolean} Whether plan supports custom duration
 */
function supportsCustomDuration(planId) {
  const duration = getPlanDuration(planId);
  return duration?.customizable === true;
}

/**
 * Get plan trial duration
 * @param {string} planId - Plan ID
 * @returns {number|null} Trial duration in days or null if no trial
 */
function getPlanTrialDays(planId) {
  const duration = getPlanDuration(planId);
  return duration?.trialDays || null;
}

module.exports = {
  getPlanFeatures,
  getAllPlans,
  hasFeature,
  checkPlanLimits,
  getPlanByLookupKey,
  getPlanDuration,
  calculatePlanEndDate,
  supportsCustomDuration,
  getPlanTrialDays,
  PLAN_FEATURES
};