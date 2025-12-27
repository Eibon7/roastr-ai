import * as React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import { authApi, type User, type ApiError } from './api';
import { setUserId, setUserProperties, reset } from './analytics-identity';
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  hasTokens
} from './auth/tokenStorage';

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
  // localStorage is the single source of truth for tokens
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        // Si es un token demo, no intentar verificar con backend
        const token = getAccessToken();
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
   * Uses localStorage as single source of truth for tokens.
   * Supports demo mode by detecting demo tokens and skipping backend verification.
   * Automatically clears invalid tokens.
   */
  const verifyAuth = async () => {
    // Read token from localStorage (single source of truth)
    const token = getAccessToken();
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
        clearTokens();
        setUser(null);
      }
    } catch {
      // Auth failed, clear tokens
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Authenticates a user with email and password
   *
   * Stores tokens in localStorage (single source of truth).
   * Handles both legacy format ({ token, user }) and v2 format ({ session: { access_token, refresh_token, user } }).
   *
   * @param email - User's email address
   * @param password - User's password
   * @throws {Error} If login fails or credentials are invalid
   */
  const login = async (email: string, password: string) => {
    try {
      const response = await authApi.login(email, password);
      
      // Handle both legacy and v2 response formats
      let accessToken: string;
      let refreshToken: string | undefined;
      let user: User;

      if ('session' in response && response.session) {
        // v2 format: { session: { access_token, refresh_token, user }, message }
        accessToken = response.session.access_token;
        refreshToken = response.session.refresh_token;
        user = response.session.user || (response as any).user;
      } else if ('token' in response && response.token && 'user' in response) {
        // Legacy format: { success, token, user }
        accessToken = response.token;
        refreshToken = undefined; // Legacy format doesn't have refresh_token
        user = response.user;
      } else {
        throw new Error('Invalid login response format');
      }

      // Store tokens in localStorage (single source of truth)
      if (refreshToken) {
        setTokens(accessToken, refreshToken);
      } else {
        // Legacy: only access token available
        localStorage.setItem('auth_token', accessToken);
      }

      // Store user data
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);

      // ROA-356: Sync identity with Amplitude
      setUserId(user.id);
      setUserProperties({
        plan: user.plan || 'free',
        role: user.is_admin ? 'admin' : 'user',
        has_roastr_persona: !!(user as any).lo_que_me_define_encrypted,
        is_admin: user.is_admin || false,
        is_trial: user.plan?.toLowerCase().includes('trial') || false,
        auth_provider: 'email_password',
        locale: navigator.language?.split('-')[0] || 'en'
      });
    } catch (error) {
      const apiError = error as ApiError;
      throw new Error(apiError.message || 'Failed to login');
    }
  };

  /**
   * Logs out the current user
   *
   * Clears authentication tokens and user data from localStorage (single source of truth)
   * and resets the auth state.
   */
  const logout = async () => {
    // ROA-356: Clear Amplitude identity
    setUserId(undefined);
    reset();

    // Clear tokens from localStorage (single source of truth)
    clearTokens();
    
    // Clear user data
    localStorage.removeItem('user');
    setUser(null);

    // Call backend logout endpoint (optional, may fail if already logged out)
    try {
      await authApi.logout();
    } catch {
      // Ignore errors - tokens already cleared
    }
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
