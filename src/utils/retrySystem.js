/**
 * Robust Retry System with Exponential Backoff
 * Handles API failures, token expiration, and network issues
 */

const { logger } = require('./logger');

/**
 * Error types that should trigger retries
 */
const RETRYABLE_ERRORS = {
  // HTTP Status Codes
  429: 'Rate limit exceeded',
  500: 'Internal server error',
  502: 'Bad gateway',
  503: 'Service unavailable',
  504: 'Gateway timeout',
  
  // OAuth/Token errors
  'TOKEN_EXPIRED': 'Access token expired',
  'INVALID_TOKEN': 'Invalid access token',
  'TOKEN_REVOKED': 'Token revoked',
  
  // Network errors
  'ECONNRESET': 'Connection reset',
  'ECONNREFUSED': 'Connection refused',
  'ETIMEDOUT': 'Connection timed out',
  'ENOTFOUND': 'DNS lookup failed',
  'ECONNABORTED': 'Connection aborted'
};

/**
 * Error types that should NOT trigger retries
 */
const NON_RETRYABLE_ERRORS = {
  400: 'Bad request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not found',
  409: 'Conflict',
  422: 'Unprocessable entity'
};

/**
 * Retry configuration for different operation types
 */
const RETRY_CONFIGS = {
  oauth: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    jitter: true
  },
  api_call: {
    maxRetries: 5,
    baseDelay: 2000,
    maxDelay: 60000,
    backoffFactor: 2,
    jitter: true
  },
  webhook: {
    maxRetries: 3,
    baseDelay: 500,
    maxDelay: 15000,
    backoffFactor: 1.5,
    jitter: true
  },
  token_refresh: {
    maxRetries: 2,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
    jitter: false
  }
};

/**
 * Retry System Class
 */
class RetrySystem {
  constructor(operationType = 'api_call') {
    this.config = RETRY_CONFIGS[operationType] || RETRY_CONFIGS.api_call;
    this.operationType = operationType;
  }

  /**
   * Execute operation with retry logic
   * @param {Function} operation - Async function to execute
   * @param {Object} context - Context object for logging
   * @returns {Promise} Operation result
   */
  async execute(operation, context = {}) {
    let lastError;
    let attempt = 0;

    while (attempt < this.config.maxRetries) {
      try {
        const result = await operation();
        
        if (attempt > 0) {
          logger.info(`Operation succeeded after ${attempt} retries`, {
            operationType: this.operationType,
            attempts: attempt + 1,
            context
          });
        }

        return result;

      } catch (error) {
        lastError = error;
        attempt++;

        const shouldRetry = this.shouldRetry(error, attempt);
        
        if (!shouldRetry || attempt >= this.config.maxRetries) {
          logger.error(`Operation failed after ${attempt} attempts`, {
            operationType: this.operationType,
            error: error.message,
            attempts: attempt,
            context,
            finalError: true
          });
          throw error;
        }

        const delay = this.calculateDelay(attempt);
        
        logger.warn(`Operation failed, retrying in ${delay}ms`, {
          operationType: this.operationType,
          error: error.message,
          attempt: attempt,
          maxRetries: this.config.maxRetries,
          delay,
          context
        });

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Execute operation with token refresh capability
   * @param {Function} operation - Async function to execute
   * @param {Function} tokenRefreshFn - Function to refresh tokens
   * @param {Object} context - Context object for logging
   * @returns {Promise} Operation result
   */
  async executeWithTokenRefresh(operation, tokenRefreshFn, context = {}) {
    let tokenRefreshed = false;

    const wrappedOperation = async () => {
      try {
        return await operation();
      } catch (error) {
        // Handle token expiration
        if (this.isTokenError(error) && !tokenRefreshed && tokenRefreshFn) {
          logger.info('Token expired, attempting refresh', {
            operationType: this.operationType,
            context
          });

          try {
            await tokenRefreshFn();
            tokenRefreshed = true;
            
            logger.info('Token refresh successful, retrying operation', {
              operationType: this.operationType,
              context
            });

            // Retry the operation with new token
            return await operation();

          } catch (refreshError) {
            logger.error('Token refresh failed', {
              operationType: this.operationType,
              error: refreshError.message,
              context
            });
            throw refreshError;
          }
        }

        throw error;
      }
    };

    return await this.execute(wrappedOperation, context);
  }

  /**
   * Check if error should trigger a retry
   * @param {Error} error - Error to check
   * @param {number} attempt - Current attempt number
   * @returns {boolean} Whether to retry
   */
  shouldRetry(error, attempt) {
    // Don't retry if we've exceeded max attempts
    if (attempt >= this.config.maxRetries) {
      return false;
    }

    // Check HTTP status codes
    if (error.status || error.response?.status) {
      const status = error.status || error.response.status;
      
      // Never retry these status codes
      if (NON_RETRYABLE_ERRORS[status]) {
        return false;
      }

      // Always retry these status codes
      if (RETRYABLE_ERRORS[status]) {
        return true;
      }
    }

    // Check error codes
    if (error.code && RETRYABLE_ERRORS[error.code]) {
      return true;
    }

    // Check error message patterns
    const message = error.message?.toLowerCase() || '';
    
    // Network-related errors
    if (message.includes('timeout') || 
        message.includes('reset') || 
        message.includes('refused') ||
        message.includes('aborted') ||
        message.includes('network')) {
      return true;
    }

    // OAuth-related errors (excluding permanent failures)
    if (message.includes('token expired') || 
        message.includes('invalid_token') ||
        message.includes('token_revoked')) {
      return true;
    }

    // Rate limiting
    if (message.includes('rate limit') || 
        message.includes('too many requests')) {
      return true;
    }

    // Default: don't retry unknown errors
    return false;
  }

  /**
   * Check if error is token-related
   * @param {Error} error - Error to check
   * @returns {boolean} Whether error is token-related
   */
  isTokenError(error) {
    const status = error.status || error.response?.status;
    if (status === 401) return true;

    const message = error.message?.toLowerCase() || '';
    return message.includes('token expired') || 
           message.includes('invalid token') ||
           message.includes('unauthorized') ||
           message.includes('token_revoked');
  }

  /**
   * Calculate delay for next retry using exponential backoff
   * @param {number} attempt - Current attempt number (1-based)
   * @returns {number} Delay in milliseconds
   */
  calculateDelay(attempt) {
    let delay = this.config.baseDelay * Math.pow(this.config.backoffFactor, attempt - 1);
    
    // Cap at maximum delay
    delay = Math.min(delay, this.config.maxDelay);
    
    // Add jitter to avoid thundering herd
    if (this.config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.round(delay);
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a retry wrapper for a specific function
   * @param {Function} fn - Function to wrap
   * @param {Object} options - Retry options
   * @returns {Function} Wrapped function with retry logic
   */
  static wrap(fn, options = {}) {
    const operationType = options.operationType || 'api_call';
    const retrySystem = new RetrySystem(operationType);
    
    return async function(...args) {
      const context = options.context || { 
        function: fn.name, 
        args: args.length 
      };

      if (options.tokenRefreshFn) {
        return await retrySystem.executeWithTokenRefresh(
          () => fn.apply(this, args),
          options.tokenRefreshFn,
          context
        );
      } else {
        return await retrySystem.execute(
          () => fn.apply(this, args),
          context
        );
      }
    };
  }

  /**
   * Create retry system for OAuth operations
   * @returns {RetrySystem} OAuth retry system
   */
  static forOAuth() {
    return new RetrySystem('oauth');
  }

  /**
   * Create retry system for API calls
   * @returns {RetrySystem} API call retry system
   */
  static forAPICall() {
    return new RetrySystem('api_call');
  }

  /**
   * Create retry system for webhook processing
   * @returns {RetrySystem} Webhook retry system
   */
  static forWebhook() {
    return new RetrySystem('webhook');
  }

  /**
   * Create retry system for token refresh operations
   * @returns {RetrySystem} Token refresh retry system
   */
  static forTokenRefresh() {
    return new RetrySystem('token_refresh');
  }
}

module.exports = {
  RetrySystem,
  RETRYABLE_ERRORS,
  NON_RETRYABLE_ERRORS,
  RETRY_CONFIGS
};