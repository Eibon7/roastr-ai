/**
 * Roast-Specific Supabase Mock Factory - Issue #680
 *
 * Production-ready mock factory for roast integration tests that provides
 * true test isolation by creating fresh mock instances per test.
 *
 * Philosophy:
 * - Each test gets a completely isolated mock instance (no shared state)
 * - Realistic data structures matching production schema
 * - Complete builder chains (select, eq, single, insert, gte)
 * - Supports sequential call patterns for complex test scenarios
 *
 * @module tests/helpers/roastMockFactory
 */

const { logger } = require('../../src/utils/logger');

/**
 * Create fresh Supabase mock with roast-specific operations
 *
 * @param {Object} options - Mock configuration
 * @param {Array} options.userSubscriptions - Mock user_subscriptions table data
 * @param {Array} options.roastUsage - Mock roast_usage table data
 * @param {boolean} options.enableLogging - Log mock operations (default: false)
 * @returns {Object} Complete Supabase mock with fresh state
 */
function createRoastSupabaseMock(options = {}) {
  // Issue #680 + CodeRabbit Review #697: Clone arrays to prevent reference mutation
  const mockData = {
    userSubscriptions: [...(options.userSubscriptions || [])],
    roastUsage: [...(options.roastUsage || [])],
    analysisUsage: [...(options.analysisUsage || [])]  // Issue #680: Support analysis_usage table
  };

  const enableLogging = options.enableLogging || false;

  // Track operations for verification and debugging
  const operations = {
    select: [],
    insert: [],
    from: []
  };

  /**
   * Create a builder with proper chain support and filtering
   * @param {string} tableName - Table being queried
   * @param {Object} filters - Accumulated filter conditions
   */
  const createBuilder = (tableName, filters = {}) => {
    const builder = {
      select: jest.fn((columns = '*') => {
        if (enableLogging) {
          logger.debug('[RoastMock] select() called', { table: tableName, columns });
        }
        operations.select.push({ table: tableName, columns, timestamp: Date.now() });
        return builder;
      }),

      eq: jest.fn((column, value) => {
        if (enableLogging) {
          logger.debug('[RoastMock] eq() called', { column, value, currentFilters: filters });
        }
        // Create new builder with accumulated filters
        const newFilters = { ...filters, [column]: value };
        return createBuilder(tableName, newFilters);
      }),

      gte: jest.fn((column, value) => {
        if (enableLogging) {
          logger.debug('[RoastMock] gte() called', { column, value });
        }
        // For now, add as filter (can be enhanced for range queries)
        const newFilters = { ...filters, [`${column}_gte`]: value };
        return createBuilder(tableName, newFilters);
      }),

      single: jest.fn(() => {
        if (enableLogging) {
          logger.debug('[RoastMock] single() called', { table: tableName, filters });
        }

        const tableKey = getTableKey(tableName);
        const data = tableKey && mockData[tableKey] ? mockData[tableKey] : [];

        // Apply filters to find matching record
        const match = data.find(row => {
          return Object.keys(filters).every(key => {
            // Handle gte filters separately
            if (key.endsWith('_gte')) {
              const actualKey = key.replace('_gte', '');
              return row[actualKey] >= filters[key];
            }
            return row[key] === filters[key];
          });
        });

        if (!match) {
          return Promise.resolve({
            data: null,
            error: { code: 'PGRST116', message: 'No rows found' }
          });
        }

        return Promise.resolve({
          data: match,
          error: null
        });
      }),

      insert: jest.fn((data) => {
        if (enableLogging) {
          logger.debug('[RoastMock] insert() called', { table: tableName, data });
        }
        operations.insert.push({ table: tableName, data, timestamp: Date.now() });

        // Actually add to mock data for realistic behavior
        const tableKey = getTableKey(tableName);
        if (tableKey && mockData[tableKey]) {
          if (Array.isArray(data)) {
            mockData[tableKey].push(...data);
          } else {
            mockData[tableKey].push(data);
          }
        }

        return Promise.resolve({
          data: Array.isArray(data) ? data : [data],
          error: null
        });
      })
    };

    return builder;
  };

  /**
   * Map table names to mockData keys
   */
  const getTableKey = (tableName) => {
    const tableMap = {
      'user_subscriptions': 'userSubscriptions',
      'roast_usage': 'roastUsage',
      'analysis_usage': 'analysisUsage'  // Issue #680: Support analysis_usage
    };
    return tableMap[tableName];
  };

  /**
   * Main from() mock - creates builders for table queries
   * Builder will query from mockData based on filters applied via .eq(), .gte(), etc.
   */
  const fromMock = jest.fn((tableName) => {
    if (enableLogging) {
      logger.debug('[RoastMock] from() called', { table: tableName });
    }

    operations.from.push({ table: tableName, timestamp: Date.now() });

    // Return builder with no filters (filters will be added by .eq(), .gte(), etc.)
    return createBuilder(tableName, {});
  });

  /**
   * Expose createBuilder for internal use with filters
   */
  fromMock._createBuilder = createBuilder;

  /**
   * Create builder with fixed data (for tests with sequential call patterns)
   * @param {string} tableName - Table name
   * @param {Object} resolveValue - Fixed data to return ({ data, error })
   */
  fromMock._createBuilderWithData = (tableName, resolveValue) => {
    const builder = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      gte: jest.fn(() => builder),
      single: jest.fn(() => Promise.resolve(resolveValue)),
      insert: jest.fn((data) => {
        const tableKey = getTableKey(tableName);
        if (tableKey && mockData[tableKey]) {
          if (Array.isArray(data)) {
            mockData[tableKey].push(...data);
          } else {
            mockData[tableKey].push(data);
          }
        }
        return Promise.resolve({
          data: Array.isArray(data) ? data : [data],
          error: null
        });
      })
    };
    return builder;
  };

  /**
   * Verification helpers for test assertions
   */
  const verify = {
    /**
     * Verify a table was queried
     */
    tableQueried: (tableName) => {
      const fromOps = operations.from.filter(op => op.table === tableName);
      if (fromOps.length === 0) {
        throw new Error(
          `Expected table "${tableName}" to be queried, but found no from() calls.\n` +
          `Tables queried: ${operations.from.map(op => op.table).join(', ')}`
        );
      }
      return true;
    },

    /**
     * Verify data was inserted into a table
     */
    dataInserted: (tableName, expectedFields = {}) => {
      const insertOps = operations.insert.filter(op => op.table === tableName);
      if (insertOps.length === 0) {
        throw new Error(
          `Expected data to be inserted into "${tableName}", but found no insert() calls`
        );
      }

      // Find an insert that matches expected fields
      const matchingInsert = insertOps.find(op => {
        const data = Array.isArray(op.data) ? op.data[0] : op.data;
        return Object.keys(expectedFields).every(key => data[key] === expectedFields[key]);
      });

      if (!matchingInsert) {
        throw new Error(
          `Expected insert into "${tableName}" with fields ${JSON.stringify(expectedFields)}, ` +
          `but no matching insert found`
        );
      }

      return matchingInsert.data;
    },

    /**
     * Get all operations for debugging
     */
    getAllOperations: () => operations,

    /**
     * Get current mock data state
     */
    getMockData: () => mockData
  };

  /**
   * Helper to reset mock state (useful in afterEach)
   */
  const reset = () => {
    operations.select.length = 0;
    operations.insert.length = 0;
    operations.from.length = 0;
    mockData.userSubscriptions.length = 0;
    mockData.roastUsage.length = 0;
    mockData.analysisUsage.length = 0;  // Issue #680: Reset analysis_usage
  };

  return {
    from: fromMock,
    verify,
    reset,
    // Expose internals for advanced test scenarios
    _operations: operations,
    _mockData: mockData
  };
}

/**
 * Create realistic user subscription data
 * @param {Object} options - Subscription configuration
 * @returns {Object} User subscription record
 */
function createUserSubscriptionData(options = {}) {
  return {
    user_id: options.userId || 'test-user-123',
    plan: options.plan || 'free',
    status: options.status || 'active',
    stripe_subscription_id: options.stripeId || null,
    current_period_start: options.periodStart || new Date().toISOString(),
    current_period_end: options.periodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: options.createdAt || new Date().toISOString(),
    updated_at: options.updatedAt || new Date().toISOString()
  };
}

/**
 * Create realistic roast usage data
 * @param {Object} options - Usage configuration
 * @returns {Object} Roast usage record
 */
function createRoastUsageData(options = {}) {
  return {
    id: options.id || `usage_${Date.now()}`,
    user_id: options.userId || 'test-user-123',
    organization_id: options.organizationId || 'test-org',
    plan: options.plan || 'free',
    roast_id: options.roastId || `roast_${Date.now()}`,
    tokens_used: options.tokensUsed ?? 100,  // CodeRabbit #697: Preserve explicit 0 values
    cost: options.cost ?? 0.002,              // CodeRabbit #697: Preserve explicit 0 values
    created_at: options.createdAt || new Date().toISOString(),
    count: options.count ?? 1                 // CodeRabbit #697: Preserve explicit 0 values
  };
}

/**
 * Create realistic analysis usage data
 * @param {Object} options - Usage configuration
 * @returns {Object} Analysis usage record
 */
function createAnalysisUsageData(options = {}) {
  return {
    id: options.id || `analysis_${Date.now()}`,
    user_id: options.userId || 'test-user-123',
    organization_id: options.organizationId || 'test-org',
    plan: options.plan || 'free',
    endpoint: options.endpoint || 'preview',
    platform: options.platform || 'twitter',
    has_style_profile: options.hasStyleProfile || false,
    has_persona: options.hasPersona || false,
    tone: options.tone || 'sarcastic',
    intensity: options.intensity ?? 3,        // CodeRabbit #697: Preserve explicit 0 values
    humor_type: options.humorType || 'witty',
    created_at: options.createdAt || new Date().toISOString(),
    count: options.count ?? 1                 // CodeRabbit #697: Preserve explicit 0 values
  };
}

module.exports = {
  createRoastSupabaseMock,
  createUserSubscriptionData,
  createRoastUsageData,
  createAnalysisUsageData  // Issue #680: Export analysis usage helper
};
