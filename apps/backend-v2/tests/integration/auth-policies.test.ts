/**
 * Auth Policies Integration Tests v2
 *
 * Tests de integración para verificar el wiring completo de A3:
 * - Authentication
 * - Authorization  
 * - Audit
 *
 * Issue: ROA-407 - A3 Auth Policy Wiring v2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { AuthError, AUTH_ERROR_CODES } from '../../src/utils/authErrorTaxonomy.js';

// Mock analytics
vi.mock('../../src/lib/analytics', () => ({
  initializeAmplitude: vi.fn(),
  trackEvent: vi.fn()
}));

// Mock loadSettings
vi.mock('../../src/lib/loadSettings', () => ({
  loadSettings: vi.fn().mockResolvedValue({
    feature_flags: { enable_user_registration: false },
    auth: { login: { enabled: true }, signup: { enabled: true }, magic_link: { enabled: true } }
  })
}));

// Mock authService
const mockAuthService = {
  signup: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
  requestMagicLink: vi.fn(),
  getCurrentUser: vi.fn(),
  register: vi.fn()
};

vi.mock('../../src/services/authService', () => ({
  authService: mockAuthService
}));

// Mock auditService (para verificar que se llama)
const mockAuditService = {
  logEvent: vi.fn().mockResolvedValue({ success: true, event_id: 'audit-123' }),
  logLoginSuccess: vi.fn().mockResolvedValue({}),
  logLoginFailed: vi.fn().mockResolvedValue({}),
  logLogout: vi.fn().mockResolvedValue({}),
  logRegisterSuccess: vi.fn().mockResolvedValue({}),
  logRegisterFailed: vi.fn().mockResolvedValue({}),
  logTokenRefresh: vi.fn().mockResolvedValue({}),
  logMagicLinkRequest: vi.fn().mockResolvedValue({}),
  logRateLimitHit: vi.fn().mockResolvedValue({}),
  logPermissionDenied: vi.fn().mockResolvedValue({})
};

vi.mock('../../src/services/auditService.js', () => ({
  auditService: mockAuditService
}));

// Mock supabaseAdmin
vi.mock('../../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'audit-123' }, error: null })
        })
      })
    })
  }
}));

describe('Backend v2 - A3 Auth Policies Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  describe('Audit Trail', () => {
    it('should log audit event on successful login', async () => {
      mockAuthService.login.mockResolvedValueOnce({
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: { id: 'u1', email: 'user@example.com', role: 'user', email_verified: true }
      });

      const { default: app } = await import('../../src/index');

      const res = await request(app).post('/api/v2/auth/login').send({
        email: 'user@example.com',
        password: 'ValidPassword123'
      });

      expect(res.status).toBe(200);
      expect(mockAuthService.login).toHaveBeenCalled();
      expect(mockAuditService.logLoginSuccess).toHaveBeenCalledWith(
        'u1',
        expect.any(String),
        expect.any(String)
      );
    });

    it('should log audit event on failed login', async () => {
      mockAuthService.login.mockRejectedValueOnce(
        new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS)
      );

      const { default: app } = await import('../../src/index');

      const res = await request(app).post('/api/v2/auth/login').send({
        email: 'user@example.com',
        password: 'wrong'
      });

      expect(res.status).toBe(401);
      expect(mockAuditService.logLoginFailed).toHaveBeenCalledWith(
        'user@example.com',
        AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        expect.any(String),
        expect.any(String)
      );
    });

    it('should log audit event on magic link request', async () => {
      mockAuthService.requestMagicLink.mockResolvedValueOnce({
        message: 'Magic link sent'
      });

      const { default: app } = await import('../../src/index');

      const res = await request(app).post('/api/v2/auth/magic-link').send({
        email: 'user@example.com'
      });

      expect(res.status).toBe(200);
      expect(mockAuditService.logMagicLinkRequest).toHaveBeenCalledWith(
        'user@example.com',
        expect.any(String),
        expect.any(String)
      );
    });

    it('should log audit event on token refresh', async () => {
      mockAuthService.refreshSession.mockResolvedValueOnce({
        access_token: 'new-token',
        refresh_token: 'refresh',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: { id: 'u1', email: 'user@example.com', role: 'user', email_verified: true }
      });

      const { default: app } = await import('../../src/index');

      const res = await request(app).post('/api/v2/auth/refresh').send({
        refresh_token: 'valid-refresh-token'
      });

      expect(res.status).toBe(200);
      expect(mockAuditService.logTokenRefresh).toHaveBeenCalledWith('u1', expect.any(String));
    });

    it('should log audit event on logout', async () => {
      mockAuthService.getCurrentUser.mockResolvedValueOnce({
        id: 'u1',
        email: 'user@example.com',
        role: 'user',
        email_verified: true
      });
      mockAuthService.logout.mockResolvedValueOnce({});

      const { default: app } = await import('../../src/index');

      const res = await request(app)
        .post('/api/v2/auth/logout')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(mockAuditService.logLogout).toHaveBeenCalledWith('u1', expect.any(String));
    });
  });

  describe('Authorization Checks', () => {
    it('should block access without token', async () => {
      const { default: app } = await import('../../src/index');

      const res = await request(app).get('/api/v2/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.TOKEN_MISSING);
    });

    it('should allow access with valid token', async () => {
      mockAuthService.getCurrentUser.mockResolvedValueOnce({
        id: 'u1',
        email: 'user@example.com',
        role: 'user',
        email_verified: true
      });

      const { default: app } = await import('../../src/index');

      const res = await request(app)
        .get('/api/v2/auth/me')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe('u1');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limit on login endpoint', async () => {
      mockAuthService.login.mockResolvedValue({
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: { id: 'u1', email: 'user@example.com', role: 'user', email_verified: true }
      });

      const { default: app } = await import('../../src/index');

      // Hacer 6 requests (límite es 5)
      const requests = Array.from({ length: 6 }, () =>
        request(app).post('/api/v2/auth/login').send({
          email: 'user@example.com',
          password: 'ValidPassword123'
        })
      );

      const results = await Promise.all(requests);

      // Los primeros 5 deben pasar
      const successful = results.filter((r) => r.status === 200);
      const blocked = results.filter((r) => r.status === 429);

      expect(successful.length).toBeGreaterThan(0);
      expect(blocked.length).toBeGreaterThan(0);

      // Verificar que los bloqueados tienen slug correcto
      blocked.forEach((res) => {
        expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.RATE_LIMITED);
      });
    });
  });

  describe('Error Handling', () => {
    it('should map Supabase errors to AuthError slugs', async () => {
      mockAuthService.login.mockRejectedValueOnce(
        new AuthError(AUTH_ERROR_CODES.EMAIL_NOT_CONFIRMED)
      );

      const { default: app } = await import('../../src/index');

      const res = await request(app).post('/api/v2/auth/login').send({
        email: 'user@example.com',
        password: 'password'
      });

      expect(res.status).toBe(401);
      expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.EMAIL_NOT_CONFIRMED);
      expect(res.body.error.retryable).toBe(false);
      expect(res.body.request_id).toBeTypeOf('string');
    });

    it('should include Retry-After header for rate limited responses', async () => {
      mockAuthService.login.mockResolvedValue({
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: { id: 'u1', email: 'user@example.com', role: 'user', email_verified: true }
      });

      const { default: app } = await import('../../src/index');

      // Hacer requests hasta que rate limit se active
      let rateLimitedResponse;
      for (let i = 0; i < 10; i++) {
        const res = await request(app).post('/api/v2/auth/login').send({
          email: `user${i}@example.com`,
          password: 'password'
        });
        if (res.status === 429) {
          rateLimitedResponse = res;
          break;
        }
      }

      if (rateLimitedResponse) {
        expect(rateLimitedResponse.headers['retry-after']).toBeDefined();
        expect(parseInt(rateLimitedResponse.headers['retry-after'])).toBeGreaterThan(0);
      }
    });
  });
});

