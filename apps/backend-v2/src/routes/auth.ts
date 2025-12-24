/**
 * Authentication Routes v2
 *
 * Endpoints de autenticación con Supabase Auth.
 *
 * Endpoints:
 * - POST /api/v2/auth/signup
 * - POST /api/v2/auth/login
 * - POST /api/v2/auth/logout
 * - POST /api/v2/auth/refresh
 * - POST /api/v2/auth/magic-link
 * - GET  /api/v2/auth/me
 */

import { Router, Request, Response } from 'express';
import { authService } from '../services/authService.js';
import { AuthError } from '../utils/authErrorTaxonomy.js';
import { rateLimitByType } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { getClientIp } from '../utils/request.js';

const router = Router();

/**
 * POST /api/v2/auth/signup
 * Registra un nuevo usuario
 * Rate limited: 5 intentos en 1 hora
 */
router.post('/signup', rateLimitByType('signup'), async (req: Request, res: Response) => {
  try {
    const { email, password, plan_id, metadata } = req.body;

    if (!email || !password || !plan_id) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email, password, and plan_id are required'
        }
      });
    }

    const session = await authService.signup({
      email,
      password,
      planId: plan_id,
      metadata
    });

    res.status(201).json({
      session,
      message: 'User created successfully'
    });
    return;
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    console.error('Signup error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during signup'
      }
    });
    return;
  }
});

/**
 * POST /api/v2/auth/login
 * Inicia sesión con email y password
 * Rate limited: 5 intentos en 15 minutos
 */
router.post('/login', rateLimitByType('login'), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required'
        }
      });
    }

    const ip = getClientIp(req);

    const session = await authService.login({
      email,
      password,
      ip
    });

    res.json({
      session,
      message: 'Login successful'
    });
    return;
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    console.error('Login error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during login'
      }
    });
    return;
  }
});

/**
 * POST /api/v2/auth/logout
 * Cierra la sesión actual
 */
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : '';

    await authService.logout(token);

    res.json({
      message: 'Logout successful'
    });
    return;
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    console.error('Logout error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during logout'
      }
    });
    return;
  }
});

/**
 * POST /api/v2/auth/refresh
 * Refresca el access token usando refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Refresh token is required'
        }
      });
    }

    const session = await authService.refreshSession(refresh_token);

    res.json({
      session,
      message: 'Token refreshed successfully'
    });
    return;
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    console.error('Refresh error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during token refresh'
      }
    });
    return;
  }
});

/**
 * POST /api/v2/auth/magic-link
 * Solicita un magic link para login passwordless
 * SOLO permitido para role=user
 * Rate limited: 3 intentos en 1 hora
 */
router.post('/magic-link', rateLimitByType('magic_link'), async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email is required'
        }
      });
    }

    const ip = getClientIp(req);

    const result = await authService.requestMagicLink({
      email,
      ip
    });

    res.json(result);
    return;
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    console.error('Magic link error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while sending magic link'
      }
    });
    return;
  }
});

/**
 * GET /api/v2/auth/me
 * Obtiene información del usuario actual
 */
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({
    user: req.user
  });
});

export default router;
