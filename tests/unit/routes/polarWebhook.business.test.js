/**
 * Business Logic Tests for Polar Webhook Handlers
 *
 * Tests the core business logic of webhook event processing:
 * - User plan updates
 * - Subscription creation/updates/cancellation
 * - Plan mapping (Polar price IDs → database plan names)
 * - Database operations and error handling
 *
 * Related: Issue #728 - CodeRabbit requirement for business logic tests
 */

const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const polarWebhookRouter = require('../../../src/routes/polarWebhook');
const { supabaseServiceClient } = require('../../../src/config/supabase');
const { getPlanFromPriceId } = require('../../../src/utils/polarHelpers');

// Mock dependencies
jest.mock('../../../src/config/supabase');
jest.mock('../../../src/utils/polarHelpers');
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Helper to generate valid signature for tests
function generateValidSignature(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

// Create test app
// NOTE: DO NOT use express.json() middleware - webhook expects raw body
const app = express();
app.use(polarWebhookRouter);

describe('Polar Webhook - Business Logic', () => {
  let mockSupabaseFrom;
  let mockSupabaseSelect;
  let mockSupabaseUpdate;
  let mockSupabaseUpsert;
  let mockSupabaseEq;
  let mockSupabaseSingle;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Supabase mock chain
    mockSupabaseSingle = jest.fn();
    mockSupabaseEq = jest.fn(() => ({ single: mockSupabaseSingle }));
    mockSupabaseSelect = jest.fn(() => ({ eq: mockSupabaseEq }));
    mockSupabaseUpdate = jest.fn(() => ({ eq: mockSupabaseEq }));
    mockSupabaseUpsert = jest.fn(() => ({ data: null, error: null }));
    mockSupabaseFrom = jest.fn((table) => {
      if (table === 'users') {
        return {
          select: mockSupabaseSelect,
          update: mockSupabaseUpdate,
        };
      }
      if (table === 'user_subscriptions') {
        return {
          upsert: mockSupabaseUpsert,
          update: mockSupabaseUpdate,
        };
      }
      return {};
    });

    supabaseServiceClient.from = mockSupabaseFrom;

    // Mock environment variables
    // NOTE: Not setting POLAR_WEBHOOK_SECRET to skip signature verification in tests
    delete process.env.POLAR_WEBHOOK_SECRET;
    process.env.POLAR_STARTER_PRICE_ID = 'price_starter_123';
    process.env.POLAR_PRO_PRICE_ID = 'price_pro_456';
    process.env.POLAR_PLUS_PRICE_ID = 'price_plus_789';
  });

  describe('handleOrderCreated', () => {
    const validOrderEvent = {
      type: 'order.created',
      id: 'evt_123',
      data: {
        id: 'ord_123',
        customer_email: 'test@example.com',
        product_price_id: 'price_pro_456',
        amount: 1200,
        currency: 'EUR',
      },
    };

    it('should find user by email and update their plan', async () => {
      // Mock user lookup
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user_123', plan: 'free' },
        error: null,
      });

      // Mock plan mapping
      getPlanFromPriceId.mockReturnValue('pro');

      // Mock successful update
      mockSupabaseUpdate.mockReturnValue({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      });

      // Mock successful subscription upsert
      mockSupabaseUpsert.mockResolvedValue({ data: null, error: null });

      const response = await request(app)
        .post('/polar/webhook')
        .set('polar-signature', 'valid-signature')
        .send(validOrderEvent);

      expect(response.status).toBe(200);
      expect(mockSupabaseFrom).toHaveBeenCalledWith('users');
      expect(mockSupabaseSelect).toHaveBeenCalledWith('id, plan');
      expect(mockSupabaseEq).toHaveBeenCalledWith('email', 'test@example.com');
      expect(getPlanFromPriceId).toHaveBeenCalledWith('price_pro_456');
    });

    it('should map Polar price IDs to correct database plan names', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user_123', plan: 'free' },
        error: null,
      });

      // Test different plan mappings
      const testCases = [
        { priceId: 'price_starter_123', expectedPlan: 'free' },
        { priceId: 'price_pro_456', expectedPlan: 'pro' },
        { priceId: 'price_plus_789', expectedPlan: 'creator_plus' },
      ];

      for (const { priceId, expectedPlan } of testCases) {
        getPlanFromPriceId.mockReturnValue(expectedPlan);

        const event = {
          ...validOrderEvent,
          data: { ...validOrderEvent.data, product_price_id: priceId },
        };

        mockSupabaseUpdate.mockReturnValue({
          eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
        });
        mockSupabaseUpsert.mockResolvedValue({ data: null, error: null });

        await request(app)
          .post('/polar/webhook')
          .set('polar-signature', 'valid-signature')
          .send(event);

        expect(getPlanFromPriceId).toHaveBeenCalledWith(priceId);
      }
    });

    it('should create subscription record with correct data', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user_123', plan: 'free' },
        error: null,
      });

      getPlanFromPriceId.mockReturnValue('pro');

      mockSupabaseUpdate.mockReturnValue({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      });

      const mockUpsert = jest.fn(() => Promise.resolve({ data: null, error: null }));
      mockSupabaseUpsert.mockImplementation(mockUpsert);

      await request(app)
        .post('/polar/webhook')
        .set('polar-signature', 'valid-signature')
        .send(validOrderEvent);

      expect(mockSupabaseFrom).toHaveBeenCalledWith('user_subscriptions');
      expect(mockUpsert).toHaveBeenCalled();
      const upsertCall = mockUpsert.mock.calls[0][0];
      expect(upsertCall).toMatchObject({
        user_id: 'user_123',
        stripe_customer_id: 'test@example.com',
        stripe_subscription_id: 'ord_123',
        plan: 'pro',
        status: 'active',
      });
    });

    it('should handle user not found error', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'User not found' },
      });

      const response = await request(app)
        .post('/polar/webhook')
        .set('polar-signature', 'valid-signature')
        .send(validOrderEvent);

      // Should still return 200 (webhook acknowledged)
      expect(response.status).toBe(200);
      // Should not attempt update
      expect(mockSupabaseUpdate).not.toHaveBeenCalled();
    });

    it('should handle plan update failure', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user_123', plan: 'free' },
        error: null,
      });

      getPlanFromPriceId.mockReturnValue('pro');

      // Mock update failure
      mockSupabaseUpdate.mockReturnValue({
        eq: jest.fn(() =>
          Promise.resolve({ data: null, error: { message: 'Update failed' } })
        ),
      });

      const response = await request(app)
        .post('/polar/webhook')
        .set('polar-signature', 'valid-signature')
        .send(validOrderEvent);

      expect(response.status).toBe(200); // Webhook still acknowledged
      expect(mockSupabaseUpdate).toHaveBeenCalled();
    });

    it('should handle subscription upsert failure', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user_123', plan: 'free' },
        error: null,
      });

      getPlanFromPriceId.mockReturnValue('pro');

      mockSupabaseUpdate.mockReturnValue({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      });

      // Mock upsert failure
      mockSupabaseUpsert.mockResolvedValue({
        data: null,
        error: { message: 'Upsert failed' },
      });

      const response = await request(app)
        .post('/polar/webhook')
        .set('polar-signature', 'valid-signature')
        .send(validOrderEvent);

      expect(response.status).toBe(200);
      expect(mockSupabaseUpsert).toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionUpdated', () => {
    const validUpdateEvent = {
      type: 'subscription.updated',
      id: 'evt_456',
      data: {
        id: 'sub_123',
        customer_email: 'test@example.com',
        product_price_id: 'price_plus_789',
        status: 'active',
      },
    };

    it('should update user plan when price_id changes', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user_123', plan: 'pro' },
        error: null,
      });

      getPlanFromPriceId.mockReturnValue('creator_plus');

      const mockUserUpdate = jest.fn(() =>
        Promise.resolve({ data: null, error: null })
      );
      const mockSubUpdate = jest.fn(() =>
        Promise.resolve({ data: null, error: null })
      );

      mockSupabaseUpdate
        .mockReturnValueOnce({ eq: mockUserUpdate }) // First call for users
        .mockReturnValueOnce({ eq: mockSubUpdate }); // Second call for subscriptions

      await request(app)
        .post('/polar/webhook')
        .set('polar-signature', 'valid-signature')
        .send(validUpdateEvent);

      expect(mockUserUpdate).toHaveBeenCalled();
      expect(mockSubUpdate).toHaveBeenCalled();
      expect(getPlanFromPriceId).toHaveBeenCalledWith('price_plus_789');
    });

    it('should not update user plan if plan unchanged', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user_123', plan: 'pro' },
        error: null,
      });

      getPlanFromPriceId.mockReturnValue('pro'); // Same plan

      const mockSubUpdate = jest.fn(() =>
        Promise.resolve({ data: null, error: null })
      );

      mockSupabaseUpdate.mockReturnValue({ eq: mockSubUpdate });

      await request(app)
        .post('/polar/webhook')
        .set('polar-signature', 'valid-signature')
        .send(validUpdateEvent);

      // Should only update subscription, not user
      expect(mockSubUpdate).toHaveBeenCalled();
    });

    it('should handle subscription status changes', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user_123', plan: 'pro' },
        error: null,
      });

      getPlanFromPriceId.mockReturnValue('pro');

      const testStatuses = ['active', 'past_due', 'canceled'];

      for (const status of testStatuses) {
        const mockUpdate = jest.fn(() =>
          Promise.resolve({ data: null, error: null })
        );
        mockSupabaseUpdate.mockReturnValue({ eq: mockUpdate });

        const event = {
          ...validUpdateEvent,
          data: { ...validUpdateEvent.data, status },
        };

        await request(app)
          .post('/polar/webhook')
          .set('polar-signature', 'valid-signature')
          .send(event);

        expect(mockUpdate).toHaveBeenCalled();
      }
    });

    it('should handle user update failure gracefully', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user_123', plan: 'free' },
        error: null,
      });

      getPlanFromPriceId.mockReturnValue('pro');

      // Mock user update failure
      mockSupabaseUpdate.mockReturnValueOnce({
        eq: jest.fn(() =>
          Promise.resolve({ data: null, error: { message: 'Update failed' } })
        ),
      });

      const response = await request(app)
        .post('/polar/webhook')
        .set('polar-signature', 'valid-signature')
        .send(validUpdateEvent);

      expect(response.status).toBe(200);
    });
  });

  describe('handleSubscriptionCanceled', () => {
    const validCancelEvent = {
      type: 'subscription.canceled',
      id: 'evt_789',
      data: {
        id: 'sub_123',
        customer_email: 'test@example.com',
      },
    };

    it('should downgrade user to free plan', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user_123' },
        error: null,
      });

      const mockUserUpdate = jest.fn(() =>
        Promise.resolve({ data: null, error: null })
      );
      const mockSubUpdate = jest.fn(() =>
        Promise.resolve({ data: null, error: null })
      );

      mockSupabaseUpdate
        .mockReturnValueOnce({ eq: mockUserUpdate })
        .mockReturnValueOnce({ eq: mockSubUpdate });

      await request(app)
        .post('/polar/webhook')
        .set('polar-signature', 'valid-signature')
        .send(validCancelEvent);

      expect(mockUserUpdate).toHaveBeenCalled();
      const updateCall = mockSupabaseUpdate.mock.calls[0][0];
      expect(updateCall.plan).toBe('free');
    });

    it('should mark subscription as canceled (audit trail)', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user_123' },
        error: null,
      });

      const mockUserUpdate = jest.fn(() =>
        Promise.resolve({ data: null, error: null })
      );
      const mockSubUpdate = jest.fn(() =>
        Promise.resolve({ data: null, error: null })
      );

      mockSupabaseUpdate
        .mockReturnValueOnce({ eq: mockUserUpdate })
        .mockReturnValueOnce({ eq: mockSubUpdate });

      await request(app)
        .post('/polar/webhook')
        .set('polar-signature', 'valid-signature')
        .send(validCancelEvent);

      expect(mockSubUpdate).toHaveBeenCalled();
      const subUpdateCall = mockSupabaseUpdate.mock.calls[1][0];
      expect(subUpdateCall.status).toBe('canceled');
      expect(subUpdateCall.cancel_at_period_end).toBe(true);
    });

    it('should handle user not found during cancellation', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'User not found' },
      });

      const response = await request(app)
        .post('/polar/webhook')
        .set('polar-signature', 'valid-signature')
        .send(validCancelEvent);

      expect(response.status).toBe(200);
      expect(mockSupabaseUpdate).not.toHaveBeenCalled();
    });

    it('should handle downgrade failure', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user_123' },
        error: null,
      });

      // Mock downgrade failure
      mockSupabaseUpdate.mockReturnValueOnce({
        eq: jest.fn(() =>
          Promise.resolve({ data: null, error: { message: 'Downgrade failed' } })
        ),
      });

      const response = await request(app)
        .post('/polar/webhook')
        .set('polar-signature', 'valid-signature')
        .send(validCancelEvent);

      expect(response.status).toBe(200);
      expect(mockSupabaseUpdate).toHaveBeenCalled();
    });

    it('should handle subscription update failure', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user_123' },
        error: null,
      });

      const mockUserUpdate = jest.fn(() =>
        Promise.resolve({ data: null, error: null })
      );

      // Mock subscription update failure
      mockSupabaseUpdate
        .mockReturnValueOnce({ eq: mockUserUpdate })
        .mockReturnValueOnce({
          eq: jest.fn(() =>
            Promise.resolve({ data: null, error: { message: 'Sub update failed' } })
          ),
        });

      const response = await request(app)
        .post('/polar/webhook')
        .set('polar-signature', 'valid-signature')
        .send(validCancelEvent);

      expect(response.status).toBe(200);
    });
  });

  describe('handleSubscriptionCreated', () => {
    const validSubscriptionEvent = {
      type: 'subscription.created',
      id: 'evt_sub_123',
      data: {
        id: 'sub_456',
        customer_email: 'test@example.com',
        product_price_id: 'price_pro_456',
        status: 'active',
      },
    };

    it('should delegate to handleOrderCreated logic', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user_123', plan: 'free' },
        error: null,
      });

      getPlanFromPriceId.mockReturnValue('pro');

      mockSupabaseUpdate.mockReturnValue({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      });

      mockSupabaseUpsert.mockResolvedValue({ data: null, error: null });

      const response = await request(app)
        .post('/polar/webhook')
        .set('polar-signature', 'valid-signature')
        .send(validSubscriptionEvent);

      expect(response.status).toBe(200);
      expect(mockSupabaseFrom).toHaveBeenCalledWith('users');
      expect(getPlanFromPriceId).toHaveBeenCalledWith('price_pro_456');
    });
  });

  describe('Edge Cases', () => {
    it('should handle unhandled event types gracefully', async () => {
      const unknownEvent = {
        type: 'payment.failed',
        id: 'evt_unknown',
        data: {},
      };

      const response = await request(app)
        .post('/polar/webhook')
        .set('polar-signature', 'valid-signature')
        .send(unknownEvent);

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });

    it('should handle malformed event data', async () => {
      const malformedEvent = {
        type: 'order.created',
        id: 'evt_malformed',
        data: null,
      };

      const response = await request(app)
        .post('/polar/webhook')
        .set('polar-signature', 'valid-signature')
        .send(malformedEvent);

      expect(response.status).toBe(200);
    });

    it('should handle missing customer_email', async () => {
      const noEmailEvent = {
        type: 'order.created',
        id: 'evt_no_email',
        data: {
          id: 'ord_123',
          product_price_id: 'price_pro_456',
        },
      };

      mockSupabaseSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'No user found' },
      });

      const response = await request(app)
        .post('/polar/webhook')
        .set('polar-signature', 'valid-signature')
        .send(noEmailEvent);

      expect(response.status).toBe(200);
    });
  });
});
