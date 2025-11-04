/**
 * Supabase Mock Factory
 *
 * Provides reusable mock creation functions for Supabase client testing.
 *
 * CRITICAL PATTERN:
 * Create mocks BEFORE jest.mock() calls to avoid module resolution timing issues.
 *
 * Related: Issue #480 Week 3 Day 2 - Supabase Mock Pattern Fix
 *
 * Example Usage:
 * ```javascript
 * const { createSupabaseMock } = require('../helpers/supabaseMockFactory');
 *
 * // Step 1: Create mock BEFORE jest.mock() call
 * const mockSupabase = createSupabaseMock({
 *   user_subscriptions: { plan: 'pro', status: 'active' },
 *   roast_usage: { count: 15 }
 * });
 *
 * // Step 2: Reference pre-created mock in jest.mock()
 * jest.mock('../../src/config/supabase', () => ({
 *   supabaseServiceClient: mockSupabase
 * }));
 * ```
 */

/**
 * Creates a mock table builder with chainable query methods
 *
 * @param {Object} options - Configuration options
 * @param {*} options.defaultData - Default data to return (single item or array)
 * @param {Error|null} options.defaultError - Default error to return
 * @param {boolean} options.single - Whether to return single item (true) or array (false)
 * @returns {Object} Mock table builder with select, insert, update, delete methods
 */
function createTableMock(options = {}) {
  const {
    defaultData = null,
    defaultError = null,
    single = false
  } = options;

  const resolveValue = {
    data: single && Array.isArray(defaultData) ? defaultData[0] : defaultData,
    error: defaultError
  };

  const builder = {
    select: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    update: jest.fn(() => builder),
    delete: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    neq: jest.fn(() => builder),
    gt: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lt: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    in: jest.fn(() => builder),
    is: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    single: jest.fn(() => Promise.resolve(resolveValue)),
    maybeSingle: jest.fn(() => Promise.resolve(resolveValue)),
    then: (resolve) => resolve(resolveValue)
  };

  return builder;
}

/**
 * Creates a complete Supabase client mock with pre-configured tables
 *
 * @param {Object} tableDefaults - Table-specific default data
 * @param {Object} rpcDefaults - RPC function default returns
 * @returns {Object} Complete Supabase client mock
 *
 * @example
 * const mockSupabase = createSupabaseMock({
 *   user_subscriptions: { plan: 'pro', status: 'active' },
 *   roast_usage: { count: 15 },
 *   comments: [{ id: '1', text: 'test' }, { id: '2', text: 'test2' }]
 * }, {
 *   get_subscription_tier: { data: 'PRO', error: null },
 *   consume_roast_credits: { data: { success: true, remaining: 45 }, error: null }
 * });
 */
function createSupabaseMock(tableDefaults = {}, rpcDefaults = {}) {
  const mock = {
    from: jest.fn((tableName) => {
      // Return table-specific mock if defined
      if (tableDefaults[tableName] !== undefined) {
        const data = tableDefaults[tableName];
        const single = !Array.isArray(data);
        return createTableMock({ defaultData: data, single });
      }

      // Return empty mock for unknown tables
      return createTableMock({ defaultData: null });
    }),

    rpc: jest.fn((functionName, params) => {
      // Return RPC-specific mock if defined
      if (rpcDefaults[functionName] !== undefined) {
        return Promise.resolve(rpcDefaults[functionName]);
      }

      // Default: RPC not mocked
      return Promise.resolve({
        data: null,
        error: { message: `RPC function '${functionName}' not mocked` }
      });
    }),

    // Utility method to reset all mocks
    _reset: function() {
      this.from.mockClear();
      this.rpc.mockClear();
    },

    // Utility method to configure table on the fly
    _setTableData: function(tableName, data) {
      const single = !Array.isArray(data);
      const existingFromMock = this.from;

      this.from = jest.fn((name) => {
        if (name === tableName) {
          return createTableMock({ defaultData: data, single });
        }
        return existingFromMock(name);
      });
    }
  };

  return mock;
}

/**
 * Creates a Supabase mock with pre-configured standard tables
 *
 * Standard tables include:
 * - user_subscriptions
 * - roast_usage
 * - analysis_usage
 * - comments
 * - posts
 * - integrations
 * - shield_actions
 * - toxicity_analysis
 * - usage_logs
 * - referral_codes
 * - referral_conversions
 * - user_behaviors (Shield feature)
 *
 * @param {Object} overrides - Custom data for specific tables
 * @returns {Object} Supabase mock with standard defaults
 *
 * @example
 * const mockSupabase = createStandardSupabaseMock({
 *   user_subscriptions: { plan: 'pro', status: 'active' },
 *   roast_usage: { count: 25 }
 * });
 */
function createStandardSupabaseMock(overrides = {}) {
  const defaults = {
    user_subscriptions: { plan: 'free', status: 'active' },
    roast_usage: { count: 0 },
    analysis_usage: { count: 0 },
    comments: [],
    posts: [],
    integrations: [],
    shield_actions: [],
    toxicity_analysis: [],
    usage_logs: [],
    referral_codes: [],
    referral_conversions: [],
    user_behaviors: [], // Shield feature table
    ...overrides
  };

  const rpcDefaults = {
    get_subscription_tier: { data: 'FREE', error: null },
    consume_roast_credits: {
      data: {
        success: true,
        hasCredits: true,
        remaining: 50,
        limit: 50,
        used: 0,
        unlimited: false
      },
      error: null
    },
    consume_analysis_credits: {
      data: {
        success: true,
        hasCredits: true,
        remaining: 1000,
        limit: 1000,
        used: 0,
        unlimited: false
      },
      error: null
    }
  };

  return createSupabaseMock(defaults, rpcDefaults);
}

module.exports = {
  createTableMock,
  createSupabaseMock,
  createStandardSupabaseMock
};
