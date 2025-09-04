module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test paths
  testMatch: [
    '<rootDir>/tests/**/*.test.js'
  ],

  // Module name mapping for easier imports
  moduleNameMapper: {
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/node_modules/**'
  ],
  
  
  // Test timeout
  testTimeout: 10000,
  
  // Verbose output
  verbose: true,
  
  // Coverage thresholds (Issue 82 - Phase 4)
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 30,
      lines: 30,
      statements: 30
    },
    // Workers require higher coverage due to critical system role
    "src/workers/**": {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70
    },
    // Billing requires high coverage due to financial impact
    "src/routes/billing.js": {
      branches: 50,
      functions: 60,
      lines: 60,
      statements: 60
    },
    // Services require good coverage
    "src/services/": {
      branches: 65,
      functions: 70,
      lines: 70,
      statements: 70
    },
    // Shield service requires higher coverage due to security role
    "src/services/shieldService.js": {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Analyze toxicity worker requires coverage
    "src/workers/analyzeToxicity.js": {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  },
  
  // Setup files to run before tests
  setupFilesAfterEnv: ['<rootDir>/tests/setupEnvOnly.js'],
  
  // Projects for different test types
  projects: [
    {
      displayName: 'node-tests',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/unit/routes/**/*.test.js', '<rootDir>/tests/unit/services/**/*.test.js', '<rootDir>/tests/unit/workers/**/*.test.js', '<rootDir>/tests/unit/middleware/**/*.test.js', '<rootDir>/tests/unit/config/**/*.test.js', '<rootDir>/tests/unit/utils/**/*.test.js', '<rootDir>/tests/unit/frontend/**/*.test.js', '<rootDir>/tests/integration/**/*.test.js', '<rootDir>/tests/smoke/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setupEnvOnly.js']
    },
    {
      displayName: 'dom-tests',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/tests/unit/auth/**/*.test.js', '<rootDir>/tests/unit/components/**/*.test.jsx'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
    }
  ]
};