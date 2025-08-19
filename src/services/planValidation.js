const { logger } = require('../utils/logger');
const { getPlanFeatures } = require('./planService');

/**
 * Validates if a plan change is allowed based on current usage and restrictions
 * @param {string} currentPlanId - Current plan ID (free, pro, creator_plus)
 * @param {string} newPlanId - New plan ID
 * @param {Object} currentUsage - User's current usage metrics
 * @returns {Object} { allowed: boolean, reason?: string, warnings?: string[] }
 */
async function isChangeAllowed(currentPlanId, newPlanId, currentUsage = {}) {
  try {
    const currentPlan = await getPlanFeatures(currentPlanId);
    const newPlan = await getPlanFeatures(newPlanId);

    if (!currentPlan || !newPlan) {
      return { allowed: false, reason: 'Invalid plan specified' };
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
      reason = `Current monthly roasts (${currentUsage.roastsThisMonth}) exceeds new plan limit (${newPlan.limits.roastsPerMonth})`;
    }

    // Check comments limit
    if (currentUsage.commentsThisMonth > newPlan.limits.commentsPerMonth) {
      allowed = false;
      reason = `Current monthly comments (${currentUsage.commentsThisMonth}) exceeds new plan limit (${newPlan.limits.commentsPerMonth})`;
    }

    // Check active integrations
    const activeIntegrations = currentUsage.activeIntegrations || 0;
    const maxIntegrations = getMaxIntegrations(newPlanId);
    if (activeIntegrations > maxIntegrations) {
      allowed = false;
      reason = `Active integrations (${activeIntegrations}) exceeds new plan limit (${maxIntegrations})`;
    }

    // Add warnings for features that will be lost
    if (currentPlan.features.prioritySupport && !newPlan.features.prioritySupport) {
      warnings.push('You will lose access to priority support');
    }

    if (currentPlan.features.advancedAnalytics && !newPlan.features.advancedAnalytics) {
      warnings.push('You will lose access to advanced analytics');
    }

    if (currentPlan.features.teamCollaboration && !newPlan.features.teamCollaboration) {
      warnings.push('You will lose access to team collaboration features');
    }

    if (currentPlan.features.styleProfile && !newPlan.features.styleProfile) {
      warnings.push('You will lose access to custom style profiles');
    }

    if (currentPlan.features.shield && !newPlan.features.shield) {
      warnings.push('You will lose access to Shield automated moderation');
    }

    return {
      allowed,
      reason,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    logger.error('Error validating plan change:', error);
    return { allowed: false, reason: 'Error validating plan change' };
  }
}

/**
 * Gets the tier number for a plan (higher = better)
 * @param {string} planId - Plan ID
 * @returns {number} Tier number
 */
function getPlanTier(planId) {
  const tiers = {
    free: 0,
    pro: 1,
    creator_plus: 2
  };
  return tiers[planId] || 0;
}

/**
 * Gets the maximum number of integrations for a plan
 * @param {string} planId - Plan ID
 * @returns {number} Maximum integrations allowed
 */
function getMaxIntegrations(planId) {
  const limits = {
    free: 1,
    pro: 3,
    creator_plus: 9
  };
  return limits[planId] || 1;
}

/**
 * Calculates prorated amount for plan change
 * @param {Object} currentSubscription - Current subscription details
 * @param {Object} newPlan - New plan details
 * @returns {Object} { amount: number, description: string }
 */
function calculateProration(currentSubscription, newPlan) {
  if (!currentSubscription || !currentSubscription.current_period_end) {
    return { amount: 0, description: 'No proration needed' };
  }

  const now = Date.now() / 1000;
  const periodEnd = currentSubscription.current_period_end;
  const remainingDays = Math.max(0, Math.ceil((periodEnd - now) / 86400));
  
  if (remainingDays === 0) {
    return { amount: 0, description: 'No proration needed' };
  }

  // Calculate unused portion of current subscription
  const currentMonthlyPrice = currentSubscription.items?.data?.[0]?.price?.unit_amount || 0;
  const newMonthlyPrice = newPlan.price || 0;
  
  const unusedAmount = (currentMonthlyPrice / 30) * remainingDays;
  const newAmount = (newMonthlyPrice / 30) * remainingDays;
  const prorationAmount = newAmount - unusedAmount;

  return {
    amount: Math.round(prorationAmount) / 100, // Convert from cents
    description: `Prorated for ${remainingDays} days remaining in billing period`
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