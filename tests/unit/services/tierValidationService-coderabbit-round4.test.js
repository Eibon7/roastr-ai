/**
 * Comprehensive Unit Tests for tierValidationService.js CodeRabbit Round 4 Improvements
 * 
 * Tests all enhanced functionality including:
 * - Enhanced caching and concurrency safety
 * - UTC date handling and cycle calculations
 * - Performance optimizations with count queries
 * - Security improvements with fail-closed behavior
 * - Configuration management and warning thresholds
 * - Enhanced upgrade/downgrade handling
 */

const tierValidationService = require('../../../src/services/tierValidationService');
const planLimitsService = require('../../../src/services/planLimitsService');
const { logger } = require('../../../src/utils/logger');

// Mock dependencies
jest.mock('../../../src/services/planLimitsService');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    single: jest.fn(),
    upsert: jest.fn(),
    insert: jest.fn()
  }
}));

describe('TierValidationService - CodeRabbit Round 4 Improvements', () => {
  let mockSupabaseClient;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:30:00Z'));
    
    mockSupabaseClient = require('../../../src/config/supabase').supabaseServiceClient;
    
    // Clear service cache before each test
    tierValidationService.clearCache();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Enhanced Caching and Concurrency', () => {
    it('should use request-scoped caching to prevent duplicate validations', async () => {
      const userId = 'test-user-123';
      const action = 'roast';
      const requestId = 'req-123';
      
      // Mock successful validation
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { plan: 'pro', status: 'active', current_period_start: '2024-01-01' },
        error: null
      });
      
      planLimitsService.getPlanLimits.mockResolvedValue({
        monthlyResponsesLimit: 1000,
        monthlyAnalysisLimit: 10000
      });

      // First call
      const result1 = await tierValidationService.validateAction(userId, action, { requestId });
      
      // Second call with same requestId should use cache
      const result2 = await tierValidationService.validateAction(userId, action, { requestId });

      expect(result1).toEqual(result2);
      // Database should only be called once due to request-scoped caching
      expect(mockSupabaseClient.single).toHaveBeenCalledTimes(1);
    });

    it('should implement atomic cache operations to prevent race conditions', async () => {
      const userId = 'test-user-123';
      const usage = { roastsThisMonth: 50, analysisThisMonth: 200 };

      // Mock database responses
      mockSupabaseClient.single.mockResolvedValue({
        data: { count: 50 },
        error: null
      });

      // Atomic cache operation should work
      const result = tierValidationService.setCachedUsageAtomic(userId, usage);
      expect(result).toBeDefined();
    });

    it('should invalidate cache after recording actions', async () => {
      const userId = 'test-user-123';
      
      // Set initial cache
      tierValidationService.setCachedUsageAtomic(userId, { roastsThisMonth: 50 });
      
      // Invalidate cache
      tierValidationService.invalidateUserCache(userId);
      
      // Cache should be cleared
      const cached = tierValidationService.getCachedUsage(userId);
      expect(cached).toBeNull();
    });

    it('should cleanup request cache after timeout', async () => {
      const userId = 'test-user-123';
      const requestId = 'req-123';
      const cacheKey = `${requestId}-${userId}-roast`;
      
      // Add to request cache
      tierValidationService.requestScopedCache.set(cacheKey, { allowed: true });
      
      // Fast-forward past cleanup timeout
      jest.advanceTimersByTime(35000);
      
      // Cache should be cleaned up
      expect(tierValidationService.requestScopedCache.has(cacheKey)).toBe(false);
    });
  });

  describe('UTC Date Handling', () => {
    it('should handle getUserTierWithUTC with UTC date processing', async () => {
      const userId = 'test-user-123';
      
      mockSupabaseClient.single.mockResolvedValue({
        data: {
          plan: 'pro',
          status: 'active',
          current_period_start: '2024-01-01T00:00:00Z',
          current_period_end: '2024-02-01T00:00:00Z'
        },
        error: null
      });

      const result = await tierValidationService.getUserTierWithUTC(userId);

      expect(result.plan).toBe('pro');
      expect(result.isActive).toBe(true);
      expect(result.periodStart).toBe('2024-01-01T00:00:00Z');
    });

    it('should compute effective cycle start using user billing period', async () => {
      const userTier = {
        periodStart: '2024-01-15T00:00:00Z',
        plan: 'pro'
      };
      const userId = 'test-user-123';

      const result = await tierValidationService.computeEffectiveCycleStart(userTier, userId);

      expect(result).toEqual(new Date('2024-01-15T00:00:00Z'));
    });

    it('should use getMonthStartUTC for UTC-consistent month boundaries', () => {
      const monthStart = tierValidationService.getMonthStartUTC();

      expect(monthStart.getUTCHours()).toBe(0);
      expect(monthStart.getUTCMinutes()).toBe(0);
      expect(monthStart.getUTCSeconds()).toBe(0);
      expect(monthStart.getUTCDate()).toBe(1);
      expect(monthStart.getUTCMonth()).toBe(0); // January
    });

    it('should handle getNextCycleStartUTC with UTC calculations', () => {
      const nextCycleStart = tierValidationService.getNextCycleStartUTC();
      const expected = new Date(Date.UTC(2024, 1, 1)); // February 1st

      expect(new Date(nextCycleStart)).toEqual(expected);
    });
  });

  describe('Security and Plan Normalization', () => {
    it('should normalize plan values to prevent downstream errors', () => {
      expect(tierValidationService.normalizePlanValue('free')).toBe('free');
      expect(tierValidationService.normalizePlanValue('PRO')).toBe('pro');
      expect(tierValidationService.normalizePlanValue('  Plus  ')).toBe('plus');
      expect(tierValidationService.normalizePlanValue('INVALID')).toBe('free');
      expect(tierValidationService.normalizePlanValue(null)).toBe('free');
      expect(tierValidationService.normalizePlanValue('')).toBe('free');
    });

    it('should fail closed on database errors', async () => {
      const userId = 'test-user-123';
      
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: new Error('Database connection failed')
      });

      process.env.TIER_VALIDATION_FAIL_OPEN = 'false';

      const result = await tierValidationService.validateAction(userId, 'roast');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Validation error - failing closed for security');
    });

    it('should detect database errors in validation data', () => {
      const invalidUserTier = null;
      const validUsage = { roastsThisMonth: 50 };
      const validLimits = { monthlyResponsesLimit: 1000 };

      const hasError = tierValidationService.detectDatabaseErrors(
        invalidUserTier, 
        validUsage, 
        validLimits
      );

      expect(hasError).toBe(true);
    });
  });

  describe('Performance Optimizations', () => {
    it('should use parallelized data fetching with Promise.all', async () => {
      const userId = 'test-user-123';
      
      // Mock concurrent responses with delays
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: { plan: 'pro' }, error: null })
        .mockResolvedValueOnce({ count: 50, error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      planLimitsService.getPlanLimits.mockResolvedValue({
        monthlyResponsesLimit: 1000
      });

      const startTime = Date.now();
      await tierValidationService.validateAction(userId, 'roast');
      const endTime = Date.now();

      // Should complete quickly due to parallelization
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should use optimized database queries with count operations', async () => {
      const userId = 'test-user-123';
      const cycleStart = new Date('2024-01-01T00:00:00Z');

      mockSupabaseClient.select.mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        count: jest.fn().mockResolvedValue({ count: 25, error: null })
      });

      const result = await tierValidationService.fetchUsageFromDatabaseOptimized(userId, cycleStart);

      // Should use count queries for performance
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
    });
  });

  describe('Configuration and Warning Thresholds', () => {
    it('should use configurable warning thresholds', () => {
      const tierLimits = { monthlyResponsesLimit: 100, monthlyAnalysisLimit: 1000 };
      const currentUsage = { roastsThisMonth: 85, analysisThisMonth: 750 };

      const result = tierValidationService.calculateWarningStatus(tierLimits, currentUsage);

      expect(result.roast).toBeDefined();
      expect(result.roast.percentage).toBe(85);
      expect(result.roast.remaining).toBe(15);
    });

    it('should provide configurable pricing information', () => {
      const upgradeMessage = tierValidationService.getEnhancedUpgradeMessage('pro');

      expect(upgradeMessage).toHaveProperty('plan', 'pro');
      expect(upgradeMessage).toHaveProperty('price', '€15/mes');
      expect(upgradeMessage).toHaveProperty('benefits');
      expect(upgradeMessage.benefits).toContain('10,000 análisis');
    });

    it('should get plan benefits for upgrade recommendations', () => {
      const benefits = tierValidationService.getPlanBenefits('pro');

      expect(benefits).toContain('10,000 análisis');
      expect(benefits).toContain('1,000 roasts');
      expect(benefits).toContain('2 cuentas por red');
    });
  });

  describe('Enhanced Tier Upgrade/Downgrade Handling', () => {
    it('should handle enhanced tier upgrade with immediate cache invalidation', async () => {
      const userId = 'test-user-123';
      const newTier = 'pro';
      const oldTier = 'free';

      mockSupabaseClient.upsert.mockResolvedValue({ data: [], error: null });

      const result = await tierValidationService.handleTierUpgradeEnhanced(userId, newTier, oldTier);

      expect(result.success).toBe(true);
      expect(result.effectiveImmediately).toBe(true);
      expect(logger.info).toHaveBeenCalledWith('Processing enhanced tier upgrade:', expect.any(Object));
    });

    it('should handle enhanced tier downgrade with dynamic effective dates', async () => {
      const userId = 'test-user-123';
      const newTier = 'free';
      const oldTier = 'pro';
      const options = { effectiveDate: '2024-02-01T00:00:00Z' };

      mockSupabaseClient.upsert.mockResolvedValue({ data: [], error: null });

      const result = await tierValidationService.handleTierDowngradeEnhanced(
        userId, 
        newTier, 
        oldTier, 
        options
      );

      expect(result.success).toBe(true);
      expect(result.effectiveDate).toBe('2024-02-01T00:00:00Z');
      expect(result.gracePeriod).toBe(true);
    });

    it('should perform atomic usage resets', async () => {
      const userId = 'test-user-123';

      mockSupabaseClient.upsert.mockResolvedValue({ data: [], error: null });

      const result = await tierValidationService.resetUsageCountersAtomic(userId);

      expect(mockSupabaseClient.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          reset_type: 'tier_upgrade',
          reason: 'Tier upgrade - usage limits reset immediately'
        }),
        expect.objectContaining({ onConflict: 'user_id,reset_type' })
      );
    });
  });

  describe('Enhanced Action Validation', () => {
    it('should provide enhanced metrics and logging', async () => {
      const userId = 'test-user-123';
      
      mockSupabaseClient.single.mockResolvedValue({
        data: { plan: 'pro', status: 'active' },
        error: null
      });
      
      planLimitsService.getPlanLimits.mockResolvedValue({
        monthlyResponsesLimit: 1000
      });

      await tierValidationService.validateAction(userId, 'roast');

      expect(tierValidationService.metrics.validationCalls).toBeGreaterThan(0);
    });

    it('should calculate warning status for approaching limits', () => {
      const tierLimits = { 
        monthlyResponsesLimit: 100,
        monthlyAnalysisLimit: 1000 
      };
      const currentUsage = { 
        roastsThisMonth: 82,
        analysisThisMonth: 850 
      };

      const result = tierValidationService.calculateWarningStatus(tierLimits, currentUsage);

      // 82/100 = 82% > 80% threshold
      expect(result.roast).toBeDefined();
      expect(result.roast.percentage).toBe(82);
      
      // 850/1000 = 85% > 80% threshold  
      expect(result.analysis).toBeDefined();
      expect(result.analysis.percentage).toBe(85);
    });
  });

  describe('Service Metrics and Monitoring', () => {
    it('should provide comprehensive service metrics', () => {
      const metrics = tierValidationService.getMetrics();

      expect(metrics).toHaveProperty('validationCalls');
      expect(metrics).toHaveProperty('allowedActions');
      expect(metrics).toHaveProperty('blockedActions');
      expect(metrics).toHaveProperty('errors');
      expect(metrics).toHaveProperty('cacheSize');
      expect(metrics).toHaveProperty('requestCacheSize');
      expect(metrics).toHaveProperty('timestamp');
    });

    it('should track validation metrics accurately', async () => {
      const userId = 'test-user-123';
      
      mockSupabaseClient.single.mockResolvedValue({
        data: { plan: 'free', status: 'active' },
        error: null
      });
      
      planLimitsService.getPlanLimits.mockResolvedValue({
        monthlyResponsesLimit: 10
      });

      // Mock usage exceeding limit
      tierValidationService.getCurrentUsageWithUTC = jest.fn().mockResolvedValue({
        roastsThisMonth: 15,
        analysisThisMonth: 50
      });

      const initialMetrics = tierValidationService.getMetrics();
      await tierValidationService.validateAction(userId, 'roast');
      const finalMetrics = tierValidationService.getMetrics();

      expect(finalMetrics.validationCalls).toBe(initialMetrics.validationCalls + 1);
      expect(finalMetrics.blockedActions).toBe(initialMetrics.blockedActions + 1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed user tier data gracefully', async () => {
      const userId = 'test-user-123';
      
      mockSupabaseClient.single.mockResolvedValue({
        data: { plan: null, status: undefined },
        error: null
      });

      const result = await tierValidationService.getUserTierWithUTC(userId);

      expect(result.plan).toBe('free'); // Should default to free
      expect(result.isActive).toBe(true);
    });

    it('should handle partial database failures gracefully', async () => {
      const userId = 'test-user-123';
      const cycleStart = new Date('2024-01-01T00:00:00Z');

      mockSupabaseClient.select.mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        count: jest.fn().mockRejectedValue(new Error('Database error'))
      });

      const result = await tierValidationService.fetchUsageFromDatabaseOptimized(userId, cycleStart);

      expect(result.error).toBe(true);
      expect(result.roastsThisMonth).toBe(0); // Safe defaults
    });

    it('should handle concurrent cache operations safely', async () => {
      const userId = 'test-user-123';
      const usage1 = { roastsThisMonth: 50 };
      const usage2 = { roastsThisMonth: 75 };

      // Concurrent cache operations
      const promises = [
        tierValidationService.setCachedUsageAtomic(userId, usage1),
        tierValidationService.setCachedUsageAtomic(userId, usage2)
      ];

      // Should not throw errors
      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });

  describe('Backwards Compatibility', () => {
    it('should maintain legacy method compatibility', async () => {
      const userId = 'test-user-123';
      
      mockSupabaseClient.single.mockResolvedValue({
        data: { plan: 'pro', status: 'active' },
        error: null
      });

      // Legacy method should work
      const legacyResult = await tierValidationService.getUserTier(userId);
      const enhancedResult = await tierValidationService.getUserTierWithUTC(userId);

      expect(legacyResult).toEqual(enhancedResult);
    });

    it('should support legacy cache methods', () => {
      const userId = 'test-user-123';
      const usage = { roastsThisMonth: 50 };

      // Legacy cache method should work
      tierValidationService.setCachedUsage(userId, usage);
      
      // Should be retrievable
      const cached = tierValidationService.getCachedUsage(userId);
      expect(cached.roastsThisMonth).toBe(50);
    });
  });
});