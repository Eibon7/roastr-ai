/**
 * Unit Tests for TierValidationService - CodeRabbit Round 5 Improvements
 *
 * Tests the enhanced features added in CodeRabbit Round 5:
 * 1. Fail-closed for unknown features
 * 2. Enhanced plan normalization
 * 3. Enhanced UTC date handling
 * 4. Enhanced usage response
 * 5. Effective cycle start with upgrade resets
 * 6. Enhanced tier downgrade
 * 7. Atomic usage recording
 * 8. Enhanced error handling
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
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(),
    upsert: jest.fn(),
    insert: jest.fn()
  }
}));

describe('TierValidationService - CodeRabbit Round 5 Improvements', () => {
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

  describe('1. Fail-closed for unknown features', () => {
    it('should return fail-closed response for unknown feature', () => {
      const tierLimits = { customTones: true };
      const result = tierValidationService.checkFeatureAccess('unknown_feature', tierLimits, 'pro');

      expect(result).toEqual({
        available: false,
        reason: 'unknown_feature',
        message: "Feature 'unknown_feature' is not recognized"
      });
    });

    it('should return fail-closed response for null feature', () => {
      const tierLimits = { customTones: true };
      const result = tierValidationService.checkFeatureAccess(null, tierLimits, 'pro');

      expect(result).toEqual({
        available: false,
        reason: 'unknown_feature',
        message: "Feature 'null' is not recognized"
      });
    });

    it('should return fail-closed response for undefined feature', () => {
      const tierLimits = { customTones: true };
      const result = tierValidationService.checkFeatureAccess(undefined, tierLimits, 'pro');

      expect(result).toEqual({
        available: false,
        reason: 'unknown_feature',
        message: "Feature 'undefined' is not recognized"
      });
    });

    it('should work correctly for known features', () => {
      const tierLimits = { customTones: true };
      const result = tierValidationService.checkFeatureAccess('custom_tones', tierLimits, 'pro');

      expect(result).toEqual({
        available: true
      });
    });
  });

  describe('2. Enhanced plan normalization', () => {
    it('should normalize valid plan values correctly', async () => {
      const validPlans = ['free', 'starter', 'pro', 'plus'];

      for (const plan of validPlans) {
        mockSupabaseClient.single.mockResolvedValue({
          data: {
            plan: plan,
            status: 'active',
            current_period_start: '2024-01-01T00:00:00Z',
            current_period_end: '2024-02-01T00:00:00Z'
          },
          error: null
        });

        const result = await tierValidationService.getUserTierWithUTC('user-123');
        expect(result.plan).toBe(plan);
      }
    });

    it('should default invalid plan values to free', async () => {
      const invalidPlans = [null, undefined, 'invalid_plan', 123, { type: 'pro' }];

      for (const invalidPlan of invalidPlans) {
        mockSupabaseClient.single.mockResolvedValue({
          data: {
            plan: invalidPlan,
            status: 'active',
            current_period_start: '2024-01-01T00:00:00Z',
            current_period_end: '2024-02-01T00:00:00Z'
          },
          error: null
        });

        const result = await tierValidationService.getUserTierWithUTC('user-123');
        expect(result.plan).toBe('free');
      }
    });
  });

  describe('3. Enhanced UTC date handling', () => {
    it('should calculate next cycle start from current date when no period end provided', () => {
      const result = tierValidationService.getNextCycleStartUTC();
      const expected = new Date(Date.UTC(2024, 1, 1)); // February 1st, 2024

      expect(result).toBe(expected.toISOString());
    });

    it('should calculate next cycle start from provided period end', () => {
      const periodEndIso = '2024-06-30T23:59:59Z';
      const result = tierValidationService.getNextCycleStartUTC(periodEndIso);
      const expected = new Date('2024-07-01T00:00:00Z');

      expect(result).toBe(expected.toISOString());
    });

    it('should handle leap year February correctly', () => {
      const periodEndIso = '2024-02-29T23:59:59Z';
      const result = tierValidationService.getNextCycleStartUTC(periodEndIso);
      const expected = new Date('2024-03-01T00:00:00Z');

      expect(result).toBe(expected.toISOString());
    });

    it('should handle end of year transition', () => {
      const periodEndIso = '2024-12-31T23:59:59Z';
      const result = tierValidationService.getNextCycleStartUTC(periodEndIso);
      const expected = new Date('2025-01-01T00:00:00Z');

      expect(result).toBe(expected.toISOString());
    });
  });

  describe('4. Enhanced usage response', () => {
    it('should include platformAccountsByPlatform and totalActivePlatformAccounts', () => {
      const usage = {
        roastsThisMonth: 5,
        analysisThisMonth: 10,
        platformAccounts: {
          twitter: 2,
          youtube: 1,
          instagram: 1
        }
      };

      const result = tierValidationService.sanitizeUsageForResponse(usage);

      expect(result).toEqual({
        roastsThisMonth: 5,
        analysisThisMonth: 10,
        platformAccountsByPlatform: {
          twitter: 2,
          youtube: 1,
          instagram: 1
        },
        totalActivePlatformAccounts: 4,
        platformAccounts: 3 // Legacy field for backward compatibility
      });
    });

    it('should handle empty platform accounts gracefully', () => {
      const usage = {
        roastsThisMonth: 0,
        analysisThisMonth: 0,
        platformAccounts: {}
      };

      const result = tierValidationService.sanitizeUsageForResponse(usage);

      expect(result).toEqual({
        roastsThisMonth: 0,
        analysisThisMonth: 0,
        platformAccountsByPlatform: {},
        totalActivePlatformAccounts: 0,
        platformAccounts: 0
      });
    });

    it('should handle null platform accounts', () => {
      const usage = {
        roastsThisMonth: 5,
        analysisThisMonth: 10,
        platformAccounts: null
      };

      const result = tierValidationService.sanitizeUsageForResponse(usage);

      expect(result).toEqual({
        roastsThisMonth: 5,
        analysisThisMonth: 10,
        platformAccountsByPlatform: {},
        totalActivePlatformAccounts: 0,
        platformAccounts: 0
      });
    });
  });

  describe('5. Effective cycle start with upgrade resets', () => {
    it('should use billing period start when no reset marker exists', async () => {
      const userTier = {
        periodStart: '2024-01-01T00:00:00Z',
        plan: 'pro'
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await tierValidationService.computeEffectiveCycleStart(userTier, 'user-123');
      expect(result).toEqual(new Date('2024-01-01T00:00:00Z'));
    });

    it('should use reset timestamp when it is after billing period start', async () => {
      const userTier = {
        periodStart: '2024-01-01T00:00:00Z',
        plan: 'pro'
      };

      const resetData = {
        reset_timestamp: '2024-01-15T00:00:00Z'
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: resetData,
        error: null
      });

      const result = await tierValidationService.computeEffectiveCycleStart(userTier, 'user-123');
      expect(result).toEqual(new Date('2024-01-15T00:00:00Z'));
    });

    it('should use billing period start when reset timestamp is before it', async () => {
      const userTier = {
        periodStart: '2024-01-15T00:00:00Z',
        plan: 'pro'
      };

      const resetData = {
        reset_timestamp: '2024-01-01T00:00:00Z'
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: resetData,
        error: null
      });

      const result = await tierValidationService.computeEffectiveCycleStart(userTier, 'user-123');
      expect(result).toEqual(new Date('2024-01-15T00:00:00Z'));
    });

    it('should handle database errors gracefully', async () => {
      const userTier = {
        periodStart: '2024-01-01T00:00:00Z',
        plan: 'pro'
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: new Error('Database error')
      });

      const result = await tierValidationService.computeEffectiveCycleStart(userTier, 'user-123');
      expect(result).toEqual(new Date('2024-01-01T00:00:00Z'));
    });
  });

  describe('6. Enhanced tier downgrade', () => {
    it('should use actual billing period end date', async () => {
      const userTier = {
        current_period_end: '2024-06-30T23:59:59Z'
      };

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: userTier,
        error: null
      });

      mockSupabaseClient.upsert.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await tierValidationService.handleTierDowngradeEnhanced(
        'user-123',
        'free',
        'pro',
        {}
      );

      expect(result.success).toBe(true);
      expect(result.billingPeriodEnd).toBe('2024-06-30T23:59:59Z');
    });

    it('should handle enhanced error handling', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { periodEnd: '2024-06-30T23:59:59Z' },
        error: null
      });

      mockSupabaseClient.upsert.mockResolvedValue({
        data: null,
        error: new Error('Database error')
      });

      await expect(
        tierValidationService.handleTierDowngradeEnhanced('user-123', 'free', 'pro', {})
      ).rejects.toThrow('Database error');
    });
  });

  describe('7. Atomic usage recording', () => {
    it('should record usage action atomically', async () => {
      const mockResult = { success: true };

      mockSupabaseClient.insert.mockResolvedValue({
        data: mockResult,
        error: null
      });

      const result = await tierValidationService.recordUsageActionAtomic(
        'user-123',
        'roast_generated',
        { comment_id: 'comment-123' }
      );

      expect(result).toBe(true);
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          activity_type: 'roast_generated',
          metadata: expect.objectContaining({
            comment_id: 'comment-123',
            service_version: 'tier_validation_v1'
          })
        })
      );
    });

    it('should handle atomic recording errors gracefully', async () => {
      mockSupabaseClient.insert.mockResolvedValue({
        data: null,
        error: new Error('Database error')
      });

      const result = await tierValidationService.recordUsageActionAtomic(
        'user-123',
        'roast_generated',
        {}
      );

      expect(result).toBe(false);
    });

    it('should record batch usage actions', async () => {
      const actions = [
        { actionType: 'roast_generated', metadata: { batch: 1 } },
        { actionType: 'analysis_performed', metadata: { batch: 1 } }
      ];

      mockSupabaseClient.insert.mockResolvedValue({
        data: { success: true },
        error: null
      });

      const result = await tierValidationService.recordUsageActionsBatch('user-123', actions);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should handle empty actions array', async () => {
      const result = await tierValidationService.recordUsageActionsBatch('user-123', []);

      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('8. Enhanced error handling', () => {
    describe('Database connection errors', () => {
      it('should handle connection timeout errors', async () => {
        const timeoutError = new Error('Connection timeout');
        timeoutError.code = 'ETIMEDOUT';

        mockSupabaseClient.single.mockResolvedValue({
          data: null,
          error: timeoutError
        });

        const result = await tierValidationService.validateAction('user-123', 'roast');

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('Validation error - failing closed for security');
      });

      it('should handle connection refused errors', async () => {
        const connectionError = new Error('Connection refused');
        connectionError.code = 'ECONNREFUSED';

        mockSupabaseClient.single.mockResolvedValue({
          data: null,
          error: connectionError
        });

        const result = await tierValidationService.validateAction('user-123', 'roast');

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('Validation error - failing closed for security');
      });
    });

    describe('Database constraint errors', () => {
      it('should handle foreign key constraint violations', async () => {
        const fkError = new Error('foreign key constraint violation');
        fkError.code = '23503';

        mockSupabaseClient.insert.mockResolvedValue({
          data: null,
          error: fkError
        });

        const result = await tierValidationService.recordUsageActionAtomic(
          'user-123',
          'roast_generated',
          {}
        );

        expect(result).toBe(false);
      });

      it('should handle unique constraint violations', async () => {
        const uniqueError = new Error('unique constraint violation');
        uniqueError.code = '23505';

        mockSupabaseClient.insert.mockResolvedValue({
          data: null,
          error: uniqueError
        });

        const result = await tierValidationService.recordUsageActionAtomic(
          'user-123',
          'roast_generated',
          {}
        );

        expect(result).toBe(false);
      });
    });

    describe('Fallback mechanisms', () => {
      it('should provide fallback values for failed database calls', () => {
        const usage = null; // Simulate failed database response

        const result = tierValidationService.sanitizeUsageForResponse(usage);

        expect(result.platformAccountsByPlatform).toEqual({});
        expect(result.totalActivePlatformAccounts).toBe(0);
      });

      it('should gracefully degrade on unexpected data formats', () => {
        const usage = {
          roastsThisMonth: null,
          analysisThisMonth: undefined,
          platformAccounts: 'invalid'
        };

        const result = tierValidationService.sanitizeUsageForResponse(usage);

        expect(result.roastsThisMonth).toBeDefined();
        expect(result.analysisThisMonth).toBeDefined();
        expect(result.platformAccountsByPlatform).toEqual({});
      });
    });
  });

  describe('Performance and stress testing', () => {
    it('should handle large platform accounts dataset efficiently', () => {
      const largePlatformAccountsSet = {};
      for (let i = 0; i < 1000; i++) {
        largePlatformAccountsSet[`platform_${i % 10}`] = Math.floor(i / 10);
      }

      const usage = {
        roastsThisMonth: 5,
        analysisThisMonth: 10,
        platformAccounts: largePlatformAccountsSet
      };

      const startTime = Date.now();
      const result = tierValidationService.sanitizeUsageForResponse(usage);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
      expect(result.totalActivePlatformAccounts).toBeGreaterThan(0);
      expect(Object.keys(result.platformAccountsByPlatform)).toHaveLength(10);
    });

    it('should handle rapid successive calls without degradation', async () => {
      const tierLimits = { customTones: true };

      const promises = Array.from({ length: 50 }, () =>
        tierValidationService.checkFeatureAccess('custom_tones', tierLimits, 'pro')
      );

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
      results.forEach((result) => {
        expect(result.available).toBe(true);
      });
    });
  });
});
