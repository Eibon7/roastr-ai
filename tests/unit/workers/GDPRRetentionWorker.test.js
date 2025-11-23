/**
 * GDPRRetentionWorker Tests
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

// Helper to create chainable Supabase mocks
const createMockChain = (finalResult = { data: [], error: null }) => {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    lt: jest.fn(() => chain),
    gt: jest.fn(() => chain),
    is: jest.fn(() => chain),
    not: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    order: jest.fn(() => Promise.resolve(finalResult)),
    update: jest.fn(() => chain),
    insert: jest.fn(() => Promise.resolve(finalResult)),
    delete: jest.fn(() => Promise.resolve(finalResult)),
    then: jest.fn((resolve) => Promise.resolve(finalResult).then(resolve))
  };
  return chain;
};

// Mock Supabase
const mockSupabase = {
  from: jest.fn((tableName) => createMockChain()),
  rpc: jest.fn((functionName) => Promise.resolve({ data: null, error: null }))
};

// Mock @supabase/supabase-js createClient
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));

// Mock mockMode
jest.mock('../../../src/config/mockMode', () => ({
  mockMode: {
    isMockMode: false
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

// Mock crypto
const mockCrypto = {
  randomBytes: jest.fn((size) => ({
    toString: jest.fn(() => 'a'.repeat(size * 2))
  })),
  createHmac: jest.fn(() => ({
    update: jest.fn(() => ({
      digest: jest.fn(() => 'b'.repeat(64))
    }))
  }))
};

jest.mock('crypto', () => mockCrypto);

// ========================================
// IMPORTS (AFTER mocks)
// ========================================

const GDPRRetentionWorker = require('../../../src/workers/GDPRRetentionWorker');
const { logger } = require('../../../src/utils/logger');

// ========================================
// TEST SUITE
// ========================================

describe('GDPRRetentionWorker', () => {
  let worker;
  let originalEnv;

  beforeAll(() => {
    // Save and set env vars
    originalEnv = process.env;
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
    process.env.GDPR_HMAC_PEPPER = 'test-pepper-secret';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new GDPRRetentionWorker({ batchSize: 100 });
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
      expect(worker.workerType).toBe('gdpr_retention');
      expect(worker.batchSize).toBe(100);
      expect(worker.hmacPepper).toBe('test-pepper-secret');
      expect(worker.dryRun).toBe(false);
    });

    test('should initialize statistics', () => {
      expect(worker.stats).toEqual({
        totalProcessed: 0,
        anonymized: 0,
        purged: 0,
        cleaned: 0,
        errors: 0,
        lastRun: null
      });
    });

    test('should throw if SUPABASE_SERVICE_KEY missing', () => {
      delete process.env.SUPABASE_SERVICE_KEY;
      expect(() => new GDPRRetentionWorker()).toThrow('SUPABASE_SERVICE_KEY is required');
      process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
    });

    test('should throw if GDPR_HMAC_PEPPER missing (not in dry-run)', () => {
      delete process.env.GDPR_HMAC_PEPPER;
      expect(() => new GDPRRetentionWorker({ dryRun: false })).toThrow(
        'GDPR_HMAC_PEPPER environment variable is required'
      );
      process.env.GDPR_HMAC_PEPPER = 'test-pepper-secret';
    });

    test('should not throw if GDPR_HMAC_PEPPER missing in dry-run mode', () => {
      delete process.env.GDPR_HMAC_PEPPER;
      expect(() => new GDPRRetentionWorker({ dryRun: true })).not.toThrow();
      process.env.GDPR_HMAC_PEPPER = 'test-pepper-secret';
    });
  });

  // ========================================
  // ANONYMIZE OLD RECORDS
  // ========================================

  describe('anonymizeOldRecords()', () => {
    test('should anonymize records older than 80 days', async () => {
      const oldRecords = [
        {
          id: 'record_1',
          original_text: 'Sensitive text 1',
          created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'record_2',
          original_text: 'Sensitive text 2',
          created_at: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      mockSupabase.from
        .mockReturnValueOnce(createMockChain({ data: oldRecords, error: null }))
        .mockReturnValue(createMockChain({ data: [], error: null }));

      const result = await worker.anonymizeOldRecords('batch_1');

      expect(result.processed).toBe(2);
      expect(result.anonymized).toBe(2);
      expect(result.errors).toBe(0);
      expect(worker.stats.anonymized).toBe(2);
    });

    test('should return early if no records to anonymize', async () => {
      mockSupabase.from.mockReturnValueOnce(createMockChain({ data: [], error: null }));

      const result = await worker.anonymizeOldRecords('batch_empty');

      expect(result.processed).toBe(0);
      expect(result.anonymized).toBe(0);
    });

    test('should handle anonymization in dry-run mode', async () => {
      worker.dryRun = true;

      const oldRecords = [
        {
          id: 'record_dry',
          original_text: 'Test text',
          created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      mockSupabase.from.mockReturnValueOnce(createMockChain({ data: oldRecords, error: null }));

      const result = await worker.anonymizeOldRecords('batch_dry');

      expect(result.anonymized).toBe(1);
      expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ id: 'record_dry' })
      );
    });

    test('should handle HMAC generation failure gracefully', async () => {
      const oldRecords = [
        {
          id: 'record_fail',
          original_text: 'Sensitive text',
          created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      mockSupabase.from
        .mockReturnValueOnce(createMockChain({ data: oldRecords, error: null }))
        .mockReturnValue(createMockChain({ data: [], error: null }));

      mockCrypto.createHmac.mockImplementationOnce(() => {
        throw new Error('HMAC failed');
      });

      const result = await worker.anonymizeOldRecords('batch_fail');

      expect(result.errors).toBeGreaterThan(0);
      expect(worker.stats.errors).toBeGreaterThan(0);
    });

    test('should handle Supabase update failure', async () => {
      const oldRecords = [
        {
          id: 'record_db_fail',
          original_text: 'Sensitive text',
          created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      mockSupabase.from
        .mockReturnValueOnce(createMockChain({ data: oldRecords, error: null }))
        .mockReturnValueOnce(createMockChain({ data: null, error: new Error('Update failed') }));

      const result = await worker.anonymizeOldRecords('batch_db_fail');

      expect(result.errors).toBeGreaterThan(0);
    });
  });

  // ========================================
  // PURGE OLD RECORDS
  // ========================================

  describe('purgeOldRecords()', () => {
    test('should purge records older than 90 days', async () => {
      mockSupabase.from.mockReturnValueOnce(
        createMockChain({ data: [], error: null })
      );

      const result = await worker.purgeOldRecords('batch_purge');

      expect(result.purged).toBe('completed');
      expect(result.errors).toBe(0);
    });

    test('should handle purge in dry-run mode', async () => {
      worker.dryRun = true;

      mockSupabase.from.mockReturnValueOnce(
        createMockChain({ count: 10, error: null })
      );

      const result = await worker.purgeOldRecords('batch_dry_purge');

      expect(result.purged).toBe(10);
      expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ count: 10 })
      );
    });

    test('should handle Supabase delete failure', async () => {
      mockSupabase.from.mockReturnValueOnce(
        createMockChain({ data: null, error: new Error('Delete failed') })
      );

      await expect(worker.purgeOldRecords('batch_fail')).rejects.toThrow('Delete failed');
    });
  });

  // ========================================
  // CLEANUP OLD PROFILES
  // ========================================

  describe('cleanupOldProfiles()', () => {
    test('should cleanup old offender profiles via RPC', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: 5, error: null });

      const result = await worker.cleanupOldProfiles('batch_cleanup');

      expect(result.cleaned).toBe(5);
      expect(result.errors).toBe(0);
      expect(worker.stats.cleaned).toBe(5);
    });

    test('should handle cleanup in dry-run mode', async () => {
      worker.dryRun = true;

      const result = await worker.cleanupOldProfiles('batch_dry_cleanup');

      expect(result.cleaned).toBe('dry_run');
      expect(logger.info).toHaveBeenCalled();
    });

    test('should handle RPC failure', async () => {
      mockSupabase.rpc.mockRejectedValueOnce(new Error('RPC failed'));

      await expect(worker.cleanupOldProfiles('batch_fail')).rejects.toThrow('RPC failed');
    });
  });

  // ========================================
  // FULL RETENTION CYCLE
  // ========================================

  describe('runFullRetentionCycle()', () => {
    test('should execute full retention cycle (anonymize + purge + cleanup)', async () => {
      // Mock anonymize
      mockSupabase.from
        .mockReturnValueOnce(createMockChain({ data: [], error: null })) // anonymize select
        .mockReturnValueOnce(createMockChain({ data: [], error: null })) // purge delete
        .mockReturnValue(createMockChain({ data: [], error: null }));

      // Mock cleanup RPC
      mockSupabase.rpc.mockResolvedValueOnce({ data: 0, error: null });

      const result = await worker.runFullRetentionCycle('batch_full');

      expect(result.fullCycle).toBe(true);
      expect(result.anonymize).toBeDefined();
      expect(result.purge).toBeDefined();
      expect(result.cleanup).toBeDefined();
      expect(result.totalErrors).toBe(0);
    });

    test('should continue cycle even if one operation fails partially', async () => {
      // Mock anonymize with some errors
      const oldRecords = [
        {
          id: 'record_1',
          original_text: 'Text 1',
          created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      mockSupabase.from
        .mockReturnValueOnce(createMockChain({ data: oldRecords, error: null })) // anonymize select
        .mockReturnValueOnce(createMockChain({ data: null, error: new Error('Anonymize failed') })) // anonymize update fails
        .mockReturnValueOnce(createMockChain({ data: [], error: null })) // purge
        .mockReturnValue(createMockChain({ data: [], error: null }));

      mockSupabase.rpc.mockResolvedValueOnce({ data: 0, error: null });

      const result = await worker.runFullRetentionCycle('batch_partial');

      expect(result.totalErrors).toBeGreaterThan(0);
      expect(result.purge).toBeDefined(); // Should still complete purge
      expect(result.cleanup).toBeDefined(); // Should still complete cleanup
    });
  });

  // ========================================
  // PROCESS JOB
  // ========================================

  describe('processJob()', () => {
    test('should process anonymize operation', async () => {
      mockSupabase.from
        .mockReturnValueOnce(createMockChain({ data: [], error: null }))
        .mockReturnValue(createMockChain({ data: [], error: null }));

      const job = { payload: { operation: 'anonymize', batchId: 'batch_1' } };
      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('anonymize');
    });

    test('should process purge operation', async () => {
      mockSupabase.from
        .mockReturnValueOnce(createMockChain({ data: [], error: null }))
        .mockReturnValue(createMockChain({ data: [], error: null }));

      const job = { payload: { operation: 'purge', batchId: 'batch_2' } };
      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('purge');
    });

    test('should process cleanup operation', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: 0, error: null });
      mockSupabase.from.mockReturnValue(createMockChain({ data: [], error: null }));

      const job = { payload: { operation: 'cleanup', batchId: 'batch_3' } };
      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('cleanup');
    });

    test('should process full_retention operation', async () => {
      mockSupabase.from
        .mockReturnValueOnce(createMockChain({ data: [], error: null }))
        .mockReturnValueOnce(createMockChain({ data: [], error: null }))
        .mockReturnValue(createMockChain({ data: [], error: null }));

      mockSupabase.rpc.mockResolvedValueOnce({ data: 0, error: null });

      const job = { payload: { operation: 'full_retention', batchId: 'batch_full' } };
      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('full_retention');
      expect(result.fullCycle).toBe(true);
    });

    test('should throw error for unknown operation', async () => {
      const job = { payload: { operation: 'unknown_op', batchId: 'batch_unknown' } };

      await expect(worker.processJob(job)).rejects.toThrow(
        'Unknown GDPR retention operation: unknown_op'
      );
    });

    test('should log operation failure to retention log', async () => {
      mockSupabase.from.mockReturnValueOnce(
        createMockChain({ data: null, error: new Error('Operation failed') })
      );

      const job = { payload: { operation: 'anonymize', batchId: 'batch_fail' } };

      await expect(worker.processJob(job)).rejects.toThrow();
      expect(worker.stats.errors).toBeGreaterThan(0);
    });
  });

  // ========================================
  // HELPER METHODS
  // ========================================

  describe('Helper Methods', () => {
    test('should get next scheduled run time', () => {
      const nextRun = worker.getNextScheduledRun();
      expect(nextRun).toBeTruthy();
      expect(new Date(nextRun).getTime()).toBeGreaterThan(Date.now());
    });

    test('should get pending records counts', async () => {
      mockSupabase.from
        .mockReturnValueOnce(createMockChain({ count: 10, error: null })) // anonymize
        .mockReturnValueOnce(createMockChain({ count: 5, error: null })) // purge
        .mockReturnValueOnce(createMockChain({ count: 2, error: null })); // cleanup

      const counts = await worker.getPendingRecordsCounts();

      expect(counts.needingAnonymization).toBe(10);
      expect(counts.needingPurge).toBe(5);
      expect(counts.needingCleanup).toBe(2);
    });

    test('should handle error when getting pending counts', async () => {
      mockSupabase.from.mockReturnValueOnce(
        createMockChain({ data: null, error: new Error('Count failed') })
      );

      const counts = await worker.getPendingRecordsCounts();

      expect(counts.needingAnonymization).toBe('error');
    });

    test('should log retention operation', async () => {
      mockSupabase.from.mockReturnValueOnce(createMockChain({ data: [], error: null }));

      await worker.logRetentionOperation({
        operation_type: 'test',
        operation_status: 'success'
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('shield_retention_log');
    });

    test('should get specific health details', async () => {
      mockSupabase.from
        .mockReturnValueOnce(createMockChain({ count: 10, error: null }))
        .mockReturnValueOnce(createMockChain({ count: 5, error: null }))
        .mockReturnValueOnce(createMockChain({ count: 2, error: null }));

      const health = await worker.getSpecificHealthDetails();

      expect(health.gdprRetention).toBeDefined();
      expect(health.gdprRetention.batchSize).toBe(100);
      expect(health.gdprRetention.dryRun).toBe(false);
      expect(health.gdprRetention.pendingRecords).toBeDefined();
    });
  });

  // ========================================
  // SCHEDULED JOBS
  // ========================================

  describe('createScheduledJobs()', () => {
    test('should return scheduled jobs configuration', () => {
      const jobs = GDPRRetentionWorker.createScheduledJobs();

      expect(jobs).toHaveLength(4);
      expect(jobs[0].name).toBe('gdpr_anonymize_daily');
      expect(jobs[1].name).toBe('gdpr_purge_daily');
      expect(jobs[2].name).toBe('gdpr_cleanup_weekly');
      expect(jobs[3].name).toBe('gdpr_full_cycle_weekly');
    });
  });
});
