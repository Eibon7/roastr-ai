/**
 * Centralized Logger Utility for Frontend
 *
 * Provides structured logging with different log levels and optional context
 * Follows best practices for frontend logging:
 * - Structured logging with context
 * - Environment-aware (reduced logging in production)
 * - Support for different log levels
 * - Safe error handling
 *
 * Issue #1080: CodeRabbit suggestion - Replace console.log/error with centralized logger
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// Get log level from environment or default to INFO
const getLogLevel = () => {
  if (process.env.NODE_ENV === 'production') {
    return LOG_LEVELS.WARN; // Only warnings and errors in production
  }
  return LOG_LEVELS.DEBUG; // All logs in development
};

const currentLogLevel = getLogLevel();

/**
 * Format log message with context
 * @param {string} level - Log level (debug, info, warn, error)
 * @param {string} message - Main log message
 * @param {Object} context - Additional context data
 * @returns {string} Formatted log message
 */
const formatMessage = (level, message, context = {}) => {
  const timestamp = new Date().toISOString();
  const contextStr = Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
};

/**
 * Centralized Logger Class
 */
class Logger {
  /**
   * Log debug message (only in development)
   * @param {string} message - Log message
   * @param {Object} context - Optional context data
   */
  debug(message, context = {}) {
    if (currentLogLevel <= LOG_LEVELS.DEBUG) {
      console.debug(formatMessage('debug', message, context), context);
    }
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {Object} context - Optional context data
   */
  info(message, context = {}) {
    if (currentLogLevel <= LOG_LEVELS.INFO) {
      console.info(formatMessage('info', message, context), context);
    }
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {Object} context - Optional context data
   */
  warn(message, context = {}) {
    if (currentLogLevel <= LOG_LEVELS.WARN) {
      console.warn(formatMessage('warn', message, context), context);
    }
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {Error|Object} error - Error object or context data
   * @param {Object} context - Optional additional context
   */
  error(message, error = {}, context = {}) {
    if (currentLogLevel <= LOG_LEVELS.ERROR) {
      const errorContext =
        error instanceof Error
          ? {
              error: {
                message: error.message,
                stack: error.stack,
                name: error.name
              },
              ...context
            }
          : { error, ...context };

      console.error(formatMessage('error', message, errorContext), errorContext);
    }
  }

  /**
   * Log with custom level (for extensibility)
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} context - Optional context data
   */
  log(level, message, context = {}) {
    const levelUpper = level.toUpperCase();
    if (currentLogLevel <= LOG_LEVELS[levelUpper] || LOG_LEVELS[levelUpper] === undefined) {
      const logMethod = console[level] || console.log;
      logMethod(formatMessage(level, message, context), context);
    }
  }
}

// Export singleton instance
const logger = new Logger();
export default logger;
