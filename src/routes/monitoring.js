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
const { getMetrics: getRateLimitMetrics } = require('../middleware/authRateLimiterV2');
const settingsLoader = require('../services/settingsLoaderV2');

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

/**
 * GET /api/monitoring/health/rate-limiter
 * Health check endpoint for rate limiting system (ROA-526)
 * 
 * Checks:
 * - Configuration validity (SSOT)
 * - Redis/Upstash connectivity
 * - Active blocks
 * - Metrics availability
 * 
 * Returns:
 * - status: 'healthy' | 'degraded' | 'unhealthy'
 * - checks: Individual check results
 * - metrics: Current rate limiter metrics
 */
router.get('/health/rate-limiter', async (req, res) => {
  try {
    const healthChecks = {
      ssot_config: { status: 'unknown', message: null },
      redis_connectivity: { status: 'unknown', message: null },
      metrics_availability: { status: 'unknown', message: null },
      active_blocks: { status: 'unknown', count: 0 }
    };

    let overallStatus = 'healthy';

    // Check 1: SSOT Configuration
    try {
      const authRateLimitConfig = await settingsLoader.getValue('rate_limit.auth');
      if (authRateLimitConfig && typeof authRateLimitConfig === 'object') {
        healthChecks.ssot_config.status = 'healthy';
        healthChecks.ssot_config.message = 'Configuration loaded from SSOT successfully';
      } else {
        healthChecks.ssot_config.status = 'degraded';
        healthChecks.ssot_config.message = 'Configuration missing or invalid, using fallback';
        overallStatus = 'degraded';
      }
    } catch (error) {
      healthChecks.ssot_config.status = 'unhealthy';
      healthChecks.ssot_config.message = `Failed to load configuration: ${error.message}`;
      overallStatus = 'unhealthy';
    }

    // Check 2: Redis Connectivity (via rate limiter store)
    try {
      const { RateLimitStoreV2 } = require('../middleware/authRateLimiterV2');
      const store = new RateLimitStoreV2();
      
      if (store.isReady()) {
        healthChecks.redis_connectivity.status = 'healthy';
        healthChecks.redis_connectivity.message = store.isRedisAvailable 
          ? 'Redis/Upstash connected' 
          : 'Using memory fallback (expected in dev/test)';
        
        // Memory fallback is expected in dev/test, but degraded in production
        if (!store.isRedisAvailable && process.env.NODE_ENV === 'production') {
          healthChecks.redis_connectivity.status = 'degraded';
          overallStatus = 'degraded';
        }
      } else {
        healthChecks.redis_connectivity.status = 'unhealthy';
        healthChecks.redis_connectivity.message = 'Storage not ready';
        overallStatus = 'unhealthy';
      }
    } catch (error) {
      healthChecks.redis_connectivity.status = 'unhealthy';
      healthChecks.redis_connectivity.message = `Failed to check storage: ${error.message}`;
      overallStatus = 'unhealthy';
    }

    // Check 3: Metrics Availability
    try {
      const rateLimitMetrics = getRateLimitMetrics();
      if (rateLimitMetrics && typeof rateLimitMetrics === 'object') {
        healthChecks.metrics_availability.status = 'healthy';
        healthChecks.metrics_availability.message = 'Metrics available';
        
        // Check active blocks
        healthChecks.active_blocks.count = rateLimitMetrics.auth_blocks_active || 0;
        healthChecks.active_blocks.status = 'healthy';
      } else {
        healthChecks.metrics_availability.status = 'degraded';
        healthChecks.metrics_availability.message = 'Metrics unavailable';
        overallStatus = 'degraded';
      }
    } catch (error) {
      healthChecks.metrics_availability.status = 'unhealthy';
      healthChecks.metrics_availability.message = `Failed to get metrics: ${error.message}`;
      overallStatus = 'unhealthy';
    }

    // Determine HTTP status code based on overall status
    const statusCode = overallStatus === 'healthy' ? 200 
                     : overallStatus === 'degraded' ? 200 
                     : 503;

    logger.info('Rate limiter health check performed', {
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
      status: overallStatus,
      timestamp: new Date().toISOString()
    });

    res.status(statusCode).json({
      success: overallStatus !== 'unhealthy',
      data: {
        status: overallStatus,
        checks: healthChecks,
        metrics: overallStatus !== 'unhealthy' ? getRateLimitMetrics() : null,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to perform rate limiter health check', {
      error: error.message,
      stack: error.stack,
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
    });

    res.status(503).json({
      success: false,
      error: 'Health check failed',
      data: {
        status: 'unhealthy',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/monitoring/metrics/prometheus
 * Export metrics in Prometheus format (ROA-526)
 * 
 * Exports:
 * - Rate limiter metrics (hits, blocks, abuse events)
 * - System metrics (uptime, memory, CPU)
 * 
 * Format: Prometheus text-based exposition format
 * https://prometheus.io/docs/instrumenting/exposition_formats/
 */
router.get('/metrics/prometheus', async (req, res) => {
  try {
    const rateLimitMetrics = getRateLimitMetrics();
    const systemMetrics = await metricsService.getSystemMetrics();

    // Build Prometheus format output
    const lines = [];

    // Rate limiter metrics
    lines.push('# HELP auth_rate_limit_hits_total Total number of rate limit hits');
    lines.push('# TYPE auth_rate_limit_hits_total counter');
    lines.push(`auth_rate_limit_hits_total ${rateLimitMetrics.auth_rate_limit_hits_total || 0}`);
    lines.push('');

    lines.push('# HELP auth_blocks_active Number of currently active blocks');
    lines.push('# TYPE auth_blocks_active gauge');
    lines.push(`auth_blocks_active ${rateLimitMetrics.auth_blocks_active || 0}`);
    lines.push('');

    lines.push('# HELP auth_abuse_events_total Total number of abuse detection events');
    lines.push('# TYPE auth_abuse_events_total counter');
    lines.push(`auth_abuse_events_total ${rateLimitMetrics.auth_abuse_events_total || 0}`);
    lines.push('');

    // System metrics
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

    lines.push('# HELP nodejs_uptime_seconds Node.js process uptime in seconds');
    lines.push('# TYPE nodejs_uptime_seconds gauge');
    lines.push(`nodejs_uptime_seconds ${uptime}`);
    lines.push('');

    lines.push('# HELP nodejs_memory_heap_used_bytes Node.js heap memory used in bytes');
    lines.push('# TYPE nodejs_memory_heap_used_bytes gauge');
    lines.push(`nodejs_memory_heap_used_bytes ${memoryUsage.heapUsed}`);
    lines.push('');

    lines.push('# HELP nodejs_memory_heap_total_bytes Node.js total heap memory in bytes');
    lines.push('# TYPE nodejs_memory_heap_total_bytes gauge');
    lines.push(`nodejs_memory_heap_total_bytes ${memoryUsage.heapTotal}`);
    lines.push('');

    lines.push('# HELP nodejs_memory_rss_bytes Node.js RSS memory in bytes');
    lines.push('# TYPE nodejs_memory_rss_bytes gauge');
    lines.push(`nodejs_memory_rss_bytes ${memoryUsage.rss}`);
    lines.push('');

    logger.info('Prometheus metrics exported', {
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
      timestamp: new Date().toISOString()
    });

    // Set content type for Prometheus
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(lines.join('\n'));

  } catch (error) {
    logger.error('Failed to export Prometheus metrics', {
      error: error.message,
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
    });

    res.status(500).json({
      success: false,
      error: 'Failed to export metrics'
    });
  }
});

module.exports = router;
