module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/smoke/feature-flags.test.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/frontend/',
    '<rootDir>/tests/unit/',
    '<rootDir>/tests/integration/'
  ],
  verbose: false,
  silent: false,
  collectCoverage: false,
  testTimeout: 60000,
  forceExit: true,
  detectOpenHandles: true,
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}'
    }]
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setupSimple.js'],
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest'
  }
};
