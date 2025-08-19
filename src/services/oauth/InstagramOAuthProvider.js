/**
 * Instagram OAuth 2.0 Provider
 * Implements real OAuth flow for Instagram Basic Display API
 */

const fetch = require('node-fetch');
const { OAuthProvider } = require('../oauthProvider');
const { logger } = require('../../utils/logger');

class InstagramOAuthProvider extends OAuthProvider {
  constructor(config = {}) {
    super('instagram', config);
    
    // Instagram OAuth 2.0 endpoints
    this.authorizationUrl = 'https://api.instagram.com/oauth/authorize';
    this.tokenUrl = 'https://api.instagram.com/oauth/access_token';
    this.longLivedTokenUrl = 'https://graph.instagram.com/access_token';
    this.refreshTokenUrl = 'https://graph.instagram.com/refresh_access_token';
    this.userInfoUrl = 'https://graph.instagram.com/me';
    
    // Instagram OAuth config
    this.clientId = config.clientId || process.env.INSTAGRAM_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.INSTAGRAM_CLIENT_SECRET;
    
    if (!this.clientId || !this.clientSecret) {
      logger.warn('Instagram OAuth credentials not found. Real OAuth will not work.');
    }
  }

  /**
   * Generate real Instagram OAuth authorization URL
   * @param {string} state - State parameter for CSRF protection
   * @param {string} redirectUri - Callback URI
   * @returns {Promise<string>} Authorization URL
   */
  async getRealAuthUrl(state, redirectUri) {
    try {
      if (!this.clientId || !this.clientSecret) {
        throw new Error('Instagram OAuth credentials not configured');
      }

      const params = new URLSearchParams({
        client_id: this.clientId,
        redirect_uri: redirectUri,
        scope: this.getDefaultScopes().join(','),
        response_type: 'code',
        state
      });

      const authUrl = `${this.authorizationUrl}?${params}`;
      
      logger.info('Generated Instagram OAuth URL', { 
        clientId: this.clientId,
        scopes: this.getDefaultScopes(),
        redirectUri,
        state: state.substring(0, 8) + '...'
      });

      return authUrl;

    } catch (error) {
      logger.error('Error generating Instagram auth URL:', error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code
   * @param {string} state - State parameter
   * @param {string} redirectUri - Callback URI
   * @returns {Promise<Object>} Token response
   */
  async handleTokenExchange(code, state, redirectUri) {
    try {
      if (!this.clientId || !this.clientSecret) {
        throw new Error('Instagram OAuth credentials not configured');
      }

      // Step 1: Get short-lived access token
      const tokenParams = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code
      });

      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: tokenParams
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Instagram token exchange failed:', {
          status: response.status,
          error: errorText
        });
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
      }

      const shortTokenData = await response.json();

      // Step 2: Exchange short-lived token for long-lived token
      const longTokenResponse = await fetch(`${this.longLivedTokenUrl}?grant_type=ig_exchange_token&client_secret=${this.clientSecret}&access_token=${shortTokenData.access_token}`, {
        method: 'GET'
      });

      if (!longTokenResponse.ok) {
        const errorText = await longTokenResponse.text();
        logger.error('Instagram long-lived token exchange failed:', {
          status: longTokenResponse.status,
          error: errorText
        });
        // Fallback to short-lived token if long-lived exchange fails
        logger.warn('Using short-lived Instagram token as fallback');
      }

      let tokenData = shortTokenData;
      if (longTokenResponse.ok) {
        tokenData = await longTokenResponse.json();
      }

      // Get user info
      const userInfo = await this.fetchUserInfo(tokenData.access_token);

      const result = {
        access_token: tokenData.access_token,
        refresh_token: null, // Instagram uses long-lived tokens that can be refreshed
        token_type: 'Bearer',
        expires_in: tokenData.expires_in || 5184000, // 60 days default for long-lived tokens
        expires_at: Date.now() + ((tokenData.expires_in || 5184000) * 1000),
        scope: this.getDefaultScopes().join(','),
        platform: this.platform,
        mock: false,
        user_info: userInfo,
        token_type_info: tokenData.expires_in ? 'long_lived' : 'short_lived'
      };

      logger.info('Instagram token exchange successful', {
        userId: userInfo.id,
        username: userInfo.username,
        tokenType: result.token_type_info,
        expiresIn: tokenData.expires_in
      });

      return result;

    } catch (error) {
      logger.error('Error in Instagram token exchange:', error);
      throw error;
    }
  }

  /**
   * Refresh long-lived access token
   * @param {string} accessToken - Current access token (Instagram uses the access token itself to refresh)
   * @returns {Promise<Object>} New token response
   */
  async refreshAccessToken(accessToken) {
    try {
      if (!this.clientId || !this.clientSecret) {
        throw new Error('Instagram OAuth credentials not configured');
      }

      const refreshResponse = await fetch(`${this.refreshTokenUrl}?grant_type=ig_refresh_token&access_token=${accessToken}`, {
        method: 'GET'
      });

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        logger.error('Instagram token refresh failed:', {
          status: refreshResponse.status,
          error: errorText
        });
        throw new Error(`Token refresh failed: ${refreshResponse.status} ${errorText}`);
      }

      const tokenData = await refreshResponse.json();

      // Get updated user info
      const userInfo = await this.fetchUserInfo(tokenData.access_token);

      const result = {
        access_token: tokenData.access_token,
        refresh_token: null, // Instagram doesn't use traditional refresh tokens
        token_type: 'Bearer',
        expires_in: tokenData.expires_in || 5184000, // 60 days
        expires_at: Date.now() + ((tokenData.expires_in || 5184000) * 1000),
        scope: this.getDefaultScopes().join(','),
        platform: this.platform,
        mock: false,
        refreshed: true,
        user_info: userInfo
      };

      logger.info('Instagram token refresh successful', {
        userId: userInfo.id,
        expiresIn: tokenData.expires_in
      });

      return result;

    } catch (error) {
      logger.error('Error refreshing Instagram token:', error);
      throw error;
    }
  }

  /**
   * Revoke tokens (Instagram doesn't have a revoke endpoint, so we just return true)
   * @param {string} accessToken - Access token to revoke
   * @returns {Promise<boolean>} Success status
   */
  async revokeTokens(accessToken) {
    try {
      // Instagram doesn't have a token revocation endpoint
      // The token will naturally expire after its lifetime
      logger.info('Instagram token revocation requested - tokens will expire naturally');
      return true;

    } catch (error) {
      logger.error('Error in Instagram token revocation:', error);
      return false;
    }
  }

  /**
   * Fetch user information from Instagram API
   * @param {string} accessToken - Access token
   * @returns {Promise<Object>} User information
   */
  async fetchUserInfo(accessToken) {
    try {
      const response = await fetch(`${this.userInfoUrl}?fields=id,username,account_type,media_count&access_token=${accessToken}`, {
        method: 'GET'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch user info: ${response.status} ${errorText}`);
      }

      const userData = await response.json();
      
      return {
        id: userData.id,
        username: userData.username,
        account_type: userData.account_type,
        media_count: userData.media_count
      };

    } catch (error) {
      logger.error('Error fetching Instagram user info:', error);
      throw error;
    }
  }

  /**
   * Get user info (implements parent class method)
   * @param {string} accessToken - Access token
   * @returns {Promise<Object>} User information
   */
  async getUserInfo(accessToken) {
    return await this.fetchUserInfo(accessToken);
  }

  /**
   * Check if token is valid by making a test API call
   * @param {string} accessToken - Access token
   * @returns {Promise<boolean>} Token validity
   */
  async isTokenValid(accessToken) {
    try {
      await this.fetchUserInfo(accessToken);
      return true;
    } catch (error) {
      logger.warn('Instagram token validation failed:', error.message);
      return false;
    }
  }

  /**
   * Override parent method to use real or mock implementation
   */
  async getAuthorizationUrl(state, redirectUri) {
    const { flags } = require('../../config/flags');
    
    if (flags.shouldUseMockOAuth()) {
      return this.getMockAuthUrl(state, redirectUri);
    }
    
    return await this.getRealAuthUrl(state, redirectUri);
  }

  /**
   * Override parent method to use real or mock implementation
   */
  async exchangeCodeForTokens(code, state, redirectUri) {
    const { flags } = require('../../config/flags');
    
    if (flags.shouldUseMockOAuth()) {
      return this.getMockTokens(code, state, redirectUri);
    }
    
    return await this.handleTokenExchange(code, state, redirectUri);
  }

  /**
   * Override parent method for Instagram's unique refresh mechanism
   */
  async refreshAccessToken(accessToken) {
    const { flags } = require('../../config/flags');
    
    if (flags.shouldUseMockOAuth()) {
      return this.getMockRefreshedTokens(accessToken);
    }
    
    return await this.refreshAccessToken(accessToken);
  }

  /**
   * Get Instagram-specific scopes
   */
  getDefaultScopes() {
    return [
      'user_profile',
      'user_media'
    ];
  }

  /**
   * Get Instagram connection requirements
   */
  getConnectionRequirements() {
    return {
      permissions: ['Access basic profile', 'Read media'],
      notes: 'Personal accounts only. Business accounts require Facebook App Review. Long-lived tokens last 60 days and can be refreshed.',
      estimatedTime: '2-3 minutes',
      documentation: 'https://developers.facebook.com/docs/instagram-basic-display-api',
      clientIdRequired: true,
      clientSecretRequired: true,
      scopes: this.getDefaultScopes()
    };
  }
}

module.exports = InstagramOAuthProvider;