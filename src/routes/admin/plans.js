/**
 * Admin Plans API Routes
 * Epic #1037: Admin Panel - Subscription Plan Management
 *
 * Provides secure endpoints for managing subscription plans
 * - GET /api/admin/plans - List all plans with user counts
 * - PUT /api/admin/plans/:id - Update plan configuration
 */

const express = require('express');
const router = express.Router();
const { supabaseServiceClient } = require('../../config/supabase');
const { requireAdmin } = require('../../middleware/auth');
const { logger } = require('../../utils/logger');
const SafeUtils = require('../../utils/safeUtils');
const planLimitsService = require('../../services/planLimitsService');
const { VALID_PLANS, PLAN_IDS } = require('../../config/planMappings');

// Apply admin middleware to all routes
router.use(requireAdmin);

/**
 * GET /api/admin/plans
 * Get all subscription plans with user counts
 */
router.get('/', async (req, res) => {
  try {
    // Get user counts per plan
    const { data: userCounts, error: countError } = await supabaseServiceClient
      .from('users')
      .select('plan')
      .eq('active', true);

    if (countError) {
      throw countError;
    }

    // Count users per plan
    const planStats = VALID_PLANS.map((plan) => {
      const count = userCounts.filter((u) => u.plan === plan).length;
      return {
        id: PLAN_IDS[plan] || plan,
        name: plan,
        userCount: count
      };
    });

    const totalUsers = userCounts.length;

    logger.info('Plans retrieved', {
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
      totalPlans: VALID_PLANS.length,
      totalUsers
    });

    res.json({
      success: true,
      data: {
        plans: planStats,
        totalUsers
      }
    });
  } catch (error) {
    logger.error('Failed to retrieve plans', {
      error: error.message,
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve plans'
    });
  }
});

/**
 * PUT /api/admin/plans/:id
 * Update plan configuration (limits)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validate plan exists
    if (!VALID_PLANS.includes(id) && !Object.values(PLAN_IDS).includes(id)) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found'
      });
    }

    // Update plan limits using the service
    const result = await planLimitsService.updateLimits(id, updates, req.user.id);

    logger.info('Plan configuration updated', {
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
      planId: id,
      updatedFields: Object.keys(updates)
    });

    res.json({
      success: true,
      message: 'Plan configuration updated successfully',
      data: {
        planId: id,
        updatedLimits: result
      }
    });
  } catch (error) {
    logger.error('Failed to update plan configuration', {
      error: error.message,
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
      planId: req.params.id
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update plan configuration'
    });
  }
});

module.exports = router;
