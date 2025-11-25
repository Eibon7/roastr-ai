/**
 * AuthService Integration Paths Tests
 *
 * Tests for complex integration flows to improve coverage
 * Issue #929: Target 85%+ coverage for authService.js
 */

const { createSupabaseMock } = require('../../helpers/supabaseMockFactory');

// Create Supabase mock with defaults
const mockSupabase = createSupabaseMock(
  {
    users: [{ id: 'user-123', email: 'test@example.com', plan: 'pro', active: true }],
    organizations: [{ id: 'org-123', name: 'Test Org', owner_id: 'user-123' }],
    email_change_requests: [],
    account_deletion_requests: [],
    user_data_exports: [],
    user_activities: [],
    integration_configs: []
  },
  {}
);

// Mock Supabase anon client
const mockSupabaseAnonClient = {
  auth: {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    signInWithOtp: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    verifyOtp: jest.fn(),
    signInWithOAuth: jest.fn(),
    updateUser: jest.fn(),
    getSession: jest.fn(),
    getUser: jest.fn()
  }
};

// Mock planLimitsService
jest.mock('../../../src/services/planLimitsService', () => ({
  getPlanLimits: jest.fn().mockResolvedValue({ roasts: 100, messages: 1000 }),
  getAllPlanLimits: jest.fn(),
  updatePlanLimits: jest.fn(),
  checkLimit: jest.fn().mockResolvedValue({ allowed: true }),
  clearCache: jest.fn()
}));

// Mock subscriptionService
jest.mock('../../../src/services/subscriptionService', () => ({
  applyPlanLimits: jest.fn().mockResolvedValue({ success: true }),
  getUserUsage: jest.fn().mockResolvedValue({ roasts: 0, messages: 0 }),
  isChangeAllowed: jest.fn().mockResolvedValue({ allowed: true, reason: null })
}));

// Mock auditService
jest.mock('../../../src/services/auditService', () => ({
  logPlanChange: jest.fn().mockResolvedValue({ success: true }),
  logAccountDeletion: jest.fn().mockResolvedValue({ success: true }),
  logEmailChange: jest.fn().mockResolvedValue({ success: true }),
  logDataExport: jest.fn().mockResolvedValue({ success: true })
}));

// Mock passwordHistoryService
jest.mock('../../../src/services/passwordHistoryService', () => ({
  addPasswordToHistory: jest.fn().mockResolvedValue({ success: true }),
  isPasswordInHistory: jest.fn().mockResolvedValue(false),
  isPasswordRecentlyUsed: jest.fn().mockResolvedValue(false),
  addToPasswordHistory: jest.fn().mockResolvedValue({ success: true }),
  getPasswordHistory: jest.fn().mockResolvedValue([])
}));

// Mock planService
jest.mock('../../../src/services/planService', () => ({
  getPlanFeatures: jest.fn().mockReturnValue({
    maxRoasts: 100,
    maxMessages: 1000,
    features: ['basic']
  }),
  getPlanLimits: jest.fn().mockReturnValue({
    roasts: 100,
    messages: 1000,
    monthly_messages: 1000,
    monthly_tokens: 100000
  })
}));

// Mock planValidation
jest.mock('../../../src/services/planValidation', () => ({
  isChangeAllowed: jest.fn().mockReturnValue({ allowed: true, reason: null })
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }))
  }
}));

// Mock createUserClient
const mockUserClient = {
  auth: {
    getUser: jest.fn(),
    updateUser: jest.fn()
  }
};

// Mock Supabase clients
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    ...mockSupabase,
    auth: {
      admin: {
        createUser: jest
          .fn()
          .mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
        deleteUser: jest.fn().mockResolvedValue({ error: null }),
        updateUserById: jest
          .fn()
          .mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })
      }
    }
  },
  supabaseAnonClient: mockSupabaseAnonClient,
  createUserClient: jest.fn().mockReturnValue(mockUserClient)
}));

const authService = require('../../../src/services/authService');
const {
  supabaseServiceClient,
  supabaseAnonClient,
  createUserClient
} = require('../../../src/config/supabase');

describe('AuthService - Integration Paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase._reset();
  });

  describe('changeEmail', () => {
    it('should change email successfully', async () => {
      // Mock the from() calls sequentially
      let callCount = 0;
      mockSupabase.from = jest.fn((tableName) => {
        callCount++;
        if (tableName === 'users') {
          if (callCount === 1) {
            // First call: get current user
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'user-123', email: 'old@example.com', active: true },
                    error: null
                  })
                })
              })
            };
          } else if (callCount === 2) {
            // Second call: check if new email exists (should return null)
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'PGRST116' } // Not found
                  })
                })
              })
            };
          }
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          })
        };
      });

      mockUserClient.auth.updateUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'new@example.com' } },
        error: null
      });

      const result = await authService.changeEmail({
        userId: 'user-123',
        currentEmail: 'old@example.com',
        newEmail: 'new@example.com',
        accessToken: 'valid-token'
      });

      expect(result.message).toContain('verification sent');
      expect(result.requiresConfirmation).toBe(true);
    });

    it('should throw error if userId is missing', async () => {
      await expect(
        authService.changeEmail({
          userId: null,
          currentEmail: 'old@example.com',
          newEmail: 'new@example.com',
          accessToken: 'token'
        })
      ).rejects.toThrow('required');
    });

    it('should throw error if currentEmail is missing', async () => {
      await expect(
        authService.changeEmail({
          userId: 'user-123',
          currentEmail: null,
          newEmail: 'new@example.com',
          accessToken: 'token'
        })
      ).rejects.toThrow('required');
    });

    it('should throw error if newEmail is missing', async () => {
      await expect(
        authService.changeEmail({
          userId: 'user-123',
          currentEmail: 'old@example.com',
          newEmail: null,
          accessToken: 'token'
        })
      ).rejects.toThrow('required');
    });

    it('should throw error if accessToken is missing', async () => {
      await expect(
        authService.changeEmail({
          userId: 'user-123',
          currentEmail: 'old@example.com',
          newEmail: 'new@example.com',
          accessToken: null
        })
      ).rejects.toThrow('required');
    });

    it('should throw error for invalid email format', async () => {
      await expect(
        authService.changeEmail({
          userId: 'user-123',
          currentEmail: 'old@example.com',
          newEmail: 'invalid-email',
          accessToken: 'token'
        })
      ).rejects.toThrow('Invalid new email format');
    });

    it('should throw error if user not found', async () => {
      let callCount = 0;
      mockSupabase.from = jest.fn((tableName) => {
        if (tableName === 'users') {
          callCount++;
          if (callCount === 1) {
            // First call: get current user - return error
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'PGRST116', message: 'Not found' }
                  })
                })
              })
            };
          }
        }
        return { select: jest.fn() };
      });

      await expect(
        authService.changeEmail({
          userId: 'nonexistent',
          currentEmail: 'old@example.com',
          newEmail: 'new@example.com',
          accessToken: 'token'
        })
      ).rejects.toThrow('User not found');
    });

    it('should throw error if current email does not match', async () => {
      mockSupabase.from = jest.fn((tableName) => {
        if (tableName === 'users') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'user-123', email: 'different@example.com', active: true },
                  error: null
                })
              })
            })
          };
        }
        return { select: jest.fn() };
      });

      await expect(
        authService.changeEmail({
          userId: 'user-123',
          currentEmail: 'old@example.com',
          newEmail: 'new@example.com',
          accessToken: 'token'
        })
      ).rejects.toThrow('Current email does not match');
    });

    it('should throw error if new email is already in use', async () => {
      let callCount = 0;
      mockSupabase.from = jest.fn((tableName) => {
        if (tableName === 'users') {
          callCount++;
          if (callCount === 1) {
            // First call: get current user
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'user-123', email: 'old@example.com', active: true },
                    error: null
                  })
                })
              })
            };
          } else if (callCount === 2) {
            // Second call: check if new email exists (should return existing user)
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'other-user', email: 'existing@example.com' },
                    error: null
                  })
                })
              })
            };
          }
        }
        return { select: jest.fn() };
      });

      await expect(
        authService.changeEmail({
          userId: 'user-123',
          currentEmail: 'old@example.com',
          newEmail: 'existing@example.com',
          accessToken: 'token'
        })
      ).rejects.toThrow('already in use');
    });

    it('should throw error if auth update fails', async () => {
      let callCount = 0;
      mockSupabase.from = jest.fn((tableName) => {
        if (tableName === 'users') {
          callCount++;
          if (callCount === 1) {
            // First call: get current user
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'user-123', email: 'old@example.com', active: true },
                    error: null
                  })
                })
              })
            };
          } else if (callCount === 2) {
            // Second call: check if new email exists (should return null - no existing user)
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'PGRST116' }
                  })
                })
              })
            };
          }
        }
        return { select: jest.fn() };
      });

      mockUserClient.auth.updateUser.mockResolvedValue({
        data: null,
        error: { message: 'Auth update failed' }
      });

      await expect(
        authService.changeEmail({
          userId: 'user-123',
          currentEmail: 'old@example.com',
          newEmail: 'new@example.com',
          accessToken: 'token'
        })
      ).rejects.toThrow('Failed to initiate email change');
    });
  });

  describe('confirmEmailChange', () => {
    it('should confirm email change successfully', async () => {
      mockSupabaseAnonClient.auth.verifyOtp.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'new@example.com' } },
        error: null
      });

      mockSupabase.from = jest.fn((tableName) => {
        if (tableName === 'users') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: { id: 'user-123', email: 'new@example.com' },
                error: null
              })
            })
          };
        }
        return { select: jest.fn() };
      });

      const result = await authService.confirmEmailChange('valid-token');

      expect(result.message).toBe('Email successfully changed');
      expect(result.user.email).toBe('new@example.com');
    });

    it('should throw error if token is missing', async () => {
      await expect(authService.confirmEmailChange(null)).rejects.toThrow(
        'Confirmation token is required'
      );
    });

    it('should throw error if verification fails', async () => {
      mockSupabaseAnonClient.auth.verifyOtp.mockResolvedValue({
        data: null,
        error: { message: 'Invalid token' }
      });

      await expect(authService.confirmEmailChange('invalid-token')).rejects.toThrow(
        'Email change confirmation failed'
      );
    });

    it('should handle update error gracefully', async () => {
      mockSupabaseAnonClient.auth.verifyOtp.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'new@example.com' } },
        error: null
      });

      mockSupabase.from = jest.fn((tableName) => {
        if (tableName === 'users') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Update failed' }
              })
            })
          };
        }
        return { select: jest.fn() };
      });

      // Should not throw, just log error
      const result = await authService.confirmEmailChange('valid-token');
      expect(result).toBeDefined();
    });
  });

  describe('exportUserData', () => {
    it('should export user data successfully', async () => {
      let callCount = 0;
      mockSupabase.from = jest.fn((tableName) => {
        callCount++;
        if (tableName === 'users') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'user-123',
                    email: 'test@example.com',
                    name: 'Test User',
                    plan: 'pro',
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-02T00:00:00Z',
                    total_messages_sent: 100,
                    total_tokens_consumed: 5000,
                    monthly_messages_sent: 50,
                    monthly_tokens_consumed: 2500,
                    last_activity_at: '2024-01-15T00:00:00Z',
                    email_confirmed: true,
                    is_admin: false,
                    active: true
                  },
                  error: null
                })
              })
            })
          };
        } else if (tableName === 'organizations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: 'org-123',
                    name: 'Test Org',
                    owner_id: 'user-123',
                    plan_id: 'pro',
                    created_at: '2024-01-01T00:00:00Z',
                    monthly_responses_limit: 1000,
                    monthly_responses_used: 500,
                    subscription_status: 'active',
                    slug: 'test-org'
                  }
                ],
                error: null
              })
            })
          };
        } else if (tableName === 'user_activities') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                      data: [
                        {
                          user_id: 'user-123',
                          activity_type: 'roast_generated',
                          platform: 'twitter',
                          tokens_used: 100,
                          created_at: '2024-01-15T00:00:00Z'
                        }
                      ],
                      error: null
                    })
                  })
                })
              })
            })
          };
        } else if (tableName === 'integration_configs') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({
                data: [
                  {
                    platform: 'twitter',
                    enabled: true,
                    organization_id: 'org-123',
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-02T00:00:00Z'
                  }
                ],
                error: null
              })
            })
          };
        }
        return { select: jest.fn() };
      });

      const result = await authService.exportUserData('user-123');

      expect(result).toBeDefined();
      expect(result.export_info).toBeDefined();
      expect(result.export_info.user_id).toBe('user-123');
      expect(result.profile).toBeDefined();
      expect(result.profile.email).toBe('test@example.com');
      expect(Array.isArray(result.organizations)).toBe(true);
      expect(Array.isArray(result.integrations)).toBe(true);
      expect(Array.isArray(result.activities)).toBe(true);
      expect(result.usage_statistics).toBeDefined();
      expect(result.usage_statistics.total_messages_sent).toBe(100);
    });

    it('should throw error if userId is missing', async () => {
      await expect(authService.exportUserData(null)).rejects.toThrow('User ID is required');
    });

    it('should throw error if user not found', async () => {
      mockSupabase.from = jest.fn((tableName) => {
        if (tableName === 'users') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116', message: 'Not found' }
                })
              })
            })
          };
        }
        return { select: jest.fn() };
      });

      await expect(authService.exportUserData('nonexistent')).rejects.toThrow('User not found');
    });

    it('should handle missing organizations gracefully', async () => {
      let callCount = 0;
      mockSupabase.from = jest.fn((tableName) => {
        callCount++;
        if (tableName === 'users') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'user-123', email: 'test@example.com' },
                  error: null
                })
              })
            })
          };
        } else if (tableName === 'organizations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Query failed' }
              })
            })
          };
        } else if (tableName === 'user_activities') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                      data: [],
                      error: null
                    })
                  })
                })
              })
            })
          };
        } else if (tableName === 'integration_configs') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          };
        }
        return { select: jest.fn() };
      });

      const result = await authService.exportUserData('user-123');
      expect(result.organizations).toEqual([]);
    });

    it('should handle missing activities gracefully', async () => {
      let callCount = 0;
      mockSupabase.from = jest.fn((tableName) => {
        callCount++;
        if (tableName === 'users') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'user-123', email: 'test@example.com' },
                  error: null
                })
              })
            })
          };
        } else if (tableName === 'organizations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          };
        } else if (tableName === 'user_activities') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                      data: null,
                      error: { message: 'Query failed' }
                    })
                  })
                })
              })
            })
          };
        } else if (tableName === 'integration_configs') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          };
        }
        return { select: jest.fn() };
      });

      const result = await authService.exportUserData('user-123');
      expect(result.activities).toEqual([]);
    });

    it('should handle missing integrations gracefully', async () => {
      let callCount = 0;
      mockSupabase.from = jest.fn((tableName) => {
        callCount++;
        if (tableName === 'users') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'user-123', email: 'test@example.com' },
                  error: null
                })
              })
            })
          };
        } else if (tableName === 'organizations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          };
        } else if (tableName === 'user_activities') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                      data: [],
                      error: null
                    })
                  })
                })
              })
            })
          };
        } else if (tableName === 'integration_configs') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          };
        }
        return { select: jest.fn() };
      });

      const result = await authService.exportUserData('user-123');
      expect(result.integrations).toEqual([]);
    });
  });

  describe('requestAccountDeletion', () => {
    it('should request account deletion successfully', async () => {
      const tableBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'user-123',
            email: 'test@example.com',
            deletion_scheduled_at: null,
            deleted_at: null
          },
          error: null
        }),
        update: jest.fn().mockReturnThis()
      };

      tableBuilder.update.mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: { id: 'user-123' },
          error: null
        })
      });

      mockSupabase.from = jest.fn((tableName) => {
        if (tableName === 'users') {
          return tableBuilder;
        }
        return { select: jest.fn() };
      });

      // Mock logUserActivity
      authService.logUserActivity = jest.fn().mockResolvedValue({ success: true });

      const result = await authService.requestAccountDeletion('user-123');

      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
    });

    it('should throw error if userId is missing', async () => {
      await expect(authService.requestAccountDeletion(null)).rejects.toThrow('User ID is required');
    });

    it('should throw error if user not found', async () => {
      const tableBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' }
        })
      };

      mockSupabase.from = jest.fn((tableName) => {
        if (tableName === 'users') {
          return tableBuilder;
        }
        return { select: jest.fn() };
      });

      await expect(authService.requestAccountDeletion('nonexistent')).rejects.toThrow(
        'User not found'
      );
    });

    it('should throw error if account already deleted', async () => {
      const tableBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'user-123',
            email: 'test@example.com',
            deleted_at: '2024-01-01T00:00:00Z',
            deletion_scheduled_at: null
          },
          error: null
        })
      };

      mockSupabase.from = jest.fn((tableName) => {
        if (tableName === 'users') {
          return tableBuilder;
        }
        return { select: jest.fn() };
      });

      await expect(authService.requestAccountDeletion('user-123')).rejects.toThrow(
        'already deleted'
      );
    });

    it('should throw error if deletion already scheduled', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const tableBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'user-123',
            email: 'test@example.com',
            deletion_scheduled_at: futureDate,
            deleted_at: null
          },
          error: null
        })
      };

      mockSupabase.from = jest.fn((tableName) => {
        if (tableName === 'users') {
          return tableBuilder;
        }
        return { select: jest.fn() };
      });

      await expect(authService.requestAccountDeletion('user-123')).rejects.toThrow(
        'already scheduled'
      );
    });
  });

  describe('cancelAccountDeletion', () => {
    it('should cancel account deletion successfully', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
      const tableBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'user-123',
            email: 'test@example.com',
            deletion_scheduled_at: futureDate,
            deleted_at: null
          },
          error: null
        }),
        update: jest.fn().mockReturnThis()
      };

      tableBuilder.update.mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: { id: 'user-123' },
          error: null
        })
      });

      mockSupabase.from = jest.fn((tableName) => {
        if (tableName === 'users') {
          return tableBuilder;
        }
        return { select: jest.fn() };
      });

      const result = await authService.cancelAccountDeletion('user-123');

      expect(result).toBeDefined();
      expect(result.message).toContain('cancelled');
    });

    it('should throw error if userId is missing', async () => {
      await expect(authService.cancelAccountDeletion(null)).rejects.toThrow('User ID is required');
    });

    it('should throw error if user not found', async () => {
      mockSupabase.from = jest.fn((tableName) => {
        if (tableName === 'users') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116', message: 'Not found' }
                })
              })
            })
          };
        }
        return { select: jest.fn() };
      });

      await expect(authService.cancelAccountDeletion('nonexistent')).rejects.toThrow(
        'User not found'
      );
    });

    it('should throw error if account already deleted', async () => {
      mockSupabase.from = jest.fn((tableName) => {
        if (tableName === 'users') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'user-123',
                    email: 'test@example.com',
                    deleted_at: '2024-01-01T00:00:00Z',
                    deletion_scheduled_at: null
                  },
                  error: null
                })
              })
            })
          };
        }
        return { select: jest.fn() };
      });

      await expect(authService.cancelAccountDeletion('user-123')).rejects.toThrow(
        'already deleted'
      );
    });

    it('should throw error if deletion not scheduled', async () => {
      mockSupabase.from = jest.fn((tableName) => {
        if (tableName === 'users') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'user-123',
                    email: 'test@example.com',
                    deletion_scheduled_at: null
                  },
                  error: null
                })
              })
            })
          };
        }
        return { select: jest.fn() };
      });

      await expect(authService.cancelAccountDeletion('user-123')).rejects.toThrow(
        'No pending account deletion found'
      );
    });

    it('should throw error if deletion already processed', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday
      mockSupabase.from = jest.fn((tableName) => {
        if (tableName === 'users') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'user-123',
                    email: 'test@example.com',
                    deletion_scheduled_at: pastDate
                  },
                  error: null
                })
              })
            })
          };
        }
        return { select: jest.fn() };
      });

      await expect(authService.cancelAccountDeletion('user-123')).rejects.toThrow(
        'Grace period has expired'
      );
    });
  });

  describe('processScheduledDeletions', () => {
    it('should process scheduled deletions', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday
      const chainableBuilder = {
        select: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'user-123',
              email: 'test1@example.com',
              deletion_scheduled_at: pastDate
            },
            {
              id: 'user-456',
              email: 'test2@example.com',
              deletion_scheduled_at: pastDate
            }
          ],
          error: null
        })
      };

      mockSupabase.from = jest.fn((tableName) => {
        if (tableName === 'users') {
          return chainableBuilder;
        }
        return { select: jest.fn() };
      });

      // Mock update for soft delete
      chainableBuilder.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: { id: 'user-123' },
          error: null
        })
      });

      // Mock logUserActivity
      authService.logUserActivity = jest.fn().mockResolvedValue({ success: true });

      const result = await authService.processScheduledDeletions();

      expect(result).toBeDefined();
      expect(result.processedCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle no scheduled deletions', async () => {
      const chainableBuilder = {
        select: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({
          data: [],
          error: null
        })
      };

      mockSupabase.from = jest.fn((tableName) => {
        if (tableName === 'users') {
          return chainableBuilder;
        }
        return { select: jest.fn() };
      });

      const result = await authService.processScheduledDeletions();

      expect(result.processedCount).toBe(0);
    });

    it('should handle deletion errors gracefully', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const chainableBuilder = {
        select: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'user-123',
              email: 'test@example.com',
              deletion_scheduled_at: pastDate
            }
          ],
          error: null
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Update failed' }
          })
        })
      };

      mockSupabase.from = jest.fn((tableName) => {
        if (tableName === 'users') {
          return chainableBuilder;
        }
        return { select: jest.fn() };
      });

      const result = await authService.processScheduledDeletions();

      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('updatePasswordWithVerification', () => {
    it('should update password with verification successfully', async () => {
      mockUserClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null
      });

      mockSupabaseAnonClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-123' }, session: {} },
        error: null
      });

      mockUserClient.auth.updateUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null
      });

      const result = await authService.updatePasswordWithVerification(
        'valid-token',
        'oldPassword123',
        'newPassword123'
      );

      expect(result.message).toBe('Password updated successfully');
      expect(result.user.id).toBe('user-123');
    });

    it('should throw error if authentication fails', async () => {
      mockUserClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Auth failed' }
      });

      await expect(
        authService.updatePasswordWithVerification('invalid-token', 'oldPass', 'newPass')
      ).rejects.toThrow('Authentication failed');
    });

    it('should throw error if user not found', async () => {
      mockUserClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      await expect(
        authService.updatePasswordWithVerification('token', 'oldPass', 'newPass')
      ).rejects.toThrow('User not found');
    });

    it('should throw error if password was recently used', async () => {
      const passwordHistoryService = require('../../../src/services/passwordHistoryService');
      passwordHistoryService.isPasswordRecentlyUsed.mockResolvedValueOnce(true);

      mockUserClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null
      });

      await expect(
        authService.updatePasswordWithVerification('token', 'oldPass', 'recentPass')
      ).rejects.toThrow('recently used');
    });

    it('should throw error if current password is incorrect', async () => {
      mockUserClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null
      });

      mockSupabaseAnonClient.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid password' }
      });

      await expect(
        authService.updatePasswordWithVerification('token', 'wrongPass', 'newPass')
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should throw error if password update fails', async () => {
      mockUserClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null
      });

      mockSupabaseAnonClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-123' }, session: {} },
        error: null
      });

      mockUserClient.auth.updateUser.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' }
      });

      await expect(
        authService.updatePasswordWithVerification('token', 'oldPass', 'newPass')
      ).rejects.toThrow('Password update failed');
    });
  });
});
