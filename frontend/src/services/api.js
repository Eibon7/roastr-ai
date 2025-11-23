/**
 * API Client for Roastr application
 * Handles HTTP requests and mock mode functionality
 */

import { createMockFetch } from '../lib/mockMode';

/**
 * Base API configuration
 */
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
};

/**
 * API Error class for handling API-specific errors
 */
export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * API Client class for making HTTP requests
 */
class ApiClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };

    // Use mock fetch if in mock mode
    this.fetch = createMockFetch();
  }

  /**
   * Set authorization token
   * @param {string} token - JWT token
   */
  setAuthToken(token) {
    if (token) {
      this.defaultHeaders['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.defaultHeaders['Authorization'];
    }
  }

  /**
   * Build full URL
   * @param {string} endpoint - API endpoint
   * @returns {string} Full URL
   */
  buildUrl(endpoint) {
    return `${this.baseURL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  }

  /**
   * Handle API response
   * @param {Response} response - Fetch response
   * @returns {Promise<any>} Parsed response data
   */
  async handleResponse(response) {
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    let data = null;
    if (isJson) {
      try {
        data = await response.json();
      } catch (error) {
        console.warn('Failed to parse JSON response:', error);
      }
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const message =
        data?.message || data?.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new ApiError(message, response.status, data);
    }

    return data;
  }

  /**
   * Make HTTP request
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {object} options - Request options
   * @returns {Promise<any>} Response data
   */
  async request(method, endpoint, options = {}) {
    const { data, headers = {}, ...fetchOptions } = options;

    const config = {
      method,
      headers: {
        ...this.defaultHeaders,
        ...headers
      },
      ...fetchOptions
    };

    if (data) {
      if (data instanceof FormData) {
        // Remove Content-Type header for FormData (browser will set it with boundary)
        delete config.headers['Content-Type'];
        config.body = data;
      } else {
        config.body = JSON.stringify(data);
      }
    }

    try {
      const response = await this.fetch(this.buildUrl(endpoint), config);
      return await this.handleResponse(response);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      // Network or other errors
      throw new ApiError(error.message || 'Network error occurred', 0, { originalError: error });
    }
  }

  /**
   * GET request
   * @param {string} endpoint - API endpoint
   * @param {object} options - Request options
   * @returns {Promise<any>} Response data
   */
  async get(endpoint, options = {}) {
    return this.request('GET', endpoint, options);
  }

  /**
   * POST request
   * @param {string} endpoint - API endpoint
   * @param {any} data - Request data
   * @param {object} options - Request options
   * @returns {Promise<any>} Response data
   */
  async post(endpoint, data = null, options = {}) {
    return this.request('POST', endpoint, { ...options, data });
  }

  /**
   * PUT request
   * @param {string} endpoint - API endpoint
   * @param {any} data - Request data
   * @param {object} options - Request options
   * @returns {Promise<any>} Response data
   */
  async put(endpoint, data = null, options = {}) {
    return this.request('PUT', endpoint, { ...options, data });
  }

  /**
   * PATCH request
   * @param {string} endpoint - API endpoint
   * @param {any} data - Request data
   * @param {object} options - Request options
   * @returns {Promise<any>} Response data
   */
  async patch(endpoint, data = null, options = {}) {
    return this.request('PATCH', endpoint, { ...options, data });
  }

  /**
   * DELETE request
   * @param {string} endpoint - API endpoint
   * @param {object} options - Request options
   * @returns {Promise<any>} Response data
   */
  async delete(endpoint, options = {}) {
    return this.request('DELETE', endpoint, options);
  }
}

/**
 * Default API client instance
 */
export const apiClient = new ApiClient();

/**
 * Create a new API client instance
 * @param {string} baseURL - Base URL for the API
 * @returns {ApiClient} New API client instance
 */
export function createApiClient(baseURL) {
  return new ApiClient(baseURL);
}

/**
 * Helper function to handle API errors in components
 * @param {Error} error - Error object
 * @returns {string} User-friendly error message
 */
export function getErrorMessage(error) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error.message) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

/**
 * Helper function to check if error is a specific HTTP status
 * @param {Error} error - Error object
 * @param {number} status - HTTP status code to check
 * @returns {boolean} True if error matches the status
 */
export function isApiError(error, status = null) {
  if (!(error instanceof ApiError)) {
    return false;
  }

  if (status === null) {
    return true;
  }

  return error.status === status;
}

/**
 * Helper function to check if error is unauthorized
 * @param {Error} error - Error object
 * @returns {boolean} True if error is 401 Unauthorized
 */
export function isUnauthorizedError(error) {
  return isApiError(error, HTTP_STATUS.UNAUTHORIZED);
}

/**
 * Helper function to check if error is forbidden
 * @param {Error} error - Error object
 * @returns {boolean} True if error is 403 Forbidden
 */
export function isForbiddenError(error) {
  return isApiError(error, HTTP_STATUS.FORBIDDEN);
}

/**
 * Helper function to check if error is not found
 * @param {Error} error - Error object
 * @returns {boolean} True if error is 404 Not Found
 */
export function isNotFoundError(error) {
  return isApiError(error, HTTP_STATUS.NOT_FOUND);
}

export default apiClient;
