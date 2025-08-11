/**
 * OAuth routes for social media platform connections
 * Supports both real OAuth flows and mock mode for testing
 */

const express = require('express');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');
const { OAuthProviderFactory } = require('../services/oauthProvider');
const { flags } = require('../config/flags');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * Mock connection store for simulating persistent connections
 */
class MockConnectionStore {
  constructor() {
    this.connections = new Map();
  }

  /**
   * Store connection for user and platform
   * @param {string} userId - User ID
   * @param {string} platform - Platform name
   * @param {Object} tokenData - Token data
   */
  storeConnection(userId, platform, tokenData) {
    const key = `${userId}:${platform}`;
    this.connections.set(key, {
      ...tokenData,
      userId,
      platform,
      connectedAt: Date.now(),
      lastRefreshed: null,
      status: 'connected'
    });

    if (flags.isEnabled('DEBUG_OAUTH')) {
      console.log(`Stored connection for ${userId}:${platform}`);
    }
  }

  /**
   * Get connection for user and platform
   * @param {string} userId - User ID
   * @param {string} platform - Platform name
   * @returns {Object|null} Connection data
   */
  getConnection(userId, platform) {
    const key = `${userId}:${platform}`;
    return this.connections.get(key) || null;
  }

  /**
   * Get all connections for user
   * @param {string} userId - User ID
   * @returns {Array<Object>} User connections
   */
  getUserConnections(userId) {
    const userConnections = [];
    for (const [key, connection] of this.connections) {
      if (connection.userId === userId) {
        userConnections.push(connection);
      }
    }
    return userConnections;
  }

  /**
   * Update connection
   * @param {string} userId - User ID
   * @param {string} platform - Platform name
   * @param {Object} updates - Updates to apply
   */
  updateConnection(userId, platform, updates) {
    const key = `${userId}:${platform}`;
    const existing = this.connections.get(key);
    if (existing) {
      this.connections.set(key, { ...existing, ...updates });
    }
  }

  /**
   * Remove connection
   * @param {string} userId - User ID
   * @param {string} platform - Platform name
   * @returns {boolean} Success status
   */
  removeConnection(userId, platform) {
    const key = `${userId}:${platform}`;
    return this.connections.delete(key);
  }

  /**
   * Check if connection exists and is valid
   * @param {string} userId - User ID
   * @param {string} platform - Platform name
   * @returns {boolean} Connection validity
   */
  isConnected(userId, platform) {
    const connection = this.getConnection(userId, platform);
    if (!connection) return false;

    // Check if token is expired
    if (connection.expires_at && Date.now() > connection.expires_at) {
      this.updateConnection(userId, platform, { status: 'expired' });
      return false;
    }

    return connection.status === 'connected';
  }
}

// Global mock store (in production, this would be Redis or database)
const mockStore = new MockConnectionStore();

/**
 * Sanitize and validate platform parameter
 * @param {string} platform - Platform name
 * @returns {string} Sanitized platform name
 * @throws {Error} If platform is invalid
 */
function sanitizePlatform(platform) {
  if (!platform || typeof platform !== 'string') {
    throw new Error('Platform parameter is required');
  }

  const sanitized = platform.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  
  if (!OAuthProviderFactory.isSupported(sanitized)) {
    throw new Error(`Unsupported platform: ${sanitized}`);
  }

  return sanitized;
}

/**
 * Generate secure state parameter
 * @param {string} userId - User ID
 * @param {string} platform - Platform name
 * @returns {string} State parameter
 */
function generateState(userId, platform) {
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(16).toString('hex');
  const payload = `${userId}:${platform}:${timestamp}:${random}`;
  return Buffer.from(payload).toString('base64url');
}

/**
 * Parse and validate state parameter
 * @param {string} state - State parameter
 * @returns {Object} Parsed state data
 * @throws {Error} If state is invalid
 */
function parseState(state) {
  try {
    const payload = Buffer.from(state, 'base64url').toString();
    const [userId, platform, timestamp, random] = payload.split(':');
    
    if (!userId || !platform || !timestamp || !random) {
      throw new Error('Invalid state format');
    }

    const age = Date.now() - parseInt(timestamp);
    const maxAge = 10 * 60 * 1000; // 10 minutes

    if (age > maxAge) {
      throw new Error('State parameter expired');
    }

    return { userId, platform, timestamp: parseInt(timestamp), random };
  } catch (error) {
    throw new Error('Invalid state parameter: ' + error.message);
  }
}

/**
 * POST /api/integrations/:platform/connect
 * Initiate OAuth connection for platform
 */
router.post('/:platform/connect', authenticateToken, async (req, res) => {
  try {
    const platform = sanitizePlatform(req.params.platform);
    const userId = req.user.id;

    // Check if already connected
    if (mockStore.isConnected(userId, platform)) {
      return res.json({
        success: true,
        data: {
          status: 'already_connected',
          message: `Already connected to ${platform}`,
          connection: mockStore.getConnection(userId, platform)
        }
      });
    }

    // Generate OAuth provider
    const provider = OAuthProviderFactory.getProvider(platform);
    const state = generateState(userId, platform);
    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/${platform}/callback`;

    // Get authorization URL
    const authUrl = await provider.getAuthorizationUrl(state, redirectUri);

    if (flags.isEnabled('DEBUG_OAUTH')) {
      console.log(`OAuth connect initiated for ${userId}:${platform}`, {
        authUrl, state, redirectUri
      });
    }

    res.json({
      success: true,
      data: {
        authUrl,
        state,
        platform,
        requirements: provider.getConnectionRequirements(),
        redirectUri,
        mock: flags.shouldUseMockOAuth()
      }
    });

  } catch (error) {
    if (flags.isEnabled('DEBUG_OAUTH')) {
      console.error('OAuth connect error:', error);
    }

    res.status(400).json({
      success: false,
      error: error.message,
      code: 'OAUTH_CONNECT_ERROR'
    });
  }
});

/**
 * GET /api/auth/:platform/callback
 * Handle OAuth callback from platform
 */
router.get('/:platform/callback', async (req, res) => {
  try {
    const platform = sanitizePlatform(req.params.platform);
    const { code, state, error, error_description } = req.query;

    // Handle OAuth errors
    if (error) {
      const errorMsg = error_description || error;
      if (flags.isEnabled('DEBUG_OAUTH')) {
        console.error(`OAuth callback error for ${platform}:`, errorMsg);
      }

      return res.redirect(`/connections?error=${encodeURIComponent(errorMsg)}&platform=${platform}`);
    }

    // Validate required parameters
    if (!code || !state) {
      return res.redirect(`/connections?error=Missing+authorization+code+or+state&platform=${platform}`);
    }

    // Parse and validate state
    const stateData = parseState(state);
    if (stateData.platform !== platform) {
      return res.redirect(`/connections?error=Platform+mismatch&platform=${platform}`);
    }

    // Get OAuth provider and exchange code for tokens
    const provider = OAuthProviderFactory.getProvider(platform);
    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/${platform}/callback`;
    
    const tokenData = await provider.exchangeCodeForTokens(code, state, redirectUri);

    // Store connection
    mockStore.storeConnection(stateData.userId, platform, tokenData);

    if (flags.isEnabled('DEBUG_OAUTH')) {
      console.log(`OAuth callback success for ${stateData.userId}:${platform}`);
    }

    // Redirect to success page
    const successUrl = `/connections?success=true&platform=${platform}&connected=true`;
    res.redirect(successUrl);

  } catch (error) {
    if (flags.isEnabled('DEBUG_OAUTH')) {
      console.error('OAuth callback processing error:', error);
    }

    const errorMsg = encodeURIComponent(error.message);
    res.redirect(`/connections?error=${errorMsg}&platform=${req.params.platform}`);
  }
});

/**
 * POST /api/integrations/:platform/refresh
 * Refresh OAuth tokens for platform
 */
router.post('/:platform/refresh', authenticateToken, async (req, res) => {
  try {
    const platform = sanitizePlatform(req.params.platform);
    const userId = req.user.id;

    const connection = mockStore.getConnection(userId, platform);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: `No connection found for ${platform}`,
        code: 'CONNECTION_NOT_FOUND'
      });
    }

    const provider = OAuthProviderFactory.getProvider(platform);
    const newTokenData = await provider.refreshAccessToken(connection.refresh_token);

    // Update stored connection
    mockStore.updateConnection(userId, platform, {
      ...newTokenData,
      lastRefreshed: Date.now(),
      status: 'connected'
    });

    if (flags.isEnabled('DEBUG_OAUTH')) {
      console.log(`OAuth tokens refreshed for ${userId}:${platform}`);
    }

    res.json({
      success: true,
      data: {
        message: `Tokens refreshed successfully for ${platform}`,
        platform,
        expires_at: newTokenData.expires_at,
        refreshed: true
      }
    });

  } catch (error) {
    if (flags.isEnabled('DEBUG_OAUTH')) {
      console.error('OAuth refresh error:', error);
    }

    // Update connection status to error
    const userId = req.user.id;
    const platform = req.params.platform;
    mockStore.updateConnection(userId, platform, { status: 'error', lastError: error.message });

    res.status(400).json({
      success: false,
      error: error.message,
      code: 'OAUTH_REFRESH_ERROR'
    });
  }
});

/**
 * POST /api/integrations/:platform/disconnect
 * Disconnect OAuth connection for platform
 */
router.post('/:platform/disconnect', authenticateToken, async (req, res) => {
  try {
    const platform = sanitizePlatform(req.params.platform);
    const userId = req.user.id;

    const connection = mockStore.getConnection(userId, platform);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: `No connection found for ${platform}`,
        code: 'CONNECTION_NOT_FOUND'
      });
    }

    // Revoke tokens with provider
    const provider = OAuthProviderFactory.getProvider(platform);
    await provider.revokeTokens(connection.access_token);

    // Remove from store
    mockStore.removeConnection(userId, platform);

    if (flags.isEnabled('DEBUG_OAUTH')) {
      console.log(`OAuth connection disconnected for ${userId}:${platform}`);
    }

    res.json({
      success: true,
      data: {
        message: `Successfully disconnected from ${platform}`,
        platform,
        disconnected: true
      }
    });

  } catch (error) {
    if (flags.isEnabled('DEBUG_OAUTH')) {
      console.error('OAuth disconnect error:', error);
    }

    res.status(400).json({
      success: false,
      error: error.message,
      code: 'OAUTH_DISCONNECT_ERROR'
    });
  }
});

/**
 * GET /api/integrations/connections
 * Get all OAuth connections for user
 */
router.get('/connections', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const connections = mockStore.getUserConnections(userId);

    // Add platform status information
    const platformStatuses = OAuthProviderFactory.getSupportedPlatforms().map(platform => {
      const connection = connections.find(conn => conn.platform === platform);
      const isConnected = mockStore.isConnected(userId, platform);
      
      return {
        platform,
        connected: isConnected,
        status: connection ? connection.status : 'disconnected',
        connectedAt: connection ? connection.connectedAt : null,
        lastRefreshed: connection ? connection.lastRefreshed : null,
        expires_at: connection ? connection.expires_at : null,
        user_info: connection ? connection.user_info : null,
        requirements: OAuthProviderFactory.getProvider(platform).getConnectionRequirements()
      };
    });

    res.json({
      success: true,
      data: {
        connections: platformStatuses,
        totalConnected: connections.filter(conn => conn.status === 'connected').length,
        totalPlatforms: OAuthProviderFactory.getSupportedPlatforms().length,
        mockMode: flags.shouldUseMockOAuth()
      }
    });

  } catch (error) {
    if (flags.isEnabled('DEBUG_OAUTH')) {
      console.error('Get connections error:', error);
    }

    res.status(500).json({
      success: false,
      error: error.message,
      code: 'GET_CONNECTIONS_ERROR'
    });
  }
});

/**
 * GET /api/integrations/platforms
 * Get available OAuth platforms and their configuration
 */
router.get('/platforms', async (req, res) => {
  try {
    const platforms = OAuthProviderFactory.getSupportedPlatforms().map(platform => {
      const provider = OAuthProviderFactory.getProvider(platform);
      const flagKey = `ENABLE_${platform.toUpperCase()}_OAUTH`;
      
      return {
        platform,
        name: platform.charAt(0).toUpperCase() + platform.slice(1),
        enabled: flags.isEnabled(flagKey) || flags.shouldUseMockOAuth(),
        mockMode: flags.shouldUseMockOAuth(),
        requirements: provider.getConnectionRequirements(),
        scopes: provider.getDefaultScopes()
      };
    });

    res.json({
      success: true,
      data: {
        platforms,
        mockMode: flags.shouldUseMockOAuth(),
        totalPlatforms: platforms.length,
        enabledPlatforms: platforms.filter(p => p.enabled).length
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'GET_PLATFORMS_ERROR'
    });
  }
});

/**
 * POST /api/integrations/mock/reset
 * Reset all mock connections (testing only)
 */
router.post('/mock/reset', authenticateToken, async (req, res) => {
  if (!flags.isEnabled('ENABLE_MOCK_MODE') && process.env.NODE_ENV !== 'test') {
    return res.status(403).json({
      success: false,
      error: 'Mock reset only available in mock mode'
    });
  }

  try {
    const userId = req.user.id;
    const { platform } = req.body;

    if (platform) {
      // Reset specific platform
      const sanitizedPlatform = sanitizePlatform(platform);
      mockStore.removeConnection(userId, sanitizedPlatform);
      
      res.json({
        success: true,
        data: {
          message: `Reset connection for ${sanitizedPlatform}`,
          platform: sanitizedPlatform
        }
      });
    } else {
      // Reset all connections for user
      const connections = mockStore.getUserConnections(userId);
      connections.forEach(conn => {
        mockStore.removeConnection(userId, conn.platform);
      });

      res.json({
        success: true,
        data: {
          message: 'Reset all connections',
          resetCount: connections.length
        }
      });
    }

    if (flags.isEnabled('DEBUG_OAUTH')) {
      console.log(`Mock connections reset for ${userId}`, { platform });
    }

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'MOCK_RESET_ERROR'
    });
  }
});

module.exports = router;