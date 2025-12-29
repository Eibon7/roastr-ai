/**
 * AuthService.login() + requestMagicLink() branch coverage tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSignInWithPassword = vi.fn();
const mockSignInWithOtp = vi.fn();
const mockListUsers = vi.fn();

vi.mock('../../../src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signInWithOtp: mockSignInWithOtp,
      admin: {
        listUsers: mockListUsers,
        signOut: vi.fn()
      }
    }
  }
}));

const mockRateLimitAttempt = vi.fn();
vi.mock('../../../src/services/rateLimitService', () => ({
  rateLimitService: {
    recordAttempt: mockRateLimitAttempt
  }
}));

const mockAbuseAttempt = vi.fn();
vi.mock('../../../src/services/abuseDetectionService', () => ({
  abuseDetectionService: {
    recordAttempt: mockAbuseAttempt
  }
}));

const mockLoadSettings = vi.fn();
vi.mock('../../../src/lib/loadSettings', () => ({
  loadSettings: mockLoadSettings
}));

describe('AuthService login + magic-link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.AUTH_LOGIN_ENABLED = 'true';
  });

  it('login() bloquea si feature flag login.enabled está OFF', async () => {
    mockLoadSettings.mockResolvedValueOnce({
      auth: { login: { enabled: false } }
    });

    const { AuthService } = await import('../../../src/services/authService');
    const svc = new AuthService();

    await expect(
      svc.login({ email: 'user@example.com', password: 'ValidPassword123', ip: '1.1.1.1' })
    ).rejects.toBeInstanceOf(AuthError);
  });

  it('login() bloquea por rate limit', async () => {
    mockLoadSettings.mockResolvedValueOnce({ auth: { login: { enabled: true } } });
    mockRateLimitAttempt.mockReturnValueOnce({ allowed: false, blockedUntil: null });

    const { AuthService } = await import('../../../src/services/authService');
    const svc = new AuthService();

    await expect(
      svc.login({ email: 'user@example.com', password: 'ValidPassword123', ip: '1.1.1.1' })
    ).rejects.toBeInstanceOf(AuthError);
  });

  it('login() bloquea por abuse detection', async () => {
    mockLoadSettings.mockResolvedValueOnce({ auth: { login: { enabled: true } } });
    mockRateLimitAttempt.mockReturnValueOnce({ allowed: true });
    mockAbuseAttempt.mockReturnValueOnce({ isAbuse: true, patterns: ['burst'] });

    const { AuthService } = await import('../../../src/services/authService');
    const svc = new AuthService();

    await expect(
      svc.login({ email: 'user@example.com', password: 'ValidPassword123', ip: '1.1.1.1' })
    ).rejects.toBeInstanceOf(AuthError);
  });

  it('login() retorna sesión en éxito y normaliza expires_at cuando viene string', async () => {
    mockLoadSettings.mockResolvedValueOnce({ auth: { login: { enabled: true } } });
    mockRateLimitAttempt.mockReturnValueOnce({ allowed: true });
    mockAbuseAttempt.mockReturnValueOnce({ isAbuse: false, patterns: [] });

    mockSignInWithPassword.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'token',
          refresh_token: 'refresh',
          expires_in: 3600,
          expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
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

    const session = await svc.login({
      email: 'user@example.com',
      password: 'ValidPassword123',
      ip: '1.1.1.1'
    });
    expect(session.access_token).toBe('token');
    expect(session.expires_at).toBeGreaterThan(0);
  });

  it('requestMagicLink() retorna mensaje neutro si no encuentra usuario', async () => {
    mockRateLimitAttempt.mockReturnValueOnce({ allowed: true });
    mockListUsers.mockResolvedValueOnce({ data: { users: [] }, error: null });

    const { AuthService } = await import('../../../src/services/authService');
    const svc = new AuthService();

    const res = await svc.requestMagicLink({ email: 'user@example.com', ip: '1.1.1.1' });
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/if this email exists/i);
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });

  it('requestMagicLink() retorna mensaje neutro si role es admin', async () => {
    mockRateLimitAttempt.mockReturnValueOnce({ allowed: true });
    mockListUsers.mockResolvedValueOnce({
      data: { users: [{ email: 'user@example.com', user_metadata: { role: 'admin' } }] },
      error: null
    });

    const { AuthService } = await import('../../../src/services/authService');
    const svc = new AuthService();

    const res = await svc.requestMagicLink({ email: 'user@example.com', ip: '1.1.1.1' });
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/if this email exists/i);
  });

  it('requestMagicLink() envía OTP si role=user', async () => {
    mockRateLimitAttempt.mockReturnValueOnce({ allowed: true });
    mockListUsers.mockResolvedValueOnce({
      data: { users: [{ email: 'user@example.com', user_metadata: { role: 'user' } }] },
      error: null
    });
    mockSignInWithOtp.mockResolvedValueOnce({ error: null });

    const { AuthService } = await import('../../../src/services/authService');
    const svc = new AuthService();

    const res = await svc.requestMagicLink({ email: 'user@example.com', ip: '1.1.1.1' });
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/magic link sent/i);
    expect(mockSignInWithOtp).toHaveBeenCalled();
  });
});
