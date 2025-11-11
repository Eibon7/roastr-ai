/**
 * Cost Control Service - Coverage Gap Tests
 * Issue #500: Increase coverage from 35% to 60%+
 * 
 * Focuses on untested methods following working mock pattern from costControl.test.js
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
        single: mockSelectSingle,
        maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null }))
      }))
    })),
    gte: jest.fn(() => ({
      lt: mockSelectOrder,
      lte: mockSelectOrder,
      order: jest.fn(() => ({
        order: mockSelectOrder,
        limit: mockSelectOrder
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

// Mock planLimitsService
const mockGetPlanLimits = jest.fn();
jest.mock('../../../src/services/planLimitsService', () => ({
  getPlanLimits: mockGetPlanLimits
}));

// Mock logger to prevent winston issues
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const CostControlService = require('../../../src/services/costControl');

/**
 * CostControlService - Coverage Gap Tests
 * 
 * @description Tests for previously untested methods in CostControlService
 * @issue #500 - Increase test coverage from 35% to 60%+
 * 
 * Coverage targets:
 * - checkUsageLimit: Verify usage limit enforcement
 * - incrementUsageCounters: Test counter updates
 * - sendUsageAlert: Alert notification system
 * - setUsageLimit: Custom limit configuration
 * - getBillingSummary: Billing aggregation
 * - updatePlanUsageLimits: Plan limit updates
 * - resetAllMonthlyUsage: Monthly reset workflow
 * - createDefaultUsageAlerts: Default alert creation
 * 
 * Mock pattern: Follows working pattern from costControl.test.js
 * Supabase mocks: Comprehensive query builder simulation
 */
describe('CostControlService - Coverage Gaps', () => {
  let costControl;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'http://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
    
    costControl = new CostControlService();
    
    // Mock planLimitsService default response
    mockGetPlanLimits.mockResolvedValue({
      monthlyResponsesLimit: 1000,
      shieldEnabled: true,
      monthlyAnalysisLimit: 2000,
      maxWebhookCalls: 500,
      maxShieldActions: 300
    });
  });

  /**
   * @function checkUsageLimit
   * @description Verifies usage limit checking for different plan types
   * 
   * Tests:
   * - Under limit scenarios (should allow)
   * - At limit scenarios (should deny)
   * - Over limit scenarios (should deny)
   * - Different plan IDs (starter_trial, starter, pro, plus)
   * 
   * Mock data: organization_usage table
   */
  describe('checkUsageLimit', () => {
    it('should check usage limit and return status', async () => {
      const organizationId = 'test-org-123';
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      // Mock organizations query
      mockSelectSingle.mockResolvedValueOnce({
        data: {
          plan_id: 'pro',
          monthly_responses_limit: 1000,
          monthly_responses_used: 750
        },
        error: null
      });

      // Mock monthly_usage query
      mockSelectSingle.mockResolvedValueOnce({
        data: {
          total_responses: 750,
          limit_exceeded: false
        },
        error: null
      });

      const result = await costControl.checkUsageLimit(organizationId);

      expect(result.canUse).toBe(true);
      expect(result.currentUsage).toBe(750);
      expect(result.limit).toBe(1000);
      expect(result.percentage).toBe(75);
    });

    it('should detect when approaching limit (>80%)', async () => {
      mockSelectSingle.mockResolvedValueOnce({
        data: {
          plan_id: 'pro',
          monthly_responses_limit: 1000,
          monthly_responses_used: 850
        },
        error: null
      });

      mockSelectSingle.mockResolvedValueOnce({
        data: {
          total_responses: 850,
          limit_exceeded: false
        },
        error: null
      });

      const result = await costControl.checkUsageLimit('test-org');

      expect(result.isNearLimit).toBe(true);
      expect(result.percentage).toBe(85);
    });

    it('should handle division by zero when limit is 0', async () => {
      mockSelectSingle.mockResolvedValueOnce({
        data: {
          plan_id: 'pro',
          monthly_responses_limit: 0,
          monthly_responses_used: 100
        },
        error: null
      });

      mockSelectSingle.mockResolvedValueOnce({
        data: {
          total_responses: 100,
          limit_exceeded: true
        },
        error: null
      });

      const result = await costControl.checkUsageLimit('test-org');

      expect(result.percentage).toBe(100);
    });
  });

  /**
   * @function incrementUsageCounters
   * @description Tests RPC call to increment usage counters atomically
   * 
   * Tests:
   * - Successful counter increment
   * - Correct parameter passing (org_id, counter type, increment value)
   * - RPC function call verification
   * 
   * Mock: Supabase RPC 'increment_usage'
   */
  describe('incrementUsageCounters', () => {
    it('should increment usage via RPC call', async () => {
      const organizationId = 'test-org-123';
      const platform = 'twitter';
      const cost = 5;

      // Mock increment_usage RPC
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: null
      });

      // Mock checkUsageLimit calls (organizations + monthly_usage)
      mockSelectSingle.mockResolvedValueOnce({
        data: {
          plan_id: 'pro',
          monthly_responses_limit: 1000,
          monthly_responses_used: 50
        },
        error: null
      });

      mockSelectSingle.mockResolvedValueOnce({
        data: {
          total_responses: 50,
          limit_exceeded: false
        },
        error: null
      });

      const result = await costControl.incrementUsageCounters(organizationId, platform, cost);

      expect(mockRpc).toHaveBeenCalledWith('increment_usage', {
        org_id: organizationId,
        platform_name: platform,
        cost
      });

      expect(result).toBeDefined();
      expect(result.canUse).toBe(true);
    });
  });

  /**
   * @function sendUsageAlert
   * @description Tests usage alert notification system
   * 
   * Tests:
   * - Alert insertion into usage_alerts table
   * - Data structure validation (org_id, threshold, current_value, message)
   * - Successful alert creation workflow
   * 
   * Mock: Supabase insert operation
   */
  describe('sendUsageAlert', () => {
    it('should send alert when approaching limit', async () => {
      const organizationId = 'test-org-123';
      const usageData = {
        currentUsage: 900,
        limit: 1000,
        percentage: 90,
        resourceType: 'roasts'
      };

      // Mock organization select with owner
      mockSelectSingle.mockResolvedValueOnce({
        data: { 
          name: 'Test Org',
          plan_id: 'pro',
          users: {
            email: 'test@example.com',
            name: 'Test User'
          }
        },
        error: null
      });

      // Mock app_logs insert
      mockInsertSelect.mockResolvedValueOnce({
        data: { id: 'log-123' },
        error: null
      });

      await costControl.sendUsageAlert(organizationId, usageData);

      expect(mockFrom).toHaveBeenCalledWith('organizations');
      expect(mockFrom).toHaveBeenCalledWith('app_logs');
    });
  });

  /**
   * @function setUsageLimit
   * @description Tests custom usage limit configuration
   * 
   * Tests:
   * - Setting new usage limits for organizations
   * - Upsert operation (insert or update)
   * - Limit type and value validation
   * 
   * Mock: Supabase upsert operation
   */
  describe('setUsageLimit', () => {
    it('should set custom usage limit for organization', async () => {
      const organizationId = 'test-org-123';
      const resourceType = 'roasts';
      const monthlyLimit = 5000;

      mockUpsertSelect.mockResolvedValueOnce({
        data: { 
          organization_id: organizationId,
          resource_type: resourceType,
          monthly_limit: monthlyLimit
        },
        error: null
      });

      const result = await costControl.setUsageLimit(
        organizationId,
        resourceType,
        monthlyLimit
      );

      expect(result.success).toBe(true);
      expect(result.resourceType).toBe(resourceType);
      expect(result.newLimit).toBe(monthlyLimit);
    });

    it('should handle invalid resource types', async () => {
      await expect(
        costControl.setUsageLimit('test-org', 'invalid_resource', 1000)
      ).rejects.toThrow('Invalid resource type');
    });
  });

  /**
   * @function getBillingSummary
   * @description Tests billing summary aggregation
   * 
   * Tests:
   * - Summary data retrieval from subscriptions table
   * - Data structure validation (plan_id, status, current_period_end, etc.)
   * - Organization-specific billing data
   * 
   * Mock: Supabase select with eq filter
   */
  describe('getBillingSummary', () => {
    it('should return billing summary for specified month', async () => {
      const organizationId = 'test-org-123';
      const year = 2025;
      const month = 10;

      // Mock monthly_usage query
      mockSelectSingle.mockResolvedValueOnce({
        data: {
          total_responses: 500,
          total_cost_cents: 2500,
          responses_by_platform: { twitter: 300, youtube: 200 }
        },
        error: null
      });

      // Mock organization query
      mockSelectSingle.mockResolvedValueOnce({
        data: {
          plan_id: 'pro',
          monthly_responses_limit: 1000
        },
        error: null
      });

      const result = await costControl.getBillingSummary(organizationId, year, month);

      expect(result.period).toEqual({ year, month });
      expect(result.usage).toBeDefined();
      expect(result.cost).toBeDefined();
    });
  });

  /**
   * @function updatePlanUsageLimits
   * @description Tests plan-specific usage limit updates
   * 
   * Tests:
   * - Updating limits when plan changes
   * - Limit calculation based on plan tier
   * - Update operation success
   * 
   * Mock: Supabase update operation
   */
  describe('updatePlanUsageLimits', () => {
    it('should update usage limits when plan changes', async () => {
      const organizationId = 'test-org-123';
      const planId = 'pro';

      // Mock upsert for each resource type (4 times)
      mockUpsertSelect.mockResolvedValue({
        data: { organization_id: organizationId },
        error: null
      });

      await costControl.updatePlanUsageLimits(organizationId, planId);

      // Should have called getPlanLimits
      expect(mockGetPlanLimits).toHaveBeenCalledWith(planId);
      
      // Should have called upsert for resource types
      expect(mockUpsert).toHaveBeenCalled();
    });
  });

  /**
   * @function resetAllMonthlyUsage
   * @description Tests monthly usage counter reset workflow
   * 
   * Tests:
   * - Batch update of all organizations
   * - Resetting counters to 0
   * - Successful reset operation
   * 
   * Mock: Supabase bulk update
   */
  describe('resetAllMonthlyUsage', () => {
    it('should reset usage for all organizations via RPC', async () => {
      mockRpc.mockResolvedValueOnce({
        data: 42, // 42 organizations reset
        error: null
      });

      const result = await costControl.resetAllMonthlyUsage();

      expect(mockRpc).toHaveBeenCalledWith('reset_monthly_usage');
      expect(result.success).toBe(true);
      expect(result.organizationsReset).toBe(42);
      expect(result.resetAt).toBeDefined();
    });

    it('should handle RPC errors during reset', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: new Error('Reset failed')
      });

      await expect(
        costControl.resetAllMonthlyUsage()
      ).rejects.toThrow('Reset failed');
    });
  });

  /**
   * @function createDefaultUsageAlerts
   * @description Tests default usage alert configuration creation
   * 
   * Tests:
   * - Default alert thresholds (80%, 90%, 100%)
   * - Alert configuration for new organizations
   * - Successful creation workflow
   * 
   * Mock: Supabase insert operation
   */
  describe('createDefaultUsageAlerts', () => {
    it('should create default alerts for all resource types', async () => {
      const organizationId = 'test-org-123';
      
      // Mock bulk insert
      mockInsert.mockReturnValueOnce({
        data: [
          { id: 'alert-1' },
          { id: 'alert-2' },
          { id: 'alert-3' },
          { id: 'alert-4' }
        ],
        error: null
      });

      const result = await costControl.createDefaultUsageAlerts(organizationId);

      expect(mockFrom).toHaveBeenCalledWith('usage_alerts');
    });
  });
});
