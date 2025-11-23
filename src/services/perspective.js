/**
 * Perspective API Service for Toxicity Detection
 *
 * Google's Perspective API provides toxicity scoring and category breakdowns
 * for text content. Used for automated moderation and Shield decision engine.
 *
 * API Documentation: https://developers.perspectiveapi.com/s/
 *
 * Related Issues: MVP Validation (Perspective API implementation)
 * Related Nodes: shield.md, roast.md
 */

const axios = require('axios');
const logger = require('../utils/logger');

class PerspectiveService {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.PERSPECTIVE_API_KEY;

    if (!this.apiKey) {
      logger.warn('Perspective API key not provided - service will use fallback');
    }

    this.baseUrl = 'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze';
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second

    // Perspective API rate limits (default: 1 QPS for free tier)
    this.rateLimitDelay = 1000;
    this.lastRequestTime = 0;
  }

  /**
   * Analyze text for toxicity using Perspective API
   *
   * @param {string} text - Text to analyze
   * @param {object} options - Optional configuration
   * @param {string[]} options.languages - Language codes (default: ['en', 'es'])
   * @param {boolean} options.doNotStore - Don't store comment in Perspective (default: true)
   * @returns {Promise<object>} Toxicity analysis result
   */
  async analyzeToxicity(text, options = {}) {
    if (!this.apiKey) {
      throw new Error('Perspective API key not configured');
    }

    // Validate input
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text input for toxicity analysis');
    }

    // Perspective API has a 3000 character limit
    if (text.length > 3000) {
      logger.warn(`Text exceeds 3000 characters (${text.length}), truncating for Perspective API`);
      text = text.substring(0, 3000);
    }

    // Rate limiting
    await this._applyRateLimit();

    const requestBody = {
      comment: { text },
      languages: options.languages || ['en', 'es'],
      doNotStore: options.doNotStore !== undefined ? options.doNotStore : true,
      requestedAttributes: {
        TOXICITY: {},
        SEVERE_TOXICITY: {},
        IDENTITY_ATTACK: {},
        INSULT: {},
        PROFANITY: {},
        THREAT: {}
      }
    };

    try {
      const response = await this._makeRequestWithRetry(requestBody);
      return this._parseResponse(response.data, text);
    } catch (error) {
      logger.error('Perspective API request failed:', {
        error: error.message,
        textLength: text.length,
        statusCode: error.response?.status
      });
      throw error;
    }
  }

  /**
   * Make HTTP request with retry logic
   */
  async _makeRequestWithRetry(requestBody, attempt = 1) {
    try {
      const response = await axios.post(`${this.baseUrl}?key=${this.apiKey}`, requestBody, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });

      return response;
    } catch (error) {
      // Handle specific error cases
      if (error.response) {
        const { status } = error.response;

        // Rate limit error (429) - wait and retry
        if (status === 429 && attempt < this.maxRetries) {
          const backoffDelay = this.retryDelay * Math.pow(2, attempt - 1);
          logger.warn(
            `Perspective API rate limited, retrying in ${backoffDelay}ms (attempt ${attempt}/${this.maxRetries})`
          );
          await this._sleep(backoffDelay);
          return this._makeRequestWithRetry(requestBody, attempt + 1);
        }

        // Bad request (400) - invalid input, don't retry
        if (status === 400) {
          throw new Error(
            `Invalid request to Perspective API: ${error.response.data?.error?.message || 'Unknown error'}`
          );
        }

        // Unauthorized (401/403) - API key issue, don't retry
        if (status === 401 || status === 403) {
          throw new Error('Perspective API authentication failed - check API key');
        }

        // Server errors (500+) - retry
        if (status >= 500 && attempt < this.maxRetries) {
          logger.warn(`Perspective API server error (${status}), retrying in ${this.retryDelay}ms`);
          await this._sleep(this.retryDelay);
          return this._makeRequestWithRetry(requestBody, attempt + 1);
        }
      }

      // Network errors - retry
      if (
        error.code === 'ECONNABORTED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ETIMEDOUT'
      ) {
        if (attempt < this.maxRetries) {
          logger.warn(`Network error (${error.code}), retrying in ${this.retryDelay}ms`);
          await this._sleep(this.retryDelay);
          return this._makeRequestWithRetry(requestBody, attempt + 1);
        }
      }

      // Max retries exceeded or non-retryable error
      throw error;
    }
  }

  /**
   * Parse Perspective API response into standardized format
   */
  _parseResponse(data, originalText) {
    const attributeScores = data.attributeScores;

    // Extract scores (0-1 range)
    const toxicity = attributeScores.TOXICITY?.summaryScore?.value || 0;
    const severeToxicity = attributeScores.SEVERE_TOXICITY?.summaryScore?.value || 0;
    const identityAttack = attributeScores.IDENTITY_ATTACK?.summaryScore?.value || 0;
    const insult = attributeScores.INSULT?.summaryScore?.value || 0;
    const profanity = attributeScores.PROFANITY?.summaryScore?.value || 0;
    const threat = attributeScores.THREAT?.summaryScore?.value || 0;

    // Determine overall severity level
    const severity = this._calculateSeverityLevel(toxicity, severeToxicity, threat);

    // Determine dominant categories (score >= 0.7)
    const categories = [];
    if (threat >= 0.7) categories.push('threat');
    if (severeToxicity >= 0.7) categories.push('severe_toxicity');
    if (identityAttack >= 0.7) categories.push('identity_attack');
    if (insult >= 0.7) categories.push('insult');
    if (profanity >= 0.7) categories.push('profanity');
    if (toxicity >= 0.7 && categories.length === 0) categories.push('toxicity');

    return {
      toxicityScore: toxicity,
      severity,
      categories,
      scores: {
        toxicity,
        severeToxicity,
        identityAttack,
        insult,
        profanity,
        threat
      },
      metadata: {
        textLength: originalText.length,
        timestamp: new Date().toISOString(),
        provider: 'perspective-api'
      }
    };
  }

  /**
   * Calculate severity level based on scores
   */
  _calculateSeverityLevel(toxicity, severeToxicity, threat) {
    // Critical: Severe toxicity or threat >= 0.95
    if (severeToxicity >= 0.95 || threat >= 0.95) {
      return 'critical';
    }

    // High: Any critical category >= 0.85
    if (toxicity >= 0.85 || severeToxicity >= 0.85 || threat >= 0.85) {
      return 'high';
    }

    // Medium: Toxicity >= 0.6
    if (toxicity >= 0.6) {
      return 'medium';
    }

    // Low: Toxicity >= 0.4
    if (toxicity >= 0.4) {
      return 'low';
    }

    // Clean: Toxicity < 0.4
    return 'clean';
  }

  /**
   * Apply rate limiting to prevent API quota exhaustion
   */
  async _applyRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      await this._sleep(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Sleep utility for retry/rate limiting
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Health check - verify API key is valid
   */
  async healthCheck() {
    if (!this.apiKey) {
      return { healthy: false, error: 'API key not configured' };
    }

    try {
      // Test with a simple benign text
      await this.analyzeToxicity('Hello world', { doNotStore: true });
      return { healthy: true, message: 'Perspective API operational' };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        suggestion: error.message.includes('authentication')
          ? 'Check PERSPECTIVE_API_KEY environment variable'
          : 'Check network connectivity or API status'
      };
    }
  }
}

module.exports = PerspectiveService;
