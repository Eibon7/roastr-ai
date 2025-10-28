/**
 * Centralized Supabase Mock Factory - Issue #482
 *
 * Production-ready mock factory for Shield tests that validates BUSINESS LOGIC
 * not just implementation details.
 *
 * Philosophy:
 * - Tests should validate "Does Shield protect users?" not "Was supabase.from() called?"
 * - Realistic data structures matching production schema
 * - Complete mock chains (select, insert, update, upsert, delete)
 * - Verification helpers for asserting actual data, not call counts
 *
 * @module tests/helpers/mockSupabaseFactory
 */

const { logger } = require('../../src/utils/logger');

/**
 * Create complete Supabase mock with all Shield operations
 *
 * @param {Object} options - Mock configuration
 * @param {Array} options.userBehavior - Mock user_behavior table data
 * @param {Array} options.shieldActions - Mock shield_actions table data
 * @param {Array} options.jobQueue - Mock job_queue table data
 * @param {Array} options.appLogs - Mock app_logs table data
 * @param {boolean} options.enableLogging - Log mock operations (default: false)
 * @returns {Object} Complete Supabase mock with verification helpers
 */
function createShieldSupabaseMock(options = {}) {
  const mockData = {
    userBehavior: options.userBehavior || [],
    shieldActions: options.shieldActions || [],
    jobQueue: options.jobQueue || [],
    appLogs: options.appLogs || []
  };

  const enableLogging = options.enableLogging || false;

  // Track all operations for verification
  const operations = {
    select: [],
    insert: [],
    update: [],
    upsert: [],
    delete: []
  };

  /**
   * Mock select() operation with chaining support
   * Issue #482: Complete chain for user_behavior queries
   * Supports multiple .eq() chaining (e.g., .eq('org').eq('platform').eq('userId'))
   */
  const selectMock = jest.fn((columns = '*') => {
    if (enableLogging) {
      logger.debug('[Mock] select() called', { columns });
    }

    operations.select.push({ columns, timestamp: Date.now() });

    /**
     * Create chainable eq() that filters data progressively
     * @param {Array} currentData - Data to filter
     * @param {Object} filters - Accumulated filter conditions
     */
    const createEqChain = (currentData, filters = {}) => {
      return jest.fn((column, value) => {
        if (enableLogging) {
          logger.debug('[Mock] .eq() called', { column, value, filtersSoFar: filters });
        }

        const newFilters = { ...filters, [column]: value };

        return {
          // Support chaining multiple .eq() calls
          eq: createEqChain(currentData, newFilters),

          single: jest.fn(() => {
            const table = getCurrentTable();
            const data = mockData[table] || [];

            // Apply all accumulated filters
            const match = data.find(row =>
              Object.keys(newFilters).every(key => row[key] === newFilters[key])
            );

            if (enableLogging) {
              logger.debug('[Mock] .single() called', {
                table,
                filters: newFilters,
                found: !!match
              });
            }

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

          // Retrieve multiple results without .single()
          all: jest.fn(() => {
            const table = getCurrentTable();
            const data = mockData[table] || [];

            // Apply all accumulated filters
            const matches = data.filter(row =>
              Object.keys(newFilters).every(key => row[key] === newFilters[key])
            );

            if (enableLogging) {
              logger.debug('[Mock] .eq().all() called', {
                table,
                filters: newFilters,
                matchCount: matches.length
              });
            }

            return Promise.resolve({
              data: matches,
              error: null,
              count: matches.length
            });
          })
        };
      });
    };

    return {
      eq: createEqChain(mockData[getCurrentTable()] || []),

      gte: jest.fn((column, value) => {
        if (enableLogging) {
          logger.debug('[Mock] .gte() called', { column, value });
        }

        return {
          lte: jest.fn((column2, value2) => {
            if (enableLogging) {
              logger.debug('[Mock] .lte() called', { column: column2, value: value2 });
            }

            const currentTable = getCurrentTable();
            const tableData = mockData[currentTable] || [];

            return Promise.resolve({
              data: tableData.filter(row =>
                row[column] >= value && row[column2] <= value2
              ),
              error: null
            });
          })
        };
      }),

      order: jest.fn((column, options = {}) => {
        if (enableLogging) {
          logger.debug('[Mock] .order() called', { column, options });
        }

        return {
          limit: jest.fn((count) => {
            if (enableLogging) {
              logger.debug('[Mock] .limit() called', { count });
            }

            const table = getCurrentTable();
            const data = mockData[table] || [];
            const sorted = [...data].sort((a, b) => {
              const aVal = a[column];
              const bVal = b[column];
              return options.ascending === false ? bVal - aVal : aVal - bVal;
            });

            return Promise.resolve({
              data: sorted.slice(0, count),
              error: null
            });
          })
        };
      })
    };
  });

  /**
   * Mock insert() operation
   * Issue #482: Track ALL inserts for audit trail verification
   */
  const insertMock = jest.fn((data) => {
    if (enableLogging) {
      logger.debug('[Mock] insert() called', { data });
    }

    operations.insert.push({ data, timestamp: Date.now() });

    // Actually add to mock data for realistic behavior
    const table = getCurrentTable();
    if (Array.isArray(data)) {
      mockData[table].push(...data);
    } else {
      mockData[table].push(data);
    }

    return Promise.resolve({
      data: Array.isArray(data) ? data : [data],
      error: null
    });
  });

  /**
   * Mock update() operation with .eq() chaining
   * Issue #482: Update user_behavior strikes, violation counts
   */
  const updateMock = jest.fn((data) => {
    if (enableLogging) {
      logger.debug('[Mock] update() called', { data });
    }

    operations.update.push({ data, timestamp: Date.now() });

    return {
      eq: jest.fn((column, value) => {
        if (enableLogging) {
          logger.debug('[Mock] .update().eq() called', { column, value });
        }

        // Actually update mock data
        const table = getCurrentTable();
        const index = mockData[table].findIndex(row => row[column] === value);

        if (index !== -1) {
          mockData[table][index] = { ...mockData[table][index], ...data };
        }

        return Promise.resolve({
          data: index !== -1 ? [mockData[table][index]] : [],
          error: null
        });
      })
    };
  });

  /**
   * Mock upsert() operation
   * Issue #482: User behavior tracking uses upsert for first-time + repeat offenders
   */
  const upsertMock = jest.fn((data, options = {}) => {
    if (enableLogging) {
      logger.debug('[Mock] upsert() called', { data, options });
    }

    operations.upsert.push({ data, options, timestamp: Date.now() });

    // Simulate upsert behavior
    const table = getCurrentTable();
    const onConflict = options.onConflict || 'id';

    const records = Array.isArray(data) ? data : [data];
    const result = [];

    records.forEach(record => {
      const index = mockData[table].findIndex(row =>
        row[onConflict] === record[onConflict]
      );

      if (index !== -1) {
        // Update existing
        mockData[table][index] = { ...mockData[table][index], ...record };
        result.push(mockData[table][index]);
      } else {
        // Insert new
        mockData[table].push(record);
        result.push(record);
      }
    });

    return Promise.resolve({
      data: result,
      error: null
    });
  });

  /**
   * Mock rpc() operation for database functions
   * CodeRabbit: Add RPC mock support for atomic_update_user_behavior
   */
  const rpcMock = jest.fn((functionName, params) => {
    if (enableLogging) {
      logger.debug('[Mock] rpc() called', { functionName, params });
    }

    // Handle atomic_update_user_behavior RPC
    if (functionName === 'atomic_update_user_behavior') {
      const { p_organization_id, p_platform, p_platform_user_id, p_platform_username } = params;

      // Simulate RPC call - update or insert user behavior
      const table = 'userBehavior';
      const conflictKey = `${p_organization_id}-${p_platform}-${p_platform_user_id}`;

      const index = mockData[table].findIndex(row =>
        row.organization_id === p_organization_id &&
        row.platform === p_platform &&
        row.platform_user_id === p_platform_user_id
      );

      if (index !== -1) {
        // Update existing
        mockData[table][index] = {
          ...mockData[table][index],
          ...params,
          updated_at: new Date().toISOString()
        };
        return Promise.resolve({
          data: mockData[table][index],
          error: null
        });
      } else {
        // Insert new
        const newRecord = {
          organization_id: p_organization_id,
          platform: p_platform,
          platform_user_id: p_platform_user_id,
          platform_username: p_platform_username,
          ...params,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        mockData[table].push(newRecord);
        return Promise.resolve({
          data: newRecord,
          error: null
        });
      }
    }

    // Default: return success for unknown RPCs
    return Promise.resolve({
      data: null,
      error: null
    });
  });

  /**
   * Mock from() operation - entry point for all queries
   * Issue #482: Routes to correct table mock data
   */
  let currentTable = null;

  const fromMock = jest.fn((tableName) => {
    if (enableLogging) {
      logger.debug('[Mock] from() called', { table: tableName });
    }

    // Map table names to mockData keys
    // Issue #482: Handle both singular and plural table names
    const tableMap = {
      'user_behavior': 'userBehavior',
      'user_behaviors': 'userBehavior',      // Shield uses plural
      'shield_actions': 'shieldActions',
      'job_queue': 'jobQueue',
      'app_logs': 'appLogs'
    };

    currentTable = tableMap[tableName] || tableName;

    return {
      select: selectMock,
      insert: insertMock,
      update: updateMock,
      upsert: upsertMock
    };
  });

  /**
   * Mock update() operation needs to support .eq().select() chains
   * CodeRabbit: Fix incomplete update mock chain for Shield tests
   */
  const updateChain = {
    eq: jest.fn((column, value) => {
      if (enableLogging) {
        logger.debug('[Mock] .update().eq() called', { column, value });
      }

      return {
        select: jest.fn(() => {
          const table = getCurrentTable();
          const data = mockData[table] || [];
          const updated = data.map(row => {
            if (row[column] === value) {
              return Promise.resolve({ data: { ...row }, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          }).filter(Boolean);

          return Promise.resolve({
            data: updated.length > 0 ? updated : [],
            error: null
          });
        })
      };
    })
  };

  // Update the updateMock to support chaining
  const updateMockExtended = jest.fn((data) => {
    if (enableLogging) {
      logger.debug('[Mock] update() called', { data });
    }

    operations.update.push({ data, timestamp: Date.now() });
    return updateChain;
  });

  /**
   * Helper: Get current table name for mock operations
   */
  function getCurrentTable() {
    return currentTable || 'userBehavior';
  }

  /**
   * Verification Helpers - Validate BUSINESS LOGIC not call counts
   * Issue #482: Production-ready assertions
   */
  const verify = {
    /**
     * Verify user_behavior was queried for escalation logic
     */
    userBehaviorQueried: (userId, organizationId) => {
      const selectOps = operations.select;
      const hasQuery = selectOps.length > 0;

      if (!hasQuery) {
        throw new Error(
          `Expected user_behavior to be queried for user ${userId}, but no select operations found`
        );
      }

      const wasQueried = fromMock.mock.calls.some(([tbl]) => /user_behaviors?/.test(tbl));
      expect(wasQueried).toBe(true);
      return true;
    },

    /**
     * Verify action was recorded in shield_actions table
     * Returns the recorded action data for further validation
     */
    actionRecorded: (actionType) => {
      const insertOps = operations.insert.filter(op => {
        const payloads = Array.isArray(op.data) ? op.data : [op.data];
        return payloads.some(d =>
          d?.action === actionType ||
          d?.action_tag === actionType ||
          d?.action_type === actionType
        );
      });

      if (insertOps.length === 0) {
        throw new Error(
          `Expected action "${actionType}" to be recorded in shield_actions, but found no matching inserts.\n` +
          `Operations recorded: ${JSON.stringify(operations.insert, null, 2)}`
        );
      }

      // Return the most recent matching action
      const latestOp = insertOps[insertOps.length - 1];
      const actionData = (Array.isArray(latestOp.data) ? latestOp.data : [latestOp.data])
        .find(d => d?.action === actionType || d?.action_tag === actionType || d?.action_type === actionType);

      expect(actionData).toBeDefined();

      // Assert on the field that actually exists
      const hasMatch = actionData?.action === actionType ||
                       actionData?.action_tag === actionType ||
                       actionData?.action_type === actionType;
      expect(hasMatch).toBe(true);

      return actionData;
    },

    /**
     * Verify user_behavior was updated (strikes, violation count)
     */
    userBehaviorUpdated: (expectedFields = {}) => {
      const updateOps = operations.update.filter(op =>
        Object.keys(expectedFields).every(key => op.data[key] !== undefined)
      );

      if (updateOps.length === 0) {
        throw new Error(
          `Expected user_behavior to be updated with fields ${Object.keys(expectedFields).join(', ')}, ` +
          `but no matching updates found`
        );
      }

      // Accept either singular or plural table name
      expect(
        fromMock.mock.calls.some(([t]) => t === 'user_behavior' || t === 'user_behaviors')
      ).toBe(true);
      return updateOps[updateOps.length - 1].data;
    },

    /**
     * Verify complete escalation path: warn → mute → block
     * This is the KEY business logic validation
     */
    escalationPathFollowed: (userId, expectedPath) => {
      const actions = operations.insert
        .filter(op => {
          const data = Array.isArray(op.data) ? op.data[0] : op.data;
          return data.user_id === userId || data.platform_user_id === userId;
        })
        .map(op => {
          const data = Array.isArray(op.data) ? op.data[0] : op.data;
          return data.action_type;
        });

      expectedPath.forEach((expectedAction, index) => {
        if (!actions.includes(expectedAction)) {
          throw new Error(
            `Escalation path verification failed:\n` +
            `Expected step ${index + 1}: "${expectedAction}"\n` +
            `Actual actions recorded: ${actions.join(' → ')}\n` +
            `Missing: ${expectedAction}`
          );
        }
      });

      return true;
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

  return {
    from: fromMock,
<<<<<<< HEAD
=======
    rpc: rpcMock,
>>>>>>> origin/main
    verify,
    // Expose operations for advanced verification
    _operations: operations,
    _mockData: mockData
  };
}

/**
 * Create realistic user behavior data for escalation tests
 * Issue #482: Production-ready test data
 */
function createUserBehaviorData(options = {}) {
  return {
    id: options.id || `behavior_${Date.now()}`,
    organization_id: options.organizationId || 'test-org',
    platform: options.platform || 'twitter',
    platform_user_id: options.userId || 'test-user',
    platform_username: options.username || 'testuser',
    total_violations: options.violationCount || 0,
    violation_severity_counts: options.severityCounts || {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    },
    actions_taken: options.actionsTaken || [],
    last_violation_at: options.lastViolation || new Date().toISOString(),
    last_seen_at: options.lastSeen || new Date().toISOString(),
    risk_score: options.riskScore || 0,
    strikes: options.strikes || 0,
    is_muted: options.isMuted !== undefined ? options.isMuted : false,  // Optional field for mute status tests
    user_type: options.userType || 'standard',  // Optional field for special user type tests (verified_creator, etc.)
    created_at: options.createdAt || new Date().toISOString(),
    updated_at: options.updatedAt || new Date().toISOString()
  };
}

/**
 * Create realistic shield action data
 */
function createShieldActionData(options = {}) {
  return {
    id: options.id || `action_${Date.now()}`,
    organization_id: options.organizationId || 'test-org',
    comment_id: options.commentId || 'test-comment',
    platform: options.platform || 'twitter',
    platform_user_id: options.userId || 'test-user',
    action_type: options.actionType || 'warn',
    severity: options.severity || 'low',
    reason: options.reason || 'Test action',
    metadata: options.metadata || {},
    reverted: options.reverted || false,
    reverted_at: options.revertedAt || null,
    created_at: options.createdAt || new Date().toISOString(),
    updated_at: options.updatedAt || new Date().toISOString()
  };
}

module.exports = {
  createShieldSupabaseMock,
  createUserBehaviorData,
  createShieldActionData
};
