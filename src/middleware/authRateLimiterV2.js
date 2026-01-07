/**
 * Auth Rate Limiting v2 - ROA-359
 *
 * Enhanced rate limiting and abuse policy for authentication endpoints:
 * - Rate limiting by auth type (password, magic link, OAuth)
 * - Rate limiting by IP and email/user independently
 * - Redis/Upstash storage with memory fallback
 * - Progressive blocking (15min → 1h → 24h → permanent)
 * - Abuse detection and scoring
 *
 * ROA-359: Refactored to be deterministic and synchronous
 * - Pre-auth middleware: checks blocks BEFORE route execution
 * - Post-auth middleware: processes results AFTER route execution
 * - No res.end interception
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
 * Fallback abuse detection thresholds (used only if SSOT is unavailable)
 * ROA-359: These are fallbacks, not active values
 */
const FALLBACK_ABUSE_DETECTION_THRESHOLDS = {
  multi_ip: 3,
  multi_email: 5,
  burst: 10,
  slow_attack: 20
};

/**
 * Auth failure codes that should be counted as authentication failures
 * ROA-359: Only specific auth errors count, not 5xx or infrastructure errors
 */
const AUTH_FAILURE_CODES = [
  'INVALID_CREDENTIALS',
  'INVALID_TOKEN',
  'UNAUTHORIZED',
  'AUTH_FAILED',
  'WRONG_EMAIL_OR_PASSWORD'
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

/**
 * Load abuse detection thresholds from SSOT v2
 * ROA-359: Configuration loaded from SSOT, no hardcoded values
 * @returns {Promise<Object>} Abuse detection thresholds
 */
async function getAbuseDetectionConfig() {
  try {
    const thresholds = await settingsLoader.getValue('abuse_detection.thresholds');
    if (thresholds && typeof thresholds === 'object') {
      // Ensure all required thresholds are present, use fallback for missing ones
      const config = {
        multi_ip: thresholds.multi_ip ?? FALLBACK_ABUSE_DETECTION_THRESHOLDS.multi_ip,
        multi_email: thresholds.multi_email ?? FALLBACK_ABUSE_DETECTION_THRESHOLDS.multi_email,
        burst: thresholds.burst ?? FALLBACK_ABUSE_DETECTION_THRESHOLDS.burst,
        slow_attack: thresholds.slow_attack ?? FALLBACK_ABUSE_DETECTION_THRESHOLDS.slow_attack
      };
      
      logger.debug('Auth Rate Limiter v2: Abuse detection thresholds loaded from SSOT');
      return config;
    }
    logger.warn('Auth Rate Limiter v2: SSOT abuse detection thresholds not found, using fallback');
    return FALLBACK_ABUSE_DETECTION_THRESHOLDS;
  } catch (error) {
    logger.error('Auth Rate Limiter v2: Error loading abuse detection thresholds from SSOT, using fallback', {
      error: error.message
    });
    return FALLBACK_ABUSE_DETECTION_THRESHOLDS;
  }
}

// Cache for configurations
let cachedRateLimitConfig = null;
let cachedBlockDurations = null;
let cachedAbuseDetectionConfig = null;
let configCacheTimestamp = null;
const CONFIG_CACHE_TTL = 60000; // 1 minute

/**
 * Get cached or load rate limit config
 */
async function getRateLimitConfig() {
  const now = Date.now();
  if (cachedRateLimitConfig && configCacheTimestamp && (now - configCacheTimestamp) < CONFIG_CACHE_TTL) {
    return cachedRateLimitConfig;
  }
  cachedRateLimitConfig = await loadRateLimitConfig();
  configCacheTimestamp = now;
  return cachedRateLimitConfig;
}

/**
 * Get cached or load progressive block durations
 */
async function getProgressiveBlockDurations() {
  const now = Date.now();
  if (cachedBlockDurations && configCacheTimestamp && (now - configCacheTimestamp) < CONFIG_CACHE_TTL) {
    return cachedBlockDurations;
  }
  cachedBlockDurations = await loadProgressiveBlockDurations();
  configCacheTimestamp = now;
  return cachedBlockDurations;
}

/**
 * Get cached or load abuse detection config
 */
async function getAbuseDetectionConfigCached() {
  const now = Date.now();
  if (cachedAbuseDetectionConfig && configCacheTimestamp && (now - configCacheTimestamp) < CONFIG_CACHE_TTL) {
    return cachedAbuseDetectionConfig;
  }
  cachedAbuseDetectionConfig = await getAbuseDetectionConfig();
  configCacheTimestamp = now;
  return cachedAbuseDetectionConfig;
}

/**
 * Invalidate config cache
 */
function invalidateConfigCache() {
  cachedRateLimitConfig = null;
  cachedBlockDurations = null;
  cachedAbuseDetectionConfig = null;
  configCacheTimestamp = null;
}

/**
 * Rate Limit Store v2
 * ROA-359: Memory leak fix - tracks timers to prevent leaks
 */
class RateLimitStoreV2 {
  constructor() {
    this.redis = null;
    this.isRedisAvailable = false;
    this.memoryStore = new Map();
    this.attemptTimers = new Map(); // Track attempt cleanup timers
    this.blockTimers = new Map(); // Track block cleanup timers
    this.init();
  }

  async init() {
    try {
      if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        this.redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN
        });
        await this.redis.ping();
        this.isRedisAvailable = true;
        logger.info('Auth Rate Limiter v2: Redis/Upstash connected');
      } else {
        logger.warn('Auth Rate Limiter v2: Redis not configured, using memory fallback');
      }
    } catch (error) {
      logger.warn('Auth Rate Limiter v2: Redis connection failed, using memory fallback', {
        error: error.message
      });
      this.isRedisAvailable = false;
    }
  }

  isReady() {
    return this.isRedisAvailable || this.memoryStore !== null;
  }

  getIPKey(ip, authType) {
    return `auth:ratelimit:ip:${authType}:${ip}`;
  }

  getEmailKey(email, authType) {
    const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
    return `auth:ratelimit:email:${authType}:${emailHash}`;
  }

  getIPBlockKey(ip, authType) {
    return `auth:block:ip:${authType}:${ip}`;
  }

  getEmailBlockKey(email, authType) {
    const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
    return `auth:block:email:${authType}:${emailHash}`;
  }

  async getAttemptCount(key) {
    if (this.isRedisAvailable && this.redis) {
      try {
        const count = await this.redis.get(key);
        return count ? parseInt(count, 10) : 0;
      } catch (error) {
        logger.warn('Auth Rate Limiter v2: Redis get failed', { error: error.message });
        return this.memoryStore.get(key) || 0;
      }
    }
    return this.memoryStore.get(key) || 0;
  }

  async incrementAttempt(key, windowMs) {
    if (this.isRedisAvailable && this.redis) {
      try {
        const count = await this.redis.incr(key);
        await this.redis.pexpire(key, windowMs);
        return count;
      } catch (error) {
        logger.warn('Auth Rate Limiter v2: Redis increment failed', { error: error.message });
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

  async resetAttempts(ipKey, emailKey) {
    if (this.isRedisAvailable && this.redis) {
      try {
        await Promise.all([this.redis.del(ipKey), this.redis.del(emailKey)]);
      } catch (error) {
        logger.warn('Auth Rate Limiter v2: Redis reset failed', { error: error.message });
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

  async getOffenseCount(blockKey) {
    if (this.isRedisAvailable && this.redis) {
      try {
        const data = await this.redis.get(blockKey);
        if (!data) return 0;
        const parsed = JSON.parse(data);
        return parsed.offenseCount || 0;
      } catch (error) {
        logger.warn('Auth Rate Limiter v2: Redis get offense failed', { error: error.message });
        const data = this.memoryStore.get(blockKey);
        if (!data) return 0;
        const parsed = JSON.parse(data);
        return parsed.offenseCount || 0;
      }
    }
    const data = this.memoryStore.get(blockKey);
    if (!data) return 0;
    const parsed = JSON.parse(data);
    return parsed.offenseCount || 0;
  }

  async setBlock(blockKey, offenseCount, progressiveBlockDurations) {
    const blockDurationIndex = Math.min(offenseCount - 1, progressiveBlockDurations.length - 1);
    const blockDurationMs = progressiveBlockDurations[blockDurationIndex];
    const isPermanent = blockDurationMs === null;
    const expiresAt = isPermanent ? null : Date.now() + blockDurationMs;

    const blockData = {
      blocked: true,
      offenseCount,
      expiresAt,
      createdAt: Date.now()
    };

    if (this.isRedisAvailable && this.redis) {
      try {
        if (isPermanent) {
          await this.redis.set(blockKey, JSON.stringify(blockData));
        } else {
          await this.redis.set(blockKey, JSON.stringify(blockData), { px: blockDurationMs });
        }
      } catch (error) {
        logger.warn('Auth Rate Limiter v2: Redis set block failed', { error: error.message });
        this.memoryStore.set(blockKey, JSON.stringify(blockData));
        
        // ROA-359: Clear existing timer before creating new one
        if (this.blockTimers.has(blockKey)) {
          clearTimeout(this.blockTimers.get(blockKey));
        }
        
        if (!isPermanent) {
          const timer = setTimeout(() => {
            this.memoryStore.delete(blockKey);
            this.blockTimers.delete(blockKey);
          }, blockDurationMs);
          this.blockTimers.set(blockKey, timer);
        }
      }
    } else {
      this.memoryStore.set(blockKey, JSON.stringify(blockData));
      
      // ROA-359: Clear existing timer before creating new one
      if (this.blockTimers.has(blockKey)) {
        clearTimeout(this.blockTimers.get(blockKey));
      }
      
      if (!isPermanent) {
        const timer = setTimeout(() => {
          this.memoryStore.delete(blockKey);
          this.blockTimers.delete(blockKey);
        }, blockDurationMs);
        this.blockTimers.set(blockKey, timer);
      }
    }
  }

  async isBlocked(blockKey) {
    if (this.isRedisAvailable && this.redis) {
      try {
        const data = await this.redis.get(blockKey);
        if (!data) {
          return { blocked: false, expiresAt: null, remainingMs: 0, offenseCount: 0 };
        }
        const parsed = JSON.parse(data);
        const now = Date.now();
        
        // ROA-359: Permanent block (expiresAt === null)
        if (parsed.expiresAt === null) {
          return {
            blocked: true,
            expiresAt: null,
            remainingMs: null,
            offenseCount: parsed.offenseCount || 0
          };
        }
        
        if (now < parsed.expiresAt) {
          return {
            blocked: true,
            expiresAt: parsed.expiresAt,
            remainingMs: parsed.expiresAt - now,
            offenseCount: parsed.offenseCount || 0
          };
        }
        return { blocked: false, expiresAt: null, remainingMs: 0, offenseCount: 0 };
      } catch (error) {
        logger.warn('Auth Rate Limiter v2: Redis get block failed', { error: error.message });
        const data = this.memoryStore.get(blockKey);
        if (!data) {
          return { blocked: false, expiresAt: null, remainingMs: 0, offenseCount: 0 };
        }
        const parsed = JSON.parse(data);
        const now = Date.now();
        
        // ROA-359: Permanent block (expiresAt === null)
        if (parsed.expiresAt === null) {
          return {
            blocked: true,
            expiresAt: null,
            remainingMs: null,
            offenseCount: parsed.offenseCount || 0
          };
        }
        
        if (now < parsed.expiresAt) {
          return {
            blocked: true,
            expiresAt: parsed.expiresAt,
            remainingMs: parsed.expiresAt - now,
            offenseCount: parsed.offenseCount || 0
          };
        }
        return { blocked: false, expiresAt: null, remainingMs: 0, offenseCount: 0 };
      }
    }
    
    const data = this.memoryStore.get(blockKey);
    if (!data) {
      return { blocked: false, expiresAt: null, remainingMs: 0, offenseCount: 0 };
    }
    const parsed = JSON.parse(data);
    const now = Date.now();
    
    // ROA-359: Permanent block (expiresAt === null)
    if (parsed.expiresAt === null) {
      return {
        blocked: true,
        expiresAt: null,
        remainingMs: null,
        offenseCount: parsed.offenseCount || 0
      };
    }
    
    if (now < parsed.expiresAt) {
      return {
        blocked: true,
        expiresAt: parsed.expiresAt,
        remainingMs: parsed.expiresAt - now,
        offenseCount: parsed.offenseCount || 0
      };
    }
    return { blocked: false, expiresAt: null, remainingMs: 0, offenseCount: 0 };
  }
}

const store = new RateLimitStoreV2();

/**
 * Metrics tracking
 */
const metrics = {
  rateLimitHits: 0,
  blocksActive: 0,
  abuseEvents: 0,
  incrementRateLimitHits() {
    this.rateLimitHits++;
  },
  incrementBlocksActive() {
    this.blocksActive++;
  },
  decrementBlocksActive() {
    this.blocksActive = Math.max(0, this.blocksActive - 1);
  },
  incrementAbuseEvents() {
    this.abuseEvents++;
  },
  getMetrics() {
    return {
      auth_rate_limit_hits_total: this.rateLimitHits,
      auth_blocks_active: this.blocksActive,
      auth_abuse_events_total: this.abuseEvents
    };
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
 * Check if error code indicates auth failure
 * ROA-359: Only specific auth errors count, not 5xx or infrastructure errors
 */
function isAuthFailure(errorCode, statusCode) {
  // Don't count 5xx errors as auth failures
  if (statusCode >= 500) {
    return false;
  }
  
  // Check if error code is in the list of auth failure codes
  if (errorCode && AUTH_FAILURE_CODES.includes(errorCode)) {
    return true;
  }
  
  // Check status code 401 (Unauthorized) - but only if not 5xx
  if (statusCode === 401) {
    return true;
  }
  
  return false;
}

/**
 * Pre-Auth Middleware: Check blocks BEFORE route execution
 * ROA-359: Deterministic, synchronous block checking
 */
async function authRateLimiterV2Pre(req, res, next) {
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

  try {
    // ROA-359: AC6 - Load configuration from SSOT (async, cached)
    const [rateLimitConfig, progressiveBlockDurations, abuseDetectionConfig] = await Promise.all([
      getRateLimitConfig(),
      getProgressiveBlockDurations(),
      getAbuseDetectionConfigCached()
    ]);

    const config = rateLimitConfig[authType] || rateLimitConfig.password || FALLBACK_RATE_LIMIT_CONFIG.password;

    // Check blocks
    const ipBlockKey = store.getIPBlockKey(ip, authType);
    const emailBlockKey = store.getEmailBlockKey(email, authType);

    const [ipBlock, emailBlock] = await Promise.all([
      store.isBlocked(ipBlockKey),
      store.isBlocked(emailBlockKey)
    ]);

    // ROA-359: AC2 - Detect abuse patterns (async, non-blocking, but we wait for it)
    let abusePatterns = { riskScore: 0, multiIPAbuse: false, multiEmailAbuse: false, burstAttack: false, slowAttack: false };
    if (flags.isEnabled('ENABLE_ABUSE_DETECTION') !== false) {
      try {
        abusePatterns = await detectAbuse(ip, email, authType, {
          multiIPThreshold: abuseDetectionConfig.multi_ip,
          multiEmailThreshold: abuseDetectionConfig.multi_email,
          burstThreshold: abuseDetectionConfig.burst,
          slowAttackThreshold: abuseDetectionConfig.slow_attack
        });
        
        // ROA-359: AC2 - If abuse detected with high risk, log it
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
      } catch (err) {
        logger.error('Error in abuse detection', { error: err.message });
      }
    }

    // Check if IP is blocked
    if (ipBlock.blocked) {
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

    // Check if email is blocked
    if (emailBlock.blocked) {
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

    // Check rate limits - if already exceeded, block immediately
    const ipKey = store.getIPKey(ip, authType);
    const emailKey = store.getEmailKey(email, authType);

    const [ipAttempts, emailAttempts] = await Promise.all([
      store.getAttemptCount(ipKey),
      store.getAttemptCount(emailKey)
    ]);

    // If limit already exceeded, block immediately
    if (ipAttempts >= config.maxAttempts || emailAttempts >= config.maxAttempts) {
      const [ipOffenses, emailOffenses] = await Promise.all([
        store.getOffenseCount(ipBlockKey),
        store.getOffenseCount(emailBlockKey)
      ]);

      // Set blocks with progressive duration
      await Promise.all([
        store.setBlock(ipBlockKey, ipOffenses + 1, progressiveBlockDurations),
        store.setBlock(emailBlockKey, emailOffenses + 1, progressiveBlockDurations)
      ]);

      const newOffenseCount = ipOffenses + 1;
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

      const retryAfterMinutes = isPermanent 
        ? undefined
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
    }

    // Store request context for post-auth middleware
    res.locals.rateLimitContext = {
      ip,
      email,
      authType,
      ipKey,
      emailKey,
      ipBlockKey,
      emailBlockKey,
      config,
      progressiveBlockDurations,
      abuseDetectionConfig
    };

    // Continue to route handler
    next();
  } catch (error) {
    logger.error('Auth Rate Limiter v2: Error en pre-auth middleware', {
      error: error.message,
      ip,
      email: email ? email.substring(0, 3) + '***' : 'unknown',
      authType
    });
    // Fail open - allow request if rate limiting fails
    next();
  }
}

/**
 * Post-Auth Middleware: Process results AFTER route execution
 * ROA-359: Deterministic, synchronous result processing
 * Returns void - checks res.headersSent to determine if response was sent
 */
async function authRateLimiterV2Post(req, res) {
  // Initialize res.locals if not present
  if (!res.locals) {
    res.locals = {};
  }
  
  // Only process if we have rate limit context
  if (!res.locals.rateLimitContext) {
    return;
  }

  const {
    ip,
    email,
    authType,
    ipKey,
    emailKey,
    ipBlockKey,
    emailBlockKey,
    config,
    progressiveBlockDurations,
    abuseDetectionConfig
  } = res.locals.rateLimitContext;

  try {
    // Check if auth was successful
    const authSuccess = res.locals.authSuccess === true;
    const authFailureCode = res.locals.authFailureCode || null;
    const statusCode = res.statusCode;

    if (authSuccess) {
      // Reset attempts on success
      await store.resetAttempts(ipKey, emailKey);

      // ROA-359: AC3 - Log unblock event if was previously blocked
      const [ipBlock, emailBlock] = await Promise.all([
        store.isBlocked(ipBlockKey),
        store.isBlocked(emailBlockKey)
      ]);

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

      if (flags.isEnabled('DEBUG_RATE_LIMIT')) {
        logger.info('Auth Rate Limiter v2: Autenticación exitosa, intentos reseteados', {
          ip,
          email: email.substring(0, 3) + '***',
          authType
        });
      }
    } else if (isAuthFailure(authFailureCode, statusCode)) {
      // Only increment attempts for actual auth failures (not 5xx or infrastructure errors)
      const [newIpAttempts, newEmailAttempts] = await Promise.all([
        store.incrementAttempt(ipKey, config.windowMs),
        store.incrementAttempt(emailKey, config.windowMs)
      ]);

      if (flags.isEnabled('DEBUG_RATE_LIMIT')) {
        logger.info('Auth Rate Limiter v2: Failed attempt recorded', {
          ip,
          email: email.substring(0, 3) + '***',
          authType,
          ipAttempts: newIpAttempts,
          emailAttempts: newEmailAttempts,
          failureCode: authFailureCode
        });
      }

      // ROA-359: AC2 - Check abuse patterns if enabled
      if (flags.isEnabled('ENABLE_ABUSE_DETECTION') !== false) {
        try {
          const abusePatterns = await detectAbuse(ip, email, authType, {
            multiIPThreshold: abuseDetectionConfig.multi_ip,
            multiEmailThreshold: abuseDetectionConfig.multi_email,
            burstThreshold: abuseDetectionConfig.burst,
            slowAttackThreshold: abuseDetectionConfig.slow_attack
          });

          if (abusePatterns.riskScore >= 50) {
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
        } catch (err) {
          logger.error('Error in abuse detection', { error: err.message });
        }
      }

      // Check if should block now (after incrementing)
      if (newIpAttempts >= config.maxAttempts || newEmailAttempts >= config.maxAttempts) {
        const [ipOffenses, emailOffenses] = await Promise.all([
          store.getOffenseCount(ipBlockKey),
          store.getOffenseCount(emailBlockKey)
        ]);

        const newOffenseCount = ipOffenses + 1;
        await Promise.all([
          store.setBlock(ipBlockKey, newOffenseCount, progressiveBlockDurations),
          store.setBlock(emailBlockKey, emailOffenses + 1, progressiveBlockDurations)
        ]);

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
        const blockDurationIndex = Math.min(newOffenseCount - 1, progressiveBlockDurations.length - 1);
        const blockDurationMs = progressiveBlockDurations[blockDurationIndex];
        const isPermanent = blockDurationMs === null;

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

        // Override response with 429
        const retryAfterMinutes = isPermanent 
          ? undefined
          : Math.ceil(blockDurationMs / (60 * 1000));

        const blockResponseObj = {
          success: false,
          error: 'Demasiados intentos fallidos. Cuenta temporalmente bloqueada.',
          code: 'AUTH_RATE_LIMIT_EXCEEDED',
          message: isPermanent
            ? 'Por razones de seguridad, esta cuenta ha sido bloqueada permanentemente. Contacta al soporte.'
            : 'Por razones de seguridad, esta cuenta ha sido temporalmente bloqueada. Por favor, inténtalo de nuevo más tarde.'
        };

        // Only include retryAfter if not permanent
        if (!isPermanent) {
          blockResponseObj.retryAfter = retryAfterMinutes;
        }

        res.status(429).json(blockResponseObj);
        return; // Response already sent, exit function
      }
    }
    // If not auth failure or success, do nothing (e.g., 5xx errors, validation errors)
    // Function returns normally, allowing original response to be sent
  } catch (error) {
    logger.error('Auth Rate Limiter v2: Error en post-auth middleware', {
      error: error.message,
      ip,
      email: email ? email.substring(0, 3) + '***' : 'unknown',
      authType
    });
    // Fail open - allow original response to be sent
    // Don't throw - let the response proceed normally
  }
}

/**
 * Combined middleware for backward compatibility
 * ROA-359: Applies pre-auth check, then intercepts res.json/res.status to process post-auth
 * NO res.end interception - only intercepts response methods before sending
 */
function authRateLimiterV2(req, res, next) {
  // Apply pre-auth middleware first
  authRateLimiterV2Pre(req, res, (err) => {
    if (err) {
      return next(err);
    }
    // If pre-auth middleware sent a response (429), don't continue
    if (res.headersSent) {
      return;
    }

    // Initialize res.locals if not present
    if (!res.locals) {
      res.locals = {};
    }
    
    // Only intercept if we have rate limit context (auth endpoint)
    if (!res.locals.rateLimitContext) {
      return next();
    }

    // Intercept res.json and res.status to capture response before sending
    // This allows us to process rate limiting synchronously without intercepting res.end
    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);
    let responseStatus = 200;
    let responseBody = null;

    res.status = function(code) {
      responseStatus = code;
      return originalStatus(code);
    };

    res.json = async function(body) {
      responseBody = body;
      
      // Determine auth result from response
      const authSuccess = responseStatus >= 200 && responseStatus < 300 && 
                         (body?.success === true || body?.data !== undefined);
      
      // Extract error code from response body
      let authFailureCode = null;
      if (!authSuccess && responseStatus < 500) {
        // Check if it's an auth failure (401 or specific error codes)
        if (responseStatus === 401) {
          authFailureCode = body?.code || 'UNAUTHORIZED';
        } else if (body?.code && AUTH_FAILURE_CODES.includes(body.code)) {
          authFailureCode = body.code;
        } else if (body?.error && typeof body.error === 'string') {
          // Check error message for auth failure patterns
          const errorLower = body.error.toLowerCase();
          if (errorLower.includes('wrong email') || 
              errorLower.includes('wrong password') ||
              errorLower.includes('invalid credentials') ||
              errorLower.includes('invalid token')) {
            authFailureCode = 'INVALID_CREDENTIALS';
          }
        }
      }

      // Set res.locals for post-auth processing
      res.locals.authSuccess = authSuccess;
      res.locals.authFailureCode = authFailureCode;

      // ROA-359: Process post-auth with await to ensure deterministic execution
      // Wait for post-auth to complete before sending response
      await authRateLimiterV2Post(req, res);

      // If post-auth middleware sent a response (429), don't send original
      if (res.headersSent) {
        return;
      }
      
      // Send original response only after post-auth completes
      originalJson(responseBody);
    };

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

/**
 * Get singleton store instance
 * ROA-526: Accessor to avoid repeated initialization in health checks
 * @returns {RateLimitStoreV2} The singleton store instance
 */
function getStore() {
  return store;
}

module.exports = {
  authRateLimiterV2,
  authRateLimiterV2Pre,
  authRateLimiterV2Post,
  RateLimitStoreV2,
  getRateLimitConfig,
  getProgressiveBlockDurations,
  getAbuseDetectionConfig: getAbuseDetectionConfigCached,
  invalidateConfigCache,
  getMetrics,
  getStore,
  FALLBACK_RATE_LIMIT_CONFIG,
  FALLBACK_PROGRESSIVE_BLOCK_DURATIONS,
  FALLBACK_ABUSE_DETECTION_THRESHOLDS,
  getClientIP,
  detectAuthType,
  isAuthFailure
};
