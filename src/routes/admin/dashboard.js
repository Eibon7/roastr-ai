/**
 * Admin Dashboard API Routes
 * Epic #1037: Admin Panel - Dashboard and Metrics
 *
 * Provides secure endpoints for dashboard data and system metrics
 * - GET /api/admin/dashboard - Get dashboard overview metrics
 */

const express = require('express');
const router = express.Router();
const { supabaseServiceClient } = require('../../config/supabase');
const { requireAdmin } = require('../../middleware/auth');
const { logger } = require('../../utils/logger');
const SafeUtils = require('../../utils/safeUtils');
const metricsService = require('../../services/metricsService');

// Apply admin middleware to all routes
router.use(requireAdmin);

/**
 * GET /api/admin/dashboard
 * Get dashboard overview metrics
 */
router.get('/', async (req, res) => {
  try {
    // Get user statistics
    const { data: users, error: usersError } = await supabaseServiceClient
      .from('users')
      .select('id, active, suspended, plan, created_at');

    if (usersError) {
      throw usersError;
    }

    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.active && !u.suspended).length;
    const suspendedUsers = users.filter(u => u.suspended).length;

    // Count users by plan
    const usersByPlan = users.reduce((acc, user) => {
      acc[user.plan || 'free'] = (acc[user.plan || 'free'] || 0) + 1;
      return acc;
    }, {});

    // Get roast statistics (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: roastCount, error: roastError } = await supabaseServiceClient
      .from('roasts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (roastError) {
      logger.warn('Failed to fetch roast count', { error: roastError.message });
    }

    // Get system metrics from metricsService if available
    let systemMetrics = {};
    try {
      systemMetrics = await metricsService.getSystemMetrics();
    } catch (error) {
      logger.warn('Failed to fetch system metrics', { error: error.message });
    }

    const dashboardData = {
      users: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
        byPlan: usersByPlan
      },
      roasts: {
        last30Days: roastCount || 0
      },
      system: systemMetrics,
      timestamp: new Date().toISOString()
    };

    logger.info('Dashboard metrics retrieved', {
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
      totalUsers,
      activeUsers
    });

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    logger.error('Failed to retrieve dashboard metrics', {
      error: error.message,
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard metrics'
    });
  }
});

module.exports = router;
