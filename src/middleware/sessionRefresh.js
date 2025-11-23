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
 * @returns {Promise<Object>} New session data
 */
async function refreshUserSession(refreshToken) {
  // Issue #628: Enable in test environment
  if (process.env.NODE_ENV !== 'test' && !flags.isEnabled('ENABLE_SESSION_REFRESH')) {
    throw new Error('Session refresh is disabled');
  }

  try {
    if (flags.isEnabled('ENABLE_MOCK_MODE') || process.env.NODE_ENV === 'test') {
      // Issue #628: Mock session refresh with Supabase mock integration
      // Delegate to Supabase anon client for proper mock handling
      const { supabaseAnonClient } = require('../config/supabase');
      const { data, error } = await supabaseAnonClient.auth.refreshSession({
        refresh_token: refreshToken
      });

      if (error || !data.session) {
        throw new Error('Invalid refresh token');
      }

      return data.session;
    }

    const { data, error } = await supabaseServiceClient.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (error) {
      if (flags.isEnabled('DEBUG_SESSION')) {
        logger.error('Session refresh error:', error);
      }
      throw error;
    }

    return data.session;
  } catch (error) {
    if (flags.isEnabled('DEBUG_SESSION')) {
      logger.error('Failed to refresh session:', error.message);
    }
    throw error;
  }
}

/**
 * Middleware to handle session refresh automatically
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
async function sessionRefreshMiddleware(req, res, next) {
  if (!flags.isEnabled('ENABLE_SESSION_REFRESH')) {
    return next();
  }

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
        if (flags.isEnabled('DEBUG_SESSION')) {
          logger.info('Token near expiry but no refresh token provided');
        }
        return next();
      }

      try {
        const newSession = await refreshUserSession(refreshToken);

        // Add new tokens to response headers for client to update
        res.set({
          'x-new-access-token': newSession.access_token,
          'x-new-refresh-token': newSession.refresh_token,
          'x-token-refreshed': 'true',
          'x-expires-at': newSession.expires_at
        });

        // Update request with new token for this request
        req.headers.authorization = `Bearer ${newSession.access_token}`;

        if (flags.isEnabled('DEBUG_SESSION')) {
          logger.info('Session refreshed automatically');
        }
      } catch (refreshError) {
        if (flags.isEnabled('DEBUG_SESSION')) {
          logger.error('Auto refresh failed:', refreshError.message);
        }

        // Don't block the request, let auth middleware handle expired token
        return next();
      }
    }

    next();
  } catch (error) {
    if (flags.isEnabled('DEBUG_SESSION')) {
      logger.error('Session middleware error:', error.message);
    }
    next();
  }
}

/**
 * Explicit session refresh endpoint
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

  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }

    const newSession = await refreshUserSession(refresh_token);

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
    if (flags.isEnabled('DEBUG_SESSION')) {
      logger.error('Session refresh endpoint error:', error);
    }

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
