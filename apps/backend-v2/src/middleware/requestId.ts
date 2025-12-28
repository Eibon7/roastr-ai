/**
 * Request ID middleware (backend-v2)
 *
 * Ensures every request has a stable `request_id` for traceability:
 * - Stored on req as `request_id`
 * - Returned via `x-request-id` response header
 *
 * IMPORTANT:
 * - No PII in request_id
 * - Safe to expose publicly
 */

import { Request, Response, NextFunction } from 'express';
import { getRequestId } from '../utils/request.js';

export function attachRequestId(req: Request, res: Response, next: NextFunction): void {
  const requestId = getRequestId(req);
  res.setHeader('x-request-id', requestId);
  next();
}

