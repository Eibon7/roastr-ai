# Backend Integration Tests

This directory contains integration tests for the backend API and services.

## Setup

### Environment Configuration

1. **For local development with real backend:**
   - Create `.env.test.real` in the project root (not committed to git)
   - Add your test credentials and API endpoints
2. **For CI or fixture-based testing:**
   - Tests will automatically use fixtures when real backend is not available
   - Set `USE_BACKEND_FIXTURES=true` to force fixture mode

### Running Tests

```bash
# Run all backend integration tests
npm run test:integration-backend

# Run with fixtures only
USE_BACKEND_FIXTURES=true npm run test:integration-backend

# Run with real backend
npm run test:integration-backend
```

## Test Structure

- `setup/` - Jest configuration and environment setup
- `fixtures/` - JSON fixtures for offline testing
- `utils/` - Test utilities and helpers
- `*.test.js` - Integration test files

## Configuration

The tests support multiple modes:

1. **Real Backend Mode** - Uses actual API endpoints (requires `.env.test.real`)
2. **Fixture Mode** - Uses JSON fixtures for offline/CI testing
3. **Fallback Mode** - Automatically falls back to fixtures if backend is unreachable

## Environment Variables

- `USE_BACKEND_FIXTURES` - Force fixture mode (true/false)
- `ENABLE_MOCK_MODE` - Enable mock mode for API responses
- `TEST_TIMEOUT` - Test timeout in milliseconds (default: 30000)
- `FALLBACK_TO_FIXTURES_ON_ERROR` - Enable automatic fallback (default: true)
