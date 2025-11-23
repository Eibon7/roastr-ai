/**
 * Worker Metrics API Tests
 *
 * Tests for worker monitoring endpoints (Issue #713)
 * - GET /api/workers/metrics
 * - GET /api/workers/:workerType/metrics
 * - GET /api/workers/queues/status
 */

const express = require('express');
const request = require('supertest');
const { router, setWorkerManager } = require('../../../src/routes/workers');

// Mock QueueService
jest.mock('../../../src/services/queueService', () => {
  return jest.fn().mockImplementation(() => ({
    getQueueStats: jest.fn()
  }));
});

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  }
}));

// Mock auth middleware
jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'test-user', isAdmin: true };
    next();
  }
}));

describe('Worker Metrics API Routes', () => {
  let app;
  let mockManager;
  let mockQueueService;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/workers', router);

    // Mock WorkerManager
    mockManager = {
      getHealthStatus: jest.fn().mockResolvedValue({
        overallStatus: 'healthy',
        healthyWorkers: 3,
        totalWorkers: 4,
        workers: {
          fetch_comments: { status: 'healthy', workerType: 'fetch_comments' },
          analyze_toxicity: { status: 'healthy', workerType: 'analyze_toxicity' },
          generate_reply: { status: 'healthy', workerType: 'generate_reply' },
          shield_action: { status: 'warning', workerType: 'shield_action' }
        }
      }),
      getStats: jest.fn().mockReturnValue({
        managerStatus: { isRunning: true },
        workers: {
          fetch_comments: {
            processedJobs: 100,
            failedJobs: 2,
            currentJobs: 1,
            uptime: 3600000
          },
          analyze_toxicity: {
            processedJobs: 150,
            failedJobs: 3,
            currentJobs: 2,
            uptime: 3600000
          },
          generate_reply: {
            processedJobs: 80,
            failedJobs: 1,
            currentJobs: 0,
            uptime: 3600000
          },
          shield_action: {
            processedJobs: 50,
            failedJobs: 5,
            currentJobs: 1,
            uptime: 3600000
          }
        }
      }),
      getSummary: jest.fn().mockReturnValue({
        isRunning: true,
        workersCount: 4,
        totalJobsProcessed: 380,
        totalJobsFailed: 11,
        currentJobsProcessing: 4,
        uptime: 3600000
      })
    };

    setWorkerManager(mockManager);

    // Mock QueueService
    const QueueService = require('../../../src/services/queueService');
    mockQueueService = new QueueService();

    // Mock getQueueStats for each queue type
    mockQueueService.getQueueStats = jest.fn().mockImplementation((queueType) => {
      const mockStats = {
        fetch_comments: {
          pending: 10,
          processing: 2,
          completed: 100,
          failed: 2,
          dlq: 1,
          healthStatus: 'healthy',
          avgProcessingTime: 1500
        },
        analyze_toxicity: {
          pending: 5,
          processing: 1,
          completed: 150,
          failed: 3,
          dlq: 0,
          healthStatus: 'healthy',
          avgProcessingTime: 2000
        },
        generate_reply: {
          pending: 8,
          processing: 0,
          completed: 80,
          failed: 1,
          dlq: 0,
          healthStatus: 'healthy',
          avgProcessingTime: 3000
        },
        shield_action: {
          pending: 2,
          processing: 1,
          completed: 50,
          failed: 5,
          dlq: 2,
          healthStatus: 'warning',
          avgProcessingTime: 1000
        },
        post_response: {
          pending: 3,
          processing: 0,
          completed: 60,
          failed: 0,
          dlq: 0,
          healthStatus: 'healthy',
          avgProcessingTime: 2500
        }
      };

      return Promise.resolve(
        mockStats[queueType] || {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          dlq: 0,
          healthStatus: 'unknown',
          avgProcessingTime: 0
        }
      );
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/workers/metrics', () => {
    it('should return comprehensive metrics for all workers', async () => {
      const response = await request(app).get('/api/workers/metrics').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');

      const { data } = response.body;

      // Check workers metrics
      expect(data.workers).toHaveProperty('total', 4);
      expect(data.workers).toHaveProperty('healthy', 3);
      expect(data.workers).toHaveProperty('unhealthy', 1);
      expect(data.workers).toHaveProperty('status', 'healthy');
      expect(data.workers.details).toHaveLength(4);

      // Check queues metrics
      expect(data.queues).toHaveProperty('totalDepth');
      expect(data.queues).toHaveProperty('totalProcessing');
      expect(data.queues).toHaveProperty('totalFailed');
      expect(data.queues).toHaveProperty('totalDLQ');
      expect(data.queues).toHaveProperty('byQueue');
      expect(Object.keys(data.queues.byQueue)).toHaveLength(5);

      // Check jobs metrics
      expect(data.jobs).toHaveProperty('totalProcessed', 380);
      expect(data.jobs).toHaveProperty('totalFailed', 11);
      expect(data.jobs).toHaveProperty('currentProcessing', 4);
      expect(data.jobs).toHaveProperty('successRate');

      // Check performance metrics
      expect(data.performance).toHaveProperty('uptime');
      expect(data.performance).toHaveProperty('averageProcessingTime');

      expect(data).toHaveProperty('timestamp');
    });

    it('should return 503 when workers are not initialized', async () => {
      setWorkerManager(null);

      const response = await request(app).get('/api/workers/metrics').expect(503);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Workers not initialized');
    });

    it('should handle queue service errors gracefully', async () => {
      mockQueueService.getQueueStats.mockRejectedValueOnce(new Error('Queue service error'));

      const response = await request(app).get('/api/workers/metrics').expect(200);

      // Should still return metrics but with error info for failed queue
      expect(response.body.success).toBe(true);
      expect(response.body.data.queues.byQueue).toBeDefined();
    });
  });

  describe('GET /api/workers/:workerType/metrics', () => {
    it('should return metrics for a specific worker', async () => {
      const response = await request(app).get('/api/workers/fetch_comments/metrics').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');

      const { data } = response.body;

      expect(data).toHaveProperty('workerType', 'fetch_comments');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('health');
      expect(data).toHaveProperty('stats');

      expect(data.stats).toHaveProperty('processedJobs', 100);
      expect(data.stats).toHaveProperty('failedJobs', 2);
      expect(data.stats).toHaveProperty('currentJobs', 1);
      expect(data.stats).toHaveProperty('uptime', 3600000);
      expect(data.stats).toHaveProperty('successRate');
    });

    it('should return 404 for non-existent worker', async () => {
      const response = await request(app).get('/api/workers/nonexistent/metrics').expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Worker not found');
    });

    it('should return 503 when workers are not initialized', async () => {
      setWorkerManager(null);

      const response = await request(app).get('/api/workers/fetch_comments/metrics').expect(503);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Workers not initialized');
    });

    it('should calculate success rate correctly', async () => {
      const response = await request(app).get('/api/workers/fetch_comments/metrics').expect(200);

      const { stats } = response.body.data;
      const expectedRate = (((100 - 2) / 100) * 100).toFixed(2) + '%';
      expect(stats.successRate).toBe(expectedRate);
    });
  });

  describe('GET /api/workers/queues/status', () => {
    it('should return status for all queues', async () => {
      const response = await request(app).get('/api/workers/queues/status').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');

      const { data } = response.body;

      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('queues');
      expect(data).toHaveProperty('summary');

      // Check that all queue types are present
      expect(data.queues).toHaveProperty('fetch_comments');
      expect(data.queues).toHaveProperty('analyze_toxicity');
      expect(data.queues).toHaveProperty('generate_reply');
      expect(data.queues).toHaveProperty('shield_action');
      expect(data.queues).toHaveProperty('post_response');

      // Check queue structure
      const queue = data.queues.fetch_comments;
      expect(queue).toHaveProperty('pending', 10);
      expect(queue).toHaveProperty('processing', 2);
      expect(queue).toHaveProperty('completed', 100);
      expect(queue).toHaveProperty('failed', 2);
      expect(queue).toHaveProperty('dlq', 1);
      expect(queue).toHaveProperty('healthStatus', 'healthy');
      expect(queue).toHaveProperty('avgProcessingTime', 1500);
      expect(queue).toHaveProperty('lastUpdated');

      // Check summary
      expect(data.summary).toHaveProperty('totalPending');
      expect(data.summary).toHaveProperty('totalProcessing');
      expect(data.summary).toHaveProperty('totalDLQ');

      expect(data.summary.totalPending).toBe(28); // 10+5+8+2+3
      expect(data.summary.totalProcessing).toBe(4); // 2+1+0+1+0
      expect(data.summary.totalDLQ).toBe(3); // 1+0+0+2+0
    });

    it('should handle queue service errors gracefully', async () => {
      mockQueueService.getQueueStats.mockRejectedValueOnce(new Error('Queue error'));

      const response = await request(app).get('/api/workers/queues/status').expect(200);

      expect(response.body.success).toBe(true);
      // Should still return other queues
      expect(Object.keys(response.body.data.queues).length).toBeGreaterThan(0);
    });

    it('should return correct totals in summary', async () => {
      const response = await request(app).get('/api/workers/queues/status').expect(200);

      const { summary } = response.body.data;

      // Verify totals match individual queue values
      const queues = response.body.data.queues;
      const calculatedPending = Object.values(queues).reduce((sum, q) => sum + (q.pending || 0), 0);
      const calculatedProcessing = Object.values(queues).reduce(
        (sum, q) => sum + (q.processing || 0),
        0
      );
      const calculatedDLQ = Object.values(queues).reduce((sum, q) => sum + (q.dlq || 0), 0);

      expect(summary.totalPending).toBe(calculatedPending);
      expect(summary.totalProcessing).toBe(calculatedProcessing);
      expect(summary.totalDLQ).toBe(calculatedDLQ);
    });
  });
});
