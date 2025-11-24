/**
 * Rate limiting middleware specifically for password change attempts
 * Prevents abuse of the password change endpoint
 */

const { flags } = require('../config/flags');
const { logger } = require('./../utils/logger'); // Issue #971: Added for console.log replacement
const { getClientIP } = require('./rateLimiter');

/**
 * In-memory storage for password change rate limiting
 * In production, this should be replaced with Redis
 */
class PasswordChangeRateLimitStore {
  constructor() {
    this.attempts = new Map();
    this.blocked = new Map();
    this.cleanupInterval = null;

    // Cleanup old entries every 5 minutes
    // Skip interval in test environment to avoid open handles
    if (process.env.NODE_ENV !== 'test') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
      // Unref to allow process to exit if this is the only active handle
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  /**
   * Get rate limit key for password change attempts (IP-based)
   * @param {string} ip - Client IP address
   * @param {string} userId - User ID for additional security
   * @returns {string}
   */
  getKey(ip, userId) {
    return `pwd_change:${ip}:${userId}`;
  }

  /**
   * Check if key is currently blocked
   * @param {string} key - Rate limit key
   * @returns {Object} Block status and remaining time
   */
  isBlocked(key) {
    const blockInfo = this.blocked.get(key);
    if (!blockInfo) return { blocked: false };

    const now = Date.now();
    if (now > blockInfo.expiresAt) {
      this.blocked.delete(key);
      return { blocked: false };
    }

    return {
      blocked: true,
      expiresAt: blockInfo.expiresAt,
      remainingMs: blockInfo.expiresAt - now
    };
  }

  /**
   * Record a password change attempt
   * @param {string} key - Rate limit key
   * @returns {Object} Current attempt status
   */
  recordAttempt(key) {
    const now = Date.now();
    const windowMs = 60 * 60 * 1000; // 1 hour window
    const maxAttempts = 5; // Max 5 password changes per hour
    const blockDurationMs = 60 * 60 * 1000; // Block for 1 hour

    // Get current attempts for this key
    let attemptInfo = this.attempts.get(key);
    if (!attemptInfo || now - attemptInfo.firstAttempt > windowMs) {
      // Reset window
      attemptInfo = {
        count: 0,
        firstAttempt: now,
        lastAttempt: now
      };
    }

    // Increment attempt count
    attemptInfo.count++;
    attemptInfo.lastAttempt = now;
    this.attempts.set(key, attemptInfo);

    // Check if should be blocked
    if (attemptInfo.count >= maxAttempts) {
      const blockExpiresAt = now + blockDurationMs;
      this.blocked.set(key, {
        blockedAt: now,
        expiresAt: blockExpiresAt,
        attemptCount: attemptInfo.count
      });

      return {
        blocked: true,
        expiresAt: blockExpiresAt,
        remainingMs: blockDurationMs,
        attemptCount: attemptInfo.count
      };
    }

    return {
      blocked: false,
      attemptCount: attemptInfo.count,
      maxAttempts,
      remainingAttempts: maxAttempts - attemptInfo.count
    };
  }

  /**
   * Record successful password change (don't reset completely, but reduce penalty)
   * @param {string} key - Rate limit key
   */
  recordSuccess(key) {
    // Don't completely reset attempts for password changes
    // This prevents rapid successive password changes
    const attemptInfo = this.attempts.get(key);
    if (attemptInfo && attemptInfo.count > 1) {
      attemptInfo.count = Math.max(1, attemptInfo.count - 1);
      this.attempts.set(key, attemptInfo);
    }
  }

  /**
   * Cleanup old entries
   */
  cleanup() {
    const now = Date.now();
    const windowMs = 60 * 60 * 1000;

    // Clean old attempts
    for (const [key, attemptInfo] of this.attempts) {
      if (now - attemptInfo.firstAttempt > windowMs) {
        this.attempts.delete(key);
      }
    }

    // Clean expired blocks
    for (const [key, blockInfo] of this.blocked) {
      if (now > blockInfo.expiresAt) {
        this.blocked.delete(key);
      }
    }

    if (flags.isEnabled('DEBUG_RATE_LIMIT')) {
      logger.info('Password change rate limiter cleanup:', {
        activeAttempts: this.attempts.size,
        blockedKeys: this.blocked.size
      });
    }
  }

  /**
   * Stop the cleanup interval (for testing)
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Create singleton store
const passwordChangeStore = new PasswordChangeRateLimitStore();

/**
 * Rate limiting middleware for password change attempts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function passwordChangeRateLimiter(req, res, next) {
  // Issue #628: Disable rate limiting in test environment (pattern from #618)
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  if (!flags.isEnabled('ENABLE_RATE_LIMIT')) {
    return next();
  }

  const ip = getClientIP(req);
  const userId = req.user?.id || 'anonymous';

  if (!userId || userId === 'anonymous') {
    return next(); // Skip if no authenticated user
  }

  const key = passwordChangeStore.getKey(ip, userId);

  // Check if currently blocked
  const blockStatus = passwordChangeStore.isBlocked(key);
  if (blockStatus.blocked) {
    const remainingMinutes = Math.ceil(blockStatus.remainingMs / (60 * 1000));

    if (flags.isEnabled('DEBUG_RATE_LIMIT')) {
      logger.info('Blocked password change attempt:', {
        ip,
        userId,
        key,
        remainingMs: blockStatus.remainingMs
      });
    }

    return res.status(429).json({
      success: false,
      error: 'Too many password change attempts. Please try again later.',
      code: 'PASSWORD_CHANGE_RATE_LIMITED',
      retryAfter: remainingMinutes,
      message: `For security reasons, password changes are temporarily blocked. Please wait ${remainingMinutes} minutes before trying again.`
    });
  }

  // Record this attempt
  const result = passwordChangeStore.recordAttempt(key);

  if (flags.isEnabled('DEBUG_RATE_LIMIT')) {
    logger.info('Password change attempt recorded:', { ip, userId, key, result });
  }

  // Store original end function to intercept response
  const originalEnd = res.end;
  let responseIntercepted = false;

  res.end = function (chunk, encoding) {
    if (!responseIntercepted) {
      responseIntercepted = true;

      // Check if this was a successful password change
      const isSuccess = res.statusCode >= 200 && res.statusCode < 300;

      if (isSuccess) {
        // Record successful password change
        passwordChangeStore.recordSuccess(key);

        if (flags.isEnabled('DEBUG_RATE_LIMIT')) {
          logger.info('Successful password change recorded:', { ip, userId, key });
        }
      }

      // If blocked due to this attempt, override response
      if (result.blocked) {
        res.statusCode = 429;
        const remainingMinutes = Math.ceil(result.remainingMs / (60 * 1000));

        const blockResponse = JSON.stringify({
          success: false,
          error: 'Too many password change attempts. Account temporarily limited.',
          code: 'PASSWORD_CHANGE_RATE_LIMITED',
          retryAfter: remainingMinutes,
          message: `For security reasons, password changes are temporarily blocked. Please wait ${remainingMinutes} minutes.`
        });

        chunk = blockResponse;
        encoding = 'utf8';
      }
    }

    originalEnd.call(this, chunk, encoding);
  };

  next();
}

module.exports = {
  passwordChangeRateLimiter,
  PasswordChangeRateLimitStore,
  passwordChangeStore
};
