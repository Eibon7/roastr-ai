import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Mock Perspective client to avoid real API calls
vi.mock('../lib/perspectiveClient', () => ({
  analyze: async () => ({})
}));

// Cleanup after each test
afterEach(() => {
  cleanup();
  // In vitest 4.0.17+, restoreAllMocks() only restores spies (vi.spyOn),
  // not mocks created with vi.fn(). We explicitly clear mocks here.
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

// Mock localStorage with actual storage functionality
const localStorageMock = (() => {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((key) => delete store[key]);
    }
  };
})();
global.localStorage = localStorageMock as any;

// Mock fetch
global.fetch = vi.fn();
