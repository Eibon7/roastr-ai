/**
 * Model Availability Admin Routes
 * Provides endpoints for monitoring and managing GPT-5 availability detection
 * Issue #326: Admin interface for model availability system
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { getModelAvailabilityService } = require('../services/modelAvailabilityService');
const { getModelAvailabilityWorker } = require('../workers/ModelAvailabilityWorker');

// Admin middleware (implement as needed for your auth system)
const requireAdmin = (req, res, next) => {
    // For now, just check if user exists - implement proper admin check
    if (!req.user) {
        return res.status(403).json({
            success: false,
            error: 'Admin access required'
        });
    }
    // TODO: Add proper admin role check
    next();
};

/**
 * GET /api/model-availability/status
 * Get current model availability status
 */
router.get('/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const modelService = getModelAvailabilityService();
        const worker = getModelAvailabilityWorker();
        
        const [modelStatus, workerStatus, stats] = await Promise.all([
            modelService.getAvailabilityStatus(),
            Promise.resolve(worker.getStatus()),
            modelService.getModelStats()
        ]);

        res.json({
            success: true,
            data: {
                models: modelStatus,
                worker: workerStatus,
                statistics: stats,
                summary: {
                    gpt5Available: modelStatus.gpt5Available,
                    totalModels: Object.keys(modelStatus.models || {}).length,
                    lastCheck: modelStatus.lastCheck,
                    nextCheck: modelStatus.nextCheck,
                    workerRunning: workerStatus.isRunning
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to get model availability status', {
            error: error.message,
            stack: error.stack
        });

        res.status(500).json({
            success: false,
            error: 'Failed to get model availability status',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/model-availability/check
 * Force a manual model availability check
 */
router.post('/check', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const worker = getModelAvailabilityWorker();
        
        logger.info('Manual model availability check triggered', {
            userId: req.user.id,
            timestamp: new Date().toISOString()
        });

        const result = await worker.runManualCheck();

        res.json({
            success: true,
            data: {
                checkCompleted: true,
                result: result,
                gpt5Available: result.gpt5Available,
                modelsChecked: Object.keys(result.models || {}).length
            },
            message: result.gpt5Available 
                ? '🎉 GPT-5 is available! All paid plans now use GPT-5.'
                : 'Model availability updated. GPT-5 not yet available.',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Manual model availability check failed', {
            userId: req.user?.id,
            error: error.message,
            stack: error.stack
        });

        res.status(500).json({
            success: false,
            error: 'Failed to check model availability',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/model-availability/model/:modelId
 * Get specific model availability info
 */
router.get('/model/:modelId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { modelId } = req.params;
        const modelService = getModelAvailabilityService();
        
        const isAvailable = await modelService.isModelAvailable(modelId);
        const stats = await modelService.getModelStats();

        res.json({
            success: true,
            data: {
                modelId: modelId,
                isAvailable: isAvailable,
                usage: stats.usage_last_7_days?.[modelId] || 0,
                totalUsage: stats.total_requests || 0
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to get model info', {
            modelId: req.params.modelId,
            error: error.message
        });

        res.status(500).json({
            success: false,
            error: 'Failed to get model information',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/model-availability/stats
 * Get detailed model usage statistics
 */
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const modelService = getModelAvailabilityService();
        const stats = await modelService.getModelStats();

        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to get model stats', {
            error: error.message
        });

        res.status(500).json({
            success: false,
            error: 'Failed to get model statistics',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/model-availability/plans
 * Get model assignments by plan
 */
router.get('/plans', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const modelService = getModelAvailabilityService();
        const plans = ['free', 'starter', 'pro', 'plus', 'custom'];
        
        const planModels = {};
        
        for (const plan of plans) {
            planModels[plan] = await modelService.getModelForPlan(plan);
        }

        res.json({
            success: true,
            data: {
                planModels: planModels,
                explanation: {
                    'free': 'Always uses GPT-3.5-turbo',
                    'starter': 'GPT-5 → GPT-4o → GPT-3.5-turbo (fallback)',
                    'pro': 'GPT-5 → GPT-4o → GPT-3.5-turbo (fallback)',
                    'plus': 'GPT-5 → GPT-4o → GPT-3.5-turbo (fallback)',
                    'custom': 'GPT-5 → GPT-4o → GPT-3.5-turbo (fallback)'
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to get plan model assignments', {
            error: error.message
        });

        res.status(500).json({
            success: false,
            error: 'Failed to get plan model assignments',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/model-availability/worker/start
 * Start the model availability worker
 */
router.post('/worker/start', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const worker = getModelAvailabilityWorker();
        
        if (worker.getStatus().isRunning) {
            return res.json({
                success: true,
                message: 'Worker is already running',
                data: worker.getStatus(),
                timestamp: new Date().toISOString()
            });
        }

        worker.start();

        res.json({
            success: true,
            message: 'Model availability worker started',
            data: worker.getStatus(),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to start model availability worker', {
            error: error.message
        });

        res.status(500).json({
            success: false,
            error: 'Failed to start worker',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/model-availability/worker/stop
 * Stop the model availability worker
 */
router.post('/worker/stop', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const worker = getModelAvailabilityWorker();
        worker.stop();

        res.json({
            success: true,
            message: 'Model availability worker stopped',
            data: worker.getStatus(),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to stop model availability worker', {
            error: error.message
        });

        res.status(500).json({
            success: false,
            error: 'Failed to stop worker',
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;