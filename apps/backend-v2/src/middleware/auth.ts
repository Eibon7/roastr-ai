/**
 * Authentication Middleware v2
 * 
 * Middleware para verificar JWT tokens y roles de usuario.
 */

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';
import { AuthError, AUTH_ERROR_CODES } from '../utils/authErrorTaxonomy.js';

// Extender Express Request con usuario autenticado
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: 'user' | 'admin' | 'superadmin';
        email_verified: boolean;
      };
    }
  }
}

/**
 * Middleware que verifica que el usuario esté autenticado
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extraer token del header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError(
        AUTH_ERROR_CODES.TOKEN_MISSING,
        'Missing or invalid authorization header'
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Verificar token con Supabase
    const user = await authService.getCurrentUser(token);

    // Adjuntar usuario a request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      email_verified: user.email_verified
    };

    next();
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message
        }
      });
      return;
    }

    res.status(401).json({
      error: {
        code: AUTH_ERROR_CODES.TOKEN_INVALID,
        message: 'Authentication failed'
      }
    });
  }
}

/**
 * Middleware que verifica que el usuario tenga un rol específico
 */
export function requireRole(...allowedRoles: Array<'user' | 'admin' | 'superadmin'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: AUTH_ERROR_CODES.TOKEN_MISSING,
          message: 'Not authenticated'
        }
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: AUTH_ERROR_CODES.ROLE_NOT_ALLOWED,
          message: `Access denied. Required roles: ${allowedRoles.join(', ')}`
        }
      });
      return;
    }

    next();
  };
}

/**
 * Middleware opcional de autenticación (no falla si no hay token)
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const user = await authService.getCurrentUser(token);
      
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        email_verified: user.email_verified
      };
    }
  } catch {
    // Ignorar errores en auth opcional
  }

  next();
}
