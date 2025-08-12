// Backend Integration Tests Jest Configuration

module.exports = {
  // Test environment
  testEnvironment: 'jsdom',
  
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
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  
  // Transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
  },
  
  // Global timeout for integration tests
  testTimeout: 30000,
  
  // Coverage configuration for integration tests
  collectCoverageFrom: [
    'frontend/src/components/**/*.{js,jsx}',
    'frontend/src/hooks/**/*.{js,jsx}',
    'frontend/src/api/**/*.{js,jsx,ts,tsx}',
    '!frontend/src/**/*.d.ts',
    '!frontend/src/index.js',
    '!frontend/src/setupTests.js'
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
      outputDirectory: 'tests/integration/backend/reports',
      outputName: 'integration-test-results.xml',
      suiteName: 'Backend Integration Tests'
    }]
  ],
  
  // Additional configuration for backend integration
  globalSetup: '<rootDir>/tests/integration/backend/setup/globalSetup.js',
  globalTeardown: '<rootDir>/tests/integration/backend/setup/globalTeardown.js'
};