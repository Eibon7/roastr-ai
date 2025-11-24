/**
 * Smoke Tests - Feature Flags
 *
 * Tests to ensure feature flags are working correctly
 */

const { flags } = require('../../src/config/flags');

describe('Feature Flags Smoke Tests', () => {
  test('Feature flags should initialize without errors', () => {
    expect(flags).toBeDefined();
    expect(typeof flags.isEnabled).toBe('function');
    expect(typeof flags.getAllFlags).toBe('function');
    expect(typeof flags.getServiceStatus).toBe('function');
  });

  test('Should be able to check flag status', () => {
    const testFlags = [
      'ENABLE_BILLING',
      'ENABLE_RQC',
      'ENABLE_REAL_OPENAI',
      'ENABLE_SUPABASE',
      'ENABLE_REAL_TWITTER'
    ];

    testFlags.forEach((flag) => {
      const result = flags.isEnabled(flag);
      expect(typeof result).toBe('boolean');
    });
  });

  test('Should return service status', () => {
    const serviceStatus = flags.getServiceStatus();

    expect(serviceStatus).toHaveProperty('billing');
    expect(serviceStatus).toHaveProperty('ai');
    expect(serviceStatus).toHaveProperty('database');
    expect(serviceStatus).toHaveProperty('integrations');
    expect(serviceStatus).toHaveProperty('features');

    // Check billing status is valid
    expect(['available', 'unavailable']).toContain(serviceStatus.billing);

    // Check AI services
    expect(['available', 'mock']).toContain(serviceStatus.ai.openai);
    expect(['available', 'mock']).toContain(serviceStatus.ai.perspective);

    // Check database status
    expect(['available', 'mock']).toContain(serviceStatus.database);
  });

  test('Should return all flags', () => {
    const allFlags = flags.getAllFlags();

    expect(typeof allFlags).toBe('object');
    expect(Object.keys(allFlags).length).toBeGreaterThan(0);

    // All flag values should be boolean
    Object.values(allFlags).forEach((value) => {
      expect(typeof value).toBe('boolean');
    });
  });

  test('Should handle unknown flags gracefully', () => {
    const result = flags.isEnabled('NONEXISTENT_FLAG');
    expect(result).toBe(false);
  });

  test('Feature flags should be consistent', () => {
    // Test multiple calls return same result
    const flagName = 'ENABLE_BILLING';
    const result1 = flags.isEnabled(flagName);
    const result2 = flags.isEnabled(flagName);

    expect(result1).toBe(result2);
  });
});
