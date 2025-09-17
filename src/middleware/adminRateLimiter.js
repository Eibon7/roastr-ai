const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

/**
 * Creates an admin rate limiter with configurable options
 * @param {Object} options - Configuration options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @returns {Function} Express middleware function
 */
const createAdminRateLimiter = (options = {}) => {
  // Disable rate limiting in test environment for testing purposes
  if (process.env.NODE_ENV === 'test' || !flags.isEnabled('ENABLE_RATE_LIMITING')) {
    logger.info('Admin rate limiting disabled (test environment or feature flag)');
    return (req, res, next) => next();
  }

  // Configurable parameters with environment variable overrides and validation
  const parsedWindowMs = parseInt(process.env.ADMIN_RATE_LIMIT_WINDOW_MS, 10);
  const parsedMax = parseInt(process.env.ADMIN_RATE_LIMIT_MAX, 10);

  const config = {
    windowMs: Math.max(1000, Number.isFinite(parsedWindowMs) ? parsedWindowMs : options.windowMs || 5 * 60 * 1000), // Minimum 1 second
    max: Math.max(1, Number.isFinite(parsedMax) ? parsedMax : options.max || 50), // Minimum 1 request
    ...options
  };

  const adminRateLimiter = rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: {
      error: 'Too many admin requests from this IP, please try again later.',
      retryAfter: Math.ceil(config.windowMs / 1000) // Convert to seconds
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req, options) => {
      // Use user ID if authenticated, otherwise fall back to IP with IPv6 support
      if (req.user?.id) {
        return `user:${req.user.id}`;
      }
      const { ipKeyGenerator } = options;
      return `ip:${ipKeyGenerator(req)}`;
    },
    handler: (req, res) => {
      logger.warn('Admin rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
        endpoint: req.originalUrl,
        method: req.method
      });

      res.status(429).json({
        error: 'Too many admin requests from this IP, please try again later.',
        retryAfter: Math.ceil(config.windowMs / 1000),
        timestamp: new Date().toISOString()
      });
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/api/health';
    }
  });

  logger.info('Admin rate limiter initialized', {
    windowMs: config.windowMs,
    maxRequests: config.max,
    configurable: true
  });

  return adminRateLimiter;
};

module.exports = {
  adminRateLimiter: createAdminRateLimiter(),
  createAdminRateLimiter
};