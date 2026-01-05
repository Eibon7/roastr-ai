/**
 * Policy Observability & Audit (ROA-396)
 *
 * Emite eventos y logs estructurados para TODAS las decisiones de policy en Auth v2.
 * NO cambia semántica ni lógica de negocio, solo observa y audita.
 *
 * CRÍTICO:
 * - NO loggear PII (email, password, tokens)
 * - Reason SIEMPRE slug estable (NO mensajes humanos)
 * - Emisión asíncrona (NO bloquea response)
 */

import { logger } from '@/utils/logger';
import { getAmplitudeClient } from '@/lib/analytics';

/**
 * Flows de Auth v2
 */
export type PolicyFlow =
  | 'login'
  | 'register'
  | 'password_recovery'
  | 'magic_link'
  | 'token_refresh'
  | 'update_password';

/**
 * Tipos de policy que pueden decidir bloquear/permitir
 */
export type PolicyType =
  | 'feature_flag'
  | 'account_status'
  | 'rate_limit'
  | 'auth_policy_gate';

/**
 * Decisión de policy (permitir o bloquear)
 */
export type PolicyDecision = 'allowed' | 'blocked';

/**
 * Reasons estables (slugs) para decisiones de policy
 */
export type PolicyBlockedReason =
  | 'feature_disabled'
  | 'account_suspended'
  | 'account_banned'
  | 'account_deleted'
  | 'rate_limit_exceeded'
  | 'policy_check_failed';

/**
 * Payload del evento policy_decision_made
 */
export interface PolicyDecisionEvent {
  flow: PolicyFlow;
  policy: PolicyType;
  decision: PolicyDecision;
  reason?: PolicyBlockedReason; // Solo presente si decision: blocked
  retryable: boolean;
  request_id: string;
}

/**
 * Emite un evento de decisión de policy
 *
 * NO bloquea response (async, setImmediate)
 * Emite a:
 * - Logger estructurado (info si allowed, warn si blocked)
 * - Analytics (Amplitude) si inicializado
 *
 * @param event - Datos del evento de decisión de policy
 */
export function emitPolicyDecision(event: PolicyDecisionEvent): void {
  // Ejecutar async (no bloquear response)
  setImmediate(() => {
    try {
      // 1. Log estructurado
      const logLevel = event.decision === 'allowed' ? 'info' : 'warn';
      const logPayload = {
        event: 'auth.policy.decision',
        flow: event.flow,
        policy: event.policy,
        decision: event.decision,
        ...(event.reason && { reason: event.reason }),
        retryable: event.retryable,
        request_id: event.request_id
      };

      if (logLevel === 'info') {
        logger.info('Policy decision: allowed', logPayload);
      } else {
        logger.warn('Policy decision: blocked', logPayload);
      }

      // 2. Emitir a Analytics (Amplitude) si disponible
      const amplitude = getAmplitudeClient();
      if (amplitude) {
        amplitude.track({
          event_type: 'policy_decision_made',
          event_properties: {
            flow: event.flow,
            policy: event.policy,
            decision: event.decision,
            ...(event.reason && { reason: event.reason }),
            retryable: event.retryable
          },
          // NO incluir user_id ni device_id (puede no estar autenticado)
          insert_id: event.request_id // Para deduplicación
        });
      }
    } catch (error) {
      // NUNCA dejar que error en observability afecte producción
      logger.error('Error emitting policy decision', {
        error: error instanceof Error ? error.message : 'Unknown error',
        event_flow: event.flow,
        event_policy: event.policy
      });
    }
  });
}

/**
 * Helper para emitir decisión de feature flag
 */
export function emitFeatureFlagDecision(params: {
  flow: PolicyFlow;
  allowed: boolean;
  request_id: string;
}): void {
  emitPolicyDecision({
    flow: params.flow,
    policy: 'feature_flag',
    decision: params.allowed ? 'allowed' : 'blocked',
    ...(params.allowed ? {} : { reason: 'feature_disabled' }),
    retryable: true, // Feature flags pueden habilitarse después
    request_id: params.request_id
  });
}

/**
 * Helper para emitir decisión de rate limit
 */
export function emitRateLimitDecision(params: {
  flow: PolicyFlow;
  allowed: boolean;
  request_id: string;
}): void {
  emitPolicyDecision({
    flow: params.flow,
    policy: 'rate_limit',
    decision: params.allowed ? 'allowed' : 'blocked',
    ...(params.allowed ? {} : { reason: 'rate_limit_exceeded' }),
    retryable: true, // Pueden reintentar después
    request_id: params.request_id
  });
}

/**
 * Helper para emitir decisión de auth policy gate
 */
export function emitAuthPolicyGateDecision(params: {
  flow: PolicyFlow;
  allowed: boolean;
  request_id: string;
}): void {
  emitPolicyDecision({
    flow: params.flow,
    policy: 'auth_policy_gate',
    decision: params.allowed ? 'allowed' : 'blocked',
    ...(params.allowed ? {} : { reason: 'policy_check_failed' }),
    retryable: false, // Policy gate blocked no es retryable
    request_id: params.request_id
  });
}

