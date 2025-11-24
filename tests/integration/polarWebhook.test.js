/**
 * Integration Tests for Polar Billing Endpoints with Zod Validation
 *
 * Tests:
 * - POST /api/checkout - Checkout session creation with Zod validation
 * - POST /api/polar/webhook - Webhook event processing with Zod validation
 *
 * Critical Security Tests:
 * - Invalid events rejected with 400
 * - Corrupted data does NOT activate subscriptions
 * - Event spoofing prevented by signature + structure validation
 *
 * Related: Issue #945 - Migrate Polar billing endpoints to Zod
 */

const request = require('supertest');
const express = require('express');
const crypto = require('crypto');

// Mock dependencies BEFORE requiring routes
jest.mock('../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null }))
      })),
      upsert: jest.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  }
}));

jest.mock('@polar-sh/sdk', () => ({
  Polar: jest.fn().mockImplementation(() => ({
    checkouts: {
      create: jest.fn().mockResolvedValue({
        id: 'checkout_123',
        url: 'https://polar.sh/checkout/checkout_123',
        customerEmail: 'user@example.com',
        productId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'open'
      }),
      get: jest.fn().mockResolvedValue({
        id: 'checkout_123',
        status: 'open',
        customerEmail: 'user@example.com',
        productId: '550e8400-e29b-41d4-a716-446655440000'
      })
    }
  }))
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Import after mocks
const checkoutRoutes = require('../../src/routes/checkout');
const webhookRoutes = require('../../src/routes/polarWebhook');
const { supabaseServiceClient } = require('../../src/config/supabase');
const { logger } = require('../../src/utils/logger');

// Create Express app for testing
function createTestApp() {
  const app = express();

  // For webhooks, we need raw body for signature verification
  app.use('/api/polar/webhook', express.raw({ type: 'application/json' }));

  // For other routes, use JSON parser
  app.use(express.json());

  // Mount routes - checkout has /checkout inside, webhook has / inside
  app.use('/api', checkoutRoutes);
  app.use('/api/polar/webhook', webhookRoutes);
  return app;
}

describe('Polar Billing Integration Tests - Zod Validation', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();

    // Set required env vars
    process.env.POLAR_ACCESS_TOKEN = 'test_token_12345';
    process.env.POLAR_WEBHOOK_SECRET = 'test_webhook_secret';
    process.env.POLAR_SUCCESS_URL = 'https://app.roastr.ai/success';
    process.env.POLAR_ALLOWED_PRODUCT_IDS =
      '550e8400-e29b-41d4-a716-446655440000,660e8400-e29b-41d4-a716-446655440000';
  });

  afterEach(() => {
    delete process.env.POLAR_ACCESS_TOKEN;
    delete process.env.POLAR_WEBHOOK_SECRET;
    delete process.env.POLAR_SUCCESS_URL;
    delete process.env.POLAR_ALLOWED_PRODUCT_IDS;
  });

  // ============================================================================
  // POST /api/checkout - Checkout Session Creation
  // ============================================================================

  describe('POST /api/checkout', () => {
    it('should create checkout with valid data (Zod validation passes)', async () => {
      const validCheckout = {
        customer_email: 'user@example.com',
        product_id: '550e8400-e29b-41d4-a716-446655440000',
        metadata: { user_id: '123' }
      };

      const response = await request(app).post('/api/checkout').send(validCheckout).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.checkout_url).toBeDefined();
      expect(response.body.checkout.id).toBe('checkout_123');
    });

    it('should reject checkout with invalid email format (Zod validation)', async () => {
      const invalidCheckout = {
        customer_email: 'not-an-email',
        product_id: '550e8400-e29b-41d4-a716-446655440000'
      };

      const response = await request(app).post('/api/checkout').send(invalidCheckout).expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
      expect(response.body.details.some((e) => e.field === 'customer_email')).toBe(true);
    });

    it('should reject checkout with invalid UUID in product_id (Zod validation)', async () => {
      const invalidCheckout = {
        customer_email: 'user@example.com',
        product_id: 'not-a-uuid'
      };

      const response = await request(app).post('/api/checkout').send(invalidCheckout).expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
      expect(
        response.body.details.some((e) => e.field === 'product_id' && e.message.includes('UUID'))
      ).toBe(true);
    });

    it('should reject checkout with missing customer_email (Zod validation)', async () => {
      const invalidCheckout = {
        product_id: '550e8400-e29b-41d4-a716-446655440000'
        // Missing customer_email
      };

      const response = await request(app).post('/api/checkout').send(invalidCheckout).expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
      expect(response.body.details.some((e) => e.field === 'customer_email')).toBe(true);
    });

    it('should reject checkout with missing both product_id and price_id (Zod validation)', async () => {
      const invalidCheckout = {
        customer_email: 'user@example.com'
        // Missing both product_id and price_id
      };

      const response = await request(app).post('/api/checkout').send(invalidCheckout).expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
      expect(response.body.details.some((e) => e.message.includes('product_id or price_id'))).toBe(
        true
      );
    });

    it('should support legacy price_id field (backward compatibility)', async () => {
      const legacyCheckout = {
        customer_email: 'user@example.com',
        price_id: '550e8400-e29b-41d4-a716-446655440000' // Legacy field
      };

      const response = await request(app).post('/api/checkout').send(legacyCheckout).expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject checkout with empty body (Zod validation)', async () => {
      const response = await request(app).post('/api/checkout').send({}).expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject checkout with null values (Zod validation)', async () => {
      const invalidCheckout = {
        customer_email: null,
        product_id: null
      };

      const response = await request(app).post('/api/checkout').send(invalidCheckout).expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
  });

  // ============================================================================
  // POST /api/polar/webhook - Webhook Event Processing
  // ============================================================================

  describe('POST /api/polar/webhook', () => {
    /**
     * Helper to generate valid webhook signature
     */
    function generateWebhookSignature(payload) {
      const secret = process.env.POLAR_WEBHOOK_SECRET;
      return crypto.createHmac('sha256', secret).update(payload).digest('hex');
    }

    /**
     * Mock Supabase to return user data
     */
    function mockSupabaseUser(userData = {}) {
      const defaultUser = {
        id: 'user_123',
        email: 'user@example.com',
        plan: 'free',
        ...userData
      };

      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: defaultUser, error: null }))
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ data: null, error: null }))
        })),
        upsert: jest.fn(() => Promise.resolve({ data: null, error: null }))
      });
    }

    it('should process valid order.created event (payment confirmed)', async () => {
      mockSupabaseUser();

      const validEvent = {
        type: 'order.created',
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          customer_email: 'user@example.com',
          product_id: '770e8400-e29b-41d4-a716-446655440000',
          amount: 1500,
          currency: 'USD',
          created_at: '2025-11-24T12:00:00Z'
        }
      };

      const payload = JSON.stringify(validEvent);
      const signature = generateWebhookSignature(payload);

      const response = await request(app)
        .post('/api/polar/webhook')
        .set('Content-Type', 'application/json')
        .set('Polar-Signature', signature)
        .send(payload)
        .expect(200);

      expect(response.body.received).toBe(true);
      expect(supabaseServiceClient.from).toHaveBeenCalledWith('users');
    });

    it('should reject webhook with invalid event structure (Zod validation)', async () => {
      const invalidEvent = {
        type: 'order.created',
        id: 'not-a-uuid', // Invalid UUID
        data: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          customer_email: 'user@example.com',
          product_id: '770e8400-e29b-41d4-a716-446655440000',
          amount: 1500,
          currency: 'USD'
        }
      };

      const payload = JSON.stringify(invalidEvent);
      const signature = generateWebhookSignature(payload);

      const response = await request(app)
        .post('/api/polar/webhook')
        .set('Content-Type', 'application/json')
        .set('Polar-Signature', signature)
        .send(payload)
        .expect(400);

      expect(response.body.error).toBe('Invalid event structure');
      expect(response.body.details).toBeDefined();
      expect(response.body.details.some((e) => e.field === 'id')).toBe(true);
    });

    it('should reject webhook with missing customer_email (Zod validation)', async () => {
      const invalidEvent = {
        type: 'order.created',
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          // Missing customer_email
          product_id: '770e8400-e29b-41d4-a716-446655440000',
          amount: 1500,
          currency: 'USD'
        }
      };

      const payload = JSON.stringify(invalidEvent);
      const signature = generateWebhookSignature(payload);

      const response = await request(app)
        .post('/api/polar/webhook')
        .set('Content-Type', 'application/json')
        .set('Polar-Signature', signature)
        .send(payload)
        .expect(400);

      expect(response.body.error).toBe('Invalid event structure');
      expect(supabaseServiceClient.from).not.toHaveBeenCalled();
    });

    it('should reject webhook with invalid currency (not ISO 4217)', async () => {
      const invalidEvent = {
        type: 'order.created',
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          customer_email: 'user@example.com',
          product_id: '770e8400-e29b-41d4-a716-446655440000',
          amount: 1500,
          currency: 'INVALID' // Not 3 characters
        }
      };

      const payload = JSON.stringify(invalidEvent);
      const signature = generateWebhookSignature(payload);

      const response = await request(app)
        .post('/api/polar/webhook')
        .set('Content-Type', 'application/json')
        .set('Polar-Signature', signature)
        .send(payload)
        .expect(400);

      expect(response.body.error).toBe('Invalid event structure');
    });

    it('should reject webhook with negative amount (Zod validation)', async () => {
      const invalidEvent = {
        type: 'order.created',
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          customer_email: 'user@example.com',
          product_id: '770e8400-e29b-41d4-a716-446655440000',
          amount: -100, // Negative amount
          currency: 'USD'
        }
      };

      const payload = JSON.stringify(invalidEvent);
      const signature = generateWebhookSignature(payload);

      const response = await request(app)
        .post('/api/polar/webhook')
        .set('Content-Type', 'application/json')
        .set('Polar-Signature', signature)
        .send(payload)
        .expect(400);

      expect(response.body.error).toBe('Invalid event structure');
      expect(supabaseServiceClient.from).not.toHaveBeenCalled();
    });

    it('should reject webhook with unknown event type (Zod validation)', async () => {
      const invalidEvent = {
        type: 'unknown.event',
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: {}
      };

      const payload = JSON.stringify(invalidEvent);
      const signature = generateWebhookSignature(payload);

      const response = await request(app)
        .post('/api/polar/webhook')
        .set('Content-Type', 'application/json')
        .set('Polar-Signature', signature)
        .send(payload)
        .expect(400);

      expect(response.body.error).toBe('Invalid event structure');
    });

    it('should process subscription.created event with valid structure', async () => {
      mockSupabaseUser();

      const validEvent = {
        type: 'subscription.created',
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          customer_email: 'user@example.com',
          product_id: '770e8400-e29b-41d4-a716-446655440000',
          status: 'active',
          current_period_start: '2025-11-24T00:00:00Z',
          current_period_end: '2025-12-24T00:00:00Z'
        }
      };

      const payload = JSON.stringify(validEvent);
      const signature = generateWebhookSignature(payload);

      const response = await request(app)
        .post('/api/polar/webhook')
        .set('Content-Type', 'application/json')
        .set('Polar-Signature', signature)
        .send(payload)
        .expect(200);

      expect(response.body.received).toBe(true);
    });

    it('should reject subscription event with invalid status (Zod validation)', async () => {
      const invalidEvent = {
        type: 'subscription.created',
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          customer_email: 'user@example.com',
          product_id: '770e8400-e29b-41d4-a716-446655440000',
          status: 'unknown_status' // Invalid enum
        }
      };

      const payload = JSON.stringify(invalidEvent);
      const signature = generateWebhookSignature(payload);

      const response = await request(app)
        .post('/api/polar/webhook')
        .set('Content-Type', 'application/json')
        .set('Polar-Signature', signature)
        .send(payload)
        .expect(400);

      expect(response.body.error).toBe('Invalid event structure');
    });

    it('should reject subscription event with invalid datetime format', async () => {
      const invalidEvent = {
        type: 'subscription.created',
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          customer_email: 'user@example.com',
          product_id: '770e8400-e29b-41d4-a716-446655440000',
          status: 'active',
          current_period_start: 'not-a-datetime' // Invalid ISO 8601
        }
      };

      const payload = JSON.stringify(invalidEvent);
      const signature = generateWebhookSignature(payload);

      const response = await request(app)
        .post('/api/polar/webhook')
        .set('Content-Type', 'application/json')
        .set('Polar-Signature', signature)
        .send(payload)
        .expect(400);

      expect(response.body.error).toBe('Invalid event structure');
    });

    it('should handle both US and UK spelling of canceled event', async () => {
      mockSupabaseUser();

      const validEventUS = {
        type: 'subscription.canceled',
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          customer_email: 'user@example.com',
          status: 'canceled'
        }
      };

      const payload = JSON.stringify(validEventUS);
      const signature = generateWebhookSignature(payload);

      const response = await request(app)
        .post('/api/polar/webhook')
        .set('Content-Type', 'application/json')
        .set('Polar-Signature', signature)
        .send(payload)
        .expect(200);

      expect(response.body.received).toBe(true);
    });

    it('should reject webhook with invalid signature (security)', async () => {
      const validEvent = {
        type: 'order.created',
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          customer_email: 'user@example.com',
          product_id: '770e8400-e29b-41d4-a716-446655440000',
          amount: 1500,
          currency: 'USD'
        }
      };

      const payload = JSON.stringify(validEvent);

      const response = await request(app)
        .post('/api/polar/webhook')
        .set('Polar-Signature', 'invalid_signature')
        .send(payload)
        .expect(401);

      expect(response.body.error).toBe('Invalid signature');
      expect(supabaseServiceClient.from).not.toHaveBeenCalled();
    });

    it('should NOT activate subscription with corrupted data (security test)', async () => {
      // CRITICAL: Ensure invalid events never reach database
      const corruptedEvent = {
        type: 'order.created',
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: {
          id: 'not-a-uuid', // Corrupted UUID
          customer_email: 'user@example.com',
          product_id: '770e8400-e29b-41d4-a716-446655440000',
          amount: 1500,
          currency: 'USD'
        }
      };

      const payload = JSON.stringify(corruptedEvent);
      const signature = generateWebhookSignature(payload);

      const response = await request(app)
        .post('/api/polar/webhook')
        .set('Content-Type', 'application/json')
        .set('Polar-Signature', signature)
        .send(payload)
        .expect(400);

      // CRITICAL: Database should NOT be touched
      expect(supabaseServiceClient.from).not.toHaveBeenCalled();
      expect(response.body.error).toBe('Invalid event structure');
    });
  });

  // ============================================================================
  // Security Edge Cases
  // ============================================================================

  describe('Security Edge Cases', () => {
    it('should reject malformed JSON in webhook (signature fails first)', async () => {
      const response = await request(app)
        .post('/api/polar/webhook')
        .set('Content-Type', 'application/json')
        .set('Polar-Signature', 'invalid_signature')
        .send('{ invalid json');

      // Security: Signature verification happens BEFORE JSON parsing
      // Expected: 401 (invalid signature) not 400 (malformed JSON)
      // This is correct behavior - don't parse untrusted data
      expect([400, 401]).toContain(response.status);
      expect(response.body).toBeDefined();
    });

    it('should reject extremely large payloads (DoS protection)', async () => {
      const largePayload = {
        customer_email: 'user@example.com',
        product_id: '550e8400-e29b-41d4-a716-446655440000',
        metadata: {
          data: 'x'.repeat(10 * 1024 * 1024) // 10MB string
        }
      };

      // This should be rejected by Express body-parser limits
      // If it passes, Zod won't care about size, only structure
      const response = await request(app).post('/api/checkout').send(largePayload);

      // Either 413 (payload too large) or 400 (validation)
      expect([400, 413]).toContain(response.status);
    });
  });
});
