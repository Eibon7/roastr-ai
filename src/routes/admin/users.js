/**
 * Admin Users API Routes
 * Epic #1037: Admin Panel - User Management
 *
 * Provides secure endpoints for managing users
 * - GET /api/admin/users - List all users with pagination and filters
 * - POST /api/admin/users/:id/toggle-admin - Toggle admin status
 * - POST /api/admin/users/:id/toggle-active - Toggle active status
 * - POST /api/admin/users/:id/suspend - Suspend user
 * - POST /api/admin/users/:id/reactivate - Reactivate user
 * - PATCH /api/admin/users/:id/plan - Update user plan
 */

const express = require('express');
const router = express.Router();
const { supabaseServiceClient } = require('../../config/supabase');
const { requireAdmin } = require('../../middleware/auth');
const { logger } = require('../../utils/logger');
const SafeUtils = require('../../utils/safeUtils');
const { VALID_PLANS } = require('../../config/planMappings');

// Apply admin middleware to all routes
router.use(requireAdmin);

/**
 * GET /api/admin/users
 * Get paginated list of users with optional filters
 */
router.get('/', async (req, res) => {
  try {
    const {
      limit = 50,
      page = 1,
      search = '',
      plan = '',
      active_only = false
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    let query = supabaseServiceClient
      .from('users')
      .select('id, email, name, is_admin, plan, active, suspended, created_at, last_login', { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
    }

    if (plan) {
      query = query.eq('plan', plan);
    }

    if (active_only === 'true') {
      query = query.eq('active', true).eq('suspended', false);
    }

    // Apply pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    const { data: users, error, count } = await query;

    if (error) {
      throw error;
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(count / parseInt(limit));
    const hasMore = parseInt(page) < totalPages;

    logger.info('Users retrieved', {
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
      totalUsers: count,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: {
        users: users.map(user => ({
          ...user,
          email: SafeUtils.maskEmail(user.email) // Mask emails for privacy
        })),
        pagination: {
          total: count,
          limit: parseInt(limit),
          offset: offset,
          page: parseInt(page),
          total_pages: totalPages,
          has_more: hasMore
        }
      }
    });
  } catch (error) {
    logger.error('Failed to retrieve users', {
      error: error.message,
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve users'
    });
  }
});

/**
 * POST /api/admin/users/:id/toggle-admin
 * Toggle admin status for a user
 */
router.post('/:id/toggle-admin', async (req, res) => {
  try {
    const { id } = req.params;

    // Get current user
    const { data: user, error: fetchError } = await supabaseServiceClient
      .from('users')
      .select('id, email, is_admin')
      .eq('id', id)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Prevent self-demotion
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify your own admin status'
      });
    }

    // Toggle admin status
    const newAdminStatus = !user.is_admin;

    const { error: updateError } = await supabaseServiceClient
      .from('users')
      .update({ is_admin: newAdminStatus })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    logger.info('User admin status toggled', {
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
      targetUserId: SafeUtils.safeUserIdPrefix(id),
      newStatus: newAdminStatus
    });

    res.json({
      success: true,
      data: {
        user: { ...user, is_admin: newAdminStatus },
        message: `User ${newAdminStatus ? 'promoted to' : 'demoted from'} admin`
      }
    });
  } catch (error) {
    logger.error('Failed to toggle admin status', {
      error: error.message,
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
    });

    res.status(500).json({
      success: false,
      error: 'Failed to toggle admin status'
    });
  }
});

/**
 * POST /api/admin/users/:id/toggle-active
 * Toggle active status for a user
 */
router.post('/:id/toggle-active', async (req, res) => {
  try {
    const { id } = req.params;

    // Get current user
    const { data: user, error: fetchError } = await supabaseServiceClient
      .from('users')
      .select('id, email, active, suspended')
      .eq('id', id)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Prevent self-deactivation
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify your own active status'
      });
    }

    // Toggle active status
    const newActiveStatus = !user.active;

    const { error: updateError } = await supabaseServiceClient
      .from('users')
      .update({ active: newActiveStatus })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    logger.info('User active status toggled', {
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
      targetUserId: SafeUtils.safeUserIdPrefix(id),
      newStatus: newActiveStatus
    });

    res.json({
      success: true,
      data: {
        user: { ...user, active: newActiveStatus },
        message: `User ${newActiveStatus ? 'activated' : 'deactivated'}`
      }
    });
  } catch (error) {
    logger.error('Failed to toggle active status', {
      error: error.message,
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
    });

    res.status(500).json({
      success: false,
      error: 'Failed to toggle active status'
    });
  }
});

/**
 * POST /api/admin/users/:id/suspend
 * Suspend a user account
 */
router.post('/:id/suspend', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Prevent self-suspension
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot suspend your own account'
      });
    }

    const { error } = await supabaseServiceClient
      .from('users')
      .update({
        suspended: true,
        active: false,
        suspension_reason: reason || null,
        suspended_at: new Date().toISOString(),
        suspended_by: req.user.id
      })
      .eq('id', id);

    if (error) {
      throw error;
    }

    logger.info('User suspended', {
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
      targetUserId: SafeUtils.safeUserIdPrefix(id),
      reason: reason || 'No reason provided'
    });

    res.json({
      success: true,
      data: {
        message: 'User suspended successfully'
      }
    });
  } catch (error) {
    logger.error('Failed to suspend user', {
      error: error.message,
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
    });

    res.status(500).json({
      success: false,
      error: 'Failed to suspend user'
    });
  }
});

/**
 * POST /api/admin/users/:id/reactivate
 * Reactivate a suspended user account
 */
router.post('/:id/reactivate', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseServiceClient
      .from('users')
      .update({
        suspended: false,
        active: true,
        suspension_reason: null,
        suspended_at: null,
        suspended_by: null
      })
      .eq('id', id);

    if (error) {
      throw error;
    }

    logger.info('User reactivated', {
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
      targetUserId: SafeUtils.safeUserIdPrefix(id)
    });

    res.json({
      success: true,
      data: {
        message: 'User reactivated successfully'
      }
    });
  } catch (error) {
    logger.error('Failed to reactivate user', {
      error: error.message,
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
    });

    res.status(500).json({
      success: false,
      error: 'Failed to reactivate user'
    });
  }
});

/**
 * PATCH /api/admin/users/:id/plan
 * Update user's subscription plan
 */
router.patch('/:id/plan', async (req, res) => {
  try {
    const { id } = req.params;
    const { plan } = req.body;

    // Validate plan
    if (!VALID_PLANS.includes(plan)) {
      return res.status(400).json({
        success: false,
        error: `Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}`
      });
    }

    const { error } = await supabaseServiceClient
      .from('users')
      .update({
        plan: plan,
        plan_updated_at: new Date().toISOString(),
        plan_updated_by: req.user.id
      })
      .eq('id', id);

    if (error) {
      throw error;
    }

    logger.info('User plan updated', {
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
      targetUserId: SafeUtils.safeUserIdPrefix(id),
      newPlan: plan
    });

    res.json({
      success: true,
      data: {
        message: `User plan updated to ${plan}`,
        user: { id, plan }
      }
    });
  } catch (error) {
    logger.error('Failed to update user plan', {
      error: error.message,
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
    });

    res.status(500).json({
      success: false,
      error: 'Failed to update user plan'
    });
  }
});

module.exports = router;
