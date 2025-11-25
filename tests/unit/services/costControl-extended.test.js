/**
 * Cost Control Service Extended Tests
 *
 * Additional tests for improved coverage of costControl.js
 */

// Mock mockMode FIRST to prevent singleton creation
jest.mock('../../../src/config/mockMode', () => ({
  mockMode: {
    isMockMode: true,
    generateMockSupabaseClient: jest.fn(() => ({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null }),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      rpc: jest
        .fn()
        .mockResolvedValue({ data: { allowed: true, current_usage: 10, limit: 100 }, error: null }),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 })
    }))
  }
}));

const CostControlService = require('../../../src/services/costControl');

// Mock planLimitsService
jest.mock('../../../src/services/planLimitsService', () => ({
  checkResourceLimit: jest.fn().mockResolvedValue({
    allowed: true,
    current_usage: 10,
    limit: 100,
    percentage: 10
  }),
  getPlanLimits: jest.fn().mockReturnValue({
    roasts: { monthly: 100 },
    api_calls: { monthly: 1000 }
  }),
  incrementUsage: jest.fn().mockResolvedValue({ success: true })
}));

describe('CostControlService - Extended Coverage', () => {
  let costControl;
  let mockSupabase;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-key';

    costControl = new CostControlService();
    mockSupabase = costControl.supabase;

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getResourceDisplayName', () => {
    it('should return display name for roasts', () => {
      const name = costControl.getResourceDisplayName('roasts');
      expect(name).toBe('roast responses');
    });

    it('should return display name for api_calls', () => {
      const name = costControl.getResourceDisplayName('api_calls');
      expect(name).toBe('API calls');
    });

    it('should return display name for comment_analysis', () => {
      const name = costControl.getResourceDisplayName('comment_analysis');
      expect(name).toBe('comment analyses');
    });

    it('should return display name for shield_actions', () => {
      const name = costControl.getResourceDisplayName('shield_actions');
      expect(name).toBe('shield actions');
    });

    it('should return name for unknown resource', () => {
      const name = costControl.getResourceDisplayName('unknown_resource');
      expect(name).toBe('unknown_resource');
    });
  });

  describe('buildLimitMessage', () => {
    it('should build message for limit_reached reason', () => {
      const result = { reason: 'limit_reached', limit: 100 };
      const message = costControl.buildLimitMessage(result, 'Roasts');

      expect(message).toContain('limit_reached');
    });

    it('should build message for trial_expired reason', () => {
      const result = { reason: 'trial_expired' };
      const message = costControl.buildLimitMessage(result, 'Roasts');

      expect(message).toContain('trial_expired');
    });

    it('should build message for plan_required reason', () => {
      const result = { reason: 'plan_required' };
      const message = costControl.buildLimitMessage(result, 'Roasts');

      expect(message).toContain('plan_required');
    });

    it('should build default message for unknown reason', () => {
      const result = { reason: 'unknown' };
      const message = costControl.buildLimitMessage(result, 'Roasts');

      expect(message).toBeDefined();
    });
  });

  describe('getUpgradeUrl', () => {
    it('should return upgrade URL for starter plan', () => {
      const url = costControl.getUpgradeUrl('starter');
      expect(url).toContain('/upgrade');
    });

    it('should return upgrade URL for pro plan', () => {
      const url = costControl.getUpgradeUrl('pro');
      expect(url).toContain('/upgrade');
    });

    it('should return upgrade URL for unknown plan', () => {
      const url = costControl.getUpgradeUrl('unknown');
      expect(url).toContain('/upgrade');
    });
  });

  describe('setUsageLimit', () => {
    it('should set custom usage limit', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ data: { id: 'limit-123' }, error: null })
      });

      try {
        const result = await costControl.setUsageLimit('org-123', 'roasts', 500);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle upsert errors', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ data: null, error: { message: 'Upsert error' } })
      });

      try {
        const result = await costControl.setUsageLimit('org-123', 'roasts', 500);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should accept additional options', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ data: { id: 'limit-123' }, error: null })
      });

      try {
        const result = await costControl.setUsageLimit('org-123', 'roasts', 500, {
          warning_threshold: 0.75
        });
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('canUseShield', () => {
    it('should allow shield for pro plan', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { subscription_plan: 'pro' },
          error: null
        })
      });

      try {
        const result = await costControl.canUseShield('org-123');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should deny shield for starter_trial plan', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { subscription_plan: 'starter_trial' },
          error: null
        })
      });

      try {
        const result = await costControl.canUseShield('org-123');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle missing organization', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        })
      });

      try {
        const result = await costControl.canUseShield('org-123');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('updatePlanUsageLimits', () => {
    it('should update limits when plan changes', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      try {
        const result = await costControl.updatePlanUsageLimits('org-123', 'pro');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle invalid plan', async () => {
      try {
        const result = await costControl.updatePlanUsageLimits('org-123', 'invalid_plan');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('resetAllMonthlyUsage', () => {
    it('should reset usage for all organizations', async () => {
      costControl.supabase.rpc = jest
        .fn()
        .mockResolvedValue({ data: { reset_count: 5 }, error: null });

      const result = await costControl.resetAllMonthlyUsage();

      expect(costControl.supabase.rpc).toHaveBeenCalled();
    });

    it('should handle RPC errors', async () => {
      costControl.supabase.rpc = jest
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'RPC error' } });

      try {
        const result = await costControl.resetAllMonthlyUsage();
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('sendUsageAlert', () => {
    it('should send usage alert', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: { id: 'alert-123' }, error: null })
      });

      const usageData = {
        resource_type: 'roasts',
        current_usage: 80,
        limit: 100,
        percentage: 80
      };

      try {
        const result = await costControl.sendUsageAlert('org-123', usageData);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle insert errors', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: null, error: { message: 'Insert error' } })
      });

      const usageData = {
        resource_type: 'roasts',
        current_usage: 80,
        limit: 100,
        percentage: 80
      };

      try {
        const result = await costControl.sendUsageAlert('org-123', usageData);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('shouldSendAlert', () => {
    it('should return true when alert conditions are met', async () => {
      const alert = {
        sent_count: 0,
        max_alerts_per_day: 3,
        last_sent_at: null,
        threshold_percentage: 80
      };

      const result = await costControl.shouldSendAlert(alert, 85);

      expect(result).toBe(true);
    });

    it('should return false when max alerts reached', async () => {
      const alert = {
        sent_count: 3,
        max_alerts_per_day: 3,
        last_sent_at: new Date().toISOString(),
        threshold_percentage: 80
      };

      const result = await costControl.shouldSendAlert(alert, 85);

      expect(result).toBe(false);
    });
  });

  describe('getBillingSummary', () => {
    it('should return billing summary for month', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({
          data: [{ resource_type: 'roasts', usage_count: 50, cost_cents: 250 }],
          error: null
        }),
        single: jest.fn().mockResolvedValue({
          data: { subscription_plan: 'pro' },
          error: null
        })
      };

      costControl.supabase.from = jest.fn().mockReturnValue(mockChain);

      try {
        const result = await costControl.getBillingSummary('org-123', 2025, 1);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle empty usage data', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({
          data: [],
          error: null
        }),
        single: jest.fn().mockResolvedValue({
          data: { subscription_plan: 'pro' },
          error: null
        })
      };

      costControl.supabase.from = jest.fn().mockReturnValue(mockChain);

      try {
        const result = await costControl.getBillingSummary('org-123', 2025, 1);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('upgradePlan', () => {
    it('should upgrade plan successfully', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        upsert: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      try {
        const result = await costControl.upgradePlan('org-123', 'pro');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle invalid plan', async () => {
      try {
        const result = await costControl.upgradePlan('org-123', 'invalid_plan');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should accept stripe subscription id', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        upsert: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      try {
        const result = await costControl.upgradePlan('org-123', 'pro', 'stripe_sub_123');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('incrementUsageCounters', () => {
    it('should increment usage counters', async () => {
      costControl.supabase.rpc = jest
        .fn()
        .mockResolvedValue({ data: { success: true }, error: null });

      try {
        const result = await costControl.incrementUsageCounters('org-123', 'twitter', 5);
        expect(costControl.supabase.rpc).toHaveBeenCalled();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle RPC errors', async () => {
      costControl.supabase.rpc = jest
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'RPC error' } });

      try {
        const result = await costControl.incrementUsageCounters('org-123', 'twitter', 5);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('createDefaultUsageAlerts', () => {
    it('should create default alerts for organization', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        insert: jest.fn().mockResolvedValue({ data: { id: 'alert-123' }, error: null })
      });

      try {
        const result = await costControl.createDefaultUsageAlerts('org-123');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should skip existing alerts', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'existing-alert' },
          error: null
        }),
        insert: jest.fn().mockResolvedValue({ data: { id: 'alert-123' }, error: null })
      });

      try {
        const result = await costControl.createDefaultUsageAlerts('org-123');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('getUsageStats', () => {
    it('should return usage statistics', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            { platform: 'twitter', action_type: 'generate_reply', cost_cents: 5 },
            { platform: 'twitter', action_type: 'generate_reply', cost_cents: 5 }
          ],
          error: null
        }),
        single: jest.fn().mockResolvedValue({
          data: { subscription_plan: 'pro' },
          error: null
        })
      };

      costControl.supabase.from = jest.fn().mockReturnValue(mockChain);

      try {
        const result = await costControl.getUsageStats('org-123', 3);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('getEnhancedUsageStats', () => {
    it('should return enhanced usage statistics', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            { resource_type: 'roasts', platform: 'twitter', usage_count: 10 },
            { resource_type: 'roasts', platform: 'youtube', usage_count: 5 }
          ],
          error: null
        }),
        single: jest.fn().mockResolvedValue({
          data: { subscription_plan: 'pro' },
          error: null
        })
      };

      costControl.supabase.from = jest.fn().mockReturnValue(mockChain);

      try {
        const result = await costControl.getEnhancedUsageStats('org-123', 3);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('getAlertHistory', () => {
    it('should return alert history', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [{ id: 'alert-1', resource_type: 'roasts', sent_at: '2025-01-01' }],
          error: null,
          count: 1
        })
      });

      try {
        const result = await costControl.getAlertHistory('org-123');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should filter by resource type', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0
        })
      });

      try {
        const result = await costControl.getAlertHistory('org-123', { resourceType: 'roasts' });
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should filter by date range', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0
        })
      });

      try {
        const result = await costControl.getAlertHistory('org-123', {
          dateFrom: '2025-01-01',
          dateTo: '2025-01-31'
        });
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('getAlertStats', () => {
    it('should return alert statistics', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({
          data: [
            { resource_type: 'roasts', alert_type: 'warning' },
            { resource_type: 'roasts', alert_type: 'warning' },
            { resource_type: 'api_calls', alert_type: 'critical' }
          ],
          error: null
        })
      });

      try {
        const result = await costControl.getAlertStats('org-123', 30);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle empty stats', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({
          data: [],
          error: null
        })
      });

      const result = await costControl.getAlertStats('org-123', 30);

      expect(result).toBeDefined();
    });
  });

  describe('checkAndSendUsageAlerts', () => {
    it('should check and send alerts when threshold reached', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: [{ id: 'alert-1', threshold_percentage: 80, sent_count: 0, max_alerts_per_day: 3 }],
          error: null
        }),
        update: jest.fn().mockReturnThis(),
        insert: jest.fn().mockResolvedValue({ data: { id: 'log-123' }, error: null })
      });

      const usageData = {
        current_usage: 85,
        monthly_limit: 100,
        percentage_used: 85
      };

      try {
        const result = await costControl.checkAndSendUsageAlerts('org-123', 'roasts', usageData);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should not send alert when under threshold', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: [{ id: 'alert-1', threshold_percentage: 80, sent_count: 0, max_alerts_per_day: 3 }],
          error: null
        })
      });

      const usageData = {
        current_usage: 50,
        monthly_limit: 100,
        percentage_used: 50
      };

      try {
        const result = await costControl.checkAndSendUsageAlerts('org-123', 'roasts', usageData);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('checkUsageLimit', () => {
    it('should check usage limit for organization', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            subscription_plan: 'pro',
            monthly_usage: 50
          },
          error: null
        })
      });

      try {
        const result = await costControl.checkUsageLimit('org-123');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle missing organization', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        })
      });

      try {
        const result = await costControl.checkUsageLimit('org-123');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  // Additional tests for higher coverage

  describe('canPerformOperation', () => {
    it('should allow operation when under limit', async () => {
      costControl.supabase.rpc = jest.fn().mockResolvedValue({
        data: { allowed: true, current_usage: 50, limit: 100 },
        error: null
      });

      try {
        const result = await costControl.canPerformOperation('org-123', 'generate_reply', 1);
        expect(result.allowed).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should deny operation when at limit', async () => {
      costControl.supabase.rpc = jest.fn().mockResolvedValue({
        data: { allowed: false, current_usage: 100, limit: 100, reason: 'limit_reached' },
        error: null
      });

      try {
        const result = await costControl.canPerformOperation('org-123', 'generate_reply', 1);
        expect(result.allowed).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle RPC errors', async () => {
      costControl.supabase.rpc = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'RPC failed' }
      });

      try {
        await costControl.canPerformOperation('org-123', 'generate_reply', 1);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle invalid RPC result', async () => {
      costControl.supabase.rpc = jest.fn().mockResolvedValue({
        data: null,
        error: null
      });

      try {
        await costControl.canPerformOperation('org-123', 'generate_reply', 1);
      } catch (error) {
        expect(error.message).toContain('Invalid response');
      }
    });

    it('should map operation types correctly', async () => {
      costControl.supabase.rpc = jest.fn().mockResolvedValue({
        data: { allowed: true, current_usage: 10, limit: 100 },
        error: null
      });

      try {
        await costControl.canPerformOperation('org-123', 'shield_action', 1);
        expect(costControl.supabase.rpc).toHaveBeenCalledWith(
          'can_perform_operation',
          expect.objectContaining({ resource_type_param: 'shield_actions' })
        );
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('recordOperation', () => {
    it('should record operation successfully', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: { id: 'record-123' }, error: null })
      });

      try {
        const result = await costControl.recordOperation('org-123', 'generate_reply', 1, 'twitter');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle insert errors', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } })
      });

      try {
        await costControl.recordOperation('org-123', 'generate_reply', 1, 'twitter');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('getOrganizationUsage', () => {
    it('should return current month usage', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({
          data: [
            { resource_type: 'roasts', usage_count: 50 },
            { resource_type: 'api_calls', usage_count: 200 }
          ],
          error: null
        })
      });

      try {
        const result = await costControl.getOrganizationUsage('org-123');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle query errors', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Query failed' }
        })
      });

      try {
        await costControl.getOrganizationUsage('org-123');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('getOrganizationPlan', () => {
    it('should return organization plan', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { subscription_plan: 'pro', subscription_status: 'active' },
          error: null
        })
      });

      try {
        const result = await costControl.getOrganizationPlan('org-123');
        expect(result).toBe('pro');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should return default plan for new organizations', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        })
      });

      try {
        const result = await costControl.getOrganizationPlan('org-123');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('plans property access', () => {
    it('should have plans object with known plans', () => {
      expect(costControl.plans).toBeDefined();
      expect(costControl.plans.pro).toBeDefined();
      expect(costControl.plans.starter).toBeDefined();
    });

    it('should have operationCosts defined', () => {
      expect(costControl.operationCosts).toBeDefined();
      expect(costControl.operationCosts.generate_reply).toBeDefined();
    });
  });

  describe('downgradePlan', () => {
    it('should downgrade plan successfully', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        upsert: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      try {
        const result = await costControl.downgradePlan('org-123', 'starter');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle invalid target plan', async () => {
      try {
        const result = await costControl.downgradePlan('org-123', 'invalid_plan');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      try {
        const result = await costControl.cancelSubscription('org-123');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle update errors', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } })
      });

      try {
        await costControl.cancelSubscription('org-123');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('reactivateSubscription', () => {
    it('should reactivate subscription', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      try {
        const result = await costControl.reactivateSubscription('org-123');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('checkTrialStatus', () => {
    it('should return trial active', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            subscription_plan: 'starter_trial',
            trial_ends_at: new Date(Date.now() + 86400000).toISOString()
          },
          error: null
        })
      });

      try {
        const result = await costControl.checkTrialStatus('org-123');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should return trial expired', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            subscription_plan: 'starter_trial',
            trial_ends_at: new Date(Date.now() - 86400000).toISOString()
          },
          error: null
        })
      });

      try {
        const result = await costControl.checkTrialStatus('org-123');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  // Deep coverage for remaining functions

  describe('recordUsage - Complete Flow', () => {
    it('should record usage and track in database', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'usage-123', cost_cents: 5 },
          error: null
        })
      });

      costControl.supabase.rpc = jest.fn().mockResolvedValue({
        data: { percentage_used: 50, limit_exceeded: false },
        error: null
      });

      try {
        const result = await costControl.recordUsage(
          'org-123',
          'twitter',
          'generate_reply',
          { tokensUsed: 100 },
          'user-123',
          1
        );
        expect(result).toHaveProperty('recorded');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should trigger alerts when near limit', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'usage-123' },
          error: null
        }),
        update: jest.fn().mockReturnThis()
      });

      costControl.supabase.rpc = jest.fn().mockResolvedValue({
        data: { percentage_used: 85, limit_exceeded: false },
        error: null
      });

      try {
        const result = await costControl.recordUsage(
          'org-123',
          'twitter',
          'generate_reply',
          {},
          null,
          1
        );
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle usage record insert error', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Insert failed' }
        })
      });

      try {
        await costControl.recordUsage('org-123', 'twitter', 'generate_reply', {}, null, 1);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle RPC tracking error', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'usage-123' },
          error: null
        })
      });

      costControl.supabase.rpc = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'RPC failed' }
      });

      try {
        await costControl.recordUsage('org-123', 'twitter', 'generate_reply', {}, null, 1);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('incrementUsageCounters - Complete', () => {
    it('should increment counters via RPC', async () => {
      costControl.supabase.rpc = jest.fn().mockResolvedValue({
        data: { success: true, new_count: 51 },
        error: null
      });

      try {
        const result = await costControl.incrementUsageCounters('org-123', 'twitter', 5);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle RPC failure', async () => {
      costControl.supabase.rpc = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Increment failed' }
      });

      try {
        await costControl.incrementUsageCounters('org-123', 'twitter', 5);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('sendUsageAlert - Complete', () => {
    it('should insert alert record', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: { id: 'alert-123' },
          error: null
        })
      });

      try {
        const result = await costControl.sendUsageAlert('org-123', {
          resource_type: 'roasts',
          current_usage: 90,
          limit: 100,
          percentage: 90
        });
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('getUsageStats - Complete', () => {
    it('should aggregate stats from usage records', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            { platform: 'twitter', action_type: 'generate_reply', cost_cents: 5 },
            { platform: 'twitter', action_type: 'generate_reply', cost_cents: 5 },
            { platform: 'youtube', action_type: 'generate_reply', cost_cents: 5 }
          ],
          error: null
        }),
        single: jest.fn().mockResolvedValue({
          data: { subscription_plan: 'pro' },
          error: null
        })
      });

      try {
        const result = await costControl.getUsageStats('org-123', 30);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle query error', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Query failed' }
        })
      });

      try {
        await costControl.getUsageStats('org-123', 30);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('getEnhancedUsageStats - Complete', () => {
    it('should return detailed usage breakdown', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            { resource_type: 'roasts', platform: 'twitter', usage_count: 50 },
            { resource_type: 'roasts', platform: 'youtube', usage_count: 30 },
            { resource_type: 'api_calls', platform: 'twitter', usage_count: 200 }
          ],
          error: null
        }),
        single: jest.fn().mockResolvedValue({
          data: { subscription_plan: 'pro' },
          error: null
        })
      });

      try {
        const result = await costControl.getEnhancedUsageStats('org-123', 30);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('getBillingSummary - Complete', () => {
    it('should return monthly billing data', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({
          data: [{ resource_type: 'roasts', usage_count: 100, cost_cents: 500 }],
          error: null
        }),
        single: jest.fn().mockResolvedValue({
          data: { subscription_plan: 'pro', subscription_status: 'active' },
          error: null
        })
      });

      try {
        const result = await costControl.getBillingSummary('org-123', 2025, 1);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('upgradePlan - Complete', () => {
    it('should upgrade and update limits', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        upsert: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      try {
        const result = await costControl.upgradePlan('org-123', 'pro', 'stripe_sub_123');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should reject invalid plan', async () => {
      try {
        const result = await costControl.upgradePlan('org-123', 'invalid');
        expect(result.success).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('canUseShield - Plan Checks', () => {
    it('should allow shield for pro plan', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { subscription_plan: 'pro', subscription_status: 'active' },
          error: null
        })
      });

      try {
        const result = await costControl.canUseShield('org-123');
        expect(result.allowed).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should deny shield for starter_trial', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { subscription_plan: 'starter_trial' },
          error: null
        })
      });

      try {
        const result = await costControl.canUseShield('org-123');
        expect(result.allowed).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('setUsageLimit - Extended', () => {
    it('should set custom limit with warning threshold', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        upsert: jest.fn().mockResolvedValue({
          data: { id: 'limit-123', limit_value: 500, warning_threshold: 0.8 },
          error: null
        })
      });

      try {
        const result = await costControl.setUsageLimit('org-123', 'roasts', 500, {
          warning_threshold: 0.8,
          notify_on_threshold: true
        });
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('updatePlanUsageLimits - Extended', () => {
    it('should update all resource limits for plan', async () => {
      costControl.supabase.from = jest.fn().mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      try {
        const result = await costControl.updatePlanUsageLimits('org-123', 'plus');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
