/**
 * Session refresh middleware for robust authentication
 * Implements sliding expiration and automatic session renewal
 */

const jwt = require('jsonwebtoken');
const { supabaseServiceClient } = require('../config/supabase');
const { flags } = require('../config/flags');
const logger = require('../utils/logger');

/**
 * Extract JWT token from Authorization header
 * @param {Object} req - Express request object
 * @returns {string|null} JWT token or null
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Check if token is close to expiration (within 5 minutes)
 * @param {Object} payload - JWT payload
 * @returns {boolean}
 */
function isTokenNearExpiry(payload) {
  if (!payload.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  const fiveMinutes = 5 * 60; // 5 minutes in seconds
  return payload.exp - now < fiveMinutes;
}

/**
 * Refresh user session with Supabase
 * @param {string} refreshToken - Refresh token
 * @param {string} correlationId - Optional correlation ID for tracking
 * @returns {Promise<Object>} New session data
 */
async function refreshUserSession(refreshToken, correlationId = null) {
  // Issue #628: Enable in test environment
  // ROA-524: Added correlation ID for observability
  if (process.env.NODE_ENV !== 'test' && !flags.isEnabled('ENABLE_SESSION_REFRESH')) {
    throw new Error('Session refresh is disabled');
  }

  const logContext = {
    correlation_id: correlationId,
    timestamp: new Date().toISOString(),
    service: 'session-refresh'
  };

  try {
    if (flags.isEnabled('ENABLE_MOCK_MODE') || process.env.NODE_ENV === 'test') {
      // Issue #628: Mock session refresh with Supabase mock integration
      // Delegate to Supabase anon client for proper mock handling
      const { supabaseAnonClient } = require('../config/supabase');
      const { data, error } = await supabaseAnonClient.auth.refreshSession({
        refresh_token: refreshToken
      });

      if (error || !data.session) {
        logger.error('Session refresh failed (mock mode)', {
          ...logContext,
          error: error?.message || 'Invalid refresh token'
        });
        throw new Error('Invalid refresh token');
      }

      logger.info('Session refreshed successfully (mock mode)', logContext);
      return data.session;
    }

    const { data, error } = await supabaseServiceClient.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (error) {
      logger.error('Session refresh failed', {
        ...logContext,
        error: error.message
      });
      throw error;
    }

    logger.info('Session refreshed successfully', logContext);
    return data.session;
  } catch (error) {
    logger.error('Session refresh error', {
      ...logContext,
      error: error.message
    });
    throw error;
  }
}

/**
 * Middleware to handle session refresh automatically
 * ROA-524: Added GDPR-compliant logging with correlation IDs
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
async function sessionRefreshMiddleware(req, res, next) {
  if (!flags.isEnabled('ENABLE_SESSION_REFRESH')) {
    return next();
  }

  // ROA-524: Extract or generate correlation ID for request tracking
  const correlationId = req.headers['x-correlation-id'] || req.correlationId || `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  req.correlationId = correlationId;

  const token = extractToken(req);
  if (!token) {
    return next();
  }

  try {
    // Decode token without verification to check expiry
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      return next();
    }

    // Check if token is near expiry
    if (isTokenNearExpiry(decoded)) {
      const refreshToken = req.headers['x-refresh-token'];

      if (!refreshToken) {
        logger.info('Token near expiry - no refresh token provided', {
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
          service: 'session-refresh-middleware'
        });
        return next();
      }

      try {
        const newSession = await refreshUserSession(refreshToken, correlationId);

        // Add new tokens to response headers for client to update
        res.set({
          'x-new-access-token': newSession.access_token,
          'x-new-refresh-token': newSession.refresh_token,
          'x-token-refreshed': 'true',
          'x-expires-at': newSession.expires_at,
          'x-correlation-id': correlationId
        });

        // Update request with new token for this request
        req.headers.authorization = `Bearer ${newSession.access_token}`;

        logger.info('Session auto-refreshed', {
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
          service: 'session-refresh-middleware'
        });
      } catch (refreshError) {
        logger.warn('Session auto-refresh failed', {
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
          service: 'session-refresh-middleware',
          error: refreshError.message
        });

        // Don't block the request, let auth middleware handle expired token
        return next();
      }
    }

    next();
  } catch (error) {
    logger.error('Session middleware error', {
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
      service: 'session-refresh-middleware',
      error: error.message
    });
    next();
  }
}

/**
 * Explicit session refresh endpoint
 * ROA-524: Added GDPR-compliant logging with correlation IDs
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handleSessionRefresh(req, res) {
  // Issue #628: Enable session refresh in test environment
  if (process.env.NODE_ENV !== 'test' && !flags.isEnabled('ENABLE_SESSION_REFRESH')) {
    return res.status(503).json({
      success: false,
      error: 'Session refresh is currently disabled',
      code: 'SESSION_REFRESH_DISABLED'
    });
  }

  // ROA-524: Extract or generate correlation ID for request tracking
  const correlationId = req.headers['x-correlation-id'] || req.correlationId || `sess-refresh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      logger.warn('Session refresh missing token', {
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
        service: 'session-refresh-endpoint'
      });
      
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }

    const newSession = await refreshUserSession(refresh_token, correlationId);

    // ROA-524: Add correlation ID to response headers
    res.set('x-correlation-id', correlationId);

    res.json({
      success: true,
      data: {
        access_token: newSession.access_token,
        refresh_token: newSession.refresh_token,
        expires_at: newSession.expires_at,
        expires_in: newSession.expires_in,
        user: newSession.user
      }
    });
  } catch (error) {
    logger.error('Session refresh endpoint failed', {
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
      service: 'session-refresh-endpoint',
      error: error.message
    });

    res.status(401).json({
      success: false,
      error: 'Failed to refresh session',
      code: 'SESSION_REFRESH_FAILED',
      details: flags.isEnabled('DEBUG_SESSION') ? error.message : undefined
    });
  }
}

module.exports = {
  sessionRefreshMiddleware,
  handleSessionRefresh,
  refreshUserSession,
  extractToken,
  isTokenNearExpiry
};
