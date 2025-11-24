/**
 * Shield Action Worker Tests
 *
 * Tests for executing automated Shield moderation actions
 */

const ShieldActionWorker = require('../../../src/workers/ShieldActionWorker');

// Mock BaseWorker
jest.mock('../../../src/workers/BaseWorker', () => {
  return class MockBaseWorker {
    constructor(workerType, options = {}) {
      this.workerType = workerType;
      this.workerName = `${workerType}-worker-test`;
      this.config = { maxRetries: 3, ...options };
      this.supabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn()
            }))
          })),
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn()
            }))
          })),
          update: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn()
              }))
            }))
          }))
        }))
      };
      this.queueService = {
        addJob: jest.fn(),
        initialize: jest.fn(),
        shutdown: jest.fn()
      };
      this.redis = null;
      this.log = jest.fn();
      this.start = jest.fn();
      this.stop = jest.fn();
      this.initializeConnections = jest.fn();
      this.setupGracefulShutdown = jest.fn();
    }
  };
});

// The new ShieldActionWorker uses the ShieldActionExecutorService
// No need for individual platform service mocks

describe('ShieldActionWorker', () => {
  let worker;
  let mockSupabase;

  beforeEach(() => {
    worker = new ShieldActionWorker();
    mockSupabase = worker.supabase;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Ensure worker is properly stopped to avoid open handles
    if (worker && typeof worker.stop === 'function') {
      await worker.stop();
    }
  });

  describe('constructor', () => {
    test('should initialize worker with correct type', () => {
      expect(worker.workerType).toBe('shield_action');
      expect(worker.actionExecutor).toBeDefined();
      expect(worker.persistenceService).toBeDefined();
      expect(worker.costControl).toBeDefined();
      expect(worker.workerMetrics).toBeDefined();
    });
  });

  describe('processJob', () => {
    test('should execute hideComment action', async () => {
      const job = {
        id: 'job-123',
        payload: {
          organizationId: 'org-123',
          userId: 'user-456',
          platform: 'twitter',
          accountRef: '@testorg',
          externalCommentId: 'tweet-123',
          externalAuthorId: 'user-456',
          externalAuthorUsername: 'testuser',
          action: 'hideComment',
          reason: 'Toxic content detected'
        }
      };

      // Mock action executor
      worker.actionExecutor.executeAction = jest.fn().mockResolvedValue({
        success: true,
        action: 'hideComment',
        details: { platform: 'twitter' },
        fallback: false,
        requiresManualReview: false,
        executionTime: 250
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.action).toBe('hideComment');
      expect(result.platform).toBe('twitter');
      expect(worker.actionExecutor.executeAction).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-123',
          platform: 'twitter',
          action: 'hideComment'
        })
      );
    });

    test('should execute blockUser action', async () => {
      const job = {
        id: 'job-456',
        payload: {
          organizationId: 'org-123',
          userId: 'user-789',
          platform: 'twitter',
          accountRef: '@testorg',
          externalCommentId: 'tweet-456',
          externalAuthorId: 'user-789',
          externalAuthorUsername: 'toxicuser',
          action: 'blockUser',
          reason: 'Repeated violations'
        }
      };

      // Mock action executor
      worker.actionExecutor.executeAction = jest.fn().mockResolvedValue({
        success: true,
        action: 'blockUser',
        details: { platform: 'twitter', blockId: 'block-456' },
        fallback: false,
        requiresManualReview: false,
        executionTime: 300
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.action).toBe('blockUser');
      expect(result.platform).toBe('twitter');
      expect(worker.actionExecutor.executeAction).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-123',
          platform: 'twitter',
          action: 'blockUser'
        })
      );
    });

    test('should handle action execution failure', async () => {
      const job = {
        id: 'job-789',
        payload: {
          organizationId: 'org-123',
          platform: 'twitter',
          externalCommentId: 'tweet-789',
          externalAuthorId: 'user-123',
          action: 'hideComment',
          reason: 'Test failure handling'
        }
      };

      // Mock action executor to throw error
      worker.actionExecutor.executeAction = jest
        .fn()
        .mockRejectedValue(new Error('Platform API error'));

      await expect(worker.processJob(job)).rejects.toThrow('Platform API error');

      expect(worker.workerMetrics.failedActions).toBe(1);
    });

    test('should handle missing required parameters', async () => {
      const job = {
        id: 'job-invalid',
        payload: {
          // Missing required fields
          platform: 'twitter'
        }
      };

      await expect(worker.processJob(job)).rejects.toThrow(
        'Missing required Shield action parameters'
      );
    });
  });

  describe('getSpecificHealthDetails', () => {
    test('should return comprehensive health status', async () => {
      const healthDetails = await worker.getSpecificHealthDetails();

      expect(healthDetails).toHaveProperty('workerMetrics');
      expect(healthDetails).toHaveProperty('actionExecutor');
      expect(healthDetails).toHaveProperty('platformCapabilities');
      expect(healthDetails).toHaveProperty('persistence');
      expect(healthDetails).toHaveProperty('costControl');

      expect(healthDetails.workerMetrics).toBe(worker.workerMetrics);
      expect(healthDetails.persistence.connected).toBe(true);
      expect(healthDetails.costControl.enabled).toBe(true);
    });
  });

  describe('getWorkerMetrics', () => {
    test('should return combined metrics', () => {
      const metrics = worker.getWorkerMetrics();

      expect(metrics).toHaveProperty('totalProcessed');
      expect(metrics).toHaveProperty('successfulActions');
      expect(metrics).toHaveProperty('failedActions');
      expect(metrics).toHaveProperty('fallbackActions');
      expect(metrics).toHaveProperty('actionExecutorMetrics');
      expect(metrics).toHaveProperty('circuitBreakerStatus');
    });
  });
});
