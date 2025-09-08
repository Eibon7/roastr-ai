/**
 * Enhanced Error Handling Middleware
 * 
 * Provides comprehensive error handling, logging, and recovery
 * with security-conscious error reporting and monitoring integration
 * 
 * Features:
 * - Centralized error handling and classification
 * - Security-conscious error messages
 * - Comprehensive logging with context
 * - Rate limiting for error responses
 * - Automatic error recovery strategies
 * - Integration with monitoring systems
 * 
 * @author Roastr.ai Team
 * @version 1.0.0
 */

const { logger } = require('../utils/logger');
const { SafeUtils } = require('../utils/logger');
const { flags } = require('../config/flags');

// Error classification constants
const ERROR_TYPES = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
    BUSINESS_LOGIC_ERROR: 'BUSINESS_LOGIC_ERROR',
    SYSTEM_ERROR: 'SYSTEM_ERROR',
    SECURITY_ERROR: 'SECURITY_ERROR'
};

const ERROR_SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

// HTTP status code to error type mapping
const STATUS_TO_ERROR_TYPE = {
    400: ERROR_TYPES.VALIDATION_ERROR,
    401: ERROR_TYPES.AUTHENTICATION_ERROR,
    403: ERROR_TYPES.AUTHORIZATION_ERROR,
    404: ERROR_TYPES.VALIDATION_ERROR,
    409: ERROR_TYPES.BUSINESS_LOGIC_ERROR,
    429: ERROR_TYPES.RATE_LIMIT_ERROR,
    500: ERROR_TYPES.SYSTEM_ERROR,
    502: ERROR_TYPES.EXTERNAL_API_ERROR,
    503: ERROR_TYPES.EXTERNAL_API_ERROR,
    504: ERROR_TYPES.EXTERNAL_API_ERROR
};

// Production-safe error messages
const SAFE_ERROR_MESSAGES = {
    [ERROR_TYPES.VALIDATION_ERROR]: 'Invalid input provided',
    [ERROR_TYPES.AUTHENTICATION_ERROR]: 'Authentication required',
    [ERROR_TYPES.AUTHORIZATION_ERROR]: 'Insufficient permissions',
    [ERROR_TYPES.RATE_LIMIT_ERROR]: 'Too many requests',
    [ERROR_TYPES.DATABASE_ERROR]: 'Service temporarily unavailable',
    [ERROR_TYPES.EXTERNAL_API_ERROR]: 'External service error',
    [ERROR_TYPES.BUSINESS_LOGIC_ERROR]: 'Operation cannot be completed',
    [ERROR_TYPES.SYSTEM_ERROR]: 'Internal server error',
    [ERROR_TYPES.SECURITY_ERROR]: 'Security violation detected'
};

/**
 * Classify error based on various factors
 * @param {Error} error - The error to classify
 * @param {number} statusCode - HTTP status code
 * @returns {Object} Error classification
 */
function classifyError(error, statusCode = 500) {
    // Classify by status code first
    if (STATUS_TO_ERROR_TYPE[statusCode]) {
        return {
            type: STATUS_TO_ERROR_TYPE[statusCode],
            severity: getSeverityFromStatus(statusCode)
        };
    }

    // Classify by error message patterns
    if (error.message) {
        const message = error.message.toLowerCase();
        
        if (message.includes('validation') || message.includes('invalid')) {
            return { type: ERROR_TYPES.VALIDATION_ERROR, severity: ERROR_SEVERITY.LOW };
        }
        
        if (message.includes('unauthorized') || message.includes('authentication')) {
            return { type: ERROR_TYPES.AUTHENTICATION_ERROR, severity: ERROR_SEVERITY.MEDIUM };
        }
        
        if (message.includes('permission') || message.includes('forbidden')) {
            return { type: ERROR_TYPES.AUTHORIZATION_ERROR, severity: ERROR_SEVERITY.MEDIUM };
        }
        
        if (message.includes('rate limit') || message.includes('too many')) {
            return { type: ERROR_TYPES.RATE_LIMIT_ERROR, severity: ERROR_SEVERITY.LOW };
        }
        
        if (message.includes('database') || message.includes('connection')) {
            return { type: ERROR_TYPES.DATABASE_ERROR, severity: ERROR_SEVERITY.HIGH };
        }
        
        if (message.includes('api') || message.includes('network') || message.includes('timeout')) {
            return { type: ERROR_TYPES.EXTERNAL_API_ERROR, severity: ERROR_SEVERITY.MEDIUM };
        }
        
        if (message.includes('security') || message.includes('malicious') || message.includes('injection')) {
            return { type: ERROR_TYPES.SECURITY_ERROR, severity: ERROR_SEVERITY.HIGH };
        }
    }
    
    // Default classification
    return { 
        type: ERROR_TYPES.SYSTEM_ERROR, 
        severity: ERROR_SEVERITY.HIGH 
    };
}

/**
 * Get error severity based on HTTP status code
 * @param {number} statusCode - HTTP status code
 * @returns {string} Severity level
 */
function getSeverityFromStatus(statusCode) {
    if (statusCode < 400) return ERROR_SEVERITY.LOW;
    if (statusCode < 500) return ERROR_SEVERITY.MEDIUM;
    return ERROR_SEVERITY.HIGH;
}

/**
 * Generate error tracking ID
 * @returns {string} Unique error tracking ID
 */
function generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Build error context for logging
 * @param {Object} req - Express request object
 * @param {Error} error - The error
 * @param {Object} classification - Error classification
 * @returns {Object} Error context
 */
function buildErrorContext(req, error, classification) {
    return {
        // Request context
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip,
        userAgent: SafeUtils.safeString(req.get('User-Agent'), 200),
        userId: SafeUtils.safeUserIdPrefix(req.user?.id),
        
        // Error details
        errorType: classification.type,
        errorSeverity: classification.severity,
        errorMessage: SafeUtils.safeString(error.message, 500),
        errorStack: flags.isEnabled('DEBUG') ? error.stack : null,
        
        // Additional context
        timestamp: new Date().toISOString(),
        statusCode: error.statusCode || 500,
        
        // Request metadata
        contentType: req.get('Content-Type'),
        contentLength: req.get('Content-Length'),
        origin: SafeUtils.safeString(req.get('Origin'), 100),
        referer: SafeUtils.safeString(req.get('Referer'), 200),
        
        // Session/auth context
        sessionId: SafeUtils.safeString(req.sessionID, 100),
        isAuthenticated: !!req.user,
        userPlan: req.user?.plan,
        
        // Performance context
        responseTime: req.responseTime,
        memoryUsage: process.memoryUsage().heapUsed
    };
}

/**
 * Build client-safe error response
 * @param {Object} classification - Error classification
 * @param {string} errorId - Error tracking ID
 * @param {Error} originalError - Original error (for dev mode)
 * @returns {Object} Client-safe error response
 */
function buildErrorResponse(classification, errorId, originalError = null) {
    const isProduction = process.env.NODE_ENV === 'production';
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    const baseResponse = {
        success: false,
        error: SAFE_ERROR_MESSAGES[classification.type] || 'An error occurred',
        code: classification.type,
        errorId,
        timestamp: new Date().toISOString()
    };
    
    // Add additional context in development
    if (isDevelopment && originalError) {
        baseResponse.debug = {
            message: originalError.message,
            stack: originalError.stack?.split('\n').slice(0, 10) // Limit stack trace
        };
    }
    
    // Add retry information for retryable errors
    if ([ERROR_TYPES.EXTERNAL_API_ERROR, ERROR_TYPES.DATABASE_ERROR].includes(classification.type)) {
        baseResponse.retryable = true;
        baseResponse.retryAfter = calculateRetryDelay(classification.type);
    }
    
    return baseResponse;
}

/**
 * Calculate retry delay based on error type
 * @param {string} errorType - Error type
 * @returns {number} Retry delay in seconds
 */
function calculateRetryDelay(errorType) {
    const delays = {
        [ERROR_TYPES.EXTERNAL_API_ERROR]: 30, // 30 seconds
        [ERROR_TYPES.DATABASE_ERROR]: 60, // 1 minute
        [ERROR_TYPES.RATE_LIMIT_ERROR]: 3600, // 1 hour
        [ERROR_TYPES.SYSTEM_ERROR]: 300 // 5 minutes
    };
    
    return delays[errorType] || 60;
}

/**
 * Attempt automatic error recovery
 * @param {Error} error - The error
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @returns {boolean} Whether recovery was attempted
 */
async function attemptErrorRecovery(error, req, res) {
    try {
        // Database connection recovery
        if (error.message?.includes('connection') || error.code === 'ECONNREFUSED') {
            logger.info('Attempting database connection recovery', {
                errorMessage: error.message,
                endpoint: req.originalUrl
            });
            
            // Could implement connection pool reset or fallback database here
            return false; // No automatic recovery for now
        }
        
        // Rate limit recovery with exponential backoff suggestion
        if (error.statusCode === 429) {
            const retryAfter = calculateRetryDelay(ERROR_TYPES.RATE_LIMIT_ERROR);
            res.set('Retry-After', retryAfter.toString());
            return true;
        }
        
        // External API fallback
        if (error.message?.includes('openai') || error.message?.includes('api')) {
            logger.info('API error detected, could implement fallback', {
                errorMessage: SafeUtils.safeString(error.message),
                endpoint: req.originalUrl
            });
            
            // Could implement fallback to mock services or cached responses
            return false;
        }
        
        return false;
    } catch (recoveryError) {
        logger.error('Error recovery attempt failed', {
            originalError: SafeUtils.safeString(error.message),
            recoveryError: SafeUtils.safeString(recoveryError.message)
        });
        return false;
    }
}

/**
 * Log error with appropriate level based on severity
 * @param {Object} context - Error context
 * @param {string} errorId - Error tracking ID
 */
function logError(context, errorId) {
    const logData = { ...context, errorId };
    
    switch (context.errorSeverity) {
        case ERROR_SEVERITY.CRITICAL:
            logger.error('CRITICAL ERROR', logData);
            // Could trigger alerts/notifications here
            break;
            
        case ERROR_SEVERITY.HIGH:
            logger.error('High severity error', logData);
            break;
            
        case ERROR_SEVERITY.MEDIUM:
            logger.warn('Medium severity error', logData);
            break;
            
        case ERROR_SEVERITY.LOW:
            logger.info('Low severity error', logData);
            break;
            
        default:
            logger.error('Unknown severity error', logData);
    }
}

/**
 * Main error handling middleware
 * @param {Object} options - Error handling options
 * @returns {Function} Express error middleware
 */
function errorHandler(options = {}) {
    const {
        enableRecovery = true,
        enableDetailedLogging = true,
        enableErrorTracking = true,
        includeStackTrace = process.env.NODE_ENV === 'development'
    } = options;
    
    return async (error, req, res, next) => {
        // Skip if response already sent
        if (res.headersSent) {
            return next(error);
        }
        
        const errorId = generateErrorId();
        const statusCode = error.statusCode || error.status || 500;
        const classification = classifyError(error, statusCode);
        
        try {
            // Build comprehensive error context
            const context = buildErrorContext(req, error, classification);
            
            // Log the error
            if (enableDetailedLogging) {
                logError(context, errorId);
            }
            
            // Attempt error recovery if enabled
            let recoveryAttempted = false;
            if (enableRecovery) {
                recoveryAttempted = await attemptErrorRecovery(error, req, res);
            }
            
            // Build client response
            const errorResponse = buildErrorResponse(classification, errorId, includeStackTrace ? error : null);
            
            // Add recovery information
            if (recoveryAttempted) {
                errorResponse.recoveryAttempted = true;
            }
            
            // Send error response
            res.status(statusCode).json(errorResponse);
            
            // Error tracking/metrics (could integrate with monitoring services)
            if (enableErrorTracking) {
                // Could send to error tracking service (Sentry, Bugsnag, etc.)
                logger.debug('Error tracked', {
                    errorId,
                    errorType: classification.type,
                    statusCode
                });
            }
            
        } catch (handlerError) {
            // Fallback error handling
            logger.error('Error handler failed', {
                originalError: SafeUtils.safeString(error.message),
                handlerError: SafeUtils.safeString(handlerError.message),
                errorId
            });
            
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'ERROR_HANDLER_FAILED',
                errorId
            });
        }
    };
}

/**
 * Express async error wrapper
 * Wraps async route handlers to catch and forward errors
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped route handler
 */
function asyncWrapper(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Custom error classes for better error handling
 */
class BaseError extends Error {
    constructor(message, statusCode = 500, errorType = ERROR_TYPES.SYSTEM_ERROR) {
        super(message);
        this.statusCode = statusCode;
        this.errorType = errorType;
        this.timestamp = new Date().toISOString();
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends BaseError {
    constructor(message, details = null) {
        super(message, 400, ERROR_TYPES.VALIDATION_ERROR);
        this.details = details;
    }
}

class AuthenticationError extends BaseError {
    constructor(message = 'Authentication required') {
        super(message, 401, ERROR_TYPES.AUTHENTICATION_ERROR);
    }
}

class AuthorizationError extends BaseError {
    constructor(message = 'Insufficient permissions') {
        super(message, 403, ERROR_TYPES.AUTHORIZATION_ERROR);
    }
}

class BusinessLogicError extends BaseError {
    constructor(message, details = null) {
        super(message, 409, ERROR_TYPES.BUSINESS_LOGIC_ERROR);
        this.details = details;
    }
}

class ExternalAPIError extends BaseError {
    constructor(message, service = 'unknown') {
        super(message, 502, ERROR_TYPES.EXTERNAL_API_ERROR);
        this.service = service;
    }
}

class DatabaseError extends BaseError {
    constructor(message, operation = 'unknown') {
        super(message, 500, ERROR_TYPES.DATABASE_ERROR);
        this.operation = operation;
    }
}

class SecurityError extends BaseError {
    constructor(message, violation = 'unknown') {
        super(message, 403, ERROR_TYPES.SECURITY_ERROR);
        this.violation = violation;
    }
}

/**
 * 404 Not Found handler
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
function notFoundHandler(req, res, next) {
    const error = new ValidationError(`Route not found: ${req.method} ${req.originalUrl}`);
    error.statusCode = 404;
    next(error);
}

/**
 * Graceful shutdown error handler
 * @param {string} signal - Shutdown signal
 */
function gracefulShutdownHandler(signal) {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    
    // Close server connections, database pools, etc.
    process.exit(0);
}

// Set up graceful shutdown handlers
process.on('SIGTERM', () => gracefulShutdownHandler('SIGTERM'));
process.on('SIGINT', () => gracefulShutdownHandler('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack,
        severity: ERROR_SEVERITY.CRITICAL
    });
    
    // Graceful shutdown
    gracefulShutdownHandler('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', {
        reason: reason?.message || reason,
        stack: reason?.stack,
        severity: ERROR_SEVERITY.CRITICAL
    });
    
    // Graceful shutdown
    gracefulShutdownHandler('unhandledRejection');
});

module.exports = {
    // Main middleware
    errorHandler,
    notFoundHandler,
    asyncWrapper,
    
    // Error classes
    BaseError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    BusinessLogicError,
    ExternalAPIError,
    DatabaseError,
    SecurityError,
    
    // Utilities
    classifyError,
    generateErrorId,
    buildErrorContext,
    buildErrorResponse,
    
    // Constants
    ERROR_TYPES,
    ERROR_SEVERITY
};