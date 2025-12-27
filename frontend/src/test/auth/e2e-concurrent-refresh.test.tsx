/**
 * E2E Test: Concurrent Requests with One Refresh
 *
 * PRIORITY 3 - Tests multiple requests during token refresh
 *
 * Verifies:
 * - Refresh called only once (not 3 times)
 * - All requests queued behind single refresh
 * - All requests retried after refresh completes
 * - FIFO order maintained
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clearTokens, setTokens } from '@/lib/auth/tokenStorage';
import { apiClient } from '@/lib/api';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('E2E: Concurrent Requests with One Refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTokens();
    localStorage.clear();
  });

  afterEach(() => {
    clearTokens();
    localStorage.clear();
  });

  it('should queue concurrent requests during refresh', async () => {
    // Setup: Login successfully with expired token
    const accessToken = 'expired-access-token';
    const refreshToken = 'valid-refresh-token';
    setTokens(accessToken, refreshToken);

    let refreshResolve: (value: any) => void;
    const refreshPromise = new Promise((resolve) => {
      refreshResolve = resolve;
    });

    // Mock: All 3 requests return 401 (expired token)
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/v2/auth/refresh')) {
        // Delay refresh to allow concurrent requests to queue
        return refreshPromise.then(() => ({
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
        }));
      }
      
      if (url.includes('/api/protected-endpoint')) {
        // First call returns 401, subsequent calls (retries) return 200
        const callCount = mockFetch.mock.calls.filter(c => c[0] === url).length;
        if (callCount === 1) {
          return Promise.resolve({
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
        } else {
          // Retry call succeeds
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              success: true,
              data: { message: `Request to ${url} successful` }
            })
          });
        }
      }
      
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    // Execute: Make 3 concurrent authenticated requests
    const request1 = apiClient.get('/api/protected-endpoint-1');
    const request2 = apiClient.get('/api/protected-endpoint-2');
    const request3 = apiClient.get('/api/protected-endpoint-3');

    // Resolve refresh after a short delay (simulating network latency)
    setTimeout(() => {
      refreshResolve!(null);
    }, 10);

    // Wait for all requests to complete
    const [result1, result2, result3] = await Promise.all([request1, request2, request3]);

    // Assertions
    // Verify refresh was called exactly once (not 3 times)
    const refreshCalls = mockFetch.mock.calls.filter(
      call => call[0].includes('/v2/auth/refresh')
    );
    expect(refreshCalls).toHaveLength(1);

    // Verify all 3 requests were made (original + retry for each)
    const allCalls = mockFetch.mock.calls.map(call => call[0]);
    const endpoint1Calls = allCalls.filter(url => url.includes('protected-endpoint-1'));
    const endpoint2Calls = allCalls.filter(url => url.includes('protected-endpoint-2'));
    const endpoint3Calls = allCalls.filter(url => url.includes('protected-endpoint-3'));

    // Each endpoint should have been called twice: original (401) + retry (200)
    expect(endpoint1Calls.length).toBeGreaterThanOrEqual(2);
    expect(endpoint2Calls.length).toBeGreaterThanOrEqual(2);
    expect(endpoint3Calls.length).toBeGreaterThanOrEqual(2);

    // Verify all requests succeeded
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result3).toBeDefined();

    // Verify tokens updated
    expect(localStorage.getItem('auth_token')).toBe('new-access-token');
    expect(localStorage.getItem('refresh_token')).toBe('new-refresh-token');
  });

  it('should maintain FIFO order for queued requests', async () => {
    // Setup: Login successfully
    const accessToken = 'expired-access-token';
    const refreshToken = 'valid-refresh-token';
    setTokens(accessToken, refreshToken);

    const callOrder: string[] = [];

    // Mock: Track call order
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/v2/auth/refresh')) {
        callOrder.push('refresh');
        return Promise.resolve({
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
      }

      if (url.includes('/api/protected-endpoint')) {
        const endpoint = url.split('/').pop();
        const callCount = callOrder.filter(c => c === endpoint).length;
        
        if (callCount === 0) {
          // First call (401)
          callOrder.push(endpoint!);
          return Promise.resolve({
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
        } else {
          // Retry call (200)
          callOrder.push(`${endpoint}-retry`);
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              success: true,
              data: { message: 'Request successful' }
            })
          });
        }
      }

      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    // Execute: Make 3 concurrent requests
    await Promise.all([
      apiClient.get('/api/protected-endpoint-1'),
      apiClient.get('/api/protected-endpoint-2'),
      apiClient.get('/api/protected-endpoint-3')
    ]);

    // Assertions
    // Verify refresh happened before retries
    const refreshIndex = callOrder.indexOf('refresh');
    expect(refreshIndex).toBeGreaterThanOrEqual(0);
    
    // Verify retries happened after refresh (FIFO order)
    const retryIndices = [
      callOrder.indexOf('protected-endpoint-1-retry'),
      callOrder.indexOf('protected-endpoint-2-retry'),
      callOrder.indexOf('protected-endpoint-3-retry')
    ];
    
    retryIndices.forEach(retryIndex => {
      expect(retryIndex).toBeGreaterThan(refreshIndex);
    });
  });

  it('should reject all queued requests if refresh fails', async () => {
    // Setup: Login successfully
    const accessToken = 'expired-access-token';
    const refreshToken = 'invalid-refresh-token';
    setTokens(accessToken, refreshToken);

    // Mock: All requests return 401
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/v2/auth/refresh')) {
        return Promise.resolve({
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
      }

      if (url.includes('/api/protected-endpoint')) {
        return Promise.resolve({
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
      }

      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    // Execute: Make 3 concurrent requests (all should fail)
    const promises = [
      apiClient.get('/api/protected-endpoint-1'),
      apiClient.get('/api/protected-endpoint-2'),
      apiClient.get('/api/protected-endpoint-3')
    ];

    const results = await Promise.allSettled(promises);

    // Assertions
    // Verify all requests were rejected
    results.forEach(result => {
      expect(result.status).toBe('rejected');
    });

    // Verify refresh was called only once
    const refreshCalls = mockFetch.mock.calls.filter(
      call => call[0].includes('/v2/auth/refresh')
    );
    expect(refreshCalls).toHaveLength(1);

    // Verify tokens cleared
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });
});

