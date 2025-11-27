/**
 * Common RLS Test Helpers
 *
 * Provides consistent setup/teardown functions for all RLS tests.
 * Handles psql availability checks and proper error handling.
 *
 * Usage:
 * ```js
 * const { setup, teardown } = require('./helpers/rls-test-helpers');
 *
 * let db, pg, shouldSkip;
 *
 * beforeAll(async () => {
 *   const result = await setup();
 *   if (result.skip) {
 *     shouldSkip = true;
 *     return;
 *   }
 *   db = result.db;
 *   pg = result.pg;
 * });
 *
 * afterAll(async () => {
 *   if (!shouldSkip) {
 *     await teardown();
 *   }
 * });
 * ```
 */

const { getConnections } = require('supabase-test');
const { getTestConfig } = require('../../setup/supabase-test.config');
const { createMigrationsSeed } = require('./load-migrations');
const { skipIfPsqlNotAvailable } = require('./check-psql');

let globalTeardown = null;

/**
 * Setup RLS test environment
 * @returns {Promise<{db: Object, pg: Object, teardown: Function, skip: boolean}>}
 */
async function setup() {
  // Check if psql is available
  const shouldSkip = await skipIfPsqlNotAvailable();
  if (shouldSkip) {
    return { skip: true };
  }

  try {
    const config = getTestConfig();
    const result = await getConnections(config, [
      createMigrationsSeed() // Load all migrations automatically
    ]);

    // Validate that result has required properties
    if (!result || !result.db || !result.pg) {
      throw new Error('getConnections did not return expected structure');
    }

    // Store teardown function globally for cleanup (may be undefined)
    globalTeardown = result.teardown || null;

    return {
      db: result.db,
      pg: result.pg,
      teardown: result.teardown || null,
      skip: false
    };
  } catch (error) {
    if (error.message && error.message.includes('psql')) {
      console.warn('⚠️  psql not found, skipping RLS tests');
      return { skip: true };
    }
    throw error;
  }
}

/**
 * Teardown RLS test environment
 * @param {Function} teardownFn - Optional teardown function (uses global if not provided)
 */
async function teardown(teardownFn = null) {
  const fn = teardownFn || globalTeardown;

  if (!fn || typeof fn !== 'function') {
    console.warn('⚠️  No teardown function available, skipping cleanup');
    return;
  }

  try {
    await fn();
  } catch (error) {
    // Ignore teardown errors if psql is not available
    if (!error.message || !error.message.includes('psql')) {
      throw error;
    }
  } finally {
    globalTeardown = null;
  }
}

/**
 * Setup beforeEach hook for test isolation
 * @param {Object} db - Database connection object
 * @param {boolean} shouldSkip - Whether to skip test execution
 */
function setupBeforeEach(db, shouldSkip) {
  if (shouldSkip || !db) {
    return;
  }
  if (db && typeof db.beforeEach === 'function') {
    db.beforeEach();
  }
}

/**
 * Setup afterEach hook for test cleanup
 * @param {Object} db - Database connection object
 * @param {boolean} shouldSkip - Whether to skip test execution
 */
function setupAfterEach(db, shouldSkip) {
  if (shouldSkip || !db) {
    return;
  }
  if (db && typeof db.afterEach === 'function') {
    db.afterEach();
  }
}

module.exports = {
  setup,
  teardown,
  setupBeforeEach,
  setupAfterEach
};
