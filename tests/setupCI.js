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

requiredEnvFlags.forEach(flag => {
  if (!process.env[flag]) {
    process.env[flag] = 'false';
  }
});

// Mock external API endpoints to prevent network calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({}),
    ok: true,
    status: 200
  })
);

console.log('🤖 CI Test Setup: Mock mode enabled, external APIs mocked');