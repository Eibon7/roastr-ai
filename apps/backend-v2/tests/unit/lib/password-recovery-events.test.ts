/**
 * Password Recovery Backend Events Tests (B3)
 *
 * Tests for password recovery analytics events emitted by backend.
 * Verifies B3 contract compliance: NO PII, only categorical data.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  trackPasswordRecoveryTokenUsed,
  trackPasswordRecoveryBackendFailed
} from '../../../src/lib/password-recovery-events';
import * as analytics from '../../../src/lib/analytics';

// Mock analytics module
vi.mock('../../../src/lib/analytics', () => ({
  trackEvent: vi.fn()
}));

// Mock logger to prevent console noise
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn()
  }
}));

describe('Password Recovery Backend Events (B3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('trackPasswordRecoveryTokenUsed', () => {
    it('should emit password_recovery_token_used with correct payload', () => {
      // Act
      trackPasswordRecoveryTokenUsed(true);

      // Assert
      expect(analytics.trackEvent).toHaveBeenCalledWith({
        event: 'password_recovery_token_used',
        properties: {
          flow: 'password_recovery',
          provider: 'supabase',
          feature_flag_state: true,
          token_status: 'valid',
          auth_state: 'anonymous'
        },
        context: {
          flow: 'password_recovery'
        }
      });
    });

    it('should emit event with feature_flag_state=false when disabled', () => {
      // Act
      trackPasswordRecoveryTokenUsed(false);

      // Assert
      const call = (analytics.trackEvent as any).mock.calls[0][0];
      expect(call.properties.feature_flag_state).toBe(false);
    });

    it('should NOT include email in payload', () => {
      // Act
      trackPasswordRecoveryTokenUsed(true);

      // Assert
      const call = (analytics.trackEvent as any).mock.calls[0][0];
      expect(call.properties).not.toHaveProperty('email');
      expect(call.properties).not.toHaveProperty('user_id');
      expect(call.properties).not.toHaveProperty('ip');
      expect(call.properties).not.toHaveProperty('token');
    });

    it('should NOT include user_id in payload', () => {
      // Act
      trackPasswordRecoveryTokenUsed(true);

      // Assert
      const call = (analytics.trackEvent as any).mock.calls[0][0];
      expect(call.properties).not.toHaveProperty('user_id');
    });

    it('should NOT include IP address in payload', () => {
      // Act
      trackPasswordRecoveryTokenUsed(true);

      // Assert
      const call = (analytics.trackEvent as any).mock.calls[0][0];
      expect(call.properties).not.toHaveProperty('ip');
      expect(call.properties).not.toHaveProperty('ip_address');
    });

    it('should NOT include token in payload', () => {
      // Act
      trackPasswordRecoveryTokenUsed(true);

      // Assert
      const call = (analytics.trackEvent as any).mock.calls[0][0];
      expect(call.properties).not.toHaveProperty('token');
      expect(call.properties).not.toHaveProperty('access_token');
    });

    it('should handle errors gracefully and not throw', () => {
      // Arrange
      (analytics.trackEvent as any).mockImplementation(() => {
        throw new Error('Analytics error');
      });

      // Act & Assert - should not throw
      expect(() => trackPasswordRecoveryTokenUsed(true)).not.toThrow();
    });
  });

  describe('trackPasswordRecoveryBackendFailed', () => {
    it('should emit password_recovery_failed with token_invalid reason', () => {
      // Act
      trackPasswordRecoveryBackendFailed(true, 'Invalid token provided');

      // Assert
      const call = (analytics.trackEvent as any).mock.calls[0][0];
      expect(call.event).toBe('password_recovery_failed');
      expect(call.properties.reason).toBe('token_invalid');
      expect(call.properties.retryable).toBe(false);
    });

    it('should emit password_recovery_failed with token_expired reason', () => {
      // Act
      trackPasswordRecoveryBackendFailed(true, 'Token has expired');

      // Assert
      const call = (analytics.trackEvent as any).mock.calls[0][0];
      expect(call.properties.reason).toBe('token_expired');
      expect(call.properties.retryable).toBe(false);
    });

    it('should emit password_recovery_failed with request_failed reason', () => {
      // Act
      trackPasswordRecoveryBackendFailed(true, 'Network timeout occurred');

      // Assert
      const call = (analytics.trackEvent as any).mock.calls[0][0];
      expect(call.properties.reason).toBe('request_failed');
      expect(call.properties.retryable).toBe(true);
    });

    it('should emit password_recovery_failed with unknown_error reason as fallback', () => {
      // Act
      trackPasswordRecoveryBackendFailed(true, 'Something strange happened');

      // Assert
      const call = (analytics.trackEvent as any).mock.calls[0][0];
      expect(call.properties.reason).toBe('unknown_error');
      expect(call.properties.retryable).toBe(false);
    });

    it('should normalize error messages correctly', () => {
      const testCases = [
        { input: 'JWT is malformed', expectedReason: 'token_invalid' },
        { input: 'Reset token has expired', expectedReason: 'token_expired' },
        { input: 'Connection timed out', expectedReason: 'request_failed' },
        { input: 'Service unavailable', expectedReason: 'request_failed' }
      ];

      testCases.forEach(({ input, expectedReason }) => {
        vi.clearAllMocks();
        trackPasswordRecoveryBackendFailed(true, input);
        const call = (analytics.trackEvent as any).mock.calls[0][0];
        expect(call.properties.reason).toBe(expectedReason);
      });
    });

    it('should set retryable correctly based on error type', () => {
      const testCases = [
        { input: 'Invalid token', retryable: false },
        { input: 'Token expired', retryable: false },
        { input: 'Network error', retryable: true },
        { input: 'Unknown error', retryable: false }
      ];

      testCases.forEach(({ input, retryable }) => {
        vi.clearAllMocks();
        trackPasswordRecoveryBackendFailed(true, input);
        const call = (analytics.trackEvent as any).mock.calls[0][0];
        expect(call.properties.retryable).toBe(retryable);
      });
    });

    it('should NOT include email in payload', () => {
      // Act
      trackPasswordRecoveryBackendFailed(true, 'Some error');

      // Assert
      const call = (analytics.trackEvent as any).mock.calls[0][0];
      expect(call.properties).not.toHaveProperty('email');
      expect(call.properties).not.toHaveProperty('user_id');
      expect(call.properties).not.toHaveProperty('ip');
      expect(call.properties).not.toHaveProperty('token');
    });

    it('should include all required B3 fields', () => {
      // Act
      trackPasswordRecoveryBackendFailed(true, 'Some error');

      // Assert
      const call = (analytics.trackEvent as any).mock.calls[0][0];
      expect(call.properties).toHaveProperty('flow', 'password_recovery');
      expect(call.properties).toHaveProperty('provider', 'supabase');
      expect(call.properties).toHaveProperty('feature_flag_state', true);
      expect(call.properties).toHaveProperty('reason');
      expect(call.properties).toHaveProperty('retryable');
    });

    it('should handle errors gracefully and not throw', () => {
      // Arrange
      (analytics.trackEvent as any).mockImplementation(() => {
        throw new Error('Analytics error');
      });

      // Act & Assert - should not throw
      expect(() => trackPasswordRecoveryBackendFailed(true, 'Error')).not.toThrow();
    });
  });

  describe('B3 Contract Compliance', () => {
    it('should NEVER include PII in any event', () => {
      // Test all event types
      trackPasswordRecoveryTokenUsed(true);
      trackPasswordRecoveryBackendFailed(true, 'Error');

      // Verify no PII in any call
      (analytics.trackEvent as any).mock.calls.forEach((call: any) => {
        const props = call[0].properties;
        expect(props).not.toHaveProperty('email');
        expect(props).not.toHaveProperty('user_id');
        expect(props).not.toHaveProperty('ip');
        expect(props).not.toHaveProperty('ip_address');
        expect(props).not.toHaveProperty('token');
        expect(props).not.toHaveProperty('access_token');
        expect(props).not.toHaveProperty('password');
      });
    });

    it('should only use categorical data (enums and booleans)', () => {
      // Act
      trackPasswordRecoveryTokenUsed(true);
      trackPasswordRecoveryBackendFailed(true, 'Error');

      // Assert - all values should be strings (enums) or booleans
      (analytics.trackEvent as any).mock.calls.forEach((call: any) => {
        const props = call[0].properties;
        Object.values(props).forEach((value) => {
          expect(['string', 'boolean'].includes(typeof value)).toBe(true);
        });
      });
    });

    it('should have consistent event naming (snake_case)', () => {
      // Act
      trackPasswordRecoveryTokenUsed(true);
      trackPasswordRecoveryBackendFailed(true, 'Error');

      // Assert
      (analytics.trackEvent as any).mock.calls.forEach((call: any) => {
        const eventName = call[0].event;
        expect(eventName).toMatch(/^[a-z_]+$/); // Only lowercase and underscores
      });
    });
  });
});

