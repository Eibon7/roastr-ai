/**
 * E2E Test: Expired Access Token Handling
 *
 * PRIORITY 1 - Tests 401 retry with expired token
 *
 * Verifies:
 * - 401 detected on expired token
 * - Refresh token called exactly once
 * - Original request retried exactly once (max 1 retry)
 * - No infinite retry loops
 * - Retry blocked if refresh fails
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clearTokens, setTokens } from '@/lib/auth/tokenStorage';
import { apiClient } from '@/lib/api';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('E2E: Expired Access Token Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTokens();
    
    // Setup localStorage mock
    localStorage.clear();
  });

  afterEach(() => {
    clearTokens();
    localStorage.clear();
  });

  it('should refresh token and retry request on 401', async () => {
    // Setup: Login successfully
    const accessToken = 'expired-access-token';
    const refreshToken = 'valid-refresh-token';
    setTokens(accessToken, refreshToken);

    // Mock: First request returns 401 (expired token)
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token expired'
        }
      })
    });

    // Mock: Refresh token call succeeds
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        session: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          expires_at: Date.now() + 3600000,
          token_type: 'bearer'
        },
        message: 'Token refreshed successfully'
      })
    });

    // Mock: Retry request succeeds with new token
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: { message: 'Request successful' }
      })
    });

    // Execute: Make authenticated request
    const result = await apiClient.get('/api/protected-endpoint');

    // Assertions
    expect(mockFetch).toHaveBeenCalledTimes(3); // Original + refresh + retry
    
    // Verify refresh was called with correct endpoint
    const refreshCall = mockFetch.mock.calls.find(
      call => call[0].includes('/v2/auth/refresh')
    );
    expect(refreshCall).toBeDefined();
    expect(refreshCall[1].body).toContain('valid-refresh-token');
    
    // Verify retry was called with new token
    const retryCall = mockFetch.mock.calls.find(
      (call, index) => index > 0 && call[0].includes('/api/protected-endpoint')
    );
    expect(retryCall).toBeDefined();
    expect(retryCall[1].headers['Authorization']).toBe('Bearer new-access-token');
    
    // Verify result
    expect(result).toEqual({ success: true, data: { message: 'Request successful' } });
    
    // Verify tokens updated in localStorage
    expect(localStorage.getItem('auth_token')).toBe('new-access-token');
    expect(localStorage.getItem('refresh_token')).toBe('new-refresh-token');
  });

  it('should not retry if refresh fails', async () => {
    // Setup: Login successfully
    const accessToken = 'expired-access-token';
    const refreshToken = 'invalid-refresh-token';
    setTokens(accessToken, refreshToken);

    // Mock: First request returns 401
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token expired'
        }
      })
    });

    // Mock: Refresh token call fails
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        error: {
          code: 'TOKEN_INVALID',
          message: 'Invalid refresh token'
        }
      })
    });

    // Execute: Make authenticated request (should fail)
    await expect(apiClient.get('/api/protected-endpoint')).rejects.toThrow();

    // Assertions
    expect(mockFetch).toHaveBeenCalledTimes(2); // Original + refresh (no retry)
    
    // Verify refresh was called
    const refreshCall = mockFetch.mock.calls.find(
      call => call[0].includes('/v2/auth/refresh')
    );
    expect(refreshCall).toBeDefined();
    
    // Verify no retry was made
    const retryCalls = mockFetch.mock.calls.filter(
      (call, index) => index > 1 && call[0].includes('/api/protected-endpoint')
    );
    expect(retryCalls).toHaveLength(0);
    
    // Verify tokens cleared on refresh failure
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  it('should not retry more than once (max 1 retry)', async () => {
    // Setup: Login successfully
    const accessToken = 'expired-access-token';
    const refreshToken = 'valid-refresh-token';
    setTokens(accessToken, refreshToken);

    // Mock: First request returns 401
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token expired'
        }
      })
    });

    // Mock: Refresh token call succeeds
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        session: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          expires_at: Date.now() + 3600000,
          token_type: 'bearer'
        },
        message: 'Token refreshed successfully'
      })
    });

    // Mock: Retry request also returns 401 (should NOT retry again)
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token expired'
        }
      })
    });

    // Execute: Make authenticated request (should fail after retry)
    await expect(apiClient.get('/api/protected-endpoint')).rejects.toThrow();

    // Assertions
    expect(mockFetch).toHaveBeenCalledTimes(3); // Original + refresh + retry (no second retry)
    
    // Verify only one retry was made
    const retryCalls = mockFetch.mock.calls.filter(
      (call, index) => index > 1 && call[0].includes('/api/protected-endpoint')
    );
    expect(retryCalls).toHaveLength(1); // Only one retry, no infinite loop
  });

  it('should not retry for auth endpoints', async () => {
    // Setup: No tokens (anonymous request)
    clearTokens();

    // Mock: Auth endpoint returns 401 (should NOT retry)
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      })
    });

    // Execute: Make auth request (should fail immediately, no retry)
    await expect(apiClient.post('/auth/login', { email: 'test@example.com', password: 'wrong' })).rejects.toThrow();

    // Assertions
    expect(mockFetch).toHaveBeenCalledTimes(1); // Only original request, no refresh, no retry
    
    // Verify refresh was NOT called
    const refreshCall = mockFetch.mock.calls.find(
      call => call[0].includes('/v2/auth/refresh')
    );
    expect(refreshCall).toBeUndefined();
  });
});

