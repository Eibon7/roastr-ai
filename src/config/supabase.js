const { createClient } = require('@supabase/supabase-js');
const { logger } = require('./../utils/logger'); // Issue #971: Added for console.log replacement

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Create mock client for when Supabase is not configured
const createMockClient = () => ({
  auth: {
    getUser: async () => ({ data: { user: null }, error: new Error('Mock mode - no user') }),
    refreshSession: async ({ refresh_token }) => {
      // Issue #628: Mock session refresh for testing
      if (!refresh_token || refresh_token === 'invalid-token') {
        return {
          data: { session: null },
          error: new Error('Invalid refresh token')
        };
      }
      return {
        data: {
          session: {
            access_token: 'mock-refreshed-access-token',
            refresh_token: refresh_token,
            expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
            expires_in: 3600,
            user: {
              id: 'mock-user-123',
              email: 'test@example.com',
              user_metadata: { full_name: 'Test User' },
              app_metadata: { role: 'user' },
              created_at: new Date().toISOString()
            }
          }
        },
        error: null
      };
    }
  },
  from: (table) => {
    const createQueryBuilder = (tableName) => {
      return {
        select: (columns) => {
          const selectBuilder = {
            eq: (col, val) => {
              const eqBuilder = {
                eq: (col2, val2) => ({
                  single: () =>
                    Promise.resolve({
                      data: null,
                      error: { code: 'PGRST116', message: 'Mock mode - no data' }
                    })
                }),
                single: () => {
                  // Return mock user data for users table queries
                  if (tableName === 'users') {
                    return Promise.resolve({
                      data: {
                        id: val,
                        email: 'test@example.com',
                        name: 'Test User',
                        plan: 'starter_trial',
                        is_admin: false,
                        active: true,
                        created_at: new Date().toISOString()
                      },
                      error: null
                    });
                  }
                  // For other tables, return null (like account_deletion_requests)
                  return Promise.resolve({
                    data: null,
                    error: { code: 'PGRST116', message: 'Mock mode - no data' }
                  });
                },
                limit: (n) => Promise.resolve({ data: [], error: null })
              };
              return eqBuilder;
            },
            in: (col, values) => {
              // Mock implementation of .in() method for WHERE column IN (values)
              const baseResponse = { data: [], error: null };

              const inBuilder = {
                eq: (col2, val2) => ({
                  single: () =>
                    Promise.resolve({
                      data: null,
                      error: { code: 'PGRST116', message: 'Mock mode - no data' }
                    })
                }),
                single: () =>
                  Promise.resolve({
                    data: null,
                    error: { code: 'PGRST116', message: 'Mock mode - no data' }
                  }),
                limit: (n) => Promise.resolve({ data: [], error: null }),
                order: (col, opts) => ({
                  limit: (n) => ({
                    single: () =>
                      Promise.resolve({
                        data: null,
                        error: { code: 'PGRST116', message: 'Mock mode - no data' }
                      })
                  })
                }),
                // Make it thenable so it can be awaited directly (for kill switch service)
                then: (resolve, reject) => Promise.resolve(baseResponse).then(resolve, reject)
              };
              return inBuilder;
            },
            limit: (n) => Promise.resolve({ data: [], error: null }),
            single: () => {
              // Return mock user data for users table queries
              if (tableName === 'users') {
                return Promise.resolve({
                  data: {
                    id: 'test-user-id',
                    email: 'test@example.com',
                    name: 'Test User',
                    plan: 'starter_trial',
                    is_admin: false,
                    active: true,
                    created_at: new Date().toISOString()
                  },
                  error: null
                });
              }
              return Promise.resolve({
                data: null,
                error: { code: 'PGRST116', message: 'Mock mode - no data' }
              });
            },
            order: (col, opts) => ({
              limit: (n) => ({
                single: () =>
                  Promise.resolve({
                    data: null,
                    error: { code: 'PGRST116', message: 'Mock mode - no data' }
                  })
              })
            })
          };
          return selectBuilder;
        },
        insert: (data) => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: { id: 'mock-id', ...data, created_at: new Date().toISOString() },
                error: null
              })
          })
        }),
        update: (data) => ({
          eq: (col, val) => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: 'mock-id', ...data, updated_at: new Date().toISOString() },
                  error: null
                })
            })
          })
        }),
        delete: () => ({
          eq: (col, val) => Promise.resolve({ data: null, error: null })
        })
      };
    };
    return createQueryBuilder(table);
  }
});

/**
 * Issue #ROA-521: Lazy initialization to fix constructor timing issues
 * 
 * Previous issue: Clients were created at require-time, BEFORE test setup could
 * configure process.env.MOCK_MODE. This caused CI failures because:
 * 1. tests/setupIntegration.js runs to configure mocks
 * 2. src/config/supabase.js gets required
 * 3. Race condition: clients created before mock env vars are set
 * 4. Real clients fail with missing credentials in CI
 * 
 * Solution: Lazy initialization with getters ensures clients are created
 * AFTER test setup completes, respecting mock mode configuration.
 */

// Cached clients (lazy initialized)
let _supabaseServiceClient = null;
let _supabaseAnonClient = null;

// Lazy initialization for service client (bypasses RLS)
const getSupabaseServiceClient = () => {
  if (!_supabaseServiceClient) {
    // Re-check configuration at initialization time (not require-time)
    const configured = supabaseUrl && supabaseServiceKey && supabaseAnonKey;
    _supabaseServiceClient = configured
      ? createClient(supabaseUrl, supabaseServiceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        })
      : createMockClient();
  }
  return _supabaseServiceClient;
};

// Lazy initialization for anonymous client (auth operations)
const getSupabaseAnonClient = () => {
  if (!_supabaseAnonClient) {
    // Re-check configuration at initialization time (not require-time)
    const configured = supabaseUrl && supabaseServiceKey && supabaseAnonKey;
    _supabaseAnonClient = configured
      ? createClient(supabaseUrl, supabaseAnonKey)
      : createMockClient();
  }
  return _supabaseAnonClient;
};

// Function to create authenticated client for specific user
const createUserClient = (accessToken) => {
  // Check configuration at call time (not require-time)
  const configured = supabaseUrl && supabaseServiceKey && supabaseAnonKey;
  if (!configured) {
    return createMockClient();
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
};

// Helper to get user from JWT
const getUserFromToken = async (token) => {
  // Check configuration at call time (not require-time)
  const configured = supabaseUrl && supabaseServiceKey && supabaseAnonKey;
  
  // In mock mode or testing, return a valid mock user for any token
  if (
    !configured ||
    process.env.NODE_ENV === 'test' ||
    process.env.ENABLE_MOCK_MODE === 'true'
  ) {
    if (token && token !== '') {
      // Different tokens return different mock users for testing
      const mockUsers = {
        'mock-jwt-token': {
          id: 'mock-user-123',
          email: 'test@example.com',
          user_metadata: { full_name: 'Test User' },
          app_metadata: { role: 'user' },
          created_at: new Date().toISOString()
        },
        'mock-creator-jwt-token': {
          id: 'mock-creator-user-456',
          email: 'creator@example.com',
          user_metadata: { full_name: 'Creator User' },
          app_metadata: { role: 'user' },
          created_at: new Date().toISOString()
        },
        'mock-admin-token': {
          id: 'mock-admin-789',
          email: 'admin@example.com',
          user_metadata: { full_name: 'Admin User' },
          app_metadata: { role: 'admin' },
          created_at: new Date().toISOString()
        }
      };

      // Return specific user if known token, otherwise return default
      return (
        mockUsers[token] || {
          id: 'mock-user-' + token.substring(0, 8),
          email: 'test@example.com',
          user_metadata: { full_name: 'Test User' },
          app_metadata: { role: 'user' },
          created_at: new Date().toISOString()
        }
      );
    }
    return null;
  }

  try {
    const {
      data: { user },
      error
    } = await getSupabaseAnonClient().auth.getUser(token);

    if (error) {
      logger.warn('Failed to get user from token:', error.message);
      return null;
    }

    return user;
  } catch (error) {
    logger.error('Error getting user from token:', error.message);
    return null;
  }
};

// Health check function
const checkConnection = async () => {
  // Check configuration at call time (not require-time)
  const configured = supabaseUrl && supabaseServiceKey && supabaseAnonKey;
  if (!configured) {
    return { connected: false, error: 'Mock mode - Supabase not configured' };
  }

  try {
    const { data, error } = await getSupabaseServiceClient().from('users').select('id').limit(1);

    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }

    return { connected: true };
  } catch (error) {
    logger.error('Supabase connection check failed:', error.message);
    return { connected: false, error: error.message };
  }
};

module.exports = {
  // Export getters for lazy initialization (Issue #ROA-521)
  get supabaseServiceClient() {
    return getSupabaseServiceClient();
  },
  get supabaseAnonClient() {
    return getSupabaseAnonClient();
  },
  createUserClient,
  getUserFromToken,
  checkConnection
};
