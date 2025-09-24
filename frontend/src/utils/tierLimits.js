/**
 * Tier Limits utility for plan-based restrictions
 * Based on Issue #366 requirements: Free=1, Pro+=2 connections
 */

// Tier-based connection limits
const TIER_LIMITS = {
  free: {
    social_connections: 1,
    roasts_per_month: 100,
    shield_enabled: false,
    priority_support: false,
    custom_styles: false
  },
  starter: {
    social_connections: 2,
    roasts_per_month: 500,
    shield_enabled: false,
    priority_support: false,
    custom_styles: false
  },
  pro: {
    social_connections: 2,
    roasts_per_month: 2000,
    shield_enabled: true,
    priority_support: true,
    custom_styles: true
  },
  plus: {
    social_connections: 2,
    roasts_per_month: 5000,
    shield_enabled: true,
    priority_support: true,
    custom_styles: true
  },
  creator_plus: {
    social_connections: 999, // Effectively unlimited
    roasts_per_month: 10000,
    shield_enabled: true,
    priority_support: true,
    custom_styles: true
  }
};

/**
 * Get tier limits for a specific plan
 * @param {string} planTier - User's plan tier
 * @returns {object} - Tier limits object
 */
export const getTierLimits = (planTier) => {
  const normalizedPlan = planTier?.toLowerCase() || 'free';
  return TIER_LIMITS[normalizedPlan] || TIER_LIMITS.free;
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
  const current = currentPlan?.toLowerCase() || 'free';
  
  const suggestions = {
    free: {
      targetPlan: 'starter',
      benefits: ['2 conexiones de redes sociales', '500 roasts mensuales', 'Soporte por email'],
      price: '€5/mes'
    },
    starter: {
      targetPlan: 'pro',
      benefits: ['Shield automated moderation', 'Estilos personalizados', 'Soporte prioritario', '2000 roasts mensuales'],
      price: '€15/mes'
    },
    pro: {
      targetPlan: 'plus',
      benefits: ['5000 roasts mensuales', 'Funciones premium adicionales', 'Configuración avanzada'],
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