/**
 * API Client for Frontend
 * 
 * Centralized HTTP client for making API requests
 * Handles authentication, error responses, and request configuration
 */

import { isMockModeEnabled } from '../lib/mockMode';

class ApiClient {
  constructor(baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  async request(method, url, data = null, options = {}) {
    const config = {
      method: method.toUpperCase(),
      headers: {
        ...this.defaultHeaders,
        ...options.headers
      }
    };

    // Add body for POST, PUT, PATCH requests
    if (data && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
      config.body = JSON.stringify(data);
    }

    // Add authorization header if available
    const token = this.getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;

    try {
      const response = await fetch(fullUrl, config);
      
      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      let responseData;
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      if (!response.ok) {
        const error = new Error(responseData.message || `HTTP ${response.status}`);
        error.response = {
          status: response.status,
          statusText: response.statusText,
          data: responseData
        };
        throw error;
      }

      return { data: responseData };
    } catch (error) {
      // Network errors or fetch failures
      if (!error.response) {
        error.response = {
          status: 500,
          statusText: 'Network Error',
          data: { message: 'Network request failed' }
        };
      }
      throw error;
    }
  }

  async get(url, options = {}) {
    return this.request('GET', url, null, options);
  }

  async post(url, data, options = {}) {
    return this.request('POST', url, data, options);
  }

  async put(url, data, options = {}) {
    return this.request('PUT', url, data, options);
  }

  async patch(url, data, options = {}) {
    return this.request('PATCH', url, data, options);
  }

  async delete(url, options = {}) {
    return this.request('DELETE', url, null, options);
  }

  getAuthToken() {
    // Get token from localStorage, sessionStorage, or context
    // This should integrate with your auth system
    if (isMockModeEnabled()) {
      return 'mock-jwt-token-12345';
    }
    
    return localStorage.getItem('auth_token') || 
           sessionStorage.getItem('auth_token') || 
           null;
  }

  setAuthToken(token) {
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_token');
    }
  }
}

// Create and export singleton instance
const apiClient = new ApiClient();

export default apiClient;