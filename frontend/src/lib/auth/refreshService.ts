/**
 * Refresh Token Service
 *
 * Handles token refresh using the backend v2 refresh endpoint.
 * Uses token storage utility to read/write tokens from localStorage.
 *
 * Endpoint: POST /api/v2/auth/refresh
 * Request: { refresh_token: string }
 * Response: { session: { access_token, refresh_token, ... }, message }
 *
 * Note: Uses direct fetch() instead of apiClient to avoid circular dependency
 * (apiClient uses refreshService, so refreshService cannot use apiClient).
 */

import { getRefreshToken, setTokens, clearTokens } from './tokenStorage';
import { apiClient } from '../api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Response format from backend v2 refresh endpoint
 */
interface RefreshResponse {
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at: number;
    token_type: string;
  };
  message: string;
}

/**
 * Refreshes the access token using the refresh token
 *
 * @returns Promise resolving to new access and refresh tokens
 * @throws {Error} If refresh fails (invalid/expired refresh token)
 */
export async function refreshAccessToken(): Promise<{
  access_token: string;
  refresh_token: string;
}> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    // Call backend v2 refresh endpoint
    const response = await fetch(`${API_BASE_URL}/v2/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      credentials: 'include'
    });

    if (!response.ok) {
      // Parse error response
      let errorMessage = 'Token refresh failed';
      let errorCode: string | undefined;

      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorData.message || errorMessage;
        errorCode = errorData.error?.code;
      } catch {
        // If response is not JSON, use default error message
      }

      // Clear tokens on refresh failure
      clearTokens();

      const error = new Error(errorMessage) as Error & { code?: string; status?: number };
      error.code = errorCode;
      error.status = response.status;

      throw error;
    }

    const data: RefreshResponse = await response.json();

    if (!data.session?.access_token || !data.session?.refresh_token) {
      clearTokens();
      throw new Error('Invalid refresh response: missing tokens');
    }

    // Update tokens in localStorage
    setTokens(data.session.access_token, data.session.refresh_token);

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    };
  } catch (error) {
    // If it's already an Error with code/status, re-throw
    if (error instanceof Error && 'code' in error) {
      throw error;
    }

    // Otherwise, wrap in generic error
    clearTokens();
    throw new Error('Token refresh failed');
  }
}

