/**
 * Auth Service
 * Handles authentication operations following the auth UI contract v1.0
 *
 * Contract:
 * - Forms return { username, password }
 * - Errors propagate as { error: true, message: string }
 * - Recovery button calls authService.sendRecoveryEmail(username)
 */

import { authHelpers } from '../lib/supabaseClient';

class AuthService {
  /**
   * Sign in with username and password
   * @param {string} username - User email/username
   * @param {string} password - User password
   * @returns {Promise<{success: boolean, data?: any, error?: boolean, message?: string}>}
   */
  async signIn(username, password) {
    try {
      const result = await authHelpers.signIn(username, password);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: true,
        message: this._getErrorMessage(error, 'login')
      };
    }
  }

  /**
   * Register new user
   * @param {string} username - User email/username
   * @param {string} password - User password
   * @returns {Promise<{success: boolean, data?: any, error?: boolean, message?: string}>}
   */
  async register(username, password) {
    try {
      const result = await authHelpers.signUp(username, password);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: true,
        message: this._getErrorMessage(error, 'register')
      };
    }
  }

  /**
   * Send recovery email
   * @param {string} username - User email/username
   * @returns {Promise<{success: boolean, error?: boolean, message?: string}>}
   */
  async sendRecoveryEmail(username) {
    try {
      await authHelpers.resetPassword(username);
      return {
        success: true,
        message: 'Recovery email sent successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: true,
        message: this._getErrorMessage(error, 'recovery')
      };
    }
  }

  /**
   * Sign out current user
   * @returns {Promise<{success: boolean, error?: boolean, message?: string}>}
   */
  async signOut() {
    try {
      await authHelpers.signOut();
      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: true,
        message: 'Failed to sign out'
      };
    }
  }

  /**
   * Get current session
   * @returns {Promise<any>}
   */
  async getCurrentSession() {
    try {
      return await authHelpers.getCurrentSession();
    } catch (error) {
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   * Issue #628: Proactive token refresh 15 minutes before expiry
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<{success: boolean, data?: any, error?: boolean, message?: string}>}
   */
  async refreshToken(refreshToken) {
    // Input validation
    if (typeof refreshToken !== 'string' || !refreshToken.trim()) {
      return {
        success: false,
        error: true,
        message: 'Invalid refresh token provided'
      };
    }

    try {
      const response = await fetch('/api/auth/session/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to refresh token');
      }

      // Issue #628 - CodeRabbit: Support both response shapes (root-level or nested)
      const payload = await response.json().catch(() => ({}));
      const data = payload.data || payload;
      return {
        success: true,
        data // { access_token, refresh_token, expires_at, expires_in, user }
      };
    } catch (error) {
      return {
        success: false,
        error: true,
        message: error?.message || 'Session expired. Please sign in again.'
      };
    }
  }

  /**
   * Get user-friendly error messages
   * @private
   */
  _getErrorMessage(error, context) {
    const message = error?.message || error || 'An unexpected error occurred';

    // Login specific errors
    if (context === 'login') {
      if (
        message.includes('Invalid login credentials') ||
        message.includes('Invalid email or password')
      ) {
        return 'Wrong email or password';
      }
      if (message.includes('Email not confirmed')) {
        return 'Please verify your email before signing in. Check your inbox for a verification link.';
      }
      if (message.includes('Too many requests')) {
        return 'Too many login attempts. Please try again later.';
      }
    }

    // Registration specific errors
    if (context === 'register') {
      if (message.includes('User already registered')) {
        return 'An account with this email already exists';
      }
      if (message.includes('Password should be at least')) {
        return 'Password must be at least 6 characters long';
      }
      if (message.includes('Invalid email')) {
        return 'Please enter a valid email address';
      }
    }

    // Recovery specific errors
    if (context === 'recovery') {
      if (message.includes('User not found')) {
        return 'No account found with this email address';
      }
      if (message.includes('Too many requests')) {
        return 'Too many recovery requests. Please wait before trying again.';
      }
    }

    // Generic fallback
    return message;
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;
