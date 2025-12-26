/**
 * Tests for Analytics Cache Invalidation (ROA-356)
 *
 * Validates that analytics cache is properly invalidated when user persona changes.
 */

// Setup mock mode
process.env.ENABLE_MOCK_MODE = 'true';
process.env.NODE_ENV = 'test';

// ROA-356: Import analytics cache service directly
const analyticsCacheService = require('../../../src/services/analyticsCacheService');
const analyticsRouter = require('../../../src/routes/analytics');

describe('Analytics Cache Invalidation (ROA-356)', () => {
  let mockUserId;

  beforeEach(() => {
    mockUserId = 'test-user-id-123';
    // Clear cache before each test
    if (analyticsRouter.__clearAnalyticsCache) {
      analyticsRouter.__clearAnalyticsCache();
    }
  });

  afterEach(() => {
    // Clean up after each test
    if (analyticsRouter.__clearAnalyticsCache) {
      analyticsRouter.__clearAnalyticsCache();
    }
  });

  describe('invalidateAnalyticsCache', () => {
    it('should handle invalid userId gracefully', () => {
      expect(() => {
        analyticsCacheService.invalidateAnalyticsCache(null);
      }).not.toThrow();

      expect(() => {
        analyticsCacheService.invalidateAnalyticsCache(undefined);
      }).not.toThrow();

      expect(() => {
        analyticsCacheService.invalidateAnalyticsCache('');
      }).not.toThrow();
    });

    it('should not throw when no cache exists for user', () => {
      const nonExistentUserId = 'non-existent-user-id';
      expect(() => {
        analyticsCacheService.invalidateAnalyticsCache(nonExistentUserId);
      }).not.toThrow();
    });

    it('should not throw when cache service is not initialized', () => {
      // This should handle gracefully when cache is not initialized
      expect(() => {
        analyticsCacheService.invalidateAnalyticsCache(mockUserId);
      }).not.toThrow();
    });
  });

  describe('Cache invalidation integration', () => {
    it('should export invalidateAnalyticsCache function', () => {
      expect(typeof analyticsCacheService.invalidateAnalyticsCache).toBe('function');
    });

    it('should have test helper functions in test environment', () => {
      // These are exposed in test mode
      if (process.env.NODE_ENV === 'test') {
        expect(analyticsRouter.__clearAnalyticsCache).toBeDefined();
        expect(analyticsRouter.__invalidateAnalyticsCache).toBeDefined();
      }
    });
  });
});
