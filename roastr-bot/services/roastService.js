/**
 * Roast Service for Roastr.ai Twitter Bot
 * Handles API calls to the /roast endpoint and manages responses
 */

const axios = require('axios');
const logger = require('../utils/logger');

class RoastService {
  constructor(config = {}) {
    // API configuration
    this.baseUrl = config.baseUrl || process.env.ROAST_API_URL || 'https://roastr-lhcp7seuh-eibon7s-projects.vercel.app';
    this.apiKey = config.apiKey || process.env.ROASTR_API_KEY;
    this.timeout = config.timeout || 15000; // 15 seconds timeout
    this.maxRetries = config.maxRetries || 2;
    
    // Validate configuration
    if (!this.apiKey) {
      logger.error('❌ ROASTR_API_KEY no está configurado');
      throw new Error('ROASTR_API_KEY is required');
    }

    logger.debug('🔥 RoastService inicializado', {
      baseUrl: this.baseUrl,
      timeout: this.timeout,
      maxRetries: this.maxRetries
    });
  }

  /**
   * Generate a roast for the given text
   * @param {string} text - Text to roast
   * @param {object} options - Additional options
   * @returns {Promise<string>} Generated roast
   */
  async generateRoast(text, options = {}) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Text is required for roast generation');
    }

    const cleanText = text.trim();
    logger.debug('🔥 Iniciando generación de roast para:', cleanText.substring(0, 100) + (cleanText.length > 100 ? '...' : ''));

    let lastError = null;

    // Retry logic
    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      try {
        const roast = await this._makeRoastRequest(cleanText, attempt);
        logger.logRoastGenerated(roast);
        return roast;
      } catch (error) {
        lastError = error;
        
        if (attempt <= this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
          logger.warn(`⚠️ Intento ${attempt} falló, reintentando en ${delay}ms...`, {
            error: error.message,
            status: error.response?.status
          });
          await this._sleep(delay);
        }
      }
    }

    // All retries failed
    logger.error('❌ Falló la generación de roast después de todos los intentos', {
      error: lastError.message,
      attempts: this.maxRetries + 1
    });
    throw lastError;
  }

  /**
   * Make the actual HTTP request to the roast API
   * @param {string} text - Text to roast
   * @param {number} attempt - Current attempt number
   * @returns {Promise<string>} Generated roast
   * @private
   */
  async _makeRoastRequest(text, attempt = 1) {
    const url = `${this.baseUrl}/roast`;
    const requestData = { message: text };
    
    logger.logApiRequest('POST', url, requestData);

    try {
      const response = await axios.post(url, requestData, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'User-Agent': 'Roastr-Bot/1.0'
        },
        timeout: this.timeout,
        validateStatus: (status) => status < 500 // Don't throw on 4xx errors
      });

      // Handle different response status codes
      if (response.status === 200 || response.status === 201) {
        const roast = response.data?.roast;
        if (!roast) {
          throw new Error('API response missing roast field');
        }
        return roast;
      } else if (response.status === 400) {
        throw new Error(`Bad request: ${response.data?.error || 'Invalid request'}`);
      } else if (response.status === 401) {
        throw new Error('Unauthorized: Invalid API key');
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded');
      } else {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

    } catch (error) {
      // Handle different types of errors
      if (error.code === 'ECONNABORTED') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error(`Cannot connect to API at ${this.baseUrl}`);
      } else if (error.response) {
        // Server responded with error status
        const status = error.response.status;
        const message = error.response.data?.error || error.response.statusText;
        throw new Error(`API error ${status}: ${message}`);
      } else if (error.request) {
        // Request was made but no response received
        throw new Error('No response received from API');
      } else {
        // Something else happened
        throw error;
      }
    }
  }

  /**
   * Future: Generate roast using CSV endpoint (placeholder for future implementation)
   * This could be used for faster responses or when OpenAI API is unavailable
   * @param {string} text - Text to roast
   * @returns {Promise<string>} Generated roast from CSV
   */
  async generateRoastFromCSV(text) {
    // TODO: Implement CSV-based roast generation
    // This would call the /csv-roast endpoint when it's fully implemented
    // Advantages: Faster response, no API costs, works offline
    // Disadvantages: Limited variety, requires manual curation
    
    const url = `${this.baseUrl}/csv-roast`;
    const requestData = { message: text };
    
    logger.logApiRequest('POST', url, requestData);
    logger.warn('⚠️ CSV roast generation not yet implemented, using mock response');
    
    // For now, return a placeholder
    return `🎯 Roast desde CSV simulado para: "${text.substring(0, 50)}..."`;
  }

  /**
   * Future: Generate roast with specific style/personality
   * This could be used for different client accounts with different roasting styles
   * @param {string} text - Text to roast
   * @param {object} style - Roasting style configuration
   * @returns {Promise<string>} Generated roast with specific style
   */
  async generateStyledRoast(text, style = {}) {
    // TODO: Implement styled roast generation
    // This could include parameters like:
    // - severity: 'mild', 'medium', 'savage'
    // - personality: 'sarcastic', 'witty', 'academic'
    // - language: 'es', 'en', 'auto-detect'
    // - topics: ['tech', 'sports', 'general']
    
    // For multi-account support, different clients could have different default styles
    logger.debug('🎨 Styled roast generation requested', { style, text: text.substring(0, 50) + '...' });
    
    // For now, use the standard roast generation
    return this.generateRoast(text);
  }

  /**
   * Test API connectivity
   * @returns {Promise<boolean>} True if API is accessible
   */
  async testConnection() {
    try {
      logger.debug('🔍 Testing API connection...');
      const testRoast = await this.generateRoast('test connection');
      logger.info('✅ API connection successful');
      return true;
    } catch (error) {
      logger.error('❌ API connection failed:', error.message);
      return false;
    }
  }

  /**
   * Get service configuration (for monitoring/debugging)
   * @returns {object} Service configuration
   */
  getConfig() {
    return {
      baseUrl: this.baseUrl,
      timeout: this.timeout,
      maxRetries: this.maxRetries,
      hasApiKey: !!this.apiKey
    };
  }

  /**
   * Sleep utility for retry delays
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = RoastService;