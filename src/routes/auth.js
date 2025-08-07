const express = require('express');
const authService = require('../services/authService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/auth/signup
 * Register new user with email and password
 */
router.post('/signup', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }
        
        const result = await authService.signUp({ email, password, name });
        
        res.status(201).json({
            success: true,
            data: {
                user: {
                    id: result.user.id,
                    email: result.user.email,
                    email_confirmed: result.user.email_confirmed_at ? true : false
                },
                session: result.session,
                profile: result.profile
            }
        });
        
    } catch (error) {
        logger.error('Signup endpoint error:', error.message);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/auth/signup/magic-link
 * Register new user with magic link
 */
router.post('/signup/magic-link', async (req, res) => {
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
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }
        
        const result = await authService.signIn({ email, password });
        
        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: result.user.id,
                    email: result.user.email,
                    email_confirmed: result.user.email_confirmed_at ? true : false
                },
                session: result.session,
                profile: result.profile
            }
        });
        
    } catch (error) {
        logger.error('Login endpoint error:', error.message);
        res.status(401).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/auth/login/magic-link
 * Login with magic link
 */
router.post('/login/magic-link', async (req, res) => {
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
 * Reset user password
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }
        
        const result = await authService.resetPassword(email);
        
        res.status(200).json({
            success: true,
            data: result
        });
        
    } catch (error) {
        logger.error('Reset password endpoint error:', error.message);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Admin routes
/**
 * GET /api/auth/admin/users
 * List all users (admin only)
 */
router.get('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        
        const users = await authService.listUsers(parseInt(limit), parseInt(offset));
        
        res.status(200).json({
            success: true,
            data: users
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
        
        const result = await authService.createUserManually({
            email, password, name, plan, isAdmin
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
 * POST /api/auth/admin/users/update-plan
 * Update user plan (admin only)
 */
router.post('/admin/users/update-plan', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId, newPlan } = req.body;
        
        if (!userId || !newPlan) {
            return res.status(400).json({
                success: false,
                error: 'User ID and new plan are required'
            });
        }
        
        // Validate plan value
        const validPlans = ['free', 'pro', 'creator_plus', 'custom'];
        if (!validPlans.includes(newPlan)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid plan. Valid plans are: ' + validPlans.join(', ')
            });
        }
        
        const result = await authService.updateUserPlan(userId, newPlan);
        
        res.status(200).json({
            success: true,
            data: result
        });
        
    } catch (error) {
        logger.error('Update user plan endpoint error:', error.message);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
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

module.exports = router;