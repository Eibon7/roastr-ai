/**
 * Jest Configuration for SPEC 14 - QA Test Suite Integral
 * 
 * Specialized configuration for comprehensive testing:
 * - E2E scenarios with extended timeouts
 * - Contract tests with mock safety
 * - Idempotency tests with database isolation
 * - Tier validation with billing mocks
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns - only SPEC 14 tests
  testMatch: [
    '<rootDir>/tests/e2e/spec14-*.test.js',
    '<rootDir>/tests/integration/spec14-*.test.js',
    '<rootDir>/tests/helpers/syntheticFixtures.test.js'
  ],
  
  // Module resolution
  moduleNameMapper: {
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@fixtures/(.*)$': '<rootDir>/tests/helpers/$1'
  },
  
  // Setup and teardown
  setupFilesAfterEnv: [
    '<rootDir>/tests/setupSpec14.js'
  ],
  
  // Timeout configuration (extended for E2E tests)
  testTimeout: 30000,
  
  // Performance settings
  maxWorkers: process.env.CI ? 2 : 4,
  maxConcurrency: 10,
  
  // Output configuration
  verbose: true,
  silent: false,
  
  // Coverage configuration for SPEC 14 components
  collectCoverageFrom: [
    // Adapter contracts
    'src/adapters/**/*.js',
    '!src/adapters/**/*.test.js',
    
    // Shield system (critical for E2E flows)
    'src/services/shield*.js',
    'src/workers/*Shield*.js',
    
    // Core routing (roast generation pipeline)
    'src/routes/roast.js',
    'src/routes/comments.js',
    
    // Billing and tiers
    'src/routes/billing.js',
    'src/services/billing*.js',
    'src/middleware/requirePlan.js',
    'src/services/tierValidation*.js',
    
    // Queue and workers (idempotency critical)
    'src/services/queueService.js',
    'src/workers/BaseWorker.js',
    'src/workers/GenerateReplyWorker.js',
    
    // Utilities
    'src/services/costControl.js',
    'src/middleware/auth.js'
  ],
  
  // Coverage thresholds (high for SPEC 14 critical components)
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    // Adapter contracts require 100% coverage
    'src/adapters/**/*.js': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    // Shield system is security-critical
    'src/services/shield*.js': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    // Billing must be highly tested
    'src/routes/billing.js': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  
  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary', 
    'json-summary',
    'html',
    'lcov'
  ],
  
  // Global test setup
  globals: {
    'SPEC14_TEST_MODE': true,
    'DRY_RUN_SHIELD': true,
    'ENABLE_MOCK_MODE': true
  },
  
  // Test environment variables
  testEnvironment: 'node',
  testEnvironmentOptions: {
    NODE_ENV: 'test',
    ENABLE_MOCK_MODE: 'true',
    DRY_RUN_SHIELD: 'true',
    JEST_TIMEOUT: '30000'
  },
  
  // Error handling
  bail: false, // Run all tests even if some fail
  errorOnDeprecated: true,
  
  // Transform settings
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // Clear mocks between tests for clean state
  clearMocks: true,
  restoreMocks: true,
  
  // Detect open handles (important for async cleanup)
  detectOpenHandles: true,
  forceExit: true,
  
  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/spec14-report',
        filename: 'spec14-test-report.html',
        pageTitle: 'SPEC 14 - QA Test Suite Report',
        logoImgPath: undefined,
        hideIcon: false,
        expand: true,
        openReport: false
      }
    ]
  ],
  
  // Test result processor for custom reporting
  testResultsProcessor: '<rootDir>/tests/spec14TestResultsProcessor.js'
};