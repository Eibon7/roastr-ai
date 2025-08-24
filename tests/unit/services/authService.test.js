const authService = require('../../../src/services/authService');
const { supabaseServiceClient, supabaseAnonClient } = require('../../../src/config/supabase');

// Mock planLimitsService
jest.mock('../../../src/services/planLimitsService', () => ({
  getPlanLimits: jest.fn(),
  getAllPlanLimits: jest.fn(),
  updatePlanLimits: jest.fn(),
  checkLimit: jest.fn(),
  clearCache: jest.fn()
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock Supabase clients
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn(),
    auth: {
      admin: {
        createUser: jest.fn(),
        deleteUser: jest.fn()
      }
    }
  },
  supabaseAnonClient: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signInWithOtp: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      verifyOtp: jest.fn(),
      signInWithOAuth: jest.fn()
    }
  },
  createUserClient: jest.fn()
}));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signUp', () => {
    it('should create a new user successfully', async () => {
      const mockAuthData = {
        user: { id: 'test-id', email: 'test@example.com' },
        session: { access_token: 'test-token' }
      };
      const mockUserData = {
        id: 'test-id',
        email: 'test@example.com',
        name: 'Test User',
        plan: 'free',
        is_admin: false
      };

      supabaseAnonClient.auth.signUp.mockResolvedValue({
        data: mockAuthData,
        error: null
      });

      supabaseServiceClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUserData,
              error: null
            })
          })
        })
      });

      const result = await authService.signUp({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

      expect(result.user).toEqual(mockAuthData.user);
      expect(result.session).toEqual(mockAuthData.session);
      expect(result.profile).toEqual(mockUserData);
    });

    it('should handle authentication errors', async () => {
      supabaseAnonClient.auth.signUp.mockResolvedValue({
        data: null,
        error: { message: 'Email already registered' }
      });

      await expect(authService.signUp({
        email: 'test@example.com',
        password: 'password123'
      })).rejects.toThrow('Signup failed: Email already registered');
    });

    it('should cleanup auth user if profile creation fails', async () => {
      const mockAuthData = {
        user: { id: 'test-id', email: 'test@example.com' }
      };

      supabaseAnonClient.auth.signUp.mockResolvedValue({
        data: mockAuthData,
        error: null
      });

      supabaseServiceClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      });

      supabaseServiceClient.auth.admin.deleteUser.mockResolvedValue({});

      await expect(authService.signUp({
        email: 'test@example.com',
        password: 'password123'
      })).rejects.toThrow('Failed to create user profile: Database error');

      expect(supabaseServiceClient.auth.admin.deleteUser).toHaveBeenCalledWith('test-id');
    });
  });

  describe('signIn', () => {
    it('should sign in user successfully', async () => {
      const mockAuthData = {
        user: { id: 'test-id', email: 'test@example.com' },
        session: { access_token: 'test-token' }
      };
      const mockProfile = {
        id: 'test-id',
        email: 'test@example.com',
        name: 'Test User'
      };

      supabaseAnonClient.auth.signInWithPassword.mockResolvedValue({
        data: mockAuthData,
        error: null
      });

      const mockUserClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockProfile,
                error: null
              })
            })
          })
        })
      };

      const { createUserClient } = require('../../../src/config/supabase');
      createUserClient.mockReturnValue(mockUserClient);

      const result = await authService.signIn({
        email: 'test@example.com',
        password: 'password123'
      });

      expect(result.user).toEqual(mockAuthData.user);
      expect(result.session).toEqual(mockAuthData.session);
      expect(result.profile).toEqual(mockProfile);
    });

    it('should handle invalid credentials', async () => {
      supabaseAnonClient.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' }
      });

      await expect(authService.signIn({
        email: 'test@example.com',
        password: 'wrongpassword'
      })).rejects.toThrow('Sign in failed: Invalid login credentials');
    });
  });

  describe('listUsers', () => {
    it('should list users successfully', async () => {
      const mockUsers = [
        { id: '1', email: 'user1@example.com', name: 'User 1' },
        { id: '2', email: 'user2@example.com', name: 'User 2' }
      ];

      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            range: jest.fn().mockResolvedValue({
              data: mockUsers,
              error: null
            })
          })
        })
      });

      const result = await authService.listUsers({ limit: 10, offset: 0 });
      expect(result.users).toHaveLength(2);
      expect(result.users[0].email).toBe('user1@example.com');
    });

    it('should handle database errors', async () => {
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            range: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      });

      await expect(authService.listUsers({ limit: 10, offset: 0 }))
        .rejects.toThrow('Failed to list users: Database error');
    });
  });

  describe('createUserManually', () => {
    it('should create user manually with provided password', async () => {
      const mockAuthData = {
        user: { id: 'test-id', email: 'test@example.com' }
      };
      const mockUserData = {
        id: 'test-id',
        email: 'test@example.com',
        name: 'Test User',
        plan: 'pro',
        is_admin: false
      };

      supabaseServiceClient.auth.admin.createUser.mockResolvedValue({
        data: mockAuthData,
        error: null
      });

      supabaseServiceClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUserData,
              error: null
            })
          })
        })
      });

      const result = await authService.createUserManually({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        plan: 'pro',
        isAdmin: false
      });

      expect(result.user).toEqual(mockUserData);
      expect(result.temporaryPassword).toBeNull();
    });

    it('should create user manually with temporary password', async () => {
      const mockAuthData = {
        user: { id: 'test-id', email: 'test@example.com' }
      };
      const mockUserData = {
        id: 'test-id',
        email: 'test@example.com',
        name: 'Test User',
        plan: 'free',
        is_admin: false
      };

      supabaseServiceClient.auth.admin.createUser.mockResolvedValue({
        data: mockAuthData,
        error: null
      });

      supabaseServiceClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUserData,
              error: null
            })
          })
        })
      });

      const result = await authService.createUserManually({
        email: 'test@example.com',
        name: 'Test User'
      });

      expect(result.user).toEqual(mockUserData);
      expect(typeof result.temporaryPassword).toBe('string');
      expect(result.temporaryPassword.length).toBeGreaterThan(0);
    });
  });

  describe('signUpWithMagicLink', () => {
    it('should send magic link for signup', async () => {
      supabaseAnonClient.auth.signInWithOtp.mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await authService.signUpWithMagicLink({
        email: 'test@example.com',
        name: 'Test User'
      });

      expect(result.message).toBe('Magic link sent to your email');
      expect(result.email).toBe('test@example.com');
      expect(supabaseAnonClient.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: {
          data: { name: 'Test User' }
        }
      });
    });

    it('should handle magic link errors', async () => {
      supabaseAnonClient.auth.signInWithOtp.mockResolvedValue({
        data: null,
        error: { message: 'Invalid email' }
      });

      await expect(authService.signUpWithMagicLink({
        email: 'invalid@example.com'
      })).rejects.toThrow('Magic link signup failed: Invalid email');
    });
  });

  describe('signInWithMagicLink', () => {
    it('should send magic link for sign in', async () => {
      supabaseAnonClient.auth.signInWithOtp.mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await authService.signInWithMagicLink('test@example.com');

      expect(result.message).toBe('Magic link sent to your email');
      expect(result.email).toBe('test@example.com');
    });

    it('should handle magic link sign in errors', async () => {
      supabaseAnonClient.auth.signInWithOtp.mockResolvedValue({
        data: null,
        error: { message: 'Rate limit exceeded' }
      });

      await expect(authService.signInWithMagicLink('test@example.com'))
        .rejects.toThrow('Magic link sign in failed: Rate limit exceeded');
    });
  });

  describe('signOut', () => {
    it('should sign out user successfully', async () => {
      const mockUserClient = {
        auth: {
          signOut: jest.fn().mockResolvedValue({ error: null })
        }
      };

      const { createUserClient } = require('../../../src/config/supabase');
      createUserClient.mockReturnValue(mockUserClient);

      const result = await authService.signOut('test-token');

      expect(result.message).toBe('Signed out successfully');
      expect(mockUserClient.auth.signOut).toHaveBeenCalled();
    });

    it('should handle sign out errors', async () => {
      const mockUserClient = {
        auth: {
          signOut: jest.fn().mockResolvedValue({ 
            error: { message: 'Token expired' }
          })
        }
      };

      const { createUserClient } = require('../../../src/config/supabase');
      createUserClient.mockReturnValue(mockUserClient);

      await expect(authService.signOut('invalid-token'))
        .rejects.toThrow('Sign out failed: Token expired');
    });
  });

  describe('getCurrentUser', () => {
    it('should get current user with profile and integrations', async () => {
      const mockUser = { id: 'test-id', email: 'test@example.com' };
      const mockProfile = {
        id: 'test-id',
        email: 'test@example.com',
        name: 'Test User',
        organizations: [{ id: 'org-1', name: 'Test Org' }]
      };
      const mockIntegrations = [
        { platform: 'twitter', enabled: true }
      ];

      const mockUserClient = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null
          })
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockImplementation((table) => {
                if (table === 'users') {
                  return Promise.resolve({ data: mockProfile, error: null });
                }
                return Promise.resolve({ data: mockIntegrations, error: null });
              })
            })
          })
        })
      };

      // Mock the select calls separately
      mockUserClient.from.mockImplementation((tableName) => {
        if (tableName === 'users') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockProfile, error: null })
              })
            })
          };
        } else if (tableName === 'integration_configs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: mockIntegrations, error: null })
            })
          };
        }
      });

      const { createUserClient } = require('../../../src/config/supabase');
      createUserClient.mockReturnValue(mockUserClient);

      const result = await authService.getCurrentUser('test-token');

      expect(result).toEqual({
        ...mockProfile,
        integrations: mockIntegrations
      });
    });

    it('should handle invalid token', async () => {
      const mockUserClient = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Invalid token' }
          })
        }
      };

      const { createUserClient } = require('../../../src/config/supabase');
      createUserClient.mockReturnValue(mockUserClient);

      await expect(authService.getCurrentUser('invalid-token'))
        .rejects.toThrow('Invalid or expired token');
    });
  });

  describe('resetPassword', () => {
    it('should send password reset email', async () => {
      supabaseAnonClient.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null
      });

      const result = await authService.resetPassword('test@example.com');

      expect(result.message).toBe('Password reset email sent');
      expect(result.email).toBe('test@example.com');
    });

    it('should handle reset password errors', async () => {
      supabaseAnonClient.auth.resetPasswordForEmail.mockResolvedValue({
        data: null,
        error: { message: 'Email not found' }
      });

      await expect(authService.resetPassword('notfound@example.com'))
        .rejects.toThrow('Password reset failed: Email not found');
    });
  });

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      const mockUser = { id: 'test-id', email: 'test@example.com' };
      const mockUpdatedProfile = {
        id: 'test-id',
        email: 'test@example.com',
        name: 'Updated Name'
      };

      const mockUserClient = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null
          })
        },
        from: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockUpdatedProfile,
                  error: null
                })
              })
            })
          })
        })
      };

      const { createUserClient } = require('../../../src/config/supabase');
      createUserClient.mockReturnValue(mockUserClient);

      const result = await authService.updateProfile('test-token', { name: 'Updated Name' });

      expect(result).toEqual(mockUpdatedProfile);
    });

    it('should handle profile update errors', async () => {
      const mockUser = { id: 'test-id', email: 'test@example.com' };

      const mockUserClient = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null
          })
        },
        from: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Update failed' }
                })
              })
            })
          })
        })
      };

      const { createUserClient } = require('../../../src/config/supabase');
      createUserClient.mockReturnValue(mockUserClient);

      await expect(authService.updateProfile('test-token', { name: 'New Name' }))
        .rejects.toThrow('Profile update failed: Update failed');
    });
  });

  describe('updatePassword', () => {
    it('should update password successfully', async () => {
      const mockUserClient = {
        auth: {
          updateUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-id' } },
            error: null
          })
        }
      };

      const { createUserClient } = require('../../../src/config/supabase');
      createUserClient.mockReturnValue(mockUserClient);

      const result = await authService.updatePassword('test-token', 'newpassword');

      expect(result.message).toBe('Password updated successfully');
    });

    it('should handle password update errors', async () => {
      const mockUserClient = {
        auth: {
          updateUser: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Password too weak' }
          })
        }
      };

      const { createUserClient } = require('../../../src/config/supabase');
      createUserClient.mockReturnValue(mockUserClient);

      await expect(authService.updatePassword('test-token', 'weak'))
        .rejects.toThrow('Password update failed: Password too weak');
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      const mockData = { user: { id: 'test-id' }, session: { access_token: 'token' } };
      
      supabaseAnonClient.auth.verifyOtp.mockResolvedValue({
        data: mockData,
        error: null
      });

      const result = await authService.verifyEmail('token123', 'email', 'test@example.com');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });

    it('should handle verification errors gracefully', async () => {
      supabaseAnonClient.auth.verifyOtp.mockResolvedValue({
        data: null,
        error: { message: 'Invalid token' }
      });

      const result = await authService.verifyEmail('invalid-token', 'email', 'test@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid token');
    });
  });

  describe('listUsers (enhanced)', () => {
    it('should list users with enhanced features', async () => {
      const mockUsers = [
        { 
          id: '1', 
          email: 'user1@example.com', 
          name: 'User 1',
          plan: 'pro',
          monthly_messages_sent: 10,
          monthly_tokens_consumed: 100,
          active: true,
          suspended: false,
          organizations: [{ id: 'org1', monthly_responses_used: 5 }]
        }
      ];

      // Create complete mock chain for main query
      const mockMainQuery = {
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: mockUsers,
          error: null
        })
      };

      // Create complete mock chain for count query
      const mockCountQuery = {
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          count: 1,
          error: null
        })
      };

      // Mock the from calls - first for main query, second for count
      supabaseServiceClient.from
        .mockReturnValueOnce(mockMainQuery)
        .mockReturnValueOnce(mockCountQuery);

      // Mock getPlanLimits method temporarily for this test
      const getPlanLimitsSpy = jest.spyOn(authService, 'getPlanLimits').mockReturnValue({
        monthly_messages: 1000,
        monthly_tokens: 100000
      });

      // Mock checkUsageAlerts method temporarily for this test
      const checkUsageAlertsSpy = jest.spyOn(authService, 'checkUsageAlerts').mockReturnValue([]);

      const result = await authService.listUsers({
        search: 'user1',
        plan: 'pro',
        limit: 10,
        offset: 0
      });

      expect(result.users).toHaveLength(1);
      expect(result.users[0]).toHaveProperty('usage_alerts');
      expect(result.pagination).toBeDefined();

      // Clean up spies
      getPlanLimitsSpy.mockRestore();
      checkUsageAlertsSpy.mockRestore();
    });

    it('should handle list users errors gracefully', async () => {
      const mockFailedQuery = {
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      };

      supabaseServiceClient.from.mockReturnValue(mockFailedQuery);

      await expect(authService.listUsers())
        .rejects.toThrow('Failed to list users: Database error');
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      supabaseServiceClient.auth.admin.deleteUser.mockResolvedValue({
        error: null
      });

      supabaseServiceClient.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })
      });

      const result = await authService.deleteUser('test-id');
      expect(result.message).toBe('User deleted successfully');
    });

    it('should handle auth deletion errors', async () => {
      supabaseServiceClient.auth.admin.deleteUser.mockResolvedValue({
        error: { message: 'User not found' }
      });

      await expect(authService.deleteUser('test-id'))
        .rejects.toThrow('Failed to delete user from auth: User not found');
    });
  });

  describe('updateUserPlan', () => {
    it('should update user plan successfully', async () => {
      const mockUpdatedUser = {
        id: 'test-id',
        email: 'test@example.com',
        plan: 'pro'
      };

      supabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: mockUpdatedUser,
                    error: null
                  })
                })
              })
            })
          };
        } else if (table === 'organizations') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          };
        }
      });

      const result = await authService.updateUserPlan('test-id', 'pro');

      expect(result.message).toBe('User plan updated successfully');
      expect(result.user).toEqual(mockUpdatedUser);
      expect(result.newPlan).toBe('pro');
    });

    it('should handle invalid plan', async () => {
      await expect(authService.updateUserPlan('test-id', 'invalid'))
        .rejects.toThrow('Invalid plan');
    });
  });

  describe('toggleUserActive', () => {
    it('should toggle user active status', async () => {
      const mockCurrentUser = { active: false, email: 'test@example.com' };
      const mockUpdatedUser = { 
        id: 'test-id', 
        active: true, 
        email: 'test@example.com' 
      };

      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockCurrentUser,
              error: null
            })
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUpdatedUser,
                error: null
              })
            })
          })
        })
      });

      // Mock logUserActivity
      jest.spyOn(authService, 'logUserActivity').mockResolvedValue();

      const result = await authService.toggleUserActive('test-id', 'admin-id');

      expect(result.message).toBe('User account activated successfully');
      expect(result.user).toEqual(mockUpdatedUser);
    });

    it('should handle user not found', async () => {
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'User not found' }
            })
          })
        })
      });

      await expect(authService.toggleUserActive('invalid-id', 'admin-id'))
        .rejects.toThrow('User not found');
    });
  });

  describe('suspendUser', () => {
    it('should suspend user successfully', async () => {
      const mockUserData = { email: 'test@example.com' };

      supabaseServiceClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUserData,
                error: null
              })
            })
          })
        })
      });

      jest.spyOn(authService, 'logUserActivity').mockResolvedValue();

      const result = await authService.suspendUser('test-id', 'admin-id', 'Violation of terms');

      expect(result.message).toBe('User account suspended successfully');
      expect(result.reason).toBe('Violation of terms');
    });
  });

  describe('canUserGenerateRoasts', () => {
    it('should return true for active, non-suspended user', async () => {
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { active: true, suspended: false },
              error: null
            })
          })
        })
      });

      const result = await authService.canUserGenerateRoasts('test-id');
      expect(result).toBe(true);
    });

    it('should return false for suspended user', async () => {
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { active: true, suspended: true },
              error: null
            })
          })
        })
      });

      const result = await authService.canUserGenerateRoasts('test-id');
      expect(result).toBe(false);
    });

    it('should return false on database error', async () => {
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      });

      const result = await authService.canUserGenerateRoasts('test-id');
      expect(result).toBe(false);
    });
  });

  describe('signInWithGoogle', () => {
    it('should initiate Google OAuth successfully', async () => {
      const mockOAuthData = {
        url: 'https://accounts.google.com/oauth/authorize?...'
      };

      supabaseAnonClient.auth.signInWithOAuth.mockResolvedValue({
        data: mockOAuthData,
        error: null
      });

      const result = await authService.signInWithGoogle();

      expect(result.url).toBe(mockOAuthData.url);
      expect(result.message).toBe('Redirecting to Google authentication...');
    });

    it('should handle Google OAuth errors', async () => {
      supabaseAnonClient.auth.signInWithOAuth.mockResolvedValue({
        data: null,
        error: { message: 'OAuth configuration error' }
      });

      await expect(authService.signInWithGoogle())
        .rejects.toThrow('Google OAuth failed: OAuth configuration error');
    });
  });

  describe('getPlanLimits', () => {
    const planLimitsService = require('../../../src/services/planLimitsService');
    
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return correct limits for known plans from database', async () => {
      planLimitsService.getPlanLimits.mockResolvedValue({
        monthlyResponsesLimit: 1000,
        monthlyTokensLimit: 100000,
        integrationsLimit: 5
      });

      const proLimits = await authService.getPlanLimits('pro');
      expect(proLimits.monthly_messages).toBe(1000);
      expect(proLimits.monthly_tokens).toBe(100000);
      expect(proLimits.integrations).toBe(5);
      expect(planLimitsService.getPlanLimits).toHaveBeenCalledWith('pro');
    });

    it('should map basic plan to free plan', async () => {
      planLimitsService.getPlanLimits.mockResolvedValue({
        monthlyResponsesLimit: 100,
        monthlyTokensLimit: 10000,
        integrationsLimit: 1
      });

      const basicLimits = await authService.getPlanLimits('basic');
      expect(basicLimits.monthly_messages).toBe(100);
      expect(basicLimits.monthly_tokens).toBe(10000);
      expect(planLimitsService.getPlanLimits).toHaveBeenCalledWith('free');
    });

    it('should return fallback limits on database error', async () => {
      planLimitsService.getPlanLimits.mockRejectedValue(new Error('Database error'));

      const proLimits = await authService.getPlanLimits('pro');
      expect(proLimits.monthly_messages).toBe(1000);
      expect(proLimits.monthly_tokens).toBe(100000);
      expect(proLimits.integrations).toBe(5);
    });

    it('should return fallback limits for unknown plans', async () => {
      planLimitsService.getPlanLimits.mockRejectedValue(new Error('Plan not found'));

      const unknownLimits = await authService.getPlanLimits('unknown_plan');
      expect(unknownLimits.monthly_messages).toBe(100);
      expect(unknownLimits.monthly_tokens).toBe(10000);
      expect(unknownLimits.integrations).toBe(1); // Basic plan has 1 integration limit
    });
  });

  describe('checkUsageAlerts', () => {
    beforeEach(() => {
      // Ensure no mocks are interfering with checkUsageAlerts
      if (authService.checkUsageAlerts.mockRestore) {
        authService.checkUsageAlerts.mockRestore();
      }
    });

    it('should return alerts for high usage', () => {
      const user = {
        monthly_messages_sent: 85, // 85% of 100 limit
        monthly_tokens_consumed: 8500, // 85% of 10000 limit
        suspended: false,
        active: true
      };
      const planLimits = {
        monthly_messages: 100,
        monthly_tokens: 10000
      };

      const alerts = authService.checkUsageAlerts(user, planLimits);

      expect(alerts).toHaveLength(2);
      expect(alerts[0].category).toBe('messages');
      expect(alerts[1].category).toBe('tokens');
      expect(alerts[0].severity).toBe('medium');
      expect(alerts[1].severity).toBe('medium');
    });

    it('should return high severity alerts when at limit', () => {
      const user = {
        monthly_messages_sent: 100, // At limit
        monthly_tokens_consumed: 10000, // At limit
        suspended: false,
        active: true
      };
      const planLimits = {
        monthly_messages: 100,
        monthly_tokens: 10000
      };

      const alerts = authService.checkUsageAlerts(user, planLimits);

      expect(alerts).toHaveLength(2);
      expect(alerts[0].severity).toBe('high');
      expect(alerts[1].severity).toBe('high');
    });

    it('should return suspended account alert', () => {
      const user = {
        monthly_messages_sent: 10,
        monthly_tokens_consumed: 1000,
        suspended: true,
        active: true
      };
      const planLimits = {
        monthly_messages: 100,
        monthly_tokens: 10000
      };

      const alerts = authService.checkUsageAlerts(user, planLimits);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].category).toBe('account');
      expect(alerts[0].message).toBe('Cuenta suspendida');
      expect(alerts[0].type).toBe('error');
      expect(alerts[0].severity).toBe('high');
    });

    it('should return inactive account alert', () => {
      const user = {
        monthly_messages_sent: 10,
        monthly_tokens_consumed: 1000,
        suspended: false,
        active: false
      };
      const planLimits = {
        monthly_messages: 100,
        monthly_tokens: 10000
      };

      const alerts = authService.checkUsageAlerts(user, planLimits);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].category).toBe('account');
      expect(alerts[0].message).toBe('Cuenta desactivada');
      expect(alerts[0].type).toBe('warning');
      expect(alerts[0].severity).toBe('medium');
    });

    it('should return no alerts for normal usage', () => {
      const user = {
        monthly_messages_sent: 50, // 50% of limit
        monthly_tokens_consumed: 5000, // 50% of limit
        suspended: false,
        active: true
      };
      const planLimits = {
        monthly_messages: 100,
        monthly_tokens: 10000
      };

      const alerts = authService.checkUsageAlerts(user, planLimits);

      expect(alerts).toHaveLength(0);
    });
  });
});