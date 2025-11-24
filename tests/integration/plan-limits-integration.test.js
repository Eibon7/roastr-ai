/**
 * Integration tests for Plan Limits system
 * Issue #99: Database-based plan limit configuration
 */

const { supabaseServiceClient } = require('../../src/config/supabase');
const planLimitsService = require('../../src/services/planLimitsService');
const workerNotificationService = require('../../src/services/workerNotificationService');
const authService = require('../../src/services/authService');

// Mock Supabase for integration testing
const mockSupabaseData = {
  pro: {
    plan_id: 'pro',
    max_roasts: 1000,
    monthly_responses_limit: 1000,
    max_platforms: 5,
    integrations_limit: 5,
    shield_enabled: true,
    custom_prompts: false,
    priority_support: true,
    api_access: false,
    analytics_enabled: true,
    custom_tones: false,
    dedicated_support: false,
    monthly_tokens_limit: 100000,
    daily_api_calls_limit: 1000,
    settings: {}
  },
  free: {
    plan_id: 'free',
    max_roasts: 100,
    monthly_responses_limit: 100,
    max_platforms: 1,
    integrations_limit: 2,
    shield_enabled: false,
    custom_prompts: false,
    priority_support: false,
    api_access: false,
    analytics_enabled: false,
    custom_tones: false,
    dedicated_support: false,
    monthly_tokens_limit: 10000,
    daily_api_calls_limit: 100,
    settings: {}
  }
};

let mockDatabaseCalls = 0;
let mockShouldFail = false;

jest.mock('../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn((field, value) => ({
          single: jest.fn(() => {
            mockDatabaseCalls++;
            if (mockShouldFail) {
              return Promise.resolve({
                data: null,
                error: new Error('Database connection failed')
              });
            }
            const data = mockSupabaseData[value] || mockSupabaseData.free;
            return Promise.resolve({ data, error: null });
          })
        })),
        order: jest.fn(() => ({
          data: [mockSupabaseData.free, mockSupabaseData.pro],
          error: null
        }))
      })),
      update: jest.fn((updateData) => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => {
              mockDatabaseCalls++;
              // Simulate updating the data
              const updatedData = { ...mockSupabaseData.pro, ...updateData };
              return Promise.resolve({ data: updatedData, error: null });
            })
          }))
        }))
      }))
    }))
  }
}));

describe('Plan Limits Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    planLimitsService.clearCache();

    // Reset mock state
    mockDatabaseCalls = 0;
    mockShouldFail = false;

    // Enable fail-open mode for testing (return requested plan defaults on DB failure)
    process.env.PLAN_LIMITS_FAIL_OPEN = 'true';
  });

  describe('End-to-end plan limits flow', () => {
    it('should work across all services', async () => {
      // 1. PlanLimitsService should fetch from database
      const limits = await planLimitsService.getPlanLimits('pro');
      expect(limits.maxRoasts).toBe(1000);
      expect(limits.shieldEnabled).toBe(true);

      // 2. WorkerNotificationService should use plan limits
      const result = await workerNotificationService.notifyPlanChange(
        'user-123',
        'free',
        'pro',
        'active'
      );
      expect(result.success).toBe(true);

      // 3. AuthService should get async plan limits
      const authLimits = await authService.getPlanLimits('pro');
      expect(authLimits.monthly_messages).toBe(1000);
      expect(authLimits.monthly_tokens).toBe(100000);
    });

    it('should handle database failures gracefully', async () => {
      // Set mock to fail
      mockShouldFail = true;

      // Services should fall back to default values
      const limits = await planLimitsService.getPlanLimits('pro');
      expect(limits.maxRoasts).toBe(1000); // Default pro value
      expect(limits.shieldEnabled).toBe(true);

      const authLimits = await authService.getPlanLimits('pro');
      expect(authLimits.monthly_messages).toBe(1000);
    });
  });

  describe('Cache behavior integration', () => {
    it('should cache limits across service calls', async () => {
      // First call to planLimitsService
      await planLimitsService.getPlanLimits('pro');
      expect(mockDatabaseCalls).toBe(1);

      // Second call should use cache
      await planLimitsService.getPlanLimits('pro');

      // Should still be only 1 database call due to caching
      expect(mockDatabaseCalls).toBe(1);
    });

    it('should refresh cache after update', async () => {
      // Initial fetch
      await planLimitsService.getPlanLimits('pro');
      expect(mockDatabaseCalls).toBe(1);

      // Update should clear cache and internally call getPlanLimits
      await planLimitsService.updatePlanLimits('pro', { max_roasts: 2000 }, 'admin-123');
      expect(mockDatabaseCalls).toBe(3); // 1 initial + 1 update + 1 internal getPlanLimits

      // Next fetch should use the cached result from updatePlanLimits
      await planLimitsService.getPlanLimits('pro');

      // Should still be 3 calls since getPlanLimits was cached by updatePlanLimits
      expect(mockDatabaseCalls).toBe(3);
    });
  });

  describe('Plan validation integration', () => {
    it('should validate plan IDs consistently', async () => {
      // Valid plans
      const validPlans = ['free', 'starter', 'pro', 'plus', 'custom'];

      for (const plan of validPlans) {
        const limits = await planLimitsService.getPlanLimits(plan);
        expect(limits).toBeDefined();
        expect(limits.maxRoasts).toBeGreaterThanOrEqual(-1); // -1 means unlimited
      }
    });

    it('should handle unknown plans consistently', async () => {
      // Unknown plan should return free plan defaults
      const limits = await planLimitsService.getPlanLimits('unknown_plan');
      expect(limits.maxRoasts).toBe(100); // Free plan default
      expect(limits.shieldEnabled).toBe(false);
    });
  });

  describe('Limit checking integration', () => {
    it('should check limits correctly', async () => {
      // Under limit
      const underLimit = await planLimitsService.checkLimit('pro', 'roasts', 500);
      expect(underLimit).toBe(false);

      // At limit
      const atLimit = await planLimitsService.checkLimit('pro', 'roasts', 1000);
      expect(atLimit).toBe(true);

      // Over limit
      const overLimit = await planLimitsService.checkLimit('pro', 'roasts', 1500);
      expect(overLimit).toBe(true);
    });

    it('should handle plan limits correctly', async () => {
      // Add plus data with 5000 roasts limit to mock data
      const originalMockData = { ...mockSupabaseData };
      mockSupabaseData.plus = {
        plan_id: 'plus',
        max_roasts: 5000,
        monthly_responses_limit: 5000,
        shield_enabled: true
      };

      const isOverLimit = await planLimitsService.checkLimit('plus', 'roasts', 4999);
      expect(isOverLimit).toBe(false); // Should be within the 5000 limit

      // Restore original mock data
      Object.assign(mockSupabaseData, originalMockData);
    });
  });

  describe('Service compatibility', () => {
    it('should maintain backward compatibility with old plan names', async () => {
      // AuthService maps 'basic' to 'free'
      const basicLimits = await authService.getPlanLimits('basic');
      expect(basicLimits.monthly_messages).toBeDefined();
      expect(basicLimits.monthly_tokens).toBeDefined();
    });

    it('should handle async conversion properly', async () => {
      // All services should now handle async getPlanLimits
      const promises = [
        planLimitsService.getPlanLimits('pro'),
        authService.getPlanLimits('pro'),
        workerNotificationService.getPlanLimits('pro', 'active')
      ];

      const results = await Promise.all(promises);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
      });
    });
  });

  describe('Error handling integration', () => {
    it('should handle partial database failures', async () => {
      // First call - simulate failure
      mockShouldFail = true;
      const limits1 = await planLimitsService.getPlanLimits('pro');
      expect(limits1.maxRoasts).toBe(1000); // Fallback value

      // Clear cache to force second database call
      planLimitsService.clearCache();

      // Second call - simulate success
      mockShouldFail = false;
      const limits2 = await planLimitsService.getPlanLimits('pro');
      expect(limits2.maxRoasts).toBe(1000); // Database value
    });

    it('should log errors appropriately', async () => {
      const { logger } = require('../../src/utils/logger');
      jest.spyOn(logger, 'error');

      // Force database error
      mockShouldFail = true;

      await planLimitsService.getPlanLimits('pro');
      expect(logger.error).toHaveBeenCalledWith('Failed to fetch plan limits:', expect.any(Error));

      logger.error.mockRestore();
    });
  });
});
