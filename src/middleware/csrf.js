/**
 * CSRF Protection Middleware (Issue #261)
 *
 * Implements Double Submit Cookie pattern for CSRF protection on state-modifying endpoints.
 * This prevents Cross-Site Request Forgery attacks by requiring a valid CSRF token
 * that must match both the cookie value and the request header.
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
 */

const crypto = require('crypto');
const { logger } = require('../utils/logger');

/**
 * Generate a cryptographically secure CSRF token
 * @returns {string} CSRF token (32 bytes hex = 64 characters)
 */
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware to generate and set CSRF token in cookie
 * Should be applied to routes that render forms or provide API access
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function setCsrfToken(req, res, next) {
  // Generate new token if not present
  if (!req.cookies || !req.cookies['csrf-token']) {
    const token = generateCsrfToken();

    // CSRF Double Submit Cookie Pattern (Issue #745)
    // httpOnly MUST be false so frontend JavaScript can read the token
    // Security comes from:
    // 1. sameSite: 'strict' - Prevents cross-site cookie sending
    // 2. Double submission - Attacker can't read cookie to forge header
    // 3. Matching validation - Both cookie AND header must match
    res.cookie('csrf-token', token, {
      httpOnly: false, // Required for frontend to read via document.cookie
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', // Primary CSRF protection
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Also send in response header so frontend can read it
    res.setHeader('X-CSRF-Token', token);

    logger.debug('CSRF token generated and set', {
      path: req.path,
      method: req.method
    });
  } else {
    // Token already exists, expose it in header
    res.setHeader('X-CSRF-Token', req.cookies['csrf-token']);
  }

  next();
}

/**
 * Middleware to validate CSRF token on state-modifying requests
 * Compares token from cookie with token from header
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 *
 * @throws {403} Forbidden if CSRF token is missing or invalid
 */
function validateCsrfToken(req, res, next) {
  // Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF check in test environment
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  const cookieToken = req.cookies && req.cookies['csrf-token'];
  const headerToken = req.headers['x-csrf-token'] || req.headers['csrf-token'];

  // Check if both tokens exist
  if (!cookieToken || !headerToken) {
    logger.warn('CSRF validation failed: missing token', {
      path: req.path,
      method: req.method,
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
      userId: req.user?.id
    });

    return res.status(403).json({
      success: false,
      error: 'CSRF_TOKEN_MISSING',
      message: 'CSRF token is required for this operation'
    });
  }

  // Use timing-safe comparison to prevent timing attacks
  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);

  // Tokens must be same length
  if (cookieBuffer.length !== headerBuffer.length) {
    logger.warn('CSRF validation failed: token length mismatch', {
      path: req.path,
      method: req.method,
      userId: req.user?.id
    });

    return res.status(403).json({
      success: false,
      error: 'CSRF_TOKEN_INVALID',
      message: 'Invalid CSRF token'
    });
  }

  // Timing-safe comparison
  const tokensMatch = crypto.timingSafeEqual(cookieBuffer, headerBuffer);

  if (!tokensMatch) {
    logger.warn('CSRF validation failed: token mismatch', {
      path: req.path,
      method: req.method,
      userId: req.user?.id
    });

    return res.status(403).json({
      success: false,
      error: 'CSRF_TOKEN_INVALID',
      message: 'Invalid CSRF token'
    });
  }

  // Validation successful
  logger.debug('CSRF validation passed', {
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });

  next();
}

/**
 * Get current CSRF token from request (for testing)
 * @param {Object} req - Express request object
 * @returns {string|null} CSRF token or null if not set
 */
function getCsrfToken(req) {
  return (req.cookies && req.cookies['csrf-token']) || null;
}

module.exports = {
  generateCsrfToken,
  setCsrfToken,
  validateCsrfToken,
  getCsrfToken
};
