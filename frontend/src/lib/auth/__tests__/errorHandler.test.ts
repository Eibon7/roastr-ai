import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
    info: vi.fn()
  }
}));

import { toast } from 'sonner';
import { handleAuthError } from '../errorHandler';

describe('handleAuthError (ROA-405 contract: slug-only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles AUTH_INVALID_CREDENTIALS by slug (no status required)', () => {
    const handled = handleAuthError({
      message: 'ignored',
      slug: 'AUTH_INVALID_CREDENTIALS',
      retryable: false
    });

    expect(handled).toBe(true);
    expect(toast.error).toHaveBeenCalled();
  });

  it('handles POLICY_RATE_LIMITED by slug (no status required)', () => {
    const handled = handleAuthError({
      message: 'ignored',
      slug: 'POLICY_RATE_LIMITED',
      retryable: true
    });

    expect(handled).toBe(true);
    expect(toast.warning).toHaveBeenCalled();
  });

  it('redirects to login for TOKEN_EXPIRED by slug (no status required)', () => {
    vi.useFakeTimers();
    const redirectToLogin = vi.fn();

    const handled = handleAuthError(
      {
        message: 'ignored',
        slug: 'TOKEN_EXPIRED',
        retryable: true
      },
      redirectToLogin
    );

    expect(handled).toBe(true);
    expect(window.sessionStorage.getItem('_auth_redirecting')).toBe('true');

    vi.advanceTimersByTime(1100);
    expect(redirectToLogin).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem('_auth_redirecting')).toBeNull();
  });
});

