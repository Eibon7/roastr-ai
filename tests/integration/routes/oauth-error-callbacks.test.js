/**
 * Integration Tests - OAuth Error Callbacks
 * Issue #948 - CodeRabbit Review #3499858197
 *
 * Tests OAuth provider error callbacks (access_denied, user_cancelled, etc.)
 * Ensures that OAuthCallbackSchema (union) accepts error-only parameters
 * and that the endpoint redirects correctly (no 400 JSON errors)
 */

const request = require('supertest');
const express = require('express');
const oauthRouter = require('../../../src/routes/oauth');

describe('OAuth Error Callbacks - Integration Tests', () => {
  let app;

  beforeEach(() => {
    // Set MOCK_OAUTH via env for testing
    process.env.MOCK_OAUTH = 'true';

    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/api/auth', oauthRouter);
  });

  afterEach(() => {
    delete process.env.MOCK_OAUTH;
  });

  describe('GET /:platform/callback - Error Flows', () => {
    const platforms = ['twitter', 'youtube', 'discord', 'instagram', 'facebook', 'twitch', 'reddit', 'tiktok', 'bluesky'];

    test.each(platforms)('should handle access_denied error for %s', async (platform) => {
      const response = await request(app)
        .get(`/api/auth/${platform}/callback`)
        .query({
          error: 'access_denied',
          error_description: 'User denied access to the application',
          state: 'optional_state_token'
        });

      // Should redirect (302), NOT return 400 JSON
      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/connections');
      expect(response.headers.location).toContain('error=');
      expect(response.headers.location).toContain(`platform=${platform}`);
    });

    test.each(platforms)('should handle user_cancelled error for %s', async (platform) => {
      const response = await request(app)
        .get(`/api/auth/${platform}/callback`)
        .query({
          error: 'user_cancelled',
          error_description: 'User cancelled the authorization flow'
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/connections');
      expect(response.headers.location).toContain('error=');
    });

    test.each(platforms)('should handle server_error without state for %s', async (platform) => {
      const response = await request(app)
        .get(`/api/auth/${platform}/callback`)
        .query({
          error: 'server_error',
          error_description: 'The authorization server encountered an error'
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/connections');
      expect(response.headers.location).toContain('error=');
    });

    test('should handle error without error_description', async () => {
      const response = await request(app)
        .get('/api/auth/twitter/callback')
        .query({
          error: 'temporarily_unavailable'
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/connections');
      expect(response.headers.location).toContain('error=temporarily_unavailable');
    });

    test('should handle long error descriptions', async () => {
      const longDescription = 'A'.repeat(300);

      const response = await request(app)
        .get('/api/auth/discord/callback')
        .query({
          error: 'invalid_request',
          error_description: longDescription
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/connections');
    });
  });

  describe('GET /:platform/callback - Success Flow Still Works', () => {
    test('should accept valid code + state (success flow)', async () => {
      const validState = JSON.stringify({
        platform: 'twitter',
        userId: 'test-user-123',
        timestamp: Date.now()
      });

      const response = await request(app)
        .get('/api/auth/twitter/callback')
        .query({
          code: 'mock_code_abc123',
          state: validState
        });

      // In MOCK_OAUTH mode, should return 200 with mock data or redirect
      expect([200, 302]).toContain(response.status);

      if (response.status === 302) {
        expect(response.headers.location).toContain('/connections');
        // May redirect to success or error depending on mock implementation
      }
    });

    test('should reject missing code in success flow', async () => {
      const response = await request(app)
        .get('/api/auth/youtube/callback')
        .query({
          // Missing code (no error param either)
          state: 'some_state_token'
        });

      // Zod validation should return 400
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.success).toBe(false);
    });

    test('should reject missing state in success flow', async () => {
      const response = await request(app)
        .get('/api/auth/instagram/callback')
        .query({
          code: 'mock_code_xyz789'
          // Missing state (no error param either)
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /:platform/callback - Edge Cases', () => {
    test('should handle both error AND code (error takes precedence)', async () => {
      const response = await request(app)
        .get('/api/auth/facebook/callback')
        .query({
          error: 'access_denied',
          error_description: 'User denied',
          code: 'should_be_ignored',
          state: 'should_also_be_ignored'
        });

      // Error flow should execute first
      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('error=');
      expect(response.headers.location).toContain('User'); // URL encoded
    });

    test('should reject completely empty query parameters', async () => {
      const response = await request(app)
        .get('/api/auth/twitch/callback');
      // No query params at all

      // Zod should reject (neither error nor code present)
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.success).toBe(false);
    });

    test('should handle invalid platform gracefully', async () => {
      const response = await request(app)
        .get('/api/auth/invalid_platform/callback')
        .query({
          error: 'access_denied',
          error_description: 'Test error'
        });

      // Should still redirect (platform validation happens inside handler)
      expect(response.status).toBe(302);
    });
  });

  describe('Backward Compatibility', () => {
    test('should maintain existing API contract for success flow', async () => {
      const validState = JSON.stringify({
        platform: 'reddit',
        userId: 'user-789',
        timestamp: Date.now()
      });

      const response = await request(app)
        .get('/api/auth/reddit/callback')
        .query({
          code: 'valid_code_123',
          state: validState
        });

      // Should NOT break existing behavior
      expect([200, 302]).toContain(response.status);
    });

    test('should maintain existing error responses for missing code/state (when no error param)', async () => {
      const response = await request(app)
        .get('/api/auth/tiktok/callback')
        .query({
          // Missing both code and error
          redirect_uri: 'https://example.com/callback'
        });

      // Should return 400 validation error (Zod rejects)
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.success).toBe(false);
    });
  });
});

