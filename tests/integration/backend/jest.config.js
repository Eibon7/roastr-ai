// Backend Integration Tests Jest Configuration

const path = require('path');

module.exports = {
  // Root directory for all paths
  rootDir: path.resolve(__dirname, '../../../'),
  
  // Roots to search for test files
  roots: ['<rootDir>/tests/integration/backend'],
  
  // Test environment
  testEnvironment: 'node',
  
  // Only run integration tests from this directory
  testMatch: [
    '<rootDir>/tests/integration/backend/**/*.test.js'
  ],
  
  // Use different setup for integration tests
  setupFilesAfterEnv: [
    '<rootDir>/tests/integration/backend/setup/integrationSetup.js'
  ],
  
  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/frontend/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^src/(.*)$': '<rootDir>/src/$1'
  },
  
  // Transform configuration
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { rootMode: 'upward' }]
  },
  
  // Transform ignore patterns - empty to transform everything
  transformIgnorePatterns: [],
  
  // Environment variables for integration tests
  setupFiles: ['<rootDir>/tests/integration/backend/setup.env.cjs'],
  
  // Global timeout for integration tests
  testTimeout: parseInt(process.env.TEST_TIMEOUT) || 30000,
  
  // Coverage configuration for integration tests
  collectCoverageFrom: [
    'frontend/src/components/**/*.{js,jsx}',
    'frontend/src/hooks/**/*.{js,jsx}',
    'frontend/src/api/**/*.{js,jsx,ts,tsx}',
    'frontend/src/pages/**/*.{js,jsx}',
    'src/routes/**/*.{js}',
    'src/services/**/*.{js}',
    '!frontend/src/**/*.d.ts',
    '!frontend/src/index.js',
    '!frontend/src/setupTests.js',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },
  
  // Integration test specific settings
  maxWorkers: 1, // Run integration tests serially
  verbose: true,
  
  // Don't collect coverage by default (use specific coverage command)
  collectCoverage: false,
  
  // Integration test reporters
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './tests/integration/backend/reports',
      outputName: 'integration-test-results.xml',
      suiteName: 'Backend Integration Tests'
    }]
  ],
  
  // Additional configuration for backend integration
  globalSetup: '<rootDir>/tests/integration/backend/setup/globalSetup.js',
  globalTeardown: '<rootDir>/tests/integration/backend/setup/globalTeardown.js',
  
  // Handle ES6 modules and transformations
  extensionsToTreatAsEsm: ['.jsx', '.ts', '.tsx'],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/frontend/build/',
    '/coverage/'
  ],
  
  // Module file extensions
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],
  
  // Resolve modules
  resolver: undefined,
  
  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost'
  }
};