const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

const createAdminRateLimiter = () => {
  // Disable rate limiting in test environment
  if (process.env.NODE_ENV === 'test' || !flags.isEnabled('ENABLE_RATE_LIMITING')) {
    logger.info('Admin rate limiting disabled (test environment or feature flag)');
    return (req, res, next) => next();
  }

  const adminRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // Limit each IP to 50 admin requests per windowMs
    message: {
      error: 'Too many admin requests from this IP, please try again later.',
      retryAfter: Math.ceil(5 * 60) // 5 minutes in seconds
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
        retryAfter: Math.ceil(5 * 60),
        timestamp: new Date().toISOString()
      });
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/api/health';
    }
  });

  logger.info('Admin rate limiter initialized', {
    windowMs: 5 * 60 * 1000,
    maxRequests: 50
  });

  return adminRateLimiter;
};

module.exports = {
  adminRateLimiter: createAdminRateLimiter(),
  createAdminRateLimiter
};