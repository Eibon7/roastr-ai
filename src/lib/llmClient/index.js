/**
 * LLM Client - Unified LLM Interface
 * 
 * Provides unified interface for LLM operations via Portkey AI Gateway
 * Issue #920: Portkey AI Gateway integration
 * 
 * Usage:
 *   const LLMClient = require('./lib/llmClient');
 *   const client = LLMClient.getInstance('default');
 *   const response = await client.chat({ messages: [...] });
 */

const factory = require('./factory');
const routes = require('./routes');
const fallbacks = require('./fallbacks');
const transformers = require('./transformers');

module.exports = {
  /**
   * Get LLM client instance for a mode
   * @param {string} mode - AI mode (default, empathetic, nsfw, cheap, fast)
   * @param {Object} options - Options (plan, timeout, maxRetries)
   * @returns {Object} LLM client wrapper
   */
  getInstance: factory.getInstance,

  /**
   * Clear client cache
   */
  clearCache: factory.clearCache,

  /**
   * Check if Portkey is configured
   */
  isPortkeyConfigured: factory.isPortkeyConfigured,

  /**
   * Get route configuration
   */
  getRoute: routes.getRoute,

  /**
   * Get available modes
   */
  getAvailableModes: routes.getAvailableModes,

  /**
   * Check if mode exists
   */
  modeExists: routes.modeExists,

  /**
   * Get fallback chain
   */
  getFallbackChain: fallbacks.getFallbackChain,

  /**
   * Extract metadata from response
   */
  extractMetadata: transformers.extractMetadata
};


