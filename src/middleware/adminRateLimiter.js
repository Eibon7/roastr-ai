const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

const createAdminRateLimiter = (options = {}) => {
  // Disable rate limiting in test environment
  if (process.env.NODE_ENV === 'test' || !flags.isEnabled('ENABLE_RATE_LIMITING')) {
    logger.info('Admin rate limiting disabled (test environment or feature flag)');
    return (req, res, next) => next();
  }

  // Configurable parameters with environment variable overrides
  const config = {
    windowMs: parseInt(process.env.ADMIN_RATE_LIMIT_WINDOW_MS) || options.windowMs || 5 * 60 * 1000, // 5 minutes default
    max: parseInt(process.env.ADMIN_RATE_LIMIT_MAX) || options.max || 50, // 50 requests default
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
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise fall back to IP
      return req.user?.id || req.ip;
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