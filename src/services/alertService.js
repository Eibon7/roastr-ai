const advancedLogger = require('../utils/advancedLogger');
const axios = require('axios');

class AlertService {
  constructor() {
    this.webhookUrl = process.env.LOG_ALERT_WEBHOOK_URL;
    this.emailEnabled = process.env.EMAIL_ALERTS_ENABLED === 'true';
    this.alertingEnabled = process.env.ALERTING_ENABLED !== 'false'; // Default enabled

    // Alert rate limiting to prevent spam
    this.alertHistory = new Map();
    this.maxAlertsPerHour = parseInt(process.env.MAX_ALERTS_PER_HOUR) || 10;
    this.alertCooldownMinutes = parseInt(process.env.ALERT_COOLDOWN_MINUTES) || 15;
  }

  /**
   * Send alert for backup failures and other maintenance issues
   */
  async sendAlert(alertType, data, options = {}) {
    if (!this.alertingEnabled) {
      advancedLogger.debug('Alerting is disabled, skipping alert', { alertType, data });
      return { sent: false, reason: 'alerting_disabled' };
    }

    try {
      // Check rate limiting
      if (this.isRateLimited(alertType)) {
        const rateLimitInfo = this.getRateLimitInfo(alertType);
        advancedLogger.warn('Alert rate limited', {
          alertType,
          cooldownMinutes: this.alertCooldownMinutes,
          maxAlertsPerHour: this.maxAlertsPerHour,
          ...rateLimitInfo
        });
        return { sent: false, reason: 'rate_limited', rateLimitInfo };
      }

      const alert = this.buildAlert(alertType, data, options);

      // Log the alert
      advancedLogger.warn(`🚨 Alert: ${alertType}`, alert);

      const results = [];

      // Send webhook alert
      if (this.webhookUrl) {
        try {
          const webhookResult = await this.sendWebhookAlert(alert);
          results.push({ type: 'webhook', success: true, response: webhookResult });
        } catch (error) {
          results.push({ type: 'webhook', success: false, error: error.message });
          advancedLogger.error('Webhook alert failed', { error: error.message });
        }
      }

      // Send email alert (if configured)
      if (this.emailEnabled) {
        try {
          const emailResult = await this.sendEmailAlert(alert);
          results.push({ type: 'email', success: true, response: emailResult });
        } catch (error) {
          results.push({ type: 'email', success: false, error: error.message });
          advancedLogger.error('Email alert failed', { error: error.message });
        }
      }

      // Send to internal notification system
      try {
        const internalResult = await this.sendInternalAlert(alert);
        results.push({ type: 'internal', success: true, response: internalResult });
      } catch (error) {
        results.push({ type: 'internal', success: false, error: error.message });
        advancedLogger.error('Internal alert failed', { error: error.message });
      }

      // Record alert in history for rate limiting
      this.recordAlert(alertType);

      const successCount = results.filter((r) => r.success).length;
      const totalChannels = results.length;

      advancedLogger.info('Alert sent', {
        alertType,
        successCount,
        totalChannels,
        results
      });

      return {
        sent: successCount > 0,
        successCount,
        totalChannels,
        results
      };
    } catch (error) {
      advancedLogger.error('Failed to send alert', { alertType, error: error.message });
      throw error;
    }
  }

  /**
   * Build standardized alert payload
   */
  buildAlert(alertType, data, options = {}) {
    const {
      severity = this.getDefaultSeverity(alertType),
      service = 'roastr-ai',
      environment = process.env.NODE_ENV || 'development'
    } = options;

    return {
      type: alertType,
      severity,
      service,
      environment,
      timestamp: new Date().toISOString(),
      message: this.getAlertMessage(alertType, data),
      data,
      metadata: {
        hostname: require('os').hostname(),
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform
      }
    };
  }

  /**
   * Get human-readable alert message
   */
  getAlertMessage(alertType, data) {
    const messages = {
      backup_failed: `Log backup failed: ${data.error || 'Unknown error'}`,
      backup_high_error_rate: `Log backup has high error rate: ${data.errorRate} (${data.errorDates?.join(', ')})`,
      backup_cleanup_failed: `Backup cleanup failed: ${data.error || 'Unknown error'}`,
      cleanup_failed: `Log cleanup failed: ${data.error || 'Unknown error'}`,
      health_issues: `Log system health issues detected: ${data.issues?.length || 0} issues found`,
      size_threshold_exceeded: `Log directory size exceeded threshold: ${data.currentSize} > ${data.threshold}`,
      stale_backup: `Backup hasn't run recently: last backup was ${data.hoursSinceLastBackup} hours ago`,
      disk_space_critical: `Critical disk space: ${data.freeSpace} remaining on ${data.disk}`,
      log_rotation_failed: `Log rotation failed for ${data.logType}: ${data.error}`,
      s3_connection_failed: `S3 connection failed: ${data.error}`,
      maintenance_service_down: `Log maintenance service is down: ${data.error}`
    };

    return messages[alertType] || `Alert: ${alertType} - ${JSON.stringify(data)}`;
  }

  /**
   * Get default severity level for alert type
   */
  getDefaultSeverity(alertType) {
    const criticalAlerts = ['disk_space_critical', 'maintenance_service_down'];
    const warningAlerts = ['backup_failed', 'cleanup_failed', 'stale_backup'];

    if (criticalAlerts.includes(alertType)) return 'critical';
    if (warningAlerts.includes(alertType)) return 'warning';
    return 'info';
  }

  /**
   * Send alert via webhook
   */
  async sendWebhookAlert(alert) {
    if (!this.webhookUrl) {
      throw new Error('Webhook URL not configured');
    }

    const payload = {
      text: `🚨 ${alert.service.toUpperCase()} Alert`,
      attachments: [
        {
          color: this.getSeverityColor(alert.severity),
          title: alert.message,
          fields: [
            {
              title: 'Type',
              value: alert.type,
              short: true
            },
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true
            },
            {
              title: 'Environment',
              value: alert.environment,
              short: true
            },
            {
              title: 'Timestamp',
              value: new Date(alert.timestamp).toLocaleString(),
              short: true
            }
          ],
          footer: `${alert.metadata.hostname} | PID ${alert.metadata.pid}`,
          ts: Math.floor(new Date(alert.timestamp).getTime() / 1000)
        }
      ]
    };

    // Add detailed data if available
    if (alert.data && Object.keys(alert.data).length > 0) {
      payload.attachments[0].fields.push({
        title: 'Details',
        value: `\`\`\`${JSON.stringify(alert.data, null, 2)}\`\`\``,
        short: false
      });
    }

    const response = await axios.post(this.webhookUrl, payload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Roastr-AI-Alert-Service/1.0'
      }
    });

    return {
      status: response.status,
      statusText: response.statusText
    };
  }

  /**
   * Send alert via email (placeholder for email service integration)
   */
  async sendEmailAlert(alert) {
    // This would integrate with your email service (SendGrid, SES, etc.)
    // For now, we'll just log it as a placeholder

    const emailPayload = {
      to: process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || ['admin@example.com'],
      subject: `🚨 ${alert.service.toUpperCase()} Alert: ${alert.type}`,
      html: this.buildEmailTemplate(alert)
    };

    advancedLogger.info('Email alert would be sent', emailPayload);

    // TODO: Integrate with actual email service
    // return await emailService.send(emailPayload);

    return { sent: false, reason: 'email_service_not_implemented' };
  }

  /**
   * Send alert to internal notification system
   */
  async sendInternalAlert(alert) {
    // This could integrate with an internal notification service
    // For now, we'll store it in the application logs with a special marker

    advancedLogger.auditEvent('System Alert Generated', {
      alertType: alert.type,
      severity: alert.severity,
      message: alert.message,
      data: alert.data,
      timestamp: alert.timestamp
    });

    return { logged: true, system: 'internal_audit_log' };
  }

  /**
   * Build HTML email template
   */
  buildEmailTemplate(alert) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .alert { border-left: 4px solid ${this.getSeverityColor(alert.severity)}; padding: 10px; margin: 10px 0; }
            .severity { color: ${this.getSeverityColor(alert.severity)}; font-weight: bold; }
            .details { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 4px; }
            .metadata { font-size: 12px; color: #666; margin-top: 20px; }
        </style>
    </head>
    <body>
        <h2>🚨 ${alert.service.toUpperCase()} Alert</h2>
        
        <div class="alert">
            <h3>${alert.message}</h3>
            <p><strong>Type:</strong> ${alert.type}</p>
            <p><strong>Severity:</strong> <span class="severity">${alert.severity.toUpperCase()}</span></p>
            <p><strong>Environment:</strong> ${alert.environment}</p>
            <p><strong>Timestamp:</strong> ${new Date(alert.timestamp).toLocaleString()}</p>
        </div>

        ${
          alert.data && Object.keys(alert.data).length > 0
            ? `
        <div class="details">
            <h4>Details:</h4>
            <pre>${JSON.stringify(alert.data, null, 2)}</pre>
        </div>
        `
            : ''
        }

        <div class="metadata">
            <p><strong>System:</strong> ${alert.metadata.hostname} (PID ${alert.metadata.pid})</p>
            <p><strong>Platform:</strong> ${alert.metadata.platform}</p>
            <p><strong>Node.js:</strong> ${alert.metadata.nodeVersion}</p>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Get color for severity level
   */
  getSeverityColor(severity) {
    const colors = {
      critical: '#dc3545',
      warning: '#ffc107',
      info: '#17a2b8',
      success: '#28a745'
    };
    return colors[severity] || colors.info;
  }

  /**
   * Get detailed rate limit information for an alert type
   */
  getRateLimitInfo(alertType) {
    const now = Date.now();
    const alertKey = `${alertType}`;

    if (!this.alertHistory.has(alertKey)) {
      return {
        alertsLastHour: 0,
        lastAlertAgo: null,
        isInCooldown: false,
        cooldownRemainingMs: 0
      };
    }

    const lastAlert = this.alertHistory.get(alertKey);
    const timeSinceLastAlert = now - lastAlert.timestamp;
    const cooldownMs = this.alertCooldownMinutes * 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentAlerts = lastAlert.history.filter((timestamp) => timestamp > oneHourAgo);

    return {
      alertsLastHour: recentAlerts.length,
      lastAlertAgo: `${Math.floor(timeSinceLastAlert / 1000)}s`,
      isInCooldown: timeSinceLastAlert < cooldownMs,
      cooldownRemainingMs: Math.max(0, cooldownMs - timeSinceLastAlert),
      cooldownRemainingMinutes: Math.max(0, Math.ceil((cooldownMs - timeSinceLastAlert) / 60000))
    };
  }

  /**
   * Check if alert type is rate limited
   */
  isRateLimited(alertType) {
    const now = Date.now();
    const alertKey = `${alertType}`;

    if (!this.alertHistory.has(alertKey)) {
      return false;
    }

    const lastAlert = this.alertHistory.get(alertKey);
    const timeSinceLastAlert = now - lastAlert.timestamp;
    const cooldownMs = this.alertCooldownMinutes * 60 * 1000;

    // Check cooldown
    if (timeSinceLastAlert < cooldownMs) {
      return true;
    }

    // Check hourly rate limit
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentAlerts = lastAlert.history.filter((timestamp) => timestamp > oneHourAgo);

    return recentAlerts.length >= this.maxAlertsPerHour;
  }

  /**
   * Record alert in history for rate limiting
   */
  recordAlert(alertType) {
    const now = Date.now();
    const alertKey = `${alertType}`;

    if (!this.alertHistory.has(alertKey)) {
      this.alertHistory.set(alertKey, {
        timestamp: now,
        history: [now]
      });
    } else {
      const alertData = this.alertHistory.get(alertKey);
      alertData.timestamp = now;
      alertData.history.push(now);

      // Keep only last 24 hours of history
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      alertData.history = alertData.history.filter((timestamp) => timestamp > oneDayAgo);
    }
  }

  /**
   * Clear alert history (for testing)
   */
  clearAlertHistory() {
    this.alertHistory.clear();
  }

  /**
   * Get alert statistics
   */
  getAlertStats() {
    const stats = {
      totalAlertTypes: this.alertHistory.size,
      alertHistory: {},
      rateLimitingActive: this.maxAlertsPerHour < 100,
      cooldownMinutes: this.alertCooldownMinutes
    };

    this.alertHistory.forEach((data, alertType) => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const recentAlerts = data.history.filter((timestamp) => timestamp > oneHourAgo);

      stats.alertHistory[alertType] = {
        lastAlert: new Date(data.timestamp).toISOString(),
        alertsLastHour: recentAlerts.length,
        totalAlerts: data.history.length,
        isRateLimited: this.isRateLimited(alertType)
      };
    });

    return stats;
  }

  /**
   * Test alert system
   */
  async testAlert() {
    const testData = {
      test: true,
      timestamp: new Date().toISOString(),
      message: 'This is a test alert from the Roastr AI alert system'
    };

    return await this.sendAlert('test_alert', testData, { severity: 'info' });
  }
}

module.exports = AlertService;
