/**
 * Centralized plan configuration for frontend
 * Issue #841: Single source of truth for plan display data
 * Syncs with backend planService.js structure
 */

/**
 * Plan configuration for UI display
 * Includes display names, prices, and feature highlights
 */
export const PLAN_CONFIGS = {
  starter_trial: {
    id: 'starter_trial',
    name: 'Starter Trial',
    displayName: 'Starter Trial',
    price: '€0',
    priceValue: 0,
    features: ['5 roasts/month', '1 account/platform', 'Shield']
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    displayName: 'Starter',
    price: '€5',
    priceValue: 500, // cents
    features: ['5 roasts/month', '1 account/platform', 'Shield']
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    displayName: 'Pro',
    price: '€15',
    priceValue: 1500, // cents
    features: ['1000 roasts/month', '2 accounts/platform', 'Custom tones']
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    displayName: 'Plus',
    price: '€50',
    priceValue: 5000, // cents
    features: ['5000 roasts/month', '2 accounts/platform', 'All features']
  }
};

/**
 * Get plan config by plan ID
 * @param {string} planId - Plan ID
 * @returns {object} Plan configuration object
 */
export function getPlanConfig(planId) {
  return PLAN_CONFIGS[planId] || PLAN_CONFIGS.starter_trial;
}

/**
 * Get all plan configs as array
 * @returns {array} Array of plan configuration objects
 */
export function getAllPlanConfigs() {
  return Object.values(PLAN_CONFIGS);
}

