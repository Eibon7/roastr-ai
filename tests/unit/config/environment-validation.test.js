/**
 * Environment Configuration Validation Tests - Issue #90
 */

const {
  environments,
  getCurrentEnvironment,
  validateCredentials,
  setupTestEnvironment,
  getMockCredentials,
  isRealApiEnabled,
  getWebhookConfig
} = require('../../../config/environments');

describe('Environment Configuration - Issue #90', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment Detection', () => {
    test('should detect test environment correctly', () => {
      process.env.NODE_ENV = 'test';
      const env = getCurrentEnvironment();
      
      expect(env.name).toBe('Test Environment');
      expect(env.features.realApiCalls).toBe(false);
      expect(env.credentials.mockDefaults).toBe(true);
    });

    test('should detect staging environment correctly', () => {
      process.env.NODE_ENV = 'staging';
      const env = getCurrentEnvironment();
      
      expect(env.name).toBe('Staging Environment');
      expect(env.features.realApiCalls).toBe(true);
      expect(env.credentials.required).toBe(true);
    });

    test('should default to development environment', () => {
      delete process.env.NODE_ENV;
      const env = getCurrentEnvironment();
      
      expect(env.name).toBe('Development Environment');
      expect(env.features.realApiCalls).toBe(false); // Default when REAL_API_TEST not set
    });

    test('should enable real API calls in development when REAL_API_TEST=true', () => {
      process.env.NODE_ENV = 'development';
      process.env.REAL_API_TEST = 'true';
      const env = getCurrentEnvironment();
      
      expect(env.features.realApiCalls).toBe(true);
      expect(env.credentials.required).toBe(true);
    });
  });

  describe('Credential Validation', () => {
    test('should validate staging environment requires all credentials', () => {
      process.env.NODE_ENV = 'staging';
      
      const validation = validateCredentials();
      
      expect(validation.valid).toBe(false);
      expect(validation.missing.length).toBeGreaterThan(0);
      expect(validation.missing).toContain('TWITTER: TWITTER_BEARER_TOKEN');
      expect(validation.missing).toContain('YOUTUBE: YOUTUBE_API_KEY');
    });

    test('should pass validation when all required credentials are present', () => {
      process.env.NODE_ENV = 'staging';
      process.env.TWITTER_BEARER_TOKEN = 'test_bearer';
      process.env.TWITTER_APP_KEY = 'test_key';
      process.env.TWITTER_APP_SECRET = 'test_secret';
      process.env.YOUTUBE_API_KEY = 'test_youtube_key';
      process.env.INSTAGRAM_ACCESS_TOKEN = 'test_instagram_token';
      process.env.FACEBOOK_ACCESS_TOKEN = 'test_facebook_token';
      
      const validation = validateCredentials();
      
      expect(validation.valid).toBe(true);
      expect(validation.missing.length).toBe(0);
    });

    test('should not require credentials in test environment', () => {
      process.env.NODE_ENV = 'test';
      
      const validation = validateCredentials();
      
      expect(validation.valid).toBe(true);
      expect(validation.missing.length).toBe(0);
      expect(validation.warnings).toContain('Environment does not require real credentials - using mocks');
    });

    test('should detect optional missing credentials as warnings', () => {
      process.env.NODE_ENV = 'staging';
      process.env.TWITTER_BEARER_TOKEN = 'test_bearer';
      process.env.TWITTER_APP_KEY = 'test_key';
      process.env.TWITTER_APP_SECRET = 'test_secret';
      process.env.YOUTUBE_API_KEY = 'test_youtube_key';
      process.env.INSTAGRAM_ACCESS_TOKEN = 'test_instagram_token';
      process.env.FACEBOOK_ACCESS_TOKEN = 'test_facebook_token';
      // Missing optional: TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET
      
      const validation = validateCredentials();
      
      expect(validation.valid).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings.some(w => w.includes('TWITTER_ACCESS_TOKEN'))).toBe(true);
    });
  });

  describe('Test Environment Setup', () => {
    test('should setup Twitter test configuration', () => {
      process.env.NODE_ENV = 'test';
      
      const config = setupTestEnvironment('twitter');
      
      expect(config.platform).toBe('twitter');
      expect(config.environment).toBe('Test Environment');
      expect(config.baseUrl).toBe('https://api.twitter.com');
      expect(config.features.realApiCalls).toBe(false);
      expect(config.credentials).toHaveProperty('bearerToken');
      expect(config.credentials.bearerToken).toMatch(/^mock_/);
    });

    test('should setup YouTube test configuration', () => {
      process.env.NODE_ENV = 'test';
      
      const config = setupTestEnvironment('youtube');
      
      expect(config.platform).toBe('youtube');
      expect(config.baseUrl).toBe('https://www.googleapis.com/youtube/v3');
      expect(config.credentials).toHaveProperty('apiKey');
      expect(config.credentials.apiKey).toMatch(/^mock_/);
    });

    test('should setup staging environment without mock credentials', () => {
      process.env.NODE_ENV = 'staging';
      
      const config = setupTestEnvironment('twitter');
      
      expect(config.platform).toBe('twitter');
      expect(config.environment).toBe('Staging Environment');
      expect(config.features.realApiCalls).toBe(true);
      expect(config.credentials).toBeUndefined(); // No mocks in staging
    });
  });

  describe('Mock Credentials Generation', () => {
    test('should generate valid Twitter mock credentials', () => {
      const creds = getMockCredentials('twitter');
      
      expect(creds).toHaveProperty('bearerToken');
      expect(creds).toHaveProperty('appKey');
      expect(creds).toHaveProperty('appSecret');
      expect(creds).toHaveProperty('accessToken');
      expect(creds).toHaveProperty('accessSecret');
      
      expect(creds.bearerToken).toMatch(/^mock_twitter_/);
      expect(typeof creds.appKey).toBe('string');
    });

    test('should generate valid YouTube mock credentials', () => {
      const creds = getMockCredentials('youtube');
      
      expect(creds).toHaveProperty('apiKey');
      expect(creds.apiKey).toMatch(/^mock_youtube_/);
    });

    test('should return empty object for unknown platform', () => {
      const creds = getMockCredentials('unknown_platform');
      
      expect(creds).toEqual({});
    });
  });

  describe('Real API Enablement Logic', () => {
    test('should disable real API calls in test environment', () => {
      process.env.NODE_ENV = 'test';
      
      expect(isRealApiEnabled()).toBe(false);
      expect(isRealApiEnabled('twitter')).toBe(false);
    });

    test('should enable real API calls in staging with proper credentials', () => {
      process.env.NODE_ENV = 'staging';
      process.env.TWITTER_BEARER_TOKEN = 'test_bearer';
      process.env.TWITTER_APP_KEY = 'test_key';
      process.env.TWITTER_APP_SECRET = 'test_secret';
      process.env.YOUTUBE_API_KEY = 'test_youtube_key';
      process.env.INSTAGRAM_ACCESS_TOKEN = 'test_instagram_token';
      process.env.FACEBOOK_ACCESS_TOKEN = 'test_facebook_token';
      
      expect(isRealApiEnabled()).toBe(true);
      expect(isRealApiEnabled('twitter')).toBe(true);
    });

    test('should disable real API calls when credentials missing', () => {
      process.env.NODE_ENV = 'staging';
      // Missing credentials
      
      expect(isRealApiEnabled('twitter')).toBe(false);
    });
  });

  describe('Webhook Configuration', () => {
    test('should provide webhook configuration for test environment', () => {
      process.env.NODE_ENV = 'test';
      
      const config = getWebhookConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.baseUrl).toBeDefined();
      expect(config.endpoints).toHaveProperty('twitter');
      expect(config.endpoints).toHaveProperty('youtube');
      expect(config.security.signatureValidation).toBe(true);
      expect(config.security.timeWindowSeconds).toBe(300);
    });

    test('should use custom webhook base URL when provided', () => {
      process.env.WEBHOOK_BASE_URL = 'https://custom-webhook-domain.com';
      
      const config = getWebhookConfig();
      
      expect(config.baseUrl).toBe('https://custom-webhook-domain.com');
    });

    test('should configure different retry limits per environment', () => {
      process.env.NODE_ENV = 'staging';
      
      const config = getWebhookConfig();
      
      expect(config.security.maxRetries).toBe(3); // staging limit
    });
  });

  describe('Environment Feature Flags', () => {
    test('should enable error simulation in development but not production', () => {
      process.env.NODE_ENV = 'development';
      let env = getCurrentEnvironment();
      expect(env.features.errorSimulation).toBe(true);
      
      process.env.NODE_ENV = 'production';
      env = getCurrentEnvironment();
      expect(env.features.errorSimulation).toBe(false);
    });

    test('should enable rate limit testing in staging', () => {
      process.env.NODE_ENV = 'staging';
      const env = getCurrentEnvironment();
      
      expect(env.features.rateLimitTesting).toBe(true);
    });

    test('should configure appropriate request limits per environment', () => {
      process.env.NODE_ENV = 'development';
      let env = getCurrentEnvironment();
      expect(env.limits.requestsPerMinute).toBe(30);
      expect(env.limits.dailyRequests).toBe(1000);
      
      process.env.NODE_ENV = 'production';
      env = getCurrentEnvironment();
      expect(env.limits.requestsPerMinute).toBe(300);
      expect(env.limits.dailyRequests).toBe(100000);
    });
  });
});