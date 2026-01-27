/**
 * API Client Base
 *
 * Centralized HTTP client with automatic token refresh, interceptors,
 * and error handling for 401/403 responses.
 *
 * Issue #1059: Base client for modular API structure
 */

import { supabase, authHelpers } from '../supabaseClient';
import { isMockModeEnabled } from '../mockMode';
import { getCsrfToken } from '../../utils/csrf';

class ApiClient {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || '/api';
    this.refreshPromise = null;
    this.interceptors = {
      request: [],
      response: [],
      error: []
    };
  }

  /**
   * Add request interceptor
   * @param {Function} interceptor - Function to modify request before sending
   */
  addRequestInterceptor(interceptor) {
    this.interceptors.request.push(interceptor);
  }

  /**
   * Add response interceptor
   * @param {Function} interceptor - Function to modify response before returning
   */
  addResponseInterceptor(interceptor) {
    this.interceptors.response.push(interceptor);
  }

  /**
   * Add error interceptor
   * @param {Function} interceptor - Function to handle errors (401, 403, etc.)
   */
  addErrorInterceptor(interceptor) {
    this.interceptors.error.push(interceptor);
  }

  /**
   * Get valid session with token refresh
   */
  async getValidSession() {
    try {
      const session = await authHelpers.getCurrentSession();

      if (!session) {
        throw new Error('No active session');
      }

      // Check if token is close to expiry (5 minutes buffer)
      const expiresAt = new Date(session.expires_at * 1000).getTime();
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      if (expiresAt - now < fiveMinutes) {
        if (!this.refreshPromise) {
          this.refreshPromise = this.refreshSession();
        }

        try {
          const newSession = await this.refreshPromise;
          return newSession;
        } finally {
          this.refreshPromise = null;
        }
      }

      return session;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Session validation error:', error);
      }
      throw new Error('Failed to get valid session');
    }
  }

  /**
   * Refresh the session token
   */
  async refreshSession() {
    if (isMockModeEnabled()) {
      const mockSession = JSON.parse(localStorage.getItem('mock_supabase_session') || '{}');
      if (mockSession.access_token) {
        mockSession.expires_at = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000);
        localStorage.setItem('mock_supabase_session', JSON.stringify(mockSession));
        return mockSession;
      }
    }

    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data?.session) {
      return data.session;
    }

    const currentSession = await supabase.auth.getSession();
    if (!currentSession.data.session) {
      throw new Error('No session to refresh');
    }

    try {
      const response = await fetch(`${this.baseURL}/auth/session/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refresh_token: currentSession.data.session.refresh_token
        })
      });

      if (!response.ok) {
        throw new Error('Failed to refresh session');
      }

      const data = await response.json();

      if (data.access_token && data.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token
        });
      }

      const {
        data: { session }
      } = await supabase.auth.getSession();
      return session;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Token refresh failed:', error);
      }
      await supabase.auth.signOut();
      throw error;
    }
  }

  /**
   * Handle 401 Unauthorized - logout and redirect to login
   */
  async handle401() {
    // Run error interceptors
    for (const interceptor of this.interceptors.error) {
      if (interceptor.status === 401) {
        await interceptor.handler();
        return;
      }
    }

    // Default behavior: logout and redirect
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  /**
   * Handle 403 Forbidden - redirect to /app
   */
  async handle403() {
    // Run error interceptors
    for (const interceptor of this.interceptors.error) {
      if (interceptor.status === 403) {
        await interceptor.handler();
        return;
      }
    }

    // Default behavior: redirect to /app
    if (typeof window !== 'undefined') {
      window.location.href = '/app';
    }
  }

  /**
   * Make authenticated request with automatic retry on 401
   */
  async request(method, endpoint, data = null) {
    try {
      let url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;

      let options = {
        method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      // Run request interceptors
      for (const interceptor of this.interceptors.request) {
        const result = await interceptor({ url, options, method, endpoint, data });
        if (result) {
          url = result.url || url;
          options = { ...options, ...result.options };
        }
      }

      // Add authorization header if not a public endpoint
      // Fix BLOCKER 2: Include all public auth endpoints (v1 + v2)
      const publicEndpoints = [
        '/auth/login',
        '/auth/register',
        '/auth/magic-link',
        '/auth/signup/magic-link',
        '/auth/reset-password',
        '/v2/auth/login',
        '/v2/auth/register',
        '/v2/auth/password-recovery',
        '/v2/auth/update-password'
      ];

      if (!publicEndpoints.some((ep) => endpoint.includes(ep))) {
        const session = await this.getValidSession();
        if (session?.access_token) {
          options.headers.Authorization = `Bearer ${session.access_token}`;
        }
      }

      // Add CSRF token for state-modifying requests
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          options.headers['X-CSRF-Token'] = csrfToken;
        }
      }

      // Add body for POST, PUT, PATCH requests
      if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
        options.body = JSON.stringify(data);
      }

      let response = await fetch(url, options);

      // Handle 401 Unauthorized
      if (response.status === 401 && !endpoint.includes('/auth/login')) {
        try {
          if (!this.refreshPromise) {
            this.refreshPromise = this.refreshSession();
          }

          try {
            const newSession = await this.refreshPromise;

            // Retry with new token
            const retryResponse = await fetch(url, {
              ...options,
              headers: {
                ...options.headers,
                Authorization: `Bearer ${newSession.access_token}`
              }
            });

            if (retryResponse.status === 401) {
              // Still 401 after refresh - handle logout
              await this.handle401();
              throw new Error('Session expired. Please log in again.');
            }

            if (!retryResponse.ok) {
              const errorData = await retryResponse.json().catch(() => ({}));
              throw new Error(errorData.error || `HTTP error! status: ${retryResponse.status}`);
            }

            response = retryResponse;
          } finally {
            this.refreshPromise = null;
          }
        } catch (refreshError) {
          await this.handle401();
          throw refreshError;
        }
      }

      // Handle 403 Forbidden
      if (response.status === 403) {
        await this.handle403();
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || 'Access denied. You do not have permission to access this resource.'
        );
      }

      // Handle 429 Too Many Requests
      if (response.status === 429) {
        const errorData = await response.json().catch(() => ({}));
        const retryAfterHeader = response.headers.get('retry-after') || errorData.retryAfter;
        let waitSeconds = 60;

        if (retryAfterHeader) {
          const delta = parseInt(retryAfterHeader, 10);
          if (!Number.isNaN(delta)) {
            waitSeconds = delta;
          } else {
            const dateMs = Date.parse(retryAfterHeader);
            if (!Number.isNaN(dateMs)) {
              waitSeconds = Math.max(0, Math.ceil((dateMs - Date.now()) / 1000));
            }
          }
        }

        throw new Error(
          `Rate limit exceeded. Please wait ${Math.ceil(waitSeconds / 60)} minutes before trying again.`
        );
      }

      // Handle different response types
      const contentType = response.headers.get('content-type');
      let responseData;

      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      if (!response.ok) {
        throw new Error(responseData.error || `HTTP error! status: ${response.status}`);
      }

      // Run response interceptors
      for (const interceptor of this.interceptors.response) {
        responseData = (await interceptor(responseData, response)) || responseData;
      }

      return responseData;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`API ${method} ${endpoint} error:`, error);
      }

      // Handle mock mode fallbacks
      if (isMockModeEnabled()) {
        return this.handleMockRequest(method, endpoint, data, error);
      }

      throw error;
    }
  }

  /**
   * Handle mock requests with fallbacks
   */
  async handleMockRequest(method, endpoint, data, originalError) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('🎭 Mock API request:', { method, endpoint, data });
    }

    // Mock responses for common endpoints
    if (endpoint === '/auth/change-email') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return {
        success: true,
        message:
          'Email de confirmación enviado. Revisa tu nueva dirección para confirmar el cambio.',
        data: { requiresConfirmation: true }
      };
    }

    if (endpoint === '/auth/export-data') {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return {
        success: true,
        message: 'Datos exportados correctamente',
        data: {
          export_info: {
            exported_at: new Date().toISOString(),
            export_version: '1.0',
            user_id: 'mock_user_123'
          }
        }
      };
    }

    throw originalError;
  }

  // Convenience methods
  async get(endpoint) {
    return this.request('GET', endpoint);
  }

  async post(endpoint, data) {
    return this.request('POST', endpoint, data);
  }

  async put(endpoint, data) {
    return this.request('PUT', endpoint, data);
  }

  async patch(endpoint, data) {
    return this.request('PATCH', endpoint, data);
  }

  async delete(endpoint) {
    return this.request('DELETE', endpoint);
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;
