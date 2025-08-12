/**
 * Environment Setup for Backend Integration Tests
 * 
 * Loads environment variables and configures test environment
 */

const path = require('path');
const fs = require('fs');

// Helper function to load environment file if it exists
function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    require('dotenv').config({ path: filePath });
    console.log(`📄 Loaded environment from: ${filePath}`);
    return true;
  }
  return false;
}

// Environment setup for integration tests
function setupIntegrationEnvironment() {
  console.log('🔧 Setting up integration test environment...');
  
  const rootDir = path.resolve(__dirname, '../../../../');
  
  // Determine test mode
  const useBackendFixtures = process.env.USE_BACKEND_FIXTURES === 'true';
  const enableMockMode = process.env.ENABLE_MOCK_MODE === 'true';
  
  // Load appropriate environment files
  if (!useBackendFixtures && !enableMockMode) {
    // Real backend mode - load .env.test.real
    const realEnvPath = path.join(rootDir, '.env.test.real');
    if (!loadEnvFile(realEnvPath)) {
      console.warn('⚠️  .env.test.real not found, falling back to fixtures mode');
      process.env.USE_BACKEND_FIXTURES = 'true';
      process.env.FALLBACK_TO_FIXTURES_ON_ERROR = 'true';
    }
  }
  
  // Always try to load base test env
  const testEnvPath = path.join(rootDir, '.env.test');
  loadEnvFile(testEnvPath);
  
  // Load default .env if available  
  const defaultEnvPath = path.join(rootDir, '.env');
  loadEnvFile(defaultEnvPath);
  
  // Set integration test specific defaults
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.INTEGRATION_TEST_MODE = process.env.INTEGRATION_TEST_MODE || 'backend';
  process.env.TEST_TIMEOUT = process.env.TEST_TIMEOUT || '30000';
  process.env.TEST_RETRY_ATTEMPTS = process.env.TEST_RETRY_ATTEMPTS || '3';
  process.env.INTEGRATION_TEST_DEBUG = process.env.INTEGRATION_TEST_DEBUG || 'true';
  
  // Configure React environment for testing
  process.env.REACT_APP_ENABLE_MOCK_MODE = enableMockMode ? 'true' : 'false';
  process.env.REACT_APP_API_URL = process.env.API_BASE_URL || process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
  
  // Set fallback configuration
  if (!process.env.FALLBACK_TO_FIXTURES_ON_ERROR) {
    process.env.FALLBACK_TO_FIXTURES_ON_ERROR = 'true';
  }
  if (!process.env.FALLBACK_TIMEOUT) {
    process.env.FALLBACK_TIMEOUT = '5000';
  }
  
  // Log final configuration
  const config = {
    NODE_ENV: process.env.NODE_ENV,
    INTEGRATION_TEST_MODE: process.env.INTEGRATION_TEST_MODE,
    USE_BACKEND_FIXTURES: process.env.USE_BACKEND_FIXTURES || 'false',
    ENABLE_MOCK_MODE: process.env.ENABLE_MOCK_MODE || 'false',
    REACT_APP_ENABLE_MOCK_MODE: process.env.REACT_APP_ENABLE_MOCK_MODE,
    REACT_APP_API_URL: process.env.REACT_APP_API_URL,
    API_BASE_URL: process.env.API_BASE_URL || 'NOT_SET',
    TEST_TIMEOUT: process.env.TEST_TIMEOUT,
    FALLBACK_TO_FIXTURES_ON_ERROR: process.env.FALLBACK_TO_FIXTURES_ON_ERROR,
    TEST_USER_EMAIL: process.env.TEST_USER_EMAIL ? '***SET***' : 'NOT_SET',
    SUPABASE_URL: process.env.SUPABASE_URL ? '***SET***' : 'NOT_SET'
  };
  
  console.log('🔧 Integration Test Environment Configuration:');
  console.table(config);
  
  // Validate critical configuration
  const warnings = [];
  
  if (process.env.USE_BACKEND_FIXTURES !== 'true' && !process.env.API_BASE_URL && !process.env.REACT_APP_API_URL) {
    warnings.push('API_BASE_URL or REACT_APP_API_URL should be set for real backend tests');
  }
  
  if (process.env.USE_BACKEND_FIXTURES !== 'true' && !process.env.TEST_USER_EMAIL) {
    warnings.push('TEST_USER_EMAIL should be set for authentication tests');
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️  Configuration warnings:');
    warnings.forEach(warning => console.warn(`   - ${warning}`));
    
    if (process.env.FALLBACK_TO_FIXTURES_ON_ERROR === 'true') {
      console.log('💡 Tests will fallback to fixture mode if backend is unreachable');
    }
  }
  
  console.log('✅ Integration test environment setup completed');
}

// Run setup
setupIntegrationEnvironment();