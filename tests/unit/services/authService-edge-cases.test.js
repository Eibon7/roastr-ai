/**
 * Auth Service Edge Cases Tests
 *
 * Tests for edge cases in authService methods that need better coverage
 * Focus: changeEmail, confirmEmailChange, exportUserData, requestAccountDeletion,
 * updateUserPlan rollback, getPlanLimits fallback, checkUsageAlerts
 */

const AuthService = require('../../../src/services/authService');

// Mock Supabase clients
const mockSupabaseServiceClient = {
  from: jest.fn(),
  auth: {
    admin: {
      deleteUser: jest.fn()
    }
  }
};

const mockSupabaseAnonClient = {
  auth: {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    signInWithOtp: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    signInWithOAuth: jest.fn(),
    verifyOtp: jest.fn()
  }
};

const mockCreateUserClient = jest.fn();

jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabaseServiceClient,
  supabaseAnonClient: mockSupabaseAnonClient,
  createUserClient: mockCreateUserClient
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock planService
jest.mock('../../../src/services/planService', () => ({
  getPlanFeatures: jest.fn(),
  calculatePlanEndDate: jest.fn(),
  getPlanLimits: jest.fn()
}));

// Mock planLimitsService
const mockPlanLimitsService = {
  getPlanLimits: jest.fn()
};

jest.mock('../../../src/services/planLimitsService', () => ({
  __esModule: true,
  default: mockPlanLimitsService
}));

// Mock planValidation
jest.mock('../../../src/services/planValidation', () => ({
  isChangeAllowed: jest.fn()
}));

// Mock subscriptionService
jest.mock('../../../src/services/subscriptionService', () => ({
  applyPlanLimits: jest.fn(),
  getUserUsage: jest.fn()
}));

// Mock auditService
const mockAuditService = {
  logPlanChange: jest.fn().mockResolvedValue({ success: true })
};

jest.mock('../../../src/services/auditService', () => ({
  __esModule: true,
  default: mockAuditService
}));

describe('AuthService - Edge Cases', () => {
  let authService;
  let mockUserClient;

  beforeEach(() => {
    authService = new AuthService();
    mockUserClient = {
      auth: {
        getUser: jest.fn(),
        signOut: jest.fn(),
        updateUser: jest.fn()
      },
      from: jest.fn()
    };
    mockCreateUserClient.mockReturnValue(mockUserClient);

    jest.clearAllMocks();
  });

  describe('changeEmail - Edge Cases', () => {
    const params = {
      userId: 'user-123',
      currentEmail: 'old@example.com',
      newEmail: 'new@example.com',
      accessToken: 'token-123'
    };

    beforeEach(() => {
      mockSupabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn()
          })
        })
      });
    });

    it('should reject if userId is missing', async () => {
      await expect(
        authService.changeEmail({
          currentEmail: params.currentEmail,
          newEmail: params.newEmail,
          accessToken: params.accessToken
        })
      ).rejects.toThrow('User ID, current email, new email, and access token are required');
    });

    it('should reject if newEmail format is invalid', async () => {
      await expect(
        authService.changeEmail({
          ...params,
          newEmail: 'invalid-email'
        })
      ).rejects.toThrow('Invalid new email format');
    });

    it('should reject if user not found', async () => {
      mockSupabaseServiceClient
        .from()
        .select()
        .eq()
        .single.mockResolvedValue({
          data: null,
          error: { message: 'Not found' }
        });

      await expect(authService.changeEmail(params)).rejects.toThrow('User not found');
    });

    it('should reject if current email does not match', async () => {
      mockSupabaseServiceClient
        .from()
        .select()
        .eq()
        .single.mockResolvedValue({
          data: { email: 'different@example.com', active: true },
          error: null
        });

      await expect(authService.changeEmail(params)).rejects.toThrow('Current email does not match');
    });

    it('should reject if new email is already in use', async () => {
      // First call: get current user
      mockSupabaseServiceClient
        .from()
        .select()
        .eq()
        .single.mockResolvedValueOnce({
          data: { email: params.currentEmail, active: true },
          error: null
        })
        // Second call: check if new email exists
        .mockResolvedValueOnce({
          data: { id: 'other-user' },
          error: null
        });

      await expect(authService.changeEmail(params)).rejects.toThrow('New email is already in use');
    });

    it('should handle auth update errors', async () => {
      mockSupabaseServiceClient
        .from()
        .select()
        .eq()
        .single.mockResolvedValueOnce({
          data: { email: params.currentEmail, active: true },
          error: null
        })
        .mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' } // Not found = email not in use
        });

      mockUserClient.auth.updateUser.mockResolvedValue({
        data: null,
        error: { message: 'Auth update failed' }
      });

      await expect(authService.changeEmail(params)).rejects.toThrow(
        'Failed to initiate email change'
      );
    });
  });

  describe('confirmEmailChange - Edge Cases', () => {
    it('should reject if token is missing', async () => {
      await expect(authService.confirmEmailChange(null)).rejects.toThrow(
        'Confirmation token is required'
      );
      await expect(authService.confirmEmailChange(undefined)).rejects.toThrow(
        'Confirmation token is required'
      );
      await expect(authService.confirmEmailChange('')).rejects.toThrow(
        'Confirmation token is required'
      );
    });

    it('should handle verification errors', async () => {
      mockSupabaseAnonClient.auth.verifyOtp.mockResolvedValue({
        data: null,
        error: { message: 'Invalid token' }
      });

      await expect(authService.confirmEmailChange('invalid-token')).rejects.toThrow(
        'Email change confirmation failed'
      );
    });

    it('should handle users table update errors gracefully', async () => {
      mockSupabaseAnonClient.auth.verifyOtp.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'new@example.com'
          }
        },
        error: null
      });

      mockSupabaseServiceClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Update failed' }
          })
        })
      });

      // Should not throw, just log warning
      const result = await authService.confirmEmailChange('valid-token');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('user');
    });
  });

  describe('exportUserData - Edge Cases', () => {
    const userId = 'user-123';

    beforeEach(() => {
      mockSupabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn(),
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ data: [], error: null })
              })
            })
          })
        })
      });
    });

    it('should reject if userId is missing', async () => {
      await expect(authService.exportUserData(null)).rejects.toThrow('User ID is required');
      await expect(authService.exportUserData(undefined)).rejects.toThrow('User ID is required');
      await expect(authService.exportUserData('')).rejects.toThrow('User ID is required');
    });

    it('should handle user not found', async () => {
      mockSupabaseServiceClient
        .from()
        .select()
        .eq()
        .single.mockResolvedValue({
          data: null,
          error: { message: 'Not found' }
        });

      await expect(authService.exportUserData(userId)).rejects.toThrow('User not found');
    });

    it('should handle organization fetch errors gracefully', async () => {
      mockSupabaseServiceClient
        .from()
        .select()
        .eq()
        .single.mockResolvedValueOnce({
          data: { id: userId, email: 'user@example.com' },
          error: null
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Org fetch failed' }
        });

      const result = await authService.exportUserData(userId);

      expect(result).toHaveProperty('profile');
      expect(result.organizations).toEqual([]);
    });

    it('should handle activities fetch errors gracefully', async () => {
      mockSupabaseServiceClient
        .from()
        .select()
        .eq()
        .single.mockResolvedValueOnce({
          data: { id: userId, email: 'user@example.com' },
          error: null
        })
        .mockResolvedValueOnce({
          data: [],
          error: null
        });

      mockSupabaseServiceClient
        .from()
        .select()
        .eq()
        .gte()
        .order()
        .limit.mockResolvedValue({
          data: null,
          error: { message: 'Activities fetch failed' }
        });

      const result = await authService.exportUserData(userId);

      expect(result).toHaveProperty('profile');
      expect(result.activities).toEqual([]);
    });

    it('should handle integrations fetch errors gracefully', async () => {
      const orgId = 'org-123';
      mockSupabaseServiceClient
        .from()
        .select()
        .eq()
        .single.mockResolvedValueOnce({
          data: { id: userId, email: 'user@example.com' },
          error: null
        })
        .mockResolvedValueOnce({
          data: [{ id: orgId }],
          error: null
        });

      mockSupabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'integration_configs') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Integrations fetch failed' }
              })
            })
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({ data: [], error: null })
                })
              })
            })
          })
        };
      });

      const result = await authService.exportUserData(userId);

      expect(result).toHaveProperty('profile');
      expect(result.integrations).toEqual([]);
    });
  });

  describe('requestAccountDeletion - Edge Cases', () => {
    const userId = 'user-123';

    beforeEach(() => {
      mockSupabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn()
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      // Mock logUserActivity
      authService.logUserActivity = jest.fn().mockResolvedValue({ success: true });
    });

    it('should reject if userId is missing', async () => {
      await expect(authService.requestAccountDeletion(null)).rejects.toThrow('User ID is required');
      await expect(authService.requestAccountDeletion(undefined)).rejects.toThrow(
        'User ID is required'
      );
      await expect(authService.requestAccountDeletion('')).rejects.toThrow('User ID is required');
    });

    it('should reject if user not found', async () => {
      mockSupabaseServiceClient
        .from()
        .select()
        .eq()
        .single.mockResolvedValue({
          data: null,
          error: { message: 'Not found' }
        });

      await expect(authService.requestAccountDeletion(userId)).rejects.toThrow('User not found');
    });

    it('should reject if account is already deleted', async () => {
      mockSupabaseServiceClient
        .from()
        .select()
        .eq()
        .single.mockResolvedValue({
          data: {
            email: 'user@example.com',
            deletion_scheduled_at: null,
            deleted_at: new Date().toISOString()
          },
          error: null
        });

      await expect(authService.requestAccountDeletion(userId)).rejects.toThrow(
        'Account is already deleted'
      );
    });

    it('should reject if deletion is already scheduled', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);

      mockSupabaseServiceClient
        .from()
        .select()
        .eq()
        .single.mockResolvedValue({
          data: {
            email: 'user@example.com',
            deletion_scheduled_at: futureDate.toISOString(),
            deleted_at: null
          },
          error: null
        });

      await expect(authService.requestAccountDeletion(userId)).rejects.toThrow(
        'Account deletion is already scheduled'
      );
    });

    it('should handle update errors', async () => {
      mockSupabaseServiceClient
        .from()
        .select()
        .eq()
        .single.mockResolvedValue({
          data: {
            email: 'user@example.com',
            deletion_scheduled_at: null,
            deleted_at: null
          },
          error: null
        });

      mockSupabaseServiceClient
        .from()
        .update()
        .eq.mockResolvedValue({
          data: null,
          error: { message: 'Update failed' }
        });

      await expect(authService.requestAccountDeletion(userId)).rejects.toThrow(
        'Failed to schedule account deletion'
      );
    });
  });

  describe('updateUserPlan - Rollback Scenarios', () => {
    const userId = 'user-123';
    const newPlan = 'pro';
    const adminId = 'admin-456';

    beforeEach(() => {
      const { getUserUsage } = require('../../../src/services/subscriptionService');
      const { isChangeAllowed } = require('../../../src/services/planValidation');
      const {
        getPlanFeatures,
        calculatePlanEndDate
      } = require('../../../src/services/planService');
      const { applyPlanLimits } = require('../../../src/services/subscriptionService');

      getUserUsage.mockResolvedValue({
        monthly_messages: 10,
        monthly_tokens: 50000
      });

      isChangeAllowed.mockResolvedValue({
        allowed: true,
        warnings: []
      });

      getPlanFeatures.mockReturnValue({
        duration: { days: 30 }
      });

      calculatePlanEndDate.mockReturnValue(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

      mockSupabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn()
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: userId, plan: newPlan },
                error: null
              })
            })
          })
        }),
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: [{ id: 'sub-123', plan: newPlan }],
            error: null
          })
        })
      });

      // Mock rollbackPlanChange
      authService.rollbackPlanChange = jest.fn().mockResolvedValue({ success: true });
    });

    it('should rollback when applyPlanLimits fails', async () => {
      const { applyPlanLimits } = require('../../../src/services/subscriptionService');

      mockSupabaseServiceClient
        .from()
        .select()
        .eq()
        .single.mockResolvedValueOnce({
          data: { id: userId, email: 'user@example.com', plan: 'starter', name: 'User' },
          error: null
        })
        .mockResolvedValueOnce({
          data: { id: 'sub-123', plan: 'starter' },
          error: null
        });

      applyPlanLimits.mockRejectedValue(new Error('Limits application failed'));

      await expect(authService.updateUserPlan(userId, newPlan, adminId)).rejects.toThrow(
        'Plan change failed during limits application and was rolled back'
      );

      expect(authService.rollbackPlanChange).toHaveBeenCalled();
      expect(mockAuditService.logPlanChange).toHaveBeenCalledWith(
        expect.objectContaining({
          changeStatus: 'rolled_back'
        })
      );
    });

    it('should handle subscription update failure gracefully', async () => {
      const { applyPlanLimits } = require('../../../src/services/subscriptionService');

      mockSupabaseServiceClient
        .from()
        .select()
        .eq()
        .single.mockResolvedValueOnce({
          data: { id: userId, email: 'user@example.com', plan: 'starter', name: 'User' },
          error: null
        })
        .mockResolvedValueOnce({
          data: { id: 'sub-123', plan: 'starter' },
          error: null
        });

      mockSupabaseServiceClient
        .from()
        .upsert()
        .select.mockResolvedValue({
          data: null,
          error: { message: 'Subscription update failed' }
        });

      applyPlanLimits.mockResolvedValue({ success: true });

      const result = await authService.updateUserPlan(userId, newPlan, adminId);

      // Should succeed but with warning
      expect(result).toHaveProperty('user');
      expect(result.user.plan).toBe(newPlan);
    });
  });

  describe('getPlanLimits - Fallback Scenarios', () => {
    it('should use fallback when planLimitsService fails', async () => {
      mockPlanLimitsService.getPlanLimits.mockRejectedValue(new Error('Service unavailable'));

      const result = await authService.getPlanLimits('pro');

      expect(result).toHaveProperty('monthly_messages');
      expect(result).toHaveProperty('monthly_tokens');
      expect(result).toHaveProperty('integrations');
    });

    it('should map basic plan to starter_trial', async () => {
      mockPlanLimitsService.getPlanLimits.mockResolvedValue({
        monthlyResponsesLimit: 10,
        monthlyTokensLimit: 100000,
        integrationsLimit: 1
      });

      const result = await authService.getPlanLimits('basic');

      expect(mockPlanLimitsService.getPlanLimits).toHaveBeenCalledWith('starter_trial');
      expect(result).toHaveProperty('monthly_messages', 10);
    });

    it('should handle unknown plans with fallback', async () => {
      mockPlanLimitsService.getPlanLimits.mockRejectedValue(new Error('Unknown plan'));

      const result = await authService.getPlanLimits('unknown_plan');

      expect(result).toHaveProperty('monthly_messages');
      expect(result).toHaveProperty('monthly_tokens');
    });
  });

  describe('checkUsageAlerts - Edge Cases', () => {
    beforeEach(() => {
      authService.getPlanLimits = jest.fn();
      authService.getCurrentUser = jest.fn();
    });

    it('should return high severity alerts when at limit', async () => {
      authService.getPlanLimits.mockResolvedValue({
        monthly_messages: 100,
        monthly_tokens: 100000
      });

      authService.getCurrentUser.mockResolvedValue({
        monthly_messages_sent: 100,
        monthly_tokens_consumed: 100000,
        active: true
      });

      const alerts = await authService.checkUsageAlerts('token-123');

      expect(alerts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: 'high',
            type: 'usage_limit_reached'
          })
        ])
      );
    });

    it('should return suspended account alert', async () => {
      authService.getCurrentUser.mockResolvedValue({
        active: false,
        suspended: true
      });

      const alerts = await authService.checkUsageAlerts('token-123');

      expect(alerts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: 'critical',
            type: 'account_suspended'
          })
        ])
      );
    });

    it('should return inactive account alert', async () => {
      authService.getCurrentUser.mockResolvedValue({
        active: false,
        suspended: false
      });

      const alerts = await authService.checkUsageAlerts('token-123');

      expect(alerts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: 'medium',
            type: 'account_inactive'
          })
        ])
      );
    });

    it('should return no alerts for normal usage', async () => {
      authService.getPlanLimits.mockResolvedValue({
        monthly_messages: 100,
        monthly_tokens: 100000
      });

      authService.getCurrentUser.mockResolvedValue({
        monthly_messages_sent: 50,
        monthly_tokens_consumed: 50000,
        active: true
      });

      const alerts = await authService.checkUsageAlerts('token-123');

      expect(alerts).toEqual([]);
    });
  });
});
