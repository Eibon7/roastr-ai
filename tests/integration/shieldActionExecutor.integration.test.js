/**
 * Integration Tests for Shield Action Executor (Issue 361)
 *
 * Tests the complete Shield action execution workflow including:
 * - Unified adapter interface
 * - Circuit breaker behavior
 * - Retry with exponential backoff
 * - Fallback strategies
 * - Audit logging
 * - GDPR compliance
 */

const ShieldActionExecutorService = require('../../src/services/shieldActionExecutor');
const ShieldActionWorker = require('../../src/workers/ShieldActionWorker');

// Mock Supabase for persistence
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: { id: 'event-123' }, error: null })
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
};

// Mock cost control
const mockCostControl = {
  recordUsage: jest.fn().mockResolvedValue()
};

describe('Shield Action Executor Integration (Issue 361)', () => {
  let executor;
  let worker;

  beforeEach(() => {
    jest.clearAllMocks();

    // Initialize services with fast retry settings for testing
    executor = new ShieldActionExecutorService({
      logger: mockLogger,
      maxRetries: 2,
      baseDelay: 10,
      maxDelay: 50,
      failureThreshold: 2,
      recoveryTimeout: 100,
      adapters: {
        twitter: { skipValidation: true, failureRate: 0 },
        youtube: { skipValidation: true, failureRate: 0 },
        discord: { skipValidation: true, failureRate: 0 },
        twitch: { skipValidation: true, failureRate: 0 }
      }
    });

    // Override persistence service to use mock
    executor.persistenceService = {
      recordShieldEvent: jest.fn().mockResolvedValue({ id: 'event-integration-123' })
    };
  });

  describe('Complete Action Execution Workflow', () => {
    test('should execute hideComment action end-to-end', async () => {
      const actionInput = {
        organizationId: 'org-integration-test',
        userId: 'user-456',
        platform: 'twitter',
        accountRef: '@testorg',
        externalCommentId: 'tweet-toxic-123',
        externalAuthorId: 'toxic-user-789',
        externalAuthorUsername: 'toxicuser',
        action: 'hideComment',
        reason: 'Toxic content violates community guidelines',
        originalText: 'This is a toxic comment that should be hidden',
        metadata: {
          severity: 'high',
          confidence: 0.95,
          categories: ['TOXICITY', 'INSULT']
        }
      };

      const result = await executor.executeAction(actionInput);

      // Verify successful execution
      expect(result.success).toBe(true);
      expect(result.action).toBe('hideComment');
      expect(result.details.platform).toBe('twitter');

      // Verify audit logging
      expect(executor.persistenceService.recordShieldEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-integration-test',
          platform: 'twitter',
          externalCommentId: 'tweet-toxic-123',
          externalAuthorId: 'toxic-user-789',
          actionTaken: 'hideComment',
          actionStatus: 'executed',
          processedBy: 'shield_action_executor'
        })
      );

      // Verify metrics updated
      const metrics = executor.getMetrics();
      expect(metrics.totalActions).toBe(1);
      expect(metrics.successfulActions).toBe(1);
      expect(metrics.byPlatform.twitter.successful).toBe(1);
      expect(metrics.byAction.hideComment.successful).toBe(1);
    });

    test('should handle unsupported action with fallback strategy', async () => {
      const actionInput = {
        organizationId: 'org-integration-test',
        platform: 'twitter',
        externalCommentId: 'tweet-report-456',
        externalAuthorId: 'reportable-user-123',
        externalAuthorUsername: 'reportuser',
        action: 'reportUser',
        reason: 'User posting spam content'
      };

      const result = await executor.executeAction(actionInput);

      // Twitter doesn't support reportUser, should fallback to blockUser
      expect(result.success).toBe(true);
      expect(result.fallback).toBe('blockUser');
      expect(result.originalAction).toBe('reportUser');

      // Verify fallback metrics
      const metrics = executor.getMetrics();
      expect(metrics.fallbackActions).toBe(1);
      expect(metrics.byAction.reportUser.fallbacks).toBe(1);
    });

    test('should require manual review for unsupported platforms', async () => {
      const actionInput = {
        organizationId: 'org-integration-test',
        platform: 'youtube',
        externalCommentId: 'comment-report-789',
        externalAuthorId: 'youtube-user-456',
        externalAuthorUsername: 'reportuser',
        action: 'reportUser',
        reason: 'Inappropriate content'
      };

      const result = await executor.executeAction(actionInput);

      // YouTube doesn't support reportUser and has no fallback
      expect(result.success).toBe(true);
      expect(result.requiresManualReview).toBe(true);
      expect(result.fallback).toBe('manual_review');
      expect(result.details.manualInstructions).toContain('YouTube Studio');
    });
  });

  describe('Circuit Breaker Integration', () => {
    test('should open circuit breaker after consecutive failures', async () => {
      // Configure adapter to fail
      const twitterAdapter = executor.adapters.get('twitter');
      twitterAdapter.failureRate = 1.0; // 100% failure rate

      const actionInput = {
        organizationId: 'org-circuit-test',
        platform: 'twitter',
        externalCommentId: 'tweet-fail-123',
        externalAuthorId: 'fail-user-789',
        action: 'hideComment',
        reason: 'Circuit breaker test'
      };

      // Execute enough failed actions to open circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await executor.executeAction(actionInput);
        } catch (error) {
          // Expected to fail
        }
      }

      // Check circuit breaker status
      const circuitBreakerStatus = executor.getCircuitBreakerStatus();
      expect(circuitBreakerStatus.twitter.state).toBe('open');

      // Next action should be rejected immediately
      await expect(executor.executeAction(actionInput)).rejects.toThrow(
        'Circuit breaker is open for platform: twitter'
      );
    });

    test('should recover from circuit breaker after timeout', async () => {
      // Force circuit breaker to open state
      const circuitBreaker = executor.circuitBreakers.get('twitter');
      circuitBreaker.state = 'open';
      circuitBreaker.nextAttemptTime = Date.now() - 1000; // Already expired

      // Reset adapter to work normally
      const twitterAdapter = executor.adapters.get('twitter');
      twitterAdapter.failureRate = 0;

      const actionInput = {
        organizationId: 'org-recovery-test',
        platform: 'twitter',
        externalCommentId: 'tweet-recovery-123',
        externalAuthorId: 'recovery-user-789',
        action: 'hideComment',
        reason: 'Circuit breaker recovery test'
      };

      const result = await executor.executeAction(actionInput);

      expect(result.success).toBe(true);
      expect(circuitBreaker.state).toBe('closed');
      expect(circuitBreaker.failureCount).toBe(0);
    });
  });

  describe('Retry Logic Integration', () => {
    test('should retry failed actions with exponential backoff', async () => {
      const twitterAdapter = executor.adapters.get('twitter');

      // Mock adapter to fail twice then succeed
      let attemptCount = 0;
      const originalHideComment = twitterAdapter.hideComment;
      twitterAdapter.hideComment = jest.fn().mockImplementation((input) => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error(`Attempt ${attemptCount} failed`);
        }
        return originalHideComment.call(twitterAdapter, input);
      });

      const actionInput = {
        organizationId: 'org-retry-test',
        platform: 'twitter',
        externalCommentId: 'tweet-retry-123',
        externalAuthorId: 'retry-user-789',
        action: 'hideComment',
        reason: 'Retry logic test'
      };

      const startTime = Date.now();
      const result = await executor.executeAction(actionInput);
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(twitterAdapter.hideComment).toHaveBeenCalledTimes(3);
      expect(executionTime).toBeGreaterThan(20); // Should include retry delays
    });
  });

  describe('Worker Integration', () => {
    test('should process Shield action jobs through worker', async () => {
      // Mock worker dependencies
      const mockWorker = new ShieldActionWorker();

      // Override action executor with our test instance
      mockWorker.actionExecutor = executor;
      mockWorker.costControl = mockCostControl;

      const jobPayload = {
        organizationId: 'org-worker-test',
        userId: 'user-worker-123',
        platform: 'discord',
        accountRef: 'TestServer#general',
        externalCommentId: 'message-toxic-456',
        externalAuthorId: 'discord-user-789',
        externalAuthorUsername: 'toxicdiscorduser',
        action: 'hideComment',
        reason: 'Toxic message in chat',
        originalText: 'Discord toxic message content',
        metadata: {
          channel: 'general',
          serverId: 'server-123'
        }
      };

      const result = await mockWorker.processJob({
        id: 'job-worker-integration-test',
        payload: jobPayload
      });

      expect(result.success).toBe(true);
      expect(result.platform).toBe('discord');
      expect(result.action).toBe('hideComment');

      // Verify cost control was called
      expect(mockCostControl.recordUsage).toHaveBeenCalledWith(
        'org-worker-test',
        'discord',
        'shield_action',
        expect.objectContaining({
          action: 'hideComment',
          success: true,
          platform: 'discord'
        }),
        null,
        1
      );

      // Verify worker metrics updated
      expect(mockWorker.workerMetrics.totalProcessed).toBe(1);
      expect(mockWorker.workerMetrics.successfulActions).toBe(1);
    });
  });

  describe('GDPR Compliance Integration', () => {
    test('should store original text for content-based actions per GDPR requirements', async () => {
      const actionInput = {
        organizationId: 'org-gdpr-test',
        platform: 'twitter',
        externalCommentId: 'tweet-gdpr-123',
        externalAuthorId: 'gdpr-user-789',
        action: 'hideComment',
        reason: 'GDPR compliance test',
        originalText: 'Personal information that needs GDPR protection'
      };

      await executor.executeAction(actionInput);

      // Verify original text is stored for content-based actions with proper GDPR metadata
      expect(executor.persistenceService.recordShieldEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          originalText: 'Personal information that needs GDPR protection',
          actionTaken: 'hideComment',
          actionDetails: expect.objectContaining({
            contentBased: true,
            gdprCompliant: true
          }),
          metadata: expect.objectContaining({
            gdprCompliance: expect.objectContaining({
              piiStored: true,
              reason: 'content_moderation'
            })
          })
        })
      );
    });

    test('should not store original text for non-content actions', async () => {
      const actionInput = {
        organizationId: 'org-gdpr-test',
        platform: 'twitter',
        externalCommentId: 'tweet-gdpr-456',
        externalAuthorId: 'gdpr-user-456',
        action: 'blockUser',
        reason: 'GDPR compliance test for blocking',
        originalText: 'This text should not be stored for blocking action'
      };

      await executor.executeAction(actionInput);

      // For blockUser action (non-content based), original text should be null for GDPR compliance
      expect(executor.persistenceService.recordShieldEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          originalText: null, // Should be null for non-content actions
          actionTaken: 'blockUser',
          actionDetails: expect.objectContaining({
            contentBased: false,
            gdprCompliant: true
          })
        })
      );
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle persistence service failures gracefully', async () => {
      executor.persistenceService.recordShieldEvent.mockRejectedValue(
        new Error('Database connection failed')
      );

      const actionInput = {
        organizationId: 'org-error-test',
        platform: 'twitter',
        externalCommentId: 'tweet-error-123',
        externalAuthorId: 'error-user-789',
        action: 'hideComment',
        reason: 'Error handling test'
      };

      // Should complete successfully despite persistence error
      const result = await executor.executeAction(actionInput);
      expect(result.success).toBe(true);

      // Should log the persistence error
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to record Shield action',
        expect.objectContaining({
          organizationId: 'org-error-test',
          error: 'Database connection failed'
        })
      );
    });

    test('should maintain metrics accuracy during failures', async () => {
      const twitterAdapter = executor.adapters.get('twitter');
      twitterAdapter.failureRate = 1.0; // Force all actions to fail

      const actionInput = {
        organizationId: 'org-metrics-test',
        platform: 'twitter',
        externalCommentId: 'tweet-metrics-123',
        externalAuthorId: 'metrics-user-789',
        action: 'hideComment',
        reason: 'Metrics accuracy test'
      };

      try {
        await executor.executeAction(actionInput);
      } catch (error) {
        // Expected to fail
      }

      const metrics = executor.getMetrics();
      expect(metrics.totalActions).toBe(1);
      expect(metrics.failedActions).toBe(1);
      expect(metrics.byPlatform.twitter.failed).toBe(1);
    });
  });

  describe('Performance and Monitoring', () => {
    test('should provide comprehensive monitoring data', () => {
      const metrics = executor.getMetrics();
      const circuitBreakerStatus = executor.getCircuitBreakerStatus();
      const capabilities = executor.getAdapterCapabilities();

      expect(metrics).toHaveProperty('totalActions');
      expect(metrics).toHaveProperty('byPlatform');
      expect(metrics).toHaveProperty('byAction');
      expect(metrics).toHaveProperty('timestamp');

      expect(circuitBreakerStatus).toHaveProperty('twitter');
      expect(circuitBreakerStatus).toHaveProperty('youtube');
      expect(circuitBreakerStatus).toHaveProperty('discord');
      expect(circuitBreakerStatus).toHaveProperty('twitch');

      expect(capabilities.twitter).toHaveProperty('hideComment');
      expect(capabilities.twitter).toHaveProperty('reportUser');
      expect(capabilities.twitter).toHaveProperty('blockUser');
      expect(capabilities.twitter).toHaveProperty('unblockUser');
    });

    test('should track execution times accurately', async () => {
      const actionInput = {
        organizationId: 'org-timing-test',
        platform: 'twitter',
        externalCommentId: 'tweet-timing-123',
        externalAuthorId: 'timing-user-789',
        action: 'hideComment',
        reason: 'Execution time test'
      };

      const startTime = Date.now();
      const result = await executor.executeAction(actionInput);
      const actualExecutionTime = Date.now() - startTime;

      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.executionTime).toBeLessThan(actualExecutionTime + 50); // Allow some variance
    });
  });
});
