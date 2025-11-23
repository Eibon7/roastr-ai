/**
 * Retry utility for handling transient failures
 */

const { logger } = require('./logger');

/**
 * Execute a function with retry logic
 * @param {Function} fn - Function to execute
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @param {number} options.backoffFactor - Backoff factor (default: 2)
 * @param {Function} options.shouldRetry - Function to determine if should retry (default: always true)
 * @param {string} options.context - Context for logging
 * @returns {Promise<any>} Result of the function
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    shouldRetry = () => true,
    context = 'Operation'
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const result = await fn();

      if (attempt > 1) {
        logger.info(`${context} succeeded after ${attempt} attempts`);
      }

      return result;
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt > maxRetries || !shouldRetry(error)) {
        logger.error(`${context} failed after ${attempt} attempts:`, error);
        throw error;
      }

      logger.warn(`${context} failed (attempt ${attempt}/${maxRetries + 1}):`, {
        error: error.message,
        nextRetryIn: delay
      });

      // Wait before retrying
      await sleep(delay);

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Default retry predicate for HTTP/network errors
 * @param {Error} error - Error to check
 * @returns {boolean} Whether to retry
 */
function isRetryableError(error) {
  // Handle null/undefined
  if (!error) {
    return false;
  }

  // Network errors
  if (
    error.code === 'ECONNREFUSED' ||
    error.code === 'ETIMEDOUT' ||
    error.code === 'ENOTFOUND' ||
    error.code === 'ECONNRESET'
  ) {
    return true;
  }

  // HTTP status codes that are retryable
  if (error.statusCode) {
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    return retryableStatusCodes.includes(error.statusCode);
  }

  // Stripe-specific errors
  if (error.type === 'StripeConnectionError' || error.type === 'StripeAPIError') {
    return true;
  }

  // Database connection errors
  if (
    error.message &&
    (error.message.includes('connection') ||
      error.message.includes('timeout') ||
      error.message.includes('ECONNREFUSED'))
  ) {
    return true;
  }

  return false;
}

/**
 * Create a retry wrapper for webhook processing
 * @param {Function} handler - Webhook handler function
 * @param {string} eventType - Event type for logging
 * @returns {Function} Wrapped handler with retry logic
 */
function createWebhookRetryHandler(handler, eventType) {
  return async (data) => {
    return withRetry(() => handler(data), {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2,
      shouldRetry: isRetryableError,
      context: `Webhook ${eventType}`
    });
  };
}

/**
 * Batch retry for multiple operations
 * @param {Array<Function>} operations - Array of async functions to execute
 * @param {Object} options - Retry options (same as withRetry)
 * @returns {Promise<Array>} Results of all operations
 */
async function batchRetry(operations, options = {}) {
  const results = await Promise.allSettled(operations.map((op) => withRetry(op, options)));

  const successful = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const failed = results.filter((r) => r.status === 'rejected').map((r) => r.reason);

  if (failed.length > 0) {
    logger.warn(`Batch operation completed with ${failed.length} failures:`, failed);
  }

  return {
    successful,
    failed,
    totalSuccess: successful.length,
    totalFailed: failed.length
  };
}

module.exports = {
  withRetry,
  sleep,
  isRetryableError,
  createWebhookRetryHandler,
  batchRetry
};
