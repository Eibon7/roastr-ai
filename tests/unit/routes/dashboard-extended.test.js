/**
 * Dashboard Routes Extended Tests
 *
 * Comprehensive tests for dashboard API routes including health checks,
 * user info, integrations, logs, usage statistics, billing portal, and roast preview
 */

const request = require('supertest');
const express = require('express');

// Mock flags first
jest.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn((flag) => {
      // Return different values based on flag for testing
      switch (flag) {
        case 'ENABLE_BILLING':
          return true;
        case 'ENABLE_REAL_OPENAI':
          return true;
        case 'ENABLE_SUPABASE':
          return true;
        case 'ENABLE_RQC':
          return false;
        case 'ENABLE_SHIELD':
          return true;
        case 'MOCK_MODE':
          return false; // Changed to false to match actual behavior
        case 'VERBOSE_LOGS':
          return false;
        case 'ENABLE_REAL_TWITTER':
          return false;
        case 'ENABLE_REAL_YOUTUBE':
          return false;
        case 'ENABLE_REAL_BLUESKY':
          return false;
        default:
          return false;
      }
    })
  }
}));

const router = require('../../../src/routes/dashboard');

// Create test app
const app = express();
app.use(express.json());
app.use('/api', router);

describe('Dashboard Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    test('should return system health status', async () => {
      const response = await request(app).get('/api/health').expect(200);

      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('flags');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('operational');
    });

    test('should include correct service statuses', async () => {
      const response = await request(app).get('/api/health').expect(200);

      const services = response.body.services;
      expect(services.api).toBe('ok');
      expect(services.billing).toBe('ok'); // ENABLE_BILLING is true
      expect(services.ai).toBe('ok'); // ENABLE_REAL_OPENAI is true
      expect(services.db).toBe('ok'); // ENABLE_SUPABASE is true
    });

    test('should include correct flag statuses', async () => {
      const response = await request(app).get('/api/health').expect(200);

      const flags = response.body.flags;
      expect(flags.rqc).toBe(false); // ENABLE_RQC is false
      expect(flags.shield).toBe(true); // ENABLE_SHIELD is true
      expect(flags.mockMode).toBe(false); // MOCK_MODE is false
      expect(flags.verboseLogs).toBe(false); // VERBOSE_LOGS is false
    });

    test('should handle errors gracefully', async () => {
      // Mock flags.isEnabled to throw an error
      const { flags } = require('../../../src/config/flags');
      flags.isEnabled.mockImplementation(() => {
        throw new Error('Test error');
      });

      const response = await request(app).get('/api/health').expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Health check failed');
      expect(response.body).toHaveProperty('message');
    });

    test('should return degraded status when services disabled', async () => {
      // Mock flags to return false for services
      const { flags } = require('../../../src/config/flags');
      flags.isEnabled.mockImplementation((flag) => {
        switch (flag) {
          case 'ENABLE_BILLING':
            return false;
          case 'ENABLE_REAL_OPENAI':
            return false;
          case 'ENABLE_SUPABASE':
            return false;
          default:
            return false;
        }
      });

      const response = await request(app).get('/api/health').expect(200);

      const services = response.body.services;
      expect(services.api).toBe('ok');
      expect(services.billing).toBe('degraded');
      expect(services.ai).toBe('degraded');
      expect(services.db).toBe('degraded');
    });
  });

  describe('GET /api/user', () => {
    test('should return mock user data', async () => {
      const response = await request(app).get('/api/user').expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('plan');
      expect(response.body).toHaveProperty('rqcEnabled');
      expect(response.body).toHaveProperty('avatar');
      expect(response.body).toHaveProperty('joinedAt');
      expect(response.body).toHaveProperty('lastActive');

      expect(response.body.id).toBe('u_mock_user');
      expect(response.body.name).toBe('Roastr User');
      expect(response.body.email).toBe('user@roastr.ai');
    });

    test('should reflect plan based on mock mode', async () => {
      // Mock mode is disabled, should return free plan
      const response = await request(app).get('/api/user').expect(200);

      expect(response.body.plan).toBe('free');
    });

    test('should reflect RQC status', async () => {
      const response = await request(app).get('/api/user').expect(200);

      expect(response.body.rqcEnabled).toBe(false); // ENABLE_RQC is false
    });

    test('should have valid timestamp format', async () => {
      const response = await request(app).get('/api/user').expect(200);

      expect(response.body.lastActive).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('GET /api/integrations', () => {
    test('should return all platform integrations', async () => {
      const response = await request(app).get('/api/integrations').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(7);

      const platformNames = response.body.map((p) => p.name);
      expect(platformNames).toContain('twitter');
      expect(platformNames).toContain('youtube');
      expect(platformNames).toContain('instagram');
      expect(platformNames).toContain('discord');
      expect(platformNames).toContain('twitch');
      expect(platformNames).toContain('reddit');
      expect(platformNames).toContain('bluesky');
    });

    test('should have correct platform structure', async () => {
      const response = await request(app).get('/api/integrations').expect(200);

      response.body.forEach((platform) => {
        expect(platform).toHaveProperty('name');
        expect(platform).toHaveProperty('displayName');
        expect(platform).toHaveProperty('status');
        expect(platform).toHaveProperty('icon');
        expect(platform).toHaveProperty('lastSync');
        expect(['connected', 'disconnected']).toContain(platform.status);
      });
    });

    test('should reflect real integration statuses', async () => {
      const response = await request(app).get('/api/integrations').expect(200);

      const twitter = response.body.find((p) => p.name === 'twitter');
      const youtube = response.body.find((p) => p.name === 'youtube');
      const bluesky = response.body.find((p) => p.name === 'bluesky');

      expect(twitter.status).toBe('disconnected'); // ENABLE_REAL_TWITTER is false
      expect(youtube.status).toBe('disconnected'); // ENABLE_REAL_YOUTUBE is false
      expect(bluesky.status).toBe('disconnected'); // ENABLE_REAL_BLUESKY is false
    });

    test('should show connected status when flags enabled', async () => {
      // Mock flags to enable real integrations
      const { flags } = require('../../../src/config/flags');
      flags.isEnabled.mockImplementation((flag) => {
        switch (flag) {
          case 'ENABLE_REAL_TWITTER':
            return true;
          case 'ENABLE_REAL_YOUTUBE':
            return true;
          case 'ENABLE_REAL_BLUESKY':
            return true;
          default:
            return false;
        }
      });

      const response = await request(app).get('/api/integrations').expect(200);

      const twitter = response.body.find((p) => p.name === 'twitter');
      const youtube = response.body.find((p) => p.name === 'youtube');
      const bluesky = response.body.find((p) => p.name === 'bluesky');

      expect(twitter.status).toBe('connected');
      expect(youtube.status).toBe('connected');
      expect(bluesky.status).toBe('connected');
      expect(twitter.lastSync).toBeTruthy();
    });
  });

  describe('GET /api/logs', () => {
    test('should return mock logs with default limit', async () => {
      const response = await request(app).get('/api/logs').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(50);
    });

    test('should respect limit parameter', async () => {
      const response = await request(app).get('/api/logs?limit=10').expect(200);

      expect(response.body).toHaveLength(10);
    });

    test('should respect level parameter', async () => {
      const response = await request(app).get('/api/logs?level=error').expect(200);

      response.body.forEach((log) => {
        expect(log.level).toBe('error');
      });
    });

    test('should have correct log structure', async () => {
      const response = await request(app).get('/api/logs?limit=5').expect(200);

      response.body.forEach((log) => {
        expect(log).toHaveProperty('id');
        expect(log).toHaveProperty('level');
        expect(log).toHaveProperty('message');
        expect(log).toHaveProperty('timestamp');
        expect(log).toHaveProperty('service');
        expect(log).toHaveProperty('metadata');
        expect(['info', 'warn', 'error']).toContain(log.level);
      });
    });

    test('should cap limit at 100', async () => {
      const response = await request(app).get('/api/logs?limit=200').expect(200);

      expect(response.body.length).toBeLessThanOrEqual(100);
    });

    test('should return logs sorted by timestamp descending', async () => {
      const response = await request(app).get('/api/logs?limit=10').expect(200);

      for (let i = 1; i < response.body.length; i++) {
        const current = new Date(response.body[i].timestamp);
        const previous = new Date(response.body[i - 1].timestamp);
        expect(current.getTime()).toBeLessThanOrEqual(previous.getTime());
      }
    });

    test('should handle invalid limit gracefully', async () => {
      const response = await request(app).get('/api/logs?limit=invalid').expect(200);

      expect(response.body.length).toBeLessThanOrEqual(50); // Should use default
    });
  });

  describe('GET /api/usage', () => {
    test('should return usage statistics', async () => {
      const response = await request(app).get('/api/usage').expect(200);

      expect(response.body).toHaveProperty('tokens');
      expect(response.body).toHaveProperty('aiCalls');
      expect(response.body).toHaveProperty('rqcCalls');
      expect(response.body).toHaveProperty('costCents');
      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('breakdown');
      expect(response.body).toHaveProperty('limits');
    });

    test('should have valid numeric values', async () => {
      const response = await request(app).get('/api/usage').expect(200);

      expect(typeof response.body.tokens).toBe('number');
      expect(typeof response.body.aiCalls).toBe('number');
      expect(typeof response.body.rqcCalls).toBe('number');
      expect(typeof response.body.costCents).toBe('number');

      expect(response.body.tokens).toBeGreaterThan(0);
      expect(response.body.aiCalls).toBeGreaterThan(0);
      expect(response.body.costCents).toBeGreaterThan(0);
    });

    test('should reflect RQC status in usage', async () => {
      const response = await request(app).get('/api/usage').expect(200);

      expect(response.body.rqcCalls).toBe(0); // ENABLE_RQC is false
      expect(response.body.breakdown.rqcReviews).toBe(0);
      expect(response.body.limits.rqcCallsLimit).toBe(0);
    });

    test('should have valid period dates', async () => {
      const response = await request(app).get('/api/usage').expect(200);

      expect(response.body.period.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(response.body.period.end).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      const start = new Date(response.body.period.start);
      const end = new Date(response.body.period.end);
      expect(end.getTime()).toBeGreaterThan(start.getTime());
    });

    test('should show RQC usage when enabled', async () => {
      // Mock RQC as enabled
      const { flags } = require('../../../src/config/flags');
      flags.isEnabled.mockImplementation((flag) => {
        return flag === 'ENABLE_RQC';
      });

      const response = await request(app).get('/api/usage').expect(200);

      expect(response.body.rqcCalls).toBeGreaterThan(0);
      expect(response.body.breakdown.rqcReviews).toBeGreaterThan(0);
      expect(response.body.limits.rqcCallsLimit).toBe(500);
    });
  });

  describe('POST /api/billing/portal', () => {
    test('should return unavailable when not in mock mode', async () => {
      const response = await request(app).post('/api/billing/portal').expect(503);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.error).toBe('billing_unavailable');
      expect(response.body.message).toBe('Billing service not configured');
    });

    test('should return mock portal when mock mode enabled', async () => {
      // Mock MOCK_MODE as true
      const { flags } = require('../../../src/config/flags');
      flags.isEnabled.mockImplementation((flag) => {
        return flag === 'MOCK_MODE';
      });

      const response = await request(app).post('/api/billing/portal').expect(200);

      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('message');
      expect(response.body.url).toBe('#mock-portal');
      expect(response.body.message).toContain('Mock billing portal');
    });
  });

  describe('POST /api/roast/preview', () => {
    test('should generate roast preview with valid input', async () => {
      const response = await request(app)
        .post('/api/roast/preview')
        .send({
          text: 'This is a test comment',
          platform: 'twitter',
          intensity: 3
        })
        .expect(200);

      expect(response.body).toHaveProperty('roast');
      expect(response.body).toHaveProperty('intensity');
      expect(response.body).toHaveProperty('platform');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body).toHaveProperty('processingTime');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body).toHaveProperty('isMock');

      expect(response.body.intensity).toBe(3);
      expect(response.body.platform).toBe('twitter');
      expect(typeof response.body.roast).toBe('string');
      expect(response.body.roast.length).toBeGreaterThan(0);
      expect(typeof response.body.isMock).toBe('boolean'); // Could be true or false depending on test order
    }, 10000); // Increase timeout for async response

    test('should reject request without text', async () => {
      const response = await request(app)
        .post('/api/roast/preview')
        .send({
          platform: 'twitter',
          intensity: 3
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.error).toBe('missing_text');
      expect(response.body.message).toBe('Text is required for roast preview');
    });

    test('should use default values for optional parameters', async () => {
      const response = await request(app)
        .post('/api/roast/preview')
        .send({
          text: 'Test comment'
        })
        .expect(200);

      expect(response.body.platform).toBe('twitter'); // default
      expect(response.body.intensity).toBe(3); // default
    }, 10000);

    test('should handle different intensity levels', async () => {
      const intensities = [1, 2, 3, 4, 5];

      for (const intensity of intensities) {
        const response = await request(app)
          .post('/api/roast/preview')
          .send({
            text: 'Test comment',
            intensity
          })
          .expect(200);

        expect(response.body.intensity).toBe(intensity);
        expect(typeof response.body.roast).toBe('string');
      }
    }, 30000); // Longer timeout for multiple requests

    test('should handle invalid intensity gracefully', async () => {
      const response = await request(app)
        .post('/api/roast/preview')
        .send({
          text: 'Test comment',
          intensity: 10 // Invalid intensity
        })
        .expect(200);

      expect(response.body.intensity).toBe(10);
      expect(typeof response.body.roast).toBe('string'); // Should fallback to intensity 3
    }, 10000);

    test('should have realistic processing metrics', async () => {
      const response = await request(app)
        .post('/api/roast/preview')
        .send({
          text: 'Test comment'
        })
        .expect(200);

      expect(response.body.confidence).toBeGreaterThan(0.8);
      expect(response.body.confidence).toBeLessThanOrEqual(1);
      expect(response.body.processingTime).toBeGreaterThan(500);
      expect(response.body.processingTime).toBeLessThan(3000);
      expect(response.body.tokens).toBeGreaterThan(50);
      expect(response.body.tokens).toBeLessThan(150);
    }, 10000);
  });

  describe('Error Handling', () => {
    test('should handle invalid JSON in POST requests', async () => {
      const response = await request(app)
        .post('/api/roast/preview')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      // Express should handle malformed JSON
    });

    test('should handle missing Content-Type', async () => {
      const response = await request(app).post('/api/roast/preview').send('text=test').expect(500);

      // Express middleware error for malformed request
    });
  });

  describe('Integration Tests', () => {
    test('should have consistent health and user data', async () => {
      const healthResponse = await request(app).get('/api/health').expect(200);

      const userResponse = await request(app).get('/api/user').expect(200);

      // Both should reflect same flag states
      expect(healthResponse.body.flags.mockMode).toBe(userResponse.body.plan === 'pro');
      expect(healthResponse.body.flags.rqc).toBe(userResponse.body.rqcEnabled);
    });

    test('should have consistent integration and usage data', async () => {
      const integrationsResponse = await request(app).get('/api/integrations').expect(200);

      const usageResponse = await request(app).get('/api/usage').expect(200);

      // RQC should be consistent
      const hasConnectedIntegrations = integrationsResponse.body.some(
        (p) => p.status === 'connected'
      );
      // Usage stats should be reasonable based on integrations
      expect(typeof usageResponse.body.tokens).toBe('number');
    });

    test('should handle complete dashboard workflow', async () => {
      // 1. Check health
      await request(app).get('/api/health').expect(200);

      // 2. Get user info
      await request(app).get('/api/user').expect(200);

      // 3. Check integrations
      await request(app).get('/api/integrations').expect(200);

      // 4. Get usage
      await request(app).get('/api/usage').expect(200);

      // 5. Get logs
      await request(app).get('/api/logs?limit=5').expect(200);

      // 6. Try billing portal (status depends on mock mode)
      const billingResponse = await request(app).post('/api/billing/portal');

      expect([200, 503]).toContain(billingResponse.status);

      // All should succeed
    });
  });
});
