# Testing Guide

Complete guide for running tests and understanding the CI pipeline for Roastr AI.

## Table of Contents

- [Test Commands](#test-commands)
- [Environment Variables](#environment-variables)
- [Fixtures & Seeds](#fixtures--seeds)
- [CI Configuration](#ci-configuration)
- [Test Duration Benchmarks](#test-duration-benchmarks)
- [Troubleshooting](#troubleshooting)

---

## Test Commands

### Unit Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run with mocked external services (recommended for local dev)
npm run test:mock

# Run specific test file
npm test tests/unit/services/costControl.test.js

# Watch mode
npm run test:mvp:watch
```

**When to use:**
- Local development (use `test:mock` to avoid API calls)
- Quick feedback loop
- TDD workflow

**Expected output:** ~178 tests passing in ~9 seconds

### Integration Tests

```bash
# Backend integration tests (requires database)
npm run test:integration-backend

# With fixtures (recommended - faster, no external deps)
npm run test:integration-backend:fixtures

# With coverage
npm run test:integration-backend:coverage

# CI mode (fixtures + coverage)
npm run test:integration-backend:ci
```

**When to use:**
- Testing database interactions
- Testing queue system
- Testing multi-component workflows

**Expected output:** Integration tests in ~12 seconds with fixtures

### E2E Tests (Playwright)

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Interactive UI mode (recommended for development)
npm run test:e2e:ui

# Run with visible browser
npm run test:e2e:headed

# Debug mode (pause on failures)
npm run test:e2e:debug
```

**When to use:**
- Testing full user workflows
- UI regression testing
- Before major releases

**Expected output:** 17 tests in ~45 seconds (3 browsers locally, 1 in CI)

### Specialized Test Suites

```bash
# MVP test suite
npm run test:mvp              # All MVP tests
npm run test:mvp:unit         # MVP unit tests only
npm run test:mvp:integration  # MVP integration only
npm run test:mvp:e2e          # MVP E2E only

# Spec14 QA test suite
npm run test:spec14           # Run Spec14 tests
npm run test:spec14:verbose   # With detailed output
npm run test:spec14:coverage  # With coverage
npm run test:spec14:dry       # Preview without running

# Observability tests
npm run test -- tests/integration/test-observability.test.js
```

---

## Environment Variables

### Required for All Tests

```bash
NODE_ENV=test
ENABLE_MOCK_MODE=true  # Enables mocked external services
```

### Database (Integration Tests)

```bash
# Supabase configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
```

### External APIs (Can be Mocked)

```bash
# OpenAI API
OPENAI_API_KEY=sk-test-dummy-key-for-testing

# Google Perspective API
PERSPECTIVE_API_KEY=dummy-perspective-key-for-testing

# Stripe (for billing tests)
STRIPE_SECRET_KEY=sk_test_dummy
STRIPE_WEBHOOK_SECRET=whsec_test_dummy
```

### Queue System

```bash
# Redis/Upstash (optional - falls back to in-memory)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Standard Redis URL (alternative)
REDIS_URL=redis://localhost:6379
```

### Dummy Values for Local Testing

Create `.env.test` file:

```bash
# .env.test (safe dummy values for local testing)
NODE_ENV=test
ENABLE_MOCK_MODE=true

# Database (use test database, not production!)
SUPABASE_URL=https://test-project.supabase.co
SUPABASE_SERVICE_KEY=test-service-key
SUPABASE_ANON_KEY=test-anon-key

# APIs (mocked automatically when ENABLE_MOCK_MODE=true)
OPENAI_API_KEY=sk-test-dummy
PERSPECTIVE_API_KEY=dummy-key

# Billing
STRIPE_SECRET_KEY=sk_test_dummy
STRIPE_WEBHOOK_SECRET=whsec_test_dummy
ENABLE_BILLING=false

# Optional
DEBUG=false
```

**Load test env:**
```bash
export $(cat .env.test | xargs) && npm test
```

---

## Fixtures & Seeds

### Demo Mode Fixtures (Issue #420)

Realistic demo data for manual testing and demos.

**Location:** `data/fixtures/`

**Commands:**
```bash
# Validate fixtures against JSON schema
npm run demo:validate

# Preview what would be seeded
npm run demo:seed:dry

# Seed database with demo data
npm run demo:seed

# Clear all demo data
npm run demo:reset

# Preview cleanup
npm run demo:reset:dry
```

**What gets seeded:**
- 2 demo organizations (Spanish, English)
- 6 demo users (Free/Starter/Pro × 2 languages)
- 35 realistic comment fixtures (18 Spanish, 17 English)

**Demo credentials:** All users have password `demo123`
- `demo-free-es@demo.roastr.ai`
- `demo-starter-es@demo.roastr.ai`
- `demo-pro-es@demo.roastr.ai`
- `demo-free-en@demo.roastr.ai`
- `demo-starter-en@demo.roastr.ai`
- `demo-pro-en@demo.roastr.ai`

**When to use:**
- Manual testing with realistic data
- Demos and presentations
- Exploring Shield triage scenarios

**Documentation:** `data/fixtures/README.md`

### Backend Integration Fixtures

Automated test data for integration tests.

**Location:** `tests/integration/backend/fixtures/`

**Commands:**
```bash
# Validate backend fixtures
npm run fixtures:validate

# Update all fixtures
npm run fixtures:update:all
```

**When to use:**
- Automatically loaded in `test:integration-backend:fixtures`
- No manual seeding required
- Clean state for each test run

---

## CI Configuration

### GitHub Actions Workflows

#### Main CI (`.github/workflows/ci.yml`)

**Triggers:**
- Push to `main` branch
- Pull requests to `main`
- Manual workflow dispatch

**Jobs:**
```yaml
1. Run tests
   - Node.js 18.x
   - Install dependencies
   - Run npm test
   - Upload coverage artifacts

2. Lint code
   - ESLint checks
   - Formatting verification
```

**Duration:** ~3-5 minutes

**Environment:**
- `ENABLE_MOCK_MODE=true`
- `NODE_ENV=test`
- All API keys mocked

#### Integration Tests (`.github/workflows/integration-tests.yml`)

**Triggers:**
- Push to `main`
- Pull requests

**Jobs:**
```yaml
1. Backend integration tests
   - Uses fixtures mode (no external DB required)
   - Runs: npm run test:integration-backend:ci
   - Uploads coverage

2. E2E tests (if applicable)
   - Playwright with Chromium only
   - Headless mode
   - Screenshots on failure
```

**Duration:** ~5-7 minutes

#### Playwright E2E Tests

**Configuration:** `playwright.config.js`

**CI-specific settings:**
```javascript
{
  // CI detection
  workers: process.env.CI ? 1 : undefined,
  
  // Headless in CI
  use: {
    headless: !!process.env.CI,
  },
  
  // Only Chromium in CI
  projects: process.env.CI 
    ? [{ name: 'chromium' }]
    : [/* all browsers */]
}
```

**Artifacts collected:**
- Screenshots on failure
- Video recordings (if enabled)
- Test reports (HTML)

### Headless Configuration

**For Linux servers without display:**

```bash
# Install Playwright browsers
npx playwright install --with-deps chromium

# Run headless
npm run test:e2e  # Already headless in CI

# Force headless locally
HEADLESS=1 npm run test:e2e
```

**Docker:**
```dockerfile
# Use official Playwright image
FROM mcr.microsoft.com/playwright:v1.56.0-jammy

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npx playwright install chromium

CMD ["npm", "run", "test:e2e"]
```

---

## Test Duration Benchmarks

### Local Development (MacBook Pro M1, 16GB RAM)

| Test Type | Duration | Tests | Notes |
|-----------|----------|-------|-------|
| Unit tests | ~9s | 178 | Fast feedback loop |
| Integration (fixtures) | ~12s | Variable | No external DB |
| E2E (3 browsers) | ~45s | 17 | Chrome, Firefox, Safari |
| **Total (serial)** | **~66s** | **195+** | All tests |

### CI (GitHub Actions)

| Test Type | Duration | Tests | Notes |
|-----------|----------|-------|-------|
| Unit tests | ~15s | 178 | Includes setup |
| Integration | ~20s | Variable | With fixtures |
| E2E (Chromium only) | ~60s | 17 | Headless, 1 browser |
| **Total (parallel)** | **~95s** | **195+** | Jobs run in parallel |

### Individual Test Suites (Examples)

```
Test Suites: 5 passed, 5 total
Tests:       178 passed, 178 total
Snapshots:   0 total
Time:        9.021 s
```

**Breakdown by file:**
- `costControl.test.js`: ~1.2s (45 tests)
- `queueService.test.js`: ~1.8s (38 tests)
- `inputValidation.test.js`: ~0.8s (28 tests)
- `tierValidation.test.js`: ~0.9s (22 tests)
- `test-observability.test.js`: ~2.1s (integration)

### Performance Tips

**Speed up local tests:**
```bash
# Use mock mode (avoid API calls)
npm run test:mock

# Run specific test files
npm test costControl.test.js

# Skip slow tests
npm test -- --testPathIgnorePatterns=e2e
```

**Speed up CI:**
```bash
# Use fixtures instead of real DB
npm run test:integration-backend:fixtures

# Run only Chromium for E2E
# (Already configured in playwright.config.js for CI)
```

---

## Troubleshooting

### Common Issues

#### 1. Tests fail with "Cannot find module"

**Cause:** Missing dependencies

**Fix:**
```bash
npm install
npx playwright install  # For E2E tests
```

#### 2. Database connection errors in integration tests

**Cause:** Missing Supabase credentials

**Fix:**
```bash
# Use fixtures mode (recommended)
npm run test:integration-backend:fixtures

# Or set up test database
cp .env.example .env.test
# Edit .env.test with test database credentials
export $(cat .env.test | xargs)
```

#### 3. Playwright fails: "Executable doesn't exist"

**Cause:** Playwright browsers not installed

**Fix:**
```bash
npx playwright install chromium
# Or all browsers:
npx playwright install
```

#### 4. Tests timeout in CI

**Cause:** Network issues or slow operations

**Fix:**
```javascript
// Increase timeout in jest.config.js
module.exports = {
  testTimeout: 30000, // 30 seconds
};
```

#### 5. Coverage reports missing

**Cause:** Coverage not generated

**Fix:**
```bash
npm run test:coverage
# Reports in: coverage/lcov-report/index.html
```

#### 6. Flaky E2E tests

**Cause:** Race conditions or timing issues

**Fix:**
```javascript
// Use Playwright's built-in waiting
await page.waitForSelector('.element');
await expect(page.locator('.element')).toBeVisible();
```

### Debug Commands

```bash
# Verbose test output
npm test -- --verbose

# Run single test file with logs
npm test -- costControl.test.js --verbose

# Debug Playwright tests
npm run test:e2e:debug

# Check test configuration
npm test -- --showConfig

# Clear Jest cache
npx jest --clearCache
```

### Getting Help

- **Documentation:** This guide, `CLAUDE.md`, `README.md`
- **Test examples:** `tests/` directory
- **CI logs:** GitHub Actions tab
- **Coverage reports:** `coverage/lcov-report/index.html`

---

## Quick Reference

### Most Common Commands

```bash
# Local development
npm run test:mock              # Unit tests (mocked)
npm run test:e2e:ui            # E2E with UI

# Before commit
npm test                       # All unit tests
npm run test:coverage          # Check coverage

# CI/Pre-merge
npm run test:integration-backend:fixtures  # Integration
npm run test:e2e                           # E2E headless

# Demo data
npm run demo:seed              # Seed demo data
npm run demo:reset             # Clean up
```

### File Locations

- **Test files:** `tests/unit/`, `tests/integration/`, `tests/e2e/`
- **Fixtures:** `data/fixtures/`, `tests/integration/backend/fixtures/`
- **Config:** `jest.config.js`, `playwright.config.js`
- **CI:** `.github/workflows/`

---

**Last Updated:** 2025-10-13  
**Maintainer:** Development Team  
**Related:** Issue #421, `CLAUDE.md`, `data/fixtures/README.md`
