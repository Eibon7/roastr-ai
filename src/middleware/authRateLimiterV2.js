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
const { detectAbuse } = require('../services/abuseDetectionService');
const auditLogService = require('../services/auditLogService');

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
   * ROA-359: FASE 6 - Ensure store is ready before middleware execution
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

        // Test connection with timeout
        const pingPromise = this.redis.ping();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redis ping timeout')), 5000)
        );
        
        await Promise.race([pingPromise, timeoutPromise]);
        this.isRedisAvailable = true;

        logger.info('Auth Rate Limiter v2: Redis/Upstash inicializado', {
          url: redisUrl ? redisUrl.replace(/\/\/.*@/, '//***@') : 'no configurado'
        });
      } else {
        logger.warn('Auth Rate Limiter v2: Redis no configurado, usando almacenamiento en memoria');
        this.isRedisAvailable = false;
      }
    } catch (error) {
      logger.warn('Auth Rate Limiter v2: Fallo en inicialización de Redis, usando fallback en memoria', {
        error: error.message
      });
      this.isRedisAvailable = false;
    }
  }
  
  /**
   * Check if store is ready (Redis initialized or memory fallback available)
   * ROA-359: FASE 6 - Explicit readiness check
   */
  isReady() {
    return this.isRedisAvailable || this.memoryStore !== null;
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
        logger.warn('Auth Rate Limiter v2: Error en Redis get, usando fallback en memoria', {
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
        logger.warn('Auth Rate Limiter v2: Error en Redis increment, usando fallback en memoria', {
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

        // ROA-359: Handle permanent blocks (expiresAt is null)
        if (parsed.expiresAt === null) {
          return {
            blocked: true,
            expiresAt: null,
            remainingMs: null,
            offenseCount: parsed.offenseCount || 1
          };
        }

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
        logger.warn('Auth Rate Limiter v2: Error en Redis get block, usando fallback en memoria', {
          error: error.message,
          key
        });
        const blockInfo = this.memoryStore.get(key);
        if (!blockInfo) return { blocked: false };

        const parsed = typeof blockInfo === 'string' ? JSON.parse(blockInfo) : blockInfo;
        const now = Date.now();

        // ROA-359: Handle permanent blocks (expiresAt is null)
        if (parsed.expiresAt === null) {
          return {
            blocked: true,
            expiresAt: null,
            remainingMs: null,
            offenseCount: parsed.offenseCount || 1
          };
        }

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

    // ROA-359: Handle permanent blocks (expiresAt is null)
    if (parsed.expiresAt === null) {
      return {
        blocked: true,
        expiresAt: null,
        remainingMs: null,
        offenseCount: parsed.offenseCount || 1
      };
    }

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
          logger.warn('Auth Rate Limiter v2: Error en Redis set block, usando fallback en memoria', {
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
          logger.warn('Auth Rate Limiter v2: Error en Redis set block, usando fallback en memoria', {
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
        logger.warn('Auth Rate Limiter v2: Error en Redis del, usando fallback en memoria', {
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
 * Metrics counter for rate limiting
 * ROA-359: AC5 - Internal metrics (logs/contadores)
 */
const metrics = {
  rateLimitHits: 0,
  blocksActive: 0,
  abuseEvents: 0,
  lastReset: Date.now(),
  
  incrementRateLimitHits() {
    this.rateLimitHits++;
    logger.debug('Auth Rate Limiter v2: Metric - rate_limit_hits_total', {
      value: this.rateLimitHits
    });
  },
  
  incrementBlocksActive() {
    this.blocksActive++;
    logger.debug('Auth Rate Limiter v2: Metric - auth_blocks_active', {
      value: this.blocksActive
    });
  },
  
  decrementBlocksActive() {
    this.blocksActive = Math.max(0, this.blocksActive - 1);
    logger.debug('Auth Rate Limiter v2: Metric - auth_blocks_active', {
      value: this.blocksActive
    });
  },
  
  incrementAbuseEvents() {
    this.abuseEvents++;
    logger.debug('Auth Rate Limiter v2: Metric - auth_abuse_events_total', {
      value: this.abuseEvents
    });
  },
  
  getMetrics() {
    return {
      auth_rate_limit_hits_total: this.rateLimitHits,
      auth_blocks_active: this.blocksActive,
      auth_abuse_events_total: this.abuseEvents,
      last_reset: this.lastReset
    };
  },
  
  reset() {
    this.rateLimitHits = 0;
    this.blocksActive = 0;
    this.abuseEvents = 0;
    this.lastReset = Date.now();
  }
};

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

  // ROA-359: FASE 6 - Check if store is ready
  if (!store.isReady()) {
    logger.warn('Auth Rate Limiter v2: Store no está listo, permitiendo request');
    return next();
  }

  // ROA-359: AC6 - Load configuration from SSOT (async, cached)
  Promise.all([
    getRateLimitConfig(),
    getProgressiveBlockDurations()
  ]).then(([rateLimitConfig, progressiveBlockDurations]) => {
    const config = rateLimitConfig[authType] || rateLimitConfig.password || FALLBACK_RATE_LIMIT_CONFIG.password;

    // ROA-359: AC2 - Detect abuse patterns (async, non-blocking)
    const abuseDetectionPromise = flags.isEnabled('ENABLE_ABUSE_DETECTION') !== false
      ? detectAbuse(ip, email, authType, {
          multiIPThreshold: 3,
          multiEmailThreshold: 5,
          burstThreshold: 10,
          slowAttackThreshold: 20
        })
      : Promise.resolve({ riskScore: 0, multiIPAbuse: false, multiEmailAbuse: false, burstAttack: false, slowAttack: false });

    // Check blocks
    const ipBlockKey = store.getIPBlockKey(ip, authType);
    const emailBlockKey = store.getEmailBlockKey(email, authType);

    return Promise.all([store.isBlocked(ipBlockKey), store.isBlocked(emailBlockKey), abuseDetectionPromise])
    .then(([ipBlock, emailBlock, abusePatterns]) => {
      // ROA-359: AC2 - If abuse detected with high risk, accelerate blocking
      if (abusePatterns.riskScore >= 50) {
        logger.warn('Auth Rate Limiter v2: Patrón de abuso detectado', {
          ip,
          email: email.substring(0, 3) + '***',
          authType,
          riskScore: abusePatterns.riskScore,
          patterns: {
            multiIP: abusePatterns.multiIPAbuse,
            multiEmail: abusePatterns.multiEmailAbuse,
            burst: abusePatterns.burstAttack,
            slow: abusePatterns.slowAttack
          }
        });
        
        // ROA-359: AC3 - Log abuse detection event
        auditLogService.logEvent('auth.abuse.detected', {
          ip,
          email: email.substring(0, 3) + '***',
          authType,
          riskScore: abusePatterns.riskScore,
          patterns: abusePatterns,
          requestId: req.id || crypto.randomUUID()
        }).catch(err => logger.error('Error logging abuse event', { error: err.message }));
        
        metrics.incrementAbuseEvents();
      }

      if (ipBlock.blocked) {
        // ROA-359: Check if block is permanent (expiresAt === null)
        const isPermanent = ipBlock.expiresAt === null;
        const remainingMinutes = isPermanent ? null : Math.ceil(ipBlock.remainingMs / (60 * 1000));
        
        logger.warn('Auth Rate Limiter v2: IP bloqueado', {
          ip,
          authType,
          remainingMs: ipBlock.remainingMs,
          offenseCount: ipBlock.offenseCount,
          isPermanent
        });

        // ROA-359: AC3 - Log block event
        auditLogService.logEvent('auth.rate_limit.blocked', {
          ip,
          email: email.substring(0, 3) + '***',
          authType,
          reason: 'ip_blocked',
          offenseCount: ipBlock.offenseCount,
          blockedUntil: isPermanent ? 'permanent' : (ipBlock.expiresAt ? new Date(ipBlock.expiresAt).toISOString() : null),
          source: 'ip',
          requestId: req.id || crypto.randomUUID()
        }).catch(err => logger.error('Error logging block event', { error: err.message }));

        const responseBody = {
          success: false,
          error: 'Demasiados intentos de autenticación. Por favor, inténtalo de nuevo más tarde.',
          code: 'AUTH_RATE_LIMIT_EXCEEDED',
          message: isPermanent
            ? 'Por razones de seguridad, esta IP ha sido bloqueada permanentemente. Contacta al soporte.'
            : 'Por razones de seguridad, por favor espera antes de intentar autenticarte de nuevo.'
        };

        // Only include retryAfter if not permanent
        if (!isPermanent && remainingMinutes !== null) {
          responseBody.retryAfter = remainingMinutes;
        }

        return res.status(429).json(responseBody);
      }

      if (emailBlock.blocked) {
        // ROA-359: Check if block is permanent (expiresAt === null)
        const isPermanent = emailBlock.expiresAt === null;
        const remainingMinutes = isPermanent ? null : Math.ceil(emailBlock.remainingMs / (60 * 1000));
        
        logger.warn('Auth Rate Limiter v2: Email bloqueado', {
          email: email.substring(0, 3) + '***',
          authType,
          remainingMs: emailBlock.remainingMs,
          offenseCount: emailBlock.offenseCount,
          isPermanent
        });

        // ROA-359: AC3 - Log block event
        auditLogService.logEvent('auth.rate_limit.blocked', {
          ip,
          email: email.substring(0, 3) + '***',
          authType,
          reason: 'email_blocked',
          offenseCount: emailBlock.offenseCount,
          blockedUntil: isPermanent ? 'permanent' : (emailBlock.expiresAt ? new Date(emailBlock.expiresAt).toISOString() : null),
          source: 'email',
          requestId: req.id || crypto.randomUUID()
        }).catch(err => logger.error('Error logging block event', { error: err.message }));

        const responseBody = {
          success: false,
          error: 'Demasiados intentos de autenticación. Por favor, inténtalo de nuevo más tarde.',
          code: 'AUTH_RATE_LIMIT_EXCEEDED',
          message: isPermanent
            ? 'Por razones de seguridad, esta cuenta ha sido bloqueada permanentemente. Contacta al soporte.'
            : 'Por razones de seguridad, por favor espera antes de intentar autenticarte de nuevo.'
        };

        // Only include retryAfter if not permanent
        if (!isPermanent && remainingMinutes !== null) {
          responseBody.retryAfter = remainingMinutes;
        }

        return res.status(429).json(responseBody);
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
              const newOffenseCount = ipOffenses + 1;
              
              // ROA-359: Calculate actual block duration from progressiveBlockDurations
              const blockDurationIndex = Math.min(newOffenseCount - 1, progressiveBlockDurations.length - 1);
              const blockDurationMs = progressiveBlockDurations[blockDurationIndex];
              const isPermanent = blockDurationMs === null;
              
              logger.warn('Auth Rate Limiter v2: Límite de rate excedido, bloqueando', {
                ip,
                email: email.substring(0, 3) + '***',
                authType,
                ipAttempts,
                emailAttempts,
                ipOffenses: newOffenseCount,
                emailOffenses: emailOffenses + 1,
                blockDurationMs: isPermanent ? 'permanent' : blockDurationMs,
                isPermanent
              });

              // ROA-359: AC3 - Log rate limit hit event
              auditLogService.logEvent('auth.rate_limit.hit', {
                ip,
                email: email.substring(0, 3) + '***',
                authType,
                ipAttempts,
                emailAttempts,
                offenseCount: newOffenseCount,
                requestId: req.id || crypto.randomUUID()
              }).catch(err => logger.error('Error logging rate limit hit', { error: err.message }));

              // ROA-359: AC3 - Log block event
              auditLogService.logEvent('auth.rate_limit.blocked', {
                ip,
                email: email.substring(0, 3) + '***',
                authType,
                reason: 'rate_limit_exceeded',
                offenseCount: newOffenseCount,
                blockedUntil: isPermanent 
                  ? 'permanent'
                  : new Date(Date.now() + blockDurationMs).toISOString(),
                source: 'rate_limit',
                requestId: req.id || crypto.randomUUID()
              }).catch(err => logger.error('Error logging block event', { error: err.message }));

              // ROA-359: AC5 - Update metrics
              metrics.incrementRateLimitHits();
              metrics.incrementBlocksActive();

              // ROA-359: Calculate retryAfter from actual block duration (not config.blockDurationMs)
              const retryAfterMinutes = isPermanent 
                ? undefined // Don't include retryAfter for permanent blocks
                : Math.ceil(blockDurationMs / (60 * 1000));

              const responseBody = {
                success: false,
                error: 'Demasiados intentos fallidos. Cuenta temporalmente bloqueada.',
                code: 'AUTH_RATE_LIMIT_EXCEEDED',
                message: isPermanent
                  ? 'Por razones de seguridad, esta cuenta ha sido bloqueada permanentemente. Contacta al soporte.'
                  : 'Por razones de seguridad, esta cuenta ha sido temporalmente bloqueada. Por favor, inténtalo de nuevo más tarde.'
              };

              // Only include retryAfter if not permanent
              if (!isPermanent) {
                responseBody.retryAfter = retryAfterMinutes;
              }

              return res.status(429).json(responseBody);
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

                  // ROA-359: AC2 - Check abuse patterns if enabled
                  if (flags.isEnabled('ENABLE_ABUSE_DETECTION') !== false) {
                    detectAbuse(ip, email, authType).then(abusePatterns => {
                      if (abusePatterns.riskScore >= 50) {
                        // Accelerate blocking for high-risk abuse
                        logger.warn('Auth Rate Limiter v2: Abuso detectado, acelerando bloqueo', {
                          ip,
                          email: email.substring(0, 3) + '***',
                          authType,
                          riskScore: abusePatterns.riskScore
                        });
                        
                        auditLogService.logEvent('auth.abuse.detected', {
                          ip,
                          email: email.substring(0, 3) + '***',
                          authType,
                          riskScore: abusePatterns.riskScore,
                          patterns: abusePatterns,
                          requestId: req.id || crypto.randomUUID()
                        }).catch(err => logger.error('Error logging abuse event', { error: err.message }));
                        
                        metrics.incrementAbuseEvents();
                      }
                    }).catch(err => logger.error('Error in abuse detection', { error: err.message }));
                  }

                  // Check if should block now
                  if (newIpAttempts >= config.maxAttempts || newEmailAttempts >= config.maxAttempts) {
                    Promise.all([
                      store.getOffenseCount(ipBlockKey),
                      store.getOffenseCount(emailBlockKey)
                    ]).then(([ipOffenses, emailOffenses]) => {
                      const newOffenseCount = ipOffenses + 1;
                      Promise.all([
                        store.setBlock(ipBlockKey, newOffenseCount, progressiveBlockDurations),
                        store.setBlock(emailBlockKey, emailOffenses + 1, progressiveBlockDurations)
                      ]).then(() => {
                        // ROA-359: AC3 - Log rate limit hit
                        auditLogService.logEvent('auth.rate_limit.hit', {
                          ip,
                          email: email.substring(0, 3) + '***',
                          authType,
                          ipAttempts: newIpAttempts,
                          emailAttempts: newEmailAttempts,
                          offenseCount: newOffenseCount,
                          requestId: req.id || crypto.randomUUID()
                        }).catch(err => logger.error('Error logging rate limit hit', { error: err.message }));

                        // ROA-359: AC3 - Log block event
                        auditLogService.logEvent('auth.rate_limit.blocked', {
                          ip,
                          email: email.substring(0, 3) + '***',
                          authType,
                          reason: 'rate_limit_exceeded',
                          offenseCount: newOffenseCount,
                          blockedUntil: progressiveBlockDurations[Math.min(newOffenseCount - 1, progressiveBlockDurations.length - 1)]
                            ? new Date(Date.now() + (progressiveBlockDurations[Math.min(newOffenseCount - 1, progressiveBlockDurations.length - 1)] || config.blockDurationMs)).toISOString()
                            : 'permanent',
                          source: 'rate_limit',
                          requestId: req.id || crypto.randomUUID()
                        }).catch(err => logger.error('Error logging block event', { error: err.message }));

                        // ROA-359: AC5 - Update metrics
                        metrics.incrementRateLimitHits();
                        metrics.incrementBlocksActive();

                        // Override response (ROA-359: AC6 - use SSOT config)
                        res.statusCode = 429;
                        const blockDurationIndex = Math.min(ipOffenses, progressiveBlockDurations.length - 1);
                        const blockDuration = progressiveBlockDurations[blockDurationIndex];
                        const isPermanent = blockDuration === null;
                        const remainingMinutes = isPermanent ? null : (blockDuration ? Math.ceil(blockDuration / (60 * 1000)) : null);

                        const blockResponseObj = {
                          success: false,
                          error: 'Demasiados intentos fallidos. Cuenta temporalmente bloqueada.',
                          code: 'AUTH_RATE_LIMIT_EXCEEDED',
                          message: isPermanent
                            ? 'Por razones de seguridad, esta cuenta ha sido bloqueada permanentemente. Contacta al soporte.'
                            : 'Por razones de seguridad, esta cuenta ha sido temporalmente bloqueada. Por favor, inténtalo de nuevo más tarde.'
                        };

                        // Only include retryAfter if not permanent
                        if (!isPermanent && remainingMinutes !== null) {
                          blockResponseObj.retryAfter = remainingMinutes;
                        }

                        const blockResponse = JSON.stringify(blockResponseObj);

                        chunk = blockResponse;
                        encoding = 'utf8';
                      });
                    });
                  }
                });
              } else if (isSuccess) {
                // Reset attempts on success
                store.resetAttempts(ipKey, emailKey).then(() => {
                  // ROA-359: AC3 - Log unblock event if was previously blocked
                  Promise.all([store.isBlocked(ipBlockKey), store.isBlocked(emailBlockKey)])
                    .then(([ipBlock, emailBlock]) => {
                      if (ipBlock.blocked || emailBlock.blocked) {
                        auditLogService.logEvent('auth.rate_limit.unblocked', {
                          ip,
                          email: email.substring(0, 3) + '***',
                          authType,
                          reason: 'successful_auth',
                          requestId: req.id || crypto.randomUUID()
                        }).catch(err => logger.error('Error logging unblock event', { error: err.message }));
                        
                        metrics.decrementBlocksActive();
                      }
                    })
                    .catch(() => {}); // Ignore errors in unblock check

                  if (flags.isEnabled('DEBUG_RATE_LIMIT')) {
                    logger.info('Auth Rate Limiter v2: Autenticación exitosa, intentos reseteados', {
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
        logger.error('Auth Rate Limiter v2: Error verificando límites de rate', {
          error: error.message,
          ip,
          email: email ? email.substring(0, 3) + '***' : 'unknown',
          authType
        });
        // Fail open - allow request if rate limiting fails
        next();
      });
      }).catch((error) => {
        logger.error('Auth Rate Limiter v2: Error cargando configuración desde SSOT', {
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
      logger.error('Auth Rate Limiter v2: Error verificando bloques', {
        error: error.message,
        ip,
        email: email ? email.substring(0, 3) + '***' : 'unknown',
        authType
      });
      // Fail open - allow request if block check fails
      next();
    });
}

/**
 * Get metrics for monitoring
 * ROA-359: AC5 - Expose internal metrics
 */
function getMetrics() {
  return metrics.getMetrics();
}

module.exports = {
  authRateLimiterV2,
  RateLimitStoreV2,
  getRateLimitConfig,
  getProgressiveBlockDurations,
  invalidateConfigCache,
  getMetrics,
  FALLBACK_RATE_LIMIT_CONFIG,
  FALLBACK_PROGRESSIVE_BLOCK_DURATIONS,
  getClientIP,
  detectAuthType
};

