import * as React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import { authApi, type User, type ApiError } from './api';
import { setUserId, setUserProperties, reset, type UserProperties } from './analytics-identity';

/**
 * Authentication context type definition
 *
 * Provides authentication state and methods throughout the application.
 */
interface AuthContextType {
  /** Current authenticated user or null if not authenticated */
  user: User | null;
  /** Whether authentication state is being verified */
  loading: boolean;
  /** Whether a user is currently authenticated */
  isAuthenticated: boolean;
  /** Whether the current user has admin privileges */
  isAdmin: boolean;
  /** Login function */
  login: (email: string, password: string) => Promise<void>;
  /** Logout function */
  logout: () => Promise<void>;
  /** Refresh user data from server */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider Component
 *
 * Provides authentication context to the entire application.
 * Manages user session state, handles authentication verification,
 * and supports demo mode for development/testing without backend.
 *
 * @param props - Component props
 * @param props.children - Child components that will have access to auth context
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        // Si es un token demo, no intentar verificar con backend
        const token = localStorage.getItem('auth_token');
        if (token && token.startsWith('demo-token-')) {
          setLoading(false);
          return;
        }
      } catch {
        localStorage.removeItem('user');
      }
    }
    verifyAuth();
  }, []);

  /**
   * Verifies authentication status with the backend
   *
   * Checks if there's a valid auth token and verifies it with the server.
   * Supports demo mode by detecting demo tokens and skipping backend verification.
   * Automatically clears invalid tokens.
   */
  const verifyAuth = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setLoading(false);
      return;
    }

    // Si es un token demo, no verificar con backend
    if (token.startsWith('demo-token-')) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          localStorage.removeItem('user');
          setUser(null);
        }
      }
      setLoading(false);
      return;
    }

    try {
      const response = await authApi.me();
      if (response.success && response.data) {
        setUser(response.data);
        localStorage.setItem('user', JSON.stringify(response.data));
      } else {
        // Invalid token, clear it
        authApi.logout();
        setUser(null);
      }
    } catch {
      // Auth failed, clear token
      authApi.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Authenticates a user with email and password
   *
   * @param email - User's email address
   * @param password - User's password
   * @throws {Error} If login fails or credentials are invalid
   */
  const login = async (email: string, password: string) => {
    try {
      const response = await authApi.login(email, password);
      if (response.success && response.token && response.user) {
        localStorage.setItem('auth_token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        setUser(response.user);
      } else {
        throw new Error('Login failed');
      }
    } catch (error) {
      const apiError = error as ApiError;
      throw new Error(apiError.message || 'Failed to login');
    }
  };

  /**
   * Logs out the current user
   *
   * Clears authentication token and user data from localStorage
   * and resets the auth state.
   */
  const logout = async () => {
    // ROA-356: Clear Amplitude identity
    setUserId(undefined);
    reset();

    authApi.logout();
    setUser(null);
  };

  /**
   * Refreshes user data from the server
   *
   * Re-verifies authentication and updates user data if token is still valid.
   */
  const refreshUser = async () => {
    await verifyAuth();
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.is_admin === true,
    login,
    logout,
    refreshUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth Hook
 *
 * Custom hook to access authentication context.
 * Must be used within an AuthProvider component.
 *
 * @returns Authentication context with user, loading state, and auth methods
 * @throws {Error} If used outside of AuthProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, isAuthenticated, login, logout } = useAuth();
 *
 *   if (!isAuthenticated) {
 *     return <LoginForm onLogin={login} />;
 *   }
 *
 *   return <Dashboard user={user} onLogout={logout} />;
 * }
 * ```
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
