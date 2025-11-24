// Jest setup file for DOM testing environment

// Import jest-dom for custom matchers
require('@testing-library/jest-dom');

// Import React for proper hook support
const React = require('react');
global.React = React;

// Polyfills for jsdom
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// Mock environment variables for tests
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.NODE_ENV = 'test';

// Mock fetch globally
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((i) => Object.keys(store)[i] || null)
  };
})();

// Mock window.location
const mockLocation = {
  href: 'http://localhost:3000/',
  origin: 'http://localhost:3000',
  protocol: 'http:',
  hostname: 'localhost',
  port: '3000',
  pathname: '/',
  search: '',
  hash: '',
  assign: jest.fn(),
  replace: jest.fn(),
  reload: jest.fn()
};

// Set up global mocks
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Skip location setup in global scope since JSDOM tests create their own window
if (typeof window !== 'undefined' && window.location) {
  try {
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
      configurable: true
    });
  } catch (e) {
    // Location cannot be redefined in newer JSDOM, skip
    console.warn('Cannot redefine window.location in JSDOM setup');
  }
}

// Mock setTimeout and setInterval
global.setTimeout = jest.fn((callback, delay) => {
  if (typeof callback === 'function') {
    callback();
  }
  return 1; // Return a fake timer ID
});

global.clearTimeout = jest.fn();
global.setInterval = jest.fn();
global.clearInterval = jest.fn();

// Reset all mocks before each test
beforeEach(() => {
  fetch.mockClear();
  mockLocalStorage.getItem.mockClear();
  mockLocalStorage.setItem.mockClear();
  mockLocalStorage.removeItem.mockClear();
  mockLocalStorage.clear.mockClear();

  mockLocation.assign.mockClear();
  mockLocation.replace.mockClear();
  mockLocation.reload.mockClear();

  // Clear localStorage
  const store = {};
  mockLocalStorage.clear();

  // Reset location if it exists
  if (typeof window !== 'undefined' && window.location) {
    try {
      mockLocation.href = 'http://localhost:3000/';
      mockLocation.pathname = '/';
      mockLocation.search = '';
      mockLocation.hash = '';
    } catch (e) {
      // Skip if location cannot be modified
    }
  }
});
