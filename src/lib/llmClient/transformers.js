/**
 * LLM Response Transformers
 * 
 * Normalizes responses from different LLM providers to OpenAI-compatible format
 * Issue #920: Portkey AI Gateway integration
 */

/**
 * Transform Portkey/LLM response to OpenAI-compatible format
 * @param {Object} response - Raw response from LLM provider
 * @returns {Object} OpenAI-compatible response
 */
function transformChatCompletion(response) {
  // If already OpenAI-compatible, return as-is
  if (response.choices && response.choices[0] && response.choices[0].message) {
    return response;
  }

  // Transform Portkey response format
  if (response.content) {
    return {
      choices: [{
        message: {
          role: 'assistant',
          content: response.content
        },
        finish_reason: 'stop'
      }],
      usage: response.usage || {},
      model: response.model || 'unknown',
      _portkey: response._portkey || {}
    };
  }

  // Fallback: return response as-is
  return response;
}

/**
 * Transform embedding response to OpenAI-compatible format
 * @param {Object} response - Raw embedding response
 * @returns {Object} OpenAI-compatible embedding response
 */
function transformEmbedding(response) {
  // If already OpenAI-compatible, return as-is
  if (response.data && Array.isArray(response.data)) {
    return response;
  }

  // Transform Portkey embedding format
  if (response.embedding) {
    return {
      data: [{
        embedding: response.embedding,
        index: 0
      }],
      usage: response.usage || {},
      model: response.model || 'unknown',
      _portkey: response._portkey || {}
    };
  }

  // Fallback: return response as-is
  return response;
}

/**
 * Extract metadata from transformed response
 * Issue #920: Extract mode, provider, fallbackUsed from Portkey metadata
 * @param {Object} transformedResponse - Transformed response with _portkey metadata
 * @returns {Object} Extracted metadata
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

