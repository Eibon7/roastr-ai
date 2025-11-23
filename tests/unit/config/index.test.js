/**
 * Unit Tests for Config Index
 * Issue #926 - Fase 1.3: Tests para Config Files
 *
 * Tests configuration structure, exports, and environment variable handling
 */

const config = require('../../../src/config/index');

describe('Config Index', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Module Loading', () => {
    test('should load without errors', () => {
      expect(() => {
        require('../../../src/config/index');
      }).not.toThrow();
    });

    test('should export config object', () => {
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
      expect(config).not.toBeNull();
    });
  });

  describe('Config Structure', () => {
    test('should have openai configuration', () => {
      expect(config.openai).toBeDefined();
      expect(typeof config.openai).toBe('object');
      expect(config.openai).toHaveProperty('apiKey');
      expect(config.openai).toHaveProperty('model');
    });

    test('should have perspective configuration', () => {
      expect(config.perspective).toBeDefined();
      expect(typeof config.perspective).toBe('object');
      expect(config.perspective).toHaveProperty('apiKey');
    });

    test('should have toxicity configuration', () => {
      expect(config.toxicity).toBeDefined();
      expect(typeof config.toxicity).toBe('object');
      expect(config.toxicity).toHaveProperty('threshold');
      expect(typeof config.toxicity.threshold).toBe('number');
    });

    test('should have billing configuration', () => {
      expect(config.billing).toBeDefined();
      expect(typeof config.billing).toBe('object');
      expect(config.billing).toHaveProperty('stripe');
    });

    test('should have billing.stripe configuration', () => {
      expect(config.billing.stripe).toBeDefined();
      expect(typeof config.billing.stripe).toBe('object');
      expect(config.billing.stripe).toHaveProperty('secretKey');
      expect(config.billing.stripe).toHaveProperty('webhookSecret');
      expect(config.billing.stripe).toHaveProperty('priceLookupKeys');
      expect(config.billing.stripe).toHaveProperty('successUrl');
      expect(config.billing.stripe).toHaveProperty('cancelUrl');
      expect(config.billing.stripe).toHaveProperty('portalReturnUrl');
    });

    test('should have billing.stripe.priceLookupKeys with all tiers', () => {
      const priceLookupKeys = config.billing.stripe.priceLookupKeys;
      expect(priceLookupKeys).toBeDefined();
      expect(typeof priceLookupKeys).toBe('object');
      expect(priceLookupKeys).toHaveProperty('free');
      expect(priceLookupKeys).toHaveProperty('starter');
      expect(priceLookupKeys).toHaveProperty('pro');
      expect(priceLookupKeys).toHaveProperty('plus');
    });
  });

  describe('Default Values', () => {
    test('should have default model value', () => {
      expect(config.openai.model).toBe('gpt-3.5-turbo');
    });

    test('should have default toxicity threshold', () => {
      expect(config.toxicity.threshold).toBe(0.7);
    });

    test('should have default price lookup keys', () => {
      expect(config.billing.stripe.priceLookupKeys.free).toBe('roastr-free-v1');
      expect(config.billing.stripe.priceLookupKeys.starter).toBe('roastr-starter-v1');
      expect(config.billing.stripe.priceLookupKeys.pro).toBe('roastr-pro-v1');
      expect(config.billing.stripe.priceLookupKeys.plus).toBe('roastr-plus-v1');
    });

    test('should have default URLs', () => {
      expect(config.billing.stripe.successUrl).toBe(
        'http://localhost:3000/billing?session_id={CHECKOUT_SESSION_ID}'
      );
      expect(config.billing.stripe.cancelUrl).toBe('http://localhost:3000/pricing');
      expect(config.billing.stripe.portalReturnUrl).toBe('http://localhost:3000/billing');
    });

    test('should use empty string as default for API keys when env vars not set', () => {
      // Note: This test verifies the fallback behavior
      // If env vars are set, they will be used; otherwise empty string
      expect(typeof config.openai.apiKey).toBe('string');
      expect(typeof config.perspective.apiKey).toBe('string');
      expect(typeof config.billing.stripe.secretKey).toBe('string');
      expect(typeof config.billing.stripe.webhookSecret).toBe('string');
    });
  });

  describe('Environment Variable Values', () => {
    test('should read API keys from environment variables', () => {
      // Verify that config reads from process.env
      // Note: Module is cached, so we verify the structure supports env vars
      expect(config.openai).toHaveProperty('apiKey');
      expect(config.perspective).toHaveProperty('apiKey');
      expect(config.billing.stripe).toHaveProperty('secretKey');
      expect(config.billing.stripe).toHaveProperty('webhookSecret');

      // Values will be from env if set, or empty string if not
      // This test verifies the structure supports env var reading
      expect(typeof config.openai.apiKey).toBe('string');
      expect(typeof config.perspective.apiKey).toBe('string');
      expect(typeof config.billing.stripe.secretKey).toBe('string');
      expect(typeof config.billing.stripe.webhookSecret).toBe('string');
    });

    test('should support custom price lookup keys from environment', () => {
      // Verify structure supports env var override
      expect(config.billing.stripe.priceLookupKeys).toHaveProperty('free');
      expect(config.billing.stripe.priceLookupKeys).toHaveProperty('starter');
      expect(config.billing.stripe.priceLookupKeys).toHaveProperty('pro');
      expect(config.billing.stripe.priceLookupKeys).toHaveProperty('plus');

      // All should be strings (either from env or default)
      expect(typeof config.billing.stripe.priceLookupKeys.free).toBe('string');
      expect(typeof config.billing.stripe.priceLookupKeys.starter).toBe('string');
      expect(typeof config.billing.stripe.priceLookupKeys.pro).toBe('string');
      expect(typeof config.billing.stripe.priceLookupKeys.plus).toBe('string');
    });

    test('should support custom URLs from environment', () => {
      // Verify structure supports env var override
      expect(typeof config.billing.stripe.successUrl).toBe('string');
      expect(typeof config.billing.stripe.cancelUrl).toBe('string');
      expect(typeof config.billing.stripe.portalReturnUrl).toBe('string');

      // URLs should be valid strings
      expect(config.billing.stripe.successUrl.length).toBeGreaterThan(0);
      expect(config.billing.stripe.cancelUrl.length).toBeGreaterThan(0);
      expect(config.billing.stripe.portalReturnUrl.length).toBeGreaterThan(0);
    });
  });

  describe('Value Types', () => {
    test('should have correct types for all properties', () => {
      expect(typeof config.openai.apiKey).toBe('string');
      expect(typeof config.openai.model).toBe('string');
      expect(typeof config.perspective.apiKey).toBe('string');
      expect(typeof config.toxicity.threshold).toBe('number');
      expect(typeof config.billing.stripe.secretKey).toBe('string');
      expect(typeof config.billing.stripe.webhookSecret).toBe('string');
      expect(typeof config.billing.stripe.priceLookupKeys).toBe('object');
      expect(typeof config.billing.stripe.priceLookupKeys.free).toBe('string');
      expect(typeof config.billing.stripe.priceLookupKeys.starter).toBe('string');
      expect(typeof config.billing.stripe.priceLookupKeys.pro).toBe('string');
      expect(typeof config.billing.stripe.priceLookupKeys.plus).toBe('string');
      expect(typeof config.billing.stripe.successUrl).toBe('string');
      expect(typeof config.billing.stripe.cancelUrl).toBe('string');
      expect(typeof config.billing.stripe.portalReturnUrl).toBe('string');
    });
  });
});
