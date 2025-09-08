/**
 * Enhanced Input Validation Middleware
 * 
 * Provides comprehensive input validation and sanitization
 * with security-focused checks for API endpoints
 * 
 * Security Features:
 * - SQL injection prevention
 * - XSS protection
 * - Rate limiting by IP and user
 * - Input size and type validation
 * - Malicious pattern detection
 * - Request context logging
 * 
 * @author Roastr.ai Team
 * @version 1.0.0
 */

const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');
const { logger } = require('../utils/logger');
const { SafeUtils } = require('../utils/logger');

// Malicious pattern detection
const MALICIOUS_PATTERNS = [
    // SQL Injection patterns
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(\'|\"|;|--|\/\*|\*\/|xp_|sp_)/gi,
    
    // XSS patterns  
    /(<script|javascript:|vbscript:|onload|onerror|onclick)/gi,
    /(<iframe|<object|<embed|<form)/gi,
    
    // Command injection patterns
    /(\||;|&|`|\$\(|\${)/gi,
    /(wget|curl|nc|netcat|bash|sh|cmd|powershell)/gi,
    
    // Path traversal patterns
    /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c)/gi,
    
    // Server-side template injection
    /(\{\{|\}\}|\$\{|\<%|\%\>)/gi
];

// Suspicious User-Agent patterns
const SUSPICIOUS_USER_AGENTS = [
    /sqlmap|nikto|nessus|burp|acunetix|appscan|w3af/gi,
    /masscan|nmap|zap|grabber|havij|pangolin/gi
];

/**
 * Rate limiting configurations
 */
const createRateLimiter = (windowMs, max, message) => rateLimit({
    windowMs,
    max,
    message: {
        success: false,
        error: message,
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn('Rate limit exceeded', {
            ip: req.ip,
            userId: req.user?.id,
            endpoint: req.path,
            userAgent: req.get('User-Agent')
        });
        res.status(429).json({
            success: false,
            error: message,
            code: 'RATE_LIMIT_EXCEEDED'
        });
    }
});

// Different rate limits for different endpoint types
const rateLimiters = {
    // Strict rate limiting for authentication endpoints
    auth: createRateLimiter(15 * 60 * 1000, 5, 'Too many authentication attempts'),
    
    // Moderate rate limiting for API endpoints
    api: createRateLimiter(15 * 60 * 1000, 100, 'Too many API requests'),
    
    // Lenient rate limiting for static content
    static: createRateLimiter(15 * 60 * 1000, 1000, 'Too many requests'),
    
    // Very strict for sensitive operations
    sensitive: createRateLimiter(60 * 60 * 1000, 3, 'Too many sensitive operations')
};

/**
 * Detect malicious patterns in input
 * @param {string} input - Input string to check
 * @returns {Object} Detection result
 */
function detectMaliciousPatterns(input) {
    if (!input || typeof input !== 'string') {
        return { isMalicious: false, patterns: [] };
    }
    
    const detectedPatterns = [];
    
    for (const pattern of MALICIOUS_PATTERNS) {
        if (pattern.test(input)) {
            detectedPatterns.push(pattern.source);
        }
    }
    
    return {
        isMalicious: detectedPatterns.length > 0,
        patterns: detectedPatterns
    };
}

/**
 * Check for suspicious User-Agent
 * @param {string} userAgent - User-Agent header
 * @returns {boolean} Whether User-Agent is suspicious
 */
function isSuspiciousUserAgent(userAgent) {
    if (!userAgent) return false;
    
    return SUSPICIOUS_USER_AGENTS.some(pattern => pattern.test(userAgent));
}

/**
 * Sanitize input string
 * @param {string} input - Input to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized input
 */
function sanitizeInput(input, options = {}) {
    if (!input || typeof input !== 'string') {
        return input;
    }
    
    const {
        maxLength = 10000,
        allowHtml = false,
        strictMode = false
    } = options;
    
    // Truncate if too long
    if (input.length > maxLength) {
        logger.warn('Input truncated due to excessive length', {
            originalLength: input.length,
            maxLength
        });
        input = input.substring(0, maxLength);
    }
    
    // Remove null bytes
    input = input.replace(/\0/g, '');
    
    // In strict mode, remove all HTML
    if (strictMode || !allowHtml) {
        input = DOMPurify.sanitize(input, { 
            ALLOWED_TAGS: [],
            ALLOWED_ATTR: []
        });
    } else if (allowHtml) {
        // Allow limited HTML but sanitize dangerous content
        input = DOMPurify.sanitize(input, {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
            ALLOWED_ATTR: []
        });
    }
    
    return input.trim();
}

/**
 * Security validation middleware
 * @param {Object} options - Validation options
 * @returns {Function} Express middleware
 */
function securityValidation(options = {}) {
    const {
        checkMaliciousPatterns = true,
        checkSuspiciousUserAgent = true,
        logSuspiciousActivity = true,
        blockMalicious = true
    } = options;
    
    return (req, res, next) => {
        const userAgent = req.get('User-Agent') || '';
        const userId = SafeUtils.safeUserIdPrefix(req.user?.id);
        const clientIp = req.ip || req.connection.remoteAddress;
        
        // Check for suspicious User-Agent
        if (checkSuspiciousUserAgent && isSuspiciousUserAgent(userAgent)) {
            logger.warn('Suspicious User-Agent detected', {
                userAgent: SafeUtils.safeString(userAgent),
                ip: clientIp,
                userId,
                endpoint: req.path
            });
            
            if (blockMalicious) {
                return res.status(403).json({
                    success: false,
                    error: 'Request blocked due to security policy',
                    code: 'SECURITY_VIOLATION'
                });
            }
        }
        
        // Check for malicious patterns in request data
        if (checkMaliciousPatterns) {
            const requestData = JSON.stringify({
                body: req.body,
                query: req.query,
                params: req.params
            });
            
            const maliciousCheck = detectMaliciousPatterns(requestData);
            
            if (maliciousCheck.isMalicious) {
                logger.error('Malicious patterns detected in request', {
                    patterns: maliciousCheck.patterns,
                    ip: clientIp,
                    userId,
                    endpoint: req.path,
                    method: req.method
                });
                
                if (blockMalicious) {
                    return res.status(400).json({
                        success: false,
                        error: 'Request contains invalid patterns',
                        code: 'INVALID_INPUT'
                    });
                }
            }
        }
        
        // Log request context for monitoring
        if (logSuspiciousActivity) {
            logger.debug('Request security check passed', {
                ip: clientIp,
                userId,
                endpoint: req.path,
                method: req.method,
                userAgent: SafeUtils.safeString(userAgent, 100)
            });
        }
        
        next();
    };
}

/**
 * Sanitize request body fields
 * @param {Array} fields - Fields to sanitize
 * @param {Object} options - Sanitization options
 * @returns {Function} Express middleware
 */
function sanitizeFields(fields = [], options = {}) {
    return (req, res, next) => {
        if (!req.body || typeof req.body !== 'object') {
            return next();
        }
        
        for (const field of fields) {
            if (req.body[field] && typeof req.body[field] === 'string') {
                const original = req.body[field];
                req.body[field] = sanitizeInput(original, options);
                
                if (original !== req.body[field]) {
                    logger.debug('Field sanitized', {
                        field,
                        originalLength: original.length,
                        sanitizedLength: req.body[field].length,
                        userId: SafeUtils.safeUserIdPrefix(req.user?.id)
                    });
                }
            }
        }
        
        next();
    };
}

/**
 * Comprehensive input validation for roast endpoints
 * @returns {Array} Array of validation middleware
 */
function validateRoastInput() {
    return [
        // Rate limiting
        rateLimiters.api,
        
        // Security checks
        securityValidation({
            checkMaliciousPatterns: true,
            checkSuspiciousUserAgent: true,
            blockMalicious: true
        }),
        
        // Input validation
        body('message')
            .isString()
            .withMessage('Message must be a string')
            .isLength({ min: 1, max: 2000 })
            .withMessage('Message must be between 1 and 2000 characters')
            .custom((value) => {
                const maliciousCheck = detectMaliciousPatterns(value);
                if (maliciousCheck.isMalicious) {
                    throw new Error('Message contains invalid patterns');
                }
                return true;
            }),
        
        body('tone')
            .optional()
            .isIn(['sarcastic', 'subtle', 'direct', 'witty', 'brutal'])
            .withMessage('Invalid tone specified'),
        
        body('platform')
            .optional()
            .isIn(['twitter', 'youtube', 'instagram', 'facebook', 'discord', 'reddit', 'tiktok', 'twitch', 'bluesky'])
            .withMessage('Invalid platform specified'),
        
        // Sanitize fields
        sanitizeFields(['message'], {
            maxLength: 2000,
            allowHtml: false,
            strictMode: true
        }),
        
        // Validation result handler
        handleValidationErrors
    ];
}

/**
 * Comprehensive input validation for credit operations
 * @returns {Array} Array of validation middleware
 */
function validateCreditOperation() {
    return [
        // Strict rate limiting for sensitive operations
        rateLimiters.sensitive,
        
        // Security checks
        securityValidation({
            checkMaliciousPatterns: true,
            checkSuspiciousUserAgent: true,
            blockMalicious: true
        }),
        
        // Input validation
        body('creditType')
            .optional()
            .isIn(['analysis', 'roast'])
            .withMessage('Invalid credit type'),
        
        body('amount')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Amount must be between 1 and 100'),
        
        param('userId')
            .optional()
            .isUUID()
            .withMessage('Invalid user ID format'),
        
        // Validation result handler
        handleValidationErrors
    ];
}

/**
 * Handle validation errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        logger.warn('Input validation failed', {
            errors: errors.array(),
            userId: SafeUtils.safeUserIdPrefix(req.user?.id),
            ip: req.ip,
            endpoint: req.path
        });
        
        return res.status(400).json({
            success: false,
            error: 'Input validation failed',
            code: 'VALIDATION_ERROR',
            details: errors.array().map(error => ({
                field: error.path || error.param,
                message: error.msg,
                value: SafeUtils.safeString(error.value, 100)
            }))
        });
    }
    
    next();
}

/**
 * Authentication validation for sensitive endpoints
 * @param {Object} options - Validation options
 * @returns {Function} Express middleware
 */
function validateAuthentication(options = {}) {
    const { requireAdmin = false, requireActiveSubscription = false } = options;
    
    return (req, res, next) => {
        // Check basic authentication
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }
        
        // Check admin requirement
        if (requireAdmin && !req.user.is_admin) {
            logger.warn('Admin access required but user is not admin', {
                userId: SafeUtils.safeUserIdPrefix(req.user.id),
                endpoint: req.path,
                ip: req.ip
            });
            
            return res.status(403).json({
                success: false,
                error: 'Admin access required',
                code: 'ADMIN_REQUIRED'
            });
        }
        
        // Check subscription requirement
        if (requireActiveSubscription && req.user.plan === 'free') {
            logger.warn('Active subscription required but user has free plan', {
                userId: SafeUtils.safeUserIdPrefix(req.user.id),
                plan: req.user.plan,
                endpoint: req.path
            });
            
            return res.status(402).json({
                success: false,
                error: 'Active subscription required',
                code: 'SUBSCRIPTION_REQUIRED',
                data: {
                    currentPlan: req.user.plan,
                    upgradeUrl: '/billing'
                }
            });
        }
        
        next();
    };
}

module.exports = {
    // Core validation functions
    securityValidation,
    sanitizeInput,
    sanitizeFields,
    detectMaliciousPatterns,
    
    // Pre-configured validators
    validateRoastInput,
    validateCreditOperation,
    validateAuthentication,
    
    // Rate limiters
    rateLimiters,
    
    // Utility functions
    handleValidationErrors,
    isSuspiciousUserAgent
};