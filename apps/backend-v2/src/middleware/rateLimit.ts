/**
 * Rate Limiting Middleware v2
 *
 * Middleware para aplicar rate limiting según tipo de endpoint.
 */

import { Request, Response, NextFunction } from 'express';
import { rateLimitService, AuthType } from '../services/rateLimitService.js';
import { AUTH_ERROR_CODES } from '../utils/authErrorTaxonomy.js';
import { getClientIp } from '../utils/request.js';

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
        // Bloqueo permanente
        res.status(429).json({
          error: {
            code: AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED,
            message: 'Account permanently locked due to repeated violations. Contact support.',
            retry_after: null
          }
        });
        return;
      }

      // Bloqueo temporal
      const retryAfterSeconds = Math.ceil((blockedUntil - Date.now()) / 1000);

      res.status(429).json({
        error: {
          code: AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED,
          message: `Too many ${authType} attempts. Please try again later.`,
          retry_after: retryAfterSeconds
        }
      });
      return;
    }

    // Rate limit OK, continuar
    next();
  };
}

/**
 * Middleware genérico de rate limiting por IP
 */
export function rateLimitByIp(options: {
  windowMs: number;
  maxAttempts: number;
  message?: string;
}) {
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

      res.status(429).json({
        error: {
          code: AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED,
          message: options.message || 'Too many requests. Please try again later.',
          retry_after: retryAfterSeconds
        }
      });
      return;
    }

    entry.count++;
    next();
  };
}
