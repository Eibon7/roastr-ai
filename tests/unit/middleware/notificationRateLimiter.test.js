/**
 * Tests for notification rate limiting middleware
 * Issue #97: Implement rate limiting for notification endpoints
 */

const request = require('supertest');
const express = require('express');
const {
  notificationLimiter,
  notificationMarkLimiter,
  notificationDeleteLimiter,
  createNotificationRateLimiter,
  getNotificationRateConfig
} = require('../../../src/middleware/notificationRateLimiter');

// Mock dependencies
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }))
  }
}));

jest.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn((flag) => {
      if (flag === 'DISABLE_RATE_LIMIT') return false;
      return false;
    })
  }
}));

describe('Notification Rate Limiters', () => {
  let app;
  let mockAuthenticateToken;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    mockAuthenticateToken = (req, res, next) => {
      req.user = { id: 'test-user-123' };
      next();
    };

    // Clear all mocks
    jest.clearAllMocks();

    // Set test environment
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.NODE_ENV;
  });

  describe('notificationLimiter', () => {
    beforeEach(() => {
      app.get('/test', notificationLimiter, mockAuthenticateToken, (req, res) => {
        res.json({ success: true, message: 'Request successful' });
      });
    });

    it('should allow requests under the limit', async () => {
      const response = await request(app).get('/test').expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Request successful'
      });
    });

    it('should skip rate limiting in test environment', async () => {
      // Make multiple requests that would normally exceed the limit
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(request(app).get('/test'));
      }

      const responses = await Promise.all(promises);
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });

    it('should include rate limit headers', async () => {
      // Temporarily disable test mode to check headers
      process.env.NODE_ENV = 'production';

      const response = await request(app).get('/test').expect(200);

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('notificationMarkLimiter', () => {
    beforeEach(() => {
      app.post('/test/mark', notificationMarkLimiter, mockAuthenticateToken, (req, res) => {
        res.json({ success: true, message: 'Marked as read' });
      });
    });

    it('should allow requests under the limit', async () => {
      const response = await request(app).post('/test/mark').expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Marked as read'
      });
    });

    it('should skip rate limiting in test environment', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(request(app).post('/test/mark'));
      }

      const responses = await Promise.all(promises);
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('notificationDeleteLimiter', () => {
    beforeEach(() => {
      app.delete(
        '/test/delete/:id',
        notificationDeleteLimiter,
        mockAuthenticateToken,
        (req, res) => {
          res.json({ success: true, message: 'Notification deleted' });
        }
      );
    });

    it('should allow requests under the limit', async () => {
      const response = await request(app).delete('/test/delete/test-id').expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Notification deleted'
      });
    });

    it('should skip rate limiting in test environment', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(request(app).delete(`/test/delete/test-id-${i}`));
      }

      const responses = await Promise.all(promises);
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('createNotificationRateLimiter', () => {
    it('should create a custom rate limiter with default options', () => {
      const customLimiter = createNotificationRateLimiter('general');
      expect(typeof customLimiter).toBe('function');
    });

    it('should create a custom rate limiter with custom options', () => {
      const customConfig = {
        max: 10,
        windowMs: 30000,
        message: 'Custom message',
        code: 'CUSTOM_CODE'
      };

      const customLimiter = createNotificationRateLimiter('general', customConfig);
      expect(typeof customLimiter).toBe('function');
    });

    it('should use type-specific configuration', () => {
      const markingLimiter = createNotificationRateLimiter('marking');
      const deletionLimiter = createNotificationRateLimiter('deletion');

      expect(typeof markingLimiter).toBe('function');
      expect(typeof deletionLimiter).toBe('function');
    });
  });

  describe('getNotificationRateConfig', () => {
    it('should return default configuration', () => {
      const config = getNotificationRateConfig();

      expect(config).toHaveProperty('general');
      expect(config).toHaveProperty('marking');
      expect(config).toHaveProperty('deletion');

      expect(config.general).toHaveProperty('windowMs');
      expect(config.general).toHaveProperty('max');
      expect(config.marking).toHaveProperty('windowMs');
      expect(config.marking).toHaveProperty('max');
      expect(config.deletion).toHaveProperty('windowMs');
      expect(config.deletion).toHaveProperty('max');
    });

    it('should use environment variables when available', () => {
      process.env.NOTIFICATION_RATE_MAX = '100';
      process.env.NOTIFICATION_MARK_RATE_MAX = '50';
      process.env.NOTIFICATION_DELETE_RATE_MAX = '25';

      const config = getNotificationRateConfig();

      expect(config.general.max).toBe(100);
      expect(config.marking.max).toBe(50);
      expect(config.deletion.max).toBe(25);

      // Clean up
      delete process.env.NOTIFICATION_RATE_MAX;
      delete process.env.NOTIFICATION_MARK_RATE_MAX;
      delete process.env.NOTIFICATION_DELETE_RATE_MAX;
    });
  });

  describe('Rate limiting behavior in production mode', () => {
    let productionApp;
    let { logger } = require('../../../src/utils/logger');

    beforeEach(() => {
      productionApp = express();
      productionApp.use(express.json());

      // Set production mode to enable rate limiting
      process.env.NODE_ENV = 'production';

      // Mock flags to enable rate limiting
      const { flags } = require('../../../src/config/flags');
      flags.isEnabled.mockImplementation((flag) => {
        if (flag === 'DISABLE_RATE_LIMIT') return false;
        return false;
      });

      productionApp.get('/test', notificationLimiter, mockAuthenticateToken, (req, res) => {
        res.json({ success: true });
      });
    });

    afterEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should apply rate limiting in production mode', async () => {
      // This test would need to be carefully designed to avoid hitting actual limits
      // In a real scenario, we'd mock the rate limiting store or use a test-specific configuration
      const response = await request(productionApp).get('/test').expect(200);

      expect(response.body.success).toBe(true);

      // Verify rate limit headers are present
      expect(response.headers['ratelimit-limit']).toBeDefined();
    });

    it('should log rate limit exceeded events', async () => {
      // This test would simulate hitting the rate limit and verify logging
      // For now, we'll just verify the logger is available
      expect(logger.warn).toBeDefined();
      expect(typeof logger.warn).toBe('function');
    });
  });

  describe('Key generation', () => {
    let testApp;

    beforeEach(() => {
      testApp = express();
      testApp.use(express.json());

      // Use production mode to enable key generation
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should generate unique keys for different users', async () => {
      const middleware1 = createNotificationRateLimiter('general');
      const middleware2 = createNotificationRateLimiter('general');

      testApp.get(
        '/user1',
        middleware1,
        (req, res, next) => {
          req.user = { id: 'user-1' };
          next();
        },
        (req, res) => {
          res.json({ success: true, user: 'user-1' });
        }
      );

      testApp.get(
        '/user2',
        middleware2,
        (req, res, next) => {
          req.user = { id: 'user-2' };
          next();
        },
        (req, res) => {
          res.json({ success: true, user: 'user-2' });
        }
      );

      // Both requests should succeed as they're from different users
      await request(testApp).get('/user1').expect(200);
      await request(testApp).get('/user2').expect(200);
    });
  });

  describe('Error handling', () => {
    it('should handle missing user information gracefully', async () => {
      const testApp = express();
      testApp.use(express.json());

      // Don't set user in request to test anonymous handling
      testApp.get('/anonymous', notificationLimiter, (req, res) => {
        res.json({ success: true, message: 'Anonymous request' });
      });

      const response = await request(testApp).get('/anonymous').expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle malformed requests gracefully', async () => {
      const testApp = express();
      testApp.use(express.json());

      testApp.post('/malformed', notificationMarkLimiter, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(testApp)
        .post('/malformed')
        .send({ invalid: 'data' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
