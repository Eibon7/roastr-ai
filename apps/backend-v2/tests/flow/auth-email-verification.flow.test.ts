/**
 * Email Verification Flow Tests (ROA-373)
 *
 * Tests de integración para el flujo completo de verificación de email:
 * 1. Register → Email verification → Login (success)
 * 2. Register → Login without verification → Error
 * 3. Verify with invalid token → Error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockTrackEvent = vi.fn();
const originalEnv = process.env;

// Mock analytics
vi.mock('../../src/lib/analytics', () => ({
  initializeAmplitude: vi.fn(),
  trackEvent: mockTrackEvent
}));

// Mock auth email service (ROA-409)
vi.mock('../../src/services/authEmailService', () => ({
  assertAuthEmailInfrastructureEnabled: vi.fn().mockResolvedValue({ provider: 'resend' }),
  sendPasswordRecoveryEmailAfterPreflight: vi.fn().mockResolvedValue(undefined)
}));

// Mock authPolicyGate
vi.mock('../../src/auth/authPolicyGate', () => ({
  checkAuthPolicy: vi.fn().mockResolvedValue({ allowed: true })
}));

// Mock loadSettings (feature flags)
vi.mock('../../src/lib/loadSettings', () => ({
  loadSettings: vi.fn()
}));

// Mock rate limiting
vi.mock('../../src/services/rateLimitService', () => ({
  rateLimitService: {
    recordAttempt: vi.fn().mockReturnValue({
      allowed: true,
      remaining: 10,
      resetAt: Date.now() + 60000
    }),
    setObservability: vi.fn()
  }
}));

// Mock abuse detection
vi.mock('../../src/services/abuseDetectionService', () => ({
  abuseDetectionService: {
    recordAttempt: vi.fn().mockReturnValue({ isAbuse: false })
  }
}));

// Mock Supabase client
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));
const mockSignUp = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockVerifyOtp = vi.fn();

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
      verifyOtp: mockVerifyOtp
    },
    from: mockFrom
  }
}));

describe('Email Verification Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup environment variables
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      RESEND_API_KEY: 'test-resend-key',
      AUTH_EMAIL_FROM: 'Roastr <noreply@roastr.ai>',
      SUPABASE_REDIRECT_URL: 'http://localhost:3000/auth/callback',
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-service-key'
    };

    // Reset mocks
    mockInsert.mockResolvedValue({ error: null });
  });

  describe('Flow 1: Register → Verify → Login (Success)', () => {
    it('debe permitir login después de verificar email', async () => {
      const testEmail = 'verified@example.com';
      const testPassword = 'SecurePass123!';
      const userId = 'user-verified-123';

      // Mock feature flags enabled
      const { loadSettings } = await import('../../src/lib/loadSettings');
      vi.mocked(loadSettings).mockResolvedValue({
        feature_flags: {
          auth_enable_register: true,
          auth_enable_login: true,
          auth_enable_email_verification: true
        }
      } as any);

      const { default: app } = await import('../../src/index');

      // Step 1: Register
      mockSignUp.mockResolvedValueOnce({
        data: {
          user: {
            id: userId,
            email: testEmail,
            email_confirmed_at: null // Email NO confirmado aún
          },
          session: null
        },
        error: null
      });

      const registerResponse = await request(app)
        .post('/api/v2/auth/register')
        .send({ email: testEmail, password: testPassword });

      expect(registerResponse.status).toBe(200);
      expect(registerResponse.body.success).toBe(true);

      // Step 2: Verify email
      mockVerifyOtp.mockResolvedValueOnce({
        data: {
          user: {
            id: userId,
            email: testEmail,
            email_confirmed_at: new Date().toISOString() // Email confirmado
          },
          session: null
        },
        error: null
      });

      const verifyResponse = await request(app)
        .post('/api/v2/auth/verify-email')
        .send({ token_hash: 'valid-token-123', type: 'email' });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.message).toBe('Email verified successfully');

      // Step 3: Login (should succeed now)
      mockSignInWithPassword.mockResolvedValueOnce({
        data: {
          user: {
            id: userId,
            email: testEmail,
            email_confirmed_at: new Date().toISOString(), // Email confirmado
            user_metadata: { role: 'user' },
            created_at: new Date().toISOString()
          },
          session: {
            access_token: 'access-token-123',
            refresh_token: 'refresh-token-123',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: 'bearer'
          }
        },
        error: null
      });

      const loginResponse = await request(app)
        .post('/api/v2/auth/login')
        .send({ email: testEmail, password: testPassword });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.session).toBeDefined();
      expect(loginResponse.body.session.access_token).toBe('access-token-123');
    });
  });

  describe('Flow 2: Register → Login without Verification (Error)', () => {
    it('debe rechazar login si email no está verificado', async () => {
      const testEmail = 'unverified@example.com';
      const testPassword = 'SecurePass123!';
      const userId = 'user-unverified-123';

      // Mock feature flags enabled
      const { loadSettings } = await import('../../src/lib/loadSettings');
      vi.mocked(loadSettings).mockResolvedValue({
        feature_flags: {
          auth_enable_register: true,
          auth_enable_login: true
        }
      } as any);

      const { default: app } = await import('../../src/index');

      // Step 1: Register
      mockSignUp.mockResolvedValueOnce({
        data: {
          user: {
            id: userId,
            email: testEmail,
            email_confirmed_at: null // Email NO confirmado
          },
          session: null
        },
        error: null
      });

      const registerResponse = await request(app)
        .post('/api/v2/auth/register')
        .send({ email: testEmail, password: testPassword });

      expect(registerResponse.status).toBe(200);
      expect(registerResponse.body.success).toBe(true);

      // Step 2: Intentar login SIN verificar (should fail)
      mockSignInWithPassword.mockResolvedValueOnce({
        data: {
          user: {
            id: userId,
            email: testEmail,
            email_confirmed_at: null, // Email NO confirmado
            user_metadata: { role: 'user' },
            created_at: new Date().toISOString()
          },
          session: {
            access_token: 'access-token-123',
            refresh_token: 'refresh-token-123',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: 'bearer'
          }
        },
        error: null
      });

      const loginResponse = await request(app)
        .post('/api/v2/auth/login')
        .send({ email: testEmail, password: testPassword });

      expect(loginResponse.status).toBe(401);
      expect(loginResponse.body.success).toBe(false);
      expect(loginResponse.body.error).toBeDefined();
      expect(loginResponse.body.error.slug).toBe('AUTH_EMAIL_NOT_CONFIRMED');
    });
  });

  describe('Flow 3: Verify with Invalid Token (Error)', () => {
    it('debe rechazar token inválido', async () => {
      // Mock feature flags enabled
      const { loadSettings } = await import('../../src/lib/loadSettings');
      vi.mocked(loadSettings).mockResolvedValue({
        feature_flags: {
          auth_enable_email_verification: true
        }
      } as any);

      const { default: app } = await import('../../src/index');

      // Mock Supabase error for invalid token
      mockVerifyOtp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: {
          message: 'Token has expired or is invalid',
          status: 400
        }
      });

      const verifyResponse = await request(app)
        .post('/api/v2/auth/verify-email')
        .send({ token_hash: 'invalid-token', type: 'email' });

      expect(verifyResponse.status).toBeGreaterThanOrEqual(400);
      expect(verifyResponse.body.success).toBe(false);
      expect(verifyResponse.body.error).toBeDefined();
    });

    it('debe rechazar token vacío', async () => {
      // Mock feature flags enabled
      const { loadSettings } = await import('../../src/lib/loadSettings');
      vi.mocked(loadSettings).mockResolvedValue({
        feature_flags: {
          auth_enable_email_verification: true
        }
      } as any);

      const { default: app } = await import('../../src/index');

      const verifyResponse = await request(app)
        .post('/api/v2/auth/verify-email')
        .send({ token_hash: '', type: 'email' });

      expect(verifyResponse.status).toBe(400);
      expect(verifyResponse.body.success).toBe(false);
      expect(verifyResponse.body.error.slug).toBe('TOKEN_INVALID');
    });

    it('debe rechazar tipo inválido', async () => {
      // Mock feature flags enabled
      const { loadSettings } = await import('../../src/lib/loadSettings');
      vi.mocked(loadSettings).mockResolvedValue({
        feature_flags: {
          auth_enable_email_verification: true
        }
      } as any);

      const { default: app } = await import('../../src/index');

      const verifyResponse = await request(app)
        .post('/api/v2/auth/verify-email')
        .send({ token_hash: 'valid-token', type: 'sms' });

      expect(verifyResponse.status).toBe(400);
      expect(verifyResponse.body.success).toBe(false);
      expect(verifyResponse.body.error.slug).toBe('POLICY_INVALID_REQUEST');
    });
  });

  describe('Flow 4: Rate Limiting', () => {
    it('debe aplicar rate limit después de múltiples intentos', async () => {
      // Mock feature flags enabled
      const { loadSettings } = await import('../../src/lib/loadSettings');
      vi.mocked(loadSettings).mockResolvedValue({
        feature_flags: {
          auth_enable_email_verification: true
        }
      } as any);

      // Mock rate limit exceeded
      const { rateLimitService } = await import('../../src/services/rateLimitService');
      vi.mocked(rateLimitService.recordAttempt).mockReturnValueOnce({
        allowed: false,
        blockedUntil: Date.now() + 60000
      });

      const { default: app } = await import('../../src/index');

      const verifyResponse = await request(app)
        .post('/api/v2/auth/verify-email')
        .send({ token_hash: 'any-token', type: 'email' });

      expect(verifyResponse.status).toBe(429);
      expect(verifyResponse.body.success).toBe(false);
      expect(verifyResponse.body.error.slug).toBe('POLICY_RATE_LIMITED');
    });
  });
});
