/**
 * AccountDeletionWorker Tests
 * Issue #928 - Fase 2.2: Tests para Workers Secundarios
 * 
 * Coverage goal: ≥70% (lines, statements, functions, branches)
 */

// ========================================
// MOCKS (BEFORE any imports - CRITICAL)
// ========================================

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  },
  SafeUtils: {
    safeUserIdPrefix: jest.fn((id) => id?.substr(0, 8) + '...')
  }
}));

// Mock DataExportService
const mockDataExportService = {
  exportUserData: jest.fn(),
  anonymizeUserData: jest.fn(),
  deleteUserData: jest.fn()
};

jest.mock('../../../src/services/dataExportService', () => {
  return jest.fn().mockImplementation(() => mockDataExportService);
});

// Mock EmailService
const mockEmailService = {
  sendAccountDeletionCompletedEmail: jest.fn(),
  sendAccountDeletionReminderEmail: jest.fn()
};

jest.mock('../../../src/services/emailService', () => mockEmailService);

// Mock AuditService
const mockAuditService = {
  logGdprAction: jest.fn(),
  logDataExport: jest.fn(),
  logAccountDeletionCompleted: jest.fn()
};

jest.mock('../../../src/services/auditService', () => mockAuditService);

// Helper to create chainable Supabase mocks
// CodeRabbit fix: Use Object.assign with real Promise instead of custom `then`
const createMockChain = (finalResult = { data: [], error: null }) => {
  const basePromise = Promise.resolve(finalResult);
  const chain = Object.assign(basePromise, {});

  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.lt = jest.fn(() => chain);
  chain.gt = jest.fn(() => chain);
  chain.is = jest.fn(() => chain);
  chain.limit = jest.fn(() => chain);
  chain.update = jest.fn(() => chain);
  chain.insert = jest.fn(() => chain);
  chain.delete = jest.fn(() => chain);

  return chain;
};

// Mock Supabase (BEFORE imports - Pattern #11 from coderabbit-lessons)
const mockSupabase = {
  from: jest.fn((tableName) => createMockChain())
};

// Mock @supabase/supabase-js createClient
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));

// Mock mockMode to avoid real Supabase initialization
jest.mock('../../../src/config/mockMode', () => ({
  mockMode: {
    isMockMode: false // Use real initialization path but with our mocks
  }
}));

// Mock QueueService (to avoid real DB connection attempts)
jest.mock('../../../src/services/queueService', () => {
  return jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(),
    getNextJob: jest.fn().mockResolvedValue(null),
    completeJob: jest.fn().mockResolvedValue(),
    failJob: jest.fn().mockResolvedValue(),
    shutdown: jest.fn().mockResolvedValue(),
    addJob: jest.fn().mockResolvedValue({ success: true, jobId: 'mock_job_id' })
  }));
});

// ========================================
// IMPORTS (AFTER mocks)
// ========================================

const AccountDeletionWorker = require('../../../src/workers/AccountDeletionWorker');
const { logger } = require('../../../src/utils/logger');

// ========================================
// TEST SUITE
// ========================================

describe('AccountDeletionWorker', () => {
  let worker;
  let originalEnv;

  beforeAll(() => {
    // Save original env (CodeRabbit fix: clone instead of reference)
    originalEnv = { ...process.env };
    
    // Set required env vars for BaseWorker initialization
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  afterAll(() => {
    // Restore original env (only keys we changed)
    process.env.SUPABASE_URL = originalEnv.SUPABASE_URL;
    process.env.SUPABASE_SERVICE_KEY = originalEnv.SUPABASE_SERVICE_KEY;
  });

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Reset mock implementations to defaults
    mockDataExportService.exportUserData.mockResolvedValue({
      success: true,
      downloadUrl: 'https://example.com/export.zip',
      filename: 'user_data_export.zip',
      size: 1024000,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    mockDataExportService.anonymizeUserData.mockResolvedValue();
    mockDataExportService.deleteUserData.mockResolvedValue();

    mockEmailService.sendAccountDeletionCompletedEmail.mockResolvedValue();
    mockEmailService.sendAccountDeletionReminderEmail.mockResolvedValue();

    mockAuditService.logGdprAction.mockResolvedValue();
    mockAuditService.logDataExport.mockResolvedValue();
    mockAuditService.logAccountDeletionCompleted.mockResolvedValue();

    // Create worker instance
    worker = new AccountDeletionWorker();
  });

  afterEach(() => {
    if (worker && worker.isRunning) {
      worker.isRunning = false;
    }
  });

  // ========================================
  // INITIALIZATION TESTS
  // ========================================

  describe('Initialization', () => {
    test('should initialize with correct config', () => {
      // workerName has timestamp: 'account_deletion-worker-{timestamp}'
      expect(worker.workerName).toMatch(/^account_deletion-worker-\d+$/);
      expect(worker.workerType).toBe('account_deletion');
      expect(worker.config.pollInterval).toBe(5 * 60 * 1000); // 5 minutes
      expect(worker.config.maxConcurrency).toBe(1);
      expect(worker.config.maxRetries).toBe(3);
      expect(worker.config.retryDelay).toBe(30 * 60 * 1000); // 30 minutes
    });

    test('should log initialization', () => {
      expect(logger.info).toHaveBeenCalledWith(
        'AccountDeletionWorker initialized',
        expect.objectContaining({
          workerName: expect.stringMatching(/^account_deletion-worker-\d+$/),
          pollInterval: 5 * 60 * 1000,
          maxConcurrency: 1
        })
      );
    });

    test('should initialize dataExportService', () => {
      expect(worker.dataExportService).toBeDefined();
    });
  });

  // ========================================
  // PROCESS SINGLE DELETION - SUCCESS
  // ========================================

  describe('processSingleDeletion() - Success', () => {
    let deletionRequest;

    beforeEach(() => {
      deletionRequest = {
        id: 'req_123',
        user_id: 'user_456',
        user_email: 'user@example.com',
        user_name: 'Test User',
        data_exported_at: null,
        scheduled_deletion_at: new Date(Date.now() - 1000).toISOString()
      };
    });

    test('should complete full deletion flow successfully', async () => {
      await worker.processSingleDeletion(deletionRequest);

      // Step 1: Log start
      expect(mockAuditService.logGdprAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'account_deletion_processing_started',
          userId: 'user_456',
          actorType: 'system',
          legalBasis: 'gdpr_article_17_right_to_be_forgotten'
        })
      );

      // Step 2: Export user data
      expect(mockDataExportService.exportUserData).toHaveBeenCalledWith('user_456');
      expect(mockAuditService.logDataExport).toHaveBeenCalled();

      // Step 3: Anonymize
      expect(mockDataExportService.anonymizeUserData).toHaveBeenCalledWith('user_456');
      expect(mockAuditService.logGdprAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'personal_data_anonymized'
        })
      );

      // Step 4: Delete
      expect(mockDataExportService.deleteUserData).toHaveBeenCalledWith('user_456');

      // Step 5: Send email
      expect(mockEmailService.sendAccountDeletionCompletedEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.objectContaining({
          userName: 'Test User'
        })
      );

      // Step 6: Log completion
      expect(mockAuditService.logAccountDeletionCompleted).toHaveBeenCalledWith(
        'user_456',
        'req_123',
        expect.objectContaining({
          worker_name: expect.stringMatching(/^account_deletion-worker-\d+$/),
          completion_method: 'automated_worker'
        })
      );

      // Verify stats updated
      expect(worker.processedJobs).toBe(1);
      expect(worker.lastActivityTime).toBeGreaterThan(0);
    });

    test('should skip data export if already exported', async () => {
      deletionRequest.data_exported_at = new Date().toISOString();
      deletionRequest.data_export_url = 'https://example.com/export.zip';

      await worker.processSingleDeletion(deletionRequest);

      // Should NOT call exportUserData
      expect(mockDataExportService.exportUserData).not.toHaveBeenCalled();
      expect(mockAuditService.logDataExport).not.toHaveBeenCalled();

      // But should still anonymize and delete
      expect(mockDataExportService.anonymizeUserData).toHaveBeenCalled();
      expect(mockDataExportService.deleteUserData).toHaveBeenCalled();
    });

    test('should continue if email notification fails', async () => {
      mockEmailService.sendAccountDeletionCompletedEmail.mockRejectedValue(
        new Error('Email service unavailable')
      );

      await worker.processSingleDeletion(deletionRequest);

      // Should log warning
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to send deletion completion email',
        expect.objectContaining({
          requestId: 'req_123',
          userEmail: 'user@example.com'
        })
      );

      // But deletion should still complete
      expect(mockAuditService.logAccountDeletionCompleted).toHaveBeenCalled();
      expect(worker.processedJobs).toBe(1);
    });
  });

  // ========================================
  // PROCESS SINGLE DELETION - ERROR HANDLING
  // ========================================

  describe('processSingleDeletion() - Error Handling', () => {
    let deletionRequest;

    beforeEach(() => {
      deletionRequest = {
        id: 'req_789',
        user_id: 'user_abc',
        user_email: 'user2@example.com',
        user_name: 'Test User 2',
        data_exported_at: null
      };
    });

    test('should handle data export failure gracefully', async () => {
      mockDataExportService.exportUserData.mockRejectedValue(
        new Error('Export service failed')
      );

      await expect(worker.processSingleDeletion(deletionRequest)).rejects.toThrow(
        'Export service failed'
      );

      // Should log error
      expect(logger.error).toHaveBeenCalledWith(
        'Account deletion processing failed',
        expect.objectContaining({
          requestId: 'req_789',
          error: 'Export service failed'
        })
      );
    });

    test('should handle anonymization failure', async () => {
      mockDataExportService.anonymizeUserData.mockRejectedValue(
        new Error('Anonymization failed')
      );

      await expect(worker.processSingleDeletion(deletionRequest)).rejects.toThrow(
        'Anonymization failed'
      );

      expect(logger.error).toHaveBeenCalled();
    });

    test('should handle deletion failure', async () => {
      mockDataExportService.deleteUserData.mockRejectedValue(
        new Error('Deletion failed')
      );

      await expect(worker.processSingleDeletion(deletionRequest)).rejects.toThrow(
        'Deletion failed'
      );

      expect(logger.error).toHaveBeenCalled();
    });

    test('should handle Supabase update failure', async () => {
      // Mock Supabase to return error on update
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({
            data: null,
            error: new Error('Database error')
          }))
        }))
      });

      await expect(worker.processSingleDeletion(deletionRequest)).rejects.toThrow('Database error');
    });
  });

  // ========================================
  // PROCESS PENDING DELETIONS
  // ========================================

  describe('processPendingDeletions()', () => {
    beforeEach(() => {
      // Worker must be running to process deletions
      worker.isRunning = true;
    });

    test('should process no deletions if none pending', async () => {
      // Mock returns empty array
      mockSupabase.from.mockReturnValueOnce(
        createMockChain({ data: [], error: null })
      );

      await worker.processPendingDeletions();

      // Should not process any
      expect(logger.info).not.toHaveBeenCalledWith(
        'Found pending deletions to process',
        expect.any(Object)
      );
    });

    test('should process multiple pending deletions', async () => {
      const pendingDeletions = [
        {
          id: 'req_1',
          user_id: 'user_1',
          user_email: 'user1@example.com',
          user_name: 'User 1',
          data_exported_at: new Date().toISOString(), // Already exported
          data_export_url: 'https://example.com/export1.zip',
          scheduled_deletion_at: new Date(Date.now() - 1000).toISOString()
        },
        {
          id: 'req_2',
          user_id: 'user_2',
          user_email: 'user2@example.com',
          user_name: 'User 2',
          data_exported_at: new Date().toISOString(), // Already exported
          data_export_url: 'https://example.com/export2.zip',
          scheduled_deletion_at: new Date(Date.now() - 2000).toISOString()
        }
      ];

      // Mock: First call returns pending deletions, all subsequent calls return success
      mockSupabase.from.mockReturnValue(createMockChain({ data: [], error: null }));
      mockSupabase.from.mockReturnValueOnce(createMockChain({ data: pendingDeletions, error: null }));

      await worker.processPendingDeletions();

      // Should log finding deletions
      expect(logger.info).toHaveBeenCalledWith(
        'Found pending deletions to process',
        expect.objectContaining({ count: 2 })
      );

      // Should process both
      expect(worker.processedJobs).toBe(2);
    });

    test('should handle failure for one deletion but continue with others', async () => {
      const pendingDeletions = [
        {
          id: 'req_fail',
          user_id: 'user_fail',
          user_email: 'fail@example.com',
          user_name: 'Fail User',
          data_exported_at: new Date().toISOString(), // Already exported
          data_export_url: 'https://example.com/export_fail.zip'
        },
        {
          id: 'req_success',
          user_id: 'user_success',
          user_email: 'success@example.com',
          user_name: 'Success User',
          data_exported_at: new Date().toISOString(), // Already exported
          data_export_url: 'https://example.com/export_success.zip'
        }
      ];

      // Mock: First call returns pending deletions
      mockSupabase.from.mockReturnValue(createMockChain({ data: [], error: null }));
      mockSupabase.from.mockReturnValueOnce(createMockChain({ data: pendingDeletions, error: null }));

      // First deletion fails at anonymization, second succeeds
      let callCount = 0;
      mockDataExportService.anonymizeUserData.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Anonymization failed'));
        }
        return Promise.resolve();
      });

      await worker.processPendingDeletions();

      // Should log error for first
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to process single deletion',
        expect.objectContaining({
          deletionRequestId: 'req_fail'
        })
      );

      // Should still process second successfully
      expect(worker.processedJobs).toBe(1);
      expect(worker.failedJobs).toBe(1);
    });
  });

  // ========================================
  // REMINDER NOTIFICATIONS
  // ========================================

  describe('sendReminderNotifications()', () => {
    beforeEach(() => {
      // Worker must be running to send reminders
      worker.isRunning = true;
    });

    test('should send reminders for upcoming deletions', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2); // 2 days from now

      const upcomingDeletions = [
        {
          id: 'req_remind',
          user_email: 'remind@example.com',
          user_name: 'Remind User',
          scheduled_deletion_at: futureDate.toISOString(),
          reminder_sent_at: null,
          data_export_url: null
        }
      ];

      // Mock: First call returns upcoming deletions, all subsequent calls return success
      mockSupabase.from.mockReturnValue(createMockChain({ data: [], error: null }));
      mockSupabase.from.mockReturnValueOnce(createMockChain({ data: upcomingDeletions, error: null }));

      await worker.sendReminderNotifications();

      // Should send email
      expect(mockEmailService.sendAccountDeletionReminderEmail).toHaveBeenCalledWith(
        'remind@example.com',
        expect.objectContaining({
          userName: 'Remind User',
          daysUntilDeletion: expect.any(Number)
        })
      );

      // Should log success
      expect(logger.info).toHaveBeenCalledWith(
        'Deletion reminder sent',
        expect.objectContaining({
          requestId: 'req_remind',
          userEmail: 'remind@example.com'
        })
      );
    });

    test('should handle no upcoming deletions gracefully', async () => {
      mockSupabase.from.mockReturnValueOnce(
        createMockChain({ data: [], error: null })
      );

      await worker.sendReminderNotifications();

      // Should not send any emails
      expect(mockEmailService.sendAccountDeletionReminderEmail).not.toHaveBeenCalled();
    });

    test('should continue if reminder email fails', async () => {
      const upcomingDeletions = [
        {
          id: 'req_fail',
          user_email: 'fail@example.com',
          user_name: 'Fail User',
          scheduled_deletion_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          reminder_sent_at: null,
          data_export_url: null
        }
      ];

      // Mock: First call returns upcoming deletions
      mockSupabase.from.mockReturnValue(createMockChain({ data: [], error: null }));
      mockSupabase.from.mockReturnValueOnce(createMockChain({ data: upcomingDeletions, error: null }));

      mockEmailService.sendAccountDeletionReminderEmail.mockRejectedValueOnce(
        new Error('Email failed')
      );

      await worker.sendReminderNotifications();

      // Should log warning
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to send deletion reminder',
        expect.objectContaining({
          requestId: 'req_fail',
          error: 'Email failed'
        })
      );
    });
  });

  // ========================================
  // HANDLE DELETION FAILURE
  // ========================================

  describe('handleDeletionFailure()', () => {
    test('should log failure and update audit trail', async () => {
      const deletionRequest = {
        id: 'req_fail',
        user_id: 'user_fail',
        user_email: 'fail@example.com'
      };

      const error = new Error('Permanent failure');

      await worker.handleDeletionFailure(deletionRequest, error);

      // Should increment failed jobs
      expect(worker.failedJobs).toBe(1);

      // Should log to audit
      expect(mockAuditService.logGdprAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'account_deletion_failed',
          userId: 'user_fail',
          resourceId: 'req_fail',
          details: expect.objectContaining({
            error_message: 'Permanent failure'
          })
        })
      );

      // Should log error
      expect(logger.error).toHaveBeenCalledWith(
        'Deletion processing failed permanently',
        expect.objectContaining({
          requestId: 'req_fail',
          error: 'Permanent failure'
        })
      );
    });

    test('should handle audit log failure gracefully', async () => {
      const deletionRequest = {
        id: 'req_audit_fail',
        user_id: 'user_audit_fail',
        user_email: 'audit@example.com'
      };

      mockAuditService.logGdprAction.mockRejectedValue(
        new Error('Audit service failed')
      );

      await worker.handleDeletionFailure(deletionRequest, new Error('Original error'));

      // Should log audit failure
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to log deletion failure',
        expect.objectContaining({
          originalError: 'Original error',
          auditError: 'Audit service failed'
        })
      );
    });
  });

  // ========================================
  // WORKER LIFECYCLE
  // ========================================

  describe('Worker Lifecycle', () => {
    test('should start worker', async () => {
      jest.spyOn(worker, 'processingLoop').mockImplementation(() => Promise.resolve());

      await worker.start();

      expect(worker.isRunning).toBe(true);
      expect(worker.startTime).toBeGreaterThan(0);
      expect(logger.info).toHaveBeenCalledWith(
        'Starting AccountDeletionWorker',
        expect.any(Object)
      );
    });

    test('should stop worker gracefully', async () => {
      worker.isRunning = true;
      worker.startTime = Date.now();
      worker.processedJobs = 10;
      worker.failedJobs = 2;

      await worker.stop();

      expect(worker.isRunning).toBe(false);
      expect(logger.info).toHaveBeenCalledWith(
        'AccountDeletionWorker stopped',
        expect.objectContaining({
          finalStats: expect.any(Object)
        })
      );
    });

    test('should get worker status', () => {
      worker.startTime = Date.now() - 60000; // 1 minute ago
      worker.processedJobs = 5;
      worker.failedJobs = 1;
      worker.lastActivityTime = Date.now() - 30000; // 30 seconds ago

      const status = worker.getStatus();

      expect(status).toMatchObject({
        workerName: expect.stringMatching(/^account_deletion-worker-\d+$/),
        workerType: 'account_deletion',
        isRunning: false,
        processedJobs: 5,
        failedJobs: 1
      });

      expect(status.successRate).toBe('83.33%');
      expect(status.uptime).toBeGreaterThan(0);
      expect(status.uptimeFormatted).toBeTruthy();
    });
  });

  // ========================================
  // UPDATE DELETION STATUS
  // ========================================

  describe('updateDeletionStatus()', () => {
    test('should update status to processing', async () => {
      await expect(worker.updateDeletionStatus('req_123', 'processing')).resolves.not.toThrow();
      expect(mockSupabase.from).toHaveBeenCalledWith('account_deletion_requests');
    });

    test('should update status to completed with timestamp', async () => {
      await expect(worker.updateDeletionStatus('req_456', 'completed')).resolves.not.toThrow();
      expect(mockSupabase.from).toHaveBeenCalledWith('account_deletion_requests');
    });

    test('should handle update failure', async () => {
      mockSupabase.from.mockReturnValueOnce(
        createMockChain({ data: null, error: new Error('Update failed') })
      );

      await expect(
        worker.updateDeletionStatus('req_fail', 'completed')
      ).rejects.toThrow('Update failed');
    });
  });

  // ========================================
  // UTILITY METHODS
  // ========================================

  describe('Utility Methods', () => {
    test('should sleep for specified duration', async () => {
      const startTime = Date.now();
      await worker.sleep(100);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    test('should format duration correctly', () => {
      expect(worker.formatDuration(1000)).toBe('1s');
      expect(worker.formatDuration(60000)).toBe('1m 0s');
      expect(worker.formatDuration(3600000)).toBe('1h 0m');
      expect(worker.formatDuration(86400000 + 3600000 + 60000)).toBe('1d 1h 1m');
    });

    test('should record processing time', () => {
      worker.recordProcessingTime(1000);
      worker.recordProcessingTime(2000);
      worker.recordProcessingTime(3000);

      expect(worker.processingTimes).toContain(1000);
      expect(worker.processingTimes).toContain(2000);
      expect(worker.processingTimes).toContain(3000);
    });
  });
});

