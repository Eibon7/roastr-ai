/**
 * Policy Observability - Unit Tests (ROA-396)
 *
 * Valida el contrato del evento policy_decision_made:
 * - Evento se emite correctamente
 * - Reason es slug estable (NO mensaje humano)
 * - retryable es booleano correcto
 * - NO hay PII en payload
 * - Logs estructurados tienen nivel correcto
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  emitPolicyDecision,
  emitFeatureFlagDecision,
  emitRateLimitDecision,
  emitAuthPolicyGateDecision,
  type PolicyDecisionEvent
} from '../../../src/lib/policyObservability';

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Mock analytics
vi.mock('../../../src/lib/analytics', () => ({
  getAmplitudeClient: vi.fn(() => ({
    track: vi.fn()
  }))
}));

// Import mocked modules
import { logger } from '../../../src/utils/logger';
import { getAmplitudeClient } from '../../../src/lib/analytics';

describe('Policy Observability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('emitPolicyDecision', () => {
    it('emite evento cuando decision: allowed', async () => {
      const event: PolicyDecisionEvent = {
        flow: 'login',
        policy: 'feature_flag',
        decision: 'allowed',
        retryable: false,
        request_id: 'test-request-123'
      };

      emitPolicyDecision(event);

      // Esperar a que setImmediate ejecute
      await new Promise((resolve) => setImmediate(resolve));

      // Logger debe llamar info (NO warn)
      expect(logger.info).toHaveBeenCalledWith(
        'Policy decision: allowed',
        expect.objectContaining({
          event: 'auth.policy.decision',
          flow: 'login',
          policy: 'feature_flag',
          decision: 'allowed',
          retryable: false,
          request_id: 'test-request-123'
        })
      );

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('emite evento cuando decision: blocked con reason', async () => {
      const event: PolicyDecisionEvent = {
        flow: 'register',
        policy: 'rate_limit',
        decision: 'blocked',
        reason: 'rate_limit_exceeded',
        retryable: true,
        request_id: 'test-request-456'
      };

      emitPolicyDecision(event);

      await new Promise((resolve) => setImmediate(resolve));

      // Logger debe llamar warn (NO info)
      expect(logger.warn).toHaveBeenCalledWith(
        'Policy decision: blocked',
        expect.objectContaining({
          event: 'auth.policy.decision',
          flow: 'register',
          policy: 'rate_limit',
          decision: 'blocked',
          reason: 'rate_limit_exceeded',
          retryable: true,
          request_id: 'test-request-456'
        })
      );

      expect(logger.info).not.toHaveBeenCalled();
    });

    it('reason es slug estable (NO mensaje humano)', async () => {
      const event: PolicyDecisionEvent = {
        flow: 'login',
        policy: 'feature_flag',
        decision: 'blocked',
        reason: 'feature_disabled',
        retryable: true,
        request_id: 'test-request-789'
      };

      emitPolicyDecision(event);

      await new Promise((resolve) => setImmediate(resolve));

      // Verificar que reason es slug (snake_case, sin espacios)
      const warnCalls = vi.mocked(logger.warn).mock.calls;
      expect(warnCalls.length).toBeGreaterThan(0);

      const logPayload = warnCalls[0][1];

      expect(logPayload.reason).toBe('feature_disabled');
      expect(logPayload.reason).toMatch(/^[a-z_]+$/); // Solo snake_case
      expect(logPayload.reason).not.toContain(' '); // Sin espacios
    });

    it('retryable es booleano correcto', async () => {
      const event: PolicyDecisionEvent = {
        flow: 'password_recovery',
        policy: 'auth_policy_gate',
        decision: 'blocked',
        reason: 'policy_check_failed',
        retryable: false,
        request_id: 'test-request-abc'
      };

      emitPolicyDecision(event);

      await new Promise((resolve) => setImmediate(resolve));

      const warnCalls = vi.mocked(logger.warn).mock.calls;
      const logPayload = warnCalls[0][1];

      expect(logPayload.retryable).toBe(false);
      expect(typeof logPayload.retryable).toBe('boolean');
    });

    it('NO hay PII en payload (email, password, tokens)', async () => {
      const event: PolicyDecisionEvent = {
        flow: 'login',
        policy: 'feature_flag',
        decision: 'blocked',
        reason: 'feature_disabled',
        retryable: true,
        request_id: 'test-request-def'
      };

      emitPolicyDecision(event);

      await new Promise((resolve) => setImmediate(resolve));

      const warnCalls = vi.mocked(logger.warn).mock.calls;
      const logPayload = warnCalls[0][1];

      // Verificar que NO hay PII en logs
      expect(logPayload).not.toHaveProperty('email');
      expect(logPayload).not.toHaveProperty('password');
      expect(logPayload).not.toHaveProperty('token');
      expect(logPayload).not.toHaveProperty('access_token');
      expect(logPayload).not.toHaveProperty('user_id');
      expect(logPayload).not.toHaveProperty('username');
    });

    it('no lanza error si Amplitude no está disponible', async () => {
      // Mock Amplitude como null
      vi.mocked(getAmplitudeClient).mockReturnValueOnce(null);

      const event: PolicyDecisionEvent = {
        flow: 'login',
        policy: 'feature_flag',
        decision: 'allowed',
        retryable: false,
        request_id: 'test-request-xyz'
      };

      // NO debe lanzar error
      expect(() => emitPolicyDecision(event)).not.toThrow();

      await new Promise((resolve) => setImmediate(resolve));

      // Logger debe funcionar igual
      expect(logger.info).toHaveBeenCalled();
    });

    it('captura y loggea error si emisión falla', async () => {
      // Mock logger.info para lanzar error
      vi.mocked(logger.info).mockImplementationOnce(() => {
        throw new Error('Simulated logger error');
      });

      const event: PolicyDecisionEvent = {
        flow: 'login',
        policy: 'feature_flag',
        decision: 'allowed',
        retryable: false,
        request_id: 'test-request-error'
      };

      // NO debe lanzar error (fail-safe)
      expect(() => emitPolicyDecision(event)).not.toThrow();

      await new Promise((resolve) => setImmediate(resolve));

      // Debe loggear el error
      expect(logger.error).toHaveBeenCalledWith(
        'Error emitting policy decision',
        expect.objectContaining({
          error: 'Simulated logger error',
          event_flow: 'login',
          event_policy: 'feature_flag'
        })
      );
    });
  });

  describe('Helpers', () => {
    it('emitFeatureFlagDecision - allowed', async () => {
      emitFeatureFlagDecision({
        flow: 'register',
        allowed: true,
        request_id: 'test-ff-allowed'
      });

      await new Promise((resolve) => setImmediate(resolve));

      expect(logger.info).toHaveBeenCalledWith(
        'Policy decision: allowed',
        expect.objectContaining({
          policy: 'feature_flag',
          decision: 'allowed',
          retryable: true
        })
      );
    });

    it('emitFeatureFlagDecision - blocked', async () => {
      emitFeatureFlagDecision({
        flow: 'login',
        allowed: false,
        request_id: 'test-ff-blocked'
      });

      await new Promise((resolve) => setImmediate(resolve));

      expect(logger.warn).toHaveBeenCalledWith(
        'Policy decision: blocked',
        expect.objectContaining({
          policy: 'feature_flag',
          decision: 'blocked',
          reason: 'feature_disabled',
          retryable: true
        })
      );
    });

    it('emitRateLimitDecision - blocked', async () => {
      emitRateLimitDecision({
        flow: 'magic_link',
        allowed: false,
        request_id: 'test-rl-blocked'
      });

      await new Promise((resolve) => setImmediate(resolve));

      expect(logger.warn).toHaveBeenCalledWith(
        'Policy decision: blocked',
        expect.objectContaining({
          policy: 'rate_limit',
          decision: 'blocked',
          reason: 'rate_limit_exceeded',
          retryable: true
        })
      );
    });

    it('emitAuthPolicyGateDecision - blocked (NO retryable)', async () => {
      emitAuthPolicyGateDecision({
        flow: 'password_recovery',
        allowed: false,
        request_id: 'test-apg-blocked'
      });

      await new Promise((resolve) => setImmediate(resolve));

      expect(logger.warn).toHaveBeenCalledWith(
        'Policy decision: blocked',
        expect.objectContaining({
          policy: 'auth_policy_gate',
          decision: 'blocked',
          reason: 'policy_check_failed',
          retryable: false // Auth policy gate NO es retryable
        })
      );
    });
  });
});
