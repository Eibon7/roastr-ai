/**
 * Integration Tests for Shield Adapter System
 *
 * These tests verify that the Shield adapters work correctly with the
 * existing Shield service and can be integrated into the worker system.
 */

const {
  ShieldAdapter,
  ModerationInput,
  ModerationResult
} = require('../../src/adapters/ShieldAdapter');
const TwitterShieldAdapter = require('../../src/adapters/mock/TwitterShieldAdapter');
const YouTubeShieldAdapter = require('../../src/adapters/mock/YouTubeShieldAdapter');
const DiscordShieldAdapter = require('../../src/adapters/mock/DiscordShieldAdapter');
const TwitchShieldAdapter = require('../../src/adapters/mock/TwitchShieldAdapter');

describe('Shield Adapter Integration Tests', () => {
  let adapterRegistry;
  const mockConfig = {
    skipValidation: true,
    mockLatency: { min: 1, max: 10 },
    failureRate: 0 // No failures for integration tests
  };

  beforeAll(async () => {
    // Create a registry of all adapters
    adapterRegistry = new Map();

    const adapters = [
      { platform: 'twitter', class: TwitterShieldAdapter },
      { platform: 'youtube', class: YouTubeShieldAdapter },
      { platform: 'discord', class: DiscordShieldAdapter },
      { platform: 'twitch', class: TwitchShieldAdapter }
    ];

    // Initialize all adapters
    for (const { platform, class: AdapterClass } of adapters) {
      const adapter = new AdapterClass(mockConfig);
      await adapter.initialize();
      adapterRegistry.set(platform, adapter);
    }
  });

  describe('Multi-Platform Shield Actions', () => {
    test('can execute same action across all platforms', async () => {
      const mockComment = {
        platform: 'multi',
        commentId: 'toxic_comment_123',
        userId: 'toxic_user_456',
        username: 'toxicuser',
        reason: 'Shield: High toxicity detected (score: 0.9)',
        orgId: 'org_789'
      };

      const results = new Map();

      // Execute hideComment across all platforms
      for (const [platform, adapter] of adapterRegistry) {
        const input = new ModerationInput({
          ...mockComment,
          platform: platform
        });

        const result = await adapter.hideComment(input);
        results.set(platform, result);
      }

      // Verify all platforms returned valid results
      expect(results.size).toBe(4);

      for (const [platform, result] of results) {
        expect(result).toBeInstanceOf(ModerationResult);
        expect(result.action).toBe('hide_comment');
        expect(result.details.platform).toBe(platform);

        // Log the result for debugging
        console.log(
          `${platform}: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.requiresManualReview ? 'MANUAL REVIEW' : 'AUTOMATED'}`
        );
      }
    });

    test('handles platform-specific limitations gracefully', async () => {
      const mockInput = new ModerationInput({
        platform: 'test',
        commentId: 'test_comment',
        userId: 'test_user',
        username: 'testuser',
        reason: 'test',
        orgId: 'test_org'
      });

      // Test platform limitations
      const platformTests = [
        { platform: 'youtube', action: 'blockUser', shouldSucceed: false },
        { platform: 'twitch', action: 'hideComment', shouldSucceed: false },
        { platform: 'twitter', action: 'reportUser', shouldSucceed: false },
        { platform: 'discord', action: 'reportUser', shouldSucceed: false }
      ];

      for (const { platform, action, shouldSucceed } of platformTests) {
        const adapter = adapterRegistry.get(platform);
        const input = new ModerationInput({ ...mockInput, platform });

        const result = await adapter[action](input);

        if (!shouldSucceed) {
          expect(result.requiresManualReview || !result.success).toBe(true);
        }
      }
    });
  });

  describe('Shield Action Workflow Simulation', () => {
    test('simulates complete Shield workflow', async () => {
      // Simulate a high-toxicity comment detected across platforms
      const toxicComment = {
        id: 'comment_toxic_999',
        content: 'This is a highly toxic comment',
        toxicityScore: 0.95,
        platforms: ['twitter', 'discord'],
        user: {
          id: 'repeat_offender_123',
          username: 'toxicuser',
          previousViolations: 3
        },
        organization: 'org_shield_test'
      };

      const workflowResults = [];

      // Step 1: Hide the comment on all platforms
      for (const platform of toxicComment.platforms) {
        const adapter = adapterRegistry.get(platform);
        const hideInput = new ModerationInput({
          platform: platform,
          commentId: toxicComment.id,
          userId: toxicComment.user.id,
          username: toxicComment.user.username,
          reason: `Shield: High toxicity (${toxicComment.toxicityScore})`,
          orgId: toxicComment.organization
        });

        const hideResult = await adapter.hideComment(hideInput);
        workflowResults.push({
          step: 'hide_comment',
          platform,
          result: hideResult
        });
      }

      // Step 2: Based on repeat offender status, escalate to blocking
      if (toxicComment.user.previousViolations >= 3) {
        for (const platform of toxicComment.platforms) {
          const adapter = adapterRegistry.get(platform);
          const blockInput = new ModerationInput({
            platform: platform,
            commentId: toxicComment.id,
            userId: toxicComment.user.id,
            username: toxicComment.user.username,
            reason: `Shield: Repeat offender (${toxicComment.user.previousViolations} violations)`,
            orgId: toxicComment.organization
          });

          const blockResult = await adapter.blockUser(blockInput);
          workflowResults.push({
            step: 'block_user',
            platform,
            result: blockResult
          });
        }
      }

      // Verify workflow executed correctly
      expect(workflowResults.length).toBe(4); // 2 platforms × 2 actions

      const hideActions = workflowResults.filter((r) => r.step === 'hide_comment');
      const blockActions = workflowResults.filter((r) => r.step === 'block_user');

      expect(hideActions.length).toBe(2);
      expect(blockActions.length).toBe(2);

      // Verify all actions completed (either successfully or queued for manual review)
      for (const { step, platform, result } of workflowResults) {
        expect(result).toBeInstanceOf(ModerationResult);
        expect(typeof result.success).toBe('boolean');
        console.log(`${step} on ${platform}: ${result.success ? 'SUCCESS' : 'QUEUED'}`);
      }
    });
  });

  describe('Adapter Factory Pattern', () => {
    test('can create adapter factory for dynamic platform handling', async () => {
      class ShieldAdapterFactory {
        constructor() {
          this.adapters = new Map();
          this.adapterClasses = new Map([
            ['twitter', TwitterShieldAdapter],
            ['youtube', YouTubeShieldAdapter],
            ['discord', DiscordShieldAdapter],
            ['twitch', TwitchShieldAdapter]
          ]);
        }

        async getAdapter(platform) {
          if (!this.adapters.has(platform)) {
            const AdapterClass = this.adapterClasses.get(platform);
            if (!AdapterClass) {
              throw new Error(`Unsupported platform: ${platform}`);
            }

            const adapter = new AdapterClass(mockConfig);
            await adapter.initialize();
            this.adapters.set(platform, adapter);
          }

          return this.adapters.get(platform);
        }

        async executeAction(platform, action, input) {
          const adapter = await this.getAdapter(platform);

          switch (action) {
            case 'hide':
              return await adapter.hideComment(input);
            case 'report':
              return await adapter.reportUser(input);
            case 'block':
              return await adapter.blockUser(input);
            case 'unblock':
              return await adapter.unblockUser(input);
            default:
              throw new Error(`Unknown action: ${action}`);
          }
        }

        getSupportedPlatforms() {
          return Array.from(this.adapterClasses.keys());
        }

        async getPlatformCapabilities(platform) {
          const adapter = await this.getAdapter(platform);
          return adapter.capabilities();
        }
      }

      const factory = new ShieldAdapterFactory();

      // Test factory functionality
      expect(factory.getSupportedPlatforms()).toEqual(['twitter', 'youtube', 'discord', 'twitch']);

      // Test dynamic adapter creation
      const twitterAdapter = await factory.getAdapter('twitter');
      expect(twitterAdapter).toBeInstanceOf(TwitterShieldAdapter);

      // Test action execution through factory
      const mockInput = new ModerationInput({
        platform: 'twitter',
        commentId: 'test_comment',
        userId: 'test_user',
        username: 'testuser',
        reason: 'test',
        orgId: 'test_org'
      });

      const result = await factory.executeAction('twitter', 'hide', mockInput);
      expect(result).toBeInstanceOf(ModerationResult);
      expect(result.action).toBe('hide_comment');

      // Test capabilities query
      const capabilities = await factory.getPlatformCapabilities('twitter');
      expect(capabilities.platform).toBe('twitter');
      expect(capabilities.hideComment).toBe(true);
    });
  });

  describe('Performance and Reliability', () => {
    test('handles concurrent actions across platforms', async () => {
      const concurrentTasks = [];
      const platforms = ['twitter', 'youtube', 'discord', 'twitch'];

      // Create 20 concurrent tasks (5 per platform)
      for (let i = 0; i < 20; i++) {
        const platform = platforms[i % platforms.length];
        const adapter = adapterRegistry.get(platform);

        const input = new ModerationInput({
          platform: platform,
          commentId: `concurrent_comment_${i}`,
          userId: `user_${i}`,
          username: `user${i}`,
          reason: `Concurrent test ${i}`,
          orgId: 'concurrent_test_org'
        });

        const task = adapter.hideComment(input).then((result) => ({
          taskId: i,
          platform,
          success: result.success,
          executionTime: result.executionTime
        }));

        concurrentTasks.push(task);
      }

      // Execute all tasks concurrently
      const startTime = Date.now();
      const results = await Promise.all(concurrentTasks);
      const totalTime = Date.now() - startTime;

      // Verify all tasks completed
      expect(results.length).toBe(20);

      // Calculate performance metrics
      const avgExecutionTime =
        results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;
      const successRate = results.filter((r) => r.success).length / results.length;

      console.log(`Concurrent execution stats:`);
      console.log(`  Total time: ${totalTime}ms`);
      console.log(`  Avg execution time: ${avgExecutionTime.toFixed(2)}ms`);
      console.log(`  Success rate: ${(successRate * 100).toFixed(1)}%`);

      // Verify reasonable performance
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
      expect(avgExecutionTime).toBeLessThan(100); // Average under 100ms per action
    });

    test('provides consistent error handling', async () => {
      // Test with high failure rate
      const unreliableAdapter = new TwitterShieldAdapter({
        ...mockConfig,
        failureRate: 0.8 // 80% failure rate
      });
      await unreliableAdapter.initialize();

      const input = new ModerationInput({
        platform: 'twitter',
        commentId: 'test_comment',
        userId: 'test_user',
        username: 'testuser',
        reason: 'error test',
        orgId: 'test_org'
      });

      const results = [];

      // Run multiple attempts to test error handling
      for (let i = 0; i < 10; i++) {
        const result = await unreliableAdapter.hideComment(input);
        results.push(result);
      }

      // Verify all results are valid ModerationResult objects
      results.forEach((result) => {
        expect(result).toBeInstanceOf(ModerationResult);
        expect(typeof result.success).toBe('boolean');
        expect(result.action).toBe('hide_comment');
        expect(result.details.platform).toBe('twitter');

        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      });

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      console.log(`Error handling test: ${successCount} successes, ${failureCount} failures`);

      // With 80% failure rate, we should see some failures
      expect(failureCount).toBeGreaterThan(0);
    });
  });
});
