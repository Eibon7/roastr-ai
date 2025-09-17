/**
 * Contract Tests for Shield Adapters
 * 
 * These tests verify that all Shield adapters conform to the unified interface
 * defined by the ShieldAdapter base class. They test the contract without
 * requiring actual API connections.
 */

const { ShieldAdapter, ModerationInput, ModerationResult, CapabilityMap } = require('../../../src/adapters/ShieldAdapter');
const TwitterShieldAdapter = require('../../../src/adapters/mock/TwitterShieldAdapter');
const YouTubeShieldAdapter = require('../../../src/adapters/mock/YouTubeShieldAdapter');
const DiscordShieldAdapter = require('../../../src/adapters/mock/DiscordShieldAdapter');
const TwitchShieldAdapter = require('../../../src/adapters/mock/TwitchShieldAdapter');

// Test configuration to skip validation
const mockConfig = {
  skipValidation: true,
  mockLatency: { min: 1, max: 5 } // Fast tests
};

describe('Shield Adapter Contract Tests', () => {
  // All adapters to test
  const adapters = [
    { name: 'Twitter', class: TwitterShieldAdapter, platform: 'twitter' },
    { name: 'YouTube', class: YouTubeShieldAdapter, platform: 'youtube' },
    { name: 'Discord', class: DiscordShieldAdapter, platform: 'discord' },
    { name: 'Twitch', class: TwitchShieldAdapter, platform: 'twitch' }
  ];

  describe('Base Class Contract', () => {
    test('ShieldAdapter cannot be instantiated directly', () => {
      expect(() => new ShieldAdapter()).toThrow(/abstract/i);
    });

    test('ModerationInput creates valid instances', () => {
      const input = new ModerationInput({
        platform: 'test',
        commentId: 'comment_123',
        userId: 'user_456',
        username: 'testuser',
        reason: 'toxicity',
        orgId: 'org_789'
      });

      expect(input.platform).toBe('test');
      expect(input.commentId).toBe('comment_123');
      expect(input.userId).toBe('user_456');
      expect(input.username).toBe('testuser');
      expect(input.reason).toBe('toxicity');
      expect(input.orgId).toBe('org_789');
    });

    test('ModerationResult creates valid instances', () => {
      const result = new ModerationResult({
        success: true,
        action: 'hide_comment',
        details: { test: 'data' },
        executionTime: 100
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('hide_comment');
      expect(result.details.test).toBe('data');
      expect(result.executionTime).toBe(100);
      expect(result.timestamp).toBeDefined();
    });

    test('CapabilityMap creates valid instances', () => {
      const capabilities = new CapabilityMap({
        hideComment: true,
        reportUser: false,
        blockUser: true,
        unblockUser: true,
        platform: 'test'
      });

      expect(capabilities.hideComment).toBe(true);
      expect(capabilities.reportUser).toBe(false);
      expect(capabilities.blockUser).toBe(true);
      expect(capabilities.unblockUser).toBe(true);
      expect(capabilities.platform).toBe('test');
    });
  });

  // Test each adapter implementation
  adapters.forEach(({ name, class: AdapterClass, platform }) => {
    describe(`${name} Adapter Contract`, () => {
      let adapter;
      let mockInput;

      beforeEach(async () => {
        adapter = new AdapterClass(mockConfig);
        await adapter.initialize();

        mockInput = new ModerationInput({
          platform: platform,
          commentId: 'test_comment_123',
          userId: 'test_user_456',
          username: 'testuser',
          reason: 'Shield: Toxic behavior detected',
          orgId: 'test_org_789',
          metadata: { channelId: 'test_channel', guildId: 'test_guild' }
        });
      });

      test('extends ShieldAdapter correctly', () => {
        expect(adapter).toBeInstanceOf(ShieldAdapter);
        expect(adapter).toBeInstanceOf(AdapterClass);
      });

      test('has correct platform name', () => {
        expect(adapter.getPlatform()).toBe(platform);
        expect(adapter.platform).toBe(platform);
      });

      test('initializes correctly', () => {
        expect(adapter.isInitialized).toBe(true);
        expect(adapter.isReady()).toBe(true);
        expect(adapter.client).toBeDefined();
      });

      test('implements required methods', () => {
        expect(typeof adapter.hideComment).toBe('function');
        expect(typeof adapter.reportUser).toBe('function');
        expect(typeof adapter.blockUser).toBe('function');
        expect(typeof adapter.unblockUser).toBe('function');
        expect(typeof adapter.capabilities).toBe('function');
        expect(typeof adapter.initialize).toBe('function');
      });

      test('hideComment returns valid ModerationResult', async () => {
        const result = await adapter.hideComment(mockInput);
        
        expect(result).toBeInstanceOf(ModerationResult);
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.action).toBe('string');
        expect(result.action).toBe('hide_comment');
        expect(typeof result.executionTime).toBe('number');
        expect(result.timestamp).toBeDefined();
        expect(result.details).toBeDefined();
        expect(result.details.platform).toBe(platform);
      });

      test('reportUser returns valid ModerationResult', async () => {
        const result = await adapter.reportUser(mockInput);
        
        expect(result).toBeInstanceOf(ModerationResult);
        expect(typeof result.success).toBe('boolean');
        expect(result.action).toBe('report_user');
        expect(typeof result.executionTime).toBe('number');
        expect(result.details.platform).toBe(platform);
      });

      test('blockUser returns valid ModerationResult', async () => {
        const result = await adapter.blockUser(mockInput);
        
        expect(result).toBeInstanceOf(ModerationResult);
        expect(typeof result.success).toBe('boolean');
        expect(result.action).toMatch(/block_user|ban_user/);
        expect(typeof result.executionTime).toBe('number');
        expect(result.details.platform).toBe(platform);
      });

      test('unblockUser returns valid ModerationResult', async () => {
        const result = await adapter.unblockUser(mockInput);
        
        expect(result).toBeInstanceOf(ModerationResult);
        expect(typeof result.success).toBe('boolean');
        expect(result.action).toMatch(/unblock_user|unban_user/);
        expect(typeof result.executionTime).toBe('number');
        expect(result.details.platform).toBe(platform);
      });

      test('capabilities returns valid CapabilityMap', () => {
        const capabilities = adapter.capabilities();
        
        expect(capabilities).toBeInstanceOf(CapabilityMap);
        expect(typeof capabilities.hideComment).toBe('boolean');
        expect(typeof capabilities.reportUser).toBe('boolean');
        expect(typeof capabilities.blockUser).toBe('boolean');
        expect(typeof capabilities.unblockUser).toBe('boolean');
        expect(capabilities.platform).toBe(platform);
        expect(capabilities.rateLimits).toBeDefined();
        expect(Array.isArray(capabilities.scopes)).toBe(true);
        expect(capabilities.fallbacks).toBeDefined();
      });

      test('validates input correctly', async () => {
        const invalidInput = new ModerationInput({ platform: platform });
        
        await expect(adapter.hideComment(invalidInput)).rejects.toThrow();
        await expect(adapter.reportUser(invalidInput)).rejects.toThrow();
        await expect(adapter.blockUser(invalidInput)).rejects.toThrow();
        await expect(adapter.unblockUser(invalidInput)).rejects.toThrow();
      });

      test('handles non-ModerationInput objects', async () => {
        const invalidInput = { platform: platform, commentId: 'test' };
        
        await expect(adapter.hideComment(invalidInput)).rejects.toThrow('Input must be an instance of ModerationInput');
      });

      test('isRateLimitError method exists and works', () => {
        expect(typeof adapter.isRateLimitError).toBe('function');
        
        const rateLimitError = new Error('rate limit exceeded');
        rateLimitError.status = 429;
        expect(adapter.isRateLimitError(rateLimitError)).toBe(true);

        const normalError = new Error('normal error');
        expect(adapter.isRateLimitError(normalError)).toBe(false);
      });

      test('logging method exists and works', () => {
        expect(typeof adapter.log).toBe('function');
        
        // Should not throw
        expect(() => adapter.log('info', 'test message', { test: 'data' })).not.toThrow();
      });

      test('createErrorResult creates valid results', () => {
        const error = new Error('Test error');
        const result = adapter.createErrorResult('test_action', error, 100);
        
        expect(result).toBeInstanceOf(ModerationResult);
        expect(result.success).toBe(false);
        expect(result.action).toBe('test_action');
        expect(result.error).toBe('Test error');
        expect(result.executionTime).toBe(100);
        expect(result.details.platform).toBe(platform);
      });

      test('createSuccessResult creates valid results', () => {
        const result = adapter.createSuccessResult('test_action', { data: 'test' }, 100, true);
        
        expect(result).toBeInstanceOf(ModerationResult);
        expect(result.success).toBe(true);
        expect(result.action).toBe('test_action');
        expect(result.executionTime).toBe(100);
        expect(result.requiresManualReview).toBe(true);
        expect(result.details.platform).toBe(platform);
        expect(result.details.data).toBe('test');
      });
    });
  });

  describe('Cross-Platform Consistency', () => {
    let adapters_instances;

    beforeAll(async () => {
      adapters_instances = [];
      for (const { class: AdapterClass } of adapters) {
        const adapter = new AdapterClass(mockConfig);
        await adapter.initialize();
        adapters_instances.push(adapter);
      }
    });

    test('all adapters have consistent method signatures', () => {
      const requiredMethods = [
        { name: 'hideComment', minParams: 1 },
        { name: 'reportUser', minParams: 1 },
        { name: 'blockUser', minParams: 1 },
        { name: 'unblockUser', minParams: 1 },
        { name: 'capabilities', minParams: 0 }
      ];
      
      adapters_instances.forEach(adapter => {
        requiredMethods.forEach(({ name, minParams }) => {
          expect(typeof adapter[name]).toBe('function');
          expect(adapter[name].length).toBeGreaterThanOrEqual(minParams);
        });
      });
    });

    test('all adapters return consistent result structure', async () => {
      const mockInput = new ModerationInput({
        platform: 'test',
        commentId: 'test_comment',
        userId: 'test_user',
        username: 'testuser',
        reason: 'test',
        orgId: 'test_org'
      });

      const actions = ['hideComment', 'reportUser', 'blockUser', 'unblockUser'];
      
      for (const adapter of adapters_instances) {
        for (const action of actions) {
          const result = await adapter[action](mockInput);
          
          // All results should have consistent structure
          expect(result).toHaveProperty('success');
          expect(result).toHaveProperty('action');
          expect(result).toHaveProperty('details');
          expect(result).toHaveProperty('executionTime');
          expect(result).toHaveProperty('timestamp');
          expect(result.details).toHaveProperty('platform');
        }
      }
    });

    test('all adapters have consistent capability structure', () => {
      adapters_instances.forEach(adapter => {
        const capabilities = adapter.capabilities();
        
        // All capability maps should have these core properties
        expect(capabilities).toHaveProperty('hideComment');
        expect(capabilities).toHaveProperty('reportUser');
        expect(capabilities).toHaveProperty('blockUser');
        expect(capabilities).toHaveProperty('unblockUser');
        expect(capabilities).toHaveProperty('platform');
        expect(capabilities).toHaveProperty('rateLimits');
        expect(capabilities).toHaveProperty('scopes');
        expect(capabilities).toHaveProperty('fallbacks');
      });
    });

    test('platform-specific capabilities are documented correctly', () => {
      const expectedCapabilities = {
        twitter: { hideComment: true, reportUser: false, blockUser: true, unblockUser: true },
        youtube: { hideComment: true, reportUser: false, blockUser: false, unblockUser: false },
        discord: { hideComment: true, reportUser: false, blockUser: true, unblockUser: true },
        twitch: { hideComment: false, reportUser: false, blockUser: true, unblockUser: true }
      };

      adapters_instances.forEach(adapter => {
        const capabilities = adapter.capabilities();
        const platform = adapter.getPlatform();
        const expected = expectedCapabilities[platform];
        
        if (expected) {
          expect(capabilities.hideComment).toBe(expected.hideComment);
          expect(capabilities.reportUser).toBe(expected.reportUser);
          expect(capabilities.blockUser).toBe(expected.blockUser);
          expect(capabilities.unblockUser).toBe(expected.unblockUser);
        }
      });
    });
  });

  describe('Error Handling Contract', () => {
    let adapter;

    beforeEach(async () => {
      // Use Twitter adapter for error handling tests
      adapter = new TwitterShieldAdapter(mockConfig);
      await adapter.initialize();
    });

    test('handles validation errors consistently', async () => {
      const invalidInput = new ModerationInput({ platform: 'twitter' });
      
      try {
        await adapter.hideComment(invalidInput);
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).toContain('Required field');
      }
    });

    test('handleRateLimit method exists and works', async () => {
      expect(typeof adapter.handleRateLimit).toBe('function');
      
      let callCount = 0;
      const mockApiCall = () => {
        callCount++;
        if (callCount < 3) {
          const error = new Error('rate limit exceeded');
          error.status = 429;
          throw error;
        }
        return 'success';
      };

      // Mock the isRateLimitError method to return true for our test error
      const originalIsRateLimitError = adapter.isRateLimitError;
      adapter.isRateLimitError = (error) => error.status === 429;

      const result = await adapter.handleRateLimit(mockApiCall, 3);
      expect(result).toBe('success');
      expect(callCount).toBe(3);

      // Restore original method
      adapter.isRateLimitError = originalIsRateLimitError;
    });
  });

  describe('Mock Behavior Consistency', () => {
    test('all adapters simulate latency', async () => {
      const adapters_with_timing = [];
      
      for (const { class: AdapterClass } of adapters) {
        const adapter = new AdapterClass({
          ...mockConfig,
          mockLatency: { min: 50, max: 100 }
        });
        await adapter.initialize();
        adapters_with_timing.push(adapter);
      }

      const mockInput = new ModerationInput({
        platform: 'test',
        commentId: 'test_comment',
        userId: 'test_user',
        username: 'testuser',
        reason: 'test',
        orgId: 'test_org'
      });

      for (const adapter of adapters_with_timing) {
        const start = Date.now();
        await adapter.hideComment(mockInput);
        const duration = Date.now() - start;
        
        // Should take at least the minimum latency
        expect(duration).toBeGreaterThanOrEqual(40); // Some tolerance for test timing
      }
    });

    test('all adapters have failure simulation', () => {
      adapters.forEach(({ class: AdapterClass }) => {
        const adapter = new AdapterClass(mockConfig);
        expect(typeof adapter.shouldSimulateFailure).toBe('function');
      });
    });
  });
});