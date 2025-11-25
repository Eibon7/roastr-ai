/**
 * Setup file for Shield Service tests
 *
 * This file mocks logger BEFORE any module loads mockMode,
 * preventing the singleton creation error.
 */

// Mock logger before ANY module loads
jest.mock('../src/utils/logger', () => {
  // Create a mock that matches the actual export structure
  // logger.js exports: module.exports = Logger; module.exports.logger = Logger;
  const mockMethods = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };

  function MockLogger() {}
  MockLogger.info = mockMethods.info;
  MockLogger.warn = mockMethods.warn;
  MockLogger.error = mockMethods.error;
  MockLogger.debug = mockMethods.debug;
  MockLogger.logger = mockMethods;
  MockLogger.SafeUtils = {};

  return MockLogger;
});

