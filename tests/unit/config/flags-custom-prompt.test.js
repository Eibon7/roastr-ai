/**
 * Feature Flags Tests - ENABLE_CUSTOM_PROMPT
 *
 * Tests for the new ENABLE_CUSTOM_PROMPT feature flag to ensure:
 * - Flag is properly loaded from environment
 * - Default behavior (disabled by default)
 * - Integration with existing flag system
 */

describe('ENABLE_CUSTOM_PROMPT Feature Flag', () => {
  // Store original env vars
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear the global mock from setupEnvOnly.js for this specific test
    jest.unmock('../../../src/config/flags');
  });

  afterAll(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('Basic Flag Functionality', () => {
    test('loads ENABLE_CUSTOM_PROMPT flag from environment when set to true', () => {
      const testEnv = { ...originalEnv, ENABLE_CUSTOM_PROMPT: 'true' };

      // Temporarily replace process.env
      process.env = testEnv;

      // Clear module cache and require fresh
      delete require.cache[require.resolve('../../../src/config/flags')];
      const { FeatureFlags } = require('../../../src/config/flags');
      const testFlags = new FeatureFlags();

      expect(testFlags.isEnabled('ENABLE_CUSTOM_PROMPT')).toBe(true);

      // Restore
      process.env = originalEnv;
    });

    test('ENABLE_CUSTOM_PROMPT defaults to false when not set', () => {
      const testEnv = { ...originalEnv };
      delete testEnv.ENABLE_CUSTOM_PROMPT;

      // Temporarily replace process.env
      process.env = testEnv;

      // Clear module cache and require fresh
      delete require.cache[require.resolve('../../../src/config/flags')];
      const { FeatureFlags } = require('../../../src/config/flags');
      const testFlags = new FeatureFlags();

      expect(testFlags.isEnabled('ENABLE_CUSTOM_PROMPT')).toBe(false);

      // Restore
      process.env = originalEnv;
    });

    test('ENABLE_CUSTOM_PROMPT is false when set to false', () => {
      const testEnv = { ...originalEnv, ENABLE_CUSTOM_PROMPT: 'false' };

      // Temporarily replace process.env
      process.env = testEnv;

      // Clear module cache and require fresh
      delete require.cache[require.resolve('../../../src/config/flags')];
      const { FeatureFlags } = require('../../../src/config/flags');
      const testFlags = new FeatureFlags();

      expect(testFlags.isEnabled('ENABLE_CUSTOM_PROMPT')).toBe(false);

      // Restore
      process.env = originalEnv;
    });

    test('ENABLE_CUSTOM_PROMPT is false when set to any other value', () => {
      const testEnv = { ...originalEnv, ENABLE_CUSTOM_PROMPT: 'yes' };

      // Temporarily replace process.env
      process.env = testEnv;

      // Clear module cache and require fresh
      delete require.cache[require.resolve('../../../src/config/flags')];
      const { FeatureFlags } = require('../../../src/config/flags');
      const testFlags = new FeatureFlags();

      expect(testFlags.isEnabled('ENABLE_CUSTOM_PROMPT')).toBe(false);

      // Restore
      process.env = originalEnv;
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
