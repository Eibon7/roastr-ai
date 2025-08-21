/**
 * Comprehensive tests for plan change rollback and error handling (Issue #125)
 * Tests the enhanced updateUserPlan function with rollback capabilities
 */

const AuthService = require('../../../src/services/authService');
const { supabaseServiceClient } = require('../../../src/config/supabase');
const { applyPlanLimits } = require('../../../src/services/subscriptionService');
const auditService = require('../../../src/services/auditService');
const { logger } = require('../../../src/utils/logger');

// Mock dependencies
jest.mock('../../../src/config/supabase');
jest.mock('../../../src/services/subscriptionService');
jest.mock('../../../src/services/auditService');
jest.mock('../../../src/utils/logger');

describe('Plan Change Rollback and Error Handling (Issue #125)', () => {
  let mockUserData;
  let mockSubscriptionData;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUserData = {
      id: 'test-user-id',
      email: 'test@example.com',
      plan: 'free',
      name: 'Test User'
    };
    
    mockSubscriptionData = {
      user_id: 'test-user-id',
      plan: 'free',
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };

    // Mock successful operations by default
    supabaseServiceClient.from = jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: mockUserData, error: null })
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: mockUserData, error: null })
          }))
        }))
      })),
      upsert: jest.fn(() => ({
        select: jest.fn().mockResolvedValue({ data: [mockSubscriptionData], error: null })
      })),
      delete: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ data: null, error: null })
      }))
    }));

    applyPlanLimits.mockResolvedValue({ success: true });
    auditService.logPlanChange.mockResolvedValue();
    
    // Mock subscription service getUserUsage
    const subscriptionService = require('../../../src/services/subscriptionService');
    subscriptionService.getUserUsage = jest.fn().mockResolvedValue({
      roastsThisMonth: 10,
      commentsThisMonth: 50,
      activeIntegrations: 1
    });

    // Mock plan validation
    const planValidation = require('../../../src/services/planValidation');
    planValidation.isChangeAllowed = jest.fn().mockResolvedValue({ allowed: true });
  });

  describe('Successful Plan Change', () => {
    test('should complete plan change successfully with configurable duration', async () => {
      const result = await AuthService.updateUserPlan('test-user-id', 'pro', 'admin-123');
      
      expect(result).toMatchObject({
        message: 'User plan updated successfully',
        oldPlan: 'free',
        newPlan: 'pro',
        limitsApplied: true,
        auditLogged: true,
        planDurationDays: 30
      });
      
      expect(applyPlanLimits).toHaveBeenCalledWith('test-user-id', 'pro', 'active');
      expect(auditService.logPlanChange).toHaveBeenCalledWith(
        expect.objectContaining({
          fromPlan: 'free',
          toPlan: 'pro',
          changeStatus: 'completed'
        })
      );
    });

    test('should use custom plan duration for creator_plus plan', async () => {
      const result = await AuthService.updateUserPlan('test-user-id', 'creator_plus', 'admin-123');
      
      expect(result.planDurationDays).toBe(30);
      expect(supabaseServiceClient.from().upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: 'creator_plus',
          current_period_end: expect.any(String)
        }),
        expect.any(Object)
      );
    });

    test('should handle custom plan with 90-day duration', async () => {
      const result = await AuthService.updateUserPlan('test-user-id', 'custom', 'admin-123');
      
      expect(result.planDurationDays).toBe(90);
    });
  });

  describe('Rollback Scenarios', () => {
    test('should rollback when applyPlanLimits fails', async () => {
      // Setup: Make applyPlanLimits fail
      const limitsError = new Error('Database connection failed');
      applyPlanLimits.mockRejectedValue(limitsError);

      // Mock the rollback operations
      const mockRollbackFrom = jest.fn(() => ({
        update: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ data: mockUserData, error: null })
        })),
        delete: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        }))
      }));
      supabaseServiceClient.from = jest.fn(mockRollbackFrom);

      await expect(AuthService.updateUserPlan('test-user-id', 'pro', 'admin-123'))
        .rejects.toThrow('Plan change failed during limits application and was rolled back: Database connection failed');
      
      // Verify rollback audit log was created
      expect(auditService.logPlanChange).toHaveBeenCalledWith(
        expect.objectContaining({
          fromPlan: 'pro', // Rolling back from new to old
          toPlan: 'free',
          changeStatus: 'rolled_back',
          metadata: expect.objectContaining({
            rollback_reason: 'Database connection failed'
          })
        })
      );
    });

    test('should restore original subscription data during rollback', async () => {
      // Setup: Existing subscription
      const originalSubscription = {
        user_id: 'test-user-id',
        plan: 'free',
        status: 'active',
        stripe_customer_id: 'cus_existing',
        current_period_start: '2024-01-01T00:00:00.000Z',
        current_period_end: '2024-01-31T00:00:00.000Z'
      };

      // Mock sequence: successful user fetch, successful subscription fetch, then failure
      const mockSelectSequence = jest.fn()
        .mockResolvedValueOnce({ data: mockUserData, error: null }) // Initial user fetch
        .mockResolvedValueOnce({ data: originalSubscription, error: null }); // Subscription fetch
      
      supabaseServiceClient.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(mockSelectSequence)
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: mockUserData, error: null })
            }))
          }))
        })),
        upsert: jest.fn().mockResolvedValue({ data: [mockSubscriptionData], error: null })
      }));

      applyPlanLimits.mockRejectedValue(new Error('Limits application failed'));

      await expect(AuthService.updateUserPlan('test-user-id', 'pro', 'admin-123'))
        .rejects.toThrow('Plan change failed during limits application and was rolled back');

      // Verify original subscription was restored
      expect(supabaseServiceClient.from().upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          ...originalSubscription,
          updated_at: expect.any(String)
        }),
        expect.any(Object)
      );
    });

    test('should handle rollback failure gracefully', async () => {
      applyPlanLimits.mockRejectedValue(new Error('Limits failed'));
      
      // Make rollback also fail
      supabaseServiceClient.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: mockUserData, error: null })
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn().mockRejectedValue(new Error('Rollback failed'))
        })),
        upsert: jest.fn().mockResolvedValue({ data: [mockSubscriptionData], error: null })
      }));

      await expect(AuthService.updateUserPlan('test-user-id', 'pro', 'admin-123'))
        .rejects.toThrow('Plan change failed during limits application and was rolled back');

      expect(logger.error).toHaveBeenCalledWith(
        'Rollback plan change failed:',
        expect.any(String)
      );
    });
  });

  describe('Error Handling Scenarios', () => {
    test('should handle user not found error', async () => {
      supabaseServiceClient.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'User not found' } })
          }))
        }))
      }));

      await expect(AuthService.updateUserPlan('test-user-id', 'pro', 'admin-123'))
        .rejects.toThrow('User not found');
    });

    test('should handle invalid plan error', async () => {
      await expect(AuthService.updateUserPlan('test-user-id', 'invalid-plan', 'admin-123'))
        .rejects.toThrow('Invalid plan. Valid plans are: free, pro, creator_plus, custom');
    });

    test('should handle plan validation failure', async () => {
      const planValidation = require('../../../src/services/planValidation');
      planValidation.isChangeAllowed.mockResolvedValue({
        allowed: false,
        reason: 'Usage exceeds new plan limits',
        warnings: ['You will lose priority support']
      });

      await expect(AuthService.updateUserPlan('test-user-id', 'pro', 'admin-123'))
        .rejects.toThrow('Plan change not allowed: Usage exceeds new plan limits. Warnings: You will lose priority support');
    });

    test('should handle user update failure', async () => {
      supabaseServiceClient.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: mockUserData, error: null })
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } })
            }))
          }))
        })),
        upsert: jest.fn().mockResolvedValue({ data: [mockSubscriptionData], error: null })
      }));

      await expect(AuthService.updateUserPlan('test-user-id', 'pro', 'admin-123'))
        .rejects.toThrow('Failed to update user plan: Update failed');
    });

    test('should handle emergency rollback after unexpected error', async () => {
      // Simulate successful initial operations but failure after rollback flag is set
      let callCount = 0;
      supabaseServiceClient.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => {
              callCount++;
              if (callCount <= 2) {
                return Promise.resolve({ data: mockUserData, error: null });
              }
              throw new Error('Unexpected database error');
            })
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: mockUserData, error: null })
            }))
          }))
        })),
        upsert: jest.fn().mockResolvedValue({ data: [mockSubscriptionData], error: null }),
        delete: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        }))
      }));

      await expect(AuthService.updateUserPlan('test-user-id', 'pro', 'admin-123'))
        .rejects.toThrow('Unexpected database error');

      expect(logger.info).toHaveBeenCalledWith('Emergency rollback completed after unexpected error');
    });
  });

  describe('Plan Duration Configuration', () => {
    test('should use plan-specific duration for custom plan', async () => {
      const result = await AuthService.updateUserPlan('test-user-id', 'custom', 'admin-123');
      
      expect(result.planDurationDays).toBe(90); // Custom plan has 90-day duration
      
      // Verify the subscription end date is set correctly (90 days from start)
      const upsertCall = supabaseServiceClient.from().upsert.mock.calls[0][0];
      const startDate = new Date(upsertCall.current_period_start);
      const endDate = new Date(upsertCall.current_period_end);
      const daysDiff = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
      
      expect(daysDiff).toBe(90);
    });

    test('should fallback to 30 days for unknown plan configurations', async () => {
      // Mock getPlanFeatures to return null for unknown plan
      const planService = require('../../../src/services/planService');
      planService.getPlanFeatures = jest.fn()
        .mockReturnValueOnce(mockUserData) // First call for old plan (won't be null)
        .mockReturnValueOnce(null); // Second call for new plan returns null
      
      const result = await AuthService.updateUserPlan('test-user-id', 'pro', 'admin-123');
      
      expect(result.planDurationDays).toBe(30); // Fallback to default
    });
  });

  describe('No-op Plan Change', () => {
    test('should handle no-change scenario gracefully', async () => {
      mockUserData.plan = 'pro'; // User already on pro plan
      
      supabaseServiceClient.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: mockUserData, error: null })
          }))
        }))
      }));

      const result = await AuthService.updateUserPlan('test-user-id', 'pro', 'admin-123');
      
      expect(result).toMatchObject({
        message: 'Plan is already set to pro',
        newPlan: 'pro',
        unchanged: true
      });
      
      // Verify no limits were applied or audits logged for no-change
      expect(applyPlanLimits).not.toHaveBeenCalled();
      expect(auditService.logPlanChange).not.toHaveBeenCalled();
    });
  });
});