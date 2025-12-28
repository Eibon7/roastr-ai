/**
 * Auth error response helpers (backend-v2) — ROA-405
 *
 * Centralizes:
 * - Fail-closed mapping
 * - Public response contract (slug + retryable + request_id)
 * - Structured logging without PII
 */

import type { Request, Response } from 'express';
import { AuthError, failClosedAuthError, isAuthError } from './authErrorTaxonomy.js';
import { getRequestId } from './request.js';
import { logger } from './logger.js';

export type AuthErrorLogContext = {
  policy?: string;
};

export type SendAuthErrorOptions = {
  /**
   * Optional explicit policy context (for observability).
   * Example: "rate_limit", "feature_flag", "abuse_detection"
   */
  log?: AuthErrorLogContext;
  /**
   * Retry-After header in seconds (for 429 backoff).
   * Frontend can use this without parsing body.
   */
  retryAfterSeconds?: number | null;
};

export function asAuthError(error: unknown): AuthError {
  return isAuthError(error) ? error : failClosedAuthError(error);
}

export function sendAuthError(
  req: Request,
  res: Response,
  error: unknown,
  options: SendAuthErrorOptions = {}
): Response {
  const authError = asAuthError(error);
  const requestId = getRequestId(req);

  if (typeof options.retryAfterSeconds === 'number' && Number.isFinite(options.retryAfterSeconds)) {
    res.setHeader('Retry-After', Math.max(0, Math.floor(options.retryAfterSeconds)).toString());
  }

  logger.warn('auth.error.generated', {
    error_slug: authError.slug,
    request_id: requestId,
    ...(options.log?.policy ? { policy: options.log.policy } : {})
  });

  return res.status(authError.http_status).json({
    success: false,
    error: authError.toPublicError(),
    request_id: requestId
  });
}

