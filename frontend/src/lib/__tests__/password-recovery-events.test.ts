/**
 * Password Recovery Frontend Events Tests (B3)
 *
 * Tests for password recovery analytics events emitted by frontend.
 * Verifies B3 contract compliance: NO PII, only categorical data.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  trackPasswordRecoveryRequested,
  trackPasswordRecoveryFailed
} from '../password-recovery-events';
import * as amplitude from '@amplitude/unified';

// Mock amplitude
vi.mock('@amplitude/unified', () => ({
  track: vi.fn()
}));

describe('Password Recovery Frontend Events (B3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock import.meta.env for non-test environment
    (import.meta as any).env = { MODE: 'development' };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('trackPasswordRecoveryRequested', () => {
    it('should emit password_recovery_requested with correct payload', () => {
      // Act
      trackPasswordRecoveryRequested(true);

      // Assert
      expect(amplitude.track).toHaveBeenCalledWith(
        'password_recovery_requested',
        {
          flow: 'password_recovery',
          feature_flag_state: true,
          provider: 'supabase',
          request_source: 'auth_ui'
        }
      );
    });

    it('should emit event with feature_flag_state=false when disabled', () => {
      // Act
      trackPasswordRecoveryRequested(false);

      // Assert
      const call = (amplitude.track as any).mock.calls[0];
      expect(call[1].feature_flag_state).toBe(false);
    });

    it('should NOT include email in payload', () => {
      // Act
      trackPasswordRecoveryRequested(true);

      // Assert
      const call = (amplitude.track as any).mock.calls[0];
      const properties = call[1];
      expect(properties).not.toHaveProperty('email');
      expect(properties).not.toHaveProperty('user_id');
      expect(properties).not.toHaveProperty('ip');
      expect(properties).not.toHaveProperty('token');
    });

    it('should NOT include user_id in payload', () => {
      // Act
      trackPasswordRecoveryRequested(true);

      // Assert
      const call = (amplitude.track as any).mock.calls[0];
      const properties = call[1];
      expect(properties).not.toHaveProperty('user_id');
    });

    it('should NOT include IP address in payload', () => {
      // Act
      trackPasswordRecoveryRequested(true);

      // Assert
      const call = (amplitude.track as any).mock.calls[0];
      const properties = call[1];
      expect(properties).not.toHaveProperty('ip');
      expect(properties).not.toHaveProperty('ip_address');
    });

    it('should skip emission in test environment', () => {
      // Arrange
      (import.meta as any).env = { MODE: 'test', VITEST: true };

      // Act
      trackPasswordRecoveryRequested(true);

      // Assert
      expect(amplitude.track).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully and not throw', () => {
      // Arrange
      (amplitude.track as any).mockImplementation(() => {
        throw new Error('Amplitude error');
      });

      // Act & Assert - should not throw
      expect(() => trackPasswordRecoveryRequested(true)).not.toThrow();
    });
  });

  describe('trackPasswordRecoveryFailed', () => {
    it('should emit password_recovery_failed with feature_disabled reason', () => {
      // Act
      trackPasswordRecoveryFailed(true, 'Feature is disabled');

      // Assert
      const call = (amplitude.track as any).mock.calls[0];
      expect(call[0]).toBe('password_recovery_failed');
      expect(call[1].reason).toBe('feature_disabled');
      expect(call[1].retryable).toBe(false);
    });

    it('should emit password_recovery_failed with rate_limited reason', () => {
      // Act
      trackPasswordRecoveryFailed(true, 'Too many requests');

      // Assert
      const call = (amplitude.track as any).mock.calls[0];
      expect(call[1].reason).toBe('rate_limited');
      expect(call[1].retryable).toBe(true);
    });

    it('should emit password_recovery_failed with request_failed reason', () => {
      // Act
      trackPasswordRecoveryFailed(true, 'Network connection failed');

      // Assert
      const call = (amplitude.track as any).mock.calls[0];
      expect(call[1].reason).toBe('request_failed');
      expect(call[1].retryable).toBe(true);
    });

    it('should emit password_recovery_failed with unknown_error reason as fallback', () => {
      // Act
      trackPasswordRecoveryFailed(true, 'Something went wrong');

      // Assert
      const call = (amplitude.track as any).mock.calls[0];
      expect(call[1].reason).toBe('unknown_error');
      expect(call[1].retryable).toBe(true);
    });

    it('should normalize error messages correctly', () => {
      const testCases = [
        { input: 'La funcionalidad no está disponible', expectedReason: 'feature_disabled' },
        { input: 'Rate limit exceeded', expectedReason: 'rate_limited' },
        { input: 'Network timeout', expectedReason: 'request_failed' },
        { input: 'Unknown issue', expectedReason: 'unknown_error' }
      ];

      testCases.forEach(({ input, expectedReason }) => {
        vi.clearAllMocks();
        trackPasswordRecoveryFailed(true, input);
        const call = (amplitude.track as any).mock.calls[0];
        expect(call[1].reason).toBe(expectedReason);
      });
    });

    it('should set retryable correctly based on error type', () => {
      const testCases = [
        { input: 'Feature disabled', retryable: false },
        { input: 'Rate limited', retryable: true },
        { input: 'Network error', retryable: true },
        { input: 'Unknown', retryable: true }
      ];

      testCases.forEach(({ input, retryable }) => {
        vi.clearAllMocks();
        trackPasswordRecoveryFailed(true, input);
        const call = (amplitude.track as any).mock.calls[0];
        expect(call[1].retryable).toBe(retryable);
      });
    });

    it('should NOT include email in payload', () => {
      // Act
      trackPasswordRecoveryFailed(true, 'Some error');

      // Assert
      const call = (amplitude.track as any).mock.calls[0];
      const properties = call[1];
      expect(properties).not.toHaveProperty('email');
      expect(properties).not.toHaveProperty('user_id');
      expect(properties).not.toHaveProperty('ip');
      expect(properties).not.toHaveProperty('token');
    });

    it('should include all required B3 fields', () => {
      // Act
      trackPasswordRecoveryFailed(true, 'Some error');

      // Assert
      const call = (amplitude.track as any).mock.calls[0];
      const properties = call[1];
      expect(properties).toHaveProperty('flow', 'password_recovery');
      expect(properties).toHaveProperty('feature_flag_state', true);
      expect(properties).toHaveProperty('provider', 'supabase');
      expect(properties).toHaveProperty('request_source', 'auth_ui');
      expect(properties).toHaveProperty('reason');
      expect(properties).toHaveProperty('retryable');
    });

    it('should skip emission in test environment', () => {
      // Arrange
      (import.meta as any).env = { MODE: 'test', VITEST: true };

      // Act
      trackPasswordRecoveryFailed(true, 'Error');

      // Assert
      expect(amplitude.track).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully and not throw', () => {
      // Arrange
      (amplitude.track as any).mockImplementation(() => {
        throw new Error('Amplitude error');
      });

      // Act & Assert - should not throw
      expect(() => trackPasswordRecoveryFailed(true, 'Error')).not.toThrow();
    });
  });

  describe('B3 Contract Compliance', () => {
    it('should NEVER include PII in any event', () => {
      // Test all event types
      trackPasswordRecoveryRequested(true);
      trackPasswordRecoveryFailed(true, 'Error');

      // Verify no PII in any call
      (amplitude.track as any).mock.calls.forEach((call: any) => {
        const props = call[1];
        expect(props).not.toHaveProperty('email');
        expect(props).not.toHaveProperty('user_id');
        expect(props).not.toHaveProperty('ip');
        expect(props).not.toHaveProperty('ip_address');
        expect(props).not.toHaveProperty('token');
        expect(props).not.toHaveProperty('password');
      });
    });

    it('should only use categorical data (enums and booleans)', () => {
      // Act
      trackPasswordRecoveryRequested(true);
      trackPasswordRecoveryFailed(true, 'Error');

      // Assert - all values should be strings (enums) or booleans
      (amplitude.track as any).mock.calls.forEach((call: any) => {
        const props = call[1];
        Object.values(props).forEach((value) => {
          expect(['string', 'boolean'].includes(typeof value)).toBe(true);
        });
      });
    });

    it('should have consistent event naming (snake_case)', () => {
      // Act
      trackPasswordRecoveryRequested(true);
      trackPasswordRecoveryFailed(true, 'Error');

      // Assert
      (amplitude.track as any).mock.calls.forEach((call: any) => {
        const eventName = call[0];
        expect(eventName).toMatch(/^[a-z_]+$/); // Only lowercase and underscores
      });
    });

    it('should have consistent property naming (snake_case)', () => {
      // Act
      trackPasswordRecoveryRequested(true);
      trackPasswordRecoveryFailed(true, 'Error');

      // Assert
      (amplitude.track as any).mock.calls.forEach((call: any) => {
        const props = call[1];
        Object.keys(props).forEach((key) => {
          expect(key).toMatch(/^[a-z_]+$/); // Only lowercase and underscores
        });
      });
    });
  });
});

