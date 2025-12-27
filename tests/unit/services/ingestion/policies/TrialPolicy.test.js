/**
 * @fileoverview Unit tests for TrialPolicy
 * @since ROA-388
 */

const { describe, it, expect, beforeEach, vi } = require('vitest');
const TrialPolicy = require('../../../../../src/services/ingestion/policies/TrialPolicy');

// Mock supabaseServiceClient
vi.mock('../../../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    }))
  }
}));

// Mock logger
vi.mock('../../../../../src/utils/logger');

describe('TrialPolicy', () => {
  let policy;
  let context;
  let mockSupabase;

  beforeEach(() => {
    policy = new TrialPolicy();
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
    it('should allow when trial is active (future trial_ends_at)', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Mock profile query
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                current_plan: 'starter',
                trial_ends_at: futureDate
              },
              error: null
            })
          }))
        }))
      });

      // Mock subscription query
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
              })
            }))
          }))
        }))
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(true);
      expect(result.metadata.trial_active).toBe(true);
      expect(result.metadata.trial_ends_at).toBe(futureDate);
    });

    it('should block when trial is expired (past trial_ends_at)', async () => {
      const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Mock profile query
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                current_plan: 'starter',
                trial_ends_at: pastDate
              },
              error: null
            })
          }))
        }))
      });

      // Mock subscription query
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
              })
            }))
          }))
        }))
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('trial_expired');
      expect(result.metadata.trial_ended_at).toBe(pastDate);
    });

    it('should allow when no trial configured (trial_ends_at null)', async () => {
      // Mock profile query
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                current_plan: 'plus',
                trial_ends_at: null
              },
              error: null
            })
          }))
        }))
      });

      // Mock subscription query
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
              })
            }))
          }))
        }))
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(true);
      expect(result.metadata.trial_applicable).toBe(false);
      expect(result.metadata.reason).toBe('no_trial_configured');
    });

    it('should allow when active subscription exists (overrides trial)', async () => {
      const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Mock profile query
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                current_plan: 'starter',
                trial_ends_at: pastDate // Expired trial
              },
              error: null
            })
          }))
        }))
      });

      // Mock subscription query - has active subscription
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  status: 'active'
                },
                error: null
              })
            }))
          }))
        }))
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(true);
      expect(result.metadata.trial_applicable).toBe(false);
      expect(result.metadata.reason).toBe('active_subscription');
    });

    it('should block on profile fetch error (fail-safe)', async () => {
      // Mock profile query with error
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          }))
        }))
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('trial_verification_error');
      expect(result.metadata.error).toBe('Database error');
    });

    it('should continue gracefully on subscription check error', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Mock profile query
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                current_plan: 'starter',
                trial_ends_at: futureDate
              },
              error: null
            })
          }))
        }))
      });

      // Mock subscription query with non-PGRST116 error
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST500', message: 'Database timeout' }
              })
            }))
          }))
        }))
      });

      const result = await policy.evaluate(context);

      // Should continue with trial check despite subscription error
      expect(result.allowed).toBe(true);
      expect(result.metadata.trial_active).toBe(true);
    });

    it('should block on unexpected errors (fail-safe)', async () => {
      // Mock profile query with exception
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockRejectedValue(new Error('Network timeout'))
          }))
        }))
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('trial_policy_error');
      expect(result.metadata.error).toBe('Network timeout');
    });
  });
});
