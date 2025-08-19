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

// Global mock for feature flags - RQC always disabled in tests
jest.mock('../src/config/flags', () => ({
  __esModule: true,
  flags: {
    isEnabled: jest.fn((flag) => {
      if (flag === 'ENABLE_RQC') return false;
      if (flag === 'ENABLE_SHIELD') return false;
      if (flag === 'ENABLE_BILLING') return false;
      if (flag === 'ENABLE_REAL_OPENAI') return true; // Keep basic functionality
      if (flag === 'ENABLE_MOCK_PERSISTENCE') return true;
      return false; // All other flags disabled by default
    }),
    getAllFlags: jest.fn(() => ({
      ENABLE_RQC: false,
      ENABLE_SHIELD: false,
      ENABLE_BILLING: false,
      ENABLE_REAL_OPENAI: true,
      ENABLE_MOCK_PERSISTENCE: true,
      ENABLE_DEBUG_LOGS: false
    })),
    getServiceStatus: jest.fn(() => ({
      billing: 'unavailable',
      ai: { openai: 'available', perspective: 'mock' },
      database: 'mock',
      integrations: { twitter: 'mock', youtube: 'mock' },
      features: { rqc: 'disabled', shield: 'disabled' }
    }))
  },
  FeatureFlags: class MockFeatureFlags {
    constructor() {
      this.flags = {
        ENABLE_RQC: false,
        ENABLE_SHIELD: false,
        ENABLE_BILLING: false,
        ENABLE_REAL_OPENAI: true,
        ENABLE_MOCK_PERSISTENCE: true
      };
    }
    isEnabled(flag) { return this.flags[flag] || false; }
    getAllFlags() { return { ...this.flags }; }
  }
}));

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