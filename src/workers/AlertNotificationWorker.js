const BaseWorker = require('./BaseWorker');
const alertingService = require('../services/alertingService');

/**
 * Alert Notification Worker for Roastr.ai Multi-Tenant Architecture
 * 
 * Processes alert_notification jobs from the queue system:
 * - Decouples alert sending from main application threads
 * - Implements retry logic with exponential backoff
 * - Handles multiple alert types (Slack, email, etc.)
 * - Provides resilient alerting infrastructure
 */
class AlertNotificationWorker extends BaseWorker {
  constructor(options = {}) {
    super('alert_notification', {
      maxRetries: 3,
      retryDelay: 1000, // Start with 1 second
      maxConcurrency: 5, // Allow multiple alert processing
      pollInterval: 2000, // Check for alerts every 2 seconds
      ...options
    });
    
    // Alert processing metrics
    this.alertsSent = 0;
    this.alertsFailed = 0;
    this.alertTypes = new Map(); // Track alerts by type
  }
  
  /**
   * Process an alert notification job
   */
  async processJob(job) {
    const { payload } = job;
    
    // Validate job payload
    this.validateAlertPayload(payload);
    
    const { type, severity, title, message, data = {}, options = {}, lang = 'en' } = payload;
    
    this.log('info', 'Processing alert notification', {
      jobId: job.id,
      type,
      severity,
      title: title.substring(0, 50) + (title.length > 50 ? '...' : ''),
      lang
    });
    
    let result;
    
    try {
      // Set language context if provided
      if (lang && this.setLanguageContext) {
        this.setLanguageContext(lang);
      }
      
      // Process alert based on type
      switch (type) {
        case 'slack':
          result = await this.processSlackAlert(severity, title, message, data, options);
          break;
          
        case 'email':
          // Future implementation for email alerts
          result = await this.processEmailAlert(severity, title, message, data, options);
          break;
          
        default:
          throw new Error(`Unsupported alert type: ${type}`);
      }
      
      // Track successful alert
      this.alertsSent++;
      this.trackAlertType(type, 'success');
      
      this.log('info', 'Alert notification sent successfully', {
        jobId: job.id,
        type,
        severity,
        result: result ? 'success' : 'failed'
      });
      
      return {
        success: true,
        type,
        severity,
        sentAt: new Date().toISOString(),
        result
      };
      
    } catch (error) {
      this.alertsFailed++;
      this.trackAlertType(type, 'failed');
      
      this.log('error', 'Failed to send alert notification', {
        jobId: job.id,
        type,
        severity,
        error: error.message
      });
      
      // Re-throw to trigger retry logic
      throw new Error(`Alert notification failed: ${error.message}`);
    }
  }
  
  /**
   * Process Slack alert notification
   */
  async processSlackAlert(severity, title, message, data, options) {
    try {
      // Use existing AlertingService to send the alert
      const success = await alertingService.sendAlert(severity, title, message, data, {
        ...options,
        force: true, // Force send since it's already queued
        skipRateLimit: true // Skip rate limiting since queue manages this
      });
      
      if (!success) {
        throw new Error('AlertingService returned false for Slack alert');
      }
      
      return { platform: 'slack', status: 'sent' };
      
    } catch (error) {
      throw new Error(`Slack alert failed: ${error.message}`);
    }
  }
  
  /**
   * Process email alert notification (placeholder for future implementation)
   */
  async processEmailAlert(severity, title, message, data, options) {
    // Future implementation for email notifications
    this.log('warn', 'Email notifications not yet implemented', { severity, title });
    
    // For now, return success to avoid blocking
    return { platform: 'email', status: 'not_implemented' };
  }
  
  /**
   * Validate alert notification payload
   */
  validateAlertPayload(payload) {
    if (!payload) {
      throw new Error('Alert payload is required');
    }
    
    const { type, severity, title, message } = payload;
    
    // Required fields
    if (!type) {
      throw new Error('Alert type is required');
    }
    
    if (!['slack', 'email'].includes(type)) {
      throw new Error(`Invalid alert type: ${type}. Must be 'slack' or 'email'`);
    }
    
    if (!severity) {
      throw new Error('Alert severity is required');
    }
    
    if (!['critical', 'warning', 'info'].includes(severity)) {
      throw new Error(`Invalid alert severity: ${severity}. Must be 'critical', 'warning', or 'info'`);
    }
    
    if (!title || typeof title !== 'string') {
      throw new Error('Alert title must be a non-empty string');
    }
    
    if (!message || typeof message !== 'string') {
      throw new Error('Alert message must be a non-empty string');
    }
    
    // Length validation
    if (title.length > 200) {
      throw new Error('Alert title must be 200 characters or less');
    }
    
    if (message.length > 2000) {
      throw new Error('Alert message must be 2000 characters or less');
    }
  }
  
  /**
   * Track alert types for metrics
   */
  trackAlertType(type, status) {
    const key = `${type}_${status}`;
    const current = this.alertTypes.get(key) || 0;
    this.alertTypes.set(key, current + 1);
  }
  
  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(attempts) {
    // Exponential backoff: 1s, 2s, 4s
    return this.config.retryDelay * Math.pow(2, attempts - 1);
  }
  
  /**
   * Get worker-specific health details
   */
  async getSpecificHealthDetails() {
    return {
      alertsSent: this.alertsSent,
      alertsFailed: this.alertsFailed,
      successRate: this.alertsSent > 0 
        ? ((this.alertsSent / (this.alertsSent + this.alertsFailed)) * 100).toFixed(2) + '%'
        : 'N/A',
      alertTypeBreakdown: Object.fromEntries(this.alertTypes),
      alertingServiceStatus: {
        enabled: alertingService.config?.enabled || false,
        hasWebhook: !!alertingService.config?.webhookUrl
      }
    };
  }
  
  /**
   * Get worker statistics including alert-specific metrics
   */
  getStats() {
    const baseStats = super.getStats();
    
    return {
      ...baseStats,
      alertMetrics: {
        alertsSent: this.alertsSent,
        alertsFailed: this.alertsFailed,
        alertTypes: Object.fromEntries(this.alertTypes),
        successRate: this.alertsSent > 0 
          ? ((this.alertsSent / (this.alertsSent + this.alertsFailed)) * 100).toFixed(2) + '%'
          : 'N/A'
      }
    };
  }
}

module.exports = AlertNotificationWorker;