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

**Detalle de requisitos:** `docs/testing/E2E-REQUIREMENTS.md` describe infraestructura, flags y pasos para ejecutar E2E.

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

### MVP Flow Validations (October 2025)

End-to-end validation scripts for critical MVP flows. These are **standalone validation scripts** (not Jest tests) that validate complete workflows against real infrastructure.

**🔗 Full Report:** `docs/test-evidence/mvp-validation-summary.md`

#### 1. Basic Roast Flow (`validate-flow-basic-roast.js`)

**What it validates:**

- Complete roast generation pipeline: Comment → Toxicity → OpenAI → Storage → Retrieval
- Tests 3 toxicity levels: high (0.85), medium (0.62), low (0.15)
- Validates cost tracking, token usage, and response quality

**How to run:**

```bash
node scripts/validate-flow-basic-roast.js
```

**Environment requirements:**

```bash
MOCK_MODE=false                    # Must use real APIs
ENABLE_MOCK_MODE=false
OPENAI_API_KEY=sk-...             # Real OpenAI key
SUPABASE_URL=https://...          # Real database
SUPABASE_SERVICE_KEY=...
```

**Expected results:**

- ✅ 3/3 test scenarios passing
- ⏱️ ~7-8 seconds total execution
- 💰 Cost tracking verified (avg $0.002 per roast)
- 📊 Performance: <3s per roast (target: <5s)

**What's tested:**

- ✅ Toxicity scoring (0.15-0.85 range)
- ✅ OpenAI API integration (gpt-4o-mini)
- ✅ Database storage (roasts table)
- ✅ Cost calculation
- ⚠️ Quality check (>50 chars) - NOT validated
- ⚠️ UI dashboard - Missing

#### 2. Shield Moderation Flow (`validate-flow-shield.js`)

**What it validates:**

- Automated content moderation with toxicity-based actions
- Tests 3 severity levels: critical (0.98 → block), high (0.85 → warn), medium (0.65 → report)
- Validates Shield activation, priority assignment, action determination, logging

**How to run:**

```bash
node scripts/validate-flow-shield.js
```

**Environment requirements:**

```bash
MOCK_MODE=false
ENABLE_MOCK_MODE=false
OPENAI_API_KEY=sk-...             # For toxicity fallback
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
```

**Expected results:**

- ✅ 3/3 severity scenarios passing
- ⏱️ ~8-9 seconds total execution
- 🛡️ Shield activation confirmed for all cases
- 🎯 Priority 1 assigned to critical actions
- 📝 App logs created for audit trail

**What's tested:**

- ✅ Toxicity threshold triggers (>0.60)
- ✅ Severity classification (critical/high/medium/low)
- ✅ Action determination (block/warn/report)
- ✅ User behavior tracking in database
- ✅ Job queue creation with priority
- ⚠️ Complete decision matrix - Partial (3/many scenarios)
- ❌ Idempotency test - Missing
- ❌ Real platform API test - Missing
- ❌ UI dashboard - Missing

#### 3. Multi-Tenant RLS Flow (`validate-flow-rls.js`)

**What it validates:**

- Row Level Security policies across multi-tenant tables
- Tests data isolation between 2 test organizations
- Validates CRUD operations respect organization boundaries

**How to run:**

```bash
npm test tests/integration/test-multi-tenant-rls.test.js
```

**Environment requirements:**

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
SUPABASE_ANON_KEY=...
SUPABASE_JWT_SECRET=...           # For JWT generation
```

**Expected results:**

- ✅ 14/14 RLS tests passing
- ⏱️ ~12-15 seconds execution
- 🔐 Complete data isolation verified
- 🏢 2 test organizations with JWT context switching

**What's tested:**

- ✅ Organizations table isolation
- ✅ Posts table isolation
- ✅ Comments table isolation
- ✅ Roasts table isolation
- ⚠️ All 7 mandatory tables - Partial (4/7 validated)
- ❌ Error code validation (403) - Missing
- ❌ Performance measurement - Missing
- ❌ SQL injection test - Missing
- ❌ UI dashboard - Missing

#### 4. Billing Limits Flow (`validate-flow-billing.js`)

**What it validates:**

- Plan-based limit enforcement (Free: 10, Pro: 1000, Creator Plus: 5000)
- Tests limit blocking when exceeded
- Validates monthly_usage tracking and CostControl service

**How to run:**

```bash
node scripts/validate-flow-billing.js
```

**Environment requirements:**

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
MOCK_MODE=false
ENABLE_MOCK_MODE=false
```

**Expected results:**

- ✅ 3/3 plan scenarios passing
- ⏱️ ~5-6 seconds execution
- 🚫 Limit enforcement confirmed for all plans
- 💳 Monthly usage tracking verified

**What's tested:**

- ✅ Free plan limit (10 responses)
- ✅ Pro plan limit (1000 responses)
- ✅ Creator Plus limit (5000 responses)
- ✅ Atomic usage increment
- ⚠️ Starter plan - Missing test
- ⚠️ Unlimited plan - Issue says unlimited, script uses 5000
- ❌ 403 response code validation - Missing
- ❌ Upgrade flow test - Missing
- ❌ Monthly reset logic - Missing
- ❌ Race condition test - Missing
- ❌ Plan features matrix test - Missing
- ❌ 5 edge cases - Missing
- ❌ UI dashboard - Missing

#### Infrastructure Improvements Made

These validation scripts required and drove the following infrastructure improvements:

**Database Migrations:**

- `20251017000003_add_plan_limits.sql` - Plan configuration table with RLS
- `20251017000004_fix_user_org_trigger.sql` - Fixed 'basic' → 'free' plan mapping

**Service Fixes:**

- `src/services/costControl.js:12` - Use SERVICE_KEY instead of ANON_KEY
- `tests/helpers/tenantTestUtils.js` - Use auth.admin API for user creation

**Test Configuration:**

- `jest.config.js` - Split test projects (unit/integration/security/dom)
- `tests/setupIntegration.js` - Created integration test setup

#### Gap Analysis Summary

Based on cross-referencing with original issues #486-#489:

| Status              | Count | Description                      |
| ------------------- | ----- | -------------------------------- |
| ✅ Fully Validated  | 21    | Core flows working end-to-end    |
| ⚠️ Partial Coverage | 14    | Implemented but not fully tested |
| ❌ Missing          | 11    | Not yet implemented or validated |

**Critical Gaps:**

- Quality validation (roast length >50 chars)
- Shield idempotency and complete decision matrix
- RLS validation for all 7 tables with error codes
- Billing edge cases (race conditions, downgrades, resets)
- UI dashboards for all 4 flows

**🔗 Detailed Gap Analysis:** See `docs/test-evidence/mvp-validation-summary.md` section "Gap Analysis"

#### How to Expand These Tests

**To add new validation scenarios:**

1. **Create new script:** `scripts/validate-flow-<name>.js`
2. **Follow the pattern:**

   ```javascript
   // 1. Disable mock mode
   process.env.MOCK_MODE = 'false';
   process.env.ENABLE_MOCK_MODE = 'false';

   // 2. Define test scenarios array
   const TEST_SCENARIOS = [
     { input, expected, description }
     // ...
   ];

   // 3. Run scenarios with proper cleanup
   for (const scenario of TEST_SCENARIOS) {
     try {
       // Execute test
       // Validate results
       console.log(`✅ ${scenario.description}`);
     } catch (error) {
       console.error(`❌ ${scenario.description}`);
       throw error;
     }
   }
   ```

3. **Add to npm scripts:** `package.json`

   ```json
   "scripts": {
     "validate:flow:<name>": "node scripts/validate-flow-<name>.js"
   }
   ```

4. **Document results:** Create evidence in `docs/test-evidence/`

**Recommendations:**

- ✅ **Reuse for regression testing:** Run before major releases
- ✅ **Expand coverage:** Add missing edge cases from gap analysis
- ✅ **Add to CI:** Consider adding critical flows to GitHub Actions
- ✅ **Create UI validation:** Use Playwright MCP for visual testing
- ✅ **Add performance benchmarks:** Track execution time trends
- ⚠️ **Be cautious:** These use REAL APIs and cost money (OpenAI charges)
- ⚠️ **Use test environment:** Never run against production database

**Related Issues:**

- #486 - Basic Roast Flow
- #487 - Shield Flow
- #488 - Multi-Tenant RLS
- #489 - Billing Limits

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

> ⚠️ **Status:** NOT YET IMPLEMENTED - The demo fixture system described below is planned but not yet available. The `data/fixtures/` directory and npm scripts do not exist yet. Refer to Backend Integration Fixtures (below) for currently available fixture functionality.

Realistic demo data for manual testing and demos (planned feature).

**Planned Location:** `data/fixtures/`

**Planned Commands:**

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

**Planned Data:**

- 2 demo organizations (Spanish, English)
- 6 demo users (Free/Starter/Pro × 2 languages)
- 35 realistic comment fixtures (18 Spanish, 17 English)

**Planned Demo Credentials:** All users with password `demo123`

- `demo-free-es@demo.roastr.ai`
- `demo-starter-es@demo.roastr.ai`
- `demo-pro-es@demo.roastr.ai`
- `demo-free-en@demo.roastr.ai`
- `demo-starter-en@demo.roastr.ai`
- `demo-pro-en@demo.roastr.ai`

**Intended Use Cases:**

- Manual testing with realistic data
- Demos and presentations
- Exploring Shield triage scenarios

**Documentation:** Will be available at `data/fixtures/README.md` when implemented

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

| Test Type              | Duration | Tests    | Notes                   |
| ---------------------- | -------- | -------- | ----------------------- |
| Unit tests             | ~9s      | 178      | Fast feedback loop      |
| Integration (fixtures) | ~12s     | Variable | No external DB          |
| E2E (3 browsers)       | ~45s     | 17       | Chrome, Firefox, Safari |
| **Total (serial)**     | **~66s** | **195+** | All tests               |

### CI (GitHub Actions)

| Test Type            | Duration | Tests    | Notes                |
| -------------------- | -------- | -------- | -------------------- |
| Unit tests           | ~15s     | 178      | Includes setup       |
| Integration          | ~20s     | Variable | With fixtures        |
| E2E (Chromium only)  | ~60s     | 17       | Headless, 1 browser  |
| **Total (parallel)** | **~95s** | **195+** | Jobs run in parallel |

### Individual Test Suites (Examples)

```text
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
  testTimeout: 30000 // 30 seconds
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

# Demo data (NOT YET IMPLEMENTED)
# npm run demo:seed            # Seed demo data (coming soon)
# npm run demo:reset           # Clean up (coming soon)
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
