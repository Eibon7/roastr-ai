/**
 * Token Storage Utility
 *
 * Manages authentication tokens in localStorage.
 * localStorage is the single source of truth for tokens (no in-memory storage).
 *
 * Token Lifetime Assumptions (from backend v2 / SSOT v2):
 * - Access token TTL: 1 hour
 * - Refresh token TTL: 7 days
 *
 * No custom token persistence beyond what Supabase already provides (localStorage is sufficient).
 * No JWT decoding or expiration checks - backend will return 401 if expired.
 */

const ACCESS_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

/**
 * Retrieves the access token from localStorage
 *
 * @returns The access token string or null if not found
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Retrieves the refresh token from localStorage
 *
 * @returns The refresh token string or null if not found
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Stores both access and refresh tokens in localStorage
 *
 * @param accessToken - The access token to store
 * @param refreshToken - The refresh token to store
 */
export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

/**
 * Clears both tokens from localStorage
 */
export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Checks if both tokens are available
 *
 * @returns true if both access and refresh tokens exist
 */
export function hasTokens(): boolean {
  return getAccessToken() !== null && getRefreshToken() !== null;
}

