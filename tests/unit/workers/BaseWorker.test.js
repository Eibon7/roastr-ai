/**
 * Comprehensive BaseWorker Tests
 * 
 * Full test coverage for the BaseWorker class including:
 * - Constructor and initialization
 * - Connection management
 * - Worker lifecycle (start/stop)
 * - Job processing flow
 * - Error handling and recovery
 * - Statistics and monitoring
 * - Graceful shutdown
 * - Mock mode operation
 */

const BaseWorker = require('../../../src/workers/BaseWorker');

// Mock dependencies
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

jest.mock('../../../src/services/queueService', () => {
  return jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    getNextJob: jest.fn(),
    completeJob: jest.fn(),
    failJob: jest.fn(),
    shutdown: jest.fn()
  }));
});

jest.mock('../../../src/config/mockMode', () => ({
  mockMode: {
    isMockMode: false,
    generateMockSupabaseClient: jest.fn(() => ({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({ data: [], error: null }))
        }))
      }))
    }))
  }
}));

const { createClient } = require('@supabase/supabase-js');
const QueueService = require('../../../src/services/queueService');
const { mockMode } = require('../../../src/config/mockMode');

// Test implementation of BaseWorker
class TestWorker extends BaseWorker {
  constructor(options = {}) {
    super('test_worker', options);
    this.processJobCalls = [];
  }

  async processJob(job) {
    this.processJobCalls.push(job);
    
    if (job.shouldFail) {
      throw new Error(job.errorMessage || 'Test job failure');
    }
    
    return {
      success: true,
      result: job.expectedResult || 'test-result',
      summary: 'Test job completed'
    };
  }
}

describe('BaseWorker', () => {
  let worker;
  let mockSupabaseClient;
  let mockQueueService;
  let originalEnv;

  beforeAll(() => {
    // Store original environment
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
    
    // Mock Supabase client
    mockSupabaseClient = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({ data: [], error: null }))
        }))
      }))
    };
    createClient.mockReturnValue(mockSupabaseClient);
    
    // Mock queue service
    mockQueueService = {
      initialize: jest.fn().mockResolvedValue(),
      getNextJob: jest.fn().mockResolvedValue(null),
      completeJob: jest.fn().mockResolvedValue(),
      failJob: jest.fn().mockResolvedValue(),
      shutdown: jest.fn().mockResolvedValue()
    };
    QueueService.mockImplementation(() => mockQueueService);
    
    // Reset mock mode
    mockMode.isMockMode = false;
    mockMode.generateMockSupabaseClient.mockReturnValue({
      from: jest.fn(() => ({ select: jest.fn() }))
    });

    // Spy on console.log to verify logging
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    if (worker && worker.isRunning) {
      // Force stop with shorter timeout for tests
      worker.config.gracefulShutdownTimeout = 100;
      await worker.stop();
    }
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with correct default configuration', () => {
      worker = new TestWorker();
      
      expect(worker.workerType).toBe('test_worker');
      expect(worker.workerName).toMatch(/test_worker-worker-\d+/);
      expect(worker.isRunning).toBe(false);
      expect(worker.processedJobs).toBe(0);
      expect(worker.failedJobs).toBe(0);
      expect(worker.startTime).toBeGreaterThan(0);
      
      expect(worker.config.maxRetries).toBe(3);
      expect(worker.config.retryDelay).toBe(5000);
      expect(worker.config.maxConcurrency).toBe(3);
      expect(worker.config.pollInterval).toBe(1000);
      expect(worker.config.gracefulShutdownTimeout).toBe(30000);
    });

    test('should accept custom configuration options', () => {
      const customConfig = {
        maxRetries: 5,
        retryDelay: 10000,
        maxConcurrency: 1,
        pollInterval: 2000,
        gracefulShutdownTimeout: 60000
      };
      
      worker = new TestWorker(customConfig);
      
      expect(worker.config.maxRetries).toBe(5);
      expect(worker.config.retryDelay).toBe(10000);
      expect(worker.config.maxConcurrency).toBe(1);
      expect(worker.config.pollInterval).toBe(2000);
      expect(worker.config.gracefulShutdownTimeout).toBe(60000);
    });

    test('should throw error when missing required environment variables', () => {
      delete process.env.SUPABASE_URL;
      
      expect(() => {
        new TestWorker();
      }).toThrow('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
    });

    test('should initialize connections during construction', () => {
      worker = new TestWorker();

      expect(createClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-service-key'
      );
      expect(QueueService).toHaveBeenCalled();
    });

    test('should prefer SERVICE_KEY over ANON_KEY', () => {
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';
      
      worker = new TestWorker();
      
      expect(createClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-service-key'
      );
    });

    test('should use ANON_KEY when SERVICE_KEY is not available', () => {
      delete process.env.SUPABASE_SERVICE_KEY;
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';
      
      worker = new TestWorker();
      
      expect(createClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key'
      );
    });
  });

  describe('mock mode initialization', () => {
    test('should initialize with mock clients when in mock mode', () => {
      mockMode.isMockMode = true;
      const mockSupabase = { from: jest.fn() };
      mockMode.generateMockSupabaseClient.mockReturnValue(mockSupabase);
      
      worker = new TestWorker();
      
      expect(worker.supabase).toBe(mockSupabase);
      expect(worker.queueService).toBeDefined();
      expect(worker.queueService.initialize).toBeDefined();
      expect(mockMode.generateMockSupabaseClient).toHaveBeenCalled();
    });
  });

  describe('worker lifecycle', () => {
    beforeEach(() => {
      worker = new TestWorker();
    });

    test('should start successfully with valid connections', async () => {
      // Mock successful connection test
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({ data: [], error: null }))
        }))
      });
      
      mockQueueService.initialize.mockResolvedValue();

      await worker.start();

      expect(worker.isRunning).toBe(true);
      expect(mockQueueService.initialize).toHaveBeenCalled();
      expect(worker.currentJobs).toBeInstanceOf(Map);
      expect(worker.currentJobs.size).toBe(0);
    });

    test('should fail to start with database connection error', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({ data: null, error: { message: 'Connection failed' } }))
        }))
      });

      await expect(worker.start()).rejects.toThrow('Database connection failed: Connection failed');
      expect(worker.isRunning).toBe(false);
    });

    test('should fail to start with queue service error', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({ data: [], error: null }))
        }))
      });
      
      mockQueueService.initialize.mockRejectedValue(new Error('Queue connection failed'));

      await expect(worker.start()).rejects.toThrow('Queue service initialization failed: Queue connection failed');
      expect(worker.isRunning).toBe(false);
    });

    test('should prevent starting already running worker', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({ data: [], error: null }))
        }))
      });
      
      await worker.start();

      await expect(worker.start()).rejects.toThrow(/Worker .* is already running/);
    });

    test('should stop worker gracefully', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({ data: [], error: null }))
        }))
      });
      
      await worker.start();
      expect(worker.isRunning).toBe(true);

      await worker.stop();

      expect(worker.isRunning).toBe(false);
      expect(mockQueueService.shutdown).toHaveBeenCalled();
    });

    test('should handle stop when not running', async () => {
      expect(worker.isRunning).toBe(false);
      
      await worker.stop();
      
      expect(mockQueueService.shutdown).not.toHaveBeenCalled();
    });
  });

  describe('connection testing', () => {
    test('should skip connection tests in mock mode', async () => {
      mockMode.isMockMode = true;
      worker = new TestWorker();
      
      await expect(worker.testConnections()).resolves.toBeUndefined();
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    test('should test database connection successfully', async () => {
      worker = new TestWorker();
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({ data: [], error: null }))
        }))
      });

      await expect(worker.testConnections()).resolves.toBeUndefined();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('organizations');
      expect(mockQueueService.initialize).toHaveBeenCalled();
    });

    test('should fail database connection test with error', async () => {
      worker = new TestWorker();
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({ data: null, error: { message: 'Connection timeout' } }))
        }))
      });

      await expect(worker.testConnections()).rejects.toThrow('Database connection failed: Connection timeout');
    });

    test('should fail queue service initialization test', async () => {
      worker = new TestWorker();
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({ data: [], error: null }))
        }))
      });
      mockQueueService.initialize.mockRejectedValue(new Error('Redis connection failed'));

      await expect(worker.testConnections()).rejects.toThrow('Queue service initialization failed: Redis connection failed');
    });
  });

  describe('job processing', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      // Use faster polling for tests
      worker = new TestWorker({ pollInterval: 10 });
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({ data: [], error: null }))
        }))
      });
      await worker.start();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should process jobs successfully', async () => {
      const testJob = {
        id: 'test-job-1',
        organization_id: 'org-123',
        job_type: 'test',
        expectedResult: 'success'
      };

      mockQueueService.getNextJob
        .mockResolvedValueOnce(testJob)
        .mockResolvedValue(null); // No more jobs

      // Advance timers to trigger processing loop
      await jest.advanceTimersByTimeAsync(worker.config.pollInterval);
      
      // Wait for async operations to complete
      await Promise.resolve();

      expect(worker.processJobCalls).toHaveLength(1);
      expect(worker.processJobCalls[0]).toEqual(testJob);
      expect(worker.processedJobs).toBe(1);
      expect(worker.failedJobs).toBe(0);
      expect(mockQueueService.completeJob).toHaveBeenCalledWith(
        testJob,
        expect.objectContaining({
          result: expect.objectContaining({
            success: true,
            result: 'success',
            summary: 'Test job completed'
          }),
          processingTime: expect.any(Number),
          completedBy: worker.workerName
        })
      );
    });

    test('should handle job processing failures', async () => {
      const failingJob = {
        id: 'failing-job',
        organization_id: 'org-123',
        shouldFail: true,
        errorMessage: 'Expected test failure'
      };

      mockQueueService.getNextJob
        .mockResolvedValueOnce(failingJob)
        .mockResolvedValue(null);

      // Advance timers to trigger processing loop
      await jest.advanceTimersByTimeAsync(worker.config.pollInterval);
      
      // Wait for async operations to complete
      await Promise.resolve();

      expect(worker.failedJobs).toBe(1);
      expect(mockQueueService.failJob).toHaveBeenCalledWith(
        failingJob,
        expect.any(Error)
      );
    });

    test('should respect max concurrency limit', async () => {
      worker.config.maxConcurrency = 2;
      
      const jobs = [
        { id: 'job-1', delay: 100 },
        { id: 'job-2', delay: 100 },
        { id: 'job-3', delay: 100 }
      ];

      mockQueueService.getNextJob
        .mockResolvedValueOnce(jobs[0])
        .mockResolvedValueOnce(jobs[1])
        .mockResolvedValueOnce(jobs[2])
        .mockResolvedValue(null);

      // Advance timers to trigger processing loop multiple times
      await jest.advanceTimersByTimeAsync(worker.config.pollInterval);
      await Promise.resolve();
      
      // Check that only 2 jobs run concurrently
      expect(worker.currentJobs.size).toBeLessThanOrEqual(2);
    });

    test('should handle queue service errors gracefully', async () => {
      mockQueueService.getNextJob.mockRejectedValue(new Error('Queue connection lost'));

      // Advance timers to trigger processing loop
      await jest.advanceTimersByTimeAsync(worker.config.pollInterval);
      await Promise.resolve();
      
      expect(worker.isRunning).toBe(true); // Should continue running
    });
  });

  describe('job completion and failure handling', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      // Use faster polling for tests
      worker = new TestWorker({ pollInterval: 10 });
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({ data: [], error: null }))
        }))
      });
      await worker.start();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should handle job completion errors', async () => {
      const testJob = { id: 'job-1', organization_id: 'org-123' };
      
      mockQueueService.getNextJob
        .mockResolvedValueOnce(testJob)
        .mockResolvedValue(null);
      
      mockQueueService.completeJob.mockRejectedValue(new Error('Failed to mark complete'));

      // Advance timers to trigger processing loop
      await jest.advanceTimersByTimeAsync(worker.config.pollInterval);
      await Promise.resolve();

      expect(worker.processedJobs).toBe(1);
      // Should continue despite completion error
      expect(worker.isRunning).toBe(true);
    });

    test('should handle job failure marking errors', async () => {
      const failingJob = {
        id: 'failing-job',
        shouldFail: true,
        errorMessage: 'Test failure'
      };

      mockQueueService.getNextJob
        .mockResolvedValueOnce(failingJob)
        .mockResolvedValue(null);
      
      mockQueueService.failJob.mockRejectedValue(new Error('Failed to mark as failed'));

      // Advance timers to trigger processing loop
      await jest.advanceTimersByTimeAsync(worker.config.pollInterval);
      await Promise.resolve();

      expect(worker.failedJobs).toBe(1);
    });
  });

  describe('graceful shutdown', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should wait for current jobs to complete', async () => {
      worker = new TestWorker({ gracefulShutdownTimeout: 1000 });
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({ data: [], error: null }))
        }))
      });
      
      await worker.start();
      
      // Simulate a long-running job
      const longJob = { id: 'long-job', delay: 100 };
      worker.currentJobs.set('long-job', longJob);

      // Start the stop process (non-blocking)
      const stopPromise = worker.stop();
      
      // Wait a moment then clear the job
      await jest.advanceTimersByTimeAsync(50);
      worker.currentJobs.delete('long-job');
      
      // Let the stop process check for the cleared job
      await jest.advanceTimersByTimeAsync(50);

      await stopPromise;
      
      expect(worker.isRunning).toBe(false);
    });

    test('should force stop after timeout', async () => {
      worker = new TestWorker({ gracefulShutdownTimeout: 50 });
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({ data: [], error: null }))
        }))
      });
      
      await worker.start();
      
      // Simulate a job that doesn't complete
      worker.currentJobs.set('stuck-job', { id: 'stuck-job' });

      const stopPromise = worker.stop();

      // Advance timers past the graceful shutdown timeout
      await jest.advanceTimersByTimeAsync(100);

      await stopPromise;

      expect(worker.isRunning).toBe(false);
    });
  });

  describe('utility methods', () => {
    beforeEach(() => {
      worker = new TestWorker();
    });

    test('should log with correct format', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      worker.log('info', 'Test message', { data: 'test' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]')
      );
      
      const loggedMessage = JSON.parse(consoleSpy.mock.calls[0][0].replace('[INFO] ', ''));
      expect(loggedMessage.level).toBe('info');
      expect(loggedMessage.message).toBe('Test message');
      expect(loggedMessage.worker).toBe(worker.workerName);
      expect(loggedMessage.workerType).toBe('test_worker');
      expect(loggedMessage.data).toBe('test');
      
      consoleSpy.mockRestore();
    });

    test('should sleep for specified duration', async () => {
      jest.useFakeTimers();
      
      const sleepPromise = worker.sleep(50);
      
      // Advance timers
      jest.advanceTimersByTime(50);
      
      await expect(sleepPromise).resolves.toBeUndefined();
      
      jest.useRealTimers();
    });

    test('should return correct statistics', () => {
      worker.processedJobs = 10;
      worker.failedJobs = 2;
      worker.isRunning = true;
      worker.currentJobs = new Map();
      worker.currentJobs.set('job1', { id: 'job1' });
      worker.currentJobs.set('job2', { id: 'job2' });
      // Set startTime to simulate worker has been running
      worker.startTime = Date.now() - 1000; // 1 second ago

      const stats = worker.getStats();

      expect(stats.workerName).toBe(worker.workerName);
      expect(stats.workerType).toBe('test_worker');
      expect(stats.isRunning).toBe(true);
      expect(stats.processedJobs).toBe(10);
      expect(stats.failedJobs).toBe(2);
      expect(stats.currentJobs).toBe(2);
      expect(stats.uptime).toBeGreaterThan(0);
      expect(stats.config).toEqual(worker.config);
    });
  });

  describe('abstract method enforcement', () => {
    test('should throw error when processJob is not implemented', async () => {
      class IncompleteWorker extends BaseWorker {
        constructor() {
          super('incomplete_worker');
        }
        // Missing processJob implementation
      }
      
      const incompleteWorker = new IncompleteWorker();
      
      await expect(incompleteWorker.processJob({})).rejects.toThrow('processJob method must be implemented by subclass');
    });
  });

  describe('process signal handling', () => {
    let processOnSpy;
    let processExitSpy;

    beforeEach(() => {
      // Mock process methods
      processOnSpy = jest.spyOn(process, 'on').mockImplementation(() => process);
      processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    });

    afterEach(() => {
      // Restore mocks
      processOnSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    test('should setup graceful shutdown signal handlers', () => {
      // Temporarily change NODE_ENV to enable signal handler setup
      const originalNodeEnv = process.env.NODE_ENV;
      const originalIsTest = process.env.IS_TEST;
      process.env.NODE_ENV = 'production';
      delete process.env.IS_TEST;

      try {
        worker = new TestWorker();

        // Verify all signal handlers are registered
        expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
        expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
        expect(processOnSpy).toHaveBeenCalledWith('SIGQUIT', expect.any(Function));
        expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
        expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
      } finally {
        // Restore original environment
        process.env.NODE_ENV = originalNodeEnv;
        if (originalIsTest) process.env.IS_TEST = originalIsTest;
      }
    });

    test('should skip signal handlers in test environment', () => {
      // Ensure we're in test environment
      process.env.NODE_ENV = 'test';
      process.env.IS_TEST = 'true';

      worker = new TestWorker();

      // Signal handlers should not be registered in test environment
      const signalHandlerCalls = processOnSpy.mock.calls.filter(call => 
        ['SIGTERM', 'SIGINT', 'SIGQUIT', 'uncaughtException', 'unhandledRejection'].includes(call[0])
      );
      
      expect(signalHandlerCalls).toHaveLength(0);
    });
  });
});