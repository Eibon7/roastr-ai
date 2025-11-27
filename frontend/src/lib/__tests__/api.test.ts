import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient, adminApi } from '../api';

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    // Reset localStorage mock to store values
    const storage: Record<string, string> = {};
    (global.localStorage.getItem as any) = vi.fn((key: string) => storage[key] || null);
    (global.localStorage.setItem as any) = vi.fn((key: string, value: string) => {
      storage[key] = value;
    });
    (global.localStorage.removeItem as any) = vi.fn((key: string) => {
      delete storage[key];
    });
    (global.localStorage.clear as any) = vi.fn(() => {
      Object.keys(storage).forEach(key => delete storage[key]);
    });
  });

  it('includes auth token in requests', async () => {
    localStorage.setItem('auth_token', 'test-token-123');

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
      headers: new Headers({ 'content-type': 'application/json' })
    });
    global.fetch = mockFetch;

    await apiClient.get('/test');

    expect(global.fetch).toHaveBeenCalled();
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toContain('/test');
    
    // Headers might be a Headers object or plain object
    const headersArg = callArgs[1]?.headers;
    let headers: Record<string, string>;
    if (headersArg instanceof Headers) {
      headers = Object.fromEntries(headersArg.entries());
    } else {
      headers = headersArg as Record<string, string>;
    }
    
    expect(headers).toHaveProperty('Authorization');
    expect(headers?.Authorization).toBe('Bearer test-token-123');
  });

  it('includes CSRF token in POST requests', async () => {
    // Mock cookie
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'csrf-token=test-csrf-token-123'
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
      headers: new Headers({ 'content-type': 'application/json' })
    });

    await apiClient.post('/test', { data: 'test' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-CSRF-Token': 'test-csrf-token-123'
        }),
        credentials: 'include'
      })
    );
  });

  it('handles API errors correctly', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Server error' } }),
      headers: new Headers({ 'content-type': 'application/json' })
    });

    await expect(apiClient.get('/test')).rejects.toThrow();
  });
});

describe('Admin API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    localStorage.setItem('auth_token', 'test-token');
  });

  it('fetches users list', async () => {
    const mockUsers = {
      success: true,
      data: {
        users: [{ id: '1', email: 'test@example.com' }],
        pagination: { total: 1, page: 1 }
      }
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockUsers,
      headers: new Headers({ 'content-type': 'application/json' })
    });

    const result = await adminApi.getUsers({ page: 1, limit: 10 });

    expect(result.success).toBe(true);
    expect(result.data.users).toHaveLength(1);
  });

  it('fetches feature flags', async () => {
    const mockFlags = {
      success: true,
      data: {
        flags: [{ flag_key: 'TEST_FLAG', is_enabled: true }],
        totalCount: 1
      }
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockFlags,
      headers: new Headers({ 'content-type': 'application/json' })
    });

    const result = await adminApi.getFeatureFlags();

    expect(result.success).toBe(true);
    expect(result.data.flags).toHaveLength(1);
  });
});
