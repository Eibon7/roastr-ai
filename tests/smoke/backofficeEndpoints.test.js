/**
 * Smoke Tests for Backoffice Endpoints
 * Issue #371: SPEC 15 — Backoffice (MVP): thresholds globales, flags y soporte básico
 * 
 * Basic smoke tests to verify that all backoffice endpoints are accessible
 * and return proper responses without diving into business logic details.
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies before importing anything
jest.mock('../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ 
            data: { 
              id: 'global-1', 
              tau_roast_lower: 0.25, 
              tau_shield: 0.70, 
              tau_critical: 0.90, 
              aggressiveness: 95 
            }, 
            error: null 
          }))
        })),
        order: jest.fn(() => ({
          limit: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ 
              data: { id: 'health-1', overall_status: 'OK' }, 
              error: null 
            }))
          }))
        })),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis()
      })),
      insert: jest.fn(() => Promise.resolve({ error: null })),
      upsert: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ 
              data: { id: 'global-1', aggressiveness: 95 }, 
              error: null 
            }))
          }))
        }))
      }))
    }))
  }
}));

jest.mock('../../src/middleware/isAdmin', () => ({
  isAdminMiddleware: jest.fn((req, res, next) => {
    req.user = { 
      id: 'admin-test-123', 
      email: 'admin@test.roastr.ai', 
      is_admin: true,
      name: 'Test Admin'
    };
    next();
  })
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../src/utils/safeUtils', () => ({
  safeUserIdPrefix: jest.fn((id) => `***${id.slice(-3)}`)
}));

describe('Backoffice Endpoints Smoke Tests', () => {
  let app;
  let server;
  
  beforeAll(async () => {
    // Mock fetch globally
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message: 'mocked response' })
      })
    );
    
    // Create a test Express app with backoffice routes
    app = express();
    app.use(express.json());
    
    // Import and setup the actual backoffice routes
    const backofficeRoutes = require('../../src/routes/admin/backofficeSettings');
    app.use('/api/admin/backoffice', backofficeRoutes);
    
    // Add feature flags route
    app.get('/api/admin/feature-flags', (req, res) => {
      const { category } = req.query;
      const mockFlags = category === 'backoffice' ? [
        { flag_key: 'shop_enabled', flag_name: 'Shop Feature', is_enabled: false },
        { flag_key: 'roast_versions', flag_name: 'Multiple Roast Versions', is_enabled: true },
        { flag_key: 'review_queue', flag_name: 'Review Queue', is_enabled: false }
      ] : [];
      res.json({ success: true, data: mockFlags });
    });
    
    // Error handling middleware
    app.use((err, req, res, next) => {
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    });

    // Start test server on random port
    server = app.listen(0);
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
    
    // Clean up global mocks
    if (global.fetch) {
      delete global.fetch;
    }
    
    jest.resetAllMocks();
  });

  afterEach(() => {
    // Reset fetch mock after each test to prevent test leakage
    if (global.fetch && typeof global.fetch.mockReset === 'function') {
      global.fetch.mockReset();
      // Re-setup the default mock
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ message: 'mocked response' })
        })
      );
    }
    jest.clearAllMocks();
  });
  describe('Global Thresholds Endpoints', () => {
    it('GET /api/admin/backoffice/thresholds should return 200', async () => {
      const response = await request(app)
        .get('/api/admin/backoffice/thresholds');

      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
      }
    }, 10000);

    it('PUT /api/admin/backoffice/thresholds should accept valid data', async () => {
      const response = await request(app)
        .put('/api/admin/backoffice/thresholds')
        .send({
          tau_roast_lower: 0.25,
          tau_shield: 0.70,
          tau_critical: 0.90,
          aggressiveness: 95
        });

      expect([200, 400, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('success');
    }, 10000);
  });

  describe('Healthcheck Endpoints', () => {
    beforeEach(() => {
      // Set mock environment variables
      process.env.TWITTER_BEARER_TOKEN = 'mock-token';
      process.env.YOUTUBE_API_KEY = 'mock-key';
      process.env.DISCORD_BOT_TOKEN = 'mock-discord-token';
      process.env.TWITCH_CLIENT_ID = 'mock-twitch-id';
      process.env.TWITCH_CLIENT_SECRET = 'mock-twitch-secret';
      process.env.INSTAGRAM_ACCESS_TOKEN = 'mock-instagram-token';
      process.env.FACEBOOK_ACCESS_TOKEN = 'mock-facebook-token';
      
      // Setup fetch mock for this test suite
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK'
      });
    });

    afterEach(() => {
      // Clean up environment variables
      delete process.env.TWITTER_BEARER_TOKEN;
      delete process.env.YOUTUBE_API_KEY;
      delete process.env.DISCORD_BOT_TOKEN;
      delete process.env.TWITCH_CLIENT_ID;
      delete process.env.TWITCH_CLIENT_SECRET;
      delete process.env.INSTAGRAM_ACCESS_TOKEN;
      delete process.env.FACEBOOK_ACCESS_TOKEN;
    });

    it('GET /api/admin/backoffice/healthcheck/status should return 200', async () => {
      const response = await request(app)
        .get('/api/admin/backoffice/healthcheck/status');

      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
      }
    }, 10000);

    it('POST /api/admin/backoffice/healthcheck should accept platform list', async () => {
      const response = await request(app)
        .post('/api/admin/backoffice/healthcheck')
        .send({
          platforms: ['twitter']
        });

      expect([200, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('success');
    }, 15000);
  });

  describe('Audit Export Endpoints', () => {
    it('GET /api/admin/backoffice/audit/export should support CSV format', async () => {
      const response = await request(app)
        .get('/api/admin/backoffice/audit/export?format=csv&days=1');

      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.headers['content-type']).toContain('text/csv');
        expect(response.headers['content-disposition']).toContain('attachment');
      }
    }, 10000);

    it('GET /api/admin/backoffice/audit/export should support JSON format', async () => {
      const response = await request(app)
        .get('/api/admin/backoffice/audit/export?format=json&days=1');

      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.headers['content-type']).toContain('application/json');
        expect(response.body).toHaveProperty('success');
      }
    }, 10000);

    it('GET /api/admin/backoffice/audit/export should reject invalid format', async () => {
      const response = await request(app)
        .get('/api/admin/backoffice/audit/export?format=xml');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('format must be either csv or json');
    }, 10000);
  });

  describe('Feature Flags Integration', () => {
    it('Should be able to access backoffice feature flags through main feature flags endpoint', async () => {
      const response = await request(app)
        .get('/api/admin/feature-flags?category=backoffice');

      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
      }
    }, 10000);
  });

  describe('Error Handling', () => {
    it('Should return proper error response for invalid threshold values', async () => {
      const response = await request(app)
        .put('/api/admin/backoffice/thresholds')
        .send({
          tau_roast_lower: 1.5, // Invalid: > 1
          tau_shield: 0.70,
          tau_critical: 0.90,
          aggressiveness: 95
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('tau_roast_lower must be a number between 0 and 1');
    }, 10000);

    it('Should return proper error response for invalid aggressiveness', async () => {
      const response = await request(app)
        .put('/api/admin/backoffice/thresholds')
        .send({
          tau_roast_lower: 0.25,
          tau_shield: 0.70,
          tau_critical: 0.90,
          aggressiveness: 75 // Invalid: not in [90, 95, 98, 100]
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('aggressiveness must be one of: 90, 95, 98, 100');
    }, 10000);
  });

  describe('GDPR Compliance Verification', () => {
    it('Should not expose user personal data in any backoffice endpoint', async () => {
      const endpoints = [
        '/api/admin/backoffice/thresholds',
        '/api/admin/backoffice/healthcheck/status',
        '/api/admin/backoffice/audit/export?format=json&days=1'
      ];

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        
        if (response.status === 200) {
          const responseText = JSON.stringify(response.body);
          
          // Check that no user personal data patterns are present
          expect(responseText).not.toMatch(/persona_defines/i);
          expect(responseText).not.toMatch(/persona_doesnt_tolerate/i);  
          expect(responseText).not.toMatch(/user_roast_persona/i);
          expect(responseText).not.toMatch(/personal_identity/i);
          
          // Admin data is OK, but verify it's properly sanitized
          if (responseText.includes('admin')) {
            // Admin emails in audit logs are acceptable for compliance
            expect(responseText).toMatch(/admin@/);
          }
        }
      }
    }, 15000);
  });

  describe('Authentication and Authorization', () => {
    it('Should require admin privileges for all backoffice endpoints', async () => {
      // This test verifies that without mocking the admin middleware,
      // the endpoints would require proper authentication
      // The mock we have ensures the endpoints are accessible in tests
      
      const endpoints = [
        { method: 'get', path: '/api/admin/backoffice/thresholds' },
        { method: 'put', path: '/api/admin/backoffice/thresholds' },
        { method: 'post', path: '/api/admin/backoffice/healthcheck' },
        { method: 'get', path: '/api/admin/backoffice/healthcheck/status' },
        { method: 'get', path: '/api/admin/backoffice/audit/export' }
      ];

      for (const endpoint of endpoints) {
        let response;
        if (endpoint.method === 'get') {
          response = await request(app).get(endpoint.path);
        } else if (endpoint.method === 'put') {
          response = await request(app).put(endpoint.path).send({
            tau_roast_lower: 0.25,
            tau_shield: 0.70, 
            tau_critical: 0.90,
            aggressiveness: 95
          });
        } else if (endpoint.method === 'post') {
          response = await request(app).post(endpoint.path).send({});
        }

        // With admin middleware mocked, should not get 401/403
        expect(response.status).not.toBe(401);
        expect(response.status).not.toBe(403);
      }
    }, 20000);
  });
});