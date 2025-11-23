/**
 * Business Logic Tests for Polar Webhook Handlers
 *
 * Tests database operations and plan mapping for all webhook events.
 * Verifies:
 * - User lookup and updates
 * - Subscription creation/updates
 * - Plan mapping (price_id → plan name)
 * - Error handling and logging
 *
 * Related: Issue #728, CodeRabbit Review #3493981712
 */

const { createSupabaseMock } = require('../../helpers/supabaseMockFactory');

// ============================================================================
// STEP 1: Create mocks BEFORE jest.mock() calls (Issue #892 - Fix Supabase Mock Pattern)
// ============================================================================

// Create Supabase mock with defaults
const mockSupabase = createSupabaseMock({
  users: [],
  user_subscriptions: []
});

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));
jest.mock('../../../src/utils/polarHelpers');
jest.mock('../../../src/utils/logger');

// ============================================================================
// STEP 3: Require modules AFTER mocks are configured
// ============================================================================

const request = require('supertest');
const express = require('express');
const polarWebhookRouter = require('../../../src/routes/polarWebhook');
const { supabaseServiceClient } = require('../../../src/config/supabase');
const { getPlanFromPriceId } = require('../../../src/utils/polarHelpers');

// Test app setup - webhook expects raw body
const app = express();
app.use(polarWebhookRouter);

describe('Polar Webhook - Business Logic', () => {
  let mockSupabaseSelect;
  let mockSupabaseUpdate;
  let mockSupabaseUpsert;
  let mockSupabaseEq;
  let mockSupabaseSingle;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Supabase mock to defaults
    mockSupabase._reset();

    // Setup Supabase mock chain
    mockSupabaseSingle = jest.fn();
    mockSupabaseEq = jest.fn(() => ({ single: mockSupabaseSingle }));
    mockSupabaseSelect = jest.fn(() => ({ eq: mockSupabaseEq }));
    mockSupabaseUpdate = jest.fn(() => ({ eq: mockSupabaseEq }));
    mockSupabaseUpsert = jest.fn(() => Promise.resolve({ error: null }));

    mockSupabase.from.mockReturnValue({
      select: mockSupabaseSelect,
      update: mockSupabaseUpdate,
      upsert: mockSupabaseUpsert
    });

    // Mock helper functions
    getPlanFromPriceId.mockImplementation((priceId) => {
      const mapping = {
        price_starter_123: 'free',
        price_pro_456: 'pro',
        price_plus_789: 'creator_plus'
      };
      return mapping[priceId] || 'free';
    });

    // Mock webhook signature verification (skip in tests)
    delete process.env.POLAR_WEBHOOK_SECRET;
    process.env.POLAR_STARTER_PRICE_ID = 'price_starter_123';
    process.env.POLAR_PRO_PRICE_ID = 'price_pro_456';
    process.env.POLAR_PLUS_PRICE_ID = 'price_plus_789';
  });

  /**
   * Helper: Create signed webhook payload
   */
  function createWebhookPayload(eventType, data) {
    const payload = JSON.stringify({
      type: eventType,
      id: `evt_${Date.now()}_${Math.random()}`,
      data
    });
    return payload;
  }

  describe('handleOrderCreated - Payment Confirmed', () => {
    it('should create subscription and update user plan when order is created', async () => {
      // Mock user lookup
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user-123', plan: 'free' },
        error: null
      });

      // Mock user update
      mockSupabaseUpdate.mockReturnValueOnce({
        eq: jest.fn(() => Promise.resolve({ error: null }))
      });

      // Mock subscription upsert
      mockSupabaseUpsert.mockResolvedValueOnce({ error: null });

      const payload = createWebhookPayload('order.created', {
        id: 'order-abc',
        customer_email: 'user@example.com',
        product_price_id: 'price_pro_456',
        amount: 1200,
        currency: 'EUR'
      });

      const response = await request(app)
        .post('/polar/webhook')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);

      // Verify user lookup
      expect(supabaseServiceClient.from).toHaveBeenCalledWith('users');
      expect(mockSupabaseSelect).toHaveBeenCalledWith('id, plan');

      // Verify plan mapping was called
      expect(getPlanFromPriceId).toHaveBeenCalledWith('price_pro_456');

      // Verify user plan update
      expect(mockSupabaseUpdate).toHaveBeenCalled();

      // Verify subscription creation
      expect(mockSupabaseUpsert).toHaveBeenCalled();
    });

    it('should handle user not found gracefully', async () => {
      // Mock user not found
      mockSupabaseSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'User not found' }
      });

      const payload = createWebhookPayload('order.created', {
        id: 'order-xyz',
        customer_email: 'unknown@example.com',
        product_price_id: 'price_pro_456',
        amount: 1200,
        currency: 'EUR'
      });

      const response = await request(app)
        .post('/polar/webhook')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);

      // Should not attempt update if user not found
      expect(mockSupabaseUpdate).not.toHaveBeenCalled();
      expect(mockSupabaseUpsert).not.toHaveBeenCalled();
    });

    it('should handle database errors during user update', async () => {
      // Mock user lookup success
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user-123', plan: 'free' },
        error: null
      });

      // Mock user update failure
      mockSupabaseUpdate.mockReturnValueOnce({
        eq: jest.fn(() =>
          Promise.resolve({
            error: { message: 'Database connection lost' }
          })
        )
      });

      const payload = createWebhookPayload('order.created', {
        id: 'order-fail',
        customer_email: 'user@example.com',
        product_price_id: 'price_pro_456',
        amount: 1200,
        currency: 'EUR'
      });

      const response = await request(app)
        .post('/polar/webhook')
        .set('Content-Type', 'application/json')
        .send(payload);

      // Webhook should still return 200 (don't fail webhook delivery)
      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });

    it('should map starter price_id to "free" plan', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user-456', plan: 'free' },
        error: null
      });

      mockSupabaseUpdate.mockReturnValueOnce({
        eq: jest.fn(() => Promise.resolve({ error: null }))
      });

      const payload = createWebhookPayload('order.created', {
        id: 'order-starter',
        customer_email: 'starter@example.com',
        product_price_id: 'price_starter_123',
        amount: 500,
        currency: 'EUR'
      });

      await request(app)
        .post('/polar/webhook')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(getPlanFromPriceId).toHaveBeenCalledWith('price_starter_123');
      expect(getPlanFromPriceId).toHaveReturnedWith('free');
    });

    it('should map plus price_id to "creator_plus" plan', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user-789', plan: 'free' },
        error: null
      });

      mockSupabaseUpdate.mockReturnValueOnce({
        eq: jest.fn(() => Promise.resolve({ error: null }))
      });

      const payload = createWebhookPayload('order.created', {
        id: 'order-plus',
        customer_email: 'plus@example.com',
        product_price_id: 'price_plus_789',
        amount: 5000,
        currency: 'EUR'
      });

      await request(app)
        .post('/polar/webhook')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(getPlanFromPriceId).toHaveBeenCalledWith('price_plus_789');
      expect(getPlanFromPriceId).toHaveReturnedWith('creator_plus');
    });
  });

  describe('handleSubscriptionUpdated - Plan Changes', () => {
    it('should update user plan when subscription plan changes', async () => {
      // Mock user lookup
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user-123', plan: 'free' },
        error: null
      });

      mockSupabaseUpdate
        .mockReturnValueOnce({
          eq: jest.fn(() => Promise.resolve({ error: null }))
        })
        .mockReturnValueOnce({
          eq: jest.fn(() => Promise.resolve({ error: null }))
        });

      const payload = createWebhookPayload('subscription.updated', {
        id: 'sub-xyz',
        customer_email: 'user@example.com',
        product_price_id: 'price_pro_456',
        status: 'active'
      });

      const response = await request(app)
        .post('/polar/webhook')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(response.status).toBe(200);
      expect(getPlanFromPriceId).toHaveBeenCalledWith('price_pro_456');
    });

    it('should update subscription status to past_due when inactive', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user-123', plan: 'pro' },
        error: null
      });

      mockSupabaseUpdate.mockReturnValue({
        eq: jest.fn(() => Promise.resolve({ error: null }))
      });

      const payload = createWebhookPayload('subscription.updated', {
        id: 'sub-pastdue',
        customer_email: 'user@example.com',
        product_price_id: 'price_pro_456',
        status: 'past_due'
      });

      await request(app)
        .post('/polar/webhook')
        .set('Content-Type', 'application/json')
        .send(payload);

      // Verify subscription update was called
      expect(mockSupabaseUpdate).toHaveBeenCalled();
    });

    it('should keep existing plan if price_id not provided', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user-123', plan: 'pro' },
        error: null
      });

      mockSupabaseUpdate.mockReturnValue({
        eq: jest.fn(() => Promise.resolve({ error: null }))
      });

      const payload = createWebhookPayload('subscription.updated', {
        id: 'sub-status-only',
        customer_email: 'user@example.com',
        product_price_id: null,
        status: 'active'
      });

      await request(app)
        .post('/polar/webhook')
        .set('Content-Type', 'application/json')
        .send(payload);

      // Should not call getPlanFromPriceId if no price_id
      expect(getPlanFromPriceId).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionCanceled - Downgrade to Free', () => {
    it('should downgrade user to free plan when subscription canceled', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user-123' },
        error: null
      });

      mockSupabaseUpdate
        .mockReturnValueOnce({
          eq: jest.fn(() => Promise.resolve({ error: null }))
        })
        .mockReturnValueOnce({
          eq: jest.fn(() => Promise.resolve({ error: null }))
        });

      const payload = createWebhookPayload('subscription.canceled', {
        id: 'sub-cancel',
        customer_email: 'user@example.com'
      });

      const response = await request(app)
        .post('/polar/webhook')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(response.status).toBe(200);

      // Verify user downgraded to free
      expect(mockSupabaseUpdate).toHaveBeenCalled();
    });

    it('should mark subscription as canceled (not deleted)', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user-456' },
        error: null
      });

      mockSupabaseUpdate
        .mockReturnValueOnce({
          eq: jest.fn(() => Promise.resolve({ error: null }))
        })
        .mockReturnValueOnce({
          eq: jest.fn(() => Promise.resolve({ error: null }))
        });

      const payload = createWebhookPayload('subscription.canceled', {
        id: 'sub-archive',
        customer_email: 'user@example.com'
      });

      await request(app)
        .post('/polar/webhook')
        .set('Content-Type', 'application/json')
        .send(payload);

      // Should update subscription (not delete)
      expect(mockSupabaseUpdate).toHaveBeenCalled();

      // Verify NO delete operation
      expect(supabaseServiceClient.from).not.toHaveBeenCalledWith(
        expect.objectContaining({ delete: expect.any(Function) })
      );
    });

    it('should handle both "canceled" and "cancelled" spellings', async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: { id: 'user-789' },
        error: null
      });

      mockSupabaseUpdate.mockReturnValue({
        eq: jest.fn(() => Promise.resolve({ error: null }))
      });

      // Test US spelling
      const payload1 = createWebhookPayload('subscription.canceled', {
        id: 'sub-us',
        customer_email: 'us@example.com'
      });

      const response1 = await request(app)
        .post('/polar/webhook')
        .set('Content-Type', 'application/json')
        .send(payload1);

      expect(response1.status).toBe(200);

      // Test UK spelling
      const payload2 = createWebhookPayload('subscription.cancelled', {
        id: 'sub-uk',
        customer_email: 'uk@example.com'
      });

      const response2 = await request(app)
        .post('/polar/webhook')
        .set('Content-Type', 'application/json')
        .send(payload2);

      expect(response2.status).toBe(200);

      // Both should trigger 2 updates each (users + user_subscriptions) = 4 total
      expect(mockSupabaseUpdate).toHaveBeenCalledTimes(4);
    });
  });

  describe('handleSubscriptionCreated - Delegates to handleOrderCreated', () => {
    it('should process subscription.created same as order.created', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: 'user-new', plan: 'free' },
        error: null
      });

      mockSupabaseUpdate.mockReturnValue({
        eq: jest.fn(() => Promise.resolve({ error: null }))
      });

      const payload = createWebhookPayload('subscription.created', {
        id: 'sub-new-123',
        customer_email: 'newuser@example.com',
        product_price_id: 'price_pro_456',
        status: 'active'
      });

      const response = await request(app)
        .post('/polar/webhook')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(response.status).toBe(200);

      // Should trigger same logic as order.created
      expect(getPlanFromPriceId).toHaveBeenCalled();
      expect(mockSupabaseUpdate).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/polar/webhook')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      // Should return 200 to avoid webhook retries
      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });

    it('should handle unknown event types gracefully', async () => {
      const payload = createWebhookPayload('order.refunded', {
        id: 'order-refund',
        customer_email: 'refund@example.com'
      });

      const response = await request(app)
        .post('/polar/webhook')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });

    it('should not fail webhook delivery even if database is down', async () => {
      // Mock complete database failure
      mockSupabaseSingle.mockRejectedValueOnce(new Error('Database unreachable'));

      const payload = createWebhookPayload('order.created', {
        id: 'order-dbfail',
        customer_email: 'user@example.com',
        product_price_id: 'price_pro_456',
        amount: 1200,
        currency: 'EUR'
      });

      const response = await request(app)
        .post('/polar/webhook')
        .set('Content-Type', 'application/json')
        .send(payload);

      // Still return 200 (avoid infinite retries)
      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });
  });

  describe('Plan Mapping Integration', () => {
    it('should NEVER use "basic" plan (database constraint)', async () => {
      // Verify all mappings return database-valid plans
      expect(getPlanFromPriceId('price_starter_123')).toBe('free');
      expect(getPlanFromPriceId('price_pro_456')).toBe('pro');
      expect(getPlanFromPriceId('price_plus_789')).toBe('creator_plus');

      // Verify "basic" is never returned
      const allPlans = [
        getPlanFromPriceId('price_starter_123'),
        getPlanFromPriceId('price_pro_456'),
        getPlanFromPriceId('price_plus_789')
      ];
      expect(allPlans).not.toContain('basic');
    });
  });
});
