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
const settingsLoader = require('../services/settingsLoaderV2');

/**
 * Fallback rate limit configuration (used only if SSOT is unavailable)
 * ROA-359: AC6 - These are fallbacks, not active values
 */
const FALLBACK_RATE_LIMIT_CONFIG = {
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
 * Fallback progressive block durations (used only if SSOT is unavailable)
 * ROA-359: AC6 - These are fallbacks, not active values
 */
const FALLBACK_PROGRESSIVE_BLOCK_DURATIONS = [
  15 * 60 * 1000, // 15 minutes (1st offense)
  60 * 60 * 1000, // 1 hour (2nd offense)
  24 * 60 * 60 * 1000, // 24 hours (3rd offense)
  null // Permanent (4th+ offense, requires manual intervention)
];

/**
 * Load rate limit configuration from SSOT v2
 * ROA-359: AC6 - Configuration loaded from SSOT, no hardcoded values
 * @returns {Promise<Object>} Rate limit configuration
 */
async function loadRateLimitConfig() {
  try {
    const config = await settingsLoader.getValue('rate_limit.auth');
    if (config && typeof config === 'object') {
      logger.debug('Auth Rate Limiter v2: Configuration loaded from SSOT');
      return config;
    }
    logger.warn('Auth Rate Limiter v2: SSOT config not found, using fallback');
    return FALLBACK_RATE_LIMIT_CONFIG;
  } catch (error) {
    logger.error('Auth Rate Limiter v2: Error loading config from SSOT, using fallback', {
      error: error.message
    });
    return FALLBACK_RATE_LIMIT_CONFIG;
  }
}

/**
 * Load progressive block durations from SSOT v2
 * ROA-359: AC6 - Configuration loaded from SSOT, no hardcoded values
 * @returns {Promise<Array>} Progressive block durations
 */
async function loadProgressiveBlockDurations() {
  try {
    const durations = await settingsLoader.getValue('rate_limit.auth.block_durations');
    if (Array.isArray(durations) && durations.length > 0) {
      logger.debug('Auth Rate Limiter v2: Block durations loaded from SSOT');
      return durations;
    }
    logger.warn('Auth Rate Limiter v2: SSOT block durations not found, using fallback');
    return FALLBACK_PROGRESSIVE_BLOCK_DURATIONS;
  } catch (error) {
    logger.error('Auth Rate Limiter v2: Error loading block durations from SSOT, using fallback', {
      error: error.message
    });
    return FALLBACK_PROGRESSIVE_BLOCK_DURATIONS;
  }
}

// Cache for loaded configuration (reload on cache invalidation)
let cachedRateLimitConfig = null;
let cachedBlockDurations = null;
let configLoadPromise = null;
let blockDurationsLoadPromise = null;

/**
 * Get rate limit configuration (with caching)
 * ROA-359: AC6 - Loads from SSOT, caches for performance
 */
async function getRateLimitConfig() {
  if (cachedRateLimitConfig) {
    return cachedRateLimitConfig;
  }
  if (!configLoadPromise) {
    configLoadPromise = loadRateLimitConfig().then(config => {
      cachedRateLimitConfig = config;
      configLoadPromise = null;
      return config;
    });
  }
  return configLoadPromise;
}

/**
 * Get progressive block durations (with caching)
 * ROA-359: AC6 - Loads from SSOT, caches for performance
 */
async function getProgressiveBlockDurations() {
  if (cachedBlockDurations) {
    return cachedBlockDurations;
  }
  if (!blockDurationsLoadPromise) {
    blockDurationsLoadPromise = loadProgressiveBlockDurations().then(durations => {
      cachedBlockDurations = durations;
      blockDurationsLoadPromise = null;
      return durations;
    });
  }
  return blockDurationsLoadPromise;
}

/**
 * Invalidate configuration cache (call when SSOT changes)
 * ROA-359: AC6 - Allows hot-reload of configuration
 */
function invalidateConfigCache() {
  cachedRateLimitConfig = null;
  cachedBlockDurations = null;
  configLoadPromise = null;
  blockDurationsLoadPromise = null;
  settingsLoader.invalidateCache();
}

/**
 * Storage abstraction for rate limiting
 * Supports Redis/Upstash with memory fallback
 */
class RateLimitStoreV2 {
  constructor() {
    this.redis = null;
    this.memoryStore = new Map();
    this.isRedisAvailable = false;
    // ROA-359: Timer registry to prevent memory leaks
    this.attemptTimers = new Map(); // Track timers for attempt keys
    this.blockTimers = new Map(); // Track timers for block keys
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
   * ROA-359: Memory leak fix - tracks timers to prevent leaks
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
        
        // ROA-359: Clear existing timer before creating new one
        if (this.attemptTimers.has(key)) {
          clearTimeout(this.attemptTimers.get(key));
        }
        
        const timer = setTimeout(() => {
          this.memoryStore.delete(key);
          this.attemptTimers.delete(key);
        }, windowMs);
        
        this.attemptTimers.set(key, timer);
        return count;
      }
    }

    const count = (this.memoryStore.get(key) || 0) + 1;
    this.memoryStore.set(key, count);
    
    // ROA-359: Clear existing timer before creating new one
    if (this.attemptTimers.has(key)) {
      clearTimeout(this.attemptTimers.get(key));
    }
    
    const timer = setTimeout(() => {
      this.memoryStore.delete(key);
      this.attemptTimers.delete(key);
    }, windowMs);
    
    this.attemptTimers.set(key, timer);
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
   * ROA-359: Memory leak fix - tracks timers to prevent leaks
   */
  async setBlock(key, offenseCount, progressiveBlockDurations) {
    const blockIndex = Math.min(offenseCount - 1, progressiveBlockDurations.length - 1);
    const blockDuration = progressiveBlockDurations[blockIndex];

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
          
          // ROA-359: Clear existing timer before creating new one
          if (this.blockTimers.has(key)) {
            clearTimeout(this.blockTimers.get(key));
          }
          
          const timer = setTimeout(() => {
            this.memoryStore.delete(key);
            this.blockTimers.delete(key);
          }, blockDuration);
          
          this.blockTimers.set(key, timer);
        return blockInfo;
      }
    }

    this.memoryStore.set(key, blockInfo);
      
      // ROA-359: Clear existing timer before creating new one
      if (this.blockTimers.has(key)) {
        clearTimeout(this.blockTimers.get(key));
      }
      
      const timer = setTimeout(() => {
        this.memoryStore.delete(key);
        this.blockTimers.delete(key);
      }, blockDuration);
      
      this.blockTimers.set(key, timer);
    return blockInfo;
  }

  /**
   * Reset attempts (on successful auth)
   * ROA-359: Memory leak fix - cleans up timers when resetting
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
        
        // ROA-359: Clean up timers
        if (this.attemptTimers.has(ipKey)) {
          clearTimeout(this.attemptTimers.get(ipKey));
          this.attemptTimers.delete(ipKey);
        }
        if (this.attemptTimers.has(emailKey)) {
          clearTimeout(this.attemptTimers.get(emailKey));
          this.attemptTimers.delete(emailKey);
        }
      }
    } else {
      this.memoryStore.delete(ipKey);
      this.memoryStore.delete(emailKey);
      
      // ROA-359: Clean up timers
      if (this.attemptTimers.has(ipKey)) {
        clearTimeout(this.attemptTimers.get(ipKey));
        this.attemptTimers.delete(ipKey);
      }
      if (this.attemptTimers.has(emailKey)) {
        clearTimeout(this.attemptTimers.get(emailKey));
        this.attemptTimers.delete(emailKey);
      }
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
  if (!req) {
    return '127.0.0.1';
  }
  
  return (
    req.ip ||
    (req.headers && req.headers['x-forwarded-for']?.split(',')[0]?.trim()) ||
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

  // ROA-359: AC6 - Load configuration from SSOT (async, cached)
  Promise.all([
    getRateLimitConfig(),
    getProgressiveBlockDurations()
  ]).then(([rateLimitConfig, progressiveBlockDurations]) => {
    const config = rateLimitConfig[authType] || rateLimitConfig.password || FALLBACK_RATE_LIMIT_CONFIG.password;

  // Check blocks
  const ipBlockKey = store.getIPBlockKey(ip, authType);
  const emailBlockKey = store.getEmailBlockKey(email, authType);

    return Promise.all([store.isBlocked(ipBlockKey), store.isBlocked(emailBlockKey)])
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
            // Set blocks with progressive duration (ROA-359: AC6 - use SSOT config)
            Promise.all([
              store.setBlock(ipBlockKey, ipOffenses + 1, progressiveBlockDurations),
              store.setBlock(emailBlockKey, emailOffenses + 1, progressiveBlockDurations)
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
                        store.setBlock(ipBlockKey, ipOffenses + 1, progressiveBlockDurations),
                        store.setBlock(emailBlockKey, emailOffenses + 1, progressiveBlockDurations)
                      ]).then(() => {
                        // Override response (ROA-359: AC6 - use SSOT config)
                        res.statusCode = 429;
                        const blockDuration = progressiveBlockDurations[Math.min(ipOffenses, progressiveBlockDurations.length - 1)] || config.blockDurationMs;
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
      }).catch((error) => {
        logger.error('Auth Rate Limiter v2: Error loading configuration from SSOT', {
          error: error.message,
          ip,
          email: email ? email.substring(0, 3) + '***' : 'unknown',
          authType
        });
        // Fail open - allow request if config loading fails
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
  getRateLimitConfig,
  getProgressiveBlockDurations,
  invalidateConfigCache,
  FALLBACK_RATE_LIMIT_CONFIG,
  FALLBACK_PROGRESSIVE_BLOCK_DURATIONS,
  getClientIP,
  detectAuthType
};

