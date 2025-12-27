/**
 * AuthService.register() - Unit Tests v2 (ROA-374)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthError } from '../../../src/utils/authErrorTaxonomy';

const mockSignUp = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock('../../../src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signUp: mockSignUp
    },
    from: mockFrom
  }
}));

describe('AuthService.register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});

