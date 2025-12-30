/**
 * Auth Observability Service (V2) - ROA-410
 *
 * Centralized observability for authentication events:
 * - Structured logging with correlation IDs and request IDs
 * - Metrics tracking (attempts, errors, durations, rate limits)
 * - Event tracking via Amplitude
 * - PII sanitization (emails truncated, IPs prefixed)
 *
 * Usage:
 * ```typescript
 * import { authObservability } from './authObservabilityService';
 *
 * authObservability.logAuthEvent('info', 'auth.login.success', {
 *   request_id: 'req_123',
 *   user_id: 'user_456',
 *   flow: 'login'
 * });
 * ```
 */

import { logger } from '../utils/logger.js';
import { trackEvent } from '../lib/analytics.js';
import { truncateEmailForLog } from '../utils/pii.js';
import { AuthError } from '../utils/authErrorTaxonomy.js';

/**
 * Context for auth events
 */
export interface AuthEventContext {
  request_id?: string;
  correlation_id?: string;
  user_id?: string;
  email?: string; // Will be truncated for logs
  ip?: string; // Will be prefixed for logs
  flow?: 'login' | 'register' | 'magic_link' | 'password_recovery' | 'logout' | 'refresh';
  [key: string]: any;
}

/**
 * Auth metric for tracking
 */
export interface AuthMetric {
  event: string;
  timestamp: number;
  context: AuthEventContext;
  metadata?: Record<string, any>;
}

/**
 * Sanitize context to remove/sanitize PII
 */
function sanitizeContext(context: AuthEventContext): Record<string, any> {
  const sanitized: Record<string, any> = {};

  // Copy safe fields
  if (context.request_id) sanitized.request_id = context.request_id;
  if (context.correlation_id) sanitized.correlation_id = context.correlation_id;
  if (context.user_id) sanitized.user_id = context.user_id;
  if (context.flow) sanitized.flow = context.flow;

  // Sanitize email (truncate)
  if (context.email) {
    sanitized.email = truncateEmailForLog(context.email);
  }

  // Sanitize IP (prefix only)
  if (context.ip) {
    const parts = context.ip.split('.');
    if (parts.length >= 2) {
      sanitized.ip_prefix = `${parts[0]}.${parts[1]}.x.x`;
    } else {
      sanitized.ip_prefix = 'x.x.x.x';
    }
  }

  // Copy other safe fields (exclude sensitive)
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'credential'];
  for (const [key, value] of Object.entries(context)) {
    if (
      !sensitiveKeys.some((sk) => key.toLowerCase().includes(sk)) &&
      !['email', 'ip'].includes(key)
    ) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Auth Observability Service
 */
class AuthObservabilityService {
  /**
   * Log auth event with structured logging
   */
  logAuthEvent(
    level: 'info' | 'warn' | 'error',
    event: string,
    context: AuthEventContext
  ): void {
    const sanitizedContext = sanitizeContext(context);

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'auth',
      event,
      ...sanitizedContext
    };

    // Use logger with JSON stringification for structured logging
    const logMessage = JSON.stringify(logEntry);
    logger[level](logMessage);
  }

  /**
   * Track auth metric
   */
  trackAuthMetric(metric: AuthMetric): void {
    // Log structured metric
    this.logAuthEvent('info', `auth.metric.${metric.event}`, metric.context);

    // Track via Amplitude
    trackEvent({
      userId: metric.context.user_id,
      event: `auth_${metric.event}`,
      properties: {
        ...metric.metadata,
        flow: metric.context.flow
      },
      context: {
        flow: 'auth',
        request_id: metric.context.request_id
      }
    });
  }

  /**
   * Track auth event via Amplitude
   */
  trackAuthEvent(
    event: string,
    context: AuthEventContext,
    properties?: Record<string, any>
  ): void {
    trackEvent({
      userId: context.user_id,
      event: `auth_${event}`,
      properties: {
        ...properties,
        flow: context.flow
      },
      context: {
        flow: 'auth',
        request_id: context.request_id,
        correlation_id: context.correlation_id
      }
    });
  }

  /**
   * Log login attempt
   */
  logLoginAttempt(context: AuthEventContext, success: boolean, error?: AuthError): void {
    if (success) {
      this.logAuthEvent('info', 'auth.login.success', context);
      this.trackAuthEvent('login_success', context);
    } else {
      this.logAuthError(context, error || new AuthError('AUTH_UNKNOWN'));
      this.trackAuthEvent('login_failed', context, {
        error_slug: error?.slug || 'AUTH_UNKNOWN'
      });
    }
  }

  /**
   * Log rate limit event
   */
  logRateLimit(context: AuthEventContext, reason: string): void {
    this.logAuthEvent('warn', 'auth.rate_limit', {
      ...context,
      reason
    });
    this.trackAuthEvent('rate_limited', context, { reason });
  }

  /**
   * Log auth error
   */
  logAuthError(context: AuthEventContext, error: AuthError): void {
    this.logAuthEvent('error', 'auth.error', {
      ...context,
      error_slug: error.slug,
      error_category: error.category,
      error_retryable: error.retryable,
      http_status: error.http_status
    });
    this.trackAuthEvent('error', context, {
      error_slug: error.slug,
      error_category: error.category,
      error_retryable: error.retryable
    });
  }

  /**
   * Track auth duration (latency)
   */
  trackAuthDuration(
    event: string,
    context: AuthEventContext,
    durationMs: number
  ): void {
    this.trackAuthMetric({
      event: `${event}.duration`,
      timestamp: Date.now(),
      context,
      metadata: {
        duration_ms: durationMs
      }
    });
  }

  /**
   * Track auth attempt
   */
  trackAuthAttempt(
    flow: AuthEventContext['flow'],
    context: AuthEventContext,
    success: boolean
  ): void {
    this.trackAuthMetric({
      event: `${flow}.attempt`,
      timestamp: Date.now(),
      context: { ...context, flow },
      metadata: {
        success
      }
    });
  }
}

// Singleton instance
export const authObservability = new AuthObservabilityService();

