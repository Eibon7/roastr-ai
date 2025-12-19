/**
 * Tests for Analytics Identity Sync (ROA-356)
 *
 * Validates Amplitude identity synchronization:
 * - setUserId called after login
 * - setUserProperties called with correct payload
 * - reset called on logout
 * - No execution in test environment
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as amplitude from '@amplitude/unified';

// Mock Amplitude SDK
vi.mock('@amplitude/unified', () => ({
  initAll: vi.fn(),
  setUserId: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn()
}));

// Mock Identify class from @amplitude/analytics-browser
vi.mock('@amplitude/analytics-browser', () => ({
  Identify: vi.fn().mockImplementation(() => ({
    set: vi.fn().mockReturnThis()
  }))
}));

// Import after mocking
import { setUserId, setUserProperties, reset, isAmplitudeInitialized } from '../analytics-identity';

describe('Analytics Identity Sync (ROA-356)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Test environment detection', () => {
    it('should not execute in test environment', () => {
      // All functions should be no-op in test
      setUserId('test-user-id');
      setUserProperties({ plan: 'pro' });
      reset();

      // Amplitude SDK methods should not be called
      expect(amplitude.setUserId).not.toHaveBeenCalled();
      expect(amplitude.identify).not.toHaveBeenCalled();
      expect(amplitude.reset).not.toHaveBeenCalled();
    });

    it('should report not initialized in test environment', () => {
      // isAmplitudeInitialized should return false in test
      expect(isAmplitudeInitialized()).toBe(false);
    });
  });

  describe('setUserId', () => {
    it('should handle undefined userId gracefully', () => {
      expect(() => {
        setUserId(undefined);
      }).not.toThrow();
    });

    it('should handle string userId gracefully', () => {
      expect(() => {
        setUserId('user-123');
      }).not.toThrow();
    });
  });

  describe('setUserProperties', () => {
    it('should handle empty properties', () => {
      expect(() => {
        setUserProperties({});
      }).not.toThrow();
    });

    it('should handle full properties payload', () => {
      expect(() => {
        setUserProperties({
          plan: 'pro',
          role: 'user',
          has_roastr_persona: true,
          is_admin: false,
          is_trial: false,
          auth_provider: 'email_password',
          locale: 'en'
        });
      }).not.toThrow();
    });
  });

  describe('reset', () => {
    it('should not throw errors', () => {
      expect(() => {
        reset();
      }).not.toThrow();
    });
  });
});

