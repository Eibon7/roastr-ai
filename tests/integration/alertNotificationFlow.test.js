const alertingService = require('../../src/services/alertingService');
const AlertNotificationWorker = require('../../src/workers/AlertNotificationWorker');
const QueueService = require('../../src/services/queueService');

// Mock external dependencies
jest.mock('axios');
jest.mock('@supabase/supabase-js');

describe('Alert Notification Flow Integration', () => {
  let queueService;
  let worker;
  let originalWebhookUrl;
  
  beforeAll(() => {
    // Set up test environment
    process.env.ALERT_QUEUE_ENABLED = 'true';
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.slack.com/test-webhook';
    process.env.MONITORING_ENABLED = 'true';
    
    originalWebhookUrl = alertingService.config.webhookUrl;
    alertingService.config.webhookUrl = 'https://hooks.slack.com/test-webhook';
  });
  
  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Initialize services
    queueService = new QueueService();
    worker = new AlertNotificationWorker();
    
    // Mock queue service methods
    queueService.addJob = jest.fn().mockResolvedValue({
      id: 'job-12345',
      job_type: 'alert_notification',
      priority: 1
    });
    
    queueService.getNextJob = jest.fn();
    queueService.completeJob = jest.fn();
    queueService.failJob = jest.fn();
    
    // Mock worker dependencies
    worker.queueService = queueService;
    worker.supabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null })
    };
    
    // Initialize currentJobs for getStats tests
    worker.currentJobs = new Map();
    
    // Inject queue service into alerting service for testing
    alertingService.queueService = queueService;
  });
  
  afterEach(async () => {
    if (worker && worker.isRunning) {
      await worker.stop();
    }
  });
  
  afterAll(() => {
    alertingService.config.webhookUrl = originalWebhookUrl;
  });
  
  describe('Queue-based Alert Processing', () => {
    test('should enqueue alert and process it through worker', async () => {
      // Mock axios for Slack webhook call
      const axios = require('axios');
      axios.post.mockResolvedValue({ status: 200, data: 'ok' });
      
      // Step 1: Enqueue alert via AlertingService
      const enqueueResult = await alertingService.enqueueAlert(
        'critical',
        'Test Critical Alert',
        'This is a test critical alert message',
        { testData: 'value' },
        { organizationId: 'org-123' }
      );
      
      expect(enqueueResult).toBe(true);
      expect(queueService.addJob).toHaveBeenCalledWith(
        'alert_notification',
        {
          organization_id: 'org-123',
          type: 'slack',
          severity: 'critical',
          title: 'Test Critical Alert',
          message: 'This is a test critical alert message',
          data: { testData: 'value' },
          options: {
            organizationId: 'org-123',
            force: true,
            skipRateLimit: true
          },
          lang: 'en'
        },
        {
          priority: 1, // Critical priority
          maxAttempts: 3
        }
      );
      
      // Step 2: Simulate worker processing the job
      const mockJob = {
        id: 'job-12345',
        job_type: 'alert_notification',
        payload: {
          organization_id: 'org-123',
          type: 'slack',
          severity: 'critical',
          title: 'Test Critical Alert',
          message: 'This is a test critical alert message',
          data: { testData: 'value' },
          options: {
            organizationId: 'org-123',
            force: true,
            skipRateLimit: true
          },
          lang: 'en'
        }
      };
      
      const result = await worker.processJob(mockJob);
      
      expect(result).toEqual({
        success: true,
        type: 'slack',
        severity: 'critical',
        sentAt: expect.any(String),
        result: { platform: 'slack', status: 'sent' }
      });
      
      // Verify Slack webhook was called
      expect(axios.post).toHaveBeenCalledWith(
        'https://hooks.slack.com/test-webhook',
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              color: '#FF0000', // Critical alert color
              title: '🚨 Test Critical Alert',
              text: 'This is a test critical alert message'
            })
          ])
        }),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        })
      );
      
      expect(worker.alertsSent).toBe(1);
      expect(worker.alertTypes.get('slack_success')).toBe(1);
    });
    
    test('should handle different alert priorities correctly', async () => {
      // Test critical alert (priority 1)
      await alertingService.enqueueAlert('critical', 'Critical', 'Message');
      expect(queueService.addJob).toHaveBeenLastCalledWith(
        'alert_notification',
        expect.any(Object),
        expect.objectContaining({ priority: 1 })
      );
      
      // Test warning alert (priority 2)
      await alertingService.enqueueAlert('warning', 'Warning', 'Message');
      expect(queueService.addJob).toHaveBeenLastCalledWith(
        'alert_notification',
        expect.any(Object),
        expect.objectContaining({ priority: 2 })
      );
      
      // Test info alert (priority 3)
      await alertingService.enqueueAlert('info', 'Info', 'Message');
      expect(queueService.addJob).toHaveBeenLastCalledWith(
        'alert_notification',
        expect.any(Object),
        expect.objectContaining({ priority: 3 })
      );
    });
    
    test('should fall back to direct sending when queue is unavailable', async () => {
      const axios = require('axios');
      axios.post.mockResolvedValue({ status: 200, data: 'ok' });
      
      // Mock queue service to fail
      queueService.addJob.mockRejectedValue(new Error('Queue unavailable'));
      
      // Also need to ensure alerting service is enabled and has webhook
      const originalEnabled = alertingService.config.enabled;
      const originalWebhookUrl = alertingService.config.webhookUrl;
      
      alertingService.config.enabled = true;
      alertingService.config.webhookUrl = 'https://hooks.slack.com/test-webhook';
      
      try {
        const result = await alertingService.enqueueAlert(
          'warning',
          'Fallback Test',
          'Testing fallback to direct sending',
          { fallback: true }
        );
        
        expect(result).toBe(true);
        
        // Should have tried to enqueue first
        expect(queueService.addJob).toHaveBeenCalled();
        
        // Should have fallen back to direct Slack call
        expect(axios.post).toHaveBeenCalledWith(
          'https://hooks.slack.com/test-webhook',
          expect.objectContaining({
            attachments: expect.arrayContaining([
              expect.objectContaining({
                title: '⚠️ Fallback Test',
                text: 'Testing fallback to direct sending'
              })
            ])
          }),
          expect.any(Object)
        );
      } finally {
        // Restore original config
        alertingService.config.enabled = originalEnabled;
        alertingService.config.webhookUrl = originalWebhookUrl;
      }
    });
    
    test('should handle worker retry logic on failures', async () => {
      // Mock alerting service to throw an error directly
      const originalSendAlert = alertingService.sendAlert;
      alertingService.sendAlert = jest.fn().mockRejectedValue(new Error('Network timeout'));
      
      try {
        const mockJob = {
          id: 'job-retry',
          attempts: 1,
          max_attempts: 3,
          payload: {
            type: 'slack',
            severity: 'warning',
            title: 'Retry Test',
            message: 'This will fail and retry',
            data: {},
            options: {}
          }
        };
        
        await expect(worker.processJob(mockJob)).rejects.toThrow(
          'Alert notification failed: Slack alert failed: Network timeout'
        );
        
        expect(worker.alertsFailed).toBe(1);
        expect(worker.alertTypes.get('slack_failed')).toBe(1);
      } finally {
        // Restore original sendAlert
        alertingService.sendAlert = originalSendAlert;
      }
    });
    
    test('should validate alert payload structure', async () => {
      const invalidJob = {
        id: 'job-invalid',
        payload: {
          // Missing required fields
          type: 'slack'
        }
      };
      
      await expect(worker.processJob(invalidJob)).rejects.toThrow(
        'Alert severity is required'
      );
    });
  });
  
  describe('Health Check Integration', () => {
    test('should enqueue health check alerts', async () => {
      const mockHealthStatus = {
        workers: {
          'fetch_comments': { status: 'error', error: 'Connection failed' },
          'analyze_toxicity': { status: 'healthy' }
        },
        queues: {
          'fetch_comments': { total: 1200 }, // Over critical threshold
          'analyze_toxicity': { total: 50 }
        },
        system: {
          memory: { usage: 95 } // Over critical threshold
        },
        costs: {
          budgetUsagePercentage: 98 // Over critical threshold
        }
      };
      
      await alertingService.checkHealthAndAlert(mockHealthStatus);
      
      // Should have enqueued multiple alerts
      expect(queueService.addJob).toHaveBeenCalledTimes(5); // Worker error + 3 critical alerts
      
      // Verify critical alerts were enqueued with priority 1
      const calls = queueService.addJob.mock.calls;
      calls.forEach(call => {
        const [jobType, payload, options] = call;
        expect(jobType).toBe('alert_notification');
        if (payload.severity === 'critical') {
          expect(options.priority).toBe(1);
        }
      });
    });
  });
  
  describe('Worker Health and Statistics', () => {
    test('should provide detailed health information', async () => {
      worker.alertsSent = 10;
      worker.alertsFailed = 2;
      worker.alertTypes.set('slack_success', 8);
      worker.alertTypes.set('slack_failed', 2);
      
      // Mock worker as running for healthy status
      worker.isRunning = true;
      worker.processedJobs = 10;
      worker.failedJobs = 2;
      worker.lastActivityTime = Date.now();
      
      const health = await worker.healthcheck();
      
      // Health might be 'warning' due to failure rate, so check for not 'unhealthy'
      expect(['healthy', 'warning']).toContain(health.status);
      expect(health.metrics.processedJobs).toBeDefined();
      expect(health.details.alertsSent).toBe(10);
      expect(health.details.alertsFailed).toBe(2);
      expect(health.details.successRate).toBe('83.33%');
    });
    
    test('should provide comprehensive statistics', () => {
      worker.alertsSent = 5;
      worker.alertsFailed = 1;
      worker.alertTypes.set('slack_success', 4);
      worker.alertTypes.set('email_success', 1);
      worker.alertTypes.set('slack_failed', 1);
      
      const stats = worker.getStats();
      
      expect(stats.workerType).toBe('alert_notification');
      expect(stats.alertMetrics).toEqual({
        alertsSent: 5,
        alertsFailed: 1,
        alertTypes: {
          slack_success: 4,
          email_success: 1,
          slack_failed: 1
        },
        successRate: '83.33%'
      });
    });
  });
});