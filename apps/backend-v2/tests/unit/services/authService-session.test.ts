/**
 * AuthService - session helpers (logout/refresh/getCurrentUser) unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthError, AUTH_ERROR_CODES } from '../../../src/utils/authErrorTaxonomy';

const mockRefreshSession = vi.fn();
const mockGetUser = vi.fn();
const mockAdminSignOut = vi.fn();

vi.mock('../../../src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      refreshSession: mockRefreshSession,
      getUser: mockGetUser,
      admin: {
        signOut: mockAdminSignOut
      }
    }
  }
}));

describe('AuthService session methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logout() retorna sin error si no hay token', async () => {
    const { AuthService } = await import('../../../src/services/authService');
    const svc = new AuthService();

    await expect(svc.logout('')).resolves.toBeUndefined();
    expect(mockAdminSignOut).not.toHaveBeenCalled();
  });

  it('logout() llama a supabase.auth.admin.signOut con token', async () => {
    mockAdminSignOut.mockResolvedValueOnce({ error: null });

    const { AuthService } = await import('../../../src/services/authService');
    const svc = new AuthService();

    await expect(svc.logout('access-token')).resolves.toBeUndefined();
    expect(mockAdminSignOut).toHaveBeenCalledWith('access-token');
  });

  it('refreshSession() calcula expires_at cuando viene undefined', async () => {
    const now = Math.floor(Date.now() / 1000);

    mockRefreshSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'token',
          refresh_token: 'refresh',
          expires_in: 10,
          expires_at: undefined,
          token_type: 'bearer'
        },
        user: {
          id: 'u1',
          email: 'user@example.com',
          email_confirmed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          user_metadata: { role: 'user' }
        }
      },
      error: null
    });

    const { AuthService } = await import('../../../src/services/authService');
    const svc = new AuthService();

    const session = await svc.refreshSession('rt');
    expect(session.expires_at).toBeGreaterThanOrEqual(now);
    expect(session.expires_at).toBeLessThanOrEqual(now + 60);
  });

  it('refreshSession() lanza AuthError si faltan session/user', async () => {
    mockRefreshSession.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: null
    });

    const { AuthService } = await import('../../../src/services/authService');
    const svc = new AuthService();

    await expect(svc.refreshSession('rt')).rejects.toBeInstanceOf(AuthError);
  });

  it('getCurrentUser() lanza AuthError si supabase retorna user null', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null
    });

    const { AuthService } = await import('../../../src/services/authService');
    const svc = new AuthService();

    await expect(svc.getCurrentUser('token')).rejects.toBeInstanceOf(AuthError);
  });

  it('getCurrentUser() mapea user correctamente', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'u1',
          email: 'user@example.com',
          email_confirmed_at: null,
          created_at: new Date().toISOString(),
          user_metadata: { role: 'user' }
        }
      },
      error: null
    });

    const { AuthService } = await import('../../../src/services/authService');
    const svc = new AuthService();

    const user = await svc.getCurrentUser('token');
    expect(user.id).toBe('u1');
    expect(user.email_verified).toBe(false);
    expect(user.role).toBe('user');
  });

  it('getCurrentUser() mapea error de supabase a AuthError', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'invalid jwt' }
    });

    const { AuthService } = await import('../../../src/services/authService');
    const svc = new AuthService();

    await expect(svc.getCurrentUser('token')).rejects.toMatchObject({
      code: AUTH_ERROR_CODES.INVALID_CREDENTIALS
    });
  });
});

