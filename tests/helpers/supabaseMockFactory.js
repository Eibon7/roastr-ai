/**
 * Supabase Mock Factory
 *
 * Centralized mock creation for Supabase client following Pattern #11 from coderabbit-lessons.md
 * Issue #1021: Fix database mock issues across ~80 tests
 *
 * Usage:
 *   const mockSupabase = createSupabaseMock(tableData, rpcResponses);
 *   jest.mock('../../src/config/supabase', () => ({
 *     supabaseServiceClient: mockSupabase
 *   }));
 */

/**
 * Create a complete Supabase mock with all chain methods
 * @param {Object} tableData - Mock data by table name { tableName: mockData }
 * @param {Object} rpcResponses - Mock RPC responses { functionName: response }
 * @returns {Object} Complete Supabase mock with OpenAI-compatible interface
 */
function createSupabaseMock(tableData = {}, rpcResponses = {}) {
  // Internal storage for mock state
  const storage = {
    tables: { ...tableData },
    rpc: { ...rpcResponses },
    insertedData: {},
    updatedData: {}
  };

  /**
   * Mock query builder with full chain support
   */
  const createQueryBuilder = (tableName) => {
    const queryState = {
      table: tableName,
      filters: [],
      selectedColumns: '*',
      orderBy: null,
      limit: null,
      offset: null
    };

    const builder = {
      // SELECT operation
      select: jest.fn((columns = '*') => {
        queryState.selectedColumns = columns;
        return builder;
      }),

      // FILTER operations
      eq: jest.fn((column, value) => {
        queryState.filters.push({ type: 'eq', column, value });
        return builder;
      }),

      neq: jest.fn((column, value) => {
        queryState.filters.push({ type: 'neq', column, value });
        return builder;
      }),

      gt: jest.fn((column, value) => {
        queryState.filters.push({ type: 'gt', column, value });
        return builder;
      }),

      gte: jest.fn((column, value) => {
        queryState.filters.push({ type: 'gte', column, value });
        return builder;
      }),

      lt: jest.fn((column, value) => {
        queryState.filters.push({ type: 'lt', column, value });
        return builder;
      }),

      lte: jest.fn((column, value) => {
        queryState.filters.push({ type: 'lte', column, value });
        return builder;
      }),

      like: jest.fn((column, pattern) => {
        queryState.filters.push({ type: 'like', column, pattern });
        return builder;
      }),

      ilike: jest.fn((column, pattern) => {
        queryState.filters.push({ type: 'ilike', column, pattern });
        return builder;
      }),

      is: jest.fn((column, value) => {
        queryState.filters.push({ type: 'is', column, value });
        return builder;
      }),

      in: jest.fn((column, values) => {
        queryState.filters.push({ type: 'in', column, values });
        return builder;
      }),

      not: jest.fn((column, operator, value) => {
        queryState.filters.push({ type: 'not', column, operator, value });
        return builder;
      }),

      // ORDERING & PAGINATION
      order: jest.fn((column, options = {}) => {
        queryState.orderBy = { column, ...options };
        return builder;
      }),

      limit: jest.fn((count) => {
        queryState.limit = count;
        return builder;
      }),

      range: jest.fn((from, to) => {
        queryState.offset = from;
        queryState.limit = to - from + 1;
        return builder;
      }),

      // TERMINAL operations
      single: jest.fn(() => {
        const data = storage.tables[tableName];

        if (!data) {
          return Promise.resolve({ data: null, error: { message: 'Table not found' } });
        }

        // Apply filters
        let result = Array.isArray(data) ? data[0] : data;

        return Promise.resolve({
          data: result || null,
          error: result ? null : { message: 'No rows found' }
        });
      }),

      maybeSingle: jest.fn(() => {
        const data = storage.tables[tableName];
        const result = Array.isArray(data) ? data[0] : data;
        return Promise.resolve({ data: result || null, error: null });
      }),

      // THEN operation (for direct promise resolution)
      then: jest.fn((resolve) => {
        const data = storage.tables[tableName];

        if (!data) {
          return Promise.resolve({ data: null, error: { message: 'Table not found' } }).then(
            resolve
          );
        }

        // Apply filters
        let result = data;
        if (Array.isArray(data) && queryState.filters.length > 0) {
          result = data.filter((row) => {
            return queryState.filters.every((filter) => {
              switch (filter.type) {
                case 'eq':
                  return row[filter.column] === filter.value;
                case 'neq':
                  return row[filter.column] !== filter.value;
                case 'gt':
                  return row[filter.column] > filter.value;
                case 'gte':
                  // For date comparisons, convert to Date objects if both are strings
                  if (typeof row[filter.column] === 'string' && typeof filter.value === 'string') {
                    const rowDate = new Date(row[filter.column]);
                    const filterDate = new Date(filter.value);
                    if (!isNaN(rowDate.getTime()) && !isNaN(filterDate.getTime())) {
                      return rowDate >= filterDate;
                    }
                  }
                  return row[filter.column] >= filter.value;
                case 'lt':
                  return row[filter.column] < filter.value;
                case 'lte':
                  // For date comparisons, convert to Date objects if both are strings
                  if (typeof row[filter.column] === 'string' && typeof filter.value === 'string') {
                    const rowDate = new Date(row[filter.column]);
                    const filterDate = new Date(filter.value);
                    if (!isNaN(rowDate.getTime()) && !isNaN(filterDate.getTime())) {
                      return rowDate <= filterDate;
                    }
                  }
                  return row[filter.column] <= filter.value;
                case 'in':
                  // filter.values is the array passed to .in(column, values)
                  if (!Array.isArray(filter.values)) {
                    return false;
                  }
                  return filter.values.includes(row[filter.column]);
                case 'is':
                  return row[filter.column] === filter.value;
                case 'not':
                  // Handle .not(column, 'is', value) - means column !== value
                  if (filter.operator === 'is') {
                    return row[filter.column] !== filter.value;
                  }
                  // Handle other not operators if needed
                  return true;
                default:
                  return true;
              }
            });
          });
        }

        return Promise.resolve({
          data: result || [],
          error: null
        }).then(resolve);
      }),

      // INSERT operation
      insert: jest.fn((insertData) => {
        // Store inserted data
        if (!storage.insertedData[tableName]) {
          storage.insertedData[tableName] = [];
        }
        storage.insertedData[tableName].push(insertData);

        return {
          select: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: { id: 'mock-id', ...insertData },
                error: null
              })
            ),
            then: (resolve) =>
              resolve({
                data: [{ id: 'mock-id', ...insertData }],
                error: null
              })
          })),
          then: (resolve) =>
            resolve({
              data: { id: 'mock-id', ...insertData },
              error: null
            })
        };
      }),

      // UPDATE operation
      update: jest.fn((updateData) => {
        // Store updated data
        if (!storage.updatedData[tableName]) {
          storage.updatedData[tableName] = [];
        }
        storage.updatedData[tableName].push(updateData);

        return {
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: { ...updateData },
                  error: null
                })
              )
            })),
            then: (resolve) => resolve({ data: { ...updateData }, error: null })
          })),
          select: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: { ...updateData },
                error: null
              })
            )
          }))
        };
      }),

      // DELETE operation
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null }))
      }))
    };

    return builder;
  };

  /**
   * Main Supabase mock client
   */
  const mockClient = {
    // Table operations
    from: jest.fn((tableName) => createQueryBuilder(tableName)),

    // RPC operations
    rpc: jest.fn((functionName, params) => {
      const response = storage.rpc[functionName];

      if (response !== undefined) {
        // Return configured response
        if (typeof response === 'function') {
          return Promise.resolve(response(params));
        }
        return Promise.resolve(response);
      }

      // Default response
      return Promise.resolve({ data: null, error: null });
    }),

    // Auth operations
    auth: {
      signInWithPassword: jest.fn(() =>
        Promise.resolve({
          data: { user: { id: 'mock-user-id', email: 'test@example.com' } },
          error: null
        })
      ),
      signUp: jest.fn(() =>
        Promise.resolve({
          data: { user: { id: 'mock-user-id', email: 'test@example.com' } },
          error: null
        })
      ),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
      getUser: jest.fn(() =>
        Promise.resolve({
          data: { user: { id: 'mock-user-id', email: 'test@example.com' } },
          error: null
        })
      ),
      updateUser: jest.fn(() =>
        Promise.resolve({
          data: { user: { id: 'mock-user-id' } },
          error: null
        })
      )
    },

    // Storage operations
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(() => Promise.resolve({ data: { path: 'mock-path' }, error: null })),
        download: jest.fn(() => Promise.resolve({ data: new Blob(), error: null })),
        remove: jest.fn(() => Promise.resolve({ data: null, error: null }))
      }))
    },

    // Helper methods for test control
    _reset: () => {
      storage.tables = { ...tableData };
      storage.rpc = { ...rpcResponses };
      storage.insertedData = {};
      storage.updatedData = {};
      jest.clearAllMocks();
    },

    _setTableData: (tableName, data) => {
      storage.tables[tableName] = data;
    },

    _setRpcResponse: (functionName, response) => {
      storage.rpc[functionName] = response;
    },

    _getInsertedData: (tableName) => {
      return storage.insertedData[tableName] || [];
    },

    _getUpdatedData: (tableName) => {
      return storage.updatedData[tableName] || [];
    }
  };

  return mockClient;
}

/**
 * Create mock with common defaults for typical test scenarios
 */
function createDefaultSupabaseMock() {
  return createSupabaseMock(
    {
      // Common tables with default data
      organizations: [
        {
          id: 'org-123',
          name: 'Test Org',
          plan: 'pro',
          status: 'active'
        }
      ],
      user_subscriptions: [
        {
          id: 'sub-123',
          organization_id: 'org-123',
          plan: 'pro',
          status: 'active'
        }
      ],
      integration_configs: [
        {
          id: 'config-123',
          organization_id: 'org-123',
          platform: 'twitter',
          enabled: true,
          config: { monitored_videos: [] }
        }
      ]
    },
    {
      // Common RPC functions
      get_subscription_tier: { data: 'PRO', error: null },
      can_perform_operation: { data: { allowed: true }, error: null }
    }
  );
}

module.exports = {
  createSupabaseMock,
  createDefaultSupabaseMock
};
