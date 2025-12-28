/**
 * Error Handler Utility
 *
 * Maps backend error slugs to user-friendly UX actions.
 * IMPORTANT (ROA-405): Frontend resolves auth errors by `slug`, not by HTTP status.
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
  const slug = error.slug || error.code; // legacy fallback

  // Session/token related errors: redirect to login
  if (
    slug === 'SESSION_EXPIRED' ||
    slug === 'SESSION_INVALID' ||
    slug === 'SESSION_REVOKED' ||
    slug === 'TOKEN_EXPIRED' ||
    slug === 'TOKEN_INVALID' ||
    slug === 'TOKEN_MISSING' ||
    // Client-side synthetic error during refresh (legacy)
    slug === 'TOKEN_REFRESH_FAILED'
  ) {
    if (redirectToLogin && !window.sessionStorage.getItem('_auth_redirecting')) {
      window.sessionStorage.setItem('_auth_redirecting', 'true');
      showToast('Session expired. Please log in again.', 'error');
      setTimeout(() => {
        redirectToLogin();
        window.sessionStorage.removeItem('_auth_redirecting');
      }, 1000);
    }
    return true;
  }

  // Authorization/account blocked
  if (
    slug?.startsWith('AUTHZ_') ||
    slug === 'ACCOUNT_SUSPENDED' ||
    slug === 'ACCOUNT_BANNED' ||
    slug === 'POLICY_BLOCKED'
  ) {
    let message = 'Access denied. You don\'t have permission for this action.';
    
    if (slug === 'AUTHZ_INSUFFICIENT_PERMISSIONS') {
      message = 'You don\'t have permission to perform this action.';
    } else if (slug === 'AUTHZ_ROLE_NOT_ALLOWED' || slug === 'AUTHZ_ADMIN_REQUIRED') {
      message = 'Admin access required.';
    } else if (slug === 'ACCOUNT_SUSPENDED') {
      message = 'Your account has been suspended. Contact support.';
    } else if (slug === 'ACCOUNT_BANNED') {
      message = 'Your account has been banned. Contact support.';
    }
    
    showToast(message, 'error');
    return true;
  }

  // Rate limit (policy)
  if (slug === 'POLICY_RATE_LIMITED') {
    handleRateLimit(error);
    return true;
  }

  // Handle other auth errors
  if (slug?.startsWith('AUTH_')) {
    let message = error.message || 'Authentication failed';
    
    if (slug === 'AUTH_INVALID_CREDENTIALS') {
      message = 'Invalid email or password';
    } else if (slug === 'AUTH_EMAIL_NOT_CONFIRMED') {
      message = 'Please verify your email before logging in';
    } else if (slug === 'AUTH_ACCOUNT_LOCKED') {
      message = 'Your account has been locked. Contact support.';
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

