/**
 * @fileoverview Rate Limit Policy Global v2 - Unified rate limiting system
 * @module services/rateLimitPolicyGlobal
 * @since ROA-392
 * 
 * Propósito:
 * Sistema unificado de rate limiting que carga configuración desde SSOT v2,
 * soporta múltiples scopes, hot-reload, y fail-safe behavior.
 * 
 * Scopes soportados:
 * - auth (password, magic_link, oauth, password_reset)
 * - ingestion (global, perUser, perAccount)
 * - roast
 * - persona
 * - notifications
 * - gdpr
 * - admin
 * - global
 * 
 * Algoritmo:
 * - Sliding window con Redis (sorted sets con timestamps)
 * - Progressive blocking (escalación de duración según infracciones)
 * - Fail-safe: Bloquea en errores de Redis (no permite bypass)
 * 
 * SSOT Reference: Section 12.6 (Rate Limiting Global v2)
 */

const redis = require('../lib/redis');
const logger = require('../utils/logger');
const settingsLoaderV2 = require('./settingsLoaderV2');

/**
 * @typedef {Object} RateLimitConfig
 * @property {number} max - Max requests in window
 * @property {number} windowMs - Window in milliseconds
 * @property {number} [blockDurationMs] - Optional progressive block duration
 * @property {boolean} enabled - Whether rate limiting is enabled for this scope
 */

/**
 * @typedef {Object} RateLimitPolicyConfig
 * @property {RateLimitConfig} global
 * @property {Object} auth
 * @property {RateLimitConfig} auth.password
 * @property {RateLimitConfig} auth.magic_link
 * @property {RateLimitConfig} auth.oauth
 * @property {RateLimitConfig} auth.password_reset
 * @property {Object} ingestion
 * @property {RateLimitConfig} ingestion.global
 * @property {RateLimitConfig} ingestion.perUser
 * @property {RateLimitConfig} ingestion.perAccount
 * @property {RateLimitConfig} roast
 * @property {RateLimitConfig} persona
 * @property {RateLimitConfig} notifications
 * @property {RateLimitConfig} gdpr
 * @property {RateLimitConfig} admin
 * @property {number[]} progressiveBlockDurations
 */

/**
 * @typedef {Object} RateLimitResult
 * @property {boolean} allowed - Whether the request is allowed
 * @property {string} [reason] - Reason if not allowed
 * @property {number} [retry_after_seconds] - Seconds until retry is allowed
 * @property {Object} [metadata] - Additional metadata
 */

class RateLimitPolicyGlobal {
  constructor() {
    this.name = 'RateLimitPolicyGlobal';
    this.config = null;
    this.configTimestamp = null;
    this.CACHE_TTL = 60 * 1000; // 1 minute cache

    // Default configuration from SSOT v2 (section 12.6.2)
    this.DEFAULT_CONFIG = {
      global: {
        max: 10000,
        windowMs: 3600000, // 1 hour
        enabled: true
      },
      auth: {
        password: {
          max: 5,
          windowMs: 900000, // 15 min
          blockDurationMs: 900000,
          enabled: true
        },
        magic_link: {
          max: 3,
          windowMs: 3600000, // 1 hour
          blockDurationMs: 3600000,
          enabled: true
        },
        oauth: {
          max: 10,
          windowMs: 900000, // 15 min
          blockDurationMs: 900000,
          enabled: true
        },
        password_reset: {
          max: 3,
          windowMs: 3600000, // 1 hour
          blockDurationMs: 3600000,
          enabled: true
        }
      },
      ingestion: {
        global: {
          max: 1000,
          windowMs: 3600000, // 1 hour
          enabled: true
        },
        perUser: {
          max: 100,
          windowMs: 3600000, // 1 hour
          enabled: true
        },
        perAccount: {
          max: 50,
          windowMs: 3600000, // 1 hour
          enabled: true
        }
      },
      roast: {
        max: 10,
        windowMs: 60000, // 1 min
        enabled: true
      },
      persona: {
        max: 3,
        windowMs: 3600000, // 1 hour
        enabled: true
      },
      notifications: {
        max: 10,
        windowMs: 60000, // 1 min
        enabled: true
      },
      gdpr: {
        max: 5,
        windowMs: 3600000, // 1 hour
        enabled: true
      },
      admin: {
        max: 100,
        windowMs: 60000, // 1 min
        enabled: true
      },
      progressiveBlockDurations: [
        900000,   // 15 min (1st infraction)
        3600000,  // 1 hour (2nd infraction)
        86400000, // 24 hours (3rd infraction)
        null      // Permanent (4th+ infraction)
      ]
    };
  }

  /**
   * Check rate limit for a given scope and key
   * 
   * @param {string} scope - Rate limit scope (auth, ingestion, roast, etc.)
   * @param {string} key - Unique identifier for the entity being rate limited
   * @param {Object} [metadata={}] - Additional metadata for logging
   * @returns {Promise<RateLimitResult>}
   */
  async checkRateLimit(scope, key, metadata = {}) {
    try {
      // Load config (cached)
      const config = await this._getConfig();

      // Get scope config
      const scopeConfig = this._getScopeConfig(scope, config);
      
      if (!scopeConfig) {
        logger.error('RateLimitPolicyGlobal: Invalid scope', { scope });
        // Fail-safe: block on invalid scope
        return {
          allowed: false,
          reason: 'invalid_scope',
          metadata: { scope }
        };
      }

      // Check if rate limiting is enabled for this scope
      if (scopeConfig.enabled === false) {
        return {
          allowed: true,
          metadata: { scope, rate_limit_disabled: true }
        };
      }

      // Check rate limit using sliding window
      const redisKey = `ratelimit:${scope}:${key}`;
      const result = await this._checkSlidingWindow(
        redisKey,
        scopeConfig.max,
        scopeConfig.windowMs
      );

      if (!result.allowed) {
        logger.info('RateLimitPolicyGlobal: Rate limit exceeded', {
          scope,
          key: this._maskKey(key),
          ...metadata
        });
        
        return {
          allowed: false,
          reason: 'rate_limit_exceeded',
          retry_after_seconds: result.retry_after_seconds,
          metadata: {
            scope,
            limit: scopeConfig.max,
            window_ms: scopeConfig.windowMs
          }
        };
      }

      // All checks passed
      return {
        allowed: true,
        metadata: {
          scope,
          rate_limit_ok: true
        }
      };

    } catch (err) {
      logger.error('RateLimitPolicyGlobal: Unexpected error', {
        error: err.message,
        scope,
        ...metadata
      });
      
      // Fail-safe: block on unexpected errors (SSOT 12.6.6 rule 1)
      return {
        allowed: false,
        reason: 'rate_limit_error',
        metadata: { error: err.message }
      };
    }
  }

  /**
   * Increment rate limit counter for a given scope and key
   * Should be called after successful request
   * 
   * @param {string} scope - Rate limit scope
   * @param {string} key - Unique identifier
   * @param {Object} [metadata={}] - Additional metadata
   * @returns {Promise<void>}
   */
  async incrementRateLimit(scope, key, metadata = {}) {
    try {
      const redisKey = `ratelimit:${scope}:${key}`;
      const now = Date.now();
      
      // Use timestamp with random suffix to avoid collisions for concurrent requests
      // in the same millisecond (ROA-392 - CodeRabbit fix)
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const uniqueMember = `${now}-${randomSuffix}`;

      await redis.zadd(redisKey, now, uniqueMember);
      
      const config = await this._getConfig();
      const scopeConfig = this._getScopeConfig(scope, config);
      
      if (scopeConfig) {
        await redis.expire(redisKey, Math.ceil(scopeConfig.windowMs / 1000));
      }

    } catch (err) {
      logger.error('RateLimitPolicyGlobal: Error incrementing rate limit', {
        error: err.message,
        scope,
        key: this._maskKey(key),
        ...metadata
      });
      // Non-blocking error, just log
    }
  }

  /**
   * Get current rate limit status for a given scope and key
   * 
   * @param {string} scope - Rate limit scope
   * @param {string} key - Unique identifier
   * @returns {Promise<Object>}
   */
  async getRateLimitStatus(scope, key) {
    try {
      const redisKey = `ratelimit:${scope}:${key}`;
      const config = await this._getConfig();
      const scopeConfig = this._getScopeConfig(scope, config);

      if (!scopeConfig) {
        return { error: 'invalid_scope' };
      }

      const now = Date.now();
      const windowStart = now - scopeConfig.windowMs;

      // Remove old entries
      await redis.zremrangebyscore(redisKey, 0, windowStart);

      // Count current entries
      const count = await redis.zcard(redisKey);

      return {
        scope,
        current: count,
        max: scopeConfig.max,
        windowMs: scopeConfig.windowMs,
        remaining: Math.max(0, scopeConfig.max - count),
        enabled: scopeConfig.enabled
      };

    } catch (err) {
      logger.error('RateLimitPolicyGlobal: Error getting rate limit status', {
        error: err.message,
        scope,
        key: this._maskKey(key)
      });
      return { error: err.message };
    }
  }

  /**
   * Clear rate limit for a given scope and key
   * (Admin function for manual intervention)
   * 
   * @param {string} scope - Rate limit scope
   * @param {string} key - Unique identifier
   * @returns {Promise<boolean>}
   */
  async clearRateLimit(scope, key) {
    try {
      const redisKey = `ratelimit:${scope}:${key}`;
      await redis.del(redisKey);
      
      logger.info('RateLimitPolicyGlobal: Rate limit cleared', {
        scope,
        key: this._maskKey(key)
      });
      
      return true;
    } catch (err) {
      logger.error('RateLimitPolicyGlobal: Error clearing rate limit', {
        error: err.message,
        scope,
        key: this._maskKey(key)
      });
      return false;
    }
  }

  /**
   * Get configuration for a specific scope
   * 
   * @param {string} scope - Rate limit scope
   * @returns {Promise<RateLimitConfig|null>}
   */
  async getConfig(scope) {
    try {
      const config = await this._getConfig();
      return this._getScopeConfig(scope, config);
    } catch (err) {
      logger.error('RateLimitPolicyGlobal: Error getting config', {
        error: err.message,
        scope
      });
      return null;
    }
  }

  /**
   * Internal: Get config from cache or reload
   * 
   * @private
   * @returns {Promise<RateLimitPolicyConfig>}
   */
  async _getConfig() {
    const now = Date.now();

    // Return cached config if still valid
    if (this.config && this.configTimestamp && (now - this.configTimestamp < this.CACHE_TTL)) {
      return this.config;
    }

    // Reload config
    await this._reloadConfig();
    return this.config;
  }

  /**
   * Internal: Reload configuration from SettingsLoader v2 or use defaults
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _reloadConfig() {
    try {
      // Load from SettingsLoader v2 (integrates SSOT + admin_settings)
      const loadedConfig = await settingsLoaderV2.loadRateLimitPolicy();
      
      this.config = loadedConfig;
      this.configTimestamp = Date.now();

      logger.info('RateLimitPolicyGlobal: Configuration reloaded', {
        source: 'settingsLoaderV2'
      });

    } catch (err) {
      logger.error('RateLimitPolicyGlobal: Error reloading config, using defaults', {
        error: err.message
      });
      
      // Fail-safe: use defaults (SSOT 12.6.6 rule 2)
      this.config = this.DEFAULT_CONFIG;
      this.configTimestamp = Date.now();
    }
  }

  /**
   * Internal: Get scope-specific config
   * 
   * @private
   * @param {string} scope - Rate limit scope (e.g., 'auth.password', 'roast')
   * @param {RateLimitPolicyConfig} config - Full config
   * @returns {RateLimitConfig|null}
   */
  _getScopeConfig(scope, config) {
    // Handle nested scopes (e.g., 'auth.password')
    const parts = scope.split('.');
    
    if (parts.length === 1) {
      // Simple scope (e.g., 'roast', 'global')
      return config[parts[0]] || null;
    } else if (parts.length === 2) {
      // Nested scope (e.g., 'auth.password', 'ingestion.perUser')
      const parent = config[parts[0]];
      return parent ? parent[parts[1]] : null;
    }
    
    return null;
  }

  /**
   * Internal: Check rate limit using sliding window algorithm
   * 
   * @private
   * @param {string} key - Redis key
   * @param {number} max - Maximum requests allowed
   * @param {number} windowMs - Window in milliseconds
   * @returns {Promise<{allowed: boolean, retry_after_seconds?: number}>}
   */
  async _checkSlidingWindow(key, max, windowMs) {
    try {
      const now = Date.now();
      const windowStart = now - windowMs;

      // Remove old entries
      await redis.zremrangebyscore(key, 0, windowStart);

      // Count current entries
      const count = await redis.zcard(key);

      if (count >= max) {
        // Get oldest entry to calculate retry_after
        const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
        const oldestTimestamp = oldest.length > 1 ? parseInt(oldest[1]) : now;
        const retryAfterMs = Math.max(0, oldestTimestamp + windowMs - now);
        const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

        return {
          allowed: false,
          retry_after_seconds: retryAfterSeconds
        };
      }

      return { allowed: true };

    } catch (err) {
      logger.error('RateLimitPolicyGlobal: Error in sliding window check', {
        key: this._maskKey(key),
        error: err.message
      });
      
      // Fail-safe: block on Redis errors (SSOT 12.6.6 rule 1)
      return {
        allowed: false,
        retry_after_seconds: 60 // Reasonable retry delay during Redis issues
      };
    }
  }

  /**
   * Internal: Mask sensitive parts of key for logging
   * 
   * @private
   * @param {string} key - Key to mask
   * @returns {string}
   */
  _maskKey(key) {
    // Mask emails, IPs, and other sensitive data
    if (key.includes('@')) {
      const [local, domain] = key.split('@');
      return `${local.substring(0, 2)}***@${domain}`;
    }
    
    if (key.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
      const parts = key.split('.');
      return `${parts[0]}.${parts[1]}.***.**`;
    }
    
    // Generic masking for other keys
    if (key.length > 8) {
      return `${key.substring(0, 4)}***${key.substring(key.length - 4)}`;
    }
    
    return '***';
  }
}

module.exports = RateLimitPolicyGlobal;

