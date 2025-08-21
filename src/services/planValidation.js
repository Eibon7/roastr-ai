const { logger } = require('../utils/logger');
const { getPlanFeatures } = require('./planService');
const { t } = require('../utils/i18n');

/**
 * Validates if a plan change is allowed based on current usage and restrictions
 * @param {string} currentPlanId - Current plan ID (free, pro, creator_plus)
 * @param {string} newPlanId - New plan ID
 * @param {Object} currentUsage - User's current usage metrics
 * @param {string} language - Language code for error messages (defaults to 'en')
 * @returns {Object} { allowed: boolean, reason?: string, warnings?: string[] }
 */
async function isChangeAllowed(currentPlanId, newPlanId, currentUsage = {}, language = 'en') {
  try {
    const currentPlan = await getPlanFeatures(currentPlanId);
    const newPlan = await getPlanFeatures(newPlanId);

    if (!currentPlan || !newPlan) {
      return { allowed: false, reason: t('plan.validation.invalid_plan', language) };
    }

    // Allow all upgrades
    if (getPlanTier(newPlanId) > getPlanTier(currentPlanId)) {
      return { allowed: true };
    }

    // For downgrades, check usage limits
    const warnings = [];
    let allowed = true;
    let reason = null;

    // Check roasts limit
    if (currentUsage.roastsThisMonth > newPlan.limits.roastsPerMonth) {
      allowed = false;
      reason = t('plan.validation.roasts_exceed_limit', language, { 
        current: currentUsage.roastsThisMonth, 
        limit: newPlan.limits.roastsPerMonth 
      });
    }

    // Check comments limit
    if (currentUsage.commentsThisMonth > newPlan.limits.commentsPerMonth) {
      allowed = false;
      reason = t('plan.validation.comments_exceed_limit', language, { 
        current: currentUsage.commentsThisMonth, 
        limit: newPlan.limits.commentsPerMonth 
      });
    }

    // Check active integrations
    const activeIntegrations = currentUsage.activeIntegrations || 0;
    const maxIntegrations = getMaxIntegrations(newPlanId);
    if (activeIntegrations > maxIntegrations) {
      allowed = false;
      reason = t('plan.validation.integrations_exceed_limit', language, { 
        current: activeIntegrations, 
        limit: maxIntegrations 
      });
    }

    // Add warnings for features that will be lost
    if (currentPlan.features.prioritySupport && !newPlan.features.prioritySupport) {
      warnings.push(t('plan.validation.lose_priority_support', language));
    }

    if (currentPlan.features.advancedAnalytics && !newPlan.features.advancedAnalytics) {
      warnings.push(t('plan.validation.lose_advanced_analytics', language));
    }

    if (currentPlan.features.teamCollaboration && !newPlan.features.teamCollaboration) {
      warnings.push(t('plan.validation.lose_team_collaboration', language));
    }

    if (currentPlan.features.styleProfile && !newPlan.features.styleProfile) {
      warnings.push(t('plan.validation.lose_style_profile', language));
    }

    if (currentPlan.features.shield && !newPlan.features.shield) {
      warnings.push(t('plan.validation.lose_shield', language));
    }

    return {
      allowed,
      reason,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    logger.error('Error validating plan change:', error);
    return { allowed: false, reason: t('plan.validation.error_validating', language) };
  }
}

/**
 * Gets the tier number for a plan (higher = better)
 * Enhanced with custom plan support (Issue #125)
 * @param {string} planId - Plan ID
 * @returns {number} Tier number
 */
function getPlanTier(planId) {
  const tiers = {
    free: 0,
    pro: 1,
    creator_plus: 2,
    custom: 3 // Custom plans are highest tier
  };
  return tiers[planId] || 0;
}

/**
 * Gets the maximum number of integrations for a plan
 * Enhanced with custom plan support (Issue #125)
 * @param {string} planId - Plan ID
 * @returns {number} Maximum integrations allowed (-1 means unlimited)
 */
function getMaxIntegrations(planId) {
  const limits = {
    free: 1,
    pro: 5, // Updated to match planService.js
    creator_plus: 9,
    custom: -1 // Unlimited for custom plans
  };
  return limits[planId] || 1;
}

/**
 * Calculates prorated amount for plan change
 * @param {Object} currentSubscription - Current subscription details
 * @param {Object} newPlan - New plan details
 * @param {string} language - Language code for description messages (defaults to 'en')
 * @returns {Object} { amount: number, description: string }
 */
function calculateProration(currentSubscription, newPlan, language = 'en') {
  if (!currentSubscription || !currentSubscription.current_period_end) {
    return { amount: 0, description: t('plan.validation.no_proration', language) };
  }

  const now = Date.now() / 1000;
  const periodEnd = currentSubscription.current_period_end;
  const remainingDays = Math.max(0, Math.ceil((periodEnd - now) / 86400));
  
  if (remainingDays === 0) {
    return { amount: 0, description: t('plan.validation.no_proration', language) };
  }

  // Calculate unused portion of current subscription
  const currentMonthlyPrice = currentSubscription.items?.data?.[0]?.price?.unit_amount || 0;
  const newMonthlyPrice = newPlan.price || 0;
  
  const unusedAmount = (currentMonthlyPrice / 30) * remainingDays;
  const newAmount = (newMonthlyPrice / 30) * remainingDays;
  const prorationAmount = newAmount - unusedAmount;

  return {
    amount: Math.round(prorationAmount) / 100, // Convert from cents
    description: t('plan.validation.proration_description', language, { days: remainingDays })
  };
}

/**
 * Validates if user can perform downgrade at end of period
 * @param {string} currentPlanId - Current plan ID
 * @param {string} newPlanId - New plan ID
 * @returns {boolean} Whether downgrade at period end is allowed
 */
function canDowngradeAtPeriodEnd(currentPlanId, newPlanId) {
  // Always allow downgrades at period end
  return getPlanTier(newPlanId) < getPlanTier(currentPlanId);
}

module.exports = {
  isChangeAllowed,
  getPlanTier,
  getMaxIntegrations,
  calculateProration,
  canDowngradeAtPeriodEnd
};