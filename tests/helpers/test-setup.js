/**
 * Test Setup - Central configuration for testing infrastructure
 * Issue #403 - Testing MVP
 */

const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Test environment configuration
const TEST_CONFIG = {
  database: {
    url: process.env.SUPABASE_URL || 'http://localhost:54321',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || 'dummy-service-key',
    anonKey: process.env.SUPABASE_ANON_KEY || 'dummy-anon-key'
  },
  mock: {
    enabled: process.env.ENABLE_MOCK_MODE === 'true',
    openaiApiKey: 'mock-openai-key',
    perspectiveApiKey: 'mock-perspective-key'
  },
  timeouts: {
    test: 30000,
    e2e: 60000,
    integration: 45000
  }
};

/**
 * Setup test environment
 */
async function setupTestEnvironment() {
  // Set NODE_ENV to test if not already set
  process.env.NODE_ENV = 'test';
  
  // Enable mock mode for testing
  process.env.ENABLE_MOCK_MODE = 'true';
  
  // Set dummy API keys for testing
  if (!process.env.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = TEST_CONFIG.mock.openaiApiKey;
  }
  
  if (!process.env.PERSPECTIVE_API_KEY) {
    process.env.PERSPECTIVE_API_KEY = TEST_CONFIG.mock.perspectiveApiKey;
  }
  
  // Set database URLs for testing
  process.env.SUPABASE_URL = TEST_CONFIG.database.url;
  process.env.SUPABASE_SERVICE_KEY = TEST_CONFIG.database.serviceKey;
  process.env.SUPABASE_ANON_KEY = TEST_CONFIG.database.anonKey;
  
  console.log('Test environment configured successfully');
}

/**
 * Create test database client
 */
function createTestDbClient() {
  return createClient(
    TEST_CONFIG.database.url,
    TEST_CONFIG.database.serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

/**
 * Clean test database
 */
async function cleanTestDatabase() {
  if (!TEST_CONFIG.mock.enabled) {
    console.warn('Skipping database cleanup - mock mode disabled');
    return;
  }
  
  const client = createTestDbClient();
  
  try {
    // Clean test data in reverse dependency order
    const tables = [
      'roasts',
      'comments',
      'social_accounts',
      'organizations',
      'users'
    ];
    
    for (const table of tables) {
      const { error } = await client.from(table).delete().neq('id', '');
      if (error && !error.message.includes('does not exist')) {
        console.warn(`Warning cleaning ${table}:`, error.message);
      }
    }
    
    console.log('Test database cleaned successfully');
  } catch (error) {
    console.warn('Database cleanup error:', error.message);
  }
}

/**
 * Wait for async operations to complete
 */
function waitForAsync(ms = 1000) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate test data helpers
 */
const TestData = {
  organization: (overrides = {}) => ({
    id: `test-org-${Date.now()}`,
    name: 'Test Organization',
    plan: 'pro',
    created_at: new Date().toISOString(),
    ...overrides
  }),
  
  user: (orgId, overrides = {}) => ({
    id: `test-user-${Date.now()}`,
    email: `test-${Date.now()}@example.com`,
    organization_id: orgId,
    role: 'admin',
    created_at: new Date().toISOString(),
    ...overrides
  }),
  
  comment: (orgId, overrides = {}) => ({
    id: `test-comment-${Date.now()}`,
    organization_id: orgId,
    platform: 'twitter',
    external_id: `ext-${Date.now()}`,
    text: 'This is a test comment',
    author_username: 'testuser',
    toxicity_score: 0.3,
    status: 'pending',
    created_at: new Date().toISOString(),
    ...overrides
  }),
  
  roast: (commentId, orgId, overrides = {}) => ({
    id: `test-roast-${Date.now()}`,
    comment_id: commentId,
    organization_id: orgId,
    text: 'This is a test roast response',
    style: 'balanced',
    status: 'generated',
    created_at: new Date().toISOString(),
    ...overrides
  })
};

module.exports = {
  TEST_CONFIG,
  setupTestEnvironment,
  createTestDbClient,
  cleanTestDatabase,
  waitForAsync,
  TestData
};