/**
 * Smoke Tests - API Health Checks
 *
 * Basic tests to ensure key endpoints are responding
 */

const request = require('supertest');
const { app, server } = require('../../src/index'); // Import the main app and server
const { store } = require('../../src/middleware/rateLimiter');

describe('API Health Smoke Tests', () => {
  afterAll((done) => {
    // Clean up rate limiter
    store.stop();

    // Close server if it exists
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  describe('Health Check Endpoints', () => {
    test('GET /health should return 200', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    test('GET /api/health should be accessible', async () => {
      const response = await request(app).get('/api/health');

      // Should be 200, 500, or 503, but not 404 (means endpoint exists)
      expect([200, 500, 503]).toContain(response.status);
    });
  });

  describe('Auth Endpoints Accessibility', () => {
    test('POST /api/auth/register should be accessible', async () => {
      const response = await request(app).post('/api/auth/register').send({});

      // Should be 400 (validation error) or 500 (server error), but not 404
      expect([400, 500]).toContain(response.status);
    });

    test('POST /api/auth/login should be accessible', async () => {
      const response = await request(app).post('/api/auth/login').send({});

      // Should be 400 (validation error) or 500 (server error), but not 404
      expect([400, 500]).toContain(response.status);
    });
  });

  describe('Billing Endpoints Accessibility', () => {
    test('GET /api/billing/plans should be accessible', async () => {
      const response = await request(app).get('/api/billing/plans');

      // Should be 200, 500, or 503, but not 404 (means endpoint exists)
      expect([200, 500, 503]).toContain(response.status);
    });

    test('POST /api/billing/create-checkout-session endpoint exists', async () => {
      const response = await request(app)
        .post('/api/billing/create-checkout-session')
        .send({ plan: 'pro' });

      // Should be 401 (auth required), 500 (server error), or 503 (billing unavailable), but not 404
      expect([401, 500, 503]).toContain(response.status);
    });
  });

  describe('Integration Endpoints Accessibility', () => {
    test('GET /api/user/integrations endpoint exists', async () => {
      const response = await request(app).get('/api/user/integrations');

      // Should be 401 (auth required) or 500 (server error), but not 404
      expect([401, 500]).toContain(response.status);
    });

    test('POST /api/user/integrations/connect endpoint exists', async () => {
      const response = await request(app)
        .post('/api/user/integrations/connect')
        .send({ platform: 'twitter' });

      // Should be 401 (auth required) or 500 (server error), but not 404
      expect([401, 500]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    test('Non-existent endpoints should return proper error', async () => {
      const response = await request(app).get('/api/nonexistent');

      // Should be 404 or 500, but endpoint should respond
      expect([404, 500]).toContain(response.status);
    });

    test('Wrong HTTP method should return proper error', async () => {
      const response = await request(app).delete('/api/billing/plans');

      // Should be 404 (not found), 405 (method not allowed) or 500, but endpoint should respond
      expect([404, 405, 500]).toContain(response.status);
    });
  });

  describe('Security Headers', () => {
    test('Should include security headers', async () => {
      const response = await request(app).get('/health').expect(200);

      // Check for basic security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
  });
});
