/**
 * Error Handler Utility
 *
 * Maps backend error codes to user-friendly UX actions.
 * Handles 401 (session expired), 403 (access denied), and 429 (rate limit) errors.
 *
 * Error codes reference: apps/backend-v2/src/utils/authErrorTaxonomy.ts
 */

import { toast } from 'sonner';
import { ApiError } from '../api';

/**
 * Handles authentication/authorization errors with appropriate UX actions
 *
 * @param error - API error with code and message
 * @param redirectToLogin - Function to redirect to login page (optional)
 * @returns true if error was handled, false otherwise
 */
export function handleAuthError(
  error: ApiError,
  redirectToLogin?: () => void
): boolean {
  const code = error.code;
  const status = error.status;

  // Handle 401 errors (session expired, token invalid)
  if (status === 401) {
    if (
      code === 'SESSION_EXPIRED' ||
      code === 'TOKEN_EXPIRED' ||
      code === 'TOKEN_INVALID' ||
      code === 'TOKEN_MISSING' ||
      code === 'TOKEN_REFRESH_FAILED'
    ) {
      // Redirect to login (only once - prevent spam)
      if (redirectToLogin && !window.sessionStorage.getItem('_auth_redirecting')) {
        window.sessionStorage.setItem('_auth_redirecting', 'true');
        
        // Show toast/notification
        showToast('Session expired. Please log in again.', 'error');
        
        // Redirect after short delay
        setTimeout(() => {
          if (redirectToLogin) {
            redirectToLogin();
          }
          window.sessionStorage.removeItem('_auth_redirecting');
        }, 1000);
      }
      return true;
    }
  }

  // Handle 403 errors (access denied)
  if (status === 403) {
    let message = 'Access denied. You don\'t have permission for this action.';
    
    if (code === 'AUTHZ_INSUFFICIENT_PERMISSIONS') {
      message = 'You don\'t have permission to perform this action.';
    } else if (code === 'AUTHZ_ROLE_NOT_ALLOWED') {
      message = 'Admin access required.';
    } else if (code === 'ACCOUNT_SUSPENDED') {
      message = 'Your account has been suspended. Contact support.';
    }
    
    showToast(message, 'error');
    return true;
  }

  // Handle 429 errors (rate limit) - per-action backoff
  if (status === 429) {
    handleRateLimit(error);
    return true;
  }

  // Handle other auth errors
  if (code?.startsWith('AUTH_')) {
    let message = error.message || 'Authentication failed';
    
    if (code === 'AUTH_INVALID_CREDENTIALS') {
      message = 'Invalid email or password';
    } else if (code === 'AUTH_EMAIL_NOT_VERIFIED') {
      message = 'Please verify your email before logging in';
    } else if (code === 'AUTH_ACCOUNT_LOCKED') {
      message = 'Your account has been locked. Contact support.';
    } else if (code === 'AUTH_RATE_LIMIT_EXCEEDED') {
      // Handled separately in handleRateLimit
      return handleRateLimit(error);
    }
    
    showToast(message, 'error');
    return true;
  }

  return false;
}

/**
 * Handles rate limit errors with per-action backoff
 *
 * Each action (endpoint + method) has its own backoff timer.
 * Actions are disabled independently, not globally.
 *
 * @param error - API error with 429 status
 */
function handleRateLimit(error: ApiError): boolean {
  // Extract retry-after from error details or use default
  let retryAfter = 60; // Default: 60 seconds
  
  // Try to get retry-after from error details
  if (error && typeof error === 'object' && 'retryAfter' in error) {
    retryAfter = Number(error.retryAfter) || 60;
  }

  const retrySeconds = Math.ceil(retryAfter);
  const message = `Too many requests. Please wait ${retrySeconds} seconds and try again.`;
  
  showToast(message, 'warning');

  // Per-action backoff: disable only the specific action that triggered 429
  // This is handled at the component level by checking the error
  // The component should disable its own submit button
  
  return true;
}

/**
 * Shows a toast notification using sonner
 *
 * @param message - Message to display
 * @param type - Toast type (error, warning, success, info)
 */
function showToast(message: string, type: 'error' | 'warning' | 'success' | 'info' = 'error'): void {
  // Use sonner toast library (installed as dependency)
  if (typeof window !== 'undefined') {
    switch (type) {
      case 'error':
        toast.error(message);
        break;
      case 'warning':
        toast.warning(message);
        break;
      case 'success':
        toast.success(message);
        break;
      case 'info':
        toast.info(message);
        break;
      default:
        toast(message);
    }
  } else {
    // Fallback to console in non-browser environments (e.g., tests)
    console[type === 'error' ? 'error' : 'warn'](`[Auth] ${message}`);
  }
}

/**
 * Gets the redirect function for login page
 *
 * @returns Function to redirect to login
 */
export function getLoginRedirect(): () => void {
  return () => {
    // Store intended destination for post-login redirect
    const currentPath = window.location.pathname;
    if (currentPath !== '/login' && currentPath !== '/auth/login') {
      window.sessionStorage.setItem('_auth_redirect_path', currentPath);
    }
    
    // Redirect to login
    window.location.href = '/login';
  };
}

