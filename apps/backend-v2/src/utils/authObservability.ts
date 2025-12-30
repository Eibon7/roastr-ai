/**
 * Auth Observability Helpers (V2) - ROA-410
 *
 * Convenience helpers for common auth observability patterns.
 * These functions wrap authObservabilityService with common use cases.
 *
 * Usage:
 * ```typescript
 * import { logLoginAttempt, trackAuthDuration } from './authObservability';
 *
 * const startTime = Date.now();
 * try {
 *   await authService.login(params);
 *   logLoginAttempt(context, true);
 *   trackAuthDuration('login', context, Date.now() - startTime);
 * } catch (error) {
 *   logLoginAttempt(context, false, asAuthError(error));
 * }
 * ```
 */

import { authObservability, AuthEventContext } from '../services/authObservabilityService.js';
import { AuthError, failClosedAuthError } from './authErrorTaxonomy.js';
import { isAuthError } from './authErrorTaxonomy.js';

/**
 * Convert unknown error to AuthError
 */
function asAuthError(error: unknown): AuthError {
  if (isAuthError(error)) {
    return error;
  }
  return failClosedAuthError(error);
}

/**
 * Log login attempt (success or failure)
 */
export function logLoginAttempt(
  context: AuthEventContext,
  success: boolean,
  error?: AuthError | unknown
): void {
  const authError = error ? asAuthError(error) : undefined;
  authObservability.logLoginAttempt(context, success, authError);
}

/**
 * Log register attempt (success or failure)
 */
export function logRegisterAttempt(
  context: AuthEventContext,
  success: boolean,
  error?: AuthError | unknown
): void {
  const authError = error ? asAuthError(error) : undefined;
  if (success) {
    authObservability.logAuthEvent('info', 'auth.register.success', context);
    authObservability.trackAuthEvent('register_success', context);
  } else {
    authObservability.logAuthError(context, authError || failClosedAuthError());
    authObservability.trackAuthEvent('register_failed', context, {
      error_slug: authError?.slug || 'AUTH_UNKNOWN'
    });
  }
}

/**
 * Log magic link request
 */
export function logMagicLinkRequest(
  context: AuthEventContext,
  success: boolean,
  error?: AuthError | unknown
): void {
  const authError = error ? asAuthError(error) : undefined;
  if (success) {
    authObservability.logAuthEvent('info', 'auth.magic_link.requested', context);
    authObservability.trackAuthEvent('magic_link_requested', context);
  } else {
    authObservability.logAuthError(context, authError || failClosedAuthError());
    authObservability.trackAuthEvent('magic_link_failed', context, {
      error_slug: authError?.slug || 'AUTH_UNKNOWN'
    });
  }
}

/**
 * Log password recovery request
 */
export function logPasswordRecoveryRequest(
  context: AuthEventContext,
  success: boolean,
  error?: AuthError | unknown
): void {
  const authError = error ? asAuthError(error) : undefined;
  if (success) {
    authObservability.logAuthEvent('info', 'auth.password_recovery.requested', context);
    authObservability.trackAuthEvent('password_recovery_requested', context);
  } else {
    authObservability.logAuthError(context, authError || failClosedAuthError());
    authObservability.trackAuthEvent('password_recovery_failed', context, {
      error_slug: authError?.slug || 'AUTH_UNKNOWN'
    });
  }
}

/**
 * Log logout
 */
export function logLogout(context: AuthEventContext): void {
  authObservability.logAuthEvent('info', 'auth.logout', context);
  authObservability.trackAuthEvent('logout', context);
}

/**
 * Log session refresh
 */
export function logSessionRefresh(context: AuthEventContext, success: boolean): void {
  if (success) {
    authObservability.logAuthEvent('info', 'auth.session.refresh.success', context);
    authObservability.trackAuthEvent('session_refresh_success', context);
  } else {
    authObservability.logAuthEvent('warn', 'auth.session.refresh.failed', context);
    authObservability.trackAuthEvent('session_refresh_failed', context);
  }
}

/**
 * Log rate limit event
 */
export function logRateLimit(context: AuthEventContext, reason: string): void {
  authObservability.logRateLimit(context, reason);
}

/**
 * Log auth error
 */
export function logAuthError(context: AuthEventContext, error: AuthError | unknown): void {
  const authError = asAuthError(error);
  authObservability.logAuthError(context, authError);
}

/**
 * Track auth duration (latency)
 */
export function trackAuthDuration(
  event: string,
  context: AuthEventContext,
  durationMs: number
): void {
  authObservability.trackAuthDuration(event, context, durationMs);
}

/**
 * Track auth attempt
 */
export function trackAuthAttempt(
  flow: AuthEventContext['flow'],
  context: AuthEventContext,
  success: boolean
): void {
  authObservability.trackAuthAttempt(flow, context, success);
}

/**
 * Create auth event context from request
 */
export function createAuthContext(req: any, additional?: Partial<AuthEventContext>): AuthEventContext {
  const requestId = (req as any)?.request_id || req.headers['x-request-id'] || undefined;
  const correlationId = req.headers['x-correlation-id'] || undefined;
  const ip = (req as any)?.ip || req.socket?.remoteAddress || undefined;

  return {
    request_id: requestId,
    correlation_id: correlationId,
    ip,
    ...additional
  };
}

