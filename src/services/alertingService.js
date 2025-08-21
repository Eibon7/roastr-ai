const axios = require('axios');
const { logger } = require('../utils/logger');
const { t } = require('../utils/alertingUtils');

/**
 * Alerting Service for Roastr.ai Monitoring System
 * 
 * Provides comprehensive alerting capabilities:
 * - Slack webhook notifications
 * - Threshold-based alerting
 * - Alert severity levels (critical, warning, info)
 * - Alert rate limiting and deduplication
 * - Health status integration
 */
class AlertingService {
  constructor() {
    this.config = {
      enabled: process.env.MONITORING_ENABLED === 'true',
      webhookUrl: process.env.ALERT_WEBHOOK_URL,
      healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 60000, // 1 minute
      alertCooldown: parseInt(process.env.ALERT_COOLDOWN) || 300000, // 5 minutes
      maxAlertsPerHour: parseInt(process.env.MAX_ALERTS_PER_HOUR) || 20
    };
    
    this.alertHistory = new Map(); // For deduplication and rate limiting
    this.alertCounts = new Map(); // For hourly limits
    
    // Define alert thresholds
    this.thresholds = {
      workerFailures: {
        warning: parseInt(process.env.WORKER_FAILURE_THRESHOLD_WARNING) || 10, // 10%
        critical: parseInt(process.env.WORKER_FAILURE_THRESHOLD_CRITICAL) || 25 // 25%
      },
      queueDepth: {
        warning: parseInt(process.env.QUEUE_DEPTH_THRESHOLD_WARNING) || 500,
        critical: parseInt(process.env.QUEUE_DEPTH_THRESHOLD_CRITICAL) || 1000
      },
      responseTime: {
        warning: parseInt(process.env.RESPONSE_TIME_THRESHOLD_WARNING) || 3000, // 3s
        critical: parseInt(process.env.RESPONSE_TIME_THRESHOLD_CRITICAL) || 5000 // 5s
      },
      costPercentage: {
        warning: parseInt(process.env.COST_THRESHOLD_WARNING) || 80, // 80%
        critical: parseInt(process.env.COST_THRESHOLD_CRITICAL) || 95  // 95%
      },
      memoryUsage: {
        warning: parseInt(process.env.MEMORY_THRESHOLD_WARNING) || 80, // 80%
        critical: parseInt(process.env.MEMORY_THRESHOLD_CRITICAL) || 90 // 90%
      }
    };
    
    // Clean up old alert history every hour
    this.cleanupInterval = setInterval(() => this.cleanupAlertHistory(), 3600000);
    
    this.log('info', 'Alerting Service initialized', {
      enabled: this.config.enabled,
      hasWebhookUrl: !!this.config.webhookUrl,
      thresholds: this.thresholds
    });
  }
  
  /**
   * Send alert notification
   * 
   * @param {string} severity - critical, warning, info
   * @param {string} title - Alert title
   * @param {string} message - Alert message
   * @param {object} data - Additional alert data
   * @param {object} options - Alert options (force, skipRateLimit, etc.)
   */
  async sendAlert(severity, title, message, data = {}, options = {}) {
    if (!this.config.enabled && !options.force) {
      this.log('debug', 'Alerting disabled, skipping alert', { severity, title });
      return false;
    }
    
    if (!this.config.webhookUrl) {
      this.log('warn', 'No webhook URL configured, cannot send alert', { severity, title });
      return false;
    }
    
    // Generate alert key for deduplication
    const alertKey = this.generateAlertKey(severity, title, message);
    
    // Check rate limiting and deduplication
    if (!options.skipRateLimit && !this.shouldSendAlert(alertKey, severity)) {
      this.log('debug', 'Alert skipped due to rate limiting or cooldown', { alertKey, severity });
      return false;
    }
    
    try {
      const alertPayload = this.buildSlackPayload(severity, title, message, data);
      
      await axios.post(this.config.webhookUrl, alertPayload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      // Record alert sent
      this.recordAlert(alertKey, severity);
      
      this.log('info', 'Alert sent successfully', {
        severity,
        title,
        alertKey
      });
      
      return true;
      
    } catch (error) {
      this.log('error', 'Failed to send alert', {
        severity,
        title,
        error: error.message,
        webhookUrl: this.config.webhookUrl ? '[CONFIGURED]' : '[NOT SET]'
      });
      
      return false;
    }
  }
  
  /**
   * Check system health and send alerts if needed
   * 
   * @param {object} healthStatus - Current system health status
   */
  async checkHealthAndAlert(healthStatus) {
    try {
      // Check worker health
      await this.checkWorkerHealth(healthStatus.workers || {});
      
      // Check queue depth
      await this.checkQueueHealth(healthStatus.queues || {});
      
      // Check system resources
      await this.checkSystemResources(healthStatus.system || {});
      
      // Check cost thresholds
      await this.checkCostThresholds(healthStatus.costs || {});
      
    } catch (error) {
      this.log('error', 'Error during health check alerting', { error: error.message });
      
      await this.sendAlert(
        'critical',
        t('alert.titles.health_check_error'),
        t('alert.messages.health_check_error', { error: error.message }),
        { error: error.stack },
        { force: true }
      );
    }
  }
  
  /**
   * Check worker health and alert on issues
   */
  async checkWorkerHealth(workers) {
    let totalWorkers = 0;
    let healthyWorkers = 0;
    let failedWorkers = [];
    
    for (const [workerType, workerHealth] of Object.entries(workers)) {
      totalWorkers++;
      
      if (workerHealth.status === 'healthy') {
        healthyWorkers++;
      } else {
        failedWorkers.push({
          type: workerType,
          status: workerHealth.status,
          error: workerHealth.error || 'Unknown error'
        });
      }
    }
    
    if (totalWorkers === 0) return;
    
    const failureRate = ((totalWorkers - healthyWorkers) / totalWorkers) * 100;
    
    // Check failure thresholds
    if (failureRate >= this.thresholds.workerFailures.critical) {
      await this.sendAlert(
        'critical',
        t('alert.titles.worker_failure_critical'),
        t('alert.messages.worker_failure_rate', {
          failureRate: failureRate.toFixed(1),
          unhealthyWorkers: totalWorkers - healthyWorkers,
          totalWorkers
        }),
        {
          failureRate: failureRate.toFixed(1),
          totalWorkers,
          healthyWorkers,
          failedWorkers
        }
      );
    } else if (failureRate >= this.thresholds.workerFailures.warning) {
      await this.sendAlert(
        'warning',
        t('alert.titles.worker_failure_warning'),
        t('alert.messages.worker_failure_rate', {
          failureRate: failureRate.toFixed(1),
          unhealthyWorkers: totalWorkers - healthyWorkers,
          totalWorkers
        }),
        {
          failureRate: failureRate.toFixed(1),
          totalWorkers,
          healthyWorkers,
          failedWorkers
        }
      );
    }
    
    // Alert on specific critical worker failures
    for (const failedWorker of failedWorkers) {
      if (failedWorker.status === 'error') {
        await this.sendAlert(
          'warning',
          t('alert.titles.worker_error', { workerType: failedWorker.type }),
          t('alert.messages.worker_error_detail', { 
            workerType: failedWorker.type, 
            error: failedWorker.error 
          }),
          failedWorker
        );
      }
    }
  }
  
  /**
   * Check queue health and alert on high depth
   */
  async checkQueueHealth(queues) {
    for (const [queueType, queueStats] of Object.entries(queues)) {
      if (typeof queueStats.total !== 'number') continue;
      
      const depth = queueStats.total;
      
      if (depth >= this.thresholds.queueDepth.critical) {
        await this.sendAlert(
          'critical',
          t('alert.titles.queue_depth_critical', { queueType }),
          t('alert.messages.queue_depth_critical', {
            queueType,
            depth,
            threshold: this.thresholds.queueDepth.critical
          }),
          {
            queueType,
            depth,
            threshold: this.thresholds.queueDepth.critical,
            queueStats
          }
        );
      } else if (depth >= this.thresholds.queueDepth.warning) {
        await this.sendAlert(
          'warning',
          t('alert.titles.queue_depth_warning', { queueType }),
          t('alert.messages.queue_depth_warning', {
            queueType,
            depth,
            threshold: this.thresholds.queueDepth.warning
          }),
          {
            queueType,
            depth,
            threshold: this.thresholds.queueDepth.warning,
            queueStats
          }
        );
      }
    }
  }
  
  /**
   * Check system resources (memory, CPU)
   */
  async checkSystemResources(systemStats) {
    if (systemStats.memory && typeof systemStats.memory.usage === 'number') {
      const memoryUsage = systemStats.memory.usage;
      
      if (memoryUsage >= this.thresholds.memoryUsage.critical) {
        await this.sendAlert(
          'critical',
          t('alert.titles.memory_usage_critical'),
          t('alert.messages.memory_usage_critical', {
            memoryUsage,
            threshold: this.thresholds.memoryUsage.critical
          }),
          {
            memoryUsage,
            threshold: this.thresholds.memoryUsage.critical,
            memoryStats: systemStats.memory
          }
        );
      } else if (memoryUsage >= this.thresholds.memoryUsage.warning) {
        await this.sendAlert(
          'warning',
          t('alert.titles.memory_usage_warning'),
          t('alert.messages.memory_usage_warning', {
            memoryUsage,
            threshold: this.thresholds.memoryUsage.warning
          }),
          {
            memoryUsage,
            threshold: this.thresholds.memoryUsage.warning,
            memoryStats: systemStats.memory
          }
        );
      }
    }
    
    // Check response times if available
    if (systemStats.responseTime && typeof systemStats.responseTime.average === 'number') {
      const avgResponseTime = systemStats.responseTime.average;
      
      if (avgResponseTime >= this.thresholds.responseTime.critical) {
        await this.sendAlert(
          'critical',
          t('alert.titles.response_time_critical'),
          t('alert.messages.response_time_critical', {
            avgResponseTime,
            threshold: this.thresholds.responseTime.critical
          }),
          {
            avgResponseTime,
            threshold: this.thresholds.responseTime.critical,
            responseTimeStats: systemStats.responseTime
          }
        );
      } else if (avgResponseTime >= this.thresholds.responseTime.warning) {
        await this.sendAlert(
          'warning',
          t('alert.titles.response_time_warning'),
          t('alert.messages.response_time_warning', {
            avgResponseTime,
            threshold: this.thresholds.responseTime.warning
          }),
          {
            avgResponseTime,
            threshold: this.thresholds.responseTime.warning,
            responseTimeStats: systemStats.responseTime
          }
        );
      }
    }
  }
  
  /**
   * Check cost thresholds
   */
  async checkCostThresholds(costStats) {
    if (costStats.budgetUsagePercentage && typeof costStats.budgetUsagePercentage === 'number') {
      const usagePercentage = costStats.budgetUsagePercentage;
      
      if (usagePercentage >= this.thresholds.costPercentage.critical) {
        await this.sendAlert(
          'critical',
          t('alert.titles.cost_critical'),
          t('alert.messages.cost_critical', {
            usagePercentage,
            threshold: this.thresholds.costPercentage.critical
          }),
          {
            usagePercentage,
            threshold: this.thresholds.costPercentage.critical,
            costStats
          }
        );
      } else if (usagePercentage >= this.thresholds.costPercentage.warning) {
        await this.sendAlert(
          'warning',
          t('alert.titles.cost_warning'),
          t('alert.messages.cost_warning', {
            usagePercentage,
            threshold: this.thresholds.costPercentage.warning
          }),
          {
            usagePercentage,
            threshold: this.thresholds.costPercentage.warning,
            costStats
          }
        );
      }
    }
  }
  
  /**
   * Build Slack webhook payload
   */
  buildSlackPayload(severity, title, message, data) {
    const colors = {
      critical: '#FF0000',
      warning: '#FFA500',
      info: '#0066CC'
    };
    
    const icons = {
      critical: '🚨',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    const payload = {
      attachments: [{
        color: colors[severity] || colors.info,
        title: `${icons[severity]} ${title}`,
        text: message,
        fields: [
          {
            title: t('alert.fields.severity'),
            value: t(`alert.severities.${severity}`),
            short: true
          },
          {
            title: t('alert.fields.timestamp'),
            value: new Date().toISOString(),
            short: true
          }
        ],
        footer: t('alert.footer'),
        ts: Math.floor(Date.now() / 1000)
      }]
    };
    
    // Add data fields if provided
    if (data && Object.keys(data).length > 0) {
      const dataFields = Object.entries(data)
        .slice(0, 8) // Limit to 8 additional fields
        .map(([key, value]) => ({
          title: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
          value: typeof value === 'object' ? JSON.stringify(value) : String(value),
          short: true
        }));
      
      payload.attachments[0].fields.push(...dataFields);
    }
    
    return payload;
  }
  
  /**
   * Generate unique alert key for deduplication
   */
  generateAlertKey(severity, title, message) {
    const hash = require('crypto').createHash('md5');
    hash.update(`${severity}:${title}:${message.substring(0, 100)}`);
    return hash.digest('hex');
  }
  
  /**
   * Check if alert should be sent (rate limiting and deduplication)
   */
  shouldSendAlert(alertKey, severity) {
    const now = Date.now();
    const hourKey = Math.floor(now / 3600000); // Current hour
    
    // Check hourly limit
    const currentHourCount = this.alertCounts.get(hourKey) || 0;
    if (currentHourCount >= this.config.maxAlertsPerHour) {
      return false;
    }
    
    // Check cooldown period
    const lastSent = this.alertHistory.get(alertKey);
    if (lastSent) {
      const timeSinceLastAlert = now - lastSent.timestamp;
      const cooldownPeriod = severity === 'critical' ? 
        this.config.alertCooldown / 2 : // Shorter cooldown for critical alerts
        this.config.alertCooldown;
      
      if (timeSinceLastAlert < cooldownPeriod) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Record that an alert was sent
   */
  recordAlert(alertKey, severity) {
    const now = Date.now();
    const hourKey = Math.floor(now / 3600000);
    
    // Update alert history
    this.alertHistory.set(alertKey, {
      timestamp: now,
      severity
    });
    
    // Update hourly count
    const currentCount = this.alertCounts.get(hourKey) || 0;
    this.alertCounts.set(hourKey, currentCount + 1);
  }
  
  /**
   * Clean up old alert history to prevent memory leaks
   */
  cleanupAlertHistory() {
    const now = Date.now();
    const cutoff = now - (24 * 60 * 60 * 1000); // 24 hours
    const currentHour = Math.floor(now / 3600000);
    
    // Clean alert history older than 24 hours
    for (const [key, data] of this.alertHistory.entries()) {
      if (data.timestamp < cutoff) {
        this.alertHistory.delete(key);
      }
    }
    
    // Clean alert counts older than 2 hours
    for (const [hourKey] of this.alertCounts.entries()) {
      if (hourKey < currentHour - 1) {
        this.alertCounts.delete(hourKey);
      }
    }
    
    this.log('debug', 'Cleaned up alert history', {
      alertHistorySize: this.alertHistory.size,
      alertCountsSize: this.alertCounts.size
    });
  }
  
  /**
   * Get alerting service statistics
   */
  getStats() {
    const now = Date.now();
    const hourKey = Math.floor(now / 3600000);
    
    return {
      enabled: this.config.enabled,
      hasWebhook: !!this.config.webhookUrl,
      thresholds: this.thresholds,
      alertHistorySize: this.alertHistory.size,
      alertsThisHour: this.alertCounts.get(hourKey) || 0,
      maxAlertsPerHour: this.config.maxAlertsPerHour,
      cooldownPeriod: this.config.alertCooldown
    };
  }
  
  /**
   * Test the alerting system
   */
  async testAlert() {
    return await this.sendAlert(
      'info',
      t('alert.titles.test_alert'),
      t('alert.messages.test_alert'),
      { test: true, timestamp: new Date().toISOString() },
      { force: true, skipRateLimit: true }
    );
  }
  
  /**
   * Shutdown the alerting service and clean up resources
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.log('info', 'Alerting Service shutdown complete');
    }
  }
  
  /**
   * Logging utility
   */
  log(level, message, metadata = {}) {
    if (logger && typeof logger[level] === 'function') {
      logger[level](message, metadata);
    } else {
      console.log(`[${level.toUpperCase()}] AlertingService: ${message}`, metadata);
    }
  }
}

module.exports = new AlertingService();