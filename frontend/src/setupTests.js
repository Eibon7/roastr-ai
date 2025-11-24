// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { setupGlobalMocks, createMockFetch } from './lib/mockMode';

// Force mock environment variables for all tests
process.env.NODE_ENV = 'test';
process.env.REACT_APP_ENABLE_MOCK_MODE = 'true';
process.env.REACT_APP_SUPABASE_URL = 'http://localhost/mock';
process.env.REACT_APP_SUPABASE_ANON_KEY = 'mock-anon-key';

// Setup global mocks
setupGlobalMocks();

// Override global fetch with Jest mock
global.fetch = jest.fn(createMockFetch());

// Mock timers and other global functions that may cause issues
global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn()
}));

// Mock window.matchMedia for responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
});

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn()
}));

// Setup for each test
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  if (global.fetch && global.fetch.mockClear) {
    global.fetch.mockClear();
  }
});

// Suppress console warnings in tests unless explicitly needed
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && typeof args[0] === 'string') {
    // Suppress known React warnings that are not critical
    if (args[0].includes('act(')) return;
    if (args[0].includes('Warning: An update to')) return;
    if (args[0].includes('Warning: Cannot update a component')) return;
  }
  originalWarn.apply(console, args);
};

console.log('🤖 Frontend Tests: Complete mock mode enabled, all external APIs mocked');
