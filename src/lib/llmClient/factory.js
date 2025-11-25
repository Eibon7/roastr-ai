/**
 * LLM Client Factory
 *
 * Creates and manages LLM client instances with Portkey AI Gateway integration
 * Issue #920: Portkey AI Gateway integration
 *
 * Features:
 * - Singleton pattern per mode/plan
 * - Automatic fallback handling
 * - OpenAI-compatible interface
 * - Portkey integration when configured
 */

const OpenAI = require('openai');
const Portkey = require('portkey-ai');
const { logger } = require('../../utils/logger');
const {
  getRoute: getRouteConfig,
  getAvailableModes: getAvailableModesFromRoutes,
  modeExists: modeExistsInRoutes
} = require('./routes');
const { getNextFallback, getFallbackChain: getFallbackChainFromModule } = require('./fallbacks');
const { transformChatCompletion, transformEmbedding, extractMetadata } = require('./transformers');
const mockMode = require('../../config/mockMode');

// Client cache: key = `${mode}-${plan}`
const clientCache = new Map();

/**
 * Check if Portkey is configured
 * @returns {boolean} True if Portkey API key and project ID are set
 */
function isPortkeyConfigured() {
  return !!(process.env.PORTKEY_API_KEY && process.env.PORTKEY_PROJECT_ID);
}

/**
 * Create Portkey client
 * @param {Object} route - Route configuration
 * @param {Object} options - Client options
 * @returns {Object} Portkey client instance
 */
function createPortkeyClient(route, options = {}) {
  const portkeyApiKey = process.env.PORTKEY_API_KEY;
  const portkeyProjectId = process.env.PORTKEY_PROJECT_ID;
  const defaultRoute = process.env.PORTKEY_DEFAULT_ROUTE || route.provider;

  return new Portkey({
    apiKey: portkeyApiKey,
    projectId: portkeyProjectId,
    defaultRoute: defaultRoute,
    ...options
  });
}

/**
 * Create OpenAI client
 * @param {Object} options - Client options
 * @returns {Object} OpenAI client instance
 */
function createOpenAIClient(options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  return new OpenAI({
    apiKey,
    timeout: options.timeout || 30000,
    maxRetries: options.maxRetries || 1,
    ...options
  });
}

/**
 * Create LLM client instance for a mode
 * @param {string} mode - AI mode (default, flanders, balanceado, canalla, nsfw)
 * @param {Object} options - Options (plan, timeout, maxRetries)
 * @returns {Object} LLM client wrapper with OpenAI-compatible interface
 */
function getInstance(mode = 'default', options = {}) {
  // Normalize mode
  const normalizedMode = mode.toLowerCase();
  const route = getRouteConfig(normalizedMode);

  // Cache key: mode + plan (if provided)
  const cacheKey = `${normalizedMode}-${options.plan || 'default'}`;

  // Return cached instance if available
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey);
  }

  // Determine client type
  let client;
  let clientType = 'openai'; // Default to OpenAI

  // Check for Grok API key for NSFW mode
  const grokApiKey = process.env.GROK_API_KEY;

  // Issue #920: Use Portkey if configured, otherwise fallback to OpenAI
  if (normalizedMode === 'nsfw' && grokApiKey && !isPortkeyConfigured()) {
    // Direct Grok client (when Portkey not configured)
    // Issue #920: Use Grok API key and endpoint (OpenAI-compatible API)
    logger.info('LLMClient: Using direct Grok client for NSFW mode');
    client = new OpenAI({
      apiKey: grokApiKey,
      baseURL: process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 1,
      ...options
    });
    clientType = 'grok';
  } else if (isPortkeyConfigured() && !mockMode.isMockMode) {
    // Use Portkey gateway
    logger.info(`LLMClient: Using Portkey gateway for mode "${normalizedMode}"`);
    client = createPortkeyClient(route, options);
    clientType = 'portkey';
  } else {
    // Fallback to OpenAI
    logger.info(`LLMClient: Using OpenAI directly for mode "${normalizedMode}"`);
    client = createOpenAIClient(options);
    clientType = 'openai';
  }

  // Create wrapper with OpenAI-compatible interface
  const wrapper = {
    client,
    clientType,
    mode: normalizedMode,
    route,
    config: route.config,
    extractMetadata: (response) => extractMetadata(response),

    // OpenAI-compatible chat interface
    chat: {
      completions: {
        create: async (params) => {
          try {
            // Works for both Portkey and direct clients (OpenAI-compatible interface)
            const response = await client.chat.completions.create({
              ...params,
              model: route.model,
              ...route.config
            });

            // Transform and add metadata
            const transformed = transformChatCompletion(response);
            return {
              ...transformed,
              _portkey: {
                mode: normalizedMode,
                provider: route.provider,
                fallbackUsed: false,
                metadata: {}
              }
            };
          } catch (error) {
            // Issue #920: Check if error is due to model not found/available
            const isModelError =
              error.message?.includes('model') ||
              error.message?.includes('not found') ||
              error.message?.includes('invalid') ||
              error.code === 'model_not_found';

            // Try fallback model if primary model failed and fallbackModel is configured
            if (isModelError && route.fallbackModel && route.model !== route.fallbackModel) {
              logger.warn(
                `LLMClient: Model "${route.model}" not available, trying fallback "${route.fallbackModel}"`
              );
              try {
                const fallbackResponse = await client.chat.completions.create({
                  ...params,
                  model: route.fallbackModel,
                  ...route.config
                });
                const transformed = transformChatCompletion(fallbackResponse);
                return {
                  ...transformed,
                  _portkey: {
                    mode: normalizedMode,
                    provider: route.provider,
                    fallbackUsed: true,
                    originalModel: route.model,
                    fallbackModel: route.fallbackModel,
                    metadata: {}
                  }
                };
              } catch (fallbackError) {
                logger.error(
                  `LLMClient: Fallback model "${route.fallbackModel}" also failed`,
                  { error: fallbackError.message }
                );
                // Continue to provider fallback logic below
              }
            }

            logger.error(
              `LLMClient: Error in chat.completions.create for mode "${normalizedMode}"`,
              {
                error: error.message,
                provider: route.provider,
                model: route.model
              }
            );

            // Handle provider fallback (Portkey → OpenAI)
            if (clientType === 'portkey') {
              const nextProvider = getNextFallback(normalizedMode, route.provider);
              if (nextProvider === 'openai') {
                logger.info(`LLMClient: Falling back to OpenAI for mode "${normalizedMode}"`);
                const openaiClient = createOpenAIClient(options);
                // Issue #920: Use fallback model if route model isn't OpenAI-compatible (e.g., grok-beta)
                const fallbackModel =
                  route.fallbackModel || (route.provider !== 'openai' ? 'gpt-4-turbo' : route.model);
                const response = await openaiClient.chat.completions.create({
                  ...params,
                  model: fallbackModel,
                  ...route.config
                });

                return {
                  ...transformChatCompletion(response),
                  _portkey: {
                    mode: normalizedMode,
                    provider: 'openai',
                    fallbackUsed: true,
                    originalProvider: route.provider,
                    originalModel: route.model,
                    fallbackModel: fallbackModel,
                    metadata: {}
                  }
                };
              }
            }

            throw error;
          }
        }
      }
    },

    // OpenAI-compatible embeddings interface
    embeddings: {
      create: async (embeddingParams) => {
        try {
          // Works for both Portkey and direct clients (OpenAI-compatible interface)
          const response = await client.embeddings.create({
            ...embeddingParams,
            model: route.model || 'text-embedding-3-small'
          });

          const transformed = transformEmbedding(response);
          return {
            ...transformed,
            _portkey: {
              mode: normalizedMode,
              provider: route.provider,
              fallbackUsed: false,
              metadata: {}
            }
          };
        } catch (error) {
          logger.error(`LLMClient: Error in embeddings.create for mode "${normalizedMode}"`, {
            error: error.message,
            provider: route.provider
          });

          // Handle fallback
          if (clientType === 'portkey') {
            const nextProvider = getNextFallback(normalizedMode, route.provider);
            if (nextProvider === 'openai') {
              logger.info(
                `LLMClient: Falling back to OpenAI for embeddings mode "${normalizedMode}"`
              );
              const openaiClient = createOpenAIClient(options);
              const response = await openaiClient.embeddings.create(embeddingParams);

              // Issue #920: Apply consistent transformation for fallback path
              return {
                ...transformEmbedding(response),
                _portkey: {
                  mode: normalizedMode,
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
    },

    // OpenAI-compatible responses interface (for Responses API)
    responses: {
      create: async (params) => {
        try {
          // Works for both Portkey and direct clients (OpenAI-compatible interface)
          const response = await client.responses.create({
            ...params,
            model: route.model,
            ...route.config
          });

          const transformed = transformChatCompletion(response);
          return {
            ...transformed,
            _portkey: {
              mode: normalizedMode,
              provider: route.provider,
              fallbackUsed: false,
              metadata: {}
            }
          };
        } catch (error) {
          // Issue #920: Check if error is due to model not found/available
          const isModelError =
            error.message?.includes('model') ||
            error.message?.includes('not found') ||
            error.message?.includes('invalid') ||
            error.code === 'model_not_found';

          // Try fallback model if primary model failed and fallbackModel is configured
          if (isModelError && route.fallbackModel && route.model !== route.fallbackModel) {
            logger.warn(
              `LLMClient: Model "${route.model}" not available for responses, trying fallback "${route.fallbackModel}"`
            );
            try {
              const fallbackResponse = await client.responses.create({
                ...params,
                model: route.fallbackModel,
                ...route.config
              });
              const transformed = transformChatCompletion(fallbackResponse);
              return {
                ...transformed,
                _portkey: {
                  mode: normalizedMode,
                  provider: route.provider,
                  fallbackUsed: true,
                  originalModel: route.model,
                  fallbackModel: route.fallbackModel,
                  metadata: {}
                }
              };
            } catch (fallbackError) {
              logger.error(
                `LLMClient: Fallback model "${route.fallbackModel}" also failed for responses`,
                { error: fallbackError.message }
              );
              // Continue to provider fallback logic below
            }
          }

          logger.error(`LLMClient: Error in responses.create for mode "${normalizedMode}"`, {
            error: error.message,
            provider: route.provider,
            model: route.model
          });

          // Handle provider fallback (Portkey → OpenAI)
          if (clientType === 'portkey') {
            const nextProvider = getNextFallback(normalizedMode, route.provider);
            if (nextProvider === 'openai') {
              logger.info(
                `LLMClient: Falling back to OpenAI for responses mode "${normalizedMode}"`
              );
              const openaiClient = createOpenAIClient(options);
              // Issue #920: Use fallback model if route model isn't OpenAI-compatible
              const fallbackModel =
                route.fallbackModel || (route.provider !== 'openai' ? 'gpt-4-turbo' : route.model);
              const response = await openaiClient.responses.create({
                ...params,
                model: fallbackModel,
                ...route.config
              });

              return {
                ...transformChatCompletion(response),
                _portkey: {
                  mode: normalizedMode,
                  provider: 'openai',
                  fallbackUsed: true,
                  originalProvider: route.provider,
                  originalModel: route.model,
                  fallbackModel: fallbackModel,
                  metadata: {}
                }
              };
            }
          }

          throw error;
        }
      }
    },

    // OpenAI-compatible moderations interface (for Moderation API)
    moderations: {
      create: async (params) => {
        try {
          // Moderations API is OpenAI-specific, use underlying client directly
          const moderationResponse = await client.moderations.create(params);
          return {
            ...moderationResponse,
            _portkey: {
              mode: normalizedMode,
              provider: route.provider,
              fallbackUsed: false,
              metadata: {}
            }
          };
        } catch (error) {
          logger.error(`LLMClient: Error in moderations.create for mode "${normalizedMode}"`, {
            error: error.message,
            provider: route.provider
          });
          throw error;
        }
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
  return getAvailableModesFromRoutes();
}

/**
 * Check if a mode exists
 * Issue #920: Helper for endpoint /api/ai-modes
 */
function modeExists(mode) {
  return modeExistsInRoutes(mode);
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
  return getFallbackChainFromModule(mode);
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
