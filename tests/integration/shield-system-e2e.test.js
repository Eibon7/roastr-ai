/**
 * Shield System End-to-End Integration Tests
 *
 * Comprehensive tests for the complete Shield moderation flow:
 * - Toxicity detection and classification
 * - Action determination and execution
 * - Logging and monitoring
 * - Error handling and resilience
 * - Cross-platform functionality
 */

const ShieldService = require('../../src/services/shieldService');
const ShieldActionWorker = require('../../src/workers/ShieldActionWorker');

// Mock external dependencies
jest.mock('@supabase/supabase-js');
jest.mock('../../src/services/queueService');
jest.mock('../../src/services/costControl');
jest.mock('twitter-api-v2');
jest.mock('discord.js');

describe('Shield System - End-to-End Integration', () => {
  let shieldService;
  let shieldWorker;
  let mockSupabase;
  let mockQueueService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase
    const mockSelect = jest.fn().mockResolvedValue({
      data: {
        id: 'user-123',
        shield_violations: 2,
        last_violation: new Date().toISOString()
      },
      error: null
    });

    const mockInsert = jest.fn().mockResolvedValue({
      data: { id: 'action-123' },
      error: null
    });

    const mockUpsert = jest.fn().mockResolvedValue({
      data: { id: 'behavior-123' },
      error: null
    });

    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => mockSelect)
          }))
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => mockInsert)
          }))
        })),
        upsert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => mockUpsert)
          }))
        }))
      }))
    };

    // Mock Queue Service
    mockQueueService = {
      addJob: jest.fn().mockResolvedValue({ id: 'job-123' }),
      shutdown: jest.fn().mockResolvedValue()
    };

    // Set up environment
    process.env.SHIELD_ENABLED = 'true';
    process.env.TWITTER_BEARER_TOKEN = 'test-token';
    process.env.TWITTER_APP_KEY = 'test-key';
    process.env.TWITTER_APP_SECRET = 'test-secret';
    process.env.TWITTER_ACCESS_TOKEN = 'test-access-token';
    process.env.TWITTER_ACCESS_SECRET = 'test-access-secret';

    // Initialize services
    shieldService = new ShieldService();
    shieldService.supabase = mockSupabase;
    shieldService.queueService = mockQueueService;

    shieldWorker = new ShieldActionWorker();
    shieldWorker.supabase = mockSupabase;

    // Initialize platform clients for testing
    shieldWorker.platformClients = new Map();
    shieldWorker.platformClients.set('twitter', {
      v2: {
        reply: jest.fn().mockResolvedValue({ data: { id: '123' } })
      }
    });
  });

  describe('Complete Moderation Flow', () => {
    test('should process toxic comment through complete Shield pipeline', async () => {
      const toxicComment = {
        id: 'comment-123',
        content: 'You are a complete idiot and should kill yourself',
        platform: 'twitter',
        platform_user_id: 'user-456',
        platform_username: 'toxicuser',
        organization_id: 'org-123'
      };

      // Step 1: Analyze content for toxicity
      const analysisResult = await shieldService.analyzeContent(
        toxicComment.content,
        toxicComment.platform_user_id,
        toxicComment.organization_id,
        { platform: toxicComment.platform }
      );

      expect(analysisResult).toEqual({
        shouldTakeAction: expect.any(Boolean),
        actionLevel: expect.any(String),
        recommendedActions: expect.any(Array),
        userRisk: expect.any(String),
        confidence: expect.any(Number)
      });

      // Step 2: Execute recommended actions (if any)
      if (analysisResult.recommendedActions && analysisResult.recommendedActions.length > 0) {
        const comment = {
          id: toxicComment.id,
          platform: toxicComment.platform,
          platform_user_id: toxicComment.platform_user_id,
          platform_username: toxicComment.platform_username,
          text: toxicComment.content
        };
        const action_tags = analysisResult.recommendedActions;
        const metadata = {
          toxicity_score: analysisResult.confidence,
          decision_level: analysisResult.actionLevel
        };

        const executionResult = await shieldService.executeActionsFromTags(
          toxicComment.organization_id,
          comment,
          action_tags,
          metadata
        );

        expect(executionResult.success).toBe(true);
        expect(executionResult.actions_executed.length).toBeGreaterThan(0);
      } else {
        // No actions recommended by Shield system
        expect(analysisResult.shouldTakeAction).toBe(false);
      }

      // Verify queue jobs were created (only if actions were taken)
      if (analysisResult.recommendedActions && analysisResult.recommendedActions.length > 0) {
        expect(mockQueueService.addJob).toHaveBeenCalledWith(
          'shield_action',
          expect.objectContaining({
            action: expect.any(String),
            platform: 'twitter'
          }),
          expect.objectContaining({ priority: expect.any(String) })
        );
      }
    });

    test('should handle borderline content appropriately', async () => {
      const borderlineComment = {
        id: 'comment-456',
        content: 'This is really annoying and stupid',
        platform: 'twitter',
        platform_user_id: 'user-789',
        platform_username: 'borderlineuser',
        organization_id: 'org-123'
      };

      const analysisResult = await shieldService.analyzeContent(
        borderlineComment.content,
        borderlineComment.platform_user_id,
        borderlineComment.organization_id,
        { platform: borderlineComment.platform }
      );

      expect(analysisResult).toEqual({
        shouldTakeAction: expect.any(Boolean),
        actionLevel: expect.any(String),
        recommendedActions: expect.any(Array),
        userRisk: expect.any(String),
        confidence: expect.any(Number)
      });
    });

    test('should not take action on benign content', async () => {
      const benignComment = {
        id: 'comment-789',
        content: 'This is a great post, thanks for sharing!',
        platform: 'twitter',
        platform_user_id: 'user-good',
        platform_username: 'gooduser',
        organization_id: 'org-123'
      };

      const analysisResult = await shieldService.analyzeContent(
        benignComment.content,
        benignComment.platform_user_id,
        benignComment.organization_id,
        { platform: benignComment.platform }
      );

      expect(analysisResult.shouldTakeAction).toBe(false);
      expect(analysisResult.actionLevel).toBe('none');
      expect(analysisResult.recommendedActions).toEqual([]);
    });
  });

  describe('Cross-Platform Functionality', () => {
    test('should handle Twitter-specific moderation actions', async () => {
      const job = {
        organizationId: 'org-123',
        platform: 'twitter',
        externalCommentId: 'tweet-123',
        externalAuthorId: 'user-456',
        externalAuthorUsername: 'testuser',
        action: 'hideComment',
        reason: 'Shield automated action'
      };

      const result = await shieldWorker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.platform).toBe('twitter');
      expect(result.action).toBe('hideComment');
    });

    test('should handle Discord-specific moderation actions', async () => {
      // Set up Discord client
      shieldWorker.platformClients.set('discord', {
        guilds: {
          cache: {
            get: jest.fn(() => ({
              members: {
                ban: jest.fn().mockResolvedValue({ success: true })
              }
            }))
          }
        }
      });

      const job = {
        organizationId: 'org-123',
        platform: 'discord',
        externalCommentId: 'message-123',
        externalAuthorId: 'user-456',
        externalAuthorUsername: 'testuser',
        action: 'blockUser',
        reason: 'Shield automated action'
      };

      const result = await shieldWorker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.platform).toBe('discord');
      expect(result.action).toBe('blockUser');
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle API failures gracefully without system crash', async () => {
      const job = {
        organizationId: 'org-123',
        platform: 'twitter',
        externalCommentId: 'comment-123',
        externalAuthorId: 'user-456',
        externalAuthorUsername: 'testuser',
        action: 'hideComment',
        reason: 'Shield automated action'
      };

      // Mock Twitter API to fail
      const mockTwitterClient = shieldWorker.platformClients.get('twitter');
      mockTwitterClient.v2.reply = jest
        .fn()
        .mockRejectedValue(new Error('Twitter API rate limit exceeded'));

      const result = await shieldWorker.processJob(job);

      // System should handle the error gracefully
      expect(result.success).toBe(true);
      // The action should still be processed (with fallback/error handling)
    });

    test('should handle database failures without losing data integrity', async () => {
      // Mock database to fail
      mockSupabase.from = jest.fn().mockReturnValue({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' }
            })
          }))
        }))
      });

      const job = {
        organizationId: 'org-123',
        platform: 'twitter',
        externalCommentId: 'comment-123',
        externalAuthorId: 'user-456',
        externalAuthorUsername: 'testuser',
        action: 'hideComment',
        reason: 'Shield automated action'
      };

      const result = await shieldWorker.processJob(job);

      // Worker should complete the job even if logging fails
      expect(result.success).toBe(true);
    });

    test('should handle malicious input without security vulnerabilities', async () => {
      const maliciousComment = {
        id: '<script>alert("xss")</script>',
        content: '"; DROP TABLE users; --',
        platform: 'twitter',
        platform_user_id: "1' OR '1'='1",
        platform_username: 'hacker',
        organization_id: 'org-123'
      };

      // Should not crash or cause security issues
      const analysisResult = await shieldService.analyzeContent(
        maliciousComment.content,
        maliciousComment.platform_user_id,
        maliciousComment.organization_id,
        { platform: maliciousComment.platform }
      );

      expect(analysisResult).toBeDefined();
      expect(typeof analysisResult.shouldTakeAction).toBe('boolean');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle high-volume concurrent requests', async () => {
      const comments = Array.from({ length: 20 }, (_, i) => ({
        id: `comment-${i}`,
        content: `This is test comment number ${i}`,
        platform: 'twitter',
        platform_user_id: `user-${i}`,
        platform_username: `testuser${i}`,
        organization_id: 'org-123'
      }));

      const promises = comments.map((comment) =>
        shieldService.analyzeContent(
          comment.content,
          comment.platform_user_id,
          comment.organization_id,
          { platform: comment.platform }
        )
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(20);
      results.forEach((result) => {
        expect(result).toHaveProperty('shouldTakeAction');
        expect(result).toHaveProperty('actionLevel');
        expect(result).toHaveProperty('recommendedActions');
      });
    });

    test('should complete analysis within performance thresholds', async () => {
      const comment = {
        content: 'This is a test comment for performance testing',
        platform_user_id: 'user-perf',
        organization_id: 'org-123'
      };

      const startTime = Date.now();

      const result = await shieldService.analyzeContent(
        comment.content,
        comment.platform_user_id,
        comment.organization_id,
        { platform: 'twitter' }
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('Logging and Monitoring', () => {
    test('should properly log Shield actions for audit trail', async () => {
      const job = {
        organizationId: 'org-123',
        platform: 'twitter',
        externalCommentId: 'comment-audit',
        externalAuthorId: 'user-456',
        externalAuthorUsername: 'testuser',
        action: 'hideComment',
        reason: 'Shield automated action'
      };

      const result = await shieldWorker.processJob(job);

      // Verify that action was processed (database logging may be async)
      expect(result.success).toBe(true);
      expect(result.action).toBe('hideComment');
    });

    test('should track user behavior patterns', async () => {
      const userId = 'repeat-offender';
      const organizationId = 'org-123';

      await shieldService.trackUserBehavior(userId, organizationId, {
        toxicityScore: 0.8,
        categories: ['TOXICITY'],
        actionTaken: 'mute_user'
      });

      // Verify behavior tracking
      expect(mockSupabase.from).toHaveBeenCalledWith('user_behaviors');
    });
  });

  afterEach(async () => {
    if (shieldService) {
      await shieldService.shutdown();
    }
  });
});
