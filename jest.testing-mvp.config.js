/**
 * Jest Configuration for Testing MVP (Issue #403)
 * Specialized configuration for comprehensive test suite
 */

module.exports = {
  // Basic setup
  testEnvironment: 'node',
  verbose: true,
  
  // Test discovery
  testMatch: [
    '**/tests/e2e/**/*.test.js',
    '**/tests/integration/**/*.test.js',
    '**/tests/unit/**/*.test.js'
  ],
  
  // Setup and teardown
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/test-setup.js'],
  
  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/public/**',
    '!src/**/*.test.js',
    '!src/**/test-*.js'
  ],
  coverageDirectory: 'coverage/testing-mvp',
  coverageReporters: ['text', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    },
    // Critical services require higher coverage
    'src/services/': {
      branches: 80,
      functions: 85,
      lines: 90,
      statements: 90
    },
    'src/workers/': {
      branches: 75,
      functions: 80,
      lines: 85,
      statements: 85
    }
  },
  
  // Test execution
  testTimeout: 30000,
  maxWorkers: '50%', // Use half of available CPU cores
  
  // Module handling
  moduleDirectories: ['node_modules', 'src'],
  
  // Transform configuration
  transform: {
    '^.+\\.jsx?$': 'babel-jest'
  },
  
  // Mock configuration
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,
  
  // Test categories with different timeouts
  projects: [
    {
      displayName: 'unit',
      testMatch: ['**/tests/unit/**/*.test.js'],
      testTimeout: 10000
    },
    {
      displayName: 'integration', 
      testMatch: ['**/tests/integration/**/*.test.js'],
      testTimeout: 45000
    },
    {
      displayName: 'e2e',
      testMatch: ['**/tests/e2e/**/*.test.js'],
      testTimeout: 60000
    }
  ],
  
  // Reporting
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'test-results',
        outputName: 'testing-mvp-results.xml'
      }
    ]
  ],
  
  // Environment variables for testing
  setupFiles: ['<rootDir>/tests/helpers/env-setup.js'],
  
  // Global test configuration
  globals: {
    'process.env': {
      NODE_ENV: 'test',
      ENABLE_MOCK_MODE: 'true'
    }
  }
};