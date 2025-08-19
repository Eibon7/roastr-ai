/**
 * API Client with automatic token refresh
 * Centralized API handling with auth token management
 */

import { supabase } from './supabaseClient';
import { isMockModeEnabled } from './mockMode';

class APIClient {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || '';
    this.refreshPromise = null;
  }

  /**
   * Get current session with automatic refresh if needed
   */
  async getValidSession() {
    // Check current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      throw new Error('Failed to get session');
    }

    if (!session) {
      throw new Error('No active session');
    }

    // Check if token is about to expire (within 5 minutes)
    const expiresAt = session.expires_at * 1000; // Convert to milliseconds
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (expiresAt - now < fiveMinutes) {
      // Token is about to expire, refresh it
      if (!this.refreshPromise) {
        // Avoid multiple simultaneous refresh requests
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
  }

  /**
   * Refresh the session token
   */
  async refreshSession() {
    // In mock mode, extend the session
    if (isMockModeEnabled()) {
      const mockSession = JSON.parse(localStorage.getItem('mock_supabase_session') || '{}');
      if (mockSession.access_token) {
        // Extend mock session by 24 hours
        mockSession.expires_at = Date.now() + (24 * 60 * 60 * 1000);
        localStorage.setItem('mock_supabase_session', JSON.stringify(mockSession));
        return mockSession;
      }
    }

    // Call backend refresh endpoint
    const currentSession = await supabase.auth.getSession();
    if (!currentSession.data.session) {
      throw new Error('No session to refresh');
    }

    try {
      const response = await fetch(`${this.baseURL}/api/auth/session/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentSession.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to refresh session');
      }

      const data = await response.json();
      
      // Update Supabase session with new tokens
      if (data.access_token && data.refresh_token) {
        // Note: Supabase should handle this automatically, but we ensure it's updated
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
      }

      // Get the updated session
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    } catch (error) {
      console.error('Token refresh failed:', error);
      // If refresh fails, sign out the user
      await supabase.auth.signOut();
      throw error;
    }
  }

  /**
   * Make an authenticated API request with automatic token refresh
   */
  async request(url, options = {}) {
    try {
      // Get valid session (will refresh if needed)
      const session = await this.getValidSession();
      
      // Prepare headers
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        ...options.headers,
      };

      // Make the request
      const response = await fetch(`${this.baseURL}${url}`, {
        ...options,
        headers,
      });

      // Check if token expired during request
      if (response.status === 401) {
        // Try to refresh and retry once
        const newSession = await this.refreshSession();
        
        // Retry with new token
        const retryResponse = await fetch(`${this.baseURL}${url}`, {
          ...options,
          headers: {
            ...headers,
            'Authorization': `Bearer ${newSession.access_token}`,
          },
        });

        if (!retryResponse.ok) {
          const errorData = await retryResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP error! status: ${retryResponse.status}`);
        }

        return retryResponse;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  /**
   * Convenience methods for common HTTP verbs
   */
  async get(url, options = {}) {
    const response = await this.request(url, {
      ...options,
      method: 'GET',
    });
    return response.json();
  }

  async post(url, data, options = {}) {
    const response = await this.request(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async put(url, data, options = {}) {
    const response = await this.request(url, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async patch(url, data, options = {}) {
    const response = await this.request(url, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async delete(url, options = {}) {
    const response = await this.request(url, {
      ...options,
      method: 'DELETE',
    });
    return response.json();
  }
}

// Create and export a singleton instance
const apiClient = new APIClient();

export default apiClient;

// Export convenience functions
export const api = {
  get: (url, options) => apiClient.get(url, options),
  post: (url, data, options) => apiClient.post(url, data, options),
  put: (url, data, options) => apiClient.put(url, data, options),
  patch: (url, data, options) => apiClient.patch(url, data, options),
  delete: (url, options) => apiClient.delete(url, options),
};