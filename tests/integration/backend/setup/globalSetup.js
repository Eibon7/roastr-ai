/**
 * Global Setup for Backend Integration Tests
 * 
 * Runs once before all tests start
 */

const path = require('path');
const fs = require('fs').promises;

module.exports = async () => {
  console.log('🚀 Starting Backend Integration Tests Global Setup');

  // Create necessary directories
  const reportsDir = path.resolve(__dirname, '../reports');
  const backupDir = path.resolve(__dirname, '../fixtures/backup');
  
  await fs.mkdir(reportsDir, { recursive: true });
  await fs.mkdir(backupDir, { recursive: true });
  
  console.log('📁 Created test directories');

  // Log test environment
  const config = {
    NODE_ENV: process.env.NODE_ENV,
    REACT_APP_ENABLE_MOCK_MODE: process.env.REACT_APP_ENABLE_MOCK_MODE,
    USE_FIXTURES: process.env.USE_FIXTURES,
    REACT_APP_API_URL: process.env.REACT_APP_API_URL,
    TEST_USER_EMAIL: process.env.TEST_USER_EMAIL ? '***SET***' : 'NOT_SET',
    TEST_USER_AUTH_TOKEN: process.env.TEST_USER_AUTH_TOKEN ? '***SET***' : 'NOT_SET'
  };

  console.log('🔧 Test Environment Configuration:');
  console.table(config);

  // Validate required environment variables for real backend tests
  if (process.env.USE_FIXTURES !== 'true') {
    const requiredVars = ['REACT_APP_API_URL'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.warn('⚠️  Missing environment variables for real backend tests:');
      missingVars.forEach(varName => console.warn(`   - ${varName}`));
      console.log('💡 Tests will fallback to fixture mode');
    }
  }

  // Set global test start time
  global.__INTEGRATION_TEST_START__ = Date.now();
  
  console.log('✅ Global setup completed');
};