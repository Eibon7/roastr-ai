import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../auth-context';
import { authApi } from '../api';

// Mock the API module
vi.mock('../api', () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    logout: vi.fn()
  }
}));

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // Test component that uses the auth context
  const TestComponent = () => {
    const { user, loading, isAuthenticated, isAdmin } = useAuth();

    if (loading) {
      return <div>Loading...</div>;
    }

    return (
      <div>
        <div data-testid="is-authenticated">{isAuthenticated ? 'true' : 'false'}</div>
        <div data-testid="is-admin">{isAdmin ? 'true' : 'false'}</div>
        <div data-testid="user-email">{user?.email || 'none'}</div>
      </div>
    );
  };

  it('provides default unauthenticated state', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('is-admin')).toHaveTextContent('false');
    });
  });

  it('loads user from localStorage on mount', async () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      is_admin: false
    };

    localStorage.setItem('user', JSON.stringify(mockUser));
    localStorage.setItem('auth_token', 'test-token');

    (authApi.me as any).mockResolvedValueOnce({
      success: true,
      data: mockUser
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');
    });
  });

  it('handles demo token mode without backend verification', async () => {
    const mockUser = {
      id: '1',
      email: 'demo@example.com',
      name: 'Demo User',
      is_admin: true
    };

    localStorage.setItem('user', JSON.stringify(mockUser));
    localStorage.setItem('auth_token', 'demo-token-123');

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('demo@example.com');
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('is-admin')).toHaveTextContent('true');
    });

    // Verify that authApi.me was not called for demo tokens
    expect(authApi.me).not.toHaveBeenCalled();
  });

  it('determines admin status correctly', async () => {
    const adminUser = {
      id: '1',
      email: 'admin@example.com',
      name: 'Admin User',
      is_admin: true
    };

    localStorage.setItem('user', JSON.stringify(adminUser));
    localStorage.setItem('auth_token', 'demo-token-admin');

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-admin')).toHaveTextContent('true');
    });
  });

  it('handles login function', async () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      is_admin: false
    };

    (authApi.login as any).mockResolvedValueOnce({
      success: true,
      data: {
        user: mockUser,
        token: 'new-token'
      }
    });

    let loginFn: ((email: string, password: string) => Promise<void>) | null = null;

    const LoginTestComponent = () => {
      const { login } = useAuth();
      loginFn = login;
      return <div>Login Component</div>;
    };

    render(
      <AuthProvider>
        <LoginTestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(loginFn).toBeDefined();
    });

    if (loginFn) {
      await act(async () => {
        await loginFn!('test@example.com', 'password123');
      });

      expect(authApi.login).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(localStorage.getItem('auth_token')).toBe('new-token');
      expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser));
    }
  });

  it('handles logout function', async () => {
    localStorage.setItem('auth_token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'test@example.com' }));

    (authApi.logout as any).mockResolvedValueOnce({
      success: true
    });

    let logoutFn: (() => Promise<void>) | null = null;

    const LogoutTestComponent = () => {
      const { logout } = useAuth();
      logoutFn = logout;
      return <div>Logout Component</div>;
    };

    render(
      <AuthProvider>
        <LogoutTestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(logoutFn).toBeDefined();
    });

    if (logoutFn) {
      await act(async () => {
        await logoutFn!();
      });

      expect(authApi.logout).toHaveBeenCalled();
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    }
  });

  it('throws error when useAuth is used outside provider', () => {
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = vi.fn();

    expect(() => {
      render(<TestComponent />);
    }).toThrow();

    console.error = originalError;
  });
});
