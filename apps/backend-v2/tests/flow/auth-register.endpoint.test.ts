/**
 * Auth Register Endpoint Tests v2 (ROA-374)
 * + B3: Register Analytics Implementation (ROA-376)
 *
 * Valida el contrato de:
 * POST /api/v2/auth/register
 *
 * Reglas:
 * - Anti-enumeration: responde { success: true } incluso si el email ya existe
 * - Feature flag: feature_flags.auth_enable_register
 * - Validación: email requerido/normalizado, password >= 8
 * - Analytics: trackea eventos de success/failed
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockTrackEvent = vi.fn();

vi.mock('../../src/lib/analytics', () => ({
  initializeAmplitude: vi.fn(),
  trackEvent: mockTrackEvent
}));

// Mock authPolicyGate (ROA-407)
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
      remaining: 5,
      resetAt: Date.now() + 60000
    })
  }
}));

// Mock Supabase client
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));
const mockSignUp = vi.fn();

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signUp: mockSignUp
    },
    from: mockFrom
  }
}));

describe('POST /api/v2/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve 401 cuando el feature flag está OFF (ROA-406)', async () => {
    const { loadSettings } = await import('../../src/lib/loadSettings');
    vi.mocked(loadSettings).mockResolvedValueOnce({
      feature_flags: {
        auth_enable_register: false
      }
    } as any);

    const { default: app } = await import('../../src/index');

    const res = await request(app).post('/api/v2/auth/register').send({
      email: 'user@example.com',
      password: 'ValidPassword123'
    });

    expect(res.status).toBe(401); // AUTH_DISABLED tiene http_status 401
    expect(res.body).toMatchObject({
      success: false,
      error: { slug: 'AUTH_DISABLED', retryable: true } // Retryable porque puede habilitarse después
    });
    expect(res.body.request_id).toBeTypeOf('string');
  });

  it('devuelve 400 si el payload es inválido', async () => {
    const { loadSettings } = await import('../../src/lib/loadSettings');
    vi.mocked(loadSettings).mockResolvedValueOnce({
      feature_flags: {
        auth_enable_register: true
      }
    } as any);

    const { default: app } = await import('../../src/index');

    const res = await request(app).post('/api/v2/auth/register').send({
      email: '',
      password: 'short'
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: { slug: 'POLICY_INVALID_REQUEST' }
    });
    expect(res.body.request_id).toBeTypeOf('string');
  });

  it('registra email nuevo y responde homogéneo { success: true }', async () => {
    const { loadSettings } = await import('../../src/lib/loadSettings');
    vi.mocked(loadSettings).mockResolvedValueOnce({
      feature_flags: {
        auth_enable_register: true
      }
    } as any);

    mockSignUp.mockResolvedValueOnce({
      data: {
        user: {
          id: 'user_123',
          email: 'user@example.com',
          created_at: new Date().toISOString(),
          user_metadata: { role: 'user' }
        },
        session: null
      },
      error: null
    });

    mockInsert.mockResolvedValueOnce({ error: null });

    const { default: app } = await import('../../src/index');

    const res = await request(app).post('/api/v2/auth/register').send({
      email: 'USER@EXAMPLE.COM',
      password: 'ValidPassword123'
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        password: 'ValidPassword123'
      })
    );
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user_123',
        username: 'user@example.com',
        onboarding_state: 'welcome'
      })
    );
  });

  it('si el email ya existe, NO lo revela y responde { success: true }', async () => {
    const { loadSettings } = await import('../../src/lib/loadSettings');
    vi.mocked(loadSettings).mockResolvedValueOnce({
      feature_flags: {
        auth_enable_register: true
      }
    } as any);

    mockSignUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: {
        message: 'User already registered'
      }
    });

    const { default: app } = await import('../../src/index');

    const res = await request(app).post('/api/v2/auth/register').send({
      email: 'user@example.com',
      password: 'ValidPassword123'
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('devuelve 500 ante error técnico no recuperable', async () => {
    const { loadSettings } = await import('../../src/lib/loadSettings');
    vi.mocked(loadSettings).mockResolvedValueOnce({
      feature_flags: {
        auth_enable_register: true
      }
    } as any);

    mockSignUp.mockRejectedValueOnce(new Error('Network down'));

    const { default: app } = await import('../../src/index');

    const res = await request(app).post('/api/v2/auth/register').send({
      email: 'user@example.com',
      password: 'ValidPassword123'
    });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      error: { slug: 'AUTH_UNKNOWN', retryable: false }
    });
    expect(res.body.request_id).toBeTypeOf('string');
  });

  // ============================================
  // B3: Register Analytics Flow Tests (ROA-376)
  // ============================================

  describe('Analytics Integration (B3)', () => {
    it('FLOW: registro exitoso trackea "auth_register_success" y "auth_register_endpoint_success"', async () => {
      const { loadSettings } = await import('../../src/lib/loadSettings');
      vi.mocked(loadSettings).mockResolvedValueOnce({
        feature_flags: {
          auth_enable_register: true
        }
      } as any);

      mockSignUp.mockResolvedValueOnce({
        data: {
          user: {
            id: 'analytics_user_1',
            email: 'analytics@example.com',
            created_at: new Date().toISOString(),
            user_metadata: { role: 'user' }
          },
          session: null
        },
        error: null
      });

      mockInsert.mockResolvedValueOnce({ error: null });

      const { default: app } = await import('../../src/index');

      const res = await request(app).post('/api/v2/auth/register').send({
        email: 'analytics@example.com',
        password: 'AnalyticsPassword123'
      });

      // ✅ VALIDAR: Flujo resuelve correctamente
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });

      // ✅ VALIDAR: Analytics trackea eventos correctos
      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'analytics_user_1',
          event: 'auth_register_success',
          context: expect.objectContaining({
            flow: 'auth'
          })
        })
      );

      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'auth_register_endpoint_success',
          properties: expect.objectContaining({
            endpoint: '/api/v2/auth/register',
            method: 'email_password',
            status_code: 200
          }),
          context: expect.objectContaining({
            flow: 'auth'
          })
        })
      );
    });

    it('FLOW: registro fallido trackea "auth_register_failed" y "auth_register_endpoint_failed"', async () => {
      const { loadSettings } = await import('../../src/lib/loadSettings');
      vi.mocked(loadSettings).mockResolvedValueOnce({
        feature_flags: {
          auth_enable_register: true
        }
      } as any);

      mockSignUp.mockRejectedValueOnce(new Error('Database connection failed'));

      const { default: app } = await import('../../src/index');

      const res = await request(app).post('/api/v2/auth/register').send({
        email: 'failed@example.com',
        password: 'ValidPassword123'
      });

      // ✅ VALIDAR: Flujo falla correctamente
      expect(res.status).toBe(500);

      // ✅ VALIDAR: Analytics trackea eventos de fallo
      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'auth_register_failed',
          properties: expect.objectContaining({
            error_slug: expect.any(String),
            method: 'email_password'
          }),
          context: expect.objectContaining({
            flow: 'auth'
          })
        })
      );

      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'auth_register_endpoint_failed',
          properties: expect.objectContaining({
            endpoint: '/api/v2/auth/register',
            error_type: 'INTERNAL_ERROR',
            status_code: 500
          }),
          context: expect.objectContaining({
            flow: 'auth'
          })
        })
      );
    });

    it('FLOW: analytics NO crashea el flujo si falla (graceful degradation)', async () => {
      const { loadSettings } = await import('../../src/lib/loadSettings');
      vi.mocked(loadSettings).mockResolvedValueOnce({
        feature_flags: {
          auth_enable_register: true
        }
      } as any);

      // Mock: trackEvent crashea
      mockTrackEvent.mockImplementationOnce(() => {
        throw new Error('Analytics service down');
      });

      mockSignUp.mockResolvedValueOnce({
        data: {
          user: {
            id: 'robust_user',
            email: 'robust@example.com',
            created_at: new Date().toISOString(),
            user_metadata: { role: 'user' }
          },
          session: null
        },
        error: null
      });

      mockInsert.mockResolvedValueOnce({ error: null });

      const { default: app } = await import('../../src/index');

      const res = await request(app).post('/api/v2/auth/register').send({
        email: 'robust@example.com',
        password: 'ValidPassword123'
      });

      // ✅ VALIDAR: Flujo resuelve correctamente AUNQUE analytics crashee
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    it('FLOW: analytics NO incluye PII en eventos', async () => {
      const { loadSettings } = await import('../../src/lib/loadSettings');
      vi.mocked(loadSettings).mockResolvedValueOnce({
        feature_flags: {
          auth_enable_register: true
        }
      } as any);

      mockSignUp.mockResolvedValueOnce({
        data: {
          user: {
            id: 'pii_test_user',
            email: 'sensitive@example.com',
            created_at: new Date().toISOString(),
            user_metadata: { role: 'user' }
          },
          session: null
        },
        error: null
      });

      mockInsert.mockResolvedValueOnce({ error: null });

      const { default: app } = await import('../../src/index');

      const sensitiveEmail = 'sensitive@example.com';
      const sensitivePassword = 'SensitivePassword123';

      await request(app).post('/api/v2/auth/register').send({
        email: sensitiveEmail,
        password: sensitivePassword
      });

      // ✅ VALIDAR: trackEvent NO contiene PII
      expect(mockTrackEvent).toHaveBeenCalled();

      mockTrackEvent.mock.calls.forEach((call) => {
        const stringifiedCall = JSON.stringify(call);
        expect(stringifiedCall).not.toContain(sensitiveEmail);
        expect(stringifiedCall).not.toContain(sensitivePassword);
      });
    });
  });
});
