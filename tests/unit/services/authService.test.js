const authService = require('../../../src/services/authService');
const { supabaseServiceClient, supabaseAnonClient } = require('../../../src/config/supabase');

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
      resetPasswordForEmail: jest.fn()
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

      const result = await authService.listUsers(10, 0);
      expect(result).toEqual(mockUsers);
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

      await expect(authService.listUsers(10, 0))
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
});