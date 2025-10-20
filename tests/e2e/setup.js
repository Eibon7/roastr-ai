/**
 * E2E Test Setup and Teardown
 * Issue #419: Global setup for E2E tests
 *
 * @module tests/e2e/setup
 */

const { chromium } = require('@playwright/test');

/**
 * Global setup function
 * Runs once before all tests
 */
async function globalSetup() {
  console.log('🚀 Starting E2E test setup...');

  // Verify environment variables
  const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missingVars.join(', ')}`);
    console.warn('⚠️  Some tests may fail without proper configuration');
  }

  // Set NODE_ENV to test if not already set
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
    console.log('✓ Set NODE_ENV=test');
  }

  // Check if application is running
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(baseURL, { timeout: 10000 });
    await browser.close();
    console.log(`✓ Application is running at ${baseURL}`);
  } catch (error) {
    console.error(`❌ Application is not running at ${baseURL}`);
    console.error('   Please start the application with: npm start');
    throw new Error('Application not running');
  }

  console.log('✅ E2E test setup complete\n');
}

/**
 * Global teardown function
 * Runs once after all tests
 */
async function globalTeardown() {
  console.log('\n🏁 E2E test teardown complete');
}

module.exports = {
  globalSetup,
  globalTeardown,
};
