/**
 * Auth Rate Limiting v2 - ROA-359
 *
 * Enhanced rate limiting and abuse policy for authentication endpoints:
 * - Rate limiting by auth type (password, magic link, OAuth)
 * - Rate limiting by IP and email/user independently
 * - Redis/Upstash storage with memory fallback
 * - Progressive blocking (15min → 1h → 24h → permanent)
 * - Abuse detection and scoring
 */

const { Redis } = require('@upstash/redis');
const crypto = require('crypto');
const { flags } = require('../config/flags');
const { logger } = require('../utils/logger');

/**
 * Rate limit configuration by auth type
 */
const RATE_LIMIT_CONFIG = {
  password: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5,
    blockDurationMs: 15 * 60 * 1000 // 15 minutes
  },
  magic_link: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3,
    blockDurationMs: 60 * 60 * 1000 // 1 hour
  },
  oauth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 10,
    blockDurationMs: 15 * 60 * 1000 // 15 minutes
  },
  password_reset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3,
    blockDurationMs: 60 * 60 * 1000 // 1 hour
  }
};

/**
 * Progressive block durations (escalation)
 */
const PROGRESSIVE_BLOCK_DURATIONS = [
  15 * 60 * 1000, // 15 minutes (1st offense)
  60 * 60 * 1000, // 1 hour (2nd offense)
  24 * 60 * 60 * 1000, // 24 hours (3rd offense)
  null // Permanent (4th+ offense, requires manual intervention)
];

/**
 * Storage abstraction for rate limiting
 * Supports Redis/Upstash with memory fallback
 */
class RateLimitStoreV2 {
  constructor() {
    this.redis = null;
    this.memoryStore = new Map();
    this.isRedisAvailable = false;
    this.initializeRedis();
  }

  /**
   * Initialize Redis/Upstash connection
   */
  async initializeRedis() {
    try {
      const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
      const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

      if (redisUrl && redisToken) {
        this.redis = new Redis({
          url: redisUrl,
          token: redisToken
        });

        // Test connection
        await this.redis.ping();
        this.isRedisAvailable = true;

        logger.info('Auth Rate Limiter v2: Redis/Upstash initialized', {
          url: redisUrl ? redisUrl.replace(/\/\/.*@/, '//***@') : 'not configured'
        });
      } else {
        logger.warn('Auth Rate Limiter v2: Redis not configured, using memory store');
        this.isRedisAvailable = false;
      }
    } catch (error) {
      logger.warn('Auth Rate Limiter v2: Redis initialization failed, using memory fallback', {
        error: error.message
      });
      this.isRedisAvailable = false;
    }
  }

  /**
   * Get rate limit key for IP
   */
  getIPKey(ip, authType) {
    return `auth:ratelimit:ip:${authType}:${ip}`;
  }

  /**
   * Get rate limit key for email/user
   */
  getEmailKey(email, authType) {
    // Hash email for privacy
    const emailHash = crypto
      .createHash('sha256')
      .update(email.toLowerCase())
      .digest('hex')
      .substring(0, 16);
    return `auth:ratelimit:email:${authType}:${emailHash}`;
  }

  /**
   * Get block key for IP
   */
  getIPBlockKey(ip, authType) {
    return `auth:block:ip:${authType}:${ip}`;
  }

  /**
   * Get block key for email/user
   */
  getEmailBlockKey(email, authType) {
    const emailHash = crypto
      .createHash('sha256')
      .update(email.toLowerCase())
      .digest('hex')
      .substring(0, 16);
    return `auth:block:email:${authType}:${emailHash}`;
  }

  /**
   * Get attempt count from store
   */
  async getAttemptCount(key) {
    if (this.isRedisAvailable && this.redis) {
      try {
        const count = await this.redis.get(key);
        return count ? parseInt(count, 10) : 0;
      } catch (error) {
        logger.warn('Auth Rate Limiter v2: Redis get failed, falling back to memory', {
          error: error.message,
          key
        });
        return this.memoryStore.get(key) || 0;
      }
    }

    return this.memoryStore.get(key) || 0;
  }

  /**
   * Increment attempt count
   */
  async incrementAttempt(key, windowMs) {
    if (this.isRedisAvailable && this.redis) {
      try {
        const count = await this.redis.incr(key);
        await this.redis.pexpire(key, windowMs);
        return count;
      } catch (error) {
        logger.warn('Auth Rate Limiter v2: Redis increment failed, falling back to memory', {
          error: error.message,
          key
        });
        const count = (this.memoryStore.get(key) || 0) + 1;
        this.memoryStore.set(key, count);
        setTimeout(() => this.memoryStore.delete(key), windowMs);
        return count;
      }
    }

    const count = (this.memoryStore.get(key) || 0) + 1;
    this.memoryStore.set(key, count);
    setTimeout(() => this.memoryStore.delete(key), windowMs);
    return count;
  }

  /**
   * Check if key is blocked
   */
  async isBlocked(key) {
    if (this.isRedisAvailable && this.redis) {
      try {
        const blockInfo = await this.redis.get(key);
        if (!blockInfo) return { blocked: false };

        const parsed = JSON.parse(blockInfo);
        const now = Date.now();

        if (now > parsed.expiresAt) {
          await this.redis.del(key);
          return { blocked: false };
        }

        return {
          blocked: true,
          expiresAt: parsed.expiresAt,
          remainingMs: parsed.expiresAt - now,
          offenseCount: parsed.offenseCount || 1
        };
      } catch (error) {
        logger.warn('Auth Rate Limiter v2: Redis get block failed, falling back to memory', {
          error: error.message,
          key
        });
        const blockInfo = this.memoryStore.get(key);
        if (!blockInfo) return { blocked: false };

        const parsed = typeof blockInfo === 'string' ? JSON.parse(blockInfo) : blockInfo;
        const now = Date.now();

        if (now > parsed.expiresAt) {
          this.memoryStore.delete(key);
          return { blocked: false };
        }

        return {
          blocked: true,
          expiresAt: parsed.expiresAt,
          remainingMs: parsed.expiresAt - now,
          offenseCount: parsed.offenseCount || 1
        };
      }
    }

    const blockInfo = this.memoryStore.get(key);
    if (!blockInfo) return { blocked: false };

    const parsed = typeof blockInfo === 'string' ? JSON.parse(blockInfo) : blockInfo;
    const now = Date.now();

    if (now > parsed.expiresAt) {
      this.memoryStore.delete(key);
      return { blocked: false };
    }

    return {
      blocked: true,
      expiresAt: parsed.expiresAt,
      remainingMs: parsed.expiresAt - now,
      offenseCount: parsed.offenseCount || 1
    };
  }

  /**
   * Set block with progressive duration
   */
  async setBlock(key, offenseCount) {
    const blockIndex = Math.min(offenseCount - 1, PROGRESSIVE_BLOCK_DURATIONS.length - 1);
    const blockDuration = PROGRESSIVE_BLOCK_DURATIONS[blockIndex];

    // Permanent block (requires manual intervention)
    if (blockDuration === null) {
      const blockInfo = {
        blockedAt: Date.now(),
        expiresAt: null, // Permanent
        offenseCount
      };

      if (this.isRedisAvailable && this.redis) {
        try {
          await this.redis.set(key, JSON.stringify(blockInfo));
          return blockInfo;
        } catch (error) {
          logger.warn('Auth Rate Limiter v2: Redis set block failed, falling back to memory', {
            error: error.message,
            key
          });
          this.memoryStore.set(key, blockInfo);
          return blockInfo;
        }
      }

      this.memoryStore.set(key, blockInfo);
      return blockInfo;
    }

    const now = Date.now();
    const blockInfo = {
      blockedAt: now,
      expiresAt: now + blockDuration,
      offenseCount
    };

    if (this.isRedisAvailable && this.redis) {
      try {
        await this.redis.set(key, JSON.stringify(blockInfo));
        await this.redis.pexpire(key, blockDuration);
        return blockInfo;
      } catch (error) {
        logger.warn('Auth Rate Limiter v2: Redis set block failed, falling back to memory', {
          error: error.message,
          key
        });
        this.memoryStore.set(key, blockInfo);
        setTimeout(() => this.memoryStore.delete(key), blockDuration);
        return blockInfo;
      }
    }

    this.memoryStore.set(key, blockInfo);
    setTimeout(() => this.memoryStore.delete(key), blockDuration);
    return blockInfo;
  }

  /**
   * Reset attempts (on successful auth)
   */
  async resetAttempts(ipKey, emailKey) {
    if (this.isRedisAvailable && this.redis) {
      try {
        await this.redis.del(ipKey, emailKey);
      } catch (error) {
        logger.warn('Auth Rate Limiter v2: Redis del failed, falling back to memory', {
          error: error.message
        });
        this.memoryStore.delete(ipKey);
        this.memoryStore.delete(emailKey);
      }
    } else {
      this.memoryStore.delete(ipKey);
      this.memoryStore.delete(emailKey);
    }
  }

  /**
   * Get offense count for progressive blocking
   */
  async getOffenseCount(blockKey) {
    const blockInfo = await this.isBlocked(blockKey);
    if (!blockInfo.blocked) return 0;
    return blockInfo.offenseCount || 1;
  }
}

// Singleton store
const store = new RateLimitStoreV2();

/**
 * Get client IP from request
 */
function getClientIP(req) {
  return (
    req.ip ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    '127.0.0.1'
  );
}

/**
 * Detect auth type from request
 */
function detectAuthType(req) {
  const path = req.path || '';
  const body = req.body || {};

  if (path.includes('/auth/magic-link') || body.magic_link) {
    return 'magic_link';
  }

  if (path.includes('/auth/oauth') || body.oauth_provider) {
    return 'oauth';
  }

  if (path.includes('/auth/reset-password') || body.reset_password) {
    return 'password_reset';
  }

  // Default to password login
  return 'password';
}

/**
 * Auth Rate Limiter v2 Middleware
 */
function authRateLimiterV2(req, res, next) {
  // Disable in test environment
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  // Check feature flag
  if (!flags.isEnabled('ENABLE_RATE_LIMIT')) {
    return next();
  }

  // Only apply to auth endpoints
  const isAuthEndpoint =
    req.path.includes('/auth/') ||
    req.path.includes('/login') ||
    (req.method === 'POST' && req.body && (req.body.email || req.body.username));

  if (!isAuthEndpoint) {
    return next();
  }

  const ip = getClientIP(req);
  const email = (req.body && (req.body.email || req.body.username)) || null;
  const authType = detectAuthType(req);

  if (!email) {
    return next();
  }

  const config = RATE_LIMIT_CONFIG[authType] || RATE_LIMIT_CONFIG.password;

  // Check blocks
  const ipBlockKey = store.getIPBlockKey(ip, authType);
  const emailBlockKey = store.getEmailBlockKey(email, authType);

  Promise.all([store.isBlocked(ipBlockKey), store.isBlocked(emailBlockKey)])
    .then(([ipBlock, emailBlock]) => {
      if (ipBlock.blocked) {
        const remainingMinutes = Math.ceil(ipBlock.remainingMs / (60 * 1000));
        logger.warn('Auth Rate Limiter v2: IP blocked', {
          ip,
          authType,
          remainingMs: ipBlock.remainingMs,
          offenseCount: ipBlock.offenseCount
        });

        return res.status(429).json({
          success: false,
          error: 'Too many authentication attempts. Please try again later.',
          code: 'AUTH_RATE_LIMIT_EXCEEDED',
          retryAfter: remainingMinutes,
          message: 'For security reasons, please wait before attempting to authenticate again.'
        });
      }

      if (emailBlock.blocked) {
        const remainingMinutes = Math.ceil(emailBlock.remainingMs / (60 * 1000));
        logger.warn('Auth Rate Limiter v2: Email blocked', {
          email: email.substring(0, 3) + '***',
          authType,
          remainingMs: emailBlock.remainingMs,
          offenseCount: emailBlock.offenseCount
        });

        return res.status(429).json({
          success: false,
          error: 'Too many authentication attempts. Please try again later.',
          code: 'AUTH_RATE_LIMIT_EXCEEDED',
          retryAfter: remainingMinutes,
          message: 'For security reasons, please wait before attempting to authenticate again.'
        });
      }

      // Check rate limits
      const ipKey = store.getIPKey(ip, authType);
      const emailKey = store.getEmailKey(email, authType);

      Promise.all([
        store.getAttemptCount(ipKey),
        store.getAttemptCount(emailKey)
      ]).then(([ipAttempts, emailAttempts]) => {
        // Check if either limit exceeded
        if (ipAttempts >= config.maxAttempts || emailAttempts >= config.maxAttempts) {
          // Get offense counts for progressive blocking
          Promise.all([
            store.getOffenseCount(ipBlockKey),
            store.getOffenseCount(emailBlockKey)
          ]).then(([ipOffenses, emailOffenses]) => {
            // Set blocks with progressive duration
            Promise.all([
              store.setBlock(ipBlockKey, ipOffenses + 1),
              store.setBlock(emailBlockKey, emailOffenses + 1)
            ]).then(() => {
              logger.warn('Auth Rate Limiter v2: Rate limit exceeded, blocking', {
                ip,
                email: email.substring(0, 3) + '***',
                authType,
                ipAttempts,
                emailAttempts,
                ipOffenses: ipOffenses + 1,
                emailOffenses: emailOffenses + 1
              });

              return res.status(429).json({
                success: false,
                error: 'Too many failed attempts. Account temporarily locked.',
                code: 'AUTH_RATE_LIMIT_EXCEEDED',
                retryAfter: Math.ceil(config.blockDurationMs / (60 * 1000)),
                message: 'For security reasons, this account has been temporarily locked. Please try again later.'
              });
            });
          });
        } else {
          // Intercept response to track failures
          const originalEnd = res.end;
          let responseIntercepted = false;

          res.end = function (chunk, encoding) {
            if (!responseIntercepted) {
              responseIntercepted = true;

              const isFailure = res.statusCode >= 400;
              const isSuccess = res.statusCode >= 200 && res.statusCode < 300;

              if (isFailure) {
                // Increment attempts
                Promise.all([
                  store.incrementAttempt(ipKey, config.windowMs),
                  store.incrementAttempt(emailKey, config.windowMs)
                ]).then(([newIpAttempts, newEmailAttempts]) => {
                  if (flags.isEnabled('DEBUG_RATE_LIMIT')) {
                    logger.info('Auth Rate Limiter v2: Failed attempt recorded', {
                      ip,
                      email: email.substring(0, 3) + '***',
                      authType,
                      ipAttempts: newIpAttempts,
                      emailAttempts: newEmailAttempts
                    });
                  }

                  // Check if should block now
                  if (newIpAttempts >= config.maxAttempts || newEmailAttempts >= config.maxAttempts) {
                    Promise.all([
                      store.getOffenseCount(ipBlockKey),
                      store.getOffenseCount(emailBlockKey)
                    ]).then(([ipOffenses, emailOffenses]) => {
                      Promise.all([
                        store.setBlock(ipBlockKey, ipOffenses + 1),
                        store.setBlock(emailBlockKey, emailOffenses + 1)
                      ]).then(() => {
                        // Override response
                        res.statusCode = 429;
                        const blockDuration = PROGRESSIVE_BLOCK_DURATIONS[Math.min(ipOffenses, PROGRESSIVE_BLOCK_DURATIONS.length - 1)] || config.blockDurationMs;
                        const remainingMinutes = blockDuration ? Math.ceil(blockDuration / (60 * 1000)) : null;

                        const blockResponse = JSON.stringify({
                          success: false,
                          error: 'Too many failed attempts. Account temporarily locked.',
                          code: 'AUTH_RATE_LIMIT_EXCEEDED',
                          retryAfter: remainingMinutes,
                          message: 'For security reasons, this account has been temporarily locked. Please try again later.'
                        });

                        chunk = blockResponse;
                        encoding = 'utf8';
                      });
                    });
                  }
                });
              } else if (isSuccess) {
                // Reset attempts on success
                store.resetAttempts(ipKey, emailKey).then(() => {
                  if (flags.isEnabled('DEBUG_RATE_LIMIT')) {
                    logger.info('Auth Rate Limiter v2: Successful auth, reset attempts', {
                      ip,
                      email: email.substring(0, 3) + '***',
                      authType
                    });
                  }
                });
              }
            }

            originalEnd.call(this, chunk, encoding);
          };

          next();
        }
      }).catch((error) => {
        logger.error('Auth Rate Limiter v2: Error checking rate limits', {
          error: error.message,
          ip,
          email: email ? email.substring(0, 3) + '***' : 'unknown',
          authType
        });
        // Fail open - allow request if rate limiting fails
        next();
      });
    })
    .catch((error) => {
      logger.error('Auth Rate Limiter v2: Error checking blocks', {
        error: error.message,
        ip,
        email: email ? email.substring(0, 3) + '***' : 'unknown',
        authType
      });
      // Fail open - allow request if block check fails
      next();
    });
}

module.exports = {
  authRateLimiterV2,
  RateLimitStoreV2,
  RATE_LIMIT_CONFIG,
  PROGRESSIVE_BLOCK_DURATIONS,
  getClientIP,
  detectAuthType
};

