/**
 * Security tests for Polar checkout price_id validation
 *
 * Tests authorization controls:
 * - Rejects unauthorized price_ids (prevents plan manipulation)
 * - Accepts only allowlisted price_ids
 * - Validates against POLAR_ALLOWED_PRODUCT_IDS env var
 *
 * Related to CodeRabbit Review #3421415462 (M1)
 * Security: OWASP Top 10 - Broken Access Control
 */

const request = require('supertest');
const express = require('express');

// Valid price IDs for testing
const VALID_STARTER_ID = 'e242580e-41df-4997-aebe-604492249f39';
const VALID_PRO_ID = 'c1787586-00b7-4790-ba43-1f1e6a60b095';
const VALID_PLUS_ID = '176df9af-337f-4607-9524-48978eae8bea';

// Mock Polar SDK before requiring the router
jest.mock('@polar-sh/sdk', () => {
  return {
    Polar: jest.fn().mockImplementation(() => ({
      checkouts: {
        create: jest.fn().mockResolvedValue({
          url: 'https://polar.sh/checkout/test_checkout_id',
          id: 'test_checkout_id'
        })
      }
    }))
  };
});

describe('Checkout Route - Price ID Security (M1)', () => {
  let app;
  let checkoutRouter;
  let originalPolarAccessToken;
  let originalPolarAllowedPriceIds;

  beforeAll(() => {
    // Save original env vars
    originalPolarAccessToken = process.env.POLAR_ACCESS_TOKEN;
    originalPolarAllowedPriceIds = process.env.POLAR_ALLOWED_PRODUCT_IDS;

    // Set test env vars before loading module
    process.env.POLAR_ACCESS_TOKEN = 'test_token_123';
    process.env.POLAR_ALLOWED_PRODUCT_IDS = `${VALID_STARTER_ID},${VALID_PRO_ID},${VALID_PLUS_ID}`;
  });

  afterAll(() => {
    // Restore original env vars
    if (originalPolarAccessToken === undefined) {
      delete process.env.POLAR_ACCESS_TOKEN;
    } else {
      process.env.POLAR_ACCESS_TOKEN = originalPolarAccessToken;
    }

    if (originalPolarAllowedPriceIds === undefined) {
      delete process.env.POLAR_ALLOWED_PRODUCT_IDS;
    } else {
      process.env.POLAR_ALLOWED_PRODUCT_IDS = originalPolarAllowedPriceIds;
    }
  });

  beforeEach(() => {
    // Clear module cache and reload router
    jest.resetModules();
    checkoutRouter = require('../../../src/routes/checkout');

    // Create fresh Express app
    app = express();
    app.use(express.json());
    app.use('/api', checkoutRouter);
  });

  describe('Authorization Bypass Prevention (CRITICAL)', () => {
    it('should reject completely unauthorized price_id', async () => {
      const UNAUTHORIZED_ID = 'price_unauthorized_attack_xxxxx';

      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer_email: 'attacker@test.com',
          price_id: UNAUTHORIZED_ID
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid price_id');
      expect(res.body.message).toContain('not available');
    });

    it('should reject price_id with SQL injection attempt', async () => {
      const sqlInjectionId = "'; DROP TABLE users; --";

      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer_email: 'attacker@test.com',
          price_id: sqlInjectionId
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid price_id');
    });

    it('should reject empty price_id', async () => {
      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer_email: 'test@test.com',
          price_id: ''
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing required fields');
    });

    it('should reject request without price_id', async () => {
      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer_email: 'test@test.com'
          // Missing price_id
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing required fields');
    });

    it('should enforce case-sensitive price_id matching', async () => {
      const uppercaseId = VALID_STARTER_ID.toUpperCase();

      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer_email: 'test@test.com',
          price_id: uppercaseId
        });

      // Should fail because price IDs are case-sensitive
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid price_id');
    });
  });

  describe('Valid Price ID Acceptance', () => {
    it('should accept valid Starter price_id', async () => {
      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer_email: 'customer@test.com',
          price_id: VALID_STARTER_ID
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('checkout');
      expect(res.body.checkout).toHaveProperty('url');
      expect(res.body.checkout.url).toContain('polar.sh');
    });

    it('should accept valid Pro price_id', async () => {
      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer_email: 'customer@test.com',
          price_id: VALID_PRO_ID
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('checkout');
      expect(res.body.checkout).toHaveProperty('url');
    });

    it('should accept valid Plus price_id', async () => {
      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer_email: 'customer@test.com',
          price_id: VALID_PLUS_ID
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('checkout');
      expect(res.body.checkout).toHaveProperty('url');
    });
  });

  describe('Security Edge Cases', () => {
    it('should prevent price manipulation with similar IDs', async () => {
      // Try with a price_id that's almost valid but slightly different
      const similarId = VALID_STARTER_ID.slice(0, -1) + 'x';

      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer_email: 'attacker@test.com',
          price_id: similarId
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid price_id');
    });

    it('should reject price_id with special characters', async () => {
      const specialCharsId = VALID_STARTER_ID + '?param=value';

      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer_email: 'attacker@test.com',
          price_id: specialCharsId
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid price_id');
    });

    it('should reject null price_id', async () => {
      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer_email: 'test@test.com',
          price_id: null
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing required fields');
    });

    it('should reject undefined price_id', async () => {
      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer_email: 'test@test.com',
          price_id: undefined
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing required fields');
    });
  });

  describe('Metadata Handling', () => {
    it('should preserve metadata in valid requests', async () => {
      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer_email: 'customer@test.com',
          price_id: VALID_STARTER_ID,
          metadata: {
            user_id: 'user_123',
            source: 'web'
          }
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('checkout');
      expect(res.body.checkout).toHaveProperty('url');
    });
  });

  describe('Email Format Validation (M5)', () => {
    it('should reject email without @ symbol', async () => {
      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer_email: 'invalidemailtest.com',
          price_id: VALID_STARTER_ID
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid email');
      expect(res.body.message).toContain('valid email address');
    });

    it('should reject email without domain', async () => {
      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer_email: 'invalid@',
          price_id: VALID_STARTER_ID
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid email');
    });

    it('should accept valid email format', async () => {
      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer_email: 'valid.user@example.com',
          price_id: VALID_STARTER_ID
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('checkout');
      expect(res.body.checkout).toHaveProperty('url');
    });
  });
});
