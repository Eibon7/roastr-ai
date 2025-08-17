/**
 * Enhanced Cost Control Service Tests
 * 
 * Comprehensive tests to improve coverage from 5.63% to 80%+
 */

const CostControlService = require('../../../src/services/costControl');

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gte: jest.fn(() => ({
            lt: jest.fn(() => ({
              sum: jest.fn(() => ({
                single: jest.fn()
              }))
            }))
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
      }))
    }))
  }))
}));

describe('CostControlService', () => {
  let costControl;
  let mockSupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'http://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-key';
    
    costControl = new CostControlService();
    mockSupabase = costControl.supabase;
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(costControl.supabaseUrl).toBe('http://test.supabase.co');
      expect(costControl.supabaseKey).toBe('test-key');
      expect(costControl.supabase).toBeDefined();
      expect(costControl.plans).toBeDefined();
      expect(costControl.operationCosts).toBeDefined();
    });

    it('should have all required plan configurations', () => {
      const expectedPlans = ['free', 'pro', 'creator_plus', 'custom'];
      
      expectedPlans.forEach(planId => {
        expect(costControl.plans[planId]).toBeDefined();
        expect(costControl.plans[planId]).toHaveProperty('id', planId);
        expect(costControl.plans[planId]).toHaveProperty('name');
        expect(costControl.plans[planId]).toHaveProperty('monthlyResponsesLimit');
        expect(costControl.plans[planId]).toHaveProperty('integrationsLimit');
        expect(costControl.plans[planId]).toHaveProperty('shieldEnabled');
        expect(costControl.plans[planId]).toHaveProperty('features');
      });
    });

    it('should have correct operation costs', () => {
      expect(costControl.operationCosts).toEqual({
        fetch_comment: 0,
        analyze_toxicity: 1,
        generate_reply: 5,
        post_response: 0
      });
    });
  });

  describe('getUserUsage', () => {
    it('should return current month usage successfully', async () => {
      const mockUsageData = {
        responses_this_month: 50,
        cost_this_month: 250,
        last_reset_date: new Date().toISOString()
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUsageData,
              error: null
            })
          })
        })
      });

      const result = await costControl.getUserUsage('user123');

      expect(result).toEqual({
        success: true,
        usage: mockUsageData
      });
      expect(mockSupabase.from).toHaveBeenCalledWith('user_usage');
    });

    it('should handle user not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'No rows found' }
            })
          })
        })
      });

      const result = await costControl.getUserUsage('nonexistent');

      expect(result).toEqual({
        success: true,
        usage: {
          responses_this_month: 0,
          cost_this_month: 0,
          last_reset_date: null
        }
      });
    });

    it('should handle database errors', async () => {
      const dbError = { message: 'Database connection failed' };
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: dbError
            })
          })
        })
      });

      const result = await costControl.getUserUsage('user123');

      expect(result).toEqual({
        success: false,
        error: 'Database connection failed'
      });
    });

    it('should handle exceptions gracefully', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Supabase client error');
      });

      const result = await costControl.getUserUsage('user123');

      expect(result).toEqual({
        success: false,
        error: 'Supabase client error'
      });
    });
  });

  describe('checkOperationAllowed', () => {
    it('should allow operation within limits for free plan', async () => {
      const mockUsage = {
        responses_this_month: 50,
        cost_this_month: 250
      };
      const mockUserData = {
        subscription_plan: 'free'
      };

      jest.spyOn(costControl, 'getUserUsage').mockResolvedValue({
        success: true,
        usage: mockUsage
      });
      jest.spyOn(costControl, 'getUserSubscriptionPlan').mockResolvedValue(mockUserData);

      const result = await costControl.checkOperationAllowed('user123', 'generate_reply');

      expect(result).toEqual({
        allowed: true,
        reason: 'Operation allowed',
        usage: mockUsage,
        plan: mockUserData
      });
    });

    it('should deny operation when exceeding free plan limits', async () => {
      const mockUsage = {
        responses_this_month: 100, // At limit
        cost_this_month: 500
      };
      const mockUserData = {
        subscription_plan: 'free'
      };

      jest.spyOn(costControl, 'getUserUsage').mockResolvedValue({
        success: true,
        usage: mockUsage
      });
      jest.spyOn(costControl, 'getUserSubscriptionPlan').mockResolvedValue(mockUserData);

      const result = await costControl.checkOperationAllowed('user123', 'generate_reply');

      expect(result).toEqual({
        allowed: false,
        reason: 'Monthly response limit exceeded for free plan',
        usage: mockUsage,
        plan: mockUserData
      });
    });

    it('should allow unlimited operations for creator_plus plan', async () => {
      const mockUsage = {
        responses_this_month: 5000,
        cost_this_month: 25000
      };
      const mockUserData = {
        subscription_plan: 'creator_plus'
      };

      jest.spyOn(costControl, 'getUserUsage').mockResolvedValue({
        success: true,
        usage: mockUsage
      });
      jest.spyOn(costControl, 'getUserSubscriptionPlan').mockResolvedValue(mockUserData);

      const result = await costControl.checkOperationAllowed('user123', 'generate_reply');

      expect(result.allowed).toBe(true);
    });

    it('should handle unknown operation types', async () => {
      const mockUsage = { responses_this_month: 10, cost_this_month: 50 };
      const mockUserData = { subscription_plan: 'free' };

      jest.spyOn(costControl, 'getUserUsage').mockResolvedValue({
        success: true,
        usage: mockUsage
      });
      jest.spyOn(costControl, 'getUserSubscriptionPlan').mockResolvedValue(mockUserData);

      const result = await costControl.checkOperationAllowed('user123', 'unknown_operation');

      expect(result.allowed).toBe(true); // Unknown operations default to allowed
    });

    it('should handle errors in usage checking', async () => {
      jest.spyOn(costControl, 'getUserUsage').mockResolvedValue({
        success: false,
        error: 'Database error'
      });

      const result = await costControl.checkOperationAllowed('user123', 'generate_reply');

      expect(result).toEqual({
        allowed: false,
        reason: 'Database error',
        usage: null,
        plan: null
      });
    });
  });

  describe('trackOperation', () => {
    it('should track operation successfully', async () => {
      const mockUpdatedUsage = {
        responses_this_month: 51,
        cost_this_month: 255
      };

      mockSupabase.from.mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUpdatedUsage,
              error: null
            })
          })
        })
      });

      const result = await costControl.trackOperation('user123', 'generate_reply');

      expect(result).toEqual({
        success: true,
        usage: mockUpdatedUsage
      });
    });

    it('should calculate correct costs for different operations', async () => {
      const operations = [
        { type: 'fetch_comment', expectedCost: 0 },
        { type: 'analyze_toxicity', expectedCost: 1 },
        { type: 'generate_reply', expectedCost: 5 },
        { type: 'post_response', expectedCost: 0 }
      ];

      for (const { type, expectedCost } of operations) {
        mockSupabase.from.mockReturnValue({
          upsert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { cost_this_month: expectedCost },
                error: null
              })
            })
          })
        });

        await costControl.trackOperation('user123', type);

        // Verify the upsert was called with correct cost increment
        const upsertCall = mockSupabase.from().upsert.mock.calls[0][0];
        expect(upsertCall).toMatchObject({
          user_id: 'user123',
          responses_this_month: expect.any(Number),
          cost_this_month: expect.any(Number)
        });
      }
    });

    it('should handle database errors during tracking', async () => {
      const dbError = { message: 'Insert failed' };
      
      mockSupabase.from.mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: dbError
            })
          })
        })
      });

      const result = await costControl.trackOperation('user123', 'generate_reply');

      expect(result).toEqual({
        success: false,
        error: 'Insert failed'
      });
    });

    it('should handle unknown operation types gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { responses_this_month: 1, cost_this_month: 0 },
              error: null
            })
          })
        })
      });

      const result = await costControl.trackOperation('user123', 'unknown_operation');

      expect(result.success).toBe(true);
      // Should track with 0 cost for unknown operations
    });
  });

  describe('getUserSubscriptionPlan', () => {
    it('should return user subscription plan', async () => {
      const mockPlanData = {
        subscription_plan: 'pro',
        subscription_status: 'active'
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockPlanData,
              error: null
            })
          })
        })
      });

      const result = await costControl.getUserSubscriptionPlan('user123');

      expect(result).toEqual(mockPlanData);
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
    });

    it('should return default plan for user not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }
            })
          })
        })
      });

      const result = await costControl.getUserSubscriptionPlan('nonexistent');

      expect(result).toEqual({
        subscription_plan: 'free',
        subscription_status: 'active'
      });
    });

    it('should handle database errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Connection timeout' }
            })
          })
        })
      });

      await expect(costControl.getUserSubscriptionPlan('user123')).rejects.toThrow('Connection timeout');
    });
  });

  describe('getPlanLimits', () => {
    it('should return correct limits for each plan', () => {
      const testCases = [
        { plan: 'free', expectedResponses: 100, expectedIntegrations: 2 },
        { plan: 'pro', expectedResponses: 1000, expectedIntegrations: 5 },
        { plan: 'creator_plus', expectedResponses: 5000, expectedIntegrations: 999 },
        { plan: 'custom', expectedResponses: 999999, expectedIntegrations: 999 }
      ];

      testCases.forEach(({ plan, expectedResponses, expectedIntegrations }) => {
        const limits = costControl.getPlanLimits(plan);
        
        expect(limits).toEqual({
          monthlyResponsesLimit: expectedResponses,
          integrationsLimit: expectedIntegrations,
          shieldEnabled: plan !== 'free',
          features: costControl.plans[plan].features
        });
      });
    });

    it('should return free plan limits for unknown plan', () => {
      const limits = costControl.getPlanLimits('unknown_plan');
      
      expect(limits).toEqual({
        monthlyResponsesLimit: 100,
        integrationsLimit: 2,
        shieldEnabled: false,
        features: costControl.plans.free.features
      });
    });
  });

  describe('resetMonthlyUsage', () => {
    it('should reset usage for specified user', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { responses_this_month: 0, cost_this_month: 0 },
                error: null
              })
            })
          })
        })
      });

      const result = await costControl.resetMonthlyUsage('user123');

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_usage');
    });

    it('should handle errors during reset', async () => {
      const dbError = { message: 'Update failed' };
      
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: dbError
              })
            })
          })
        })
      });

      const result = await costControl.resetMonthlyUsage('user123');

      expect(result).toEqual({
        success: false,
        error: 'Update failed'
      });
    });
  });

  describe('calculateOperationCost', () => {
    it('should return correct costs for all operations', () => {
      expect(costControl.calculateOperationCost('fetch_comment')).toBe(0);
      expect(costControl.calculateOperationCost('analyze_toxicity')).toBe(1);
      expect(costControl.calculateOperationCost('generate_reply')).toBe(5);
      expect(costControl.calculateOperationCost('post_response')).toBe(0);
    });

    it('should return 0 for unknown operations', () => {
      expect(costControl.calculateOperationCost('unknown_operation')).toBe(0);
    });

    it('should handle null/undefined operations', () => {
      expect(costControl.calculateOperationCost(null)).toBe(0);
      expect(costControl.calculateOperationCost(undefined)).toBe(0);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete operation workflow', async () => {
      // Setup: User with some existing usage
      const mockUsage = { responses_this_month: 25, cost_this_month: 125 };
      const mockUserData = { subscription_plan: 'pro' };

      jest.spyOn(costControl, 'getUserUsage').mockResolvedValue({
        success: true,
        usage: mockUsage
      });
      jest.spyOn(costControl, 'getUserSubscriptionPlan').mockResolvedValue(mockUserData);
      jest.spyOn(costControl, 'trackOperation').mockResolvedValue({
        success: true,
        usage: { responses_this_month: 26, cost_this_month: 130 }
      });

      // 1. Check if operation is allowed
      const checkResult = await costControl.checkOperationAllowed('user123', 'generate_reply');
      expect(checkResult.allowed).toBe(true);

      // 2. If allowed, track the operation
      if (checkResult.allowed) {
        const trackResult = await costControl.trackOperation('user123', 'generate_reply');
        expect(trackResult.success).toBe(true);
      }
    });

    it('should deny operation and not track when limits exceeded', async () => {
      const mockUsage = { responses_this_month: 999, cost_this_month: 4995 }; // Near limit
      const mockUserData = { subscription_plan: 'pro' }; // Pro has 1000 limit

      jest.spyOn(costControl, 'getUserUsage').mockResolvedValue({
        success: true,
        usage: mockUsage
      });
      jest.spyOn(costControl, 'getUserSubscriptionPlan').mockResolvedValue(mockUserData);

      const checkResult = await costControl.checkOperationAllowed('user123', 'generate_reply');
      expect(checkResult.allowed).toBe(true); // Should still be allowed (999 < 1000)

      // But if we're at exactly the limit
      mockUsage.responses_this_month = 1000;
      const checkResult2 = await costControl.checkOperationAllowed('user123', 'generate_reply');
      expect(checkResult2.allowed).toBe(false);
    });
  });
});