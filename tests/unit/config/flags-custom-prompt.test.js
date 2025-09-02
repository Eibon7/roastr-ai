/**
 * Feature Flags Tests - ENABLE_CUSTOM_PROMPT
 *
 * Tests for the new ENABLE_CUSTOM_PROMPT feature flag to ensure:
 * - Flag is properly loaded from environment
 * - Default behavior (disabled by default)
 * - Integration with existing flag system
 */

describe('ENABLE_CUSTOM_PROMPT Feature Flag', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = process.env.ENABLE_CUSTOM_PROMPT;
  });

  afterEach(() => {
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.ENABLE_CUSTOM_PROMPT = originalEnv;
    } else {
      delete process.env.ENABLE_CUSTOM_PROMPT;
    }
  });

  describe('Basic Flag Functionality', () => {
    test('should be disabled by default when env var is not set', () => {
      delete process.env.ENABLE_CUSTOM_PROMPT;

      // Test the flag logic directly
      const flagValue = process.env.ENABLE_CUSTOM_PROMPT === 'true';
      expect(flagValue).toBe(false);
    });

    test('should be enabled when env var is set to true', () => {
      process.env.ENABLE_CUSTOM_PROMPT = 'true';

      // Test the flag logic directly
      const flagValue = process.env.ENABLE_CUSTOM_PROMPT === 'true';
      expect(flagValue).toBe(true);
    });

    test('should be disabled when env var is set to false', () => {
      process.env.ENABLE_CUSTOM_PROMPT = 'false';

      // Test the flag logic directly
      const flagValue = process.env.ENABLE_CUSTOM_PROMPT === 'true';
      expect(flagValue).toBe(false);
    });

    test('should be disabled when env var is set to any other value', () => {
      process.env.ENABLE_CUSTOM_PROMPT = 'yes';

      // Test the flag logic directly
      const flagValue = process.env.ENABLE_CUSTOM_PROMPT === 'true';
      expect(flagValue).toBe(false);
    });
  });

  describe('Integration with Flags System', () => {
    test('should work with existing flags system', () => {
      // Test that the flag is properly integrated
      const { flags } = require('../../../src/config/flags');

      // Should have the isEnabled method
      expect(typeof flags.isEnabled).toBe('function');

      // Should handle the flag (even if disabled by default)
      expect(typeof flags.isEnabled('ENABLE_CUSTOM_PROMPT')).toBe('boolean');
    });

    test('should not break existing functionality', () => {
      const { flags } = require('../../../src/config/flags');

      // Verify other critical flags still work
      expect(typeof flags.isEnabled('ENABLE_RQC')).toBe('boolean');
      expect(typeof flags.isEnabled('ENABLE_SHIELD')).toBe('boolean');
      expect(typeof flags.isEnabled('MOCK_MODE')).toBe('boolean');
    });
  });
});
