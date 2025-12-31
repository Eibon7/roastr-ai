/**
 * Auth Observability Helpers (V2) - ROA-410
 *
 * Spec-compliant helpers for auth observability with:
 * - Correct event names (auth_flow_started, auth_flow_completed, auth_flow_failed, auth_flow_blocked)
 * - Specific metric counters (auth_requests_total, auth_success_total, auth_failures_total, auth_blocks_total)
 * - Feature flag disabled handling
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
 * Log auth flow started (emits auth_flow_started + increments auth_requests_total)
 * Call this at the beginning of ANY auth flow
 */
export function logAuthFlowStarted(context: AuthEventContext): void {
  authObservability.logAuthEvent('info', 'auth.flow.started', context);
  authObservability.trackAuthEvent('flow_started', context, { flow: context.flow });
  authObservability.trackMetricCounter('auth_requests_total', context, { flow: context.flow });
}

/**
 * Log login attempt with spec-compliant events
 * - Success: auth_flow_completed + auth_success_total++
 * - Failure: auth_flow_failed + auth_failures_total++
 */
export function logLoginAttempt(
  context: AuthEventContext,
  success: boolean,
  error?: AuthError | unknown
): void {
  const authError = error ? asAuthError(error) : undefined;
  authObservability.trackMetricCounter('auth_requests_total', context, { flow: 'login' });

  if (success) {
    authObservability.logAuthEvent('info', 'auth.flow.completed', context);
    authObservability.trackAuthEvent('flow_completed', context, { flow: 'login' });
    authObservability.trackMetricCounter('auth_success_total', context, { flow: 'login' });
  } else {
    authObservability.logAuthError(context, authError || failClosedAuthError());
    authObservability.trackAuthEvent('flow_failed', context, {
      flow: 'login',
      error_slug: authError?.slug || 'AUTH_UNKNOWN'
    });
    authObservability.trackMetricCounter('auth_failures_total', context, {
      flow: 'login',
      error_slug: authError?.slug || 'AUTH_UNKNOWN'
    });
  }
}

/**
 * Log register attempt with spec-compliant events
 */
export function logRegisterAttempt(
  context: AuthEventContext,
  success: boolean,
  error?: AuthError | unknown
): void {
  const authError = error ? asAuthError(error) : undefined;
  authObservability.trackMetricCounter('auth_requests_total', context, { flow: 'register' });

  if (success) {
    authObservability.logAuthEvent('info', 'auth.flow.completed', context);
    authObservability.trackAuthEvent('flow_completed', context, { flow: 'register' });
    authObservability.trackMetricCounter('auth_success_total', context, { flow: 'register' });
  } else {
    authObservability.logAuthError(context, authError || failClosedAuthError());
    authObservability.trackAuthEvent('flow_failed', context, {
      flow: 'register',
      error_slug: authError?.slug || 'AUTH_UNKNOWN'
    });
    authObservability.trackMetricCounter('auth_failures_total', context, {
      flow: 'register',
      error_slug: authError?.slug || 'AUTH_UNKNOWN'
    });
  }
}

/**
 * Log magic link request with spec-compliant events
 */
export function logMagicLinkRequest(
  context: AuthEventContext,
  success: boolean,
  error?: AuthError | unknown
): void {
  const authError = error ? asAuthError(error) : undefined;
  authObservability.trackMetricCounter('auth_requests_total', context, { flow: 'magic_link' });

  if (success) {
    authObservability.logAuthEvent('info', 'auth.flow.completed', context);
    authObservability.trackAuthEvent('flow_completed', context, { flow: 'magic_link' });
    authObservability.trackMetricCounter('auth_success_total', context, { flow: 'magic_link' });
  } else {
    authObservability.logAuthError(context, authError || failClosedAuthError());
    authObservability.trackAuthEvent('flow_failed', context, {
      flow: 'magic_link',
      error_slug: authError?.slug || 'AUTH_UNKNOWN'
    });
    authObservability.trackMetricCounter('auth_failures_total', context, {
      flow: 'magic_link',
      error_slug: authError?.slug || 'AUTH_UNKNOWN'
    });
  }
}

/**
 * Log password recovery request with spec-compliant events
 */
export function logPasswordRecoveryRequest(
  context: AuthEventContext,
  success: boolean,
  error?: AuthError | unknown
): void {
  const authError = error ? asAuthError(error) : undefined;
  authObservability.trackMetricCounter('auth_requests_total', context, {
    flow: 'password_recovery'
  });

  if (success) {
    authObservability.logAuthEvent('info', 'auth.flow.completed', context);
    authObservability.trackAuthEvent('flow_completed', context, { flow: 'password_recovery' });
    authObservability.trackMetricCounter('auth_success_total', context, {
      flow: 'password_recovery'
    });
  } else {
    authObservability.logAuthError(context, authError || failClosedAuthError());
    authObservability.trackAuthEvent('flow_failed', context, {
      flow: 'password_recovery',
      error_slug: authError?.slug || 'AUTH_UNKNOWN'
    });
    authObservability.trackMetricCounter('auth_failures_total', context, {
      flow: 'password_recovery',
      error_slug: authError?.slug || 'AUTH_UNKNOWN'
    });
  }
}

/**
 * Log rate limit event (emits auth_flow_blocked + increments auth_blocks_total)
 */
export function logRateLimit(context: AuthEventContext, reason: string): void {
  authObservability.logAuthEvent('warn', 'auth.rate_limit', {
    ...context,
    reason
  });
  authObservability.trackAuthEvent('flow_blocked', context, {
    flow: context.flow,
    reason: 'rate_limit',
    details: reason
  });
  authObservability.trackMetricCounter('auth_blocks_total', context, {
    flow: context.flow,
    reason: 'rate_limit'
  });
}

/**
 * Log feature disabled (emits auth_flow_blocked + increments auth_blocks_total)
 * Called when a feature flag disables an auth flow
 */
export function logFeatureDisabled(
  context: AuthEventContext,
  featureFlag: string,
  reason?: string
): void {
  authObservability.logAuthEvent('warn', 'auth.feature_disabled', {
    ...context,
    feature_flag: featureFlag,
    reason: reason || 'feature_disabled'
  });
  authObservability.trackAuthEvent('flow_blocked', context, {
    flow: context.flow,
    reason: 'feature_disabled',
    feature_flag: featureFlag
  });
  authObservability.trackMetricCounter('auth_blocks_total', context, {
    flow: context.flow,
    reason: 'feature_disabled',
    feature_flag: featureFlag
  });
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
 * Create auth event context from request
 */
export function createAuthContext(
  req: any,
  additional?: Partial<AuthEventContext>
): AuthEventContext {
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
