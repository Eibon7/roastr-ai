// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock fetch globally for all tests
global.fetch = jest.fn();

// Setup for each test
beforeEach(() => {
  // Clear all fetch mocks
  fetch.mockClear();
});