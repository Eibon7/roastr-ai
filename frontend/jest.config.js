// Frontend Jest Configuration
// Extended from Create React App's default config to include social networks panel tests

module.exports = {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Test patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/?(*.)(spec|test).{js,jsx,ts,tsx}'
  ],
  
  // Module name mapping for absolute imports and CSS
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  
  // Transform files
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
    '^.+\\.css$': '<rootDir>/config/jest/cssTransform.js',
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '<rootDir>/config/jest/fileTransform.js'
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/src/setupTests.js'
  ],
  
  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.js',
    '!src/setupTests.js'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    // Specific thresholds for social networks components
    './src/hooks/useSocialAccounts.js': {
      branches: 75,
      functions: 90,
      lines: 80,
      statements: 80
    },
    './src/components/AccountModal.js': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/api/social.js': {
      branches: 70,
      functions: 100,
      lines: 75,
      statements: 75
    }
  },
  
  // Mock mode setup for API calls
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  
  // Test timeout
  testTimeout: 10000,
  
  // Verbose output for social networks tests
  verbose: true
};