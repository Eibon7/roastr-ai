/**
 * LLM Client Factory
 *
 * Singleton factory for creating and caching LLM client instances
 * Issue #920: Portkey AI Gateway integration
 */

const Portkey = require('portkey-ai');
const OpenAI = require('openai');
const { logger } = require('../../utils/logger');
const {
  getRoute: getRouteConfig,
  getAvailableModes: getAvailableModesFromRoutes,
  modeExists: modeExistsInRoutes
} = require('./routes');
const { getNextFallback } = require('./fallbacks');
const { transformChatCompletion, transformEmbedding, extractMetadata } = require('./transformers');
const mockMode = require('../../config/mockMode');

require('dotenv').config();

/**
 * Cache of client instances by mode
 * @type {Map<string, Object>}
 */
const clientCache = new Map();

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  timeout: parseInt(process.env.PORTKEY_TIMEOUT_MS || '30000', 10),
  maxRetries: parseInt(process.env.PORTKEY_MAX_RETRIES || '3', 10)
};

/**
 * Check if Portkey is configured
 * @returns {boolean} True if Portkey API key is available
 */
function isPortkeyConfigured() {
  return !!(process.env.PORTKEY_API_KEY && process.env.PORTKEY_PROJECT_ID);
}

/**
 * Create Portkey client instance
 * @param {string} mode - AI mode
 * @param {Object} config - Additional configuration
 * @returns {Object} Portkey client instance
 */
function createPortkeyClient(mode, config = {}) {
  const route = getRouteConfig(mode);
  const portkeyConfig = {
    apiKey: process.env.PORTKEY_API_KEY,
    baseURL: process.env.PORTKEY_BASE_URL || 'https://api.portkey.ai/v1',
    defaultHeaders: {
      'x-portkey-api-key': process.env.PORTKEY_API_KEY,
      'x-portkey-project-id': process.env.PORTKEY_PROJECT_ID
    },
    timeout: config.timeout || DEFAULT_CONFIG.timeout,
    maxRetries: config.maxRetries || DEFAULT_CONFIG.maxRetries
  };

  return new Portkey(portkeyConfig);
}

/**
 * Create OpenAI client instance (fallback)
 * @param {Object} config - Configuration
 * @returns {Object} OpenAI client instance
 */
function createOpenAIClient(config = {}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  return new OpenAI({
    apiKey,
    timeout: config.timeout || DEFAULT_CONFIG.timeout,
    maxRetries: config.maxRetries || DEFAULT_CONFIG.maxRetries
  });
}

/**
 * Get or create LLM client instance for a mode
 * @param {string} mode - AI mode (default, empathetic, nsfw, cheap, fast)
 * @param {Object} options - Options (plan, timeout, maxRetries)
 * @returns {Object} LLM client wrapper
 */
function getInstance(mode = 'default', options = {}) {
  // Check cache first
  const cacheKey = `${mode}-${options.plan || 'default'}`;
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey);
  }

  // Create new instance
  const route = getRouteConfig(mode);
  const config = {
    ...DEFAULT_CONFIG,
    ...route.config,
    ...options
  };

  let client;
  let clientType;

  // Special handling for NSFW mode (Grok) - Issue #920
  // If Grok not configured, fallback to OpenAI
  if (mode === 'nsfw' && route.fallbackToOpenAI) {
    const grokApiKey = process.env.GROK_API_KEY;
    if (!grokApiKey && !isPortkeyConfigured()) {
      logger.warn(
        'LLMClient: NSFW mode requested but Grok API key not configured, using OpenAI fallback'
      );
      client = createOpenAIClient(config);
      clientType = 'openai';
      // Update route to reflect fallback
      route.provider = 'openai';
      route.model = 'gpt-5.1';
    } else if (isPortkeyConfigured() && !mockMode.isMockMode) {
      // Use Portkey for Grok routing
      try {
        client = createPortkeyClient(mode, config);
        clientType = 'portkey';
        logger.info(`LLMClient: Created Portkey client for NSFW mode (Grok)`);
      } catch (error) {
        logger.warn(
          `LLMClient: Failed to create Portkey client for NSFW, falling back to OpenAI: ${error.message}`
        );
        client = createOpenAIClient(config);
        clientType = 'openai';
        route.provider = 'openai';
        route.model = 'gpt-5.1';
      }
    } else {
      client = createOpenAIClient(config);
      clientType = 'openai';
      route.provider = 'openai';
      route.model = 'gpt-5.1';
    }
  } else if (isPortkeyConfigured() && !mockMode.isMockMode) {
    // Use Portkey for other modes (flanders, balanceado, canalla)
    try {
      client = createPortkeyClient(mode, config);
      clientType = 'portkey';
      logger.info(`LLMClient: Created Portkey client for mode "${mode}"`);
    } catch (error) {
      logger.warn(
        `LLMClient: Failed to create Portkey client, falling back to OpenAI: ${error.message}`
      );
      client = createOpenAIClient(config);
      clientType = 'openai';
    }
  } else {
    // Fallback to OpenAI direct
    if (mockMode.isMockMode) {
      client = mockMode.generateMockOpenAI();
      clientType = 'mock';
      logger.info(`LLMClient: Using mock client for mode "${mode}"`);
    } else {
      client = createOpenAIClient(config);
      clientType = 'openai';
      logger.info(`LLMClient: Created OpenAI client for mode "${mode}" (Portkey not configured)`);
    }
  }

  // Create wrapper with OpenAI-compatible interface
  const wrapper = {
    client,
    clientType,
    mode,
    route,
    config,

    /**
     * Chat completions (OpenAI-compatible)
     * Exposes chat.completions.create() for backward compatibility
     */
    chat: {
      completions: {
        create: async (completionParams) => {
          return await wrapper._chatInternal(completionParams);
        }
      }
    },

    /**
     * Embeddings (OpenAI-compatible)
     * Exposes embeddings.create() for backward compatibility
     */
    embeddings: {
      create: async (embeddingParams) => {
        return await wrapper._embeddingsInternal(embeddingParams);
      }
    },

    /**
     * Internal chat completion method
     * @private
     */
    async _chatInternal(completionParams) {
      const startTime = Date.now();
      let lastError;

      try {
        if (clientType === 'portkey') {
          // Use Portkey with route configuration
          const portkeyParams = {
            ...completionParams,
            model: route.model,
            // Portkey-specific: route configuration
            route: process.env.PORTKEY_DEFAULT_ROUTE || 'default'
          };

          const response = await client.chat.completions.create(portkeyParams);
          const transformed = transformChatCompletion(response, mode, route.provider);

          logger.debug('LLMClient: Portkey chat completion successful', {
            mode,
            provider: route.provider,
            latency: Date.now() - startTime
          });

          return transformed;
        } else {
          // Direct OpenAI or mock
          const response = await client.chat.completions.create(completionParams);

          logger.debug('LLMClient: OpenAI chat completion successful', {
            mode,
            clientType,
            latency: Date.now() - startTime
          });

          return response;
        }
      } catch (error) {
        lastError = error;
        logger.error('LLMClient: Chat completion failed', {
          mode,
          clientType,
          error: error.message
        });

        // Try fallback if using Portkey
        if (clientType === 'portkey') {
          const nextProvider = getNextFallback(mode, route.provider);
          if (nextProvider === 'openai') {
            logger.info(`LLMClient: Falling back to OpenAI for mode "${mode}"`);
            const openaiClient = createOpenAIClient(config);
            const response = await openaiClient.chat.completions.create(completionParams);

            // Mark as fallback used
            return {
              ...response,
              _portkey: {
                mode,
                provider: 'openai',
                fallbackUsed: true,
                originalProvider: route.provider
              }
            };
          }
        }

        throw error;
      }
    },

    /**
     * Responses API (OpenAI-compatible)
     * Exposes responses.create() for prompt caching support
     */
    responses: {
      create: async (responsesParams) => {
        // Responses API is OpenAI-specific, so use OpenAI client directly
        // Portkey may support this in the future, but for now fallback to OpenAI
        if (clientType === 'portkey') {
          logger.warn('LLMClient: Responses API not supported via Portkey, using OpenAI fallback');
          const openaiClient = createOpenAIClient(config);
          return await openaiClient.responses.create(responsesParams);
        } else if (clientType === 'openai' && client.responses) {
          return await client.responses.create(responsesParams);
        } else {
          // Fallback: convert Responses API params to chat.completions
          logger.debug('LLMClient: Converting Responses API to chat.completions');
          const messages = [
            {
              role: 'system',
              content: responsesParams.input || ''
            }
          ];
          return await wrapper._chatInternal({
            model: responsesParams.model,
            messages,
            max_tokens: responsesParams.max_tokens,
            temperature: responsesParams.temperature
          });
        }
      }
    },

    /**
     * Extract Portkey metadata from response
     * Issue #920: Helper to extract mode, provider, fallbackUsed from responses
     */
    extractMetadata(response) {
      return extractMetadataFromResponse(response);
    },

    /**
     * Internal embeddings method
     * @private
     */
    async _embeddingsInternal(embeddingParams) {
      const startTime = Date.now();

      try {
        if (clientType === 'portkey') {
          const portkeyParams = {
            ...embeddingParams,
            model: route.model || 'text-embedding-3-small',
            route: process.env.PORTKEY_DEFAULT_ROUTE || 'default'
          };

          const response = await client.embeddings.create(portkeyParams);
          const transformed = transformEmbedding(response, mode, route.provider);

          logger.debug('LLMClient: Portkey embedding successful', {
            mode,
            provider: route.provider,
            latency: Date.now() - startTime
          });

          return transformed;
        } else {
          const response = await client.embeddings.create(embeddingParams);

          logger.debug('LLMClient: OpenAI embedding successful', {
            mode,
            clientType,
            latency: Date.now() - startTime
          });

          return response;
        }
      } catch (error) {
        logger.error('LLMClient: Embedding failed', {
          mode,
          clientType,
          error: error.message
        });

        // Try fallback if using Portkey
        if (clientType === 'portkey') {
          const nextProvider = getNextFallback(mode, route.provider);
          if (nextProvider === 'openai') {
            logger.info(`LLMClient: Falling back to OpenAI for embeddings mode "${mode}"`);
            const openaiClient = createOpenAIClient(config);
            const response = await openaiClient.embeddings.create(embeddingParams);

            return {
              ...response,
              _portkey: {
                mode,
                provider: 'openai',
                fallbackUsed: true,
                originalProvider: route.provider
              }
            };
          }
        }

        throw error;
      }
    }
  };

  // Cache instance
  clientCache.set(cacheKey, wrapper);

  return wrapper;
}

/**
 * Clear client cache (useful for testing)
 */
function clearCache() {
  clientCache.clear();
}

/**
 * Get available AI modes
 * Issue #920: Helper for endpoint /api/ai-modes
 */
function getAvailableModes() {
  const { LLM_ROUTES } = require('./routes');
  return Object.keys(LLM_ROUTES);
}

/**
 * Check if a mode exists
 * Issue #920: Helper for endpoint /api/ai-modes
 */
function modeExists(mode) {
  const { LLM_ROUTES } = require('./routes');
  return mode in LLM_ROUTES;
}

/**
 * Get route configuration for a mode
 * Issue #920: Helper for endpoint /api/ai-modes
 */
function getRoute(mode) {
  return getRouteConfig(mode);
}

/**
 * Get fallback chain for a mode
 * Issue #920: Helper for endpoint /api/ai-modes
 */
function getFallbackChain(mode) {
  const { getNextFallback } = require('./fallbacks');
  const route = getRouteConfig(mode);
  if (!route || !route.fallbacks) {
    return [];
  }
  return route.fallbacks;
}

module.exports = {
  getInstance,
  clearCache,
  isPortkeyConfigured,
  getAvailableModes,
  modeExists,
  getRoute,
  getFallbackChain
};
