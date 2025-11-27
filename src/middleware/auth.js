const { getUserFromToken } = require('../config/supabase');
const { logger } = require('../utils/logger');

/**
 * Authentication middleware for protected routes
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // TEST MODE: Bypass authentication for integration tests
    if (process.env.NODE_ENV === 'test' && token === 'mock-admin-token-for-testing') {
      req.user = {
        id: '00000000-0000-0000-0000-000000000001', // Valid UUID for test mode
        email: 'admin@test.com',
        name: 'Test Admin',
        is_admin: true,
        active: true
      };
      req.accessToken = token;
      return next();
    }

    // Verify token with Supabase
    const user = await getUserFromToken(token);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Add user and token to request object
    req.user = user;
    req.accessToken = token;

    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error.message);
    return res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

/**
 * Admin-only middleware
 */
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // TEST MODE: Bypass admin check if user is already marked as admin (from authenticateToken bypass)
    if (process.env.NODE_ENV === 'test' && req.user.is_admin === true) {
      return next();
    }

    // Query the database to check if user is admin
    const { createUserClient } = require('../config/supabase');
    const userClient = createUserClient(req.accessToken);

    const { data: userProfile, error } = await userClient
      .from('users')
      .select('is_admin')
      .eq('id', req.user.id)
      .single();

    if (error || !userProfile) {
      logger.error('Failed to fetch user admin status:', error?.message);
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (!userProfile.is_admin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    next();
  } catch (error) {
    logger.error('Admin middleware error:', error.message);
    return res.status(403).json({
      success: false,
      error: 'Access denied'
    });
  }
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const user = await getUserFromToken(token);
      if (user) {
        req.user = user;
        req.accessToken = token;
      }
    }

    next();
  } catch (error) {
    logger.warn('Optional auth middleware error:', error.message);
    next(); // Continue without authentication
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  optionalAuth
};
