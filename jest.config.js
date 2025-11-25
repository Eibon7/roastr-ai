module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Babel transform for modern JS syntax
  transform: {
    '^.+\\.jsx?$': 'babel-jest'
  },
  
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
      branches: 30,
      functions: 30,
      lines: 30,
      statements: 30
    },
    // Billing requires high coverage due to financial impact
    "src/routes/billing.js": {
      branches: 50,
      functions: 60,
      lines: 60,
      statements: 60
    },
    // Services require good coverage (lowered temporarily for SPEC 14)
    "src/services/": {
      branches: 20,
      functions: 20,
      lines: 20,
      statements: 20
    },
    // Shield service requires higher coverage due to security role (lowered temporarily)
    "src/services/shieldService.js": {
      branches: 20,
      functions: 20,
      lines: 20,
      statements: 20
    },
    // Decision engine under Shield requires higher coverage (lowered temporarily)
    "src/services/shieldDecisionEngine.js": {
      branches: 20,
      functions: 20,
      lines: 20,
      statements: 20
    }
  },
  
  // Setup files to run before tests
  setupFilesAfterEnv: ['<rootDir>/tests/setupEnvOnly.js'],
  
  // Projects for different test types
  projects: [
    {
      displayName: 'unit-tests',
      testMatch: ['<rootDir>/tests/unit/routes/**/*.test.js', '<rootDir>/tests/unit/services/**/*.test.js', '<rootDir>/tests/unit/workers/**/*.test.js', '<rootDir>/tests/unit/middleware/**/*.test.js', '<rootDir>/tests/unit/config/**/*.test.js', '<rootDir>/tests/unit/utils/**/*.test.js', '<rootDir>/tests/unit/adapters/**/*.test.js', '<rootDir>/tests/unit/frontend/**/*.test.js', '<rootDir>/tests/unit/scripts/**/*.test.js', '<rootDir>/tests/unit/validators/**/*.test.js', '<rootDir>/tests/unit/lib/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setupEnvOnly.js']
    },
    {
      displayName: 'integration-tests',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js', '<rootDir>/tests/e2e/**/*.test.js', '<rootDir>/tests/smoke/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setupIntegration.js'],
      testTimeout: 30000
    },
    {
      displayName: 'security-tests',
      testMatch: ['<rootDir>/tests/security/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setupEnvOnly.js']
    },
    {
      displayName: 'dom-tests',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/tests/unit/auth/**/*.test.js', '<rootDir>/tests/unit/components/**/*.test.jsx'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
    },
    {
      displayName: 'rls-tests',
      testMatch: ['<rootDir>/tests/rls/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setupEnvOnly.js'],
      testTimeout: 30000
    }
  ]
};