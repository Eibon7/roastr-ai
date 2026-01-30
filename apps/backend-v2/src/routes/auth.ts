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
import { getClientIp, getRequestId } from '../utils/request.js';
import { trackEvent } from '../lib/analytics.js';
import { sendAuthError } from '../utils/authErrorResponse.js';
import { logger } from '../utils/logger.js';
import { checkAuthPolicy } from '../auth/authPolicyGate.js';
import { isAuthEndpointEnabled } from '../lib/authFlags.js';
import { truncateEmailForLog } from '../utils/pii.js';
import { createAuthContext, logFeatureDisabled } from '../utils/authObservability.js';
import { emitFeatureFlagDecision, emitAuthPolicyGateDecision } from '../lib/policyObservability.js';

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
  const request_id = getRequestId(req);

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
    // ROA-406: Feature flag check (fail-closed, no env fallback) + ROA-410: observability
    await isAuthEndpointEnabled('auth_enable_register', 'auth_enable_register')
      .then(() => {
        // ROA-396: Policy decision observability
        emitFeatureFlagDecision({ flow: 'register', allowed: true, request_id });
      })
      .catch((err) => {
        const context = createAuthContext(req, {
          flow: 'register',
          email: truncateEmailForLog(String(normalizedEmail ?? ''))
        });
        logFeatureDisabled(context, 'auth_enable_register', 'feature_disabled');

        // ROA-396: Policy decision observability
        emitFeatureFlagDecision({ flow: 'register', allowed: false, request_id });

        throw err;
      });

    // ✅ A3 POLICY GATE: Check policies BEFORE auth logic
    const policyResult = await checkAuthPolicy({
      action: 'register',
      ip,
      email: normalizedEmail,
      userAgent
    });

    if (!policyResult.allowed) {
      logger.warn('AuthPolicyGate blocked register', {
        email: truncateEmailForLog(normalizedEmail),
        policy: policyResult.policy,
        reason: policyResult.reason
      });

      // ROA-396: Policy decision observability
      emitAuthPolicyGateDecision({ flow: 'register', allowed: false, request_id });

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

    // ROA-396: Policy decision observability
    emitAuthPolicyGateDecision({ flow: 'register', allowed: true, request_id });

    // Policy gate passed - proceed with auth business logic
    await authService.register({
      email: normalizedEmail,
      password,
      request_id
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
    // Log error with structured logger (non-blocking, redacted)
    if (process.env.NODE_ENV !== 'production') {
      logger.error('Register endpoint error', {
        errorType: typeof error,
        errorName: error?.name,
        errorMessage: error?.message,
        errorStack: error?.stack?.substring(0, 300), // Truncated
        isAuthError: error?.constructor?.name === 'AuthError',
        hasSlug: !!(error as any)?.slug,
        errorSlug: (error as any)?.slug,
        location: 'auth.ts:register'
      });
    }

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
  const request_id = getRequestId(req);

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.INVALID_REQUEST), {
        log: { policy: 'validation:login' }
      });
    }

    // ROA-406: Feature flag check (fail-closed, no env fallback) + ROA-410: observability
    await isAuthEndpointEnabled('auth_enable_login', 'auth_enable_login')
      .then(() => {
        // ROA-396: Policy decision observability
        emitFeatureFlagDecision({ flow: 'login', allowed: true, request_id });
      })
      .catch((err) => {
        const context = createAuthContext(req, {
          flow: 'login',
          email: truncateEmailForLog(String(email ?? ''))
        });
        logFeatureDisabled(context, 'auth_enable_login', 'feature_disabled');

        // ROA-396: Policy decision observability
        emitFeatureFlagDecision({ flow: 'login', allowed: false, request_id });

        throw err;
      });

    // ✅ A3 POLICY GATE: Check policies BEFORE auth logic
    const policyResult = await checkAuthPolicy({
      action: 'login',
      ip,
      email,
      userAgent
    });

    if (!policyResult.allowed) {
      logger.warn('AuthPolicyGate blocked login', {
        email: truncateEmailForLog(String(email ?? '')),
        policy: policyResult.policy,
        reason: policyResult.reason
      });

      // ROA-396: Policy decision observability
      emitAuthPolicyGateDecision({ flow: 'login', allowed: false, request_id });

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

    // ROA-396: Policy decision observability
    emitAuthPolicyGateDecision({ flow: 'login', allowed: true, request_id });

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
  const request_id = getRequestId(req);

  try {
    const { email } = req.body;

    if (!email) {
      return sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.INVALID_REQUEST), {
        log: { policy: 'validation:magic_link' }
      });
    }

    // ROA-406: Feature flag check (fail-closed, no env fallback) + ROA-410: observability
    await isAuthEndpointEnabled('auth_enable_magic_link', 'auth_enable_magic_link')
      .then(() => {
        // ROA-396: Policy decision observability
        emitFeatureFlagDecision({ flow: 'magic_link', allowed: true, request_id });
      })
      .catch((err) => {
        const context = createAuthContext(req, {
          flow: 'magic_link',
          email: truncateEmailForLog(String(email ?? ''))
        });
        logFeatureDisabled(context, 'auth_enable_magic_link', 'feature_disabled');

        // ROA-396: Policy decision observability
        emitFeatureFlagDecision({ flow: 'magic_link', allowed: false, request_id });

        throw err;
      });

    // ✅ A3 POLICY GATE: Check policies BEFORE auth logic
    const policyResult = await checkAuthPolicy({
      action: 'magic_link',
      ip,
      email,
      userAgent
    });

    if (!policyResult.allowed) {
      logger.warn('AuthPolicyGate blocked magic_link', {
        email: truncateEmailForLog(String(email ?? '')),
        policy: policyResult.policy,
        reason: policyResult.reason
      });

      // ROA-396: Policy decision observability
      emitAuthPolicyGateDecision({ flow: 'magic_link', allowed: false, request_id });

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

    // ROA-396: Policy decision observability
    emitAuthPolicyGateDecision({ flow: 'magic_link', allowed: true, request_id });

    // Policy gate passed - proceed with auth business logic
    const result = await authService.requestMagicLink({
      email,
      ip,
      request_id
    });

    res.json(result);
    return;
  } catch (error) {
    return sendAuthError(req, res, error, { log: { policy: 'magic_link' } });
  }
});

/**
 * POST /api/v2/auth/password-recovery
 * Solicita un email de recuperación de contraseña
 * Rate limited: 3 intentos en 1 hora
 */
router.post(
  '/password-recovery',
  rateLimitByType('password_recovery'),
  async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const userAgent = (req.headers['user-agent'] as string) || null;
    const request_id = getRequestId(req);

    try {
      // ROA-406: Feature flag check (fail-closed, no env fallback) + ROA-410: observability
      await isAuthEndpointEnabled('auth_enable_password_recovery', 'auth_enable_password_recovery')
        .then(() => {
          // ROA-396: Policy decision observability
          emitFeatureFlagDecision({ flow: 'password_recovery', allowed: true, request_id });
        })
        .catch((err) => {
          const context = createAuthContext(req, {
            flow: 'password_recovery',
            email: truncateEmailForLog(String(req.body?.email ?? ''))
          });
          logFeatureDisabled(context, 'auth_enable_password_recovery', 'feature_disabled');

          // ROA-396: Policy decision observability
          emitFeatureFlagDecision({ flow: 'password_recovery', allowed: false, request_id });

          throw err;
        });

      const { email } = req.body;

      if (!email) {
        return sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.INVALID_REQUEST), {
          log: { policy: 'validation:password_recovery' }
        });
      }

      // ✅ A3 POLICY GATE: Check policies BEFORE auth logic
      const policyResult = await checkAuthPolicy({
        action: 'password_recovery',
        ip,
        email,
        userAgent
      });

      if (!policyResult.allowed) {
        logger.warn('AuthPolicyGate blocked password_recovery', {
          email: truncateEmailForLog(String(email ?? '')),
          policy: policyResult.policy,
          reason: policyResult.reason
        });

        // ROA-396: Policy decision observability
        emitAuthPolicyGateDecision({ flow: 'password_recovery', allowed: false, request_id });

        return sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.AUTH_DISABLED), {
          log: { policy: `auth_policy_gate:${policyResult.policy}` }
        });
      }

      // ROA-396: Policy decision observability
      emitAuthPolicyGateDecision({ flow: 'password_recovery', allowed: true, request_id });

      const result = await authService.requestPasswordRecovery({
        email,
        ip,
        request_id
      });

      res.json(result);
      return;
    } catch (error) {
      return sendAuthError(req, res, error, { log: { policy: 'password_recovery' } });
    }
  }
);

/**
 * POST /api/v2/auth/update-password
 * Actualiza contraseña usando token de recuperación del email
 * Rate limited: 3 intentos en 1 hora (compartido con /password-recovery)
 *
 * Request body:
 * - access_token: string (REQUIRED) - Token de recuperación del email
 * - password: string (REQUIRED) - Nueva contraseña (8-128 caracteres)
 *
 * Response (200 OK):
 * - { success: true, message: "Password updated successfully..." }
 *
 * Errors:
 * - 400 POLICY_INVALID_REQUEST - Validación de input falla
 * - 401 TOKEN_INVALID - Token inválido o expirado
 * - 403 AUTH_DISABLED - Feature flag OFF o policy gate bloqueó
 * - 429 POLICY_RATE_LIMITED - Rate limit excedido
 * - 500 AUTH_UNKNOWN - Error técnico
 */
router.post(
  '/update-password',
  rateLimitByType('password_recovery'),
  async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const userAgent = (req.headers['user-agent'] as string) || null;
    const request_id = getRequestId(req);

    try {
      // ROA-406: Feature flag check (fail-closed, no env fallback) + ROA-410: observability
      await isAuthEndpointEnabled(
        'auth_enable_password_recovery',
        'auth_enable_password_recovery'
      ).catch((err) => {
        const context = createAuthContext(req, {
          flow: 'update_password',
          request_id
        });
        logFeatureDisabled(context, 'auth_enable_password_recovery', 'feature_disabled');
        throw err;
      });

      const { access_token, password } = req.body;

      // Validación de input: access_token
      if (!access_token || typeof access_token !== 'string' || access_token.trim().length === 0) {
        return sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.INVALID_REQUEST), {
          log: { policy: 'validation:update_password:access_token' }
        });
      }

      // Validación de input: password
      if (!password || typeof password !== 'string') {
        return sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.INVALID_REQUEST), {
          log: { policy: 'validation:update_password:password_required' }
        });
      }

      if (password.length < 8) {
        return sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.INVALID_REQUEST), {
          log: { policy: 'validation:update_password:password_too_short' }
        });
      }

      if (password.length > 128) {
        return sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.INVALID_REQUEST), {
          log: { policy: 'validation:update_password:password_too_long' }
        });
      }

      // ✅ A3 POLICY GATE: Check policies BEFORE auth logic
      const policyResult = await checkAuthPolicy({
        action: 'update_password',
        ip,
        userAgent
      });

      if (!policyResult.allowed) {
        logger.warn('AuthPolicyGate blocked update_password', {
          policy: policyResult.policy,
          reason: policyResult.reason
        });

        return sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.AUTH_DISABLED), {
          log: { policy: `auth_policy_gate:${policyResult.policy}` }
        });
      }

      // Llamar servicio authService.updatePassword()
      const result = await authService.updatePassword(access_token, password);

      res.json({
        success: true,
        message: result.message
      });
      return;
    } catch (error) {
      return sendAuthError(req, res, error, { log: { policy: 'update_password' } });
    }
  }
);

/**
 * GET /api/v2/auth/me
 * Obtiene información del usuario actual
 */
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({
    user: req.user
  });
});

/**
 * GET /api/v2/auth/health
 * Health check endpoint (infra)
 *
 * Verifica:
 * - Supabase reachable
 * - SSOT/Settings loader reachable
 *
 * Response contractual:
 * {
 *   status: "ok" | "degraded" | "error",
 *   supabase: "ok" | "error",
 *   ssot: "ok" | "error",
 *   timestamp: ISO string
 * }
 *
 * Acceso: Public (no auth requerida)
 */
router.get('/health', async (req: Request, res: Response) => {
  const timestamp = new Date().toISOString();
  const checks: Record<string, string> = {};

  try {
    // Check 1: Supabase reachable
    try {
      await authService.getCurrentUser('invalid-token-for-health-check');
      checks.supabase = 'ok'; // Si llega aquí, Supabase respondió (aunque sea error)
    } catch (error) {
      // Error esperado (token inválido), pero Supabase respondió
      checks.supabase = error instanceof AuthError ? 'ok' : 'error';
    }

    // Check 2: SSOT/Settings loader
    try {
      const { loadSettings } = await import('../lib/loadSettings.js');
      await loadSettings();
      checks.ssot = 'ok';
    } catch {
      checks.ssot = 'error';
    }

    // Determine overall status
    const allOk = Object.values(checks).every((v) => v === 'ok');
    const someError = Object.values(checks).some((v) => v === 'error');

    const status = allOk ? 'ok' : someError ? 'degraded' : 'error';

    return res.status(status === 'ok' ? 200 : 503).json({
      status,
      ...checks,
      timestamp
    });
  } catch (error) {
    logger.error('auth.health: unexpected error', { error });
    return res.status(500).json({
      status: 'error',
      supabase: 'unknown',
      ssot: 'unknown',
      timestamp
    });
  }
});

export default router;
