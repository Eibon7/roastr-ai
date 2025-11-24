/**
 * Webhook Security Middleware Tests (Issue #924)
 *
 * Tests for webhook signature verification, idempotency, and security validation
 */

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  },
  SafeUtils: {
    safeString: jest.fn((str, maxLen) => (str ? str.substring(0, maxLen) : ''))
  }
}));

// Mock Supabase
const mockSupabase = {
  from: jest.fn(() => ({
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: { id: '1' }, error: null }))
      }))
    })),
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: null, error: null }))
      }))
    })),
    delete: jest.fn(() => Promise.resolve({ data: [], error: null }))
  }))
};

jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));

// Mock express-rate-limit
// Must work both as default export (require('express-rate-limit'))
// and named export ({ ipKeyGenerator })
const mockIpKeyGenerator = jest.fn((req) => req.ip || '127.0.0.1');

const mockRateLimitFn = jest.fn((options) => {
  // Return a middleware function
  const middleware = (req, res, next) => {
    if (options.skip && options.skip(req)) {
      return next();
    }
    if (options.handler) {
      return options.handler(req, res);
    }
    return next();
  };
  middleware.keyGenerator = options.keyGenerator;
  middleware.skip = options.skip;
  middleware.handler = options.handler;
  return middleware;
});

// Attach ipKeyGenerator as property for named export
mockRateLimitFn.ipKeyGenerator = mockIpKeyGenerator;

jest.mock('express-rate-limit', () => mockRateLimitFn);

const crypto = require('crypto');
const {
  stripeWebhookSecurity,
  genericWebhookSecurity,
  webhookRateLimit,
  verifyStripeSignature,
  checkIdempotency,
  detectSuspiciousWebhookPayload,
  cleanupExpiredIdempotencyRecords
} = require('../../../src/middleware/webhookSecurity');

const { logger } = require('../../../src/utils/logger');

describe('Webhook Security Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'POST',
      path: '/api/webhooks/stripe',
      ip: '127.0.0.1',
      body: Buffer.from(JSON.stringify({ type: 'payment_intent.succeeded', id: 'evt_123' })),
      headers: {
        'user-agent': 'Stripe/1.0',
        'stripe-signature': ''
      },
      get: jest.fn((header) => {
        const headers = {
          'user-agent': 'Stripe/1.0',
          'stripe-signature': ''
        };
        return headers[header.toLowerCase()];
      })
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  });

  describe('verifyStripeSignature', () => {
    test('should verify valid Stripe signature', () => {
      const payload = 'test payload';
      const timestamp = Math.floor(Date.now() / 1000);
      const signedPayload = `${timestamp}.${payload}`;
      const secret = 'whsec_test_secret';
      const signature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload, 'utf8')
        .digest('hex');

      const sigHeader = `t=${timestamp},v1=${signature}`;

      // verifyStripeSignature accepts Buffer or string
      const result = verifyStripeSignature(Buffer.from(payload), sigHeader, secret);

      expect(result.valid).toBe(true);
      expect(result.timestamp).toBe(timestamp);
    });

    test('should reject signature without timestamp', () => {
      const result = verifyStripeSignature('payload', 'v1=signature', 'secret');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('timestamp');
    });

    test('should reject signature with timestamp outside tolerance', () => {
      const payload = 'test payload';
      const timestamp = Math.floor(Date.now() / 1000) - 400; // 400 seconds ago
      const signedPayload = `${timestamp}.${payload}`;
      const secret = 'whsec_test_secret';
      const signature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload, 'utf8')
        .digest('hex');

      const sigHeader = `t=${timestamp},v1=${signature}`;

      const result = verifyStripeSignature(payload, sigHeader, secret);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('tolerance');
    });

    test('should reject invalid signature', () => {
      const payload = 'test payload';
      const timestamp = Math.floor(Date.now() / 1000);
      const sigHeader = `t=${timestamp},v1=invalid_signature`;

      const result = verifyStripeSignature(payload, sigHeader, 'secret');

      expect(result.valid).toBe(false);
    });

    test('should return error for missing signature', () => {
      const result = verifyStripeSignature('payload', null, 'secret');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing');
    });

    test('should return error for missing secret', () => {
      const result = verifyStripeSignature('payload', 'signature', null);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing');
    });
  });

  describe('checkIdempotency', () => {
    test('should return isNew=true for new event', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: { id: '1', idempotency_key: 'evt_123' },
                error: null
              })
            )
          }))
        }))
      });

      const result = await checkIdempotency('evt_123', { type: 'payment' });

      expect(result.isNew).toBe(true);
      expect(result.shouldProcess).toBe(true);
    });

    test('should return isNew=false for duplicate event', async () => {
      // First call - insert fails with unique constraint
      mockSupabase.from
        .mockReturnValueOnce({
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: null,
                  error: { code: '23505' }
                })
              )
            }))
          }))
        })
        .mockReturnValueOnce({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: { id: '1', idempotency_key: 'evt_123' },
                  error: null
                })
              )
            }))
          }))
        });

      const result = await checkIdempotency('evt_123', { type: 'payment' });

      expect(result.isNew).toBe(false);
      expect(result.shouldProcess).toBe(false);
    });

    test('should fail open on database error', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: null,
                error: { code: 'OTHER_ERROR', message: 'DB error' }
              })
            )
          }))
        }))
      });

      const result = await checkIdempotency('evt_123', { type: 'payment' });

      expect(result.isNew).toBe(true);
      expect(result.shouldProcess).toBe(true);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('detectSuspiciousWebhookPayload', () => {
    test('should detect script injection patterns', () => {
      const payload = { data: '<script>alert("xss")</script>' };

      const result = detectSuspiciousWebhookPayload(payload);

      expect(result.isSuspicious).toBe(true);
      expect(result.patterns.length).toBeGreaterThan(0);
    });

    test('should detect JavaScript execution patterns', () => {
      const payload = { data: 'eval("malicious code")' };

      const result = detectSuspiciousWebhookPayload(payload);

      expect(result.isSuspicious).toBe(true);
    });

    test('should detect deep object nesting', () => {
      let deepObj = {};
      let current = deepObj;
      for (let i = 0; i < 25; i++) {
        current.nested = {};
        current = current.nested;
      }

      const result = detectSuspiciousWebhookPayload(deepObj);

      expect(result.isSuspicious).toBe(true);
      expect(result.tooDeep).toBe(true);
    });

    test('should detect large arrays', () => {
      const payload = { items: Array(2000).fill({ id: 1 }) };

      const result = detectSuspiciousWebhookPayload(payload);

      expect(result.isSuspicious).toBe(true);
      expect(result.hasLargeArrays).toBe(true);
    });

    test('should return false for normal payload', () => {
      const payload = { type: 'payment', amount: 100 };

      const result = detectSuspiciousWebhookPayload(payload);

      expect(result.isSuspicious).toBe(false);
    });
  });

  describe('stripeWebhookSecurity middleware', () => {
    test('should reject request without body', async () => {
      req.body = null;
      const middleware = stripeWebhookSecurity();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No request body',
        code: 'MISSING_BODY'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject body too large', async () => {
      req.body = Buffer.alloc(2 * 1024 * 1024); // 2MB
      const middleware = stripeWebhookSecurity();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(413);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Request body too large',
        code: 'BODY_TOO_LARGE'
      });
    });

    test('should reject invalid signature', async () => {
      req.get = jest.fn((header) => {
        if (header === 'stripe-signature') return 't=123,v1=invalid';
        return null;
      });
      const middleware = stripeWebhookSecurity();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid signature',
        code: 'INVALID_SIGNATURE'
      });
    });

    test('should reject invalid JSON', async () => {
      const invalidJson = 'invalid json';
      req.body = Buffer.from(invalidJson);
      const timestamp = Math.floor(Date.now() / 1000);
      // verifyStripeSignature does: timestamp + '.' + payload
      // When payload is Buffer, JS converts: timestamp + '.' + payload.toString()
      // Template string also converts Buffer: `${timestamp}.${payload}`
      const signedPayload = timestamp + '.' + req.body; // Exact match to source code
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      const signature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload, 'utf8')
        .digest('hex');
      req.headers['stripe-signature'] = `t=${timestamp},v1=${signature}`;
      req.get = jest.fn((header) => {
        if (header.toLowerCase() === 'stripe-signature') return `t=${timestamp},v1=${signature}`;
        return null;
      });
      const middleware = stripeWebhookSecurity();

      await middleware(req, res, next);

      // Should fail at JSON parsing, not signature verification
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid JSON payload',
        code: 'INVALID_JSON'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should skip duplicate events', async () => {
      const payload = JSON.stringify({ type: 'payment', id: 'evt_123' });
      req.body = Buffer.from(payload);
      const timestamp = Math.floor(Date.now() / 1000);
      // verifyStripeSignature does: timestamp + '.' + payload (exact match)
      const signedPayload = timestamp + '.' + req.body;
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      const signature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload, 'utf8')
        .digest('hex');
      req.headers['stripe-signature'] = `t=${timestamp},v1=${signature}`;
      req.get = jest.fn((header) => {
        if (header.toLowerCase() === 'stripe-signature') return `t=${timestamp},v1=${signature}`;
        return null;
      });

      // Mock duplicate idempotency check - reset mocks first
      jest.clearAllMocks();
      mockSupabase.from
        .mockReturnValueOnce({
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: null,
                  error: { code: '23505' }
                })
              )
            }))
          }))
        })
        .mockReturnValueOnce({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: { id: '1', idempotency_key: 'evt_123' },
                  error: null
                })
              )
            }))
          }))
        });

      const middleware = stripeWebhookSecurity({ enableIdempotency: true });

      await middleware(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        received: true,
        processed: false,
        idempotent: true,
        message: 'Event already processed'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should pass valid webhook', async () => {
      const payload = JSON.stringify({ type: 'payment', id: 'evt_123' });
      req.body = Buffer.from(payload);
      const timestamp = Math.floor(Date.now() / 1000);
      // verifyStripeSignature does: timestamp + '.' + payload (exact match)
      const signedPayload = timestamp + '.' + req.body;
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      const signature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload, 'utf8')
        .digest('hex');
      req.headers['stripe-signature'] = `t=${timestamp},v1=${signature}`;
      req.get = jest.fn((header) => {
        if (header.toLowerCase() === 'stripe-signature') return `t=${timestamp},v1=${signature}`;
        return null;
      });

      // Reset mocks
      jest.clearAllMocks();
      mockSupabase.from.mockReturnValue({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: { id: '1', idempotency_key: 'evt_123' },
                error: null
              })
            )
          }))
        }))
      });

      const middleware = stripeWebhookSecurity();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.webhookSecurity).toBeDefined();
      expect(req.webhookSecurity.verified).toBe(true);
    });
  });

  describe('genericWebhookSecurity middleware', () => {
    test('should skip signature verification when disabled', () => {
      const middleware = genericWebhookSecurity({ verifySignature: false });

      expect(Array.isArray(middleware)).toBe(true);
      // First middleware is rate limiter (if enabled), second is signature check
      const signatureMiddleware = middleware[middleware.length - 1];
      signatureMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should reject missing signature', () => {
      const middleware = genericWebhookSecurity({
        verifySignature: true,
        secret: 'test_secret',
        enableRateLimit: false // Skip rate limiter for simpler test
      });

      req.headers = {};
      req.get = jest.fn(() => null);

      // Signature middleware is the only one (no rate limiter)
      middleware[0](req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing signature',
        code: 'MISSING_SIGNATURE'
      });
    });

    test('should reject invalid signature', () => {
      const secret = 'test_secret';
      const payload = 'test payload';
      req.body = Buffer.from(payload);
      // genericWebhookSecurity uses req.body directly (line 497: .update(req.body))
      // So we need to ensure the signature matches Buffer conversion
      const expectedSig = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
      // Use a signature with the same length as expected (64 hex chars) but different value
      const invalidSig = 'a'.repeat(64); // 64 hex chars, but wrong value
      req.headers = { 'x-hub-signature-256': `sha256=${invalidSig}` };
      req.get = jest.fn((header) => {
        if (header === 'x-hub-signature-256') return `sha256=${invalidSig}`;
        return null;
      });

      const middleware = genericWebhookSecurity({
        verifySignature: true,
        secret,
        enableRateLimit: false
      });

      middleware[0](req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid signature',
        code: 'INVALID_SIGNATURE'
      });
    });

    test('should accept valid signature', () => {
      const secret = 'test_secret';
      const payload = 'test payload';
      req.body = Buffer.from(payload);
      // genericWebhookSecurity uses req.body directly: .update(req.body)
      // crypto.createHmac().update() accepts Buffer, so this works
      const signature = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
      req.headers = { 'x-hub-signature-256': `sha256=${signature}` };
      req.get = jest.fn((header) => {
        if (header === 'x-hub-signature-256') return `sha256=${signature}`;
        return null;
      });

      const middleware = genericWebhookSecurity({
        verifySignature: true,
        secret,
        enableRateLimit: false
      });

      middleware[0](req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredIdempotencyRecords', () => {
    test('should cleanup expired records', async () => {
      jest.clearAllMocks();
      mockSupabase.from.mockReturnValue({
        delete: jest.fn(() => ({
          lt: jest.fn(() =>
            Promise.resolve({
              data: [{ id: '1' }, { id: '2' }],
              error: null
            })
          )
        }))
      });

      const result = await cleanupExpiredIdempotencyRecords();

      expect(result.success).toBe(true);
      expect(result.recordsDeleted).toBe(2);
      expect(logger.info).toHaveBeenCalledWith(
        'Cleaned up expired idempotency records',
        expect.objectContaining({
          recordsDeleted: 2
        })
      );
    });

    test('should handle cleanup errors', async () => {
      mockSupabase.from.mockReturnValue({
        delete: jest.fn(() =>
          Promise.resolve({
            data: null,
            error: { message: 'DB error' }
          })
        )
      });

      const result = await cleanupExpiredIdempotencyRecords();

      expect(result.success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
