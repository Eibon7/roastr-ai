/**
 * BaseWorker Healthcheck Tests
 *
 * Tests for the healthcheck functionality in BaseWorker and all worker types
 */

// Mock dependencies (must be declared before imports)
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        limit: jest.fn(() => ({
          single: jest.fn(() => ({ error: null }))
        }))
      }))
    }))
  }))
}));

// Mock googleapis
jest.mock('googleapis', () => ({
  google: {
    commentanalyzer: jest.fn(() => ({
      comments: {
        analyze: jest.fn()
      }
    })),
    youtube: jest.fn(() => ({
      search: {
        list: jest.fn().mockResolvedValue({ data: { items: [] } })
      }
    }))
  }
}));

// Import after mocks
const BaseWorker = require('../../../src/workers/BaseWorker');
const FetchCommentsWorker = require('../../../src/workers/FetchCommentsWorker');
const AnalyzeToxicityWorker = require('../../../src/workers/AnalyzeToxicityWorker');
const GenerateReplyWorker = require('../../../src/workers/GenerateReplyWorker');
const ShieldActionWorker = require('../../../src/workers/ShieldActionWorker');
const WorkerManager = require('../../../src/workers/WorkerManager');

jest.mock('../../../src/services/queueService', () => {
  return jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    getNextJob: jest.fn().mockResolvedValue(null),
    completeJob: jest.fn().mockResolvedValue(true),
    failJob: jest.fn().mockResolvedValue(true),
    shutdown: jest.fn().mockResolvedValue(true)
  }));
});

jest.mock('../../../src/services/costControl', () => {
  return jest.fn().mockImplementation(() => ({
    checkUsage: jest.fn().mockResolvedValue({ allowed: true }),
    trackUsage: jest.fn().mockResolvedValue(true)
  }));
});

jest.mock('../../../src/services/shieldService', () => {
  return jest.fn().mockImplementation(() => ({
    analyzeContent: jest.fn().mockResolvedValue({ shouldAct: false }),
    mode: 'active',
    ruleCount: 5
  }));
});

jest.mock('../../../src/config/mockMode', () => ({
  mockMode: {
    isMockMode: false,
    generateMockSupabaseClient: jest.fn(),
    generateMockOpenAI: jest.fn(),
    generateMockPerspective: jest.fn()
  }
}));

describe('BaseWorker Healthcheck', () => {
  let worker;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'http://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-key';
  });

  afterEach(() => {
    if (worker && worker.stop) {
      worker.stop();
    }
  });

  describe('healthcheck() method', () => {
    it('should return comprehensive health status', async () => {
      worker = new BaseWorker('test_worker');
      worker.isRunning = true;
      worker.processedJobs = 100;
      worker.failedJobs = 5;
      worker.currentJobs = new Map();
      worker.lastActivityTime = Date.now();
      worker.processingTimes = [100, 200, 150, 120, 180];

      const health = await worker.healthcheck();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('workerType', 'test_worker');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('checks');
      expect(health).toHaveProperty('metrics');
      expect(health).toHaveProperty('details');
    });

    it('should check running status correctly', async () => {
      worker = new BaseWorker('test_worker');
      worker.isRunning = true;
      worker.currentJobs = new Map();

      const health = await worker.healthcheck();

      expect(health.checks.running.status).toBe('healthy');
      expect(health.checks.running.message).toBe('Worker is running');

      worker.isRunning = false;
      const unhealthyCheck = await worker.healthcheck();
      expect(unhealthyCheck.checks.running.status).toBe('unhealthy');
    });

    it('should check database connection', async () => {
      worker = new BaseWorker('test_worker');
      worker.isRunning = true;
      worker.currentJobs = new Map();

      const health = await worker.healthcheck();

      expect(health.checks.database.status).toBe('healthy');
      expect(health.checks.database.message).toBe('Database connection OK');
    });

    it('should check queue service', async () => {
      worker = new BaseWorker('test_worker');
      worker.isRunning = true;
      worker.currentJobs = new Map();

      const health = await worker.healthcheck();

      expect(health.checks.queue.status).toBe('healthy');
      expect(health.checks.queue.message).toBe('Queue service is operational');
    });

    it('should detect processing inactivity', async () => {
      worker = new BaseWorker('test_worker');
      worker.isRunning = true;
      worker.currentJobs = new Map();
      worker.processedJobs = 10;
      worker.lastActivityTime = Date.now() - 600000; // 10 minutes ago

      const health = await worker.healthcheck();

      expect(health.checks.processing.status).toBe('warning');
      expect(health.checks.processing.message).toContain('No activity for');
    });

    it('should calculate performance metrics', async () => {
      worker = new BaseWorker('test_worker');
      worker.isRunning = true;
      worker.currentJobs = new Map();
      worker.processedJobs = 100;
      worker.failedJobs = 30; // 30% failure rate

      const health = await worker.healthcheck();

      expect(health.checks.performance.status).toBe('warning');
      expect(health.checks.performance.message).toContain('Elevated failure rate');
    });

    it('should determine overall health status correctly', async () => {
      worker = new BaseWorker('test_worker');
      worker.isRunning = true;
      worker.currentJobs = new Map();
      worker.processedJobs = 100;
      worker.failedJobs = 5;

      const health = await worker.healthcheck();
      expect(health.status).toBe('healthy');

      // Make it unhealthy
      worker.isRunning = false;
      const unhealthyCheck = await worker.healthcheck();
      expect(unhealthyCheck.status).toBe('unhealthy');
    });
  });

  describe('processing time tracking', () => {
    it('should track processing times correctly', async () => {
      worker = new BaseWorker('test_worker');
      worker.processingTimes = [100, 200, 150];

      const avgTime = worker.getAverageProcessingTime();
      expect(avgTime).toBe('150ms');
    });

    it('should handle no processing times', async () => {
      worker = new BaseWorker('test_worker');

      const avgTime = worker.getAverageProcessingTime();
      expect(avgTime).toBe('N/A');
    });
  });
});

describe('FetchCommentsWorker Healthcheck', () => {
  let worker;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'http://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-key';
    process.env.TWITTER_BEARER_TOKEN = 'test-token';
  });

  afterEach(() => {
    if (worker && worker.stop) {
      worker.stop();
    }
  });

  it('should provide worker-specific health details', async () => {
    worker = new FetchCommentsWorker();
    worker.isRunning = true;
    worker.currentJobs = new Map();
    worker.rateLimitInfo = { twitter: { remaining: 100, reset: Date.now() + 3600000 } };
    worker.lastFetchCounts = { twitter: 25 };

    const health = await worker.healthcheck();

    expect(health.details).toHaveProperty('platformClients');
    expect(health.details).toHaveProperty('rateLimits');
    expect(health.details).toHaveProperty('lastFetchCounts');
    expect(health.details).toHaveProperty('costControl');
    expect(health.details.platformClients.twitter).toEqual({
      initialized: true,
      status: 'available'
    });
  });
});

describe('AnalyzeToxicityWorker Healthcheck', () => {
  let worker;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'http://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-key';
    process.env.PERSPECTIVE_API_KEY = 'test-key';
  });

  afterEach(() => {
    if (worker && worker.stop) {
      worker.stop();
    }
  });

  it('should provide API status in health details', async () => {
    worker = new AnalyzeToxicityWorker();
    worker.isRunning = true;
    worker.currentJobs = new Map();
    worker.totalAnalyzed = 1000;
    worker.toxicDetected = 150;
    worker.perspectiveErrors = 2;

    const health = await worker.healthcheck();

    expect(health.details.apis).toHaveProperty('perspective');
    expect(health.details.apis).toHaveProperty('openai');
    expect(health.details.apis.perspective.apiKey).toBe('configured');
    expect(health.details.toxicityStats.total).toBe(1000);
    expect(health.details.toxicityStats.toxic).toBe(150);
  });
});

describe('GenerateReplyWorker Healthcheck', () => {
  let worker;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'http://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-key';
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    if (worker && worker.stop) {
      worker.stop();
    }
  });

  it('should provide generation stats in health details', async () => {
    worker = new GenerateReplyWorker();
    worker.isRunning = true;
    worker.currentJobs = new Map();
    worker.totalGenerated = 500;
    worker.fallbackUseCount = 10;
    worker.avgTokensUsed = 150;

    const health = await worker.healthcheck();

    expect(health.details.openai).toHaveProperty('available');
    expect(health.details.openai.apiKey).toBe('configured');
    expect(health.details.generationStats.total).toBe(500);
    expect(health.details.openai.fallbackCount).toBe(10);
  });
});

describe('ShieldActionWorker Healthcheck', () => {
  let worker;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'http://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-key';
  });

  afterEach(() => {
    if (worker && worker.stop) {
      worker.stop();
    }
  });

  it('should provide Shield action stats in health details', async () => {
    worker = new ShieldActionWorker();
    worker.isRunning = true;
    worker.currentJobs = new Map();

    const health = await worker.healthcheck();

    // Verify worker metrics structure (actual implementation)
    expect(health.details.workerMetrics).toBeDefined();
    expect(health.details.workerMetrics).toHaveProperty('totalProcessed');
    expect(health.details.workerMetrics).toHaveProperty('successfulActions');
    expect(health.details.workerMetrics).toHaveProperty('failedActions');
    expect(health.details.workerMetrics).toHaveProperty('fallbackActions');

    // Verify action executor details
    expect(health.details.actionExecutor).toBeDefined();
    expect(health.details.actionExecutor).toHaveProperty('metrics');
    expect(health.details.actionExecutor).toHaveProperty('circuitBreakers');
    expect(health.details.actionExecutor).toHaveProperty('supportedPlatforms');

    // Verify services status
    expect(health.details.persistence).toHaveProperty('connected');
    expect(health.details.costControl).toHaveProperty('enabled');
  });
});

describe('WorkerManager Healthcheck', () => {
  let manager;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'http://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-key';
  });

  afterEach(async () => {
    if (manager && manager.stop) {
      await manager.stop();
    }
  });

  it('should perform health checks on all workers', async () => {
    manager = new WorkerManager({
      enabledWorkers: ['fetch_comments'],
      workerConfig: {
        fetch_comments: { maxConcurrency: 1 }
      }
    });

    await manager.start();
    const health = await manager.getHealthStatus();

    expect(health).toHaveProperty('timestamp');
    expect(health).toHaveProperty('managerUptime');
    expect(health).toHaveProperty('totalWorkers', 1);
    expect(health).toHaveProperty('healthyWorkers');
    expect(health).toHaveProperty('workers');
    expect(health).toHaveProperty('overallStatus');
  });

  it('should determine overall health status', async () => {
    manager = new WorkerManager({
      enabledWorkers: ['fetch_comments', 'analyze_toxicity'],
      workerConfig: {
        fetch_comments: { maxConcurrency: 1 },
        analyze_toxicity: { maxConcurrency: 1 }
      }
    });

    await manager.start();
    const health = await manager.getHealthStatus();

    expect(health.overallStatus).toBe('healthy');
    expect(health.healthyWorkers).toBe(2);
  });
});

describe('Worker Status API Routes', () => {
  const { router, setWorkerManager } = require('../../../src/routes/workers');
  const express = require('express');
  const request = require('supertest');

  let app;
  let mockManager;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/workers', router);

    mockManager = {
      getHealthStatus: jest.fn().mockResolvedValue({
        overallStatus: 'healthy',
        healthyWorkers: 2,
        totalWorkers: 2,
        uptime: 3600000, // 1 hour in milliseconds
        workers: {
          fetch_comments: { status: 'healthy' },
          analyze_toxicity: { status: 'healthy' }
        }
      }),
      getStats: jest.fn().mockReturnValue({
        managerStatus: { isRunning: true },
        workers: {}
      }),
      getSummary: jest.fn().mockReturnValue({
        isRunning: true,
        workersCount: 2,
        totalJobsProcessed: 100,
        totalJobsFailed: 5,
        currentJobsProcessing: 3,
        uptime: 3600000 // 1 hour in milliseconds
      })
    };

    setWorkerManager(mockManager);
  });

  it('should return health status via API', async () => {
    const response = await request(app).get('/api/workers/health').expect(200);

    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('workers');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('jobs');
  });

  it('should return 503 when workers are unhealthy', async () => {
    mockManager.getHealthStatus.mockResolvedValue({
      overallStatus: 'unhealthy',
      healthyWorkers: 0,
      totalWorkers: 2,
      workers: {}
    });

    const response = await request(app).get('/api/workers/health').expect(503);

    expect(response.body.status).toBe('unhealthy');
  });

  it('should return 503 when workers not initialized', async () => {
    setWorkerManager(null);

    const response = await request(app).get('/api/workers/health').expect(503);

    expect(response.body.status).toBe('unavailable');
    expect(response.body.workers).toBe('not initialized');
  });
});
