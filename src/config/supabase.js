const { createClient } = require('@supabase/supabase-js');
const { logger } = require('./../utils/logger'); // Issue #971: Added for console.log replacement

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Check if we're in mock mode - if variables are missing, create mock clients
const isSupabaseConfigured = supabaseUrl && supabaseServiceKey && supabaseAnonKey;

if (!isSupabaseConfigured) {
  logger.warn('🔄 Supabase environment variables not set - running in mock mode');
}

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

// Service client for admin operations (bypasses RLS)
const supabaseServiceClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : createMockClient();

// Anonymous client for auth operations
const supabaseAnonClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMockClient();

// Function to create authenticated client for specific user
const createUserClient = (accessToken) => {
  if (!isSupabaseConfigured) {
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
  // In mock mode or testing, return a valid mock user for any token
  if (
    !isSupabaseConfigured ||
    process.env.NODE_ENV === 'test' ||
    process.env.ENABLE_MOCK_MODE === 'true'
  ) {
    if (token && token !== '') {
      // Try to decode JWT to extract user data from payload (Issue #1022)
      let userId = null;
      let organizationId = null;
      let email = null;
      let isValidJWT = false;
      try {
        const jwt = require('jsonwebtoken');
        const secret = process.env.JWT_SECRET || 'test-secret-key';
        const decoded = jwt.verify(token, secret);
        userId = decoded.id;
        organizationId = decoded.organizationId;
        email = decoded.email;
        isValidJWT = true;
      } catch (err) {
        // JWT verification failed - will check if it's a known mock token below
      }

      // Different tokens return different mock users for testing
      const mockUsers = {
        'mock-jwt-token': {
          id: userId || 'mock-user-123',
          email: email || 'test@example.com',
          organizationId: organizationId || 'mock-org-123',
          user_metadata: { full_name: 'Test User' },
          app_metadata: { role: 'user' },
          created_at: new Date().toISOString()
        },
        'mock-creator-jwt-token': {
          id: userId || 'mock-creator-user-456',
          email: email || 'creator@example.com',
          organizationId: organizationId || 'mock-org-456',
          user_metadata: { full_name: 'Creator User' },
          app_metadata: { role: 'user' },
          created_at: new Date().toISOString()
        },
        'mock-admin-token': {
          id: userId || 'mock-admin-789',
          email: email || 'admin@example.com',
          organizationId: organizationId || 'mock-org-789',
          user_metadata: { full_name: 'Admin User' },
          app_metadata: { role: 'admin' },
          created_at: new Date().toISOString()
        }
      };

      // Return specific user if known token
      if (mockUsers[token]) {
        return mockUsers[token];
      }

      // If JWT was valid, return user with decoded data
      if (isValidJWT && userId && organizationId) {
        return {
          id: userId,
          email: email || 'test@example.com',
          organizationId: organizationId,
          user_metadata: { full_name: 'Test User' },
          app_metadata: { role: 'user' },
          created_at: new Date().toISOString()
        };
      }

      // Invalid token (JWT verification failed and not a known mock token)
      return null;
    }
    return null;
  }

  try {
    const {
      data: { user },
      error
    } = await supabaseAnonClient.auth.getUser(token);

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
  if (!isSupabaseConfigured) {
    return { connected: false, error: 'Mock mode - Supabase not configured' };
  }

  try {
    const { data, error } = await supabaseServiceClient.from('users').select('id').limit(1);

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
  supabaseServiceClient,
  supabaseAnonClient,
  createUserClient,
  getUserFromToken,
  checkConnection
};
