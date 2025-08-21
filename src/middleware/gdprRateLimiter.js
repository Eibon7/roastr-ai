/**
 * Rate limiting middleware for GDPR-sensitive endpoints
 * Implements strict rate limiting for account deletion and data export endpoints
 * Issue #115: Prevent DoS and brute force attacks on GDPR endpoints
 */

const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

/**
 * Rate limiter for account deletion endpoint
 * Very strict: 3 attempts per hour per IP
 */
const accountDeletionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 3, // 3 requests per hour
  message: {
    success: false,
    error: 'Too many account deletion requests. Please wait before trying again.',
    code: 'GDPR_DELETION_RATE_LIMITED'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Use IP + user ID for authenticated requests
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const userId = req.user?.id || 'anonymous';
    return `gdpr_delete:${ip}:${userId}`;
  },
  handler: (req, res) => {
    logger.warn('GDPR account deletion rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.id?.substr(0, 8) + '...',
      endpoint: req.path,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      success: false,
      error: 'Too many account deletion requests. Please wait before trying again.',
      code: 'GDPR_DELETION_RATE_LIMITED',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  },
  skip: (req) => {
    // Skip rate limiting in test mode
    return process.env.NODE_ENV === 'test' || flags.isEnabled('DISABLE_RATE_LIMIT');
  }
});

/**
 * Rate limiter for data export endpoint
 * Moderate: 5 attempts per hour per IP
 */
const dataExportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // 5 requests per hour
  message: {
    success: false,
    error: 'Too many data export requests. Please wait before trying again.',
    code: 'GDPR_EXPORT_RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const userId = req.user?.id || 'anonymous';
    return `gdpr_export:${ip}:${userId}`;
  },
  handler: (req, res) => {
    logger.warn('GDPR data export rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.id?.substr(0, 8) + '...',
      endpoint: req.path,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      success: false,
      error: 'Too many data export requests. Please wait before trying again.',
      code: 'GDPR_EXPORT_RATE_LIMITED',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test' || flags.isEnabled('DISABLE_RATE_LIMIT');
  }
});

/**
 * Rate limiter for data download endpoint
 * Strict: 10 attempts per hour per IP (allows for retries on download failures)
 */
const dataDownloadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 10, // 10 download attempts per hour
  message: {
    success: false,
    error: 'Too many download attempts. Please wait before trying again.',
    code: 'GDPR_DOWNLOAD_RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // For download endpoint, we use IP + token prefix for rate limiting
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const token = req.params.token || 'no-token';
    const tokenPrefix = token.substr(0, 8);
    return `gdpr_download:${ip}:${tokenPrefix}`;
  },
  handler: (req, res) => {
    logger.warn('GDPR data download rate limit exceeded', {
      ip: req.ip,
      tokenPrefix: req.params.token?.substr(0, 8) + '...',
      endpoint: req.path,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      success: false,
      error: 'Too many download attempts. Please wait before trying again.',
      code: 'GDPR_DOWNLOAD_RATE_LIMITED',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test' || flags.isEnabled('DISABLE_RATE_LIMIT');
  }
});

/**
 * Rate limiter for account deletion cancellation
 * Moderate: 5 attempts per hour (allows for UI retries)
 */
const deletionCancellationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // 5 requests per hour
  message: {
    success: false,
    error: 'Too many cancellation attempts. Please wait before trying again.',
    code: 'GDPR_CANCEL_RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const userId = req.user?.id || 'anonymous';
    return `gdpr_cancel:${ip}:${userId}`;
  },
  handler: (req, res) => {
    logger.warn('GDPR deletion cancellation rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.id?.substr(0, 8) + '...',
      endpoint: req.path,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      success: false,
      error: 'Too many cancellation attempts. Please wait before trying again.',
      code: 'GDPR_CANCEL_RATE_LIMITED',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test' || flags.isEnabled('DISABLE_RATE_LIMIT');
  }
});

/**
 * Combined rate limiter for all GDPR endpoints
 * Overall limit to prevent abuse across all GDPR endpoints
 */
const gdprGlobalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 20, // 20 total GDPR requests per hour across all endpoints
  message: {
    success: false,
    error: 'Too many GDPR-related requests. Please wait before trying again.',
    code: 'GDPR_GLOBAL_RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    return `gdpr_global:${ip}`;
  },
  handler: (req, res) => {
    logger.warn('Global GDPR rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.id?.substr(0, 8) + '...',
      endpoint: req.path,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      success: false,
      error: 'Too many GDPR-related requests. Please wait before trying again.',
      code: 'GDPR_GLOBAL_RATE_LIMITED',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test' || flags.isEnabled('DISABLE_RATE_LIMIT');
  }
});

module.exports = {
  accountDeletionLimiter,
  dataExportLimiter,
  dataDownloadLimiter,
  deletionCancellationLimiter,
  gdprGlobalLimiter
};