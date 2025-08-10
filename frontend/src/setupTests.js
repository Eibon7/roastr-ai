// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock environment variables for frontend tests
if (process.env.CI === 'true' || process.env.NODE_ENV === 'test') {
  process.env.REACT_APP_ENABLE_MOCK_MODE = 'true';
  process.env.REACT_APP_SUPABASE_URL = 'http://localhost/dummy';
  process.env.REACT_APP_SUPABASE_ANON_KEY = 'dummy';
}

// Mock fetch for all frontend tests
global.fetch = jest.fn((url) => {
  // Mock health endpoint
  if (url && url.includes('/api/health')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        timestamp: new Date().toISOString(),
        services: {
          database: 'ok',
          queue: 'ok',
          openai: 'ok'
        },
        flags: {
          rqc: false,
          shield: false,
          mockMode: true
        }
      })
    });
  }
  
  // Mock logs endpoint
  if (url && url.includes('/api/logs')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        logs: [
          {
            id: '1',
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Test log entry',
            source: 'test'
          }
        ],
        total: 1
      })
    });
  }
  
  // Mock user endpoint
  if (url && url.includes('/api/user')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        id: 'mock-user-id',
        name: 'Mock User',
        email: 'mock@example.com',
        plan: 'pro'
      })
    });
  }
  
  // Mock usage endpoint
  if (url && url.includes('/api/usage')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        aiCalls: 150,
        limits: { aiCallsLimit: 1000 }
      })
    });
  }
  
  // Default mock response
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({})
  });
});

// Setup for each test
beforeEach(() => {
  // Clear all fetch mocks
  fetch.mockClear();
});

console.log('🤖 Frontend Tests: Mock mode enabled, external APIs mocked');