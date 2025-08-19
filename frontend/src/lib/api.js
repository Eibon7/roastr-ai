import { supabase, authHelpers } from './supabaseClient';
import { isMockModeEnabled } from './mockMode';

/**
 * API Client for making authenticated requests to the backend
 */
class ApiClient {
  constructor() {
    this.baseURL = '/api';
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
        // Try to refresh the token
        const { data, error } = await supabase.auth.refreshSession();
        if (!error && data?.session) {
          return data.session;
        }
      }

      return session;
    } catch (error) {
      console.error('Session validation error:', error);
      throw new Error('Failed to get valid session');
    }
  }

  /**
   * Make authenticated request
   */
  async request(method, endpoint, data = null) {
    try {
      const url = `${this.baseURL}${endpoint}`;
      
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
      console.error(`API ${method} ${endpoint} error:`, error);
      
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
    console.log('🎭 Mock API request:', { method, endpoint, data });
    
    // Mock responses for common endpoints
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