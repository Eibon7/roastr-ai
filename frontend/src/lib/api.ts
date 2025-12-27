/**
 * API Client for Roastr.ai
 *
 * Provides a centralized HTTP client with authentication, CSRF protection,
 * and standardized error handling for all API requests.
 *
 * Features:
 * - Automatic token injection from localStorage (single source of truth)
 * - CSRF token handling from cookies
 * - Request/response interceptors
 * - Type-safe generic methods
 * - Automatic 401 retry with token refresh (max 1 retry)
 * - FIFO queue for concurrent requests during refresh
 *
 * ## 401 Retry Logic
 *
 * When a protected endpoint returns 401:
 * 1. Check if endpoint is auth endpoint → skip retry, throw error immediately
 * 2. If already refreshing → queue request in FIFO order
 * 3. If not refreshing → start refresh process
 * 4. On refresh success → retry original request exactly once (max 1 retry)
 * 5. On refresh failure → reject all queued requests, clear tokens, redirect to login
 *
 * **Constraints:**
 * - Max 1 retry attempt per request (hard limit)
 * - Block retry if refresh fails
 * - Block retry for auth endpoints themselves
 * - Concurrent 401s queue behind single refresh (FIFO order)
 *
 * ## FIFO Queue
 *
 * The `_pendingRequests` array maintains a First-In-First-Out queue:
 * - Requests are added in order received
 * - After refresh completes, requests are processed in same order
 * - If refresh fails, all queued requests rejected in FIFO order
 *
 * ## Error Handling
 *
 * - **401 (after refresh failure):** Clear tokens, redirect to login, show toast once
 * - **403:** Show "Access denied" message, no redirect
 * - **429:** Per-action backoff (not global lock), disable specific action button
 */

import { getAccessToken, clearTokens } from './auth/tokenStorage';
import { refreshAccessToken } from './auth/refreshService';
import { handleAuthError, getLoginRedirect } from './auth/errorHandler';

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
/**
 * Pending request in the retry queue
 */
interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: ApiError) => void;
  endpoint: string;
  options: RequestInit;
}

class ApiClient {
  private baseURL: string;
  
  /**
   * Flag to prevent concurrent refresh calls
   * Only one refresh operation can be in progress at a time.
   */
  private _isRefreshing: boolean = false;
  
  /**
   * FIFO queue for requests waiting on token refresh
   * 
   * When multiple requests receive 401 simultaneously, they are queued here
   * in First-In-First-Out order. Once refresh completes, all queued requests
   * are retried in the same order they were received.
   * 
   * Queue is cleared if refresh fails (all requests rejected).
   */
  private _pendingRequests: PendingRequest<any>[] = [];

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
   * Uses tokenStorage as single source of truth.
   *
   * @returns The auth token string or null if not found
   */
  private getAuthToken(): string | null {
    return getAccessToken();
  }
  
  /**
   * Checks if an endpoint is an auth endpoint (no retry on 401)
   * 
   * Auth endpoints don't require authentication, so 401 means
   * authentication failed (not expired token). No retry needed.
   * 
   * @param endpoint - API endpoint path
   * @returns true if endpoint is an auth endpoint
   */
  private isAuthEndpoint(endpoint: string): boolean {
    const authEndpoints = [
      '/auth/login',
      '/auth/signup',
      '/auth/refresh',
      '/auth/magic-link',
      '/auth/reset-password',
      '/v2/auth/login',
      '/v2/auth/signup',
      '/v2/auth/refresh',
      '/v2/auth/magic-link',
      '/v2/auth/reset-password'
    ];
    
    return authEndpoints.some(authEndpoint => endpoint.includes(authEndpoint));
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
    const csrfCookie = cookies.find((cookie) => cookie.trim().startsWith('csrf-token='));
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
   * Handles 401 Unauthorized with automatic token refresh and retry:
   * - Detects 401 responses
   * - Refreshes token if available
   * - Retries original request once (max 1 retry)
   * - Queues concurrent requests during refresh (FIFO)
   * - Blocks retry for auth endpoints
   * - Blocks retry if refresh fails
   *
   * @template T - Expected response type
   * @param endpoint - API endpoint path (relative to baseURL)
   * @param options - Fetch API options (method, body, headers, etc.)
   * @param isRetry - Internal flag to track if this is a retry attempt (max 1 retry)
   * @returns Promise resolving to the typed response data
   * @throws {ApiError} If the request fails or returns an error status
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry: boolean = false
  ): Promise<T> {
    const token = this.getAuthToken();
    const csrfToken = this.getCsrfToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>)
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
      credentials: 'include' // Include cookies for CSRF token
    });

    // Handle 401 Unauthorized with token refresh and retry
    if (response.status === 401 && !isRetry) {
      // Block retry for auth endpoints (401 means auth failed, not expired token)
      if (this.isAuthEndpoint(endpoint)) {
        const error: ApiError = {
          message: 'Authentication failed',
          status: 401
        };
        try {
          const errorData = await response.json();
          error.message = errorData.error?.message || errorData.message || error.message;
          error.code = errorData.error?.code;
        } catch {
          // If response is not JSON, use default error message
        }
        throw error;
      }

      // If already refreshing, queue this request (FIFO)
      if (this._isRefreshing) {
        return new Promise<T>((resolve, reject) => {
          this._pendingRequests.push({
            resolve,
            reject,
            endpoint,
            options
          });
        });
      }

      // Start refresh process
      this._isRefreshing = true;

      try {
        // Refresh token
        await refreshAccessToken();

        // Get new token
        const newToken = this.getAuthToken();
        if (!newToken) {
          throw new Error('Token refresh failed: no new token');
        }

        // Update Authorization header with new token
        headers['Authorization'] = `Bearer ${newToken}`;

        // Retry original request with new token (max 1 retry)
        const retryResponse = await fetch(`${this.baseURL}${endpoint}`, {
          ...options,
          headers,
          credentials: 'include'
        });

        // Process retry response
        if (!retryResponse.ok) {
          const error: ApiError = {
            message: `HTTP error! status: ${retryResponse.status}`,
            status: retryResponse.status
          };

          try {
            const errorData = await retryResponse.json();
            error.message = errorData.error?.message || errorData.message || error.message;
            error.code = errorData.error?.code;
          } catch {
            // If response is not JSON, use default error message
          }

          // Retry failed - reject all queued requests
          this._rejectPendingRequests(error);
          throw error;
        }

        // Retry successful - process response
        const contentType = retryResponse.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const result = {} as T;
          this._resolvePendingRequests();
          return result;
        }

        const data = await retryResponse.json();
        
        // Resolve all queued requests (FIFO order)
        this._resolvePendingRequests();
        
        return data;
      } catch (refreshError) {
        // Refresh failed - reject all queued requests and redirect to login
        const error: ApiError = {
          message: refreshError instanceof Error ? refreshError.message : 'Token refresh failed',
          status: 401,
          code: 'TOKEN_REFRESH_FAILED'
        };
        
        // Handle error UX (redirect to login, show toast)
        handleAuthError(error, getLoginRedirect());
        
        this._rejectPendingRequests(error);
        throw error;
      } finally {
        this._isRefreshing = false;
      }
    }

    // Handle non-401 errors (403, 429, etc.)
    if (!response.ok) {
      const error: ApiError = {
        message: `HTTP error! status: ${response.status}`,
        status: response.status
      };

      try {
        const errorData = await response.json();
        error.message = errorData.error?.message || errorData.message || error.message;
        error.code = errorData.error?.code;
        
        // Extract retry-after header for 429 errors
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          if (retryAfter) {
            const numericValue = Number(retryAfter);
            if (!isNaN(numericValue) && numericValue > 0) {
              (error as any).retryAfter = numericValue;
            } else {
              const dateValue = Date.parse(retryAfter);
              if (!isNaN(dateValue)) {
                const secondsUntilDate = Math.max(0, Math.floor((dateValue - Date.now()) / 1000));
                (error as any).retryAfter = secondsUntilDate || 60;
              }
            }
          }
        }
      } catch {
        // If response is not JSON, use default error message
      }

      // Handle auth-related errors with UX actions
      if (error.status === 403 || error.status === 429 || error.code?.startsWith('AUTH')) {
        handleAuthError(error, getLoginRedirect());
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
   * Resolves all pending requests in FIFO order after successful refresh
   * 
   * Each queued request is retried with the new token in the order it was received.
   */
  private async _resolvePendingRequests(): Promise<void> {
    const pending = [...this._pendingRequests];
    this._pendingRequests = [];

    // Resolve in FIFO order
    for (const pendingRequest of pending) {
      try {
        // Retry each queued request with new token
        const newToken = this.getAuthToken();
        if (!newToken) {
          pendingRequest.reject({
            message: 'Token refresh failed: no new token',
            status: 401
          });
          continue;
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${newToken}`,
          ...(pendingRequest.options.headers as Record<string, string>)
        };

        const retryResponse = await fetch(
          `${this.baseURL}${pendingRequest.endpoint}`,
          {
            ...pendingRequest.options,
            headers,
            credentials: 'include'
          }
        );

        if (!retryResponse.ok) {
          const error: ApiError = {
            message: `HTTP error! status: ${retryResponse.status}`,
            status: retryResponse.status
          };

          try {
            const errorData = await retryResponse.json();
            error.message = errorData.error?.message || errorData.message || error.message;
            error.code = errorData.error?.code;
          } catch {
            // If response is not JSON, use default error message
          }

          pendingRequest.reject(error);
        } else {
          const contentType = retryResponse.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            pendingRequest.resolve({} as any);
          } else {
            const data = await retryResponse.json();
            pendingRequest.resolve(data);
          }
        }
      } catch (error) {
        pendingRequest.reject({
          message: error instanceof Error ? error.message : 'Request failed',
          status: 500
        });
      }
    }
  }

  /**
   * Rejects all pending requests when refresh fails
   * 
   * All queued requests are rejected with the same error in FIFO order.
   * 
   * @param error - The error to reject all requests with
   */
  private _rejectPendingRequests(error: ApiError): void {
    const pending = [...this._pendingRequests];
    this._pendingRequests = [];

    // Reject in FIFO order
    for (const pendingRequest of pending) {
      pendingRequest.reject(error);
    }
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
      body: data ? JSON.stringify(data) : undefined
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
      body: data ? JSON.stringify(data) : undefined
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
      body: data ? JSON.stringify(data) : undefined
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
    return apiClient.post<{ success: boolean; token: string; user: User } | { session: { access_token: string; refresh_token?: string; user: User }; message: string }>('/auth/login', {
      email,
      password
    });
  },

  /**
   * Clears authentication data from localStorage
   *
   * Removes both the auth token and user data. Should be called
   * when user explicitly logs out or session expires.
   */
  async logout() {
    clearTokens();
    localStorage.removeItem('user');
  }
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
  /** User's subscription plan */
  plan?: string;
  /** Encrypted persona data (if user has configured persona) */
  lo_que_me_define_encrypted?: string | null;
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
    return apiClient.post<{ success: boolean; data: any }>(`/admin/users/${userId}/suspend`, {
      reason
    });
  },

  /**
   * Reactivates a previously suspended user account
   *
   * @param userId - ID of the user to reactivate
   * @returns Promise resolving to reactivation confirmation
   */
  async reactivateUser(userId: string) {
    return apiClient.post<{ success: boolean; data: any }>(`/admin/users/${userId}/reactivate`);
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
  async updateFeatureFlag(
    flagKey: string,
    updates: {
      is_enabled?: boolean;
      flag_value?: any;
      description?: string;
    }
  ) {
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
  }
};
