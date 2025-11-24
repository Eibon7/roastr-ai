/**
 * Unit Tests for Zod Billing Validation Schemas
 *
 * Tests:
 * - Checkout schema validation (happy path + errors)
 * - Webhook event schemas (all event types)
 * - Helper functions (formatZodError, validateCheckout, validateWebhook)
 * - Express middleware (validateZodSchema)
 *
 * Coverage: Happy path + Error cases + Edge cases
 *
 * Related: Issue #945 - Migrate Polar billing endpoints to Zod
 */

const {
  checkoutSchema,
  webhookSchema,
  checkoutCreatedSchema,
  orderCreatedSchema,
  subscriptionCreatedSchema,
  subscriptionUpdatedSchema,
  subscriptionCanceledSchema,
  formatZodError,
  validateCheckout,
  validateWebhook,
  validateZodSchema
} = require('../../../src/validators/zod/billing.schema');

describe('Zod Billing Schemas - Unit Tests', () => {
  // ============================================================================
  // Checkout Schema Tests
  // ============================================================================

  describe('checkoutSchema', () => {
    it('should validate valid checkout with product_id', () => {
      const validCheckout = {
        customer_email: 'user@example.com',
        product_id: '550e8400-e29b-41d4-a716-446655440000',
        metadata: { user_id: '123' }
      };

      const result = checkoutSchema.safeParse(validCheckout);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validCheckout);
    });

    it('should validate valid checkout with price_id (legacy fallback)', () => {
      const validCheckout = {
        customer_email: 'user@example.com',
        price_id: '550e8400-e29b-41d4-a716-446655440000'
      };

      const result = checkoutSchema.safeParse(validCheckout);

      expect(result.success).toBe(true);
      expect(result.data.price_id).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should reject checkout with invalid email format', () => {
      const invalidCheckout = {
        customer_email: 'not-an-email',
        product_id: '550e8400-e29b-41d4-a716-446655440000'
      };

      const result = checkoutSchema.safeParse(invalidCheckout);

      expect(result.success).toBe(false);
      expect(result.error.errors[0].path).toContain('customer_email');
      expect(result.error.errors[0].message).toMatch(/invalid/i);
    });

    it('should reject checkout with missing email', () => {
      const invalidCheckout = {
        product_id: '550e8400-e29b-41d4-a716-446655440000'
      };

      const result = checkoutSchema.safeParse(invalidCheckout);

      expect(result.success).toBe(false);
      expect(result.error.errors.some((e) => e.path.includes('customer_email'))).toBe(true);
    });

    it('should reject checkout with invalid UUID in product_id', () => {
      const invalidCheckout = {
        customer_email: 'user@example.com',
        product_id: 'not-a-uuid'
      };

      const result = checkoutSchema.safeParse(invalidCheckout);

      expect(result.success).toBe(false);
      expect(result.error.errors[0].path).toContain('product_id');
      expect(result.error.errors[0].message).toMatch(/uuid/i);
    });

    it('should reject checkout with missing both product_id and price_id', () => {
      const invalidCheckout = {
        customer_email: 'user@example.com'
      };

      const result = checkoutSchema.safeParse(invalidCheckout);

      expect(result.success).toBe(false);
      expect(result.error.errors[0].message).toMatch(/product_id or price_id/i);
    });

    it('should allow optional metadata field', () => {
      const validCheckout = {
        customer_email: 'user@example.com',
        product_id: '550e8400-e29b-41d4-a716-446655440000'
        // No metadata
      };

      const result = checkoutSchema.safeParse(validCheckout);

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Webhook Event Schema Tests
  // ============================================================================

  describe('webhookSchema - checkout.created', () => {
    it('should validate valid checkout.created event', () => {
      const validEvent = {
        type: 'checkout.created',
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          customer_email: 'user@example.com',
          product_id: '770e8400-e29b-41d4-a716-446655440000',
          status: 'open',
          amount: 500,
          currency: 'USD'
        }
      };

      const result = webhookSchema.safeParse(validEvent);

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('checkout.created');
    });

    it('should reject checkout.created with missing customer_email', () => {
      const invalidEvent = {
        type: 'checkout.created',
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          product_id: '770e8400-e29b-41d4-a716-446655440000'
          // Missing customer_email
        }
      };

      const result = webhookSchema.safeParse(invalidEvent);

      expect(result.success).toBe(false);
    });
  });

  describe('webhookSchema - order.created', () => {
    it('should validate valid order.created event (CRITICAL - payment confirmed)', () => {
      const validEvent = {
        type: 'order.created',
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          customer_email: 'user@example.com',
          product_id: '770e8400-e29b-41d4-a716-446655440000',
          amount: 1500,
          currency: 'USD',
          status: 'paid',
          created_at: '2025-11-24T12:00:00Z'
        }
      };

      const result = webhookSchema.safeParse(validEvent);

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('order.created');
      expect(result.data.data.amount).toBe(1500);
    });

    it('should reject order.created with invalid currency (not ISO 4217)', () => {
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

      const result = webhookSchema.safeParse(invalidEvent);

      expect(result.success).toBe(false);
    });

    it('should reject order.created with negative amount', () => {
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

      const result = webhookSchema.safeParse(invalidEvent);

      expect(result.success).toBe(false);
    });

    it('should support product_price_id fallback (legacy)', () => {
      const validEvent = {
        type: 'order.created',
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          customer_email: 'user@example.com',
          product_price_id: '770e8400-e29b-41d4-a716-446655440000', // Legacy field
          amount: 1500,
          currency: 'USD'
        }
      };

      const result = webhookSchema.safeParse(validEvent);

      expect(result.success).toBe(true);
    });
  });

  describe('webhookSchema - subscription.created', () => {
    it('should validate valid subscription.created event', () => {
      const validEvent = {
        type: 'subscription.created',
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          customer_email: 'user@example.com',
          product_id: '770e8400-e29b-41d4-a716-446655440000',
          status: 'active',
          current_period_start: '2025-11-24T00:00:00Z',
          current_period_end: '2025-12-24T00:00:00Z',
          cancel_at_period_end: false
        }
      };

      const result = webhookSchema.safeParse(validEvent);

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('subscription.created');
      expect(result.data.data.status).toBe('active');
    });

    it('should reject subscription.created with invalid status', () => {
      const invalidEvent = {
        type: 'subscription.created',
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          customer_email: 'user@example.com',
          product_id: '770e8400-e29b-41d4-a716-446655440000',
          status: 'unknown_status' // Invalid enum value
        }
      };

      const result = webhookSchema.safeParse(invalidEvent);

      expect(result.success).toBe(false);
    });

    it('should reject subscription.created with invalid datetime format', () => {
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

      const result = webhookSchema.safeParse(invalidEvent);

      expect(result.success).toBe(false);
    });
  });

  describe('webhookSchema - subscription.updated', () => {
    it('should validate valid subscription.updated event', () => {
      const validEvent = {
        type: 'subscription.updated',
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          customer_email: 'user@example.com',
          product_id: '880e8400-e29b-41d4-a716-446655440000', // Plan changed
          status: 'past_due',
          updated_at: '2025-11-24T12:00:00Z'
        }
      };

      const result = webhookSchema.safeParse(validEvent);

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('subscription.updated');
    });
  });

  describe('webhookSchema - subscription.canceled', () => {
    it('should validate valid subscription.canceled event (US spelling)', () => {
      const validEvent = {
        type: 'subscription.canceled',
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          customer_email: 'user@example.com',
          status: 'canceled',
          canceled_at: '2025-11-24T12:00:00Z',
          cancel_at_period_end: true
        }
      };

      const result = webhookSchema.safeParse(validEvent);

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('subscription.canceled');
    });

    it('should validate valid subscription.cancelled event (UK spelling)', () => {
      const validEvent = {
        type: 'subscription.cancelled',
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          customer_email: 'user@example.com',
          status: 'cancelled'
        }
      };

      const result = webhookSchema.safeParse(validEvent);

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('subscription.cancelled');
    });
  });

  describe('webhookSchema - Unknown event type', () => {
    it('should reject webhook with unknown event type', () => {
      const invalidEvent = {
        type: 'unknown.event',
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: {}
      };

      const result = webhookSchema.safeParse(invalidEvent);

      expect(result.success).toBe(false);
    });
  });

  describe('webhookSchema - Invalid UUID in event.id', () => {
    it('should reject webhook with invalid event ID (not UUID)', () => {
      const invalidEvent = {
        type: 'order.created',
        id: 'not-a-uuid',
        data: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          customer_email: 'user@example.com',
          product_id: '770e8400-e29b-41d4-a716-446655440000',
          amount: 1500,
          currency: 'USD'
        }
      };

      const result = webhookSchema.safeParse(invalidEvent);

      expect(result.success).toBe(false);
      expect(result.error.errors[0].path).toContain('id');
    });
  });

  // ============================================================================
  // Helper Function Tests
  // ============================================================================

  describe('formatZodError', () => {
    it('should format Zod error into user-friendly structure', () => {
      const invalidData = {
        customer_email: 'not-an-email',
        product_id: 'not-a-uuid'
      };

      const result = checkoutSchema.safeParse(invalidData);

      expect(result.success).toBe(false);

      const formatted = formatZodError(result.error);

      expect(formatted).toBeInstanceOf(Array);
      expect(formatted.length).toBeGreaterThan(0);
      expect(formatted[0]).toHaveProperty('field');
      expect(formatted[0]).toHaveProperty('message');
      expect(formatted[0]).toHaveProperty('code');
    });

    it('should handle nested path errors correctly', () => {
      const invalidEvent = {
        type: 'order.created',
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          customer_email: 'invalid', // Invalid nested field
          product_id: '770e8400-e29b-41d4-a716-446655440000',
          amount: 1500,
          currency: 'USD'
        }
      };

      const result = webhookSchema.safeParse(invalidEvent);
      const formatted = formatZodError(result.error);

      expect(formatted.some((err) => err.field.includes('data'))).toBe(true);
    });
  });

  describe('validateCheckout', () => {
    it('should return success for valid checkout', () => {
      const validData = {
        customer_email: 'user@example.com',
        product_id: '550e8400-e29b-41d4-a716-446655440000'
      };

      const result = validateCheckout(validData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
    });

    it('should return errors for invalid checkout', () => {
      const invalidData = {
        customer_email: 'not-an-email'
        // Missing product_id and price_id
      };

      const result = validateCheckout(invalidData);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateWebhook', () => {
    it('should return success for valid webhook event', () => {
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

      const result = validateWebhook(validEvent);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.eventType).toBe('order.created');
    });

    it('should return errors for invalid webhook event', () => {
      const invalidEvent = {
        type: 'unknown.event',
        id: 'not-a-uuid',
        data: {}
      };

      const result = validateWebhook(invalidEvent);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('validateZodSchema - Express middleware', () => {
    it('should attach validated data to req.validatedData on success', () => {
      const middleware = validateZodSchema(checkoutSchema, 'body');

      const req = {
        body: {
          customer_email: 'user@example.com',
          product_id: '550e8400-e29b-41d4-a716-446655440000'
        },
        path: '/api/checkout',
        method: 'POST'
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.validatedData).toEqual(req.body);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 400 with formatted errors on validation failure', () => {
      const middleware = validateZodSchema(checkoutSchema, 'body');

      const req = {
        body: {
          customer_email: 'not-an-email'
          // Missing product_id
        },
        path: '/api/checkout',
        method: 'POST'
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          details: expect.any(Array)
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should support query/params validation', () => {
      const querySchema = checkoutSchema;
      const middleware = validateZodSchema(querySchema, 'query');

      const req = {
        query: {
          customer_email: 'user@example.com',
          product_id: '550e8400-e29b-41d4-a716-446655440000'
        },
        path: '/api/checkout',
        method: 'GET'
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.validatedData).toEqual(req.query);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge cases', () => {
    it('should handle empty objects gracefully', () => {
      const result = checkoutSchema.safeParse({});

      expect(result.success).toBe(false);
    });

    it('should handle null values', () => {
      const result = checkoutSchema.safeParse(null);

      expect(result.success).toBe(false);
    });

    it('should handle undefined values', () => {
      const result = checkoutSchema.safeParse(undefined);

      expect(result.success).toBe(false);
    });

    it('should handle extra fields in checkout (should pass with metadata)', () => {
      const validCheckout = {
        customer_email: 'user@example.com',
        product_id: '550e8400-e29b-41d4-a716-446655440000',
        extra_field: 'should-be-ignored' // Not in schema
      };

      const result = checkoutSchema.safeParse(validCheckout);

      // Zod will strip extra fields by default
      expect(result.success).toBe(true);
    });

    it('should handle extremely long email addresses', () => {
      const longEmail = 'a'.repeat(100) + '@example.com';
      const result = checkoutSchema.safeParse({
        customer_email: longEmail,
        product_id: '550e8400-e29b-41d4-a716-446655440000'
      });

      // Zod email validation should handle this
      expect(result.success).toBe(true);
    });

    it('should reject unicode characters in email local part (security)', () => {
      // Unicode in local part (user+tëst) is technically valid per RFC 6531
      // but Zod rejects it for security + compatibility reasons
      const unicodeEmail = 'user+tëst@example.com';
      const result = checkoutSchema.safeParse({
        customer_email: unicodeEmail,
        product_id: '550e8400-e29b-41d4-a716-446655440000'
      });

      // Expected: Zod rejects unicode in local part (we don't support SMTPUTF8)
      expect(result.success).toBe(false);
      expect(result.error.errors[0].path).toContain('customer_email');
    });
  });
});
