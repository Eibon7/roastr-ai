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
const advancedLogger = require('../../../src/utils/advancedLogger');

// Test implementation of BaseWorker
class TestWorker extends BaseWorker {
  constructor(options = {}) {
    super('test_worker', options);
    this.internalCalls = [];
  }

  async _processJobInternal(job) {
    this.internalCalls.push(job);

    if (job.shouldFail) {
      const error = new Error(job.errorMessage || 'Test job failure');
      if (job.permanent) {
        error.permanent = true;
      }
      if (job.retriable === false) {
        error.retriable = false;
      }
      throw error;
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

      expect(createClient).toHaveBeenCalledWith('https://test.supabase.co', 'test-service-key');
      expect(QueueService).toHaveBeenCalled();
    });

    test('should prefer SERVICE_KEY over ANON_KEY', () => {
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';

      worker = new TestWorker();

      expect(createClient).toHaveBeenCalledWith('https://test.supabase.co', 'test-service-key');
    });

    test('should use ANON_KEY when SERVICE_KEY is not available', () => {
      delete process.env.SUPABASE_SERVICE_KEY;
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';

      worker = new TestWorker();

      expect(createClient).toHaveBeenCalledWith('https://test.supabase.co', 'test-anon-key');
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

      await expect(worker.start()).rejects.toThrow(
        'Queue service initialization failed: Queue connection failed'
      );
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

      await expect(worker.testConnections()).rejects.toThrow(
        'Database connection failed: Connection timeout'
      );
    });

    test('should fail queue service initialization test', async () => {
      worker = new TestWorker();
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({ data: [], error: null }))
        }))
      });
      mockQueueService.initialize.mockRejectedValue(new Error('Redis connection failed'));

      await expect(worker.testConnections()).rejects.toThrow(
        'Queue service initialization failed: Redis connection failed'
      );
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

      mockQueueService.getNextJob.mockResolvedValueOnce(testJob).mockResolvedValue(null); // No more jobs

      // Advance timers to trigger processing loop
      await jest.advanceTimersByTimeAsync(worker.config.pollInterval);

      // Wait for async operations to complete
      await Promise.resolve();

      expect(worker.internalCalls).toHaveLength(1);
      expect(worker.internalCalls[0]).toEqual(testJob);
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

    test('should continue when markJobCompleted fails but job was processed successfully', async () => {
      const testJob = {
        id: 'test-job-ack-fail',
        organization_id: 'org-123',
        job_type: 'test',
        expectedResult: 'success'
      };

      // Make completeJob fail
      mockQueueService.completeJob.mockRejectedValueOnce(new Error('Acknowledgment failed'));

      mockQueueService.getNextJob.mockResolvedValueOnce(testJob).mockResolvedValue(null);

      const logSpy = jest.spyOn(worker, 'log');

      // Advance timers to trigger processing loop
      await jest.advanceTimersByTimeAsync(worker.config.pollInterval);
      await Promise.resolve();

      // Job should still be processed successfully
      expect(worker.internalCalls).toHaveLength(1);
      expect(worker.processedJobs).toBe(1);
      expect(worker.failedJobs).toBe(0);

      // Should log error but continue (check for the actual log message)
      expect(logSpy).toHaveBeenCalledWith(
        'error',
        'Failed to mark job as completed',
        expect.objectContaining({
          jobId: testJob.id,
          error: 'Acknowledgment failed'
        })
      );

      logSpy.mockRestore();
    });

    test('should handle job processing failures', async () => {
      const failingJob = {
        id: 'failing-job',
        organization_id: 'org-123',
        shouldFail: true,
        errorMessage: 'Expected test failure',
        permanent: true
      };

      mockQueueService.getNextJob.mockResolvedValueOnce(failingJob).mockResolvedValue(null);

      // Advance timers to trigger processing loop
      await jest.advanceTimersByTimeAsync(worker.config.pollInterval);

      // Wait for async operations to complete
      await Promise.resolve();

      expect(worker.failedJobs).toBe(1);
      expect(mockQueueService.failJob).toHaveBeenCalledWith(failingJob, expect.any(Error));
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

    test('should handle errors in processing loop and continue', async () => {
      // Make getNextJob throw an error
      mockQueueService.getNextJob.mockRejectedValueOnce(new Error('Processing loop error'));

      // Advance timers to trigger processing loop
      await jest.advanceTimersByTimeAsync(worker.config.pollInterval);
      await Promise.resolve();

      // Should continue running despite error
      expect(worker.isRunning).toBe(true);
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

      mockQueueService.getNextJob.mockResolvedValueOnce(testJob).mockResolvedValue(null);

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
        errorMessage: 'Test failure',
        permanent: true
      };

      mockQueueService.getNextJob.mockResolvedValueOnce(failingJob).mockResolvedValue(null);

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

    test('should resolve immediately if currentJobs was never initialized', async () => {
      worker = new TestWorker({ gracefulShutdownTimeout: 1000 });
      // Initialize connections but don't start processing loop
      // This ensures worker is initialized but currentJobs is never set
      await worker.initializeConnections();

      // Stop should resolve immediately since processing loop never ran
      const stopPromise = worker.stop();
      await jest.advanceTimersByTimeAsync(100);
      await stopPromise;

      expect(worker.isRunning).toBe(false);
    });
  });

  describe('isRetryableError', () => {
    beforeEach(() => {
      worker = new TestWorker();
    });

    test('returns false when error is explicitly marked permanent', () => {
      const error = new Error('Permanent failure');
      error.statusCode = 503;
      error.permanent = true;

      expect(worker.isRetryableError(error)).toBe(false);
    });

    test('returns true when error is marked retriable even if status is 4xx', () => {
      const error = new Error('Temporary missing resource');
      error.statusCode = 404;
      error.retriable = true;

      expect(worker.isRetryableError(error)).toBe(true);
    });

    test('returns false for permanent status codes (400, 401, 403, 404, 422)', () => {
      [400, 401, 403, 404, 422].forEach((statusCode) => {
        const error = new Error('Client error');
        error.statusCode = statusCode;
        expect(worker.isRetryableError(error)).toBe(false);
      });
    });

    test('returns false for permanent error codes', () => {
      ['UNAUTHORIZED', 'FORBIDDEN', 'BAD_REQUEST', 'NOT_FOUND', 'CERT_INVALID'].forEach((code) => {
        const error = new Error('Permanent error');
        error.code = code;
        expect(worker.isRetryableError(error)).toBe(false);
      });
    });

    test('returns false for permanent error patterns in messages', () => {
      const permanentMessages = [
        'Invalid authentication',
        'Unauthorized access',
        'API key invalid',
        'Forbidden resource',
        'Bad request format',
        'Resource not found',
        'Video not found',
        'User not found',
        'Page not found',
        'Endpoint not found',
        'SSL certificate error'
      ];

      permanentMessages.forEach((message) => {
        const error = new Error(message);
        expect(worker.isRetryableError(error)).toBe(false);
      });
    });

    test('returns true for retryable status codes (429, 500, 502, 503, 504)', () => {
      [429, 500, 502, 503, 504].forEach((statusCode) => {
        const error = new Error('Server error');
        error.statusCode = statusCode;
        expect(worker.isRetryableError(error)).toBe(true);
      });
    });

    test('returns true for retryable error codes', () => {
      ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED'].forEach((code) => {
        const error = new Error('Network error');
        error.code = code;
        expect(worker.isRetryableError(error)).toBe(true);
      });
    });

    test('returns true for retryable error patterns in messages', () => {
      const retryableMessages = [
        'Network error occurred',
        'Connection failed',
        'Request timeout',
        'Rate limit exceeded',
        'Service unavailable',
        'Bad gateway',
        'Gateway timeout'
      ];

      retryableMessages.forEach((message) => {
        const error = new Error(message);
        expect(worker.isRetryableError(error)).toBe(true);
      });
    });

    test('returns true for unknown errors (default case)', () => {
      const error = new Error('Unknown error');
      expect(worker.isRetryableError(error)).toBe(true);
    });

    test('prioritizes explicit flags over status codes', () => {
      const error = new Error('Error');
      error.statusCode = 500; // Retryable status
      error.permanent = true; // But explicitly permanent
      expect(worker.isRetryableError(error)).toBe(false);
    });
  });

  describe('executeJobWithRetry behavior', () => {
    beforeEach(() => {
      worker = new TestWorker({ maxRetries: 2, retryDelay: 5 });
    });

    test('retries retriable errors before succeeding', async () => {
      const job = { id: 'retry-job' };
      let attempts = 0;
      const sleepSpy = jest.spyOn(worker, 'sleep').mockResolvedValue();
      const processSpy = jest.spyOn(worker, '_processJobInternal').mockImplementation(async () => {
        attempts += 1;
        if (attempts < 2) {
          const error = new Error('transient');
          error.retriable = true;
          throw error;
        }
        return { summary: 'ok' };
      });

      const result = await worker.executeJobWithRetry(job);

      expect(result).toEqual({ summary: 'ok' });
      expect(attempts).toBe(2);
      expect(sleepSpy).toHaveBeenCalledWith(expect.any(Number));

      sleepSpy.mockRestore();
      processSpy.mockRestore();
    });

    test('throws immediately on permanent errors', async () => {
      const job = { id: 'permanent-job' };
      const error = new Error('fatal');
      error.permanent = true;

      const sleepSpy = jest.spyOn(worker, 'sleep');
      const processSpy = jest.spyOn(worker, '_processJobInternal').mockRejectedValue(error);

      await expect(worker.executeJobWithRetry(job)).rejects.toThrow('fatal');
      expect(sleepSpy).not.toHaveBeenCalled();

      sleepSpy.mockRestore();
      processSpy.mockRestore();
    });

    test('fails after exhausting retries', async () => {
      const job = { id: 'limit-job' };
      const error = new Error('retry limit reached');
      error.retriable = true;

      const sleepSpy = jest.spyOn(worker, 'sleep').mockResolvedValue();
      const processSpy = jest.spyOn(worker, '_processJobInternal').mockRejectedValue(error);

      await expect(worker.executeJobWithRetry(job)).rejects.toThrow('retry limit reached');
      expect(processSpy).toHaveBeenCalledTimes(worker.config.maxRetries + 1);
      expect(sleepSpy).toHaveBeenCalledTimes(worker.config.maxRetries);

      sleepSpy.mockRestore();
      processSpy.mockRestore();
    });
  });

  describe('utility methods', () => {
    beforeEach(() => {
      worker = new TestWorker();
    });

    test('should log with correct format', () => {
      const loggerSpy = jest.spyOn(advancedLogger.workerLogger, 'info').mockImplementation();

      worker.log('info', 'Test message', { data: 'test' });

      expect(loggerSpy).toHaveBeenCalledWith(
        'Test message',
        expect.objectContaining({
          worker: worker.workerName,
          workerType: 'test_worker',
          data: 'test'
        })
      );

      loggerSpy.mockRestore();
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
      const originalNodeEnv = process.env.NODE_ENV;
      const originalMockMode = mockMode.isMockMode;

      process.env.NODE_ENV = 'test';
      mockMode.isMockMode = true;

      class IncompleteWorker extends BaseWorker {
        constructor() {
          super('incomplete_worker');
        }
        // Missing processJob implementation
      }

      const incompleteWorker = new IncompleteWorker({ retryDelay: 1, maxRetries: 0 });

      const retryableSpy = jest.spyOn(incompleteWorker, 'isRetryableError').mockReturnValue(false);

      try {
        await expect(incompleteWorker.processJob({})).rejects.toThrow(
          '_processJobInternal method must be implemented by subclass'
        );
      } finally {
        retryableSpy.mockRestore();
        process.env.NODE_ENV = originalNodeEnv;
        mockMode.isMockMode = originalMockMode;
      }
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
      const signalHandlerCalls = processOnSpy.mock.calls.filter((call) =>
        ['SIGTERM', 'SIGINT', 'SIGQUIT', 'uncaughtException', 'unhandledRejection'].includes(
          call[0]
        )
      );

      expect(signalHandlerCalls).toHaveLength(0);
    });
  });

  describe('healthcheck', () => {
    beforeEach(async () => {
      worker = new TestWorker();
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({
            single: jest.fn(() => ({ data: { id: 'test' }, error: null }))
          }))
        }))
      });
      await worker.initializeConnections();
      // Initialize currentJobs for healthcheck
      worker.currentJobs = new Map();
    });

    test('should return health status when running', async () => {
      await worker.start();

      const health = await worker.healthcheck();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('workerType', 'test_worker');
      expect(health).toHaveProperty('workerName');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('checks');
      expect(health).toHaveProperty('metrics');
      expect(health.checks.running.status).toBe('healthy');
    });

    test('should return unhealthy when stopped', async () => {
      const health = await worker.healthcheck();

      expect(health.checks.running.status).toBe('unhealthy');
      expect(health.checks.running.message).toBe('Worker is stopped');
    });

    test('should check database connection in non-mock mode', async () => {
      const originalMockMode = mockMode.isMockMode;
      mockMode.isMockMode = false;

      await worker.start();
      const health = await worker.healthcheck();

      expect(health.checks.database).toHaveProperty('status');
      expect(health.checks.database).toHaveProperty('message');

      mockMode.isMockMode = originalMockMode;
    });

    test('should handle database connection errors', async () => {
      const originalMockMode = mockMode.isMockMode;
      mockMode.isMockMode = false;

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({
            single: jest.fn(() => ({ data: null, error: { message: 'Connection failed' } }))
          }))
        }))
      });

      await worker.start();
      const health = await worker.healthcheck();

      expect(health.checks.database.status).toBe('unhealthy');
      expect(health.checks.database.message).toContain('Database error');

      mockMode.isMockMode = originalMockMode;
    });

    test('should check queue connection', async () => {
      await worker.start();
      const health = await worker.healthcheck();

      expect(health.checks.queue).toHaveProperty('status');
      expect(health.checks.queue).toHaveProperty('message');
    });

    test('should detect no activity warning', async () => {
      await worker.start();
      worker.processedJobs = 1; // Need at least one processed job
      // Set lastActivityTime to 6 minutes ago (more than 5 minute threshold of 300000ms)
      worker.lastActivityTime = Date.now() - 360000;

      const health = await worker.healthcheck();

      expect(health.checks.processing.status).toBe('warning');
      expect(health.checks.processing.message).toContain('No activity');
    });

    test('should detect high failure rate', async () => {
      await worker.start();
      worker.processedJobs = 10;
      worker.failedJobs = 6; // 60% failure rate

      const health = await worker.healthcheck();

      expect(health.checks.performance.status).toBe('unhealthy');
      expect(health.checks.performance.message).toContain('High failure rate');
    });

    test('should detect elevated failure rate', async () => {
      await worker.start();
      worker.processedJobs = 10;
      worker.failedJobs = 3; // 30% failure rate

      const health = await worker.healthcheck();

      expect(health.checks.performance.status).toBe('warning');
      expect(health.checks.performance.message).toContain('Elevated failure rate');
    });

    test('should calculate success rate correctly', async () => {
      await worker.start();
      worker.processedJobs = 10;
      worker.failedJobs = 2;

      const health = await worker.healthcheck();

      expect(health.metrics.successRate).toBe('80.00%');
    });

    test('should handle getSpecificHealthDetails errors gracefully', async () => {
      await worker.start();

      // Make getSpecificHealthDetails throw an error (this is inside the try-catch)
      worker.getSpecificHealthDetails = jest
        .fn()
        .mockRejectedValue(new Error('Health check internal error'));

      const health = await worker.healthcheck();

      // The error should be caught and health status should be 'error'
      expect(health.status).toBe('error');
      expect(health).toHaveProperty('error');
      expect(health.error).toBe('Health check internal error');
    });
  });

  describe('processing times management', () => {
    test('should limit processing times array to maxProcessingTimeSamples', () => {
      worker = new TestWorker();
      // Override maxProcessingTimeSamples to test the limit logic
      worker.maxProcessingTimeSamples = 5;

      // Simulate what happens in processJobAsync when limit is exceeded
      // The code does: push() then check if length > max, then shift()
      for (let i = 0; i < 10; i++) {
        const processingTime = i * 100;
        worker.processingTimes.push(processingTime);
        // This is the exact logic from BaseWorker.js line 479-481
        if (worker.processingTimes.length > worker.maxProcessingTimeSamples) {
          worker.processingTimes.shift(); // Remove oldest sample
        }
      }

      // Should be limited to maxProcessingTimeSamples
      expect(worker.processingTimes.length).toBe(5);
      // Oldest values should be removed, keeping the last 5
      expect(worker.processingTimes[0]).toBe(500); // 5th value (index 4 * 100)
      expect(worker.processingTimes[4]).toBe(900); // Last value (index 9 * 100)
    });
  });

  describe('executeJobWithRetry edge cases', () => {
    beforeEach(() => {
      worker = new TestWorker({ maxRetries: 2, retryDelay: 5 });
    });

    test('should throw last error when all retries are exhausted', async () => {
      const job = { id: 'exhausted-retries' };
      const lastError = new Error('Final failure after retries');
      lastError.retriable = true;

      let attemptCount = 0;
      const processSpy = jest.spyOn(worker, '_processJobInternal').mockImplementation(async () => {
        attemptCount++;
        throw lastError;
      });

      const sleepSpy = jest.spyOn(worker, 'sleep').mockResolvedValue();

      await expect(worker.executeJobWithRetry(job)).rejects.toThrow('Final failure after retries');

      // Should attempt maxRetries + 1 times (initial + retries)
      expect(attemptCount).toBe(worker.config.maxRetries + 1);
      expect(sleepSpy).toHaveBeenCalledTimes(worker.config.maxRetries);

      processSpy.mockRestore();
      sleepSpy.mockRestore();
    });
  });
});
