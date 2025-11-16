// const { logger } = require('../utils/logger');
// const { flags } = require('../config/flags');

/**
 * Plan feature definitions - SINGLE SOURCE OF TRUTH
 * Issue #841: Consolidated plan configuration
 * 
 * This is the ONLY place where plan limits and features should be defined.
 * All other services should read from here via planService or planLimitsService.
 * 
 * Business Policy for Platform Integrations (Issue #110, #841):
 * - Starter/Starter Trial: 1 account per platform (for basic individual usage)
 * - Pro/Plus: 2 accounts per platform (for creators with multiple personal accounts)
 * - Limits are PER PLATFORM, not total (e.g., Pro can have 2 X accounts + 2 Instagram accounts + 2 TikTok accounts)
 * - This policy ensures no plan can be abused by agencies to manage multiple client accounts
 * 
 * Custom Plan (Issue #841):
 * - NOT a standard plan - applied ad-hoc to brands/special accounts
 * - Pay-per-use billing (not subscription-based)
 * - Features: ONLY Custom Tones, Shield, and Style Profile
 * - Unlimited limits but billed per use
 * - Requires manual assignment (not in ADMIN_ASSIGNABLE)
 * 
 * Tokens System (Issue #841):
 * - Tokens are related to the credits system used for roasts and regenerations
 * - Regenerations consume credits when users manually review and regenerate roasts
 * - Token limits are defined but implementation details pending further study
 * - DO NOT remove tokens configuration - they are part of the credits/regeneration system
 */
const PLAN_FEATURES = {
  starter_trial: {
    id: 'starter_trial',
    name: 'Starter Trial',
    price: 0,
    currency: 'eur',
    duration: {
      days: 30,
      type: 'fixed', // Fixed trial period
      renewalType: 'manual', // Must upgrade manually
      trialDays: 30
    },
    // Usage limits
    limits: {
      roastsPerMonth: 5,
      monthlyResponsesLimit: 5,
      monthlyAnalysisLimit: 1000,
      commentsPerMonth: 1000,
      platformIntegrations: 1,
      maxPlatforms: 1,
      integrationsLimit: 1
    },
    // Feature flags
    features: {
      basicSupport: true,
      prioritySupport: false,
      advancedAnalytics: false,
      teamCollaboration: false,
      customTones: false,
      apiAccess: false,
      shield: true, // Shield enabled during trial
      styleProfile: false,
      shieldEnabled: true,
      customPrompts: false,
      analyticsEnabled: false,
      dedicatedSupport: false,
      embeddedJudge: false
    },
    // Additional limits
    tokens: {
      monthlyTokensLimit: 100000,
      dailyApiCallsLimit: 500
    },
    // AI model configuration
    aiModel: 'gpt-5.1',
    // Metadata
    isTrial: true
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
    // Usage limits
    limits: {
      roastsPerMonth: 5,
      monthlyResponsesLimit: 5,
      monthlyAnalysisLimit: 1000,
      commentsPerMonth: 1000,
      platformIntegrations: 1,
      maxPlatforms: 1,
      integrationsLimit: 1
    },
    // Feature flags
    features: {
      basicSupport: true,
      prioritySupport: false,
      advancedAnalytics: false,
      teamCollaboration: false,
      customTones: false,
      apiAccess: false,
      shield: true,
      styleProfile: false,
      shieldEnabled: true,
      customPrompts: false,
      analyticsEnabled: false,
      dedicatedSupport: false,
      embeddedJudge: false
    },
    // Additional limits
    tokens: {
      monthlyTokensLimit: 100000,
      dailyApiCallsLimit: 500
    },
    // AI model configuration
    aiModel: 'gpt-5.1'
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
    // Usage limits
    limits: {
      roastsPerMonth: 1000,
      monthlyResponsesLimit: 1000,
      monthlyAnalysisLimit: 10000,
      commentsPerMonth: 10000,
      platformIntegrations: 2, // 2 accounts per social network as per business policy
      maxPlatforms: 2,
      integrationsLimit: 2
    },
    // Feature flags
    features: {
      basicSupport: true,
      prioritySupport: false,
      advancedAnalytics: false,
      teamCollaboration: false,
      customTones: false,
      apiAccess: false,
      shield: true,
      styleProfile: false,
      shieldEnabled: true,
      customPrompts: false,
      analyticsEnabled: false,
      dedicatedSupport: false,
      embeddedJudge: false
    },
    // Additional limits
    tokens: {
      monthlyTokensLimit: 500000,
      dailyApiCallsLimit: 5000
    },
    // AI model configuration
    aiModel: 'gpt-5.1'
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
    // Usage limits
    limits: {
      roastsPerMonth: 5000,
      monthlyResponsesLimit: 5000,
      monthlyAnalysisLimit: 100000,
      commentsPerMonth: 100000,
      platformIntegrations: 2, // 2 integrations per social network as per business policy
      maxPlatforms: 2,
      integrationsLimit: 2
    },
    // Feature flags
    features: {
      basicSupport: true,
      prioritySupport: false,
      advancedAnalytics: false,
      teamCollaboration: true,
      customTones: true,
      apiAccess: false,
      shield: true,
      styleProfile: true,
      shieldEnabled: true,
      customPrompts: false,
      analyticsEnabled: false,
      dedicatedSupport: false,
      embeddedJudge: false
    },
    // Additional limits
    tokens: {
      monthlyTokensLimit: 2000000,
      dailyApiCallsLimit: 20000
    },
    // AI model configuration
    aiModel: 'gpt-5.1',
    rqcEmbedded: false
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    price: 0, // Pay-per-use pricing (not a standard plan)
    currency: 'eur',
    duration: {
      days: 30, // Monthly billing for custom plans
      type: 'rolling',
      renewalType: 'manual',
      customizable: true
    },
    // Usage limits (-1 = unlimited, but billed per use)
    // This plan is for brands/special accounts with pay-per-use billing
    // DISABLED: Not available for users to contract (Issue #841)
    limits: {
      roastsPerMonth: -1, // Unlimited (billed per use)
      monthlyResponsesLimit: -1, // Unlimited (billed per use)
      monthlyAnalysisLimit: -1, // Unlimited (billed per use)
      commentsPerMonth: -1, // Unlimited (billed per use)
      platformIntegrations: 2, // 2 integrations per social network (may vary in future)
      maxPlatforms: -1, // Unlimited
      integrationsLimit: -1 // Unlimited
    },
    // Feature flags - ONLY Custom Tones, Shield, and Style Profile
    // This is NOT a standard plan - applied ad-hoc to specific users/brands
    features: {
      basicSupport: false,
      prioritySupport: false,
      advancedAnalytics: false,
      teamCollaboration: false,
      customTones: true, // ✅ Only this
      apiAccess: false,
      shield: true, // ✅ Only this
      styleProfile: true, // ✅ Only this
      customIntegrations: false,
      dedicatedSupport: false,
      shieldEnabled: true,
      customPrompts: false,
      analyticsEnabled: false,
      embeddedJudge: false
    },
    // Additional limits (-1 = unlimited, but billed per use)
    tokens: {
      monthlyTokensLimit: -1, // Unlimited (billed per use)
      dailyApiCallsLimit: -1 // Unlimited (billed per use)
    },
    // AI model configuration
    aiModel: 'gpt-5.1',
    enterprise: true,
    // This plan is NOT standard - applied ad-hoc to brands/special accounts
    // Billing is pay-per-use, not subscription-based
    adHoc: true
  }
};

/**
 * Get complete plan limits in format compatible with planLimitsService
 * This function transforms PLAN_FEATURES to the format expected by other services
 * @param {string} planId - Plan ID
 * @returns {Object|null} Plan limits in standard format or null if not found
 */
function getPlanLimits(planId) {
  const plan = PLAN_FEATURES[planId];
  if (!plan) return null;

  return {
    maxRoasts: plan.limits.roastsPerMonth,
    monthlyResponsesLimit: plan.limits.monthlyResponsesLimit,
    monthlyAnalysisLimit: plan.limits.monthlyAnalysisLimit,
    maxPlatforms: plan.limits.maxPlatforms,
    integrationsLimit: plan.limits.integrationsLimit,
    shieldEnabled: plan.features.shieldEnabled,
    customPrompts: plan.features.customPrompts,
    prioritySupport: plan.features.prioritySupport,
    apiAccess: plan.features.apiAccess,
    analyticsEnabled: plan.features.analyticsEnabled,
    customTones: plan.features.customTones,
    dedicatedSupport: plan.features.dedicatedSupport,
    embeddedJudge: plan.features.embeddedJudge,
    monthlyTokensLimit: plan.tokens?.monthlyTokensLimit,
    dailyApiCallsLimit: plan.tokens?.dailyApiCallsLimit,
    ai_model: plan.aiModel
  };
}

/**
 * Get plan features by plan ID
 * @param {string} planId - Plan ID (starter_trial, starter, pro, plus)
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
  getPlanLimits, // New: Get limits in standard format
  PLAN_FEATURES // Export for direct access if needed
};