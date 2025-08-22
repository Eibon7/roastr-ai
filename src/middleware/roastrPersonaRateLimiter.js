const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { createClient } = require('redis');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

/**
 * Rate Limiter for Roastr Persona endpoints
 * 
 * Protects against abuse and brute force attacks on personal data endpoints
 * Issue #154: Security enhancement for Roastr Persona system
 */

// Redis client for rate limiting (if available)
let redisClient = null;

if (process.env.REDIS_URL && process.env.NODE_ENV === 'production') {
  redisClient = createClient({
    url: process.env.REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
    }
  });
  
  redisClient.on('error', (err) => {
    logger.error('Redis client error for rate limiting:', err);
  });
  
  redisClient.connect().catch(err => {
    logger.error('Failed to connect to Redis for rate limiting:', err);
    redisClient = null;
  });
}

// Create rate limiter configuration
const createRateLimiter = (windowMs, max, message, keyPrefix) => {
  const options = {
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use both IP and user ID for more accurate rate limiting
      const userId = req.user?.id || 'anonymous';
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      return `${keyPrefix}:${userId}:${ip}`;
    },
    skip: (req) => {
      // Skip rate limiting in test environment
      if (process.env.NODE_ENV === 'test') return true;
      // Skip if feature flag is disabled
      if (!flags.isEnabled('ENABLE_RATE_LIMITING')) return true;
      return false;
    },
    handler: (req, res) => {
      logger.warn('Rate limit exceeded for Roastr Persona endpoint', {
        userId: req.user?.id,
        ip: req.ip,
        endpoint: req.originalUrl,
        keyPrefix
      });
      
      res.status(429).json({
        success: false,
        error: message,
        retryAfter: res.getHeader('Retry-After')
      });
    }
  };
  
  // Use Redis store if available
  if (redisClient && redisClient.isReady) {
    options.store = new RedisStore({
      client: redisClient,
      prefix: `roastr-persona:${keyPrefix}:`
    });
  }
  
  return rateLimit(options);
};

// Rate limiter for GET requests (reading Roastr Persona)
const roastrPersonaReadLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  30, // 30 requests per window
  'Too many read requests for Roastr Persona. Please try again later.',
  'read'
);

// Rate limiter for POST/PUT requests (updating Roastr Persona)
const roastrPersonaWriteLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  10, // 10 updates per hour
  'Too many update requests for Roastr Persona. Please try again later.',
  'write'
);

// Rate limiter for DELETE requests (deleting Roastr Persona)
const roastrPersonaDeleteLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  5, // 5 deletions per hour
  'Too many deletion requests for Roastr Persona. Please try again later.',
  'delete'
);

// Stricter rate limiter for sensitive operations (like bulk updates)
const roastrPersonaSensitiveLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  3, // 3 requests per hour
  'Too many sensitive operations on Roastr Persona. Please try again later.',
  'sensitive'
);

// Global rate limiter across all Roastr Persona endpoints
const roastrPersonaGlobalLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  50, // 50 total requests per hour
  'Too many total requests to Roastr Persona endpoints. Please try again later.',
  'global'
);

// Middleware to apply multiple rate limiters
const applyRateLimiters = (...limiters) => {
  return (req, res, next) => {
    // Apply limiters sequentially
    const applyNext = (index) => {
      if (index >= limiters.length) {
        return next();
      }
      
      limiters[index](req, res, (err) => {
        if (err) return next(err);
        applyNext(index + 1);
      });
    };
    
    applyNext(0);
  };
};

// Combined rate limiters for different operations
const readRateLimiter = applyRateLimiters(
  roastrPersonaGlobalLimiter,
  roastrPersonaReadLimiter
);

const writeRateLimiter = applyRateLimiters(
  roastrPersonaGlobalLimiter,
  roastrPersonaWriteLimiter
);

const deleteRateLimiter = applyRateLimiters(
  roastrPersonaGlobalLimiter,
  roastrPersonaDeleteLimiter
);

const sensitiveRateLimiter = applyRateLimiters(
  roastrPersonaGlobalLimiter,
  roastrPersonaSensitiveLimiter
);

module.exports = {
  roastrPersonaReadLimiter: readRateLimiter,
  roastrPersonaWriteLimiter: writeRateLimiter,
  roastrPersonaDeleteLimiter: deleteRateLimiter,
  roastrPersonaSensitiveLimiter: sensitiveRateLimiter,
  // Export individual limiters for testing
  _limiters: {
    read: roastrPersonaReadLimiter,
    write: roastrPersonaWriteLimiter,
    delete: roastrPersonaDeleteLimiter,
    sensitive: roastrPersonaSensitiveLimiter,
    global: roastrPersonaGlobalLimiter
  }
};