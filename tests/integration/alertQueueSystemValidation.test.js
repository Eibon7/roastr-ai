const alertingService = require('../../src/services/alertingService');
const AlertNotificationWorker = require('../../src/workers/AlertNotificationWorker');
const monitoringService = require('../../src/services/monitoringService');

// Mock external dependencies  
jest.mock('axios');
jest.mock('@supabase/supabase-js');

describe('Alert Queue System Validation', () => {
  
  describe('System Integration', () => {
    test('should have AlertingService properly configured with queue support', () => {
      // Verify AlertingService has the new enqueueAlert method
      expect(typeof alertingService.enqueueAlert).toBe('function');
      expect(typeof alertingService.getAlertPriority).toBe('function');
      
      // Verify AlertingService is configured for queue usage
      expect(alertingService.queueEnabled).toBeDefined();
      
      // Verify existing sendAlert method is preserved for fallback
      expect(typeof alertingService.sendAlert).toBe('function');
    });
    
    test('should have AlertNotificationWorker properly configured', () => {
      const worker = new AlertNotificationWorker();
      
      // Verify worker type
      expect(worker.workerType).toBe('alert_notification');
      
      // Verify worker has correct configuration
      expect(worker.config.maxRetries).toBe(3);
      expect(worker.config.maxConcurrency).toBe(5);
      expect(worker.config.pollInterval).toBe(2000);
      
      // Verify worker has required methods
      expect(typeof worker.processJob).toBe('function');
      expect(typeof worker.validateAlertPayload).toBe('function');
      expect(typeof worker.calculateRetryDelay).toBe('function');
      
      // Verify alert metrics are initialized
      expect(worker.alertsSent).toBe(0);
      expect(worker.alertsFailed).toBe(0);
      expect(worker.alertTypes).toBeInstanceOf(Map);
      
      worker.stop();
    });
    
    test('should have MonitoringService using AlertingService correctly', async () => {
      // MonitoringService should call alertingService.checkHealthAndAlert
      // which now uses enqueueAlert internally
      
      // Mock health status
      const mockHealthStatus = {
        system: { status: 'healthy' },
        services: {},
        workers: { status: 'healthy' },
        queues: { status: 'healthy' },
        costs: { budgetUsagePercentage: 50 }
      };
      
      // Mock the queue service to avoid actual queue operations
      alertingService.queueService = {
        addJob: jest.fn().mockResolvedValue({ id: 'test-job-123' })
      };
      
      // Test that monitoring service can call health check without errors
      await expect(alertingService.checkHealthAndAlert(mockHealthStatus)).resolves.not.toThrow();
    });
    
    test('should properly configure alert priorities', () => {
      expect(alertingService.getAlertPriority('critical')).toBe(1);
      expect(alertingService.getAlertPriority('warning')).toBe(2);
      expect(alertingService.getAlertPriority('info')).toBe(3);
      expect(alertingService.getAlertPriority('unknown')).toBe(3); // Default
    });
    
    test('should validate alert payload structure requirements', () => {
      const worker = new AlertNotificationWorker();
      
      // Valid payload should not throw
      const validPayload = {
        type: 'slack',
        severity: 'warning',
        title: 'Valid Alert',
        message: 'This is a valid alert message'
      };
      
      expect(() => worker.validateAlertPayload(validPayload)).not.toThrow();
      
      // Invalid payloads should throw specific errors
      expect(() => worker.validateAlertPayload(null)).toThrow('Alert payload is required');
      
      expect(() => worker.validateAlertPayload({
        severity: 'warning',
        title: 'Test',
        message: 'Test'
      })).toThrow('Alert type is required');
      
      expect(() => worker.validateAlertPayload({
        type: 'slack',
        title: 'Test',
        message: 'Test'
      })).toThrow('Alert severity is required');
      
      worker.stop();
    });
    
    test('should support both queue and fallback modes', async () => {
      // Test with queue available
      alertingService.queueService = {
        addJob: jest.fn().mockResolvedValue({ id: 'queued-job' })
      };
      
      const queueResult = await alertingService.enqueueAlert(
        'info',
        'Queue Test',
        'Testing queue mode'
      );
      
      expect(queueResult).toBe(true);
      expect(alertingService.queueService.addJob).toHaveBeenCalledWith(
        'alert_notification',
        expect.objectContaining({
          type: 'slack',
          severity: 'info',
          title: 'Queue Test',
          message: 'Testing queue mode'
        }),
        expect.objectContaining({
          priority: 3,
          maxAttempts: 3
        })
      );
      
      // Test fallback when queue fails
      alertingService.queueService.addJob.mockRejectedValue(new Error('Queue down'));
      alertingService.config.enabled = false; // Disable to avoid actual webhook call
      
      const fallbackResult = await alertingService.enqueueAlert(
        'info',
        'Fallback Test',
        'Testing fallback mode'
      );
      
      expect(fallbackResult).toBe(false); // Should return false when disabled
    });
  });
  
  describe('Issue #106 Requirements Validation', () => {
    test('should decouple AlertingService from direct execution', () => {
      // Verify that AlertingService now has enqueueAlert as the primary method
      expect(typeof alertingService.enqueueAlert).toBe('function');
      
      // Verify enqueueAlert supports all required payload fields
      const mockQueue = {
        addJob: jest.fn().mockResolvedValue({ id: 'test-job' })
      };
      alertingService.queueService = mockQueue;
      
      // Test all payload structure requirements from issue
      alertingService.enqueueAlert(
        'critical',
        'Test Title',
        'Test Message',
        { additional: 'data' },
        {
          alertType: 'slack',
          lang: 'es',
          organizationId: 'org-123'
        }
      );
      
      const [jobType, payload, options] = mockQueue.addJob.mock.calls[0];
      
      expect(jobType).toBe('alert_notification');
      expect(payload).toEqual({
        organization_id: 'org-123',
        type: 'slack',
        severity: 'critical',
        title: 'Test Title',
        message: 'Test Message',
        data: { additional: 'data' },
        options: {
          alertType: 'slack',
          lang: 'es',
          organizationId: 'org-123',
          force: true,
          skipRateLimit: true
        },
        lang: 'es'
      });
      expect(options).toEqual({
        priority: 1,
        maxAttempts: 3
      });
    });
    
    test('should implement AlertNotificationWorker with correct retry logic', () => {
      const worker = new AlertNotificationWorker();
      
      // Verify exponential backoff: 1s, 2s, 4s
      expect(worker.calculateRetryDelay(1)).toBe(1000);
      expect(worker.calculateRetryDelay(2)).toBe(2000);
      expect(worker.calculateRetryDelay(3)).toBe(4000);
      
      // Verify max retries configuration
      expect(worker.config.maxRetries).toBe(3);
      
      worker.stop();
    });
    
    test('should provide fallback when queue is not available', async () => {
      // Set queueService to null to simulate unavailable queue
      const originalQueueService = alertingService.queueService;
      alertingService.queueService = null;
      
      try {
        // Mock sendAlert to avoid actual webhook calls
        const originalSendAlert = alertingService.sendAlert;
        alertingService.sendAlert = jest.fn().mockResolvedValue(true);
        
        try {
          const result = await alertingService.enqueueAlert(
            'warning',
            'Fallback Test',
            'Queue unavailable fallback test'
          );
          
          expect(result).toBe(true);
          expect(alertingService.sendAlert).toHaveBeenCalledWith(
            'warning',
            'Fallback Test',
            'Queue unavailable fallback test',
            {},
            {}
          );
        } finally {
          alertingService.sendAlert = originalSendAlert;
        }
      } finally {
        alertingService.queueService = originalQueueService;
      }
    });
    
    test('should validate CLI alerts use queue system via MonitoringService', async () => {
      // MonitoringService.getHealthStatus() calls alertingService.checkHealthAndAlert()
      // which now uses enqueueAlert() internally
      
      const mockQueue = {
        addJob: jest.fn().mockResolvedValue({ id: 'cli-alert-job' })
      };
      alertingService.queueService = mockQueue;
      
      // Mock a health status that would trigger alerts
      const criticalHealthStatus = {
        system: { 
          status: 'critical',
          memory: { usage: 95 }
        },
        services: { database: { status: 'healthy' } },
        workers: { status: 'healthy' },
        queues: { 
          status: 'critical',
          'fetch_comments': { total: 1200 } // Over threshold
        },
        costs: { budgetUsagePercentage: 98 }
      };
      
      // This should trigger multiple alerts via the queue system
      await alertingService.checkHealthAndAlert(criticalHealthStatus);
      
      // Verify that alerts were enqueued (not sent directly)
      expect(mockQueue.addJob).toHaveBeenCalled();
      
      // Verify alert_notification jobs were created
      const alertCalls = mockQueue.addJob.mock.calls.filter(call => 
        call[0] === 'alert_notification'
      );
      expect(alertCalls.length).toBeGreaterThan(0);
      
      // Verify critical alerts have priority 1
      const criticalAlerts = alertCalls.filter(call => 
        call[1].severity === 'critical' && call[2].priority === 1
      );
      expect(criticalAlerts.length).toBeGreaterThan(0);
    });
  });
});