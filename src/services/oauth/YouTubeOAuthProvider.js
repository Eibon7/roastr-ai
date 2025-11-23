/**
 * YouTube (Google) OAuth 2.0 Provider
 * Implements real OAuth flow for YouTube Data API v3
 */

const fetch = require('node-fetch');
const { OAuthProvider } = require('../oauthProvider');
const { logger } = require('../../utils/logger');

class YouTubeOAuthProvider extends OAuthProvider {
  constructor(config = {}) {
    super('youtube', config);

    // Google OAuth 2.0 endpoints
    this.authorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    this.tokenUrl = 'https://oauth2.googleapis.com/token';
    this.revokeUrl = 'https://oauth2.googleapis.com/revoke';
    this.userInfoUrl = 'https://www.googleapis.com/youtube/v3/channels';

    // Google OAuth config
    this.clientId =
      config.clientId || process.env.GOOGLE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID;
    this.clientSecret =
      config.clientSecret || process.env.GOOGLE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET;

    if (!this.clientId || !this.clientSecret) {
      logger.warn('YouTube/Google OAuth credentials not found. Real OAuth will not work.');
    }
  }

  /**
   * Generate real YouTube OAuth authorization URL
   * @param {string} state - State parameter for CSRF protection
   * @param {string} redirectUri - Callback URI
   * @returns {Promise<string>} Authorization URL
   */
  async getRealAuthUrl(state, redirectUri) {
    try {
      if (!this.clientId || !this.clientSecret) {
        throw new Error('YouTube OAuth credentials not configured');
      }

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: this.clientId,
        redirect_uri: redirectUri,
        scope: this.getDefaultScopes().join(' '),
        state,
        access_type: 'offline',
        prompt: 'consent', // Force consent to ensure we get refresh token
        include_granted_scopes: 'true'
      });

      const authUrl = `${this.authorizationUrl}?${params}`;

      logger.info('Generated YouTube OAuth URL', {
        clientId: this.clientId,
        scopes: this.getDefaultScopes(),
        redirectUri,
        state: state.substring(0, 8) + '...'
      });

      return authUrl;
    } catch (error) {
      logger.error('Error generating YouTube auth URL:', error);
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
        throw new Error('YouTube OAuth credentials not configured');
      }

      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret
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
        logger.error('YouTube token exchange failed:', {
          status: response.status,
          error: errorText
        });
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
      }

      const tokenData = await response.json();

      // Get user channel info
      const userInfo = await this.fetchUserInfo(tokenData.access_token);

      const result = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        expires_at: Date.now() + tokenData.expires_in * 1000,
        scope: tokenData.scope,
        platform: this.platform,
        mock: false,
        user_info: userInfo
      };

      logger.info('YouTube token exchange successful', {
        channelId: userInfo.id,
        channelTitle: userInfo.snippet?.title,
        expiresIn: tokenData.expires_in
      });

      return result;
    } catch (error) {
      logger.error('Error in YouTube token exchange:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New token response
   */
  async refreshAccessToken(refreshToken) {
    try {
      if (!this.clientId || !this.clientSecret) {
        throw new Error('YouTube OAuth credentials not configured');
      }

      const refreshParams = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret
      });

      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: refreshParams
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('YouTube token refresh failed:', {
          status: response.status,
          error: errorText
        });
        throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
      }

      const tokenData = await response.json();

      // Get updated user info
      const userInfo = await this.fetchUserInfo(tokenData.access_token);

      const result = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || refreshToken, // Google might not return new refresh token
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        expires_at: Date.now() + tokenData.expires_in * 1000,
        scope: tokenData.scope,
        platform: this.platform,
        mock: false,
        refreshed: true,
        user_info: userInfo
      };

      logger.info('YouTube token refresh successful', {
        channelId: userInfo.id,
        expiresIn: tokenData.expires_in
      });

      return result;
    } catch (error) {
      logger.error('Error refreshing YouTube token:', error);
      throw error;
    }
  }

  /**
   * Revoke tokens
   * @param {string} accessToken - Access token to revoke
   * @returns {Promise<boolean>} Success status
   */
  async revokeTokens(accessToken) {
    try {
      const response = await fetch(`${this.revokeUrl}?token=${accessToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn('YouTube token revocation failed:', {
          status: response.status,
          error: errorText
        });
        return false;
      }

      logger.info('YouTube tokens revoked successfully');
      return true;
    } catch (error) {
      logger.error('Error revoking YouTube tokens:', error);
      return false;
    }
  }

  /**
   * Fetch user channel information from YouTube API
   * @param {string} accessToken - Access token
   * @returns {Promise<Object>} Channel information
   */
  async fetchUserInfo(accessToken) {
    try {
      const response = await fetch(
        `${this.userInfoUrl}?part=snippet,statistics,contentDetails&mine=true`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch channel info: ${response.status} ${errorText}`);
      }

      const channelData = await response.json();

      if (!channelData.items || channelData.items.length === 0) {
        throw new Error('No channel data returned from YouTube API');
      }

      const channel = channelData.items[0];

      return {
        id: channel.id,
        snippet: {
          title: channel.snippet.title,
          description: channel.snippet.description,
          thumbnails: channel.snippet.thumbnails
        },
        statistics: {
          viewCount: channel.statistics?.viewCount || '0',
          subscriberCount: channel.statistics?.subscriberCount || '0',
          videoCount: channel.statistics?.videoCount || '0'
        },
        contentDetails: channel.contentDetails
      };
    } catch (error) {
      logger.error('Error fetching YouTube channel info:', error);
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
      logger.warn('YouTube token validation failed:', error.message);
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
   * Get YouTube-specific scopes
   */
  getDefaultScopes() {
    return [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.force-ssl'
    ];
  }

  /**
   * Get YouTube connection requirements
   */
  getConnectionRequirements() {
    return {
      permissions: [
        'Read channel info',
        'Access video comments',
        'Upload videos',
        'Manage channel'
      ],
      notes:
        'Requires Google Cloud Console project with YouTube Data API enabled. OAuth consent screen must be configured.',
      estimatedTime: '3-5 minutes',
      documentation: 'https://developers.google.com/youtube/v3/guides/auth',
      clientIdRequired: true,
      clientSecretRequired: true,
      scopes: this.getDefaultScopes()
    };
  }
}

module.exports = YouTubeOAuthProvider;
