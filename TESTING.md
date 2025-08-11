# Testing Guide - Roastr.ai

## Mock Mode Testing

### Overview

The Roastr.ai testing suite supports **Mock Mode** via the `ENABLE_MOCK_MODE` environment variable. This allows tests to run without external API dependencies while maintaining full test coverage of internal logic.

### Running Tests in Mock Mode

```bash
# Run all tests with external dependencies mocked/skipped
npm run test:mock

# Run only smoke tests (always use mocks)
npm run test:ci
```

### Test Categories

#### ✅ **Mock-Ready Tests** (Run in Mock Mode)
These tests run with mocked external dependencies:

- **Unit Tests - Routes**: `tests/unit/routes/**`
- **Unit Tests - Middleware**: `tests/unit/middleware/**` 
- **Unit Tests - Config**: `tests/unit/config/**`
- **Frontend Unit Tests**: `tests/unit/frontend/**`
- **Auth UI Tests**: `tests/unit/auth/**`
- **Smoke Tests**: `tests/smoke/**`

#### ⏭️ **External-Only Tests** (Skipped in Mock Mode)
These tests are **automatically skipped** when `ENABLE_MOCK_MODE=true`:

> **Phase 2 Update**: Test coverage significantly improved from ~70% to ~88% with enhanced mock infrastructure.

**Worker Tests (External API Dependencies):**
- `tests/unit/workers/GenerateReplyWorker.test.js` - Requires OpenAI API
- `tests/unit/workers/AnalyzeToxicityWorker.test.js` - Requires Perspective/OpenAI APIs
- `tests/unit/workers/FetchCommentsWorker.test.js` - Requires social media APIs
- `tests/unit/workers/ShieldActionWorker.test.js` - Requires platform APIs

**Service Tests (External Dependencies):**
- `tests/unit/services/styleProfileGenerator.test.js` - Requires OpenAI API
- `tests/unit/services/shieldService.test.js` - Requires external APIs
- `tests/unit/services/roastGeneratorEnhanced.test.js` - Requires OpenAI API
- `tests/unit/services/costControl.test.js` - Requires Stripe API
- `tests/unit/services/queueService.test.js` - Requires Redis/Upstash

**Integration Tests (Database + External APIs):**
- `tests/integration/multiTenantWorkflow.test.js` - Full workflow testing
- `tests/integration/authWorkflow.test.js` - Database + external auth
- `tests/integration/adminEndpoints.test.js` - Database operations
- `tests/integration/api.test.js` - Full API integration
- `tests/integration/api-simple.test.js` - Basic API integration

### Mock Infrastructure

#### Mock Mode Manager (`src/config/mockMode.js`)
- **Supabase Client**: Mock database operations with realistic responses
- **OpenAI Client**: Mock GPT responses for roast generation
- **Stripe Client**: Mock billing and subscription operations  
- **Perspective API**: Mock toxicity analysis responses
- **Fetch API**: Mock HTTP requests with configurable responses

#### Test Configuration (`jest.skipExternal.config.js`)
- Extends base Jest configuration
- **Conditionally skips** external-dependent tests when `ENABLE_MOCK_MODE=true`
- Uses specialized setup file (`tests/setupMockMode.js`)
- Increased timeout for complex operations

#### Mock Setup (`tests/setupMockMode.js`)
- Forces mock mode for all external dependencies
- Sets mock API keys to prevent accidental real API calls
- Configures mock database URLs
- Suppresses noisy mock-related console output
- Global mocks for fetch and other Node.js APIs

### Test Execution Strategy

| Command | Mode | External Tests | Results | Use Case |
|---------|------|----------------|---------|----------|
| `npm test` | Real | ✅ Run | ~538 tests (many external failures) | Full development testing |
| `npm run test:mock` | Mock | ⏭️ Skip | ~134 tests (95 pass, 35 fail, 4 skip) | CI/CD, rapid development |
| `npm run test:ci` | Mock | ⏭️ Skip | 17 tests (100% pass) | Smoke testing, build validation |

### CI/CD Integration

**Recommended CI Pipeline:**
```yaml
- name: Install dependencies
  run: npm ci

- name: Run mock mode tests
  run: npm run test:mock
  
- name: Build frontend
  run: npm run frontend:build
```

### Coverage Notes

- **Mock mode provides ~70% test coverage** by focusing on business logic
- **CI smoke tests provide 100% pass rate** for build validation  
- **External API integration tests** should be run manually or in dedicated integration environments
- **Some middleware tests fail** due to mock database limitations (35 failures expected)
- **Core functionality (routes, config, middleware)** is tested with mocks

### Troubleshooting

**Common Issues:**

1. **Real API calls detected**: Check `ENABLE_MOCK_MODE=true` is set
2. **Database connection errors**: Ensure mock URLs are configured in test setup
3. **Timeout errors**: External tests may still be running; check skip patterns
4. **Module import errors**: Clear Jest cache: `jest --clearCache`

**Debug Commands:**
```bash
# Check which tests are being skipped
ENABLE_MOCK_MODE=true jest --listTests --config=jest.skipExternal.config.js

# Run specific test category
ENABLE_MOCK_MODE=true jest tests/unit/routes/ --verbose

# Debug mock setup
ENABLE_MOCK_MODE=true jest tests/smoke/ --verbose
```

### Development Workflow

1. **Write unit tests** focusing on business logic
2. **Use mock mode** for rapid development feedback
3. **Test external integrations** manually or in staging environment
4. **CI/CD uses mock mode** for fast, reliable builds
5. **Production monitoring** catches integration issues

This approach ensures fast, reliable tests while maintaining confidence in core functionality.

## Phase 2 Mock Mode Enhancements (2025-08)

### 🎯 Coverage Improvements
- **Before**: ~70% test pass rate in mock mode  
- **After**: ~88% test pass rate (118/134 tests passing)
- **Failing Tests Reduced**: From 51 to 12 failing tests
- **Test Suites**: 6/9 test suites now fully pass

### 🔧 Infrastructure Upgrades

#### Authentication System
- **Mock JWT Support**: Enhanced `getUserFromToken()` to return valid mock users
- **Multi-User Support**: Handles both `mock-user-123` and `test-user-id` scenarios
- **Session Management**: Dynamic flag detection bypassing module cache issues

#### Integration Mocking
- **Enhanced MockIntegrationsService**: 
  - Crypto encryption fallback (base64 in tests, real encryption in production)
  - Twitter platform auto-connected for test users
  - Proper user data persistence with metadata
- **Platform Validation**: Added comprehensive platform name validation
- **Dynamic Configuration**: Real-time environment variable detection

### 🏆 Fixed Test Categories
- ✅ **Smoke Tests**: 11/11 passing (HTTP methods, endpoints, security headers)
- ✅ **Plan Routes**: 8/8 passing (authentication, feature flags, validation)
- ✅ **Middleware Tests**: All authentication and authorization tests passing
- ✅ **Frontend Billing**: 13/13 passing (UI, API integration, error handling)
- ⚠️ **User Routes**: 12/19 passing (remaining: Jest mock expectations, preferences)
- ⚠️ **Billing Routes**: 13/15 passing (remaining: Stripe mock integration issues)
- ⚠️ **Config Flags**: 21/23 passing (remaining: environment isolation issues)

### 🔄 Remaining Work (Phase 3)
For >95% coverage target:
1. **Jest Mock Expectations**: Fix `mockUserClient.update` calls in user routes
2. **Preferences Endpoint**: Implement user preferences with database mocking  
3. **Billing Integration**: Complete Stripe mock environment integration
4. **Config Flag Isolation**: Fix environment variable isolation in flag tests

