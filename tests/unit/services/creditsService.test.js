/**
 * Credits Service Unit Tests
 * 
 * Tests for the dual credit system including:
 * - Credit consumption and availability checks
 * - Billing period management
 * - Feature flag integration
 * - Error handling and fallbacks
 */

const creditsService = require('../../../src/services/creditsService');
const { createUserClient } = require('../../../src/config/supabase');
const { flags } = require('../../../src/config/flags');
const planService = require('../../../src/services/planService');

// Mock dependencies
jest.mock('../../../src/config/supabase');
jest.mock('../../../src/config/flags');
jest.mock('../../../src/services/planService');
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('CreditsService', () => {
  let mockUserClient;
  const testUserId = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Supabase client
    mockUserClient = {
      rpc: jest.fn(),
      from: jest.fn(() => ({
        insert: jest.fn(),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn(() => ({
                gte: jest.fn(() => ({
                  lte: jest.fn()
                }))
              }))
            }))
          }))
        }))
      }))
    };
    
    createUserClient.mockReturnValue(mockUserClient);
    
    // Default: Credits v2 enabled
    flags.isEnabled.mockImplementation((flag) => {
      if (flag === 'ENABLE_CREDITS_V2') return true;
      return false;
    });
    
    // Mock plan service
    planService.getUserPlan.mockResolvedValue('pro');
  });

  describe('getOrCreateActivePeriod', () => {
    it('should return active period when credits v2 is enabled', async () => {
      const mockPeriod = {
        period_start: '2024-01-01T00:00:00Z',
        period_end: '2024-02-01T00:00:00Z',
        analysis_used: 50,
        analysis_limit: 10000,
        roast_used: 5,
        roast_limit: 1000
      };

      mockUserClient.rpc.mockResolvedValue({ data: mockPeriod, error: null });

      const result = await creditsService.getOrCreateActivePeriod(testUserId);

      expect(mockUserClient.rpc).toHaveBeenCalledWith('get_or_create_active_period', {
        p_user_id: testUserId,
        p_analysis_limit: null,
        p_roast_limit: null
      });

      expect(result).toEqual({
        period_start: mockPeriod.period_start,
        period_end: mockPeriod.period_end,
        analysis: {
          used: 50,
          limit: 10000,
          remaining: 9950
        },
        roast: {
          used: 5,
          limit: 1000,
          remaining: 995
        }
      });
    });

    it('should return fallback period when credits v2 is disabled', async () => {
      flags.isEnabled.mockReturnValue(false);

      const result = await creditsService.getOrCreateActivePeriod(testUserId);

      expect(result).toHaveProperty('fallback', true);
      expect(result).toHaveProperty('analysis');
      expect(result).toHaveProperty('roast');
      expect(result.analysis.limit).toBe(10000); // Pro plan limits
      expect(result.roast.limit).toBe(1000);
    });

    it('should handle database errors gracefully', async () => {
      mockUserClient.rpc.mockResolvedValue({ 
        data: null, 
        error: new Error('Database connection failed') 
      });

      const result = await creditsService.getOrCreateActivePeriod(testUserId);

      expect(result).toHaveProperty('fallback', true);
    });
  });

  describe('canConsume', () => {
    it('should return true when sufficient credits available', async () => {
      const mockPeriod = {
        analysis: { used: 50, limit: 10000, remaining: 9950 },
        roast: { used: 5, limit: 1000, remaining: 995 },
        period_end: '2024-02-01T00:00:00Z'
      };

      jest.spyOn(creditsService, 'getOrCreateActivePeriod')
        .mockResolvedValue(mockPeriod);

      const result = await creditsService.canConsume(testUserId, 'analysis', 100);

      expect(result).toEqual({
        canConsume: true,
        remaining: 9950,
        limit: 10000,
        used: 50,
        reason: null,
        periodEnd: '2024-02-01T00:00:00Z'
      });
    });

    it('should return false when insufficient credits', async () => {
      const mockPeriod = {
        analysis: { used: 9990, limit: 10000, remaining: 10 },
        roast: { used: 5, limit: 1000, remaining: 995 },
        period_end: '2024-02-01T00:00:00Z'
      };

      jest.spyOn(creditsService, 'getOrCreateActivePeriod')
        .mockResolvedValue(mockPeriod);

      const result = await creditsService.canConsume(testUserId, 'analysis', 100);

      expect(result).toEqual({
        canConsume: false,
        remaining: 10,
        limit: 10000,
        used: 9990,
        reason: 'insufficient_credits',
        periodEnd: '2024-02-01T00:00:00Z'
      });
    });

    it('should fail open when credits v2 is disabled', async () => {
      flags.isEnabled.mockReturnValue(false);

      const result = await creditsService.canConsume(testUserId, 'analysis', 100);

      expect(result).toEqual({
        canConsume: true,
        reason: 'credits_v2_disabled'
      });
    });
  });

  describe('consume', () => {
    it('should consume credits successfully', async () => {
      mockUserClient.rpc.mockResolvedValue({ data: true, error: null });

      const result = await creditsService.consume(testUserId, 'analysis', {
        amount: 5,
        actionType: 'gatekeeper_check',
        platform: 'twitter'
      });

      expect(result).toBe(true);
      expect(mockUserClient.rpc).toHaveBeenCalledWith('consume_credits', {
        p_user_id: testUserId,
        p_credit_type: 'analysis',
        p_amount: 5,
        p_action_type: 'gatekeeper_check',
        p_platform: 'twitter',
        p_metadata: {}
      });
    });

    it('should return false when consumption fails', async () => {
      mockUserClient.rpc.mockResolvedValue({ data: false, error: null });

      const result = await creditsService.consume(testUserId, 'roast', {
        amount: 1,
        actionType: 'roast_generation'
      });

      expect(result).toBe(false);
    });

    it('should fail open when credits v2 is disabled', async () => {
      flags.isEnabled.mockReturnValue(false);

      const result = await creditsService.consume(testUserId, 'analysis');

      expect(result).toBe(true);
      expect(mockUserClient.rpc).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockUserClient.rpc.mockResolvedValue({ 
        data: null, 
        error: new Error('Database error') 
      });

      const result = await creditsService.consume(testUserId, 'analysis');

      expect(result).toBe(false);
    });
  });

  describe('resetCreditsForNewPeriod', () => {
    it('should reset credits for new billing period', async () => {
      const billingPeriod = {
        start: '2024-02-01T00:00:00Z',
        end: '2024-03-01T00:00:00Z',
        stripeCustomerId: 'cus_test123'
      };

      mockUserClient.from().insert.mockResolvedValue({ error: null });

      const result = await creditsService.resetCreditsForNewPeriod(testUserId, billingPeriod);

      expect(result).toBe(true);
      expect(mockUserClient.from).toHaveBeenCalledWith('usage_counters');
    });

    it('should skip reset when credits v2 is disabled', async () => {
      flags.isEnabled.mockReturnValue(false);

      const result = await creditsService.resetCreditsForNewPeriod(testUserId, {});

      expect(result).toBe(true);
      expect(mockUserClient.from).not.toHaveBeenCalled();
    });
  });

  describe('getConsumptionHistory', () => {
    it('should return consumption history', async () => {
      const mockHistory = [
        {
          id: 1,
          credit_type: 'analysis',
          amount_consumed: 1,
          action_type: 'gatekeeper_check',
          consumed_at: '2024-01-15T10:00:00Z'
        }
      ];

      const mockQuery = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({ data: mockHistory, error: null })
      };

      mockUserClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue(mockQuery)
      });

      const result = await creditsService.getConsumptionHistory(testUserId, {
        creditType: 'analysis',
        limit: 10
      });

      expect(result).toEqual(mockHistory);
    });

    it('should return empty array when credits v2 is disabled', async () => {
      flags.isEnabled.mockReturnValue(false);

      const result = await creditsService.getConsumptionHistory(testUserId);

      expect(result).toEqual([]);
    });
  });

  describe('plan limits mapping', () => {
    it('should map plan names to correct limits', async () => {
      const testCases = [
        { plan: 'free', expected: { analysisLimit: 100, roastLimit: 10 } },
        { plan: 'starter', expected: { analysisLimit: 1000, roastLimit: 10 } },
        { plan: 'pro', expected: { analysisLimit: 10000, roastLimit: 1000 } },
        { plan: 'plus', expected: { analysisLimit: 100000, roastLimit: 5000 } },
        { plan: 'creator_plus', expected: { analysisLimit: 100000, roastLimit: 5000 } },
        { plan: 'unknown', expected: { analysisLimit: 100, roastLimit: 10 } } // fallback to free
      ];

      for (const testCase of testCases) {
        planService.getUserPlan.mockResolvedValue(testCase.plan);

        // Access private method for testing
        const limits = creditsService._mapPlanToLimits(testCase.plan);
        expect(limits).toEqual(testCase.expected);
      }
    });
  });

  describe('concurrency and race conditions', () => {
    it('should handle concurrent consumption attempts', async () => {
      // Simulate multiple concurrent consumption attempts
      const consumptionPromises = Array.from({ length: 10 }, (_, i) =>
        creditsService.consume(testUserId, 'analysis', {
          amount: 1,
          actionType: `concurrent_test_${i}`
        })
      );

      // Mock database function to succeed for first 5, fail for rest
      let callCount = 0;
      mockUserClient.rpc.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          data: callCount <= 5,
          error: null
        });
      });

      const results = await Promise.all(consumptionPromises);

      // First 5 should succeed, rest should fail
      expect(results.slice(0, 5)).toEqual(Array(5).fill(true));
      expect(results.slice(5)).toEqual(Array(5).fill(false));
    });
  });
});
