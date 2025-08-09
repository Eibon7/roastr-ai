// mock-mode adjustment: Test feature flags functionality 
describe('Feature Flags Configuration', () => {
  // Store original env vars
  const originalEnv = process.env;

  afterAll(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('Flag loading from environment variables', () => {
    test('loads ENABLE_RQC flag from environment', () => {
      const testEnv = { ...originalEnv, ENABLE_RQC: 'true' };
      
      // Temporarily replace process.env
      process.env = testEnv;
      
      // Clear module cache and require fresh
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      const testFlags = new FeatureFlags();
      
      expect(testFlags.isEnabled('ENABLE_RQC')).toBe(true);
      
      // Restore
      process.env = originalEnv;
    });

    test('ENABLE_RQC defaults to false when not set', () => {
      const testEnv = { ...originalEnv };
      delete testEnv.ENABLE_RQC;
      
      process.env = testEnv;
      
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      const testFlags = new FeatureFlags();
      
      expect(testFlags.isEnabled('ENABLE_RQC')).toBe(false);
      
      process.env = originalEnv;
    });

    test('loads VERBOSE_LOGS flag from environment', () => {
      const testEnv = { ...originalEnv, VERBOSE_LOGS: 'true' };
      
      process.env = testEnv;
      
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      const testFlags = new FeatureFlags();
      
      expect(testFlags.isEnabled('VERBOSE_LOGS')).toBe(true);
      
      process.env = originalEnv;
    });

    test('VERBOSE_LOGS defaults to false when not set', () => {
      const testEnv = { ...originalEnv };
      delete testEnv.VERBOSE_LOGS;
      
      process.env = testEnv;
      
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      const testFlags = new FeatureFlags();
      
      expect(testFlags.isEnabled('VERBOSE_LOGS')).toBe(false);
      
      process.env = originalEnv;
    });

    test('loads MOCK_MODE flag from environment', () => {
      const testEnv = { ...originalEnv, MOCK_MODE: 'true' };
      
      process.env = testEnv;
      
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      const testFlags = new FeatureFlags();
      
      expect(testFlags.isEnabled('MOCK_MODE')).toBe(true);
      
      process.env = originalEnv;
    });
  });

  describe('mock mode detection', () => {
    test('detects missing API keys for mock mode', () => {
      const testEnv = { ...originalEnv, MOCK_MODE: 'auto' };
      delete testEnv.OPENAI_API_KEY;
      delete testEnv.SUPABASE_URL;
      delete testEnv.STRIPE_SECRET_KEY;
      
      process.env = testEnv;
      
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      const testFlags = new FeatureFlags();
      
      expect(testFlags.isEnabled('MOCK_MODE')).toBe(true);
      
      process.env = originalEnv;
    });

    test('uses real mode when all critical API keys are present', () => {
      const testEnv = { 
        ...originalEnv, 
        MOCK_MODE: 'auto',
        OPENAI_API_KEY: 'test-key',
        SUPABASE_URL: 'https://test.supabase.co',
        STRIPE_SECRET_KEY: 'test-stripe-key'
      };
      
      process.env = testEnv;
      
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      const testFlags = new FeatureFlags();
      
      expect(testFlags.isEnabled('MOCK_MODE')).toBe(false);
      
      process.env = originalEnv;
    });

    test('detects partial API keys and uses mock mode', () => {
      const testEnv = { 
        ...originalEnv, 
        MOCK_MODE: 'auto',
        OPENAI_API_KEY: 'test-key'
      };
      delete testEnv.SUPABASE_URL;
      delete testEnv.STRIPE_SECRET_KEY;
      
      process.env = testEnv;
      
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      const testFlags = new FeatureFlags();
      
      expect(testFlags.isEnabled('MOCK_MODE')).toBe(true);
      
      process.env = originalEnv;
    });

    test('respects explicit MOCK_MODE=true', () => {
      const testEnv = { 
        ...originalEnv, 
        MOCK_MODE: 'true',
        OPENAI_API_KEY: 'test-key',
        SUPABASE_URL: 'https://test.supabase.co',
        STRIPE_SECRET_KEY: 'test-stripe-key'
      };
      
      process.env = testEnv;
      
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      const testFlags = new FeatureFlags();
      
      expect(testFlags.isEnabled('MOCK_MODE')).toBe(true);
      
      process.env = originalEnv;
    });
  });

  describe('API integrations detection', () => {
    test('detects OpenAI availability', () => {
      const testEnv = { ...originalEnv, OPENAI_API_KEY: 'test-key' };
      
      process.env = testEnv;
      
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      const testFlags = new FeatureFlags();
      
      expect(testFlags.isEnabled('ENABLE_REAL_OPENAI')).toBe(true);
      
      process.env = originalEnv;
    });

    test('detects missing OpenAI key', () => {
      const testEnv = { ...originalEnv };
      delete testEnv.OPENAI_API_KEY;
      
      process.env = testEnv;
      
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      const testFlags = new FeatureFlags();
      
      expect(testFlags.isEnabled('ENABLE_REAL_OPENAI')).toBe(false);
      
      process.env = originalEnv;
    });

    test('detects Supabase availability', () => {
      const testEnv = { 
        ...originalEnv, 
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_KEY: 'test-service-key'
      };
      
      process.env = testEnv;
      
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      const testFlags = new FeatureFlags();
      
      expect(testFlags.isEnabled('ENABLE_SUPABASE')).toBe(true);
      
      process.env = originalEnv;
    });

    test('detects Twitter API keys', () => {
      const testEnv = { 
        ...originalEnv, 
        TWITTER_BEARER_TOKEN: 'test-bearer',
        TWITTER_APP_KEY: 'test-key',
        TWITTER_APP_SECRET: 'test-secret'
      };
      
      process.env = testEnv;
      
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      const testFlags = new FeatureFlags();
      
      expect(testFlags.isEnabled('ENABLE_REAL_TWITTER')).toBe(true);
      
      process.env = originalEnv;
    });
  });

  describe('Boolean parsing and flag methods', () => {
    test('parses "true" string as boolean true', () => {
      const testEnv = { ...originalEnv, ENABLE_RQC: 'true' };
      
      process.env = testEnv;
      
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      const testFlags = new FeatureFlags();
      
      expect(testFlags.isEnabled('ENABLE_RQC')).toBe(true);
      
      process.env = originalEnv;
    });

    test('treats non-true strings as false', () => {
      const testEnv = { ...originalEnv, ENABLE_RQC: 'false' };
      
      process.env = testEnv;
      
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      const testFlags = new FeatureFlags();
      
      expect(testFlags.isEnabled('ENABLE_RQC')).toBe(false);
      
      process.env = originalEnv;
    });

    test('treats undefined as false', () => {
      const testEnv = { ...originalEnv };
      delete testEnv.ENABLE_RQC;
      
      process.env = testEnv;
      
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      const testFlags = new FeatureFlags();
      
      expect(testFlags.isEnabled('ENABLE_RQC')).toBe(false);
      
      process.env = originalEnv;
    });

    test('getAllFlags returns all flag status', () => {
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      const testFlags = new FeatureFlags();
      const allFlags = testFlags.getAllFlags();
      
      expect(typeof allFlags).toBe('object');
      expect(allFlags).toHaveProperty('ENABLE_RQC');
      expect(Object.keys(allFlags).length).toBeGreaterThan(0);
    });
  });

  describe('Flag object structure', () => {
    test('exports flags instance with expected methods', () => {
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      
      expect(FeatureFlags).toBeDefined();
      expect(typeof FeatureFlags).toBe('function');
      
      const testInstance = new FeatureFlags();
      expect(typeof testInstance.isEnabled).toBe('function');
      expect(typeof testInstance.getAllFlags).toBe('function');
      expect(typeof testInstance.getServiceStatus).toBe('function');
    });

    test('isEnabled method works correctly', () => {
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      const testFlags = new FeatureFlags();
      
      expect(typeof testFlags.isEnabled('ENABLE_RQC')).toBe('boolean');
      expect(typeof testFlags.isEnabled('VERBOSE_LOGS')).toBe('boolean');
      expect(typeof testFlags.isEnabled('MOCK_MODE')).toBe('boolean');
      expect(testFlags.isEnabled('NONEXISTENT_FLAG')).toBe(false);
    });

    test('basic flag functionality works', () => {
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      const testFlags = new FeatureFlags();
      
      expect(typeof testFlags.isEnabled('ENABLE_RQC')).toBe('boolean');
      expect(typeof testFlags.getAllFlags()).toBe('object');
      expect(typeof testFlags.getServiceStatus()).toBe('object');
    });
  });

  describe('Environment scenarios', () => {
    test('development environment enables debug logs', () => {
      const testEnv = { ...originalEnv, NODE_ENV: 'development' };
      
      process.env = testEnv;
      
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      const testFlags = new FeatureFlags();
      
      expect(testFlags.isEnabled('ENABLE_DEBUG_LOGS')).toBe(true);
      
      process.env = originalEnv;
    });

    test('production environment with minimal flags', () => {
      const testEnv = { ...originalEnv, NODE_ENV: 'production' };
      delete testEnv.DEBUG;
      delete testEnv.VERBOSE_LOGS;
      
      process.env = testEnv;
      
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      const testFlags = new FeatureFlags();
      
      expect(testFlags.isEnabled('ENABLE_DEBUG_LOGS')).toBe(false);
      expect(testFlags.isEnabled('VERBOSE_LOGS')).toBe(false);
      
      process.env = originalEnv;
    });

    test('test environment behavior', () => {
      const testEnv = { ...originalEnv, NODE_ENV: 'test' };
      
      process.env = testEnv;
      
      delete require.cache[require.resolve('../../../../src/config/flags')];
      const { FeatureFlags } = require('../../../../src/config/flags');
      const testFlags = new FeatureFlags();
      
      expect(typeof testFlags.isEnabled('MOCK_MODE')).toBe('boolean');
      expect(typeof testFlags.isEnabled('ENABLE_RQC')).toBe('boolean');
      
      process.env = originalEnv;
    });
  });
});