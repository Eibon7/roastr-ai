/**
 * CSRF Token Utility for Admin Frontend (Issue #745)
 *
 * Provides functions to read CSRF token from cookies and headers
 * for inclusion in state-modifying API requests.
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
 */

/**
 * Get CSRF token from cookies
 *
 * Reads the 'csrf-token' cookie set by the backend middleware.
 * This token must be included in the X-CSRF-Token header for
 * all state-modifying requests (POST, PUT, PATCH, DELETE).
 *
 * @returns {string|null} CSRF token or null if not found
 *
 * @example
 * const token = getCsrfToken();
 * if (token) {
 *   headers['X-CSRF-Token'] = token;
 * }
 */
export function getCsrfToken() {
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrf-token') {
      return value;
    }
  }
  return null;
}

/**
 * Get CSRF token from response headers
 *
 * Used for debugging and initial token acquisition.
 * Backend sends X-CSRF-Token header when setting the cookie.
 *
 * @param {Headers} headers - Response headers object
 * @returns {string|null} CSRF token or null if not found
 *
 * @example
 * const response = await fetch('/api/admin/...');
 * const token = getCsrfTokenFromHeader(response.headers);
 */
export function getCsrfTokenFromHeader(headers) {
  return headers.get('X-CSRF-Token') || headers.get('x-csrf-token');
}
