const AlertNotificationWorker = require('../../../src/workers/AlertNotificationWorker');
const alertingService = require('../../../src/services/alertingService');

// Mock the alerting service
jest.mock('../../../src/services/alertingService', () => ({
  sendAlert: jest.fn(),
  config: {
    enabled: true,
    webhookUrl: 'https://hooks.slack.com/test'
  }
}));

// Mock the base worker dependencies
jest.mock('../../../src/services/queueService');
jest.mock('@supabase/supabase-js');

describe('AlertNotificationWorker', () => {
  let worker;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new AlertNotificationWorker({
      maxRetries: 3,
      retryDelay: 1000
    });

    // Mock the queue service
    worker.queueService = {
      initialize: jest.fn(),
      getNextJob: jest.fn(),
      completeJob: jest.fn(),
      failJob: jest.fn(),
      shutdown: jest.fn()
    };

    // Mock supabase
    worker.supabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null })
    };

    // Initialize currentJobs for getStats tests
    worker.currentJobs = new Map();
  });

  afterEach(() => {
    if (worker && worker.isRunning) {
      worker.stop();
    }
  });

  describe('constructor', () => {
    test('should initialize worker with correct type and default config', () => {
      expect(worker.workerType).toBe('alert_notification');
      expect(worker.config.maxRetries).toBe(3);
      expect(worker.config.retryDelay).toBe(1000);
      expect(worker.config.maxConcurrency).toBe(5);
      expect(worker.config.pollInterval).toBe(2000);
    });

    test('should initialize alert metrics', () => {
      expect(worker.alertsSent).toBe(0);
      expect(worker.alertsFailed).toBe(0);
      expect(worker.alertTypes).toBeInstanceOf(Map);
    });
  });

  describe('processJob', () => {
    test('should process valid Slack alert successfully', async () => {
      alertingService.sendAlert.mockResolvedValue(true);

      const job = {
        id: 'job-123',
        payload: {
          type: 'slack',
          severity: 'critical',
          title: 'Test Alert',
          message: 'This is a test alert',
          data: { test: true },
          options: {},
          lang: 'en'
        }
      };

      const result = await worker.processJob(job);

      expect(result).toEqual({
        success: true,
        type: 'slack',
        severity: 'critical',
        sentAt: expect.any(String),
        result: { platform: 'slack', status: 'sent' }
      });

      expect(alertingService.sendAlert).toHaveBeenCalledWith(
        'critical',
        'Test Alert',
        'This is a test alert',
        { test: true },
        {
          force: true,
          skipRateLimit: true
        }
      );

      expect(worker.alertsSent).toBe(1);
      expect(worker.alertTypes.get('slack_success')).toBe(1);
    });

    test('should handle email alerts (not implemented)', async () => {
      const job = {
        id: 'job-123',
        payload: {
          type: 'email',
          severity: 'warning',
          title: 'Email Test',
          message: 'Email alert test',
          data: {},
          options: {},
          lang: 'en'
        }
      };

      const result = await worker.processJob(job);

      expect(result).toEqual({
        success: true,
        type: 'email',
        severity: 'warning',
        sentAt: expect.any(String),
        result: { platform: 'email', status: 'not_implemented' }
      });

      expect(worker.alertsSent).toBe(1);
      expect(worker.alertTypes.get('email_success')).toBe(1);
    });

    test('should throw error for unsupported alert type', async () => {
      const job = {
        id: 'job-123',
        payload: {
          type: 'unsupported',
          severity: 'info',
          title: 'Test',
          message: 'Test message'
        }
      };

      await expect(worker.processJob(job)).rejects.toThrow(
        "Invalid alert type: unsupported. Must be 'slack' or 'email'"
      );

      // Validation errors don't increment metrics since they're thrown before processing
      expect(worker.alertsFailed).toBe(0);
      expect(worker.alertTypes.get('unsupported_failed')).toBeUndefined();
    });
  });

  describe('validateAlertPayload', () => {
    test('should validate valid payload', () => {
      const payload = {
        type: 'slack',
        severity: 'warning',
        title: 'Valid Title',
        message: 'Valid message'
      };

      expect(() => worker.validateAlertPayload(payload)).not.toThrow();
    });

    test('should throw error for missing payload', () => {
      expect(() => worker.validateAlertPayload(null)).toThrow('Alert payload is required');
    });
  });

  describe('calculateRetryDelay', () => {
    test('should calculate exponential backoff correctly', () => {
      expect(worker.calculateRetryDelay(1)).toBe(1000); // 1s * 2^0
      expect(worker.calculateRetryDelay(2)).toBe(2000); // 1s * 2^1
      expect(worker.calculateRetryDelay(3)).toBe(4000); // 1s * 2^2
    });
  });
});
