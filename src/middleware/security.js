/**
 * Security Middleware
 * 
 * Implements security hardening measures including helmet, CORS, rate limiting
 */

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit'); // Issue #618 - IPv6 support
const { logger } = require('../utils/logger');

/**
 * Configure Helmet security headers
 */
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers (onclick, etc.) for manual-approval.html
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com", "https://api.polar.sh", "https://polar.sh", "wss:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      // Disable upgrade-insecure-requests in development to allow HTTP localhost
      ...(process.env.NODE_ENV !== 'production' && { upgradeInsecureRequests: null })
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
});

/**
 * Configure CORS
 */
const corsConfig = cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://roastr.ai',
      'https://www.roastr.ai',
      'https://app.roastr.ai',
      ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
    ];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
});

/**
 * General rate limiting
 */
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator, // Issue #618 - Proper IPv6 support
  handler: (req, res) => {
    logger.warn('Rate limit exceeded:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later',
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }
});

/**
 * Strict rate limiting for auth endpoints
 */
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 auth requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  skipSuccessfulRequests: true,
  keyGenerator: ipKeyGenerator, // Issue #618 - Proper IPv6 support
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts, please try again later',
      code: 'AUTH_RATE_LIMIT_EXCEEDED'
    });
  }
});

/**
 * Strict rate limiting for billing endpoints
 */
const billingRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 billing requests per windowMs
  message: {
    success: false,
    error: 'Too many billing requests, please try again later',
    code: 'BILLING_RATE_LIMIT_EXCEEDED'
  },
  keyGenerator: ipKeyGenerator, // Issue #618 - Proper IPv6 support
  handler: (req, res) => {
    logger.warn('Billing rate limit exceeded:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    res.status(429).json({
      success: false,
      error: 'Too many billing requests, please try again later',
      code: 'BILLING_RATE_LIMIT_EXCEEDED'
    });
  }
});

/**
 * Input validation middleware
 */
const validateInput = (req, res, next) => {
  // Basic XSS protection for string inputs
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    
    // Remove potentially dangerous HTML tags and scripts
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  };

  // Recursively sanitize object properties
  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'string') {
          obj[key] = sanitizeString(obj[key]);
        } else if (typeof obj[key] === 'object') {
          obj[key] = sanitizeObject(obj[key]);
        }
      }
    }
    return obj;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters (modify in place since req.query is read-only)
  if (req.query) {
    const sanitizedQuery = sanitizeObject({ ...req.query });
    // Copy sanitized values back to original query object
    Object.keys(req.query).forEach(key => {
      if (sanitizedQuery.hasOwnProperty(key)) {
        // Use Object.defineProperty to safely update the property
        try {
          if (req.query[key] !== sanitizedQuery[key]) {
            Object.defineProperty(req.query, key, {
              value: sanitizedQuery[key],
              writable: true,
              enumerable: true,
              configurable: true
            });
          }
        } catch (error) {
          // If we can't modify the property, log warning but continue
          logger.warn('Could not sanitize query parameter:', { key, error: error.message });
        }
      }
    });
  }

  next();
};

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  // Skip logging for health checks and static assets
  if (req.path === '/health' || req.path.startsWith('/static/')) {
    return next();
  }

  const startTime = Date.now();
  
  // Log request
  logger.info('HTTP Request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length')
  });

  // Log response when finished
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    logger.info('HTTP Response', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length')
    });

    originalSend.call(this, data);
  };

  next();
};

/**
 * Error handling middleware
 */
const errorHandler = (error, req, res, next) => {
  // Log the full error
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    ip: req.ip
  });

  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      ...(isDevelopment && { details: error.message })
    });
  }

  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    });
  }

  // Generic server error
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(isDevelopment && { details: error.message })
  });
};

module.exports = {
  helmetConfig,
  corsConfig,
  generalRateLimit,
  authRateLimit,
  billingRateLimit,
  validateInput,
  requestLogger,
  errorHandler
};