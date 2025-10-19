/**
 * Cost Control Service Tests
 *
 * Tests for multi-tenant cost management and usage tracking
 */

// Create comprehensive mocks for Supabase query builder pattern BEFORE importing
const mockSelectSingle = jest.fn();
const mockSelectOrder = jest.fn();
const mockSelect = jest.fn(() => ({
  eq: jest.fn(() => ({
    single: mockSelectSingle,
    limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
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
  })),
  limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
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

const mockUpsertSelect = jest.fn();
const mockUpsert = jest.fn(() => ({
  select: jest.fn(() => ({
    single: mockUpsertSelect
  }))
}));

const mockFrom = jest.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  upsert: mockUpsert
}));

const mockRpc = jest.fn();

const mockSupabaseClient = {
  from: mockFrom,
  rpc: mockRpc
};

// Mock Supabase BEFORE importing services
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));

// Mock mockMode to prevent initialization errors
jest.mock('../../../src/config/mockMode', () => ({
  mockMode: {
    isMockMode: false,
    generateMockSupabaseClient: jest.fn(() => mockSupabaseClient)
  }
}));

// Mock planLimitsService (CodeRabbit #3353894295 - Missing mock)
const mockGetPlanLimits = jest.fn();
jest.mock('../../../src/services/planLimitsService', () => ({
  getPlanLimits: mockGetPlanLimits
}));

const CostControlService = require('../../../src/services/costControl');

describe('CostControlService', () => {
  let costControl;

  beforeEach(() => {
    // Mock environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

    // Clear all mocks
    jest.clearAllMocks();

    // Reset specific mocks that use mockResolvedValueOnce (CodeRabbit #3353894295)
    mockSelectSingle.mockReset();
    mockGetPlanLimits.mockReset();

    costControl = new CostControlService();
  });

  describe('canPerformOperation', () => {
    test('should allow operation when under limit', async () => {
      // Mock RPC can_perform_operation response (CodeRabbit #3353894295 M4)
      mockRpc.mockResolvedValueOnce({
        data: { allowed: true, current_usage: 50, monthly_limit: 100, percentage_used: 50 },
        error: null
      });

      const result = await costControl.canPerformOperation('test-org-123');

      expect(result.allowed).toBe(true);
      expect(result.current_usage).toBe(50);
      expect(result.monthly_limit).toBe(100);
      expect(result.percentage_used).toBe(50);
      expect(mockRpc).toHaveBeenCalledWith('can_perform_operation', {
        org_id: 'test-org-123',
        resource_type_param: 'roasts',
        quantity_param: 1
      });
    });

    test('should deny operation when over limit', async () => {
      // Mock RPC can_perform_operation response (CodeRabbit #3353894295 M5)
      mockRpc.mockResolvedValueOnce({
        data: {
          allowed: false,
          reason: 'monthly_limit_exceeded',
          current_usage: 105,
          monthly_limit: 100,
          remaining: 0
        },
        error: null
      });

      const result = await costControl.canPerformOperation('test-org-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('monthly_limit_exceeded');
      expect(result.current_usage).toBe(105);
      expect(result.monthly_limit).toBe(100);
      expect(mockRpc).toHaveBeenCalledWith('can_perform_operation', {
        org_id: 'test-org-123',
        resource_type_param: 'roasts',
        quantity_param: 1
      });
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
      expect(mockRpc).toHaveBeenCalledWith('record_usage', {
        org_id: 'test-org-123',
        resource_type_param: 'roasts',
        platform_param: 'twitter',
        user_id_param: null,
        quantity_param: 1,
        cost_param: 5,
        tokens_param: 25,
        metadata_param: { tokensUsed: 25 }
      });
    });

    test('should record free operations with RPC tracking', async () => {
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

      // Mock RPC record_usage (CodeRabbit #3353894295 M6)
      // Implementation always calls RPC, even for free ops
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          current_usage: 1,
          monthly_limit: 200,
          percentage_used: 0.5,
          limit_exceeded: false
        },
        error: null
      });

      const result = await costControl.recordUsage(
        'test-org-123',
        'twitter',
        'fetch_comment'
      );

      expect(result.recorded).toBe(true);
      expect(result.cost).toBe(0); // Free operation
      expect(mockRpc).toHaveBeenCalledWith('record_usage', {
        org_id: 'test-org-123',
        resource_type_param: 'api_calls',
        platform_param: 'twitter',
        user_id_param: null,
        quantity_param: 1,
        cost_param: 0,
        tokens_param: 0,
        metadata_param: {}
      });
    });
  });

  describe('canUseShield', () => {
    test('should allow Shield for pro plan', async () => {
      mockSelectSingle.mockResolvedValueOnce({
        data: {
          plan_id: 'pro'
        },
        error: null
      });

      // Mock planLimitsService response (CodeRabbit #3353894295 - Missing mock)
      mockGetPlanLimits.mockResolvedValueOnce({
        shieldEnabled: true
      });

      const result = await costControl.canUseShield('test-org-123');

      expect(result.allowed).toBe(true);
      expect(result.planId).toBe('pro');
      expect(result.planName).toBe('Pro');
    });

    test('should deny Shield for free plan', async () => {
      mockSelectSingle.mockResolvedValueOnce({
        data: {
          plan_id: 'free'
        },
        error: null
      });

      // Mock planLimitsService response (CodeRabbit #3353894295 - Missing mock)
      mockGetPlanLimits.mockResolvedValueOnce({
        shieldEnabled: false
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

      // Mock planLimitsService response (CodeRabbit #3353894295 - Missing mock)
      mockGetPlanLimits.mockResolvedValue({
        monthlyResponsesLimit: 1000,
        shieldEnabled: true
      });

      // Mock the update operation for organizations table
      mockUpdateSelect.mockResolvedValueOnce({
        data: mockOrg,
        error: null
      });

      // Mock upsert operations for updatePlanUsageLimits (4 resource types)
      mockUpsertSelect.mockResolvedValue({
        data: { organization_id: 'test-org-123' },
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
      // Test plan metadata (CodeRabbit #3353894295 N4)
      // Plans only contain id, name, and features (not limits)
      expect(costControl.plans.free.id).toBe('free');
      expect(costControl.plans.free.name).toBe('Free');
      expect(costControl.plans.free.features).toContain('basic_integrations');
      expect(costControl.plans.free.features).toContain('community_support');

      expect(costControl.plans.pro.id).toBe('pro');
      expect(costControl.plans.pro.name).toBe('Pro');
      expect(costControl.plans.pro.features).toContain('shield_mode');
      expect(costControl.plans.pro.features).toContain('analytics');

      expect(costControl.plans.creator_plus.id).toBe('creator_plus');
      expect(costControl.plans.creator_plus.name).toBe('Creator Plus');
      expect(costControl.plans.creator_plus.features).toContain('unlimited_integrations');
      expect(costControl.plans.creator_plus.features).toContain('custom_tones');

      expect(costControl.plans.custom.id).toBe('custom');
      expect(costControl.plans.custom.name).toBe('Custom');
      expect(costControl.plans.custom.features).toContain('everything');
      expect(costControl.plans.custom.features).toContain('sla');
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
      // Mock error from RPC call (CodeRabbit #3353894295 - Fix mock target)
      const dbError = new Error('Database error');
      mockRpc.mockResolvedValue({
        data: null,
        error: dbError
      });

      await expect(
        costControl.canPerformOperation('test-org-123')
      ).rejects.toThrow('Database error');
    });
  });

  describe('Authentication', () => {
    test('should require SERVICE_KEY for admin operations in non-mock mode', () => {
      // Clear environment
      delete process.env.SUPABASE_SERVICE_KEY;
      delete process.env.MOCK_MODE;
      process.env.SUPABASE_URL = 'https://test.supabase.co';

      // Should throw error when SERVICE_KEY missing in non-mock mode
      expect(() => {
        new CostControlService();
      }).toThrow('SUPABASE_SERVICE_KEY is required for admin operations in CostControlService');
    });

    test('should use SERVICE_KEY when available', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
      delete process.env.MOCK_MODE;

      const service = new CostControlService();

      expect(service.supabaseKey).toBe('test-service-key');
    });

    // Note: Mock mode behavior is tested separately in integration tests
    // where mockMode.isMockMode can be properly controlled
  });
});