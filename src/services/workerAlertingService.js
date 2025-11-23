/**
 * Worker Alerting Service
 *
 * Part of Issue #713: Worker Monitoring Dashboard
 *
 * Provides alerting capabilities for worker health, queue status, and job failures.
 * Supports multiple channels: email, Slack, and structured logging.
 */

const logger = require('../utils/logger');
const { flags } = require('../config/flags');

class WorkerAlertingService {
  constructor(options = {}) {
    this.options = {
      enabled: options.enabled !== false,
      channels: options.channels || ['log'], // log, email, slack
      thresholds: {
        workerDown: options.thresholds?.workerDown || 1, // Alert if any worker down
        queueDepth: options.thresholds?.queueDepth || 1000, // Alert if queue depth exceeds
        failureRate: options.thresholds?.failureRate || 0.1, // Alert if failure rate > 10%
        dlqSize: options.thresholds?.dlqSize || 100, // Alert if DLQ size exceeds
        processingTime: options.thresholds?.processingTime || 30000, // Alert if avg processing > 30s
        ...options.thresholds
      },
      cooldown: options.cooldown || 300000, // 5 minutes cooldown between same alerts
      ...options
    };

    // Track sent alerts to prevent spam
    this.alertHistory = new Map();

    // Initialize channels
    this.initializeChannels();
  }

  /**
   * Initialize alert channels
   */
  initializeChannels() {
    this.channels = {
      log: true, // Always enabled
      email: this.options.channels.includes('email') && this.checkEmailConfig(),
      slack: this.options.channels.includes('slack') && this.checkSlackConfig()
    };
  }

  /**
   * Check if email configuration is available
   */
  checkEmailConfig() {
    return !!(process.env.SMTP_HOST || process.env.EMAIL_SERVICE || process.env.ALERT_EMAIL);
  }

  /**
   * Check if Slack configuration is available
   */
  checkSlackConfig() {
    return !!(process.env.SLACK_WEBHOOK_URL || process.env.SLACK_BOT_TOKEN);
  }

  /**
   * Check worker health and send alerts if needed
   */
  async checkWorkerHealth(workerMetrics) {
    if (!this.options.enabled) return;

    const alerts = [];

    // Check for down workers
    if (workerMetrics.workers.unhealthy > this.options.thresholds.workerDown) {
      alerts.push({
        type: 'worker_down',
        severity: 'critical',
        message: `${workerMetrics.workers.unhealthy} worker(s) are unhealthy`,
        data: {
          total: workerMetrics.workers.total,
          healthy: workerMetrics.workers.healthy,
          unhealthy: workerMetrics.workers.unhealthy,
          details: workerMetrics.workers.details.filter(
            (w) => w.status !== 'healthy' && w.status !== 'operational'
          )
        }
      });
    }

    // Check queue depth
    if (workerMetrics.queues.totalDepth > this.options.thresholds.queueDepth) {
      alerts.push({
        type: 'queue_depth_high',
        severity: 'warning',
        message: `Queue depth is high: ${workerMetrics.queues.totalDepth} jobs pending`,
        data: {
          totalDepth: workerMetrics.queues.totalDepth,
          byQueue: workerMetrics.queues.byQueue
        }
      });
    }

    // Check failure rate
    const failureRate =
      workerMetrics.jobs.totalProcessed > 0
        ? workerMetrics.jobs.totalFailed / workerMetrics.jobs.totalProcessed
        : 0;

    if (failureRate > this.options.thresholds.failureRate) {
      alerts.push({
        type: 'failure_rate_high',
        severity: 'warning',
        message: `Job failure rate is high: ${(failureRate * 100).toFixed(2)}%`,
        data: {
          failureRate,
          totalProcessed: workerMetrics.jobs.totalProcessed,
          totalFailed: workerMetrics.jobs.totalFailed
        }
      });
    }

    // Check DLQ size
    if (workerMetrics.queues.totalDLQ > this.options.thresholds.dlqSize) {
      alerts.push({
        type: 'dlq_size_high',
        severity: 'critical',
        message: `Dead Letter Queue size is high: ${workerMetrics.queues.totalDLQ} jobs`,
        data: {
          dlqSize: workerMetrics.queues.totalDLQ,
          byQueue: Object.entries(workerMetrics.queues.byQueue)
            .filter(([_, q]) => q.dlq > 0)
            .map(([name, q]) => ({ queue: name, dlq: q.dlq }))
        }
      });
    }

    // Check processing time
    if (workerMetrics.performance.averageProcessingTime > this.options.thresholds.processingTime) {
      alerts.push({
        type: 'processing_time_high',
        severity: 'warning',
        message: `Average processing time is high: ${workerMetrics.performance.averageProcessingTime}ms`,
        data: {
          averageProcessingTime: workerMetrics.performance.averageProcessingTime,
          threshold: this.options.thresholds.processingTime
        }
      });
    }

    // Send alerts
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }

    return alerts;
  }

  /**
   * Send alert through configured channels
   */
  async sendAlert(alert) {
    const alertKey = `${alert.type}_${JSON.stringify(alert.data)}`;
    const lastSent = this.alertHistory.get(alertKey);

    // Check cooldown
    if (lastSent && Date.now() - lastSent < this.options.cooldown) {
      logger.debug('Alert suppressed due to cooldown', {
        type: alert.type,
        lastSent: new Date(lastSent).toISOString()
      });
      return;
    }

    // Update history
    this.alertHistory.set(alertKey, Date.now());

    // Clean old history (keep last 100 entries)
    if (this.alertHistory.size > 100) {
      const entries = Array.from(this.alertHistory.entries());
      entries.sort((a, b) => b[1] - a[1]); // Sort by timestamp desc
      this.alertHistory.clear();
      entries.slice(0, 100).forEach(([key, value]) => {
        this.alertHistory.set(key, value);
      });
    }

    // Send through channels
    const promises = [];

    if (this.channels.log) {
      promises.push(this.sendLogAlert(alert));
    }

    if (this.channels.email) {
      promises.push(this.sendEmailAlert(alert));
    }

    if (this.channels.slack) {
      promises.push(this.sendSlackAlert(alert));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Send alert via logging
   */
  async sendLogAlert(alert) {
    const logLevel = alert.severity === 'critical' ? 'error' : 'warn';
    logger[logLevel]('Worker Alert', {
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      data: alert.data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send alert via email
   */
  async sendEmailAlert(alert) {
    try {
      // Check if email service is available
      const emailService = require('./emailService');

      const subject = `[Roastr.ai] Worker Alert: ${alert.type}`;
      const body = `
        Worker Alert: ${alert.message}
        
        Type: ${alert.type}
        Severity: ${alert.severity}
        Timestamp: ${new Date().toISOString()}
        
        Details:
        ${JSON.stringify(alert.data, null, 2)}
      `;

      await emailService.send({
        to: process.env.ALERT_EMAIL || process.env.ADMIN_EMAIL,
        subject,
        text: body
      });

      logger.info('Worker alert sent via email', { type: alert.type });
    } catch (error) {
      logger.warn('Failed to send email alert', { error: error.message });
    }
  }

  /**
   * Send alert via Slack
   */
  async sendSlackAlert(alert) {
    try {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL;
      if (!webhookUrl) {
        logger.warn('Slack webhook URL not configured');
        return;
      }

      const axios = require('axios');
      const color = alert.severity === 'critical' ? 'danger' : 'warning';

      const payload = {
        text: `Worker Alert: ${alert.message}`,
        attachments: [
          {
            color,
            fields: [
              { title: 'Type', value: alert.type, short: true },
              { title: 'Severity', value: alert.severity, short: true },
              { title: 'Timestamp', value: new Date().toISOString(), short: false },
              { title: 'Details', value: JSON.stringify(alert.data, null, 2), short: false }
            ]
          }
        ]
      };

      await axios.post(webhookUrl, payload);
      logger.info('Worker alert sent via Slack', { type: alert.type });
    } catch (error) {
      logger.warn('Failed to send Slack alert', { error: error.message });
    }
  }

  /**
   * Get alert statistics
   */
  getStats() {
    return {
      enabled: this.options.enabled,
      channels: Object.keys(this.channels).filter((k) => this.channels[k]),
      alertsSent: this.alertHistory.size,
      thresholds: this.options.thresholds
    };
  }

  /**
   * Clear alert history (for testing)
   */
  clearHistory() {
    this.alertHistory.clear();
  }
}

module.exports = WorkerAlertingService;
