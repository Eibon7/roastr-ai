const config = require('../config/integrations');

// Import integration services
const TwitterRoastBot = require('../services/twitter');
const YouTubeService = require('./youtube/youtubeService');
const BlueskyService = require('./bluesky/blueskyService');
const InstagramService = require('./instagram/instagramService');

class IntegrationManager {
  constructor() {
    this.activeIntegrations = new Map();
    this.config = config;
    this.debug = config.debugMode;
    
    // Global metrics
    this.globalMetrics = {
      totalCommentsProcessed: 0,
      totalResponsesGenerated: 0,
      totalErrors: 0,
      startTime: new Date().toISOString(),
      uptime: 0
    };
    
    // Start metrics collection
    if (config.logging.enableMetrics) {
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
    setInterval(() => {
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
}

module.exports = IntegrationManager;