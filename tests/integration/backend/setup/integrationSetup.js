/**
 * Integration Tests Setup
 *
 * Setup configuration for backend integration tests
 */

// Node.js 18+ has built-in fetch, so no need for polyfill

// Mock console methods to reduce noise in integration tests
const originalConsole = { ...console };

beforeAll(() => {
  // Only show errors and warnings in integration tests
  console.log = jest.fn();
  console.info = jest.fn();
  console.debug = jest.fn();
  // Keep error and warn for important messages
});

afterAll(() => {
  // Restore console methods
  Object.assign(console, originalConsole);
});

// Global test configuration
const INTEGRATION_CONFIG = {
  API_URL: process.env.REACT_APP_API_URL || 'http://localhost:3001',
  USE_FIXTURES: process.env.USE_FIXTURES === 'true',
  MOCK_MODE: process.env.REACT_APP_ENABLE_MOCK_MODE === 'true',
  TEST_TIMEOUT: parseInt(process.env.INTEGRATION_TEST_TIMEOUT) || 30000,
  RETRY_COUNT: parseInt(process.env.INTEGRATION_TEST_RETRIES) || 3
};

// Make config available globally
global.INTEGRATION_CONFIG = INTEGRATION_CONFIG;

// Log integration test configuration
console.error('🔧 Integration Test Configuration:');
console.error(`📡 API URL: ${INTEGRATION_CONFIG.API_URL}`);
console.error(`📁 Use Fixtures: ${INTEGRATION_CONFIG.USE_FIXTURES}`);
console.error(`🎭 Mock Mode: ${INTEGRATION_CONFIG.MOCK_MODE}`);
console.error(`⏱️  Timeout: ${INTEGRATION_CONFIG.TEST_TIMEOUT}ms`);

// Fetch polyfill already loaded at the top

// Mock localStorage for tests
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock window.open for OAuth tests
Object.defineProperty(window, 'open', {
  value: jest.fn()
});

// Global error handler for integration tests
const handleUnhandledRejection = (event) => {
  console.error('🚨 Unhandled promise rejection in integration test:', event.reason);
  // Don't fail the test for unhandled rejections, but log them
  event.preventDefault();
};

const handleError = (event) => {
  console.error('🚨 Unhandled error in integration test:', event.error);
};

// Add global error handlers
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', handleUnhandledRejection);
  window.addEventListener('error', handleError);
}

// Clean up after each test
afterEach(() => {
  // Clear localStorage mocks
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();

  // Clear fetch mocks if any
  if (global.fetch && global.fetch.mockClear) {
    global.fetch.mockClear();
  }

  // Clear window.open mocks
  if (window.open && window.open.mockClear) {
    window.open.mockClear();
  }
});
