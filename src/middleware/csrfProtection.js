const crypto = require('crypto');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

class CSRFProtection {
  constructor() {
    this.tokenCache = new Map();
    this.maxTokenAge = 2 * 60 * 60 * 1000; // 2 hours
    this.cookieName = 'csrf-token';
    this.headerName = 'x-csrf-token';
    
    // Clean up expired tokens every 30 minutes
    this._cleanupInterval = setInterval(() => this.cleanupExpiredTokens(), 30 * 60 * 1000);
  }

  cleanup() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }
  }

  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  storeToken(sessionId, token) {
    this.tokenCache.set(sessionId, {
      token,
      timestamp: Date.now()
    });
  }

  validateToken(sessionId, providedToken) {
    const stored = this.tokenCache.get(sessionId);
    
    if (!stored) {
      return false;
    }

    // Check if token has expired
    if (Date.now() - stored.timestamp > this.maxTokenAge) {
      this.tokenCache.delete(sessionId);
      return false;
    }

    // Validate and normalize inputs before converting to buffers
    const normalizedProvidedToken = providedToken || '';

    // Check if providedToken is a valid hex string of expected length
    const expectedLength = stored.token.length;
    const isValidHex = /^[0-9a-fA-F]*$/.test(normalizedProvidedToken) &&
                       normalizedProvidedToken.length === expectedLength;

    try {
      const storedBuffer = Buffer.from(stored.token, 'hex');
      const providedBuffer = isValidHex
        ? Buffer.from(normalizedProvidedToken, 'hex')
        : Buffer.alloc(storedBuffer.length, 0); // Zero-filled buffer of same length

      return crypto.timingSafeEqual(storedBuffer, providedBuffer);
    } catch (error) {
      // Fallback to safe comparison with zero buffer
      const storedBuffer = Buffer.from(stored.token, 'hex');
      const zeroBuffer = Buffer.alloc(storedBuffer.length, 0);
      return crypto.timingSafeEqual(storedBuffer, zeroBuffer);
    }
  }

  cleanupExpiredTokens() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [sessionId, data] of this.tokenCache.entries()) {
      if (now - data.timestamp > this.maxTokenAge) {
        this.tokenCache.delete(sessionId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug('CSRF token cleanup completed', { tokensRemoved: cleaned });
    }
  }

  getSessionId(req) {
    // Use session ID if available, otherwise use IP + User-Agent as fallback
    return req.sessionID || 
           req.session?.id || 
           crypto.createHash('sha256')
             .update(req.ip + (req.get('User-Agent') || ''))
             .digest('hex');
  }
}

const csrfProtectionInstance = new CSRFProtection();

const csrfProtection = (options = {}) => {
  const {
    ignoreMethods = ['GET', 'HEAD', 'OPTIONS'],
    skipPaths = ['/health', '/api/health', '/api/webhooks'],
    enabled = flags.isEnabled('ENABLE_CSRF_PROTECTION')
  } = options;

  // Disable CSRF protection in test environment
  if (process.env.NODE_ENV === 'test' || !enabled) {
    logger.info('CSRF protection disabled (test environment or feature flag)');
    return (req, res, next) => {
      // Still provide token generation for testing
      req.csrfToken = () => csrfProtectionInstance.generateToken();
      next();
    };
  }

  return (req, res, next) => {
    // Skip CSRF protection for certain paths
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    const sessionId = csrfProtectionInstance.getSessionId(req);

    // For safe methods, generate and send token
    if (ignoreMethods.includes(req.method)) {
      const token = csrfProtectionInstance.generateToken();
      csrfProtectionInstance.storeToken(sessionId, token);
      
      // Set token in cookie with hardened security settings
      res.cookie(csrfProtectionInstance.cookieName, token, {
        httpOnly: false, // Allow JS access for AJAX requests (required for CSRF token)
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict', // Strict same-site policy
        maxAge: csrfProtectionInstance.maxTokenAge,
        path: '/', // Explicit path
        domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined // Domain restriction in production
      });
      
      req.csrfToken = () => token;
      return next();
    }

    // For unsafe methods, validate token
    const providedToken = req.get(csrfProtectionInstance.headerName) ||
                         req.body?._csrf ||
                         req.query._csrf;

    if (!providedToken) {
      logger.warn('CSRF token missing', {
        ip: req.ip,
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(403).json({
        error: 'CSRF token missing',
        code: 'CSRF_TOKEN_MISSING'
      });
    }

    if (!csrfProtectionInstance.validateToken(sessionId, providedToken)) {
      logger.warn('CSRF token validation failed', {
        ip: req.ip,
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent'),
        sessionId: sessionId.substring(0, 8) + '...' // Log partial session ID for debugging
      });
      
      return res.status(403).json({
        error: 'Invalid CSRF token',
        code: 'CSRF_TOKEN_INVALID'
      });
    }

    // Token is valid, continue
    req.csrfToken = () => providedToken;
    next();
  };
};

module.exports = {
  csrfProtection,
  CSRFProtection,
  csrfProtectionInstance
};