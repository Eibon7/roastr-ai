const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

// Store reference to WorkerManager instance
let workerManager = null;

/**
 * Set the WorkerManager instance
 * This should be called when workers are started
 */
function setWorkerManager(manager) {
  workerManager = manager;
}

/**
 * GET /api/workers/status
 * Get comprehensive worker status and health information
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    if (!workerManager) {
      return res.status(503).json({
        success: false,
        error: 'Workers not initialized',
        message: 'Worker system is not running. Please start workers using npm run workers:start'
      });
    }
    
    // Get health status from worker manager
    const healthStatus = await workerManager.getHealthStatus();
    const stats = workerManager.getStats();
    const summary = workerManager.getSummary();
    
    res.json({
      success: true,
      data: {
        summary,
        health: healthStatus,
        stats,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Error fetching worker status', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch worker status',
      message: error.message
    });
  }
});

/**
 * GET /api/workers/health
 * Simple health check endpoint for monitoring
 */
router.get('/health', async (req, res) => {
  try {
    if (!workerManager) {
      return res.status(503).json({
        status: 'unavailable',
        workers: 'not initialized'
      });
    }
    
    const summary = workerManager.getSummary();
    const health = await workerManager.getHealthStatus();
    
    // Determine HTTP status based on health
    let httpStatus = 200;
    if (health.overallStatus === 'unhealthy') {
      httpStatus = 503;
    } else if (health.overallStatus === 'warning') {
      httpStatus = 200; // Still return 200 for warnings
    }
    
    res.status(httpStatus).json({
      status: health.overallStatus,
      workers: {
        running: summary.workersCount,
        healthy: health.healthyWorkers,
        total: Object.keys(health.workers).length
      },
      uptime: summary.uptime,
      jobs: {
        processed: summary.totalJobsProcessed,
        failed: summary.totalJobsFailed,
        current: summary.currentJobsProcessing
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error in worker health check', { error: error.message });
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

/**
 * GET /api/workers/:workerType/health
 * Get health status for a specific worker
 */
router.get('/:workerType/health', authenticateToken, async (req, res) => {
  try {
    const { workerType } = req.params;
    
    if (!workerManager) {
      return res.status(503).json({
        success: false,
        error: 'Workers not initialized'
      });
    }
    
    const health = await workerManager.getHealthStatus();
    const workerHealth = health.workers[workerType];
    
    if (!workerHealth) {
      return res.status(404).json({
        success: false,
        error: 'Worker not found',
        message: `Worker type '${workerType}' does not exist or is not running`
      });
    }
    
    res.json({
      success: true,
      data: workerHealth
    });
    
  } catch (error) {
    logger.error('Error fetching worker health', { 
      workerType: req.params.workerType, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch worker health',
      message: error.message
    });
  }
});

/**
 * POST /api/workers/:workerType/restart
 * Restart a specific worker
 */
router.post('/:workerType/restart', authenticateToken, async (req, res) => {
  try {
    const { workerType } = req.params;
    
    if (!workerManager) {
      return res.status(503).json({
        success: false,
        error: 'Workers not initialized'
      });
    }
    
    // Check if user has admin privileges
    if (!req.user.isAdmin && !flags.isEnabled('ALLOW_WORKER_RESTART')) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: 'Admin privileges required to restart workers'
      });
    }
    
    await workerManager.restartWorker(workerType);
    
    res.json({
      success: true,
      message: `Worker '${workerType}' restarted successfully`
    });
    
  } catch (error) {
    logger.error('Error restarting worker', { 
      workerType: req.params.workerType, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to restart worker',
      message: error.message
    });
  }
});

module.exports = { router, setWorkerManager };