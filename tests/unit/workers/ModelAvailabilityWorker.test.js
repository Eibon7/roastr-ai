/**
 * ModelAvailabilityWorker Tests
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

// Mock model availability service
const mockModelService = {
  forceRefresh: jest.fn(),
  getModelStats: jest.fn()
};

jest.mock('../../../src/services/modelAvailabilityService', () => ({
  getModelAvailabilityService: jest.fn(() => mockModelService)
}));

// Mock flags
jest.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn()
  }
}));

// ========================================
// IMPORTS (AFTER mocks)
// ========================================

const {
  ModelAvailabilityWorker,
  getModelAvailabilityWorker,
  startModelAvailabilityWorker,
  stopModelAvailabilityWorker
} = require('../../../src/workers/ModelAvailabilityWorker');
const { logger } = require('../../../src/utils/logger');

// ========================================
// TEST SUITE
// ========================================

describe('ModelAvailabilityWorker', () => {
  let worker;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Set default mock return value
    mockModelService.forceRefresh.mockResolvedValue({
      gpt5Available: false,
      models: {},
      nextCheck: new Date().toISOString()
    });
    
    mockModelService.getModelStats.mockResolvedValue({});
    
    worker = new ModelAvailabilityWorker();
  });

  afterEach(() => {
    if (worker && worker.isRunning) {
      worker.stop();
    }
    jest.useRealTimers();
  });

  // ========================================
  // INITIALIZATION TESTS
  // ========================================

  describe('Initialization', () => {
    test('should initialize with correct config', () => {
      expect(worker.serviceName).toBe('ModelAvailabilityWorker');
      expect(worker.intervalMs).toBe(24 * 60 * 60 * 1000); // 24 hours
      expect(worker.isRunning).toBe(false);
      expect(worker.intervalId).toBe(null);
    });

    test('should initialize modelService', () => {
      expect(worker.modelService).toBeDefined();
    });

    // Note: Worker doesn't log in constructor, only when start() is called
    test.skip('should log initialization', () => {
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting ModelAvailabilityWorker'),
        expect.any(Object)
      );
    });
  });

  // ========================================
  // START/STOP LIFECYCLE
  // ========================================

  describe('start()', () => {
    test('should start worker and schedule periodic checks', () => {
      const runCheckSpy = jest.spyOn(worker, 'runCheck').mockResolvedValue({});

      worker.start();

      expect(worker.isRunning).toBe(true);
      expect(worker.intervalId).not.toBe(null);
      expect(runCheckSpy).toHaveBeenCalledTimes(1); // Initial check

      // Fast-forward time and verify periodic execution
      jest.advanceTimersByTime(24 * 60 * 60 * 1000);
      expect(runCheckSpy).toHaveBeenCalledTimes(2);

      runCheckSpy.mockRestore();
    });

    test('should not start if already running', () => {
      worker.start();
      const intervalIdBefore = worker.intervalId;

      // Try to start again
      worker.start();

      expect(worker.intervalId).toBe(intervalIdBefore);
      expect(logger.warn).toHaveBeenCalledWith('ModelAvailabilityWorker already running');
    });

    test('should log start message', () => {
      jest.spyOn(worker, 'runCheck').mockResolvedValue({});

      worker.start();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting ModelAvailabilityWorker'),
        expect.objectContaining({
          intervalHours: 24,
          service: 'ModelAvailabilityWorker'
        })
      );
    });
  });

  describe('stop()', () => {
    test('should stop worker and clear interval', () => {
      jest.spyOn(worker, 'runCheck').mockResolvedValue({});
      worker.start();

      expect(worker.isRunning).toBe(true);

      worker.stop();

      expect(worker.isRunning).toBe(false);
      expect(worker.intervalId).toBe(null);
    });

    test('should log stop message', () => {
      jest.spyOn(worker, 'runCheck').mockResolvedValue({});
      worker.start();

      worker.stop();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Stopped ModelAvailabilityWorker')
      );
    });

    test('should handle stop when not running', () => {
      expect(() => worker.stop()).not.toThrow();
    });
  });

  // ========================================
  // RUN CHECK - SUCCESS CASES
  // ========================================

  describe('runCheck() - Success', () => {
    test('should run check successfully when GPT-5 available', async () => {
      const mockStatus = {
        gpt5Available: true,
        models: {
          'gpt-5-turbo': { available: true }
        },
        nextCheck: new Date().toISOString()
      };

      mockModelService.forceRefresh.mockResolvedValue(mockStatus);

      const result = await worker.runCheck();

      expect(result).toEqual(mockStatus);
      expect(mockModelService.forceRefresh).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Model availability check completed'),
        expect.objectContaining({
          worker: 'ModelAvailabilityWorker',
          gpt5Available: true
        })
      );
    });

    test('should run check successfully when GPT-5 NOT available', async () => {
      const mockStatus = {
        gpt5Available: false,
        models: {
          'gpt-4-turbo': { available: true }
        },
        nextCheck: new Date().toISOString()
      };

      mockModelService.forceRefresh.mockResolvedValue(mockStatus);

      const result = await worker.runCheck();

      expect(result).toEqual(mockStatus);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Model availability check completed'),
        expect.objectContaining({
          gpt5Available: false
        })
      );
    });

    test('should log special message when GPT-5 becomes available', async () => {
      const mockStatus = {
        gpt5Available: true,
        models: {
          'gpt-5-turbo': { available: true }
        },
        nextCheck: new Date().toISOString()
      };

      mockModelService.forceRefresh.mockResolvedValue(mockStatus);
      jest.spyOn(worker, 'notifyGPT5Available').mockResolvedValue();

      await worker.runCheck();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('GPT-5 IS NOW AVAILABLE'),
        expect.objectContaining({
          impact: expect.stringContaining('Paid plans')
        })
      );

      expect(worker.notifyGPT5Available).toHaveBeenCalledWith(mockStatus);
    });

    test('should track processing time', async () => {
      const mockStatus = { gpt5Available: false, models: {} };
      mockModelService.forceRefresh.mockResolvedValue(mockStatus);

      await worker.runCheck();

      expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          processingTimeMs: expect.any(Number)
        })
      );
    });
  });

  // ========================================
  // RUN CHECK - ERROR HANDLING
  // ========================================

  describe('runCheck() - Error Handling', () => {
    test('should handle model service failure', async () => {
      const error = new Error('Model service unavailable');
      mockModelService.forceRefresh.mockRejectedValue(error);

      await expect(worker.runCheck()).rejects.toThrow('Model service unavailable');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Model availability check failed'),
        expect.objectContaining({
          worker: 'ModelAvailabilityWorker',
          error: 'Model service unavailable'
        })
      );
    });

    test('should track processing time even on failure', async () => {
      mockModelService.forceRefresh.mockRejectedValue(new Error('Failed'));

      try {
        await worker.runCheck();
      } catch (e) {
        // Expected
      }

      expect(logger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          processingTimeMs: expect.any(Number)
        })
      );
    });
  });

  // ========================================
  // MANUAL CHECK
  // ========================================

  describe('runManualCheck()', () => {
    test('should execute manual check', async () => {
      const mockStatus = { gpt5Available: false, models: {} };
      mockModelService.forceRefresh.mockResolvedValue(mockStatus);

      const result = await worker.runManualCheck();

      expect(result).toEqual(mockStatus);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Running manual model availability check'),
        expect.objectContaining({
          worker: 'ModelAvailabilityWorker',
          trigger: 'manual'
        })
      );
    });

    test('should call runCheck internally', async () => {
      const runCheckSpy = jest.spyOn(worker, 'runCheck').mockResolvedValue({});

      await worker.runManualCheck();

      expect(runCheckSpy).toHaveBeenCalled();

      runCheckSpy.mockRestore();
    });
  });

  // ========================================
  // GET STATUS
  // ========================================

  describe('getStatus()', () => {
    test('should return worker status when not running', () => {
      const status = worker.getStatus();

      expect(status).toMatchObject({
        serviceName: 'ModelAvailabilityWorker',
        isRunning: false,
        intervalMs: 24 * 60 * 60 * 1000,
        intervalHours: 24,
        nextCheck: null
      });
    });

    test('should return worker status with next check when running', () => {
      jest.spyOn(worker, 'runCheck').mockResolvedValue({});
      worker.start();

      const status = worker.getStatus();

      expect(status).toMatchObject({
        serviceName: 'ModelAvailabilityWorker',
        isRunning: true,
        intervalMs: 24 * 60 * 60 * 1000,
        intervalHours: 24
      });

      expect(status.nextCheck).toBeInstanceOf(Date);
    });
  });

  // ========================================
  // GET STATS
  // ========================================

  describe('getStats()', () => {
    test('should return model stats', async () => {
      const mockStats = {
        totalChecks: 10,
        gpt5Available: false,
        lastCheck: new Date().toISOString()
      };

      mockModelService.getModelStats.mockResolvedValue(mockStats);

      const stats = await worker.getStats();

      expect(stats).toEqual(mockStats);
      expect(mockModelService.getModelStats).toHaveBeenCalled();
    });

    test('should return empty object if stats fetch fails', async () => {
      mockModelService.getModelStats.mockRejectedValue(new Error('Stats failed'));

      const stats = await worker.getStats();

      expect(stats).toEqual({});
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get model stats',
        expect.objectContaining({
          worker: 'ModelAvailabilityWorker',
          error: 'Stats failed'
        })
      );
    });
  });

  // ========================================
  // NOTIFY GPT-5 AVAILABLE
  // ========================================

  describe('notifyGPT5Available()', () => {
    test('should log GPT-5 availability notification', async () => {
      const mockStatus = {
        gpt5Available: true,
        models: { 'gpt-5-turbo': { available: true } }
      };

      await worker.notifyGPT5Available(mockStatus);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('GPT-5 availability notification sent'),
        expect.objectContaining({
          worker: 'ModelAvailabilityWorker',
          status: mockStatus,
          notificationChannels: ['logs']
        })
      );
    });

    test('should handle notification failure gracefully', async () => {
      // Simulate error by making logger.info throw
      const originalInfo = logger.info;
      logger.info.mockImplementationOnce(() => {
        throw new Error('Logger failed');
      });

      await expect(worker.notifyGPT5Available({})).resolves.not.toThrow();

      logger.info = originalInfo;
    });
  });

  // ========================================
  // SINGLETON PATTERN
  // ========================================

  describe('Singleton Pattern', () => {
    test('getModelAvailabilityWorker() should return same instance', () => {
      const instance1 = getModelAvailabilityWorker();
      const instance2 = getModelAvailabilityWorker();

      expect(instance1).toBe(instance2);
    });

    test('startModelAvailabilityWorker() should start worker', () => {
      jest.spyOn(ModelAvailabilityWorker.prototype, 'runCheck').mockResolvedValue({});

      const worker = startModelAvailabilityWorker();

      expect(worker.isRunning).toBe(true);
      expect(worker).toBeInstanceOf(ModelAvailabilityWorker);

      worker.stop(); // Cleanup
    });

    test('stopModelAvailabilityWorker() should stop worker', () => {
      jest.spyOn(ModelAvailabilityWorker.prototype, 'runCheck').mockResolvedValue({});

      const worker = startModelAvailabilityWorker();
      expect(worker.isRunning).toBe(true);

      stopModelAvailabilityWorker();
      expect(worker.isRunning).toBe(false);
    });
  });
});

