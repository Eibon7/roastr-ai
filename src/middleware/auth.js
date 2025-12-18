const { getUserFromToken } = require('../config/supabase');
const { logger } = require('../utils/logger');
const {
  AUTH_ERROR_CODES,
  AuthError,
  createAuthErrorFromSupabase
} = require('../utils/authErrorTaxonomy');

/**
 * Authentication middleware for protected routes
 * Uses Auth Error Taxonomy v2 for consistent error handling
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      const error = new AuthError(AUTH_ERROR_CODES.TOKEN_MISSING);
      error.log({ endpoint: req.originalUrl, method: req.method });
      return res.status(error.httpStatus).json(error.toJSON());
    }

    // Verify token with Supabase
    let user;
    try {
      user = await getUserFromToken(token);
    } catch (supabaseError) {
      // Classify Supabase error and create AuthError
      const authError = createAuthErrorFromSupabase(
        supabaseError,
        AUTH_ERROR_CODES.TOKEN_INVALID
      );
      authError.log({
        endpoint: req.originalUrl,
        method: req.method,
        error: supabaseError.message
      });
      return res.status(authError.httpStatus).json(authError.toJSON());
    }

    if (!user) {
      const error = new AuthError(AUTH_ERROR_CODES.TOKEN_INVALID);
      error.log({ endpoint: req.originalUrl, method: req.method });
      return res.status(error.httpStatus).json(error.toJSON());
    }

    // Add user and token to request object
    req.user = user;
    req.accessToken = token;

    next();
  } catch (error) {
    // Handle unexpected errors
    if (error instanceof AuthError) {
      error.log({ endpoint: req.originalUrl, method: req.method });
      return res.status(error.httpStatus).json(error.toJSON());
    }

    // Fallback for non-AuthError exceptions
    logger.error('Authentication middleware error:', {
      message: error.message,
      stack: error.stack,
      endpoint: req.originalUrl,
      method: req.method
    });

    const authError = new AuthError(
      AUTH_ERROR_CODES.AUTH_SERVICE_UNAVAILABLE,
      'Authentication failed'
    );
    authError.log({ originalError: error.message });
    return res.status(authError.httpStatus).json(authError.toJSON());
  }
};

/**
 * Admin-only middleware
 * Uses Auth Error Taxonomy v2 for consistent error handling
 */
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      const error = new AuthError(AUTH_ERROR_CODES.TOKEN_MISSING);
      error.log({ endpoint: req.originalUrl, method: req.method });
      return res.status(error.httpStatus).json(error.toJSON());
    }

    // Query the database to check if user is admin
    const { createUserClient } = require('../config/supabase');
    const userClient = createUserClient(req.accessToken);

    const { data: userProfile, error: dbError } = await userClient
      .from('users')
      .select('is_admin')
      .eq('id', req.user.id)
      .single();

    if (dbError || !userProfile) {
      logger.error('Failed to fetch user admin status:', dbError?.message);
      const authError = new AuthError(
        AUTH_ERROR_CODES.AUTH_SERVICE_UNAVAILABLE,
        'Failed to verify admin status'
      );
      authError.log({
        endpoint: req.originalUrl,
        method: req.method,
        userId: req.user.id,
        error: dbError?.message
      });
      return res.status(authError.httpStatus).json(authError.toJSON());
    }

    if (!userProfile.is_admin) {
      const error = new AuthError(AUTH_ERROR_CODES.ADMIN_REQUIRED);
      error.log({
        endpoint: req.originalUrl,
        method: req.method,
        userId: req.user.id
      });
      return res.status(error.httpStatus).json(error.toJSON());
    }

    next();
  } catch (error) {
    if (error instanceof AuthError) {
      error.log({ endpoint: req.originalUrl, method: req.method });
      return res.status(error.httpStatus).json(error.toJSON());
    }

    logger.error('Admin middleware error:', {
      message: error.message,
      stack: error.stack,
      endpoint: req.originalUrl,
      method: req.method
    });

    const authError = new AuthError(
      AUTH_ERROR_CODES.AUTH_SERVICE_UNAVAILABLE,
      'Access verification failed'
    );
    authError.log({ originalError: error.message });
    return res.status(authError.httpStatus).json(authError.toJSON());
  }
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 * Uses Auth Error Taxonomy v2 for consistent error handling
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const user = await getUserFromToken(token);
        if (user) {
          req.user = user;
          req.accessToken = token;
        }
      } catch (supabaseError) {
        // Log but don't fail - this is optional auth
        const authError = createAuthErrorFromSupabase(
          supabaseError,
          AUTH_ERROR_CODES.TOKEN_INVALID
        );
        authError.log({
          endpoint: req.originalUrl,
          method: req.method,
          context: 'optional_auth',
          error: supabaseError.message
        });
        // Continue without authentication
      }
    }

    next();
  } catch (error) {
    // Log but don't fail - this is optional auth
    logger.warn('Optional auth middleware error:', {
      message: error.message,
      endpoint: req.originalUrl,
      method: req.method
    });
    next(); // Continue without authentication
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  optionalAuth
};
