/**
 * LLM Response Transformers
 * 
 * Normalizes Portkey responses to OpenAI-compatible format
 * Issue #920: Portkey AI Gateway integration
 */

const { logger } = require('../../utils/logger');

/**
 * Transform Portkey chat completion response to OpenAI format
 * @param {Object} portkeyResponse - Response from Portkey API
 * @param {string} mode - AI mode used
 * @param {string} provider - Provider used
 * @returns {Object} OpenAI-compatible response
 */
function transformChatCompletion(portkeyResponse, mode, provider) {
  try {
    // Portkey returns OpenAI-compatible format, but may have additional metadata
    const transformed = {
      id: portkeyResponse.id || `portkey-${Date.now()}`,
      object: portkeyResponse.object || 'chat.completion',
      created: portkeyResponse.created || Math.floor(Date.now() / 1000),
      model: portkeyResponse.model || 'unknown',
      choices: portkeyResponse.choices || [],
      usage: portkeyResponse.usage || {},
      // Portkey-specific metadata
      _portkey: {
        mode,
        provider,
        metadata: portkeyResponse.metadata || {},
        fallbackUsed: portkeyResponse.fallback_used || false
      }
    };

    return transformed;
  } catch (error) {
    logger.error('Error transforming Portkey response:', error);
    throw new Error(`Failed to transform Portkey response: ${error.message}`);
  }
}

/**
 * Transform Portkey embedding response to OpenAI format
 * @param {Object} portkeyResponse - Response from Portkey API
 * @param {string} mode - AI mode used
 * @param {string} provider - Provider used
 * @returns {Object} OpenAI-compatible response
 */
function transformEmbedding(portkeyResponse, mode, provider) {
  try {
    const transformed = {
      object: portkeyResponse.object || 'list',
      data: portkeyResponse.data || [],
      model: portkeyResponse.model || 'unknown',
      usage: portkeyResponse.usage || {},
      // Portkey-specific metadata
      _portkey: {
        mode,
        provider,
        metadata: portkeyResponse.metadata || {},
        fallbackUsed: portkeyResponse.fallback_used || false
      }
    };

    return transformed;
  } catch (error) {
    logger.error('Error transforming Portkey embedding response:', error);
    throw new Error(`Failed to transform Portkey embedding response: ${error.message}`);
  }
}

/**
 * Extract metadata from transformed response
 * @param {Object} transformedResponse - Transformed response with _portkey metadata
 * @returns {Object} Metadata object
 */
function extractMetadata(transformedResponse) {
  return {
    mode: transformedResponse._portkey?.mode || 'default',
    provider: transformedResponse._portkey?.provider || 'openai',
    fallbackUsed: transformedResponse._portkey?.fallbackUsed || false,
    metadata: transformedResponse._portkey?.metadata || {}
  };
}

module.exports = {
  transformChatCompletion,
  transformEmbedding,
  extractMetadata
};


