/**
 * Logger utility for Roastr.ai Twitter Bot
 * Handles debug, info, and error logging based on DEBUG environment variable
 */

class Logger {
  constructor() {
    this.isDebugMode = process.env.DEBUG === 'true';
  }

  /**
   * Log debug messages (only if DEBUG=true)
   * @param {string} message - Debug message
   * @param {...any} args - Additional arguments
   */
  debug(message, ...args) {
    if (this.isDebugMode) {
      const timestamp = new Date().toISOString();
      console.log(`[DEBUG] ${timestamp}: ${message}`, ...args);
    }
  }

  /**
   * Log info messages (always shown)
   * @param {string} message - Info message
   * @param {...any} args - Additional arguments
   */
  info(message, ...args) {
    const timestamp = new Date().toISOString();
    console.log(`[INFO] ${timestamp}: ${message}`, ...args);
  }

  /**
   * Log error messages (always shown)
   * @param {string} message - Error message
   * @param {...any} args - Additional arguments
   */
  error(message, ...args) {
    const timestamp = new Date().toISOString();
    console.error(`[ERROR] ${timestamp}: ${message}`, ...args);
  }

  /**
   * Log warning messages (always shown)
   * @param {string} message - Warning message
   * @param {...any} args - Additional arguments
   */
  warn(message, ...args) {
    const timestamp = new Date().toISOString();
    console.warn(`[WARN] ${timestamp}: ${message}`, ...args);
  }

  /**
   * Log mention received (debug mode)
   * @param {object} mention - Twitter mention object
   */
  logMentionReceived(mention) {
    this.debug('📨 Nueva mención recibida:', {
      id: mention.id,
      author: mention.author_id,
      text: mention.text?.substring(0, 100) + (mention.text?.length > 100 ? '...' : ''),
      created_at: mention.created_at
    });
  }

  /**
   * Log API request (debug mode)
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {object} data - Request data
   */
  logApiRequest(method, url, data = null) {
    this.debug(`📡 ${method} ${url}`, data ? { data } : '');
  }

  /**
   * Log roast generation (debug mode)
   * @param {string} roast - Generated roast
   */
  logRoastGenerated(roast) {
    this.debug('🔥 Roast generado:', roast);
  }

  /**
   * Log tweet response (debug mode)
   * @param {string} tweetId - Original tweet ID
   * @param {string} responseId - Response tweet ID
   */
  logTweetResponse(tweetId, responseId) {
    this.debug(`💬 Respondido al tweet ${tweetId} con tweet ${responseId}`);
  }

  /**
   * Check if debug mode is enabled
   * @returns {boolean} True if debug mode is enabled
   */
  isDebug() {
    return this.isDebugMode;
  }
}

// Export singleton instance
module.exports = new Logger();
