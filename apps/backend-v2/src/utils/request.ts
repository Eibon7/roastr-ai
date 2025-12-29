/**
 * Request Utilities
 *
 * Shared utilities for extracting request information
 */

import { Request } from 'express';
import { randomUUID } from 'crypto';

/**
 * Extracts client IP address from request
 * Handles x-forwarded-for header and fallback to socket address
 */
export function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

/**
 * Gets (or lazily generates) a stable request_id for this request.
 *
 * - Uses incoming `x-request-id` header if present
 * - Otherwise generates a UUIDv4
 *
 * NOTE: In backend-v2 we attach it on req as `request_id` for convenience.
 */
export function getRequestId(req: Request): string {
  const existing = (req as any)?.request_id;
  if (typeof existing === 'string' && existing.length > 0) {
    return existing;
  }

  const header = req.headers['x-request-id'];
  if (typeof header === 'string' && header.length > 0) {
    (req as any).request_id = header;
    return header;
  }

  const generated = randomUUID();
  (req as any).request_id = generated;
  return generated;
}
