// Jest setup file for DOM testing environment

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

Object.defineProperty(window, 'location', {
    value: mockLocation,
    writable: true
});

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
    
    // Reset location
    mockLocation.href = 'http://localhost:3000/';
    mockLocation.pathname = '/';
    mockLocation.search = '';
    mockLocation.hash = '';
});