/**
 * Password Recovery Backend Events - Analytics Tracking (B3)
 *
 * Implementa tracking de eventos de password recovery desde backend.
 *
 * Reglas estrictas (B3):
 * - NO enviar PII (email, IP, user_id, tokens)
 * - Solo datos categóricos (flow, provider, token_status, auth_state, reason, retryable, feature_flag_state)
 * - Eventos definidos: password_recovery_token_used, password_recovery_failed
 * - Usar sistema de tracking existente (trackEvent from analytics.ts)
 *
 * Scope: SOLO emisión de eventos. NO endpoints, NO métricas, NO agregaciones.
 */

import { trackEvent } from '../lib/analytics.js';
import { logger } from '../utils/logger.js';

/**
 * Common properties for password recovery backend events
 * NO incluir PII (email, tokens, user_id, IP)
 */
interface BasePasswordRecoveryBackendEventProperties {
  /** Flow identifier - always "password_recovery" */
  flow: 'password_recovery';
  /** Provider used for password recovery */
  provider: 'supabase';
  /** Feature flag state at the time of event */
  feature_flag_state: boolean;
}

/**
 * Properties for password_recovery_token_used event
 */
interface PasswordRecoveryTokenUsedProperties extends BasePasswordRecoveryBackendEventProperties {
  /** Token validation status - always "valid" for this event */
  token_status: 'valid';
  /** Authentication state at the time of token usage */
  auth_state: 'anonymous';
}

/**
 * Properties for password_recovery_failed event (backend)
 */
interface PasswordRecoveryBackendFailedProperties extends BasePasswordRecoveryBackendEventProperties {
  /** Normalized error reason (NO raw error messages) */
  reason: 
    | 'token_invalid' 
    | 'token_expired' 
    | 'request_failed' 
    | 'unknown_error';
  /** Whether the error is retryable */
  retryable: boolean;
}

/**
 * Track password_recovery_token_used event
 * 
 * Se dispara: Cuando se usa un token válido de recuperación (updatePassword con token de recovery)
 * NO incluir user_id, email ni datos sensibles
 *
 * @param featureFlagState - Estado del feature flag ENABLE_PASSWORD_RECOVERY_V2
 */
export function trackPasswordRecoveryTokenUsed(featureFlagState: boolean): void {
  try {
    const properties: PasswordRecoveryTokenUsedProperties = {
      flow: 'password_recovery',
      provider: 'supabase',
      feature_flag_state: featureFlagState,
      token_status: 'valid',
      auth_state: 'anonymous'
    };

    trackEvent({
      event: 'password_recovery_token_used',
      properties,
      context: {
        flow: 'password_recovery'
      }
    });
  } catch (error) {
    // Log error but don't propagate - observability should never break auth flow
    logger.warn('[Password Recovery Backend Events] Failed to track password_recovery_token_used', {
      error: String(error)
    });
  }
}

/**
 * Track password_recovery_failed event (backend)
 * 
 * Se dispara: Error durante uso de token de recuperación
 * NO enviar mensajes de error crudos, solo códigos normalizados
 *
 * @param featureFlagState - Estado del feature flag
 * @param errorMessage - Mensaje de error (será normalizado a reason)
 */
export function trackPasswordRecoveryBackendFailed(
  featureFlagState: boolean,
  errorMessage: string
): void {
  try {
    // Normalizar error message a reason code (NO enviar mensaje crudo)
    const { reason, retryable } = normalizeErrorToReason(errorMessage);

    const properties: PasswordRecoveryBackendFailedProperties = {
      flow: 'password_recovery',
      provider: 'supabase',
      feature_flag_state: featureFlagState,
      reason,
      retryable
    };

    trackEvent({
      event: 'password_recovery_failed',
      properties,
      context: {
        flow: 'password_recovery'
      }
    });
  } catch (error) {
    // Log error but don't propagate - observability should never break auth flow
    logger.warn('[Password Recovery Backend Events] Failed to track password_recovery_failed', {
      error: String(error)
    });
  }
}

/**
 * Normaliza mensajes de error a reason codes estructurados
 * 
 * Reglas:
 * - NO enviar mensajes de error crudos (pueden contener PII)
 * - Usar solo códigos definidos en PasswordRecoveryBackendFailedProperties
 * - Determinar si el error es retryable
 *
 * @internal
 */
function normalizeErrorToReason(errorMessage: string): {
  reason: PasswordRecoveryBackendFailedProperties['reason'];
  retryable: boolean;
} {
  const message = errorMessage.toLowerCase();

  // Token inválido (no retryable)
  if (
    message.includes('invalid') || 
    message.includes('jwt') || 
    message.includes('malformed')
  ) {
    return { reason: 'token_invalid', retryable: false };
  }

  // Token expirado (no retryable - necesita nuevo token)
  if (
    message.includes('expired') || 
    message.includes('expir')
  ) {
    return { reason: 'token_expired', retryable: false };
  }

  // Request failed (retryable)
  if (
    message.includes('network') || 
    message.includes('timeout') || 
    message.includes('connection') ||
    message.includes('failed') ||
    message.includes('unavailable')
  ) {
    return { reason: 'request_failed', retryable: true };
  }

  // Error desconocido (no retryable por defecto en backend)
  return { reason: 'unknown_error', retryable: false };
}

