/**
 * Integration tests for OAuth routes with Zod validation
 * Tests Issue #948: Migration to Zod for social connection endpoints
 */

const request = require('supertest');
const express = require('express');
const oauthRouter = require('../../../src/routes/oauth');

describe('OAuth Routes - Zod Validation (Issue #948)', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/integrations', oauthRouter);
  });

  describe('GET /api/integrations/:platform/callback', () => {
    describe('Valid OAuth Callbacks', () => {
      it('should accept valid OAuth callback with code and state', async () => {
        const response = await request(app).get('/api/integrations/twitter/callback').query({
          code: 'valid_oauth_code_12345',
          state: 'csrf_token_abc123'
        });

        // Should redirect (302) or process successfully
        // Not 400 (validation error)
        expect(response.status).not.toBe(400);
      });

      it('should accept valid OAuth callback with redirect_uri', async () => {
        const response = await request(app).get('/api/integrations/discord/callback').query({
          code: 'discord_code_xyz',
          state: 'csrf_state_456',
          redirect_uri: 'https://roastr.ai/auth/callback'
        });

        expect(response.status).not.toBe(400);
      });

      it('should accept callback with http localhost redirect_uri', async () => {
        const response = await request(app).get('/api/integrations/youtube/callback').query({
          code: 'youtube_code',
          state: 'state_token',
          redirect_uri: 'http://localhost:3000/callback'
        });

        expect(response.status).not.toBe(400);
      });
    });

    describe('Zod Validation Errors', () => {
      it('should reject callback with missing code', async () => {
        const response = await request(app).get('/api/integrations/twitter/callback').query({
          state: 'csrf_token_abc123'
          // code missing
        });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'code',
              message: expect.stringMatching(/required/i)
            })
          ])
        );
      });

      it('should reject callback with missing state', async () => {
        const response = await request(app).get('/api/integrations/discord/callback').query({
          code: 'valid_code'
          // state missing
        });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'state',
              message: expect.stringMatching(/required/i)
            })
          ])
        );
      });

      it('should reject callback with empty code', async () => {
        const response = await request(app).get('/api/integrations/youtube/callback').query({
          code: '',
          state: 'valid_state'
        });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Validation failed');
      });

      it('should reject callback with empty state', async () => {
        const response = await request(app).get('/api/integrations/instagram/callback').query({
          code: 'valid_code',
          state: ''
        });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('should reject callback with invalid redirect_uri format', async () => {
        const response = await request(app).get('/api/integrations/twitch/callback').query({
          code: 'valid_code',
          state: 'valid_state',
          redirect_uri: 'not-a-valid-url'
        });

        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'redirect_uri',
              message: expect.stringMatching(/invalid/i)
            })
          ])
        );
      });

      it('should reject callback with code exceeding max length', async () => {
        const response = await request(app)
          .get('/api/integrations/facebook/callback')
          .query({
            code: 'a'.repeat(501), // 501 chars, max is 500
            state: 'valid_state'
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'code',
              message: expect.stringMatching(/too long/i)
            })
          ])
        );
      });

      it('should reject callback with state exceeding max length', async () => {
        const response = await request(app)
          .get('/api/integrations/reddit/callback')
          .query({
            code: 'valid_code',
            state: 's'.repeat(201) // 201 chars, max is 200
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'state',
              message: expect.stringMatching(/too long/i)
            })
          ])
        );
      });
    });

    describe('Multiple Validation Errors', () => {
      it('should return multiple errors when both code and state are missing', async () => {
        const response = await request(app).get('/api/integrations/twitter/callback').query({});

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.errors).toHaveLength(2);
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'code' }),
            expect.objectContaining({ field: 'state' })
          ])
        );
      });

      it('should return multiple errors when code empty and redirect_uri invalid', async () => {
        const response = await request(app).get('/api/integrations/bluesky/callback').query({
          code: '',
          state: 'valid_state',
          redirect_uri: 'invalid-url'
        });

        expect(response.status).toBe(400);
        expect(response.body.errors.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('Platform-Specific OAuth Flows', () => {
      it('should handle Twitter callback (OAuth 1.0a)', async () => {
        const response = await request(app).get('/api/integrations/twitter/callback').query({
          code: 'twitter_oauth_code',
          state: 'csrf_token',
          oauth_token: 'twitter_token',
          oauth_verifier: 'verifier_123'
        });

        // Twitter-specific fields should not cause validation errors
        expect(response.status).not.toBe(400);
      });

      it('should handle YouTube callback with scope', async () => {
        const response = await request(app).get('/api/integrations/youtube/callback').query({
          code: 'youtube_code',
          state: 'csrf_token',
          scope: 'https://www.googleapis.com/auth/youtube.force-ssl'
        });

        expect(response.status).not.toBe(400);
      });

      it('should handle Discord callback with guild_id', async () => {
        const response = await request(app).get('/api/integrations/discord/callback').query({
          code: 'discord_code',
          state: 'csrf_token',
          guild_id: '123456789012345678'
        });

        expect(response.status).not.toBe(400);
      });
    });

    describe('Error Response Format Compatibility', () => {
      it('should return Zod error format compatible with express-validator', async () => {
        const response = await request(app).get('/api/integrations/twitter/callback').query({
          state: 'valid_state'
          // missing code
        });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          message: 'Validation failed',
          errors: expect.arrayContaining([
            expect.objectContaining({
              field: expect.any(String),
              message: expect.any(String),
              code: expect.any(String)
            })
          ])
        });
      });

      it('should include error codes in validation errors', async () => {
        const response = await request(app).get('/api/integrations/youtube/callback').query({
          code: 'valid_code'
          // missing state
        });

        expect(response.status).toBe(400);
        expect(response.body.errors[0]).toHaveProperty('code');
        expect(response.body.errors[0]).toHaveProperty('field');
        expect(response.body.errors[0]).toHaveProperty('message');
      });
    });

    describe('Edge Cases', () => {
      it('should handle code with special characters', async () => {
        const response = await request(app).get('/api/integrations/instagram/callback').query({
          code: 'code-with_special.chars-123',
          state: 'state_with-special.chars'
        });

        expect(response.status).not.toBe(400);
      });

      it('should handle redirect_uri with query params', async () => {
        const response = await request(app).get('/api/integrations/facebook/callback').query({
          code: 'fb_code',
          state: 'csrf_token',
          redirect_uri: 'https://roastr.ai/callback?source=facebook&test=true'
        });

        expect(response.status).not.toBe(400);
      });

      it('should handle maximum valid lengths', async () => {
        const response = await request(app)
          .get('/api/integrations/twitch/callback')
          .query({
            code: 'c'.repeat(500), // Max length
            state: 's'.repeat(200) // Max length
          });

        expect(response.status).not.toBe(400);
      });
    });
  });

  describe('No Breaking Changes (AC#5)', () => {
    it('should maintain same status code (400) for validation errors', async () => {
      const response = await request(app).get('/api/integrations/twitter/callback').query({});

      expect(response.status).toBe(400);
    });

    it('should maintain errors array structure', async () => {
      const response = await request(app)
        .get('/api/integrations/discord/callback')
        .query({ code: 'valid_code' }); // missing state

      expect(response.body).toHaveProperty('errors');
      expect(Array.isArray(response.body.errors)).toBe(true);
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('should include success: false in error responses', async () => {
      const response = await request(app)
        .get('/api/integrations/youtube/callback')
        .query({ state: 'valid_state' }); // missing code

      expect(response.body.success).toBe(false);
    });

    it('should include descriptive error messages', async () => {
      const response = await request(app).get('/api/integrations/instagram/callback').query({
        code: '',
        state: 'valid_state'
      });

      expect(response.body.errors[0].message).toBeTruthy();
      expect(typeof response.body.errors[0].message).toBe('string');
    });
  });
});
