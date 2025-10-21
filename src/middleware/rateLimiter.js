/**
 * Rate limiting middleware for login attempts
 * Prevents brute force attacks with IP + email combination tracking
 */

const { flags } = require('../config/flags');

/**
 * In-memory storage for rate limiting
 * In production, this should be replaced with Redis
 */
class RateLimitStore {
  constructor() {
    this.attempts = new Map();
    this.blocked = new Map();
    this.metrics = {
      totalAttempts: 0,
      blockedAttempts: 0,
      uniqueIPs: new Set(),
      recentBlocks: []
    };
    this.cleanupInterval = null;
    
    // Cleanup old entries every 10 minutes
    // Skip interval in test environment to avoid open handles
    if (process.env.NODE_ENV !== 'test') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000);
      // Unref to allow process to exit if this is the only active handle
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  /**
   * Get rate limit key for IP + email combination
   * @param {string} ip - Client IP address
   * @param {string} email - Email being attempted (hashed for privacy)
   * @returns {string}
   */
  getKey(ip, email) {
    // Don't store actual email, use hash for privacy
    const crypto = require('crypto');
    const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').substring(0, 8);
    return `${ip}:${emailHash}`;
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
   * Record a failed attempt
   * @param {string} key - Rate limit key
   * @param {string} ip - Client IP
   * @returns {Object} Current attempt status
   */
  recordAttempt(key, ip) {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxAttempts = 5;
    const blockDurationMs = 15 * 60 * 1000; // 15 minutes

    // Update metrics
    this.metrics.totalAttempts++;
    this.metrics.uniqueIPs.add(ip);

    // Get current attempts for this key
    let attemptInfo = this.attempts.get(key);
    if (!attemptInfo || (now - attemptInfo.firstAttempt) > windowMs) {
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

      // Update metrics
      this.metrics.blockedAttempts++;
      this.metrics.recentBlocks.push({
        key,
        ip,
        blockedAt: now,
        expiresAt: blockExpiresAt,
        attemptCount: attemptInfo.count
      });

      // Keep only last 100 blocks for metrics
      if (this.metrics.recentBlocks.length > 100) {
        this.metrics.recentBlocks = this.metrics.recentBlocks.slice(-100);
      }

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
   * Record successful login (reset attempts)
   * @param {string} key - Rate limit key
   */
  recordSuccess(key) {
    this.attempts.delete(key);
    this.blocked.delete(key);
  }

  /**
   * Cleanup old entries
   */
  cleanup() {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;

    // Clean old attempts
    for (const [key, attemptInfo] of this.attempts) {
      if ((now - attemptInfo.firstAttempt) > windowMs) {
        this.attempts.delete(key);
      }
    }

    // Clean expired blocks
    for (const [key, blockInfo] of this.blocked) {
      if (now > blockInfo.expiresAt) {
        this.blocked.delete(key);
      }
    }

    // Clean old unique IPs (reset daily)
    if (this.lastIPCleanup && (now - this.lastIPCleanup) > (24 * 60 * 60 * 1000)) {
      this.metrics.uniqueIPs.clear();
      this.lastIPCleanup = now;
    } else if (!this.lastIPCleanup) {
      this.lastIPCleanup = now;
    }

    if (flags.isEnabled('DEBUG_RATE_LIMIT')) {
      console.log('Rate limiter cleanup:', {
        activeAttempts: this.attempts.size,
        blockedKeys: this.blocked.size,
        uniqueIPs: this.metrics.uniqueIPs.size
      });
    }
  }

  /**
   * Get current metrics for monitoring
   * @returns {Object}
   */
  getMetrics() {
    return {
      ...this.metrics,
      uniqueIPs: this.metrics.uniqueIPs.size,
      activeAttempts: this.attempts.size,
      currentlyBlocked: this.blocked.size,
      recentBlocksCount: this.metrics.recentBlocks.length
    };
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
const store = new RateLimitStore();

/**
 * Get client IP address from request
 * @param {Object} req - Express request object
 * @returns {string}
 */
function getClientIP(req) {
  return req.ip || 
         (req.connection && req.connection.remoteAddress) ||
         (req.socket && req.socket.remoteAddress) ||
         (req.connection && req.connection.socket && req.connection.socket.remoteAddress) ||
         '127.0.0.1';
}

/**
 * Rate limiting middleware for login attempts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function loginRateLimiter(req, res, next) {
  // Issue #628: Disable rate limiting in test environment (pattern from #618)
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  if (!flags.isEnabled('ENABLE_RATE_LIMIT')) {
    return next();
  }

  // Only apply to login/auth endpoints
  const isAuthEndpoint = req.path.includes('/auth/') || 
                        req.path.includes('/login') || 
                        req.method === 'POST' && req.body && req.body.email;

  if (!isAuthEndpoint) {
    return next();
  }

  const ip = getClientIP(req);
  const email = (req.body && (req.body.email || req.body.username)) || 'unknown';
  
  if (!email || email === 'unknown') {
    return next();
  }

  const key = store.getKey(ip, email);
  
  // Check if currently blocked
  const blockStatus = store.isBlocked(key);
  if (blockStatus.blocked) {
    const remainingMinutes = Math.ceil(blockStatus.remainingMs / (60 * 1000));
    
    if (flags.isEnabled('DEBUG_RATE_LIMIT')) {
      console.log('Blocked login attempt:', { ip, key, remainingMs: blockStatus.remainingMs });
    }

    return res.status(429).json({
      success: false,
      error: 'Too many login attempts. Please try again later.',
      code: 'RATE_LIMITED',
      retryAfter: remainingMinutes,
      // Don't reveal specific timing to prevent enumeration
      message: 'For security reasons, please wait before attempting to log in again.'
    });
  }

  // Store original end function to intercept response
  const originalEnd = res.end;
  let responseIntercepted = false;

  res.end = function(chunk, encoding) {
    if (!responseIntercepted) {
      responseIntercepted = true;
      
      // Check if this was a failed login attempt
      const isFailure = res.statusCode >= 400;
      
      if (isFailure) {
        // Record failed attempt
        const result = store.recordAttempt(key, ip);
        
        if (flags.isEnabled('DEBUG_RATE_LIMIT')) {
          console.log('Failed login attempt recorded:', { ip, key, result });
        }
        
        if (result.blocked) {
          // Override response for newly blocked attempts
          res.statusCode = 429;
          const remainingMinutes = Math.ceil(result.remainingMs / (60 * 1000));
          
          const blockResponse = JSON.stringify({
            success: false,
            error: 'Too many failed attempts. Account temporarily locked.',
            code: 'RATE_LIMITED',
            retryAfter: remainingMinutes,
            message: 'For security reasons, this account has been temporarily locked. Please try again later.'
          });
          
          chunk = blockResponse;
          encoding = 'utf8';
        }
      } else if (res.statusCode >= 200 && res.statusCode < 300) {
        // Successful login - reset attempts
        store.recordSuccess(key);
        
        if (flags.isEnabled('DEBUG_RATE_LIMIT')) {
          console.log('Successful login, reset attempts:', { ip, key });
        }
      }
    }
    
    originalEnd.call(this, chunk, encoding);
  };

  next();
}

/**
 * Endpoint to get rate limiting metrics (mock mode only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function getRateLimitMetrics(req, res) {
  if (!flags.isEnabled('MOCK_MODE') && process.env.NODE_ENV !== 'test') {
    return res.status(403).json({
      success: false,
      error: 'Metrics only available in mock mode'
    });
  }

  const metrics = store.getMetrics();
  
  res.json({
    success: true,
    data: {
      ...metrics,
      rateLimitEnabled: flags.isEnabled('ENABLE_RATE_LIMIT'),
      timestamp: Date.now()
    }
  });
}

/**
 * Reset rate limiting for specific IP/email (testing only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function resetRateLimit(req, res) {
  if (!flags.isEnabled('MOCK_MODE') && process.env.NODE_ENV !== 'test') {
    return res.status(403).json({
      success: false,
      error: 'Rate limit reset only available in mock mode'
    });
  }

  const { ip, email } = req.body;
  
  if (!ip || !email) {
    return res.status(400).json({
      success: false,
      error: 'IP and email are required'
    });
  }

  const key = store.getKey(ip, email);
  store.recordSuccess(key);
  
  res.json({
    success: true,
    message: 'Rate limit reset successfully',
    key
  });
}

/**
 * Rate limiting middleware specifically for password change attempts (Issue #133)
 * More restrictive than login attempts since these are sensitive operations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Next middleware function
 */
function passwordChangeRateLimiter(req, res, next) {
  if (!flags.isEnabled('ENABLE_RATE_LIMIT')) {
    return next();
  }

  const ip = getClientIP(req);
  const userId = req.user ? req.user.id : 'anonymous';
  
  // Create specific key for password changes (using user ID instead of email for authenticated users)
  const crypto = require('crypto');
  const userHash = crypto.createHash('sha256').update(userId).digest('hex').substring(0, 8);
  const key = `pwd_change:${ip}:${userHash}`;
  
  // More restrictive limits for password changes
  const windowMs = 60 * 60 * 1000; // 1 hour window
  const maxAttempts = 3; // Only 3 attempts per hour
  const blockDurationMs = 60 * 60 * 1000; // Block for 1 hour
  
  // Check if currently blocked
  const blockStatus = store.isBlocked(key);
  if (blockStatus.blocked) {
    const remainingMinutes = Math.ceil(blockStatus.remainingMs / (60 * 1000));
    
    if (flags.isEnabled('DEBUG_RATE_LIMIT')) {
      console.log('Blocked password change attempt:', { ip, userId, key, remainingMs: blockStatus.remainingMs });
    }

    return res.status(429).json({
      success: false,
      error: 'Too many password change attempts. Please try again later.',
      code: 'PASSWORD_CHANGE_RATE_LIMITED',
      retryAfter: remainingMinutes,
      message: `For security reasons, password changes are limited. Please wait ${remainingMinutes} minutes before trying again.`
    });
  }

  // Store original end function to intercept response
  const originalEnd = res.end;
  let responseIntercepted = false;

  res.end = function(chunk, encoding) {
    if (!responseIntercepted) {
      responseIntercepted = true;
      
      // Check if this was a failed password change attempt
      const isFailure = res.statusCode >= 400;
      
      if (isFailure) {
        // Get current attempts or create new entry
        const now = Date.now();
        let attemptInfo = store.attempts.get(key);
        if (!attemptInfo || (now - attemptInfo.firstAttempt) > windowMs) {
          attemptInfo = {
            count: 0,
            firstAttempt: now,
            lastAttempt: now
          };
        }

        // Increment attempt count
        attemptInfo.count++;
        attemptInfo.lastAttempt = now;
        store.attempts.set(key, attemptInfo);

        if (flags.isEnabled('DEBUG_RATE_LIMIT')) {
          console.log('Failed password change attempt recorded:', { 
            ip, userId, key, 
            count: attemptInfo.count, 
            maxAttempts 
          });
        }
        
        // Check if should be blocked
        if (attemptInfo.count >= maxAttempts) {
          const blockExpiresAt = now + blockDurationMs;
          store.blocked.set(key, {
            blockedAt: now,
            expiresAt: blockExpiresAt,
            attemptCount: attemptInfo.count
          });

          // Update metrics
          store.metrics.blockedAttempts++;
          
          // Override response for newly blocked attempts
          res.statusCode = 429;
          const remainingMinutes = Math.ceil(blockDurationMs / (60 * 1000));
          
          const blockResponse = JSON.stringify({
            success: false,
            error: 'Too many failed password change attempts. Account temporarily locked.',
            code: 'PASSWORD_CHANGE_RATE_LIMITED',
            retryAfter: remainingMinutes,
            message: `For security reasons, password changes have been temporarily disabled for this account. Please wait ${remainingMinutes} minutes before trying again.`
          });
          
          chunk = blockResponse;
          encoding = 'utf8';
        }
      } else if (res.statusCode >= 200 && res.statusCode < 300) {
        // Successful password change - reset attempts
        store.attempts.delete(key);
        store.blocked.delete(key);
        
        if (flags.isEnabled('DEBUG_RATE_LIMIT')) {
          console.log('Successful password change, reset attempts:', { ip, userId, key });
        }
      }
    }
    
    originalEnd.call(this, chunk, encoding);
  };

  next();
}

module.exports = {
  loginRateLimiter,
  passwordChangeRateLimiter,
  getRateLimitMetrics,
  resetRateLimit,
  RateLimitStore,
  getClientIP,
  store
};