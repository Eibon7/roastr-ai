/**
 * Twitter OAuth 2.0 Provider with PKCE
 * Implements real OAuth flow for Twitter API v2
 */

const crypto = require('crypto');
const fetch = require('node-fetch');
const { OAuthProvider } = require('../oauthProvider');
const { logger } = require('../../utils/logger');
const { RetrySystem } = require('../../utils/retrySystem');

class TwitterOAuthProvider extends OAuthProvider {
  constructor(config = {}) {
    super('twitter', config);

    // Twitter OAuth 2.0 endpoints
    this.authorizationUrl = 'https://twitter.com/i/oauth2/authorize';
    this.tokenUrl = 'https://api.twitter.com/2/oauth2/token';
    this.revokeUrl = 'https://api.twitter.com/2/oauth2/revoke';
    this.userInfoUrl = 'https://api.twitter.com/2/users/me';

    // Twitter OAuth config
    this.clientId = config.clientId || process.env.TWITTER_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.TWITTER_CLIENT_SECRET;

    if (!this.clientId || !this.clientSecret) {
      logger.warn('Twitter OAuth credentials not found. Real OAuth will not work.');
    }

    // PKCE storage for state management
    this.pkceStore = new Map();

    // Retry systems for different operations
    this.oauthRetry = RetrySystem.forOAuth();
    this.apiRetry = RetrySystem.forAPICall();
  }

  /**
   * Generate PKCE challenge and verifier
   * @returns {Object} PKCE challenge data
   */
  generatePKCEChallenge() {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256'
    };
  }

  /**
   * Generate real Twitter OAuth authorization URL
   * @param {string} state - State parameter for CSRF protection
   * @param {string} redirectUri - Callback URI
   * @returns {Promise<string>} Authorization URL
   */
  async getRealAuthUrl(state, redirectUri) {
    try {
      if (!this.clientId || !this.clientSecret) {
        throw new Error('Twitter OAuth credentials not configured');
      }

      // Generate PKCE challenge
      const pkceData = this.generatePKCEChallenge();

      // Store PKCE data for later use
      this.pkceStore.set(state, {
        ...pkceData,
        redirectUri,
        createdAt: Date.now(),
        expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
      });

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: this.clientId,
        redirect_uri: redirectUri,
        scope: this.getDefaultScopes().join(' '),
        state,
        code_challenge: pkceData.codeChallenge,
        code_challenge_method: pkceData.codeChallengeMethod
      });

      const authUrl = `${this.authorizationUrl}?${params}`;

      logger.info('Generated Twitter OAuth URL', {
        clientId: this.clientId,
        scopes: this.getDefaultScopes(),
        redirectUri,
        state: state.substring(0, 8) + '...' // Log partial state for debugging
      });

      return authUrl;
    } catch (error) {
      logger.error('Error generating Twitter auth URL:', error);
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
        throw new Error('Twitter OAuth credentials not configured');
      }

      // Retrieve PKCE data
      const pkceData = this.pkceStore.get(state);
      if (!pkceData) {
        throw new Error('Invalid or expired state parameter');
      }

      if (Date.now() > pkceData.expiresAt) {
        this.pkceStore.delete(state);
        throw new Error('State parameter expired');
      }

      if (pkceData.redirectUri !== redirectUri) {
        throw new Error('Redirect URI mismatch');
      }

      // Prepare token exchange request
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: pkceData.codeVerifier,
        client_id: this.clientId
      });

      const response = await this.oauthRetry.execute(
        async () => {
          return await fetch(this.tokenUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
            },
            body: tokenParams
          });
        },
        { operation: 'token_exchange', platform: 'twitter' }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Twitter token exchange failed:', {
          status: response.status,
          error: errorText
        });
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
      }

      const tokenData = await response.json();

      // Clean up PKCE data
      this.pkceStore.delete(state);

      // Get user info
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

      logger.info('Twitter token exchange successful', {
        userId: userInfo.id,
        username: userInfo.username,
        expiresIn: tokenData.expires_in
      });

      return result;
    } catch (error) {
      logger.error('Error in Twitter token exchange:', error);
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
        throw new Error('Twitter OAuth credentials not configured');
      }

      const refreshParams = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId
      });

      const response = await this.oauthRetry.execute(
        async () => {
          return await fetch(this.tokenUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
            },
            body: refreshParams
          });
        },
        { operation: 'token_refresh', platform: 'twitter' }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Twitter token refresh failed:', {
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
        refresh_token: tokenData.refresh_token || refreshToken, // Twitter might not return new refresh token
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        expires_at: Date.now() + tokenData.expires_in * 1000,
        scope: tokenData.scope,
        platform: this.platform,
        mock: false,
        refreshed: true,
        user_info: userInfo
      };

      logger.info('Twitter token refresh successful', {
        userId: userInfo.id,
        expiresIn: tokenData.expires_in
      });

      return result;
    } catch (error) {
      logger.error('Error refreshing Twitter token:', error);
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
      if (!this.clientId || !this.clientSecret) {
        throw new Error('Twitter OAuth credentials not configured');
      }

      const revokeParams = new URLSearchParams({
        token: accessToken,
        client_id: this.clientId
      });

      const response = await fetch(this.revokeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
        },
        body: revokeParams
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn('Twitter token revocation failed:', {
          status: response.status,
          error: errorText
        });
        // Don't throw error for revocation failures, as token might already be expired
        return false;
      }

      logger.info('Twitter tokens revoked successfully');
      return true;
    } catch (error) {
      logger.error('Error revoking Twitter tokens:', error);
      // Don't throw error for revocation failures
      return false;
    }
  }

  /**
   * Fetch user information from Twitter API
   * @param {string} accessToken - Access token
   * @returns {Promise<Object>} User information
   */
  async fetchUserInfo(accessToken) {
    try {
      const response = await this.apiRetry.execute(
        async () => {
          return await fetch(
            `${this.userInfoUrl}?user.fields=id,username,name,profile_image_url,verified,public_metrics`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            }
          );
        },
        { operation: 'fetch_user_info', platform: 'twitter' }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch user info: ${response.status} ${errorText}`);
      }

      const userData = await response.json();

      if (!userData.data) {
        throw new Error('No user data returned from Twitter API');
      }

      const user = userData.data;

      return {
        id: user.id,
        username: user.username,
        name: user.name,
        profile_image_url: user.profile_image_url,
        verified: user.verified || false,
        public_metrics: user.public_metrics || {}
      };
    } catch (error) {
      logger.error('Error fetching Twitter user info:', error);
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
      logger.warn('Twitter token validation failed:', error.message);
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
   * Get Twitter-specific scopes
   */
  getDefaultScopes() {
    return ['tweet.read', 'tweet.write', 'users.read', 'offline.access'];
  }

  /**
   * Get Twitter connection requirements
   */
  getConnectionRequirements() {
    return {
      permissions: ['Read tweets', 'Write tweets', 'Access profile', 'Offline access'],
      notes:
        'Requires Twitter Developer account with OAuth 2.0 app configured. Ensure your app has read and write permissions.',
      estimatedTime: '2-3 minutes',
      documentation: 'https://developer.twitter.com/en/docs/authentication/oauth-2-0',
      clientIdRequired: true,
      clientSecretRequired: true,
      scopes: this.getDefaultScopes()
    };
  }
}

module.exports = TwitterOAuthProvider;
