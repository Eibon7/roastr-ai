/**
 * @fileoverview Unit tests for SubscriptionPolicy
 * @since ROA-388
 */

const { describe, it, expect, beforeEach, vi } = require('vitest');
const SubscriptionPolicy = require('../../../../../src/services/ingestion/policies/SubscriptionPolicy');

// Mock supabaseServiceClient
vi.mock('../../../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      }))
    }))
  }
}));

// Mock logger
vi.mock('../../../../../src/utils/logger');

describe('SubscriptionPolicy', () => {
  let policy;
  let context;
  let mockSupabase;

  beforeEach(() => {
    policy = new SubscriptionPolicy();
    context = {
      userId: 'user-123',
      accountId: 'account-456',
      platform: 'x',
      flow: 'timeline',
      requestId: 'req-789'
    };

    // Get mock supabase instance
    const { supabaseServiceClient } = require('../../../../../src/config/supabase');
    mockSupabase = supabaseServiceClient;

    vi.clearAllMocks();
  });

  describe('evaluate', () => {
    it('should allow ingestion for active subscription', async () => {
      const mockSingle = mockSupabase.from().select().eq().eq().single;
      mockSingle.mockResolvedValue({
        data: {
          status: 'active',
          current_period_end: '2025-12-31T23:59:59Z'
        },
        error: null
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(true);
      expect(result.metadata.status).toBe('active');
      expect(result.reason).toBeUndefined();
    });

    it('should allow ingestion for trialing subscription', async () => {
      const mockSingle = mockSupabase.from().select().eq().eq().single;
      mockSingle.mockResolvedValue({
        data: {
          status: 'trialing',
          current_period_end: '2025-12-31T23:59:59Z'
        },
        error: null
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(true);
      expect(result.metadata.status).toBe('trialing');
    });

    it('should allow canceled_pending within paid period', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const mockSingle = mockSupabase.from().select().eq().eq().single;
      mockSingle.mockResolvedValue({
        data: {
          status: 'canceled_pending',
          current_period_end: futureDate
        },
        error: null
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(true);
      expect(result.metadata.status).toBe('canceled_pending');
      expect(result.metadata.period_ends).toBe(futureDate);
    });

    it('should block canceled_pending after paid period', async () => {
      const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const mockSingle = mockSupabase.from().select().eq().eq().single;
      mockSingle.mockResolvedValue({
        data: {
          status: 'canceled_pending',
          current_period_end: pastDate
        },
        error: null
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('subscription_inactive');
      expect(result.metadata.status).toBe('canceled_pending');
      expect(result.metadata.period_ended).toBe(pastDate);
    });

    it('should block paused subscription', async () => {
      const mockSingle = mockSupabase.from().select().eq().eq().single;
      mockSingle.mockResolvedValue({
        data: {
          status: 'paused',
          current_period_end: '2025-12-31T23:59:59Z'
        },
        error: null
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('subscription_inactive');
      expect(result.metadata.status).toBe('paused');
    });

    it('should block expired_trial_pending_payment', async () => {
      const mockSingle = mockSupabase.from().select().eq().eq().single;
      mockSingle.mockResolvedValue({
        data: {
          status: 'expired_trial_pending_payment',
          current_period_end: '2025-12-31T23:59:59Z'
        },
        error: null
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('subscription_inactive');
      expect(result.metadata.status).toBe('expired_trial_pending_payment');
    });

    it('should block payment_retry', async () => {
      const mockSingle = mockSupabase.from().select().eq().eq().single;
      mockSingle.mockResolvedValue({
        data: {
          status: 'payment_retry',
          current_period_end: '2025-12-31T23:59:59Z'
        },
        error: null
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('subscription_inactive');
      expect(result.metadata.status).toBe('payment_retry');
    });

    it('should allow when no subscription found (PGRST116)', async () => {
      const mockSingle = mockSupabase.from().select().eq().eq().single;
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' }
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(true);
      expect(result.metadata.status).toBe('no_subscription');
    });

    it('should block on verification error (non-PGRST116)', async () => {
      const mockSingle = mockSupabase.from().select().eq().eq().single;
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST500', message: 'Database error' }
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('subscription_verification_error');
      expect(result.metadata.error).toBe('Database error');
      expect(result.metadata.code).toBe('PGRST500');
    });

    it('should block on unexpected errors (fail-safe)', async () => {
      const mockSingle = mockSupabase.from().select().eq().eq().single;
      mockSingle.mockRejectedValue(new Error('Network timeout'));

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('subscription_policy_error');
      expect(result.metadata.error).toBe('Network timeout');
    });

    it('should block on unknown subscription status (fail-safe)', async () => {
      const mockSingle = mockSupabase.from().select().eq().eq().single;
      mockSingle.mockResolvedValue({
        data: {
          status: 'unknown_status',
          current_period_end: '2025-12-31T23:59:59Z'
        },
        error: null
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('subscription_status_unknown');
      expect(result.metadata.status).toBe('unknown_status');
    });
  });
});
