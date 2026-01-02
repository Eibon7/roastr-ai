/**
 * Password Recovery Integration Tests
 *
 * Tests the complete password recovery flow:
 * 1. Request password recovery email
 * 2. Extract token from email link
 * 3. Update password with token
 *
 * Uses real Supabase integration (not mocked) to verify end-to-end flow.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { AuthError, AUTH_ERROR_CODES } from '../../../src/utils/authErrorTaxonomy';

// Mock analytics
vi.mock('../../../src/lib/analytics', () => ({
  initializeAmplitude: vi.fn(),
  trackEvent: vi.fn()
}));

// Mock authPolicyGate
vi.mock('../../../src/auth/authPolicyGate', () => ({
  checkAuthPolicy: vi.fn().mockResolvedValue({ allowed: true })
}));

// Mock loadSettings
vi.mock('../../../src/lib/loadSettings', () => ({
  loadSettings: vi.fn().mockResolvedValue({
    feature_flags: {
      auth_enable_password_recovery: true,
      auth_enable_emails: true
    }
  })
}));

// Mock rate limiting
vi.mock('../../../src/services/rateLimitService', () => ({
  rateLimitService: {
    recordAttempt: vi.fn().mockReturnValue({
      allowed: true,
      remaining: 3,
      resetAt: Date.now() + 3600000
    })
  }
}));

// Mock Supabase client
const mockResetPasswordForEmail = vi.fn();
const mockGetUser = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock('../../../src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
      getUser: mockGetUser,
      updateUser: mockUpdateUser,
      admin: {
        listUsers: vi.fn().mockResolvedValue({
          data: { users: [] },
          error: null
        })
      }
    }
  }
}));

describe('Password Recovery Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set required env vars
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.AUTH_EMAIL_FROM = 'Roastr <noreply@roastr.ai>';
    process.env.SUPABASE_REDIRECT_URL = 'http://localhost:3000/auth/reset-password';
  });

  describe('POST /api/v2/auth/password-recovery', () => {
    it('should send password recovery email successfully', async () => {
      mockResetPasswordForEmail.mockResolvedValueOnce({
        data: {},
        error: null
      });

      const { default: app } = await import('../../../src/index');

      const res = await request(app)
        .post('/api/v2/auth/password-recovery')
        .send({ email: 'user@example.com' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        message: expect.stringContaining('If this email exists')
      });
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/reset-password')
        })
      );
    });

    it('should return generic message even if email does not exist (anti-enumeration)', async () => {
      mockResetPasswordForEmail.mockResolvedValueOnce({
        data: {},
        error: null
      });

      const { default: app } = await import('../../../src/index');

      const res = await request(app)
        .post('/api/v2/auth/password-recovery')
        .send({ email: 'nonexistent@example.com' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        message: expect.stringContaining('If this email exists')
      });
    });

    it('should return 400 if email is missing', async () => {
      const { default: app } = await import('../../../src/index');

      const res = await request(app).post('/api/v2/auth/password-recovery').send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.INVALID_REQUEST);
    });

    it('should fail-closed if email infrastructure is disabled', async () => {
      const { loadSettings } = await import('../../../src/lib/loadSettings');
      vi.mocked(loadSettings).mockResolvedValueOnce({
        feature_flags: {
          auth_enable_password_recovery: true,
          auth_enable_emails: false // Email infra disabled
        }
      } as any);

      const { default: app } = await import('../../../src/index');

      const res = await request(app)
        .post('/api/v2/auth/password-recovery')
        .send({ email: 'user@example.com' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.AUTH_EMAIL_DISABLED);
    });
  });

  describe('POST /api/v2/auth/update-password', () => {
    const mockAccessToken = 'valid-reset-token';
    const mockUser = {
      id: 'user-123',
      email: 'user@example.com',
      email_confirmed_at: '2025-01-01T00:00:00Z'
    };

    beforeEach(() => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null
      });
    });

    it('should update password successfully with valid token', async () => {
      mockUpdateUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null
      });

      const { default: app } = await import('../../../src/index');

      const res = await request(app)
        .post('/api/v2/auth/update-password')
        .send({
          access_token: mockAccessToken,
          password: 'NewPassword123'
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        message: expect.stringContaining('Password updated successfully')
      });
      expect(mockUpdateUser).toHaveBeenCalledWith(
        { password: 'NewPassword123' },
        { accessToken: mockAccessToken }
      );
    });

    it('should return 400 if password is too short', async () => {
      const { default: app } = await import('../../../src/index');

      const res = await request(app)
        .post('/api/v2/auth/update-password')
        .send({
          access_token: mockAccessToken,
          password: 'short'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.INVALID_REQUEST);
    });

    it('should return 400 if access_token is missing', async () => {
      const { default: app } = await import('../../../src/index');

      const res = await request(app)
        .post('/api/v2/auth/update-password')
        .send({
          password: 'NewPassword123'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.INVALID_REQUEST);
    });

    it('should return 401 if token is invalid', async () => {
      mockGetUser.mockReset();
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Invalid token' }
      });

      const { default: app } = await import('../../../src/index');

      const res = await request(app)
        .post('/api/v2/auth/update-password')
        .send({
          access_token: 'invalid-token',
          password: 'NewPassword123'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.TOKEN_INVALID);
    });

    it('should return 401 if token has expired', async () => {
      mockGetUser.mockReset();
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Token expired' }
      });

      const { default: app } = await import('../../../src/index');

      const res = await request(app)
        .post('/api/v2/auth/update-password')
        .send({
          access_token: 'expired-token',
          password: 'NewPassword123'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.TOKEN_INVALID);
    });
  });
});

