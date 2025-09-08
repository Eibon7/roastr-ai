const QueueService = require('./queueService');
const WorkerManager = require('../workers/WorkerManager');
const alertingService = require('./alertingService');
const metricsService = require('./metricsService');
const logger = require('../utils/logger');
const { flags } = require('../config/flags');
const { createClient } = require('@supabase/supabase-js');

/**
 * Comprehensive Monitoring Service for Roastr.ai
 * 
 * Provides unified monitoring, health checks, and metrics collection:
 * - System health monitoring
 * - Queue and worker statistics
 * - Cost tracking and alerting
 * - Performance metrics
 * - Database connectivity checks
 * - Redis/cache health checks
 * - Automated alerting integration
 */
class MonitoringService {
  constructor() {
    this.queueService = new QueueService();
    this.workerManager = null; // Initialized lazily
    this.supabase = null;
    
    // Performance tracking
    this.responseTimeTracker = {
      samples: [],
      maxSamples: 100
    };
    
    // System metrics
    this.systemMetrics = {
      startTime: Date.now(),
      requestCount: 0,
      errorCount: 0,
      lastHealthCheck: null
    };
    
    this.initializeConnections();
    
    this.log('info', 'Monitoring Service initialized');
  }
  
  /**
   * Initialize database connections
   */
  async initializeConnections() {
    try {
      // Initialize Supabase connection
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
      }
      
    } catch (error) {
      this.log('warn', 'Failed to initialize some monitoring connections', {
        error: error.message
      });
    }
  }
  
  /**
   * Get comprehensive system health status
   */
  async getHealthStatus() {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    try {
      const healthStatus = {
        status: 'healthy',
        timestamp,
        checks: {},
        system: await this.getSystemHealth(),
        services: await this.getServicesHealth(),
        workers: await this.getWorkersHealth(),
        queues: await this.getQueuesHealth(),
        costs: await this.getCostHealth(),
        performance: await this.getPerformanceHealth()
      };
      
      // Determine overall status
      const failedChecks = this.getFailedChecks(healthStatus);
      if (failedChecks.length > 0) {
        if (failedChecks.some(check => check.critical)) {
          healthStatus.status = 'unhealthy';
        } else {
          healthStatus.status = 'degraded';
        }
        healthStatus.failedChecks = failedChecks;
      }
      
      const duration = Date.now() - startTime;
      healthStatus.checkDuration = `${duration}ms`;
      this.systemMetrics.lastHealthCheck = timestamp;
      
      // Trigger alerting if needed
      try {
        await alertingService.checkHealthAndAlert(healthStatus);
      } catch (alertError) {
        this.log('warn', 'Failed to process health alerts', {
          error: alertError.message
        });
      }
      
      return healthStatus;
      
    } catch (error) {
      this.log('error', 'Failed to get health status', { error: error.message });
      
      return {
        status: 'error',
        timestamp,
        error: error.message,
        checkDuration: `${Date.now() - startTime}ms`
      };
    }
  }
  
  /**
   * Get system health (memory, uptime, etc.)
   */
  async getSystemHealth() {
    try {
      const uptime = process.uptime();
      const memUsage = process.memoryUsage();
      const totalMem = require('os').totalmem();
      const freeMem = require('os').freemem();
      const usedMem = totalMem - freeMem;
      const memoryUsagePercent = Math.round((usedMem / totalMem) * 100);
      
      return {
        status: memoryUsagePercent > 90 ? 'critical' : (memoryUsagePercent > 80 ? 'warning' : 'healthy'),
        uptime: `${Math.floor(uptime)}s`,
        uptimeMs: uptime * 1000,
        memory: {
          usage: memoryUsagePercent,
          total: Math.round(totalMem / 1024 / 1024),
          used: Math.round(usedMem / 1024 / 1024),
          free: Math.round(freeMem / 1024 / 1024),
          process: {
            rss: Math.round(memUsage.rss / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024)
          }
        },
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid
      };
      
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
  
  /**
   * Get services health (database, Redis, external APIs)
   */
  async getServicesHealth() {
    const services = {};
    
    // Database health
    services.database = await this.checkDatabaseHealth();
    
    // Redis health
    services.redis = await this.checkRedisHealth();
    
    // Queue service health
    services.queue = await this.checkQueueServiceHealth();
    
    // External service flags
    services.flags = flags.getServiceStatus();
    
    return services;
  }
  
  /**
   * Check database connectivity and health
   */
  async checkDatabaseHealth() {
    try {
      if (!this.supabase) {
        return {
          status: 'disabled',
          message: 'Database not configured'
        };
      }
      
      const startTime = Date.now();
      
      // Simple connectivity test
      const { data, error } = await this.supabase
        .from('users')
        .select('id')
        .limit(1);
      
      const responseTime = Date.now() - startTime;
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows, which is OK
        return {
          status: 'error',
          error: error.message,
          responseTime: `${responseTime}ms`
        };
      }
      
      return {
        status: responseTime > 1000 ? 'slow' : 'healthy',
        responseTime: `${responseTime}ms`,
        connection: 'active'
      };
      
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
  
  /**
   * Check Redis/cache health
   */
  async checkRedisHealth() {
    try {
      if (!this.queueService.redis) {
        return {
          status: 'disabled',
          message: 'Redis not configured'
        };
      }
      
      const startTime = Date.now();
      
      if (!this.queueService.isRedisAvailable) {
        return {
          status: 'disconnected',
          message: 'Redis connection unavailable'
        };
      }
      
      await this.queueService.redis.ping();
      const responseTime = Date.now() - startTime;
      
      return {
        status: responseTime > 500 ? 'slow' : 'healthy',
        responseTime: `${responseTime}ms`,
        connection: 'active'
      };
      
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
  
  /**
   * Check queue service health
   */
  async checkQueueServiceHealth() {
    try {
      const queueStats = await this.queueService.getQueueStats();
      const hasActiveBackend = queueStats.redis || queueStats.database;
      
      return {
        status: hasActiveBackend ? 'healthy' : 'error',
        activeBackends: {
          redis: queueStats.redis,
          database: queueStats.database
        },
        stats: queueStats
      };
      
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
  
  /**
   * Get workers health status
   */
  async getWorkersHealth() {
    try {
      if (!this.workerManager) {
        // Try to get existing worker manager instance
        // In a real scenario, this would be injected or retrieved from a registry
        return {
          status: 'disabled',
          message: 'Worker manager not running'
        };
      }
      
      const workerHealth = await this.workerManager.getHealthStatus();
      
      return {
        status: workerHealth.overallStatus || 'unknown',
        totalWorkers: workerHealth.totalWorkers,
        healthyWorkers: workerHealth.healthyWorkers,
        workers: workerHealth.workers,
        uptime: workerHealth.managerUptime
      };
      
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
  
  /**
   * Get queues health and statistics
   */
  async getQueuesHealth() {
    try {
      const queueStats = await this.queueService.getQueueStats();
      
      let status = 'healthy';
      let totalDepth = 0;
      
      // Calculate total queue depth and check thresholds
      if (queueStats.redisStats && queueStats.redisStats.queues) {
        for (const [queueType, queueData] of Object.entries(queueStats.redisStats.queues)) {
          totalDepth += queueData.total || 0;
        }
      }
      
      if (queueStats.databaseStats && queueStats.databaseStats.total) {
        totalDepth += queueStats.databaseStats.total;
      }
      
      // Determine status based on depth
      if (totalDepth > 1000) {
        status = 'critical';
      } else if (totalDepth > 500) {
        status = 'warning';
      }
      
      return {
        status,
        totalDepth,
        backends: {
          redis: queueStats.redis,
          database: queueStats.database
        },
        stats: queueStats
      };
      
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
  
  /**
   * Get cost health and budget status
   */
  async getCostHealth() {
    try {
      // This would integrate with your cost tracking system
      // For now, return a placeholder structure
      
      return {
        status: 'healthy',
        budgetUsagePercentage: 45, // Placeholder
        monthlySpend: 125.50, // Placeholder
        budgetLimit: 300.00, // Placeholder
        message: 'Cost tracking integration needed'
      };
      
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
  
  /**
   * Get performance health metrics
   */
  async getPerformanceHealth() {
    try {
      const samples = this.responseTimeTracker.samples;
      
      if (samples.length === 0) {
        return {
          status: 'unknown',
          message: 'No response time data available'
        };
      }
      
      const average = samples.reduce((sum, time) => sum + time, 0) / samples.length;
      const max = Math.max(...samples);
      const min = Math.min(...samples);
      
      let status = 'healthy';
      if (average > 3000) {
        status = 'critical';
      } else if (average > 1500) {
        status = 'warning';
      }
      
      return {
        status,
        responseTime: {
          average: Math.round(average),
          max,
          min,
          samples: samples.length
        },
        requests: {
          total: this.systemMetrics.requestCount,
          errors: this.systemMetrics.errorCount,
          errorRate: this.systemMetrics.requestCount > 0 ? 
            ((this.systemMetrics.errorCount / this.systemMetrics.requestCount) * 100).toFixed(2) + '%' : '0%'
        }
      };
      
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
  
  /**
   * Get comprehensive system metrics
   */
  async getMetrics() {
    try {
      const healthStatus = await this.getHealthStatus();
      const dashboardMetrics = await metricsService.getDashboardMetrics();
      
      return {
        timestamp: new Date().toISOString(),
        system: {
          uptime: healthStatus.system.uptimeMs,
          memory: healthStatus.system.memory,
          status: healthStatus.status
        },
        workers: {
          total: healthStatus.workers.totalWorkers || 0,
          healthy: healthStatus.workers.healthyWorkers || 0,
          status: healthStatus.workers.status
        },
        queues: {
          totalDepth: healthStatus.queues.totalDepth || 0,
          status: healthStatus.queues.status
        },
        performance: {
          averageResponseTime: healthStatus.performance.responseTime?.average || 0,
          errorRate: healthStatus.performance.requests?.errorRate || '0%',
          totalRequests: healthStatus.performance.requests?.total || 0
        },
        jobs: {
          processed: dashboardMetrics.roasts?.total || 0,
          failed: 0, // Would need to track this
          tokenUsage: dashboardMetrics.roasts?.total_tokens || 0
        },
        users: {
          total: dashboardMetrics.users?.total || 0,
          active: dashboardMetrics.users?.active || 0
        },
        integrations: {
          total: dashboardMetrics.integrations?.stats?.total || 0,
          enabled: dashboardMetrics.integrations?.stats?.enabled || 0,
          active: dashboardMetrics.integrations?.stats?.active || 0
        },
        costs: {
          budgetUsagePercentage: healthStatus.costs.budgetUsagePercentage || 0,
          monthlySpend: healthStatus.costs.monthlySpend || 0
        },
        alerting: alertingService.getStats()
      };
      
    } catch (error) {
      this.log('error', 'Failed to get metrics', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Track response time for performance monitoring
   */
  trackResponseTime(responseTime) {
    this.responseTimeTracker.samples.push(responseTime);
    
    // Keep only the last N samples
    if (this.responseTimeTracker.samples.length > this.responseTimeTracker.maxSamples) {
      this.responseTimeTracker.samples.shift();
    }
  }
  
  /**
   * Track request
   */
  trackRequest(isError = false) {
    this.systemMetrics.requestCount++;
    if (isError) {
      this.systemMetrics.errorCount++;
    }
  }

  /**
   * Track webhook processing for metrics
   */
  trackWebhookProcessing(eventType, metadata = {}) {
    try {
      this.log('info', 'Webhook processing tracked', {
        eventType,
        processingTimeMs: metadata.processingTimeMs,
        success: metadata.success,
        handled: metadata.handled,
        accountId: metadata.accountId || 'unknown',
        timestamp: new Date().toISOString()
      });

      // Could emit to external metrics system here (Prometheus, DataDog, etc.)
      // For now, just log with structured data for metrics aggregation
      
    } catch (error) {
      this.log('warn', 'Failed to track webhook processing', {
        eventType,
        error: error.message
      });
    }
  }
  
  /**
   * Get failed health checks
   */
  getFailedChecks(healthStatus) {
    const failedChecks = [];
    
    // Check system health
    if (healthStatus.system.status !== 'healthy') {
      failedChecks.push({
        component: 'system',
        status: healthStatus.system.status,
        critical: healthStatus.system.status === 'critical'
      });
    }
    
    // Check service health
    for (const [serviceName, serviceHealth] of Object.entries(healthStatus.services)) {
      if (serviceHealth.status && serviceHealth.status !== 'healthy' && serviceHealth.status !== 'disabled') {
        failedChecks.push({
          component: `service.${serviceName}`,
          status: serviceHealth.status,
          critical: serviceHealth.status === 'error'
        });
      }
    }
    
    // Check worker health
    if (healthStatus.workers.status && healthStatus.workers.status !== 'healthy' && healthStatus.workers.status !== 'disabled') {
      failedChecks.push({
        component: 'workers',
        status: healthStatus.workers.status,
        critical: healthStatus.workers.status === 'critical'
      });
    }
    
    // Check queue health
    if (healthStatus.queues.status && healthStatus.queues.status !== 'healthy') {
      failedChecks.push({
        component: 'queues',
        status: healthStatus.queues.status,
        critical: healthStatus.queues.status === 'critical'
      });
    }
    
    return failedChecks;
  }
  
  /**
   * Set worker manager instance
   */
  setWorkerManager(workerManager) {
    this.workerManager = workerManager;
  }
  
  /**
   * Test the monitoring system
   */
  async runSystemTest() {
    try {
      this.log('info', 'Starting monitoring system test');
      
      // Test health check
      const healthStatus = await this.getHealthStatus();
      
      // Test metrics
      const metrics = await this.getMetrics();
      
      // Test alerting
      const alertResult = await alertingService.testAlert();
      
      const testResults = {
        timestamp: new Date().toISOString(),
        healthCheck: {
          status: healthStatus.status,
          passed: healthStatus.status !== 'error'
        },
        metrics: {
          status: 'success',
          passed: true
        },
        alerting: {
          status: alertResult ? 'success' : 'failed',
          passed: alertResult
        }
      };
      
      const overallPassed = testResults.healthCheck.passed && 
                           testResults.metrics.passed && 
                           testResults.alerting.passed;
      
      testResults.overall = {
        status: overallPassed ? 'success' : 'failed',
        passed: overallPassed
      };
      
      this.log('info', 'Monitoring system test completed', testResults);
      
      return testResults;
      
    } catch (error) {
      this.log('error', 'Monitoring system test failed', { error: error.message });
      
      return {
        timestamp: new Date().toISOString(),
        overall: {
          status: 'error',
          passed: false
        },
        error: error.message
      };
    }
  }
  
  /**
   * Logging utility
   */
  log(level, message, metadata = {}) {
    if (logger && typeof logger[level] === 'function') {
      logger[level](message, metadata);
    } else {
      console.log(`[${level.toUpperCase()}] MonitoringService: ${message}`, metadata);
    }
  }
}

module.exports = new MonitoringService();