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
  verbose: true
};