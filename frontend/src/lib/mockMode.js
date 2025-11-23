/**
 * Frontend Mock Mode System
 * Provides comprehensive mocking for all external APIs and services
 */

/**
 * Check if Supabase environment variables are configured with real values
 */
const isSupabaseConfigured = () => {
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

  return !!(
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('mock') &&
    !supabaseUrl.includes('dummy') &&
    !supabaseAnonKey.includes('mock') &&
    !supabaseAnonKey.includes('dummy')
  );
};

/**
 * Check if mock mode should be enabled
 * Priority:
 * 1. If NODE_ENV is test -> force mock mode
 * 2. If REACT_APP_ENABLE_MOCK_MODE is explicitly set -> respect it
 * 3. If Supabase variables are missing/mock -> force mock mode
 * 4. Default to false when everything is configured
 */
const isMockModeEnabled = () => {
  // Force mock mode in test environment
  if (process.env.NODE_ENV === 'test') {
    return true;
  }

  // Check explicit mock mode flag
  if (process.env.REACT_APP_ENABLE_MOCK_MODE === 'true') {
    return true;
  }

  // If Supabase is not configured with real values, force mock mode
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '🔄 Supabase environment variables not found or contain mock values - enabling mock mode automatically'
      );
    }
    return true;
  }

  return false;
};

/**
 * Get mock mode status with detailed info
 */
const getMockModeStatus = () => {
  const supabaseConfigured = isSupabaseConfigured();
  const isTestEnv = process.env.NODE_ENV === 'test';
  const mockModeForced = !supabaseConfigured || isTestEnv;
  const mockModeExplicit = process.env.REACT_APP_ENABLE_MOCK_MODE === 'true';
  const mockModeEnabled = isMockModeEnabled();

  return {
    enabled: mockModeEnabled,
    supabaseConfigured,
    mockModeForced,
    mockModeExplicit,
    reason: isTestEnv
      ? 'Forced in test environment'
      : !supabaseConfigured
        ? 'Missing Supabase environment variables'
        : mockModeExplicit
          ? 'Explicitly enabled via REACT_APP_ENABLE_MOCK_MODE'
          : 'Disabled - using real Supabase client'
  };
};

/**
 * Log mock mode status for debugging
 */
const logMockModeStatus = () => {
  if (process.env.NODE_ENV === 'development') {
    const status = getMockModeStatus();
    console.log('🎭 Mock Mode Status:', status);
  }
};

/**
 * Create mock fetch implementation
 */
const createMockFetch = () => {
  return async (url, options = {}) => {
    console.log(`🎭 Frontend Mock Fetch: ${url}`);

    await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate network delay

    // Mock different API endpoints
    if (url.includes('/api/health')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ok',
          timestamp: new Date().toISOString(),
          services: {
            database: 'mock',
            queue: 'mock',
            ai: 'mock'
          },
          flags: {
            rqc: false,
            shield: false,
            mockMode: true
          }
        })
      };
    }

    if (url.includes('/api/logs')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          logs: [
            {
              id: '1',
              timestamp: new Date().toISOString(),
              level: 'info',
              message: 'Mock log entry - system started',
              source: 'system'
            },
            {
              id: '2',
              timestamp: new Date(Date.now() - 60000).toISOString(),
              level: 'warn',
              message: 'Mock warning - rate limit approaching',
              source: 'api'
            }
          ],
          total: 2,
          hasMore: false
        })
      };
    }

    // Mock Supabase auth endpoints
    if (url.includes('supabase') && url.includes('auth')) {
      if (options.method === 'POST' && url.includes('signup')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            user: {
              id: 'mock-user-123',
              email: 'test@example.com',
              created_at: new Date().toISOString()
            },
            session: {
              access_token: 'mock-access-token',
              refresh_token: 'mock-refresh-token'
            }
          })
        };
      }
    }

    // Default successful mock response
    return {
      ok: true,
      status: 200,
      json: async () => ({
        mock: true,
        message: 'Mock API response',
        data: []
      }),
      text: async () => 'Mock response text'
    };
  };
};

/**
 * Create mock Supabase client
 */
const createMockSupabaseClient = () => {
  return {
    auth: {
      signUp: async ({ email, password }) => ({
        data: {
          user: {
            id: 'mock-user-123',
            email,
            created_at: new Date().toISOString()
          },
          session: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token'
          }
        },
        error: null
      }),

      signInWithPassword: async ({ email, password }) => ({
        data: {
          user: {
            id: 'mock-user-123',
            email,
            last_sign_in_at: new Date().toISOString()
          },
          session: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token'
          }
        },
        error: null
      }),

      signOut: async () => ({
        error: null
      }),

      getUser: async () => ({
        data: {
          user: {
            id: 'mock-user-123',
            email: 'test@example.com',
            created_at: new Date().toISOString()
          }
        },
        error: null
      }),

      onAuthStateChange: (callback) => {
        // Simulate initial auth state
        setTimeout(() => {
          callback('SIGNED_IN', {
            id: 'mock-user-123',
            email: 'test@example.com',
            created_at: new Date().toISOString()
          });
        }, 100);

        return {
          data: {
            subscription: {
              unsubscribe: () => console.log('🎭 Mock auth listener unsubscribed')
            }
          }
        };
      }
    },

    from: (table) => ({
      select: (columns = '*') => ({
        eq: (column, value) =>
          Promise.resolve({
            data: [
              {
                id: 1,
                [column]: value,
                name: `Mock ${table} entry`,
                created_at: new Date().toISOString()
              }
            ],
            error: null
          })
      }),

      insert: (data) =>
        Promise.resolve({
          data: [
            {
              id: Math.random(),
              ...data,
              created_at: new Date().toISOString()
            }
          ],
          error: null
        })
    })
  };
};

/**
 * Setup global mocks for test environment
 */
const setupGlobalMocks = () => {
  if (isMockModeEnabled()) {
    // Mock fetch globally
    if (typeof global !== 'undefined') {
      global.fetch = createMockFetch();
    }
    if (typeof window !== 'undefined') {
      window.fetch = createMockFetch();
    }
  }
};

export {
  isMockModeEnabled,
  isSupabaseConfigured,
  getMockModeStatus,
  logMockModeStatus,
  createMockFetch,
  createMockSupabaseClient,
  setupGlobalMocks
};
