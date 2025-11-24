/**
 * OAuth Mock Integration Tests
 * Tests the complete OAuth flow in mock mode for all supported platforms
 */

const request = require('supertest');
const { app } = require('../../src/index');
const { flags } = require('../../src/config/flags');

describe('OAuth Mock Integration Tests', () => {
  let authToken;
  let mockUserId;

  beforeAll(async () => {
    // Ensure mock mode is enabled
    process.env.ENABLE_OAUTH_MOCK = 'true';
    process.env.ENABLE_MOCK_MODE = 'true';
    flags.reload();

    // Setup authenticated user
    authToken = 'mock-jwt-token-oauth';
    mockUserId = 'mock-oauth-user-id';
  });

  afterAll(() => {
    // Clean up environment
    delete process.env.ENABLE_OAUTH_MOCK;
    delete process.env.ENABLE_MOCK_MODE;
    flags.reload();
  });

  describe('Platform Support', () => {
    it('should return all supported platforms', async () => {
      const response = await request(app)
        .get('/api/auth/platforms')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const data = response.body.data;
      expect(data.platforms).toBeInstanceOf(Array);
      expect(data.platforms.length).toBeGreaterThan(0);

      // Check required platforms are present
      const platformNames = data.platforms.map((p) => p.platform);
      const requiredPlatforms = [
        'twitter',
        'instagram',
        'youtube',
        'tiktok',
        'linkedin',
        'facebook',
        'bluesky'
      ];

      requiredPlatforms.forEach((platform) => {
        expect(platformNames).toContain(platform);
      });

      expect(data.mockMode).toBe(true);
    });

    it('should have correct platform configurations', async () => {
      const response = await request(app)
        .get('/api/auth/platforms')
        .set('Authorization', `Bearer ${authToken}`);

      const platforms = response.body.data.platforms;

      platforms.forEach((platform) => {
        expect(platform).toHaveProperty('platform');
        expect(platform).toHaveProperty('name');
        expect(platform).toHaveProperty('enabled');
        expect(platform).toHaveProperty('mockMode');
        expect(platform).toHaveProperty('requirements');
        expect(platform).toHaveProperty('scopes');

        // Requirements structure
        expect(platform.requirements).toHaveProperty('permissions');
        expect(platform.requirements).toHaveProperty('notes');
        expect(platform.requirements).toHaveProperty('estimatedTime');
        expect(platform.requirements.permissions).toBeInstanceOf(Array);
      });
    });
  });

  describe('Connection Status', () => {
    it('should return empty connections initially', async () => {
      const response = await request(app)
        .get('/api/auth/connections')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const data = response.body.data;
      expect(data.connections).toBeInstanceOf(Array);
      expect(data.totalConnected).toBe(0);
      expect(data.mockMode).toBe(true);

      // All platforms should be disconnected initially
      data.connections.forEach((connection) => {
        expect(connection.connected).toBe(false);
        expect(connection.status).toBe('disconnected');
      });
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/auth/connections');

      expect(response.status).toBe(401);
    });
  });

  describe('OAuth Connect Flow', () => {
    const testPlatform = 'twitter';

    it('should initiate connection successfully', async () => {
      const response = await request(app)
        .post(`/api/auth/${testPlatform}/connect`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const data = response.body.data;
      expect(data.authUrl).toContain(testPlatform);
      expect(data.authUrl).toContain('mock-oauth.roastr.ai');
      expect(data.state).toBeDefined();
      expect(data.platform).toBe(testPlatform);
      expect(data.mock).toBe(true);
      expect(data.requirements).toBeDefined();
    });

    it('should reject unsupported platform', async () => {
      const response = await request(app)
        .post('/api/auth/unsupported/connect')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unsupported platform');
    });

    it('should require authentication for connect', async () => {
      const response = await request(app).post(`/api/auth/${testPlatform}/connect`);

      expect(response.status).toBe(401);
    });

    it('should sanitize platform parameter', async () => {
      const response = await request(app)
        .post('/api/auth/twitter<script>/connect')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Unsupported platform');
    });
  });

  describe('OAuth Callback Flow', () => {
    let state;
    let mockCode;

    beforeEach(async () => {
      // First initiate a connection to get valid state
      const connectResponse = await request(app)
        .post('/api/auth/twitter/connect')
        .set('Authorization', `Bearer ${authToken}`);

      state = connectResponse.body.data.state;
      mockCode = 'mock_auth_code_' + Date.now();
    });

    it('should handle successful callback', async () => {
      const response = await request(app).get(
        `/api/auth/twitter/callback?code=${mockCode}&state=${state}`
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('success=true');
      expect(response.headers.location).toContain('platform=twitter');
      expect(response.headers.location).toContain('connected=true');
    });

    it('should handle callback with error', async () => {
      const response = await request(app).get(
        '/api/auth/twitter/callback?error=access_denied&state=' + state
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('error=');
    });

    it('should reject callback without required parameters', async () => {
      const response = await request(app).get('/api/auth/twitter/callback');

      // After Issue #948: Zod validation returns 400 for missing params (not 302 redirect)
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.success).toBe(false);
    });

    it('should reject callback with invalid state', async () => {
      const response = await request(app).get(
        '/api/auth/twitter/callback?code=testcode&state=invalid_state'
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('error=');
    });

    it('should reject expired state', async () => {
      // Create an expired state (base64 encoded with old timestamp)
      const expiredPayload = `${mockUserId}:twitter:${Date.now() - 11 * 60 * 1000}:random`;
      const expiredState = Buffer.from(expiredPayload).toString('base64url');

      const response = await request(app).get(
        `/api/auth/twitter/callback?code=${mockCode}&state=${expiredState}`
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('error=');
    });
  });

  describe('Complete OAuth Flow', () => {
    const platforms = ['twitter', 'instagram', 'youtube', 'facebook', 'bluesky'];

    beforeAll(async () => {
      // Issue #638: Reset all connections to ensure clean state
      // Previous tests may have connected platforms
      await request(app)
        .post('/api/auth/mock/reset')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});
    });

    platforms.forEach((platform) => {
      describe(`${platform} OAuth flow`, () => {
        it('should complete full connect -> callback -> status cycle', async () => {
          // Step 1: Initiate connection
          const connectResponse = await request(app)
            .post(`/api/auth/${platform}/connect`)
            .set('Authorization', `Bearer ${authToken}`);

          expect(connectResponse.status).toBe(200);
          const { state } = connectResponse.body.data;

          // Step 2: Simulate callback
          const mockCode = `mock_code_${platform}_${Date.now()}`;
          const callbackResponse = await request(app).get(
            `/api/auth/${platform}/callback?code=${mockCode}&state=${state}`
          );

          expect(callbackResponse.status).toBe(302);
          expect(callbackResponse.headers.location).toContain('success=true');

          // Step 3: Check connection status
          const statusResponse = await request(app)
            .get('/api/auth/connections')
            .set('Authorization', `Bearer ${authToken}`);

          expect(statusResponse.status).toBe(200);
          const platformConnection = statusResponse.body.data.connections.find(
            (conn) => conn.platform === platform
          );

          expect(platformConnection).toBeDefined();
          expect(platformConnection.connected).toBe(true);
          expect(platformConnection.status).toBe('connected');
          expect(platformConnection.user_info).toBeDefined();
        });
      });
    });
  });

  describe('Token Management', () => {
    const testPlatform = 'twitter';

    beforeEach(async () => {
      // Setup a connected platform
      const connectResponse = await request(app)
        .post(`/api/auth/${testPlatform}/connect`)
        .set('Authorization', `Bearer ${authToken}`);

      const { state } = connectResponse.body.data;
      const mockCode = 'mock_code_' + Date.now();

      await request(app).get(`/api/auth/${testPlatform}/callback?code=${mockCode}&state=${state}`);
    });

    it('should refresh tokens successfully', async () => {
      const response = await request(app)
        .post(`/api/auth/${testPlatform}/refresh`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('refreshed successfully');
      expect(response.body.data.platform).toBe(testPlatform);
      expect(response.body.data.refreshed).toBe(true);
    });

    it('should disconnect successfully', async () => {
      const response = await request(app)
        .post(`/api/auth/${testPlatform}/disconnect`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('Successfully disconnected');
      expect(response.body.data.platform).toBe(testPlatform);
      expect(response.body.data.disconnected).toBe(true);

      // Verify disconnection
      const statusResponse = await request(app)
        .get('/api/auth/connections')
        .set('Authorization', `Bearer ${authToken}`);

      const platformConnection = statusResponse.body.data.connections.find(
        (conn) => conn.platform === testPlatform
      );

      expect(platformConnection.connected).toBe(false);
    });

    it('should handle refresh for non-existent connection', async () => {
      const response = await request(app)
        .post('/api/auth/nonexistent/refresh')
        .set('Authorization', `Bearer ${authToken}`);

      // Issue #638 Fix: nonexistent platform returns 400 (invalid parameter) not 404
      // sanitizePlatform() throws "Unsupported platform" before connection check
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unsupported platform');
    });

    it('should handle disconnect for non-existent connection', async () => {
      const response = await request(app)
        .post('/api/auth/nonexistent/disconnect')
        .set('Authorization', `Bearer ${authToken}`);

      // Issue #638 Fix: nonexistent platform returns 400 (invalid parameter) not 404
      // sanitizePlatform() throws "Unsupported platform" before connection check
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unsupported platform');
    });
  });

  describe('Mock Reset Functionality', () => {
    beforeEach(async () => {
      // Connect to twitter for testing reset
      const connectResponse = await request(app)
        .post('/api/auth/twitter/connect')
        .set('Authorization', `Bearer ${authToken}`);

      const { state } = connectResponse.body.data;
      const mockCode = 'mock_code_' + Date.now();

      await request(app).get(`/api/auth/twitter/callback?code=${mockCode}&state=${state}`);
    });

    it('should reset specific platform connection', async () => {
      const response = await request(app)
        .post('/api/auth/mock/reset')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platform: 'twitter' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.platform).toBe('twitter');

      // Verify reset
      const statusResponse = await request(app)
        .get('/api/auth/connections')
        .set('Authorization', `Bearer ${authToken}`);

      const twitterConnection = statusResponse.body.data.connections.find(
        (conn) => conn.platform === 'twitter'
      );

      expect(twitterConnection.connected).toBe(false);
    });

    it('should reset all connections', async () => {
      const response = await request(app)
        .post('/api/auth/mock/reset')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('Reset all connections');

      // Verify all connections are reset
      const statusResponse = await request(app)
        .get('/api/auth/connections')
        .set('Authorization', `Bearer ${authToken}`);

      statusResponse.body.data.connections.forEach((connection) => {
        expect(connection.connected).toBe(false);
      });
    });

    it('should only be available in mock mode', async () => {
      // Temporarily disable mock mode
      process.env.ENABLE_MOCK_MODE = 'false';
      flags.reload();

      const response = await request(app)
        .post('/api/auth/mock/reset')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platform: 'twitter' });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Mock reset only available in mock mode');

      // Restore mock mode
      process.env.ENABLE_MOCK_MODE = 'true';
      flags.reload();
    });
  });

  describe('Error Handling & Edge Cases', () => {
    beforeAll(async () => {
      // Issue #638: Reset all connections to ensure clean state for platform mismatch test
      await request(app)
        .post('/api/auth/mock/reset')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});
    });

    it('should handle malformed state parameter', async () => {
      const response = await request(app).get(
        '/api/auth/twitter/callback?code=testcode&state=invalid_base64!@#'
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('error=');
    });

    it('should handle platform mismatch in state', async () => {
      // Create state for twitter but use in instagram callback
      const connectResponse = await request(app)
        .post('/api/auth/twitter/connect')
        .set('Authorization', `Bearer ${authToken}`);

      const { state } = connectResponse.body.data;

      const response = await request(app).get(
        `/api/auth/instagram/callback?code=testcode&state=${state}`
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('error=Platform+mismatch');
    });

    it('should handle already connected platform', async () => {
      // First connection
      const connectResponse1 = await request(app)
        .post('/api/auth/twitter/connect')
        .set('Authorization', `Bearer ${authToken}`);

      const { state } = connectResponse1.body.data;
      const mockCode = 'mock_code_' + Date.now();

      await request(app).get(`/api/auth/twitter/callback?code=${mockCode}&state=${state}`);

      // Attempt second connection
      const connectResponse2 = await request(app)
        .post('/api/auth/twitter/connect')
        .set('Authorization', `Bearer ${authToken}`);

      expect(connectResponse2.status).toBe(200);
      expect(connectResponse2.body.data.status).toBe('already_connected');
      expect(connectResponse2.body.data.message).toContain('Already connected');
    });

    it('should validate platform parameter format', async () => {
      const invalidPlatforms = ['', ' ', 'platform with spaces', 'platform-with-dashes!'];

      for (const platform of invalidPlatforms) {
        const response = await request(app)
          .post(`/api/auth/${encodeURIComponent(platform)}/connect`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(400);
      }
    });
  });

  describe('User Info Validation', () => {
    it('should provide valid user info for all platforms', async () => {
      const platforms = ['twitter', 'instagram', 'youtube', 'facebook', 'bluesky'];

      for (const platform of platforms) {
        // Connect platform
        const connectResponse = await request(app)
          .post(`/api/auth/${platform}/connect`)
          .set('Authorization', `Bearer ${authToken}`);

        const { state } = connectResponse.body.data;
        const mockCode = `mock_code_${platform}_${Date.now()}`;

        await request(app).get(`/api/auth/${platform}/callback?code=${mockCode}&state=${state}`);

        // Check user info
        const statusResponse = await request(app)
          .get('/api/auth/connections')
          .set('Authorization', `Bearer ${authToken}`);

        const connection = statusResponse.body.data.connections.find(
          (conn) => conn.platform === platform
        );

        expect(connection.user_info).toBeDefined();
        expect(
          connection.user_info.id || connection.user_info.did || connection.user_info.open_id
        ).toBeDefined();

        // Platform-specific validations
        if (platform === 'twitter') {
          expect(connection.user_info.username).toBeDefined();
          expect(connection.user_info.public_metrics).toBeDefined();
        } else if (platform === 'youtube') {
          expect(connection.user_info.snippet).toBeDefined();
          expect(connection.user_info.statistics).toBeDefined();
        } else if (platform === 'bluesky') {
          expect(connection.user_info.handle).toBeDefined();
        }
      }
    });
  });
});
