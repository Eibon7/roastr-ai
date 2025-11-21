/**
 * E2E Test Prerequisites Helper - Issue #896
 * 
 * Utilities to check E2E infrastructure availability and skip tests appropriately.
 * 
 * Usage:
 * ```javascript
 * const { skipIfNoE2E, isE2EAvailable, isServerAvailable, isPlaywrightAvailable } = require('../helpers/e2ePrerequisites');
 * 
 * // Skip entire suite if no E2E infrastructure
 * describe('My E2E Tests', () => {
 *   skipIfNoE2E(test, 'requires server running');
 *   
 *   it('should test something', async () => {
 *     // test code
 *   });
 * });
 * ```
 */

const http = require('http');
const https = require('https');
const { logger } = require('../../src/utils/logger');

/**
 * Check if server is available at given URL
 * @param {string} url - Server URL to check (default: http://localhost:3000)
 * @param {number} timeout - Timeout in ms (default: 2000)
 * @returns {Promise<boolean>} True if server responds to health check
 */
async function isServerAvailable(url = null, timeout = 2000) {
  const testUrl = url || process.env.TEST_SERVER_URL || process.env.TEST_URL || 'http://localhost:3000';
  
  return new Promise((resolve) => {
    const healthUrl = `${testUrl}/health`;
    const urlObj = new URL(healthUrl);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.get(healthUrl, (res) => {
      // Accept any 2xx or 3xx response as "available"
      const available = res.statusCode >= 200 && res.statusCode < 400;
      resolve(available);
    });
    
    // Use req.setTimeout() instead of deprecated { timeout } option
    req.setTimeout(timeout);
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Check if Playwright is installed and available
 * @returns {boolean} True if Playwright can be required
 */
function isPlaywrightAvailable() {
  try {
    // Try to require playwright package (low-level)
    require('playwright');
    return true;
  } catch (e1) {
    try {
      // Try to require @playwright/test (framework)
      require('@playwright/test');
      return true;
    } catch (e2) {
      return false;
    }
  }
}

/**
 * Check if E2E infrastructure is available
 * 
 * E2E is considered available if:
 * 1. E2E_ENABLED=true explicitly set, OR
 * 2. (Server is available OR TEST_SERVER_URL set) AND Playwright installed (if needed)
 * 
 * E2E is NOT available if:
 * 1. SKIP_E2E=true explicitly set, OR
 * 2. Server not available and no TEST_SERVER_URL, OR
 * 3. Playwright required but not installed
 * 
 * @param {Object} options - Options
 * @param {boolean} options.requireServer - Require server availability (default: true)
 * @param {boolean} options.requirePlaywright - Require Playwright (default: false)
 * @param {string} options.serverUrl - Custom server URL to check
 * @returns {Promise<boolean>} True if E2E tests can run
 */
async function isE2EAvailable(options = {}) {
  const {
    requireServer = true,
    requirePlaywright = false,
    serverUrl = null
  } = options;
  
  // Explicit skip flag
  if (process.env.SKIP_E2E === 'true') {
    logger.debug('E2E tests skipped: SKIP_E2E=true');
    return false;
  }
  
  // Explicit enable flag (bypass checks)
  if (process.env.E2E_ENABLED === 'true') {
    logger.debug('E2E tests enabled: E2E_ENABLED=true');
    return true;
  }
  
  // Check server if required
  if (requireServer) {
    const serverAvailable = await isServerAvailable(serverUrl);
    if (!serverAvailable) {
      logger.debug('E2E tests skipped: server not available');
      return false;
    }
  }
  
  // Check Playwright if required
  if (requirePlaywright) {
    const playwrightAvailable = isPlaywrightAvailable();
    if (!playwrightAvailable) {
      logger.debug('E2E tests skipped: Playwright not installed');
      return false;
    }
  }
  
  return true;
}

/**
 * Skip test or suite if E2E infrastructure not available
 * 
 * Usage in test file:
 * ```javascript
 * describe('My E2E Tests', () => {
 *   skipIfNoE2E(test, 'requires server running', { requireServer: true });
 *   
 *   it('should work', () => { ... });
 * });
 * ```
 * 
 * @param {Function} testFn - Test function (test, it, describe)
 * @param {string} reason - Reason for skip (default: 'requires E2E infrastructure')
 * @param {Object} options - Options passed to isE2EAvailable
 */
function skipIfNoE2E(testFn, reason = 'requires E2E infrastructure', options = {}) {
  // This runs synchronously, so we need to check availability in beforeAll
  // For now, we check environment variables only (sync checks)
  
  // Explicit skip
  if (process.env.SKIP_E2E === 'true') {
    if (testFn.skip) {
      testFn.skip(`Skipped: ${reason} (SKIP_E2E=true)`, () => {});
    }
    return true;
  }
  
  // Explicit enable (bypass)
  if (process.env.E2E_ENABLED === 'true') {
    return false;
  }
  
  // Check Playwright if required (sync check)
  if (options.requirePlaywright) {
    const playwrightAvailable = isPlaywrightAvailable();
    if (!playwrightAvailable) {
      if (testFn.skip) {
        testFn.skip(`Skipped: ${reason} (Playwright not installed)`, () => {});
      }
      return true;
    }
  }
  
  // Server availability requires async check, can't do here
  // Tests should use beforeAll with isE2EAvailable for server checks
  
  return false;
}

/**
 * Helper to conditionally skip suite based on E2E availability (async)
 * 
 * Usage:
 * ```javascript
 * describe('My E2E Tests', () => {
 *   beforeAll(async () => {
 *     await skipSuiteIfNoE2E('requires server + Playwright', {
 *       requireServer: true,
 *       requirePlaywright: true
 *     });
 *   });
 *   
 *   it('should work', () => { ... });
 * });
 * ```
 * 
 * @param {string} reason - Reason for skip
 * @param {Object} options - Options passed to isE2EAvailable
 * @throws {Error} If E2E not available (Jest will skip remaining tests)
 */
async function skipSuiteIfNoE2E(reason = 'requires E2E infrastructure', options = {}) {
  const available = await isE2EAvailable(options);
  
  if (!available) {
    // Throw error to skip remaining tests in suite
    throw new Error(`Skipped: ${reason}`);
  }
}

module.exports = {
  isE2EAvailable,
  isServerAvailable,
  isPlaywrightAvailable,
  skipIfNoE2E,
  skipSuiteIfNoE2E
};

