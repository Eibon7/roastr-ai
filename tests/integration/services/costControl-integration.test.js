/**
 * Cost Control Service - Integration Tests
 * Issue #929: Increase test coverage for critical business services
 *
 * @description Integration tests for costControl.js covering:
 * - canPerformOperation (RPC calls with different operation types)
 * - getUsageStats (monthly usage statistics)
 * - getResourceDisplayName & buildLimitMessage (helper methods)
 * - checkAndSendUsageAlerts (alert system)
 * - shouldSendAlert (cooldown logic)
 * - sendUsageAlert (alert sending)
 * - getEnhancedUsageStats (enhanced statistics)
 * - upgradePlan (plan upgrades)
 * - canUseShield (Shield access verification)
 * - getBillingSummary (billing aggregation)
 * - getAlertHistory (alert history)
 * - getAlertStats (alert statistics)
 *
 * Coverage target: 85%+ for costControl.js
 */

// Create comprehensive mocks BEFORE importing services
// Create chainable mock builder
function createChainableBuilder(returnValue) {
  const builder = {
    eq: jest.fn(() => builder),
    neq: jest.fn(() => builder),
    gt: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lt: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    in: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    range: jest.fn(() => Promise.resolve(returnValue)),
    single: jest.fn(() => Promise.resolve(returnValue)),
    maybeSingle: jest.fn(() => Promise.resolve(returnValue)),
    then: (resolve, reject) => {
      if (returnValue.error) {
        reject(returnValue.error);
      } else {
        resolve(returnValue);
      }
    }
  };
  return builder;
}

const mockSelectSingle = jest.fn();
const mockSelectOrder = jest.fn();
const mockSelect = jest.fn(() => createChainableBuilder({ data: [], error: null }));

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
    })),
    update: jest.fn(() => Promise.resolve({ data: null, error: null }))
  }))
}));

const mockUpsertSelect = jest.fn();
const mockUpsert = jest.fn(() => ({
  select: jest.fn(() => ({
    single: mockUpsertSelect
  }))
}));

const mockFrom = jest.fn((tableName) => {
  // Return appropriate mock based on table name
  // But allow individual tests to override with mockReturnValueOnce
  return {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    upsert: mockUpsert
  };
});

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

// Mock logger - costControl imports logger directly
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

const CostControlService = require('../../../src/services/costControl');

describe('CostControlService - Integration Tests', () => {
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

  describe('canPerformOperation', () => {
    it('should check operation permission via RPC for generate_reply', async () => {
      const organizationId = 'test-org-123';
      
      mockRpc.mockResolvedValueOnce({
        data: {
          allowed: true,
          current_usage: 50,
          monthly_limit: 1000,
          remaining: 950
        },
        error: null
      });

      const result = await costControl.canPerformOperation(
        organizationId,
        'generate_reply',
        1,
        'twitter'
      );

      expect(mockRpc).toHaveBeenCalledWith('can_perform_operation', {
        org_id: organizationId,
        resource_type_param: 'roasts',
        quantity_param: 1
      });
      expect(result.allowed).toBe(true);
      expect(result.current_usage).toBe(50);
    });

    it('should check operation permission for fetch_comment', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          allowed: true,
          current_usage: 100,
          monthly_limit: 2000
        },
        error: null
      });

      const result = await costControl.canPerformOperation(
        'test-org',
        'fetch_comment',
        1
      );

      expect(mockRpc).toHaveBeenCalledWith('can_perform_operation', {
        org_id: 'test-org',
        resource_type_param: 'api_calls',
        quantity_param: 1
      });
      expect(result.allowed).toBe(true);
    });

    it('should check operation permission for analyze_toxicity', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          allowed: true,
          current_usage: 200,
          monthly_limit: 2000
        },
        error: null
      });

      const result = await costControl.canPerformOperation(
        'test-org',
        'analyze_toxicity',
        1
      );

      expect(mockRpc).toHaveBeenCalledWith('can_perform_operation', {
        org_id: 'test-org',
        resource_type_param: 'comment_analysis',
        quantity_param: 1
      });
      expect(result.allowed).toBe(true);
    });

    it('should check operation permission for shield_action', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          allowed: true,
          current_usage: 50,
          monthly_limit: 300
        },
        error: null
      });

      const result = await costControl.canPerformOperation(
        'test-org',
        'shield_action',
        1
      );

      expect(mockRpc).toHaveBeenCalledWith('can_perform_operation', {
        org_id: 'test-org',
        resource_type_param: 'shield_actions',
        quantity_param: 1
      });
      expect(result.allowed).toBe(true);
    });

    it('should return error message when operation not allowed', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          allowed: false,
          reason: 'monthly_limit_exceeded',
          current_usage: 1000,
          monthly_limit: 1000,
          remaining: 0
        },
        error: null
      });

      const result = await costControl.canPerformOperation(
        'test-org',
        'generate_reply',
        1
      );

      expect(result.allowed).toBe(false);
      expect(result.message).toContain('Monthly limit');
    });

    it('should throw error when RPC returns invalid response', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: null
      });

      await expect(
        costControl.canPerformOperation('test-org', 'generate_reply', 1)
      ).rejects.toThrow('Invalid response from can_perform_operation');
    });

    it('should throw error when RPC fails', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC error' }
      });

      await expect(
        costControl.canPerformOperation('test-org', 'generate_reply', 1)
      ).rejects.toEqual({ message: 'RPC error' });
    });
  });

  describe('getResourceDisplayName', () => {
    it('should return display name for roasts', () => {
      expect(costControl.getResourceDisplayName('roasts')).toBe('roast responses');
    });

    it('should return display name for api_calls', () => {
      expect(costControl.getResourceDisplayName('api_calls')).toBe('API calls');
    });

    it('should return display name for comment_analysis', () => {
      expect(costControl.getResourceDisplayName('comment_analysis')).toBe('comment analyses');
    });

    it('should return display name for shield_actions', () => {
      expect(costControl.getResourceDisplayName('shield_actions')).toBe('shield actions');
    });

    it('should return display name for webhook_calls', () => {
      expect(costControl.getResourceDisplayName('webhook_calls')).toBe('webhook calls');
    });

    it('should return display name for integrations', () => {
      expect(costControl.getResourceDisplayName('integrations')).toBe('active integrations');
    });

    it('should return resource type as-is for unknown types', () => {
      expect(costControl.getResourceDisplayName('unknown_type')).toBe('unknown_type');
    });
  });

  describe('buildLimitMessage', () => {
    it('should build message for monthly_limit_exceeded', () => {
      const result = {
        reason: 'monthly_limit_exceeded',
        current_usage: 1000,
        monthly_limit: 1000,
        remaining: 0
      };

      const message = costControl.buildLimitMessage(result, 'roast responses');
      expect(message).toContain('Monthly limit of 1000 roast responses exceeded');
      expect(message).toContain('Current usage: 1000');
    });

    it('should build message for overage_allowed', () => {
      const result = {
        reason: 'overage_allowed',
        current_usage: 1000,
        monthly_limit: 1000
      };

      const message = costControl.buildLimitMessage(result, 'roast responses');
      expect(message).toContain('Monthly limit exceeded but overage is allowed');
    });

    it('should build default message for unknown reason', () => {
      const result = {
        reason: 'unknown_reason'
      };

      const message = costControl.buildLimitMessage(result, 'roast responses');
      expect(message).toContain('Operation not allowed: unknown_reason');
    });
  });

  describe('getUsageStats', () => {
    it('should get usage statistics for organization', async () => {
      const organizationId = 'test-org-123';
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();

      // Mock monthly_usage query - need chainable builder
      const mockMonthlyUsageBuilder = createChainableBuilder({
        data: [
          {
            organization_id: organizationId,
            year: currentYear,
            month: currentMonth,
            total_responses: 750,
            total_cost_cents: 5000
          }
        ],
        error: null
      });

      // Mock organizations query
      const mockOrgBuilder = createChainableBuilder({
        data: {
          plan_id: 'pro',
          monthly_responses_limit: 1000,
          monthly_responses_used: 750
        },
        error: null
      });

      // Mock usage_records query
      const mockUsageRecordsBuilder = createChainableBuilder({
        data: [
          {
            platform: 'twitter',
            action_type: 'generate_reply',
            cost_cents: 5
          },
          {
            platform: 'twitter',
            action_type: 'generate_reply',
            cost_cents: 5
          }
        ],
        error: null
      });

      mockFrom
        .mockReturnValueOnce({
          select: jest.fn(() => mockMonthlyUsageBuilder)
        })
        .mockReturnValueOnce({
          select: jest.fn(() => mockOrgBuilder)
        })
        .mockReturnValueOnce({
          select: jest.fn(() => mockUsageRecordsBuilder)
        });

      // Mock checkUsageLimit
      jest.spyOn(costControl, 'checkUsageLimit').mockResolvedValueOnce({
        canUse: true,
        currentUsage: 750,
        limit: 1000,
        percentage: 75
      });

      const result = await costControl.getUsageStats(organizationId, 3);

      expect(result.organizationId).toBe(organizationId);
      expect(result.planId).toBe('pro');
      expect(result.monthlyStats).toBeDefined();
      expect(result.platformBreakdown).toBeDefined();
      expect(result.totalCostThisMonth).toBe(10);
    });

    it('should handle errors when getting usage stats', async () => {
      const mockMonthlyUsageBuilder = createChainableBuilder({
        data: null,
        error: { message: 'Database error' }
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn(() => mockMonthlyUsageBuilder)
      });

      await expect(costControl.getUsageStats('test-org')).rejects.toEqual({
        message: 'Database error'
      });
    });
  });

  describe('checkAndSendUsageAlerts', () => {
    it('should check and send alerts when threshold exceeded', async () => {
      const organizationId = 'test-org-123';
      const usageData = {
        current_usage: 850,
        monthly_limit: 1000,
        percentage_used: 85
      };

      // Mock alerts query
      const mockAlertsBuilder = createChainableBuilder({
        data: [
          {
            id: 'alert-1',
            threshold_percentage: 80,
            alert_type: 'email',
            sent_count: 0,
            max_alerts_per_day: 3,
            cooldown_hours: 24,
            last_sent_at: null
          }
        ],
        error: null
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn(() => mockAlertsBuilder)
      });

      // Mock shouldSendAlert
      jest.spyOn(costControl, 'shouldSendAlert').mockResolvedValueOnce(true);

      // Mock sendUsageAlert
      jest.spyOn(costControl, 'sendUsageAlert').mockResolvedValueOnce();

      // Mock update alert
      const mockUpdateBuilder = {
        eq: jest.fn(() => ({
          update: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      };

      mockFrom.mockReturnValueOnce({
        update: jest.fn(() => mockUpdateBuilder)
      });

      await costControl.checkAndSendUsageAlerts(organizationId, 'roasts', usageData);

      expect(costControl.shouldSendAlert).toHaveBeenCalled();
      expect(costControl.sendUsageAlert).toHaveBeenCalled();
    });

    it('should create default alerts if none exist', async () => {
      const organizationId = 'test-org-123';
      const usageData = {
        current_usage: 850,
        monthly_limit: 1000,
        percentage_used: 85
      };

      // Mock no alerts found
      const mockAlertsBuilder1 = createChainableBuilder({
        data: [],
        error: null
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn(() => mockAlertsBuilder1)
      });

      // Mock createDefaultUsageAlerts
      jest.spyOn(costControl, 'createDefaultUsageAlerts').mockResolvedValueOnce([]);

      // Mock retry alerts query
      const mockAlertsBuilder2 = createChainableBuilder({
        data: [],
        error: null
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn(() => mockAlertsBuilder2)
      });

      await costControl.checkAndSendUsageAlerts(organizationId, 'roasts', usageData);

      expect(costControl.createDefaultUsageAlerts).toHaveBeenCalledWith(organizationId);
    });

    it('should not throw error on alert check failure', async () => {
      const organizationId = 'test-org-123';
      const usageData = {
        current_usage: 850,
        monthly_limit: 1000
      };

      mockSelectOrder.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' }
      });

      // Should not throw
      await expect(
        costControl.checkAndSendUsageAlerts(organizationId, 'roasts', usageData)
      ).resolves.not.toThrow();
    });
  });

  describe('shouldSendAlert', () => {
    it('should return true when alert can be sent', async () => {
      const alert = {
        id: 'alert-1',
        sent_count: 0,
        max_alerts_per_day: 3,
        last_sent_at: null
      };

      const result = await costControl.shouldSendAlert(alert, 85);

      expect(result).toBe(true);
    });

    it('should return false when daily limit reached', async () => {
      const alert = {
        id: 'alert-1',
        sent_count: 3,
        max_alerts_per_day: 3,
        last_sent_at: new Date().toISOString()
      };

      const result = await costControl.shouldSendAlert(alert, 85);

      expect(result).toBe(false);
    });

    it('should reset count and return true when new day', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const alert = {
        id: 'alert-1',
        sent_count: 3,
        max_alerts_per_day: 3,
        last_sent_at: yesterday.toISOString()
      };

      mockUpdate.mockReturnValueOnce({
        eq: jest.fn(() => ({
          update: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      });

      const result = await costControl.shouldSendAlert(alert, 85);

      expect(result).toBe(true);
    });

    it('should return false when cooldown period active', async () => {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const alert = {
        id: 'alert-1',
        sent_count: 0,
        max_alerts_per_day: 3,
        cooldown_hours: 24,
        last_sent_at: oneHourAgo.toISOString()
      };

      const result = await costControl.shouldSendAlert(alert, 85);

      expect(result).toBe(false);
    });

    it('should return true when cooldown period expired', async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const alert = {
        id: 'alert-1',
        sent_count: 0,
        max_alerts_per_day: 3,
        cooldown_hours: 24,
        last_sent_at: twoDaysAgo.toISOString()
      };

      const result = await costControl.shouldSendAlert(alert, 85);

      expect(result).toBe(true);
    });
  });

  describe('sendUsageAlert', () => {
    it('should send usage alert and log to database', async () => {
      const organizationId = 'test-org-123';
      const alertData = {
        resourceType: 'roasts',
        current_usage: 850,
        monthly_limit: 1000,
        percentage_used: 85,
        alertType: 'email',
        thresholdPercentage: 80
      };

      // Mock organizations query with users join - need chainable builder
      const mockOrgBuilder = createChainableBuilder({
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

      mockFrom.mockReturnValueOnce({
        select: jest.fn(() => mockOrgBuilder)
      });

      // Mock app_logs insert
      mockInsertSelect.mockResolvedValueOnce({
        data: { id: 'log-1' },
        error: null
      });

      const result = await costControl.sendUsageAlert(organizationId, alertData);

      expect(mockInsert).toHaveBeenCalled();
      expect(result.type).toBe('usage_alert');
      expect(result.organizationId).toBe(organizationId);
    });

    it('should handle errors when sending alert', async () => {
      const organizationId = 'test-org-123';
      const alertData = {
        resourceType: 'roasts',
        current_usage: 850,
        monthly_limit: 1000
      };

      // Mock organizations query error
      const mockOrgBuilder = createChainableBuilder({
        data: null,
        error: { message: 'Database error' }
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn(() => mockOrgBuilder)
      });

      await expect(
        costControl.sendUsageAlert(organizationId, alertData)
      ).rejects.toEqual({ message: 'Database error' });
    });
  });

  describe('getEnhancedUsageStats', () => {
    it('should get enhanced usage statistics', async () => {
      const organizationId = 'test-org-123';
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      // Mock usage_tracking query
      const mockUsageTrackingBuilder = createChainableBuilder({
        data: [
          {
            resource_type: 'roasts',
            platform: 'twitter',
            quantity: 100,
            cost_cents: 500,
            tokens_used: 1000
          }
        ],
        error: null
      });

      // Mock usage_limits query
      const mockUsageLimitsBuilder = createChainableBuilder({
        data: [
          {
            resource_type: 'roasts',
            monthly_limit: 1000,
            allow_overage: true,
            is_active: true
          }
        ],
        error: null
      });

      // Mock organizations query
      const mockOrgBuilder = createChainableBuilder({
        data: {
          plan_id: 'pro',
          monthly_responses_limit: 1000
        },
        error: null
      });

      mockFrom
        .mockReturnValueOnce({
          select: jest.fn(() => mockUsageTrackingBuilder)
        })
        .mockReturnValueOnce({
          select: jest.fn(() => mockUsageLimitsBuilder)
        })
        .mockReturnValueOnce({
          select: jest.fn(() => mockOrgBuilder)
        });

      const result = await costControl.getEnhancedUsageStats(organizationId, 3);

      expect(result.organizationId).toBe(organizationId);
      expect(result.planId).toBe('pro');
      expect(result.currentMonth).toBeDefined();
      expect(result.currentMonth.usageByResource).toBeDefined();
      expect(result.currentMonth.usageByPlatform).toBeDefined();
    });

    it('should handle errors when getting enhanced stats', async () => {
      const mockUsageTrackingBuilder = createChainableBuilder({
        data: null,
        error: { message: 'Database error' }
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn(() => mockUsageTrackingBuilder)
      });

      await expect(costControl.getEnhancedUsageStats('test-org')).rejects.toEqual({
        message: 'Database error'
      });
    });
  });

  describe('upgradePlan', () => {
    it('should upgrade organization plan', async () => {
      const organizationId = 'test-org-123';
      const newPlanId = 'pro';
      const stripeSubscriptionId = 'sub_123';

      mockGetPlanLimits.mockResolvedValueOnce({
        monthlyResponsesLimit: 1000,
        shieldEnabled: true
      });

      // Mock update().eq().select().single() chain
      const mockUpdateBuilder = {
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: {
                  id: organizationId,
                  plan_id: 'starter', // previous plan
                  new_plan_id: newPlanId,
                  monthly_responses_limit: 1000,
                  stripe_subscription_id: stripeSubscriptionId,
                  subscription_status: 'active'
                },
                error: null
              })
            )
          }))
        }))
      };

      mockFrom
        .mockReturnValueOnce({
          update: jest.fn(() => mockUpdateBuilder)
        })
        .mockReturnValueOnce({
          insert: mockInsert
        });

      // Mock updatePlanUsageLimits
      jest.spyOn(costControl, 'updatePlanUsageLimits').mockResolvedValueOnce();

      // Mock app_logs insert
      mockInsertSelect.mockResolvedValueOnce({
        data: { id: 'log-1' },
        error: null
      });

      const result = await costControl.upgradePlan(
        organizationId,
        newPlanId,
        stripeSubscriptionId
      );

      expect(result.success).toBe(true);
      expect(result.organization.id).toBe(organizationId);
      expect(costControl.updatePlanUsageLimits).toHaveBeenCalledWith(
        organizationId,
        newPlanId
      );
    });

    it('should throw error for invalid plan ID', async () => {
      await expect(
        costControl.upgradePlan('test-org', 'invalid_plan')
      ).rejects.toThrow('Invalid plan ID: invalid_plan');
    });

    it('should handle errors during upgrade', async () => {
      mockGetPlanLimits.mockResolvedValueOnce({
        monthlyResponsesLimit: 1000
      });

      const mockUpdateBuilder = {
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: null,
                error: { message: 'Database error' }
              })
            )
          }))
        }))
      };

      mockFrom.mockReturnValueOnce({
        update: jest.fn(() => mockUpdateBuilder)
      });

      await expect(
        costControl.upgradePlan('test-org', 'pro')
      ).rejects.toEqual({ message: 'Database error' });
    });
  });

  describe('canUseShield', () => {
    it('should check if organization can use Shield', async () => {
      const organizationId = 'test-org-123';

      const mockOrgBuilder = createChainableBuilder({
        data: {
          plan_id: 'pro'
        },
        error: null
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn(() => mockOrgBuilder)
      });

      mockGetPlanLimits.mockResolvedValueOnce({
        shieldEnabled: true
      });

      const result = await costControl.canUseShield(organizationId);

      expect(result.allowed).toBe(true);
      expect(result.planId).toBe('pro');
      expect(result.planName).toBe('Pro');
    });

    it('should return false when Shield not enabled for plan', async () => {
      const mockOrgBuilder = createChainableBuilder({
        data: {
          plan_id: 'starter'
        },
        error: null
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn(() => mockOrgBuilder)
      });

      mockGetPlanLimits.mockResolvedValueOnce({
        shieldEnabled: false
      });

      const result = await costControl.canUseShield('test-org');

      expect(result.allowed).toBe(false);
    });

    it('should throw error when plan not found', async () => {
      const mockOrgBuilder = createChainableBuilder({
        data: {
          plan_id: 'unknown_plan'
        },
        error: null
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn(() => mockOrgBuilder)
      });

      // Mock getPlanLimits to return valid limits (plan check happens after)
      mockGetPlanLimits.mockResolvedValueOnce({
        shieldEnabled: true
      });

      await expect(costControl.canUseShield('test-org')).rejects.toThrow(
        'Plan not found for plan_id: unknown_plan'
      );
    });
  });

  describe('getBillingSummary', () => {
    it('should get billing summary for specified month', async () => {
      const organizationId = 'test-org-123';
      const year = 2024;
      const month = 10;

      // Mock monthly_usage query - use chainable builder
      const mockMonthlyUsageBuilder = createChainableBuilder({
        data: {
          organization_id: organizationId,
          year,
          month,
          total_responses: 750,
          total_cost_cents: 5000,
          responses_by_platform: { twitter: 500, youtube: 250 }
        },
        error: null
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn(() => mockMonthlyUsageBuilder)
      });

      // Mock usage_records query
      const mockUsageRecordsBuilder = createChainableBuilder({
        data: [
          {
            platform: 'twitter',
            action_type: 'generate_reply',
            cost_cents: 5,
            created_at: new Date(year, month - 1, 15).toISOString()
          }
        ],
        error: null
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn(() => mockUsageRecordsBuilder)
      });

      const result = await costControl.getBillingSummary(organizationId, year, month);

      expect(result.organizationId).toBe(organizationId);
      expect(result.year).toBe(year);
      expect(result.month).toBe(month);
      expect(result.totalResponses).toBe(750);
      expect(result.totalCostCents).toBe(5000);
      expect(result.detailedRecords).toBeDefined();
    });

    it('should handle missing monthly_usage gracefully', async () => {
      const organizationId = 'test-org-123';
      const year = 2024;
      const month = 10;

      // Mock monthly_usage not found (PGRST116 is ignored)
      const mockMonthlyUsageBuilder = createChainableBuilder({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' }
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn(() => mockMonthlyUsageBuilder)
      });

      // Mock usage_records query
      const mockUsageRecordsBuilder = createChainableBuilder({
        data: [],
        error: null
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn(() => mockUsageRecordsBuilder)
      });

      const result = await costControl.getBillingSummary(organizationId, year, month);

      expect(result.totalResponses).toBe(0);
      expect(result.totalCostCents).toBe(0);
    });

    it('should handle errors when getting billing summary', async () => {
      // Mock monthly_usage query with non-PGRST116 error
      const mockMonthlyUsageBuilder = createChainableBuilder({
        data: null,
        error: { message: 'Database error', code: 'OTHER' }
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn(() => mockMonthlyUsageBuilder)
      });

      await expect(
        costControl.getBillingSummary('test-org', 2024, 10)
      ).rejects.toEqual({ message: 'Database error', code: 'OTHER' });
    });
  });

  describe('getAlertHistory', () => {
    it('should get alert history for organization', async () => {
      const organizationId = 'test-org-123';

      // Mock main query with chainable builder
      const mockQueryBuilder = createChainableBuilder({
        data: [
          {
            id: 'alert-1',
            category: 'usage_alert',
            metadata: {
              resourceType: 'roasts',
              alertType: 'email',
              thresholdPercentage: 80
            },
            created_at: new Date().toISOString()
          }
        ],
        error: null,
        count: 1
      });

      // Mock count query
      const mockCountBuilder = createChainableBuilder({
        count: 1,
        error: null
      });

      mockFrom
        .mockReturnValueOnce({
          select: jest.fn(() => mockQueryBuilder)
        })
        .mockReturnValueOnce({
          select: jest.fn(() => mockCountBuilder)
        });

      const result = await costControl.getAlertHistory(organizationId, {
        limit: 50,
        offset: 0
      });

      expect(result.alerts).toBeDefined();
      expect(result.pagination.total).toBe(1);
    });

    it('should filter alerts by resource type', async () => {
      const organizationId = 'test-org-123';

      // Mock main query with chainable builder
      const mockQueryBuilder = createChainableBuilder({
        data: [],
        error: null,
        count: 0
      });

      // Mock count query
      const mockCountBuilder = createChainableBuilder({
        count: 0,
        error: null
      });

      mockFrom
        .mockReturnValueOnce({
          select: jest.fn(() => mockQueryBuilder)
        })
        .mockReturnValueOnce({
          select: jest.fn(() => mockCountBuilder)
        });

      const result = await costControl.getAlertHistory(organizationId, {
        resourceType: 'roasts'
      });

      expect(result.alerts).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should handle errors when getting alert history', async () => {
      // Mock main query with error
      const mockQueryBuilder = createChainableBuilder({
        data: null,
        error: { message: 'Database error' }
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn(() => mockQueryBuilder)
      });

      await expect(
        costControl.getAlertHistory('test-org')
      ).rejects.toEqual({ message: 'Database error' });
    });
  });

  describe('getAlertStats', () => {
    it('should get alert statistics for organization', async () => {
      const organizationId = 'test-org-123';

      const alertsData = [
        {
          metadata: {
            resourceType: 'roasts',
            thresholdPercentage: 80
          },
          created_at: new Date().toISOString()
        },
        {
          metadata: {
            resourceType: 'roasts',
            thresholdPercentage: 90
          },
          created_at: new Date().toISOString()
        }
      ];

      const mockQueryBuilder = createChainableBuilder({
        data: alertsData,
        error: null
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn(() => mockQueryBuilder)
      });

      const result = await costControl.getAlertStats(organizationId, 30);

      expect(result.organizationId).toBe(organizationId);
      expect(result.stats.total).toBe(2);
      expect(result.stats.byResourceType.roasts).toBe(2);
      expect(result.stats.byThreshold).toBeDefined();
    });

    it('should handle errors when getting alert stats', async () => {
      // Create a builder that throws error when awaited
      const mockQueryBuilder = {
        eq: jest.fn(() => mockQueryBuilder),
        gte: jest.fn(() => Promise.resolve({
          data: null,
          error: { message: 'Database error' }
        })),
        then: (resolve, reject) => {
          reject({ message: 'Database error' });
        }
      };

      mockFrom.mockReturnValueOnce({
        select: jest.fn(() => mockQueryBuilder)
      });

      await expect(costControl.getAlertStats('test-org')).rejects.toEqual({
        message: 'Database error'
      });
    });
  });

  describe('Constructor and Initialization', () => {
    it('should use mockMode when isMockMode is true', () => {
      const mockModeModule = require('../../../src/config/mockMode');
      const originalIsMockMode = mockModeModule.mockMode.isMockMode;
      const originalGenerateMock = mockModeModule.mockMode.generateMockSupabaseClient;

      mockModeModule.mockMode.isMockMode = true;
      mockModeModule.mockMode.generateMockSupabaseClient = jest.fn(() => mockSupabaseClient);

      const service = new CostControlService();

      expect(mockModeModule.mockMode.generateMockSupabaseClient).toHaveBeenCalled();
      expect(service.supabase).toBe(mockSupabaseClient);

      // Restore
      mockModeModule.mockMode.isMockMode = originalIsMockMode;
      mockModeModule.mockMode.generateMockSupabaseClient = originalGenerateMock;
    });

    it('should throw error when SUPABASE_SERVICE_KEY is missing', () => {
      const originalKey = process.env.SUPABASE_SERVICE_KEY;
      delete process.env.SUPABASE_SERVICE_KEY;

      expect(() => {
        new CostControlService();
      }).toThrow('SUPABASE_SERVICE_KEY is required for admin operations');

      process.env.SUPABASE_SERVICE_KEY = originalKey;
    });

    it('should throw error when SUPABASE_URL is missing', () => {
      const originalUrl = process.env.SUPABASE_URL;
      delete process.env.SUPABASE_URL;

      expect(() => {
        new CostControlService();
      }).toThrow('SUPABASE_URL is required for CostControlService');

      process.env.SUPABASE_URL = originalUrl;
    });
  });

  describe('recordUsage', () => {
    it('should record usage and cost', async () => {
      const organizationId = 'test-org-123';
      const platform = 'twitter';
      const operationType = 'generate_reply';
      const metadata = { tokensUsed: 100 };

      // Mock usage_records insert - need to use mockInsert properly
      const mockInsertBuilder = {
        select: jest.fn(() => ({
          single: jest.fn(() =>
            Promise.resolve({
              data: { id: 'record-1' },
              error: null
            })
          )
        }))
      };

      mockFrom.mockReturnValueOnce({
        insert: jest.fn(() => mockInsertBuilder)
      });

      // Mock RPC record_usage
      mockRpc.mockResolvedValueOnce({
        data: {
          limit_exceeded: false,
          percentage_used: 75
        },
        error: null
      });

      // Mock checkAndSendUsageAlerts (not called since < 80%)
      jest.spyOn(costControl, 'checkAndSendUsageAlerts').mockResolvedValueOnce();

      const result = await costControl.recordUsage(
        organizationId,
        platform,
        operationType,
        metadata,
        null,
        1
      );

      expect(result.recorded).toBe(true);
      expect(result.usageRecordId).toBe('record-1');
      expect(mockRpc).toHaveBeenCalled();
    });

    it('should trigger alerts when usage >= 80%', async () => {
      const organizationId = 'test-org-123';

      mockInsertSelect.mockResolvedValueOnce({
        data: { id: 'record-1' },
        error: null
      });

      mockRpc.mockResolvedValueOnce({
        data: {
          limit_exceeded: false,
          percentage_used: 85
        },
        error: null
      });

      jest.spyOn(costControl, 'checkAndSendUsageAlerts').mockResolvedValueOnce();

      await costControl.recordUsage(organizationId, 'twitter', 'generate_reply');

      expect(costControl.checkAndSendUsageAlerts).toHaveBeenCalled();
    });

    it('should handle errors when recording usage', async () => {
      const mockInsertBuilder = {
        select: jest.fn(() => ({
          single: jest.fn(() =>
            Promise.resolve({
              data: null,
              error: { message: 'Database error' }
            })
          )
        }))
      };

      mockFrom.mockReturnValueOnce({
        insert: jest.fn(() => mockInsertBuilder)
      });

      await expect(
        costControl.recordUsage('test-org', 'twitter', 'generate_reply')
      ).rejects.toEqual({ message: 'Database error' });
    });
  });

  describe('incrementUsageCounters', () => {
    it('should send alert when approaching limit', async () => {
      const organizationId = 'test-org-123';

      mockRpc.mockResolvedValueOnce({
        data: { success: true },
        error: null
      });

      jest.spyOn(costControl, 'checkUsageLimit').mockResolvedValueOnce({
        canUse: true,
        isNearLimit: true,
        alertSent: false,
        currentUsage: 850,
        limit: 1000
      });

      jest.spyOn(costControl, 'sendUsageAlert').mockResolvedValueOnce();

      await costControl.incrementUsageCounters(organizationId, 'twitter', 5);

      expect(costControl.sendUsageAlert).toHaveBeenCalled();
    });

    it('should handle errors when incrementing usage', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC error' }
      });

      await expect(
        costControl.incrementUsageCounters('test-org', 'twitter', 5)
      ).rejects.toEqual({ message: 'RPC error' });
    });
  });

  describe('createDefaultUsageAlerts', () => {
    it('should create default alerts when none exist', async () => {
      const organizationId = 'test-org-123';

      // Mock no existing alerts for all resource types
      const mockCheckBuilder = createChainableBuilder({
        data: null,
        error: null
      });

      // Override mockFrom temporarily for this test
      const originalMockFrom = mockFrom.getMockImplementation();
      
      let callCount = 0;
      mockFrom.mockImplementation((tableName) => {
        callCount++;
        if (callCount <= 6) {
          // First 6 calls are select queries
          return {
            select: jest.fn(() => mockCheckBuilder),
            insert: mockInsert,
            update: mockUpdate,
            upsert: mockUpsert
          };
        } else {
          // 7th call is insert
          return {
            select: mockSelect,
            insert: jest.fn(() => Promise.resolve({ error: null })),
            update: mockUpdate,
            upsert: mockUpsert
          };
        }
      });

      const result = await costControl.createDefaultUsageAlerts(organizationId);

      // Restore original implementation
      mockFrom.mockImplementation(originalMockFrom);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      const organizationId = 'test-org-123';

      // Mock error when checking existing alerts
      const mockCheckBuilder = createChainableBuilder({
        data: null,
        error: { message: 'Database error' }
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn(() => mockCheckBuilder)
      });

      // Should not throw - returns empty array
      const result = await costControl.createDefaultUsageAlerts(organizationId);

      expect(result).toEqual([]);
    });
  });

  describe('checkAndSendUsageAlerts', () => {
    it('should handle errors gracefully when checking alerts', async () => {
      const organizationId = 'test-org-123';
      const usageData = {
        current_usage: 850,
        monthly_limit: 1000
      };

      const mockAlertsBuilder = createChainableBuilder({
        data: null,
        error: { message: 'Database error' }
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn(() => mockAlertsBuilder)
      });

      // Should not throw - alerts are not critical
      await expect(
        costControl.checkAndSendUsageAlerts(organizationId, 'roasts', usageData)
      ).resolves.not.toThrow();
    });
  });

  describe('setUsageLimit', () => {
    it('should set usage limit for organization', async () => {
      const organizationId = 'test-org-123';
      const resourceType = 'roasts';
      const monthlyLimit = 1000;

      mockUpsertSelect.mockResolvedValueOnce({
        data: {
          organization_id: organizationId,
          resource_type: resourceType,
          monthly_limit: monthlyLimit,
          is_active: true
        },
        error: null
      });

      const result = await costControl.setUsageLimit(
        organizationId,
        resourceType,
        monthlyLimit,
        { allowOverage: true, hardLimit: false }
      );

      expect(result.organization_id).toBe(organizationId);
      expect(result.resource_type).toBe(resourceType);
      expect(result.monthly_limit).toBe(monthlyLimit);
      expect(mockUpsert).toHaveBeenCalled();
    });

    it('should handle errors when setting usage limit', async () => {
      mockUpsertSelect.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(
        costControl.setUsageLimit('test-org', 'roasts', 1000)
      ).rejects.toEqual({ message: 'Database error' });
    });
  });

  describe('updatePlanUsageLimits', () => {
    it('should handle errors when updating plan limits', async () => {
      const organizationId = 'test-org-123';
      const planId = 'pro';

      // Mock setUsageLimit to throw error
      jest.spyOn(costControl, 'setUsageLimit').mockRejectedValueOnce(
        new Error('Database error')
      );

      await expect(
        costControl.updatePlanUsageLimits(organizationId, planId)
      ).rejects.toThrow('Database error');
    });
  });

  describe('resetAllMonthlyUsage', () => {
    it('should reset monthly usage for all organizations', async () => {
      mockRpc.mockResolvedValueOnce({
        data: 10,
        error: null
      });

      const result = await costControl.resetAllMonthlyUsage();

      expect(result.success).toBe(true);
      expect(result.organizationsReset).toBe(10);
      expect(mockRpc).toHaveBeenCalledWith('reset_monthly_usage');
    });

    it('should handle errors when resetting monthly usage', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC error' }
      });

      await expect(costControl.resetAllMonthlyUsage()).rejects.toEqual({
        message: 'RPC error'
      });
    });
  });

  describe('checkUsageLimit', () => {
    it('should handle case when monthlyUsage does not exist', async () => {
      const organizationId = 'test-org-123';

      // Mock organizations query - need to use chainable builder
      const mockOrgBuilder = createChainableBuilder({
        data: {
          plan_id: 'pro',
          monthly_responses_limit: 1000,
          monthly_responses_used: 500
        },
        error: null
      });

      // Mock monthly_usage query - not found (usageError but data is null)
      const mockUsageBuilder = createChainableBuilder({
        data: null,
        error: { code: 'PGRST116' } // Not found
      });

      const originalMockFrom = mockFrom.getMockImplementation();
      let callCount = 0;
      mockFrom.mockImplementation((tableName) => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn(() => mockOrgBuilder),
            insert: mockInsert,
            update: mockUpdate,
            upsert: mockUpsert
          };
        } else {
          return {
            select: jest.fn(() => mockUsageBuilder),
            insert: mockInsert,
            update: mockUpdate,
            upsert: mockUpsert
          };
        }
      });

      const result = await costControl.checkUsageLimit(organizationId);

      // Restore
      mockFrom.mockImplementation(originalMockFrom);

      expect(result.canUse).toBe(true);
      expect(result.currentUsage).toBe(0);
      expect(result.limit).toBe(1000);
    });

    it('should handle unlimited plans (limit === -1)', async () => {
      const organizationId = 'test-org-123';

      const mockOrgBuilder = createChainableBuilder({
        data: {
          plan_id: 'custom',
          monthly_responses_limit: -1,
          monthly_responses_used: 0
        },
        error: null
      });

      const mockUsageBuilder = createChainableBuilder({
        data: {
          total_responses: 10000,
          limit_exceeded: false
        },
        error: null
      });

      const mockOrgTable = {
        select: jest.fn(() => mockOrgBuilder)
      };

      const mockUsageTable = {
        select: jest.fn(() => mockUsageBuilder)
      };

      mockFrom
        .mockReturnValueOnce(mockOrgTable)
        .mockReturnValueOnce(mockUsageTable);

      const result = await costControl.checkUsageLimit(organizationId);

      expect(result.canUse).toBe(true);
      expect(result.percentage).toBe(0);
    });
  });

  describe('getAlertHistory - Optional Filters', () => {
    it('should filter by alertType', async () => {
      const organizationId = 'test-org-123';

      const mockQueryBuilder = createChainableBuilder({
        data: [],
        error: null,
        count: 0
      });

      const mockCountBuilder = createChainableBuilder({
        count: 0,
        error: null
      });

      mockFrom
        .mockReturnValueOnce({
          select: jest.fn(() => mockQueryBuilder)
        })
        .mockReturnValueOnce({
          select: jest.fn(() => mockCountBuilder)
        });

      const result = await costControl.getAlertHistory(organizationId, {
        alertType: 'email'
      });

      expect(result.filters.alertType).toBe('email');
    });

    it('should filter by dateFrom', async () => {
      const organizationId = 'test-org-123';
      const dateFrom = new Date('2024-01-01').toISOString();

      const mockQueryBuilder = createChainableBuilder({
        data: [],
        error: null,
        count: 0
      });

      const mockCountBuilder = createChainableBuilder({
        count: 0,
        error: null
      });

      mockFrom
        .mockReturnValueOnce({
          select: jest.fn(() => mockQueryBuilder)
        })
        .mockReturnValueOnce({
          select: jest.fn(() => mockCountBuilder)
        });

      const result = await costControl.getAlertHistory(organizationId, {
        dateFrom
      });

      expect(result.filters.dateFrom).toBe(dateFrom);
    });

    it('should filter by dateTo', async () => {
      const organizationId = 'test-org-123';
      const dateTo = new Date('2024-12-31').toISOString();

      const mockQueryBuilder = createChainableBuilder({
        data: [],
        error: null,
        count: 0
      });

      const mockCountBuilder = createChainableBuilder({
        count: 0,
        error: null
      });

      mockFrom
        .mockReturnValueOnce({
          select: jest.fn(() => mockQueryBuilder)
        })
        .mockReturnValueOnce({
          select: jest.fn(() => mockCountBuilder)
        });

      const result = await costControl.getAlertHistory(organizationId, {
        dateTo
      });

      expect(result.filters.dateTo).toBe(dateTo);
    });
  });
});

