/**
 * Session Refresh Middleware v2
 *
 * Infraestructura: Detecta tokens expirados y los refresca automáticamente.
 * NO incluye lógica de UI, redirects ni magic behavior.
 */

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';
import { AuthError, AUTH_ERROR_CODES } from '../utils/authErrorTaxonomy.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware que refresca access tokens expirados automáticamente.
 * 
 * Comportamiento:
 * - Token válido → continúa sin modificar
 * - Token expirado + refresh válido → refresca y continúa
 * - Token expirado + refresh inválido → AuthError SESSION_EXPIRED
 * 
 * NO incluye:
 * - Redirects a login
 * - Modificación de response headers
 * - Lógica de UI
 */
export async function sessionRefresh(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extraer tokens del header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Sin token → no hay sesión que refrescar, continuar
      return next();
    }

    const accessToken = authHeader.substring(7);
    
    // Intentar obtener usuario con token actual
    try {
      const user = await authService.getCurrentUser(accessToken);
      
      // Token válido → adjuntar usuario y continuar
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        email_verified: user.email_verified
      };
      
      return next();
    } catch (error) {
      // Si error NO es token expirado → propagar error
      if (!(error instanceof AuthError) || error.slug !== AUTH_ERROR_CODES.TOKEN_EXPIRED) {
        return next(); // Dejar que requireAuth maneje otros errores
      }

      // Token expirado → intentar refresh
      const refreshToken = extractRefreshToken(req);
      
      if (!refreshToken) {
        // Sin refresh token → no se puede refrescar
        logger.debug('sessionRefresh: access token expired, no refresh token available');
        return next(); // Dejar que requireAuth maneje
      }

      try {
        // Intentar refresh
        const newSession = await authService.refreshSession(refreshToken);
        
        // Refresh exitoso → adjuntar usuario actualizado
        req.user = {
          id: newSession.user.id,
          email: newSession.user.email,
          role: newSession.user.role,
          email_verified: newSession.user.email_verified
        };
        
        // Adjuntar nuevos tokens al request (para que endpoint los retorne si quiere)
        (req as any).newSession = newSession;
        
        logger.info('sessionRefresh: session refreshed successfully', {
          userId: newSession.user.id
        });
        
        return next();
      } catch (refreshError) {
        // Refresh falló → sesión inválida
        logger.warn('sessionRefresh: refresh failed', {
          error: refreshError instanceof AuthError ? refreshError.slug : 'unknown'
        });
        
        return next(); // Dejar que requireAuth maneje
      }
    }
  } catch (error) {
    // Error inesperado → log y continuar (fail-open para no romper requests)
    logger.error('sessionRefresh: unexpected error', { error });
    return next();
  }
}

/**
 * Helper: Extrae refresh token de headers/cookies/body.
 * 
 * Prioridad:
 * 1. Header X-Refresh-Token
 * 2. Cookie refresh_token (si httpOnly cookies implementadas)
 * 3. Body refresh_token (solo para POST /refresh)
 */
function extractRefreshToken(req: Request): string | null {
  // Header X-Refresh-Token (preferido para API clients)
  const headerToken = req.headers['x-refresh-token'];
  if (headerToken && typeof headerToken === 'string') {
    return headerToken;
  }

  // Cookie refresh_token (si implementado)
  const cookieToken = req.cookies?.refresh_token;
  if (cookieToken && typeof cookieToken === 'string') {
    return cookieToken;
  }

  // Body (solo como fallback, no recomendado)
  const bodyToken = req.body?.refresh_token;
  if (bodyToken && typeof bodyToken === 'string') {
    return bodyToken;
  }

  return null;
}

