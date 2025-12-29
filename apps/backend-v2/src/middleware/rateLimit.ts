/**
 * Rate Limiting Middleware v2
 *
 * Middleware para aplicar rate limiting según tipo de endpoint.
 */

import { Request, Response, NextFunction } from 'express';
import { rateLimitService, AuthType } from '../services/rateLimitService.js';
import { AuthError, AUTH_ERROR_CODES } from '../utils/authErrorTaxonomy.js';
import { getClientIp } from '../utils/request.js';
import { sendAuthError } from '../utils/authErrorResponse.js';

/**
 * Middleware de rate limiting por tipo de autenticación
 */
export function rateLimitByType(authType: AuthType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Obtener IP del cliente
    const ip = getClientIp(req);

    // Verificar rate limit
    const result = rateLimitService.recordAttempt(authType, ip);

    if (!result.allowed) {
      const blockedUntil = result.blockedUntil;

      if (blockedUntil === null) {
        return void sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.RATE_LIMITED), {
          log: { policy: `rate_limit:${authType}` }
        });
      }

      // Bloqueo temporal
      const retryAfterSeconds = blockedUntil ? Math.ceil((blockedUntil - Date.now()) / 1000) : 0;
      return void sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.RATE_LIMITED), {
        log: { policy: `rate_limit:${authType}` },
        retryAfterSeconds
      });
    }

    // Rate limit OK, continuar
    next();
  };
}

/**
 * Middleware genérico de rate limiting por IP
 */
export function rateLimitByIp(options: { windowMs: number; maxAttempts: number }) {
  const attempts = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = getClientIp(req);

    const now = Date.now();
    const entry = attempts.get(ip);

    if (!entry || now > entry.resetAt) {
      attempts.set(ip, {
        count: 1,
        resetAt: now + options.windowMs
      });
      next();
      return;
    }

    if (entry.count >= options.maxAttempts) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      return void sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.RATE_LIMITED), {
        log: { policy: 'rate_limit:ip' },
        retryAfterSeconds
      });
    }

    entry.count++;
    next();
  };
}
