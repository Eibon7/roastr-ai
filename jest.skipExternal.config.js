// Mock mode configuration - only runs safe tests without external dependencies
module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Only run specific safe test suites in mock mode
  testMatch: [
    '<rootDir>/tests/smoke/**/*.test.js',
    '<rootDir>/tests/unit/routes/user.test.js',
    '<rootDir>/tests/unit/routes/user-extended.test.js',
    '<rootDir>/tests/unit/routes/billing.test.js',
    '<rootDir>/tests/unit/routes/billing-simple.test.js',
    '<rootDir>/tests/unit/routes/plan.test.js',
    '<rootDir>/tests/unit/routes/plan-extended.test.js',
    '<rootDir>/tests/unit/routes/dashboard.test.js',
    '<rootDir>/tests/unit/routes/auth-edge-cases.test.js',
    '<rootDir>/tests/unit/middleware/requirePlan.test.js',
    '<rootDir>/tests/unit/middleware/isAdmin.test.js',
    '<rootDir>/tests/unit/middleware/security.test.js',
    '<rootDir>/tests/unit/config/**/*.test.js',
    '<rootDir>/tests/unit/frontend/**/*.test.js'
  ],
  
  // Skip all problematic tests completely
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/frontend/',
    '<rootDir>/tests/unit/workers/',
    '<rootDir>/tests/unit/services/styleProfileGenerator.test.js',
    '<rootDir>/tests/unit/services/shieldService.test.js',
    '<rootDir>/tests/unit/services/roastGeneratorEnhanced.test.js',
    '<rootDir>/tests/unit/services/costControl.test.js',
    '<rootDir>/tests/unit/services/queueService.test.js',
    '<rootDir>/tests/unit/services/authService.test.js',
    '<rootDir>/tests/unit/services/metricsService.test.js',
    '<rootDir>/tests/unit/services/authPasswordRecovery.test.js',
    '<rootDir>/tests/unit/services/rqcService.test.js',
    '<rootDir>/tests/integration/',
    '<rootDir>/tests/unit/auth/',
    '<rootDir>/tests/unit/routes/integrations-new.test.js',
    '<rootDir>/tests/unit/routes/style-profile.test.js',
    '<rootDir>/tests/unit/routes/admin.test.js'
  ],
  
  // Coverage settings
  collectCoverageFrom: [
    'src/routes/**/*.js',
    'src/middleware/**/*.js',
    'src/config/**/*.js',
    '!src/**/*.test.js'
  ],
  
  // Test timeout
  testTimeout: 10000,
  
  // Verbose output
  verbose: true,
  
  // Mock mode setup
  setupFilesAfterEnv: ['<rootDir>/tests/setupMockMode.js'],
  
  // Disable projects (single config)
  projects: undefined,
  
  // Display name
  displayName: 'mock-safe-tests'
};