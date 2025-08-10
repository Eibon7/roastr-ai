/**
 * Complete CI Test Setup
 * Ensures 100% mock mode for all external APIs and services
 */

// Force mock mode globally
process.env.ENABLE_MOCK_MODE = 'true';
process.env.NODE_ENV = 'test';
process.env.SKIP_E2E = 'true';

// Initialize mock mode system
const { mockMode } = require('../src/config/mockMode');

// Ensure all APIs use mock responses
global.fetch = mockMode.generateMockFetch();

// Mock process.exit to prevent tests from exiting
const originalExit = process.exit;
process.exit = (code) => {
  console.warn(`⚠️ Process.exit(${code}) called during test - ignoring`);
};

// Cleanup after tests
process.on('exit', () => {
  process.exit = originalExit;
});

console.log('🧪 Complete CI Setup: 100% mock mode enabled, no external API calls allowed');