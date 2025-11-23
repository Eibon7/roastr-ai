/**
 * CI Test Setup
 * Configuration for running tests in CI environment with mock mode
 */

// Set CI environment variables for mock mode
process.env.ENABLE_RQC = 'false';
process.env.NODE_ENV = 'test';
process.env.CI = 'true';

// Mark that we're in CI for skipping real API tests
process.env.SKIP_E2E = 'true';
process.env.SKIP_REAL_API_TESTS = 'true';

// Set all required environment flags to prevent failures
const requiredEnvFlags = [
  'ENABLED_INSTAGRAM',
  'ENABLED_FACEBOOK',
  'ENABLED_DISCORD',
  'ENABLED_TWITCH',
  'ENABLED_REDDIT',
  'ENABLED_TIKTOK',
  'ENABLED_BLUESKY'
];

requiredEnvFlags.forEach((flag) => {
  if (!process.env[flag]) {
    process.env[flag] = 'false';
  }
});

// Mock external API endpoints to prevent network calls
global.fetch = jest.fn((url) => {
  // Mock health endpoint
  if (url.includes('/api/health')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
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
  if (url.includes('/api/logs')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
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

  // Default mock response
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({})
  });
});

console.log('🤖 CI Test Setup: Mock mode enabled, external APIs mocked');
