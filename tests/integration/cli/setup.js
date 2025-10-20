/**
 * Setup for CLI Integration Tests
 * 
 * Global setup and teardown for CLI testing environment
 */

const fs = require('fs-extra');
const path = require('path');
const { rm } = require('fs/promises'); // Node built-in for fs.rm (Issue #618)

// Global test configuration
global.TEST_TIMEOUT = 30000;
global.CLI_PATH = path.join(__dirname, '../../../src/cli.js'); // Issue #618 - correct path

// Setup before all tests
beforeAll(async () => {
  // Ensure test directories exist
  const testDirs = [
    path.join(__dirname, '../../../temp-test-logs'),
    path.join(__dirname, '../../../coverage/cli-integration')
  ];
  
  for (const dir of testDirs) {
    await fs.ensureDir(dir);
  }
  
  // Set up test environment
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
});

// Cleanup after all tests
afterAll(async () => {
  // Clean up temporary directories
  const tempDirs = [
    path.join(__dirname, '../../../temp-test-logs')
  ];
  
  for (const dir of tempDirs) {
    try {
      await rm(dir, { recursive: true, force: true }); // Issue #618 - use Node built-in
    } catch (error) {
      console.warn(`Failed to clean up ${dir}:`, error.message);
    }
  }
});

// Setup before each test
beforeEach(() => {
  // Clear any cached modules to ensure clean state
  jest.clearAllMocks();
});

// Teardown after each test
afterEach(() => {
  // Reset environment variables that might have been modified
  if (process.env.TEST_ORIGINAL_ENV) {
    const originalEnv = JSON.parse(process.env.TEST_ORIGINAL_ENV);
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('LOG_') || key.startsWith('AWS_') || key.startsWith('ALERT_')) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
  }
});
