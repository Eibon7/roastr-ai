/**
 * AuthService.register() - Unit Tests v2 (ROA-374)
 * + B3: Register Analytics Implementation (ROA-376)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthError } from '../../../src/utils/authErrorTaxonomy';

const mockSignUp = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));
const mockTrackEvent = vi.fn();
const mockAssertAuthEmailInfrastructureEnabled = vi.fn();

vi.mock('../../../src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signUp: mockSignUp
    },
    from: mockFrom
  }
}));

vi.mock('../../../src/lib/analytics', () => ({
  trackEvent: mockTrackEvent
}));

// ROA-409: AuthService.register now requires auth email infra preflight.
// In register unit tests we mock this dependency to keep tests focused on register logic.
vi.mock('../../../src/services/authEmailService', () => ({
  assertAuthEmailInfrastructureEnabled: mockAssertAuthEmailInfrastructureEnabled,
  sendPasswordRecoveryEmailAfterPreflight: vi.fn()
}));

describe('AuthService.register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertAuthEmailInfrastructureEnabled.mockResolvedValue({ provider: 'resend' });
  });

  it('rechaza email inválido con AuthError', async () => {
    const { AuthService } = await import('../../../src/services/authService');
    const svc = new AuthService();

    await expect(
      svc.register({
        email: 'not-an-email',
        password: 'ValidPassword123'
      })
    ).rejects.toBeInstanceOf(AuthError);
  });

  it('rechaza password corto con AuthError', async () => {
    const { AuthService } = await import('../../../src/services/authService');
    const svc = new AuthService();

    await expect(
      svc.register({
        email: 'user@example.com',
        password: 'short'
      })
    ).rejects.toBeInstanceOf(AuthError);
  });

  it('anti-enumeration: si Supabase dice "already registered", retorna éxito silencioso', async () => {
    const { AuthService } = await import('../../../src/services/authService');
    const svc = new AuthService();

    mockSignUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'User already registered' }
    });

    await expect(
      svc.register({
        email: 'user@example.com',
        password: 'ValidPassword123'
      })
    ).resolves.toBeUndefined();

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('crea perfil mínimo cuando el signup retorna user.id', async () => {
    const { AuthService } = await import('../../../src/services/authService');
    const svc = new AuthService();

    mockSignUp.mockResolvedValueOnce({
      data: {
        user: { id: 'u1' },
        session: null
      },
      error: null
    });
    mockInsert.mockResolvedValueOnce({ error: null });

    await expect(
      svc.register({
        email: 'USER@EXAMPLE.COM',
        password: 'ValidPassword123'
      })
    ).resolves.toBeUndefined();

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        username: 'user@example.com',
        onboarding_state: 'welcome'
      })
    );
  });

  it('no falla si el insert del perfil devuelve error (best-effort)', async () => {
    const { AuthService } = await import('../../../src/services/authService');
    const svc = new AuthService();

    mockSignUp.mockResolvedValueOnce({
      data: {
        user: { id: 'u1' },
        session: null
      },
      error: null
    });
    mockInsert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key' } });

    await expect(
      svc.register({
        email: 'user@example.com',
        password: 'ValidPassword123'
      })
    ).resolves.toBeUndefined();
  });

  // ============================================
  // B3: Register Analytics Tests (ROA-376)
  // ============================================

  describe('Analytics Integration', () => {
    it('trackea "auth_register_success" cuando el registro es exitoso', async () => {
      const { AuthService } = await import('../../../src/services/authService');
      const svc = new AuthService();

      mockSignUp.mockResolvedValueOnce({
        data: {
          user: { id: 'u_analytics_1' },
          session: null
        },
        error: null
      });
      mockInsert.mockResolvedValueOnce({ error: null });

      await svc.register({
        email: 'analytics@example.com',
        password: 'ValidPassword123'
      });

      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u_analytics_1',
          event: 'auth_register_success',
          properties: expect.objectContaining({
            method: 'email_password'
          }),
          context: expect.objectContaining({
            flow: 'auth'
          })
        })
      );
    });

    it('trackea "auth_register_failed" cuando hay error de validación', async () => {
      const { AuthService } = await import('../../../src/services/authService');
      const svc = new AuthService();

      try {
        await svc.register({
          email: 'invalid-email',
          password: 'ValidPassword123'
        });
      } catch {
        // Expected to fail
      }

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
    });

    it('trackea "auth_register_failed" cuando Supabase falla', async () => {
      const { AuthService } = await import('../../../src/services/authService');
      const svc = new AuthService();

      mockSignUp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Database connection failed' }
      });

      try {
        await svc.register({
          email: 'test@example.com',
          password: 'ValidPassword123'
        });
      } catch {
        // Expected to fail
      }

      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'auth_register_failed',
          properties: expect.objectContaining({
            error_slug: expect.any(String),
            method: 'email_password'
          })
        })
      );
    });

    it('NO trackea PII (email, password) en eventos de analytics', async () => {
      const { AuthService } = await import('../../../src/services/authService');
      const svc = new AuthService();

      mockSignUp.mockResolvedValueOnce({
        data: {
          user: { id: 'u_pii_test' },
          session: null
        },
        error: null
      });
      mockInsert.mockResolvedValueOnce({ error: null });

      const sensitiveEmail = 'sensitive@example.com';
      const sensitivePassword = 'SuperSecret123';

      await svc.register({
        email: sensitiveEmail,
        password: sensitivePassword
      });

      // Verificar que trackEvent NO contiene PII
      expect(mockTrackEvent).toHaveBeenCalled();
      const callArgs = mockTrackEvent.mock.calls[0][0];
      const stringifiedCall = JSON.stringify(callArgs);

      expect(stringifiedCall).not.toContain(sensitiveEmail);
      expect(stringifiedCall).not.toContain(sensitivePassword);
    });

    it('incluye "profile_created" en success event', async () => {
      const { AuthService } = await import('../../../src/services/authService');
      const svc = new AuthService();

      mockSignUp.mockResolvedValueOnce({
        data: {
          user: { id: 'u_profile_test' },
          session: null
        },
        error: null
      });
      mockInsert.mockResolvedValueOnce({ error: null });

      await svc.register({
        email: 'profile@example.com',
        password: 'ValidPassword123'
      });

      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            profile_created: true
          })
        })
      );
    });

    it('marca "profile_created: false" cuando el perfil falla', async () => {
      const { AuthService } = await import('../../../src/services/authService');
      const svc = new AuthService();

      mockSignUp.mockResolvedValueOnce({
        data: {
          user: { id: 'u_no_profile' },
          session: null
        },
        error: null
      });
      mockInsert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate' } });

      await svc.register({
        email: 'noprofile@example.com',
        password: 'ValidPassword123'
      });

      expect(mockTrackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            profile_created: false
          })
        })
      );
    });
  });
});
