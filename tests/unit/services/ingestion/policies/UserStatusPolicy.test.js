/**
 * @fileoverview Unit tests for UserStatusPolicy
 * @since ROA-388
 */

const { describe, it, expect, beforeEach, vi } = require('vitest');
const UserStatusPolicy = require('../../../../../src/services/ingestion/policies/UserStatusPolicy');

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    }))
  }))
}));

// Mock logger
vi.mock('../../../../../src/utils/logger');

describe('UserStatusPolicy', () => {
  let policy;
  let context;
  let mockSupabase;

  beforeEach(() => {
    policy = new UserStatusPolicy();
    context = {
      userId: 'user-123',
      accountId: 'account-456',
      platform: 'x',
      flow: 'timeline',
      requestId: 'req-789'
    };

    // Get mock supabase instance
    const { createClient } = require('@supabase/supabase-js');
    mockSupabase = createClient();

    vi.clearAllMocks();
  });

  describe('evaluate', () => {
    it('should allow ingestion for active users', async () => {
      const mockSingle = mockSupabase.from().select().eq().single;
      mockSingle.mockResolvedValue({
        data: {
          is_suspended: false,
          deleted_at: null
        },
        error: null
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(true);
      expect(result.metadata.status).toBe('active');
      expect(result.reason).toBeUndefined();
    });

    it('should block ingestion for deleted users', async () => {
      const mockSingle = mockSupabase.from().select().eq().single;
      mockSingle.mockResolvedValue({
        data: {
          is_suspended: false,
          deleted_at: '2025-12-20T00:00:00Z'
        },
        error: null
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('user_deleted');
      expect(result.metadata.deleted_at).toBe('2025-12-20T00:00:00Z');
      expect(result.retry_after_seconds).toBeUndefined();
    });

    it('should block ingestion for suspended users', async () => {
      const mockSingle = mockSupabase.from().select().eq().single;
      mockSingle.mockResolvedValue({
        data: {
          is_suspended: true,
          deleted_at: null
        },
        error: null
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('user_suspended');
      expect(result.metadata.is_suspended).toBe(true);
    });

    it('should block when user profile cannot be fetched', async () => {
      const mockSingle = mockSupabase.from().select().eq().single;
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Profile not found' }
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('user_status_unknown');
      expect(result.metadata.error).toBe('Profile not found');
    });

    it('should block on unexpected errors (fail-safe)', async () => {
      const mockSingle = mockSupabase.from().select().eq().single;
      mockSingle.mockRejectedValue(new Error('Database connection failed'));

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('user_status_error');
      expect(result.metadata.error).toBe('Database connection failed');
    });
  });
});
