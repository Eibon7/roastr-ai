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
import { AuthError, AUTH_ERROR_CODES } from '../utils/authErrorTaxonomy.js';
import { rateLimitByType } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { getClientIp } from '../utils/request.js';
import { trackEvent } from '../lib/analytics.js';
import { sendAuthError } from '../utils/authErrorResponse.js';
import { logger } from '../utils/logger.js';
import { checkAuthPolicy } from '../auth/authPolicyGate.js';

const router = Router();

/**
 * POST /api/v2/auth/register
 * Registro v2 (Supabase Auth) — contrato estable:
 *
 * - Input: { email, password }
 * - Output: { success: true } (anti-enumeration: homogéneo incluso si el email ya existe)
 * - Feature flag: feature_flags.enable_user_registration (default: false)
 * - Rate limit: misma política que login
 */
router.post('/register', rateLimitByType('login'), async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const userAgent = (req.headers['user-agent'] as string) || null;

  const { email, password } = req.body || {};

  if (typeof email !== 'string' || email.trim().length === 0) {
    return sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.INVALID_REQUEST), {
      log: { policy: 'validation:register' }
    });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.INVALID_REQUEST), {
      log: { policy: 'validation:register' }
    });
  }

  // Validación de formato básico (sin normalizar password)
  const normalizedEmail = email
    .trim()
    .toLowerCase()
    .replace(/[\x00-\x1F\x7F]/g, '');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.INVALID_REQUEST), {
      log: { policy: 'validation:register' }
    });
  }

  if (password.length > 128) {
    return sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.INVALID_REQUEST), {
      log: { policy: 'validation:register' }
    });
  }

  try {
    // ✅ A3 POLICY GATE: Check policies BEFORE auth logic
    const policyResult = await checkAuthPolicy({
      action: 'register',
      ip,
      email: normalizedEmail,
      userAgent
    });

    if (!policyResult.allowed) {
      logger.warn('AuthPolicyGate blocked register', {
        email: normalizedEmail,
        policy: policyResult.policy,
        reason: policyResult.reason
      });

      // Map policy result to AuthError
      const errorCode =
        policyResult.policy === 'rate_limit'
          ? AUTH_ERROR_CODES.RATE_LIMITED
          : policyResult.policy === 'feature_flag'
            ? AUTH_ERROR_CODES.NOT_FOUND // Feature disabled = 404
            : AUTH_ERROR_CODES.AUTH_DISABLED;

      return sendAuthError(req, res, new AuthError(errorCode), {
        log: { policy: `gate:${policyResult.policy}` },
        retryAfterSeconds: policyResult.retryAfterSeconds
      });
    }

    // Policy gate passed - proceed with auth business logic
    await authService.register({
      email: normalizedEmail,
      password
    });

    // Track successful registration at endpoint level (B3: Register Analytics)
    try {
      trackEvent({
        event: 'auth_register_endpoint_success',
        properties: {
          endpoint: '/api/v2/auth/register',
          method: 'email_password',
          status_code: 200
        },
        context: {
          flow: 'auth'
        }
      });
    } catch {
      logger.warn('analytics.track_failed', { event: 'auth_register_endpoint_success' });
    }

    // Anti-enumeration: siempre homogéneo
    return res.json({ success: true });
  } catch (error) {
    // Track failed registration at endpoint level (B3: Register Analytics)
    try {
      trackEvent({
        event: 'auth_register_endpoint_failed',
        properties: {
          endpoint: '/api/v2/auth/register',
          error_type: 'INTERNAL_ERROR',
          status_code: 500
        },
        context: {
          flow: 'auth'
        }
      });
    } catch {
      logger.warn('analytics.track_failed', { event: 'auth_register_endpoint_failed' });
    }

    return sendAuthError(req, res, error, { log: { policy: 'register' } });
  }
});

/**
 * POST /api/v2/auth/signup
 * Registra un nuevo usuario
 * Rate limited: 5 intentos en 1 hora
 */
router.post('/signup', rateLimitByType('signup'), async (req: Request, res: Response) => {
  try {
    const { email, password, plan_id, metadata } = req.body;

    if (!email || !password || !plan_id) {
      return sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.INVALID_REQUEST), {
        log: { policy: 'validation:signup' }
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
    return sendAuthError(req, res, error, { log: { policy: 'signup' } });
  }
});

/**
 * POST /api/v2/auth/login
 * Inicia sesión con email y password
 * Rate limited: 5 intentos en 15 minutos
 */
router.post('/login', rateLimitByType('login'), async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const userAgent = (req.headers['user-agent'] as string) || null;

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.INVALID_REQUEST), {
        log: { policy: 'validation:login' }
      });
    }

    // ✅ A3 POLICY GATE: Check policies BEFORE auth logic
    const policyResult = await checkAuthPolicy({
      action: 'login',
      ip,
      email,
      userAgent
    });

    if (!policyResult.allowed) {
      logger.warn('AuthPolicyGate blocked login', {
        email,
        policy: policyResult.policy,
        reason: policyResult.reason
      });

      // Map policy result to AuthError
      const errorCode =
        policyResult.policy === 'rate_limit'
          ? AUTH_ERROR_CODES.RATE_LIMITED
          : AUTH_ERROR_CODES.AUTH_DISABLED;

      return sendAuthError(req, res, new AuthError(errorCode), {
        log: { policy: `gate:${policyResult.policy}` },
        retryAfterSeconds: policyResult.retryAfterSeconds
      });
    }

    // Policy gate passed - proceed with auth business logic
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
    return sendAuthError(req, res, error, { log: { policy: 'login' } });
  }
});

/**
 * POST /api/v2/auth/logout
 * Cierra la sesión actual
 */
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    await authService.logout(token);

    res.json({
      message: 'Logout successful'
    });
    return;
  } catch (error) {
    return sendAuthError(req, res, error, { log: { policy: 'logout' } });
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
      return sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.INVALID_REQUEST), {
        log: { policy: 'validation:refresh' }
      });
    }

    const session = await authService.refreshSession(refresh_token);

    res.json({
      session,
      message: 'Token refreshed successfully'
    });
    return;
  } catch (error) {
    return sendAuthError(req, res, error, { log: { policy: 'refresh' } });
  }
});

/**
 * POST /api/v2/auth/magic-link
 * Solicita un magic link para login passwordless
 * SOLO permitido para role=user
 * Rate limited: 3 intentos en 1 hora
 */
router.post('/magic-link', rateLimitByType('magic_link'), async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const userAgent = (req.headers['user-agent'] as string) || null;

  try {
    const { email } = req.body;

    if (!email) {
      return sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.INVALID_REQUEST), {
        log: { policy: 'validation:magic_link' }
      });
    }

    // ✅ A3 POLICY GATE: Check policies BEFORE auth logic
    const policyResult = await checkAuthPolicy({
      action: 'magic_link',
      ip,
      email,
      userAgent
    });

    if (!policyResult.allowed) {
      logger.warn('AuthPolicyGate blocked magic_link', {
        email,
        policy: policyResult.policy,
        reason: policyResult.reason
      });

      // Map policy result to AuthError
      const errorCode =
        policyResult.policy === 'rate_limit'
          ? AUTH_ERROR_CODES.RATE_LIMITED
          : policyResult.policy === 'feature_flag'
            ? AUTH_ERROR_CODES.MAGIC_LINK_NOT_ALLOWED
            : AUTH_ERROR_CODES.AUTH_DISABLED;

      return sendAuthError(req, res, new AuthError(errorCode), {
        log: { policy: `gate:${policyResult.policy}` },
        retryAfterSeconds: policyResult.retryAfterSeconds
      });
    }

    // Policy gate passed - proceed with auth business logic
    const result = await authService.requestMagicLink({
      email,
      ip
    });

    res.json(result);
    return;
  } catch (error) {
    return sendAuthError(req, res, error, { log: { policy: 'magic_link' } });
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
