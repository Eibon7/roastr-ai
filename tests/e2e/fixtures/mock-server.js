/**
 * Mock Server Fixture for E2E Tests
 * Issue #419: Simulates API server for error scenario testing
 *
 * @module tests/e2e/fixtures/mock-server
 */

class MockServer {
  constructor(page) {
    this.page = page;
    this.routes = new Map();
    this.globalDelay = 0;
  }

  /**
   * Set global delay for all API calls
   * @param {number} delayMs - Delay in milliseconds
   */
  setGlobalDelay(delayMs) {
    this.globalDelay = delayMs;
  }

  /**
   * Clear global delay
   */
  clearGlobalDelay() {
    this.globalDelay = 0;
  }

  /**
   * Mock a specific endpoint with custom response
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} urlPattern - URL pattern to match
   * @param {Object} options - Response options
   * @param {number} options.status - HTTP status code
   * @param {Object} options.body - Response body
   * @param {number} [options.delay=0] - Response delay in ms
   * @param {Object} [options.headers={}] - Additional headers
   */
  async mockEndpoint(method, urlPattern, { status, body, delay = 0, headers = {} }) {
    await this.page.route(urlPattern, async (route) => {
      if (route.request().method() !== method.toUpperCase()) {
        return route.continue();
      }

      const totalDelay = delay + this.globalDelay;
      if (totalDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, totalDelay));
      }

      await route.fulfill({
        status,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          ...headers
        },
        body: JSON.stringify(body)
      });
    });

    this.routes.set(`${method}:${urlPattern}`, { status, body, delay });
  }

  /**
   * Mock network error for endpoint
   * @param {string} urlPattern - URL pattern to match
   */
  async mockNetworkError(urlPattern) {
    await this.page.route(urlPattern, (route) => {
      route.abort('failed');
    });
  }

  /**
   * Mock timeout for endpoint
   * @param {string} urlPattern - URL pattern to match
   * @param {number} [timeoutMs=31000] - Timeout duration in ms
   */
  async mockTimeout(urlPattern, timeoutMs = 31000) {
    await this.mockEndpoint('POST', urlPattern, {
      status: 408,
      body: {
        error: 'TIMEOUT',
        message: 'Request timeout',
        code: 'E_TIMEOUT'
      },
      delay: timeoutMs
    });
  }

  /**
   * Mock variant exhaustion error (429)
   * @param {string} [urlPattern] - URL pattern, defaults to variant endpoint
   */
  async mockVariantExhaustion(urlPattern = '**/api/approval/*/regenerate') {
    await this.mockEndpoint('POST', urlPattern, {
      status: 429,
      body: {
        error: 'VARIANTS_EXHAUSTED',
        message: 'No more variants available for this roast',
        code: 'E_VARIANT_LIMIT'
      }
    });
  }

  /**
   * Mock successful variant generation
   * @param {string} [urlPattern] - URL pattern, defaults to variant endpoint
   * @param {string} [variantText] - Variant text to return
   */
  async mockSuccessfulVariant(
    urlPattern = '**/api/approval/*/regenerate',
    variantText = 'Este es un nuevo roast generado'
  ) {
    await this.mockEndpoint('POST', urlPattern, {
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
   * Mock successful approval
   * @param {string} [urlPattern] - URL pattern, defaults to approval endpoint
   */
  async mockSuccessfulApproval(urlPattern = '**/api/approval/*/approve') {
    await this.mockEndpoint('POST', urlPattern, {
      status: 200,
      body: {
        success: true,
        message: 'Roast approved and published'
      }
    });
  }

  /**
   * Mock successful rejection
   * @param {string} [urlPattern] - URL pattern, defaults to rejection endpoint
   */
  async mockSuccessfulRejection(urlPattern = '**/api/approval/*/reject') {
    await this.mockEndpoint('POST', urlPattern, {
      status: 200,
      body: {
        success: true,
        message: 'Roast rejected'
      }
    });
  }

  /**
   * Mock pending roasts list
   * @param {Array} roasts - Array of roast objects
   * @param {string} [urlPattern] - URL pattern, defaults to pending endpoint
   */
  async mockPendingRoasts(roasts, urlPattern = '**/api/approval/pending') {
    await this.mockEndpoint('GET', urlPattern, {
      status: 200,
      body: {
        roasts: roasts || [
          {
            id: 'roast_1',
            comment: 'Este es un comentario tóxico',
            roast: 'Esta es una respuesta ingeniosa',
            platform: 'twitter',
            created_at: new Date().toISOString()
          }
        ]
      }
    });
  }

  /**
   * Mock first request failure, then success (for retry testing)
   * @param {string} urlPattern - URL pattern
   * @param {Object} errorOptions - Error response options
   * @param {Object} successOptions - Success response options
   */
  async mockFailThenSuccess(urlPattern, errorOptions, successOptions) {
    let callCount = 0;

    await this.page.route(urlPattern, async (route) => {
      callCount++;

      if (callCount === 1) {
        // First call: return error
        await route.fulfill({
          status: errorOptions.status || 500,
          contentType: 'application/json',
          body: JSON.stringify(errorOptions.body || { error: 'Temporary error' })
        });
      } else {
        // Subsequent calls: return success
        await route.fulfill({
          status: successOptions.status || 200,
          contentType: 'application/json',
          body: JSON.stringify(successOptions.body || { success: true })
        });
      }
    });
  }

  /**
   * Clear all mocked routes
   */
  async clearAll() {
    await this.page.unrouteAll({ behavior: 'ignoreErrors' });
    this.routes.clear();
  }

  /**
   * Get statistics about mocked routes
   * @returns {Object} - Statistics object
   */
  getStats() {
    return {
      totalRoutes: this.routes.size,
      routes: Array.from(this.routes.keys()),
      globalDelay: this.globalDelay
    };
  }
}

/**
 * Create mock server fixture for Playwright test
 * @param {import('@playwright/test').Page} page - Playwright page
 * @returns {MockServer}
 */
function createMockServer(page) {
  return new MockServer(page);
}

module.exports = {
  MockServer,
  createMockServer
};
