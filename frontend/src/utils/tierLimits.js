/**
 * Tier Limits utility for plan-based restrictions
 * Issue #841: Updated plan structure - Starter Trial/Starter: 1 per platform, Pro/Plus: 2 per platform
 */

import { normalizePlanId } from './planHelpers';

// Tier-based connection limits (per platform)
const TIER_LIMITS = {
  starter_trial: {
    social_connections: 1, // Per platform
    roasts_per_month: 5,
    shield_enabled: true,
    priority_support: false,
    custom_styles: false
  },
  starter: {
    social_connections: 1, // Per platform
    roasts_per_month: 5,
    shield_enabled: true,
    priority_support: false,
    custom_styles: false
  },
  pro: {
    social_connections: 2, // Per platform
    roasts_per_month: 1000,
    shield_enabled: true,
    priority_support: false,
    custom_styles: true
  },
  plus: {
    social_connections: 2, // Per platform
    roasts_per_month: 5000,
    shield_enabled: true,
    priority_support: false,
    custom_styles: true
  },
  custom: {
    // Custom plan: ad-hoc for brands/special accounts with pay-per-use billing
    // Limits are effectively unlimited but billed per use
    // Note: Actual limits should be sourced from backend/enterprise configuration
    social_connections: 999, // Effectively unlimited (per platform)
    roasts_per_month: 999999, // Effectively unlimited (billed per use)
    shield_enabled: true,
    priority_support: true, // Custom plans may include premium support
    custom_styles: true
  }
};

/**
 * Get tier limits for a specific plan
 * @param {string} planTier - User's plan tier
 * @returns {object} - Tier limits object
 */
export const getTierLimits = (planTier) => {
  const normalizedPlan = normalizePlanId(planTier || 'starter_trial');
  return TIER_LIMITS[normalizedPlan] || TIER_LIMITS.starter_trial;
};

/**
 * Check if user can add more connections
 * @param {number} currentConnections - Current number of connections
 * @param {string} planTier - User's plan tier
 * @returns {object} - Validation result with allowed status and details
 */
export const validateConnectionLimit = (currentConnections, planTier) => {
  const limits = getTierLimits(planTier);
  const maxConnections = limits.social_connections;
  
  return {
    allowed: currentConnections < maxConnections,
    currentConnections,
    maxConnections,
    message: currentConnections >= maxConnections 
      ? `Plan ${planTier} permite máximo ${maxConnections} conexión${maxConnections > 1 ? 'es' : ''}. Actualiza tu plan para conectar más plataformas.`
      : 'Conexión permitida'
  };
};

/**
 * Get connection limit warning message
 * @param {number} currentConnections - Current number of connections
 * @param {string} planTier - User's plan tier
 * @returns {string|null} - Warning message or null if no warning needed
 */
export const getConnectionWarning = (currentConnections, planTier) => {
  const limits = getTierLimits(planTier);
  const maxConnections = limits.social_connections;
  
  if (currentConnections >= maxConnections) {
    return `Has alcanzado el límite de ${maxConnections} conexión${maxConnections > 1 ? 'es' : ''} para el plan ${planTier}. Considera actualizar tu plan.`;
  }
  
  if (currentConnections === maxConnections - 1) {
    return `Te queda 1 conexión disponible en tu plan ${planTier}.`;
  }
  
  return null;
};

/**
 * Check if a feature is available for the user's plan
 * @param {string} feature - Feature name
 * @param {string} planTier - User's plan tier
 * @returns {boolean} - Whether the feature is available
 */
export const isFeatureAvailable = (feature, planTier) => {
  const limits = getTierLimits(planTier);
  return limits[feature] || false;
};

/**
 * Get upgrade suggestion for the user's current plan
 * @param {string} currentPlan - Current plan tier
 * @returns {object} - Upgrade suggestion with target plan and benefits
 */
export const getUpgradeSuggestion = (currentPlan) => {
  const current = normalizePlanId(currentPlan || 'starter_trial');
  
  const suggestions = {
    starter_trial: {
      targetPlan: 'starter',
      benefits: ['5 roasts mensuales', '1 cuenta por plataforma', 'Soporte estándar'],
      price: '€5/mes'
    },
    starter: {
      targetPlan: 'pro',
      benefits: ['1000 roasts mensuales', '2 cuentas por plataforma', 'Custom tones'],
      price: '€15/mes'
    },
    pro: {
      targetPlan: 'plus',
      benefits: ['5000 roasts mensuales', '2 cuentas por plataforma', 'Todas las features'],
      price: '€50/mes'
    }
  };
  
  return suggestions[current] || null;
};

export default {
  getTierLimits,
  validateConnectionLimit,
  getConnectionWarning,
  isFeatureAvailable,
  getUpgradeSuggestion,
  TIER_LIMITS
};