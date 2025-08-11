/**
 * Feature flags configuration and management
 * Controls feature availability based on environment variables
 */

class FeatureFlags {
  constructor() {
    this.flags = new Map();
    this.reload();
  }

  /**
   * Reload all feature flags from environment variables
   */
  reload() {
    this.flags.clear();
    
    // Core authentication features
    this.flags.set('ENABLE_SESSION_REFRESH', this.parseFlag('ENABLE_SESSION_REFRESH', true));
    this.flags.set('ENABLE_RATE_LIMIT', this.parseFlag('ENABLE_RATE_LIMIT', true));
    this.flags.set('ENABLE_OAUTH_MOCK', this.parseFlag('ENABLE_OAUTH_MOCK', true));
    
    // Existing features
    this.flags.set('ENABLE_STYLE_PROFILE', this.parseFlag('ENABLE_STYLE_PROFILE', true));
    this.flags.set('ENABLE_RQC', this.parseFlag('ENABLE_RQC', false));
    this.flags.set('ENABLE_SHIELD', this.parseFlag('ENABLE_SHIELD', true));
    this.flags.set('ENABLE_MOCK_MODE', this.parseFlag('ENABLE_MOCK_MODE', false));
    
    // OAuth provider flags (individual control)
    this.flags.set('ENABLE_TWITTER_OAUTH', this.parseFlag('ENABLE_TWITTER_OAUTH', false));
    this.flags.set('ENABLE_INSTAGRAM_OAUTH', this.parseFlag('ENABLE_INSTAGRAM_OAUTH', false));
    this.flags.set('ENABLE_YOUTUBE_OAUTH', this.parseFlag('ENABLE_YOUTUBE_OAUTH', false));
    this.flags.set('ENABLE_TIKTOK_OAUTH', this.parseFlag('ENABLE_TIKTOK_OAUTH', false));
    this.flags.set('ENABLE_LINKEDIN_OAUTH', this.parseFlag('ENABLE_LINKEDIN_OAUTH', false));
    this.flags.set('ENABLE_FACEBOOK_OAUTH', this.parseFlag('ENABLE_FACEBOOK_OAUTH', false));
    this.flags.set('ENABLE_BLUESKY_OAUTH', this.parseFlag('ENABLE_BLUESKY_OAUTH', false));
    
    // Debug and development
    this.flags.set('DEBUG_OAUTH', this.parseFlag('DEBUG_OAUTH', false));
    this.flags.set('DEBUG_SESSION', this.parseFlag('DEBUG_SESSION', false));
    this.flags.set('DEBUG_RATE_LIMIT', this.parseFlag('DEBUG_RATE_LIMIT', false));
  }

  /**
   * Parse environment variable to boolean with default
   * @param {string} envVar - Environment variable name
   * @param {boolean} defaultValue - Default value if not set
   * @returns {boolean}
   */
  parseFlag(envVar, defaultValue = false) {
    const value = process.env[envVar];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
  }

  /**
   * Check if a feature is enabled
   * @param {string} flagName - Feature flag name
   * @returns {boolean}
   */
  isEnabled(flagName) {
    return this.flags.get(flagName) || false;
  }

  /**
   * Get all flags as object
   * @returns {Object}
   */
  getAllFlags() {
    const result = {};
    for (const [key, value] of this.flags) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Get flags for OAuth providers
   * @returns {Object}
   */
  getOAuthProviderFlags() {
    return {
      twitter: this.isEnabled('ENABLE_TWITTER_OAUTH'),
      instagram: this.isEnabled('ENABLE_INSTAGRAM_OAUTH'),
      youtube: this.isEnabled('ENABLE_YOUTUBE_OAUTH'),
      tiktok: this.isEnabled('ENABLE_TIKTOK_OAUTH'),
      linkedin: this.isEnabled('ENABLE_LINKEDIN_OAUTH'),
      facebook: this.isEnabled('ENABLE_FACEBOOK_OAUTH'),
      bluesky: this.isEnabled('ENABLE_BLUESKY_OAUTH')
    };
  }

  /**
   * Check if any OAuth provider is enabled for real connections
   * @returns {boolean}
   */
  hasRealOAuthEnabled() {
    const providers = this.getOAuthProviderFlags();
    return Object.values(providers).some(enabled => enabled);
  }

  /**
   * Check if mock mode should be used for OAuth
   * @returns {boolean}
   */
  shouldUseMockOAuth() {
    return this.isEnabled('ENABLE_OAUTH_MOCK') || !this.hasRealOAuthEnabled();
  }

  /**
   * Get environment-specific defaults
   * @returns {Object}
   */
  getEnvironmentDefaults() {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isCI = process.env.CI === 'true';
    const isTest = nodeEnv === 'test';
    
    return {
      nodeEnv,
      isCI,
      isTest,
      shouldUseMocks: isCI || isTest || nodeEnv === 'development',
      debugEnabled: nodeEnv === 'development' && !isCI
    };
  }
}

// Create singleton instance
const flags = new FeatureFlags();

module.exports = {
  flags,
  FeatureFlags
};