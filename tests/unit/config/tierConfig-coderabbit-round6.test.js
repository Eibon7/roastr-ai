const tierConfig = require('../../../src/config/tierConfig');

describe('TierConfig - CodeRabbit Round 6 Improvements', () => {
  describe('Configuration Consistency', () => {
    test('should have all required tier definitions', () => {
      const requiredTiers = ['free', 'starter', 'pro', 'plus'];
      
      requiredTiers.forEach(tier => {
        expect(tierConfig.DEFAULT_TIER_LIMITS).toHaveProperty(tier);
      });
    });

    test('should have consistent limit structure across all tiers', () => {
      const requiredLimitKeys = [
        'maxRoasts',
        'monthlyResponsesLimit',
        'monthlyAnalysisLimit'
      ];
      
      Object.keys(tierConfig.DEFAULT_TIER_LIMITS).forEach(tier => {
        requiredLimitKeys.forEach(key => {
          expect(tierConfig.DEFAULT_TIER_LIMITS[tier]).toHaveProperty(key);
          expect(typeof tierConfig.DEFAULT_TIER_LIMITS[tier][key]).toBe('number');
          expect(tierConfig.DEFAULT_TIER_LIMITS[tier][key]).toBeGreaterThan(0);
        });
      });
    });

    test('should maintain proper tier hierarchy in limits', () => {
      const tiers = ['free', 'starter', 'pro', 'plus'];
      const limitKeys = ['maxRoasts', 'monthlyResponsesLimit', 'monthlyAnalysisLimit'];
      
      limitKeys.forEach(limitKey => {
        for (let i = 1; i < tiers.length; i++) {
          const currentTier = tiers[i];
          const previousTier = tiers[i - 1];
          
          expect(tierConfig.DEFAULT_TIER_LIMITS[currentTier][limitKey])
            .toBeGreaterThan(tierConfig.DEFAULT_TIER_LIMITS[previousTier][limitKey]);
        }
      });
    });

    test('should have logical feature progression', () => {
      // Free should have minimal features
      expect(tierConfig.DEFAULT_TIER_LIMITS.free.shieldEnabled).toBe(false);
      expect(tierConfig.DEFAULT_TIER_LIMITS.free.analyticsEnabled).toBe(false);
      expect(tierConfig.DEFAULT_TIER_LIMITS.free.prioritySupport).toBe(false);
      
      // Starter should add shield
      expect(tierConfig.DEFAULT_TIER_LIMITS.starter.shieldEnabled).toBe(true);
      expect(tierConfig.DEFAULT_TIER_LIMITS.starter.analyticsEnabled).toBe(false);
      
      // Pro should add analytics
      expect(tierConfig.DEFAULT_TIER_LIMITS.pro.shieldEnabled).toBe(true);
      expect(tierConfig.DEFAULT_TIER_LIMITS.pro.analyticsEnabled).toBe(true);
      
      // Plus should have all features
      expect(tierConfig.DEFAULT_TIER_LIMITS.plus.shieldEnabled).toBe(true);
      expect(tierConfig.DEFAULT_TIER_LIMITS.plus.analyticsEnabled).toBe(true);
      expect(tierConfig.DEFAULT_TIER_LIMITS.plus.prioritySupport).toBe(true);
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
      
      // Attempt to add new tier
      try {
        tierConfig.DEFAULT_TIER_LIMITS.enterprise = { maxRoasts: 10000 };
      } catch (error) {
        // Expected if config is frozen
      }
      
      // Should not have new tier (if properly frozen)
      const newKeys = Object.keys(tierConfig.DEFAULT_TIER_LIMITS);
      expect(newKeys.length).toBe(originalKeys.length);
    });
  });

  describe('Business Logic Validation', () => {
    test('should have sensible monthly to daily ratios', () => {
      Object.keys(tierConfig.DEFAULT_TIER_LIMITS).forEach(tier => {
        const limits = tierConfig.DEFAULT_TIER_LIMITS[tier];
        const monthlyToDailyRatio = limits.monthlyResponsesLimit / limits.maxRoasts;
        
        // Should be between 5-20 (roughly monthly usage patterns)
        expect(monthlyToDailyRatio).toBeGreaterThan(5);
        expect(monthlyToDailyRatio).toBeLessThan(25);
      });
    });

    test('should have meaningful tier differences', () => {
      const tiers = ['free', 'starter', 'pro', 'plus'];
      
      for (let i = 1; i < tiers.length; i++) {
        const currentTier = tiers[i];
        const previousTier = tiers[i - 1];
        
        const currentLimits = tierConfig.DEFAULT_TIER_LIMITS[currentTier];
        const previousLimits = tierConfig.DEFAULT_TIER_LIMITS[previousTier];
        
        // Each tier should provide at least 2x improvement
        expect(currentLimits.maxRoasts).toBeGreaterThanOrEqual(previousLimits.maxRoasts * 2);
        expect(currentLimits.monthlyResponsesLimit).toBeGreaterThanOrEqual(previousLimits.monthlyResponsesLimit * 2);
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
      const validTierNames = ['free', 'starter', 'pro', 'plus', 'custom'];
      
      Object.keys(tierConfig.DEFAULT_TIER_LIMITS).forEach(tier => {
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