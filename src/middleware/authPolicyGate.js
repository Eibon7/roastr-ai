/**
 * @fileoverview Auth Policy Gate - ROA-523
 * @module middleware/authPolicyGate
 * 
 * Punto de decisión centralizado para Auth v2.
 * Evalúa rate limiting ANTES de la lógica de negocio.
 * 
 * Pipeline:
 * HTTP Request → Auth Feature Flags → Auth Policy Gate (AQUÍ) → Auth Business Logic
 * 
 * Si el policy bloquea, la request se corta y retorna error inmediatamente.
 * 
 * SSOT Reference: Section 12.4 (Auth Rate Limiting), 12.6 (Rate Limiting Global v2)
 */

const RateLimitPolicyGlobal = require('../services/rateLimitPolicyGlobal');
const { createRateLimitError } = require('../errors/authErrors');
const { AUTH_ACTIONS, AUTH_TYPES, AUTH_SCOPE } = require('../constants/authActions');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

/**
 * Emite evento de rate limiting para observabilidad
 * @param {string} authAction - Acción de auth bloqueada
 * @param {boolean} retryable - Si es retryable
 * @param {string} requestId - Request ID para correlación
 * @private
 */
function emitRateLimitEvent(authAction, retryable, requestId) {
  try {
    // Log estructurado para backend
    logger.info('auth_rate_limited_event', {
      event: 'auth_rate_limited',
      flow: 'auth',
      auth_action: authAction,
      retryable,
      policy: 'rate_limit',
      scope: AUTH_SCOPE,
      request_id: requestId
    });

    // Amplitude event (if available in backend context)
    // Backend v2 usa @amplitude/analytics-node con trackEvent()
    // Para mantener compatibilidad, usamos logger que puede ser consumido por analytics service
    // Ver: apps/backend-v2/src/lib/analytics.ts para backend v2 pattern
  } catch (error) {
    logger.error('Failed to emit auth_rate_limited event', {
      error: error.message,
      auth_action: authAction
    });
  }
}

/**
 * Middleware de Auth Policy Gate
 * Evalúa rate limiting antes de permitir acceso a lógica de auth
 * 
 * @param {Object} options - Opciones de configuración
 * @param {string} options.action - Acción de auth (AUTH_ACTIONS)
 * @param {string} options.authType - Tipo de auth (AUTH_TYPES)
 * @returns {Function} Express middleware
 */
function authPolicyGate(options) {
  const { action, authType } = options;
  
  if (!action || !Object.values(AUTH_ACTIONS).includes(action)) {
    throw new Error(`Invalid auth action: ${action}. Must be one of: ${Object.values(AUTH_ACTIONS).join(', ')}`);
  }
  
  if (!authType || !Object.values(AUTH_TYPES).includes(authType)) {
    throw new Error(`Invalid auth type: ${authType}. Must be one of: ${Object.values(AUTH_TYPES).join(', ')}`);
  }
  
  return async (req, res, next) => {
    // Feature flag check: Si rate limiting está OFF, permitir paso
    if (!flags.isEnabled('enable_rate_limit_auth')) {
      logger.debug('auth_policy_gate_bypassed', {
        action,
        reason: 'feature_flag_disabled'
      });
      return next();
    }
    
    try {
      const policy = new RateLimitPolicyGlobal();
      
      // Construir key para rate limiting
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const email = req.body?.email;
      
      // Input contract al policy (sección 12.6 SSOT)
      const policyInput = {
        scope: AUTH_SCOPE,
        action: authType, // auth_type como scope interno (password, magic_link, password_reset)
        key: {
          ip,
          ...(email && { email })
        },
        metadata: {
          auth_type: authType
        }
      };
      
      // Evaluar policy
      const result = await policy.evaluate(policyInput);
      
      // Si permitido, continuar
      if (result.allowed) {
        logger.debug('auth_policy_gate_allowed', {
          action,
          auth_type: authType,
          ip
        });
        return next();
      }
      
      // Si bloqueado, cortar y retornar error
      logger.warn('auth_policy_gate_blocked', {
        action,
        auth_type: authType,
        block_type: result.block_type,
        retry_after_seconds: result.retry_after_seconds,
        ip,
        request_id: req.id || req.headers['x-request-id']
      });
      
      // Emitir evento de observabilidad
      emitRateLimitEvent(action, result.block_type === 'temporary', req.id || req.headers['x-request-id']);
      
      // Crear error y retornar
      const error = createRateLimitError(result);
      return res.status(429).json({
        success: false,
        error: error.toJSON()
      });
      
    } catch (error) {
      // Fail-safe: Si hay error interno del policy, loguear pero permitir paso (fail-open)
      logger.error('auth_policy_gate_error', {
        action,
        auth_type: authType,
        error: error.message,
        stack: error.stack,
        behavior: 'fail_open'
      });
      
      // Permitir continuar (fail-open documentado)
      return next();
    }
  };
}

module.exports = {
  authPolicyGate
};

