/**
 * Alert Service Tests
 *
 * Tests for alert functionality including:
 * - Alert configuration and initialization
 * - Webhook and email alert sending
 * - Rate limiting and cooldown mechanisms
 * - Alert message building and formatting
 * - Error handling and fallback mechanisms
 */

// Create mock queueLogger with all methods BEFORE any imports
const mockQueueLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

const mockWorkerLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Mock advancedLogger BEFORE any imports
jest.mock('../../../src/utils/advancedLogger', () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  auditEvent: jest.fn(),
  queueLogger: mockQueueLogger,
  workerLogger: mockWorkerLogger
}));

// Mock queueService to prevent initialization
jest.mock('../../../src/services/queueService', () => {
  return jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(),
    enqueue: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    getNextJob: jest.fn().mockResolvedValue(null),
    completeJob: jest.fn().mockResolvedValue(),
    failJob: jest.fn().mockResolvedValue(),
    shutdown: jest.fn().mockResolvedValue(),
    log: jest.fn()
  }));
});

// Mock alertingService to prevent setup issues
jest.mock('../../../src/services/alertingService', () => ({
  shutdown: jest.fn()
}));

const axios = require('axios');
const AlertService = require('../../../src/services/alertService');

// Mock axios
jest.mock('axios');

describe('AlertService', () => {
  let alertService;
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Set up test environment
    process.env.LOG_ALERT_WEBHOOK_URL = 'https://hooks.slack.com/test-webhook';
    process.env.EMAIL_ALERTS_ENABLED = 'true';
    process.env.ALERTING_ENABLED = 'true';
    process.env.MAX_ALERTS_PER_HOUR = '10';
    process.env.ALERT_COOLDOWN_MINUTES = '15';
    process.env.ALERT_EMAIL_RECIPIENTS = 'admin@test.com,ops@test.com';

    alertService = new AlertService();

    // Clear alert history
    alertService.alertHistory.clear();

    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('constructor', () => {
    test('should initialize with correct configuration', () => {
      expect(alertService.webhookUrl).toBe('https://hooks.slack.com/test-webhook');
      expect(alertService.emailEnabled).toBe(true);
      expect(alertService.alertingEnabled).toBe(true);
      expect(alertService.maxAlertsPerHour).toBe(10);
      expect(alertService.alertCooldownMinutes).toBe(15);
    });

    test('should use default values for missing environment variables', () => {
      delete process.env.MAX_ALERTS_PER_HOUR;
      delete process.env.ALERT_COOLDOWN_MINUTES;
      delete process.env.ALERTING_ENABLED;

      const service = new AlertService();

      expect(service.maxAlertsPerHour).toBe(10); // default
      expect(service.alertCooldownMinutes).toBe(15); // default
      expect(service.alertingEnabled).toBe(true); // default enabled
    });

    test('should disable alerting when explicitly set to false', () => {
      process.env.ALERTING_ENABLED = 'false';

      const service = new AlertService();

      expect(service.alertingEnabled).toBe(false);
    });
  });

  describe('sendAlert', () => {
    test('should send alert successfully when all channels are configured', async () => {
      axios.post.mockResolvedValue({ status: 200, data: 'OK' });

      const result = await alertService.sendAlert('backup_failed', {
        error: 'S3 connection timeout',
        retryCount: 3
      });

      expect(result.sent).toBe(true);
      expect(result.results).toHaveLength(3); // webhook, email, internal
      expect(result.results[0].type).toBe('webhook');
      expect(result.results[0].success).toBe(true);
    });

    test('should skip alert when alerting is disabled', async () => {
      alertService.alertingEnabled = false;

      const result = await alertService.sendAlert('backup_failed', {});

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('alerting_disabled');
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('should respect rate limiting', async () => {
      // Fill up the rate limit - need to set up alertHistory correctly
      // The service uses a single key with history array
      const now = Date.now();
      const recentTimestamp = now - 20 * 60 * 1000; // 20 minutes ago (past cooldown)
      
      alertService.alertHistory.set('backup_failed', {
        timestamp: recentTimestamp, // Past cooldown
        history: Array(11).fill(now - 10 * 60 * 1000) // 11 alerts in last hour (exceeds limit of 10)
      });

      const result = await alertService.sendAlert('backup_failed', {});

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('rate_limited');
      expect(result.rateLimitInfo).toBeDefined();
    });

    test('should handle webhook failures gracefully', async () => {
      axios.post.mockRejectedValue(new Error('Webhook timeout'));

      const result = await alertService.sendAlert('backup_failed', {});

      expect(result.sent).toBe(true);
      expect(result.results[0].type).toBe('webhook');
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toBe('Webhook timeout');
    });

    test('should send to multiple channels even if one fails', async () => {
      axios.post.mockRejectedValue(new Error('Webhook failed'));

      const result = await alertService.sendAlert('backup_failed', {});

      expect(result.sent).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.results[0].success).toBe(false); // webhook failed
      expect(result.results[1].success).toBe(true); // email succeeded (mocked)
      expect(result.results[2].success).toBe(true); // internal succeeded
    });
  });

  describe('buildAlert', () => {
    test('should build alert with correct structure', () => {
      const alert = alertService.buildAlert('backup_failed', {
        error: 'Connection timeout',
        retryCount: 3
      });

      expect(alert).toEqual({
        type: 'backup_failed',
        severity: 'warning',
        service: 'roastr-ai',
        environment: expect.any(String),
        timestamp: expect.any(String),
        message: expect.stringContaining('Log backup failed'),
        data: {
          error: 'Connection timeout',
          retryCount: 3
        },
        metadata: {
          hostname: expect.any(String),
          pid: expect.any(Number),
          nodeVersion: expect.any(String),
          platform: expect.any(String)
        }
      });
    });

    test('should use custom severity when provided', () => {
      const alert = alertService.buildAlert(
        'backup_failed',
        {},
        {
          severity: 'critical'
        }
      );

      expect(alert.severity).toBe('critical');
    });

    test('should use custom service and environment', () => {
      const alert = alertService.buildAlert(
        'backup_failed',
        {},
        {
          service: 'custom-service',
          environment: 'staging'
        }
      );

      expect(alert.service).toBe('custom-service');
      expect(alert.environment).toBe('staging');
    });
  });

  describe('getAlertMessage', () => {
    test('should return appropriate message for backup_failed', () => {
      const message = alertService.getAlertMessage('backup_failed', {
        error: 'S3 timeout'
      });

      expect(message).toContain('Log backup failed');
      expect(message).toContain('S3 timeout');
    });

    test('should return appropriate message for cleanup_failed', () => {
      const message = alertService.getAlertMessage('cleanup_failed', {
        error: 'Permission denied'
      });

      expect(message).toContain('Log cleanup failed');
      expect(message).toContain('Permission denied');
    });

    test('should return appropriate message for high_disk_usage', () => {
      const message = alertService.getAlertMessage('size_threshold_exceeded', {
        currentSize: '5.2 GB',
        threshold: '5.0 GB'
      });

      expect(message).toContain('Log directory size exceeded threshold');
      expect(message).toContain('5.2 GB');
      expect(message).toContain('5.0 GB');
    });

    test('should return generic message for unknown alert types', () => {
      const message = alertService.getAlertMessage('unknown_alert', {});

      expect(message).toContain('Alert: unknown_alert');
    });
  });

  describe('getDefaultSeverity', () => {
    test('should return correct severity for known alert types', () => {
      expect(alertService.getDefaultSeverity('disk_space_critical')).toBe('critical');
      expect(alertService.getDefaultSeverity('maintenance_service_down')).toBe('critical');
      expect(alertService.getDefaultSeverity('backup_failed')).toBe('warning');
      expect(alertService.getDefaultSeverity('cleanup_failed')).toBe('warning');
      expect(alertService.getDefaultSeverity('stale_backup')).toBe('warning');
    });

    test('should return info for unknown alert types', () => {
      expect(alertService.getDefaultSeverity('unknown_alert')).toBe('info');
    });
  });

  describe('isRateLimited', () => {
    test('should return false when no previous alerts', () => {
      expect(alertService.isRateLimited('backup_failed')).toBe(false);
    });

    test('should return true when under cooldown', () => {
      // Record a recent alert
      alertService.recordAlert('backup_failed');

      // Should be rate limited due to cooldown (15 minutes)
      expect(alertService.isRateLimited('backup_failed')).toBe(true);
    });

    test('should return true when over hourly rate limit', () => {
      // Manually add entries to exceed rate limit
      alertService.alertHistory.set('backup_failed', {
        timestamp: Date.now() - 20 * 60 * 1000, // 20 minutes ago (past cooldown)
        history: Array(11).fill(Date.now() - 10 * 60 * 1000) // 11 alerts in last hour
      });

      expect(alertService.isRateLimited('backup_failed')).toBe(true);
    });

    test('should ignore old alerts outside the time window', () => {
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;

      // Add old alerts that should be ignored
      alertService.alertHistory.set('backup_failed', {
        timestamp: twoHoursAgo,
        history: Array(11).fill(twoHoursAgo)
      });

      expect(alertService.isRateLimited('backup_failed')).toBe(false);
    });
  });

  describe('sendWebhookAlert', () => {
    test('should send webhook with correct payload', async () => {
      axios.post.mockResolvedValue({ status: 200, data: 'OK' });

      const alert = {
        type: 'backup_failed',
        severity: 'error',
        message: 'Test alert message',
        timestamp: '2024-01-01T00:00:00Z',
        service: 'roastr-ai',
        environment: 'test',
        metadata: {
          hostname: 'test-host',
          pid: 12345
        }
      };

      const result = await alertService.sendWebhookAlert(alert);

      expect(axios.post).toHaveBeenCalledWith(
        'https://hooks.slack.com/test-webhook',
        expect.objectContaining({
          text: expect.stringContaining('ROASTR-AI Alert'),
          attachments: expect.arrayContaining([
            expect.objectContaining({
              title: 'Test alert message',
              fields: expect.arrayContaining([
                expect.objectContaining({ title: 'Type', value: 'backup_failed' })
              ])
            })
          ])
        }),
        expect.objectContaining({
          timeout: 10000,
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'Roastr-AI-Alert-Service/1.0' }
        })
      );

      expect(result.status).toBe(200);
    });

    test('should handle webhook timeout', async () => {
      axios.post.mockRejectedValue(new Error('timeout of 10000ms exceeded'));

      const alert = {
        type: 'test',
        message: 'test',
        severity: 'info',
        service: 'test',
        metadata: { hostname: 'test', pid: 1 }
      };

      await expect(alertService.sendWebhookAlert(alert)).rejects.toThrow('timeout');
    });

    test('should throw if webhook URL not configured', async () => {
      alertService.webhookUrl = null;

      const alert = { type: 'test', message: 'test' };

      await expect(alertService.sendWebhookAlert(alert)).rejects.toThrow(
        'Webhook URL not configured'
      );
    });
  });

  describe('buildEmailTemplate', () => {
    test('should build HTML email template', () => {
      const alert = {
        type: 'backup_failed',
        severity: 'error',
        message: 'Backup failed due to S3 timeout',
        timestamp: '2024-01-01T00:00:00Z',
        service: 'roastr-ai',
        environment: 'production',
        data: { error: 'Connection timeout' },
        metadata: {
          hostname: 'prod-server',
          pid: 12345,
          platform: 'linux',
          nodeVersion: 'v18.0.0'
        }
      };

      const html = alertService.buildEmailTemplate(alert);

      expect(html).toContain('ROASTR-AI Alert');
      expect(html).toContain('Backup failed due to S3 timeout');
      expect(html).toContain('backup_failed');
      expect(html).toContain('production');
      expect(html).toContain('Connection timeout');
    });

    test('should handle alerts without data', () => {
      const alert = {
        type: 'test_alert',
        severity: 'info',
        message: 'Test message',
        timestamp: '2024-01-01T00:00:00Z',
        service: 'test',
        environment: 'test',
        metadata: {
          hostname: 'test',
          pid: 1,
          platform: 'test',
          nodeVersion: 'v18'
        }
      };

      const html = alertService.buildEmailTemplate(alert);

      expect(html).toContain('Test message');
      expect(html).not.toContain('undefined');
    });
  });

  describe('getSeverityColor', () => {
    test('should return correct colors for severity levels', () => {
      expect(alertService.getSeverityColor('critical')).toBe('#dc3545');
      expect(alertService.getSeverityColor('warning')).toBe('#ffc107');
      expect(alertService.getSeverityColor('info')).toBe('#17a2b8');
      expect(alertService.getSeverityColor('success')).toBe('#28a745');
    });

    test('should return info color for unknown severity', () => {
      expect(alertService.getSeverityColor('unknown')).toBe('#17a2b8');
    });
  });

  describe('recordAlert', () => {
    test('should record first alert for a type', () => {
      alertService.recordAlert('backup_failed');

      const recorded = alertService.alertHistory.get('backup_failed');
      expect(recorded).toBeDefined();
      expect(recorded.timestamp).toBeDefined();
      expect(recorded.history).toHaveLength(1);
    });

    test('should append to existing alert history', () => {
      alertService.recordAlert('backup_failed');
      alertService.recordAlert('backup_failed');
      alertService.recordAlert('backup_failed');

      const recorded = alertService.alertHistory.get('backup_failed');
      expect(recorded.history).toHaveLength(3);
    });
  });

  describe('clearAlertHistory', () => {
    test('should clear all alert history', () => {
      alertService.recordAlert('backup_failed');
      alertService.recordAlert('cleanup_failed');

      expect(alertService.alertHistory.size).toBe(2);

      alertService.clearAlertHistory();

      expect(alertService.alertHistory.size).toBe(0);
    });
  });

  describe('getAlertStats', () => {
    test('should return stats for recorded alerts', () => {
      alertService.recordAlert('backup_failed');
      alertService.recordAlert('backup_failed');
      alertService.recordAlert('cleanup_failed');

      const stats = alertService.getAlertStats();

      expect(stats.totalAlertTypes).toBe(2);
      expect(stats.alertHistory['backup_failed'].totalAlerts).toBe(2);
      expect(stats.alertHistory['cleanup_failed'].totalAlerts).toBe(1);
    });

    test('should return empty stats when no alerts', () => {
      const stats = alertService.getAlertStats();

      expect(stats.totalAlertTypes).toBe(0);
      expect(stats.alertHistory).toEqual({});
    });
  });

  describe('getRateLimitInfo', () => {
    test('should return info for unknown alert type', () => {
      const info = alertService.getRateLimitInfo('unknown_type');

      expect(info.alertsLastHour).toBe(0);
      expect(info.lastAlertAgo).toBeNull();
      expect(info.isInCooldown).toBe(false);
    });

    test('should return info for recorded alert type', () => {
      alertService.recordAlert('backup_failed');

      const info = alertService.getRateLimitInfo('backup_failed');

      expect(info.alertsLastHour).toBe(1);
      expect(info.isInCooldown).toBe(true);
      expect(info.cooldownRemainingMinutes).toBeGreaterThan(0);
    });
  });
});
