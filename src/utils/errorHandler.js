/**
 * Enhanced Error Handler - Consistent error handling across workers
 *
 * Provides standardized error handling, retry logic, and fallback mechanisms
 * to improve system resilience and user experience.
 */

const { ValidationError } = require('./jobValidator');

class WorkerError extends Error {
  constructor(message, type = 'WORKER_ERROR', retryable = false, context = {}) {
    super(message);
    this.name = 'WorkerError';
    this.type = type;
    this.retryable = retryable;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

class WorkerErrorHandler {
  constructor(logger = console) {
    this.logger = this.createLoggerAdapter(logger);
    this.retryDelays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff
  }

  /**
   * Create a logger adapter to handle different logging interfaces
   */
  createLoggerAdapter(logger) {
    const adapter = {};

    // Map common logging methods
    adapter.info = logger.info?.bind(logger) || logger.log?.bind(logger) || (() => {});
    adapter.warn = logger.warn?.bind(logger) || logger.log?.bind(logger) || (() => {});
    adapter.error = logger.error?.bind(logger) || logger.log?.bind(logger) || (() => {});
    adapter.debug = logger.debug?.bind(logger) || logger.log?.bind(logger) || (() => {});

    // Handle worker-style log method (that takes level as first argument)
    if (typeof logger.log === 'function' && !logger.info && !logger.warn && !logger.error) {
      adapter.info = (message, meta = {}) => logger.log('info', message, meta);
      adapter.warn = (message, meta = {}) => logger.log('warn', message, meta);
      adapter.error = (message, meta = {}) => logger.log('error', message, meta);
      adapter.debug = (message, meta = {}) => logger.log('debug', message, meta);
    }

    return adapter;
  }

  /**
   * Execute operation with fallback mechanism
   */
  async handleWithFallback(operation, fallback, context = {}) {
    try {
      return await operation();
    } catch (error) {
      this.logger.warn('Operation failed, using fallback', {
        error: error.message,
        context,
        stack: error.stack
      });

      if (fallback) {
        try {
          return await fallback();
        } catch (fallbackError) {
          this.logger.error('Fallback also failed', {
            originalError: error.message,
            fallbackError: fallbackError.message,
            context
          });
          throw new WorkerError(
            `Both operation and fallback failed: ${error.message}`,
            'FALLBACK_FAILED',
            false,
            { originalError: error.message, fallbackError: fallbackError.message }
          );
        }
      }

      throw error;
    }
  }

  /**
   * Execute operation with retry logic
   */
  async handleWithRetry(operation, maxRetries = 3, context = {}) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry validation errors or non-retryable errors
        if (
          error instanceof ValidationError ||
          (error instanceof WorkerError && !error.retryable)
        ) {
          throw error;
        }

        if (attempt < maxRetries) {
          const delay = this.retryDelays[attempt] || this.retryDelays[this.retryDelays.length - 1];

          this.logger.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms`, {
            error: error.message,
            attempt: attempt + 1,
            maxRetries,
            context
          });

          await this.sleep(delay);
        }
      }
    }

    throw new WorkerError(
      `Operation failed after ${maxRetries + 1} attempts: ${lastError.message}`,
      'MAX_RETRIES_EXCEEDED',
      false,
      { attempts: maxRetries + 1, lastError: lastError.message }
    );
  }

  /**
   * Execute operation with timeout
   */
  async handleWithTimeout(operation, timeoutMs = 30000, context = {}) {
    return Promise.race([
      operation(),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new WorkerError(`Operation timed out after ${timeoutMs}ms`, 'TIMEOUT', true, {
              timeoutMs,
              context
            })
          );
        }, timeoutMs);
      })
    ]);
  }

  /**
   * Comprehensive error handling with retry, timeout, and fallback
   */
  async handleRobust(operation, options = {}) {
    const { fallback = null, maxRetries = 3, timeoutMs = 30000, context = {} } = options;

    const wrappedOperation = () => this.handleWithTimeout(operation, timeoutMs, context);

    if (fallback) {
      return this.handleWithFallback(
        () => this.handleWithRetry(wrappedOperation, maxRetries, context),
        fallback,
        context
      );
    } else {
      return this.handleWithRetry(wrappedOperation, maxRetries, context);
    }
  }

  /**
   * Handle database operations with specific error handling
   */
  async handleDatabaseOperation(operation, context = {}) {
    try {
      const result = await operation();

      if (result?.error) {
        throw new WorkerError(`Database error: ${result.error.message}`, 'DATABASE_ERROR', true, {
          code: result.error.code,
          details: result.error.details
        });
      }

      return result;
    } catch (error) {
      if (error instanceof WorkerError) {
        throw error;
      }

      // Handle common database errors
      if (error.message?.includes('connection')) {
        throw new WorkerError('Database connection failed', 'DATABASE_CONNECTION_ERROR', true, {
          originalError: error.message
        });
      }

      if (error.message?.includes('timeout')) {
        throw new WorkerError('Database operation timed out', 'DATABASE_TIMEOUT', true, {
          originalError: error.message
        });
      }

      throw new WorkerError(`Database operation failed: ${error.message}`, 'DATABASE_ERROR', true, {
        originalError: error.message
      });
    }
  }

  /**
   * Handle API operations with rate limiting awareness
   */
  async handleAPIOperation(operation, apiName, context = {}) {
    try {
      return await operation();
    } catch (error) {
      // Handle rate limiting
      if (error.status === 429 || error.message?.includes('rate limit')) {
        const retryAfter = error.headers?.['retry-after'] || 60;
        throw new WorkerError(
          `${apiName} API rate limit exceeded. Retry after ${retryAfter} seconds`,
          'RATE_LIMIT_EXCEEDED',
          true,
          { apiName, retryAfter, originalError: error.message }
        );
      }

      // Handle authentication errors
      if (error.status === 401 || error.status === 403) {
        throw new WorkerError(`${apiName} API authentication failed`, 'API_AUTH_ERROR', false, {
          apiName,
          status: error.status,
          originalError: error.message
        });
      }

      // Handle server errors
      if (error.status >= 500) {
        throw new WorkerError(`${apiName} API server error`, 'API_SERVER_ERROR', true, {
          apiName,
          status: error.status,
          originalError: error.message
        });
      }

      throw new WorkerError(`${apiName} API error: ${error.message}`, 'API_ERROR', false, {
        apiName,
        status: error.status,
        originalError: error.message
      });
    }
  }

  /**
   * Create standardized error response for workers
   */
  createErrorResponse(error, jobId = null, additionalContext = {}) {
    const baseResponse = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      jobId
    };

    if (error instanceof WorkerError) {
      return {
        ...baseResponse,
        type: error.type,
        retryable: error.retryable,
        context: { ...error.context, ...additionalContext }
      };
    }

    if (error instanceof ValidationError) {
      return {
        ...baseResponse,
        type: 'VALIDATION_ERROR',
        field: error.field,
        retryable: false
      };
    }

    return {
      ...baseResponse,
      type: 'UNKNOWN_ERROR',
      retryable: false,
      context: additionalContext
    };
  }

  /**
   * Log error with appropriate level
   */
  logError(error, context = {}) {
    const logData = {
      message: error.message,
      type: error.type || 'UNKNOWN',
      context,
      stack: error.stack
    };

    if (error instanceof WorkerError) {
      if (error.retryable) {
        this.logger.warn('Retryable worker error', logData);
      } else {
        this.logger.error('Non-retryable worker error', logData);
      }
    } else if (error instanceof ValidationError) {
      this.logger.warn('Validation error', logData);
    } else {
      this.logger.error('Unexpected error', logData);
    }
  }

  /**
   * Sleep utility for retry delays
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = {
  WorkerErrorHandler,
  WorkerError
};
