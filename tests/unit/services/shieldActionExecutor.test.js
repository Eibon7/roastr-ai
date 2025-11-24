/**
 * Unit Tests for Shield Action Executor Service
 *
 * Tests the unified action execution system with retry logic,
 * circuit breaker, fallback strategies, and audit logging.
 */

const ShieldActionExecutorService = require('../../../src/services/shieldActionExecutor');
const { ModerationInput, ModerationResult } = require('../../../src/adapters/ShieldAdapter');

// Mock adapters
const mockTwitterAdapter = {
  getPlatform: () => 'twitter',
  isReady: () => true,
  initialize: jest.fn().mockResolvedValue(),
  hideComment: jest.fn(),
  reportUser: jest.fn(),
  blockUser: jest.fn(),
  unblockUser: jest.fn(),
  capabilities: () => ({
    hideComment: true,
    reportUser: false,
    blockUser: true,
    unblockUser: true,
    platform: 'twitter',
    fallbacks: {
      reportUser: 'blockUser'
    }
  })
};

const mockYouTubeAdapter = {
  getPlatform: () => 'youtube',
  isReady: () => true,
  initialize: jest.fn().mockResolvedValue(),
  hideComment: jest.fn(),
  reportUser: jest.fn(),
  blockUser: jest.fn(),
  unblockUser: jest.fn(),
  capabilities: () => ({
    hideComment: true,
    reportUser: false,
    blockUser: false,
    unblockUser: false,
    platform: 'youtube',
    fallbacks: {
      blockUser: 'hideComment'
    }
  })
};

// Mock persistence service
const mockPersistenceService = {
  recordShieldEvent: jest.fn().mockResolvedValue({ id: 'event-123' })
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
};

describe('ShieldActionExecutorService', () => {
  let executor;

  beforeEach(() => {
    jest.clearAllMocks();

    executor = new ShieldActionExecutorService({
      logger: mockLogger,
      persistenceService: mockPersistenceService,
      maxRetries: 2,
      baseDelay: 10, // Fast for tests
      maxDelay: 100,
      failureThreshold: 3,
      recoveryTimeout: 1000,
      adapters: {
        twitter: { skipValidation: true },
        youtube: { skipValidation: true }
      }
    });

    // Replace adapters with mocks
    executor.adapters.set('twitter', mockTwitterAdapter);
    executor.adapters.set('youtube', mockYouTubeAdapter);
  });

  describe('Constructor and Initialization', () => {
    test('should initialize with correct configuration', () => {
      expect(executor.retryConfig.maxRetries).toBe(2);
      expect(executor.circuitBreakerConfig.failureThreshold).toBe(3);
      expect(executor.adapters.has('twitter')).toBe(true);
      expect(executor.adapters.has('youtube')).toBe(true);
    });

    test('should initialize circuit breakers for all platforms', () => {
      expect(executor.circuitBreakers.has('twitter')).toBe(true);
      expect(executor.circuitBreakers.has('youtube')).toBe(true);

      const twitterBreaker = executor.circuitBreakers.get('twitter');
      expect(twitterBreaker.state).toBe('closed');
      expect(twitterBreaker.failureCount).toBe(0);
    });

    test('should initialize metrics tracking', () => {
      expect(executor.metrics.totalActions).toBe(0);
      expect(executor.metrics.byPlatform.twitter).toBeDefined();
      expect(executor.metrics.byAction).toEqual({});
    });
  });

  describe('Action Execution', () => {
    const validActionInput = {
      organizationId: 'org-123',
      platform: 'twitter',
      externalCommentId: 'tweet-456',
      externalAuthorId: 'user-789',
      externalAuthorUsername: 'toxicuser',
      action: 'hideComment',
      reason: 'Toxic content detected'
    };

    test('should execute supported action successfully', async () => {
      const mockResult = new ModerationResult({
        success: true,
        action: 'hideComment',
        details: { tweetId: 'tweet-456' },
        executionTime: 150
      });

      mockTwitterAdapter.hideComment.mockResolvedValue(mockResult);

      const result = await executor.executeAction(validActionInput);

      expect(result.success).toBe(true);
      expect(result.action).toBe('hideComment');
      expect(mockTwitterAdapter.hideComment).toHaveBeenCalledWith(expect.any(ModerationInput));
      expect(mockPersistenceService.recordShieldEvent).toHaveBeenCalled();
      expect(executor.metrics.successfulActions).toBe(1);
    });

    test('should handle unsupported action with fallback', async () => {
      const reportUserInput = {
        ...validActionInput,
        action: 'reportUser'
      };

      const mockBlockResult = new ModerationResult({
        success: true,
        action: 'blockUser',
        details: { userId: 'user-789' },
        executionTime: 200
      });

      mockTwitterAdapter.blockUser.mockResolvedValue(mockBlockResult);

      const result = await executor.executeAction(reportUserInput);

      expect(result.success).toBe(true);
      expect(result.fallback).toBe('blockUser');
      expect(result.originalAction).toBe('reportUser');
      expect(mockTwitterAdapter.blockUser).toHaveBeenCalled();
      expect(executor.metrics.fallbackActions).toBe(1);
    });

    test('should handle unsupported action without fallback', async () => {
      const blockUserInput = {
        ...validActionInput,
        platform: 'youtube',
        action: 'blockUser' // blockUser has no fallback and has YouTube Studio instructions
      };

      const result = await executor.executeAction(blockUserInput);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.requiresManualReview).toBe(true);
      expect(result.fallback).toBe('manual_review');
      expect(result.details.manualInstructions).toContain('YouTube Studio');
    });

    test('should validate required input fields', async () => {
      const invalidInput = {
        organizationId: 'org-123'
        // Missing required fields
      };

      await expect(executor.executeAction(invalidInput)).rejects.toThrow('platform is required');
    });

    test('should handle unknown platform', async () => {
      const unknownPlatformInput = {
        ...validActionInput,
        platform: 'unknown'
      };

      await expect(executor.executeAction(unknownPlatformInput)).rejects.toThrow(
        'No adapter available for platform: unknown'
      );
    });
  });

  describe('Retry Logic', () => {
    test('should retry failed actions with exponential backoff', async () => {
      // Use fake timers to make retry tests faster and deterministic
      jest.useFakeTimers();

      const mockError = new Error('API temporarily unavailable');
      mockTwitterAdapter.hideComment
        .mockRejectedValueOnce(mockError)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(
          new ModerationResult({
            success: true,
            action: 'hideComment'
          })
        );

      const validActionInput = {
        organizationId: 'org-123',
        platform: 'twitter',
        externalCommentId: 'tweet-456',
        externalAuthorId: 'user-789',
        action: 'hideComment',
        reason: 'Test retry'
      };

      // Execute action with fake timers to skip actual delays
      const actionPromise = executor.executeAction(validActionInput);

      // Fast-forward through all retry delays
      await jest.runAllTimersAsync();

      const result = await actionPromise;

      expect(result.success).toBe(true);
      expect(mockTwitterAdapter.hideComment).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });

    test('should fail after max retries exceeded', async () => {
      const mockError = new Error('Persistent API failure');
      mockTwitterAdapter.hideComment.mockRejectedValue(mockError);

      const validActionInput = {
        organizationId: 'org-123',
        platform: 'twitter',
        externalCommentId: 'tweet-456',
        externalAuthorId: 'user-789',
        action: 'hideComment',
        reason: 'Test max retries'
      };

      await expect(executor.executeAction(validActionInput)).rejects.toThrow(
        'Persistent API failure'
      );

      expect(mockTwitterAdapter.hideComment).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(executor.metrics.failedActions).toBe(1);
    });
  });

  describe('Circuit Breaker', () => {
    test('should open circuit breaker after failure threshold', async () => {
      const mockError = new Error('Service unavailable');
      mockTwitterAdapter.hideComment.mockRejectedValue(mockError);

      const validActionInput = {
        organizationId: 'org-123',
        platform: 'twitter',
        externalCommentId: 'tweet-456',
        externalAuthorId: 'user-789',
        action: 'hideComment',
        reason: 'Circuit breaker test'
      };

      // Execute enough failed attempts to open circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await executor.executeAction(validActionInput);
        } catch (error) {
          // Expected to fail
        }
      }

      const circuitBreaker = executor.circuitBreakers.get('twitter');
      expect(circuitBreaker.state).toBe('open');
      expect(executor.metrics.circuitBreakerTrips).toBe(1);
    });

    test('should reject actions when circuit breaker is open', async () => {
      // Open circuit breaker by causing enough failures
      const mockError = new Error('Service unavailable');
      mockTwitterAdapter.hideComment.mockRejectedValue(mockError);

      const validActionInput = {
        organizationId: 'org-123',
        platform: 'twitter',
        externalCommentId: 'tweet-456',
        externalAuthorId: 'user-789',
        action: 'hideComment',
        reason: 'Circuit breaker open test'
      };

      // Execute enough failed attempts to open circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await executor.executeAction(validActionInput);
        } catch (error) {
          // Expected to fail
        }
      }

      // Next attempt should be rejected due to open circuit breaker
      await expect(executor.executeAction(validActionInput)).rejects.toThrow(
        'Circuit breaker is open for platform: twitter'
      );
    });

    test('should reset circuit breaker on successful action after failures', async () => {
      // First cause some failures to increase failure count
      const mockError = new Error('Temporary failure');
      mockTwitterAdapter.hideComment
        .mockRejectedValueOnce(mockError)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValue(
          new ModerationResult({
            success: true,
            action: 'hideComment'
          })
        );

      const validActionInput = {
        organizationId: 'org-123',
        platform: 'twitter',
        externalCommentId: 'tweet-456',
        externalAuthorId: 'user-789',
        action: 'hideComment',
        reason: 'Circuit breaker reset test'
      };

      // Cause some failures first (but not enough to open circuit)
      try {
        await executor.executeAction(validActionInput);
      } catch (error) {
        // First failure expected
      }

      try {
        await executor.executeAction(validActionInput);
      } catch (error) {
        // Second failure expected
      }

      // Third attempt should succeed and reset circuit breaker
      const result = await executor.executeAction(validActionInput);

      expect(result.success).toBe(true);
      const circuitBreaker = executor.circuitBreakers.get('twitter');
      expect(circuitBreaker.state).toBe('closed');
    });
  });

  describe('Metrics and Monitoring', () => {
    test('should track metrics correctly', async () => {
      const mockResult = new ModerationResult({
        success: true,
        action: 'hideComment'
      });
      mockTwitterAdapter.hideComment.mockResolvedValue(mockResult);

      const validActionInput = {
        organizationId: 'org-123',
        platform: 'twitter',
        externalCommentId: 'tweet-456',
        externalAuthorId: 'user-789',
        action: 'hideComment',
        reason: 'Metrics test'
      };

      await executor.executeAction(validActionInput);

      const metrics = executor.getMetrics();
      expect(metrics.totalActions).toBe(1);
      expect(metrics.successfulActions).toBe(1);
      expect(metrics.byPlatform.twitter.successful).toBe(1);
      expect(metrics.byAction.hideComment.successful).toBe(1);
    });

    test('should provide circuit breaker status', () => {
      const status = executor.getCircuitBreakerStatus();
      expect(status.twitter).toBeDefined();
      expect(status.twitter.state).toBe('closed');
      expect(status.twitter.failureCount).toBe(0);
    });

    test('should provide adapter capabilities', () => {
      const capabilities = executor.getAdapterCapabilities();
      expect(capabilities.twitter.hideComment).toBe(true);
      expect(capabilities.twitter.reportUser).toBe(false);
      expect(capabilities.youtube.hideComment).toBe(true);
      expect(capabilities.youtube.blockUser).toBe(false);
    });

    test('should assert fallback mapping in capabilities', () => {
      const capabilities = executor.getAdapterCapabilities();

      // Verify that twitter has fallback mapping for unsupported actions
      expect(capabilities.twitter.fallbacks).toBeDefined();
      expect(capabilities.twitter.fallbacks.reportUser).toBe('blockUser');

      // Verify that youtube has proper fallback mappings
      expect(capabilities.youtube.fallbacks).toBeDefined();
      expect(capabilities.youtube.fallbacks.blockUser).toBe('hideComment');

      // Ensure all fallback actions are actually supported by the platform
      Object.entries(capabilities.twitter.fallbacks).forEach(([originalAction, fallbackAction]) => {
        expect(capabilities.twitter[fallbackAction]).toBe(true);
      });

      Object.entries(capabilities.youtube.fallbacks).forEach(([originalAction, fallbackAction]) => {
        expect(capabilities.youtube[fallbackAction]).toBe(true);
      });
    });
  });

  describe('Fallback Strategies', () => {
    test('should use explicit fallback from capabilities', async () => {
      const mockBlockResult = new ModerationResult({
        success: true,
        action: 'blockUser'
      });
      mockTwitterAdapter.blockUser.mockResolvedValue(mockBlockResult);

      const reportUserInput = {
        organizationId: 'org-123',
        platform: 'twitter',
        externalCommentId: 'tweet-456',
        externalAuthorId: 'user-789',
        action: 'reportUser',
        reason: 'Explicit fallback test'
      };

      const result = await executor.executeAction(reportUserInput);

      expect(result.fallback).toBe('blockUser');
      expect(mockTwitterAdapter.blockUser).toHaveBeenCalled();
    });

    test('should handle multiple fallback levels', async () => {
      // Mock YouTube adapter where reportUser -> hideComment fallback should work
      const mockHideResult = new ModerationResult({
        success: true,
        action: 'hide_comment'
      });
      mockYouTubeAdapter.hideComment.mockResolvedValue(mockHideResult);

      const reportUserInput = {
        organizationId: 'org-123',
        platform: 'youtube',
        externalCommentId: 'comment-456',
        externalAuthorId: 'user-789',
        action: 'reportUser',
        reason: 'Multi-level fallback test'
      };

      const result = await executor.executeAction(reportUserInput);

      // Should fall back to hideComment since YouTube supports it
      expect(result.fallback).toBe('hideComment');
      expect(result.originalAction).toBe('reportUser');
      expect(mockYouTubeAdapter.hideComment).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should record failed actions in persistence layer', async () => {
      mockTwitterAdapter.hideComment.mockRejectedValue(new Error('API Error'));

      const validActionInput = {
        organizationId: 'org-123',
        platform: 'twitter',
        externalCommentId: 'tweet-456',
        externalAuthorId: 'user-789',
        action: 'hideComment',
        reason: 'Error handling test'
      };

      await expect(executor.executeAction(validActionInput)).rejects.toThrow();

      expect(mockPersistenceService.recordShieldEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actionStatus: 'failed'
        })
      );
    });

    test('should handle persistence service errors gracefully', async () => {
      mockPersistenceService.recordShieldEvent.mockRejectedValue(new Error('Database error'));

      mockTwitterAdapter.hideComment.mockResolvedValue(
        new ModerationResult({
          success: true,
          action: 'hideComment'
        })
      );

      const validActionInput = {
        organizationId: 'org-123',
        platform: 'twitter',
        externalCommentId: 'tweet-456',
        externalAuthorId: 'user-789',
        action: 'hideComment',
        reason: 'Persistence error test'
      };

      // Should not throw despite persistence error
      const result = await executor.executeAction(validActionInput);
      expect(result.success).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to record Shield action',
        expect.any(Object)
      );
    });
  });
});
