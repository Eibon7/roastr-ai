# E2E Testing Requirements

## Comprehensive Guide for End-to-End Test Execution

**Issue:** #896 - Fase 5: Documentar E2E Requirements  
**Fecha:** 2025-11-21  
**Audiencia:** Developers, QA Engineers, CI/CD Maintainers

---

## Table of Contents

1. [Overview](#overview)
2. [Infrastructure Requirements](#infrastructure-requirements)
3. [Setup Instructions](#setup-instructions)
4. [Execution](#execution)
5. [CI/CD Configuration](#cicd-configuration)
6. [Playwright MCP Alternative](#playwright-mcp-alternative)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Overview

### What are E2E Tests?

**End-to-End (E2E) tests** verify complete user workflows from start to finish, simulating real-world scenarios across multiple system components.

**In Roastr.ai, E2E tests cover:**

- Shield UI interactions (blocking, muting, reverting actions)
- Multi-tenant workflow orchestration (fetch → analyze → reply)
- API health and availability
- Visual stability across viewports
- Database integration scenarios

---

### When to Run E2E Tests

| Scenario                      | Run E2E?    | Reason                               |
| ----------------------------- | ----------- | ------------------------------------ |
| **Local feature development** | ⚠️ Optional | Faster to use unit/integration tests |
| **Pre-PR validation**         | ✅ **YES**  | Ensure no regressions in workflows   |
| **CI/CD on `test:e2e` label** | ✅ **YES**  | Automated validation before merge    |
| **Quick fix / typo**          | ❌ No       | Overkill, unit tests sufficient      |
| **Visual UI changes**         | ✅ **YES**  | Validate across viewports + browsers |
| **Database schema changes**   | ✅ **YES**  | Ensure integration tests pass        |

**Rule of thumb:** Run E2E tests when changes affect:

- User-facing workflows
- API endpoints
- Database interactions
- UI components
- Multi-service orchestration

---

### E2E Test Categories

See [E2E-INVENTORY.md](./E2E-INVENTORY.md) for complete list. Summary:

1. **Playwright E2E** (2 suites, 2 skipped)
   - `shield-stability.test.js` - Network + visual stability
   - Requires: Playwright + servidor + matchers (Issue #482)

2. **Visual Tests** (1 suite, active)
   - `shieldUI.test.js` - Multi-viewport + accessibility
   - Requires: `@playwright/test` + servidor

3. **Workflow Integration** (1 suite, conditional)
   - `multiTenantWorkflow.test.js` - Queue + workers
   - Requires: Redis/Queue + mocks

4. **Database Integration** (1 suite, skipped)
   - `trial-management.test.js` - Supabase real instance
   - Requires: Real DB (covered by unit tests)

5. **Smoke Tests** (2 suites, active)
   - `api-health.test.js`, `simple-health.test.js`
   - Requires: Servidor corriendo

---

## Infrastructure Requirements

### 1. Server Running

**Purpose:** Most E2E tests require API server for requests/responses.

**Required:**

- Server running on port 3000 (default) or custom port
- Health endpoint responding: `http://localhost:3000/health`
- API endpoints accessible: `http://localhost:3000/api/*`

**How to start:**

```bash
# Option 1: Full stack with auto-reload
npm run dev

# Option 2: API only (no frontend)
npm run start:api

# Option 3: Production mode
npm start
```

**Health check:**

```bash
# Verify server is ready
curl http://localhost:3000/health

# Expected response
{"status":"ok","timestamp":"2025-11-21T..."}

# If server not ready, you'll get:
# curl: (7) Failed to connect to localhost port 3000: Connection refused
```

**Environment variables required:**

```bash
# Minimum required for server start
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=sk-...

# Optional (depends on test scope)
ENABLE_REAL_OPENAI=false  # Use mocks in tests
MOCK_MODE=true            # Skip external API calls
```

See `.env.example` for complete list.

---

### 2. Playwright

**Purpose:** Browser automation for visual and interaction testing.

**Two flavors:**

#### A) `playwright` package (low-level)

Used by: `shield-stability.test.js` (currently skipped)

```bash
# Install
npm install playwright

# Install browsers
npx playwright install chromium firefox webkit
```

**⚠️ CRITICAL:** This package does NOT include test matchers (`.toBeVisible()`, `.toHaveText()`).

**Issue #482 tracks migration to `@playwright/test` or rewriting assertions.**

#### B) `@playwright/test` framework (recommended)

Used by: `shieldUI.test.js` (active)

```bash
# Install (already in package.json)
npm install @playwright/test

# Install browsers
npx playwright install chromium firefox webkit
```

**Includes:**

- Test runner (`npx playwright test`)
- Built-in matchers (`.toBeVisible()`, `.toHaveText()`, etc.)
- HTML reports
- Parallel execution
- Retries and timeouts

**Verification:**

```bash
# Check Playwright installed
npx playwright --version
# Expected: Version 1.40.0 or later

# List installed browsers
npx playwright install --dry-run
# Expected: chromium, firefox, webkit
```

---

### 3. Database (Conditional)

**Purpose:** Some tests require real database for stateful scenarios.

**Requirements:**

| Test Suite                       | DB Type          | Reason                                     |
| -------------------------------- | ---------------- | ------------------------------------------ |
| `trial-management.test.js`       | ✅ Real Supabase | Trial lifecycle (start → expire → upgrade) |
| `tierValidationSecurity.test.js` | ⚠️ Optional      | Skips if `MOCK_MODE=true`                  |
| Most other tests                 | ❌ Mocks         | Use `mockSupabaseFactory.js`               |

**Setup for real DB tests:**

```bash
# Use Supabase instance (dev or test)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...

# Run migrations
npm run db:migrate

# Seed test data (if needed)
npm run db:seed:test
```

**Note:** `trial-management.test.js` is currently skipped. Unit tests provide alternative coverage.

---

### 4. Redis/Queue (Conditional)

**Purpose:** Multi-tenant workflow tests require queue service.

**Requirements:**

| Test Suite                    | Redis Required?  | Reason              |
| ----------------------------- | ---------------- | ------------------- |
| `multiTenantWorkflow.test.js` | ⚠️ Can use mocks | Queue orchestration |
| Most other tests              | ❌ No            | Don't use queue     |

**Setup:**

```bash
# Local Redis
brew install redis  # macOS
redis-server

# Or use Upstash (cloud)
REDIS_URL=redis://default:...@us1-...upstash.io:6379

# Verify connection
redis-cli ping
# Expected: PONG
```

---

### 5. Environment Variables

**Critical variables for E2E tests:**

```bash
# Server & Database
DATABASE_URL=postgresql://...       # Required for server start
REDIS_URL=redis://localhost:6379   # Required for queue tests

# API Keys (can use mocks in tests)
OPENAI_API_KEY=sk-...               # Mock if ENABLE_REAL_OPENAI=false
PERSPECTIVE_API_KEY=AIza...         # Mock in test environment

# Test-specific
TEST_URL=http://localhost:3000      # Override server URL for tests
TEST_SERVER_URL=http://localhost:3000  # Alternative name
E2E_ENABLED=true                    # Explicitly enable E2E tests

# Skip flags
SKIP_E2E=true                       # Skip E2E tests (CI)
MOCK_MODE=true                      # Skip external API calls
```

**Load from `.env`:**

```bash
# Ensure .env exists
cp .env.example .env

# Edit with your values
nano .env

# Tests automatically load .env via dotenv
# No manual sourcing needed
```

---

## Setup Instructions

### Local Development

**Step-by-step setup for running E2E tests locally:**

```bash
# 1. Clone and install dependencies
git clone https://github.com/your-org/roastr-ai.git
cd roastr-ai
npm install

# 2. Install Playwright browsers
npx playwright install chromium firefox webkit

# 3. Setup environment
cp .env.example .env
nano .env  # Add DATABASE_URL, REDIS_URL, API keys

# 4. Start database (if not using remote)
# For PostgreSQL:
brew services start postgresql
createdb roastr_test

# For Redis:
brew services start redis

# 5. Run migrations
npm run db:migrate

# 6. Start server (in separate terminal)
npm run start:api
# Wait for: "Server listening on http://localhost:3000"

# 7. Verify server health
curl http://localhost:3000/health
# Expected: {"status":"ok",...}

# 8. Run E2E tests
npm test tests/integration/
# Or specific suite:
npm test tests/integration/multiTenantWorkflow.test.js

# 9. Run Playwright visual tests (different framework)
npx playwright test tests/visual/shieldUI.test.js

# 10. View Playwright HTML report
npx playwright show-report
```

**Verification checklist:**

- [ ] Server responds to `/health` endpoint
- [ ] Playwright browsers installed (`npx playwright --version`)
- [ ] Database connection working (`npm run db:ping` or manual check)
- [ ] Redis connection working (`redis-cli ping`)
- [ ] Environment variables loaded (check `process.env.DATABASE_URL` in node REPL)

---

## Helper: `tests/helpers/e2ePrerequisites.js`

Para evitar que las suites E2E fallen cuando falta infraestructura, incluimos un helper compartido que encapsula verificaciones y lógica de skip.

| Función                                | Propósito                                                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `isE2EAvailable(options)`              | Comprueba flags (`SKIP_E2E`, `E2E_ENABLED`), disponibilidad del servidor y Playwright cuando se solicita. |
| `skipIfNoE2E(testFn, reason, options)` | Ejecuta `testFn.skip(...)` para suites condicionales (ej. `multiTenantWorkflow.test.js`).                 |
| `skipSuiteIfNoE2E(reason, options)`    | Ideal en `beforeAll` para abortar suites asincrónicas si falta infraestructura.                           |
| `isServerAvailable(url, timeout)`      | Verifica el endpoint `/health` y reporta si responde en el timeout esperado.                              |
| `isPlaywrightAvailable()`              | Verifica si `playwright` o `@playwright/test` están instalados y configurados correctamente.              |

`shield-stability.test.js` documenta por qué sigue skip (Playwright matchers) y referencia este helper junto a Issue #482.

### CI/CD

**GitHub Actions configuration for E2E tests:**

#### Option 1: Separate E2E Job (Recommended)

Add to `.github/workflows/test.yml`:

```yaml
jobs:
  # ... existing unit/integration tests ...

  e2e-tests:
    name: E2E Tests (Playwright)
    runs-on: ubuntu-latest

    # Only run if PR has 'test:e2e' label
    if: contains(github.event.pull_request.labels.*.name, 'test:e2e')

    services:
      # Postgres service
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: roastr_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      # Redis service
      redis:
        image: redis:7
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium firefox webkit

      - name: Setup environment
        run: |
          cp .env.example .env
          echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/roastr_test" >> .env
          echo "REDIS_URL=redis://localhost:6379" >> .env
          echo "ENABLE_REAL_OPENAI=false" >> .env
          echo "E2E_ENABLED=true" >> .env

      - name: Run database migrations
        run: npm run db:migrate

      - name: Start server in background
        run: |
          npm run start:api &
          echo "SERVER_PID=$!" >> $GITHUB_ENV

      - name: Wait for server ready
        run: |
          timeout 30 bash -c 'until curl -f http://localhost:3000/health; do sleep 2; done'

      - name: Run E2E tests (Jest)
        run: npm test -- tests/integration/ tests/smoke/
        env:
          TEST_SERVER_URL: http://localhost:3000
          E2E_ENABLED: true

      - name: Run Playwright visual tests
        run: npx playwright test tests/visual/
        env:
          TEST_URL: http://localhost:3000

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

      - name: Stop server
        if: always()
        run: kill $SERVER_PID || true
```

#### Option 2: Conditional Skip in Main Job

Use environment variable to skip E2E in main test job:

```yaml
- name: Run tests (skip E2E)
  run: npm test
  env:
    SKIP_E2E: true # Skips multiTenantWorkflow.test.js
```

**Benefits of separate job:**

- ✅ Isolated environment
- ✅ Only runs when needed (`test:e2e` label)
- ✅ Parallel execution (faster CI)
- ✅ Clear separation of concerns

---

## Execution

### Run All E2E Tests

```bash
# Option 1: All integration tests (Jest)
npm test tests/integration/

# Option 2: All smoke tests
npm test tests/smoke/

# Option 3: All Playwright visual tests
npx playwright test tests/visual/

# Option 4: Everything (mixed frameworks)
npm test tests/integration/ tests/smoke/ && npx playwright test tests/visual/
```

---

### Run Specific Suite

```bash
# Jest-based tests
npm test tests/integration/multiTenantWorkflow.test.js
npm test tests/integration/shieldPersistenceIntegration.test.js
npm test tests/smoke/api-health.test.js

# Playwright tests (@playwright/test framework)
npx playwright test tests/visual/shieldUI.test.js

# With specific browser
npx playwright test tests/visual/shieldUI.test.js --project=chromium
```

---

### Skip E2E Tests

```bash
# Method 1: Use SKIP_E2E flag (multiTenantWorkflow respects this)
SKIP_E2E=true npm test

# Method 2: Exclude integration directory
npm test -- --testPathIgnorePatterns=integration

# Method 3: Run only unit tests
npm test tests/unit/

# Method 4: Use MOCK_MODE (skips real DB tests)
MOCK_MODE=true npm test tests/integration/
```

---

### Timeouts

**Default timeouts:**

| Framework  | Default | Adjustable?                 |
| ---------- | ------- | --------------------------- |
| Jest       | 5000ms  | ✅ `--testTimeout=30000`    |
| Playwright | 30000ms | ✅ `test.setTimeout(60000)` |

**Override Jest timeout:**

```bash
# Global timeout for all tests
npm test -- --testTimeout=30000

# Or in test file:
jest.setTimeout(30000); // 30 seconds
```

**Override Playwright timeout:**

```javascript
// In test file
test.setTimeout(60000); // 60 seconds per test

// Or in playwright.config.js
module.exports = {
  timeout: 60000, // Global timeout
  expect: {
    timeout: 10000 // Assertion timeout
  }
};
```

---

### Debug Mode

**Jest tests:**

```bash
# Run with verbose output
npm test tests/integration/ -- --verbose

# Run single test with debugging
node --inspect-brk node_modules/.bin/jest tests/integration/multiTenantWorkflow.test.js --runInBand

# Open chrome://inspect in Chrome
# Click "inspect" under Remote Target
```

**Playwright tests:**

```bash
# Run with headed browser (see what's happening)
npx playwright test tests/visual/shieldUI.test.js --headed

# Run with UI mode (interactive)
npx playwright test tests/visual/shieldUI.test.js --ui

# Debug mode (pauses on failures)
npx playwright test tests/visual/shieldUI.test.js --debug

# Slow motion (500ms delay between actions)
npx playwright test tests/visual/shieldUI.test.js --headed --slowMo=500
```

---

## CI/CD Configuration

### Required Services

**For GitHub Actions:**

```yaml
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: roastr_test
    ports:
      - 5432:5432

  redis:
    image: redis:7
    ports:
      - 6379:6379
```

**For GitLab CI:**

```yaml
services:
  - postgres:15
  - redis:7

variables:
  POSTGRES_DB: roastr_test
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: postgres
  REDIS_URL: redis://redis:6379
```

---

### Conditional Execution

**Run E2E only when relevant files change:**

```yaml
# GitHub Actions
on:
  pull_request:
    paths:
      - 'src/**'
      - 'tests/integration/**'
      - 'tests/visual/**'

# Or use label-based trigger (recommended)
if: contains(github.event.pull_request.labels.*.name, 'test:e2e')
```

---

### Artifacts

**Upload test results and reports:**

```yaml
- name: Upload Jest test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: jest-results
    path: test-results/

- name: Upload Playwright report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

---

## Playwright MCP Alternative

**Purpose:** Execute E2E visual tests without running local server, using Playwright MCP integration.

### When to Use MCP

| Scenario                    | Use MCP? | Reason                                    |
| --------------------------- | -------- | ----------------------------------------- |
| **Quick visual validation** | ✅ Yes   | No server setup needed                    |
| **CI/CD on remote PR**      | ✅ Yes   | Isolated browser environment              |
| **Comprehensive E2E suite** | ⚠️ Maybe | MCP has limitations (no custom endpoints) |
| **Local development**       | ❌ No    | Easier to use local server                |

---

### MCP Setup

**Prerequisites:**

1. Playwright MCP server configured (already done in project)
2. MCP tools available in environment

**Verify MCP:**

```bash
# Check MCP server running
/mcp list

# Expected output includes:
# - playwright
# - playwright.browse
# - playwright.screenshot
```

---

### MCP Execution

**Example: Visual validation of Shield UI**

```bash
# 1. Start MCP session (if not already active)
/mcp connect playwright

# 2. Browse to Shield panel
/mcp exec playwright browse https://roastr-ai-staging.vercel.app/shield

# 3. Take screenshot
/mcp exec playwright screenshot --viewport=1920x1080 --output=docs/test-evidence/issue-896/shield-desktop.png

# 4. Take screenshot mobile
/mcp exec playwright screenshot --viewport=375x667 --output=docs/test-evidence/issue-896/shield-mobile.png

# 5. Check accessibility
/mcp exec playwright a11y --url=https://roastr-ai-staging.vercel.app/shield
```

---

### MCP Limitations

**What MCP can do:**

- ✅ Browse public URLs
- ✅ Take screenshots (multi-viewport)
- ✅ Check accessibility
- ✅ Verify visual rendering
- ✅ Test responsive design

**What MCP cannot do:**

- ❌ Access `localhost` (no local server)
- ❌ Run authenticated flows (no login)
- ❌ Execute custom test assertions
- ❌ Interact with database
- ❌ Test API endpoints directly

**Verdict:** MCP is great for quick visual validation, but not a replacement for comprehensive E2E tests.

---

### MCP in CI/CD

**Add MCP step to workflow:**

```yaml
- name: Visual validation with Playwright MCP
  run: |
    /mcp exec playwright browse ${{ env.DEPLOY_URL }}/shield
    /mcp exec playwright screenshot --output=shield-screenshot.png
  env:
    DEPLOY_URL: https://roastr-ai-preview-${{ github.event.number }}.vercel.app
```

**Use case:** Validate deployed preview before merging PR.

---

## Troubleshooting

### Server Not Available

**Error:**

```
Error: connect ECONNREFUSED 127.0.0.1:3000
```

**Solution:**

```bash
# 1. Check if server running
curl http://localhost:3000/health

# 2. If not, start server
npm run start:api

# 3. Check port not in use by another process
lsof -i :3000
# Kill process if needed:
kill -9 <PID>

# 4. Try different port
PORT=4000 npm run start:api
# Update TEST_URL:
TEST_URL=http://localhost:4000 npm test tests/integration/
```

---

### Playwright Browsers Not Installed

**Error:**

```
Error: browserType.launch: Executable doesn't exist at /Users/.../chromium-1097/chrome-mac/Chromium.app/Contents/MacOS/Chromium
```

**Solution:**

```bash
# Install all browsers
npx playwright install chromium firefox webkit

# Or specific browser
npx playwright install chromium

# With system dependencies (Linux)
npx playwright install --with-deps
```

---

### Playwright Matchers Not Available (Jest)

**Error:**

```
Error: expect(received).toBeVisible is not a function
```

**Cause:** Using `playwright` package with Jest (no matchers included).

**Solution:**

**Option 1:** Migrate to `@playwright/test` framework

```javascript
// Before (Jest + playwright - BROKEN)
const { chromium } = require('playwright');
describe('My Test', () => {
  it('should be visible', async () => {
    const page = await browser.newPage();
    await expect(page.locator('.button')).toBeVisible(); // ❌ Not available
  });
});

// After (@playwright/test - WORKS)
const { test, expect } = require('@playwright/test');
test('should be visible', async ({ page }) => {
  await expect(page.locator('.button')).toBeVisible(); // ✅ Works
});
```

**Option 2:** Use Playwright's `is*` methods with Jest

```javascript
const { chromium } = require('playwright');
describe('My Test', () => {
  it('should be visible', async () => {
    const page = await browser.newPage();
    const button = page.locator('.button');
    const isVisible = await button.isVisible(); // ✅ Native Playwright method
    expect(isVisible).toBe(true); // ✅ Jest assertion
  });
});
```

**Recommendation:** Migrate to `@playwright/test` (see Issue #482).

---

### Database Connection Failed

**Error:**

```
Error: connect ECONNREFUSED postgresql://localhost:5432/roastr_test
```

**Solution:**

```bash
# 1. Check PostgreSQL running
brew services list | grep postgres
# Or:
systemctl status postgresql

# 2. Start if stopped
brew services start postgresql
# Or:
systemctl start postgresql

# 3. Verify connection
psql -U postgres -d roastr_test -c "SELECT 1"

# 4. Check DATABASE_URL in .env
echo $DATABASE_URL
# Should match: postgresql://user:password@host:port/database

# 5. Create database if missing
createdb roastr_test

# 6. Run migrations
npm run db:migrate
```

---

### Redis Connection Failed

**Error:**

```
Error: connect ECONNREFUSED redis://localhost:6379
```

**Solution:**

```bash
# 1. Check Redis running
brew services list | grep redis
# Or:
systemctl status redis

# 2. Start if stopped
brew services start redis
# Or:
redis-server

# 3. Verify connection
redis-cli ping
# Expected: PONG

# 4. Check REDIS_URL in .env
echo $REDIS_URL
# Should match: redis://localhost:6379 or redis://user:pass@host:port
```

---

### Tests Timeout

**Error:**

```
Timeout - Async callback was not invoked within the 5000 ms timeout
```

**Solution:**

```bash
# Option 1: Increase global timeout
npm test -- --testTimeout=30000

# Option 2: In test file
jest.setTimeout(30000);

# Option 3: Specific test
it('slow test', async () => {
  // test code
}, 30000); // 30 seconds timeout
```

---

### CI/CD Fails, Local Passes

**Common causes:**

1. **Different Node version**
   - Solution: Pin Node version in CI (`.nvmrc` or workflow)

2. **Missing environment variables**
   - Solution: Add to CI secrets/variables

3. **Database not seeded**
   - Solution: Add seed step to CI workflow

4. **Timeouts too short**
   - Solution: Increase CI timeouts (slower CI environment)

5. **Playwright browsers not installed**
   - Solution: Add `npx playwright install --with-deps` to CI

**Debug CI:**

```yaml
# Add debug step to workflow
- name: Debug environment
  run: |
    echo "Node version: $(node --version)"
    echo "npm version: $(npm --version)"
    echo "DATABASE_URL: $DATABASE_URL"
    curl -f http://localhost:3000/health || echo "Server not ready"
    npx playwright --version || echo "Playwright not installed"
```

---

## FAQ

### Q: Do I need to run E2E tests for every PR?

**A:** No, only when:

- Changes affect user workflows
- PR has `test:e2e` label
- Pre-release validation
- Visual UI changes

For quick fixes, unit + integration tests are sufficient.

---

### Q: Can I run E2E tests without Playwright?

**A:** Partially. Tests that don't require browser automation will work:

- ✅ `multiTenantWorkflow.test.js` (uses mocks)
- ✅ `api-health.test.js` (HTTP requests only)
- ❌ `shieldUI.test.js` (requires Playwright)
- ❌ `shield-stability.test.js` (requires Playwright)

---

### Q: Why are some E2E tests skipped?

**A:** See [E2E-INVENTORY.md](./E2E-INVENTORY.md) for complete list. Reasons:

- **Playwright matchers** - `shield-stability.test.js` (Issue #482)
- **Real database** - `trial-management.test.js` (unit tests provide coverage)
- **Conditional skip** - `multiTenantWorkflow.test.js` (respects `SKIP_E2E=true`)

---

### Q: Should I use `@playwright/test` or `playwright` package?

**A:** **Use `@playwright/test`** (recommended).

| Feature            | `playwright`     | `@playwright/test`                  |
| ------------------ | ---------------- | ----------------------------------- |
| Browser automation | ✅ Yes           | ✅ Yes                              |
| Test matchers      | ❌ No            | ✅ Yes (`.toBeVisible()`, etc.)     |
| Test runner        | ❌ No (use Jest) | ✅ Built-in (`npx playwright test`) |
| HTML reports       | ❌ No            | ✅ Yes                              |
| Parallel execution | Manual           | ✅ Automatic                        |

**Verdict:** `@playwright/test` is feature-complete, easier to use, better DX.

---

### Q: How do I add new E2E test?

**Checklist:**

1. **Choose framework:**
   - Jest → for API/workflow tests (fast, familiar)
   - `@playwright/test` → for visual/browser tests

2. **Add prerequisites check:**

   ```javascript
   const { skipIfNoE2E } = require('../helpers/e2ePrerequisites');
   skipIfNoE2E(describe, 'requires server running');
   ```

3. **Document requirements:**
   - Add entry to [E2E-INVENTORY.md](./E2E-INVENTORY.md)
   - Update this file if new requirements introduced

4. **Add to CI:**
   - If always run → include in main test job
   - If conditional → add to `e2e-tests` job with label trigger

5. **Verify locally:**
   - Start server
   - Run test: `npm test tests/integration/yourTest.test.js`
   - Verify passes

6. **PR review:**
   - Include test evidence in `docs/test-evidence/issue-{id}/`
   - Mention requirements in PR description

---

### Q: Can I use Playwright MCP instead of local tests?

**A:** MCP is complementary, not a replacement.

**Use MCP for:**

- ✅ Quick visual validation (screenshots)
- ✅ Accessibility checks
- ✅ Public URL testing

**Use local tests for:**

- ✅ Comprehensive E2E workflows
- ✅ Authenticated flows
- ✅ Database integration
- ✅ API endpoint testing
- ✅ Custom assertions

**Best practice:** Use both (MCP for quick checks, local tests for thorough validation).

---

### Q: Tests fail with "logger.info is not a function"

**A:** Logger import pattern mismatch. See [coderabbit-lessons.md](../patterns/coderabbit-lessons.md) pattern #10.

**Solution:**

```javascript
// ❌ Wrong
const logger = require('../utils/logger');
logger.info('...'); // Error: logger.info is not a function

// ✅ Correct
const { logger } = require('../utils/logger'); // Destructure
logger.info('...'); // Works
```

---

### Q: How long should E2E tests take?

**Benchmarks (local machine):**

| Suite                           | Duration | Acceptable Range |
| ------------------------------- | -------- | ---------------- |
| `api-health.test.js`            | ~2s      | <5s              |
| `multiTenantWorkflow.test.js`   | ~5s      | <15s             |
| `shieldUI.test.js` (Playwright) | ~30s     | <60s             |
| **All E2E tests**               | **~40s** | **<2min**        |

**If slower:**

- Check server response times
- Reduce test data size
- Parallelize tests (Playwright does this automatically)
- Increase CI resources

---

## References

- [E2E-INVENTORY.md](./E2E-INVENTORY.md) - Complete list of E2E tests
- [TESTING-GUIDE.md](../TESTING-GUIDE.md) - General testing guide
- [coderabbit-lessons.md](../patterns/coderabbit-lessons.md) - Common patterns and mistakes
- Issue #896 - Documentar E2E Requirements
- Issue #480 - EPIC Test Stabilization
- Issue #482 - Playwright matchers en Jest
- [Playwright Documentation](https://playwright.dev/) - Official Playwright docs
- [Jest Documentation](https://jestjs.io/) - Official Jest docs

---

**Last Updated:** 2025-11-21  
**Maintained by:** TestEngineer  
**Next Review:** When new E2E requirements identified
