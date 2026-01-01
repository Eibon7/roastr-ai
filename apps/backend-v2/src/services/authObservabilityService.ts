/**
 * Auth Observability Service (V2) - ROA-410
 *
 * Centralized observability for authentication events with:
 * - Structured logging (timestamp, level, service, event, request_id)
 * - Spec-compliant event names (auth_flow_*)
 * - Specific metric counters (auth_*_total)
 * - ENABLE_ANALYTICS feature flag for conditional analytics
 * - PII sanitization (emails truncated, IPs prefixed)
 * - Graceful degradation (try/catch around analytics)
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
   * Always emits logs (regardless of ENABLE_ANALYTICS flag)
   */
  logAuthEvent(level: 'info' | 'warn' | 'error', event: string, context: AuthEventContext): void {
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
   * Track auth event via Amplitude
   * Only emits when ENABLE_ANALYTICS is true (ROA-410 AC)
   * Wrapped in try/catch for graceful degradation (CodeRabbit safety)
   */
  trackAuthEvent(event: string, context: AuthEventContext, properties?: Record<string, any>): void {
    // Check ENABLE_ANALYTICS feature flag
    if (!process.env.ENABLE_ANALYTICS || process.env.ENABLE_ANALYTICS === 'false') {
      return; // Skip analytics when disabled
    }

    try {
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
    } catch (error) {
      // Log error but don't propagate - observability should never break auth flow
      this.logAuthEvent('warn', 'observability.track_event_failed', {
        ...context,
        error: String(error)
      });
    }
  }

  /**
   * Track auth metric
   * Only emits analytics when ENABLE_ANALYTICS is true (ROA-410 AC)
   * Wrapped in try/catch for graceful degradation (CodeRabbit safety)
   */
  trackAuthMetric(metric: AuthMetric): void {
    // Log structured metric (always log, regardless of analytics flag)
    this.logAuthEvent('info', `auth.metric.${metric.event}`, metric.context);

    // Check ENABLE_ANALYTICS feature flag
    if (!process.env.ENABLE_ANALYTICS || process.env.ENABLE_ANALYTICS === 'false') {
      return; // Skip analytics when disabled
    }

    // Track via Amplitude (with error handling)
    try {
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
    } catch (error) {
      // Log error but don't propagate - observability should never break auth flow
      this.logAuthEvent('warn', 'observability.track_metric_failed', {
        ...metric.context,
        error: String(error)
      });
    }
  }

  /**
   * Track specific metric counter with labels
   * ROA-410 AC: auth_requests_total, auth_success_total, auth_failures_total, auth_blocks_total
   */
  trackMetricCounter(
    name:
      | 'auth_requests_total'
      | 'auth_success_total'
      | 'auth_failures_total'
      | 'auth_blocks_total',
    context: AuthEventContext,
    labels: Record<string, any>
  ): void {
    // Log structured counter (always log, regardless of analytics flag)
    this.logAuthEvent('info', `auth.metric.counter.${name}`, {
      ...context,
      ...labels
    });

    // Check ENABLE_ANALYTICS feature flag
    if (!process.env.ENABLE_ANALYTICS || process.env.ENABLE_ANALYTICS === 'false') {
      return; // Skip analytics when disabled
    }

    // Track via Amplitude (with error handling)
    try {
      trackEvent({
        userId: context.user_id,
        event: `auth_metric_${name}`,
        properties: {
          ...labels,
          counter: name
        },
        context: {
          flow: 'auth',
          request_id: context.request_id
        }
      });
    } catch (error) {
      // Log error but don't propagate - observability should never break auth flow
      this.logAuthEvent('warn', 'observability.track_counter_failed', {
        ...context,
        error: String(error)
      });
    }
  }

  /**
   * Log auth error with full details
   */
  logAuthError(context: AuthEventContext, error: AuthError): void {
    this.logAuthEvent('error', 'auth.error', {
      ...context,
      error_slug: error.slug,
      error_category: error.category,
      error_retryable: error.retryable,
      http_status: error.http_status
    });
  }

  /**
   * Track auth duration (latency)
   */
  trackAuthDuration(event: string, context: AuthEventContext, durationMs: number): void {
    this.trackAuthMetric({
      event: `${event}.duration`,
      timestamp: Date.now(),
      context,
      metadata: {
        duration_ms: durationMs
      }
    });
  }
}

// Singleton instance
export const authObservability = new AuthObservabilityService();
