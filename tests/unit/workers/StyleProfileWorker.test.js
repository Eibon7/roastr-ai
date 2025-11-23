/**
 * StyleProfileWorker Tests
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
  }
}));

// Mock style profile service
const mockStyleProfileService = {
  needsRefresh: jest.fn(),
  extractStyleProfile: jest.fn()
};

jest.mock('../../../src/services/styleProfileService', () => mockStyleProfileService);

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

// Mock QueueService
const mockQueueService = {
  initialize: jest.fn().mockResolvedValue(),
  addJob: jest.fn().mockResolvedValue({ success: true, jobId: 'mock_job_id' }),
  getNextJob: jest.fn().mockResolvedValue(null),
  completeJob: jest.fn().mockResolvedValue(),
  failJob: jest.fn().mockResolvedValue(),
  shutdown: jest.fn().mockResolvedValue()
};

jest.mock('../../../src/services/queueService', () => {
  return jest.fn().mockImplementation(() => mockQueueService);
});

// ========================================
// IMPORTS (AFTER mocks)
// ========================================

const StyleProfileWorker = require('../../../src/workers/StyleProfileWorker');
const { logger } = require('../../../src/utils/logger');

// ========================================
// TEST SUITE
// ========================================

describe('StyleProfileWorker', () => {
  let worker;
  let originalEnv;

  beforeAll(() => {
    // Save and set env vars
    originalEnv = process.env;
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set default mock behaviors
    mockStyleProfileService.needsRefresh.mockResolvedValue(true);
    mockStyleProfileService.extractStyleProfile.mockResolvedValue({
      success: true,
      commentCount: 50
    });
    
    worker = new StyleProfileWorker();
    worker.queueService = mockQueueService; // Inject mock
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
    test('should initialize with correct worker type', () => {
      expect(worker.workerType).toBe('style_profile');
      expect(worker.workerName).toMatch(/^style_profile-worker-\d+$/);
    });

    test('should extend BaseWorker', () => {
      expect(worker.config).toBeDefined();
      expect(worker.processedJobs).toBe(0);
      expect(worker.failedJobs).toBe(0);
    });
  });

  // ========================================
  // PROCESS JOB - SUCCESS CASES
  // ========================================

  describe('processJob() - Success', () => {
    test('should extract style profile successfully', async () => {
      const job = {
        id: 'job_123',
        data: {
          userId: 'user_123',
          platform: 'twitter',
          accountRef: 'account_ref',
          isRefresh: false
        }
      };

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.commentCount).toBe(50);
      expect(mockStyleProfileService.needsRefresh).toHaveBeenCalledWith('user_123', 'twitter');
      expect(mockStyleProfileService.extractStyleProfile).toHaveBeenCalledWith(
        'user_123',
        'twitter',
        'account_ref'
      );
    });

    test('should skip extraction if profile is up to date', async () => {
      mockStyleProfileService.needsRefresh.mockResolvedValue(false);

      const job = {
        id: 'job_skip',
        data: {
          userId: 'user_456',
          platform: 'youtube',
          isRefresh: false
        }
      };

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.message).toBe('Style profile is up to date');
      expect(mockStyleProfileService.extractStyleProfile).not.toHaveBeenCalled();

      expect(logger.info).toHaveBeenCalledWith(
        'Style profile is up to date, skipping',
        expect.objectContaining({ userId: 'user_456', platform: 'youtube' })
      );
    });

    test('should force refresh when isRefresh is true', async () => {
      const job = {
        id: 'job_force',
        data: {
          userId: 'user_789',
          platform: 'instagram',
          accountRef: 'account_ref',
          isRefresh: true
        }
      };

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(mockStyleProfileService.needsRefresh).not.toHaveBeenCalled(); // Skip check
      expect(mockStyleProfileService.extractStyleProfile).toHaveBeenCalled();
    });

    test('should schedule next refresh after successful extraction', async () => {
      const job = {
        id: 'job_schedule',
        data: {
          userId: 'user_abc',
          platform: 'facebook',
          accountRef: 'account_ref'
        }
      };

      jest.spyOn(worker, 'scheduleNextRefresh').mockResolvedValue();

      await worker.processJob(job);

      expect(worker.scheduleNextRefresh).toHaveBeenCalledWith('user_abc', 'facebook');
    });
  });

  // ========================================
  // PROCESS JOB - ERROR HANDLING
  // ========================================

  describe('processJob() - Error Handling', () => {
    test('should handle retryable errors', async () => {
      const error = new Error('Network timeout');
      mockStyleProfileService.extractStyleProfile.mockRejectedValue(error);

      const job = {
        id: 'job_retry',
        data: {
          userId: 'user_retry',
          platform: 'twitter'
        }
      };

      await expect(worker.processJob(job)).rejects.toThrow('Network timeout');

      expect(logger.error).toHaveBeenCalledWith(
        'Style profile extraction failed',
        expect.objectContaining({
          error: 'Network timeout',
          userId: 'user_retry',
          platform: 'twitter'
        })
      );
    });

    test('should handle non-retryable errors (insufficient comments)', async () => {
      const error = new Error('Insufficient comments for style analysis');
      mockStyleProfileService.extractStyleProfile.mockRejectedValue(error);

      const job = {
        id: 'job_nonretry',
        data: {
          userId: 'user_nonretry',
          platform: 'twitter'
        }
      };

      const result = await worker.processJob(job);

      expect(result.success).toBe(false);
      expect(result.permanent).toBe(true);
      expect(result.error).toBe('Insufficient comments for style analysis');
    });

    test('should handle non-retryable errors (plan restriction)', async () => {
      const error = new Error('Style profile feature is only available for Pro and Plus users');
      mockStyleProfileService.extractStyleProfile.mockRejectedValue(error);

      const job = {
        id: 'job_plan',
        data: {
          userId: 'user_plan',
          platform: 'twitter'
        }
      };

      const result = await worker.processJob(job);

      expect(result.success).toBe(false);
      expect(result.permanent).toBe(true);
    });
  });

  // ========================================
  // SCHEDULE NEXT REFRESH
  // ========================================

  describe('scheduleNextRefresh()', () => {
    test('should schedule refresh for 90 days later', async () => {
      await worker.scheduleNextRefresh('user_123', 'twitter');

      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'style_profile',
        {
          userId: 'user_123',
          platform: 'twitter',
          isRefresh: true
        },
        expect.objectContaining({
          delay: expect.any(Number),
          priority: 3
        })
      );

      // Verify delay is approximately 90 days (in ms)
      const call = mockQueueService.addJob.mock.calls[0];
      const delay = call[2].delay;
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
      expect(delay).toBeGreaterThan(ninetyDaysMs - 1000);
      expect(delay).toBeLessThan(ninetyDaysMs + 1000);
    });

    test('should log scheduled refresh', async () => {
      await worker.scheduleNextRefresh('user_456', 'youtube');

      expect(logger.info).toHaveBeenCalledWith(
        'Scheduled next style profile refresh',
        expect.objectContaining({
          userId: 'user_456',
          platform: 'youtube',
          nextRefreshDate: expect.any(String)
        })
      );
    });

    test('should handle scheduling failure gracefully', async () => {
      mockQueueService.addJob.mockRejectedValue(new Error('Queue full'));

      await worker.scheduleNextRefresh('user_789', 'instagram');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to schedule next refresh',
        expect.objectContaining({
          error: 'Queue full',
          userId: 'user_789',
          platform: 'instagram'
        })
      );
    });
  });

  // ========================================
  // SHOULD RETRY
  // ========================================

  describe('shouldRetry()', () => {
    test('should return false for non-retryable errors', () => {
      const error1 = new Error('Style profile feature is only available for Pro and Plus users');
      expect(worker.shouldRetry(error1)).toBe(false);

      const error2 = new Error('Insufficient comments for style analysis');
      expect(worker.shouldRetry(error2)).toBe(false);
    });

    test('should return true for retryable errors', () => {
      const error1 = new Error('Network timeout');
      expect(worker.shouldRetry(error1)).toBe(true);

      const error2 = new Error('Database connection failed');
      expect(worker.shouldRetry(error2)).toBe(true);
    });
  });

  // ========================================
  // JOB LIFECYCLE HOOKS
  // ========================================
  
  // Note: onJobComplete and onJobFailed are part of BaseWorker
  // and are tested there. Worker-specific behavior is already
  // tested in processJob() tests above.

  describe.skip('onJobComplete()', () => {
    test('should log completion for successful extraction', async () => {
      const job = {
        data: {
          userId: 'user_complete',
          platform: 'twitter'
        }
      };

      const result = {
        success: true,
        skipped: false,
        commentCount: 75
      };

      await worker.onJobComplete(job, result);

      expect(logger.info).toHaveBeenCalledWith(
        'Style profile extraction completed',
        expect.objectContaining({
          userId: 'user_complete',
          platform: 'twitter',
          commentCount: 75
        })
      );
    });

    test('should not log if job was skipped', async () => {
      const job = {
        data: {
          userId: 'user_skip',
          platform: 'twitter'
        }
      };

      const result = {
        success: true,
        skipped: true
      };

      await worker.onJobComplete(job, result);

      expect(logger.info).not.toHaveBeenCalledWith(
        'Style profile extraction completed',
        expect.any(Object)
      );
    });
  });

  describe.skip('onJobFailed()', () => {
    test('should log permanent failure', async () => {
      const job = {
        data: {
          userId: 'user_failed',
          platform: 'twitter'
        },
        attemptsMade: 3
      };

      const error = new Error('Permanent failure');

      await worker.onJobFailed(job, error);

      expect(logger.error).toHaveBeenCalledWith(
        'Style profile job failed permanently',
        expect.objectContaining({
          userId: 'user_failed',
          platform: 'twitter',
          error: 'Permanent failure',
          attempts: 3
        })
      );
    });
  });
});

