/**
 * Tests for AuthObservabilityService (V2) - ROA-410
 *
 * Verifies:
 * - Sanitización PII (emails truncados, IPs prefijadas)
 * - request_id presente en todos los logs
 * - Emisión analytics solo cuando ENABLE_ANALYTICS=true
 * - Estructura JSON correcta (timestamp, level, service, event)
 * - Error handling en trackEvent (graceful degradation)
 */

import { authObservability, AuthEventContext } from '../../../src/services/authObservabilityService';
import { logger } from '../../../src/utils/logger';
import { trackEvent } from '../../../src/lib/analytics';
import { AuthError } from '../../../src/utils/authErrorTaxonomy';

// Mock dependencies
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/lib/analytics');

describe('AuthObservabilityService', () => {
  const mockContext: AuthEventContext = {
    request_id: 'req_123',
    correlation_id: 'corr_456',
    user_id: 'user_789',
    email: 'test@example.com',
    ip: '192.168.1.100',
    flow: 'login'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset ENABLE_ANALYTICS for each test
    delete process.env.ENABLE_ANALYTICS;
  });

  describe('logAuthEvent', () => {
    it('should log with correct structure (timestamp, level, service, event)', () => {
      authObservability.logAuthEvent('info', 'auth.test.event', mockContext);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('"level":"info"')
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('"service":"auth"')
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('"event":"auth.test.event"')
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('"timestamp":')
      );
    });

    it('should include request_id in all logs', () => {
      authObservability.logAuthEvent('info', 'auth.test', mockContext);

      const logCall = (logger.info as jest.Mock).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      expect(logEntry.request_id).toBe('req_123');
    });

    it('should sanitize email (truncate)', () => {
      authObservability.logAuthEvent('info', 'auth.test', mockContext);

      const logCall = (logger.info as jest.Mock).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      // Email should be truncated (e.g., "t***@e***.com")
      expect(logEntry.email).not.toBe('test@example.com');
      expect(logEntry.email).toMatch(/t\*+@e\*+\.com/);
    });

    it('should sanitize IP (prefix only)', () => {
      authObservability.logAuthEvent('info', 'auth.test', mockContext);

      const logCall = (logger.info as jest.Mock).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      // IP should be prefixed (e.g., "192.168.x.x")
      expect(logEntry.ip_prefix).toBe('192.168.x.x');
      expect(logEntry.ip).toBeUndefined(); // Original IP should not be in log
    });

    it('should exclude sensitive fields (password, token, secret)', () => {
      const contextWithSensitive = {
        ...mockContext,
        password: 'secret123',
        token: 'token123',
        api_key: 'key123'
      };

      authObservability.logAuthEvent('info', 'auth.test', contextWithSensitive);

      const logCall = (logger.info as jest.Mock).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      expect(logEntry.password).toBeUndefined();
      expect(logEntry.token).toBeUndefined();
      expect(logEntry.api_key).toBeUndefined();
    });
  });

  describe('trackAuthEvent', () => {
    it('should emit analytics when ENABLE_ANALYTICS=true', () => {
      process.env.ENABLE_ANALYTICS = 'true';

      authObservability.trackAuthEvent('flow_started', mockContext, { flow: 'login' });

      expect(trackEvent).toHaveBeenCalledWith({
        userId: 'user_789',
        event: 'auth_flow_started',
        properties: {
          flow: 'login'
        },
        context: {
          flow: 'auth',
          request_id: 'req_123',
          correlation_id: 'corr_456'
        }
      });
    });

    it('should NOT emit analytics when ENABLE_ANALYTICS=false', () => {
      process.env.ENABLE_ANALYTICS = 'false';

      authObservability.trackAuthEvent('flow_started', mockContext);

      expect(trackEvent).not.toHaveBeenCalled();
    });

    it('should NOT emit analytics when ENABLE_ANALYTICS is undefined', () => {
      delete process.env.ENABLE_ANALYTICS;

      authObservability.trackAuthEvent('flow_started', mockContext);

      expect(trackEvent).not.toHaveBeenCalled();
    });

    it('should gracefully handle trackEvent errors (no propagation)', () => {
      process.env.ENABLE_ANALYTICS = 'true';
      (trackEvent as jest.Mock).mockImplementation(() => {
        throw new Error('Amplitude API failed');
      });

      // Should not throw
      expect(() => {
        authObservability.trackAuthEvent('flow_started', mockContext);
      }).not.toThrow();

      // Should log error
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('observability.track_event_failed')
      );
    });
  });

  describe('trackMetricCounter', () => {
    it('should always log counter regardless of ENABLE_ANALYTICS', () => {
      process.env.ENABLE_ANALYTICS = 'false';

      authObservability.trackMetricCounter('auth_requests_total', mockContext, {
        flow: 'login'
      });

      expect(logger.info).toHaveBeenCalled();
      const logCall = (logger.info as jest.Mock).mock.calls[0][0];
      expect(logCall).toContain('auth.metric.counter.auth_requests_total');
    });

    it('should emit analytics when ENABLE_ANALYTICS=true', () => {
      process.env.ENABLE_ANALYTICS = 'true';

      authObservability.trackMetricCounter('auth_success_total', mockContext, {
        flow: 'login'
      });

      expect(trackEvent).toHaveBeenCalledWith({
        userId: 'user_789',
        event: 'auth_metric_auth_success_total',
        properties: {
          flow: 'login',
          counter: 'auth_success_total'
        },
        context: {
          flow: 'auth',
          request_id: 'req_123'
        }
      });
    });

    it('should NOT emit analytics when ENABLE_ANALYTICS=false', () => {
      process.env.ENABLE_ANALYTICS = 'false';

      authObservability.trackMetricCounter('auth_failures_total', mockContext);

      expect(trackEvent).not.toHaveBeenCalled();
    });

    it('should gracefully handle counter errors', () => {
      process.env.ENABLE_ANALYTICS = 'true';
      (trackEvent as jest.Mock).mockImplementation(() => {
        throw new Error('Counter failed');
      });

      expect(() => {
        authObservability.trackMetricCounter('auth_blocks_total', mockContext);
      }).not.toThrow();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('observability.track_counter_failed')
      );
    });
  });

  describe('logAuthError', () => {
    it('should log error with full AuthError details', () => {
      const authError = new AuthError('AUTH_INVALID_CREDENTIALS');

      authObservability.logAuthError(mockContext, authError);

      expect(logger.error).toHaveBeenCalled();
      const logCall = (logger.error as jest.Mock).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      expect(logEntry.error_slug).toBe('AUTH_INVALID_CREDENTIALS');
      expect(logEntry.error_category).toBe('auth');
      expect(logEntry.error_retryable).toBe(false);
      expect(logEntry.http_status).toBe(401);
    });
  });

  describe('trackAuthDuration', () => {
    it('should track duration with correct metadata', () => {
      process.env.ENABLE_ANALYTICS = 'true';

      authObservability.trackAuthDuration('login', mockContext, 1234);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('auth.metric.login.duration')
      );
    });
  });
});

