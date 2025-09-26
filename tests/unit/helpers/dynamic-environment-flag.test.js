/**
 * Dynamic Environment Flag Test
 * Validates CodeRabbit fix for static TEST_CONFIG.mock.enabled
 */

const { TEST_CONFIG } = require('../../helpers/test-setup');

describe('Dynamic Environment Flag - CodeRabbit Fix', () => {
  
  test('should read mock mode flag dynamically from environment', () => {
    // Save original value
    const originalValue = process.env.ENABLE_MOCK_MODE;
    
    try {
      // Test with mock mode enabled
      process.env.ENABLE_MOCK_MODE = 'true';
      expect(TEST_CONFIG.mock.enabled).toBe(true);
      
      // Test with mock mode disabled
      process.env.ENABLE_MOCK_MODE = 'false';
      expect(TEST_CONFIG.mock.enabled).toBe(false);
      
      // Test with undefined (should be false)
      delete process.env.ENABLE_MOCK_MODE;
      expect(TEST_CONFIG.mock.enabled).toBe(false);
      
      console.log('✅ Mock mode flag reads dynamically from environment');
    } finally {
      // Restore original value
      if (originalValue !== undefined) {
        process.env.ENABLE_MOCK_MODE = originalValue;
      } else {
        delete process.env.ENABLE_MOCK_MODE;
      }
    }
  });
  
  test('should use getter instead of static property', () => {
    // Verify that enabled is a getter function, not a static property
    const descriptor = Object.getOwnPropertyDescriptor(TEST_CONFIG.mock, 'enabled');
    
    expect(descriptor).toBeDefined();
    expect(descriptor.get).toBeDefined();
    expect(typeof descriptor.get).toBe('function');
    
    console.log('✅ TEST_CONFIG.mock.enabled is a getter function, not static property');
  });
  
  test('should prevent module-load-time capture of environment variable', () => {
    // This test ensures the fix prevents the issue where the environment variable
    // was captured at module load time and couldn't be changed during test execution
    
    const originalValue = process.env.ENABLE_MOCK_MODE;
    
    try {
      // Change environment during runtime
      process.env.ENABLE_MOCK_MODE = 'true';
      const enabledWhenTrue = TEST_CONFIG.mock.enabled;
      
      process.env.ENABLE_MOCK_MODE = 'false';
      const enabledWhenFalse = TEST_CONFIG.mock.enabled;
      
      // Should reflect real-time changes
      expect(enabledWhenTrue).toBe(true);
      expect(enabledWhenFalse).toBe(false);
      expect(enabledWhenTrue).not.toBe(enabledWhenFalse);
      
      console.log('✅ Environment variable changes reflected in real-time');
    } finally {
      if (originalValue !== undefined) {
        process.env.ENABLE_MOCK_MODE = originalValue;
      } else {
        delete process.env.ENABLE_MOCK_MODE;
      }
    }
  });
  
});