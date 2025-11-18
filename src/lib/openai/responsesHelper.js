/**
 * OpenAI Responses API Helper
 * 
 * Issue #858: Helper para usar Responses API con prompt caching
 * 
 * Provides a unified interface for OpenAI API calls with:
 * - Responses API support (prompt caching) when available
 * - Fallback to chat.completions API if Responses API not available
 * - Automatic token logging
 * 
 * @module lib/openai/responsesHelper
 */

const { logger } = require('../../utils/logger');
const aiUsageLogger = require('../../services/aiUsageLogger');

/**
 * Call OpenAI with Responses API (prompt caching) or fallback to chat.completions
 * 
 * @param {Object} openaiClient - OpenAI client instance
 * @param {Object} options - Request options
 * @param {string} options.model - Model to use (e.g., 'gpt-5.1', 'gpt-4o')
 * @param {string} options.input - Complete prompt (for Responses API)
 * @param {Array} options.messages - Messages array (for chat.completions fallback)
 * @param {number} options.max_tokens - Max tokens
 * @param {number} options.temperature - Temperature
 * @param {string} options.prompt_cache_retention - Cache retention ('24h' for Responses API)
 * @param {Object} options.loggingContext - Context for logging (userId, plan, endpoint)
 * @returns {Promise<Object>} Response with content and usage data
 */
async function callOpenAIWithCaching(openaiClient, options = {}) {
  const {
    model = 'gpt-4o',
    input = null,
    messages = null,
    max_tokens = 150,
    temperature = 0.8,
    prompt_cache_retention = '24h',
    loggingContext = {}
  } = options;

  // Determine if we should use Responses API
  // Responses API requires:
  // 1. Model supports it (gpt-5.1, gpt-4o, etc.)
  // 2. Input string (not messages array)
  // 3. prompt_cache_retention parameter
  
  // Whitelist of models that support Responses API (explicit matching to avoid false positives)
  const RESPONSES_API_MODELS = [
    'gpt-5',
    'gpt-5.1',
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'o3'
  ];
  
  const supportsResponsesAPI = RESPONSES_API_MODELS.some(supportedModel => 
    model === supportedModel || model.startsWith(supportedModel + '-')
  );
  
  let useResponsesAPI = input && typeof input === 'string' && supportsResponsesAPI;

  try {
    let response;
    let usage = {};

    if (useResponsesAPI && openaiClient.responses) {
      // Try Responses API with prompt caching
      try {
        logger.debug('Using Responses API with prompt caching', {
          model,
          inputLength: input.length,
          prompt_cache_retention
        });

        response = await openaiClient.responses.create({
          model: model,
          input: input,
          prompt_cache_retention: prompt_cache_retention,
          max_tokens: max_tokens,
          temperature: temperature
        });

        // Extract content and usage from Responses API format
        const content = response.choices?.[0]?.message?.content || 
                       response.text || 
                       response.content || 
                       '';

        usage = {
          input_tokens: response.usage?.input_tokens || 0,
          output_tokens: response.usage?.output_tokens || 0,
          input_cached_tokens: response.usage?.input_cached_tokens || 0,
          total_tokens: response.usage?.total_tokens || 0
        };

        logger.info('Responses API call successful', {
          model,
          cachedTokens: usage.input_cached_tokens,
          cacheHitRatio: usage.input_tokens > 0 
            ? (usage.input_cached_tokens / (usage.input_tokens + usage.input_cached_tokens)).toFixed(2)
            : 0
        });

      } catch (responsesError) {
        // Responses API not available or failed, fallback to chat.completions
        logger.warn('Responses API failed, falling back to chat.completions', {
          error: responsesError.message,
          model
        });
        
        // Fall through to chat.completions
        useResponsesAPI = false;
      }
    }

    if (!useResponsesAPI || !response) {
      // Fallback to chat.completions API
      const messagesToUse = messages || [
        {
          role: 'system',
          content: input || 'You are a helpful assistant.'
        }
      ];

      logger.debug('Using chat.completions API (fallback)', {
        model,
        messagesCount: messagesToUse.length
      });

      response = await openaiClient.chat.completions.create({
        model: model,
        messages: messagesToUse,
        max_tokens: max_tokens,
        temperature: temperature
      });

      // Extract content and usage from chat.completions format
      const content = response.choices?.[0]?.message?.content || '';

      usage = {
        input_tokens: response.usage?.prompt_tokens || response.usage?.input_tokens || 0,
        output_tokens: response.usage?.completion_tokens || response.usage?.output_tokens || 0,
        input_cached_tokens: response.usage?.input_cached_tokens || 0, // May not be available
        total_tokens: response.usage?.total_tokens || 0
      };

      logger.debug('chat.completions API call successful', {
        model,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens
      });
    }

    // Extract content
    const content = response.choices?.[0]?.message?.content || 
                   response.text || 
                   response.content || 
                   '';

    // Log usage metrics
    if (loggingContext.userId) {
      await aiUsageLogger.logUsage({
        userId: loggingContext.userId,
        orgId: loggingContext.orgId || null,
        model: model,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cachedTokens: usage.input_cached_tokens || 0,
        plan: loggingContext.plan || null,
        endpoint: loggingContext.endpoint || 'roast'
      });
    }

    return {
      content: content.trim(),
      usage: usage,
      method: useResponsesAPI ? 'responses_api' : 'chat_completions'
    };

  } catch (error) {
    logger.error('OpenAI API call failed', {
      error: error.message,
      model,
      useResponsesAPI,
      stack: error.stack
    });
    throw error;
  }
}

module.exports = {
  callOpenAIWithCaching
};

