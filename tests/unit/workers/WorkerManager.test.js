/**
 * Comprehensive WorkerManager Tests
 *
 * Full test coverage for the WorkerManager class including:
 * - Constructor and initialization
 * - Worker lifecycle management
 * - Health monitoring
 * - Statistics and metrics
 * - Error handling
 * - Dynamic worker management
 * - Graceful shutdown
 */

const WorkerManager = require('../../../src/workers/WorkerManager');
const FetchCommentsWorker = require('../../../src/workers/FetchCommentsWorker');
const AnalyzeToxicityWorker = require('../../../src/workers/AnalyzeToxicityWorker');
const GenerateReplyWorker = require('../../../src/workers/GenerateReplyWorker');
const ShieldActionWorker = require('../../../src/workers/ShieldActionWorker');
const BillingWorker = require('../../../src/workers/BillingWorker');
const PublisherWorker = require('../../../src/workers/PublisherWorker');

// Mock all worker classes
jest.mock('../../../src/workers/FetchCommentsWorker');
jest.mock('../../../src/workers/AnalyzeToxicityWorker');
jest.mock('../../../src/workers/GenerateReplyWorker');
jest.mock('../../../src/workers/ShieldActionWorker');
jest.mock('../../../src/workers/BillingWorker');
jest.mock('../../../src/workers/PublisherWorker');

describe('WorkerManager', () => {
  let manager;
  let mockWorkerInstances;

  beforeEach(() => {
    jest.clearAllMocks();

    // Increase max listeners to avoid warnings in tests
    // Each WorkerManager instance adds 5 listeners (SIGTERM, SIGINT, SIGQUIT, uncaughtException, unhandledRejection)
    process.setMaxListeners(30);

    // Create mock worker instances
    const createMockWorker = (type) => ({
      workerName: `${type}-worker-123`,
      workerType: type,
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockReturnValue({
        workerName: `${type}-worker-123`,
        workerType: type,
        isRunning: true,
        processedJobs: 10,
        failedJobs: 1,
        currentJobs: 2,
        uptime: 30000
      }),
      healthcheck: jest.fn().mockResolvedValue({
        status: 'healthy',
        workerType: type,
        timestamp: new Date().toISOString(),
        checks: {
          running: { status: 'healthy' },
          database: { status: 'healthy' },
          queue: { status: 'healthy' }
        }
      })
    });

    mockWorkerInstances = {
      fetch_comments: createMockWorker('fetch_comments'),
      analyze_toxicity: createMockWorker('analyze_toxicity'),
      generate_roast: createMockWorker('generate_roast'),
      shield_action: createMockWorker('shield_action'),
      billing_update: createMockWorker('billing_update'),
      social_posting: createMockWorker('social_posting')
    };

    // Mock worker constructors
    FetchCommentsWorker.mockImplementation(() => mockWorkerInstances.fetch_comments);
    AnalyzeToxicityWorker.mockImplementation(() => mockWorkerInstances.analyze_toxicity);
    GenerateReplyWorker.mockImplementation(() => mockWorkerInstances.generate_roast);
    ShieldActionWorker.mockImplementation(() => mockWorkerInstances.shield_action);
    BillingWorker.mockImplementation(() => mockWorkerInstances.billing_update);
    PublisherWorker.mockImplementation(() => mockWorkerInstances.social_posting);

    // Spy on console.log
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    if (manager) {
      if (manager.healthCheckTimer) {
        clearInterval(manager.healthCheckTimer);
        manager.healthCheckTimer = null;
      }
      if (manager.isRunning) {
        await manager.stop();
      }
    }
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      manager = new WorkerManager();

      expect(manager.options.enabledWorkers).toEqual([
        'fetch_comments',
        'analyze_toxicity',
        'generate_roast',
        'shield_action',
        'billing_update',
        'social_posting'
      ]);
      expect(manager.options.workerConfig).toEqual({});
      expect(manager.options.healthCheckInterval).toBe(30000);
      expect(manager.workers).toBeInstanceOf(Map);
      expect(manager.isRunning).toBe(false);
      expect(manager.startTime).toBeNull();
      expect(manager.healthCheckTimer).toBeNull();
    });

    it('should accept custom options', () => {
      const customOptions = {
        enabledWorkers: ['fetch_comments', 'analyze_toxicity'],
        workerConfig: {
          fetch_comments: { maxConcurrency: 5 }
        },
        healthCheckInterval: 15000
      };

      manager = new WorkerManager(customOptions);

      expect(manager.options.enabledWorkers).toEqual(['fetch_comments', 'analyze_toxicity']);
      expect(manager.options.workerConfig).toEqual({ fetch_comments: { maxConcurrency: 5 } });
      expect(manager.options.healthCheckInterval).toBe(15000);
    });

    it('should have correct worker class mappings', () => {
      manager = new WorkerManager();

      expect(manager.workerClasses).toEqual({
        fetch_comments: FetchCommentsWorker,
        analyze_toxicity: AnalyzeToxicityWorker,
        generate_roast: GenerateReplyWorker,
        shield_action: ShieldActionWorker,
        billing_update: BillingWorker,
        social_posting: PublisherWorker
      });
    });

    it('should log initialization', () => {
      manager = new WorkerManager();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Worker Manager initialized')
      );
    });
  });

  describe('Worker Lifecycle Management', () => {
    beforeEach(() => {
      manager = new WorkerManager({
        enabledWorkers: ['fetch_comments', 'analyze_toxicity']
      });
    });

    describe('start()', () => {
      it('should start all enabled workers successfully', async () => {
        await manager.start();

        expect(manager.isRunning).toBe(true);
        expect(typeof manager.startTime).toBe('number');
        expect(manager.workers.size).toBe(2);
        expect(manager.workers.has('fetch_comments')).toBe(true);
        expect(manager.workers.has('analyze_toxicity')).toBe(true);
        expect(mockWorkerInstances.fetch_comments.start).toHaveBeenCalled();
        expect(mockWorkerInstances.analyze_toxicity.start).toHaveBeenCalled();
      });

      it('should throw error if already running', async () => {
        await manager.start();

        await expect(manager.start()).rejects.toThrow('Worker Manager is already running');
      });

      it('should start health monitoring', async () => {
        jest.spyOn(manager, 'startHealthMonitoring');

        await manager.start();

        expect(manager.startHealthMonitoring).toHaveBeenCalled();
        expect(manager.healthCheckTimer).not.toBeNull();
      });

      it('should setup graceful shutdown', async () => {
        jest.spyOn(manager, 'setupGracefulShutdown');

        await manager.start();

        expect(manager.setupGracefulShutdown).toHaveBeenCalled();
      });

      it('should handle worker startup failures', async () => {
        const error = new Error('Worker failed to start');
        mockWorkerInstances.fetch_comments.start.mockRejectedValue(error);

        await expect(manager.start()).rejects.toThrow('Worker failed to start');
        expect(manager.isRunning).toBe(false);
      });

      it('should clean up on startup failure', async () => {
        const error = new Error('Second worker failed');
        mockWorkerInstances.analyze_toxicity.start.mockRejectedValue(error);
        jest.spyOn(manager, 'stop');

        await expect(manager.start()).rejects.toThrow('Second worker failed');
        expect(manager.stop).toHaveBeenCalled();
      });
    });

    describe('stop()', () => {
      it('should stop all workers gracefully', async () => {
        await manager.start();
        await manager.stop();

        expect(manager.isRunning).toBe(false);
        expect(manager.healthCheckTimer).toBeNull();
        expect(manager.workers.size).toBe(0);
        expect(mockWorkerInstances.fetch_comments.stop).toHaveBeenCalled();
        expect(mockWorkerInstances.analyze_toxicity.stop).toHaveBeenCalled();
      });

      it('should do nothing if not running', async () => {
        expect(manager.isRunning).toBe(false);

        await manager.stop();

        expect(manager.isRunning).toBe(false);
        expect(mockWorkerInstances.fetch_comments.stop).not.toHaveBeenCalled();
      });

      it('should handle worker stop errors gracefully', async () => {
        await manager.start();

        const error = new Error('Worker failed to stop');
        mockWorkerInstances.fetch_comments.stop.mockRejectedValue(error);

        // Should not throw, but handle gracefully
        await manager.stop();

        expect(manager.isRunning).toBe(false);
        expect(manager.workers.size).toBe(0);
      });

      it('should clear health check timer', async () => {
        await manager.start();
        const timerId = manager.healthCheckTimer;

        await manager.stop();

        expect(manager.healthCheckTimer).toBeNull();
      });
    });

    describe('startWorker()', () => {
      it('should start a specific worker type', async () => {
        await manager.startWorker('fetch_comments');

        expect(manager.workers.has('fetch_comments')).toBe(true);
        expect(FetchCommentsWorker).toHaveBeenCalledWith({});
        expect(mockWorkerInstances.fetch_comments.start).toHaveBeenCalled();
      });

      it('should use worker-specific configuration', async () => {
        manager.options.workerConfig.fetch_comments = { maxConcurrency: 5 };

        await manager.startWorker('fetch_comments');

        expect(FetchCommentsWorker).toHaveBeenCalledWith({ maxConcurrency: 5 });
      });

      it('should throw error for unknown worker type', async () => {
        await expect(manager.startWorker('unknown_worker')).rejects.toThrow(
          'Unknown worker type: unknown_worker'
        );
      });

      it('should handle worker start failures', async () => {
        const error = new Error('Worker start failed');
        mockWorkerInstances.fetch_comments.start.mockRejectedValue(error);

        await expect(manager.startWorker('fetch_comments')).rejects.toThrow('Worker start failed');
      });
    });

    describe('stopWorker()', () => {
      it('should stop a specific worker type', async () => {
        await manager.startWorker('fetch_comments');
        await manager.stopWorker('fetch_comments');

        expect(manager.workers.has('fetch_comments')).toBe(false);
        expect(mockWorkerInstances.fetch_comments.stop).toHaveBeenCalled();
      });

      it('should throw error if worker is not running', async () => {
        await expect(manager.stopWorker('fetch_comments')).rejects.toThrow(
          'Worker fetch_comments is not running'
        );
      });

      it('should handle worker stop failures', async () => {
        await manager.startWorker('fetch_comments');

        const error = new Error('Worker stop failed');
        mockWorkerInstances.fetch_comments.stop.mockRejectedValue(error);

        await expect(manager.stopWorker('fetch_comments')).rejects.toThrow('Worker stop failed');
      });
    });

    describe('restartWorker()', () => {
      it('should restart an existing worker', async () => {
        await manager.startWorker('fetch_comments');
        await manager.restartWorker('fetch_comments');

        expect(mockWorkerInstances.fetch_comments.stop).toHaveBeenCalled();
        expect(mockWorkerInstances.fetch_comments.start).toHaveBeenCalledTimes(2);
        expect(manager.workers.has('fetch_comments')).toBe(true);
      });

      it('should start a worker if not already running', async () => {
        await manager.restartWorker('fetch_comments');

        expect(mockWorkerInstances.fetch_comments.stop).not.toHaveBeenCalled();
        expect(mockWorkerInstances.fetch_comments.start).toHaveBeenCalled();
        expect(manager.workers.has('fetch_comments')).toBe(true);
      });

      it('should handle restart failures', async () => {
        const error = new Error('Restart failed');
        mockWorkerInstances.fetch_comments.start.mockRejectedValue(error);

        await expect(manager.restartWorker('fetch_comments')).rejects.toThrow('Restart failed');
      });
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      manager = new WorkerManager({
        enabledWorkers: ['fetch_comments', 'analyze_toxicity'],
        healthCheckInterval: 1000 // Short interval for testing
      });
    });

    describe('startHealthMonitoring()', () => {
      it('should start periodic health checks', () => {
        jest.spyOn(manager, 'performHealthCheck');

        manager.startHealthMonitoring();

        expect(manager.healthCheckTimer).not.toBeNull();

        // Verify timer exists (can't easily test the actual interval in unit tests)
        expect(typeof manager.healthCheckTimer).toBe('object');
      });
    });

    describe('performHealthCheck()', () => {
      it('should perform health checks on all workers', async () => {
        await manager.start();

        const healthReport = await manager.performHealthCheck();

        expect(healthReport).toHaveProperty('timestamp');
        expect(healthReport).toHaveProperty('managerUptime');
        expect(healthReport).toHaveProperty('totalWorkers', 2);
        expect(healthReport).toHaveProperty('healthyWorkers', 2);
        expect(healthReport).toHaveProperty('workers');
        expect(healthReport).toHaveProperty('overallStatus', 'healthy');

        expect(healthReport.workers).toHaveProperty('fetch_comments');
        expect(healthReport.workers).toHaveProperty('analyze_toxicity');

        expect(mockWorkerInstances.fetch_comments.healthcheck).toHaveBeenCalled();
        expect(mockWorkerInstances.analyze_toxicity.healthcheck).toHaveBeenCalled();
      });

      it('should handle unhealthy workers', async () => {
        mockWorkerInstances.fetch_comments.healthcheck.mockResolvedValue({
          status: 'unhealthy',
          workerType: 'fetch_comments',
          checks: { database: { status: 'unhealthy' } }
        });

        await manager.start();
        const healthReport = await manager.performHealthCheck();

        expect(healthReport.healthyWorkers).toBe(1);
        expect(healthReport.overallStatus).toBe('warning');
      });

      it('should handle all workers unhealthy', async () => {
        mockWorkerInstances.fetch_comments.healthcheck.mockResolvedValue({
          status: 'unhealthy'
        });
        mockWorkerInstances.analyze_toxicity.healthcheck.mockResolvedValue({
          status: 'error'
        });

        await manager.start();
        const healthReport = await manager.performHealthCheck();

        expect(healthReport.healthyWorkers).toBe(0);
        expect(healthReport.overallStatus).toBe('unhealthy');
      });

      it('should handle healthcheck errors', async () => {
        const error = new Error('Healthcheck failed');
        mockWorkerInstances.fetch_comments.healthcheck.mockRejectedValue(error);

        await manager.start();
        const healthReport = await manager.performHealthCheck();

        expect(healthReport.workers.fetch_comments).toEqual({
          status: 'error',
          error: 'Healthcheck failed',
          workerType: 'fetch_comments',
          timestamp: expect.any(String)
        });
      });

      it('should log unhealthy workers', async () => {
        mockWorkerInstances.fetch_comments.healthcheck.mockResolvedValue({
          status: 'unhealthy',
          workerType: 'fetch_comments'
        });

        await manager.start();
        await manager.performHealthCheck();

        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Unhealthy worker detected')
        );
      });
    });

    describe('getHealthStatus()', () => {
      it('should return health status', async () => {
        await manager.start();
        jest.spyOn(manager, 'performHealthCheck');

        const health = await manager.getHealthStatus();

        expect(manager.performHealthCheck).toHaveBeenCalled();
        expect(health).toHaveProperty('overallStatus');
        expect(health).toHaveProperty('workers');
      });
    });
  });

  describe('Statistics and Metrics', () => {
    beforeEach(async () => {
      manager = new WorkerManager({
        enabledWorkers: ['fetch_comments', 'analyze_toxicity']
      });
      await manager.start();
    });

    describe('getStats()', () => {
      it('should return comprehensive statistics', () => {
        const stats = manager.getStats();

        expect(stats).toHaveProperty('managerStatus');
        expect(stats).toHaveProperty('workers');

        expect(stats.managerStatus).toEqual({
          isRunning: true,
          startTime: expect.any(Number),
          uptime: expect.any(Number),
          totalWorkers: 2,
          enabledWorkers: ['fetch_comments', 'analyze_toxicity']
        });

        expect(stats.workers).toHaveProperty('fetch_comments');
        expect(stats.workers).toHaveProperty('analyze_toxicity');

        expect(mockWorkerInstances.fetch_comments.getStats).toHaveBeenCalled();
        expect(mockWorkerInstances.analyze_toxicity.getStats).toHaveBeenCalled();
      });
    });

    describe('getSummary()', () => {
      it('should return summary metrics', () => {
        const summary = manager.getSummary();

        expect(summary).toEqual({
          isRunning: true,
          uptime: expect.any(Number),
          workersCount: 2,
          totalJobsProcessed: 20, // 10 + 10 from mock workers
          totalJobsFailed: 2, // 1 + 1 from mock workers
          currentJobsProcessing: 4, // 2 + 2 from mock workers
          successRate: '90.00%' // (20-2)/20 * 100
        });
      });

      it('should handle no processed jobs', () => {
        // Override mock to return zero jobs
        mockWorkerInstances.fetch_comments.getStats.mockReturnValue({
          processedJobs: 0,
          failedJobs: 0,
          currentJobs: 0
        });
        mockWorkerInstances.analyze_toxicity.getStats.mockReturnValue({
          processedJobs: 0,
          failedJobs: 0,
          currentJobs: 0
        });

        const summary = manager.getSummary();

        expect(summary.successRate).toBe('N/A');
      });

      it('should return correct metrics when not running', async () => {
        await manager.stop();

        const summary = manager.getSummary();

        expect(summary.isRunning).toBe(false);
        expect(summary.workersCount).toBe(0);
      });
    });
  });

  describe('Dynamic Worker Management', () => {
    beforeEach(() => {
      manager = new WorkerManager({ enabledWorkers: [] });
    });

    describe('addWorker()', () => {
      it('should add a new worker type', async () => {
        class CustomWorker {
          constructor() {
            this.workerName = 'custom-worker';
            this.start = jest.fn().mockResolvedValue(undefined);
            this.stop = jest.fn().mockResolvedValue(undefined);
          }
        }

        await manager.addWorker('custom', CustomWorker);

        expect(manager.workerClasses.custom).toBe(CustomWorker);
      });

      it('should start worker if manager is running', async () => {
        class CustomWorker {
          constructor() {
            this.workerName = 'custom-worker';
            this.start = jest.fn().mockResolvedValue(undefined);
            this.stop = jest.fn().mockResolvedValue(undefined);
          }
        }

        await manager.start();
        jest.spyOn(manager, 'startWorker');

        await manager.addWorker('custom', CustomWorker);

        expect(manager.startWorker).toHaveBeenCalledWith('custom');
      });

      it('should throw error if worker type already exists', async () => {
        class CustomWorker {}

        await expect(manager.addWorker('fetch_comments', CustomWorker)).rejects.toThrow(
          'Worker type fetch_comments already exists'
        );
      });
    });
  });

  describe('Graceful Shutdown', () => {
    beforeEach(() => {
      manager = new WorkerManager();
    });

    it('should setup signal handlers', () => {
      const processOnSpy = jest.spyOn(process, 'on');

      manager.setupGracefulShutdown();

      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGQUIT', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });
  });

  describe('Logging', () => {
    beforeEach(() => {
      manager = new WorkerManager();
    });

    it('should log with correct format', () => {
      manager.log('info', 'Test message', { extra: 'data' });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[INFO]'));

      const logCall = console.log.mock.calls[console.log.mock.calls.length - 1][0];
      const logEntry = JSON.parse(logCall.split('] ')[1]);

      expect(logEntry).toMatchObject({
        level: 'info',
        component: 'WorkerManager',
        message: 'Test message',
        extra: 'data',
        timestamp: expect.any(String)
      });
    });

    it('should handle logs without metadata', () => {
      manager.log('error', 'Error message');

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'));
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      manager = new WorkerManager({
        enabledWorkers: ['fetch_comments']
      });
    });

    it('should handle unknown worker types gracefully', async () => {
      manager.options.enabledWorkers = ['unknown_worker'];

      await expect(manager.start()).rejects.toThrow('Unknown worker type: unknown_worker');
    });

    it('should handle worker class instantiation errors', async () => {
      FetchCommentsWorker.mockImplementation(() => {
        throw new Error('Instantiation failed');
      });

      await expect(manager.start()).rejects.toThrow('Instantiation failed');
    });

    it('should handle worker start failures and cleanup', async () => {
      mockWorkerInstances.fetch_comments.start.mockRejectedValue(new Error('Start failed'));
      jest.spyOn(manager, 'stop');

      await expect(manager.start()).rejects.toThrow('Start failed');
      expect(manager.stop).toHaveBeenCalled();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle full lifecycle with multiple workers', async () => {
      manager = new WorkerManager({
        enabledWorkers: ['fetch_comments', 'analyze_toxicity', 'generate_roast']
      });

      // Start manager
      await manager.start();
      expect(manager.isRunning).toBe(true);
      expect(manager.workers.size).toBe(3);

      // Check health
      const health = await manager.getHealthStatus();
      expect(health.overallStatus).toBe('healthy');

      // Get statistics
      const stats = manager.getStats();
      expect(stats.managerStatus.totalWorkers).toBe(3);

      // Stop manager
      await manager.stop();
      expect(manager.isRunning).toBe(false);
      expect(manager.workers.size).toBe(0);
    });

    it('should handle partial worker failures gracefully', async () => {
      manager = new WorkerManager({
        enabledWorkers: ['fetch_comments', 'analyze_toxicity']
      });

      // Make one worker unhealthy
      mockWorkerInstances.analyze_toxicity.healthcheck.mockResolvedValue({
        status: 'unhealthy'
      });

      await manager.start();
      const health = await manager.getHealthStatus();

      expect(health.totalWorkers).toBe(2);
      expect(health.healthyWorkers).toBe(1);
      expect(health.overallStatus).toBe('warning');
    });

    it('should maintain functionality during worker restart', async () => {
      manager = new WorkerManager({
        enabledWorkers: ['fetch_comments']
      });

      await manager.start();
      expect(manager.workers.size).toBe(1);

      await manager.restartWorker('fetch_comments');
      expect(manager.workers.size).toBe(1);
      expect(manager.isRunning).toBe(true);

      await manager.stop();
    });
  });
});
