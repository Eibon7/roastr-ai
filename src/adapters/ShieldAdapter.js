/**
 * ShieldAdapter - Unified interface for platform moderation actions
 * 
 * This abstract class defines the contract that all platform-specific
 * shield adapters must implement. It provides a consistent interface
 * for the Shield system to interact with different social media platforms.
 */

class ModerationInput {
  constructor({
    platform,
    commentId,
    userId,
    username,
    reason,
    orgId,
    metadata = {}
  }) {
    this.platform = platform;
    this.commentId = commentId;
    this.userId = userId;
    this.username = username;
    this.reason = reason;
    this.orgId = orgId;
    this.metadata = metadata;
  }
}

class ModerationResult {
  constructor({
    success,
    action,
    details = {},
    error = null,
    requiresManualReview = false,
    executionTime = 0
  }) {
    this.success = success;
    this.action = action;
    this.details = details;
    this.error = error;
    this.requiresManualReview = requiresManualReview;
    this.executionTime = executionTime;
    this.timestamp = new Date().toISOString();
  }
}

class CapabilityMap {
  constructor({
    hideComment = false,
    reportUser = false,
    blockUser = false,
    unblockUser = false,
    platform = '',
    rateLimits = {},
    scopes = [],
    fallbacks = {}
  }) {
    this.hideComment = hideComment;
    this.reportUser = reportUser;
    this.blockUser = blockUser;
    this.unblockUser = unblockUser;
    this.platform = platform;
    this.rateLimits = rateLimits;
    this.scopes = scopes;
    this.fallbacks = fallbacks;
  }
}

/**
 * Abstract base class for Shield platform adapters
 */
class ShieldAdapter {
  constructor(platform, config = {}) {
    if (this.constructor === ShieldAdapter) {
      throw new Error('ShieldAdapter is abstract and cannot be instantiated directly');
    }
    
    this.platform = platform;
    this.config = config;
    this.client = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the platform client
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclasses');
  }

  /**
   * Hide a specific comment/reply
   * @param {ModerationInput} input - Moderation input parameters
   * @returns {Promise<ModerationResult>}
   */
  async hideComment(input) {
    throw new Error('hideComment() must be implemented by subclasses');
  }

  /**
   * Report a user to the platform
   * @param {ModerationInput} input - Moderation input parameters
   * @returns {Promise<ModerationResult>}
   */
  async reportUser(input) {
    throw new Error('reportUser() must be implemented by subclasses');
  }

  /**
   * Block a user
   * @param {ModerationInput} input - Moderation input parameters
   * @returns {Promise<ModerationResult>}
   */
  async blockUser(input) {
    throw new Error('blockUser() must be implemented by subclasses');
  }

  /**
   * Unblock a previously blocked user
   * @param {ModerationInput} input - Moderation input parameters
   * @returns {Promise<ModerationResult>}
   */
  async unblockUser(input) {
    throw new Error('unblockUser() must be implemented by subclasses');
  }

  /**
   * Get platform capabilities
   * @returns {CapabilityMap}
   */
  capabilities() {
    throw new Error('capabilities() must be implemented by subclasses');
  }

  /**
   * Check if the adapter is properly initialized
   * @returns {boolean}
   */
  isReady() {
    return this.isInitialized && this.client !== null;
  }

  /**
   * Get the platform name
   * @returns {string}
   */
  getPlatform() {
    return this.platform;
  }

  /**
   * Validate input parameters
   * @param {ModerationInput} input 
   * @param {string[]} requiredFields 
   * @throws {Error} If validation fails
   */
  validateInput(input, requiredFields = []) {
    if (input == null || typeof input !== 'object') {
      throw new Error('Input must be an object');
    }
    
    // Check if input is an instance of ModerationInput
    if (!(input instanceof ModerationInput)) {
      throw new Error('Input must be an instance of ModerationInput');
    }
    
    for (const field of requiredFields) {
      if (!(field in input) || input[field] == null || input[field] === '') {
        throw new Error(`Required field '${field}' is missing or empty`);
      }
    }
  }

  /**
   * Create a standardized error result
   * @param {string} action 
   * @param {Error} error 
   * @param {number} executionTime 
   * @returns {ModerationResult}
   */
  createErrorResult(action, error, executionTime = 0) {
    return new ModerationResult({
      success: false,
      action,
      error: error.message,
      executionTime,
      details: {
        platform: this.platform,
        errorType: error.constructor.name,
        stack: error.stack
      }
    });
  }

  /**
   * Create a standardized success result
   * @param {string} action 
   * @param {Object} details 
   * @param {number} executionTime 
   * @param {boolean} requiresManualReview 
   * @returns {ModerationResult}
   */
  createSuccessResult(action, details = {}, executionTime = 0, requiresManualReview = false) {
    return new ModerationResult({
      success: true,
      action,
      details: {
        platform: this.platform,
        ...details
      },
      executionTime,
      requiresManualReview
    });
  }

  /**
   * Handle rate limiting with exponential backoff
   * @param {Function} apiCall 
   * @param {number} maxRetries 
   * @returns {Promise<any>}
   */
  async handleRateLimit(apiCall, maxRetries = 3) {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error;
        if (this.isRateLimitError(error)) {
          const retryAfterMs =
            (error?.response?.headers?.['retry-after']
              ? Number(error.response.headers['retry-after']) * 1000
              : null);
          const base = retryAfterMs ?? Math.min(1000 * (2 ** attempt), 30000);
          const jitter = Math.floor(base * 0.2 * Math.random());
          await new Promise(r => setTimeout(r, base + jitter));
          continue;
        }
        // If it's not a rate limit error, throw immediately
        throw error;
      }
    }
    throw lastError;
  }

  /**
   * Check if an error is related to rate limiting
   * @param {Error} error 
   * @returns {boolean}
   */
  isRateLimitError(error) {
    // Default implementation - should be overridden by specific adapters
    const msg = (error?.message || '').toLowerCase();
    return msg.includes('rate limit') ||
           error?.status === 429 ||
           error?.code === 429 ||
           error?.response?.status === 429;
  }

  /**
   * Log adapter activity
   * @param {string} level 
   * @param {string} message 
   * @param {Object} meta 
   */
  log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logger = this.config?.logger || console;
    logger[level] ? logger[level](
      `[${timestamp}] [${this.platform}] ${message}`, meta
    ) : logger.log(`[${timestamp}] [${this.platform}] ${message}`, meta);
  }
}

module.exports = {
  ShieldAdapter,
  ModerationInput,
  ModerationResult,
  CapabilityMap
};