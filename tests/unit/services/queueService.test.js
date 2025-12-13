/**
 * Queue Service Tests
 *
 * Tests for unified Redis/Database queue management with priority support
 */

// Mock mockMode to disable it in tests
jest.mock('../../../src/config/mockMode', () => ({
  mockMode: {
    isMockMode: false,
    generateMockSupabaseClient: jest.fn()
  }
}));

const QueueService = require('../../../src/services/queueService');

// Mock @upstash/redis (REST SDK - stateless, no event handlers)
jest.mock('@upstash/redis', () => {
  const mockRedis = {
    lpush: jest.fn(),
    brpop: jest.fn(),
    rpop: jest.fn(),
    llen: jest.fn(),
    lrange: jest.fn(),
    del: jest.fn(),
    ping: jest.fn(),
    // Note: No disconnect/on methods needed (stateless REST SDK)
    setex: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    get: jest.fn(),
    set: jest.fn()
  };

  return {
    Redis: jest.fn(() => mockRedis)
  };
});

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        })),
        limit: jest.fn(() => Promise.resolve({ data: null, error: null }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: { id: 'test-job' }, error: null }))
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null }))
      }))
    }))
  }))
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }))
  }
}));

describe('QueueService', () => {
  let queueService;

  beforeEach(async () => {
    // Mock environment variables
    process.env.UPSTASH_REDIS_REST_URL = 'redis://test:6379';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-key';

    // Create QueueService
    queueService = new QueueService();

    // Wait for initialization to complete
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Configuration', () => {
    test('should initialize with correct default properties', () => {
      expect(queueService).toBeDefined();
      expect(queueService.queuePrefix).toBe('roastr:jobs');
      expect(queueService.dlqPrefix).toBe('roastr:dlq');
      expect(queueService.metricsPrefix).toBe('roastr:metrics');
      expect(queueService.options).toBeDefined();
      expect(queueService.options.maxRetries).toBe(3);
      expect(queueService.options.retryDelay).toBe(5000);
    });

    test('should have correct priority queue mappings', () => {
      expect(queueService.priorityQueues).toEqual({
        1: 'critical',
        2: 'high',
        3: 'medium',
        4: 'normal',
        5: 'low'
      });
    });

    test('should accept custom options', () => {
      const customService = new QueueService({
        maxRetries: 5,
        retryDelay: 3000,
        deadLetterQueueEnabled: false
      });

      expect(customService.options.maxRetries).toBe(5);
      expect(customService.options.retryDelay).toBe(3000);
      expect(customService.options.deadLetterQueueEnabled).toBe(false);
    });
  });

  describe('Queue Key Generation', () => {
    test('should generate correct queue keys for different priorities', () => {
      const key1 = queueService.getQueueKey('fetch_comments', 1);
      const key2 = queueService.getQueueKey('shield_action', 5);

      expect(key1).toBe('roastr:jobs:fetch_comments:p1');
      expect(key2).toBe('roastr:jobs:shield_action:p5');
    });

    test('should handle default priority', () => {
      const key = queueService.getQueueKey('analyze_toxicity');

      expect(key).toBe('roastr:jobs:analyze_toxicity:p5');
    });

    test('should handle various job types', () => {
      const types = ['fetch_comments', 'analyze_toxicity', 'generate_roast', 'shield_action'];

      types.forEach((type) => {
        const key = queueService.getQueueKey(type, 3);
        expect(key).toBe(`roastr:jobs:${type}:p3`);
      });
    });
  });

  describe('Job ID Generation', () => {
    test('should generate unique job IDs', () => {
      const id1 = queueService.generateJobId();
      const id2 = queueService.generateJobId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });

    test('should generate IDs with correct format', () => {
      const id = queueService.generateJobId();

      expect(id).toMatch(/^job_\d+_[a-z0-9]+$/); // job_timestamp_random format
      expect(id.length).toBeGreaterThan(15);
      expect(id).toContain('job_');
    });
  });

  describe('addJob', () => {
    test('should create job with correct properties', async () => {
      const jobData = {
        organization_id: 'org-123',
        platform: 'twitter',
        action_type: 'fetch_comments',
        payload: { comment_id: 'comment-456' }
      };

      // Mock the internal method to avoid Redis dependencies
      jest.spyOn(queueService, 'addJobToRedis').mockResolvedValue({
        id: 'job-123',
        job_type: 'fetch_comments',
        organization_id: 'org-123',
        priority: 2,
        payload: jobData,
        max_attempts: 3,
        created_at: new Date().toISOString()
      });

      queueService.isRedisAvailable = true;

      const result = await queueService.addJob('fetch_comments', jobData, { priority: 2 });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.jobId).toBeDefined();
      expect(result.job).toBeDefined();
      expect(result.job.id).toBeDefined();
      expect(result.job.job_type).toBe('fetch_comments');
      expect(result.job.organization_id).toBe('org-123');
      expect(result.job.priority).toBe(2);
      expect(result.queuedTo).toBe('redis');

      // Validate the job object passed to addJobToRedis
      const [jobArg] = queueService.addJobToRedis.mock.calls[0];
      expect(jobArg).toMatchObject({
        job_type: 'fetch_comments',
        organization_id: 'org-123',
        priority: 2,
        payload: jobData,
        max_attempts: 3
      });
    });

    test('should use default priority when not specified', async () => {
      const jobData = {
        organization_id: 'org-123',
        platform: 'twitter',
        action_type: 'fetch_comments'
      };

      jest.spyOn(queueService, 'addJobToRedis').mockResolvedValue({
        id: 'job-123',
        job_type: 'fetch_comments',
        priority: 5,
        organization_id: 'org-123'
      });

      queueService.isRedisAvailable = true;

      const result = await queueService.addJob('fetch_comments', jobData);

      expect(result.success).toBe(true);
      expect(result.jobId).toBeDefined();
      expect(result.job.priority).toBe(5);

      // Validate the job object has default priority
      const [jobArg] = queueService.addJobToRedis.mock.calls[0];
      expect(jobArg).toMatchObject({
        job_type: 'fetch_comments',
        organization_id: 'org-123',
        priority: 5,
        payload: jobData
      });
    });

    test('should set correct max attempts', async () => {
      const jobData = { organization_id: 'org-123' };

      jest.spyOn(queueService, 'addJobToRedis').mockResolvedValue({
        id: 'job-123',
        job_type: 'test',
        max_attempts: 5,
        organization_id: 'org-123'
      });

      queueService.isRedisAvailable = true;

      const result = await queueService.addJob('test', jobData, { maxAttempts: 5 });

      expect(result.success).toBe(true);
      expect(result.jobId).toBeDefined();
      expect(result.job.max_attempts).toBe(5);

      // Validate the job object has custom max_attempts
      const [jobArg] = queueService.addJobToRedis.mock.calls[0];
      expect(jobArg).toMatchObject({
        job_type: 'test',
        organization_id: 'org-123',
        max_attempts: 5,
        payload: jobData
      });
    });

    test('should fallback to database when Redis unavailable', async () => {
      const jobData = { organization_id: 'org-123' };

      jest.spyOn(queueService, 'addJobToDatabase').mockResolvedValue({
        id: 'job-123',
        job_type: 'test',
        organization_id: 'org-123'
      });

      queueService.isRedisAvailable = false;

      const result = await queueService.addJob('test', jobData);

      expect(result.success).toBe(true);
      expect(result.jobId).toBeDefined();
      expect(queueService.addJobToDatabase).toHaveBeenCalled();

      // Validate the job object passed to addJobToDatabase
      const [jobArg] = queueService.addJobToDatabase.mock.calls[0];
      expect(jobArg).toMatchObject({
        job_type: 'test',
        organization_id: 'org-123',
        payload: jobData
      });
    });
  });

  describe('getNextJob', () => {
    test('should return null when no jobs available', async () => {
      jest.spyOn(queueService, 'getJobFromRedis').mockResolvedValue(null);
      jest.spyOn(queueService, 'getJobFromDatabase').mockResolvedValue(null);

      queueService.isRedisAvailable = true;

      const result = await queueService.getNextJob('fetch_comments');

      expect(result).toBeNull();
    });

    test('should prioritize Redis when available', async () => {
      const mockJob = { id: 'job-123', job_type: 'fetch_comments' };

      jest.spyOn(queueService, 'getJobFromRedis').mockResolvedValue(mockJob);
      queueService.isRedisAvailable = true;

      const result = await queueService.getNextJob('fetch_comments');

      expect(result).toEqual(mockJob);
      expect(queueService.getJobFromRedis).toHaveBeenCalled();
    });

    test('should use database when Redis unavailable', async () => {
      const mockJob = { id: 'job-123', job_type: 'fetch_comments' };

      jest.spyOn(queueService, 'getJobFromDatabase').mockResolvedValue(mockJob);
      queueService.isRedisAvailable = false;

      const result = await queueService.getNextJob('fetch_comments');

      expect(result).toEqual(mockJob);
      expect(queueService.getJobFromDatabase).toHaveBeenCalled();
    });
  });

  describe('Job Management', () => {
    test('should complete job successfully', async () => {
      const job = { id: 'job-123', job_type: 'test' };
      const result = { processed: 5, errors: 0 };

      jest.spyOn(queueService, 'completeJobInDatabase').mockResolvedValue(true);
      jest.spyOn(queueService, 'incrementMetric').mockResolvedValue(true);

      // Ensure supabase is available for the test
      queueService.supabase = {};

      await queueService.completeJob(job, result);

      expect(queueService.completeJobInDatabase).toHaveBeenCalledWith(job, result);
      expect(queueService.incrementMetric).toHaveBeenCalledWith('jobs_completed', 'test');
    });

    test('should handle job completion gracefully', async () => {
      const job = { id: 'job-123', job_type: 'test' };
      const result = { processed: 5, errors: 0 };

      // Test that completion works without Redis available
      queueService.isRedisAvailable = false;

      // Should not throw
      await expect(queueService.completeJob(job, result)).resolves.not.toThrow();
    });

    test('should handle job without throwing errors', async () => {
      const job = { id: 'job-123', job_type: 'test' };
      const result = { processed: 5, errors: 0 };

      // Don't mock - test that it handles errors gracefully
      queueService.isRedisAvailable = false;

      await expect(queueService.completeJob(job, result)).resolves.not.toThrow();
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should return queue statistics structure', async () => {
      jest.spyOn(queueService, 'getRedisStats').mockResolvedValue({
        total: 10,
        queues: {
          fetch_comments: { total: 5, byPriority: { 1: 2, 2: 3 } },
          analyze_toxicity: { total: 5, byPriority: { 1: 1, 2: 4 } }
        }
      });

      jest.spyOn(queueService, 'getDatabaseStats').mockResolvedValue({
        total: 20,
        byStatus: { pending: 15, processing: 3, failed: 2 },
        byType: { fetch_comments: 10, analyze_toxicity: 10 }
      });

      queueService.isRedisAvailable = true;
      queueService.supabase = {}; // Ensure database is available

      const stats = await queueService.getQueueStats();

      expect(stats).toBeDefined();
      expect(stats.redis).toBe(true);
      expect(stats.database).toBe(true);
      expect(stats.redisStats).toBeDefined();
      expect(stats.databaseStats).toBeDefined();
    });

    test('should handle database-only statistics', async () => {
      jest.spyOn(queueService, 'getDatabaseStats').mockResolvedValue({
        total: 5,
        byStatus: { pending: 3, processing: 2 },
        byType: { fetch_comments: 5 }
      });

      queueService.isRedisAvailable = false;
      queueService.supabase = {}; // Ensure database is available

      const stats = await queueService.getQueueStats();

      expect(stats.redis).toBe(false);
      expect(stats.database).toBe(true);
      expect(stats.redisStats).toBeUndefined();
      expect(stats.databaseStats).toBeDefined();
    });
  });

  describe('Utility Methods', () => {
    test('should handle logging correctly', () => {
      // Verify log method exists and doesn't throw
      expect(() => {
        queueService.log('info', 'Test message', { extra: 'data' });
      }).not.toThrow();
    });

    test('should handle shutdown gracefully', async () => {
      jest.spyOn(queueService, 'log').mockImplementation(() => {});

      await expect(queueService.shutdown()).resolves.not.toThrow();
    });

    test('should increment metrics properly', async () => {
      if (queueService.redis) {
        queueService.redis.incr = jest.fn().mockResolvedValue(1);

        await queueService.incrementMetric('jobs_added', 'fetch_comments');

        expect(queueService.redis.incr).toHaveBeenCalled();
      } else {
        // Just verify method doesn't throw when Redis unavailable
        await expect(
          queueService.incrementMetric('jobs_added', 'fetch_comments')
        ).resolves.not.toThrow();
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle Redis connection errors gracefully', async () => {
      queueService.isRedisAvailable = false;

      // Should fallback to database operations without throwing
      jest.spyOn(queueService, 'addJobToDatabase').mockResolvedValue({ id: 'test' });

      const result = await queueService.addJob('test', { organization_id: 'org-123' });

      expect(result).toBeDefined();
    });

    test('should handle malformed job data', async () => {
      // Test that method exists and handles invalid input
      jest.spyOn(queueService, 'addJobToDatabase').mockResolvedValue({ id: 'test' });
      queueService.isRedisAvailable = false;

      // Should throw for null payload
      await expect(queueService.addJob('test', null)).rejects.toThrow();
    });

    test('should handle valid job data', async () => {
      // Test with valid data
      jest.spyOn(queueService, 'addJobToDatabase').mockResolvedValue({ id: 'test' });
      queueService.isRedisAvailable = false;

      // Should handle valid payload
      await expect(
        queueService.addJob('test', { organization_id: 'test-org' })
      ).resolves.toBeDefined();
    });
  });

  // ========== EXPANDED TESTS FOR ISSUE #929 - COVERAGE IMPROVEMENT ==========

  describe('validateCorrelationId (static method)', () => {
    it('should accept undefined correlation ID', () => {
      expect(QueueService.validateCorrelationId(undefined)).toBe(true);
    });

    it('should accept null correlation ID', () => {
      expect(QueueService.validateCorrelationId(null)).toBe(true);
    });

    it('should accept empty string correlation ID', () => {
      expect(QueueService.validateCorrelationId('')).toBe(true);
    });

    it('should accept valid UUID v4 correlation ID', () => {
      const validUUIDs = [
        '550e8400-e29b-41d4-a716-446655440000',
        '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
        '00000000-0000-4000-8000-000000000000'
      ];

      validUUIDs.forEach((uuid) => {
        expect(QueueService.validateCorrelationId(uuid)).toBe(true);
      });
    });

    it('should reject non-string correlation ID', () => {
      expect(() => QueueService.validateCorrelationId(12345)).toThrow('must be a string');
      expect(() => QueueService.validateCorrelationId({})).toThrow('must be a string');
      expect(() => QueueService.validateCorrelationId([])).toThrow('must be a string');
    });

    it('should reject invalid UUID format', () => {
      const invalidUUIDs = [
        'not-a-uuid',
        '550e8400-e29b-11d4-a716-446655440000', // UUID v1
        '550e8400-e29b-21d4-a716-446655440000', // UUID v2
        '550e8400-e29b-31d4-a716-446655440000', // UUID v3
        '550e8400-e29b-51d4-a716-446655440000', // UUID v5
        '550e8400e29b41d4a716446655440000', // No dashes
        '550e8400-e29b-41d4-a716' // Incomplete
      ];

      invalidUUIDs.forEach((uuid) => {
        expect(() => QueueService.validateCorrelationId(uuid)).toThrow(
          'Invalid correlation ID format'
        );
      });
    });
  });

  describe('Dead Letter Queue (DLQ) Operations', () => {
    describe('moveToDeadLetterQueue', () => {
      it('should move job to DLQ in Redis when available', async () => {
        queueService.isRedisAvailable = true;
        const mockRedis = queueService.redis;
        mockRedis.lpush = jest.fn().mockResolvedValue(1);

        const job = {
          id: 'job-123',
          job_type: 'test_queue',
          payload: { test: 'data' },
          attempts: 3
        };
        const error = new Error('Job failed permanently');

        await queueService.moveToDeadLetterQueue(job, error);

        expect(mockRedis.lpush).toHaveBeenCalledWith(
          'roastr:dlq:test_queue',
          expect.stringContaining('job-123')
        );
      });

      it('should log warning when moving to DLQ (Redis unavailable)', async () => {
        queueService.isRedisAvailable = false;
        const mockLog = jest.spyOn(queueService, 'log');

        const job = {
          id: 'job-123',
          job_type: 'test_queue',
          payload: { test: 'data' },
          attempts: 3
        };
        const error = new Error('Job failed');

        await queueService.moveToDeadLetterQueue(job, error);

        expect(mockLog).toHaveBeenCalledWith(
          'warn',
          'Job moved to dead letter queue',
          expect.objectContaining({
            jobId: 'job-123',
            jobType: 'test_queue'
          })
        );
      });

      it('should include error details in DLQ entry', async () => {
        queueService.isRedisAvailable = true;
        const mockRedis = queueService.redis;
        let capturedDLQEntry;
        mockRedis.lpush = jest.fn((key, entry) => {
          capturedDLQEntry = JSON.parse(entry);
          return Promise.resolve(1);
        });
        mockRedis.expire = jest.fn().mockResolvedValue(1);

        const job = {
          id: 'job-123',
          job_type: 'test_queue',
          payload: { test: 'data' },
          attempts: 3
        };
        const error = new Error('Test error message');

        await queueService.moveToDeadLetterQueue(job, error);

        expect(capturedDLQEntry).toMatchObject({
          id: 'job-123',
          job_type: 'test_queue',
          final_error: 'Test error message',
          attempts: 3
        });
        expect(capturedDLQEntry.failed_at).toBeDefined();
      });
    });

    describe('retryJob', () => {
      it('should retry job with exponential backoff', async () => {
        const mockAddJob = jest.spyOn(queueService, 'addJob').mockResolvedValue({
          success: true,
          jobId: 'retry-job-123',
          job: {},
          queuedTo: 'redis'
        });

        const job = {
          id: 'job-123',
          job_type: 'test_queue',
          priority: 3,
          payload: { test: 'data' },
          max_attempts: 3
        };
        const attempts = 2;
        const error = new Error('Temporary error');

        await queueService.retryJob(job, attempts, error);

        expect(mockAddJob).toHaveBeenCalledWith(
          'test_queue',
          expect.objectContaining(job.payload),
          expect.objectContaining({
            priority: 3,
            maxAttempts: 3,
            delay: expect.any(Number)
          })
        );

        // Verify exponential backoff (should be 5000 * 2^(attempts-1) = 5000 * 2^1 = 10000ms)
        const callOptions = mockAddJob.mock.calls[0][2];
        expect(callOptions.delay).toBeGreaterThanOrEqual(10000);
      });

      it('should pass original payload to addJob on retry', async () => {
        const mockAddJob = jest.spyOn(queueService, 'addJob').mockResolvedValue({
          success: true,
          jobId: 'retry-job-123',
          job: {},
          queuedTo: 'redis'
        });

        const job = {
          id: 'job-123',
          job_type: 'test_queue',
          payload: { original: 'data' }
        };

        await queueService.retryJob(job, 1, new Error('Test'));

        const retryPayload = mockAddJob.mock.calls[0][1];
        expect(retryPayload).toMatchObject({
          original: 'data'
        });
        // Verify options include retry delay
        const retryOptions = mockAddJob.mock.calls[0][2];
        expect(retryOptions.delay).toBeDefined();
      });
    });

    describe('markJobAsFailed', () => {
      it('should mark job as failed in database', async () => {
        const mockUpdate = jest.fn(() => Promise.resolve({ error: null }));
        const mockEq = jest.fn(() => ({ update: mockUpdate }));
        const mockFrom = jest.fn(() => ({
          update: jest.fn(() => ({
            eq: mockEq
          }))
        }));
        queueService.supabase = { from: mockFrom };

        const job = {
          id: 'job-123',
          job_type: 'test_queue'
        };
        const error = new Error('Failed permanently');

        await queueService.markJobAsFailed(job, error);

        expect(mockFrom).toHaveBeenCalledWith('job_queue');
      });

      it('should handle database errors gracefully', async () => {
        const mockFrom = jest.fn(() => ({
          update: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ error: new Error('DB error') }))
          }))
        }));
        queueService.supabase = { from: mockFrom };

        const job = { id: 'job-123' };
        const error = new Error('Job failed');

        // Should not throw, just log error
        await expect(queueService.markJobAsFailed(job, error)).resolves.not.toThrow();
      });
    });
  });

  describe('completeJob - Detailed Tests', () => {
    describe('completeJobInRedis', () => {
      it('should store completed job in Redis with TTL', async () => {
        queueService.isRedisAvailable = true;
        const mockRedis = queueService.redis;
        mockRedis.setex = jest.fn().mockResolvedValue('OK');

        const job = { id: 'job-123', job_type: 'test_queue' };
        const result = { status: 'success', data: 'result' };

        await queueService.completeJobInRedis(job, result);

        expect(mockRedis.setex).toHaveBeenCalledWith(
          'roastr:jobs:completed:test_queue:job-123',
          86400, // 24 hour TTL
          expect.any(String)
        );
      });

      it('should include result in completed job data', async () => {
        queueService.isRedisAvailable = true;
        const mockRedis = queueService.redis;
        let capturedData;
        mockRedis.setex = jest.fn((key, ttl, data) => {
          capturedData = JSON.parse(data);
          return Promise.resolve('OK');
        });

        const job = { id: 'job-123', job_type: 'test_queue', payload: { test: 'data' } };
        const result = { status: 'success' };

        await queueService.completeJobInRedis(job, result);

        expect(capturedData).toMatchObject({
          id: 'job-123',
          job_type: 'test_queue',
          result: { status: 'success' }
        });
        expect(capturedData.completed_at).toBeDefined();
      });
    });

    describe('completeJobInDatabase', () => {
      it('should update job status to completed', async () => {
        const mockEq = jest.fn(() => Promise.resolve({ error: null }));
        const mockUpdate = jest.fn(() => ({
          eq: mockEq
        }));
        const mockFrom = jest.fn(() => ({
          update: mockUpdate
        }));
        queueService.supabase = { from: mockFrom };

        const job = { id: 'job-123', job_type: 'test_queue' };
        const result = { output: 'success' };

        await queueService.completeJobInDatabase(job, result);

        expect(mockFrom).toHaveBeenCalledWith('job_queue');
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'completed'
          })
        );
      });

      it('should handle database update errors', async () => {
        const mockFrom = jest.fn(() => ({
          update: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ error: new Error('Update failed') }))
          }))
        }));
        queueService.supabase = { from: mockFrom };

        const job = { id: 'job-123' };

        // Should throw on database error
        await expect(queueService.completeJobInDatabase(job, {})).rejects.toThrow('Update failed');
      });
    });

    describe('completeJob - Dual Storage Behavior', () => {
      it('should complete in both Redis and database when both available', async () => {
        queueService.isRedisAvailable = true;
        queueService.supabase = { from: jest.fn() };
        const mockCompleteInRedis = jest
          .spyOn(queueService, 'completeJobInRedis')
          .mockResolvedValue();
        const mockCompleteInDB = jest
          .spyOn(queueService, 'completeJobInDatabase')
          .mockResolvedValue();
        const mockIncrement = jest.spyOn(queueService, 'incrementMetric').mockResolvedValue();

        const job = { id: 'job-123', job_type: 'test' };

        await queueService.completeJob(job, {});

        expect(mockCompleteInRedis).toHaveBeenCalled();
        expect(mockCompleteInDB).toHaveBeenCalled();
        expect(mockIncrement).toHaveBeenCalledWith('jobs_completed', 'test');
      });

      it('should only complete in database when Redis unavailable', async () => {
        queueService.isRedisAvailable = false;
        queueService.supabase = { from: jest.fn() };
        const mockCompleteInRedis = jest
          .spyOn(queueService, 'completeJobInRedis')
          .mockResolvedValue();
        const mockCompleteInDB = jest
          .spyOn(queueService, 'completeJobInDatabase')
          .mockResolvedValue();

        const job = { id: 'job-123', job_type: 'test' };

        await queueService.completeJob(job, {});

        expect(mockCompleteInRedis).not.toHaveBeenCalled();
        expect(mockCompleteInDB).toHaveBeenCalled();
      });
    });
  });

  describe('Priority Queue Behavior', () => {
    describe('getJobFromRedis - Priority Order', () => {
      it('should check priority 1 (critical) first', async () => {
        queueService.isRedisAvailable = true;
        const mockRedis = queueService.redis;

        // Mock rpop to return null for priorities 1-4, job for priority 5
        mockRedis.rpop = jest.fn((key) => {
          if (key.includes(':5')) {
            return Promise.resolve(
              JSON.stringify({
                id: 'low-priority-job',
                priority: 5
              })
            );
          }
          return Promise.resolve(null);
        });

        const job = await queueService.getJobFromRedis('test_queue');

        // Should have checked priorities 1,2,3,4,5 in order
        expect(mockRedis.rpop).toHaveBeenCalledTimes(5);
        expect(mockRedis.rpop.mock.calls[0][0]).toContain(':p1'); // Critical first
        expect(mockRedis.rpop.mock.calls[4][0]).toContain(':p5'); // Low last
      });

      it('should return null when no jobs in any priority', async () => {
        queueService.isRedisAvailable = true;
        const mockRedis = queueService.redis;
        mockRedis.rpop = jest.fn().mockResolvedValue(null);

        const job = await queueService.getJobFromRedis('test_queue');

        expect(job).toBeNull();
        expect(mockRedis.rpop).toHaveBeenCalledTimes(5);
      });

      it('should skip scheduled jobs not yet due', async () => {
        queueService.isRedisAvailable = true;
        const mockRedis = queueService.redis;

        const futureJob = {
          id: 'future-job',
          scheduled_at: new Date(Date.now() + 60000).toISOString() // 1 minute future
        };

        mockRedis.rpop = jest
          .fn()
          .mockResolvedValueOnce(JSON.stringify(futureJob)) // Priority 1 - future
          .mockResolvedValueOnce(null) // Priority 2
          .mockResolvedValueOnce(null) // Priority 3
          .mockResolvedValueOnce(null) // Priority 4
          .mockResolvedValueOnce(null); // Priority 5

        const job = await queueService.getJobFromRedis('test_queue');

        expect(job).toBeNull();
      });
    });

    describe('getJobFromDatabase - Priority Order', () => {
      it('should query jobs ordered by priority ascending', async () => {
        const mockSingle = jest.fn(() =>
          Promise.resolve({ data: null, error: { code: 'PGRST116' } })
        );
        const mockLimit = jest.fn(() => ({ single: mockSingle }));
        const mockOrder = jest.fn(() => ({ order: jest.fn(() => ({ limit: mockLimit })) }));
        const mockLte = jest.fn(() => ({ order: mockOrder }));
        const mockEq2 = jest.fn(() => ({ lte: mockLte }));
        const mockEq1 = jest.fn(() => ({ eq: mockEq2 }));
        const mockSelect = jest.fn(() => ({ eq: mockEq1 }));
        const mockFrom = jest.fn(() => ({
          select: mockSelect,
          update: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ error: null }))
          }))
        }));
        queueService.supabase = { from: mockFrom };

        await queueService.getJobFromDatabase('test_queue');

        expect(mockOrder).toHaveBeenCalledWith('priority', { ascending: true });
      });

      it('should return null when no jobs available', async () => {
        const mockFrom = jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve({ data: null, error: null }))
              }))
            }))
          })),
          update: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ error: null }))
          }))
        }));
        queueService.supabase = { from: mockFrom };

        const job = await queueService.getJobFromDatabase('test_queue');

        expect(job).toBeNull();
      });
    });
  });

  describe('Error Handling Edge Cases', () => {
    describe('addJob - Error Scenarios', () => {
      it('should handle Redis failure and fallback to database', async () => {
        queueService.isRedisAvailable = true;
        const mockRedis = queueService.redis;
        mockRedis.lpush = jest.fn().mockRejectedValue(new Error('Redis connection lost'));

        // Mock database fallback success
        const mockFrom = jest.fn(() => ({
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: { id: 'fallback-job' },
                  error: null
                })
              )
            }))
          }))
        }));
        queueService.supabase = { from: mockFrom };

        const result = await queueService.addJob('test_queue', {
          organization_id: 'org-123',
          data: 'test'
        });

        expect(result.success).toBe(true);
        expect(result.queuedTo).toBe('database');
      });

      it('should return error when both Redis and database fail', async () => {
        queueService.isRedisAvailable = true;
        const mockRedis = queueService.redis;
        mockRedis.lpush = jest.fn().mockRejectedValue(new Error('Redis error'));

        const mockFrom = jest.fn(() => ({
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: null,
                  error: new Error('Database error')
                })
              )
            }))
          }))
        }));
        queueService.supabase = { from: mockFrom };

        const result = await queueService.addJob('test_queue', {
          organization_id: 'org-123'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe('failJob - Max Retries', () => {
      it('should move to DLQ when max retries exceeded', async () => {
        const mockMoveToDLQ = jest.spyOn(queueService, 'moveToDeadLetterQueue').mockResolvedValue();
        const mockRetry = jest.spyOn(queueService, 'retryJob').mockResolvedValue();

        const job = {
          id: 'job-123',
          attempts: 3,
          max_attempts: 3,
          job_type: 'test_queue'
        };
        const error = new Error('Failed');

        await queueService.failJob(job, error);

        expect(mockMoveToDLQ).toHaveBeenCalledWith(job, error);
        expect(mockRetry).not.toHaveBeenCalled();
      });

      it('should retry when attempts < max_attempts', async () => {
        const mockMoveToDLQ = jest.spyOn(queueService, 'moveToDeadLetterQueue').mockResolvedValue();
        const mockRetry = jest.spyOn(queueService, 'retryJob').mockResolvedValue();
        const mockIncrement = jest.spyOn(queueService, 'incrementMetric').mockResolvedValue();

        const job = {
          id: 'job-123',
          attempts: 1,
          max_attempts: 3,
          job_type: 'test_queue'
        };
        const error = new Error('Temporary failure');

        await queueService.failJob(job, error);

        // failJob increments attempts before calling retryJob: (1 + 1 = 2)
        expect(mockRetry).toHaveBeenCalledWith(job, 2, error);
        expect(mockMoveToDLQ).not.toHaveBeenCalled();
        expect(mockIncrement).toHaveBeenCalledWith('jobs_retried', 'test_queue');
      });

      it('should mark job as failed and increment metric when max retries reached', async () => {
        const mockMoveToDLQ = jest.spyOn(queueService, 'moveToDeadLetterQueue').mockResolvedValue();
        const mockMarkFailed = jest.spyOn(queueService, 'markJobAsFailed').mockResolvedValue();
        const mockIncrement = jest.spyOn(queueService, 'incrementMetric').mockResolvedValue();

        // Enable DLQ for this test
        queueService.options.deadLetterQueueEnabled = true;

        const job = {
          id: 'job-123',
          attempts: 2, // After increment will be 3
          max_attempts: 3,
          job_type: 'test_queue'
        };
        const error = new Error('Failed');

        await queueService.failJob(job, error);

        expect(mockMoveToDLQ).toHaveBeenCalledWith(job, error);
        expect(mockMarkFailed).toHaveBeenCalledWith(job, error);
        expect(mockIncrement).toHaveBeenCalledWith('jobs_failed', 'test_queue');
      });
    });
  });

  describe('Queue Statistics', () => {
    describe('getQueueStats - Redis Mode', () => {
      it('should return stats from Redis when available', async () => {
        queueService.isRedisAvailable = true;
        const mockGetRedisStats = jest.spyOn(queueService, 'getRedisStats').mockResolvedValue({
          queues: {
            test_queue: {
              byPriority: { 1: 2, 2: 1, 3: 2, 4: 0, 5: 0 },
              total: 5
            }
          },
          total: 5
        });

        const stats = await queueService.getQueueStats('test_queue');

        expect(mockGetRedisStats).toHaveBeenCalledWith('test_queue');
        expect(stats).toMatchObject({
          timestamp: expect.any(String),
          redis: true,
          database: expect.any(Boolean),
          redisStats: expect.objectContaining({
            queues: expect.objectContaining({
              test_queue: expect.any(Object)
            })
          })
        });
      });

      it('should return stats for all queues when no jobType specified', async () => {
        queueService.isRedisAvailable = true;
        const mockGetRedisStats = jest.spyOn(queueService, 'getRedisStats').mockResolvedValue({
          queues: {
            fetch_comments: { byPriority: {}, total: 3 },
            analyze_toxicity: { byPriority: {}, total: 5 },
            generate_roast: { byPriority: {}, total: 2 }
          },
          total: 10
        });

        const stats = await queueService.getQueueStats();

        expect(stats.redis).toBe(true);
        expect(stats.redisStats).toHaveProperty('queues');
        expect(stats.redisStats.queues).toHaveProperty('fetch_comments');
        expect(stats.redisStats.queues).toHaveProperty('analyze_toxicity');
        expect(stats.redisStats.queues).toHaveProperty('generate_roast');
      });
    });

    describe('getQueueStats - Database Mode', () => {
      it('should return stats from database when Redis unavailable', async () => {
        queueService.isRedisAvailable = false;
        const mockGetDBStats = jest.spyOn(queueService, 'getDatabaseStats').mockResolvedValue({
          byType: {
            test_queue: 10
          },
          byStatus: {
            pending: 10,
            processing: 1,
            completed: 50,
            failed: 2
          },
          byPriority: {},
          total: 63
        });

        const stats = await queueService.getQueueStats('test_queue');

        expect(mockGetDBStats).toHaveBeenCalledWith('test_queue');
        expect(stats).toMatchObject({
          timestamp: expect.any(String),
          redis: false,
          database: true,
          databaseStats: expect.objectContaining({
            byType: expect.any(Object),
            byStatus: expect.any(Object),
            total: 63
          })
        });
      });
    });

    describe('incrementMetric', () => {
      it('should increment metric in Redis', async () => {
        queueService.isRedisAvailable = true;
        const mockRedis = queueService.redis;
        mockRedis.incr = jest.fn().mockResolvedValue(1);
        mockRedis.expire = jest.fn().mockResolvedValue(1);

        await queueService.incrementMetric('completed', 'test_queue');

        expect(mockRedis.incr).toHaveBeenCalledWith('roastr:metrics:completed:test_queue');
        expect(mockRedis.expire).toHaveBeenCalledWith('roastr:metrics:completed:test_queue', 86400);
      });

      it('should do nothing when Redis unavailable', async () => {
        queueService.isRedisAvailable = false;

        // Should not throw
        await expect(queueService.incrementMetric('completed', 'test')).resolves.not.toThrow();
      });
    });
  });

  describe('Utility Methods', () => {
    describe('generateJobId', () => {
      it('should generate unique job IDs', () => {
        const id1 = queueService.generateJobId();
        const id2 = queueService.generateJobId();

        expect(id1).toBeDefined();
        expect(id2).toBeDefined();
        expect(id1).not.toBe(id2);
      });

      it('should generate ID with correct format (job_timestamp_random)', () => {
        const jobId = queueService.generateJobId();

        expect(jobId).toMatch(/^job_\d+_[a-z0-9]+$/);
      });
    });

    describe('getQueueKey', () => {
      it('should generate correct Redis key with priority', () => {
        const key = queueService.getQueueKey('test_queue', 1);

        expect(key).toBe('roastr:jobs:test_queue:p1');
      });

      it('should use default priority 5 when not specified', () => {
        const key = queueService.getQueueKey('test_queue');

        expect(key).toBe('roastr:jobs:test_queue:p5');
      });

      it('should handle different queue types', () => {
        const types = ['fetch_comments', 'analyze_toxicity', 'generate_roast', 'shield_action'];

        types.forEach((type) => {
          const key = queueService.getQueueKey(type, 3);
          expect(key).toContain(type);
          expect(key).toContain(':p3');
        });
      });
    });

    describe('shutdown', () => {
      it('should log shutdown message', async () => {
        const mockLog = jest.spyOn(queueService, 'log');

        await queueService.shutdown();

        expect(mockLog).toHaveBeenCalledWith('info', 'Shutting down Queue Service');
      });

      it('should handle shutdown gracefully even when not initialized', async () => {
        queueService.redis = null;
        queueService.supabase = null;

        await expect(queueService.shutdown()).resolves.not.toThrow();
      });
    });
  });

  // ========== PHASE 6: PUSH TO 75%+ COVERAGE ==========

  describe('Delayed/Scheduled Jobs', () => {
    it('should handle delayed jobs with options.delay', async () => {
      queueService.isRedisAvailable = true;
      queueService.redis = {
        lpush: jest.fn().mockResolvedValue(1),
        setex: jest.fn().mockResolvedValue('OK'),
        incr: jest.fn().mockResolvedValue(1)
      };

      const job = await queueService.addJobToRedis(
        {
          id: 'job-delayed',
          job_type: 'test_queue',
          payload: { test: 'data' },
          priority: 3
        },
        { delay: 5000 } // 5 seconds delay
      );

      expect(queueService.redis.setex).toHaveBeenCalledWith(
        expect.stringContaining(':delayed:job-delayed'),
        5,
        expect.any(String)
      );
      expect(job).toBeDefined();
      expect(job.id).toBe('job-delayed');
    });

    it('should handle delay without Redis', async () => {
      queueService.isRedisAvailable = false;
      const job = { id: 'job-1', job_type: 'test', payload: {}, priority: 3 };

      // Just verify it doesn't crash when Redis unavailable
      const result = await queueService.addJobToDatabase(job);
      expect(result).toBeDefined();
    });
  });

  describe('Stats Methods - Direct Testing', () => {
    describe('getRedisStats', () => {
      it('should return stats for all job types when no jobType specified', async () => {
        queueService.redis = {
          llen: jest
            .fn()
            .mockResolvedValueOnce(5) // fetch_comments p1
            .mockResolvedValueOnce(3) // fetch_comments p2
            .mockResolvedValueOnce(0) // fetch_comments p3
            .mockResolvedValueOnce(0) // fetch_comments p4
            .mockResolvedValueOnce(0) // fetch_comments p5
            .mockResolvedValueOnce(2) // analyze_toxicity p1
            .mockResolvedValueOnce(1) // analyze_toxicity p2
            .mockResolvedValueOnce(0) // analyze_toxicity p3
            .mockResolvedValueOnce(0) // analyze_toxicity p4
            .mockResolvedValueOnce(0) // analyze_toxicity p5
            .mockResolvedValue(0) // remaining
        };

        const stats = await queueService.getRedisStats();

        expect(stats.total).toBe(11);
        expect(stats.queues.fetch_comments).toBeDefined();
        expect(stats.queues.fetch_comments.total).toBe(8);
        expect(stats.queues.analyze_toxicity.total).toBe(3);
      });

      it('should return stats for specific job type', async () => {
        queueService.redis = {
          llen: jest.fn().mockResolvedValue(2)
        };

        const stats = await queueService.getRedisStats('test_queue');

        expect(stats.queues.test_queue).toBeDefined();
        expect(stats.queues.test_queue.total).toBe(10); // 2 * 5 priorities
      });
    });

    describe('getDatabaseStats', () => {
      it('should process stats by type, status, and priority', async () => {
        const mockJobs = [
          { job_type: 'fetch', status: 'pending', priority: 1 },
          { job_type: 'fetch', status: 'pending', priority: 2 },
          { job_type: 'analyze', status: 'processing', priority: 1 },
          { job_type: 'analyze', status: 'failed', priority: 3 }
        ];

        queueService.supabase = {
          from: jest.fn(() => ({
            select: jest.fn(() => ({
              apply: jest.fn(() => Promise.resolve({ data: mockJobs, error: null }))
            }))
          }))
        };

        const result = await queueService.getDatabaseStats();

        expect(result.total).toBe(4);
        expect(result.byType.fetch).toBe(2);
        expect(result.byType.analyze).toBe(2);
        expect(result.byStatus.pending).toBe(2);
        expect(result.byStatus.processing).toBe(1);
        expect(result.byStatus.failed).toBe(1);
        expect(result.byPriority[1]).toBe(2);
        expect(result.byPriority[2]).toBe(1);
        expect(result.byPriority[3]).toBe(1);
      });

      it('should throw error when database query fails', async () => {
        queueService.supabase = {
          from: jest.fn(() => ({
            select: jest.fn(() => ({
              apply: jest.fn(() =>
                Promise.resolve({
                  data: [],
                  error: new Error('Database connection failed')
                })
              )
            }))
          }))
        };

        await expect(queueService.getDatabaseStats()).rejects.toThrow('Database connection failed');
      });

      it('should filter by job type', async () => {
        const mockJobs = [
          { job_type: 'test', status: 'pending', priority: 1 },
          { job_type: 'test', status: 'processing', priority: 2 }
        ];

        queueService.supabase = {
          from: jest.fn(() => ({
            select: jest.fn(() => ({
              apply: jest.fn(() => Promise.resolve({ data: mockJobs, error: null }))
            }))
          }))
        };

        const result = await queueService.getDatabaseStats('test');

        expect(result.total).toBe(2);
        expect(result.byType.test).toBe(2);
      });
    });
  });
});
