/**
 * Cost Control Service Tests
 * 
 * Tests for multi-tenant cost management and usage tracking
 */

const CostControlService = require('../../../src/services/costControl');

// Create comprehensive mocks for Supabase query builder pattern
const mockSelectSingle = jest.fn();
const mockSelectOrder = jest.fn();
const mockSelect = jest.fn(() => ({
  eq: jest.fn(() => ({
    single: mockSelectSingle,
    eq: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: mockSelectSingle
      }))
    })),
    gte: jest.fn(() => ({
      lt: mockSelectOrder,
      order: jest.fn(() => ({
        order: mockSelectOrder
      }))
    }))
  }))
}));

const mockInsertSelect = jest.fn();
const mockInsert = jest.fn(() => ({
  select: jest.fn(() => ({
    single: mockInsertSelect
  }))
}));

const mockUpdateSelect = jest.fn();
const mockUpdate = jest.fn(() => ({
  eq: jest.fn(() => ({
    select: jest.fn(() => ({
      single: mockUpdateSelect
    }))
  }))
}));

const mockFrom = jest.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate
}));

const mockRpc = jest.fn();

const mockSupabaseClient = {
  from: mockFrom,
  rpc: mockRpc
};

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));

describe('CostControlService', () => {
  let costControl;

  beforeEach(() => {
    // Mock environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-key';
    
    // Clear all mocks
    jest.clearAllMocks();
    
    costControl = new CostControlService();
  });

  describe('canPerformOperation', () => {
    test('should allow operation when under limit', async () => {
      // Mock organization data (first call)
      mockSelectSingle
        .mockResolvedValueOnce({
          data: {
            plan_id: 'free',
            monthly_responses_limit: 100,
            monthly_responses_used: 50
          },
          error: null
        })
        // Mock monthly usage data (second call)
        .mockResolvedValueOnce({
          data: {
            total_responses: 50
          },
          error: null
        });

      const result = await costControl.canPerformOperation('test-org-123');

      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(50);
      expect(result.limit).toBe(100);
      expect(result.percentage).toBe(50);
    });

    test('should deny operation when over limit', async () => {
      // Mock organization data (first call) and monthly usage data (second call)
      mockSelectSingle
        .mockResolvedValueOnce({
          data: {
            plan_id: 'free',
            monthly_responses_limit: 100,
            monthly_responses_used: 105
          },
          error: null
        })
        .mockResolvedValueOnce({
          data: {
            total_responses: 105
          },
          error: null
        });

      const result = await costControl.canPerformOperation('test-org-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('monthly_limit_exceeded');
      expect(result.currentUsage).toBe(105);
      expect(result.limit).toBe(100);
    });
  });

  describe('recordUsage', () => {
    test('should record usage and increment counters for billable operations', async () => {
      const mockUsageRecord = {
        id: 'test-usage-123',
        organization_id: 'test-org-123',
        platform: 'twitter',
        action_type: 'generate_reply',
        tokens_used: 25,
        cost_cents: 5
      };

      // Mock the insert operation
      mockInsertSelect.mockResolvedValue({
        data: mockUsageRecord,
        error: null
      });

      // Mock RPC call for incrementing counters
      mockRpc.mockResolvedValue({ error: null });

      // Mock checkUsageLimit call (called by incrementUsageCounters)
      mockSelectSingle
        .mockResolvedValueOnce({
          data: {
            plan_id: 'pro',
            monthly_responses_limit: 1000,
            monthly_responses_used: 25
          },
          error: null
        })
        .mockResolvedValueOnce({
          data: { total_responses: 25 },
          error: null
        });

      const result = await costControl.recordUsage(
        'test-org-123',
        'twitter',
        'generate_reply',
        { tokensUsed: 25 }
      );

      expect(result.recorded).toBe(true);
      expect(result.cost).toBe(5); // 5 cents for generate_reply
      expect(mockFrom).toHaveBeenCalledWith('usage_records');
      expect(mockRpc).toHaveBeenCalledWith('increment_usage', {
        org_id: 'test-org-123',
        platform_name: 'twitter',
        cost: 5
      });
    });

    test('should record free operations without incrementing counters', async () => {
      const mockUsageRecord = {
        id: 'test-usage-124',
        organization_id: 'test-org-123',
        platform: 'twitter',
        action_type: 'fetch_comment',
        tokens_used: 0,
        cost_cents: 0
      };

      // Mock the insert operation
      mockInsertSelect.mockResolvedValue({
        data: mockUsageRecord,
        error: null
      });

      const result = await costControl.recordUsage(
        'test-org-123',
        'twitter',
        'fetch_comment'
      );

      expect(result.recorded).toBe(true);
      expect(result.cost).toBe(0); // Free operation
      expect(mockRpc).not.toHaveBeenCalled(); // No counter increment for free ops
    });
  });

  describe('canUseShield', () => {
    test('should allow Shield for pro plan', async () => {
      mockSelectSingle.mockResolvedValue({
        data: {
          plan_id: 'pro'
        },
        error: null
      });

      const result = await costControl.canUseShield('test-org-123');

      expect(result.allowed).toBe(true);
      expect(result.planId).toBe('pro');
      expect(result.planName).toBe('Pro');
    });

    test('should deny Shield for free plan', async () => {
      mockSelectSingle.mockResolvedValue({
        data: {
          plan_id: 'free'
        },
        error: null
      });

      const result = await costControl.canUseShield('test-org-123');

      expect(result.allowed).toBe(false);
      expect(result.planId).toBe('free');
      expect(result.planName).toBe('Free');
    });
  });

  describe('upgradePlan', () => {
    test('should upgrade organization plan successfully', async () => {
      const mockOrg = {
        id: 'test-org-123',
        plan_id: 'pro',
        monthly_responses_limit: 1000,
        stripe_subscription_id: 'sub_123',
        subscription_status: 'active'
      };

      // Mock the update operation for organizations table
      mockUpdateSelect.mockResolvedValueOnce({
        data: mockOrg,
        error: null
      });

      // Mock the insert operation for app_logs table
      mockInsertSelect.mockResolvedValueOnce({ error: null });

      const result = await costControl.upgradePlan('test-org-123', 'pro', 'sub_123');

      expect(result.success).toBe(true);
      expect(result.newPlan.id).toBe('pro');
      expect(result.newPlan.name).toBe('Pro');
    });

    test('should reject invalid plan upgrade', async () => {
      await expect(
        costControl.upgradePlan('test-org-123', 'invalid_plan')
      ).rejects.toThrow('Invalid plan ID: invalid_plan');
    });
  });

  describe('getUsageStats', () => {
    test('should return comprehensive usage statistics', async () => {
      const mockMonthlyStats = [
        {
          year: 2024,
          month: 1,
          total_responses: 50,
          total_cost_cents: 250,
          responses_by_platform: { twitter: 30, youtube: 20 }
        }
      ];

      const mockOrg = {
        plan_id: 'pro',
        monthly_responses_limit: 1000,
        monthly_responses_used: 50
      };

      const mockUsageRecords = [
        {
          platform: 'twitter',
          action_type: 'generate_reply',
          cost_cents: 5
        },
        {
          platform: 'youtube',
          action_type: 'generate_reply',
          cost_cents: 5
        }
      ];

      // Mock monthly stats query (first call to mockSelectOrder)
      mockSelectOrder.mockResolvedValueOnce({
        data: mockMonthlyStats,
        error: null
      });

      // Mock organization query (call to mockSelectSingle)
      mockSelectSingle
        .mockResolvedValueOnce({
          data: mockOrg,
          error: null
        })
        // Mock usage limit check (called by getUsageStats -> checkUsageLimit)
        .mockResolvedValueOnce({
          data: mockOrg,
          error: null
        })
        // Mock monthly usage for checkUsageLimit
        .mockResolvedValueOnce({
          data: { total_responses: 50 },
          error: null
        });

      // Mock platform stats query (second call to mockSelectOrder)
      mockSelectOrder.mockResolvedValueOnce({
        data: mockUsageRecords,
        error: null
      });

      const stats = await costControl.getUsageStats('test-org-123', 3);

      expect(stats.organizationId).toBe('test-org-123');
      expect(stats.planId).toBe('pro');
      expect(stats.monthlyStats).toHaveLength(1);
      expect(stats.platformBreakdown).toHaveProperty('twitter');
      expect(stats.platformBreakdown).toHaveProperty('youtube');
      expect(stats.totalCostThisMonth).toBe(10); // 2 × 5 cents
    });
  });

  describe('Plan configurations', () => {
    test('should have correct plan configurations', () => {
      expect(costControl.plans.free.monthlyResponsesLimit).toBe(100);
      expect(costControl.plans.free.shieldEnabled).toBe(false);
      
      expect(costControl.plans.pro.monthlyResponsesLimit).toBe(1000);
      expect(costControl.plans.pro.shieldEnabled).toBe(true);
      
      expect(costControl.plans.creator_plus.monthlyResponsesLimit).toBe(5000);
      expect(costControl.plans.creator_plus.shieldEnabled).toBe(true);
      
      expect(costControl.plans.custom.monthlyResponsesLimit).toBe(999999);
      expect(costControl.plans.custom.shieldEnabled).toBe(true);
    });

    test('should have correct operation costs', () => {
      expect(costControl.operationCosts.fetch_comment).toBe(0);
      expect(costControl.operationCosts.analyze_toxicity).toBe(1);
      expect(costControl.operationCosts.generate_reply).toBe(5);
      expect(costControl.operationCosts.post_response).toBe(0);
    });
  });

  describe('Error handling', () => {
    test('should handle database errors gracefully', async () => {
      // Mock error from first database call
      const dbError = new Error('Database error');
      mockSelectSingle.mockResolvedValue({
        data: null,
        error: dbError
      });

      await expect(
        costControl.canPerformOperation('test-org-123')
      ).rejects.toThrow('Database error');
    });
  });
});