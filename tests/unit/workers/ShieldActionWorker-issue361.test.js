/**
 * Unit Tests for Shield Action Worker (Issue 361 Implementation)
 * 
 * Tests the refactored ShieldActionWorker that uses the unified
 * ShieldActionExecutorService with circuit breaker, retry logic,
 * and fallback strategies.
 */

const ShieldActionWorker = require('../../../src/workers/ShieldActionWorker');

// Mock dependencies
jest.mock('../../../src/services/shieldActionExecutor');
jest.mock('../../../src/services/shieldPersistenceService');
jest.mock('../../../src/services/costControl');

const ShieldActionExecutorService = require('../../../src/services/shieldActionExecutor');
const ShieldPersistenceService = require('../../../src/services/shieldPersistenceService');
const CostControlService = require('../../../src/services/costControl');

describe('ShieldActionWorker (Issue 361)', () => {
  let worker;
  let mockActionExecutor;
  let mockPersistenceService;
  let mockCostControl;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock action executor
    mockActionExecutor = {
      executeAction: jest.fn(),
      getMetrics: jest.fn().mockReturnValue({
        totalActions: 10,
        successfulActions: 8,
        failedActions: 2,
        fallbackActions: 1,
        byPlatform: {
          twitter: { total: 5, successful: 4, failed: 1 },
          youtube: { total: 3, successful: 2, failed: 1 },
          discord: { total: 2, successful: 2, failed: 0 }
        },
        byAction: {
          hideComment: { total: 6, successful: 5, failed: 1 },
          blockUser: { total: 4, successful: 3, failed: 1 }
        }
      }),
      getCircuitBreakerStatus: jest.fn().mockReturnValue({
        twitter: { state: 'closed', failureCount: 0 },
        youtube: { state: 'closed', failureCount: 1 },
        discord: { state: 'open', failureCount: 5 }
      }),
      getAdapterCapabilities: jest.fn().mockReturnValue({
        twitter: { hideComment: true, reportUser: false, blockUser: true },
        youtube: { hideComment: true, reportUser: false, blockUser: false },
        discord: { hideComment: true, reportUser: false, blockUser: true }
      })
    };
    
    // Mock persistence service
    mockPersistenceService = {
      recordShieldEvent: jest.fn().mockResolvedValue({ id: 'event-123' })
    };
    
    // Mock cost control
    mockCostControl = {
      recordUsage: jest.fn().mockResolvedValue()
    };
    
    // Setup mocks
    ShieldActionExecutorService.mockImplementation(() => mockActionExecutor);
    ShieldPersistenceService.mockImplementation(() => mockPersistenceService);
    CostControlService.mockImplementation(() => mockCostControl);
    
    worker = new ShieldActionWorker();
  });
  
  describe('Constructor and Initialization', () => {
    test('should initialize with correct worker configuration', () => {
      expect(worker.queueName).toBe('shield_action');
      expect(worker.options.maxConcurrency).toBe(3);
      expect(worker.options.pollInterval).toBe(2000);
      expect(worker.options.maxRetries).toBe(1); // Let executor handle retries
      expect(worker.options.priority).toBe(1);
    });
    
    test('should initialize action executor with correct config', () => {
      expect(ShieldActionExecutorService).toHaveBeenCalledWith({
        maxRetries: 3,
        baseDelay: 500,
        maxDelay: 30000,
        failureThreshold: 5,
        recoveryTimeout: 60000
      });
    });
    
    test('should initialize worker metrics', () => {
      expect(worker.workerMetrics.totalProcessed).toBe(0);
      expect(worker.workerMetrics.successfulActions).toBe(0);
      expect(worker.workerMetrics.failedActions).toBe(0);
      expect(worker.workerMetrics.fallbackActions).toBe(0);
      expect(worker.workerMetrics.averageProcessingTime).toBe(0);
    });
  });
  
  describe('Health Details', () => {
    test('should provide comprehensive health details', async () => {
      const healthDetails = await worker.getSpecificHealthDetails();
      
      expect(healthDetails).toHaveProperty('workerMetrics');
      expect(healthDetails).toHaveProperty('actionExecutor');
      expect(healthDetails).toHaveProperty('platformCapabilities');
      expect(healthDetails).toHaveProperty('persistence');
      expect(healthDetails).toHaveProperty('costControl');
      
      expect(healthDetails.actionExecutor.metrics).toBeDefined();
      expect(healthDetails.actionExecutor.circuitBreakers).toBeDefined();
      expect(healthDetails.actionExecutor.supportedPlatforms).toEqual([
        'twitter', 'youtube', 'discord'
      ]);
      
      expect(healthDetails.platformCapabilities.twitter.hideComment).toBe(true);
      expect(healthDetails.platformCapabilities.youtube.blockUser).toBe(false);
    });
    
    test('should include current worker metrics in health details', async () => {
      // Update some metrics
      worker.updateWorkerMetrics(true, false, 150);
      worker.updateWorkerMetrics(false, true, 200);
      
      const healthDetails = await worker.getSpecificHealthDetails();
      
      expect(healthDetails.workerMetrics.totalProcessed).toBe(2);
      expect(healthDetails.workerMetrics.successfulActions).toBe(1);
      expect(healthDetails.workerMetrics.failedActions).toBe(1);
      expect(healthDetails.workerMetrics.fallbackActions).toBe(1);
    });
  });
  
  describe('Job Processing', () => {
    const validJobPayload = {
      organizationId: 'org-123',
      userId: 'user-456',
      platform: 'twitter',
      accountRef: '@testorg',
      externalCommentId: 'tweet-789',
      externalAuthorId: 'author-111',
      externalAuthorUsername: 'toxicuser',
      action: 'hideComment',
      reason: 'Toxic content detected',
      originalText: 'This is a toxic comment',
      metadata: { severity: 'high' }
    };
    
    test('should process valid job successfully', async () => {
      const mockExecutorResult = {
        success: true,
        action: 'hideComment',
        fallback: null,
        requiresManualReview: false,
        executionTime: 150,
        details: { tweetId: 'tweet-789' }
      };
      
      mockActionExecutor.executeAction.mockResolvedValue(mockExecutorResult);
      
      const result = await worker.processJob({ payload: validJobPayload, id: 'job-123' });
      
      expect(result.success).toBe(true);
      expect(result.summary).toBe('Shield action executed: hideComment on twitter');
      expect(result.platform).toBe('twitter');
      expect(result.action).toBe('hideComment');
      expect(result.requiresManualReview).toBe(false);
      
      expect(mockActionExecutor.executeAction).toHaveBeenCalledWith({
        organizationId: 'org-123',
        userId: 'user-456',
        platform: 'twitter',
        accountRef: '@testorg',
        externalCommentId: 'tweet-789',
        externalAuthorId: 'author-111',
        externalAuthorUsername: 'toxicuser',
        action: 'hideComment',
        reason: 'Toxic content detected',
        originalText: 'This is a toxic comment',
        metadata: {
          severity: 'high',
          jobId: 'job-123',
          workerId: worker.workerId,
          queueName: 'shield_action'
        }
      });
    });
    
    test('should handle job with fallback action', async () => {
      const reportUserPayload = {
        ...validJobPayload,
        action: 'reportUser'
      };
      
      const mockExecutorResult = {
        success: true,
        action: 'blockUser',
        originalAction: 'reportUser',
        fallback: 'blockUser',
        requiresManualReview: false,
        executionTime: 200,
        details: { userId: 'author-111' }
      };
      
      mockActionExecutor.executeAction.mockResolvedValue(mockExecutorResult);
      
      const result = await worker.processJob({ payload: reportUserPayload, id: 'job-124' });
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('blockUser');
      expect(result.originalAction).toBe('reportUser');
      expect(result.fallback).toBe('blockUser');
    });
    
    test('should handle job requiring manual review', async () => {
      const mockExecutorResult = {
        success: true,
        action: 'reportUser',
        fallback: 'manual_review',
        requiresManualReview: true,
        executionTime: 50,
        details: {
          manualInstructions: 'Use Twitter web interface to report manually'
        }
      };
      
      mockActionExecutor.executeAction.mockResolvedValue(mockExecutorResult);
      
      const result = await worker.processJob({ payload: validJobPayload, id: 'job-125' });
      
      expect(result.success).toBe(true);
      expect(result.requiresManualReview).toBe(true);
      expect(result.fallback).toBe('manual_review');
    });
    
    test('should validate required job parameters', async () => {
      const invalidPayload = {
        organizationId: 'org-123',
        platform: 'twitter'
        // Missing required fields
      };
      
      await expect(worker.processJob({ payload: invalidPayload }))
        .rejects.toThrow('Missing required Shield action parameters');
    });
    
    test('should record usage for successful actions', async () => {
      const mockExecutorResult = {
        success: true,
        action: 'hideComment',
        executionTime: 150
      };
      
      mockActionExecutor.executeAction.mockResolvedValue(mockExecutorResult);
      
      await worker.processJob({ payload: validJobPayload, id: 'job-126' });
      
      expect(mockCostControl.recordUsage).toHaveBeenCalledWith(
        'org-123',
        'twitter',
        'shield_action',
        expect.objectContaining({
          action: 'hideComment',
          success: true,
          executionTime: 150,
          platform: 'twitter'
        }),
        null,
        1
      );
    });
    
    test('should update worker metrics on successful processing', async () => {
      const mockExecutorResult = {
        success: true,
        action: 'hideComment',
        fallback: 'blockUser',
        executionTime: 150
      };
      
      mockActionExecutor.executeAction.mockResolvedValue(mockExecutorResult);
      
      await worker.processJob({ payload: validJobPayload, id: 'job-127' });
      
      expect(worker.workerMetrics.totalProcessed).toBe(1);
      expect(worker.workerMetrics.successfulActions).toBe(1);
      expect(worker.workerMetrics.fallbackActions).toBe(1);
      expect(worker.workerMetrics.averageProcessingTime).toBeGreaterThan(0);
      expect(worker.workerMetrics.lastActionTime).toBeDefined();
    });
    
    test('should handle executor errors and update metrics', async () => {
      const mockError = new Error('Action execution failed');
      mockActionExecutor.executeAction.mockRejectedValue(mockError);
      
      await expect(worker.processJob({ payload: validJobPayload, id: 'job-128' }))
        .rejects.toThrow('Action execution failed');
      
      expect(worker.workerMetrics.totalProcessed).toBe(1);
      expect(worker.workerMetrics.failedActions).toBe(1);
      expect(worker.workerMetrics.successfulActions).toBe(0);
    });
    
    test('should handle cost control recording errors gracefully', async () => {
      const mockExecutorResult = {
        success: true,
        action: 'hideComment',
        executionTime: 150
      };
      
      mockActionExecutor.executeAction.mockResolvedValue(mockExecutorResult);
      mockCostControl.recordUsage.mockRejectedValue(new Error('Cost control error'));
      
      // Should complete successfully despite cost control error
      const result = await worker.processJob({ payload: validJobPayload, id: 'job-129' });
      expect(result.success).toBe(true);
    });
  });
  
  describe('Worker Metrics', () => {
    test('should update metrics correctly for various scenarios', () => {
      // Successful action without fallback
      worker.updateWorkerMetrics(true, false, 100);
      expect(worker.workerMetrics.totalProcessed).toBe(1);
      expect(worker.workerMetrics.successfulActions).toBe(1);
      expect(worker.workerMetrics.fallbackActions).toBe(0);
      
      // Failed action
      worker.updateWorkerMetrics(false, false, 150);
      expect(worker.workerMetrics.totalProcessed).toBe(2);
      expect(worker.workerMetrics.failedActions).toBe(1);
      
      // Successful action with fallback
      worker.updateWorkerMetrics(true, true, 200);
      expect(worker.workerMetrics.totalProcessed).toBe(3);
      expect(worker.workerMetrics.successfulActions).toBe(2);
      expect(worker.workerMetrics.fallbackActions).toBe(1);
    });
    
    test('should calculate average processing time correctly', () => {
      worker.updateWorkerMetrics(true, false, 100);
      expect(worker.workerMetrics.averageProcessingTime).toBe(100);
      
      worker.updateWorkerMetrics(true, false, 200);
      expect(worker.workerMetrics.averageProcessingTime).toBe(150);
      
      worker.updateWorkerMetrics(true, false, 300);
      expect(worker.workerMetrics.averageProcessingTime).toBe(200);
    });
    
    test('should provide comprehensive worker metrics', () => {
      worker.updateWorkerMetrics(true, false, 100);
      worker.updateWorkerMetrics(false, true, 150);
      
      const metrics = worker.getWorkerMetrics();
      
      expect(metrics.totalProcessed).toBe(2);
      expect(metrics.successfulActions).toBe(1);
      expect(metrics.failedActions).toBe(1);
      expect(metrics.fallbackActions).toBe(1);
      expect(metrics.actionExecutorMetrics).toBeDefined();
      expect(metrics.circuitBreakerStatus).toBeDefined();
    });
  });
  
  describe('Integration with Action Executor', () => {
    test('should pass job metadata to action executor', async () => {
      const mockExecutorResult = {
        success: true,
        action: 'hideComment'
      };
      
      mockActionExecutor.executeAction.mockResolvedValue(mockExecutorResult);
      
      await worker.processJob({ 
        payload: validJobPayload, 
        id: 'job-metadata-test' 
      });
      
      expect(mockActionExecutor.executeAction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            jobId: 'job-metadata-test',
            workerId: worker.workerId,
            queueName: 'shield_action'
          })
        })
      );
    });
    
    test('should handle default values for optional parameters', async () => {
      const minimalPayload = {
        organizationId: 'org-123',
        platform: 'twitter',
        externalCommentId: 'tweet-789',
        externalAuthorId: 'author-111',
        action: 'hideComment'
      };
      
      const mockExecutorResult = {
        success: true,
        action: 'hideComment'
      };
      
      mockActionExecutor.executeAction.mockResolvedValue(mockExecutorResult);
      
      await worker.processJob({ payload: minimalPayload, id: 'job-minimal' });
      
      expect(mockActionExecutor.executeAction).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
          reason: 'Shield automated action',
          originalText: null
        })
      );
    });
  });
});