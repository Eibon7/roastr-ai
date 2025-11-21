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
    Object.keys(this.data).forEach(table => {
      this.data[table] = [];
    });
    this.callCount = 0;
  }

  /**
   * Check if current user has access to organization
   */
  _hasOrgAccess(orgId) {
    if (!this.currentUserId) return false; // Not authenticated
    
    // Check if user is owner or member
    const org = this.data.organizations.find(o => o.id === orgId);
    if (org && org.owner_id === this.currentUserId) return true;
    
    const member = this.data.organization_members.find(m => 
      m.organization_id === orgId && m.user_id === this.currentUserId
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
    
    if (!this.currentUserId) {
      // No auth context = no access
      return [];
    }

    // Filter based on organization_id (RLS policy pattern)
    return rows.filter(row => {
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
    
    return {
      select: (columns = '*') => ({
        eq: (column, value) => {
          const rows = this.data[table] || [];
          const filtered = rows.filter(r => r[column] === value);
          const rlsFiltered = this._applyRLSFilter(table, filtered);
          
          return {
            data: rlsFiltered,
            error: null,
            
            // Chainable methods
            maybeSingle: () => Promise.resolve({
              data: rlsFiltered[0] || null,
              error: null // No error if not found (unlike single())
            }),
            
            single: () => Promise.resolve({
              data: rlsFiltered[0] || null,
              error: rlsFiltered.length === 0 ? { message: 'No rows found' } : null
            }),
            
            then: (resolve) => {
              resolve({ data: rlsFiltered, error: null });
            }
          };
        },
        
        maybeSingle: () => {
          const rows = this.data[table] || [];
          const rlsFiltered = this._applyRLSFilter(table, rows);
          
          return Promise.resolve({
            data: rlsFiltered[0] || null,
            error: null // No error if not found
          });
        },
        
        single: () => {
          const rows = this.data[table] || [];
          const rlsFiltered = this._applyRLSFilter(table, rows);
          
          return Promise.resolve({
            data: rlsFiltered[0] || null,
            error: rlsFiltered.length === 0 ? { message: 'No rows found' } : null
          });
        },
        
        // Default select (all rows)
        then: (resolve) => {
          const rows = this.data[table] || [];
          const rlsFiltered = this._applyRLSFilter(table, rows);
          resolve({ data: rlsFiltered, error: null });
        }
      }),
      
      insert: (rows) => {
        const rowsArray = Array.isArray(rows) ? rows : [rows];
        const insertedRows = [];
        
        // Issue #894: Auto-create table if doesn't exist (flexible mock)
        if (!this.data[table]) {
          this.data[table] = [];
        }
        
        for (const row of rowsArray) {
          // Check RLS before insert
          const rlsError = this._checkRLSViolation(table, row);
          if (rlsError) {
            return Promise.resolve({
              data: null,
              error: rlsError
            });
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
        
        return {
          select: () => ({
            single: () => Promise.resolve({
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
          const matchingRows = rows.filter(r => r[column] === value);
          
          // Apply RLS filter
          const accessibleRows = this._applyRLSFilter(table, matchingRows);
          
          if (accessibleRows.length === 0) {
            // RLS blocked the update
            return Promise.resolve({
              data: null,
              error: {
                code: '42501',
                message: 'new row violates row-level security policy for table "' + table + '"'
              }
            });
          }
          
          // Update rows
          accessibleRows.forEach(row => {
            Object.assign(row, updates, {
              updated_at: new Date().toISOString()
            });
          });
          
          return Promise.resolve({
            data: accessibleRows,
            error: null
          });
        }
      }),
      
      delete: () => ({
        eq: (column, value) => {
          const rows = this.data[table] || [];
          const matchingRows = rows.filter(r => r[column] === value);
          
          // Apply RLS filter
          const accessibleRows = this._applyRLSFilter(table, matchingRows);
          
          if (accessibleRows.length === 0) {
            // RLS blocked the delete
            return Promise.resolve({
              data: null,
              error: {
                code: '42501',
                message: 'permission denied for table ' + table
              }
            });
          }
          
          // Delete rows
          this.data[table] = rows.filter(r => !accessibleRows.includes(r));
          
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
        // In real implementation, this would decode JWT
        // For mock, we just track that session was set
        return Promise.resolve({ data: { session: { access_token } }, error: null });
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
      tablesUsed: Object.keys(this.data).filter(table => this.data[table].length > 0),
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

