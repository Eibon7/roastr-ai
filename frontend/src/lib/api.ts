/**
 * API Client for Roastr.ai
 * 
 * Provides a centralized HTTP client with authentication, CSRF protection,
 * and standardized error handling for all API requests.
 * 
 * Features:
 * - Automatic token injection from localStorage
 * - CSRF token handling from cookies
 * - Request/response interceptors
 * - Type-safe generic methods
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Represents an API error response
 */
export interface ApiError {
  /** Human-readable error message */
  message: string;
  /** Optional error code for programmatic handling */
  code?: string;
  /** HTTP status code */
  status?: number;
}

/**
 * Centralized HTTP client for Roastr.ai API
 * 
 * Handles all API communication including authentication headers,
 * CSRF tokens, and error transformation.
 */
class ApiClient {
  private baseURL: string;

  /**
   * Creates a new API client instance
   * 
   * @param baseURL - Base URL for API requests (defaults to env var or localhost:3000/api)
   */
  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  /**
   * Retrieves the authentication token from localStorage
   * 
   * @returns The auth token string or null if not found
   */
  private getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  /**
   * Extracts the CSRF token from document cookies
   * 
   * CSRF tokens are required for state-modifying requests (POST, PUT, PATCH, DELETE)
   * to prevent cross-site request forgery attacks.
   * 
   * @returns The CSRF token string or null if not found
   */
  private getCsrfToken(): string | null {
    // Extract CSRF token from cookies
    const cookies = document.cookie.split(';');
    const csrfCookie = cookies.find(cookie => cookie.trim().startsWith('csrf-token='));
    if (csrfCookie) {
      return csrfCookie.split('=')[1];
    }
    return null;
  }

  /**
   * Makes an authenticated HTTP request to the API
   * 
   * Automatically injects:
   * - Authorization header (Bearer token)
   * - CSRF token header for mutations
   * - Content-Type header
   * - Credentials for cookie-based auth
   * 
   * @template T - Expected response type
   * @param endpoint - API endpoint path (relative to baseURL)
   * @param options - Fetch API options (method, body, headers, etc.)
   * @returns Promise resolving to the typed response data
   * @throws {ApiError} If the request fails or returns an error status
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getAuthToken();
    const csrfToken = this.getCsrfToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add CSRF token for mutations (POST, PUT, PATCH, DELETE)
    if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method || 'GET')) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // Include cookies for CSRF token
    });

    if (!response.ok) {
      const error: ApiError = {
        message: `HTTP error! status: ${response.status}`,
        status: response.status,
      };

      try {
        const errorData = await response.json();
        error.message = errorData.error?.message || errorData.message || error.message;
        error.code = errorData.code;
      } catch {
        // If response is not JSON, use default error message
      }

      throw error;
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return {} as T;
    }

    const data = await response.json();
    return data;
  }

  /**
   * Performs a GET request
   * 
   * @template T - Expected response type
   * @param endpoint - API endpoint path
   * @returns Promise resolving to the typed response data
   */
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  /**
   * Performs a POST request
   * 
   * @template T - Expected response type
   * @param endpoint - API endpoint path
   * @param data - Optional request body (will be JSON stringified)
   * @returns Promise resolving to the typed response data
   */
  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Performs a PUT request
   * 
   * @template T - Expected response type
   * @param endpoint - API endpoint path
   * @param data - Optional request body (will be JSON stringified)
   * @returns Promise resolving to the typed response data
   */
  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Performs a PATCH request
   * 
   * @template T - Expected response type
   * @param endpoint - API endpoint path
   * @param data - Optional request body (will be JSON stringified)
   * @returns Promise resolving to the typed response data
   */
  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Performs a DELETE request
   * 
   * @template T - Expected response type
   * @param endpoint - API endpoint path
   * @returns Promise resolving to the typed response data
   */
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

/**
 * Shared API client instance for all API requests
 */
export const apiClient = new ApiClient();

/**
 * Authentication API endpoints
 * 
 * Handles user authentication, session management, and user profile retrieval.
 */
export const authApi = {
  /**
   * Retrieves the current authenticated user's profile
   * 
   * @returns Promise resolving to user data if authenticated
   * @throws {ApiError} If user is not authenticated or token is invalid
   */
  async me() {
    return apiClient.get<{ success: boolean; data: User }>('/auth/me');
  },

  /**
   * Authenticates a user with email and password
   * 
   * @param email - User's email address
   * @param password - User's password
   * @returns Promise resolving to auth token and user data
   * @throws {ApiError} If credentials are invalid
   */
  async login(email: string, password: string) {
    return apiClient.post<{ success: boolean; token: string; user: User }>(
      '/auth/login',
      { email, password }
    );
  },

  /**
   * Clears authentication data from localStorage
   * 
   * Removes both the auth token and user data. Should be called
   * when user explicitly logs out or session expires.
   */
  async logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  },
};

/**
 * User model representing a Roastr.ai user
 */
export interface User {
  /** Unique user identifier */
  id: string;
  /** User's email address */
  email: string;
  /** Optional display name */
  name?: string;
  /** Whether the user has admin privileges */
  is_admin?: boolean;
  /** ID of the organization the user belongs to */
  organization_id?: string;
}

/**
 * Admin API endpoints
 * 
 * Provides methods for admin-only operations including user management,
 * feature flags, plan configuration, tone management, and system metrics.
 * 
 * All methods require admin authentication.
 */
export const adminApi = {
  /**
   * User Management
   */
  
  /**
   * Retrieves a paginated list of users
   * 
   * Supports filtering by plan, search query, and active status.
   * 
   * @param params - Query parameters for filtering and pagination
   * @param params.limit - Number of users per page (default: API default)
   * @param params.page - Page number (1-indexed)
   * @param params.search - Search query to filter by email/name
   * @param params.plan - Filter by subscription plan
   * @param params.active_only - Only return active (non-suspended) users
   * @returns Promise resolving to paginated user list
   */
  async getUsers(params?: {
    limit?: number;
    page?: number;
    search?: string;
    plan?: string;
    active_only?: boolean;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.plan) queryParams.append('plan', params.plan);
    if (params?.active_only) queryParams.append('active_only', 'true');
    
    return apiClient.get<{
      success: boolean;
      data: {
        users: any[];
        pagination: {
          total: number;
          limit: number;
          offset: number;
          page: number;
          total_pages: number;
          has_more: boolean;
        };
      };
    }>(`/admin/users?${queryParams.toString()}`);
  },

  /**
   * Toggles admin status for a user
   * 
   * @param userId - ID of the user to modify
   * @returns Promise resolving to updated user data
   */
  async toggleUserAdmin(userId: string) {
    return apiClient.post<{ success: boolean; data: { user: any; message: string } }>(
      `/admin/users/${userId}/toggle-admin`
    );
  },

  /**
   * Toggles active status for a user
   * 
   * @param userId - ID of the user to modify
   * @returns Promise resolving to updated user data
   */
  async toggleUserActive(userId: string) {
    return apiClient.post<{ success: boolean; data: { user: any; message: string } }>(
      `/admin/users/${userId}/toggle-active`
    );
  },

  /**
   * Suspends a user account
   * 
   * @param userId - ID of the user to suspend
   * @param reason - Optional reason for suspension
   * @returns Promise resolving to suspension confirmation
   */
  async suspendUser(userId: string, reason?: string) {
    return apiClient.post<{ success: boolean; data: any }>(
      `/admin/users/${userId}/suspend`,
      { reason }
    );
  },

  /**
   * Reactivates a previously suspended user account
   * 
   * @param userId - ID of the user to reactivate
   * @returns Promise resolving to reactivation confirmation
   */
  async reactivateUser(userId: string) {
    return apiClient.post<{ success: boolean; data: any }>(
      `/admin/users/${userId}/reactivate`
    );
  },

  /**
   * Updates a user's subscription plan
   * 
   * @param userId - ID of the user to update
   * @param plan - New plan identifier (e.g., 'starter', 'pro', 'plus')
   * @returns Promise resolving to updated user data
   */
  async updateUserPlan(userId: string, plan: string) {
    return apiClient.patch<{ success: boolean; data: { user: any; message: string } }>(
      `/admin/users/${userId}/plan`,
      { plan }
    );
  },

  /**
   * Feature Flag Management
   */
  
  /**
   * Retrieves all feature flags, optionally filtered by category
   * 
   * @param category - Optional category filter
   * @returns Promise resolving to flags grouped by category
   */
  async getFeatureFlags(category?: string) {
    const query = category ? `?category=${category}` : '';
    return apiClient.get<{
      success: boolean;
      data: {
        flags: any[];
        flagsByCategory: Record<string, any[]>;
        totalCount: number;
      };
    }>(`/admin/feature-flags${query}`);
  },

  /**
   * Updates a feature flag's configuration
   * 
   * @param flagKey - Unique identifier for the feature flag
   * @param updates - Flag properties to update
   * @param updates.is_enabled - Whether the flag is enabled
   * @param updates.flag_value - Value of the flag (can be boolean, string, or number)
   * @param updates.description - Optional description update
   * @returns Promise resolving to updated flag data
   */
  async updateFeatureFlag(flagKey: string, updates: {
    is_enabled?: boolean;
    flag_value?: any;
    description?: string;
  }) {
    return apiClient.put<{
      success: boolean;
      data: { flag: any; message: string };
    }>(`/admin/feature-flags/${flagKey}`, updates);
  },

  /**
   * Plan Configuration
   */
  
  /**
   * Retrieves all subscription plans with user counts
   * 
   * @returns Promise resolving to plans data with total user counts per plan
   */
  async getPlans() {
    return apiClient.get<{
      success: boolean;
      data: { plans: any[]; totalUsers: number };
    }>('/admin/plans');
  },

  /**
   * Updates a subscription plan's configuration
   * 
   * @param planId - ID of the plan to update
   * @param updates - Plan configuration updates
   * @returns Promise resolving to updated plan data
   */
  async updatePlan(planId: string, updates: any) {
    return apiClient.put<{
      success: boolean;
      message: string;
      data: { planId: string; updatedLimits: any };
    }>(`/admin/plans/${planId}`, updates);
  },

  /**
   * Retrieves plan limits configuration
   * 
   * @param planId - Optional specific plan ID, or undefined for all plans
   * @returns Promise resolving to plan limits data
   */
  async getPlanLimits(planId?: string) {
    const endpoint = planId ? `/admin/plan-limits/${planId}` : '/admin/plan-limits';
    return apiClient.get<{
      success: boolean;
      data: { plans?: any[]; planId?: string; limits?: any; last_updated: string };
    }>(endpoint);
  },

  /**
   * Updates plan limits for a specific subscription plan
   * 
   * @param planId - ID of the plan to update
   * @param updates - Limits configuration to apply
   * @returns Promise resolving to updated limits data
   */
  async updatePlanLimits(planId: string, updates: any) {
    return apiClient.put<{
      success: boolean;
      data: { planId: string; limits: any; updated_at: string; updated_by: string };
    }>(`/admin/plan-limits/${planId}`, updates);
  },

  /**
   * Tone Management
   */
  
  /**
   * Retrieves all configured roast tones
   * 
   * @returns Promise resolving to array of tone configurations
   */
  async getTones() {
    return apiClient.get<{ success: boolean; data: any[] }>('/admin/tones');
  },

  /**
   * Updates a roast tone's configuration
   * 
   * @param toneId - ID of the tone to update
   * @param updates - Tone properties to update (intensity, examples, etc.)
   * @returns Promise resolving to updated tone data
   */
  async updateTone(toneId: string, updates: any) {
    return apiClient.put<{ success: boolean; data: any }>(`/admin/tones/${toneId}`, updates);
  },

  /**
   * Dashboard and Metrics
   */
  
  /**
   * Retrieves dashboard metrics and statistics
   * 
   * @returns Promise resolving to aggregated dashboard data
   */
  async getDashboardMetrics() {
    return apiClient.get<{ success: boolean; data: any }>('/admin/dashboard');
  },

  /**
   * Retrieves system monitoring and performance metrics
   * 
   * @returns Promise resolving to monitoring and performance data
   */
  async getMetrics() {
    return apiClient.get<{
      success: boolean;
      data: {
        monitoring: any;
        performance: any;
        timestamp: string;
      };
    }>('/monitoring/metrics');
  },
};

