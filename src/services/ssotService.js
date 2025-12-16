/**
 * SSOT Service
 * 
 * Provides structured access to SSOT-V2.md data for public endpoints
 * 
 * Issue: ROA-267 - Crear endpoints públicos de SSOT para frontend v2
 * 
 * This service exposes SSOT data in a structured format without exposing
 * sensitive information. All data must match SSOT-V2.md exactly.
 */

const { logger } = require('../utils/logger');

/**
 * Get valid plan IDs (v2)
 * Source: SSOT-V2.md section 1.1
 * 
 * @returns {string[]} Array of valid plan IDs
 */
function getValidPlanIds() {
  // SSOT-V2.md section 1.1: Only 'starter' | 'pro' | 'plus' are valid
  return ['starter', 'pro', 'plus'];
}

/**
 * Get trial configuration by plan
 * Source: SSOT-V2.md section 1.2
 * 
 * @returns {Object} Trial configuration by plan
 */
function getTrialConfiguration() {
  return {
    starter: {
      trial_enabled: true,
      trial_days: 30
    },
    pro: {
      trial_enabled: true,
      trial_days: 7
    },
    plus: {
      trial_enabled: false,
      trial_days: 0
    }
  };
}

/**
 * Get monthly functional limits by plan
 * Source: SSOT-V2.md section 1.3
 * 
 * @returns {Object} Limits by plan
 */
function getPlanLimits() {
  return {
    starter: {
      analysis_limit: 1_000,
      roast_limit: 5,
      accounts_per_platform: 1,
      sponsors_allowed: false,
      tone_personal_allowed: false
    },
    pro: {
      analysis_limit: 10_000,
      roast_limit: 1_000,
      accounts_per_platform: 2,
      sponsors_allowed: false,
      tone_personal_allowed: true
    },
    plus: {
      analysis_limit: 100_000,
      roast_limit: 5_000,
      accounts_per_platform: 2,
      sponsors_allowed: true,
      tone_personal_allowed: true
    }
  };
}

/**
 * Get plan capabilities (high-level)
 * Source: SSOT-V2.md section 1.4
 * 
 * @returns {Object} Capabilities by plan
 */
function getPlanCapabilities() {
  return {
    starter: {
      shield: 'básico', // Same engine, same thresholds; "básico" is marketing
      tones: ['flanders', 'balanceado', 'canalla'], // Standard tones
      roastr_persona: true,
      tone_personal: false,
      sponsors: false
    },
    pro: {
      shield: 'completo', // Same engine, may have more UI controls
      tones: ['flanders', 'balanceado', 'canalla', 'personal'], // Standard + personal (beta)
      multi_account: true, // Up to 2 accounts per platform
      roastr_persona: true,
      tone_personal: true, // Beta
      sponsors: false
    },
    plus: {
      shield: 'completo',
      tones: ['flanders', 'balanceado', 'canalla', 'personal'],
      multi_account: true,
      roastr_persona: true,
      tone_personal: true,
      sponsors: true,
      priority_queue: false // Optional future feature
    }
  };
}

/**
 * Get valid subscription states
 * Source: SSOT-V2.md section 2.2
 * 
 * @returns {string[]} Array of valid subscription states
 */
function getValidSubscriptionStates() {
  return [
    'trialing',
    'expired_trial_pending_payment',
    'payment_retry',
    'active',
    'canceled_pending',
    'paused'
  ];
}

/**
 * Get valid feature flag keys
 * Source: SSOT-V2.md section 3.2
 * 
 * @returns {string[]} Array of valid feature flag keys
 */
function getValidFeatureFlagKeys() {
  return [
    // Core producto
    'autopost_enabled',
    'manual_approval_enabled',
    'custom_prompt_enabled',
    'sponsor_feature_enabled',
    'original_tone_enabled',
    'nsfw_tone_enabled',
    // Shield / seguridad
    'kill_switch_autopost',
    'enable_shield',
    'enable_roast',
    // UX / UI
    'show_two_roast_variants',
    'show_transparency_disclaimer',
    // Despliegue / experimentales controlados
    'enable_style_validator',
    'enable_advanced_tones',
    'enable_beta_sponsor_ui'
  ];
}

/**
 * Get feature flag semantics (brief)
 * Source: SSOT-V2.md section 3.3
 * 
 * @returns {Object} Feature flag semantics
 */
function getFeatureFlagSemantics() {
  return {
    autopost_enabled: {
      actors: ['user', 'account'],
      description: 'Permite auto-approve de roasts'
    },
    manual_approval_enabled: {
      actors: ['user', 'account'],
      description: 'Cuando está ON, los roasts requieren aprobación manual'
    },
    custom_prompt_enabled: {
      actors: ['admin', 'plus'],
      description: 'Habilita UI de prompt personalizado (post-MVP, no implementar sin tarea)'
    },
    sponsor_feature_enabled: {
      actors: ['admin'],
      description: 'Habilita módulo de sponsors (solo Plus)'
    },
    original_tone_enabled: {
      actors: ['admin'],
      description: 'Habilita tono personal (Pro/Plus)'
    },
    nsfw_tone_enabled: {
      actors: ['admin'],
      description: 'Solo futuro con modelo dedicado, no usar en v2'
    },
    kill_switch_autopost: {
      actors: ['admin'],
      description: 'Apaga todos los autopost, aunque autopost_enabled esté ON'
    },
    enable_shield: {
      actors: ['user', 'account'],
      description: 'Enciende/apaga Shield para la cuenta'
    },
    enable_roast: {
      actors: ['user', 'account'],
      description: 'Permite desactivar Roasts y usar solo Shield'
    },
    show_two_roast_variants: {
      actors: ['admin'],
      description: 'ON → 2 variantes de roast. OFF → 1 variante'
    },
    show_transparency_disclaimer: {
      actors: ['admin'],
      description: 'Controla copia de transparencia IA, pero no puede desactivar la señalización legal obligatoria en UE para autopost'
    },
    enable_style_validator: {
      actors: ['admin'],
      description: 'Activa validador de estilo'
    },
    enable_advanced_tones: {
      actors: ['admin'],
      description: 'Reserva para extensiones futuras de tonos'
    },
    enable_beta_sponsor_ui: {
      actors: ['admin'],
      description: 'Habilita versiones beta de UI de sponsors'
    }
  };
}

/**
 * Get valid roast tones
 * Source: SSOT-V2.md section 6.1
 * 
 * @returns {string[]} Array of valid roast tones
 */
function getValidRoastTones() {
  return ['flanders', 'balanceado', 'canalla', 'personal'];
}

/**
 * Get supported platforms (v2 MVP)
 * Source: SSOT-V2.md section 7.1
 * 
 * @returns {string[]} Array of supported platforms
 */
function getSupportedPlatforms() {
  return ['x', 'youtube'];
}

/**
 * Get planned platforms (not implemented in v2)
 * Source: SSOT-V2.md section 7.2
 * 
 * @returns {string[]} Array of planned platforms
 */
function getPlannedPlatforms() {
  return [
    'instagram',
    'facebook',
    'discord',
    'twitch',
    'reddit',
    'tiktok',
    'bluesky'
  ];
}

/**
 * Get all SSOT data in a structured format
 * 
 * @returns {Object} Complete SSOT data structure
 */
function getAllSSOTData() {
  try {
    return {
      plans: {
        valid_ids: getValidPlanIds(),
        trial_config: getTrialConfiguration(),
        limits: getPlanLimits(),
        capabilities: getPlanCapabilities()
      },
      subscription: {
        valid_states: getValidSubscriptionStates()
      },
      features: {
        valid_flags: getValidFeatureFlagKeys(),
        semantics: getFeatureFlagSemantics()
      },
      tones: {
        valid_tones: getValidRoastTones()
      },
      platforms: {
        supported: getSupportedPlatforms(),
        planned: getPlannedPlatforms()
      },
      version: '2.0.0',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error getting SSOT data:', error);
    throw error;
  }
}

module.exports = {
  getValidPlanIds,
  getTrialConfiguration,
  getPlanLimits,
  getPlanCapabilities,
  getValidSubscriptionStates,
  getValidFeatureFlagKeys,
  getFeatureFlagSemantics,
  getValidRoastTones,
  getSupportedPlatforms,
  getPlannedPlatforms,
  getAllSSOTData
};

