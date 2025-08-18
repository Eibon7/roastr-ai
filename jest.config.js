module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test paths
  testMatch: [
    '<rootDir>/tests/**/*.test.js'
  ],
  
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
  
  // Coverage thresholds (Phase 2: Workers + Billing)
  coverageThreshold: {
    global: {
      branches: 35,
      functions: 40,
      lines: 40,
      statements: 40
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
    }
  },
  
  // Setup files to run before tests
  setupFilesAfterEnv: ['<rootDir>/tests/setupEnvOnly.js'],
  
  // Projects for different test types
  projects: [
    {
      displayName: 'node-tests',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/unit/routes/**/*.test.js', '<rootDir>/tests/unit/services/**/*.test.js', '<rootDir>/tests/unit/workers/**/*.test.js', '<rootDir>/tests/unit/middleware/**/*.test.js', '<rootDir>/tests/unit/config/**/*.test.js', '<rootDir>/tests/unit/frontend/**/*.test.js', '<rootDir>/tests/integration/**/*.test.js', '<rootDir>/tests/smoke/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setupEnvOnly.js']
    },
    {
      displayName: 'dom-tests', 
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/tests/unit/auth/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
    }
  ]
};