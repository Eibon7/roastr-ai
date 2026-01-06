/**
 * Auth HTTP Endpoints v2 - Coverage-oriented tests
 *
 * Enfoque: cubrir wiring de Express (routes + middleware) con mocks de authService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { AuthError, AUTH_ERROR_CODES } from '../../src/utils/authErrorTaxonomy';

vi.mock('../../src/lib/analytics', () => ({
  initializeAmplitude: vi.fn()
}));

// Mock rateLimitByType (middleware)
vi.mock('../../src/middleware/rateLimit', () => ({
  rateLimitByType: vi.fn(() => (req: any, res: any, next: any) => next())
}));

// Mock authPolicyGate (ROA-407)
vi.mock('../../src/auth/authPolicyGate', () => ({
  checkAuthPolicy: vi.fn().mockResolvedValue({ allowed: true })
}));

// Mock loadSettings (ROA-406: Ahora retorna feature flags v2)
vi.mock('../../src/lib/loadSettings', () => ({
  loadSettings: vi.fn().mockResolvedValue({
    feature_flags: {
      auth_enable_login: true,
      auth_enable_register: true,
      auth_enable_magic_link: true,
      auth_enable_password_recovery: true
    }
  })
}));

// Mock authService (used by routes + auth middleware)
const mockAuthService = {
  signup: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
  requestMagicLink: vi.fn(),
  getCurrentUser: vi.fn(),
  requestPasswordRecovery: vi.fn(),
  updatePassword: vi.fn()
};

vi.mock('../../src/services/authService', () => ({
  authService: mockAuthService
}));

describe('Backend v2 HTTP endpoints (auth)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  it('GET /health devuelve estado healthy', async () => {
    const { default: app } = await import('../../src/index');

    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.timestamp).toBeDefined();
  });

  it('POST /api/v2/auth/login valida payload (400)', async () => {
    const { default: app } = await import('../../src/index');

    const res = await request(app).post('/api/v2/auth/login').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.INVALID_REQUEST);
    expect(res.body.request_id).toBeTypeOf('string');
  });

  it('POST /api/v2/auth/login responde 200 en éxito', async () => {
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
    expect(res.body.session.access_token).toBe('token');
    expect(mockAuthService.login).toHaveBeenCalled();
  });

  it('POST /api/v2/auth/login mapea AuthError', async () => {
    mockAuthService.login.mockRejectedValueOnce(
      new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS)
    );

    const { default: app } = await import('../../src/index');
    const res = await request(app).post('/api/v2/auth/login').send({
      email: 'user@example.com',
      password: 'wrong'
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
    expect(res.body.error.retryable).toBe(false);
    expect(res.body.request_id).toBeTypeOf('string');
  });

  it('POST /api/v2/auth/login devuelve 500 ante error genérico', async () => {
    mockAuthService.login.mockRejectedValueOnce(new Error('boom'));

    const { default: app } = await import('../../src/index');
    const res = await request(app).post('/api/v2/auth/login').send({
      email: 'user@example.com',
      password: 'ValidPassword123'
    });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.UNKNOWN);
    expect(res.body.request_id).toBeTypeOf('string');
  });

  it('GET /api/v2/auth/me requiere auth y devuelve user', async () => {
    mockAuthService.getCurrentUser.mockResolvedValueOnce({
      id: 'u1',
      email: 'user@example.com',
      role: 'user',
      email_verified: true
    });

    const { default: app } = await import('../../src/index');
    const res = await request(app)
      .get('/api/v2/auth/me')
      .set('Authorization', 'Bearer access-token');

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('user@example.com');
  });

  it('POST /api/v2/auth/logout requiere auth y hace logout', async () => {
    mockAuthService.getCurrentUser.mockResolvedValueOnce({
      id: 'u1',
      email: 'user@example.com',
      role: 'user',
      email_verified: true
    });
    mockAuthService.logout.mockResolvedValueOnce(undefined);

    const { default: app } = await import('../../src/index');
    const res = await request(app)
      .post('/api/v2/auth/logout')
      .set('Authorization', 'Bearer access-token');

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/logout successful/i);
    expect(mockAuthService.logout).toHaveBeenCalledWith('access-token');
  });

  it('POST /api/v2/auth/logout mapea AuthError', async () => {
    mockAuthService.getCurrentUser.mockResolvedValueOnce({
      id: 'u1',
      email: 'user@example.com',
      role: 'user',
      email_verified: true
    });
    mockAuthService.logout.mockRejectedValueOnce(new AuthError(AUTH_ERROR_CODES.TOKEN_INVALID));

    const { default: app } = await import('../../src/index');
    const res = await request(app)
      .post('/api/v2/auth/logout')
      .set('Authorization', 'Bearer access-token');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.TOKEN_INVALID);
  });

  it('POST /api/v2/auth/refresh valida payload (400)', async () => {
    const { default: app } = await import('../../src/index');
    const res = await request(app).post('/api/v2/auth/refresh').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.INVALID_REQUEST);
  });

  it('POST /api/v2/auth/refresh responde 200 en éxito', async () => {
    mockAuthService.refreshSession.mockResolvedValueOnce({
      access_token: 'token',
      refresh_token: 'refresh',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: { id: 'u1', email: 'user@example.com', role: 'user', email_verified: true }
    });

    const { default: app } = await import('../../src/index');
    const res = await request(app).post('/api/v2/auth/refresh').send({ refresh_token: 'rt' });
    expect(res.status).toBe(200);
    expect(res.body.session.refresh_token).toBe('refresh');
  });

  it('POST /api/v2/auth/refresh mapea AuthError', async () => {
    mockAuthService.refreshSession.mockRejectedValueOnce(
      new AuthError(AUTH_ERROR_CODES.TOKEN_INVALID)
    );

    const { default: app } = await import('../../src/index');
    const res = await request(app).post('/api/v2/auth/refresh').send({ refresh_token: 'rt' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.TOKEN_INVALID);
  });

  it('POST /api/v2/auth/refresh devuelve 500 ante error genérico', async () => {
    mockAuthService.refreshSession.mockRejectedValueOnce(new Error('boom'));

    const { default: app } = await import('../../src/index');
    const res = await request(app).post('/api/v2/auth/refresh').send({ refresh_token: 'rt' });
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.UNKNOWN);
  });

  it('POST /api/v2/auth/magic-link valida payload (400)', async () => {
    const { default: app } = await import('../../src/index');
    const res = await request(app).post('/api/v2/auth/magic-link').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.INVALID_REQUEST);
  });

  it('POST /api/v2/auth/magic-link responde success cuando authService lo hace', async () => {
    mockAuthService.requestMagicLink.mockResolvedValueOnce({
      success: true,
      message: 'If this email exists, a magic link has been sent'
    });

    const { default: app } = await import('../../src/index');
    const res = await request(app)
      .post('/api/v2/auth/magic-link')
      .send({ email: 'user@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/v2/auth/magic-link mapea AuthError', async () => {
    mockAuthService.requestMagicLink.mockRejectedValueOnce(
      new AuthError(AUTH_ERROR_CODES.AUTH_DISABLED)
    );

    const { default: app } = await import('../../src/index');
    const res = await request(app)
      .post('/api/v2/auth/magic-link')
      .send({ email: 'user@example.com' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.AUTH_DISABLED);
  });

  it('POST /api/v2/auth/signup valida payload (400)', async () => {
    const { default: app } = await import('../../src/index');
    const res = await request(app).post('/api/v2/auth/signup').send({
      email: 'user@example.com',
      password: 'ValidPassword123'
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.INVALID_REQUEST);
  });

  it('POST /api/v2/auth/signup responde 201 en éxito', async () => {
    mockAuthService.signup.mockResolvedValueOnce({
      access_token: 'token',
      refresh_token: 'refresh',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: { id: 'u1', email: 'user@example.com', role: 'user', email_verified: false }
    });

    const { default: app } = await import('../../src/index');
    const res = await request(app).post('/api/v2/auth/signup').send({
      email: 'user@example.com',
      password: 'ValidPassword123',
      plan_id: 'starter'
    });

    expect(res.status).toBe(201);
    expect(res.body.session.access_token).toBe('token');
  });

  it('POST /api/v2/auth/signup mapea AuthError', async () => {
    mockAuthService.signup.mockRejectedValueOnce(
      new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS)
    );

    const { default: app } = await import('../../src/index');
    const res = await request(app).post('/api/v2/auth/signup').send({
      email: 'user@example.com',
      password: 'ValidPassword123',
      plan_id: 'starter'
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
  });

  // ================================
  // Password Recovery Endpoints Tests
  // ================================

  describe('POST /api/v2/auth/password-recovery', () => {
    it('valida email requerido (400)', async () => {
      const { default: app } = await import('../../src/index');
      const res = await request(app).post('/api/v2/auth/password-recovery').send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.INVALID_REQUEST);
      expect(res.body.request_id).toBeTypeOf('string');
    });

    it('responde 200 en éxito (anti-enumeration)', async () => {
      mockAuthService.requestPasswordRecovery.mockResolvedValueOnce({
        success: true,
        message: 'If this email exists, a password recovery link has been sent'
      });

      const { default: app } = await import('../../src/index');
      const res = await request(app).post('/api/v2/auth/password-recovery').send({
        email: 'user@example.com'
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('If this email exists');
      expect(mockAuthService.requestPasswordRecovery).toHaveBeenCalled();
    });

    it('devuelve 403 cuando feature flag está deshabilitado', async () => {
      // Temporarily override loadSettings mock
      const { loadSettings } = await import('../../src/lib/loadSettings');
      vi.mocked(loadSettings).mockResolvedValueOnce({
        feature_flags: {
          auth_enable_login: true,
          auth_enable_register: true,
          auth_enable_magic_link: true,
          auth_enable_password_recovery: false
        }
      });

      const { default: app } = await import('../../src/index');
      const res = await request(app).post('/api/v2/auth/password-recovery').send({
        email: 'user@example.com'
      });

      expect(res.status).toBe(401); // AUTH_DISABLED tiene http_status 401
      expect(res.body.success).toBe(false);
      expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.AUTH_DISABLED);
    });
  });

  describe('POST /api/v2/auth/update-password', () => {
    it('valida access_token requerido (400)', async () => {
      const { default: app } = await import('../../src/index');
      const res = await request(app).post('/api/v2/auth/update-password').send({
        password: 'NewPassword123'
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.INVALID_REQUEST);
      expect(res.body.request_id).toBeTypeOf('string');
    });

    it('valida password requerido (400)', async () => {
      const { default: app } = await import('../../src/index');
      const res = await request(app).post('/api/v2/auth/update-password').send({
        access_token: 'valid-token-123'
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.INVALID_REQUEST);
    });

    it('valida password mínimo 8 caracteres (400)', async () => {
      const { default: app } = await import('../../src/index');
      const res = await request(app).post('/api/v2/auth/update-password').send({
        access_token: 'valid-token-123',
        password: 'short'
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.INVALID_REQUEST);
    });

    it('valida password máximo 128 caracteres (400)', async () => {
      const { default: app } = await import('../../src/index');
      const longPassword = 'a'.repeat(129);
      const res = await request(app).post('/api/v2/auth/update-password').send({
        access_token: 'valid-token-123',
        password: longPassword
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.INVALID_REQUEST);
    });

    it('responde 200 en éxito con token válido', async () => {
      mockAuthService.updatePassword.mockResolvedValueOnce({
        message: 'Password updated successfully. You can now login with your new password.'
      });

      const { default: app } = await import('../../src/index');
      const res = await request(app).post('/api/v2/auth/update-password').send({
        access_token: 'valid-recovery-token-123',
        password: 'NewSecurePassword123!'
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Password updated successfully');
      expect(mockAuthService.updatePassword).toHaveBeenCalledWith(
        'valid-recovery-token-123',
        'NewSecurePassword123!'
      );
    });

    it('mapea TOKEN_INVALID cuando token es inválido (401)', async () => {
      mockAuthService.updatePassword.mockRejectedValueOnce(
        new AuthError(AUTH_ERROR_CODES.TOKEN_INVALID)
      );

      const { default: app } = await import('../../src/index');
      const res = await request(app).post('/api/v2/auth/update-password').send({
        access_token: 'invalid-token',
        password: 'NewPassword123'
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.TOKEN_INVALID);
    });

    it('mapea AUTH_UNKNOWN en errores técnicos (500)', async () => {
      mockAuthService.updatePassword.mockRejectedValueOnce(new AuthError(AUTH_ERROR_CODES.UNKNOWN));

      const { default: app } = await import('../../src/index');
      const res = await request(app).post('/api/v2/auth/update-password').send({
        access_token: 'valid-token',
        password: 'NewPassword123'
      });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.UNKNOWN);
    });

    it('devuelve 403 cuando feature flag está deshabilitado', async () => {
      // Temporarily override loadSettings mock
      const { loadSettings } = await import('../../src/lib/loadSettings');
      vi.mocked(loadSettings).mockResolvedValueOnce({
        feature_flags: {
          auth_enable_login: true,
          auth_enable_register: true,
          auth_enable_magic_link: true,
          auth_enable_password_recovery: false
        }
      });

      const { default: app } = await import('../../src/index');
      const res = await request(app).post('/api/v2/auth/update-password').send({
        access_token: 'valid-token',
        password: 'NewPassword123'
      });

      expect(res.status).toBe(401); // AUTH_DISABLED tiene http_status 401
      expect(res.body.success).toBe(false);
      expect(res.body.error.slug).toBe(AUTH_ERROR_CODES.AUTH_DISABLED);
    });
  });
});
