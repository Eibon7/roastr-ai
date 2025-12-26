/**
 * Request Utilities
 *
 * Shared utilities for extracting request information
 */

import { Request } from 'express';

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
