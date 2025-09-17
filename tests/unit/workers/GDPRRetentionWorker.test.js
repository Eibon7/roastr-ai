/**
 * Unit Tests for GDPR Retention Worker
 * 
 * Tests GDPR-compliant data retention operations:
 * - Anonymization of text at 80 days
 * - Purging of data at 90 days
 * - Cleanup of old offender profiles
 */

const GDPRRetentionWorker = require('../../../src/workers/GDPRRetentionWorker');

// Mock crypto for consistent testing
jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => Buffer.from('mockedsalt123456', 'ascii')),
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mocked_hash_value_1234567890abcdef')
  }))
}));

// Mock Supabase
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  rpc: jest.fn()
};

describe('GDPRRetentionWorker', () => {
  let worker;
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = {
      batchSize: 100,
      dryRun: false,
      supabase: mockSupabase
    };

    worker = new GDPRRetentionWorker(mockConfig);
    worker.supabase = mockSupabase; // Ensure mock is attached
  });

  describe('constructor', () => {
    test('should initialize with correct worker type and configuration', () => {
      expect(worker.workerType).toBe('gdpr_retention');
      expect(worker.batchSize).toBe(100);
      expect(worker.dryRun).toBe(false);
      expect(worker.stats.totalProcessed).toBe(0);
      expect(worker.stats.anonymized).toBe(0);
      expect(worker.stats.purged).toBe(0);
      expect(worker.stats.cleaned).toBe(0);
      expect(worker.stats.errors).toBe(0);
    });

    test('should use default configuration when not provided', () => {
      const defaultWorker = new GDPRRetentionWorker();
      expect(defaultWorker.batchSize).toBe(1000);
      expect(defaultWorker.dryRun).toBe(false);
    });

    test('should enable dry run mode when configured', () => {
      const dryRunWorker = new GDPRRetentionWorker({ dryRun: true });
      expect(dryRunWorker.dryRun).toBe(true);
    });
  });

  describe('getSpecificHealthDetails', () => {
    test('should return comprehensive health information', async () => {
      // Mock pending records count
      mockSupabase.select.mockResolvedValue({ count: 50 });
      
      const healthDetails = await worker.getSpecificHealthDetails();

      expect(healthDetails.gdprRetention).toBeDefined();
      expect(healthDetails.gdprRetention.totalProcessed).toBe(0);
      expect(healthDetails.gdprRetention.batchSize).toBe(100);
      expect(healthDetails.gdprRetention.dryRun).toBe(false);
      expect(healthDetails.gdprRetention.nextScheduledRun).toBeDefined();
      expect(healthDetails.gdprRetention.pendingRecords).toBeDefined();
    });
  });

  describe('processJob', () => {
    test('should process anonymize operation successfully', async () => {
      const job = {
        payload: {
          operation: 'anonymize',
          batchId: 'batch-123'
        }
      };

      // Mock anonymizeOldRecords method
      jest.spyOn(worker, 'anonymizeOldRecords').mockResolvedValue({
        processed: 10,
        anonymized: 8,
        errors: 2
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('anonymize');
      expect(result.processed).toBe(10);
      expect(result.anonymized).toBe(8);
      expect(result.errors).toBe(2);
      expect(worker.anonymizeOldRecords).toHaveBeenCalledWith('batch-123');
    });

    test('should process purge operation successfully', async () => {
      const job = {
        payload: {
          operation: 'purge',
          batchId: 'batch-456'
        }
      };

      jest.spyOn(worker, 'purgeOldRecords').mockResolvedValue({
        processed: 'unknown',
        purged: 'completed',
        errors: 0
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('purge');
      expect(result.purged).toBe('completed');
    });

    test('should process cleanup operation successfully', async () => {
      const job = {
        payload: {
          operation: 'cleanup',
          batchId: 'batch-789'
        }
      };

      jest.spyOn(worker, 'cleanupOldProfiles').mockResolvedValue({
        cleaned: 25,
        errors: 0
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('cleanup');
      expect(result.cleaned).toBe(25);
    });

    test('should process full retention cycle', async () => {
      const job = {
        payload: {
          operation: 'full_retention',
          batchId: 'batch-full'
        }
      };

      jest.spyOn(worker, 'runFullRetentionCycle').mockResolvedValue({
        fullCycle: true,
        anonymize: { processed: 10, anonymized: 10, errors: 0 },
        purge: { processed: 'unknown', purged: 'completed', errors: 0 },
        cleanup: { cleaned: 5, errors: 0 },
        totalErrors: 0
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.fullCycle).toBe(true);
      expect(result.totalErrors).toBe(0);
    });

    test('should handle unknown operation error', async () => {
      const job = {
        payload: {
          operation: 'unknown_operation',
          batchId: 'batch-error'
        }
      };

      await expect(worker.processJob(job)).rejects.toThrow('Unknown GDPR retention operation: unknown_operation');
      expect(worker.stats.errors).toBe(1);
    });

    test('should handle processing errors and log them', async () => {
      const job = {
        payload: {
          operation: 'anonymize',
          batchId: 'batch-error'
        }
      };

      const processingError = new Error('Database connection failed');
      jest.spyOn(worker, 'anonymizeOldRecords').mockRejectedValue(processingError);
      jest.spyOn(worker, 'logRetentionOperation').mockResolvedValue();

      await expect(worker.processJob(job)).rejects.toThrow('Database connection failed');
      expect(worker.stats.errors).toBe(1);
      expect(worker.logRetentionOperation).toHaveBeenCalledWith({
        operation_type: 'anonymize',
        operation_status: 'failed',
        batch_id: 'batch-error',
        error_message: 'Database connection failed',
        error_details: { stack: expect.any(String) },
        processing_time_ms: expect.any(Number)
      });
    });
  });

  describe('anonymizeOldRecords', () => {
    test('should anonymize old records successfully', async () => {
      const mockOldRecords = [
        {
          id: 'event-1',
          original_text: 'Toxic comment 1',
          created_at: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'event-2',
          original_text: 'Toxic comment 2',
          created_at: new Date(Date.now() - 82 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      // Mock select query for old records
      mockSupabase.select.mockResolvedValue({
        data: mockOldRecords,
        error: null
      });

      // Mock update operations
      mockSupabase.update.mockResolvedValue({
        error: null
      });

      // Mock logging operation
      jest.spyOn(worker, 'logRetentionOperation').mockResolvedValue();

      const result = await worker.anonymizeOldRecords('batch-123');

      expect(result.processed).toBe(2);
      expect(result.anonymized).toBe(2);
      expect(result.errors).toBe(0);
      
      // Verify anonymization was called for each record
      expect(mockSupabase.update).toHaveBeenCalledTimes(2);
      expect(mockSupabase.update).toHaveBeenCalledWith({
        original_text: null,
        original_text_hash: 'mocked_hash_value_1234567890abcdef',
        text_salt: 'mockedsalt123456',
        anonymized_at: expect.any(String)
      });

      expect(worker.logRetentionOperation).toHaveBeenCalledWith({
        operation_type: 'anonymize',
        operation_status: 'success',
        batch_id: 'batch-123',
        records_processed: 2,
        records_anonymized: 2,
        records_failed: 0,
        metadata: { cutoff_date: expect.any(String) }
      });
    });

    test('should handle no records to anonymize', async () => {
      mockSupabase.select.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await worker.anonymizeOldRecords('batch-empty');

      expect(result.processed).toBe(0);
      expect(result.anonymized).toBe(0);
      expect(result.errors).toBe(0);
    });

    test('should handle anonymization errors gracefully', async () => {
      const mockOldRecords = [
        {
          id: 'event-1',
          original_text: 'Toxic comment 1',
          created_at: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'event-2',
          original_text: 'Toxic comment 2',
          created_at: new Date(Date.now() - 82 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      mockSupabase.select.mockResolvedValue({
        data: mockOldRecords,
        error: null
      });

      // First update succeeds, second fails
      mockSupabase.update
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: new Error('Update failed') });

      jest.spyOn(worker, 'logRetentionOperation').mockResolvedValue();

      const result = await worker.anonymizeOldRecords('batch-partial');

      expect(result.processed).toBe(2);
      expect(result.anonymized).toBe(1);
      expect(result.errors).toBe(1);
      
      expect(worker.logRetentionOperation).toHaveBeenCalledWith({
        operation_type: 'anonymize',
        operation_status: 'partial',
        batch_id: 'batch-partial',
        records_processed: 2,
        records_anonymized: 1,
        records_failed: 1,
        metadata: { cutoff_date: expect.any(String) }
      });
    });

    test('should handle dry run mode', async () => {
      worker.dryRun = true;

      const mockOldRecords = [
        {
          id: 'event-1',
          original_text: 'Toxic comment 1',
          created_at: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      mockSupabase.select.mockResolvedValue({
        data: mockOldRecords,
        error: null
      });

      jest.spyOn(worker, 'logRetentionOperation').mockResolvedValue();

      const result = await worker.anonymizeOldRecords('batch-dry');

      expect(result.processed).toBe(1);
      expect(result.anonymized).toBe(1);
      expect(result.errors).toBe(0);
      
      // Verify no actual updates were made
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });
  });

  describe('purgeOldRecords', () => {
    test('should purge old records successfully', async () => {
      mockSupabase.delete.mockResolvedValue({
        error: null
      });

      jest.spyOn(worker, 'logRetentionOperation').mockResolvedValue();

      const result = await worker.purgeOldRecords('batch-purge');

      expect(result.purged).toBe('completed');
      expect(result.errors).toBe(0);
      
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.lt).toHaveBeenCalledWith('created_at', expect.any(String));
      
      expect(worker.logRetentionOperation).toHaveBeenCalledWith({
        operation_type: 'purge',
        operation_status: 'success',
        batch_id: 'batch-purge',
        metadata: { cutoff_date: expect.any(String) }
      });
    });

    test('should handle purge errors', async () => {
      const purgeError = new Error('Purge operation failed');
      mockSupabase.delete.mockResolvedValue({
        error: purgeError
      });

      await expect(worker.purgeOldRecords('batch-error')).rejects.toThrow('Purge operation failed');
    });

    test('should handle dry run for purge', async () => {
      worker.dryRun = true;

      mockSupabase.select.mockResolvedValue({
        count: 150,
        error: null
      });

      const result = await worker.purgeOldRecords('batch-dry-purge');

      expect(result.processed).toBe(150);
      expect(result.purged).toBe(150);
      expect(result.errors).toBe(0);
      
      // Verify no actual deletes were made
      expect(mockSupabase.delete).not.toHaveBeenCalled();
    });
  });

  describe('cleanupOldProfiles', () => {
    test('should cleanup old offender profiles successfully', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 25,
        error: null
      });

      const result = await worker.cleanupOldProfiles('batch-cleanup');

      expect(result.cleaned).toBe(25);
      expect(result.errors).toBe(0);
      expect(worker.stats.cleaned).toBe(25);
      
      expect(mockSupabase.rpc).toHaveBeenCalledWith('cleanup_old_offender_profiles');
    });

    test('should handle cleanup errors', async () => {
      const cleanupError = new Error('RPC function failed');
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: cleanupError
      });

      await expect(worker.cleanupOldProfiles('batch-error')).rejects.toThrow('RPC function failed');
    });

    test('should handle dry run for cleanup', async () => {
      worker.dryRun = true;

      const result = await worker.cleanupOldProfiles('batch-dry-cleanup');

      expect(result.cleaned).toBe('dry_run');
      expect(result.errors).toBe(0);
      
      // Verify no actual RPC was called
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe('runFullRetentionCycle', () => {
    test('should execute full retention cycle successfully', async () => {
      jest.spyOn(worker, 'anonymizeOldRecords').mockResolvedValue({
        processed: 10, anonymized: 8, errors: 2
      });
      jest.spyOn(worker, 'purgeOldRecords').mockResolvedValue({
        processed: 'unknown', purged: 'completed', errors: 0
      });
      jest.spyOn(worker, 'cleanupOldProfiles').mockResolvedValue({
        cleaned: 5, errors: 0
      });

      const result = await worker.runFullRetentionCycle('batch-full');

      expect(result.fullCycle).toBe(true);
      expect(result.anonymize.processed).toBe(10);
      expect(result.anonymize.anonymized).toBe(8);
      expect(result.anonymize.errors).toBe(2);
      expect(result.purge.purged).toBe('completed');
      expect(result.cleanup.cleaned).toBe(5);
      expect(result.totalErrors).toBe(2);
    });

    test('should handle errors in full retention cycle', async () => {
      jest.spyOn(worker, 'anonymizeOldRecords').mockRejectedValue(new Error('Anonymization failed'));

      await expect(worker.runFullRetentionCycle('batch-error')).rejects.toThrow('Anonymization failed');
    });
  });

  describe('logRetentionOperation', () => {
    test('should log retention operation successfully', async () => {
      mockSupabase.insert.mockResolvedValue({
        error: null
      });

      const logData = {
        operation_type: 'anonymize',
        operation_status: 'success',
        batch_id: 'batch-123',
        records_processed: 10
      };

      await worker.logRetentionOperation(logData);

      expect(mockSupabase.from).toHaveBeenCalledWith('shield_retention_log');
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        ...logData,
        completed_at: expect.any(String),
        processing_time_ms: 0
      });
    });

    test('should handle logging errors gracefully', async () => {
      const logError = new Error('Logging failed');
      mockSupabase.insert.mockResolvedValue({
        error: logError
      });

      const logData = {
        operation_type: 'purge',
        operation_status: 'success'
      };

      // Should not throw, just log the error
      await expect(worker.logRetentionOperation(logData)).resolves.toBeUndefined();
    });
  });

  describe('getPendingRecordsCounts', () => {
    test('should return counts of pending operations', async () => {
      // Mock counts for different operations
      mockSupabase.select
        .mockResolvedValueOnce({ count: 25 }) // anonymization
        .mockResolvedValueOnce({ count: 10 }) // purge
        .mockResolvedValueOnce({ count: 5 });  // cleanup

      const counts = await worker.getPendingRecordsCounts();

      expect(counts.needingAnonymization).toBe(25);
      expect(counts.needingPurge).toBe(10);
      expect(counts.needingCleanup).toBe(5);
    });

    test('should handle errors in count queries', async () => {
      mockSupabase.select.mockRejectedValue(new Error('Count query failed'));

      const counts = await worker.getPendingRecordsCounts();

      expect(counts.needingAnonymization).toBe('error');
      expect(counts.needingPurge).toBe('error');
      expect(counts.needingCleanup).toBe('error');
    });
  });

  describe('createScheduledJobs', () => {
    test('should return correct scheduled job configurations', () => {
      const jobs = GDPRRetentionWorker.createScheduledJobs();

      expect(jobs).toHaveLength(4);
      
      const anonymizeJob = jobs.find(j => j.name === 'gdpr_anonymize_daily');
      expect(anonymizeJob.schedule).toBe('0 2 * * *'); // Daily at 2 AM
      expect(anonymizeJob.payload.operation).toBe('anonymize');

      const purgeJob = jobs.find(j => j.name === 'gdpr_purge_daily');
      expect(purgeJob.schedule).toBe('0 3 * * *'); // Daily at 3 AM
      expect(purgeJob.payload.operation).toBe('purge');

      const cleanupJob = jobs.find(j => j.name === 'gdpr_cleanup_weekly');
      expect(cleanupJob.schedule).toBe('0 4 * * 0'); // Weekly on Sunday at 4 AM
      expect(cleanupJob.payload.operation).toBe('cleanup');

      const fullCycleJob = jobs.find(j => j.name === 'gdpr_full_cycle_weekly');
      expect(fullCycleJob.schedule).toBe('0 1 * * 1'); // Weekly on Monday at 1 AM
      expect(fullCycleJob.payload.operation).toBe('full_retention');
    });
  });

  describe('getNextScheduledRun', () => {
    test('should return next hour timestamp', () => {
      const nextRun = worker.getNextScheduledRun();
      const nextRunTime = new Date(nextRun);
      const now = new Date();
      
      expect(nextRunTime.getHours()).toBe((now.getHours() + 1) % 24);
      expect(nextRunTime.getMinutes()).toBe(0);
      expect(nextRunTime.getSeconds()).toBe(0);
    });
  });
});