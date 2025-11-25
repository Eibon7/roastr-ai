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

const axios = require('axios');
const AlertService = require('../../../src/services/alertService');

// Mock dependencies
jest.mock('axios');
jest.mock('../../../src/utils/advancedLogger', () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

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
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.clearAllMocks();
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
      // Fill up the rate limit
      for (let i = 0; i < 10; i++) {
        alertService.alertHistory.set(`backup_failed_${Date.now() + i}`, {
          timestamp: Date.now(),
          type: 'backup_failed'
        });
      }

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
        severity: 'error',
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
          severity: 'warning'
        }
      );

      expect(alert.severity).toBe('warning');
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
      const message = alertService.getAlertMessage('high_disk_usage', {
        currentSize: '5.2 GB',
        threshold: '5.0 GB'
      });

      expect(message).toContain('High disk usage detected');
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
      expect(alertService.getDefaultSeverity('backup_failed')).toBe('error');
      expect(alertService.getDefaultSeverity('cleanup_failed')).toBe('error');
      expect(alertService.getDefaultSeverity('high_disk_usage')).toBe('warning');
      expect(alertService.getDefaultSeverity('backup_success')).toBe('info');
    });

    test('should return warning for unknown alert types', () => {
      expect(alertService.getDefaultSeverity('unknown_alert')).toBe('warning');
    });
  });

  describe('isRateLimited', () => {
    test('should return false when under rate limit', () => {
      // Add only 5 alerts in the last hour
      for (let i = 0; i < 5; i++) {
        alertService.alertHistory.set(`backup_failed_${i}`, {
          timestamp: Date.now(),
          type: 'backup_failed'
        });
      }

      expect(alertService.isRateLimited('backup_failed')).toBe(false);
    });

    test('should return true when over rate limit', () => {
      // Add 11 alerts in the last hour (over the limit of 10)
      for (let i = 0; i < 11; i++) {
        alertService.alertHistory.set(`backup_failed_${i}`, {
          timestamp: Date.now(),
          type: 'backup_failed'
        });
      }

      expect(alertService.isRateLimited('backup_failed')).toBe(true);
    });

    test('should ignore old alerts outside the time window', () => {
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;

      // Add 11 old alerts (should be ignored)
      for (let i = 0; i < 11; i++) {
        alertService.alertHistory.set(`old_alert_${i}`, {
          timestamp: twoHoursAgo,
          type: 'backup_failed'
        });
      }

      // Add 5 recent alerts (should count)
      for (let i = 0; i < 5; i++) {
        alertService.alertHistory.set(`recent_alert_${i}`, {
          timestamp: Date.now(),
          type: 'backup_failed'
        });
      }

      expect(alertService.isRateLimited('backup_failed')).toBe(false);
    });

    test('should check cooldown period for same alert type', () => {
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

      alertService.alertHistory.set('recent_backup_failed', {
        timestamp: tenMinutesAgo,
        type: 'backup_failed'
      });

      // Should be rate limited due to cooldown (15 minutes)
      expect(alertService.isRateLimited('backup_failed')).toBe(true);
    });
  });

  describe('sendWebhookAlert', () => {
    test('should send webhook with correct payload', async () => {
      axios.post.mockResolvedValue({ status: 200, data: 'OK' });

      const alert = {
        type: 'backup_failed',
        severity: 'error',
        message: 'Test alert message',
        timestamp: '2024-01-01T00:00:00Z'
      };

      const result = await alertService.sendWebhookAlert(alert);

      expect(axios.post).toHaveBeenCalledWith(
        'https://hooks.slack.com/test-webhook',
        expect.objectContaining({
          text: expect.stringContaining('🚨 ROASTR-AI Alert'),
          attachments: expect.arrayContaining([
            expect.objectContaining({
              color: 'danger',
              title: 'backup_failed',
              text: 'Test alert message'
            })
          ])
        }),
        expect.objectContaining({
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      expect(result.status).toBe(200);
    });

    test('should handle webhook timeout', async () => {
      axios.post.mockRejectedValue(new Error('timeout of 10000ms exceeded'));

      const alert = { type: 'test', message: 'test' };

      await expect(alertService.sendWebhookAlert(alert)).rejects.toThrow('timeout');
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
        data: { error: 'Connection timeout' }
      };

      const html = alertService.buildEmailTemplate(alert);

      expect(html).toContain('🚨 Alert: backup_failed');
      expect(html).toContain('Backup failed due to S3 timeout');
      expect(html).toContain('2024-01-01T00:00:00Z');
      expect(html).toContain('roastr-ai');
      expect(html).toContain('production');
      expect(html).toContain('Connection timeout');
    });

    test('should handle alerts without data', () => {
      const alert = {
        type: 'test_alert',
        severity: 'info',
        message: 'Test message',
        timestamp: '2024-01-01T00:00:00Z'
      };

      const html = alertService.buildEmailTemplate(alert);

      expect(html).toContain('Test message');
      expect(html).not.toContain('undefined');
    });
  });
});
