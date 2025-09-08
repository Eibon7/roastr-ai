/**
 * Jest Configuration for CLI Integration Tests
 * 
 * Specific configuration for testing CLI commands and log management functionality
 */

module.exports = {
  displayName: 'CLI Integration Tests',
  testMatch: ['**/tests/integration/cli/**/*.test.js'],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/integration/cli/setup.js'],
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 30000,
  maxWorkers: 1, // Run CLI tests sequentially to avoid conflicts

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/services/logBackupService.js',
    'src/utils/logMaintenance.js',
    'src/services/alertService.js',
    'cli.js'
  ],
  coverageDirectory: process.env.COVERAGE_DIR || 'coverage/cli-integration',
  coverageReporters: ['text', 'lcov', 'html'],

  // Environment variables for testing
  setupFiles: ['<rootDir>/tests/integration/cli/env.setup.js'],

  // Verbose output for debugging
  verbose: true,

  // Handle long-running operations - prefer fixing open handles
  // forceExit: true, // prefer fixing open handles
  detectOpenHandles: true
};
