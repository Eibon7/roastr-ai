/**
 * Cost Control Service Tests
 * 
 * Tests for multi-tenant cost management and usage tracking
 */

const CostControlService = require('../../../src/services/costControl');

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        })),
        gte: jest.fn(() => ({
          order: jest.fn(() => ({
            order: jest.fn()
          }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn()
          }))
        }))
      })),
      upsert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      rpc: jest.fn()
    }))
  }))
}));

describe('CostControlService', () => {
  let costControl;
  let mockSupabase;

  beforeEach(() => {
    // Mock environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-key';
    
    costControl = new CostControlService();
    mockSupabase = costControl.supabase;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canPerformOperation', () => {
    test('should allow operation when under limit', async () => {
      // Mock organization data
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                plan_id: 'free',
                monthly_responses_limit: 100,
                monthly_responses_used: 50
              },
              error: null
            })
          })
        })
      });

      // Mock usage data
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  plan_id: 'free',
                  monthly_responses_limit: 100,
                  monthly_responses_used: 50
                },
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: {
                      total_responses: 50
                    },
                    error: null
                  })
                })
              })
            })
          })
        });

      const result = await costControl.canPerformOperation('test-org-123');

      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(50);
      expect(result.limit).toBe(100);
      expect(result.percentage).toBe(50);
    });

    test('should deny operation when over limit', async () => {
      // Mock organization data
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                plan_id: 'free',
                monthly_responses_limit: 100,
                monthly_responses_used: 105
              },
              error: null
            })
          })
        })
      });

      // Mock usage data showing over limit
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  plan_id: 'free',
                  monthly_responses_limit: 100,
                  monthly_responses_used: 105
                },
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: {
                      total_responses: 105
                    },
                    error: null
                  })
                })
              })
            })
          })
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

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUsageRecord,
              error: null
            })
          })
        })
      });

      // Mock RPC call for incrementing counters
      mockSupabase.rpc.mockResolvedValue({ error: null });

      const result = await costControl.recordUsage(
        'test-org-123',
        'twitter',
        'generate_reply',
        { tokensUsed: 25 }
      );

      expect(result.recorded).toBe(true);
      expect(result.cost).toBe(5); // 5 cents for generate_reply
      expect(mockSupabase.from).toHaveBeenCalledWith('usage_records');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_usage', {
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

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUsageRecord,
              error: null
            })
          })
        })
      });

      const result = await costControl.recordUsage(
        'test-org-123',
        'twitter',
        'fetch_comment'
      );

      expect(result.recorded).toBe(true);
      expect(result.cost).toBe(0); // Free operation
      expect(mockSupabase.rpc).not.toHaveBeenCalled(); // No counter increment for free ops
    });
  });

  describe('canUseShield', () => {
    test('should allow Shield for pro plan', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                plan_id: 'pro'
              },
              error: null
            })
          })
        })
      });

      const result = await costControl.canUseShield('test-org-123');

      expect(result.allowed).toBe(true);
      expect(result.planId).toBe('pro');
      expect(result.planName).toBe('Pro');
    });

    test('should deny Shield for free plan', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                plan_id: 'free'
              },
              error: null
            })
          })
        })
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

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockOrg,
                error: null
              })
            })
          })
        })
      });

      // Mock app_logs insertion
      mockSupabase.from
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockOrg,
                  error: null
                })
              })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({ error: null })
        });

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

      // Mock the chain of database calls
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: mockMonthlyStats,
                    error: null
                  })
                })
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockOrg,
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockReturnValue({
                lt: jest.fn().mockResolvedValue({
                  data: mockUsageRecords,
                  error: null
                })
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { total_responses: 50 },
                    error: null
                  })
                })
              })
            })
          })
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
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      });

      await expect(
        costControl.canPerformOperation('test-org-123')
      ).rejects.toThrow('Database error');
    });
  });
});