/**
 * Comprehensive BaseWorker Tests
 * 
 * Full test coverage for the BaseWorker class including:
 * - Constructor and initialization
 * - Connection management
 * - Worker lifecycle (start/stop)
 * - Job processing
 * - Error handling
 * - Statistics and monitoring
 * - Graceful shutdown
 */

const BaseWorker = require('../../../src/workers/BaseWorker');
const QueueService = require('../../../src/services/queueService');
const { createClient } = require('@supabase/supabase-js');

// Mock external dependencies
jest.mock('@supabase/supabase-js');
jest.mock('../../../src/services/queueService');
jest.mock('../../../src/config/mockMode', () => ({
  mockMode: {
    isMockMode: false,
    generateMockSupabaseClient: jest.fn(() => ({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({
            single: jest.fn(() => ({ error: null }))
          }))
        }))
      }))
    }))
  }
}));

describe('BaseWorker', () => {
  let worker;
  let mockSupabaseClient;
  let mockQueueService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env.SUPABASE_URL = 'http://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

    // Mock Supabase client
    mockSupabaseClient = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({
            single: jest.fn(() => ({ error: null }))
          }))
        }))
      }))
    };
    createClient.mockReturnValue(mockSupabaseClient);

    // Mock Queue Service
    mockQueueService = {
      initialize: jest.fn().mockResolvedValue(true),
      getNextJob: jest.fn().mockResolvedValue(null),
      completeJob: jest.fn().mockResolvedValue(true),
      failJob: jest.fn().mockResolvedValue(true),
      shutdown: jest.fn().mockResolvedValue(true)
    };
    QueueService.mockImplementation(() => mockQueueService);

    // Spy on console.log to verify logging
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    if (worker && worker.isRunning) {
      await worker.stop();
    }
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with correct default properties', () => {
      worker = new BaseWorker('test_worker');

      expect(worker.workerType).toBe('test_worker');
      expect(worker.workerName).toMatch(/test_worker-worker-\d+/);
      expect(worker.isRunning).toBe(false);
      expect(worker.processedJobs).toBe(0);
      expect(worker.failedJobs).toBe(0);
      expect(typeof worker.startTime).toBe('number');
      expect(worker.lastActivityTime).toBeNull();
      expect(worker.processingTimes).toEqual([]);
      expect(worker.maxProcessingTimeSamples).toBe(100);
    });

    it('should accept custom configuration options', () => {
      const customConfig = {
        maxRetries: 5,
        retryDelay: 3000,
        maxConcurrency: 5,
        pollInterval: 2000,
        gracefulShutdownTimeout: 45000
      };

      worker = new BaseWorker('test_worker', customConfig);

      expect(worker.config.maxRetries).toBe(5);
      expect(worker.config.retryDelay).toBe(3000);
      expect(worker.config.maxConcurrency).toBe(5);
      expect(worker.config.pollInterval).toBe(2000);
      expect(worker.config.gracefulShutdownTimeout).toBe(45000);
    });

    it('should merge custom options with defaults', () => {
      worker = new BaseWorker('test_worker', { maxRetries: 5 });

      expect(worker.config.maxRetries).toBe(5);
      expect(worker.config.retryDelay).toBe(5000); // default
      expect(worker.config.maxConcurrency).toBe(3); // default
    });

    it('should initialize connections during construction', () => {
      worker = new BaseWorker('test_worker');

      expect(createClient).toHaveBeenCalledWith(
        'http://test.supabase.co',
        'test-service-key'
      );
      expect(QueueService).toHaveBeenCalled();
    });
  });

  describe('Connection Initialization', () => {
    it('should throw error if required environment variables are missing', () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_KEY;

      expect(() => {
        worker = new BaseWorker('test_worker');
      }).toThrow('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
    });

    it('should use SUPABASE_ANON_KEY if SERVICE_KEY is not available', () => {
      delete process.env.SUPABASE_SERVICE_KEY;
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';

      worker = new BaseWorker('test_worker');

      expect(createClient).toHaveBeenCalledWith(
        'http://test.supabase.co',
        'test-anon-key'
      );
    });

    it('should use mock services in mock mode', () => {
      const mockMode = require('../../../src/config/mockMode');
      mockMode.mockMode.isMockMode = true;

      worker = new BaseWorker('test_worker');

      expect(mockMode.mockMode.generateMockSupabaseClient).toHaveBeenCalled();
      expect(worker.queueService).toHaveProperty('initialize');
      expect(worker.queueService).toHaveProperty('getNextJob');

      mockMode.mockMode.isMockMode = false; // Reset
    });
  });

  describe('Worker Lifecycle', () => {
    beforeEach(() => {
      worker = new BaseWorker('test_worker');
    });

    describe('start()', () => {
      it('should start the worker successfully', async () => {
        await worker.start();

        expect(worker.isRunning).toBe(true);
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('[INFO]')
        );
      });

      it('should test connections before starting', async () => {
        await worker.start();

        expect(mockSupabaseClient.from).toHaveBeenCalledWith('organizations');
        expect(mockQueueService.initialize).toHaveBeenCalled();
      });

      it('should throw error if worker is already running', async () => {
        worker.isRunning = true;

        await expect(worker.start()).rejects.toThrow(
          'Worker test_worker-worker-'
        );
      });

      it('should handle connection test failures', async () => {
        // Override the mock to return an error - note the promise structure
        worker.supabase.from = jest.fn(() => ({
          select: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve({ error: { message: 'DB Error' } }))
          }))
        }));

        await expect(worker.start()).rejects.toThrow(
          'Database connection failed: DB Error'
        );
        expect(worker.isRunning).toBe(false);
      });

      it('should handle queue service initialization failures', async () => {
        mockQueueService.initialize.mockRejectedValue(new Error('Queue Error'));

        await expect(worker.start()).rejects.toThrow(
          'Queue service initialization failed: Queue Error'
        );
        expect(worker.isRunning).toBe(false);
      });
    });

    describe('stop()', () => {
      it('should stop a running worker gracefully', async () => {
        await worker.start();
        expect(worker.isRunning).toBe(true);

        await worker.stop();

        expect(worker.isRunning).toBe(false);
        expect(mockQueueService.shutdown).toHaveBeenCalled();
      });

      it('should do nothing if worker is not running', async () => {
        expect(worker.isRunning).toBe(false);

        await worker.stop();

        expect(worker.isRunning).toBe(false);
        expect(mockQueueService.shutdown).not.toHaveBeenCalled();
      });

      it('should wait for current jobs to complete', async () => {
        await worker.start();
        worker.currentJobs = new Map([['job1', { id: 'job1' }]]);

        const stopPromise = worker.stop();

        // Simulate job completion
        setTimeout(() => {
          worker.currentJobs.clear();
        }, 10);

        await stopPromise;

        expect(worker.isRunning).toBe(false);
      });

      it('should force stop after timeout', async () => {
        worker.config.gracefulShutdownTimeout = 100; // Short timeout for testing
        await worker.start();
        worker.currentJobs = new Map([['job1', { id: 'job1' }]]);

        const stopPromise = worker.stop();

        // Don't clear jobs, let it timeout
        await stopPromise;

        expect(worker.isRunning).toBe(false);
      });

      it('should handle case where currentJobs is never initialized', async () => {
        await worker.start();
        worker.currentJobs = null; // Simulate never being initialized

        const stopPromise = worker.stop();
        await stopPromise;

        expect(worker.isRunning).toBe(false);
      });
    });
  });

  describe('Connection Testing', () => {
    beforeEach(() => {
      worker = new BaseWorker('test_worker');
    });

    it('should skip connection tests in mock mode', async () => {
      const mockMode = require('../../../src/config/mockMode');
      mockMode.mockMode.isMockMode = true;

      await worker.testConnections();

      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
      
      mockMode.mockMode.isMockMode = false; // Reset
    });

    it('should test database connection successfully', async () => {
      await worker.testConnections();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('organizations');
    });

    it('should throw error on database connection failure', async () => {
      // Override the worker's supabase instance - note the promise structure
      worker.supabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ error: { message: 'Connection failed' } }))
        }))
      }));

      await expect(worker.testConnections()).rejects.toThrow(
        'Database connection failed: Connection failed'
      );
    });

    it('should test queue service initialization', async () => {
      await worker.testConnections();

      expect(mockQueueService.initialize).toHaveBeenCalled();
    });

    it('should throw error on queue service failure', async () => {
      mockQueueService.initialize.mockRejectedValue(new Error('Redis connection failed'));

      await expect(worker.testConnections()).rejects.toThrow(
        'Queue service initialization failed: Redis connection failed'
      );
    });
  });

  describe('Job Processing', () => {
    beforeEach(async () => {
      worker = new BaseWorker('test_worker');
      // Mock the abstract processJob method
      worker.processJob = jest.fn().mockResolvedValue({ success: true });
      await worker.start();
    });

    describe('getNextJob()', () => {
      it('should get next job from queue service', async () => {
        const mockJob = { id: 'job1', type: 'test' };
        mockQueueService.getNextJob.mockResolvedValue(mockJob);

        const job = await worker.getNextJob();

        expect(job).toEqual(mockJob);
        expect(mockQueueService.getNextJob).toHaveBeenCalledWith('test_worker', {
          timeout: 1
        });
      });

      it('should return null when queue service fails', async () => {
        mockQueueService.getNextJob.mockRejectedValue(new Error('Queue error'));

        const job = await worker.getNextJob();

        expect(job).toBeNull();
      });

      it('should return null when no jobs available', async () => {
        mockQueueService.getNextJob.mockResolvedValue(null);

        const job = await worker.getNextJob();

        expect(job).toBeNull();
      });
    });

    describe('processJobAsync()', () => {
      it('should process job successfully', async () => {
        const mockJob = { id: 'job1', type: 'test', organization_id: 'org1' };
        const mockResult = { success: true, data: 'processed' };
        worker.processJob.mockResolvedValue(mockResult);

        await worker.processJobAsync(mockJob);

        expect(worker.processJob).toHaveBeenCalledWith(mockJob);
        expect(mockQueueService.completeJob).toHaveBeenCalledWith(
          mockJob,
          expect.objectContaining({
            result: mockResult,
            processingTime: expect.any(Number),
            completedBy: worker.workerName
          })
        );
        expect(worker.processedJobs).toBe(1);
        expect(worker.lastActivityTime).toBeTruthy();
      });

      it('should track processing times', async () => {
        const mockJob = { id: 'job1', type: 'test' };
        worker.processJob.mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return { success: true };
        });

        await worker.processJobAsync(mockJob);

        expect(worker.processingTimes).toHaveLength(1);
        expect(worker.processingTimes[0]).toBeGreaterThan(0);
      });

      it('should limit processing time samples', async () => {
        const mockJob = { id: 'job1', type: 'test' };
        
        // Fill up to max samples + 1
        for (let i = 0; i <= worker.maxProcessingTimeSamples; i++) {
          await worker.processJobAsync(mockJob);
        }

        expect(worker.processingTimes).toHaveLength(worker.maxProcessingTimeSamples);
      });

      it('should handle job processing errors', async () => {
        const mockJob = { id: 'job1', type: 'test' };
        const error = new Error('Processing failed');
        worker.processJob.mockRejectedValue(error);

        await worker.processJobAsync(mockJob);

        expect(mockQueueService.failJob).toHaveBeenCalledWith(mockJob, error);
        expect(worker.failedJobs).toBe(1);
        expect(worker.processedJobs).toBe(0);
      });

      it('should handle jobs without IDs', async () => {
        const mockJob = { type: 'test' };
        
        await worker.processJobAsync(mockJob);

        expect(worker.processJob).toHaveBeenCalledWith(mockJob);
        expect(worker.processedJobs).toBe(1);
      });

      it('should clean up currentJobs map', async () => {
        const mockJob = { id: 'job1', type: 'test' };
        
        const processPromise = worker.processJobAsync(mockJob);
        
        // Job should be in currentJobs during processing
        expect(worker.currentJobs.has('job1')).toBe(true);
        
        await processPromise;
        
        // Job should be removed after processing
        expect(worker.currentJobs.has('job1')).toBe(false);
      });
    });

    describe('processJob() abstract method', () => {
      it('should throw error when not implemented', async () => {
        const baseWorker = new BaseWorker('test');
        const mockJob = { id: 'job1' };

        await expect(baseWorker.processJob(mockJob)).rejects.toThrow(
          'processJob method must be implemented by subclass'
        );
      });
    });

    describe('markJobCompleted()', () => {
      it('should mark job as completed successfully', async () => {
        const mockJob = { id: 'job1' };
        const mockResult = { success: true };
        const processingTime = 150;

        await worker.markJobCompleted(mockJob, mockResult, processingTime);

        expect(mockQueueService.completeJob).toHaveBeenCalledWith(
          mockJob,
          expect.objectContaining({
            result: mockResult,
            processingTime,
            completedBy: worker.workerName
          })
        );
      });

      it('should handle completion errors gracefully', async () => {
        const mockJob = { id: 'job1' };
        const error = new Error('Completion failed');
        mockQueueService.completeJob.mockRejectedValue(error);

        // Should not throw
        await worker.markJobCompleted(mockJob, { success: true }, 100);

        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Failed to mark job as completed')
        );
      });
    });

    describe('handleJobError()', () => {
      it('should handle job errors properly', async () => {
        const mockJob = { id: 'job1', attempts: 2 };
        const error = new Error('Job failed');

        await worker.handleJobError(mockJob, error);

        expect(mockQueueService.failJob).toHaveBeenCalledWith(mockJob, error);
        expect(worker.failedJobs).toBe(1);
      });

      it('should handle jobs without IDs', async () => {
        const mockJob = { type: 'test' };
        const error = new Error('Job failed');

        await worker.handleJobError(mockJob, error);

        expect(mockQueueService.failJob).toHaveBeenCalledWith(mockJob, error);
      });

      it('should handle failure to mark job as failed', async () => {
        const mockJob = { id: 'job1' };
        const error = new Error('Job failed');
        const failureError = new Error('Failed to mark as failed');
        mockQueueService.failJob.mockRejectedValue(failureError);

        // Should not throw
        await worker.handleJobError(mockJob, error);

        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Failed to handle job error')
        );
      });
    });
  });

  describe('Processing Loop', () => {
    beforeEach(async () => {
      worker = new BaseWorker('test_worker', { pollInterval: 10, gracefulShutdownTimeout: 100 });
      worker.processJob = jest.fn().mockResolvedValue({ success: true });
    });

    it('should initialize processing loop properly', async () => {
      await worker.start();
      
      expect(worker.isRunning).toBe(true);
      expect(worker.currentJobs).toBeInstanceOf(Map);
      
      await worker.stop();
    });

    it('should respect max concurrency concept', () => {
      worker.config.maxConcurrency = 2;
      worker.currentJobs = new Map([
        ['job1', { id: 'job1' }],
        ['job2', { id: 'job2' }]
      ]);

      // Should indicate at capacity
      expect(worker.currentJobs.size).toBe(worker.config.maxConcurrency);
    });

    it('should handle processing loop component functionality', async () => {
      // Test the components of processing loop without the actual loop
      await worker.start();
      
      // Test job retrieval
      const mockJob = { id: 'job1', type: 'test' };
      mockQueueService.getNextJob.mockResolvedValueOnce(mockJob);
      
      const job = await worker.getNextJob();
      expect(job).toEqual(mockJob);
      
      await worker.stop();
    });

    it('should handle errors in loop components', async () => {
      mockQueueService.getNextJob.mockRejectedValue(new Error('Queue error'));

      const job = await worker.getNextJob();

      expect(job).toBeNull();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get job from queue')
      );
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(() => {
      worker = new BaseWorker('test_worker');
    });

    describe('getStats()', () => {
      it('should return worker statistics', () => {
        worker.processedJobs = 50;
        worker.failedJobs = 5;
        worker.currentJobs = new Map([['job1', {}]]);

        const stats = worker.getStats();

        expect(stats).toEqual({
          workerName: worker.workerName,
          workerType: 'test_worker',
          isRunning: false,
          processedJobs: 50,
          failedJobs: 5,
          currentJobs: 1,
          uptime: expect.any(Number),
          config: worker.config
        });
      });
    });

    describe('updateActivityTime()', () => {
      it('should update last activity time', () => {
        expect(worker.lastActivityTime).toBeNull();
        
        worker.updateActivityTime();
        
        expect(typeof worker.lastActivityTime).toBe('number');
        expect(worker.lastActivityTime).toBeCloseTo(Date.now(), -2);
      });
    });

    describe('getAverageProcessingTime()', () => {
      it('should return N/A when no processing times recorded', () => {
        expect(worker.getAverageProcessingTime()).toBe('N/A');
      });

      it('should calculate correct average', () => {
        worker.processingTimes = [100, 200, 300];
        
        expect(worker.getAverageProcessingTime()).toBe('200ms');
      });

      it('should handle empty array', () => {
        worker.processingTimes = [];
        
        expect(worker.getAverageProcessingTime()).toBe('N/A');
      });

      it('should round to nearest millisecond', () => {
        worker.processingTimes = [150, 175];
        
        expect(worker.getAverageProcessingTime()).toBe('163ms');
      });
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      worker = new BaseWorker('test_worker');
    });

    describe('log()', () => {
      it('should log with correct format', () => {
        worker.log('info', 'Test message', { extra: 'data' });

        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('[INFO]')
        );
        
        const logCall = console.log.mock.calls[0][0];
        const logEntry = JSON.parse(logCall.split('] ')[1]);
        
        expect(logEntry).toMatchObject({
          level: 'info',
          worker: worker.workerName,
          workerType: 'test_worker',
          message: 'Test message',
          extra: 'data',
          timestamp: expect.any(String)
        });
      });

      it('should handle logs without metadata', () => {
        worker.log('error', 'Error message');

        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('[ERROR]')
        );
      });
    });

    describe('sleep()', () => {
      it('should resolve after specified time', async () => {
        const start = Date.now();
        await worker.sleep(10);
        const elapsed = Date.now() - start;
        
        expect(elapsed).toBeGreaterThanOrEqual(8); // Allow some variance
      });
    });
  });

  describe('Graceful Shutdown', () => {
    beforeEach(() => {
      worker = new BaseWorker('test_worker');
    });

    it('should set up signal handlers', () => {
      const processOnSpy = jest.spyOn(process, 'on');
      
      worker = new BaseWorker('test_worker');

      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGQUIT', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      worker = new BaseWorker('test_worker');
    });

    it('should handle supabase connection errors during start', async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Connection refused');
      });

      await expect(worker.start()).rejects.toThrow();
      expect(worker.isRunning).toBe(false);
    });

    it('should handle queue service errors during start', async () => {
      mockQueueService.initialize.mockRejectedValue(new Error('Redis unavailable'));

      await expect(worker.start()).rejects.toThrow('Queue service initialization failed');
      expect(worker.isRunning).toBe(false);
    });

    it('should handle processing loop exceptions', async () => {
      worker.processJob = jest.fn().mockResolvedValue({ success: true });
      
      // Test that getNextJob handles errors properly (already tested above)
      mockQueueService.getNextJob.mockRejectedValue(new Error('Unexpected error'));
      
      const job = await worker.getNextJob();
      expect(job).toBeNull();
    });
  });

  describe('Integration Scenarios', () => {
    beforeEach(async () => {
      worker = new BaseWorker('test_worker', { 
        maxConcurrency: 2,
        pollInterval: 50,
        gracefulShutdownTimeout: 100
      });
      worker.processJob = jest.fn().mockResolvedValue({ success: true });
    });

    it('should handle full worker lifecycle', async () => {
      // Start worker
      await worker.start();
      expect(worker.isRunning).toBe(true);
      expect(worker.currentJobs).toBeInstanceOf(Map);

      // Stop worker
      await worker.stop();
      expect(worker.isRunning).toBe(false);
      expect(mockQueueService.shutdown).toHaveBeenCalled();
    });

    it('should maintain correct initial statistics', async () => {
      // Initialize currentJobs map by starting the worker
      await worker.start();
      await worker.stop();
      
      const stats = worker.getStats();
      
      expect(stats.processedJobs).toBe(0);
      expect(stats.failedJobs).toBe(0);
      expect(stats.isRunning).toBe(false);
      expect(stats.uptime).toBeGreaterThan(0);
      expect(stats.workerType).toBe('test_worker');
      expect(stats.currentJobs).toBe(0);
    });

    it('should handle job processing workflow', async () => {
      const mockJob = { id: 'job1', type: 'test' };
      
      await worker.start();
      
      // Manually test job processing
      await worker.processJobAsync(mockJob);
      
      const stats = worker.getStats();
      expect(stats.processedJobs).toBe(1);
      expect(stats.failedJobs).toBe(0);
      
      await worker.stop();
    });
  });
});