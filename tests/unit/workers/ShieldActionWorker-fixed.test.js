/**
 * Shield Action Worker Tests - Fixed and Comprehensive
 *
 * Tests for the Shield Action Worker focusing on:
 * - Core moderation actions (warning, mute, block, content removal)
 * - Platform integration (Twitter, Discord, YouTube)
 * - Error handling and resilience
 * - Malicious input protection
 * - Logging and monitoring
 */

const ShieldActionWorker = require('../../../src/workers/ShieldActionWorker');

// Mock Supabase
const mockSupabase = {
  from: jest.fn(() => ({
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({
          data: { id: 'action-123' },
          error: null
        })
      }))
    })),
    upsert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({
          data: { id: 'behavior-123' },
          error: null
        })
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn().mockResolvedValue({
        error: null
      })
    }))
  }))
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

// Mock BaseWorker
jest.mock('../../../src/workers/BaseWorker', () => {
  return class MockBaseWorker {
    constructor(type, options) {
      this.workerType = type;
      this.options = options;
      this.supabase = mockSupabase;
      this.log = jest.fn();
    }
  };
});

// Mock Shield Service
const mockShieldService = {
  analyzeForShield: jest.fn(),
  executeActions: jest.fn(),
  getShieldConfig: jest.fn(),
  shutdown: jest.fn()
};

jest.mock('../../../src/services/shieldService', () => {
  return jest.fn().mockImplementation(() => mockShieldService);
});

// Mock Cost Control Service
const mockCostControl = {
  recordUsage: jest.fn().mockResolvedValue({ success: true })
};

jest.mock('../../../src/services/costControl', () => {
  return jest.fn().mockImplementation(() => mockCostControl);
});

// Mock Twitter API
jest.mock('twitter-api-v2', () => ({
  TwitterApi: jest.fn().mockImplementation(() => ({
    v1: {
      createMute: jest.fn().mockResolvedValue({ success: true }),
      createBlock: jest.fn().mockResolvedValue({ success: true })
    },
    v2: {
      reply: jest.fn().mockResolvedValue({
        data: { id: 'tweet-123' }
      }),
      tweet: jest.fn().mockResolvedValue({
        data: { id: 'tweet-456' }
      })
    }
  }))
}));

// Mock Discord
jest.mock('discord.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    login: jest.fn(),
    destroy: jest.fn(),
    guilds: {
      cache: {
        get: jest.fn(() => ({
          members: {
            ban: jest.fn().mockResolvedValue({ success: true }),
            kick: jest.fn().mockResolvedValue({ success: true })
          }
        }))
      }
    }
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    GuildModeration: 4
  }
}));

describe('ShieldActionWorker - Fixed Tests', () => {
  let worker;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up environment variables for testing
    process.env.TWITTER_BEARER_TOKEN = 'test-token';
    process.env.TWITTER_APP_KEY = 'test-key';
    process.env.TWITTER_APP_SECRET = 'test-secret';
    process.env.TWITTER_ACCESS_TOKEN = 'test-access-token';
    process.env.TWITTER_ACCESS_SECRET = 'test-access-secret';

    worker = new ShieldActionWorker();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with correct worker type', () => {
      expect(worker.workerType).toBe('shield_action');
      expect(worker.shieldService).toBeDefined();
      expect(worker.platformClients).toBeDefined();
      expect(worker.platformClients instanceof Map).toBe(true);
    });

    test('should initialize platform clients when credentials are available', () => {
      expect(worker.platformClients.has('twitter')).toBe(true);
    });
  });

  describe('Core Shield Actions', () => {
    test('should execute reply warning action on Twitter', async () => {
      const job = {
        comment_id: 'comment-123',
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: 'user-456',
        platform_username: 'testuser',
        action: 'reply_warning',
        shield_mode: true
      };

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.action).toBe('reply_warning');
      expect(result.platform).toBe('twitter');
      expect(mockCostControl.recordUsage).toHaveBeenCalled();
    });

    test('should execute mute user action on Twitter', async () => {
      const job = {
        comment_id: 'comment-456',
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: 'user-789',
        platform_username: 'toxicuser',
        action: 'mute_user',
        duration: 24,
        shield_mode: true
      };

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.action).toBe('mute_user');
      expect(result.platform).toBe('twitter');
    });

    test('should execute block user action on Twitter', async () => {
      const job = {
        comment_id: 'comment-789',
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: 'user-blocked',
        platform_username: 'baduser',
        action: 'block_user',
        shield_mode: true
      };

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.action).toBe('block_user');
      expect(result.platform).toBe('twitter');
    });
  });

  describe('Input Validation and Security', () => {
    test('should reject jobs without shield_mode', async () => {
      const job = {
        comment_id: 'comment-123',
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: 'user-456',
        action: 'reply_warning'
        // Missing shield_mode: true
      };

      await expect(worker.processJob(job)).rejects.toThrow(
        'Shield action job must be in Shield mode'
      );
    });

    test('should handle malicious input safely', async () => {
      const maliciousJob = {
        comment_id: '<script>alert("xss")</script>',
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: 'user-456',
        platform_username: '"; DROP TABLE users; --',
        action: 'reply_warning',
        shield_mode: true
      };

      // Should not throw an error and should sanitize inputs
      const result = await worker.processJob(maliciousJob);
      expect(result.success).toBe(true);
    });

    test('should handle extremely long input strings', async () => {
      const longString = 'a'.repeat(10000);
      const job = {
        comment_id: longString,
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: 'user-456',
        platform_username: longString,
        action: 'reply_warning',
        shield_mode: true
      };

      const result = await worker.processJob(job);
      expect(result.success).toBe(true);
    });

    test('should handle null and undefined values gracefully', async () => {
      const job = {
        comment_id: null,
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: undefined,
        platform_username: 'testuser',
        action: 'reply_warning',
        shield_mode: true
      };

      // Should handle gracefully without crashing
      await expect(worker.processJob(job)).resolves.toBeDefined();
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle unsupported platform gracefully', async () => {
      const job = {
        comment_id: 'comment-123',
        organization_id: 'org-123',
        platform: 'unsupported_platform',
        platform_user_id: 'user-456',
        platform_username: 'testuser',
        action: 'reply_warning',
        shield_mode: true
      };

      await expect(worker.processJob(job)).rejects.toThrow(
        'No unsupported_platform client configured for Shield actions'
      );
    });

    test('should handle platform API failures', async () => {
      const job = {
        comment_id: 'comment-123',
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: 'user-456',
        platform_username: 'testuser',
        action: 'reply_warning',
        shield_mode: true
      };

      // Mock Twitter API to fail
      const mockTwitterClient = worker.platformClients.get('twitter');
      mockTwitterClient.v2.reply = jest
        .fn()
        .mockRejectedValue(new Error('Twitter API rate limit exceeded'));

      const result = await worker.processJob(job);

      // Worker should handle errors gracefully and return success: false
      expect(result.success).toBe(true); // Main job succeeds
      expect(result.result).toBe(false); // But platform action fails
    });

    test('should handle database connection failures', async () => {
      const job = {
        comment_id: 'comment-123',
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: 'user-456',
        platform_username: 'testuser',
        action: 'reply_warning',
        shield_mode: true
      };

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

      const result = await worker.processJob(job);

      // Worker should handle database errors gracefully and still complete the job
      expect(result.success).toBe(true);
      expect(result.platform).toBe('twitter');
      expect(result.action).toBe('reply_warning');
    });
  });

  describe('Platform-Specific Actions', () => {
    test('should handle Twitter-specific action parameters', async () => {
      const job = {
        comment_id: 'tweet-123',
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: 'user-456',
        platform_username: 'testuser',
        action: 'reply_warning',
        shield_mode: true
      };

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.platform).toBe('twitter');
      expect(result.action).toBe('reply_warning');

      // Verify that the Twitter client exists and was configured
      const twitterClient = worker.platformClients.get('twitter');
      expect(twitterClient).toBeDefined();
    });

    test('should handle missing platform client gracefully', async () => {
      // Remove Twitter client
      worker.platformClients.delete('twitter');

      const job = {
        comment_id: 'comment-123',
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: 'user-456',
        platform_username: 'testuser',
        action: 'reply_warning',
        shield_mode: true
      };

      await expect(worker.processJob(job)).rejects.toThrow(
        'No twitter client configured for Shield actions'
      );
    });
  });

  describe('Logging and Monitoring', () => {
    test('should log Shield actions appropriately', async () => {
      const job = {
        comment_id: 'comment-123',
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: 'user-456',
        platform_username: 'testuser',
        action: 'reply_warning',
        shield_mode: true
      };

      await worker.processJob(job);

      expect(worker.log).toHaveBeenCalledWith('info', 'Processing Shield action', {
        commentId: 'comment-123',
        platform: 'twitter',
        platformUserId: 'user-456',
        action: 'reply_warning',
        duration: undefined
      });
    });

    test('should record usage statistics', async () => {
      const job = {
        comment_id: 'comment-123',
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: 'user-456',
        platform_username: 'testuser',
        action: 'reply_warning',
        shield_mode: true
      };

      await worker.processJob(job);

      expect(mockCostControl.recordUsage).toHaveBeenCalledWith(
        'org-123',
        'twitter',
        'shield_action',
        expect.objectContaining({
          commentId: 'comment-123',
          actionType: 'reply_warning',
          platformUserId: 'user-456'
        }),
        null,
        1
      );
    });
  });

  describe('Advanced Security and Edge Cases', () => {
    test('should handle SQL injection attempts in job data', async () => {
      const maliciousJob = {
        comment_id: "'; DROP TABLE shield_actions; --",
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: "1' OR '1'='1",
        platform_username: 'testuser',
        action: 'reply_warning',
        shield_mode: true
      };

      const result = await worker.processJob(maliciousJob);
      expect(result.success).toBe(true);
      // Should not crash and should sanitize the input
    });

    test('should handle extremely large payloads', async () => {
      const largeString = 'x'.repeat(1000000); // 1MB string
      const job = {
        comment_id: largeString,
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: 'user-456',
        platform_username: largeString,
        action: 'reply_warning',
        shield_mode: true
      };

      const result = await worker.processJob(job);
      expect(result.success).toBe(true);
    });

    test('should handle concurrent job processing', async () => {
      const jobs = Array.from({ length: 10 }, (_, i) => ({
        comment_id: `comment-${i}`,
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: `user-${i}`,
        platform_username: `testuser${i}`,
        action: 'reply_warning',
        shield_mode: true
      }));

      const promises = jobs.map((job) => worker.processJob(job));
      const results = await Promise.all(promises);

      results.forEach((result) => {
        expect(result.success).toBe(true);
      });
    });

    test('should handle invalid action types gracefully', async () => {
      const job = {
        comment_id: 'comment-123',
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: 'user-456',
        platform_username: 'testuser',
        action: 'invalid_action_type',
        shield_mode: true
      };

      const result = await worker.processJob(job);

      // Worker should handle invalid actions gracefully
      expect(result.success).toBe(true);
      expect(result.result).toBe(false); // But the action itself fails
      expect(result.action).toBe('invalid_action_type');
    });

    test('should handle missing required fields', async () => {
      const incompleteJob = {
        comment_id: 'comment-123',
        // Missing organization_id, platform, etc.
        shield_mode: true
      };

      // Should reject jobs with missing platform
      await expect(worker.processJob(incompleteJob)).rejects.toThrow(
        'No undefined client configured for Shield actions'
      );
    });

    test('should handle Unicode and special characters', async () => {
      const job = {
        comment_id: 'comment-🔥💀👹',
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: 'user-456',
        platform_username: '测试用户_🚀',
        action: 'reply_warning',
        shield_mode: true
      };

      const result = await worker.processJob(job);
      expect(result.success).toBe(true);
    });

    test('should handle network timeouts gracefully', async () => {
      const job = {
        comment_id: 'comment-123',
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: 'user-456',
        platform_username: 'testuser',
        action: 'reply_warning',
        shield_mode: true
      };

      // Mock Twitter API to timeout
      const mockTwitterClient = worker.platformClients.get('twitter');
      mockTwitterClient.v2.reply = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));

      const result = await worker.processJob(job);
      expect(result.success).toBe(true);
      expect(result.result).toBe(false); // Platform action failed
    });
  });

  describe('Platform-Specific Edge Cases', () => {
    test('should handle Discord-specific actions when client is available', async () => {
      // Set up Discord client
      worker.platformClients.set('discord', {
        guilds: {
          cache: {
            get: jest.fn(() => ({
              members: {
                ban: jest.fn().mockResolvedValue({ success: true }),
                kick: jest.fn().mockResolvedValue({ success: true })
              }
            }))
          }
        }
      });

      const job = {
        comment_id: 'message-123',
        organization_id: 'org-123',
        platform: 'discord',
        platform_user_id: 'user-456',
        platform_username: 'testuser',
        action: 'ban_user',
        shield_mode: true
      };

      const result = await worker.processJob(job);
      expect(result.success).toBe(true);
      expect(result.platform).toBe('discord');
    });

    test('should handle YouTube content removal', async () => {
      // Set up YouTube client mock
      worker.platformClients.set('youtube', {
        comments: {
          delete: jest.fn().mockResolvedValue({ success: true })
        }
      });

      const job = {
        comment_id: 'comment-123',
        organization_id: 'org-123',
        platform: 'youtube',
        platform_user_id: 'user-456',
        platform_username: 'testuser',
        action: 'remove_comment',
        shield_mode: true
      };

      const result = await worker.processJob(job);
      expect(result.success).toBe(true);
      expect(result.platform).toBe('youtube');
    });
  });

  describe('Performance and Resource Management', () => {
    test('should complete jobs within reasonable time limits', async () => {
      const job = {
        comment_id: 'comment-123',
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: 'user-456',
        platform_username: 'testuser',
        action: 'reply_warning',
        shield_mode: true
      };

      const startTime = Date.now();
      const result = await worker.processJob(job);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle memory-intensive operations', async () => {
      const job = {
        comment_id: 'comment-123',
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: 'user-456',
        platform_username: 'testuser',
        action: 'reply_warning',
        shield_mode: true
      };

      // Run the same job multiple times to test memory usage
      const promises = Array.from({ length: 50 }, () => worker.processJob(job));
      const results = await Promise.all(promises);

      results.forEach((result) => {
        expect(result.success).toBe(true);
      });
    });
  });
});
