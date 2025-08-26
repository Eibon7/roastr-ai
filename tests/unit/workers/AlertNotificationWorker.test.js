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
    
    test('should handle Slack alert failure', async () => {
      alertingService.sendAlert.mockResolvedValue(false);
      
      const job = {
        id: 'job-123',
        payload: {
          type: 'slack',
          severity: 'warning',
          title: 'Test Alert',
          message: 'This will fail',
          data: {},
          options: {}
        }
      };
      
      await expect(worker.processJob(job)).rejects.toThrow(
        'Alert notification failed: Slack alert failed: AlertingService returned false for Slack alert'
      );
      
      expect(worker.alertsFailed).toBe(1);
      expect(worker.alertTypes.get('slack_failed')).toBe(1);
    });
    
    test('should handle Slack service exception', async () => {
      alertingService.sendAlert.mockRejectedValue(new Error('Network error'));
      
      const job = {
        id: 'job-123',
        payload: {
          type: 'slack',
          severity: 'critical',
          title: 'Test Alert',
          message: 'Network test',
          data: {},
          options: {}
        }
      };
      
      await expect(worker.processJob(job)).rejects.toThrow(
        'Alert notification failed: Slack alert failed: Network error'
      );
      
      expect(worker.alertsFailed).toBe(1);
      expect(worker.alertTypes.get('slack_failed')).toBe(1);
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
    
    test('should throw error for missing type', () => {
      const payload = {
        severity: 'warning',
        title: 'Test',
        message: 'Test message'
      };
      
      expect(() => worker.validateAlertPayload(payload)).toThrow('Alert type is required');
    });
    
    test('should throw error for invalid type', () => {
      const payload = {
        type: 'invalid',
        severity: 'warning',
        title: 'Test',
        message: 'Test message'
      };
      
      expect(() => worker.validateAlertPayload(payload)).toThrow(
        "Invalid alert type: invalid. Must be 'slack' or 'email'"
      );
    });
    
    test('should throw error for missing severity', () => {
      const payload = {
        type: 'slack',
        title: 'Test',
        message: 'Test message'
      };
      
      expect(() => worker.validateAlertPayload(payload)).toThrow('Alert severity is required');
    });
    
    test('should throw error for invalid severity', () => {
      const payload = {
        type: 'slack',
        severity: 'invalid',
        title: 'Test',
        message: 'Test message'
      };
      
      expect(() => worker.validateAlertPayload(payload)).toThrow(
        "Invalid alert severity: invalid. Must be 'critical', 'warning', or 'info'"
      );
    });
    
    test('should throw error for missing or invalid title', () => {
      const payload1 = {
        type: 'slack',
        severity: 'warning',
        message: 'Test message'
      };
      
      expect(() => worker.validateAlertPayload(payload1)).toThrow(
        'Alert title must be a non-empty string'
      );
      
      const payload2 = {
        type: 'slack',
        severity: 'warning',
        title: 123,
        message: 'Test message'
      };
      
      expect(() => worker.validateAlertPayload(payload2)).toThrow(
        'Alert title must be a non-empty string'
      );
    });
    
    test('should throw error for missing or invalid message', () => {
      const payload1 = {
        type: 'slack',
        severity: 'warning',
        title: 'Test Title'
      };
      
      expect(() => worker.validateAlertPayload(payload1)).toThrow(
        'Alert message must be a non-empty string'
      );
      
      const payload2 = {
        type: 'slack',
        severity: 'warning',
        title: 'Test Title',
        message: null
      };
      
      expect(() => worker.validateAlertPayload(payload2)).toThrow(
        'Alert message must be a non-empty string'
      );
    });
    
    test('should throw error for title too long', () => {
      const payload = {
        type: 'slack',
        severity: 'warning',
        title: 'x'.repeat(201), // 201 characters
        message: 'Test message'
      };
      
      expect(() => worker.validateAlertPayload(payload)).toThrow(
        'Alert title must be 200 characters or less'
      );
    });
    
    test('should throw error for message too long', () => {
      const payload = {
        type: 'slack',
        severity: 'warning',
        title: 'Test Title',
        message: 'x'.repeat(2001) // 2001 characters
      };
      
      expect(() => worker.validateAlertPayload(payload)).toThrow(
        'Alert message must be 2000 characters or less'
      );
    });
  });
  
  describe('calculateRetryDelay', () => {
    test('should calculate exponential backoff correctly', () => {
      expect(worker.calculateRetryDelay(1)).toBe(1000); // 1s * 2^0
      expect(worker.calculateRetryDelay(2)).toBe(2000); // 1s * 2^1
      expect(worker.calculateRetryDelay(3)).toBe(4000); // 1s * 2^2
    });
  });
  
  describe('getSpecificHealthDetails', () => {
    test('should return alert-specific health details', async () => {
      worker.alertsSent = 10;
      worker.alertsFailed = 2;
      worker.alertTypes.set('slack_success', 8);
      worker.alertTypes.set('email_success', 2);
      worker.alertTypes.set('slack_failed', 2);
      
      const details = await worker.getSpecificHealthDetails();
      
      expect(details).toEqual({
        alertsSent: 10,
        alertsFailed: 2,
        successRate: '83.33%',
        alertTypeBreakdown: {
          slack_success: 8,
          email_success: 2,
          slack_failed: 2
        },
        alertingServiceStatus: {
          enabled: true,
          hasWebhook: true
        }
      });
    });
    
    test('should handle zero alerts sent', async () => {
      const details = await worker.getSpecificHealthDetails();
      
      expect(details.successRate).toBe('N/A');
    });
  });
  
  describe('getStats', () => {
    test('should return enhanced stats with alert metrics', () => {
      worker.alertsSent = 5;
      worker.alertsFailed = 1;
      worker.alertTypes.set('slack_success', 4);
      worker.alertTypes.set('slack_failed', 1);
      worker.alertTypes.set('email_success', 1);
      
      const stats = worker.getStats();
      
      expect(stats.workerType).toBe('alert_notification');
      expect(stats.alertMetrics).toEqual({
        alertsSent: 5,
        alertsFailed: 1,
        alertTypes: {
          slack_success: 4,
          slack_failed: 1,
          email_success: 1
        },
        successRate: '83.33%'
      });
    });
  });
});