/**
 * Network Helpers for E2E Tests
 * Issue #419: Simulate network conditions (errors, delays, disconnections)
 *
 * @module tests/e2e/helpers/network-helpers
 */

/**
 * Simulate network error by intercepting route
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} urlPattern - URL pattern to intercept (e.g., '**/ api / approval; /*/regenerate')
 * @returns {Promise<void>}
 */
async function simulateNetworkError(page, urlPattern) {
  await page.route(urlPattern, (route) => {
    route.abort('failed');
  });
}

/**
 * Simulate network timeout by delaying response
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} urlPattern - URL pattern to intercept
 * @param {number} delayMs - Delay in milliseconds (default: 31000ms = 31s)
 * @returns {Promise<void>}
 */
async function simulateNetworkTimeout(page, urlPattern, delayMs = 31000) {
  await page.route(urlPattern, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill({
      status: 408,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'TIMEOUT',
        message: 'Request timeout',
        code: 'E_TIMEOUT'
      })
    });
  });
}

/**
 * Simulate slow network by adding delay to all responses
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} urlPattern - URL pattern to intercept
 * @param {number} delayMs - Delay in milliseconds
 * @returns {Promise<void>}
 */
async function simulateSlowNetwork(page, urlPattern, delayMs = 3000) {
  await page.route(urlPattern, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.continue();
  });
}

/**
 * Mock API response with custom status and body
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} urlPattern - URL pattern to intercept
 * @param {Object} options - Response options
 * @param {number} options.status - HTTP status code
 * @param {Object} options.body - Response body (will be JSON stringified)
 * @param {Object} [options.headers] - Additional headers
 * @returns {Promise<void>}
 */
async function mockApiResponse(page, urlPattern, { status, body, headers = {} }) {
  await page.route(urlPattern, (route) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      headers: {
        'Access-Control-Allow-Origin': '*',
        ...headers
      },
      body: JSON.stringify(body)
    });
  });
}

/**
 * Mock variant exhaustion error (429)
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} [urlPattern='**/ api / approval; /*/regenerate'] - URL pattern
 * @returns {Promise<void>}
 */
async function mockVariantExhaustion(page, urlPattern = '**/api/approval/*/regenerate') {
  await mockApiResponse(page, urlPattern, {
    status: 429,
    body: {
      error: 'VARIANTS_EXHAUSTED',
      message: 'No more variants available for this roast',
      code: 'E_VARIANT_LIMIT'
    }
  });
}

/**
 * Mock server error (500)
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} urlPattern - URL pattern to intercept
 * @param {string} [errorMessage='Internal server error'] - Error message
 * @returns {Promise<void>}
 */
async function mockServerError(page, urlPattern, errorMessage = 'Internal server error') {
  await mockApiResponse(page, urlPattern, {
    status: 500,
    body: {
      error: 'SERVER_ERROR',
      message: errorMessage,
      code: 'E_SERVER'
    }
  });
}

/**
 * Mock successful variant generation
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} [urlPattern='**/ api / approval; /*/regenerate'] - URL pattern
 * @param {string} [variantText='Este es un nuevo roast generado'] - Variant text
 * @returns {Promise<void>}
 */
async function mockSuccessfulVariant(
  page,
  urlPattern = '**/api/approval/*/regenerate',
  variantText = 'Este es un nuevo roast generado'
) {
  await mockApiResponse(page, urlPattern, {
    status: 200,
    body: {
      variant: {
        id: 'variant_' + Date.now(),
        text: variantText,
        created_at: new Date().toISOString()
      }
    }
  });
}

/**
 * Clear all route interceptions
 * @param {import('@playwright/test').Page} page - Playwright page
 * @returns {Promise<void>}
 */
async function clearAllMocks(page) {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

/**
 * Mock first request failure, then success (for retry testing)
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} urlPattern - URL pattern
 * @param {Object} errorOptions - Error response options
 * @param {Object} successOptions - Success response options
 * @returns {Promise<void>}
 */
async function mockFailThenSuccess(page, urlPattern, errorOptions, successOptions) {
  let callCount = 0;

  await page.route(urlPattern, (route) => {
    callCount++;

    if (callCount === 1) {
      // First call: return error
      route.fulfill({
        status: errorOptions.status || 500,
        contentType: 'application/json',
        body: JSON.stringify(errorOptions.body || { error: 'Temporary error' })
      });
    } else {
      // Subsequent calls: return success
      route.fulfill({
        status: successOptions.status || 200,
        contentType: 'application/json',
        body: JSON.stringify(successOptions.body || { success: true })
      });
    }
  });
}

module.exports = {
  simulateNetworkError,
  simulateNetworkTimeout,
  simulateSlowNetwork,
  mockApiResponse,
  mockVariantExhaustion,
  mockServerError,
  mockSuccessfulVariant,
  clearAllMocks,
  mockFailThenSuccess
};
