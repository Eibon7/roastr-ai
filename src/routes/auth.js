const express = require('express');
const authService = require('../services/authService');
const emailService = require('../services/emailService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { handleSessionRefresh } = require('../middleware/sessionRefresh');
// ROA-523: Legacy rate limiters removed from Auth endpoints (migrated to authPolicyGate per-endpoint)
// Keep utility functions for admin/monitoring endpoints
const { getRateLimitMetrics, resetRateLimit } = require('../middleware/rateLimiter');
const { passwordChangeRateLimiter } = require('../middleware/passwordChangeRateLimiter');
// ROA-523: Auth Policy Gate (unified rate limiting)
const { authPolicyGate } = require('../middleware/authPolicyGate');
const { AUTH_ACTIONS, AUTH_TYPES } = require('../constants/authActions');
const { flags } = require('../config/flags');
const { validatePassword } = require('../utils/passwordValidator');
const passwordValidationService = require('../services/passwordValidationService');
const {
  isPasswordReused,
  addPasswordToHistory,
  isPasswordHistoryEnabled
} = require('../services/passwordHistoryService');
// Issue #947: Zod validation schemas for auth endpoints
const { registerSchema, loginSchema, formatZodError } = require('../validators/zod/auth.schema');

const router = express.Router();

// ROA-523: Legacy rate limiters removed - now using authPolicyGate per-endpoint
// (No global middleware - rate limiting applied at Auth Policy Gate per action)

/**
 * POST /api/auth/register
 * Register new user with email and password
 * ROA-523: Rate limiting evaluated at Auth Policy Gate before business logic
 */
router.post('/register',
  authPolicyGate({ action: AUTH_ACTIONS.REGISTER, authType: AUTH_TYPES.PASSWORD }),
  async (req, res) => {
  try {
    // Issue #947: Zod validation for register endpoint
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: formatZodError(validation.error)
      });
    }

    const { email, password, name } = validation.data;

    // Register user
    const result = await authService.signUp({ email, password, name });

    logger.info('User registration successful:', { email, userId: result.user.id });

    // Send welcome email (don't block registration if email fails)
    emailService
      .sendWelcomeEmail(email, {
        userName: name,
        name: name,
        language: 'es'
      })
      .catch((error) => {
        logger.warn('Failed to send welcome email:', { email, error: error.message });
      });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          email_confirmed: result.user.email_confirmed_at !== null
        }
      }
    });
  } catch (error) {
    logger.error('Registration error:', error.message);

    // Handle specific Supabase errors
    if (error.message.includes('already registered') || error.message.includes('already exists')) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.'
    });
  }
});

/**
 * POST /api/auth/signup (legacy endpoint - same as register)
 * Register new user with email and password
 * Issue #947: Migrated to Zod validation
 * ROA-523: Rate limiting evaluated at Auth Policy Gate before business logic
 */
router.post('/signup',
  authPolicyGate({ action: AUTH_ACTIONS.REGISTER, authType: AUTH_TYPES.PASSWORD }),
  async (req, res) => {
  try {
    // Issue #947: Zod validation for signup endpoint (same as register)
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: formatZodError(validation.error)
      });
    }

    const { email, password, name } = validation.data;

    // Register user
    const result = await authService.signUp({ email, password, name });

    logger.info('User registration successful (via /signup):', { email, userId: result.user.id });

    // Send welcome email (don't block registration if email fails)
    emailService
      .sendWelcomeEmail(email, {
        userName: name,
        name: name,
        language: 'es'
      })
      .catch((error) => {
        logger.warn('Failed to send welcome email:', { email, error: error.message });
      });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          email_confirmed: result.user.email_confirmed_at !== null
        },
        session: result.session
      }
    });
  } catch (error) {
    logger.error('Registration error (via /signup):', error.message);

    // Handle specific Supabase errors
    if (error.message.includes('already registered') || error.message.includes('already exists')) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.'
    });
  }
});

/**
 * POST /api/auth/signup/magic-link
 * Register new user with magic link
 * ROA-523: Rate limiting evaluated at Auth Policy Gate before business logic
 */
router.post('/signup/magic-link',
  authPolicyGate({ action: AUTH_ACTIONS.REGISTER, authType: AUTH_TYPES.MAGIC_LINK }),
  async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const result = await authService.signUpWithMagicLink({ email, name });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Magic link signup endpoint error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 * ROA-523: Rate limiting evaluated at Auth Policy Gate before business logic
 */
router.post('/login',
  authPolicyGate({ action: AUTH_ACTIONS.LOGIN, authType: AUTH_TYPES.PASSWORD }),
  async (req, res) => {
  try {
    // Issue #947: Zod validation for login endpoint
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: formatZodError(validation.error)
      });
    }

    const { email, password } = validation.data;
    const { keepLogged = false } = req.body; // Optional field, not validated

    // Attempt login
    const result = await authService.signIn({ email, password });

    logger.info('User login successful:', { email, userId: result.user.id });

    // Issue #947: Maintain original response structure (no breaking changes)
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        session: {
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
          expires_at: result.session.expires_at
        },
        user: {
          id: result.user.id,
          email: result.user.email,
          email_confirmed: result.user.email_confirmed_at !== null,
          is_admin: result.profile?.is_admin || false,
          name: result.profile?.name,
          plan: result.profile?.plan || 'basic'
        }
      }
    });
  } catch (error) {
    logger.error('Login error:', error.message);

    // Generic error message for security (don't reveal if email exists)
    res.status(401).json({
      success: false,
      error: 'Wrong email or password'
    });
  }
});

/**
 * POST /api/auth/magic-link
 * Send magic link for passwordless login
 * ROA-523: Rate limiting evaluated at Auth Policy Gate before business logic
 */
router.post('/magic-link',
  authPolicyGate({ action: AUTH_ACTIONS.MAGIC_LINK, authType: AUTH_TYPES.MAGIC_LINK }),
  async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const result = await authService.signInWithMagicLink(email);

    logger.info('Magic link sent:', { email });

    res.json({
      success: true,
      message: 'Magic link sent to your email. Please check your inbox.',
      data: { email }
    });
  } catch (error) {
    logger.error('Magic link error:', error.message);

    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If an account with this email exists, a magic link has been sent.'
    });
  }
});

/**
 * POST /api/auth/login/magic-link (legacy endpoint)
 * Login with magic link
 * ROA-523: Rate limiting evaluated at Auth Policy Gate before business logic
 */
router.post('/login/magic-link',
  authPolicyGate({ action: AUTH_ACTIONS.MAGIC_LINK, authType: AUTH_TYPES.MAGIC_LINK }),
  async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const result = await authService.signInWithMagicLink(email);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Magic link login endpoint error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout current user
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const result = await authService.signOut(req.accessToken);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Logout endpoint error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const profile = await authService.getCurrentUser(req.accessToken);

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    logger.error('Get me endpoint error:', error.message);
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const updates = req.body;

    // Remove sensitive fields that shouldn't be updated via API
    delete updates.id;
    delete updates.email;
    delete updates.created_at;
    delete updates.updated_at;
    delete updates.is_admin;
    delete updates.plan; // Plan changes should go through billing

    const profile = await authService.updateProfile(req.accessToken, updates);

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    logger.error('Update profile endpoint error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Send password reset email
 * ROA-523: Rate limiting evaluated at Auth Policy Gate before business logic
 */
router.post('/reset-password',
  authPolicyGate({ action: AUTH_ACTIONS.PASSWORD_RECOVERY, authType: AUTH_TYPES.PASSWORD_RESET }),
  async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const result = await authService.resetPassword(email);

    logger.info('Password reset requested:', { email });

    res.json({
      success: true,
      message: 'If an account with this email exists, a reset link has been sent.',
      data: { email }
    });
  } catch (error) {
    logger.error('Password reset error:', error.message);

    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If an account with this email exists, a reset link has been sent.'
    });
  }
});

/**
 * POST /api/auth/update-password
 * Update password with reset token
 */
router.post('/update-password', async (req, res) => {
  try {
    const { access_token, password } = req.body;

    if (!access_token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Access token and new password are required'
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: passwordValidation.errors.join('. ')
      });
    }

    const result = await authService.updatePassword(access_token, password);

    logger.info('Password updated successfully for user');

    res.json({
      success: true,
      message: 'Password updated successfully. You can now login with your new password.',
      data: result
    });
  } catch (error) {
    logger.error('Password update error:', error.message);

    res.status(400).json({
      success: false,
      error: 'Failed to update password. The reset link may have expired.'
    });
  }
});

/**
 * POST /api/auth/change-password
 * Update password with current password verification (Issue #89 + #133)
 * With rate limiting for security (Issue #133)
 */
router.post('/change-password', authenticateToken, passwordChangeRateLimiter, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const accessToken = req.headers.authorization?.replace('Bearer ', '');

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    // Get current user's password hash for validation
    const userClient = createUserClient(accessToken);
    const { data: userData, error: userError } = await userClient
      .from('users')
      .select('password')
      .eq('id', req.user.id)
      .single();

    if (userError || !userData) {
      logger.error('Failed to retrieve user for password change:', userError);
      return res.status(500).json({
        success: false,
        error: 'Unable to verify current password'
      });
    }

    // Use the new password validation service
    const validation = await passwordValidationService.validatePasswordChange(
      req.user.id,
      currentPassword,
      newPassword,
      confirmPassword || newPassword, // Use newPassword as confirmation if not provided
      userData.password
    );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error,
        code: validation.code,
        details: validation.details,
        validationId: validation.validationId
      });
    }

    // Check password history (if enabled)
    if (isPasswordHistoryEnabled()) {
      const isReused = await isPasswordReused(req.user.id, newPassword);
      if (isReused) {
        return res.status(400).json({
          success: false,
          error: 'Cannot reuse a recent password. Please choose a different password.',
          code: 'PASSWORD_RECENTLY_USED'
        });
      }
    }

    const result = await authService.updatePasswordWithVerification(
      accessToken,
      currentPassword,
      newPassword
    );

    logger.info('Password changed successfully with enhanced validation:', {
      userId: req.user.id,
      validationId: validation.validationId,
      strengthScore: validation.strengthScore
    });

    // Add password to history (if enabled)
    if (isPasswordHistoryEnabled()) {
      await addPasswordToHistory(req.user.id, newPassword);
    }

    res.json({
      success: true,
      message: 'Password changed successfully. Please use your new password for future logins.',
      data: result,
      validationId: validation.validationId
    });
  } catch (error) {
    logger.error('Change password error:', error.message);

    // Provide specific error messages for better UX
    let statusCode = 400;
    let errorMessage = error.message;

    if (error.message.includes('Current password is incorrect')) {
      statusCode = 401;
      errorMessage = 'Current password is incorrect';
    } else if (error.message.includes('Authentication failed')) {
      statusCode = 401;
      errorMessage = 'Authentication failed. Please log in again.';
    } else if (error.message.includes('User not found')) {
      statusCode = 404;
      errorMessage = 'User not found';
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * GET /api/auth/google
 * Initiate Google OAuth flow
 */
router.get('/google', async (req, res) => {
  try {
    const result = await authService.signInWithGoogle();

    // Redirect to Google OAuth URL
    res.redirect(result.url);
  } catch (error) {
    logger.error('Google OAuth initiation error:', error.message);
    res.redirect('/login.html?message=Google authentication is temporarily unavailable&type=error');
  }
});

/**
 * GET /api/auth/health
 * Health check endpoint for auth service
 * ROA-524: Session Refresh and Health Check Completion
 * 
 * @public No authentication required
 * @returns {Object} health - Auth service health status with feature flags
 */
router.get('/health', (req, res) => {
  try {
    // ROA-524: Report auth-specific service status
    const authHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      features: {
        sessionRefresh: flags.isEnabled('ENABLE_SESSION_REFRESH') ? 'enabled' : 'disabled',
        magicLink: flags.isEnabled('ENABLE_MAGIC_LINK') ? 'enabled' : 'disabled',
        passwordHistory: flags.isEnabled('ENABLE_PASSWORD_HISTORY') ? 'enabled' : 'disabled',
        rateLimit: flags.isEnabled('ENABLE_RATE_LIMIT') ? 'enabled' : 'disabled',
        csrfProtection: flags.isEnabled('ENABLE_CSRF_PROTECTION') ? 'enabled' : 'disabled'
      },
      services: {
        supabase: flags.isEnabled('ENABLE_SUPABASE') ? 'available' : 'mock',
        email: flags.isEnabled('ENABLE_EMAIL_NOTIFICATIONS') ? 'available' : 'unavailable'
      }
    };

    res.status(200).json(authHealth);
  } catch (error) {
    logger.error('Auth health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

/**
 * POST /api/auth/google (legacy endpoint for frontend requests)
 * Handle Google OAuth login
 */
router.post('/google', async (req, res) => {
  try {
    // For frontend JavaScript requests, return the OAuth URL
    const result = await authService.signInWithGoogle();

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Google auth error:', error.message);

    res.status(500).json({
      success: false,
      error: 'Google authentication is not yet configured. Please contact support.'
    });
  }
});

/**
 * GET /api/auth/callback
 * Handle OAuth callback from providers (Google, etc.)
 */
router.get('/callback', async (req, res) => {
  try {
    const { access_token, refresh_token, error } = req.query;

    if (error) {
      logger.error('OAuth callback error:', error);
      return res.redirect('/login.html?message=Authentication failed&type=error');
    }

    if (!access_token) {
      return res.redirect(
        '/login.html?message=Authentication failed - no token received&type=error'
      );
    }

    // Handle the OAuth callback
    const result = await authService.handleOAuthCallback(access_token, refresh_token);

    // Set session data for frontend
    const sessionData = {
      access_token: result.session.access_token,
      refresh_token: result.session.refresh_token,
      user: {
        id: result.user.id,
        email: result.user.email,
        email_confirmed: true,
        is_admin: result.profile?.is_admin || false,
        name: result.profile?.name,
        plan: result.profile?.plan || 'basic'
      }
    };

    // Redirect to dashboard with session data (URL params for frontend to handle)
    const encodedData = encodeURIComponent(JSON.stringify(sessionData));
    res.redirect(`/dashboard.html?auth_data=${encodedData}&type=oauth_success`);
  } catch (error) {
    logger.error('OAuth callback processing error:', error.message);
    res.redirect('/login.html?message=Authentication failed during processing&type=error');
  }
});

/**
 * GET /api/auth/verify
 * Verify email confirmation token
 */
router.get('/verify', async (req, res) => {
  try {
    const { token, type, email } = req.query;

    if (!token || !type || !email) {
      return res.redirect('/login.html?message=Invalid verification link&type=error');
    }

    // Verify the token with Supabase
    const result = await authService.verifyEmail(token, type, email);

    if (result.success) {
      logger.info('Email verified successfully:', { email });
      res.redirect(
        '/login.html?message=Email verified successfully. You can now log in.&type=success'
      );
    } else {
      res.redirect('/login.html?message=Email verification failed or link expired.&type=error');
    }
  } catch (error) {
    logger.error('Email verification error:', error.message);
    res.redirect('/login.html?message=Email verification failed.&type=error');
  }
});

/**
 * POST /api/auth/session/refresh
 * Refresh user session with new tokens
 */
router.post('/session/refresh', handleSessionRefresh);

/**
 * GET /api/auth/rate-limit/metrics
 * Get rate limiting metrics (mock mode only)
 */
router.get('/rate-limit/metrics', getRateLimitMetrics);

/**
 * POST /api/auth/rate-limit/reset
 * Reset rate limiting for IP/email (testing only)
 */
router.post('/rate-limit/reset', resetRateLimit);

// Admin routes
/**
 * GET /api/auth/admin/users
 * List all users with search and filters (admin only)
 */
router.get('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      limit = 20,
      offset = 0,
      search = '',
      plan = null,
      active = null,
      suspended = null,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      search: search,
      plan: plan,
      active: active === 'true' ? true : active === 'false' ? false : null,
      suspended: suspended === 'true' ? true : suspended === 'false' ? false : null,
      sortBy: sortBy,
      sortOrder: sortOrder
    };

    const result = await authService.listUsers(options);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('List users endpoint error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/admin/users
 * Create user manually (admin only)
 */
router.post('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, name, plan, isAdmin } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Validate password if provided
    if (password) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: passwordValidation.errors.join('. ')
        });
      }
    }

    const result = await authService.createUserManually({
      email,
      password,
      name,
      plan,
      isAdmin
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Create user manually endpoint error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/auth/admin/users/:userId
 * Delete user (admin only)
 */
router.delete('/admin/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const result = await authService.deleteUser(userId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Delete user endpoint error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Helper function to update user plan
 * Shared logic for all plan update endpoints (DRY principle)
 */
const updateUserPlanHandler = async (userId, newPlan, adminId, res) => {
  try {
    // Review #3366641810: Validate adminId presence before service call
    if (!adminId) {
      return res.status(400).json({
        success: false,
        error: 'Admin ID is required'
      });
    }

    if (!userId || !newPlan) {
      return res.status(400).json({
        success: false,
        error: 'User ID and new plan are required'
      });
    }

    // Validate plan value
    const validPlans = ['starter_trial', 'starter', 'pro', 'plus', 'creator_plus', 'custom'];
    if (!validPlans.includes(newPlan)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan. Valid plans are: ' + validPlans.join(', ')
      });
    }

    const result = await authService.updateUserPlan(userId, newPlan, adminId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Update user plan error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/auth/admin/users/:id/plan
 * Update user plan (admin only) - CANONICAL RESTful endpoint
 * Takes userId from URL path, newPlan from body
 */
router.post('/admin/users/:id/plan', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { newPlan } = req.body;
  return updateUserPlanHandler(id, newPlan, req.user.id, res);
});

/**
 * POST /api/auth/admin/users/update-plan
 * @deprecated Use POST /admin/users/:id/plan instead
 * Legacy endpoint - kept for backward compatibility
 */
router.post('/admin/users/update-plan', authenticateToken, requireAdmin, async (req, res) => {
  const { userId, newPlan } = req.body;
  return updateUserPlanHandler(userId, newPlan, req.user.id, res);
});

/**
 * POST /api/auth/admin/users/:id/update-plan
 * @deprecated Use POST /admin/users/:id/plan instead
 * Legacy endpoint - kept for backward compatibility
 */
router.post('/admin/users/:id/update-plan', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { newPlan } = req.body;
  return updateUserPlanHandler(id, newPlan, req.user.id, res);
});

/**
 * POST /api/auth/admin/users/reset-password
 * Reset user password (admin only)
 */
router.post('/admin/users/reset-password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const result = await authService.adminResetPassword(userId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Admin reset password endpoint error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/auth/admin/users/:id
 * Get user details (admin only)
 */
router.get('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const result = await authService.getUserStats(id);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get user details endpoint error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/admin/users/:id/toggle-active
 * Toggle user active status (admin only)
 */
router.post('/admin/users/:id/toggle-active', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const result = await authService.toggleUserActive(id, req.user.id);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Toggle user active endpoint error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/admin/users/:id/suspend
 * Suspend user account (admin only)
 */
router.post('/admin/users/:id/suspend', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Prevent self-suspension
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Administrators cannot suspend their own accounts'
      });
    }

    const result = await authService.suspendUser(id, req.user.id, reason);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Suspend user endpoint error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/admin/users/:id/unsuspend
 * Unsuspend user account (admin only)
 */
router.post('/admin/users/:id/unsuspend', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const result = await authService.unsuspendUser(id, req.user.id);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Unsuspend user endpoint error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/auth/admin/users/:id/stats
 * Get user usage statistics (admin only)
 */
router.get('/admin/users/:id/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const result = await authService.getUserStats(id);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get user stats endpoint error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/change-email
 * Change user email with verification
 */
router.post('/change-email', authenticateToken, async (req, res) => {
  try {
    const { currentEmail, newEmail } = req.body;
    const userId = req.user.id;
    const accessToken = req.headers.authorization?.replace('Bearer ', '');

    // Validate input
    if (!currentEmail || !newEmail) {
      return res.status(400).json({
        success: false,
        error: 'Current email and new email are required'
      });
    }

    if (currentEmail === newEmail) {
      return res.status(400).json({
        success: false,
        error: 'New email must be different from current email'
      });
    }

    const result = await authService.changeEmail({
      userId,
      currentEmail,
      newEmail,
      accessToken
    });

    logger.info('Email change request processed:', { userId, currentEmail, newEmail });

    res.json({
      success: true,
      message: result.message,
      data: {
        requiresConfirmation: result.requiresConfirmation
      }
    });
  } catch (error) {
    logger.error('Change email endpoint error:', error.message);

    // Return appropriate error messages
    let statusCode = 400;
    if (error.message.includes('not found')) {
      statusCode = 404;
    } else if (error.message.includes('already in use')) {
      statusCode = 409;
    }

    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/confirm-email-change
 * Confirm email change with token from email
 */
router.post('/confirm-email-change', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Confirmation token is required'
      });
    }

    const result = await authService.confirmEmailChange(token);

    logger.info('Email change confirmed successfully');

    res.json({
      success: true,
      message: result.message,
      data: {
        user: result.user
          ? {
              id: result.user.id,
              email: result.user.email
            }
          : null
      }
    });
  } catch (error) {
    logger.error('Confirm email change endpoint error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/auth/export-data
 * Export user data (GDPR compliance)
 */
router.get('/export-data', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await authService.exportUserData(userId);

    logger.info('User data exported:', { userId });

    res.json({
      success: true,
      message: 'User data exported successfully',
      data: result
    });
  } catch (error) {
    logger.error('Export user data endpoint error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/delete-account
 * Request account deletion (with grace period)
 */
router.post('/delete-account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { confirmEmail } = req.body;

    if (!confirmEmail || confirmEmail !== req.user.email) {
      return res.status(400).json({
        success: false,
        error: 'Email confirmation is required to delete account'
      });
    }

    const result = await authService.requestAccountDeletion(userId);

    logger.info('Account deletion requested:', { userId });

    res.json({
      success: true,
      message: result.message,
      data: {
        gracePeriodEnds: result.gracePeriodEnds,
        canCancel: true
      }
    });
  } catch (error) {
    logger.error('Delete account endpoint error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/cancel-account-deletion
 * Cancel pending account deletion
 */
router.post('/cancel-account-deletion', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await authService.cancelAccountDeletion(userId);

    logger.info('Account deletion cancelled:', { userId });

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    logger.error('Cancel account deletion endpoint error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
