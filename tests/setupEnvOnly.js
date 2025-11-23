/**
 * Test setup file for environment variables only (Node.js tests)
 */

// Mock environment variables for tests
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.NODE_ENV = 'test';

// Force RQC disabled for all tests
process.env.ENABLE_RQC = 'false';
process.env.ENABLE_SHIELD = 'false';

// Mock console to suppress logs in tests unless needed
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn()
};

// Add polyfills for Node.js tests
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// Mock fetch globally for all tests
global.fetch = jest.fn();

// NOTE: Global mock for feature flags REMOVED (Issue #618)
// Why: This global mock was interfering with integration tests that need
// the real FeatureFlags behavior. Unit tests that need mocks should use
// their own jest.mock() calls specific to their needs.
//
// If you need to mock flags in a unit test, add this to your test file:
//   jest.mock('../../../src/config/flags', () => ({
//     flags: { isEnabled: jest.fn(), ... }
//   }));

// Global test teardown to prevent Jest from hanging
afterAll(async () => {
  try {
    // Clean up AlertingService intervals
    const alertingService = require('../src/services/alertingService');
    if (alertingService && typeof alertingService.shutdown === 'function') {
      alertingService.shutdown();
    }

    // Clean up any other resources that might prevent Jest from exiting
    if (global.gc) {
      global.gc();
    }
  } catch (error) {
    // Ignore cleanup errors in tests
    console.log('Test cleanup error (ignored):', error.message);
  }
});
