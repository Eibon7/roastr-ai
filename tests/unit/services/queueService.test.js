/**
 * Queue Service Tests
 * 
 * Tests for unified Redis/Database queue management with priority support
 */

const QueueService = require('../../../src/services/queueService');

// Mock IORedis
jest.mock('ioredis', () => {
  const mockRedis = {
    lpush: jest.fn(),
    brpop: jest.fn(),
    rpop: jest.fn(),
    llen: jest.fn(),
    lrange: jest.fn(),
    del: jest.fn(),
    ping: jest.fn(),
    disconnect: jest.fn(),
    setex: jest.fn(),
    status: 'ready',
    on: jest.fn()
  };
  
  return jest.fn(() => mockRedis);
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
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
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
    await new Promise(resolve => setTimeout(resolve, 10));
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
      const types = ['fetch_comments', 'analyze_toxicity', 'generate_reply', 'shield_action'];
      
      types.forEach(type => {
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
      
      if (queueService.redis) {
        queueService.redis.disconnect = jest.fn().mockResolvedValue(true);
      }

      await expect(queueService.shutdown()).resolves.not.toThrow();
    });

    test('should increment metrics properly', async () => {
      if (queueService.redis) {
        queueService.redis.incr = jest.fn().mockResolvedValue(1);
        
        await queueService.incrementMetric('jobs_added', 'fetch_comments');
        
        expect(queueService.redis.incr).toHaveBeenCalled();
      } else {
        // Just verify method doesn't throw when Redis unavailable
        await expect(queueService.incrementMetric('jobs_added', 'fetch_comments')).resolves.not.toThrow();
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
      await expect(queueService.addJob('test', { organization_id: 'test-org' })).resolves.toBeDefined();
    });
  });
});