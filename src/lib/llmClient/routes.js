/**
 * LLM Routes Configuration
 *
 * Defines routing table for AI modes → provider/model mappings
 * Issue #920: Portkey AI Gateway integration
 */

/**
 * Route configuration for each AI mode
 * Issue #920: Portkey AI Gateway integration
 *
 * Modos actuales del sistema:
 * - flanders: Tono amable pero con ironía sutil (intensidad 2/5)
 * - balanceado: Equilibrio entre ingenio y firmeza (intensidad 3/5)
 * - canalla: Directo y sin filtros, más picante (intensidad 4/5)
 * - nsfw: Modo NSFW con Grok (preparado para cuando tengamos API key)
 *
 * Model Configuration:
 * - Primary: gpt-5.1 (if available via Portkey or OpenAI)
 * - Fallback: gpt-4-turbo (if gpt-5.1 not available)
 * - Portkey gateway handles automatic fallbacks when model unavailable
 *
 * @type {Object<string, {provider: string, model: string, fallbackModel?: string, config: Object}>}
 */
const routes = {
  default: {
    provider: 'openai',
    model: 'gpt-5.1', // Portkey/OpenAI will fallback to gpt-4-turbo if unavailable
    fallbackModel: 'gpt-4-turbo', // Explicit fallback for direct OpenAI calls
    config: {
      temperature: 0.8,
      max_tokens: 150,
      timeout: 30000
    }
  },
  flanders: {
    provider: 'openai',
    model: 'gpt-5.1',
    fallbackModel: 'gpt-4-turbo',
    config: {
      temperature: 0.7, // Más bajo para tono más amable
      max_tokens: 150,
      timeout: 30000
    }
  },
  balanceado: {
    provider: 'openai',
    model: 'gpt-5.1',
    fallbackModel: 'gpt-4-turbo',
    config: {
      temperature: 0.8, // Equilibrado
      max_tokens: 150,
      timeout: 30000
    }
  },
  canalla: {
    provider: 'openai',
    model: 'gpt-5.1',
    fallbackModel: 'gpt-4-turbo',
    config: {
      temperature: 0.9, // Más alto para tono más directo
      max_tokens: 150,
      timeout: 30000
    }
  },
  nsfw: {
    provider: 'grok',
    model: 'grok-beta',
    // Issue #920: Fallback model for when Grok fails and falls back to OpenAI
    fallbackModel: 'gpt-4-turbo', // Use valid OpenAI model as fallback
    config: {
      temperature: 0.9,
      max_tokens: 150,
      timeout: 30000
    },
    // Fallback a OpenAI si Grok no está configurado
    fallbackToOpenAI: true
  }
};

/**
 * Get route configuration for a given mode
 * @param {string} mode - AI mode (flanders, balanceado, canalla, nsfw, default)
 * @returns {Object} Route configuration
 */
function getRoute(mode = 'default') {
  // Normalize mode name (case-insensitive, handle Spanish accents)
  const normalizedMode = mode.toLowerCase();

  // Map common variations
  const modeMap = {
    flanders: 'flanders',
    balanceado: 'balanceado',
    balanced: 'balanceado',
    canalla: 'canalla',
    savage: 'canalla',
    nsfw: 'nsfw',
    default: 'default'
  };

  const mappedMode = modeMap[normalizedMode] || normalizedMode;
  return routes[mappedMode] || routes.default;
}

/**
 * Get all available modes
 * @returns {string[]} Array of mode names
 */
function getAvailableModes() {
  return Object.keys(routes);
}

/**
 * Check if a mode exists
 * @param {string} mode - Mode to check
 * @returns {boolean} True if mode exists
 */
function modeExists(mode) {
  return mode in routes;
}

module.exports = {
  routes,
  getRoute,
  getAvailableModes,
  modeExists
};
