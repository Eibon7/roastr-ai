/**
 * Test setup file for REAL integration tests
 * Does NOT mock Supabase credentials or fetch
 * Use this for tests that need real service connections
 */

// Load real environment variables from .env
require('dotenv').config();

// Set NODE_ENV to test
process.env.NODE_ENV = 'test';

// Verify required credentials are present
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY || !process.env.SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY');
  process.exit(1);
}

// Add polyfills for Node.js tests
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// DO NOT mock fetch - integration tests need real HTTP calls
// DO NOT mock Supabase credentials - integration tests need real DB

// Suppress console logs but allow them in individual tests if needed
global.console = {
  ...console,
  log: jest.fn((...args) => {
    // Allow logs that start with emoji (test progress indicators)
    if (args[0] && typeof args[0] === 'string' && /^[🔌📊✅❌🧹📝🎉⚠️🚀🔄]/.test(args[0])) {
      console.info(...args);
    }
  })
};

// Global test teardown to prevent Jest from hanging
afterAll(async () => {
  try {
    // Clean up any active Supabase connections or timers
    await new Promise(resolve => setTimeout(resolve, 100));

    if (global.gc) {
      global.gc();
    }
  } catch (error) {
    // Ignore cleanup errors in tests
  }
});
