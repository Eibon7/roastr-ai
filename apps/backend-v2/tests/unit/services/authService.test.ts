/**
 * Auth Service Tests
 * ROA-355: Email existence check pre-signup validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '../../../src/services/authService';
import { AuthError, AUTH_ERROR_CODES } from '../../../src/utils/authErrorTaxonomy';
import { supabase } from '../../../src/lib/supabaseClient';

// Mock supabase client
vi.mock('../../../src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      refreshSession: vi.fn(),
      signInWithOtp: vi.fn(),
      getUser: vi.fn(),
      admin: {
        listUsers: vi.fn(),
        signOut: vi.fn()
      }
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        error: null
      }))
    }))
  }
}));

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}));

// Mock rateLimitService
vi.mock('../../../src/services/rateLimitService', () => ({
  rateLimitService: {
    recordAttempt: vi.fn(() => ({ allowed: true, remaining: 4 }))
  }
}));

// Mock abuseDetectionService
vi.mock('../../../src/services/abuseDetectionService', () => ({
  abuseDetectionService: {
    recordAttempt: vi.fn(() => ({ isAbuse: false, patterns: [] }))
  }
}));

// Mock loadSettings
vi.mock('../../../src/lib/loadSettings', () => ({
  loadSettings: vi.fn(() =>
    Promise.resolve({
      auth: {
        login: { enabled: true },
        signup: {
          checkEmailExists: { enabled: true }
        }
      }
    })
  )
}));

// Mock analytics to avoid @amplitude/analytics-node dependency
vi.mock('../../../src/lib/analytics', () => ({
  trackEvent: vi.fn()
}));

describe('AuthService - Email Existence Check (ROA-355)', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    vi.clearAllMocks();
  });

  describe('signup - email existence check', () => {
    it('should throw EMAIL_ALREADY_EXISTS if email exists', async () => {
      const email = 'existing@example.com';
      const password = 'password123';
      const planId = 'starter';

      // Mock checkEmailExists to return true (email exists)
      // We'll mock listUsers to return a user with matching email
      vi.mocked(supabase.auth.admin.listUsers).mockResolvedValueOnce({
        data: {
          users: [
            {
              id: 'user-123',
              email: email,
              created_at: new Date().toISOString(),
              user_metadata: {}
            }
          ]
        },
        error: null
      } as any);

      await expect(
        authService.signup({
          email,
          password,
          planId
        })
      ).rejects.toMatchObject({
        slug: AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS,
        http_status: 409
      });

      // Verify that signUp was NOT called (email check prevented it)
      expect(supabase.auth.signUp).not.toHaveBeenCalled();
    });

    it('should allow signup if email does not exist', async () => {
      const email = 'new@example.com';
      const password = 'password123';
      const planId = 'starter';

      // Mock checkEmailExists to return false (email does not exist)
      vi.mocked(supabase.auth.admin.listUsers).mockResolvedValueOnce({
        data: {
          users: []
        },
        error: null
      } as any);

      // Mock successful signup
      vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-456',
            email: email,
            created_at: new Date().toISOString(),
            email_confirmed_at: null,
            user_metadata: { role: 'user', plan_id: planId }
          },
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: 'bearer'
          }
        },
        error: null
      } as any);

      const result = await authService.signup({
        email,
        password,
        planId
      });

      expect(result).toBeDefined();
      expect(result.user.email).toBe(email);
      expect(result.access_token).toBe('access-token');
      expect(supabase.auth.signUp).toHaveBeenCalled();
    });

    it('should handle pagination when checking email existence', async () => {
      const email = 'existing@example.com';
      const password = 'password123';
      const planId = 'starter';

      // Mock first page (100 users, email not found)
      vi.mocked(supabase.auth.admin.listUsers)
        .mockResolvedValueOnce({
          data: {
            users: Array.from({ length: 100 }, (_, i) => ({
              id: `user-${i}`,
              email: `user${i}@example.com`,
              created_at: new Date().toISOString(),
              user_metadata: {}
            }))
          },
          error: null
        } as any)
        // Mock second page (email found)
        .mockResolvedValueOnce({
          data: {
            users: [
              {
                id: 'user-123',
                email: email,
                created_at: new Date().toISOString(),
                user_metadata: {}
              }
            ]
          },
          error: null
        } as any);

      await expect(
        authService.signup({
          email,
          password,
          planId
        })
      ).rejects.toMatchObject({
        slug: AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS,
        http_status: 409
      });

      // Verify that listUsers was called twice (pagination)
      expect(supabase.auth.admin.listUsers).toHaveBeenCalledTimes(2);
      expect(supabase.auth.signUp).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive email comparison', async () => {
      const email = 'Existing@Example.com';
      const password = 'password123';
      const planId = 'starter';

      // Mock email exists with different case
      vi.mocked(supabase.auth.admin.listUsers).mockResolvedValueOnce({
        data: {
          users: [
            {
              id: 'user-123',
              email: 'existing@example.com', // lowercase
              created_at: new Date().toISOString(),
              user_metadata: {}
            }
          ]
        },
        error: null
      } as any);

      await expect(
        authService.signup({
          email, // Mixed case
          password,
          planId
        })
      ).rejects.toMatchObject({
        slug: AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS,
        http_status: 409
      });
    });

    it('should continue signup if email check fails (error handling)', async () => {
      const email = 'new@example.com';
      const password = 'password123';
      const planId = 'starter';

      // Mock listUsers to return error (email check fails)
      vi.mocked(supabase.auth.admin.listUsers).mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error', status: 500 }
      } as any);

      // Mock successful signup (fallback behavior)
      vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-456',
            email: email,
            created_at: new Date().toISOString(),
            email_confirmed_at: null,
            user_metadata: { role: 'user', plan_id: planId }
          },
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: 'bearer'
          }
        },
        error: null
      } as any);

      // Should not throw, should continue with signup
      const result = await authService.signup({
        email,
        password,
        planId
      });

      expect(result).toBeDefined();
      expect(result.user.email).toBe(email);
      // signUp should have been called (fallback behavior)
      expect(supabase.auth.signUp).toHaveBeenCalled();
    });

    it('should validate planId before checking email', async () => {
      const email = 'new@example.com';
      const password = 'password123';
      const planId = 'invalid-plan';

      // Should throw INVALID_CREDENTIALS for plan (planId validation happens first)
      await expect(
        authService.signup({
          email,
          password,
          planId
        })
      ).rejects.toMatchObject({
        slug: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        http_status: 401
      });

      // Verify that email check was NOT called (planId validation happened first)
      expect(supabase.auth.admin.listUsers).not.toHaveBeenCalled();
    });
  });
});

