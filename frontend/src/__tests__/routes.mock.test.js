/**
 * Route Smoke Tests in Mock Mode
 * Tests that mock mode detection and basic functionality works
 */

import { isMockModeEnabled } from '../lib/mockMode';

// Mock environment to force mock mode
const originalEnv = process.env;

beforeAll(() => {
  // Force mock mode by removing Supabase environment variables
  process.env = { 
    ...originalEnv,
    NODE_ENV: 'test'
  };
  delete process.env.REACT_APP_SUPABASE_URL;
  delete process.env.REACT_APP_SUPABASE_ANON_KEY;
});

afterAll(() => {
  process.env = originalEnv;
});

describe('Mock Mode Integration Tests', () => {
  test('mock mode is enabled when environment variables are missing', () => {
    expect(isMockModeEnabled()).toBe(true);
  });

  test('mock mode detection works with different environment scenarios', () => {
    // Test with both variables missing
    delete process.env.REACT_APP_SUPABASE_URL;
    delete process.env.REACT_APP_SUPABASE_ANON_KEY;
    expect(isMockModeEnabled()).toBe(true);

    // Test with explicit override
    process.env.REACT_APP_SUPABASE_URL = 'https://test.supabase.co';
    process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-key';
    process.env.REACT_APP_ENABLE_MOCK_MODE = 'true';
    expect(isMockModeEnabled()).toBe(true);

    // Clean up
    delete process.env.REACT_APP_ENABLE_MOCK_MODE;
    delete process.env.REACT_APP_SUPABASE_URL;
    delete process.env.REACT_APP_SUPABASE_ANON_KEY;
  });
});