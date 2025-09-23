/**
 * Monitoring Routes - Issue #396
 * Production monitoring endpoints for SPEC 10 Tier Limits System
 */

const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const tierValidationMonitoringService = require('../services/tierValidationMonitoringService');
const planLimitsService = require('../services/planLimitsService');
const { logger } = require('../utils/logger');

const router = express.Router();

// All monitoring routes require authentication
router.use(authenticateToken);

/**
 * Helper function to compute plan limits health status
 */
async function getPlanLimitsHealth() {
    try {
        // Test basic plan limits functionality
        const testPlanLimits = await planLimitsService.getPlanLimits('free');
        
        const health = {
            status: 'healthy',
            cacheSize: planLimitsService.cache?.size || 0,
            lastRefresh: planLimitsService.lastCacheRefresh,
            testResult: !!testPlanLimits
        };
        
        // Check if basic functionality works
        if (!testPlanLimits || !testPlanLimits.maxRoasts) {
            health.status = 'degraded';
            health.issue = 'Plan limits data missing or invalid';
        }
        
        // Check cache freshness (if cache exists but is stale)
        if (health.lastRefresh && Date.now() - health.lastRefresh > 10 * 60 * 1000) { // 10 minutes
            health.status = health.status === 'healthy' ? 'degraded' : health.status;
            health.cacheWarning = 'Cache may be stale';
        }
        
        return health;
    } catch (error) {
        logger.error('Error checking plan limits health:', error);
        return {
            status: 'unhealthy',
            error: error.message,
            cacheSize: 0,
            lastRefresh: null,
            testResult: false
        };
    }
}

/**
 * GET /api/monitoring/health
 * Get tier validation system health status
 */
router.get('/health', async (req, res) => {
    try {
        const tierHealth = tierValidationMonitoringService.getHealthStatus();
        const planLimitsHealth = await getPlanLimitsHealth();
        
        const overallHealth = {
            ...tierHealth,
            components: {
                tierValidation: tierHealth.status,
                planLimits: planLimitsHealth.status
            },
            planLimitsDetails: planLimitsHealth
        };
        
        // Set appropriate HTTP status based on health
        const httpStatus = tierHealth.status === 'unhealthy' ? 503 : 
                          tierHealth.status === 'degraded' ? 200 : 200;
        
        res.status(httpStatus).json({
            success: tierHealth.status !== 'unhealthy',
            data: overallHealth
        });
        
    } catch (error) {
        logger.error('Error getting monitoring health:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to get health status',
                details: error.message
            }
        });
    }
});

/**
 * GET /api/monitoring/metrics
 * Get detailed tier validation metrics
 */
router.get('/metrics', async (req, res) => {
    try {
        const monitoringMetrics = tierValidationMonitoringService.getHealthMetrics();
        const performanceAnalytics = tierValidationMonitoringService.getPerformanceAnalytics();
        
        res.json({
            success: true,
            data: {
                monitoring: monitoringMetrics,
                performance: performanceAnalytics,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        logger.error('Error getting monitoring metrics:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to get metrics',
                details: error.message
            }
        });
    }
});

/**
 * GET /api/monitoring/cache
 * Get cache performance metrics
 */
router.get('/cache', async (req, res) => {
    try {
        const cacheMetrics = {
            monitoring: {
                size: tierValidationMonitoringService.cache.size,
                hitRate: tierValidationMonitoringService.getCacheHitRate(),
                hits: tierValidationMonitoringService.metrics.cacheHits,
                misses: tierValidationMonitoringService.metrics.cacheMisses,
                ttl: tierValidationMonitoringService.cacheTTL
            },
            planLimits: {
                size: planLimitsService.cache?.size || 0,
                timeout: planLimitsService.cacheTimeout,
                lastRefresh: planLimitsService.lastCacheRefresh
            }
        };
        
        res.json({
            success: true,
            data: cacheMetrics
        });
        
    } catch (error) {
        logger.error('Error getting cache metrics:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to get cache metrics',
                details: error.message
            }
        });
    }
});

/**
 * POST /api/monitoring/cache/clear
 * Clear all caches (admin operation)
 */
router.post('/cache/clear', requireAdmin, async (req, res) => {
    try {
        // Clear all caches
        tierValidationMonitoringService.clearCache();
        planLimitsService.clearCache();
        
        logger.info('All caches cleared by admin', {
            userId: req.user.id,
            timestamp: new Date().toISOString()
        });
        
        res.json({
            success: true,
            data: {
                message: 'All caches cleared successfully',
                clearedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        logger.error('Error clearing caches:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to clear caches',
                details: error.message
            }
        });
    }
});

/**
 * GET /api/monitoring/alerts/config
 * Get current alert configuration
 */
router.get('/alerts/config', async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                thresholds: tierValidationMonitoringService.alertThresholds,
                cooldown: tierValidationMonitoringService.alertCooldown,
                externalAlerts: {
                    webhookConfigured: !!tierValidationMonitoringService.externalAlerts.webhookUrl,
                    slackConfigured: !!tierValidationMonitoringService.externalAlerts.slackWebhook
                }
            }
        });
        
    } catch (error) {
        logger.error('Error getting alert config:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to get alert configuration',
                details: error.message
            }
        });
    }
});

/**
 * PUT /api/monitoring/alerts/config
 * Update alert thresholds (admin only)
 */
router.put('/alerts/config', requireAdmin, async (req, res) => {
    try {
        const { thresholds } = req.body;
        
        if (!thresholds || typeof thresholds !== 'object') {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Invalid thresholds configuration',
                    details: 'thresholds must be an object'
                }
            });
        }
        
        // Validate threshold values
        const validKeys = ['errorRatePercentage', 'criticalErrorRatePercentage', 'maxErrorsPerHour', 'maxValidationsPerMinute'];
        for (const [key, value] of Object.entries(thresholds)) {
            if (!validKeys.includes(key)) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: `Invalid threshold key: ${key}`,
                        details: `Valid keys: ${validKeys.join(', ')}`
                    }
                });
            }
            
            if (typeof value !== 'number' || value < 0) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: `Invalid threshold value for ${key}`,
                        details: 'Threshold values must be positive numbers'
                    }
                });
            }
        }
        
        tierValidationMonitoringService.updateAlertThresholds(thresholds);
        
        logger.info('Alert thresholds updated', {
            userId: req.user.id,
            newThresholds: thresholds,
            timestamp: new Date().toISOString()
        });
        
        res.json({
            success: true,
            data: {
                message: 'Alert thresholds updated successfully',
                newThresholds: tierValidationMonitoringService.alertThresholds,
                updatedBy: req.user.id,
                updatedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        logger.error('Error updating alert config:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to update alert configuration',
                details: error.message
            }
        });
    }
});

/**
 * POST /api/monitoring/alerts/test
 * Send a test alert (admin only)
 */
router.post('/alerts/test', requireAdmin, async (req, res) => {
    try {
        const { severity = 'info', title = 'Test Alert', message = 'This is a test alert from monitoring system' } = req.body;
        
        // Validate severity
        const validSeverities = ['info', 'warning', 'critical'];
        if (!validSeverities.includes(severity)) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Invalid severity level',
                    details: `Valid severities: ${validSeverities.join(', ')}`
                }
            });
        }
        
        await tierValidationMonitoringService.sendAlert(severity, title, message);
        
        logger.info('Test alert sent', {
            userId: req.user.id,
            severity,
            title,
            timestamp: new Date().toISOString()
        });
        
        res.json({
            success: true,
            data: {
                message: 'Test alert sent successfully',
                alertDetails: { severity, title, message },
                sentBy: req.user.id,
                sentAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        logger.error('Error sending test alert:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to send test alert',
                details: error.message
            }
        });
    }
});

/**
 * GET /api/monitoring/performance
 * Get detailed performance analytics
 */
router.get('/performance', async (req, res) => {
    try {
        const analytics = tierValidationMonitoringService.getPerformanceAnalytics();
        const healthMetrics = tierValidationMonitoringService.getHealthMetrics();
        
        res.json({
            success: true,
            data: {
                analytics,
                summary: {
                    totalValidations: healthMetrics.validationCount,
                    totalErrors: healthMetrics.errorCount,
                    errorRate: healthMetrics.errorRate,
                    cacheHitRate: healthMetrics.cacheHitRate,
                    averagePerformance: healthMetrics.averagePerformance
                },
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        logger.error('Error getting performance analytics:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to get performance analytics',
                details: error.message
            }
        });
    }
});

module.exports = router;