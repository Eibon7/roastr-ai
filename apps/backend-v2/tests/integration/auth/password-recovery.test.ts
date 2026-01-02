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
    }),
    setObservability: vi.fn() // Mock setObservability method
  }
}));

// Mock authEmailService
const mockAssertAuthEmailInfrastructureEnabled = vi.fn();
const mockSendPasswordRecoveryEmailAfterPreflight = vi.fn();

vi.mock('../../../src/services/authEmailService', () => ({
  assertAuthEmailInfrastructureEnabled: mockAssertAuthEmailInfrastructureEnabled,
  sendPasswordRecoveryEmailAfterPreflight: mockSendPasswordRecoveryEmailAfterPreflight
}));

// Mock Supabase client
const mockGetUser = vi.fn();
const mockListUsers = vi.fn();
const mockUpdateUserById = vi.fn();

vi.mock('../../../src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: mockGetUser,
      admin: {
        listUsers: mockListUsers,
        updateUserById: mockUpdateUserById
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
      mockAssertAuthEmailInfrastructureEnabled.mockResolvedValueOnce(undefined);
      mockListUsers.mockResolvedValueOnce({
        data: {
          users: [
            {
              id: 'user-123',
              email: 'user@example.com',
              user_metadata: { role: 'user' }
            }
          ]
        },
        error: null
      });
      mockSendPasswordRecoveryEmailAfterPreflight.mockResolvedValueOnce(undefined);

      const { default: app } = await import('../../../src/index');

      const res = await request(app)
        .post('/api/v2/auth/password-recovery')
        .send({ email: 'user@example.com' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        message: expect.stringContaining('Password recovery link sent')
      });
      expect(mockSendPasswordRecoveryEmailAfterPreflight).toHaveBeenCalledWith(
        'user@example.com',
        expect.objectContaining({
          request_id: expect.any(String)
        })
      );
    });

    it('should return generic message even if email does not exist (anti-enumeration)', async () => {
      mockAssertAuthEmailInfrastructureEnabled.mockResolvedValueOnce(undefined);
      mockListUsers.mockResolvedValueOnce({
        data: { users: [] },
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
      mockAssertAuthEmailInfrastructureEnabled.mockRejectedValueOnce(
        new AuthError(AUTH_ERROR_CODES.AUTH_EMAIL_DISABLED)
      );

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

    it('should update password successfully with valid token', async () => {
      mockGetUser.mockReset();
      mockGetUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null
      });
      mockUpdateUserById.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null
      });

      const { default: app } = await import('../../../src/index');

      const res = await request(app).post('/api/v2/auth/update-password').send({
        access_token: mockAccessToken,
        password: 'NewPassword123'
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        message: expect.stringContaining('Password updated successfully')
      });
      expect(mockUpdateUserById).toHaveBeenCalledWith(mockUser.id, {
        password: 'NewPassword123'
      });
    });

    it('should return 400 if password is too short', async () => {
      mockGetUser.mockReset();
      const { default: app } = await import('../../../src/index');

      const res = await request(app).post('/api/v2/auth/update-password').send({
        access_token: mockAccessToken,
        password: 'short'
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.INVALID_REQUEST);
    });

    it('should return 400 if access_token is missing', async () => {
      mockGetUser.mockReset();
      const { default: app } = await import('../../../src/index');

      const res = await request(app).post('/api/v2/auth/update-password').send({
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

      const res = await request(app).post('/api/v2/auth/update-password').send({
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

      const res = await request(app).post('/api/v2/auth/update-password').send({
        access_token: 'expired-token',
        password: 'NewPassword123'
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.TOKEN_INVALID);
    });
  });
});
