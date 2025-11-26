/**
 * API Client for Roastr.ai
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private getCsrfToken(): string | null {
    // Extract CSRF token from cookies
    const cookies = document.cookie.split(';');
    const csrfCookie = cookies.find((cookie) => cookie.trim().startsWith('csrf-token='));
    if (csrfCookie) {
      return csrfCookie.split('=')[1];
    }
    return null;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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

    if (!response.ok) {
      const error: ApiError = {
        message: `HTTP error! status: ${response.status}`,
        status: response.status
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

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();

// Auth API
export const authApi = {
  async me() {
    return apiClient.get<{ success: boolean; data: User }>('/auth/me');
  },

  async login(email: string, password: string) {
    return apiClient.post<{ success: boolean; token: string; user: User }>('/auth/login', {
      email,
      password
    });
  },

  async logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  }
};

export interface User {
  id: string;
  email: string;
  name?: string;
  is_admin?: boolean;
  organization_id?: string;
}

// Admin API
export const adminApi = {
  // Users
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

  async toggleUserAdmin(userId: string) {
    return apiClient.post<{ success: boolean; data: { user: any; message: string } }>(
      `/admin/users/${userId}/toggle-admin`
    );
  },

  async toggleUserActive(userId: string) {
    return apiClient.post<{ success: boolean; data: { user: any; message: string } }>(
      `/admin/users/${userId}/toggle-active`
    );
  },

  async suspendUser(userId: string, reason?: string) {
    return apiClient.post<{ success: boolean; data: any }>(`/admin/users/${userId}/suspend`, {
      reason
    });
  },

  async reactivateUser(userId: string) {
    return apiClient.post<{ success: boolean; data: any }>(`/admin/users/${userId}/reactivate`);
  },

  async updateUserPlan(userId: string, plan: string) {
    return apiClient.patch<{ success: boolean; data: { user: any; message: string } }>(
      `/admin/users/${userId}/plan`,
      { plan }
    );
  },

  // Feature Flags
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

  // Plans
  async getPlans() {
    return apiClient.get<{
      success: boolean;
      data: { plans: any[]; totalUsers: number };
    }>('/admin/plans');
  },

  async updatePlan(planId: string, updates: any) {
    return apiClient.put<{
      success: boolean;
      message: string;
      data: { planId: string; updatedLimits: any };
    }>(`/admin/plans/${planId}`, updates);
  },

  async getPlanLimits(planId?: string) {
    const endpoint = planId ? `/admin/plan-limits/${planId}` : '/admin/plan-limits';
    return apiClient.get<{
      success: boolean;
      data: { plans?: any[]; planId?: string; limits?: any; last_updated: string };
    }>(endpoint);
  },

  async updatePlanLimits(planId: string, updates: any) {
    return apiClient.put<{
      success: boolean;
      data: { planId: string; limits: any; updated_at: string; updated_by: string };
    }>(`/admin/plan-limits/${planId}`, updates);
  },

  // Tones
  async getTones() {
    return apiClient.get<{ success: boolean; data: any[] }>('/admin/tones');
  },

  async updateTone(toneId: string, updates: any) {
    return apiClient.put<{ success: boolean; data: any }>(`/admin/tones/${toneId}`, updates);
  },

  // Dashboard/Metrics
  async getDashboardMetrics() {
    return apiClient.get<{ success: boolean; data: any }>('/admin/dashboard');
  },

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
