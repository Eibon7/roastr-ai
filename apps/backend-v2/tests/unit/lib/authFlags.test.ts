/**
 * Unit Tests for AuthFlags Loader (ROA-406)
 *
 * Tests the fail-closed behavior and SSOT v2 compliance:
 * - Defaults to false (fail-closed)
 * - NO environment variable fallbacks
 * - Single source of truth: SettingsLoader v2
 * - Throws AuthError when endpoint disabled
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadAuthFlags, isAuthEndpointEnabled } from '../../../src/lib/authFlags.js';
import { AuthError, AUTH_ERROR_CODES } from '../../../src/utils/authErrorTaxonomy.js';
import { loadSettings } from '../../../src/lib/loadSettings.js';
import { logger } from '../../../src/utils/logger.js';
import { trackEvent } from '../../../src/lib/analytics.js';

// Mock loadSettings
vi.mock('../../../src/lib/loadSettings', () => ({
  loadSettings: vi.fn()
}));

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}));

// Mock analytics
vi.mock('../../../src/lib/analytics', () => ({
  trackEvent: vi.fn()
}));

describe('AuthFlags Loader (ROA-406)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Limpiar variables de entorno para asegurar que no haya fallbacks
    delete process.env.AUTH_LOGIN_ENABLED;
    delete process.env.AUTH_REGISTER_ENABLED;
    delete process.env.AUTH_MAGIC_LINK_ENABLED;
    delete process.env.AUTH_PASSWORD_RECOVERY_ENABLED;
  });

  describe('loadAuthFlags', () => {
    it('devuelve defaults fail-closed cuando settings NO define flags', async () => {
      vi.mocked(loadSettings).mockResolvedValueOnce({ feature_flags: {} } as any);

      const flags = await loadAuthFlags();

      expect(flags).toEqual({
        auth_enable_emails: false,
        auth_enable_login: false,
        auth_enable_register: false,
        auth_enable_magic_link: false,
        auth_enable_password_recovery: false
      });
    });

    it('devuelve defaults fail-closed cuando loadSettings falla', async () => {
      vi.mocked(loadSettings).mockRejectedValueOnce(new Error('DB error'));

      const flags = await loadAuthFlags();

      expect(flags).toEqual({
        auth_enable_emails: false,
        auth_enable_login: false,
        auth_enable_register: false,
        auth_enable_magic_link: false,
        auth_enable_password_recovery: false
      });
      expect(logger.error).toHaveBeenCalledOnce();
    });

    it('carga flags correctamente cuando están definidos en settings', async () => {
      vi.mocked(loadSettings).mockResolvedValueOnce({
        feature_flags: {
          auth_enable_emails: true,
          auth_enable_login: true,
          auth_enable_register: false,
          auth_enable_magic_link: true,
          auth_enable_password_recovery: false
        }
      } as any);

      const flags = await loadAuthFlags();

      expect(flags).toEqual({
        auth_enable_emails: true,
        auth_enable_login: true,
        auth_enable_register: false,
        auth_enable_magic_link: true,
        auth_enable_password_recovery: false
      });
    });

    it('NO usa env vars como fallback (SSOT v2 enforcement)', async () => {
      // Intentar usar env vars (que deben ser ignoradas)
      process.env.AUTH_LOGIN_ENABLED = 'true';
      process.env.AUTH_REGISTER_ENABLED = 'true';

      vi.mocked(loadSettings).mockResolvedValueOnce({ feature_flags: {} } as any);

      const flags = await loadAuthFlags();

      // Sigue siendo false por default fail-closed, NO usa env vars
      expect(flags.auth_enable_login).toBe(false);
      expect(flags.auth_enable_register).toBe(false);
    });
  });

  describe('isAuthEndpointEnabled', () => {
    it('devuelve true si el flag está activo', async () => {
      vi.mocked(loadSettings).mockResolvedValueOnce({
        feature_flags: { auth_enable_login: true }
      } as any);

      await expect(isAuthEndpointEnabled('auth_enable_login', 'login_policy')).resolves.toBe(true);
    });

    it('lanza AuthError si el flag está inactivo', async () => {
      vi.mocked(loadSettings).mockResolvedValueOnce({
        feature_flags: { auth_enable_login: false }
      } as any);

      await expect(isAuthEndpointEnabled('auth_enable_login', 'login_policy')).rejects.toThrow(
        AuthError
      );
      await expect(
        isAuthEndpointEnabled('auth_enable_login', 'login_policy')
      ).rejects.toHaveProperty('slug', AUTH_ERROR_CODES.AUTH_DISABLED);
    });

    it('lanza AuthError si loadAuthFlags falla (fail-closed)', async () => {
      vi.mocked(loadSettings).mockRejectedValueOnce(new Error('Network error'));

      await expect(isAuthEndpointEnabled('auth_enable_login', 'login_policy')).rejects.toThrow(
        AuthError
      );
      await expect(
        isAuthEndpointEnabled('auth_enable_login', 'login_policy')
      ).rejects.toHaveProperty('slug', AUTH_ERROR_CODES.AUTH_DISABLED);
    });

    it('valida todos los auth flags correctamente', async () => {
      vi.mocked(loadSettings).mockResolvedValue({
        feature_flags: {
          auth_enable_emails: true,
          auth_enable_login: true,
          auth_enable_register: true,
          auth_enable_magic_link: true,
          auth_enable_password_recovery: true
        }
      } as any);

      await expect(isAuthEndpointEnabled('auth_enable_login', 'login_policy')).resolves.toBe(true);
      await expect(isAuthEndpointEnabled('auth_enable_register', 'register_policy')).resolves.toBe(
        true
      );
      await expect(
        isAuthEndpointEnabled('auth_enable_magic_link', 'magic_link_policy')
      ).resolves.toBe(true);
      await expect(
        isAuthEndpointEnabled('auth_enable_password_recovery', 'password_recovery_policy')
      ).resolves.toBe(true);
    });

    it('llama a trackEvent cuando un endpoint es bloqueado (ROA-406 observability)', async () => {
      vi.mocked(loadSettings).mockResolvedValue({
        feature_flags: {
          auth_enable_login: false
        }
      } as any);

      await expect(isAuthEndpointEnabled('auth_enable_login', 'login_policy')).rejects.toThrow(
        AuthError
      );

      expect(trackEvent).toHaveBeenCalledWith({
        event: 'auth_feature_blocked',
        properties: {
          flag: 'auth_enable_login',
          policy: 'login_policy',
          endpoint: 'login_policy'
        },
        context: {
          flow: 'auth'
        }
      });
    });
  });
});
