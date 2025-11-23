/**
 * Test Environment Utilities
 *
 * Comprehensive test environment management for multi-tenant, mockMode, and worker testing.
 * Combines simple helpers with advanced configuration for consistent testing across the system.
 */

const { createMockSupabaseResponse } = require('./mocks');

/**
 * Environment presets for different test scenarios
 */
const ENV_PRESETS = {
  MOCK: {
    ENABLE_MOCK_MODE: 'true',
    NODE_ENV: 'test',
    ENABLE_RQC: 'false',
    ENABLE_SHIELD: 'false',
    ENABLE_BILLING: 'false',
    OPENAI_API_KEY: 'mock-openai-key-sk-test123456789',
    SUPABASE_URL: 'http://localhost:54321/mock',
    SUPABASE_SERVICE_KEY: 'mock-service-key-for-testing',
    SUPABASE_ANON_KEY: 'mock-anon-key-for-testing'
  },

  PRODUCTION_LIKE: {
    NODE_ENV: 'test',
    ENABLE_MOCK_MODE: 'false',
    ENABLE_RQC: 'true',
    ENABLE_SHIELD: 'true',
    ENABLE_BILLING: 'true',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-service-key',
    SUPABASE_ANON_KEY: 'test-anon-key',
    OPENAI_API_KEY: 'sk-test-openai-key',
    STRIPE_SECRET_KEY: process.env.TEST_STRIPE_SECRET_KEY || 'sk_test_stripe',
    PERSPECTIVE_API_KEY: 'test-perspective-key'
  },

  DEVELOPMENT: {
    NODE_ENV: 'development',
    ENABLE_MOCK_MODE: 'false',
    ENABLE_RQC: 'true',
    ENABLE_SHIELD: 'false',
    ENABLE_BILLING: 'false',
    DEBUG: 'true'
  },

  TEST_FULL: {
    NODE_ENV: 'test',
    ENABLE_MOCK_MODE: 'true',
    ENABLE_RQC: 'true',
    ENABLE_SHIELD: 'true',
    ENABLE_BILLING: 'true',
    ENABLE_STYLE_PROFILE: 'true',
    ENABLE_SUPABASE: 'true',
    SUPABASE_URL: 'http://localhost:54321/mock',
    SUPABASE_SERVICE_KEY: 'mock-service-key',
    SUPABASE_ANON_KEY: 'mock-anon-key',
    OPENAI_API_KEY: 'mock-openai-key-sk-test123456789',
    STRIPE_SECRET_KEY: process.env.TEST_STRIPE_SECRET_KEY || 'sk_test_mock',
    STRIPE_WEBHOOK_SECRET: process.env.TEST_STRIPE_WEBHOOK_SECRET || 'whsec_mock',
    PERSPECTIVE_API_KEY: 'mock-perspective-key'
  }
};

/**
 * Mock configurations for external services
 */
const MOCK_CONFIGURATIONS = {
  supabase: {
    createClient: jest.fn(),
    from: jest.fn(),
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
    eq: jest.fn(),
    single: jest.fn(),
    limit: jest.fn()
  },

  stripe: {
    customers: { create: jest.fn(), retrieve: jest.fn() },
    prices: { list: jest.fn() },
    checkout: { sessions: { create: jest.fn() } },
    billingPortal: { sessions: { create: jest.fn() } },
    subscriptions: { retrieve: jest.fn() },
    webhooks: { constructEvent: jest.fn() }
  },

  openai: {
    chat: { completions: { create: jest.fn() } },
    moderations: { create: jest.fn() }
  },

  perspective: {
    analyzeComment: jest.fn()
  },

  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    pipeline: jest.fn(() => ({
      exec: jest.fn()
    })),
    disconnect: jest.fn()
  }
};

/**
 * Mock database configurations for testing
 */
const mockDbConfigs = {
  supabase: {
    SUPABASE_URL: 'http://localhost:54321/mock',
    SUPABASE_SERVICE_KEY: 'mock-service-key-for-testing',
    SUPABASE_ANON_KEY: 'mock-anon-key-for-testing'
  },

  redis: {
    UPSTASH_REDIS_REST_URL: 'http://localhost:6379/mock',
    UPSTASH_REDIS_REST_TOKEN: 'mock-redis-token',
    REDIS_URL: 'redis://localhost:6379/mock'
  }
};

/**
 * Mock API configurations for testing
 */
const mockApiConfigs = {
  openai: {
    OPENAI_API_KEY: 'sk-mock-openai-key-for-testing'
  },

  perspective: {
    PERSPECTIVE_API_KEY: 'mock-perspective-api-key'
  },

  stripe: {
    STRIPE_SECRET_KEY: process.env.TEST_STRIPE_SECRET_KEY || 'sk_test_mock123456789',
    STRIPE_WEBHOOK_SECRET: process.env.TEST_STRIPE_WEBHOOK_SECRET || 'whsec_mock123456789',
    STRIPE_SUCCESS_URL: 'http://localhost:3000/success',
    STRIPE_CANCEL_URL: 'http://localhost:3000/cancel'
  }
};

/**
 * TestEnvironment class for managing test setup and teardown
 * Supports both simple and advanced test environment configuration
 */
class TestEnvironment {
  constructor(preset = 'MOCK') {
    this.originalEnv = process.env;
    this.preset = preset;
    this.mocks = new Map();
    this.cleanupTasks = [];
  }

  /**
   * Set up a clean environment for testing
   * @param {Object} customEnv - Custom environment variables to apply
   */
  setup(customEnv = {}) {
    // Store original environment
    this.originalEnv = { ...process.env };

    // Reset Jest modules for clean state
    jest.resetModules();

    // Apply preset environment variables
    const envConfig = { ...ENV_PRESETS[this.preset], ...customEnv };
    Object.entries(envConfig).forEach(([key, value]) => {
      process.env[key] = value;
    });

    // Setup console mocks to reduce test output noise
    this.setupConsoleMocks();

    // Setup common Jest mocks
    this.setupJestMocks();

    return this;
  }

  /**
   * Restore original environment
   */
  teardown() {
    // Restore original environment
    process.env = this.originalEnv;

    // Clear all mocks
    jest.clearAllMocks();

    // Run cleanup tasks
    this.cleanupTasks.forEach((task) => {
      try {
        task();
      } catch (error) {
        console.warn('Cleanup task failed:', error.message);
      }
    });
    this.cleanupTasks = [];

    // Restore console
    this.restoreConsole();

    return this;
  }

  /**
   * Set multiple environment variables at once
   * @param {Object} envVars - Key-value pairs of environment variables
   */
  setEnvVars(envVars) {
    Object.entries(envVars).forEach(([key, value]) => {
      process.env[key] = value;
    });
  }

  /**
   * Clear specific environment variables
   * @param {string[]} keys - Array of environment variable keys to delete
   */
  clearEnvVars(keys) {
    keys.forEach((key) => {
      delete process.env[key];
    });
  }

  /**
   * Get standard mock mode environment
   */
  getMockModeEnv() {
    return ENV_PRESETS.MOCK;
  }

  /**
   * Get standard production-like environment (but safe for testing)
   */
  getProdLikeEnv() {
    return ENV_PRESETS.PRODUCTION_LIKE;
  }

  /**
   * Get test environment with all features enabled
   */
  getFullFeaturesEnv() {
    return ENV_PRESETS.TEST_FULL;
  }

  /**
   * Get minimal test environment
   */
  getMinimalEnv() {
    return {
      NODE_ENV: 'test'
    };
  }

  /**
   * Setup console mocks to reduce noise in test output
   */
  setupConsoleMocks() {
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info
    };

    // Mock console methods but allow errors to show for debugging
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    // Keep console.error for debugging purposes but can be mocked if needed
  }

  /**
   * Restore original console methods
   */
  restoreConsole() {
    if (this.originalConsole) {
      Object.entries(this.originalConsole).forEach(([method, original]) => {
        console[method] = original;
      });
    }
  }

  /**
   * Setup common Jest mocks for external dependencies
   */
  setupJestMocks() {
    // Mock Supabase
    const mockSupabaseClient = this.createMockSupabaseClient();
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: jest.fn(() => mockSupabaseClient)
    }));

    // Mock Stripe
    jest.doMock('stripe', () => jest.fn(() => MOCK_CONFIGURATIONS.stripe));

    // Mock OpenAI
    jest.doMock('openai', () => ({
      OpenAI: jest.fn(() => MOCK_CONFIGURATIONS.openai)
    }));

    // Mock Redis
    jest.doMock('redis', () => ({
      createClient: jest.fn(() => MOCK_CONFIGURATIONS.redis)
    }));

    // Mock platform APIs
    this.setupPlatformMocks();
  }

  /**
   * Create mock Supabase client with realistic responses
   */
  createMockSupabaseClient() {
    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue(createMockSupabaseResponse()),
          limit: jest.fn().mockResolvedValue(createMockSupabaseResponse([]))
        }),
        limit: jest.fn().mockResolvedValue(createMockSupabaseResponse([]))
      }),
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue(createMockSupabaseResponse())
        })
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(createMockSupabaseResponse())
          })
        })
      }),
      upsert: jest.fn().mockResolvedValue(createMockSupabaseResponse()),
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue(createMockSupabaseResponse())
      })
    });

    return {
      from: mockFrom,
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user', email: 'test@example.com' } },
          error: null
        })
      }
    };
  }

  /**
   * Setup platform-specific API mocks
   */
  setupPlatformMocks() {
    // Mock Twitter API
    jest.doMock('twitter-api-v2', () => ({
      TwitterApi: jest.fn().mockImplementation(() => ({
        v2: {
          userMentionTimeline: jest.fn().mockResolvedValue({
            data: { data: [] },
            includes: { users: [] }
          }),
          search: jest.fn().mockResolvedValue({ data: { data: [] } })
        }
      }))
    }));

    // Mock YouTube API
    jest.doMock('googleapis', () => ({
      google: {
        youtube: jest.fn(() => ({
          commentThreads: {
            list: jest.fn().mockResolvedValue({ data: { items: [] } })
          }
        }))
      }
    }));

    // Mock Instagram API
    jest.doMock('instagram-basic-display', () => ({
      InstagramApi: jest.fn(() => ({
        getMedia: jest.fn().mockResolvedValue({ data: [] })
      }))
    }));
  }

  /**
   * Add a cleanup task to run during teardown
   */
  addCleanupTask(task) {
    if (typeof task === 'function') {
      this.cleanupTasks.push(task);
    }
  }

  /**
   * Get mock for a specific service
   */
  getMock(serviceName) {
    return this.mocks.get(serviceName) || MOCK_CONFIGURATIONS[serviceName];
  }

  /**
   * Set custom mock for a service
   */
  setMock(serviceName, mockImplementation) {
    this.mocks.set(serviceName, mockImplementation);
  }

  /**
   * Create isolated test database transaction (for integration tests)
   */
  async createTestTransaction() {
    // This would be used for integration tests with real database
    // For now, returns mock transaction
    return {
      rollback: jest.fn(),
      commit: jest.fn(),
      query: jest.fn()
    };
  }

  /**
   * Wait for async operations to complete
   */
  async waitForAsyncOps(timeout = 1000) {
    return new Promise((resolve) => setTimeout(resolve, timeout));
  }

  /**
   * Utility to create test-specific environment variables
   */
  static createTestEnv(customVars = {}) {
    return {
      ...ENV_PRESETS.MOCK,
      ...customVars
    };
  }

  /**
   * Utility to validate environment setup
   */
  validateEnvironment() {
    const requiredVars = ['NODE_ENV', 'ENABLE_MOCK_MODE'];
    const missing = requiredVars.filter((varName) => !process.env[varName]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    return true;
  }

  /**
   * Create database seed data for tests
   */
  createSeedData() {
    return {
      organizations: [
        {
          id: 'org-test-123',
          name: 'Test Organization',
          plan: 'pro',
          created_at: new Date().toISOString()
        }
      ],
      users: [
        {
          id: 'user-test-123',
          email: 'test@example.com',
          organization_id: 'org-test-123',
          created_at: new Date().toISOString()
        }
      ],
      integration_configs: [
        {
          id: 'config-test-123',
          organization_id: 'org-test-123',
          platform: 'twitter',
          enabled: true,
          config: { monitored_accounts: ['@testaccount'] }
        }
      ]
    };
  }
}

/**
 * Jest setup helpers for common patterns
 */
const setupHelpers = {
  /**
   * Standard beforeEach/afterEach for environment isolation
   */
  withCleanEnv: () => {
    const testEnv = new TestEnvironment();

    beforeEach(() => {
      testEnv.setup();
    });

    afterEach(() => {
      testEnv.teardown();
    });

    return testEnv;
  },

  /**
   * Set up mock mode for a test suite
   */
  withMockMode: () => {
    const testEnv = setupHelpers.withCleanEnv();

    beforeEach(() => {
      testEnv.setEnvVars(ENV_PRESETS.MOCK);
    });

    return testEnv;
  },

  /**
   * Set up production-like environment for testing
   */
  withProdLike: () => {
    const testEnv = setupHelpers.withCleanEnv();

    beforeEach(() => {
      testEnv.setEnvVars(ENV_PRESETS.PRODUCTION_LIKE);
    });

    return testEnv;
  }
};

/**
 * Helper function to quickly setup test environment
 */
const setupTestEnv = (preset = 'MOCK', customEnv = {}) => {
  const testEnv = new TestEnvironment(preset);
  return testEnv.setup(customEnv);
};

/**
 * Jest setup helper for beforeEach/afterEach
 */
const setupJestTestEnv = (preset = 'MOCK') => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv(preset);
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.teardown();
    }
  });

  return () => testEnv;
};

module.exports = {
  TestEnvironment,
  ENV_PRESETS,
  MOCK_CONFIGURATIONS,
  setupHelpers,
  mockDbConfigs,
  mockApiConfigs,
  setupTestEnv,
  setupJestTestEnv
};
