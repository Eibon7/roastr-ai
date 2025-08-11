/**
 * OAuth Provider abstraction for multi-platform authentication
 * Supports both real OAuth flows and mock mode for testing
 */

const crypto = require('crypto');
const { flags } = require('../config/flags');

/**
 * Base OAuth Provider class
 */
class OAuthProvider {
  constructor(platform, config = {}) {
    this.platform = platform;
    this.config = config;
    this.mockStore = new Map(); // For mock mode state storage
  }

  /**
   * Generate OAuth authorization URL
   * @param {string} state - State parameter for CSRF protection
   * @param {string} redirectUri - Callback URI
   * @returns {Promise<string>} Authorization URL
   */
  async getAuthorizationUrl(state, redirectUri) {
    if (flags.shouldUseMockOAuth()) {
      return this.getMockAuthUrl(state, redirectUri);
    }
    
    throw new Error(`Real OAuth not implemented for ${this.platform}`);
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code
   * @param {string} state - State parameter
   * @param {string} redirectUri - Callback URI
   * @returns {Promise<Object>} Token response
   */
  async exchangeCodeForTokens(code, state, redirectUri) {
    if (flags.shouldUseMockOAuth()) {
      return this.getMockTokens(code, state, redirectUri);
    }
    
    throw new Error(`Real OAuth not implemented for ${this.platform}`);
  }

  /**
   * Refresh access token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New token response
   */
  async refreshAccessToken(refreshToken) {
    if (flags.shouldUseMockOAuth()) {
      return this.getMockRefreshedTokens(refreshToken);
    }
    
    throw new Error(`Token refresh not implemented for ${this.platform}`);
  }

  /**
   * Revoke tokens
   * @param {string} accessToken - Access token to revoke
   * @returns {Promise<boolean>} Success status
   */
  async revokeTokens(accessToken) {
    if (flags.shouldUseMockOAuth()) {
      return this.mockRevokeTokens(accessToken);
    }
    
    throw new Error(`Token revocation not implemented for ${this.platform}`);
  }

  /**
   * Generate mock authorization URL
   * @param {string} state - State parameter
   * @param {string} redirectUri - Callback URI
   * @returns {string} Mock authorization URL
   */
  getMockAuthUrl(state, redirectUri) {
    // Store state for validation
    this.mockStore.set(state, {
      platform: this.platform,
      redirectUri,
      createdAt: Date.now(),
      expiresAt: Date.now() + (10 * 60 * 1000) // 10 minutes
    });

    const params = new URLSearchParams({
      client_id: `mock_${this.platform}_client`,
      response_type: 'code',
      redirect_uri: redirectUri,
      state,
      scope: this.getDefaultScopes().join(' ')
    });

    return `https://mock-oauth.roastr.ai/${this.platform}/authorize?${params}`;
  }

  /**
   * Generate mock tokens
   * @param {string} code - Authorization code
   * @param {string} state - State parameter
   * @param {string} redirectUri - Callback URI
   * @returns {Object} Mock token response
   */
  getMockTokens(code, state, redirectUri) {
    // Validate state
    const stateData = this.mockStore.get(state);
    if (!stateData) {
      throw new Error('Invalid or expired state parameter');
    }

    if (Date.now() > stateData.expiresAt) {
      this.mockStore.delete(state);
      throw new Error('State parameter expired');
    }

    if (stateData.redirectUri !== redirectUri) {
      throw new Error('Redirect URI mismatch');
    }

    // Clean up state
    this.mockStore.delete(state);

    // Generate mock tokens
    const accessToken = `mock_${this.platform}_access_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    const refreshToken = `mock_${this.platform}_refresh_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour
    
    const tokenData = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 3600,
      expires_at: expiresAt,
      scope: this.getDefaultScopes().join(' '),
      platform: this.platform,
      mock: true,
      user_info: this.getMockUserInfo()
    };

    // Store token data for refresh
    this.mockStore.set(accessToken, tokenData);
    this.mockStore.set(refreshToken, { accessToken, platform: this.platform });

    return tokenData;
  }

  /**
   * Generate mock refreshed tokens
   * @param {string} refreshToken - Refresh token
   * @returns {Object} New mock token response
   */
  getMockRefreshedTokens(refreshToken) {
    const refreshData = this.mockStore.get(refreshToken);
    if (!refreshData) {
      throw new Error('Invalid or expired refresh token');
    }

    // Remove old tokens
    this.mockStore.delete(refreshData.accessToken);
    this.mockStore.delete(refreshToken);

    // Generate new tokens
    const newAccessToken = `mock_${this.platform}_access_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    const newRefreshToken = `mock_${this.platform}_refresh_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour

    const tokenData = {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      token_type: 'Bearer',
      expires_in: 3600,
      expires_at: expiresAt,
      scope: this.getDefaultScopes().join(' '),
      platform: this.platform,
      mock: true,
      refreshed: true,
      user_info: this.getMockUserInfo()
    };

    // Store new token data
    this.mockStore.set(newAccessToken, tokenData);
    this.mockStore.set(newRefreshToken, { accessToken: newAccessToken, platform: this.platform });

    return tokenData;
  }

  /**
   * Mock token revocation
   * @param {string} accessToken - Access token to revoke
   * @returns {boolean} Success status
   */
  mockRevokeTokens(accessToken) {
    const tokenData = this.mockStore.get(accessToken);
    if (!tokenData) {
      return false;
    }

    // Remove both access and refresh tokens
    this.mockStore.delete(accessToken);
    if (tokenData.refresh_token) {
      this.mockStore.delete(tokenData.refresh_token);
    }

    return true;
  }

  /**
   * Get default OAuth scopes for this platform
   * @returns {Array<string>} Default scopes
   */
  getDefaultScopes() {
    const scopeMap = {
      twitter: ['read', 'write', 'offline.access'],
      instagram: ['instagram_basic', 'instagram_content_publish'],
      youtube: ['https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/youtube.upload'],
      tiktok: ['user.info.basic', 'video.list'],
      linkedin: ['r_liteprofile', 'r_emailaddress', 'w_member_social'],
      facebook: ['public_profile', 'email', 'pages_manage_posts'],
      bluesky: ['read', 'write']
    };

    return scopeMap[this.platform] || ['read'];
  }

  /**
   * Get mock user information for this platform
   * @returns {Object} Mock user data
   */
  getMockUserInfo() {
    const mockUsers = {
      twitter: {
        id: `mock_twitter_user_${Date.now()}`,
        username: 'mock_twitter_user',
        name: 'Mock Twitter User',
        profile_image_url: 'https://via.placeholder.com/400x400',
        verified: false,
        public_metrics: {
          followers_count: 1234,
          following_count: 567,
          tweet_count: 890
        }
      },
      instagram: {
        id: `mock_instagram_user_${Date.now()}`,
        username: 'mock_instagram_user',
        account_type: 'PERSONAL',
        media_count: 456
      },
      youtube: {
        id: `mock_youtube_user_${Date.now()}`,
        snippet: {
          title: 'Mock YouTube Channel',
          description: 'A mock YouTube channel for testing',
          thumbnails: {
            default: { url: 'https://via.placeholder.com/88x88' }
          }
        },
        statistics: {
          viewCount: '12345',
          subscriberCount: '678',
          videoCount: '90'
        }
      },
      tiktok: {
        open_id: `mock_tiktok_user_${Date.now()}`,
        union_id: `mock_tiktok_union_${Date.now()}`,
        display_name: 'Mock TikTok User',
        avatar_url: 'https://via.placeholder.com/400x400'
      },
      linkedin: {
        id: `mock_linkedin_user_${Date.now()}`,
        localizedFirstName: 'Mock',
        localizedLastName: 'LinkedIn User',
        profilePicture: {
          'displayImage~': {
            elements: [{ identifiers: [{ identifier: 'https://via.placeholder.com/400x400' }] }]
          }
        }
      },
      facebook: {
        id: `mock_facebook_user_${Date.now()}`,
        name: 'Mock Facebook User',
        email: 'mock@facebook.example.com',
        picture: {
          data: { url: 'https://via.placeholder.com/400x400' }
        }
      },
      bluesky: {
        did: `did:mock:bluesky:${Date.now()}`,
        handle: 'mock.bluesky.social',
        displayName: 'Mock Bluesky User',
        avatar: 'https://via.placeholder.com/400x400'
      }
    };

    return mockUsers[this.platform] || { id: `mock_${this.platform}_user_${Date.now()}`, name: `Mock ${this.platform} User` };
  }

  /**
   * Validate token and get user info
   * @param {string} accessToken - Access token
   * @returns {Promise<Object>} User information
   */
  async getUserInfo(accessToken) {
    if (flags.shouldUseMockOAuth()) {
      const tokenData = this.mockStore.get(accessToken);
      if (!tokenData) {
        throw new Error('Invalid access token');
      }

      if (Date.now() > tokenData.expires_at) {
        this.mockStore.delete(accessToken);
        throw new Error('Access token expired');
      }

      return tokenData.user_info;
    }

    throw new Error(`User info retrieval not implemented for ${this.platform}`);
  }

  /**
   * Check if token is valid and not expired
   * @param {string} accessToken - Access token
   * @returns {boolean} Token validity
   */
  isTokenValid(accessToken) {
    if (flags.shouldUseMockOAuth()) {
      const tokenData = this.mockStore.get(accessToken);
      return tokenData && Date.now() < tokenData.expires_at;
    }

    return false;
  }

  /**
   * Get platform-specific connection requirements
   * @returns {Object} Connection requirements and instructions
   */
  getConnectionRequirements() {
    const requirements = {
      twitter: {
        permissions: ['Read tweets', 'Write tweets', 'Access profile'],
        notes: 'Requires Twitter Developer account approval',
        estimatedTime: '5-10 minutes'
      },
      instagram: {
        permissions: ['Access basic profile', 'Read media'],
        notes: 'Personal accounts only, business accounts require Facebook approval',
        estimatedTime: '2-3 minutes'
      },
      youtube: {
        permissions: ['Read channel info', 'Access video comments'],
        notes: 'Google account required',
        estimatedTime: '2-3 minutes'
      },
      tiktok: {
        permissions: ['Read profile info', 'Access video data'],
        notes: 'Business account required for API access',
        estimatedTime: '10-15 minutes'
      },
      linkedin: {
        permissions: ['Read profile', 'Share content'],
        notes: 'LinkedIn application approval required',
        estimatedTime: '5-10 minutes'
      },
      facebook: {
        permissions: ['Read profile', 'Manage pages', 'Publish content'],
        notes: 'Facebook app review required for production',
        estimatedTime: '3-5 minutes'
      },
      bluesky: {
        permissions: ['Read posts', 'Write posts', 'Access profile'],
        notes: 'Bluesky account required',
        estimatedTime: '1-2 minutes'
      }
    };

    return requirements[this.platform] || {
      permissions: ['Basic access'],
      notes: 'Platform-specific requirements apply',
      estimatedTime: '3-5 minutes'
    };
  }
}

/**
 * OAuth Provider Factory
 */
class OAuthProviderFactory {
  static providers = new Map();

  /**
   * Get OAuth provider instance for platform
   * @param {string} platform - Platform name
   * @param {Object} config - Platform-specific configuration
   * @returns {OAuthProvider} Provider instance
   */
  static getProvider(platform, config = {}) {
    const key = `${platform}_${JSON.stringify(config)}`;
    
    if (!this.providers.has(key)) {
      this.providers.set(key, new OAuthProvider(platform, config));
    }

    return this.providers.get(key);
  }

  /**
   * Get all supported platforms
   * @returns {Array<string>} Supported platforms
   */
  static getSupportedPlatforms() {
    return ['twitter', 'instagram', 'youtube', 'tiktok', 'linkedin', 'facebook', 'bluesky'];
  }

  /**
   * Check if platform is supported
   * @param {string} platform - Platform name
   * @returns {boolean} Support status
   */
  static isSupported(platform) {
    return this.getSupportedPlatforms().includes(platform);
  }

  /**
   * Clear provider cache (for testing)
   */
  static clearCache() {
    this.providers.clear();
  }
}

module.exports = {
  OAuthProvider,
  OAuthProviderFactory
};