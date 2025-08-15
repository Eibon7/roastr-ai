/**
 * Queue Service Tests
 * 
 * Tests for unified Redis/Database queue management with priority support
 */

const QueueService = require('../../../src/services/queueService');
const IORedis = require('ioredis');

// Mock IORedis
jest.mock('ioredis', () => {
  const mockRedis = {
    lpush: jest.fn(),
    brpop: jest.fn(),
    llen: jest.fn(),
    lrange: jest.fn(),
    del: jest.fn(),
    ping: jest.fn(),
    disconnect: jest.fn(),
    status: 'ready'
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
            limit: jest.fn(() => Promise.resolve({ data: null, error: null })),
            single: jest.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        })),
        order: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
        })),
        in: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        })),
        limit: jest.fn(() => Promise.resolve({ data: null, error: null }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn()
          }))
        }))
      })),
      delete: jest.fn(() => ({
        eq: jest.fn()
      }))
    }))
  }))
}));

describe('QueueService', () => {
  let queueService;
  let mockRedis;
  let mockSupabase;

  beforeEach(() => {
    // Mock environment variables
    process.env.UPSTASH_REDIS_REST_URL = 'redis://test:6379';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-key';
    
    queueService = new QueueService();
    
    // Get mocked instances
    mockRedis = IORedis();
    mockSupabase = queueService.supabase;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    test('should initialize with Redis available', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      await queueService.initialize();

      expect(queueService.isRedisAvailable).toBe(true);
      expect(queueService.isDatabaseAvailable).toBe(true);
    });

    test('should fallback to database only when Redis unavailable', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Redis connection failed'));

      await queueService.initialize();

      expect(queueService.isRedisAvailable).toBe(false);
      expect(queueService.isDatabaseAvailable).toBe(true);
    });
  });

  describe('addJob', () => {
    beforeEach(async () => {
      mockRedis.ping.mockResolvedValue('PONG');
      await queueService.initialize();
    });

    test('should add job to Redis queue with correct priority', async () => {
      const jobData = {
        organization_id: 'org-123',
        platform: 'twitter',
        action_type: 'fetch_comments',
        payload: { comment_id: 'comment-456' }
      };

      mockRedis.lpush.mockResolvedValue(1);

      const result = await queueService.addJob('fetch_comments', jobData, 2);

      expect(result.success).toBe(true);
      expect(result.jobId).toBeDefined();
      expect(result.queuedTo).toBe('redis');
      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'roastr:queue:fetch_comments:priority:2',
        expect.stringContaining(jobData.organization_id)
      );
    });

    test('should fallback to database when Redis fails', async () => {
      const jobData = {
        organization_id: 'org-123',
        platform: 'twitter',
        action_type: 'fetch_comments'
      };

      mockRedis.lpush.mockRejectedValue(new Error('Redis error'));
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'job-123' },
              error: null
            })
          })
        })
      });

      const result = await queueService.addJob('fetch_comments', jobData, 2);

      expect(result.success).toBe(true);
      expect(result.queuedTo).toBe('database');
    });

    test('should add Shield job with high priority', async () => {
      const jobData = {
        organization_id: 'org-123',
        platform: 'twitter',
        action_type: 'shield_action',
        user_id: 'user-456',
        severity: 'high'
      };

      mockRedis.lpush.mockResolvedValue(1);

      const result = await queueService.addJob('shield_action', jobData, 1);

      expect(result.success).toBe(true);
      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'roastr:queue:shield_action:priority:1',
        expect.any(String)
      );
    });
  });

  describe('getNextJob', () => {
    beforeEach(async () => {
      mockRedis.ping.mockResolvedValue('PONG');
      await queueService.initialize();
    });

    test('should get job from Redis queue by priority', async () => {
      const jobData = {
        id: 'job-123',
        organization_id: 'org-123',
        job_type: 'fetch_comments',
        payload: { comment_id: 'comment-456' },
        priority: 2,
        created_at: new Date().toISOString()
      };

      // Mock priority queue checks
      mockRedis.brpop
        .mockResolvedValueOnce(null) // Priority 1 (Critical)
        .mockResolvedValueOnce(['roastr:queue:fetch_comments:priority:2', JSON.stringify(jobData)]) // Priority 2 (High)
        .mockResolvedValueOnce(null); // Priority 3 (Medium)

      const result = await queueService.getNextJob('fetch_comments', { timeout: 1 });

      expect(result).toBeDefined();
      expect(result.id).toBe('job-123');
      expect(result.organization_id).toBe('org-123');
      expect(mockRedis.brpop).toHaveBeenCalledTimes(2);
    });

    test('should get job from database when Redis returns null', async () => {
      // Redis returns no jobs
      mockRedis.brpop.mockResolvedValue(null);

      const dbJob = {
        id: 'db-job-123',
        organization_id: 'org-123',
        job_type: 'fetch_comments',
        payload: { comment_id: 'comment-456' },
        priority: 2
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [dbJob],
                  error: null
                })
              })
            })
          })
        })
      });

      // Mock job claim update
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [dbJob],
                  error: null
                })
              })
            })
          })
        })
      }).mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: dbJob,
                error: null
              })
            })
          })
        })
      });

      const result = await queueService.getNextJob('fetch_comments', { timeout: 1 });

      expect(result).toBeDefined();
      expect(result.id).toBe('db-job-123');
    });

    test('should return null when no jobs available', async () => {
      mockRedis.brpop.mockResolvedValue(null);
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          })
        })
      });

      const result = await queueService.getNextJob('fetch_comments', { timeout: 1 });

      expect(result).toBeNull();
    });
  });

  describe('completeJob', () => {
    test('should mark job as completed in database', async () => {
      const job = {
        id: 'job-123',
        job_type: 'fetch_comments',
        organization_id: 'org-123'
      };

      const result = { processed: 5, errors: 0 };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })
      });

      await queueService.completeJob(job, result);

      expect(mockSupabase.from).toHaveBeenCalledWith('job_queue');
    });
  });

  describe('failJob', () => {
    test('should handle job failure with retry logic', async () => {
      const job = {
        id: 'job-123',
        job_type: 'fetch_comments',
        attempts: 2,
        max_attempts: 3
      };

      const error = new Error('Processing failed');

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })
      });

      await queueService.failJob(job, error);

      expect(mockSupabase.from).toHaveBeenCalledWith('job_queue');
    });

    test('should move job to DLQ after max attempts', async () => {
      const job = {
        id: 'job-123',
        job_type: 'fetch_comments',
        attempts: 3,
        max_attempts: 3
      };

      const error = new Error('Final failure');

      mockRedis.ping.mockResolvedValue('PONG');
      await queueService.initialize();

      mockRedis.lpush.mockResolvedValue(1);
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })
      });

      await queueService.failJob(job, error);

      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'roastr:dlq:fetch_comments',
        expect.any(String)
      );
    });
  });

  describe('getQueueStats', () => {
    test('should return comprehensive queue statistics', async () => {
      mockRedis.ping.mockResolvedValue('PONG');
      await queueService.initialize();

      // Mock Redis stats
      mockRedis.llen
        .mockResolvedValueOnce(2) // fetch_comments priority 1
        .mockResolvedValueOnce(5) // fetch_comments priority 2
        .mockResolvedValueOnce(1) // analyze_toxicity priority 1
        .mockResolvedValueOnce(0) // analyze_toxicity priority 2
        .mockResolvedValueOnce(0) // generate_reply priority 1
        .mockResolvedValueOnce(3); // generate_reply priority 2

      // Mock database stats
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: [
            { status: 'pending', job_type: 'fetch_comments', priority: 1, count: 5 },
            { status: 'processing', job_type: 'analyze_toxicity', priority: 2, count: 2 },
            { status: 'failed', job_type: 'generate_reply', priority: 1, count: 1 }
          ],
          error: null
        })
      });

      const stats = await queueService.getQueueStats();

      expect(stats.redis).toBe(true);
      expect(stats.database).toBe(true);
      expect(stats.redisStats.total).toBe(11); // Sum of all Redis queue lengths
      expect(stats.databaseStats.total).toBe(8); // Sum of database counts
      expect(stats.redisStats.queues.fetch_comments.total).toBe(7);
      expect(stats.databaseStats.byStatus.pending).toBe(5);
    });

    test('should handle database-only statistics', async () => {
      queueService.isRedisAvailable = false;

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: [
            { status: 'pending', job_type: 'fetch_comments', priority: 2, count: 3 }
          ],
          error: null
        })
      });

      const stats = await queueService.getQueueStats();

      expect(stats.redis).toBe(false);
      expect(stats.database).toBe(true);
      expect(stats.redisStats).toBeNull();
      expect(stats.databaseStats.total).toBe(3);
    });
  });

  describe('error handling', () => {
    test('should handle Redis connection errors gracefully', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection failed'));

      await queueService.initialize();

      expect(queueService.isRedisAvailable).toBe(false);
      expect(queueService.isDatabaseAvailable).toBe(true);
    });

    test('should handle malformed job data', async () => {
      mockRedis.ping.mockResolvedValue('PONG');
      await queueService.initialize();

      mockRedis.brpop.mockResolvedValue(['queue:test', 'invalid-json']);

      const result = await queueService.getNextJob('fetch_comments');

      expect(result).toBeNull();
    });
  });

  describe('queue key generation', () => {
    test('should generate correct queue keys for different priorities', () => {
      const key1 = queueService.getQueueKey('fetch_comments', 1);
      const key2 = queueService.getQueueKey('shield_action', 5);

      expect(key1).toBe('roastr:queue:fetch_comments:priority:1');
      expect(key2).toBe('roastr:queue:shield_action:priority:5');
    });

    test('should handle default priority', () => {
      const key = queueService.getQueueKey('analyze_toxicity');

      expect(key).toBe('roastr:queue:analyze_toxicity:priority:3');
    });
  });

  describe('shutdown', () => {
    test('should close all connections gracefully', async () => {
      mockRedis.ping.mockResolvedValue('PONG');
      await queueService.initialize();

      await queueService.shutdown();

      expect(mockRedis.disconnect).toHaveBeenCalled();
    });
  });
});