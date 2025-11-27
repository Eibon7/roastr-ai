/**
 * Monitoring API Routes
 * Epic #1037: System Monitoring and Metrics
 *
 * Provides endpoints for system monitoring and performance metrics
 * - GET /api/monitoring/metrics - Get system metrics
 */

const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const SafeUtils = require('../utils/safeUtils');
const metricsService = require('../services/metricsService');

// Apply admin middleware to all routes
router.use(requireAdmin);

/**
 * GET /api/monitoring/metrics
 * Get system monitoring and performance metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    // Get system metrics from metricsService
    const metrics = await metricsService.getSystemMetrics();

    // Add performance data
    const performanceData = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    };

    logger.info('Monitoring metrics retrieved', {
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        monitoring: metrics,
        performance: performanceData,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to retrieve monitoring metrics', {
      error: error.message,
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve monitoring metrics'
    });
  }
});

module.exports = router;
