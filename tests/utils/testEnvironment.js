/**
 * Test Environment Utilities
 * 
 * Common helpers for mocking environment variables and setting up test environments
 * across different test suites.
 */

class TestEnvironment {
  constructor() {
    this.originalEnv = process.env;
  }

  /**
   * Set up a clean environment for testing
   */
  setup() {
    jest.resetModules();
    process.env = { ...this.originalEnv };
  }

  /**
   * Restore original environment
   */
  teardown() {
    process.env = this.originalEnv;
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
    keys.forEach(key => {
      delete process.env[key];
    });
  }

  /**
   * Get standard mock mode environment
   */
  getMockModeEnv() {
    return {
      ENABLE_MOCK_MODE: 'true',
      NODE_ENV: 'test',
      ENABLE_RQC: 'false',
      ENABLE_SHIELD: 'false',
      ENABLE_BILLING: 'false',
      OPENAI_API_KEY: 'mock-openai-key-sk-test123456789',
      SUPABASE_URL: 'http://localhost:54321/mock',
      SUPABASE_SERVICE_KEY: 'mock-service-key-for-testing',
      SUPABASE_ANON_KEY: 'mock-anon-key-for-testing'
    };
  }

  /**
   * Get standard production-like environment (but safe for testing)
   */
  getProdLikeEnv() {
    return {
      NODE_ENV: 'production',
      ENABLE_RQC: 'true',
      ENABLE_SHIELD: 'true',
      ENABLE_BILLING: 'true',
      ENABLE_MOCK_MODE: 'false'
    };
  }

  /**
   * Get test environment with all features enabled
   */
  getFullFeaturesEnv() {
    return {
      NODE_ENV: 'test',
      ENABLE_RQC: 'true',
      ENABLE_SHIELD: 'true',
      ENABLE_BILLING: 'true',
      ENABLE_MOCK_MODE: 'false',
      ENABLE_STYLE_PROFILE: 'true',
      ENABLE_SUPABASE: 'true'
    };
  }

  /**
   * Get minimal test environment
   */
  getMinimalEnv() {
    return {
      NODE_ENV: 'test'
    };
  }
}

/**
 * Common environment variable presets for different test scenarios
 */
const ENV_PRESETS = {
  MOCK: {
    ENABLE_MOCK_MODE: 'true',
    NODE_ENV: 'test',
    ENABLE_RQC: 'false',
    ENABLE_SHIELD: 'false'
  },
  
  PRODUCTION_LIKE: {
    NODE_ENV: 'production',
    ENABLE_RQC: 'true',
    ENABLE_SHIELD: 'true',
    ENABLE_BILLING: 'true'
  },
  
  DEVELOPMENT: {
    NODE_ENV: 'development',
    ENABLE_RQC: 'true',
    ENABLE_SHIELD: 'false',
    ENABLE_BILLING: 'false'
  },
  
  TEST_FULL: {
    NODE_ENV: 'test',
    ENABLE_RQC: 'true',
    ENABLE_SHIELD: 'true',
    ENABLE_BILLING: 'true',
    ENABLE_STYLE_PROFILE: 'true'
  }
};

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
    STRIPE_SECRET_KEY: 'sk_test_mock123456789',
    STRIPE_WEBHOOK_SECRET: 'whsec_mock123456789',
    STRIPE_SUCCESS_URL: 'http://localhost:3000/success',
    STRIPE_CANCEL_URL: 'http://localhost:3000/cancel'
  }
};

module.exports = {
  TestEnvironment,
  ENV_PRESETS,
  setupHelpers,
  mockDbConfigs,
  mockApiConfigs
};