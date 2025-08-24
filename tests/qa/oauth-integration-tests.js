/**
 * QA Integration Tests for Social Media OAuth Flows
 * Issue #90: Real-world testing of Twitter, YouTube, Instagram integrations
 * 
 * These tests require real OAuth credentials and external network access
 * Run in QA/staging environment only
 */

const request = require('supertest');
const app = require('../../src/index');
const { flags } = require('../../src/config/flags');
const { logger } = require('../../src/utils/logger');

// Test configuration
const QA_CONFIG = {
  baseUrl: process.env.QA_BASE_URL || 'http://localhost:3000',
  ngrokUrl: process.env.NGROK_URL || null,
  testUserId: 'qa-test-user-' + Date.now(),
  platforms: ['twitter', 'youtube', 'instagram'],
  timeout: 30000 // 30 seconds for real API calls
};

describe('OAuth Integration QA Tests', () => {
  let testToken;
  let testUserId;
  
  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'qa';
    
    // Create test user and get auth token
    const authResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: `qa-test-${Date.now()}@example.com`,
        password: 'QATestPass123!',
        name: 'QA Test User'
      });
    
    testToken = authResponse.body.data.token;
    testUserId = authResponse.body.data.user.id;
    
    logger.info('QA Test Setup Complete', { 
      testUserId, 
      platforms: QA_CONFIG.platforms,
      ngrokUrl: QA_CONFIG.ngrokUrl 
    });
  });

  afterAll(async () => {
    // Cleanup: disconnect all test connections
    for (const platform of QA_CONFIG.platforms) {
      try {
        await request(app)
          .post(`/api/integrations/${platform}/disconnect`)
          .set('Authorization', `Bearer ${testToken}`)
          .send();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('OAuth Authorization Flow Tests', () => {
    QA_CONFIG.platforms.forEach(platform => {
      test(`should initiate ${platform} OAuth flow with real credentials`, async () => {
        const response = await request(app)
          .post(`/api/integrations/${platform}/connect`)
          .set('Authorization', `Bearer ${testToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.authUrl).toBeDefined();
        expect(response.body.data.state).toBeDefined();
        expect(response.body.data.platform).toBe(platform);
        
        // For real OAuth, authUrl should point to actual platform
        if (!flags.shouldUseMockOAuth()) {
          expect(response.body.data.authUrl).toMatch(new RegExp(platform));
          expect(response.body.data.mock).toBe(false);
        }

        // Log the auth URL for manual testing
        console.log(`\n📋 Manual Test Required for ${platform}:`);
        console.log(`   1. Visit: ${response.body.data.authUrl}`);
        console.log(`   2. Complete OAuth flow`);
        console.log(`   3. Verify callback handling\n`);
        
        // Store state for callback testing
        global[`${platform}_oauth_state`] = response.body.data.state;
      }, QA_CONFIG.timeout);
    });
  });

  describe('Platform Configuration Tests', () => {
    QA_CONFIG.platforms.forEach(platform => {
      test(`should get default configuration for ${platform}`, async () => {
        const response = await request(app)
          .get(`/api/integrations/${platform}/config`)
          .set('Authorization', `Bearer ${testToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.platform).toBe(platform);
        expect(response.body.data.config).toBeDefined();
        expect(response.body.data.config.tone).toBeDefined();
        expect(response.body.data.config.humorType).toBeDefined();
        expect(response.body.data.config.shieldActions).toBeDefined();
      });

      test(`should update configuration for ${platform}`, async () => {
        const newConfig = {
          tone: 'witty',
          humorType: 'clever',
          responseFrequency: 0.8,
          autoReply: false,
          shieldActions: {
            enabled: true,
            muteEnabled: true,
            blockEnabled: false,
            reportEnabled: true
          }
        };

        const response = await request(app)
          .put(`/api/integrations/${platform}/config`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({ config: newConfig })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.config.tone).toBe('witty');
        expect(response.body.data.config.humorType).toBe('clever');
        expect(response.body.data.config.responseFrequency).toBe(0.8);
      });
    });
  });

  describe('Token Management Tests', () => {
    test('should handle token expiration gracefully', async () => {
      // This test would need expired tokens to work properly
      // For now, we'll test the validation logic
      const response = await request(app)
        .get('/api/integrations/connections')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.connections).toBeInstanceOf(Array);
      
      // Check that each platform has proper status tracking
      response.body.data.connections.forEach(connection => {
        expect(connection.platform).toBeDefined();
        expect(['connected', 'disconnected', 'expired', 'error']).toContain(connection.status);
        expect(connection.requirements).toBeDefined();
      });
    });

    test('should provide platform requirements and metadata', async () => {
      const response = await request(app)
        .get('/api/integrations/platforms')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.platforms).toBeInstanceOf(Array);
      
      const platformNames = response.body.data.platforms.map(p => p.platform);
      QA_CONFIG.platforms.forEach(platform => {
        expect(platformNames).toContain(platform);
      });

      // Check that each platform has proper metadata
      response.body.data.platforms.forEach(platform => {
        expect(platform.requirements).toBeDefined();
        expect(platform.requirements.permissions).toBeInstanceOf(Array);
        expect(platform.requirements.estimatedTime).toBeDefined();
        expect(platform.scopes).toBeInstanceOf(Array);
      });
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle invalid platform gracefully', async () => {
      const response = await request(app)
        .post('/api/integrations/invalid-platform/connect')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/unsupported platform/i);
    });

    test('should require authentication for protected endpoints', async () => {
      await request(app)
        .post('/api/integrations/twitter/connect')
        .expect(401);

      await request(app)
        .get('/api/integrations/connections')
        .expect(401);
    });

    test('should handle malformed configuration updates', async () => {
      const response = await request(app)
        .put('/api/integrations/twitter/config')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ config: 'invalid-config' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});

/**
 * Manual Testing Instructions
 * 
 * These tests require manual intervention for OAuth callbacks:
 * 
 * 1. Set up ngrok tunnel: `ngrok http 3000`
 * 2. Set NGROK_URL environment variable
 * 3. Configure OAuth apps with ngrok callback URLs
 * 4. Run tests and follow console prompts for manual OAuth completion
 * 5. Verify webhook endpoints receive real payload data
 */

module.exports = {
  QA_CONFIG
};