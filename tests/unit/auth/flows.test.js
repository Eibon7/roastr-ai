/**
 * Tests unitarios para flujos de autenticación y redirección
 */

// DOM mocks are handled by tests/setup.js

describe('Auth Flows', () => {
  beforeEach(() => {
    localStorage.clear();
    if (window.location) {
      window.location.href = '';
      window.location.search = '';
      if (window.location.assign && window.location.assign.mockClear) {
        window.location.assign.mockClear();
      }
      if (window.location.replace && window.location.replace.mockClear) {
        window.location.replace.mockClear();
      }
    }
    fetch.mockClear();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Login Flow', () => {
    const mockLoginSuccess = {
      ok: true,
      json: async () => ({
        success: true,
        message: 'Login successful',
        data: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: {
            id: '123',
            email: 'test@example.com',
            is_admin: false,
            name: 'Test User',
            plan: 'basic'
          }
        }
      })
    };

    const mockLoginError = {
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        error: 'Wrong email or password'
      })
    };

    async function simulateLogin(email, password, keepLogged = false) {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, keepLogged })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        localStorage.setItem('auth_token', result.data.access_token);
        localStorage.setItem('refresh_token', result.data.refresh_token);
        localStorage.setItem('user_data', JSON.stringify(result.data.user));

        return { success: true, user: result.data.user };
      } else {
        return { success: false, error: result.error };
      }
    }

    it('should handle successful login', async () => {
      fetch.mockResolvedValueOnce(mockLoginSuccess);

      const result = await simulateLogin('test@example.com', 'password123');

      expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
          keepLogged: false
        })
      });

      expect(result.success).toBe(true);
      expect(localStorage.getItem('auth_token')).toBe('mock-access-token');
      expect(localStorage.getItem('refresh_token')).toBe('mock-refresh-token');
      expect(JSON.parse(localStorage.getItem('user_data'))).toEqual({
        id: '123',
        email: 'test@example.com',
        is_admin: false,
        name: 'Test User',
        plan: 'basic'
      });
    });

    it('should handle login failure', async () => {
      fetch.mockResolvedValueOnce(mockLoginError);

      const result = await simulateLogin('test@example.com', 'wrongpassword');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Wrong email or password');
      expect(localStorage.getItem('auth_token')).toBeNull();
    });

    it('should handle network error during login', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(simulateLogin('test@example.com', 'password123')).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('Registration Flow', () => {
    const mockRegisterSuccess = {
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        data: {
          user: {
            id: '123',
            email: 'test@example.com',
            email_confirmed: false
          }
        }
      })
    };

    const mockRegisterError = {
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: 'An account with this email already exists'
      })
    };

    async function simulateRegistration(email, password, name) {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, name })
      });

      const result = await response.json();
      return { success: response.ok && result.success, result };
    }

    it('should handle successful registration', async () => {
      fetch.mockResolvedValueOnce(mockRegisterSuccess);

      const result = await simulateRegistration('test@example.com', 'password123', 'Test User');

      expect(fetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User'
        })
      });

      expect(result.success).toBe(true);
      expect(result.result.message).toContain('Registration successful');
    });

    it('should handle registration failure - duplicate email', async () => {
      fetch.mockResolvedValueOnce(mockRegisterError);

      const result = await simulateRegistration('existing@example.com', 'password123', 'Test User');

      expect(result.success).toBe(false);
      expect(result.result.error).toContain('already exists');
    });
  });

  describe('Password Recovery Flow', () => {
    const mockRecoverySuccess = {
      ok: true,
      json: async () => ({
        success: true,
        message: 'If an account with this email exists, a reset link has been sent.',
        data: { email: 'test@example.com' }
      })
    };

    async function simulatePasswordRecovery(email) {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const result = await response.json();
      return { success: response.ok, result };
    }

    it('should handle password recovery request', async () => {
      fetch.mockResolvedValueOnce(mockRecoverySuccess);

      const result = await simulatePasswordRecovery('test@example.com');

      expect(fetch).toHaveBeenCalledWith('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' })
      });

      expect(result.success).toBe(true);
      expect(result.result.message).toContain('reset link has been sent');
    });

    it('should handle password recovery with generic message for security', async () => {
      // Even for non-existent emails, should return success for security
      fetch.mockResolvedValueOnce(mockRecoverySuccess);

      const result = await simulatePasswordRecovery('nonexistent@example.com');

      expect(result.success).toBe(true);
      expect(result.result.message).toContain('reset link has been sent');
    });
  });

  describe('Magic Link Flow', () => {
    const mockMagicLinkSuccess = {
      ok: true,
      json: async () => ({
        success: true,
        message: 'Magic link sent to your email. Please check your inbox.',
        data: { email: 'test@example.com' }
      })
    };

    async function simulateMagicLink(email) {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const result = await response.json();
      return { success: response.ok, result };
    }

    it('should handle magic link request', async () => {
      fetch.mockResolvedValueOnce(mockMagicLinkSuccess);

      const result = await simulateMagicLink('test@example.com');

      expect(fetch).toHaveBeenCalledWith('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' })
      });

      expect(result.success).toBe(true);
      expect(result.result.message).toContain('Magic link sent');
    });
  });

  describe('User Redirection Logic', () => {
    function getRedirectUrl(userData) {
      if (userData.is_admin) {
        return '/admin.html';
      } else {
        return '/dashboard.html';
      }
    }

    function checkAuthRedirect() {
      const token = localStorage.getItem('auth_token');
      if (token) {
        const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
        return getRedirectUrl(userData);
      }
      return null;
    }

    it('should redirect admin users to admin panel', () => {
      const adminUser = {
        id: '123',
        email: 'admin@example.com',
        is_admin: true,
        plan: 'pro'
      };

      localStorage.setItem('auth_token', 'valid-token');
      localStorage.setItem('user_data', JSON.stringify(adminUser));

      const redirectUrl = checkAuthRedirect();
      expect(redirectUrl).toBe('/admin.html');
    });

    it('should redirect regular users to dashboard', () => {
      const regularUser = {
        id: '456',
        email: 'user@example.com',
        is_admin: false,
        plan: 'basic'
      };

      localStorage.setItem('auth_token', 'valid-token');
      localStorage.setItem('user_data', JSON.stringify(regularUser));

      const redirectUrl = checkAuthRedirect();
      expect(redirectUrl).toBe('/dashboard.html');
    });

    it('should not redirect if user is not authenticated', () => {
      // No token in localStorage
      const redirectUrl = checkAuthRedirect();
      expect(redirectUrl).toBeNull();
    });

    it('should handle missing user data gracefully', () => {
      localStorage.setItem('auth_token', 'valid-token');
      // No user_data in localStorage

      const redirectUrl = checkAuthRedirect();
      expect(redirectUrl).toBe('/dashboard.html'); // Default to dashboard
    });
  });

  describe('OAuth Callback Flow', () => {
    function handleOAuthCallback(authData, type) {
      if (authData && type === 'oauth_success') {
        try {
          const sessionData = JSON.parse(decodeURIComponent(authData));
          localStorage.setItem('auth_token', sessionData.access_token);
          localStorage.setItem('refresh_token', sessionData.refresh_token);
          localStorage.setItem('user_data', JSON.stringify(sessionData.user));
          return { success: true, user: sessionData.user };
        } catch (error) {
          return { success: false, error: 'Error processing OAuth data' };
        }
      }
      return { success: false, error: 'Invalid OAuth callback' };
    }

    it('should process OAuth callback successfully', () => {
      const oauthData = {
        access_token: 'oauth-access-token',
        refresh_token: 'oauth-refresh-token',
        user: {
          id: '789',
          email: 'oauth@example.com',
          is_admin: false,
          name: 'OAuth User'
        }
      };

      const encodedData = encodeURIComponent(JSON.stringify(oauthData));
      const result = handleOAuthCallback(encodedData, 'oauth_success');

      expect(result.success).toBe(true);
      expect(result.user.email).toBe('oauth@example.com');
      expect(localStorage.getItem('auth_token')).toBe('oauth-access-token');
    });

    it('should handle malformed OAuth data', () => {
      const malformedData = 'invalid-json-data';
      const result = handleOAuthCallback(malformedData, 'oauth_success');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Error processing OAuth data');
    });

    it('should reject invalid OAuth callback type', () => {
      const oauthData = encodeURIComponent(JSON.stringify({ test: 'data' }));
      const result = handleOAuthCallback(oauthData, 'invalid_type');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid OAuth callback');
    });
  });

  describe('Session Management', () => {
    function logout() {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_data');
      localStorage.removeItem('token_expires_at');
      localStorage.removeItem('pendingVerificationEmail');
    }

    function isSessionValid() {
      const token = localStorage.getItem('auth_token');
      const expiresAt = localStorage.getItem('token_expires_at');

      if (!token) return false;

      if (expiresAt) {
        const now = Date.now() / 1000;
        const expiry = parseInt(expiresAt);
        return now < expiry;
      }

      return true;
    }

    it('should clear all session data on logout', () => {
      // Set session data
      localStorage.setItem('auth_token', 'token');
      localStorage.setItem('refresh_token', 'refresh');
      localStorage.setItem('user_data', '{"id":"123"}');
      localStorage.setItem('token_expires_at', '1234567890');
      localStorage.setItem('pendingVerificationEmail', 'test@example.com');

      logout();

      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
      expect(localStorage.getItem('user_data')).toBeNull();
      expect(localStorage.getItem('token_expires_at')).toBeNull();
      expect(localStorage.getItem('pendingVerificationEmail')).toBeNull();
    });

    it('should validate active session', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;
      localStorage.setItem('auth_token', 'valid-token');
      localStorage.setItem('token_expires_at', futureTimestamp.toString());

      expect(isSessionValid()).toBe(true);
    });

    it('should invalidate expired session', () => {
      const pastTimestamp = Math.floor(Date.now() / 1000) - 3600;
      localStorage.setItem('auth_token', 'expired-token');
      localStorage.setItem('token_expires_at', pastTimestamp.toString());

      expect(isSessionValid()).toBe(false);
    });

    it('should validate session without expiration time', () => {
      localStorage.setItem('auth_token', 'token-without-expiry');

      expect(isSessionValid()).toBe(true);
    });
  });
});
