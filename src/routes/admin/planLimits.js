/**
 * Admin Plan Limits API Routes
 * Epic #1037: Admin Panel - Plan Limits Management
 *
 * Provides secure endpoints for managing plan limits
 * - GET /api/admin/plan-limits - Get all plan limits
 * - GET /api/admin/plan-limits/:id - Get limits for specific plan
 * - PUT /api/admin/plan-limits/:id - Update limits for specific plan
 */

const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../middleware/auth');
const { logger } = require('../../utils/logger');
const SafeUtils = require('../../utils/safeUtils');
const planLimitsService = require('../../services/planLimitsService');

// Apply admin middleware to all routes
router.use(requireAdmin);

/**
 * GET /api/admin/plan-limits
 * Get all plan limits
 */
router.get('/', async (req, res) => {
  try {
    // Get all plan limits
    const allLimits = await planLimitsService.getAllLimits();

    logger.info('All plan limits retrieved', {
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
      planCount: Object.keys(allLimits).length
    });

    res.json({
      success: true,
      data: {
        plans: allLimits,
        last_updated: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to retrieve plan limits', {
      error: error.message,
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve plan limits'
    });
  }
});

/**
 * GET /api/admin/plan-limits/:id
 * Get limits for specific plan
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get limits for specific plan
    const limits = await planLimitsService.getPlanLimits(id);

    if (!limits) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found'
      });
    }

    logger.info('Plan limits retrieved', {
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
      planId: id
    });

    res.json({
      success: true,
      data: {
        planId: id,
        limits,
        last_updated: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to retrieve plan limits', {
      error: error.message,
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve plan limits'
    });
  }
});

/**
 * PUT /api/admin/plan-limits/:id
 * Update plan limits for a specific plan
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Update limits using service
    const updatedLimits = await planLimitsService.updateLimits(id, updates, req.user.id);

    logger.info('Plan limits updated', {
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
      planId: id,
      updatedFields: Object.keys(updates)
    });

    res.json({
      success: true,
      data: {
        planId: id,
        limits: updatedLimits,
        updated_at: new Date().toISOString(),
        updated_by: req.user.id
      }
    });
  } catch (error) {
    logger.error('Failed to update plan limits', {
      error: error.message,
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
      planId: req.params.id
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update plan limits'
    });
  }
});

module.exports = router;
