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
    const isProduction = process.env.NODE_ENV === 'production';
    
    return {
      // Core System Features
      ENABLE_BILLING: this.checkBillingAvailable(),
      ENABLE_RQC: this.parseDevelopmentFlag(process.env.ENABLE_RQC, isProduction), // Disabled by default - under development
      ENABLE_SHIELD: this.parseFlag(process.env.ENABLE_SHIELD),
      
      // Platform Integration Features
      ENABLE_REAL_TWITTER: this.checkTwitterKeys(),
      ENABLE_REAL_YOUTUBE: this.checkYouTubeKeys(),
      ENABLE_REAL_INSTAGRAM: this.parseFlag(process.env.ENABLE_REAL_INSTAGRAM) || this.checkInstagramKeys(),
      ENABLE_REAL_FACEBOOK: this.parseFlag(process.env.ENABLE_REAL_FACEBOOK) || this.checkFacebookKeys(),
      ENABLE_REAL_DISCORD: this.checkDiscordKeys(),
      ENABLE_REAL_TWITCH: this.checkTwitchKeys(),
      ENABLE_REAL_REDDIT: this.checkRedditKeys(),
      ENABLE_REAL_TIKTOK: this.checkTikTokKeys(),
      ENABLE_REAL_BLUESKY: this.checkBlueskyKeys(),
      
      // AI Service Features
      ENABLE_REAL_OPENAI: !!process.env.OPENAI_API_KEY,
      ENABLE_REAL_PERSPECTIVE: !!process.env.PERSPECTIVE_API_KEY,
      ENABLE_PERSPECTIVE_API: !!process.env.PERSPECTIVE_API_KEY, // Alias for compatibility
      
      // Email Features
      ENABLE_EMAIL_NOTIFICATIONS: !!process.env.SENDGRID_API_KEY,
      
      // Database Features
      ENABLE_SUPABASE: this.checkSupabaseKeys(),
      
      // Development Features
      ENABLE_DEBUG_LOGS: this.parseFlag(process.env.DEBUG), // Disabled by default, requires explicit environment variable
      VERBOSE_LOGS: this.parseFlag(process.env.VERBOSE_LOGS),
      MOCK_MODE: mockMode.isMockMode,
      
      // UI Feature Flags (Issue #366)  
      // Removed SHOP_ENABLED duplicate - standardized to ENABLE_SHOP below
      ENABLE_MOCK_PERSISTENCE: this.parseFlag(process.env.ENABLE_MOCK_PERSISTENCE) || mockMode.isMockMode,
      
      // Auth Features
      ENABLE_MAGIC_LINK: this.parseFlag(process.env.ENABLE_MAGIC_LINK, true), // Default enabled
      ENABLE_PASSWORD_HISTORY: this.parseFlag(process.env.ENABLE_PASSWORD_HISTORY, true), // Default enabled  
      ENABLE_RATE_LIMIT: this.parseFlag(process.env.ENABLE_RATE_LIMIT, true), // Default enabled
      ENABLE_CSRF_PROTECTION: this.parseFlag(process.env.ENABLE_CSRF_PROTECTION, true), // Default enabled - Issue #261
      ENABLE_RESPONSE_CACHE: this.parseFlag(process.env.ENABLE_RESPONSE_CACHE, true), // Default enabled - Issue #261
      DEBUG_CACHE: this.parseFlag(process.env.DEBUG_CACHE), // Default disabled
      
      // Style Profile Feature (basic style analysis)
      ENABLE_STYLE_PROFILE: this.parseFlag(process.env.ENABLE_STYLE_PROFILE, true), // Default enabled

      // Credits v2 Feature
      ENABLE_CREDITS_V2: this.parseFlag(process.env.ENABLE_CREDITS_V2),

      // Custom Style Prompt Feature (Issue #868: Feature Flag)
      // Permite Custom Style Prompt SOLO con flag + Plus plan
      // Default: FALSE - No aparece en UI ni onboarding
      ENABLE_CUSTOM_PROMPT: this.parseDevelopmentFlag(process.env.ENABLE_CUSTOM_PROMPT, isProduction), // Default disabled, requires explicit activation

      // UI Platform Features (separate from API integration)
      ENABLE_FACEBOOK_UI: this.parseDevelopmentFlag(process.env.ENABLE_FACEBOOK_UI, isProduction), // Default disabled - under development
      ENABLE_INSTAGRAM_UI: this.parseDevelopmentFlag(process.env.ENABLE_INSTAGRAM_UI, isProduction), // Default disabled - under development

      // Style Profile Extraction Feature (Issue #369 - SPEC 9)
      ENABLE_ORIGINAL_TONE: this.parseFlag(process.env.ENABLE_ORIGINAL_TONE, false), // Default disabled, Pro/Plus feature

      // Shop Feature (Issue #366 CodeRabbit fix - standardized naming with backward compatibility)
      ENABLE_SHOP: this.parseFlag(process.env.ENABLE_SHOP || process.env.SHOP_ENABLED), // Default disabled unless explicitly enabled, supports both naming conventions

      // Roast Engine Features (SPEC 7 - Issue #363)
      ROAST_VERSIONS_MULTIPLE: this.parseFlag(process.env.ROAST_VERSIONS_MULTIPLE, true), // Default: generate 2 versions, set to false for 1 version
      ENABLE_ROAST_ENGINE: this.parseFlag(process.env.ENABLE_ROAST_ENGINE, true), // Default: enabled, can be disabled for maintenance

      // Shield UI Features (Issue #365)
      ENABLE_SHIELD_UI: this.parseFlag(process.env.ENABLE_SHIELD_UI, false) // Default: disabled for safer rollout, allows Shield UI access for Pro+ plans when enabled
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
    // Check for OAuth 2.0 credentials (new) OR OAuth 1.0a credentials (legacy)
    const oauth2Required = ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET'];
    const oauth1Required = ['TWITTER_BEARER_TOKEN', 'TWITTER_APP_KEY', 'TWITTER_APP_SECRET'];
    
    const hasOAuth2 = oauth2Required.every(key => !!process.env[key]);
    const hasOAuth1 = oauth1Required.every(key => !!process.env[key]);
    
    return hasOAuth2 || hasOAuth1;
  }

  checkYouTubeKeys() {
    // Check for OAuth credentials OR API key
    const oauthRequired = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
    const hasOAuth = oauthRequired.every(key => !!process.env[key]) || 
                    ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'].every(key => !!process.env[key]);
    
    return hasOAuth || !!process.env.YOUTUBE_API_KEY;
  }

  checkInstagramKeys() {
    // Check for OAuth credentials OR access token
    const oauthRequired = ['INSTAGRAM_CLIENT_ID', 'INSTAGRAM_CLIENT_SECRET'];
    const hasOAuth = oauthRequired.every(key => !!process.env[key]);
    
    return hasOAuth || !!process.env.INSTAGRAM_ACCESS_TOKEN;
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
   * Parse environment variable to boolean with proper handling
   * @param {string} value - Environment variable value
   * @param {boolean} defaultValue - Default value if undefined
   * @returns {boolean}
   */
  parseFlag(value, defaultValue = false) {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    
    if (typeof value === 'boolean') {
      return value;
    }
    
    const stringValue = String(value).toLowerCase().trim();
    return stringValue === 'true' || stringValue === '1' || stringValue === 'yes';
  }

  /**
   * Parse development feature flag with production safety
   * Development features are automatically disabled in production environment
   * @param {string} value - Environment variable value
   * @param {boolean} isProduction - Whether we're in production environment
   * @returns {boolean}
   */
  parseDevelopmentFlag(value, isProduction = false) {
    // Always return false for development features in production
    if (isProduction) {
      return false;
    }
    
    // In non-production environments, use normal parsing
    return this.parseFlag(value, false);
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
        styleProfile: this.flags.ENABLE_STYLE_PROFILE ? 'enabled' : 'disabled',
        magicLink: this.flags.ENABLE_MAGIC_LINK ? 'enabled' : 'disabled',
        emailNotifications: this.flags.ENABLE_EMAIL_NOTIFICATIONS ? 'enabled' : 'disabled',
        customPrompt: this.flags.ENABLE_CUSTOM_PROMPT ? 'enabled' : 'disabled',
        shop: this.flags.ENABLE_SHOP ? 'enabled' : 'disabled',
        facebookUI: this.flags.ENABLE_FACEBOOK_UI ? 'enabled' : 'disabled',
        instagramUI: this.flags.ENABLE_INSTAGRAM_UI ? 'enabled' : 'disabled',
        originalTone: this.flags.ENABLE_ORIGINAL_TONE ? 'enabled' : 'disabled',
        roastVersionsMultiple: this.flags.ROAST_VERSIONS_MULTIPLE ? 'enabled' : 'disabled',
        roastEngine: this.flags.ENABLE_ROAST_ENGINE ? 'enabled' : 'disabled',
        shieldUI: this.flags.ENABLE_SHIELD_UI ? 'enabled' : 'disabled'
      }
    };
  }

  /**
   * Determine if OAuth should use mock mode
   * OAuth uses mock mode if:
   * - MOCK_MODE flag is enabled
   * - NODE_ENV is test (unless explicitly disabled)
   * - FORCE_MOCK_OAUTH environment variable is set to 'true'
   *
   * Issue #638: Respect explicit disable even in test mode
   */
  shouldUseMockOAuth() {
    // If explicitly disabled, respect that even in test mode
    if (process.env.ENABLE_MOCK_MODE === 'false') {
      return false;
    }

    return this.flags.MOCK_MODE ||
           process.env.NODE_ENV === 'test' ||
           this.parseFlag(process.env.FORCE_MOCK_OAUTH);
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