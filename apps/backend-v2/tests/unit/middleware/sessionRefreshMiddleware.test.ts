/**
 * Session Refresh Middleware Tests
 *
 * Tests mínimos de infraestructura:
 * - Token válido → continúa
 * - Token expirado + refresh OK → continúa
 * - Token expirado + refresh falla → permite que requireAuth maneje
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sessionRefresh } from '../../../src/middleware/sessionRefresh';
import { authService } from '../../../src/services/authService';
import { AuthError, AUTH_ERROR_CODES } from '../../../src/utils/authErrorTaxonomy';

// Mock authService
vi.mock('../../../src/services/authService', () => ({
  authService: {
    getCurrentUser: vi.fn(),
    refreshSession: vi.fn()
  }
}));

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('sessionRefresh Middleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      headers: {},
      cookies: {},
      body: {}
    };
    res = {};
    next = vi.fn();
  });

  it('should continue without auth header', async () => {
    await sessionRefresh(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });

  it('should continue with valid token', async () => {
    req.headers.authorization = 'Bearer valid-token';

    vi.mocked(authService.getCurrentUser).mockResolvedValueOnce({
      id: 'user-123',
      email: 'test@example.com',
      role: 'user',
      email_verified: true
    });

    await sessionRefresh(req, res, next);

    expect(req.user).toEqual({
      id: 'user-123',
      email: 'test@example.com',
      role: 'user',
      email_verified: true
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it('should refresh expired token if refresh token available', async () => {
    req.headers.authorization = 'Bearer expired-token';
    req.headers['x-refresh-token'] = 'valid-refresh-token';

    // First call: token expired
    vi.mocked(authService.getCurrentUser).mockRejectedValueOnce(
      new AuthError(AUTH_ERROR_CODES.TOKEN_EXPIRED)
    );

    // Refresh succeeds
    vi.mocked(authService.refreshSession).mockResolvedValueOnce({
      access_token: 'new-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600,
      expires_at: Date.now() / 1000 + 3600,
      token_type: 'bearer',
      user: {
        id: 'user-123',
        email: 'test@example.com',
        role: 'user',
        email_verified: true
      }
    });

    await sessionRefresh(req, res, next);

    expect(req.user).toEqual({
      id: 'user-123',
      email: 'test@example.com',
      role: 'user',
      email_verified: true
    });
    expect((req as any).newSession).toBeDefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it('should continue if token expired but no refresh token', async () => {
    req.headers.authorization = 'Bearer expired-token';
    // No refresh token available

    vi.mocked(authService.getCurrentUser).mockRejectedValueOnce(
      new AuthError(AUTH_ERROR_CODES.TOKEN_EXPIRED)
    );

    await sessionRefresh(req, res, next);

    // Should continue, letting requireAuth handle
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });

  it('should continue if refresh fails', async () => {
    req.headers.authorization = 'Bearer expired-token';
    req.headers['x-refresh-token'] = 'invalid-refresh-token';

    // Token expired
    vi.mocked(authService.getCurrentUser).mockRejectedValueOnce(
      new AuthError(AUTH_ERROR_CODES.TOKEN_EXPIRED)
    );

    // Refresh fails
    vi.mocked(authService.refreshSession).mockRejectedValueOnce(
      new AuthError(AUTH_ERROR_CODES.TOKEN_INVALID)
    );

    await sessionRefresh(req, res, next);

    // Should continue, letting requireAuth handle
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });

  it('should continue on unexpected errors', async () => {
    req.headers.authorization = 'Bearer token';

    vi.mocked(authService.getCurrentUser).mockRejectedValueOnce(new Error('Unexpected error'));

    await sessionRefresh(req, res, next);

    // Fail-open: continue on unexpected errors
    expect(next).toHaveBeenCalledOnce();
  });
});
