/**
 * Stripe Wrapper with Retry Logic & Rate Limiting
 *
 * This wrapper provides:
 * - Automatic retry with exponential backoff (3 attempts: 500ms → 1000ms → 2000ms)
 * - Differentiated logging for 4xx, 5xx, and 429 errors
 * - Protection against traffic spikes and transient failures
 * - Observability with comprehensive logging
 *
 * Implements requirements from Issue #112
 */

const Stripe = require('stripe');
const { logger } = require('../utils/logger');

class StripeWrapper {
  constructor(secretKey) {
    if (!secretKey) {
      throw new Error('Stripe secret key is required');
    }

    this.stripe = Stripe(secretKey);
    this.maxRetries = 3;
    this.baseDelay = 500; // 500ms initial delay
    this.maxDelay = 2000; // 2s max delay
  }

  /**
   * Calculate exponential backoff delay
   * @param {number} attempt - Current attempt number (0-based)
   * @returns {number} Delay in milliseconds
   */
  calculateRetryDelay(attempt) {
    const delay = this.baseDelay * Math.pow(2, attempt);
    return Math.min(delay, this.maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   */
  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log error with differentiated handling based on status code
   * @param {Error} error - The error object
   * @param {string} operation - The operation being attempted
   * @param {number} attempt - Current attempt number
   * @param {Object} context - Additional context for logging
   */
  logError(error, operation, attempt, context = {}) {
    const baseLog = {
      operation,
      attempt: attempt + 1,
      maxRetries: this.maxRetries,
      context,
      errorMessage: error.message,
      errorType: error.type || 'unknown'
    };

    if (error.statusCode) {
      baseLog.statusCode = error.statusCode;

      if (error.statusCode === 429) {
        // Rate limiting error
        logger.warn('🚦 Stripe rate limit hit - will retry with backoff', {
          ...baseLog,
          rateLimitType: 'stripe_api_limit',
          nextRetryIn: attempt < this.maxRetries - 1 ? this.calculateRetryDelay(attempt) : 'none'
        });
      } else if (error.statusCode >= 400 && error.statusCode < 500) {
        // Client errors (4xx) - typically won't be resolved by retry
        logger.error('❌ Stripe client error (4xx) - check request validity', {
          ...baseLog,
          errorCategory: 'client_error',
          retryRecommended: false,
          stripeCode: error.code,
          stripeParam: error.param
        });
      } else if (error.statusCode >= 500) {
        // Server errors (5xx) - may be resolved by retry
        logger.error('⚠️ Stripe server error (5xx) - transient issue possible', {
          ...baseLog,
          errorCategory: 'server_error',
          retryRecommended: true,
          nextRetryIn: attempt < this.maxRetries - 1 ? this.calculateRetryDelay(attempt) : 'none'
        });
      }
    } else {
      // Network or other errors
      logger.error('🔌 Stripe request failed - network or connection issue', {
        ...baseLog,
        errorCategory: 'network_error',
        retryRecommended: true
      });
    }
  }

  /**
   * Execute a Stripe operation with retry logic
   * @param {Function} operation - Async function that returns a Stripe API call
   * @param {string} operationName - Name of the operation for logging
   * @param {Object} context - Additional context for logging
   * @returns {Promise} Result of the Stripe operation
   */
  async safeRequest(operation, operationName, context = {}) {
    let lastError;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        logger.debug(`🔄 Attempting Stripe ${operationName}`, {
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          context
        });

        const result = await operation();

        if (attempt > 0) {
          logger.info(`✅ Stripe ${operationName} succeeded after retries`, {
            attempt: attempt + 1,
            context
          });
        } else {
          logger.debug(`✅ Stripe ${operationName} succeeded on first try`, {
            context
          });
        }

        return result;
      } catch (error) {
        lastError = error;
        this.logError(error, operationName, attempt, context);

        // Don't retry for 4xx errors (except 429 rate limit)
        if (
          error.statusCode &&
          error.statusCode >= 400 &&
          error.statusCode < 500 &&
          error.statusCode !== 429
        ) {
          logger.error(`❌ Stripe ${operationName} failed with client error - not retrying`, {
            statusCode: error.statusCode,
            errorCode: error.code,
            attempt: attempt + 1,
            context
          });
          throw error;
        }

        // If this was the last attempt, don't wait
        if (attempt === this.maxRetries - 1) {
          break;
        }

        // Calculate and apply exponential backoff
        const retryDelay = this.calculateRetryDelay(attempt);
        logger.info(`⏱️ Retrying Stripe ${operationName} in ${retryDelay}ms`, {
          attempt: attempt + 1,
          nextAttempt: attempt + 2,
          delay: retryDelay,
          context
        });

        await this.sleep(retryDelay);
      }
    }

    // All retries exhausted
    logger.error(`💥 Stripe ${operationName} failed after ${this.maxRetries} attempts`, {
      finalError: lastError.message,
      finalStatusCode: lastError.statusCode,
      context
    });

    throw lastError;
  }

  /**
   * Retry-enabled wrapper for Stripe customer operations
   */
  get customers() {
    return {
      create: (params) =>
        this.safeRequest(() => this.stripe.customers.create(params), 'customers.create', {
          email: params?.email,
          metadata: params?.metadata
        }),

      retrieve: (customerId, params = {}) =>
        this.safeRequest(
          () => this.stripe.customers.retrieve(customerId, params),
          'customers.retrieve',
          { customerId, expand: params.expand }
        ),

      update: (customerId, params) =>
        this.safeRequest(
          () => this.stripe.customers.update(customerId, params),
          'customers.update',
          { customerId, updateFields: Object.keys(params) }
        ),

      list: (params = {}) =>
        this.safeRequest(() => this.stripe.customers.list(params), 'customers.list', {
          limit: params.limit,
          email: params.email
        })
    };
  }

  /**
   * Retry-enabled wrapper for Stripe subscription operations
   */
  get subscriptions() {
    return {
      create: (params) =>
        this.safeRequest(() => this.stripe.subscriptions.create(params), 'subscriptions.create', {
          customer: params?.customer,
          items: params?.items?.length
        }),

      retrieve: (subscriptionId, params = {}) =>
        this.safeRequest(
          () => this.stripe.subscriptions.retrieve(subscriptionId, params),
          'subscriptions.retrieve',
          { subscriptionId, expand: params.expand }
        ),

      update: (subscriptionId, params) =>
        this.safeRequest(
          () => this.stripe.subscriptions.update(subscriptionId, params),
          'subscriptions.update',
          { subscriptionId, updateFields: Object.keys(params) }
        ),

      list: (params = {}) =>
        this.safeRequest(() => this.stripe.subscriptions.list(params), 'subscriptions.list', {
          customer: params.customer,
          limit: params.limit
        }),

      cancel: (subscriptionId, params = {}) =>
        this.safeRequest(
          () => this.stripe.subscriptions.cancel(subscriptionId, params),
          'subscriptions.cancel',
          { subscriptionId, cancelImmediately: params.cancel_immediately }
        )
    };
  }

  /**
   * Retry-enabled wrapper for Stripe price operations
   */
  get prices() {
    return {
      list: (params = {}) =>
        this.safeRequest(() => this.stripe.prices.list(params), 'prices.list', {
          lookup_keys: params.lookup_keys,
          limit: params.limit
        }),

      retrieve: (priceId, params = {}) =>
        this.safeRequest(() => this.stripe.prices.retrieve(priceId, params), 'prices.retrieve', {
          priceId,
          expand: params.expand
        })
    };
  }

  /**
   * Retry-enabled wrapper for Stripe checkout operations
   */
  get checkout() {
    return {
      sessions: {
        create: (params) =>
          this.safeRequest(
            () => this.stripe.checkout.sessions.create(params),
            'checkout.sessions.create',
            {
              customer: params?.customer,
              mode: params?.mode,
              line_items: params?.line_items?.length
            }
          ),

        retrieve: (sessionId, params = {}) =>
          this.safeRequest(
            () => this.stripe.checkout.sessions.retrieve(sessionId, params),
            'checkout.sessions.retrieve',
            { sessionId, expand: params.expand }
          )
      }
    };
  }

  /**
   * Retry-enabled wrapper for Stripe billing portal operations
   */
  get billingPortal() {
    return {
      sessions: {
        create: (params) =>
          this.safeRequest(
            () => this.stripe.billingPortal.sessions.create(params),
            'billingPortal.sessions.create',
            { customer: params?.customer, return_url: params?.return_url }
          )
      }
    };
  }

  /**
   * Retry-enabled wrapper for Stripe webhook operations
   * Note: Webhooks typically shouldn't be retried, but validation can be
   */
  get webhooks() {
    return {
      constructEvent: (payload, signature, secret) => {
        // Webhook signature verification - no retry needed
        try {
          const event = this.stripe.webhooks.constructEvent(payload, signature, secret);
          logger.debug('✅ Webhook signature verified successfully', {
            eventType: event.type,
            eventId: event.id
          });
          return event;
        } catch (error) {
          logger.error('❌ Webhook signature verification failed', {
            error: error.message,
            hasPayload: !!payload,
            hasSignature: !!signature,
            hasSecret: !!secret
          });
          throw error;
        }
      }
    };
  }

  /**
   * Generic retry wrapper for any Stripe operation not covered above
   * @param {Function} operation - The Stripe operation to execute
   * @param {string} operationName - Name for logging
   * @param {Object} context - Context for logging
   * @returns {Promise} Result of the operation
   */
  async retryRequest(operation, operationName, context = {}) {
    return this.safeRequest(operation, operationName, context);
  }

  /**
   * Get the underlying Stripe instance for operations not wrapped
   * Use with caution - no retry logic applied
   */
  get raw() {
    logger.warn('⚠️ Using raw Stripe instance - no retry protection', {
      caller: new Error().stack.split('\n')[2]?.trim()
    });
    return this.stripe;
  }
}

module.exports = StripeWrapper;
