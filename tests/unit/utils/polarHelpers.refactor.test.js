/**
 * Unit Tests: PRICE_ID → PRODUCT_ID Migration (Issue #887)
 *
 * Validates the refactor from Stripe's price_id to Polar's product_id
 * while maintaining backward compatibility.
 *
 * Issue: #887 - Migrar PRICE_ID a PRODUCT_ID para Polar
 * Related: Issue #808 - Migrar tests de billing de Stripe a Polar
 */

// Mock logger to avoid noise in tests
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

describe('PRICE_ID → PRODUCT_ID Migration (Issue #887)', () => {
  // Set up test environment variables BEFORE importing the module
  const originalEnv = process.env;
  let getPlanFromProductId, getProductIdFromPlan, getPlanFromPriceId;
  let getPriceIdFromPlan, getConfiguredProductIds, getConfiguredPriceIds, isValidPlan;
  let logger;
  
  beforeAll(() => {
    // Set environment variables before module is loaded
    process.env.POLAR_STARTER_PRODUCT_ID = 'prod_starter_test';
    process.env.POLAR_PRO_PRODUCT_ID = 'prod_pro_test';
    process.env.POLAR_PLUS_PRODUCT_ID = 'prod_plus_test';
    
    // Clear module cache and reload with new env vars
    jest.resetModules();
    const polarHelpers = require('../../../src/utils/polarHelpers');
    logger = require('../../../src/utils/logger');
    
    // Extract functions
    getPlanFromProductId = polarHelpers.getPlanFromProductId;
    getProductIdFromPlan = polarHelpers.getProductIdFromPlan;
    getPlanFromPriceId = polarHelpers.getPlanFromPriceId;
    getPriceIdFromPlan = polarHelpers.getPriceIdFromPlan;
    getConfiguredProductIds = polarHelpers.getConfiguredProductIds;
    getConfiguredPriceIds = polarHelpers.getConfiguredPriceIds;
    isValidPlan = polarHelpers.isValidPlan;
  });

  afterAll(() => {
    process.env = originalEnv;
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('New API: getPlanFromProductId()', () => {
    it('should map product_id to plan correctly', () => {
      expect(getPlanFromProductId('prod_starter_test')).toBe('starter_trial');
      expect(getPlanFromProductId('prod_pro_test')).toBe('pro');
      expect(getPlanFromProductId('prod_plus_test')).toBe('plus');
    });

    it('should throw error for unknown product_id', () => {
      expect(() => {
        getPlanFromProductId('prod_unknown');
      }).toThrow('Unknown product_id: prod_unknown');
      
      expect(logger.error).toHaveBeenCalledWith(
        '[Polar Helpers] Unknown product_id',
        { productId: 'prod_unknown' }
      );
    });
  });

  describe('New API: getProductIdFromPlan()', () => {
    it('should map plan to product_id correctly', () => {
      expect(getProductIdFromPlan('starter_trial')).toBe('prod_starter_test');
      expect(getProductIdFromPlan('pro')).toBe('prod_pro_test');
      expect(getProductIdFromPlan('plus')).toBe('prod_plus_test');
    });

    it('should throw error for unknown plan', () => {
      expect(() => {
        getProductIdFromPlan('unknown_plan');
      }).toThrow('Unknown plan: unknown_plan');
      
      expect(logger.error).toHaveBeenCalledWith(
        '[Polar Helpers] Unknown plan',
        { plan: 'unknown_plan' }
      );
    });
  });

  describe('Legacy API: getPlanFromPriceId() (deprecated)', () => {
    it('should support legacy price_id calls with warning', () => {
      const result = getPlanFromPriceId('prod_starter_test');
      
      expect(result).toBe('starter_trial');
      expect(logger.warn).toHaveBeenCalledWith(
        '[Polar Helpers] getPlanFromPriceId is deprecated, use getPlanFromProductId',
        { priceId: 'prod_starter_test' }
      );
    });

    it('should return same plan for both product_id and price_id', () => {
      const planFromProduct = getPlanFromProductId('prod_pro_test');
      const planFromPrice = getPlanFromPriceId('prod_pro_test');
      
      expect(planFromProduct).toBe(planFromPrice);
      expect(planFromProduct).toBe('pro');
    });

    it('should throw same error for unknown IDs', () => {
      expect(() => {
        getPlanFromPriceId('prod_unknown');
      }).toThrow('Unknown product_id: prod_unknown');
    });
  });

  describe('Legacy API: getPriceIdFromPlan() (deprecated)', () => {
    it('should support legacy calls with warning', () => {
      const result = getPriceIdFromPlan('pro');
      
      expect(result).toBe('prod_pro_test');
      expect(logger.warn).toHaveBeenCalledWith(
        '[Polar Helpers] getPriceIdFromPlan is deprecated, use getProductIdFromPlan',
        { plan: 'pro' }
      );
    });

    it('should return same product_id for both APIs', () => {
      const idFromProduct = getProductIdFromPlan('plus');
      const idFromPrice = getPriceIdFromPlan('plus');
      
      expect(idFromProduct).toBe(idFromPrice);
      expect(idFromProduct).toBe('prod_plus_test');
    });
  });

  describe('Legacy API: getConfiguredPriceIds() (deprecated)', () => {
    it('should return same IDs as getConfiguredProductIds()', () => {
      const productIds = getConfiguredProductIds();
      const priceIds = getConfiguredPriceIds();
      
      expect(priceIds).toEqual(productIds);
      expect(logger.warn).toHaveBeenCalledWith(
        '[Polar Helpers] getConfiguredPriceIds is deprecated, use getConfiguredProductIds'
      );
    });
  });

  describe('Backward Compatibility Validation', () => {
    it('should maintain identical behavior between old and new APIs', () => {
      const testCases = [
        { id: 'prod_starter_test', expectedPlan: 'starter_trial' },
        { id: 'prod_pro_test', expectedPlan: 'pro' },
        { id: 'prod_plus_test', expectedPlan: 'plus' }
      ];

      testCases.forEach(({ id, expectedPlan }) => {
        const planFromProduct = getPlanFromProductId(id);
        const planFromPrice = getPlanFromPriceId(id);
        
        expect(planFromProduct).toBe(expectedPlan);
        expect(planFromPrice).toBe(expectedPlan);
        expect(planFromProduct).toBe(planFromPrice);
      });
    });

    it('should maintain identical reverse mapping', () => {
      const plans = ['starter_trial', 'pro', 'plus'];
      
      plans.forEach(plan => {
        const idFromProduct = getProductIdFromPlan(plan);
        const idFromPrice = getPriceIdFromPlan(plan);
        
        expect(idFromProduct).toBe(idFromPrice);
      });
    });
  });

  describe('Utility Functions', () => {
    it('isValidPlan() should validate plan names', () => {
      expect(isValidPlan('starter_trial')).toBe(true);
      expect(isValidPlan('starter')).toBe(true);
      expect(isValidPlan('pro')).toBe(true);
      expect(isValidPlan('plus')).toBe(true);
      expect(isValidPlan('unknown')).toBe(false);
      expect(isValidPlan('')).toBe(false);
    });

    it('getConfiguredProductIds() should return all configured IDs', () => {
      const ids = getConfiguredProductIds();
      
      expect(ids).toContain('prod_starter_test');
      expect(ids).toContain('prod_pro_test');
      expect(ids).toContain('prod_plus_test');
      expect(ids.length).toBe(3);
    });
  });
});

