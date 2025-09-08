/**
 * Test Setup for Mock Mode
 * 
 * This setup file is used when ENABLE_MOCK_MODE=true
 * It ensures all external dependencies are mocked and tests run with fake data
 */

// Load environment variables
require('dotenv').config();

// Force mock mode to be enabled for all tests
process.env.ENABLE_MOCK_MODE = 'true';
process.env.NODE_ENV = 'test';

// Ensure mock database settings
process.env.SUPABASE_URL = 'http://localhost:54321/mock';
process.env.SUPABASE_SERVICE_KEY = 'mock-service-key-for-testing';
process.env.SUPABASE_ANON_KEY = 'mock-anon-key-for-testing';

// Mock external API keys to prevent real API calls
process.env.OPENAI_API_KEY = 'mock-openai-key-sk-test123456789';
process.env.PERSPECTIVE_API_KEY = 'mock-perspective-key';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock123456789';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock123456789';
process.env.STRIPE_SUCCESS_URL = 'http://localhost:3000/success';
process.env.STRIPE_CANCEL_URL = 'http://localhost:3000/cancel';
process.env.STRIPE_PORTAL_RETURN_URL = 'http://localhost:3000/dashboard';

// Mock security secrets
process.env.IDEMPOTENCY_SECRET = 'mock-idempotency-secret-for-testing-12345678901234567890';

// Enable style profile feature for tests
process.env.ENABLE_STYLE_PROFILE = 'true';

// Redis/Queue mocking
process.env.UPSTASH_REDIS_REST_URL = 'http://localhost:6379/mock';
process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-redis-token';

// Import and initialize mock mode
const { mockMode } = require('../src/config/mockMode');

// Force reload flags to pick up test environment variables
delete require.cache[require.resolve('../src/config/flags')];
delete require.cache[require.resolve('../src/config/mockMode')];
const { flags } = require('../src/config/flags');

// Global mock setup for common Node.js modules
global.fetch = mockMode.generateMockFetch();

// Mock console methods to reduce test noise (but keep errors visible)
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

// Only suppress specific noisy logs, keep important ones
console.warn = (...args) => {
  const message = args.join(' ');
  // Suppress specific mock-related warnings
  if (message.includes('Mock Mode ENABLED') || 
      message.includes('Using fake data') ||
      message.includes('Feature flags initialized') ||
      message.includes('injecting env')) {
    return;
  }
  originalConsoleWarn(...args);
};

console.log = (...args) => {
  const message = args.join(' ');
  // Suppress verbose mock logs but keep test results
  if (message.includes('🎭 Mock') || 
      message.includes('🧪 Complete CI Setup') ||
      message.includes('[dotenv@') ||
      message.includes('🏁 Feature flags')) {
    return;
  }
  originalConsoleLog(...args);
};

// Global test timeout
jest.setTimeout(10000);

// Enhanced error handling for mock mode
global.beforeEach(() => {
  // Clear any module cache that might interfere with mocking
  jest.clearAllMocks();
});

global.afterAll(() => {
  // Restore console methods
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

console.log('🧪 Mock Mode Test Setup: All external APIs mocked, tests running in isolation');