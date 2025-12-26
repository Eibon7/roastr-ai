/**
 * @fileoverview Rate Limit Policy - Verifies ingestion rate limits
 * @module services/ingestion/policies/RateLimitPolicy
 * @since ROA-388
 */

const redis = require('../../../lib/redis');
const logger = require('../../../utils/logger');

/**
 * @typedef {import('../types').PolicyResult} PolicyResult
 * @typedef {import('../types').EligibilityContext} EligibilityContext
 */

class RateLimitPolicy {
  constructor() {
    this.name = 'RateLimitPolicy';
    // Default rate limits (can be overridden by SSOT)
    this.limits = {
      global: {
        max: 1000, // Max ingestions per hour globally
        windowMs: 60 * 60 * 1000 // 1 hour
      },
      perUser: {
        max: 100, // Max ingestions per hour per user
        windowMs: 60 * 60 * 1000 // 1 hour
      },
      perAccount: {
        max: 50, // Max ingestions per hour per account
        windowMs: 60 * 60 * 1000 // 1 hour
      }
    };
  }

  /**
   * Evaluates if rate limit is exceeded
   *
   * Checks three levels:
   * 1. Global rate limit (all users)
   * 2. Per-user rate limit
   * 3. Per-account rate limit
   *
   * @param {EligibilityContext} context - Evaluation context
   * @returns {Promise<PolicyResult>}
   */
  async evaluate(context) {
    try {
      const { userId, accountId, platform } = context;

      // Check global rate limit
      const globalResult = await this._checkRateLimit(
        `ingestion:global`,
        this.limits.global.max,
        this.limits.global.windowMs
      );

      if (!globalResult.allowed) {
        logger.warn('RateLimitPolicy: Global rate limit exceeded', {
          requestId: context.requestId
        });
        return {
          allowed: false,
          reason: 'rate_limit_exceeded',
          retry_after_seconds: globalResult.retry_after_seconds,
          metadata: {
            scope: 'global',
            limit: this.limits.global.max,
            window_ms: this.limits.global.windowMs
          }
        };
      }

      // Check per-user rate limit
      const userResult = await this._checkRateLimit(
        `ingestion:user:${userId}`,
        this.limits.perUser.max,
        this.limits.perUser.windowMs
      );

      if (!userResult.allowed) {
        logger.info('RateLimitPolicy: User rate limit exceeded', {
          userId,
          requestId: context.requestId
        });
        return {
          allowed: false,
          reason: 'rate_limit_exceeded',
          retry_after_seconds: userResult.retry_after_seconds,
          metadata: {
            scope: 'user',
            limit: this.limits.perUser.max,
            window_ms: this.limits.perUser.windowMs
          }
        };
      }

      // Check per-account rate limit
      const accountResult = await this._checkRateLimit(
        `ingestion:account:${accountId}:${platform}`,
        this.limits.perAccount.max,
        this.limits.perAccount.windowMs
      );

      if (!accountResult.allowed) {
        logger.info('RateLimitPolicy: Account rate limit exceeded', {
          accountId,
          platform,
          requestId: context.requestId
        });
        return {
          allowed: false,
          reason: 'rate_limit_exceeded',
          retry_after_seconds: accountResult.retry_after_seconds,
          metadata: {
            scope: 'account',
            limit: this.limits.perAccount.max,
            window_ms: this.limits.perAccount.windowMs
          }
        };
      }

      // All rate limits OK
      return {
        allowed: true,
        metadata: {
          rate_limits_ok: true
        }
      };

    } catch (err) {
      logger.error('RateLimitPolicy: Unexpected error', {
        error: err.message,
        requestId: context.requestId
      });
      // Fail-safe: block on unexpected errors
      return {
        allowed: false,
        reason: 'rate_limit_error',
        metadata: { error: err.message }
      };
    }
  }

  /**
   * Check rate limit for a given key
   * Uses sliding window algorithm
   *
   * @private
   * @param {string} key - Redis key for rate limit
   * @param {number} max - Maximum requests allowed
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Promise<{allowed: boolean, retry_after_seconds?: number}>}
   */
  async _checkRateLimit(key, max, windowMs) {
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

      // Add current request
      await redis.zadd(key, now, `${now}`);
      await redis.expire(key, Math.ceil(windowMs / 1000));

      return { allowed: true };

    } catch (err) {
      logger.error('RateLimitPolicy: Error checking rate limit', {
        key,
        error: err.message
      });
      // Fail-safe: block on Redis errors per IG1 policy
      return {
        allowed: false,
        retry_after_seconds: 60 // Reasonable retry delay during Redis issues
      };
    }
  }
}

module.exports = RateLimitPolicy;
