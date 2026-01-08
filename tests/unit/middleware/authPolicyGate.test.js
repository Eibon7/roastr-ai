/**
 * @fileoverview Auth Policy Gate Wiring Tests - ROA-523
 * Tests de wiring de Auth → RateLimitPolicyGlobal
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies BEFORE imports
vi.mock('../../../src/services/rateLimitPolicyGlobal', () => ({
  default: vi.fn()
}));
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));
vi.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: vi.fn()
  }
}));

// Import after mocks
const { authPolicyGate } = await import('../../../src/middleware/authPolicyGate.js');
const { AUTH_ACTIONS, AUTH_TYPES } = await import('../../../src/constants/authActions.js');
const { AUTH_ERROR_CODES } = await import('../../../src/errors/authErrors.js');
const RateLimitPolicyGlobalModule = await import('../../../src/services/rateLimitPolicyGlobal.js');
const RateLimitPolicyGlobal = RateLimitPolicyGlobalModule.default;
const { flags } = await import('../../../src/config/flags.js');
const { logger } = await import('../../../src/utils/logger.js');

describe('authPolicyGate - ROA-523', () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      ip: '192.168.1.1',
      body: { email: 'test@example.com' },
      id: 'test-request-id',
      headers: {}
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    next = vi.fn();
    flags.isEnabled.mockReturnValue(true);
  });

  describe('Blocked flows', () => {
    it('blocks login when rate limited (temporary)', async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        allowed: false,
        reason: 'rate_limited',
        block_type: 'temporary',
        retry_after_seconds: 900
      });

      RateLimitPolicyGlobal.mockImplementation(() => ({
        evaluate: mockEvaluate
      }));

      const middleware = authPolicyGate({
        action: AUTH_ACTIONS.LOGIN,
        authType: AUTH_TYPES.PASSWORD
      });

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          code: AUTH_ERROR_CODES.AUTH_RATE_LIMITED,
          retryable: true
        })
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('blocks register when rate limited', async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        allowed: false,
        reason: 'rate_limited',
        block_type: 'temporary',
        retry_after_seconds: 900
      });

      RateLimitPolicyGlobal.mockImplementation(() => ({
        evaluate: mockEvaluate
      }));

      const middleware = authPolicyGate({
        action: AUTH_ACTIONS.REGISTER,
        authType: AUTH_TYPES.PASSWORD
      });

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(next).not.toHaveBeenCalled();
    });

    it('blocks password recovery when rate limited', async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        allowed: false,
        reason: 'rate_limited',
        block_type: 'temporary',
        retry_after_seconds: 3600
      });

      RateLimitPolicyGlobal.mockImplementation(() => ({
        evaluate: mockEvaluate
      }));

      const middleware = authPolicyGate({
        action: AUTH_ACTIONS.PASSWORD_RECOVERY,
        authType: AUTH_TYPES.PASSWORD_RESET
      });

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Feature flag OFF', () => {
    it('bypasses rate limiting when flag is OFF', async () => {
      flags.isEnabled.mockReturnValue(false);

      const mockEvaluate = vi.fn();
      RateLimitPolicyGlobal.mockImplementation(() => ({
        evaluate: mockEvaluate
      }));

      const middleware = authPolicyGate({
        action: AUTH_ACTIONS.LOGIN,
        authType: AUTH_TYPES.PASSWORD
      });

      await middleware(req, res, next);

      expect(mockEvaluate).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Allowed flows', () => {
    it('allows login when policy permits', async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        allowed: true
      });

      RateLimitPolicyGlobal.mockImplementation(() => ({
        evaluate: mockEvaluate
      }));

      const middleware = authPolicyGate({
        action: AUTH_ACTIONS.LOGIN,
        authType: AUTH_TYPES.PASSWORD
      });

      await middleware(req, res, next);

      expect(mockEvaluate).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('allows register when policy permits', async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        allowed: true
      });

      RateLimitPolicyGlobal.mockImplementation(() => ({
        evaluate: mockEvaluate
      }));

      const middleware = authPolicyGate({
        action: AUTH_ACTIONS.REGISTER,
        authType: AUTH_TYPES.PASSWORD
      });

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Fail-open behavior', () => {
    it('allows request when policy throws error', async () => {
      const mockEvaluate = vi.fn().mockRejectedValue(new Error('Redis failed'));

      RateLimitPolicyGlobal.mockImplementation(() => ({
        evaluate: mockEvaluate
      }));

      const middleware = authPolicyGate({
        action: AUTH_ACTIONS.LOGIN,
        authType: AUTH_TYPES.PASSWORD
      });

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'auth_policy_gate_error',
        expect.objectContaining({ behavior: 'fail_open' })
      );
    });
  });
});
