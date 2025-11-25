/**
 * Integration Manager Tests
 *
 * Tests for IntegrationManager class covering initialization, batch processing,
 * metrics, status, shutdown, and restart functionality.
 *
 * Issue #933: Coverage improvement - Integration Manager (2.8% → 70%+)
 */

const IntegrationManager = require('../../../src/integrations/integrationManager');

// Mock logger - use factory function
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock integration services
const mockTwitterBot = {
  platform: 'twitter',
  initialize: jest.fn().mockResolvedValue(true),
  listenForMentions: jest.fn().mockResolvedValue({ mentions: 3, responses: 1 }),
  getMetrics: jest.fn().mockReturnValue({ commentsProcessed: 3, responsesGenerated: 1 }),
  shutdown: jest.fn().mockResolvedValue(true)
};

const mockYouTubeService = {
  platform: 'youtube',
  initialize: jest.fn().mockResolvedValue(true),
  listenForMentions: jest.fn().mockResolvedValue({ videos: 2, comments: 8 }),
  getMetrics: jest.fn().mockReturnValue({ commentsProcessed: 8, responsesGenerated: 2 }),
  shutdown: jest.fn().mockResolvedValue(true)
};

const mockBlueskyService = {
  platform: 'bluesky',
  initialize: jest.fn().mockResolvedValue(true),
  listenForMentions: jest.fn().mockResolvedValue({ mentions: 5 }),
  getMetrics: jest.fn().mockReturnValue({ commentsProcessed: 5, responsesGenerated: 1 }),
  shutdown: jest.fn().mockResolvedValue(true)
};

jest.mock('../../../src/services/twitter', () => {
  return jest.fn().mockImplementation(() => mockTwitterBot);
});

jest.mock('../../../src/integrations/youtube/youtubeService', () => {
  return jest.fn().mockImplementation(() => mockYouTubeService);
});

jest.mock('../../../src/integrations/bluesky/blueskyService', () => {
  return jest.fn().mockImplementation(() => mockBlueskyService);
});

jest.mock('../../../src/integrations/instagram/instagramService', () => {
  return jest.fn().mockImplementation(() => ({
    platform: 'instagram',
    initialize: jest.fn().mockResolvedValue(true),
    listenForMentions: jest.fn().mockResolvedValue({}),
    shutdown: jest.fn().mockResolvedValue(true),
    getMetrics: jest.fn().mockReturnValue({ commentsProcessed: 0 })
  }));
});

jest.mock('../../../src/integrations/facebook/facebookService', () => {
  return jest.fn().mockImplementation(() => ({
    platform: 'facebook',
    initialize: jest.fn().mockResolvedValue(true),
    getMetrics: jest.fn().mockReturnValue({ commentsProcessed: 0 })
  }));
});

jest.mock('../../../src/integrations/discord/discordService', () => {
  return jest.fn().mockImplementation(() => ({
    platform: 'discord',
    initialize: jest.fn().mockResolvedValue(true),
    getMetrics: jest.fn().mockReturnValue({ commentsProcessed: 0 })
  }));
});

jest.mock('../../../src/integrations/twitch/twitchService', () => {
  return jest.fn().mockImplementation(() => ({
    platform: 'twitch',
    initialize: jest.fn().mockResolvedValue(true),
    getMetrics: jest.fn().mockReturnValue({ commentsProcessed: 0 })
  }));
});

jest.mock('../../../src/integrations/reddit/redditService', () => {
  return jest.fn().mockImplementation(() => ({
    platform: 'reddit',
    initialize: jest.fn().mockResolvedValue(true),
    getMetrics: jest.fn().mockReturnValue({ commentsProcessed: 0 })
  }));
});

jest.mock('../../../src/integrations/tiktok/tiktokService', () => {
  return jest.fn().mockImplementation(() => ({
    platform: 'tiktok',
    initialize: jest.fn().mockResolvedValue(true),
    getMetrics: jest.fn().mockReturnValue({ commentsProcessed: 0 })
  }));
});

// Mock config - use factory function to avoid hoisting issues
jest.mock('../../../src/config/integrations', () => {
  return {
    enabled: ['twitter', 'youtube', 'bluesky'],
    twitter: { enabled: true },
    youtube: { enabled: true },
    bluesky: { enabled: true },
    maxConcurrent: 3,
    logging: {
      enableMetrics: false,
      metricsInterval: 60000
    },
    debugMode: false
  };
});

const { logger } = require('../../../src/utils/logger');

describe('IntegrationManager', () => {
  let manager;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset process.env
    delete process.env.INTEGRATIONS_ENABLED;
  });

  afterEach(async () => {
    if (manager) {
      try {
        await manager.shutdown();
      } catch (error) {
        // Ignore shutdown errors in tests
      }
    }
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      manager = new IntegrationManager();
      expect(manager.activeIntegrations).toBeInstanceOf(Map);
      expect(manager.config).toBeDefined();
      expect(manager.testMode).toBe(false);
      expect(manager.globalMetrics).toBeDefined();
      expect(manager.globalMetrics.totalCommentsProcessed).toBe(0);
      expect(manager.globalMetrics.totalResponsesGenerated).toBe(0);
    });

    it('should initialize with testMode enabled', () => {
      manager = new IntegrationManager({ testMode: true });
      expect(manager.testMode).toBe(true);
    });

    it('should not start metrics collection in test mode', () => {
      manager = new IntegrationManager({ testMode: true });
      expect(manager.metricsInterval).toBeNull();
    });
  });

  describe('initializeIntegrations', () => {
    it('should initialize all enabled integrations successfully', async () => {
      manager = new IntegrationManager();
      const result = await manager.initializeIntegrations();

      expect(result.success).toBeGreaterThan(0);
      expect(result.failed).toBe(0);
      expect(manager.activeIntegrations.size).toBeGreaterThan(0);
      expect(mockTwitterBot.initialize).toHaveBeenCalled();
      expect(mockYouTubeService.initialize).toHaveBeenCalled();
    });

    it('should handle initialization failures gracefully', async () => {
      mockTwitterBot.initialize.mockRejectedValueOnce(new Error('Init failed'));
      manager = new IntegrationManager();

      const result = await manager.initializeIntegrations();

      expect(result.failed).toBeGreaterThan(0);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Integration initialization failed'),
        expect.any(String)
      );
    });

    it('should initialize integrations in test mode', async () => {
      process.env.INTEGRATIONS_ENABLED = 'twitter,youtube';
      manager = new IntegrationManager({ testMode: true });

      const result = await manager.initializeIntegrations();

      expect(result.success).toBeGreaterThan(0);
      expect(manager.activeIntegrations.has('twitter')).toBe(true);
      expect(manager.activeIntegrations.has('youtube')).toBe(true);
    });

    it('should handle empty enabled list in test mode', async () => {
      process.env.INTEGRATIONS_ENABLED = '';
      manager = new IntegrationManager({ testMode: true });

      const result = await manager.initializeIntegrations();

      expect(result.success).toBe(0);
      expect(manager.activeIntegrations.size).toBe(0);
    });
  });

  describe('startListening', () => {
    it('should start listening on all active integrations', async () => {
      manager = new IntegrationManager();
      await manager.initializeIntegrations();

      await manager.startListening();

      expect(mockTwitterBot.listenForMentions).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('All integrations are now listening')
      );
    });

    it('should handle errors when starting listeners', async () => {
      mockTwitterBot.listenForMentions.mockRejectedValueOnce(new Error('Listen failed'));
      manager = new IntegrationManager();
      await manager.initializeIntegrations();

      await manager.startListening();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error starting listening'),
        expect.any(String)
      );
    });

    it('should handle no active integrations', async () => {
      manager = new IntegrationManager();
      // Don't initialize integrations

      await manager.startListening();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('All integrations are now listening')
      );
    });
  });

  describe('runBatch', () => {
    it('should process batch for all active integrations', async () => {
      manager = new IntegrationManager();
      await manager.initializeIntegrations();

      const result = await manager.runBatch();

      expect(result.processed).toBeGreaterThan(0);
      expect(result.success).toBeGreaterThan(0);
      expect(result.failed).toBe(0);
      expect(mockTwitterBot.listenForMentions).toHaveBeenCalled();
    });

    it('should handle no active integrations', async () => {
      manager = new IntegrationManager();

      const result = await manager.runBatch();

      expect(result.processed).toBe(0);
      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('No active integrations to process')
      );
    });

    it('should handle batch processing errors', async () => {
      mockTwitterBot.listenForMentions.mockRejectedValueOnce(new Error('Batch failed'));
      manager = new IntegrationManager();
      await manager.initializeIntegrations();

      const result = await manager.runBatch();

      expect(result.failed).toBeGreaterThan(0);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error running batch'),
        expect.any(String)
      );
    });

    it('should respect maxConcurrent limit', async () => {
      manager = new IntegrationManager();
      await manager.initializeIntegrations();
      manager.config.maxConcurrent = 1;

      const result = await manager.runBatch();

      // Should process in batches
      expect(result.processed).toBeGreaterThan(0);
    }, 15000); // Increase timeout for batch processing
  });

  describe('runIntegrationBatch', () => {
    it('should run batch for specific integration', async () => {
      manager = new IntegrationManager();
      await manager.initializeIntegrations();

      const result = await manager.runIntegrationBatch('twitter');

      expect(result.platform).toBe('twitter');
      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(mockTwitterBot.listenForMentions).toHaveBeenCalled();
    });

    it('should handle integration not found', async () => {
      manager = new IntegrationManager();
      await manager.initializeIntegrations();

      const result = await manager.runIntegrationBatch('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Integration nonexistent not found');
    });

    it('should handle batch errors gracefully', async () => {
      mockTwitterBot.listenForMentions.mockRejectedValueOnce(new Error('Batch error'));
      manager = new IntegrationManager();
      await manager.initializeIntegrations();

      const result = await manager.runIntegrationBatch('twitter');

      expect(result.platform).toBe('twitter');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getGlobalMetrics', () => {
    it('should return global metrics from all integrations', () => {
      manager = new IntegrationManager();
      manager.activeIntegrations.set('twitter', mockTwitterBot);
      manager.activeIntegrations.set('youtube', mockYouTubeService);

      const metrics = manager.getGlobalMetrics();

      expect(metrics.global).toBeDefined();
      expect(metrics.integrations).toBeDefined();
      expect(metrics.integrations.twitter).toBeDefined();
      expect(metrics.integrations.youtube).toBeDefined();
      expect(metrics.activeIntegrations).toContain('twitter');
      expect(metrics.activeIntegrations).toContain('youtube');
      expect(metrics.timestamp).toBeDefined();
    });

    it('should calculate uptime correctly', () => {
      manager = new IntegrationManager();
      const metrics = manager.getGlobalMetrics();

      expect(metrics.global.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getStatus', () => {
    it('should return status of all integrations', () => {
      manager = new IntegrationManager();
      manager.activeIntegrations.set('twitter', mockTwitterBot);

      const status = manager.getStatus();

      expect(status.manager.running).toBe(true);
      expect(status.manager.activeIntegrations).toBe(1);
      expect(status.integrations.twitter).toBeDefined();
      expect(status.integrations.twitter.active).toBe(true);
    });

    it('should include metrics in status', () => {
      manager = new IntegrationManager();
      manager.activeIntegrations.set('twitter', mockTwitterBot);

      const status = manager.getStatus();

      expect(status.integrations.twitter.metrics).toBeDefined();
    });
  });

  describe('shutdown', () => {
    it('should shutdown all integrations gracefully', async () => {
      manager = new IntegrationManager();
      await manager.initializeIntegrations();

      await manager.shutdown();

      expect(mockTwitterBot.shutdown).toHaveBeenCalled();
      expect(mockYouTubeService.shutdown).toHaveBeenCalled();
      expect(manager.activeIntegrations.size).toBe(0);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Integration Manager shut down successfully')
      );
    });

    it('should clear metrics interval', async () => {
      manager = new IntegrationManager();
      manager.metricsInterval = setInterval(() => {}, 1000);

      await manager.shutdown();

      expect(manager.metricsInterval).toBeNull();
    });

    it('should handle shutdown errors gracefully', async () => {
      mockTwitterBot.shutdown.mockRejectedValueOnce(new Error('Shutdown failed'));
      manager = new IntegrationManager();
      await manager.initializeIntegrations();

      await manager.shutdown();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error shutting down'),
        expect.any(String)
      );
    });
  });

  describe('restartIntegration', () => {
    it('should restart specific integration', async () => {
      manager = new IntegrationManager();
      await manager.initializeIntegrations();

      await manager.restartIntegration('twitter');

      expect(mockTwitterBot.shutdown).toHaveBeenCalled();
      expect(mockTwitterBot.initialize).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('twitter integration restarted successfully')
      );
    });

    it('should handle unknown platform', async () => {
      manager = new IntegrationManager();
      await manager.initializeIntegrations();

      await expect(manager.restartIntegration('unknown')).rejects.toThrow(
        'Unknown integration platform'
      );
    });
  });

  describe('runAllIntegrationsOnce', () => {
    it('should run all integrations once in test mode', async () => {
      process.env.INTEGRATIONS_ENABLED = 'twitter,youtube';
      manager = new IntegrationManager({ testMode: true });

      await manager.runAllIntegrationsOnce();

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Integration Test Summary'));
    });

    it('should handle missing runOnce method', async () => {
      process.env.INTEGRATIONS_ENABLED = 'twitter';
      manager = new IntegrationManager({ testMode: true });
      await manager.initializeIntegrations();

      // Create a mock integration without any test methods
      const mockIntegrationWithoutMethods = {
        platform: 'twitter',
        getMetrics: jest.fn().mockReturnValue({ commentsProcessed: 0 })
      };
      manager.activeIntegrations.set('twitter', mockIntegrationWithoutMethods);

      // Should complete without throwing errors
      await expect(manager.runAllIntegrationsOnce()).resolves.not.toThrow();

      // The code should handle gracefully when integration doesn't implement test methods
      // It either logs a warning or handles it silently
      const summaryCalls = logger.info.mock.calls.filter(
        (call) => call[0] && call[0].includes('Integration Test Summary')
      );
      expect(summaryCalls.length).toBeGreaterThan(0);
    });

    it('should handle no enabled integrations', async () => {
      process.env.INTEGRATIONS_ENABLED = '';
      manager = new IntegrationManager({ testMode: true });

      await manager.runAllIntegrationsOnce();

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('No integrations enabled'));
    });
  });

  describe('debugLog', () => {
    it('should log debug messages when debug is enabled', () => {
      manager = new IntegrationManager();
      manager.debug = true;

      manager.debugLog('Test message', { key: 'value' });

      // debugLog calls logger.info with formatted string and spread args
      expect(logger.info).toHaveBeenCalled();
      const callArgs = logger.info.mock.calls[0];
      expect(callArgs[0]).toContain('[INTEGRATION-MANAGER]');
      expect(callArgs[0]).toContain('Test message');
      expect(callArgs[1]).toEqual({ key: 'value' });
    });

    it('should not log when debug is disabled', () => {
      manager = new IntegrationManager();
      manager.debug = false;

      manager.debugLog('Test message');

      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe('startMetricsCollection', () => {
    it('should start metrics collection when enabled and not in test mode', () => {
      // Temporarily modify config
      const config = require('../../../src/config/integrations');
      const originalEnableMetrics = config.logging.enableMetrics;
      config.logging.enableMetrics = true;

      manager = new IntegrationManager();

      // Verify metrics interval was set
      expect(manager.metricsInterval).toBeDefined();
      expect(typeof manager.metricsInterval).toBe('object');

      // Cleanup
      if (manager.metricsInterval) {
        clearInterval(manager.metricsInterval);
      }
      config.logging.enableMetrics = originalEnableMetrics;
    });
  });

  describe('initializeIntegrations - normal mode', () => {
    it('should initialize Instagram in normal mode', async () => {
      const InstagramService = require('../../../src/integrations/instagram/instagramService');
      manager = new IntegrationManager();

      await manager.initializeInstagram();

      expect(InstagramService).toHaveBeenCalled();
      expect(manager.activeIntegrations.has('instagram')).toBe(true);
    });

    it('should initialize Facebook in normal mode', async () => {
      const FacebookService = require('../../../src/integrations/facebook/facebookService');
      manager = new IntegrationManager();

      await manager.initializeFacebook();

      expect(FacebookService).toHaveBeenCalled();
      expect(manager.activeIntegrations.has('facebook')).toBe(true);
    });

    it('should initialize Discord in normal mode', async () => {
      const DiscordService = require('../../../src/integrations/discord/discordService');
      manager = new IntegrationManager();

      await manager.initializeDiscord();

      expect(DiscordService).toHaveBeenCalled();
      expect(manager.activeIntegrations.has('discord')).toBe(true);
    });

    it('should initialize Twitch in normal mode', async () => {
      const TwitchService = require('../../../src/integrations/twitch/twitchService');
      manager = new IntegrationManager();

      await manager.initializeTwitch();

      expect(TwitchService).toHaveBeenCalled();
      expect(manager.activeIntegrations.has('twitch')).toBe(true);
    });

    it('should initialize Reddit in normal mode', async () => {
      const RedditService = require('../../../src/integrations/reddit/redditService');
      manager = new IntegrationManager();

      await manager.initializeReddit();

      expect(RedditService).toHaveBeenCalled();
      expect(manager.activeIntegrations.has('reddit')).toBe(true);
    });

    it('should initialize TikTok in normal mode', async () => {
      const TikTokService = require('../../../src/integrations/tiktok/tiktokService');
      manager = new IntegrationManager();

      await manager.initializeTikTok();

      expect(TikTokService).toHaveBeenCalled();
      expect(manager.activeIntegrations.has('tiktok')).toBe(true);
    });

    it('should handle initialization errors for Instagram', async () => {
      const InstagramService = require('../../../src/integrations/instagram/instagramService');
      InstagramService.mockImplementationOnce(() => ({
        initialize: jest.fn().mockRejectedValue(new Error('Instagram init failed'))
      }));
      manager = new IntegrationManager();

      await expect(manager.initializeInstagram()).rejects.toThrow('Instagram init failed');
    });

    it('should handle initialization errors for Facebook', async () => {
      const FacebookService = require('../../../src/integrations/facebook/facebookService');
      FacebookService.mockImplementationOnce(() => ({
        initialize: jest.fn().mockRejectedValue(new Error('Facebook init failed'))
      }));
      manager = new IntegrationManager();

      await expect(manager.initializeFacebook()).rejects.toThrow('Facebook init failed');
    });
  });

  describe('restartIntegration - additional platforms', () => {
    it('should restart YouTube integration', async () => {
      manager = new IntegrationManager();
      await manager.initializeIntegrations();

      // Mock YouTube service
      const YouTubeService = require('../../../src/integrations/youtube/youtubeService');
      const mockYouTube = {
        platform: 'youtube',
        initialize: jest.fn().mockResolvedValue(true),
        listenForMentions: jest.fn().mockResolvedValue({}),
        shutdown: jest.fn().mockResolvedValue(true)
      };
      manager.activeIntegrations.set('youtube', mockYouTube);

      await manager.restartIntegration('youtube');

      expect(mockYouTube.shutdown).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('youtube integration restarted successfully')
      );
    });

    it('should restart Bluesky integration', async () => {
      manager = new IntegrationManager();
      await manager.initializeIntegrations();

      const mockBluesky = {
        platform: 'bluesky',
        initialize: jest.fn().mockResolvedValue(true),
        listenForMentions: jest.fn().mockResolvedValue({}),
        shutdown: jest.fn().mockResolvedValue(true)
      };
      manager.activeIntegrations.set('bluesky', mockBluesky);

      await manager.restartIntegration('bluesky');

      expect(mockBluesky.shutdown).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('bluesky integration restarted successfully')
      );
    });

    it('should restart Instagram integration', async () => {
      manager = new IntegrationManager();
      // Initialize Instagram first
      await manager.initializeInstagram();

      // Ensure the mock has all required methods
      const mockInstagram = manager.activeIntegrations.get('instagram');
      if (mockInstagram) {
        mockInstagram.shutdown = jest.fn().mockResolvedValue(true);
        mockInstagram.listenForMentions = jest.fn().mockResolvedValue({});
      }

      await manager.restartIntegration('instagram');

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('instagram integration restarted successfully')
      );
    });
  });

  describe('runAllIntegrationsOnce - additional scenarios', () => {
    it('should handle integration with testConnection method', async () => {
      process.env.INTEGRATIONS_ENABLED = 'twitter';
      manager = new IntegrationManager({ testMode: true });

      // Override the integration after initialization
      const mockIntegration = {
        platform: 'twitter',
        testConnection: jest.fn().mockResolvedValue(true),
        getMetrics: jest.fn().mockReturnValue({ commentsProcessed: 0 })
      };

      // Mock initializeIntegrations to set our custom integration
      const originalInit = manager.initializeIntegrations.bind(manager);
      manager.initializeIntegrations = jest.fn().mockResolvedValue({ success: 1, failed: 0 });
      manager.activeIntegrations.set('twitter', mockIntegration);

      await manager.runAllIntegrationsOnce();

      expect(mockIntegration.testConnection).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Integration Test Summary'));
    });

    it('should handle integration with fetchComments method', async () => {
      process.env.INTEGRATIONS_ENABLED = 'twitter';
      manager = new IntegrationManager({ testMode: true });

      const mockIntegration = {
        platform: 'twitter',
        fetchComments: jest.fn().mockResolvedValue([]), // Returns array, not object
        getMetrics: jest.fn().mockReturnValue({ commentsProcessed: 0 })
      };

      manager.initializeIntegrations = jest.fn().mockResolvedValue({ success: 1, failed: 0 });
      manager.activeIntegrations.set('twitter', mockIntegration);

      await manager.runAllIntegrationsOnce();

      expect(mockIntegration.fetchComments).toHaveBeenCalledWith({ limit: 1, dryRun: true });
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Integration Test Summary'));
    });

    it('should handle errors during integration test', async () => {
      process.env.INTEGRATIONS_ENABLED = 'twitter';
      manager = new IntegrationManager({ testMode: true });

      const mockIntegration = {
        platform: 'twitter',
        runOnce: jest.fn().mockRejectedValue(new Error('Test failed')),
        getMetrics: jest.fn().mockReturnValue({ commentsProcessed: 0 })
      };

      manager.initializeIntegrations = jest.fn().mockResolvedValue({ success: 1, failed: 0 });
      manager.activeIntegrations.set('twitter', mockIntegration);

      // The method throws error only if failureCount > 0 at the end
      await expect(manager.runAllIntegrationsOnce()).rejects.toThrow('integration test(s) failed');

      // Check that error was logged (format: "❌ Error testing twitter: Test failed")
      const errorCalls = logger.error.mock.calls.filter(
        (call) => call[0] && call[0].includes('Error testing')
      );
      expect(errorCalls.length).toBeGreaterThan(0);
    });

    it('should handle integration not found in active integrations', async () => {
      process.env.INTEGRATIONS_ENABLED = 'twitter';
      manager = new IntegrationManager({ testMode: true });

      // Mock initializeIntegrations to not add twitter
      manager.initializeIntegrations = jest.fn().mockResolvedValue({ success: 0, failed: 0 });
      // Don't add twitter to activeIntegrations

      // Should throw error because failureCount > 0
      await expect(manager.runAllIntegrationsOnce()).rejects.toThrow('integration test(s) failed');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No active integration found')
      );
    });
  });

  describe('processBatchResults', () => {
    it('should process batch results correctly', async () => {
      manager = new IntegrationManager();
      await manager.initializeIntegrations();

      const mockResults = [
        {
          status: 'fulfilled',
          value: { success: true, metrics: { commentsProcessed: 5, responsesGenerated: 2 } }
        },
        { status: 'fulfilled', value: { success: false, error: 'Failed' } },
        { status: 'rejected', reason: { message: 'Error' } }
      ];

      const summary = manager.processBatchResults(mockResults);

      expect(summary.processed).toBe(3);
      expect(summary.success).toBe(1);
      expect(summary.failed).toBe(2);
      expect(summary.results).toHaveLength(3);
    });
  });

  describe('printBatchSummary', () => {
    it('should print batch summary correctly', async () => {
      manager = new IntegrationManager();
      manager.globalMetrics.totalCommentsProcessed = 10;
      manager.globalMetrics.totalResponsesGenerated = 5;
      manager.globalMetrics.totalErrors = 1;

      const summary = {
        processed: 3,
        success: 2,
        failed: 1,
        results: [
          { success: true, platform: 'twitter' },
          { success: true, platform: 'youtube' },
          { success: false, platform: 'bluesky', error: 'Failed' }
        ]
      };

      manager.printBatchSummary(summary, 5000);

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('BATCH PROCESSING SUMMARY'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Failed integrations'));
    });
  });
});
