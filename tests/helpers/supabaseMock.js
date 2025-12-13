/**
 * Mock Supabase Client for Integration Tests
 *
 * Issue #894: Supabase egress exceeded (287%)
 * Root cause: Integration tests hitting real Supabase database
 * Solution: Mock client simulates RLS behavior without network calls
 *
 * Bandwidth savings:
 * - Before: 50MB per test run × 50 runs/day = 2.5GB/day
 * - After: 0MB (no network calls)
 * - Savings: 75GB/month within free tier
 */

const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

class MockSupabaseClient {
  constructor(options = {}) {
    // In-memory data store
    this.data = {
      users: [],
      organizations: [],
      organization_members: [],
      posts: [],
      comments: [],
      responses: [],
      integration_configs: [],
      usage_records: [],
      monthly_usage: [],
      user_activities: [],
      roast_metadata: []
    };

    // Current RLS context (simulates auth.uid())
    this.currentUserId = null;
    this.currentOrgId = null;

    // Track call count for monitoring
    this.callCount = 0;

    // Issue #894: Service role bypasses RLS (like real Supabase)
    this.bypassRLS = options.bypassRLS || false;
  }

  /**
   * Set RLS context (simulates JWT token)
   */
  setContext(userId, orgId) {
    this.currentUserId = userId;
    this.currentOrgId = orgId;
  }

  /**
   * Reset context (simulates signOut)
   */
  resetContext() {
    this.currentUserId = null;
    this.currentOrgId = null;
  }

  /**
   * Clear all data (for test cleanup)
   */
  clearAll() {
    Object.keys(this.data).forEach((table) => {
      this.data[table] = [];
    });
    this.callCount = 0;
  }

  /**
   * Check if current user has access to organization
   */
  _hasOrgAccess(orgId) {
    // Issue #894: Use currentContext set by setSession()
    const userId = this.currentContext?.user_id || this.currentUserId;
    const contextOrg = this.currentContext?.organization_id;

    if (!userId) return false; // Not authenticated

    // CRITICAL: If JWT contains organization_id, trust it (simulates RLS policy)
    if (contextOrg && contextOrg === orgId) {
      return true; // User authenticated for this specific org
    }

    // Fallback: Check if user is owner or member
    const org = this.data.organizations?.find((o) => o.id === orgId);
    if (org && org.owner_id === userId) return true;

    const member = this.data.organization_members?.find(
      (m) => m.organization_id === orgId && m.user_id === userId
    );

    return !!member;
  }

  /**
   * Simulate RLS filtering for SELECT operations
   */
  _applyRLSFilter(table, rows) {
    // Issue #894: Service role bypasses RLS (like real Supabase)
    if (this.bypassRLS) {
      return rows; // Service role sees everything
    }

    // Issue #894: Check currentContext (set by setSession)
    const userId = this.currentContext?.user_id || this.currentUserId;

    if (!userId) {
      // No auth context = no access
      return [];
    }

    // Filter based on organization_id (RLS policy pattern)
    return rows.filter((row) => {
      if (!row.organization_id) return true; // No org scope = accessible
      return this._hasOrgAccess(row.organization_id);
    });
  }

  /**
   * Simulate RLS check for INSERT/UPDATE operations
   */
  _checkRLSViolation(table, row) {
    // Issue #894: Service role bypasses RLS (like real Supabase)
    if (this.bypassRLS) {
      return null; // Service role can insert anything
    }

    if (!row.organization_id) return null; // No org scope = no RLS

    if (!this._hasOrgAccess(row.organization_id)) {
      // RLS violation! Return error code 42501
      return {
        code: '42501',
        message: 'new row violates row-level security policy for table "' + table + '"',
        details: null,
        hint: null
      };
    }

    return null; // No violation
  }

  /**
   * Main query interface (simulates Supabase PostgREST API)
   */
  from(table) {
    this.callCount++;

    const buildSelectChain = ({ filters = [], orderBys = [], limitValue = null } = {}) => {
      const applyQuery = () => {
        const rows = this.data[table] || [];
        let filtered = [...rows];

        filters.forEach((fn) => {
          filtered = filtered.filter(fn);
        });

        // Apply ordering
        orderBys.forEach(({ column, ascending }) => {
          filtered = filtered.sort((a, b) => {
            const av = a[column];
            const bv = b[column];
            if (av === bv) return 0;
            return ascending ? (av > bv ? 1 : -1) : av > bv ? -1 : 1;
          });
        });

        // Apply RLS
        filtered = this._applyRLSFilter(table, filtered);

        // Apply limit
        if (typeof limitValue === 'number') {
          filtered = filtered.slice(0, limitValue);
        }

        return filtered;
      };

      const toResult = (rows) => ({ data: rows, error: null, status: 200, statusText: 'OK' });
      const toSingleResult = (rows) => ({
        data: rows[0] || null,
        error: rows.length === 0 ? { message: 'No rows found' } : null,
        status: rows.length === 0 ? 404 : 200,
        statusText: rows.length === 0 ? 'Not Found' : 'OK'
      });

      const chain = {
        eq: (column, value) =>
          buildSelectChain({
            filters: [...filters, (r) => r[column] === value],
            orderBys,
            limitValue
          }),
        in: (column, values = []) =>
          buildSelectChain({
            filters: [...filters, (r) => values.includes(r[column])],
            orderBys,
            limitValue
          }),
        order: (column, options = {}) =>
          buildSelectChain({
            filters,
            orderBys: [...orderBys, { column, ascending: options.ascending !== false }],
            limitValue
          }),
        limit: (value) =>
          buildSelectChain({
            filters,
            orderBys,
            limitValue: typeof value === 'number' ? value : null
          }),
        single: () => Promise.resolve(toSingleResult(applyQuery())),
        maybeSingle: () => Promise.resolve({ data: applyQuery()[0] || null, error: null }),
        then: (resolve) => {
          resolve(toResult(applyQuery()));
        }
      };

      return chain;
    };

    return {
      select: () => buildSelectChain(),

      insert: (rows) => {
        const rowsArray = Array.isArray(rows) ? rows : [rows];
        const insertedRows = [];

        // Issue #894: Auto-create table if doesn't exist (flexible mock)
        if (!this.data[table]) {
          this.data[table] = [];
        }

        let rlsError = null;

        for (const row of rowsArray) {
          // Check RLS before insert
          const error = this._checkRLSViolation(table, row);
          if (error) {
            rlsError = error;
            break; // Stop on first RLS violation
          }

          // Add generated fields
          const newRow = {
            id: row.id || uuidv4(),
            ...row,
            created_at: row.created_at || new Date().toISOString(),
            updated_at: row.updated_at || new Date().toISOString()
          };

          this.data[table].push(newRow);
          insertedRows.push(newRow);
        }

        // Return chainable object even on RLS error (for .select() support)
        if (rlsError) {
          return {
            data: null,
            error: rlsError,
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: null,
                  error: rlsError
                }),
              then: (resolve) => {
                resolve({ data: null, error: rlsError });
              }
            }),
            then: (resolve) => {
              resolve({ data: null, error: rlsError });
            }
          };
        }

        return {
          select: () => ({
            single: () =>
              Promise.resolve({
                data: insertedRows[0],
                error: null
              }),
            then: (resolve) => {
              resolve({ data: insertedRows, error: null });
            }
          }),
          then: (resolve) => {
            resolve({ data: insertedRows, error: null });
          }
        };
      },

      update: (updates) => ({
        eq: (column, value) => {
          const rows = this.data[table] || [];
          const matchingRows = rows.filter((r) => r[column] === value);

          // Apply RLS filter
          const accessibleRows = this._applyRLSFilter(table, matchingRows);

          if (accessibleRows.length === 0) {
            // RLS blocked the update
            // Issue #894: Return empty array (not null) when RLS blocks
            return {
              data: [],
              error: {
                code: '42501',
                message: 'new row violates row-level security policy for table "' + table + '"'
              },
              select: () =>
                Promise.resolve({
                  data: [],
                  error: {
                    code: '42501',
                    message: 'new row violates row-level security policy for table "' + table + '"'
                  }
                }),
              then: (resolve) =>
                resolve({
                  data: [],
                  error: {
                    code: '42501',
                    message: 'new row violates row-level security policy for table "' + table + '"'
                  }
                })
            };
          }

          // Issue #894: CRITICAL - Prevent changing organization_id to another tenant
          // This is a common RLS violation attempt
          if (updates.organization_id && !this.bypassRLS) {
            const currentOrgId = this.currentContext?.organization_id;
            if (currentOrgId && updates.organization_id !== currentOrgId) {
              // Attempting to transfer row to another organization - BLOCKED
              return {
                data: [],
                error: {
                  code: '42501',
                  message: 'cannot change organization_id: violates row-level security policy'
                },
                select: () =>
                  Promise.resolve({
                    data: [],
                    error: {
                      code: '42501',
                      message: 'cannot change organization_id: violates row-level security policy'
                    }
                  }),
                then: (resolve) =>
                  resolve({
                    data: [],
                    error: {
                      code: '42501',
                      message: 'cannot change organization_id: violates row-level security policy'
                    }
                  })
              };
            }
          }

          // Update rows
          accessibleRows.forEach((row) => {
            Object.assign(row, updates, {
              updated_at: new Date().toISOString()
            });
          });

          return {
            data: accessibleRows,
            error: null,

            // Chainable select() after update
            select: (columns = '*') =>
              Promise.resolve({
                data: accessibleRows,
                error: null
              }),

            // Direct promise resolution
            then: (resolve) =>
              resolve({
                data: accessibleRows,
                error: null
              })
          };
        }
      }),

      delete: () => ({
        eq: (column, value) => {
          const rows = this.data[table] || [];
          const matchingRows = rows.filter((r) => r[column] === value);

          // Apply RLS filter
          const accessibleRows = this._applyRLSFilter(table, matchingRows);

          if (accessibleRows.length === 0) {
            // RLS blocked the delete
            // Issue #894: Return empty array (not null) to match UPDATE behavior
            return Promise.resolve({
              data: [],
              error: {
                code: '42501',
                message: 'permission denied for table ' + table
              }
            });
          }

          // Delete rows
          this.data[table] = rows.filter((r) => !accessibleRows.includes(r));

          return Promise.resolve({
            data: accessibleRows,
            error: null
          });
        },

        in: (column, values) => {
          const rows = this.data[table] || [];
          const matchingRows = rows.filter((r) => values.includes(r[column]));

          // Apply RLS filter
          const accessibleRows = this._applyRLSFilter(table, matchingRows);

          if (accessibleRows.length === 0) {
            // RLS blocked the delete (no accessible rows to delete)
            // Issue #894: Return empty array (not null) to match UPDATE behavior
            return Promise.resolve({
              data: [],
              error: {
                code: '42501',
                message: 'permission denied for table ' + table
              }
            });
          }

          // Delete rows
          this.data[table] = rows.filter((r) => !accessibleRows.includes(r));

          return Promise.resolve({
            data: accessibleRows,
            error: null
          });
        }
      })
    };
  }

  /**
   * Auth interface (minimal mock)
   */
  get auth() {
    return {
      signOut: () => {
        this.resetContext();
        return Promise.resolve({ error: null });
      },

      setSession: ({ access_token }) => {
        // Issue #894: Decode JWT to extract organization_id for RLS context
        try {
          // Decode without verification (mock environment)
          const decoded = jwt.decode(access_token);

          if (decoded && decoded.organization_id) {
            // Set RLS context based on JWT claims
            this.currentContext = {
              user_id: decoded.sub,
              organization_id: decoded.organization_id,
              role: decoded.role || 'authenticated'
            };

            console.log(
              `🔐 Mock RLS context set: user=${decoded.sub}, org=${decoded.organization_id}`
            );
          } else {
            console.warn('⚠️  JWT missing organization_id claim');
          }

          return Promise.resolve({
            data: { session: { access_token, user: { id: decoded?.sub } } },
            error: null
          });
        } catch (error) {
          return Promise.resolve({
            data: null,
            error: { message: `Failed to decode JWT: ${error.message}` }
          });
        }
      },

      getSession: () => {
        // Return current session based on context
        return Promise.resolve({
          data: {
            session: this.currentContext
              ? {
                  user: { id: this.currentContext.user_id }
                }
              : null
          },
          error: null
        });
      }
    };
  }

  /**
   * RPC interface (for database functions)
   */
  rpc(functionName, params) {
    this.callCount++;

    // Mock common RPC functions
    switch (functionName) {
      case 'get_subscription_tier':
        return Promise.resolve({
          data: 'FREE',
          error: null
        });

      default:
        return Promise.resolve({
          data: null,
          error: { message: `Mock RPC function ${functionName} not implemented` }
        });
    }
  }

  /**
   * Get call statistics (for monitoring)
   */
  getStats() {
    return {
      callCount: this.callCount,
      tablesUsed: Object.keys(this.data).filter((table) => this.data[table].length > 0),
      totalRows: Object.values(this.data).reduce((sum, table) => sum + table.length, 0)
    };
  }
}

/**
 * Factory function to create mock clients
 */
function createMockSupabaseClient(options = {}) {
  return new MockSupabaseClient(options);
}

/**
 * Factory function to create service role client (bypasses RLS)
 */
function createMockServiceClient() {
  return new MockSupabaseClient({ bypassRLS: true });
}

module.exports = {
  MockSupabaseClient,
  createMockSupabaseClient,
  createMockServiceClient
};
