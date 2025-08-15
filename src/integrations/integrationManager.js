const config = require('../config/integrations');

// Import integration services
const TwitterRoastBot = require('../services/twitter');
const YouTubeService = require('./youtube/youtubeService');
const BlueskyService = require('./bluesky/blueskyService');
const InstagramService = require('./instagram/instagramService');
const FacebookService = require('./facebook/facebookService');
const DiscordService = require('./discord/discordService');
const TwitchService = require('./twitch/twitchService');
const RedditService = require('./reddit/redditService');
const TikTokService = require('./tiktok/tiktokService');

class IntegrationManager {
  constructor(options = {}) {
    this.activeIntegrations = new Map();
    this.config = config;
    this.debug = config.debugMode;
    this.testMode = options.testMode || false; // New test mode flag
    
    // Global metrics
    this.globalMetrics = {
      totalCommentsProcessed: 0,
      totalResponsesGenerated: 0,
      totalErrors: 0,
      startTime: new Date().toISOString(),
      uptime: 0
    };
    
    // Timer references for cleanup
    this.metricsInterval = null;
    
    // Start metrics collection only if not in test mode
    if (config.logging.enableMetrics && !this.testMode) {
      this.startMetricsCollection();
    }
  }

  /**
   * Debug logging utility
   */
  debugLog(message, ...args) {
    if (this.debug) {
      console.log(`[INTEGRATION-MANAGER] ${new Date().toISOString()}: ${message}`, ...args);
    }
  }

  /**
   * Initialize all enabled integrations
   */
  async initializeIntegrations() {
    try {
      console.log('🚀 Initializing Roastr.ai Integration Manager...');
      this.debugLog('Enabled integrations:', this.config.enabled);
      
      const integrationPromises = [];
      
      // In test mode, initialize based on INTEGRATIONS_ENABLED regardless of individual platform config
      if (this.testMode) {
        const testPlatforms = process.env.INTEGRATIONS_ENABLED?.split(',').map(p => p.trim()) || [];
        console.log(`🧪 Test mode: Initializing platforms: ${testPlatforms.join(', ')}`);
        
        if (testPlatforms.includes('twitter')) {
          integrationPromises.push(this.initializeTwitter());
        }
        if (testPlatforms.includes('youtube')) {
          integrationPromises.push(this.initializeYouTube());
        }
        if (testPlatforms.includes('bluesky')) {
          integrationPromises.push(this.initializeBluesky());
        }
        if (testPlatforms.includes('instagram')) {
          integrationPromises.push(this.initializeInstagram());
        }
        if (testPlatforms.includes('facebook')) {
          integrationPromises.push(this.initializeFacebook());
        }
        if (testPlatforms.includes('discord')) {
          integrationPromises.push(this.initializeDiscord());
        }
        if (testPlatforms.includes('twitch')) {
          integrationPromises.push(this.initializeTwitch());
        }
        if (testPlatforms.includes('reddit')) {
          integrationPromises.push(this.initializeReddit());
        }
        if (testPlatforms.includes('tiktok')) {
          integrationPromises.push(this.initializeTikTok());
        }
      } else {
        // Normal mode: check both enabled list and platform config
        // Initialize Twitter (existing)
        if (this.config.enabled.includes('twitter') && this.config.twitter.enabled) {
          integrationPromises.push(this.initializeTwitter());
        }
        
        // Initialize YouTube
        if (this.config.enabled.includes('youtube') && this.config.youtube.enabled) {
          integrationPromises.push(this.initializeYouTube());
        }
        
        // Initialize Bluesky
        if (this.config.enabled.includes('bluesky') && this.config.bluesky.enabled) {
          integrationPromises.push(this.initializeBluesky());
        }
        
        // Initialize Instagram
        if (this.config.enabled.includes('instagram') && this.config.instagram.enabled) {
          integrationPromises.push(this.initializeInstagram());
        }
        
        // Initialize Facebook
        if (this.config.enabled.includes('facebook') && this.config.facebook?.enabled) {
          integrationPromises.push(this.initializeFacebook());
        }
        
        // Initialize Discord
        if (this.config.enabled.includes('discord') && this.config.discord?.enabled) {
          integrationPromises.push(this.initializeDiscord());
        }
        
        // Initialize Twitch
        if (this.config.enabled.includes('twitch') && this.config.twitch?.enabled) {
          integrationPromises.push(this.initializeTwitch());
        }
        
        // Initialize Reddit
        if (this.config.enabled.includes('reddit') && this.config.reddit?.enabled) {
          integrationPromises.push(this.initializeReddit());
        }
        
        // Initialize TikTok
        if (this.config.enabled.includes('tiktok') && this.config.tiktok?.enabled) {
          integrationPromises.push(this.initializeTikTok());
        }
      }
      
      // Wait for all integrations to initialize (up to maxConcurrent)
      const results = await Promise.allSettled(integrationPromises);
      
      // Log results
      let successCount = 0;
      let failureCount = 0;
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          failureCount++;
          console.error(`❌ Integration initialization failed:`, result.reason?.message);
        }
      });
      
      console.log(`✅ Integration Manager initialized: ${successCount} successful, ${failureCount} failed`);
      console.log(`🔥 Active integrations: ${Array.from(this.activeIntegrations.keys()).join(', ')}`);
      
      return { success: successCount, failed: failureCount };
      
    } catch (error) {
      console.error('❌ Critical error initializing Integration Manager:', error.message);
      throw error;
    }
  }

  /**
   * Initialize Twitter integration
   */
  async initializeTwitter() {
    try {
      this.debugLog('Initializing Twitter integration...');
      
      if (this.testMode) {
        // Create mock Twitter integration for testing
        const mockTwitter = {
          platform: 'twitter',
          runOnce: async () => {
            console.log('🧪 Twitter mock: Fetching mentions...');
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
            console.log('🧪 Twitter mock: Found 3 mentions, 1 toxic comment');
            console.log('🧪 Twitter mock: Generated witty response');
            return { mentions: 3, responses: 1 };
          },
          testConnection: async () => {
            console.log('🧪 Twitter mock: Connection test passed');
            return true;
          },
          getMetrics: () => ({ commentsProcessed: 3, responsesGenerated: 1 })
        };
        this.activeIntegrations.set('twitter', mockTwitter);
        console.log('✅ Twitter integration initialized (test mode)');
        return;
      }
      
      const twitterBot = new TwitterRoastBot();
      await twitterBot.initialize();
      
      this.activeIntegrations.set('twitter', twitterBot);
      console.log('✅ Twitter integration initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Twitter integration:', error.message);
      throw error;
    }
  }

  /**
   * Initialize YouTube integration
   */
  async initializeYouTube() {
    try {
      this.debugLog('Initializing YouTube integration...');
      
      if (this.testMode) {
        // Create mock YouTube integration for testing
        const mockYouTube = {
          platform: 'youtube',
          runOnce: async () => {
            console.log('🧪 YouTube mock: Fetching video comments...');
            await new Promise(resolve => setTimeout(resolve, 700)); // Simulate API call
            console.log('🧪 YouTube mock: Found 8 comments on 2 videos, 2 toxic comments');
            console.log('🧪 YouTube mock: Generated clever responses');
            return { videos: 2, comments: 8, responses: 2 };
          },
          testConnection: async () => {
            console.log('🧪 YouTube mock: API connection test passed');
            return true;
          },
          getMetrics: () => ({ commentsProcessed: 8, responsesGenerated: 2 })
        };
        this.activeIntegrations.set('youtube', mockYouTube);
        console.log('✅ YouTube integration initialized (test mode)');
        return;
      }
      
      const youtubeService = new YouTubeService(this.config.youtube);
      await youtubeService.initialize();
      
      this.activeIntegrations.set('youtube', youtubeService);
      console.log('✅ YouTube integration initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize YouTube integration:', error.message);
      throw error;
    }
  }

  /**
   * Initialize Bluesky integration
   */
  async initializeBluesky() {
    try {
      this.debugLog('Initializing Bluesky integration...');
      
      if (this.testMode) {
        // Create mock Bluesky integration for testing
        const mockBluesky = {
          platform: 'bluesky',
          runOnce: async () => {
            console.log('🧪 Bluesky mock: Monitoring firehose...');
            await new Promise(resolve => setTimeout(resolve, 600)); // Simulate firehose connection
            console.log('🧪 Bluesky mock: Found 5 mentions, 1 roast-worthy post');
            console.log('🧪 Bluesky mock: Generated sarcastic reply');
            return { mentions: 5, posts: 1, responses: 1 };
          },
          testConnection: async () => {
            console.log('🧪 Bluesky mock: AT Protocol connection test passed');
            return true;
          },
          getMetrics: () => ({ commentsProcessed: 5, responsesGenerated: 1 })
        };
        this.activeIntegrations.set('bluesky', mockBluesky);
        console.log('✅ Bluesky integration initialized (test mode)');
        return;
      }
      
      const blueskyService = new BlueskyService(this.config.bluesky);
      await blueskyService.initialize();
      
      this.activeIntegrations.set('bluesky', blueskyService);
      console.log('✅ Bluesky integration initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Bluesky integration:', error.message);
      throw error;
    }
  }

  /**
   * Initialize Instagram integration
   */
  async initializeInstagram() {
    try {
      this.debugLog('Initializing Instagram integration...');
      
      if (this.testMode) {
        // Create mock Instagram integration for testing
        const mockInstagram = {
          platform: 'instagram',
          runOnce: async () => {
            console.log('🧪 Instagram mock: Fetching story mentions and comments...');
            await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API call
            console.log('🧪 Instagram mock: Found 4 mentions, 1 story reaction');
            console.log('🧪 Instagram mock: Generated stylish response');
            return { mentions: 4, stories: 2, responses: 1 };
          },
          testConnection: async () => {
            console.log('🧪 Instagram mock: Graph API connection test passed');
            return true;
          },
          getMetrics: () => ({ commentsProcessed: 4, responsesGenerated: 1 })
        };
        this.activeIntegrations.set('instagram', mockInstagram);
        console.log('✅ Instagram integration initialized (test mode)');
        return;
      }
      
      const instagramService = new InstagramService(this.config.instagram);
      await instagramService.initialize();
      
      this.activeIntegrations.set('instagram', instagramService);
      console.log('✅ Instagram integration initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Instagram integration:', error.message);
      throw error;
    }
  }

  /**
   * Initialize Facebook integration
   */
  async initializeFacebook() {
    try {
      this.debugLog('Initializing Facebook integration...');
      
      const facebookService = new FacebookService(this.config.facebook || {});
      await facebookService.initialize();
      
      this.activeIntegrations.set('facebook', facebookService);
      console.log('✅ Facebook integration initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Facebook integration:', error.message);
      throw error;
    }
  }

  /**
   * Initialize Discord integration
   */
  async initializeDiscord() {
    try {
      this.debugLog('Initializing Discord integration...');
      
      const discordService = new DiscordService(this.config.discord || {});
      await discordService.initialize();
      
      this.activeIntegrations.set('discord', discordService);
      console.log('✅ Discord integration initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Discord integration:', error.message);
      throw error;
    }
  }

  /**
   * Initialize Twitch integration
   */
  async initializeTwitch() {
    try {
      this.debugLog('Initializing Twitch integration...');
      
      const twitchService = new TwitchService(this.config.twitch || {});
      await twitchService.initialize();
      
      this.activeIntegrations.set('twitch', twitchService);
      console.log('✅ Twitch integration initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Twitch integration:', error.message);
      throw error;
    }
  }

  /**
   * Initialize Reddit integration
   */
  async initializeReddit() {
    try {
      this.debugLog('Initializing Reddit integration...');
      
      const redditService = new RedditService(this.config.reddit || {});
      await redditService.initialize();
      
      this.activeIntegrations.set('reddit', redditService);
      console.log('✅ Reddit integration initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Reddit integration:', error.message);
      throw error;
    }
  }

  /**
   * Initialize TikTok integration
   */
  async initializeTikTok() {
    try {
      this.debugLog('Initializing TikTok integration...');
      
      const tiktokService = new TikTokService(this.config.tiktok || {});
      await tiktokService.initialize();
      
      this.activeIntegrations.set('tiktok', tiktokService);
      console.log('✅ TikTok integration initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize TikTok integration:', error.message);
      throw error;
    }
  }

  /**
   * Start listening for mentions on all active integrations
   */
  async startListening() {
    try {
      console.log('👂 Starting to listen for mentions across all integrations...');
      
      const listeningPromises = [];
      
      for (const [platform, integration] of this.activeIntegrations) {
        this.debugLog(`Starting listening for ${platform}...`);
        listeningPromises.push(
          integration.listenForMentions().catch(error => {
            console.error(`❌ Error starting listening for ${platform}:`, error.message);
          })
        );
      }
      
      await Promise.allSettled(listeningPromises);
      
      console.log('🎧 All integrations are now listening for mentions');
      
    } catch (error) {
      console.error('❌ Error starting listeners:', error.message);
      throw error;
    }
  }

  /**
   * Run batch processing for all active integrations
   */
  async runBatch() {
    try {
      console.log('🔄 Starting batch processing for all active integrations...');
      
      if (this.activeIntegrations.size === 0) {
        console.log('⚠️ No active integrations to process');
        return {
          processed: 0,
          success: 0,
          failed: 0,
          results: []
        };
      }
      
      const startTime = Date.now();
      const batchPromises = [];
      const results = [];
      
      // Process integrations respecting maxConcurrent limit
      const platforms = Array.from(this.activeIntegrations.keys());
      
      for (let i = 0; i < platforms.length; i += this.config.maxConcurrent) {
        const batch = platforms.slice(i, i + this.config.maxConcurrent);
        
        this.debugLog(`Processing batch: ${batch.join(', ')}`);
        
        const batchResults = await Promise.allSettled(
          batch.map(platform => this.runIntegrationBatch(platform))
        );
        
        results.push(...batchResults);
        
        // Add delay between batches if there are more to process
        if (i + this.config.maxConcurrent < platforms.length) {
          this.debugLog('Adding delay between batches...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      // Process and summarize results
      const summary = this.processBatchResults(results);
      const duration = Date.now() - startTime;
      
      console.log(`✅ Batch processing completed in ${duration}ms`);
      this.printBatchSummary(summary, duration);
      
      return summary;
      
    } catch (error) {
      console.error('❌ Error in batch processing:', error.message);
      this.globalMetrics.totalErrors++;
      throw error;
    }
  }

  /**
   * Run batch processing for a specific integration
   */
  async runIntegrationBatch(platform) {
    try {
      this.debugLog(`Running batch for ${platform}...`);
      
      const integration = this.activeIntegrations.get(platform);
      
      if (!integration) {
        throw new Error(`Integration ${platform} not found`);
      }
      
      const startTime = Date.now();
      
      // Run the integration's batch processing (listenForMentions in batch mode)
      await integration.listenForMentions();
      
      const duration = Date.now() - startTime;
      
      // Get updated metrics
      const metrics = integration.getMetrics ? integration.getMetrics() : {};
      
      this.debugLog(`Completed batch for ${platform} in ${duration}ms`);
      
      return {
        platform,
        success: true,
        duration,
        metrics,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Error running batch for ${platform}:`, error.message);
      
      return {
        platform,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Process batch results and create summary
   */
  processBatchResults(results) {
    const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success);
    const failed = results.filter(r => r.status === 'rejected' || !r.value?.success);
    
    const summary = {
      processed: results.length,
      success: successful.length,
      failed: failed.length,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { 
        success: false, 
        error: r.reason?.message || 'Unknown error' 
      })
    };
    
    // Update global metrics
    let totalComments = 0;
    let totalResponses = 0;
    let totalErrors = 0;
    
    successful.forEach(result => {
      const metrics = result.value?.metrics || {};
      totalComments += metrics.commentsProcessed || 0;
      totalResponses += metrics.responsesGenerated || 0;
      totalErrors += metrics.errorsEncountered || 0;
    });
    
    this.globalMetrics.totalCommentsProcessed += totalComments;
    this.globalMetrics.totalResponsesGenerated += totalResponses;
    this.globalMetrics.totalErrors += totalErrors;
    
    return summary;
  }

  /**
   * Print batch summary
   */
  printBatchSummary(summary, duration) {
    console.log('\n📈 BATCH PROCESSING SUMMARY');
    console.log('============================');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`🔢 Integrations processed: ${summary.processed}`);
    console.log(`✅ Successful: ${summary.success}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`💬 Total comments processed: ${this.globalMetrics.totalCommentsProcessed}`);
    console.log(`🚀 Total responses generated: ${this.globalMetrics.totalResponsesGenerated}`);
    console.log(`⚠️  Total errors: ${this.globalMetrics.totalErrors}`);
    
    if (summary.failed > 0) {
      console.log('\n❌ Failed integrations:');
      summary.results.forEach(result => {
        if (!result.success) {
          console.log(`   - ${result.platform || 'unknown'}: ${result.error}`);
        }
      });
    }
    
    console.log('============================\n');
  }

  /**
   * Get metrics from all active integrations
   */
  getGlobalMetrics() {
    const integrationMetrics = {};
    
    // Collect metrics from each integration
    for (const [platform, integration] of this.activeIntegrations) {
      if (typeof integration.getMetrics === 'function') {
        integrationMetrics[platform] = integration.getMetrics();
        
        // Accumulate global metrics
        const metrics = integrationMetrics[platform];
        this.globalMetrics.totalCommentsProcessed += metrics.commentsProcessed || 0;
        this.globalMetrics.totalResponsesGenerated += metrics.responsesGenerated || 0;
        this.globalMetrics.totalErrors += metrics.errorsEncountered || 0;
      }
    }
    
    // Calculate uptime
    this.globalMetrics.uptime = process.uptime();
    
    return {
      global: this.globalMetrics,
      integrations: integrationMetrics,
      activeIntegrations: Array.from(this.activeIntegrations.keys()),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Start periodic metrics collection
   */
  startMetricsCollection() {
    this.metricsInterval = setInterval(() => {
      const metrics = this.getGlobalMetrics();
      this.debugLog('Periodic metrics:', metrics.global);
      
      // Here you could send metrics to external monitoring service
      // this.sendMetricsToMonitoring(metrics);
      
    }, this.config.logging.metricsInterval);
  }

  /**
   * Get status of all integrations
   */
  getStatus() {
    const status = {
      manager: {
        running: true,
        startTime: this.globalMetrics.startTime,
        uptime: process.uptime(),
        activeIntegrations: this.activeIntegrations.size
      },
      integrations: {}
    };
    
    for (const [platform, integration] of this.activeIntegrations) {
      status.integrations[platform] = {
        active: true,
        metrics: integration.getMetrics ? integration.getMetrics() : {},
        lastActivity: integration.metrics?.lastActivity || null
      };
    }
    
    return status;
  }

  /**
   * Shutdown all integrations gracefully
   */
  async shutdown() {
    try {
      console.log('🛑 Shutting down Integration Manager...');
      
      // Clear metrics interval with error handling
      try {
        if (this.metricsInterval) {
          clearInterval(this.metricsInterval);
          this.metricsInterval = null;
          console.log('🧹 Cleared metrics collection interval');
        }
      } catch (error) {
        console.warn('⚠️ Error clearing metrics interval:', error.message);
      }
      
      const shutdownPromises = [];
      
      for (const [platform, integration] of this.activeIntegrations) {
        this.debugLog(`Shutting down ${platform}...`);
        if (typeof integration.shutdown === 'function') {
          shutdownPromises.push(
            integration.shutdown().catch(error => {
              console.error(`❌ Error shutting down ${platform}:`, error.message);
            })
          );
        }
      }
      
      await Promise.allSettled(shutdownPromises);
      
      this.activeIntegrations.clear();
      
      console.log('✅ Integration Manager shut down successfully');
      
      // TODO: Implement shutdown timeout to prevent hanging shutdown operations
      // TODO: Add cleanup verification tests that check for resource leaks
      
    } catch (error) {
      console.error('❌ Error during Integration Manager shutdown:', error.message);
    }
  }

  /**
   * Restart a specific integration
   */
  async restartIntegration(platform) {
    try {
      console.log(`🔄 Restarting ${platform} integration...`);
      
      // Shutdown existing integration
      const integration = this.activeIntegrations.get(platform);
      if (integration && typeof integration.shutdown === 'function') {
        await integration.shutdown();
      }
      
      this.activeIntegrations.delete(platform);
      
      // Reinitialize
      switch (platform) {
        case 'twitter':
          await this.initializeTwitter();
          break;
        case 'youtube':
          await this.initializeYouTube();
          break;
        case 'bluesky':
          await this.initializeBluesky();
          break;
        case 'instagram':
          await this.initializeInstagram();
          break;
        default:
          throw new Error(`Unknown integration platform: ${platform}`);
      }

      // Start listening again
      const newIntegration = this.activeIntegrations.get(platform);
      if (newIntegration) {
        await newIntegration.listenForMentions();
      }

      console.log(`✅ ${platform} integration restarted successfully`);

    } catch (error) {
      console.error(`❌ Error restarting ${platform} integration:`, error.message);
      throw error;
    }
  }

  async runAllIntegrationsOnce() {
    try {
      console.log('🧪 Running all integrations in test mode (dry-run)...');
      
      // Get enabled platforms from environment variable
      const enabledPlatforms = process.env.INTEGRATIONS_ENABLED
        ? process.env.INTEGRATIONS_ENABLED.split(',').map((p) => p.trim())
        : [];

      if (enabledPlatforms.length === 0) {
        console.log('⚠️ No integrations enabled in INTEGRATIONS_ENABLED environment variable');
        return;
      }

      console.log(`🎯 Testing platforms: ${enabledPlatforms.join(', ')}`);

      // Initialize integrations first
      await this.initializeIntegrations();

      let successCount = 0;
      let failureCount = 0;

      // Run each enabled integration once
      for (const platform of enabledPlatforms) {
        try {
          const integration = this.activeIntegrations.get(platform);
          
          if (!integration) {
            console.warn(`⚠️ No active integration found for: ${platform}`);
            failureCount++;
            continue;
          }

          console.log(`🖋️ Running ${platform} integration test...`);
          
          // Check if integration has runOnce method
          if (typeof integration.runOnce === 'function') {
            await integration.runOnce();
            console.log(`✅ ${platform} test completed successfully`);
            successCount++;
          } else {
            // Fallback: try to run a single batch or fetch operation
            console.log(`🔄 ${platform} doesn't have runOnce(), trying alternative test...`);
            
            if (typeof integration.testConnection === 'function') {
              await integration.testConnection();
              console.log(`✅ ${platform} connection test completed`);
              successCount++;
            } else if (typeof integration.fetchComments === 'function') {
              // Try to fetch comments in dry-run mode
              const comments = await integration.fetchComments({ limit: 1, dryRun: true });
              console.log(`✅ ${platform} fetch test completed (${comments?.length || 0} comments would be processed)`);
              successCount++;
            } else {
              console.warn(`⚠️ ${platform} doesn't implement runOnce() or testConnection() - test skipped`);
              failureCount++;
            }
          }
        } catch (error) {
          console.error(`❌ Error testing ${platform}: ${error.message}`);
          failureCount++;
        }
      }

      // Print summary
      console.log('\n📊 Integration Test Summary:');
      console.log('============================');
      console.log(`✅ Successful: ${successCount}`);
      console.log(`❌ Failed: ${failureCount}`);
      console.log(`📋 Total: ${enabledPlatforms.length}`);
      console.log('============================\n');

      if (failureCount > 0) {
        throw new Error(`${failureCount} integration test(s) failed`);
      }

    } catch (error) {
      console.error('❌ Integration test error:', error.message);
      throw error;
    }
  }
}

module.exports = IntegrationManager;

      
