/**
 * Auth Feature Flags Tests (ROA-406)
 * 
 * Valida el contrato A2:
 * - Fail-closed: todos los flags default = false
 * - SSOT v2 única fuente de verdad (no env var fallback)
 * - Si loadSettings falla → devuelve defaults (todos false)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock loadSettings
vi.mock('../../../src/lib/loadSettings', () => ({
  loadSettings: vi.fn()
}));

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

import { loadAuthFlags, isAuthEndpointEnabled } from '../../../src/lib/authFlags.js';
import { loadSettings } from '../../../src/lib/loadSettings.js';

describe('loadAuthFlags (ROA-406)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve todos false cuando settings NO define feature_flags', async () => {
    vi.mocked(loadSettings).mockResolvedValueOnce({} as any);

    const flags = await loadAuthFlags();

    expect(flags).toEqual({
      auth_enable_login: false,
      auth_enable_register: false,
      auth_enable_magic_link: false,
      auth_enable_password_recovery: false
    });
  });

  it('devuelve valores desde SSOT cuando están definidos', async () => {
    vi.mocked(loadSettings).mockResolvedValueOnce({
      feature_flags: {
        auth_enable_login: true,
        auth_enable_register: true,
        auth_enable_magic_link: false,
        auth_enable_password_recovery: false
      }
    } as any);

    const flags = await loadAuthFlags();

    expect(flags).toEqual({
      auth_enable_login: true,
      auth_enable_register: true,
      auth_enable_magic_link: false,
      auth_enable_password_recovery: false
    });
  });

  it('devuelve defaults fail-closed cuando loadSettings falla', async () => {
    vi.mocked(loadSettings).mockRejectedValueOnce(new Error('Database connection failed'));

    const flags = await loadAuthFlags();

    expect(flags).toEqual({
      auth_enable_login: false,
      auth_enable_register: false,
      auth_enable_magic_link: false,
      auth_enable_password_recovery: false
    });
  });

  it('usa false como default para flags no definidos (fail-closed)', async () => {
    vi.mocked(loadSettings).mockResolvedValueOnce({
      feature_flags: {
        auth_enable_login: true
        // Los demás NO están definidos
      }
    } as any);

    const flags = await loadAuthFlags();

    expect(flags).toEqual({
      auth_enable_login: true,
      auth_enable_register: false, // Default fail-closed
      auth_enable_magic_link: false, // Default fail-closed
      auth_enable_password_recovery: false // Default fail-closed
    });
  });

  it('NO usa env vars como fallback (SSOT única fuente de verdad)', async () => {
    // Intenta contaminar con env vars
    process.env.AUTH_LOGIN_ENABLED = 'true';
    process.env.AUTH_MAGIC_LINK_ENABLED = 'true';

    vi.mocked(loadSettings).mockResolvedValueOnce({
      feature_flags: {}
    } as any);

    const flags = await loadAuthFlags();

    // Debe ignorar env vars y usar defaults (false)
    expect(flags).toEqual({
      auth_enable_login: false,
      auth_enable_register: false,
      auth_enable_magic_link: false,
      auth_enable_password_recovery: false
    });

    // Cleanup
    delete process.env.AUTH_LOGIN_ENABLED;
    delete process.env.AUTH_MAGIC_LINK_ENABLED;
  });
});

describe('isAuthEndpointEnabled (ROA-406)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve true solo si el flag está habilitado en SSOT', async () => {
    vi.mocked(loadSettings).mockResolvedValue({
      feature_flags: {
        auth_enable_login: true,
        auth_enable_register: false,
        auth_enable_magic_link: false,
        auth_enable_password_recovery: false
      }
    } as any);

    expect(await isAuthEndpointEnabled('login')).toBe(true);
    expect(await isAuthEndpointEnabled('register')).toBe(false);
    expect(await isAuthEndpointEnabled('magic_link')).toBe(false);
    expect(await isAuthEndpointEnabled('password_recovery')).toBe(false);
  });

  it('devuelve false si loadSettings falla (fail-closed)', async () => {
    vi.mocked(loadSettings).mockRejectedValue(new Error('Network error'));

    expect(await isAuthEndpointEnabled('login')).toBe(false);
    expect(await isAuthEndpointEnabled('register')).toBe(false);
    expect(await isAuthEndpointEnabled('magic_link')).toBe(false);
    expect(await isAuthEndpointEnabled('password_recovery')).toBe(false);
  });
});

