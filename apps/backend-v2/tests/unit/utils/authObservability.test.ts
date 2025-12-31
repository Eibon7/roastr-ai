/**
 * Tests for authObservability helpers - ROA-410
 *
 * Verifies integration of observability helpers with auth flows:
 * - logAuthFlowStarted increments auth_requests_total
 * - logLoginAttempt uses correct event names (flow_completed/flow_failed)
 * - logRateLimit emits flow_blocked and increments auth_blocks_total
 * - logFeatureDisabled emits flow_blocked with feature_flag
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  logAuthFlowStarted,
  logLoginAttempt,
  logRegisterAttempt,
  logRateLimit,
  logFeatureDisabled,
  createAuthContext
} from '../../../src/utils/authObservability';
import { authObservability } from '../../../src/services/authObservabilityService';
import { AuthError } from '../../../src/utils/authErrorTaxonomy';

// Mock authObservabilityService
vi.mock('../../../src/services/authObservabilityService', () => ({
  authObservability: {
    logAuthEvent: vi.fn(),
    trackAuthEvent: vi.fn(),
    trackMetricCounter: vi.fn(),
    logAuthError: vi.fn()
  }
}));

describe('authObservability helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logAuthFlowStarted', () => {
    it('should increment auth_requests_total counter', () => {
      const context = { flow: 'login' as const, email: 'test@example.com' };

      logAuthFlowStarted(context);

      expect(authObservability.trackMetricCounter).toHaveBeenCalledWith(
        'auth_requests_total',
        context,
        { flow: 'login' }
      );
    });

    it('should log auth.flow.started event', () => {
      const context = { flow: 'register' as const };

      logAuthFlowStarted(context);

      expect(authObservability.logAuthEvent).toHaveBeenCalledWith(
        'info',
        'auth.flow.started',
        context
      );
    });

    it('should emit auth_flow_started analytics event', () => {
      const context = { flow: 'magic_link' as const };

      logAuthFlowStarted(context);

      expect(authObservability.trackAuthEvent).toHaveBeenCalledWith(
        'flow_started',
        context,
        { flow: 'magic_link' }
      );
    });
  });

  describe('logLoginAttempt', () => {
    const context = { flow: 'login' as const, email: 'test@example.com', ip: '192.168.1.1' };

    it('should emit auth_flow_completed on success', () => {
      logLoginAttempt(context, true);

      expect(authObservability.trackAuthEvent).toHaveBeenCalledWith(
        'flow_completed',
        context,
        { flow: 'login' }
      );
    });

    it('should increment auth_success_total on success', () => {
      logLoginAttempt(context, true);

      expect(authObservability.trackMetricCounter).toHaveBeenCalledWith(
        'auth_success_total',
        context,
        { flow: 'login' }
      );
    });

    it('should emit auth_flow_failed on failure', () => {
      const authError = new AuthError('AUTH_INVALID_CREDENTIALS');

      logLoginAttempt(context, false, authError);

      expect(authObservability.trackAuthEvent).toHaveBeenCalledWith(
        'flow_failed',
        context,
        {
          flow: 'login',
          error_slug: 'AUTH_INVALID_CREDENTIALS'
        }
      );
    });

    it('should increment auth_failures_total on failure', () => {
      const authError = new AuthError('AUTH_INVALID_CREDENTIALS');

      logLoginAttempt(context, false, authError);

      expect(authObservability.trackMetricCounter).toHaveBeenCalledWith(
        'auth_failures_total',
        context,
        {
          flow: 'login',
          error_slug: 'AUTH_INVALID_CREDENTIALS'
        }
      );
    });

    it('should log error details on failure', () => {
      const authError = new AuthError('AUTH_ACCOUNT_LOCKED');

      logLoginAttempt(context, false, authError);

      expect(authObservability.logAuthError).toHaveBeenCalledWith(
        context,
        authError
      );
    });
  });

  describe('logRegisterAttempt', () => {
    const context = { flow: 'register' as const, email: 'new@example.com' };

    it('should emit auth_flow_completed on success', () => {
      logRegisterAttempt(context, true);

      expect(authObservability.trackAuthEvent).toHaveBeenCalledWith(
        'flow_completed',
        context,
        { flow: 'register' }
      );
    });

    it('should increment auth_success_total on success', () => {
      logRegisterAttempt(context, true);

      expect(authObservability.trackMetricCounter).toHaveBeenCalledWith(
        'auth_success_total',
        context,
        { flow: 'register' }
      );
    });

    it('should emit auth_flow_failed on failure', () => {
      const authError = new AuthError('ACCOUNT_EMAIL_ALREADY_EXISTS');

      logRegisterAttempt(context, false, authError);

      expect(authObservability.trackAuthEvent).toHaveBeenCalledWith(
        'flow_failed',
        context,
        {
          flow: 'register',
          error_slug: 'ACCOUNT_EMAIL_ALREADY_EXISTS'
        }
      );
    });

    it('should increment auth_failures_total on failure', () => {
      const authError = new AuthError('ACCOUNT_EMAIL_ALREADY_EXISTS');

      logRegisterAttempt(context, false, authError);

      expect(authObservability.trackMetricCounter).toHaveBeenCalledWith(
        'auth_failures_total',
        context,
        {
          flow: 'register',
          error_slug: 'ACCOUNT_EMAIL_ALREADY_EXISTS'
        }
      );
    });
  });

  describe('logRateLimit', () => {
    const context = { flow: 'login' as const, ip: '192.168.1.1' };
    const reason = 'login_rate_limit:192.168.1.1';

    it('should emit auth_flow_blocked event', () => {
      logRateLimit(context, reason);

      expect(authObservability.trackAuthEvent).toHaveBeenCalledWith(
        'flow_blocked',
        context,
        {
          flow: 'login',
          reason: 'rate_limit',
          details: reason
        }
      );
    });

    it('should increment auth_blocks_total counter', () => {
      logRateLimit(context, reason);

      expect(authObservability.trackMetricCounter).toHaveBeenCalledWith(
        'auth_blocks_total',
        context,
        {
          flow: 'login',
          reason: 'rate_limit'
        }
      );
    });

    it('should log rate limit with reason', () => {
      logRateLimit(context, reason);

      expect(authObservability.logAuthEvent).toHaveBeenCalledWith(
        'warn',
        'auth.rate_limit',
        {
          ...context,
          reason
        }
      );
    });
  });

  describe('logFeatureDisabled', () => {
    const context = { flow: 'login' as const };
    const featureFlag = 'auth.login.enabled';

    it('should emit auth_flow_blocked event with feature_flag', () => {
      logFeatureDisabled(context, featureFlag);

      expect(authObservability.trackAuthEvent).toHaveBeenCalledWith(
        'flow_blocked',
        context,
        {
          flow: 'login',
          reason: 'feature_disabled',
          feature_flag: featureFlag
        }
      );
    });

    it('should increment auth_blocks_total with feature_flag label', () => {
      logFeatureDisabled(context, featureFlag);

      expect(authObservability.trackMetricCounter).toHaveBeenCalledWith(
        'auth_blocks_total',
        context,
        {
          flow: 'login',
          reason: 'feature_disabled',
          feature_flag: featureFlag
        }
      );
    });

    it('should log feature disabled event', () => {
      logFeatureDisabled(context, featureFlag, 'Login disabled by admin');

      expect(authObservability.logAuthEvent).toHaveBeenCalledWith(
        'warn',
        'auth.feature_disabled',
        {
          ...context,
          feature_flag: featureFlag,
          reason: 'Login disabled by admin'
        }
      );
    });
  });

  describe('createAuthContext', () => {
    it('should extract request_id from request object', () => {
      const req = {
        request_id: 'req_123',
        headers: {}
      };

      const context = createAuthContext(req);

      expect(context.request_id).toBe('req_123');
    });

    it('should extract correlation_id from headers', () => {
      const req = {
        headers: {
          'x-correlation-id': 'corr_456'
        }
      };

      const context = createAuthContext(req);

      expect(context.correlation_id).toBe('corr_456');
    });

    it('should extract IP from request', () => {
      const req = {
        ip: '192.168.1.100',
        headers: {}
      };

      const context = createAuthContext(req);

      expect(context.ip).toBe('192.168.1.100');
    });

    it('should merge additional context', () => {
      const req = {
        request_id: 'req_123',
        headers: {}
      };

      const context = createAuthContext(req, {
        flow: 'login',
        email: 'test@example.com'
      });

      expect(context.flow).toBe('login');
      expect(context.email).toBe('test@example.com');
      expect(context.request_id).toBe('req_123');
    });
  });
});

