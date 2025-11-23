# E2E Testing with Playwright

## Overview

End-to-end tests for Roastr.ai using Playwright. Tests validate complete user workflows including error handling, resilience, and recovery scenarios.

**Issue #419**: UI Resilience Tests for Manual Approval Flow

## Installation

```bash
npm install --save-dev @playwright/test playwright
npx playwright install chromium
```

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test manual-approval-resilience.spec.js

# Run with UI mode (debugging)
npx playwright test --ui

# Run in headed mode (see browser)
npx playwright test --headed

# Run specific test by name
npx playwright test -g "timeout"

# Generate HTML report
npx playwright show-report
```

## Test Structure

```
tests/e2e/
├── *.spec.js            # Test suites
├── helpers/             # Utility functions
│   ├── network-helpers.js    # Network simulation
│   └── timeout-helpers.js    # Timeout utilities
├── fixtures/            # Test data and mocks
│   └── mock-server.js        # Mock API server
├── setup.js             # Global setup/teardown
└── README.md            # This file
```

## Writing Tests

### Basic Test Structure

```javascript
const { test, expect } = require('@playwright/test');
const { createMockServer } = require('./fixtures/mock-server');
const { waitForErrorMessage } = require('./helpers/timeout-helpers');

test.describe('My Feature', () => {
  let mockServer;

  test.beforeEach(async ({ page }) => {
    mockServer = createMockServer(page);
    await page.goto('/manual-approval.html');
  });

  test('should handle error gracefully', async ({ page }) => {
    // 1. Set up mock server
    await mockServer.mockNetworkError('**/api/endpoint');

    // 2. Interact with UI
    await page.click('[data-testid="action-btn"]');

    // 3. Assert error handling
    const errorText = await waitForErrorMessage(page);
    expect(errorText).toContain('expected message');

    // 4. Screenshot for evidence
    await page.screenshot({
      path: 'docs/test-evidence/issue-419/error-scenario.png'
    });
  });
});
```

### Using Network Helpers

```javascript
const {
  simulateNetworkError,
  simulateNetworkTimeout,
  mockVariantExhaustion,
  mockSuccessfulVariant
} = require('./helpers/network-helpers');

// Simulate network error
await simulateNetworkError(page, '**/api/manual-approval/approve/*');

// Simulate timeout (31s delay)
await simulateNetworkTimeout(page, '**/api/manual-approval/variants/*', 31000);

// Mock variant exhaustion
await mockVariantExhaustion(page);

// Mock successful variant
await mockSuccessfulVariant(page, '**/api/manual-approval/variants/*', 'Custom roast text');
```

### Using Mock Server

```javascript
const mockServer = createMockServer(page);

// Mock custom response
await mockServer.mockEndpoint('POST', '**/api/endpoint', {
  status: 200,
  body: { success: true },
  delay: 1000 // Optional delay
});

// Mock network error
await mockServer.mockNetworkError('**/api/endpoint');

// Mock timeout
await mockServer.mockTimeout('**/api/endpoint', 31000);

// Mock variant exhaustion
await mockServer.mockVariantExhaustion();

// Mock fail then success (for retry testing)
await mockServer.mockFailThenSuccess(
  '**/api/endpoint',
  { status: 500, body: { error: 'Temporary error' } },
  { status: 200, body: { success: true } }
);

// Clear all mocks
await mockServer.clearAll();
```

### Using Timeout Helpers

```javascript
const {
  waitForErrorMessage,
  waitForSuccessMessage,
  measureDuration,
  retryOperation,
  isVisibleWithinTimeout
} = require('./helpers/timeout-helpers');

// Wait for error message
const errorText = await waitForErrorMessage(page, 35000);

// Wait for success message
const successText = await waitForSuccessMessage(page);

// Measure operation duration
const { duration, result } = await measureDuration(async () => {
  await page.click('[data-testid="btn"]');
  return await page.textContent('.result');
});
console.log(`Operation took ${duration}ms`);

// Check if element becomes visible
const isVisible = await isVisibleWithinTimeout(page, '[data-testid="retry-btn"]', 5000);
expect(isVisible).toBe(true);
```

## Test Scenarios (Issue #419)

### AC #1: Timeout Handling

- Test timeout message after 30s
- Test retry functionality after timeout
- Verify clear error message

### AC #2: Network Error Handling

- Test network error during approval
- Test network error during variant generation
- Verify retry button availability

### AC #3: Variants Exhaustion

- Test variant limit reached (429)
- Verify specific error message
- Verify approve/reject still functional

### AC #4: Clear Error Messages

- Test actionable error messages
- Test no sensitive info leaked
- Test error context included

### AC #5: Retry Functionality

- Test retry button appears on recoverable errors
- Test retry button NOT shown on non-recoverable errors
- Test successful retry operation

## CI/CD Integration

E2E tests run automatically on every PR via GitHub Actions (`.github/workflows/e2e-tests.yml`).

```yaml
- name: Run E2E tests
  run: npm run test:e2e
  env:
    NODE_ENV: test
```

## Test Evidence

Screenshots and reports saved to:

- `/docs/test-evidence/issue-419/` - Test screenshots
- `/playwright-report/` - HTML test reports

## Debugging

### Run with UI Mode

```bash
npx playwright test --ui
```

This opens the Playwright Test Runner with:

- Interactive test execution
- Time travel debugging
- Network inspection
- DOM snapshots

### Run in Debug Mode

```bash
npx playwright test --debug
```

This opens Playwright Inspector for step-by-step debugging.

### View Trace

```bash
# Generate trace on failure (default in config)
npx playwright test

# View trace
npx playwright show-trace trace.zip
```

## Best Practices

### 1. Use Stable Selectors

```javascript
// ✅ Good: Use data-testid
await page.click('[data-testid="approve-btn"]');

// ❌ Bad: Use fragile class names
await page.click('.btn.btn-primary.approve');
```

### 2. Explicit Waits

```javascript
// ✅ Good: Explicit wait
await page.waitForSelector('[data-testid="result"]');

// ❌ Bad: Arbitrary timeout
await page.waitForTimeout(5000);
```

### 3. Clean Up Mocks

```javascript
test.afterEach(async () => {
  await mockServer.clearAll();
});
```

### 4. Descriptive Test Names

```javascript
// ✅ Good
test('should display clear timeout message after 30s and show retry button', async () => {});

// ❌ Bad
test('timeout test', async () => {});
```

### 5. Screenshot on Failure

```javascript
// Screenshots automatically captured on failure (configured in playwright.config.js)
screenshot: 'only-on-failure',
```

## Troubleshooting

### Tests Timing Out

- Increase timeout in test: `test.setTimeout(60000);`
- Check if application is running: `npm start`
- Verify BASE_URL in environment

### Flaky Tests

- Use explicit waits instead of `waitForTimeout`
- Enable retries: `retries: 1` in config
- Check for race conditions in application

### Mock Not Working

- Verify URL pattern matches: Use `**` for wildcards
- Check route order: Routes are matched in reverse order
- Clear mocks between tests: `await mockServer.clearAll()`

## Related Documentation

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Issue #419](https://github.com/Eibon7/roastr-ai/issues/419)
- [GDD Node: roast.md](/docs/nodes/roast.md)
- [CLAUDE.md - E2E Testing](/CLAUDE.md#testing)

---

**Created**: 2025-10-13 (Issue #419)
**Maintained by**: Test Engineer Agent
**Last Updated**: 2025-10-13
