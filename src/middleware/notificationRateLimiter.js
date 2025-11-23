/**
 * Rate limiting middleware for notification endpoints
 * Prevents abuse of notification-related endpoints
 * Issue #97: Implement rate limiting for notification endpoints
 */

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

/**
 * Rate limiter for general notification endpoints
 * Moderate limit: 60 requests per minute per IP/user
 */
const notificationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 60, // 60 requests per minute
  message: {
    success: false,
    error: 'Too many notification requests. Please slow down.',
    code: 'NOTIFICATION_RATE_LIMITED'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Use IP + user ID for authenticated requests
    const ip = ipKeyGenerator(req);
    const userId = req.user?.id || 'anonymous';
    return `notification:${ip}:${userId}`;
  },
  handler: (req, res) => {
    logger.warn('Notification endpoint rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.id?.substring(0, 8) + '...',
      endpoint: req.path,
      userAgent: req.get('User-Agent'),
      method: req.method
    });
    res.status(429).json({
      success: false,
      error: 'Too many notification requests. Please slow down.',
      code: 'NOTIFICATION_RATE_LIMITED',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  },
  skip: (req) => {
    // Skip rate limiting in test mode or when disabled
    return process.env.NODE_ENV === 'test' || flags.isEnabled('DISABLE_RATE_LIMIT');
  }
});

/**
 * Rate limiter for notification marking endpoints (mark-read, mark-all-read)
 * More restrictive: 30 requests per minute per IP/user
 */
const notificationMarkLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 30, // 30 requests per minute
  message: {
    success: false,
    error: 'Too many notification marking requests. Please slow down.',
    code: 'NOTIFICATION_MARK_RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req);
    const userId = req.user?.id || 'anonymous';
    return `notification_mark:${ip}:${userId}`;
  },
  handler: (req, res) => {
    logger.warn('Notification marking rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.id?.substring(0, 8) + '...',
      endpoint: req.path,
      userAgent: req.get('User-Agent'),
      method: req.method
    });
    res.status(429).json({
      success: false,
      error: 'Too many notification marking requests. Please slow down.',
      code: 'NOTIFICATION_MARK_RATE_LIMITED',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test' || flags.isEnabled('DISABLE_RATE_LIMIT');
  }
});

/**
 * Rate limiter for notification deletion/archive endpoints
 * More restrictive: 20 requests per minute per IP/user
 */
const notificationDeleteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 20, // 20 requests per minute
  message: {
    success: false,
    error: 'Too many notification deletion requests. Please slow down.',
    code: 'NOTIFICATION_DELETE_RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req);
    const userId = req.user?.id || 'anonymous';
    return `notification_delete:${ip}:${userId}`;
  },
  handler: (req, res) => {
    logger.warn('Notification deletion rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.id?.substring(0, 8) + '...',
      endpoint: req.path,
      userAgent: req.get('User-Agent'),
      method: req.method,
      notificationId: req.params.id?.substring(0, 8) + '...'
    });
    res.status(429).json({
      success: false,
      error: 'Too many notification deletion requests. Please slow down.',
      code: 'NOTIFICATION_DELETE_RATE_LIMITED',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test' || flags.isEnabled('DISABLE_RATE_LIMIT');
  }
});

/**
 * Configuration object for notification rate limiting
 * Allows for easy adjustment of rate limits via environment variables
 */
const getNotificationRateConfig = () => {
  return {
    general: {
      windowMs: parseInt(process.env.NOTIFICATION_RATE_WINDOW_MS) || 60 * 1000,
      max: parseInt(process.env.NOTIFICATION_RATE_MAX) || 60
    },
    marking: {
      windowMs: parseInt(process.env.NOTIFICATION_MARK_RATE_WINDOW_MS) || 60 * 1000,
      max: parseInt(process.env.NOTIFICATION_MARK_RATE_MAX) || 30
    },
    deletion: {
      windowMs: parseInt(process.env.NOTIFICATION_DELETE_RATE_WINDOW_MS) || 60 * 1000,
      max: parseInt(process.env.NOTIFICATION_DELETE_RATE_MAX) || 20
    }
  };
};

/**
 * Create a custom rate limiter with configurable options
 * @param {string} type - Type of rate limiter (general, marking, deletion)
 * @param {Object} customConfig - Custom configuration options
 * @returns {Function} Express middleware function
 */
const createNotificationRateLimiter = (type, customConfig = {}) => {
  const config = getNotificationRateConfig();
  const typeConfig = config[type] || config.general;

  return rateLimit({
    windowMs: customConfig.windowMs || typeConfig.windowMs,
    max: customConfig.max || typeConfig.max,
    message: {
      success: false,
      error: customConfig.message || 'Too many requests. Please slow down.',
      code: customConfig.code || 'NOTIFICATION_RATE_LIMITED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator:
      customConfig.keyGenerator ||
      ((req) => {
        const ip = ipKeyGenerator(req);
        const userId = req.user?.id || 'anonymous';
        return `notification_${type}:${ip}:${userId}`;
      }),
    handler:
      customConfig.handler ||
      ((req, res) => {
        logger.warn(`Notification ${type} rate limit exceeded`, {
          ip: req.ip,
          userId: req.user?.id?.substring(0, 8) + '...',
          endpoint: req.path,
          userAgent: req.get('User-Agent'),
          method: req.method
        });
        res.status(429).json({
          success: false,
          error: customConfig.message || 'Too many requests. Please slow down.',
          code: customConfig.code || 'NOTIFICATION_RATE_LIMITED',
          retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
      }),
    skip:
      customConfig.skip ||
      ((req) => {
        return process.env.NODE_ENV === 'test' || flags.isEnabled('DISABLE_RATE_LIMIT');
      })
  });
};

module.exports = {
  notificationLimiter,
  notificationMarkLimiter,
  notificationDeleteLimiter,
  createNotificationRateLimiter,
  getNotificationRateConfig
};
