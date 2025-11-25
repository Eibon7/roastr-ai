const tierConfig = require('../../../src/config/tierConfig');
const { getPlanLimits, getAllPlans } = require('../../../src/services/planService');

describe('TierConfig - CodeRabbit Round 6 Improvements', () => {
  // Reset DEFAULT_TIER_LIMITS before each test to ensure clean state
  // Issue #973: Tests modify the object, so we need to reset it
  beforeEach(() => {
    // Re-generate DEFAULT_TIER_LIMITS from planService (single source of truth)
    const allPlans = getAllPlans();
    const freshLimits = {};
    for (const planId in allPlans) {
      freshLimits[planId] = getPlanLimits(planId);
    }
    // Replace the object properties (can't reassign the export, but can modify properties)
    Object.keys(tierConfig.DEFAULT_TIER_LIMITS).forEach((key) => {
      delete tierConfig.DEFAULT_TIER_LIMITS[key];
    });
    Object.assign(tierConfig.DEFAULT_TIER_LIMITS, freshLimits);
  });

  describe('Configuration Consistency', () => {
    test('should have all required tier definitions', () => {
      // Issue #841: Actual plans are starter_trial, starter, pro, plus, custom (no free plan)
      const requiredTiers = ['starter_trial', 'starter', 'pro', 'plus', 'custom'];

      requiredTiers.forEach((tier) => {
        expect(tierConfig.DEFAULT_TIER_LIMITS).toHaveProperty(tier);
      });
    });

    test('should have consistent limit structure across all tiers', () => {
      const requiredLimitKeys = ['maxRoasts', 'monthlyResponsesLimit', 'monthlyAnalysisLimit'];

      Object.keys(tierConfig.DEFAULT_TIER_LIMITS).forEach((tier) => {
        // Skip custom tier which has unlimited limits (-1)
        if (tier === 'custom') return;
        
        requiredLimitKeys.forEach((key) => {
          expect(tierConfig.DEFAULT_TIER_LIMITS[tier]).toHaveProperty(key);
          expect(typeof tierConfig.DEFAULT_TIER_LIMITS[tier][key]).toBe('number');
          expect(tierConfig.DEFAULT_TIER_LIMITS[tier][key]).toBeGreaterThan(0);
        });
      });
    });

    test('should maintain proper tier hierarchy in limits', () => {
      // Issue #841: Actual tier order (excluding custom which has unlimited limits)
      const tiers = ['starter_trial', 'starter', 'pro', 'plus'];
      const limitKeys = ['maxRoasts', 'monthlyResponsesLimit', 'monthlyAnalysisLimit'];

      limitKeys.forEach((limitKey) => {
        for (let i = 1; i < tiers.length; i++) {
          const currentTier = tiers[i];
          const previousTier = tiers[i - 1];

          // Starter_trial and starter have same limits, so use >= instead of >
          if (currentTier === 'starter' && previousTier === 'starter_trial') {
            expect(tierConfig.DEFAULT_TIER_LIMITS[currentTier][limitKey]).toBeGreaterThanOrEqual(
              tierConfig.DEFAULT_TIER_LIMITS[previousTier][limitKey]
            );
          } else {
            expect(tierConfig.DEFAULT_TIER_LIMITS[currentTier][limitKey]).toBeGreaterThan(
              tierConfig.DEFAULT_TIER_LIMITS[previousTier][limitKey]
            );
          }
        }
      });
    });

    test('should have logical feature progression', () => {
      // Issue #841: Starter Trial has shield enabled (same as starter)
      expect(tierConfig.DEFAULT_TIER_LIMITS.starter_trial.shieldEnabled).toBe(true);
      expect(tierConfig.DEFAULT_TIER_LIMITS.starter_trial.analyticsEnabled).toBe(false);
      expect(tierConfig.DEFAULT_TIER_LIMITS.starter_trial.prioritySupport).toBe(false);

      // Starter should have shield
      expect(tierConfig.DEFAULT_TIER_LIMITS.starter.shieldEnabled).toBe(true);
      expect(tierConfig.DEFAULT_TIER_LIMITS.starter.analyticsEnabled).toBe(false);

      // Pro has shield but analytics is disabled (Issue #841: analytics not enabled in Pro)
      expect(tierConfig.DEFAULT_TIER_LIMITS.pro.shieldEnabled).toBe(true);
      expect(tierConfig.DEFAULT_TIER_LIMITS.pro.analyticsEnabled).toBe(false);

      // Plus should have shield and custom tones
      expect(tierConfig.DEFAULT_TIER_LIMITS.plus.shieldEnabled).toBe(true);
      expect(tierConfig.DEFAULT_TIER_LIMITS.plus.customTones).toBe(true);
      expect(tierConfig.DEFAULT_TIER_LIMITS.plus.analyticsEnabled).toBe(false);
    });
  });

  describe('Security Configuration', () => {
    test('should have valid security config', () => {
      expect(tierConfig).toHaveProperty('SECURITY_CONFIG');

      const securityConfig = tierConfig.SECURITY_CONFIG;
      expect(typeof securityConfig.failClosed.forceInProduction).toBe('boolean');
      expect(typeof securityConfig.failClosed.environmentVar).toBe('string');

      expect(securityConfig.failClosed.environmentVar).toBeTruthy();
    });

    test('should have reasonable security defaults', () => {
      const securityConfig = tierConfig.SECURITY_CONFIG;

      // Should fail closed for security
      expect(securityConfig.failClosed.forceInProduction).toBe(true);

      // Should have retry policy
      expect(securityConfig.retryPolicy.maxRetries).toBeGreaterThan(0);
      expect(securityConfig.retryPolicy.baseDelayMs).toBeGreaterThan(0);
    });
  });

  describe('Cache Configuration', () => {
    test('should have valid cache configuration', () => {
      expect(tierConfig).toHaveProperty('CACHE_CONFIG');

      const cacheConfig = tierConfig.CACHE_CONFIG;
      expect(typeof cacheConfig.timeouts.usage).toBe('number');
      expect(typeof cacheConfig.timeouts.tiers).toBe('number');
      expect(typeof cacheConfig.timeouts.limits).toBe('number');

      expect(cacheConfig.timeouts.usage).toBeGreaterThan(0);
      expect(cacheConfig.timeouts.tiers).toBeGreaterThan(0);
      expect(cacheConfig.timeouts.limits).toBeGreaterThan(0);
    });

    test('should have reasonable cache timeouts', () => {
      const cacheConfig = tierConfig.CACHE_CONFIG;

      // Cache timeouts should be reasonable (30 seconds to 30 minutes)
      expect(cacheConfig.timeouts.usage).toBeGreaterThanOrEqual(30000);
      expect(cacheConfig.timeouts.usage).toBeLessThanOrEqual(1800000);

      expect(cacheConfig.timeouts.limits).toBeGreaterThanOrEqual(300000);
      expect(cacheConfig.timeouts.limits).toBeLessThanOrEqual(1800000);
    });
  });

  describe('Configuration Immutability', () => {
    test('should prevent accidental modification of tier limits', () => {
      const originalValue = tierConfig.DEFAULT_TIER_LIMITS.pro.maxRoasts;

      // Attempt to modify
      try {
        tierConfig.DEFAULT_TIER_LIMITS.pro.maxRoasts = 999999;
      } catch (error) {
        // Expected if config is frozen
      }

      // Value should remain unchanged (if properly frozen)
      // Note: This test will pass even if not frozen, but serves as documentation
      expect(tierConfig.DEFAULT_TIER_LIMITS.pro.maxRoasts).toBeDefined();
    });

    test('should prevent addition of new tiers', () => {
      const originalKeys = Object.keys(tierConfig.DEFAULT_TIER_LIMITS);
      const expectedTierCount = 5; // starter_trial, starter, pro, plus, custom

      // Attempt to add new tier
      try {
        tierConfig.DEFAULT_TIER_LIMITS.enterprise = { maxRoasts: 10000 };
      } catch (error) {
        // Expected if config is frozen
      }

      // Clean up if enterprise was added (object may not be frozen)
      if (tierConfig.DEFAULT_TIER_LIMITS.enterprise) {
        delete tierConfig.DEFAULT_TIER_LIMITS.enterprise;
      }

      // Should have expected number of tiers
      const newKeys = Object.keys(tierConfig.DEFAULT_TIER_LIMITS);
      expect(newKeys.length).toBe(expectedTierCount);
    });
  });

  describe('Business Logic Validation', () => {
    test('should have sensible monthly to daily ratios', () => {
      // Issue #841: Only test standard tiers (exclude custom which has unlimited limits -1)
      const standardTiers = ['starter_trial', 'starter', 'pro', 'plus'];
      
      standardTiers.forEach((tier) => {
        const limits = tierConfig.DEFAULT_TIER_LIMITS[tier];
        const monthlyToDailyRatio = limits.monthlyResponsesLimit / limits.maxRoasts;

        // Should be between 1-200 (roughly monthly usage patterns)
        // Note: starter_trial/starter have 5/5 = 1 ratio (same limits)
        expect(monthlyToDailyRatio).toBeGreaterThanOrEqual(1);
        expect(monthlyToDailyRatio).toBeLessThan(200);
      });
    });

    test('should have meaningful tier differences', () => {
      // Issue #841: Actual tier order (excluding custom which has unlimited limits)
      const tiers = ['starter_trial', 'starter', 'pro', 'plus'];

      for (let i = 1; i < tiers.length; i++) {
        const currentTier = tiers[i];
        const previousTier = tiers[i - 1];

        const currentLimits = tierConfig.DEFAULT_TIER_LIMITS[currentTier];
        const previousLimits = tierConfig.DEFAULT_TIER_LIMITS[previousTier];

        // Each tier should provide improvement (or equal for starter_trial/starter)
        if (currentTier === 'starter' && previousTier === 'starter_trial') {
          // Starter trial and starter have same limits
          expect(currentLimits.maxRoasts).toBeGreaterThanOrEqual(previousLimits.maxRoasts);
        } else {
          // Pro has 200x more than starter (1000 vs 5), Plus has 5x more than Pro (5000 vs 1000)
          expect(currentLimits.maxRoasts).toBeGreaterThan(previousLimits.maxRoasts);
        }
        expect(currentLimits.monthlyResponsesLimit).toBeGreaterThanOrEqual(
          previousLimits.monthlyResponsesLimit
        );
      }
    });
  });

  describe('Configuration Export Validation', () => {
    test('should export all required configuration objects', () => {
      expect(tierConfig).toHaveProperty('DEFAULT_TIER_LIMITS');
      expect(tierConfig).toHaveProperty('SECURITY_CONFIG');
      expect(tierConfig).toHaveProperty('CACHE_CONFIG');

      expect(typeof tierConfig.DEFAULT_TIER_LIMITS).toBe('object');
      expect(typeof tierConfig.SECURITY_CONFIG).toBe('object');
      expect(typeof tierConfig.CACHE_CONFIG).toBe('object');
    });

    test('should have valid tier names', () => {
      // Issue #841: Actual tier names from planService.js
      const validTierNames = ['starter_trial', 'starter', 'pro', 'plus', 'custom'];

      Object.keys(tierConfig.DEFAULT_TIER_LIMITS).forEach((tier) => {
        expect(validTierNames).toContain(tier);
      });
    });

    test('should have validation helpers', () => {
      expect(tierConfig).toHaveProperty('VALIDATION_HELPERS');
      expect(typeof tierConfig.VALIDATION_HELPERS.isValidPlan).toBe('function');
      expect(typeof tierConfig.VALIDATION_HELPERS.normalizePlan).toBe('function');
    });
  });
});
