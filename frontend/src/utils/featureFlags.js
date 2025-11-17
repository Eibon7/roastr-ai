/**
 * Feature flags utility for conditional UI rendering
 * Based on environment variables and user plan tier
 */

// Environment-based feature flags
const FEATURE_FLAGS = {
  shop_enabled: process.env.REACT_APP_SHOP_ENABLED === 'true',
  ENABLE_SHIELD_UI: process.env.REACT_APP_ENABLE_SHIELD_UI === 'true',
  debug_mode: process.env.NODE_ENV === 'development'
};

/**
 * Check if a feature flag is enabled
 * @param {string} flagName - Name of the feature flag
 * @returns {boolean} - Whether the feature is enabled
 */
export const isFeatureEnabled = (flagName) => {
  return FEATURE_FLAGS[flagName] || false;
};

/**
 * Get all feature flags
 * @returns {object} - Object containing all feature flags
 */
export const getAllFeatureFlags = () => {
  return { ...FEATURE_FLAGS };
};

/**
 * Check if Shield is enabled for user's plan
 * @param {string} planTier - User's plan tier (starter_trial, starter, pro, plus)
 * @returns {boolean} - Whether Shield is available for this plan
 */
export const isShieldEnabledForPlan = (planTier) => {
  const shieldEnabledPlans = ['pro', 'plus'];
  return shieldEnabledPlans.includes(planTier?.toLowerCase());
};

export default {
  isFeatureEnabled,
  getAllFeatureFlags,
  isShieldEnabledForPlan
};