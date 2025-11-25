/**
 * LLM Fallback Chains
 * 
 * Defines fallback sequences for each AI mode when primary provider fails
 * Issue #920: Portkey AI Gateway integration
 */

/**
 * Fallback chains for each mode
 * Issue #920: Portkey AI Gateway integration
 * 
 * Modos actuales:
 * - flanders, balanceado, canalla: OpenAI GPT-5.1 (sin fallback necesario)
 * - nsfw: Grok → OpenAI (fallback si Grok no está configurado)
 * @type {Object<string, string[]>}
 */
const fallbackChains = {
  default: ['openai'], // GPT-5.1 por defecto
  flanders: ['openai'], // GPT-5.1
  balanceado: ['openai'], // GPT-5.1
  canalla: ['openai'], // GPT-5.1
  nsfw: ['grok', 'openai'] // Grok → OpenAI (si Grok no configurado)
};

/**
 * Get fallback chain for a mode
 * @param {string} mode - AI mode
 * @returns {string[]} Array of provider names in fallback order
 */
function getFallbackChain(mode = 'default') {
  return fallbackChains[mode] || fallbackChains.default;
}

/**
 * Get next provider in fallback chain
 * @param {string} mode - AI mode
 * @param {string} currentProvider - Current provider that failed
 * @returns {string|null} Next provider or null if no more fallbacks
 */
function getNextFallback(mode, currentProvider) {
  const chain = getFallbackChain(mode);
  const currentIndex = chain.indexOf(currentProvider);
  
  if (currentIndex === -1 || currentIndex === chain.length - 1) {
    return null; // No more fallbacks
  }
  
  return chain[currentIndex + 1];
}

module.exports = {
  fallbackChains,
  getFallbackChain,
  getNextFallback
};

