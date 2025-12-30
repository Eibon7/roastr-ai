/**
 * Auth Policy Gate Tests V2
 *
 * Tests for deterministic policy gate that decides auth action allowance.
 * Tests validate CONTRACTUAL behavior, not implementation details.
 *
 * Policy Order (STRICT CONTRACT):
 * 1. Feature Flags
 * 2. Account Status
 * 3. Rate Limit
 * 4. Abuse
 *
 * Issue: ROA-407 - A3 Auth Policy Wiring v2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock loadSettings
const mockLoadSettings = vi.fn();
vi.mock('../../../src/lib/loadSettings.js', () => ({
  loadSettings: mockLoadSettings
}));

// Mock rateLimitService
const mockRateLimitService = {
  recordAttempt: vi.fn()
};
vi.mock('../../../src/services/rateLimitService.js', () => ({
  rateLimitService: mockRateLimitService
}));

// Mock abuseDetectionServiceAdapter (ROA-408)
const mockAbuseDetectionServiceAdapter = {
  checkRequest: vi.fn()
};
vi.mock('../../../src/services/abuseDetectionServiceAdapter.js', () => ({
  abuseDetectionServiceAdapter: mockAbuseDetectionServiceAdapter
}));

// Mock supabase client
const mockSupabase = {
  from: vi.fn()
};

vi.mock('../../../src/lib/supabaseClient.js', () => ({
  supabase: mockSupabase
}));

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

const { AuthPolicyGate } = await import('../../../src/auth/authPolicyGate.js');

describe('AuthPolicyGate - Contractual Behavior', () => {
  let gate: InstanceType<typeof AuthPolicyGate>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset all mock implementations
    mockRateLimitService.recordAttempt.mockReset();
    mockAbuseDetectionServiceAdapter.checkRequest.mockReset();

    gate = new AuthPolicyGate();

    // Default: all policies allow
    mockLoadSettings.mockResolvedValue({
      feature_flags: {
        enable_user_registration: true,
        ENABLE_RATE_LIMIT: true,
        ENABLE_ABUSE_DETECTION: true
      },
      auth: {
        login: { enabled: true },
        signup: { enabled: true },
        magic_link: { enabled: true }
      }
    });

    mockRateLimitService.recordAttempt.mockReturnValue({
      allowed: true,
      remaining: 4
    });

    mockAbuseDetectionServiceAdapter.checkRequest.mockResolvedValue(false);

    // Mock supabaseAdmin query chain - default: active user
    const mockSelect = vi.fn().mockReturnValue({
      or: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'user-123',
            email: 'user@example.com',
            active: true,
            suspended: false,
            suspended_reason: null
          },
          error: null
        })
      })
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Policy 1: Feature Flags (Highest Priority)', () => {
    it('should allow login when feature flag enabled', async () => {
      const result = await gate.check({
        action: 'login',
        ip: '127.0.0.1',
        email: 'user@example.com'
      });

      expect(result.allowed).toBe(true);
    });

    it('should block login when feature flag disabled', async () => {
      mockLoadSettings.mockResolvedValueOnce({
        feature_flags: {},
        auth: { login: { enabled: false } }
      });

      const result = await gate.check({
        action: 'login',
        ip: '127.0.0.1',
        email: 'user@example.com'
      });

      expect(result.allowed).toBe(false);
      expect(result.policy).toBe('feature_flag');
      expect(result.retryable).toBe(true);
    });

    it('should block register when feature flag disabled', async () => {
      mockLoadSettings.mockResolvedValueOnce({
        feature_flags: { enable_user_registration: false },
        auth: {}
      });

      const result = await gate.check({
        action: 'register',
        ip: '127.0.0.1',
        email: 'new@example.com'
      });

      expect(result.allowed).toBe(false);
      expect(result.policy).toBe('feature_flag');
    });

    it('should fail-closed when settings load fails', async () => {
      mockLoadSettings.mockRejectedValueOnce(new Error('Settings unavailable'));

      const result = await gate.check({
        action: 'login',
        ip: '127.0.0.1'
      });

      expect(result.allowed).toBe(false);
      expect(result.policy).toBe('feature_flag');
      expect(result.retryable).toBe(true);
    });
  });

  describe('Policy 2: Account Status', () => {
    it('should skip account status check for register', async () => {
      const result = await gate.check({
        action: 'register',
        ip: '127.0.0.1',
        email: 'new@example.com'
      });

      expect(result.allowed).toBe(true);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should allow login for active user', async () => {
      const result = await gate.check({
        action: 'login',
        userId: 'user-123',
        ip: '192.168.1.1'
      });

      expect(result.allowed).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
    });

    it('should block login for suspended user', async () => {
      // Mock suspended user
      const mockSelect = vi.fn().mockReturnValue({
        or: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'user-456',
              email: 'suspended@example.com',
              active: true,
              suspended: true,
              suspended_reason: 'Terms of Service violation'
            },
            error: null
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await gate.check({
        action: 'login',
        userId: 'user-456',
        ip: '192.168.1.1'
      });

      expect(result.allowed).toBe(false);
      expect(result.policy).toBe('account_status');
      expect(result.reason).toBe('Terms of Service violation');
      expect(result.retryable).toBe(false);
      expect(result.metadata?.suspended).toBe(true);
    });

    it('should block login for inactive user', async () => {
      // Mock inactive user
      const mockSelect = vi.fn().mockReturnValue({
        or: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'user-789',
              email: 'inactive@example.com',
              active: false,
              suspended: false,
              suspended_reason: null
            },
            error: null
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await gate.check({
        action: 'login',
        userId: 'user-789',
        ip: '192.168.1.1'
      });

      expect(result.allowed).toBe(false);
      expect(result.policy).toBe('account_status');
      expect(result.reason).toBe('Account is inactive');
      expect(result.retryable).toBe(false);
      expect(result.metadata?.active).toBe(false);
    });

    it('should fail-closed if database query fails', async () => {
      // Mock database error
      const mockSelect = vi.fn().mockReturnValue({
        or: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database connection failed' }
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await gate.check({
        action: 'login',
        userId: 'user-error',
        ip: '192.168.1.1'
      });

      expect(result.allowed).toBe(false);
      expect(result.policy).toBe('account_status');
      expect(result.reason).toBe('Unable to verify account status');
      expect(result.retryable).toBe(true);
    });

    it('should fail-closed if account status check throws', async () => {
      // Mock exception during query
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Unexpected database error');
      });

      const result = await gate.check({
        action: 'login',
        userId: 'user-exception',
        ip: '192.168.1.1'
      });

      expect(result.allowed).toBe(false);
      expect(result.policy).toBe('account_status');
      expect(result.reason).toBe('Unable to verify account status');
      expect(result.retryable).toBe(true);
    });

    it('should allow if user is found by email (not userId)', async () => {
      // Mock user found by email
      const mockSelect = vi.fn().mockReturnValue({
        or: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'user-email',
              email: 'email-search@example.com',
              active: true,
              suspended: false,
              suspended_reason: null
            },
            error: null
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await gate.check({
        action: 'login',
        email: 'email-search@example.com',
        ip: '192.168.1.1'
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('Policy 3: Rate Limit', () => {
    it('should allow when rate limit not exceeded', async () => {
      mockRateLimitService.recordAttempt.mockReturnValueOnce({
        allowed: true,
        remaining: 3
      });

      const result = await gate.check({
        action: 'login',
        ip: '127.0.0.1',
        email: 'user@example.com'
      });

      expect(result.allowed).toBe(true);
      expect(mockRateLimitService.recordAttempt).toHaveBeenCalledWith('login', 'user@example.com');
    });

    it('should block when rate limit exceeded', async () => {
      mockRateLimitService.recordAttempt.mockReturnValueOnce({
        allowed: false,
        remaining: 0,
        blockedUntil: Date.now() + 60000
      });

      const result = await gate.check({
        action: 'login',
        ip: '127.0.0.1',
        email: 'user@example.com'
      });

      expect(result.allowed).toBe(false);
      expect(result.policy).toBe('rate_limit');
      expect(result.retryable).toBe(true);
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('should skip rate limit for logout', async () => {
      const result = await gate.check({
        action: 'logout',
        ip: '127.0.0.1'
      });

      expect(result.allowed).toBe(true);
      expect(mockRateLimitService.recordAttempt).not.toHaveBeenCalled();
    });

    it('should fail-closed when rate limit check throws', async () => {
      mockRateLimitService.recordAttempt.mockImplementationOnce(() => {
        throw new Error('Rate limit service error');
      });

      const result = await gate.check({
        action: 'login',
        ip: '127.0.0.1'
      });

      expect(result.allowed).toBe(false);
      expect(result.policy).toBe('rate_limit');
    });
  });

  describe('Policy 4: Abuse (Lowest Priority)', () => {
    it('should allow when no abuse detected', async () => {
      mockAbuseDetectionServiceAdapter.checkRequest.mockResolvedValueOnce(false);

      const result = await gate.check({
        action: 'login',
        ip: '127.0.0.1',
        email: 'user@example.com'
      });

      expect(result.allowed).toBe(true);
      expect(mockAbuseDetectionServiceAdapter.checkRequest).toHaveBeenCalledWith({
        ip: '127.0.0.1',
        email: 'user@example.com',
        userId: undefined,
        action: 'login',
        userAgent: undefined
      });
    });

    it('should block when abuse detected', async () => {
      mockAbuseDetectionServiceAdapter.checkRequest.mockResolvedValueOnce(true);

      const result = await gate.check({
        action: 'login',
        ip: '127.0.0.1',
        email: 'user@example.com'
      });

      expect(result.allowed).toBe(false);
      expect(result.policy).toBe('abuse');
      expect(result.retryable).toBe(false); // Abuse blocks are not retryable
    });

    it('should fail-closed when abuse check fails', async () => {
      mockAbuseDetectionServiceAdapter.checkRequest.mockRejectedValueOnce(
        new Error('Abuse service error')
      );

      const result = await gate.check({
        action: 'login',
        ip: '127.0.0.1'
      });

      expect(result.allowed).toBe(false);
      expect(result.policy).toBe('abuse');
      expect(result.retryable).toBe(true);
    });
  });

  describe('Policy Order Enforcement (STRICT CONTRACT)', () => {
    it('should check Feature Flags first (blocks before other policies)', async () => {
      mockLoadSettings.mockResolvedValueOnce({
        feature_flags: {},
        auth: { login: { enabled: false } }
      });

      // Even if rate limit and abuse would also block
      mockRateLimitService.recordAttempt.mockReturnValueOnce({ allowed: false });
      mockAbuseDetectionServiceAdapter.checkRequest.mockResolvedValueOnce(true);

      const result = await gate.check({
        action: 'login',
        ip: '127.0.0.1'
      });

      expect(result.policy).toBe('feature_flag');
      // Subsequent checks should not have been called
      expect(mockRateLimitService.recordAttempt).not.toHaveBeenCalled();
      expect(mockAbuseDetectionServiceAdapter.checkRequest).not.toHaveBeenCalled();
    });

    it('should check Account Status second (after Feature Flags)', async () => {
      // Feature flags pass
      // Mock suspended user - account status will block
      const mockSelect = vi.fn().mockReturnValue({
        or: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'user-suspended',
              email: 'suspended@example.com',
              active: true,
              suspended: true,
              suspended_reason: 'Policy violation'
            },
            error: null
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      });

      // Rate limit and abuse would also block
      mockRateLimitService.recordAttempt.mockReturnValueOnce({
        allowed: false,
        blockedUntil: Date.now() + 60000
      });
      mockAbuseDetectionServiceAdapter.checkRequest.mockResolvedValueOnce(true);

      const result = await gate.check({
        action: 'login',
        userId: 'user-suspended',
        ip: '127.0.0.1'
      });

      expect(result.policy).toBe('account_status');
      // Subsequent checks should not have been called
      expect(mockRateLimitService.recordAttempt).not.toHaveBeenCalled();
      expect(mockAbuseDetectionServiceAdapter.checkRequest).not.toHaveBeenCalled();
    });

    it('should check Rate Limit third (after Feature Flags and Account Status)', async () => {
      mockRateLimitService.recordAttempt.mockReturnValueOnce({
        allowed: false,
        blockedUntil: Date.now() + 60000
      });

      // Abuse would also block
      mockAbuseDetectionServiceAdapter.checkRequest.mockResolvedValueOnce(true);

      const result = await gate.check({
        action: 'login',
        ip: '127.0.0.1'
      });

      expect(result.policy).toBe('rate_limit');
      // Abuse check should not have been called
      expect(mockAbuseDetectionServiceAdapter.checkRequest).not.toHaveBeenCalled();
    });

    it('should check Abuse last (only if all other policies pass)', async () => {
      // Clear and reconfigure rate limit to explicitly allow
      mockRateLimitService.recordAttempt.mockClear();
      mockRateLimitService.recordAttempt.mockReturnValue({
        allowed: true,
        remaining: 3
      });

      // Abuse blocks
      mockAbuseDetectionServiceAdapter.checkRequest.mockResolvedValueOnce(true);

      const result = await gate.check({
        action: 'login',
        ip: '127.0.0.1',
        email: 'user@example.com'
      });

      expect(result.policy).toBe('abuse');
      // All previous checks should have been called
      expect(mockLoadSettings).toHaveBeenCalled();
      expect(mockRateLimitService.recordAttempt).toHaveBeenCalled();
      expect(mockAbuseDetectionServiceAdapter.checkRequest).toHaveBeenCalled();
    });
  });

  describe('Fail Semantics (STRICT CONTRACT)', () => {
    it('should fail-closed for Feature Flags', async () => {
      mockLoadSettings.mockRejectedValueOnce(new Error());

      const result = await gate.check({ action: 'login', ip: '127.0.0.1' });

      expect(result.allowed).toBe(false);
      expect(result.policy).toBe('feature_flag');
    });

    it('should fail-closed for Rate Limit', async () => {
      mockRateLimitService.recordAttempt.mockImplementationOnce(() => {
        throw new Error();
      });

      const result = await gate.check({ action: 'login', ip: '127.0.0.1' });

      expect(result.allowed).toBe(false);
      expect(result.policy).toBe('rate_limit');
    });

    it('should fail-closed for Abuse', async () => {
      // Rate limit passes
      mockRateLimitService.recordAttempt.mockReturnValueOnce({
        allowed: true,
        remaining: 3
      });

      // Abuse check fails
      mockAbuseDetectionServiceAdapter.checkRequest.mockRejectedValueOnce(new Error());

      const result = await gate.check({ action: 'login', ip: '127.0.0.1' });

      expect(result.allowed).toBe(false);
      expect(result.policy).toBe('abuse');
    });
  });

  describe('Feature Flag Behavior (ROA-408)', () => {
    it('should skip rate limit check when ENABLE_RATE_LIMIT is OFF', async () => {
      mockLoadSettings.mockResolvedValue({
        feature_flags: {
          enable_user_registration: true,
          ENABLE_RATE_LIMIT: false, // Feature flag OFF
          ENABLE_ABUSE_DETECTION: true
        },
        auth: {
          login: { enabled: true }
        }
      });

      // Rate limit would block if checked
      mockRateLimitService.recordAttempt.mockReturnValueOnce({
        allowed: false
      });

      const result = await gate.check({ action: 'login', ip: '127.0.0.1' });

      // Should pass because rate limit was skipped
      expect(result.allowed).toBe(true);
      // recordAttempt should not have been called
      expect(mockRateLimitService.recordAttempt).not.toHaveBeenCalled();
    });

    it('should skip abuse check when ENABLE_ABUSE_DETECTION is OFF', async () => {
      mockLoadSettings.mockResolvedValue({
        feature_flags: {
          enable_user_registration: true,
          ENABLE_RATE_LIMIT: true,
          ENABLE_ABUSE_DETECTION: false // Feature flag OFF
        },
        auth: {
          login: { enabled: true }
        }
      });

      // Rate limit passes
      mockRateLimitService.recordAttempt.mockReturnValueOnce({
        allowed: true,
        remaining: 3
      });

      // Abuse would block if checked
      mockAbuseDetectionServiceAdapter.checkRequest.mockResolvedValueOnce(true);

      const result = await gate.check({ action: 'login', ip: '127.0.0.1' });

      // Should pass because abuse was skipped
      expect(result.allowed).toBe(true);
      // checkRequest should not have been called
      expect(mockAbuseDetectionServiceAdapter.checkRequest).not.toHaveBeenCalled();
    });

    it('should enforce rate limit when ENABLE_RATE_LIMIT is ON', async () => {
      mockLoadSettings.mockResolvedValue({
        feature_flags: {
          enable_user_registration: true,
          ENABLE_RATE_LIMIT: true, // Feature flag ON
          ENABLE_ABUSE_DETECTION: true
        },
        auth: {
          login: { enabled: true }
        }
      });

      // Rate limit blocks
      mockRateLimitService.recordAttempt.mockReturnValueOnce({
        allowed: false,
        blockedUntil: Date.now() + 60000
      });

      const result = await gate.check({ action: 'login', ip: '127.0.0.1' });

      expect(result.allowed).toBe(false);
      expect(result.policy).toBe('rate_limit');
    });

    it('should enforce abuse check when ENABLE_ABUSE_DETECTION is ON', async () => {
      mockLoadSettings.mockResolvedValue({
        feature_flags: {
          enable_user_registration: true,
          ENABLE_RATE_LIMIT: true,
          ENABLE_ABUSE_DETECTION: true // Feature flag ON
        },
        auth: {
          login: { enabled: true }
        }
      });

      // Rate limit passes
      mockRateLimitService.recordAttempt.mockReturnValueOnce({
        allowed: true,
        remaining: 3
      });

      // Abuse blocks
      mockAbuseDetectionServiceAdapter.checkRequest.mockResolvedValueOnce(true);

      const result = await gate.check({ action: 'login', ip: '127.0.0.1' });

      expect(result.allowed).toBe(false);
      expect(result.policy).toBe('abuse');
    });
  });
});
