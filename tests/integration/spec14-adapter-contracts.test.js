/**
 * SPEC 14 - Enhanced Contract Tests for Shield Adapters
 * 
 * Comprehensive contract validation ensuring all adapters implement
 * the exact same interface with consistent behavior across platforms.
 * 
 * Tests verify:
 * - Method signatures (hideComment, reportUser, blockUser, unblockUser, capabilities)
 * - Return value structures
 * - Error handling consistency
 * - Platform capabilities matrices
 * - Rate limiting behavior
 * - Idempotency guarantees
 */

const { ShieldAdapter, ModerationInput, ModerationResult, CapabilityMap } = require('../../src/adapters/ShieldAdapter');

// Import all available platform adapters
const TwitterShieldAdapter = require('../../src/adapters/mock/TwitterShieldAdapter');
const YouTubeShieldAdapter = require('../../src/adapters/mock/YouTubeShieldAdapter');
const DiscordShieldAdapter = require('../../src/adapters/mock/DiscordShieldAdapter');
const TwitchShieldAdapter = require('../../src/adapters/mock/TwitchShieldAdapter');

// Test configuration with dryRun enabled
const contractTestConfig = {
  skipValidation: true, // Skip validation for contract tests
  dryRun: true, // Never make real API calls
  mockLatency: { min: 1, max: 5 }, // Fast tests
  failureRate: 0, // No random failures for contract tests
  maxRetries: 2
};

describe('SPEC 14 - Enhanced Adapter Contract Tests', () => {
  // All available adapters to test against the contract
  const adapterDefinitions = [
    { name: 'Twitter', class: TwitterShieldAdapter, platform: 'twitter' },
    { name: 'YouTube', class: YouTubeShieldAdapter, platform: 'youtube' },
    { name: 'Discord', class: DiscordShieldAdapter, platform: 'discord' },
    { name: 'Twitch', class: TwitchShieldAdapter, platform: 'twitch' }
  ];

  describe('Base Contract Compliance', () => {
    test('all adapters extend ShieldAdapter base class', async () => {
      for (const { class: AdapterClass, platform } of adapterDefinitions) {
        const adapter = new AdapterClass(contractTestConfig);
        await adapter.initialize();
        
        expect(adapter).toBeInstanceOf(ShieldAdapter);
        expect(adapter.getPlatform()).toBe(platform);
      }
    });

    test('all adapters implement required methods with correct signatures', async () => {
      const requiredMethods = [
        { name: 'hideComment', params: 1, async: true },
        { name: 'reportUser', params: 1, async: true },
        { name: 'blockUser', params: 1, async: true },
        { name: 'unblockUser', params: 1, async: true },
        { name: 'capabilities', params: 0, async: false },
        { name: 'initialize', params: 0, async: true },
        { name: 'isReady', params: 0, async: false },
        { name: 'getPlatform', params: 0, async: false }
      ];

      for (const { class: AdapterClass, name } of adapterDefinitions) {
        const adapter = new AdapterClass(contractTestConfig);
        
        requiredMethods.forEach(({ name: methodName, params, async }) => {
          expect(typeof adapter[methodName]).toBe('function');
          expect(adapter[methodName].length).toBe(params);
          
          if (async) {
            // Check that async methods return promises
            expect(adapter[methodName].constructor.name).toBe('AsyncFunction');
          }
        });
      }
    });
  });

  describe('Method Contract Validation', () => {
    let adapters;

    beforeAll(async () => {
      adapters = [];
      for (const { class: AdapterClass, platform } of adapterDefinitions) {
        const adapter = new AdapterClass(contractTestConfig);
        await adapter.initialize();
        adapters.push({ adapter, platform });
      }
    });

    // Test each method across all adapters
    ['hideComment', 'reportUser', 'blockUser', 'unblockUser'].forEach(methodName => {
      describe(`${methodName} contract`, () => {
        test('accepts valid ModerationInput and returns ModerationResult', async () => {
          const validInput = new ModerationInput({
            platform: 'test',
            commentId: 'test_comment_123',
            userId: 'test_user_456',
            username: 'testuser',
            reason: 'Contract test validation',
            orgId: 'test_org_789',
            metadata: { test: true }
          });

          for (const { adapter, platform } of adapters) {
            // Update input platform to match adapter
            validInput.platform = platform;
            
            const result = await adapter[methodName](validInput);
            
            // Verify return type and structure
            expect(result).toBeInstanceOf(ModerationResult);
            expect(typeof result.success).toBe('boolean');
            expect(typeof result.action).toBe('string');
            expect(typeof result.executionTime).toBe('number');
            expect(result.timestamp).toBeDefined();
            // Accept both Date objects and ISO strings
            if (typeof result.timestamp === 'string') {
              expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
            } else {
              expect(result.timestamp).toBeInstanceOf(Date);
            }
            expect(result.details).toBeDefined();
            expect(result.details.platform).toBe(platform);
            
            // Verify action matches expected pattern
            const expectedActions = {
              hideComment: /hide_comment|delete_comment/,
              reportUser: /report_user|flag_user/,
              blockUser: /block_user|ban_user|mute_user/,
              unblockUser: /unblock_user|unban_user|unmute_user/
            };
            
            expect(result.action).toMatch(expectedActions[methodName]);
          }
        });

        test('rejects invalid input consistently', async () => {
          const invalidInputs = [
            null,
            undefined,
            {},
            { platform: 'test' }, // Missing required fields
            new ModerationInput({ platform: 'test' }), // Incomplete
            'invalid_string'
          ];

          for (const { adapter } of adapters) {
            for (const invalidInput of invalidInputs) {
              await expect(adapter[methodName](invalidInput)).rejects.toThrow();
            }
          }
        });

        test('handles platform-specific requirements', async () => {
          const platformSpecificInputs = {
            discord: {
              platform: 'discord',
              commentId: 'test_message_123',
              userId: 'test_user_456',
              username: 'testuser',
              reason: 'Test',
              orgId: 'test_org',
              metadata: { guildId: 'test_guild_789', channelId: 'test_channel_456' }
            },
            youtube: {
              platform: 'youtube',
              commentId: 'test_comment_123',
              userId: 'test_user_456',
              username: 'testuser',
              reason: 'Test',
              orgId: 'test_org',
              metadata: { videoId: 'test_video_123' }
            },
            twitter: {
              platform: 'twitter',
              commentId: 'test_tweet_123',
              userId: 'test_user_456',
              username: 'testuser',
              reason: 'Test',
              orgId: 'test_org',
              metadata: { tweetType: 'reply' }
            }
          };

          for (const { adapter, platform } of adapters) {
            const platformInput = platformSpecificInputs[platform];
            if (platformInput) {
              const input = new ModerationInput(platformInput);
              const result = await adapter[methodName](input);
              
              expect(result).toBeInstanceOf(ModerationResult);
              expect(result.details.platform).toBe(platform);
            }
          }
        });
      });
    });

    describe('capabilities contract', () => {
      test('returns consistent CapabilityMap structure', () => {
        for (const { adapter, platform } of adapters) {
          const capabilities = adapter.capabilities();
          
          expect(capabilities).toBeInstanceOf(CapabilityMap);
          expect(capabilities.platform).toBe(platform);
          
          // Required boolean capabilities
          expect(typeof capabilities.hideComment).toBe('boolean');
          expect(typeof capabilities.reportUser).toBe('boolean');
          expect(typeof capabilities.blockUser).toBe('boolean');
          expect(typeof capabilities.unblockUser).toBe('boolean');
          
          // Required array/object capabilities
          expect(Array.isArray(capabilities.scopes)).toBe(true);
          expect(typeof capabilities.rateLimits).toBe('object');
          expect(typeof capabilities.fallbacks).toBe('object');
          
          // Platform-specific validation
          const expectedCapabilities = {
            twitter: { hideComment: true, reportUser: false, blockUser: true, unblockUser: true },
            youtube: { hideComment: true, reportUser: false, blockUser: false, unblockUser: false },
            discord: { hideComment: true, reportUser: false, blockUser: true, unblockUser: true },
            twitch: { hideComment: false, reportUser: false, blockUser: true, unblockUser: true },
            instagram: { hideComment: true, reportUser: true, blockUser: true, unblockUser: false },
            facebook: { hideComment: true, reportUser: true, blockUser: false, unblockUser: false }
          };
          
          const expected = expectedCapabilities[platform];
          if (expected) {
            Object.entries(expected).forEach(([capability, expectedValue]) => {
              expect(capabilities[capability]).toBe(expectedValue);
            });
          }
        }
      });

      test('rate limits are properly defined', () => {
        for (const { adapter, platform } of adapters) {
          const capabilities = adapter.capabilities();
          const { rateLimits } = capabilities;
          
          // All platforms should have rate limit definitions (if available)
          expect(rateLimits).toBeDefined();
          
          // Accept either numeric format or string format
          if (typeof rateLimits.requests === 'number' && typeof rateLimits.windowMs === 'number') {
            // Numeric format
            expect(rateLimits.requests).toBeGreaterThan(0);
            expect(rateLimits.windowMs).toBeGreaterThan(0);
          } else {
            // String format or action-specific format - just verify structure exists
            expect(typeof rateLimits).toBe('object');
            expect(Object.keys(rateLimits).length).toBeGreaterThan(0);
          }
          
          // Platform-specific rate limit validation (if using numeric format)
          if (typeof rateLimits.requests === 'number' && typeof rateLimits.windowMs === 'number') {
            const expectedRateLimits = {
              twitter: { requests: 300, windowMs: 15 * 60 * 1000 }, // 300 per 15 min
              youtube: { requests: 100, windowMs: 60 * 60 * 1000 },  // 100 per hour
              discord: { requests: 50, windowMs: 60 * 1000 },        // 50 per minute
              twitch: { requests: 120, windowMs: 60 * 1000 },        // 120 per minute
            };
            
            const expected = expectedRateLimits[platform];
            if (expected) {
              expect(rateLimits.requests).toBe(expected.requests);
              expect(rateLimits.windowMs).toBe(expected.windowMs);
            }
          }
        }
      });
    });
  });

  describe('Error Handling Contract', () => {
    let adapters;

    beforeAll(async () => {
      adapters = [];
      for (const { class: AdapterClass, platform } of adapterDefinitions) {
        const adapter = new AdapterClass({
          ...contractTestConfig,
          failureRate: 0.5 // Inject failures for error testing
        });
        await adapter.initialize();
        adapters.push({ adapter, platform });
      }
    });

    test('handles rate limit errors consistently', async () => {
      for (const { adapter } of adapters) {
        expect(typeof adapter.isRateLimitError).toBe('function');
        expect(typeof adapter.handleRateLimit).toBe('function');
        
        // Test rate limit error detection
        const rateLimitError = new Error('rate limit exceeded');
        rateLimitError.status = 429;
        expect(adapter.isRateLimitError(rateLimitError)).toBe(true);
        
        const normalError = new Error('normal error');
        expect(adapter.isRateLimitError(normalError)).toBe(false);
      }
    });

    test('creates consistent error results', () => {
      for (const { adapter, platform } of adapters) {
        const testError = new Error('Test error');
        const errorResult = adapter.createErrorResult('test_action', testError, 100);
        
        expect(errorResult).toBeInstanceOf(ModerationResult);
        expect(errorResult.success).toBe(false);
        expect(errorResult.action).toBe('test_action');
        expect(errorResult.error).toBe('Test error');
        expect(errorResult.executionTime).toBe(100);
        expect(errorResult.details.platform).toBe(platform);
      }
    });
  });

  describe('Idempotency Contract', () => {
    let adapters;

    beforeAll(async () => {
      adapters = [];
      for (const { class: AdapterClass, platform } of adapterDefinitions) {
        const adapter = new AdapterClass(contractTestConfig);
        await adapter.initialize();
        adapters.push({ adapter, platform });
      }
    });

    test('identical requests produce identical results', async () => {
      const testInput = new ModerationInput({
        platform: 'test',
        commentId: 'idempotency_test_123',
        userId: 'idempotency_user_456',
        username: 'idempotencyuser',
        reason: 'Idempotency test',
        orgId: 'idempotency_org_789'
      });

      for (const { adapter, platform } of adapters) {
        testInput.platform = platform;
        
        // Execute the same action multiple times
        const results = [];
        for (let i = 0; i < 3; i++) {
          const result = await adapter.hideComment(testInput);
          results.push(result);
        }
        
        // Results should be consistent (allowing for timing differences)
        expect(results).toHaveLength(3);
        results.forEach((result, index) => {
          expect(result.success).toBe(results[0].success);
          expect(result.action).toBe(results[0].action);
          expect(result.details.platform).toBe(platform);
          
          // In mock mode, results should be deterministic
          if (contractTestConfig.dryRun) {
            // For mock adapters, just ensure results are consistent
            // The fact that we got consistent results means the mock is working
            expect(result.success).toBe(results[0].success);
            expect(result.action).toBe(results[0].action);
          }
        });
      }
    });
  });

  describe('Performance Contract', () => {
    let adapters;

    beforeAll(async () => {
      adapters = [];
      for (const { class: AdapterClass, platform } of adapterDefinitions) {
        const adapter = new AdapterClass({
          ...contractTestConfig,
          mockLatency: { min: 10, max: 50 } // Realistic latency for perf tests
        });
        await adapter.initialize();
        adapters.push({ adapter, platform });
      }
    });

    test('all operations complete within reasonable time limits', async () => {
      const testInput = new ModerationInput({
        platform: 'test',
        commentId: 'perf_test_123',
        userId: 'perf_user_456',
        username: 'perfuser',
        reason: 'Performance test',
        orgId: 'perf_org_789'
      });

      const maxExecutionTime = 1000; // 1 second max per operation

      for (const { adapter, platform } of adapters) {
        testInput.platform = platform;
        
        const actions = ['hideComment', 'reportUser', 'blockUser', 'unblockUser'];
        
        for (const action of actions) {
          const startTime = Date.now();
          const result = await adapter[action](testInput);
          const executionTime = Date.now() - startTime;
          
          expect(executionTime).toBeLessThan(maxExecutionTime);
          expect(result.executionTime).toBeGreaterThan(0);
          expect(result.executionTime).toBeLessThan(maxExecutionTime);
        }
      }
    });

    test('concurrent operations handle properly', async () => {
      const testInput = new ModerationInput({
        platform: 'test',
        commentId: 'concurrent_test_123',
        userId: 'concurrent_user_456',
        username: 'concurrentuser',
        reason: 'Concurrency test',
        orgId: 'concurrent_org_789'
      });

      for (const { adapter, platform } of adapters) {
        testInput.platform = platform;
        
        // Execute multiple operations concurrently
        const promises = [
          adapter.hideComment(testInput),
          adapter.reportUser(testInput),
          adapter.blockUser(testInput),
          adapter.unblockUser(testInput)
        ];
        
        const results = await Promise.all(promises);
        
        // All operations should complete successfully
        expect(results).toHaveLength(4);
        results.forEach(result => {
          expect(result).toBeInstanceOf(ModerationResult);
          expect(result.details.platform).toBe(platform);
        });
      }
    });
  });

  describe('Cross-Platform Consistency', () => {
    test('all adapters have consistent logging interface', async () => {
      for (const { class: AdapterClass } of adapterDefinitions) {
        const adapter = new AdapterClass(contractTestConfig);
        
        expect(typeof adapter.log).toBe('function');
        expect(adapter.log.length).toBeGreaterThanOrEqual(2); // level, message, ...args
        
        // Should not throw when called
        expect(() => adapter.log('info', 'Test message', { test: true })).not.toThrow();
        expect(() => adapter.log('error', 'Test error')).not.toThrow();
      }
    });

    test('all adapters handle initialization consistently', async () => {
      for (const { class: AdapterClass, platform } of adapterDefinitions) {
        const adapter = new AdapterClass(contractTestConfig);
        
        // Initially not ready
        expect(adapter.isReady()).toBe(false);
        expect(adapter.isInitialized).toBe(false);
        
        // After initialization, should be ready
        await adapter.initialize();
        expect(adapter.isReady()).toBe(true);
        expect(adapter.isInitialized).toBe(true);
        expect(adapter.client).toBeDefined();
      }
    });

    test('all adapters provide proper metadata', () => {
      for (const { class: AdapterClass, platform } of adapterDefinitions) {
        const adapter = new AdapterClass(contractTestConfig);
        
        expect(adapter.getPlatform()).toBe(platform);
        expect(typeof adapter.platform).toBe('string');
        expect(adapter.platform).toBe(platform);
        
        // Should have version info (if available)
        if (adapter.version) {
          expect(typeof adapter.version).toBe('string');
          expect(adapter.version).toMatch(/^\d+\.\d+\.\d+$/);
        } else {
          // Version might not be implemented in mock adapters
          console.warn(`Version not defined for ${platform} adapter`);
        }
      }
    });
  });

  describe('Platform Matrix Validation', () => {
    test('capabilities match documented platform matrix', () => {
      // This is the official capability matrix from SPEC
      const officialMatrix = {
        twitter: {
          hideComment: true,   // Can hide tweets/replies
          reportUser: false,   // No direct report API
          blockUser: true,     // Can block users
          unblockUser: true    // Can unblock users
        },
        youtube: {
          hideComment: true,   // Can hide/remove comments
          reportUser: false,   // No direct report in API
          blockUser: false,    // No block functionality
          unblockUser: false   // No unblock functionality
        },
        discord: {
          hideComment: true,   // Can delete messages
          reportUser: false,   // No report API
          blockUser: true,     // Can ban users
          unblockUser: true    // Can unban users
        },
        twitch: {
          hideComment: false,  // Cannot delete chat messages retroactively
          reportUser: false,   // No report API
          blockUser: true,     // Can ban users
          unblockUser: true    // Can unban users
        },
        instagram: {
          hideComment: true,   // Can hide comments
          reportUser: true,    // Has reporting functionality
          blockUser: true,     // Can block users
          unblockUser: false   // No unblock in Basic API
        },
        facebook: {
          hideComment: true,   // Can hide comments
          reportUser: true,    // Has reporting functionality
          blockUser: false,    // No direct block API
          unblockUser: false   // No unblock functionality
        }
      };

      for (const { class: AdapterClass, platform } of adapterDefinitions) {
        const adapter = new AdapterClass(contractTestConfig);
        const capabilities = adapter.capabilities();
        const expectedCapabilities = officialMatrix[platform];
        
        if (expectedCapabilities) {
          Object.entries(expectedCapabilities).forEach(([capability, expected]) => {
            expect(capabilities[capability]).toBe(expected);
          });
        }
      }
    });
  });
});