/**
 * Timeout Helpers for E2E Tests
 * Issue #419: Utilities for testing timeout scenarios
 *
 * @module tests/e2e/helpers/timeout-helpers
 */

/**
 * Wait for element with custom timeout
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} selector - Element selector
 * @param {number} [timeout=30000] - Timeout in milliseconds
 * @returns {Promise<import('@playwright/test').ElementHandle>}
 */
async function waitForElement(page, selector, timeout = 30000) {
  return await page.waitForSelector(selector, { timeout });
}

/**
 * Wait for error message to appear
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {number} [timeout=35000] - Timeout in milliseconds
 * @returns {Promise<string>} - Error message text
 */
async function waitForErrorMessage(page, timeout = 35000) {
  await page.waitForSelector('.error-message:not(.hidden)', { timeout });
  return await page.textContent('.error-message #error-text');
}

/**
 * Wait for success message to appear
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {number} [timeout=10000] - Timeout in milliseconds
 * @returns {Promise<string>} - Success message text
 */
async function waitForSuccessMessage(page, timeout = 10000) {
  await page.waitForSelector('.success-message:not(.hidden)', { timeout });
  return await page.textContent('.success-message');
}

/**
 * Wait for element to disappear
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} selector - Element selector
 * @param {number} [timeout=10000] - Timeout in milliseconds
 * @returns {Promise<void>}
 */
async function waitForElementToDisappear(page, selector, timeout = 10000) {
  await page.waitForSelector(selector, { state: 'hidden', timeout });
}

/**
 * Wait for loading spinner to disappear
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {number} [timeout=30000] - Timeout in milliseconds
 * @returns {Promise<void>}
 */
async function waitForLoadingToComplete(page, timeout = 30000) {
  await page.waitForSelector('.loading-spinner', { state: 'hidden', timeout }).catch(() => {
    // Loading spinner might not exist, which is fine
  });
}

/**
 * Wait for network idle
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {number} [timeout=30000] - Timeout in milliseconds
 * @returns {Promise<void>}
 */
async function waitForNetworkIdle(page, timeout = 30000) {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Measure operation duration
 * @param {Function} operation - Async operation to measure
 * @returns {Promise<{duration: number, result: any}>}
 */
async function measureDuration(operation) {
  const startTime = Date.now();
  const result = await operation();
  const duration = Date.now() - startTime;
  return { duration, result };
}

/**
 * Verify operation completes within timeout
 * @param {Function} operation - Async operation
 * @param {number} maxDuration - Maximum allowed duration in ms
 * @returns {Promise<boolean>}
 */
async function verifyOperationTimeout(operation, maxDuration) {
  const { duration } = await measureDuration(operation);
  return duration <= maxDuration;
}

/**
 * Retry operation until success or max attempts
 * @param {Function} operation - Async operation
 * @param {number} [maxAttempts=3] - Maximum retry attempts
 * @param {number} [delayMs=1000] - Delay between retries
 * @returns {Promise<any>} - Operation result
 * @throws {Error} - If all attempts fail
 */
async function retryOperation(operation, maxAttempts = 3, delayMs = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * Wait with custom delay
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if element becomes visible within timeout
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} selector - Element selector
 * @param {number} [timeout=5000] - Timeout in milliseconds
 * @returns {Promise<boolean>} - True if visible within timeout
 */
async function isVisibleWithinTimeout(page, selector, timeout = 5000) {
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  waitForElement,
  waitForErrorMessage,
  waitForSuccessMessage,
  waitForElementToDisappear,
  waitForLoadingToComplete,
  waitForNetworkIdle,
  measureDuration,
  verifyOperationTimeout,
  retryOperation,
  wait,
  isVisibleWithinTimeout
};
