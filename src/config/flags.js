/**
 * Central Feature Flags System
 * 
 * Controls which features are enabled based on environment variables
 * and graceful degradation when required keys are missing
 */

const { mockMode } = require('./mockMode');

class FeatureFlags {
  constructor() {
    this.flags = this.loadFlags();
    this.logFlagsStatus();
  }

  loadFlags() {
    return {
      // Core System Features
      ENABLE_BILLING: this.checkBillingAvailable(),
      ENABLE_RQC: process.env.ENABLE_RQC === 'true' || false,
      ENABLE_SHIELD: process.env.ENABLE_SHIELD === 'true' || false,
      
      // Platform Integration Features  
      ENABLE_REAL_TWITTER: this.checkTwitterKeys(),
      ENABLE_REAL_YOUTUBE: this.checkYouTubeKeys(),
      ENABLE_REAL_INSTAGRAM: this.checkInstagramKeys(),
      ENABLE_REAL_FACEBOOK: this.checkFacebookKeys(),
      ENABLE_REAL_DISCORD: this.checkDiscordKeys(),
      ENABLE_REAL_TWITCH: this.checkTwitchKeys(),
      ENABLE_REAL_REDDIT: this.checkRedditKeys(),
      ENABLE_REAL_TIKTOK: this.checkTikTokKeys(),
      ENABLE_REAL_BLUESKY: this.checkBlueskyKeys(),
      
      // AI Service Features
      ENABLE_REAL_OPENAI: !!process.env.OPENAI_API_KEY,
      ENABLE_REAL_PERSPECTIVE: !!process.env.PERSPECTIVE_API_KEY,
      
      // Database Features
      ENABLE_SUPABASE: this.checkSupabaseKeys(),
      
      // Development Features
      ENABLE_DEBUG_LOGS: process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development',
      VERBOSE_LOGS: process.env.VERBOSE_LOGS === 'true',
      MOCK_MODE: mockMode.isMockMode,
      ENABLE_MOCK_PERSISTENCE: process.env.ENABLE_MOCK_PERSISTENCE === 'true' || mockMode.isMockMode,
      
      // Style Profile Feature
      ENABLE_STYLE_PROFILE: process.env.ENABLE_STYLE_PROFILE !== 'false' // Default enabled unless explicitly disabled
    };
  }

  checkBillingAvailable() {
    const required = [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_SUCCESS_URL',
      'STRIPE_CANCEL_URL',
      'STRIPE_PORTAL_RETURN_URL'
    ];
    
    // In mock mode, enable billing if mock Stripe keys are available
    if (mockMode.isMockMode) {
      return required.every(key => !!process.env[key]);
    }
    
    return required.every(key => !!process.env[key]);
  }

  checkTwitterKeys() {
    const required = ['TWITTER_BEARER_TOKEN', 'TWITTER_APP_KEY', 'TWITTER_APP_SECRET'];
    return required.every(key => !!process.env[key]);
  }

  checkYouTubeKeys() {
    return !!process.env.YOUTUBE_API_KEY;
  }

  checkInstagramKeys() {
    return !!process.env.INSTAGRAM_ACCESS_TOKEN;
  }

  checkFacebookKeys() {
    return !!process.env.FACEBOOK_ACCESS_TOKEN;
  }

  checkDiscordKeys() {
    return !!process.env.DISCORD_BOT_TOKEN;
  }

  checkTwitchKeys() {
    const required = ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET'];
    return required.every(key => !!process.env[key]);
  }

  checkRedditKeys() {
    const required = ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET'];
    return required.every(key => !!process.env[key]);
  }

  checkTikTokKeys() {
    return !!process.env.TIKTOK_ACCESS_TOKEN;
  }

  checkBlueskyKeys() {
    return !!process.env.BLUESKY_USERNAME && !!process.env.BLUESKY_PASSWORD;
  }

  checkSupabaseKeys() {
    // In mock mode, always return false to use mock Supabase
    if (mockMode.isMockMode) {
      return false;
    }
    const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
    return required.every(key => !!process.env[key] && !process.env[key].includes('mock'));
  }

  logFlagsStatus() {
    const enabledFlags = Object.entries(this.flags)
      .filter(([, enabled]) => enabled)
      .map(([flag]) => flag);
    
    const disabledFlags = Object.entries(this.flags)
      .filter(([, enabled]) => !enabled)
      .map(([flag]) => flag);

    try {
      const { logger } = require('../utils/logger');
      logger.info('🏁 Feature flags initialized', {
        enabled: enabledFlags,
        disabled: disabledFlags,
        totalFlags: Object.keys(this.flags).length
      });
    } catch (error) {
      // Fallback to console if logger not available (e.g., in tests)
      console.log('🏁 Feature flags initialized:', {
        enabled: enabledFlags.length,
        disabled: disabledFlags.length,
        total: Object.keys(this.flags).length
      });
    }
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(flagName) {
    return this.flags[flagName] || false;
  }

  /**
   * Get all flags status
   */
  getAllFlags() {
    return { ...this.flags };
  }

  /**
   * Get service availability status for graceful degradation
   */
  getServiceStatus() {
    return {
      billing: this.flags.ENABLE_BILLING ? 'available' : 'unavailable',
      ai: {
        openai: this.flags.ENABLE_REAL_OPENAI ? 'available' : 'mock',
        perspective: this.flags.ENABLE_REAL_PERSPECTIVE ? 'available' : 'mock'
      },
      database: this.flags.ENABLE_SUPABASE ? 'available' : 'mock',
      integrations: {
        twitter: this.flags.ENABLE_REAL_TWITTER ? 'available' : 'mock',
        youtube: this.flags.ENABLE_REAL_YOUTUBE ? 'available' : 'mock',
        instagram: this.flags.ENABLE_REAL_INSTAGRAM ? 'available' : 'mock',
        facebook: this.flags.ENABLE_REAL_FACEBOOK ? 'available' : 'mock',
        discord: this.flags.ENABLE_REAL_DISCORD ? 'available' : 'mock',
        twitch: this.flags.ENABLE_REAL_TWITCH ? 'available' : 'mock',
        reddit: this.flags.ENABLE_REAL_REDDIT ? 'available' : 'mock',
        tiktok: this.flags.ENABLE_REAL_TIKTOK ? 'available' : 'mock',
        bluesky: this.flags.ENABLE_REAL_BLUESKY ? 'available' : 'mock'
      },
      features: {
        rqc: this.flags.ENABLE_RQC ? 'enabled' : 'disabled',
        shield: this.flags.ENABLE_SHIELD ? 'enabled' : 'disabled',
        styleProfile: this.flags.ENABLE_STYLE_PROFILE ? 'enabled' : 'disabled'
      }
    };
  }

  /**
   * Reload flags (useful for runtime updates)
   */
  reload() {
    this.flags = this.loadFlags();
    this.logFlagsStatus();
  }
}

// Create singleton instance
const flags = new FeatureFlags();

module.exports = {
  flags,
  FeatureFlags
};