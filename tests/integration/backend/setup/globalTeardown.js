/**
 * Global Teardown for Backend Integration Tests
 * 
 * Runs once after all tests complete
 */

const path = require('path');
const fs = require('fs').promises;

module.exports = async () => {
  console.log('🧹 Starting Backend Integration Tests Global Teardown');

  // Calculate test duration
  const startTime = global.__INTEGRATION_TEST_START__ || Date.now();
  const duration = Date.now() - startTime;
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);

  console.log(`⏱️  Total integration test duration: ${minutes}m ${seconds}s`);

  // Generate test summary report
  const summaryReport = {
    completedAt: new Date().toISOString(),
    duration: duration,
    durationFormatted: `${minutes}m ${seconds}s`,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      mockMode: process.env.REACT_APP_ENABLE_MOCK_MODE === 'true',
      useFixtures: process.env.USE_FIXTURES === 'true',
      apiUrl: process.env.REACT_APP_API_URL
    },
    configuration: {
      testTimeout: process.env.INTEGRATION_TEST_TIMEOUT || '30000',
      retryCount: process.env.INTEGRATION_TEST_RETRIES || '3',
      concurrent: process.env.INTEGRATION_TEST_CONCURRENT === 'true'
    }
  };

  // Save summary report
  try {
    const reportsDir = path.resolve(__dirname, '../reports');
    const summaryPath = path.join(reportsDir, 'integration-summary.json');
    
    await fs.writeFile(
      summaryPath,
      JSON.stringify(summaryReport, null, 2),
      'utf-8'
    );
    
    console.log(`📊 Test summary saved to: ${summaryPath}`);
  } catch (error) {
    console.warn('⚠️  Failed to save test summary:', error.message);
  }

  // Clean up temporary test data
  try {
    const tempDir = path.resolve(__dirname, '../temp');
    await fs.rmdir(tempDir, { recursive: true });
    console.log('🗑️  Cleaned up temporary test data');
  } catch (error) {
    // Ignore if temp dir doesn't exist
    if (error.code !== 'ENOENT') {
      console.warn('⚠️  Failed to clean temp directory:', error.message);
    }
  }

  // Log completion message
  console.log('✅ Backend Integration Tests completed successfully');
  
  if (process.env.USE_FIXTURES === 'true') {
    console.log('💡 Tests ran in fixture mode. To test against real backend:');
    console.log('   npm run test:integration-backend');
  } else {
    console.log('💡 Tests ran against real backend. To use fixtures:');
    console.log('   npm run test:integration-backend:fixtures');
  }
};