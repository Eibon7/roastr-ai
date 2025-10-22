/**
 * API Client with automatic token refresh and Account Management functionality
 * Centralized API handling with auth token management and mock mode support
 */

import { supabase, authHelpers } from './supabaseClient';
import { isMockModeEnabled } from './mockMode';

class ApiClient {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || '/api';
    this.refreshPromise = null;
  }

  /**
   * Get valid session with token refresh
   */
  async getValidSession() {
    try {
      // Use authHelpers for consistency with existing codebase
      const session = await authHelpers.getCurrentSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      // Check if token is close to expiry (5 minutes buffer)
      const expiresAt = new Date(session.expires_at * 1000).getTime();
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      if (expiresAt - now < fiveMinutes) {
        // Use refresh promise to avoid multiple simultaneous refreshes
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
      // Issue #628 - CodeRabbit: Remove console.* from production
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
    // In mock mode, extend the session
    if (isMockModeEnabled()) {
      const mockSession = JSON.parse(localStorage.getItem('mock_supabase_session') || '{}');
      if (mockSession.access_token) {
        // Extend mock session by 24 hours (expires_at in seconds, not milliseconds)
        mockSession.expires_at = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000);
        localStorage.setItem('mock_supabase_session', JSON.stringify(mockSession));
        return mockSession;
      }
    }

    // Try to refresh the token using Supabase
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data?.session) {
      return data.session;
    }

    // Fallback: Call backend refresh endpoint
    const currentSession = await supabase.auth.getSession();
    if (!currentSession.data.session) {
      throw new Error('No session to refresh');
    }

    try {
      const response = await fetch(`${this.baseURL}/auth/session/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: currentSession.data.session.refresh_token
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh session');
      }

      const data = await response.json();
      
      // Update Supabase session with new tokens
      if (data.access_token && data.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
      }

      // Get the updated session
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    } catch (error) {
      // Issue #628 - CodeRabbit: Remove console.* from production
      if (process.env.NODE_ENV !== 'production') {
        console.error('Token refresh failed:', error);
      }
      // If refresh fails, sign out the user
      await supabase.auth.signOut();
      throw error;
    }
  }

  /**
   * Make authenticated request with automatic retry on 401
   */
  async request(method, endpoint, data = null) {
    try {
      const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
      
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      // Add authorization header if not a public endpoint
      if (!endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
        const session = await this.getValidSession();
        if (session?.access_token) {
          options.headers.Authorization = `Bearer ${session.access_token}`;
        }
      }

      // Add body for POST, PUT, PATCH requests
      if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);

      // Issue #628: Enhanced error handling for auth errors

      // Handle 403 Forbidden - Access denied
      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Access denied. You do not have permission to access this resource.');
      }

      // Handle 429 Too Many Requests - Rate limit exceeded
      if (response.status === 429) {
        const errorData = await response.json().catch(() => ({}));
        const retryAfterHeader = response.headers.get('retry-after') || errorData.retryAfter;
        let waitSeconds = 60;

        // Issue #628 - CodeRabbit: Support both delta-seconds and HTTP-date formats
        if (retryAfterHeader) {
          const delta = parseInt(retryAfterHeader, 10);
          if (!Number.isNaN(delta)) {
            // Delta-seconds format
            waitSeconds = delta;
          } else {
            // HTTP-date format
            const dateMs = Date.parse(retryAfterHeader);
            if (!Number.isNaN(dateMs)) {
              waitSeconds = Math.max(0, Math.ceil((dateMs - Date.now()) / 1000));
            }
          }
        }

        throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitSeconds / 60)} minutes before trying again.`);
      }

      // Check if token expired during request - retry once with refresh
      if (response.status === 401 && !endpoint.includes('/auth/login')) {
        try {
          // Issue #628 - CodeRabbit: Coalesce concurrent 401s to avoid multiple refreshes
          if (!this.refreshPromise) {
            this.refreshPromise = this.refreshSession();
          }
          const newSession = await this.refreshPromise;
          this.refreshPromise = null;
          
          // Retry with new token
          const retryResponse = await fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              'Authorization': `Bearer ${newSession.access_token}`,
            },
          });

          if (!retryResponse.ok) {
            const errorData = await retryResponse.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${retryResponse.status}`);
          }

          // Handle different response types for retry
          const contentType = retryResponse.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            return await retryResponse.json();
          }
          return await retryResponse.text();
        } catch (refreshError) {
          // Issue #628 - CodeRabbit: Remove console.* from production
          if (process.env.NODE_ENV !== 'production') {
            console.error('Token refresh and retry failed:', refreshError);
          }
          throw refreshError;
        }
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

      return responseData;
    } catch (error) {
      // Issue #628 - CodeRabbit: Remove console.* from production
      if (process.env.NODE_ENV !== 'production') {
        console.error(`API ${method} ${endpoint} error:`, error);
      }

      // Handle mock mode fallbacks for Account Management endpoints
      if (isMockModeEnabled()) {
        return this.handleMockRequest(method, endpoint, data, error);
      }

      throw error;
    }
  }

  /**
   * Handle mock requests with fallbacks for Account Management features
   */
  async handleMockRequest(method, endpoint, data, originalError) {
    // Issue #628 - CodeRabbit: Remove console.* from production (mock mode is dev-only)
    if (process.env.NODE_ENV !== 'production') {
      console.log('🎭 Mock API request:', { method, endpoint, data });
    }

    // Mock responses for Account Management endpoints
    if (endpoint === '/auth/change-email') {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
      return {
        success: true,
        message: 'Email de confirmación enviado. Revisa tu nueva dirección para confirmar el cambio.',
        data: { requiresConfirmation: true }
      };
    }
    
    if (endpoint === '/auth/export-data') {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate delay
      return {
        success: true,
        message: 'Datos exportados correctamente',
        data: {
          export_info: {
            exported_at: new Date().toISOString(),
            export_version: '1.0',
            user_id: 'mock_user_123',
            note: 'This is mock data for demonstration purposes'
          },
          profile: {
            id: 'mock_user_123',
            email: 'user@roastr.ai',
            name: 'Demo User',
            plan: 'pro',
            created_at: '2024-01-15T10:00:00Z'
          },
          organizations: [],
          integrations: [],
          activities: [],
          usage_statistics: {
            total_messages_sent: 42,
            total_tokens_consumed: 1337,
            monthly_messages_sent: 15,
            monthly_tokens_consumed: 456
          }
        }
      };
    }
    
    if (endpoint === '/auth/delete-account') {
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
      const gracePeriodEnds = new Date();
      gracePeriodEnds.setDate(gracePeriodEnds.getDate() + 30);
      
      return {
        success: true,
        message: `Eliminación de cuenta programada para ${gracePeriodEnds.toLocaleDateString('es-ES')}. Tienes 30 días para cancelar esta acción.`,
        data: {
          gracePeriodEnds: gracePeriodEnds.toISOString(),
          canCancel: true
        }
      };
    }
    
    if (endpoint === '/auth/cancel-account-deletion') {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
      return {
        success: true,
        message: 'Eliminación de cuenta cancelada exitosamente. Tu cuenta seguirá activa.',
        data: {}
      };
    }
    
    // For other endpoints, throw the original error
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

// Export convenience functions for compatibility with main branch
// Issue #628 - CodeRabbit: Remove unused options parameters
export const api = {
  get: (url) => apiClient.get(url),
  post: (url, data) => apiClient.post(url, data),
  put: (url, data) => apiClient.put(url, data),
  patch: (url, data) => apiClient.patch(url, data),
  delete: (url) => apiClient.delete(url),
};