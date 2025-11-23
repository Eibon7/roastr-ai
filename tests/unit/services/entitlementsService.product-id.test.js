/**
 * Unit Tests: EntitlementsService with Polar Product ID (Issue #887)
 *
 * Validates setEntitlementsFromPolarPrice() works correctly with
 * product_id instead of price_id.
 *
 * Issue: #887 - Migrar PRICE_ID a PRODUCT_ID para Polar
 * Related: Issue #808 - Migrar tests de billing de Stripe a Polar
 */

const EntitlementsService = require('../../../src/services/entitlementsService');
const { getPlanFromProductId, getPlanFromPriceId } = require('../../../src/utils/polarHelpers');

// Mock dependencies
jest.mock('../../../src/utils/polarHelpers');
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn(() => ({
      upsert: jest.fn().mockResolvedValue({
        data: [{ id: 'user_123', plan: 'pro' }],
        error: null
      }),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [{ id: 'user_123', plan: 'pro' }],
        error: null
      }),
      single: jest.fn().mockResolvedValue({
        data: { id: 'user_123', plan: 'pro' },
        error: null
      })
    }))
  }
}));

describe('EntitlementsService with Polar Product ID (Issue #887)', () => {
  let entitlementsService;
  const ORIGINAL_ENV = { ...process.env }; // Snapshot by value, not reference

  beforeAll(() => {
    process.env.POLAR_STARTER_PRODUCT_ID = 'prod_starter_test';
    process.env.POLAR_PRO_PRODUCT_ID = 'prod_pro_test';
    process.env.POLAR_PLUS_PRODUCT_ID = 'prod_plus_test';

    // Mock polarHelpers functions
    getPlanFromProductId.mockImplementation((productId) => {
      const mapping = {
        prod_starter_test: 'starter_trial',
        prod_pro_test: 'pro',
        prod_plus_test: 'plus'
      };
      const plan = mapping[productId];
      if (!plan) {
        throw new Error(`Unknown product_id: ${productId}`);
      }
      return plan;
    });

    getPlanFromPriceId.mockImplementation((priceId) => {
      // Legacy function, should call getPlanFromProductId
      return getPlanFromProductId(priceId);
    });

    entitlementsService = new EntitlementsService();
    // Enable polarClient for tests
    entitlementsService.polarClient = { enabled: true };

    // Mock internal methods
    entitlementsService._getPlanLimitsFromName = jest.fn((planName) => {
      const limits = {
        starter_trial: { analysis_limit_monthly: 100, roast_limit_monthly: 50 },
        pro: { analysis_limit_monthly: 1000, roast_limit_monthly: 500 },
        plus: { analysis_limit_monthly: 5000, roast_limit_monthly: 2000 }
      };
      return limits[planName] || limits.pro;
    });

    entitlementsService._persistEntitlements = jest.fn().mockResolvedValue({
      id: 'user_123',
      plan: 'pro',
      analysis_limit_monthly: 1000,
      roast_limit_monthly: 500
    });

    entitlementsService._applyFallbackEntitlements = jest.fn().mockResolvedValue(true);
  });

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV }; // Restore from snapshot to prevent cross-test contamination
    jest.clearAllMocks();
  });

  describe('setEntitlementsFromPolarPrice() with product_id', () => {
    it('should set entitlements using product_id (new API)', async () => {
      const result = await entitlementsService.setEntitlementsFromPolarPrice(
        'user_123',
        'prod_pro_test'
      );

      expect(result.success).toBe(true);
      expect(result.source).toBe('polar_product');
      expect(getPlanFromProductId).toHaveBeenCalledWith('prod_pro_test');
      expect(result.entitlements).toBeDefined();
    });

    it('should fallback to legacy getPlanFromPriceId if getPlanFromProductId fails', async () => {
      // Mock getPlanFromProductId to return null (unknown product)
      getPlanFromProductId.mockReturnValueOnce(null);
      getPlanFromPriceId.mockReturnValueOnce('pro'); // Legacy fallback works

      const result = await entitlementsService.setEntitlementsFromPolarPrice(
        'user_123',
        'prod_unknown'
      );

      // Should try both APIs
      expect(getPlanFromProductId).toHaveBeenCalledWith('prod_unknown');
      expect(getPlanFromPriceId).toHaveBeenCalledWith('prod_unknown');
    });

    it('should log "Polar Product" terminology', async () => {
      const { logger } = require('../../../src/utils/logger');
      jest.clearAllMocks();

      await entitlementsService.setEntitlementsFromPolarPrice('user_123', 'prod_pro_test');

      expect(logger.info).toHaveBeenCalledWith(
        'Entitlements updated from Polar Product',
        expect.objectContaining({
          polarProductId: 'prod_pro_test'
        })
      );
    });

    it('should handle error and return fallback', async () => {
      const { logger } = require('../../../src/utils/logger');
      jest.clearAllMocks();

      // Mock getPlanFromProductId to throw error
      getPlanFromProductId.mockImplementationOnce(() => {
        throw new Error('Unknown product_id');
      });

      const result = await entitlementsService.setEntitlementsFromPolarPrice(
        'user_123',
        'prod_invalid'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to set entitlements from Polar Product',
        expect.objectContaining({
          polarProductId: 'prod_invalid'
        })
      );
    });

    it('should persist polar_price_id column for backward compatibility', async () => {
      // Reset mock to track calls
      entitlementsService._persistEntitlements.mockClear();

      await entitlementsService.setEntitlementsFromPolarPrice('user_123', 'prod_pro_test');

      // Verify _persistEntitlements was called with polar_price_id (backward compatibility)
      expect(entitlementsService._persistEntitlements).toHaveBeenCalledWith(
        'user_123',
        expect.objectContaining({
          polar_price_id: 'prod_pro_test' // Column name kept for backward compatibility
        })
      );
    });

    it('should include metadata with updated_from: polar_product', async () => {
      // Reset mock to track calls
      entitlementsService._persistEntitlements.mockClear();

      await entitlementsService.setEntitlementsFromPolarPrice('user_123', 'prod_pro_test');

      expect(entitlementsService._persistEntitlements).toHaveBeenCalledWith(
        'user_123',
        expect.objectContaining({
          metadata: expect.objectContaining({
            updated_from: 'polar_product'
          })
        })
      );
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with legacy price_id values', async () => {
      // Simulate legacy client sending price_id that happens to match product_id format
      const result = await entitlementsService.setEntitlementsFromPolarPrice(
        'user_123',
        'prod_pro_test' // Could be from legacy price_id parameter
      );

      expect(result.success).toBe(true);
      // Should work because getPlanFromProductId handles it
    });

    it('should maintain same behavior for both product_id and price_id', async () => {
      const productIdResult = await entitlementsService.setEntitlementsFromPolarPrice(
        'user_123',
        'prod_pro_test'
      );

      jest.clearAllMocks();

      // Legacy: price_id that maps to same product
      getPlanFromPriceId.mockReturnValueOnce('pro');
      const priceIdResult = await entitlementsService.setEntitlementsFromPolarPrice(
        'user_123',
        'prod_pro_test' // Same value, different context
      );

      // Both should succeed
      expect(productIdResult.success).toBe(true);
      expect(priceIdResult.success).toBe(true);
    });
  });
});
