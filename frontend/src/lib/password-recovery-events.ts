/**
 * Password Recovery Events - Analytics Tracking (B3)
 *
 * Implementa tracking de analytics del flujo de password recovery.
 *
 * Reglas estrictas (B3):
 * - NO enviar PII (email, IP, user_id, tokens)
 * - Solo datos categóricos (flow, provider, reason, retryable, feature_flag_state)
 * - Eventos definidos: password_recovery_requested, password_recovery_failed
 * - Usar sistema de tracking existente (Amplitude)
 *
 * Scope: SOLO emisión de eventos. NO endpoints, NO métricas, NO agregaciones.
 */

import * as amplitude from '@amplitude/unified';

/**
 * Common properties for password recovery events
 * NO incluir PII (email, tokens, user_id, IP)
 */
interface BasePasswordRecoveryEventProperties {
  /** Flow identifier - always "password_recovery" */
  flow: 'password_recovery';
  /** Feature flag state at the time of event */
  feature_flag_state: boolean;
  /** Provider used for password recovery */
  provider: 'supabase';
  /** Request source */
  request_source: 'auth_ui';
}

/**
 * Properties for password_recovery_failed event
 */
interface PasswordRecoveryFailedProperties extends BasePasswordRecoveryEventProperties {
  /** Normalized error reason (NO raw error messages) */
  reason: 
    | 'request_failed' 
    | 'feature_disabled' 
    | 'rate_limited' 
    | 'unknown_error';
  /** Whether the error is retryable */
  retryable: boolean;
}

/**
 * Track password_recovery_requested event
 * 
 * Se dispara: Al solicitar password recovery (submit del formulario)
 * NO incluir email ni datos sensibles
 *
 * @param featureFlagState - Estado del feature flag ENABLE_PASSWORD_RECOVERY_V2
 */
export function trackPasswordRecoveryRequested(featureFlagState: boolean): void {
  // No-op in test environment
  if (import.meta.env.MODE === 'test' || import.meta.env.VITEST) {
    return;
  }

  try {
    const properties: BasePasswordRecoveryEventProperties = {
      flow: 'password_recovery',
      feature_flag_state: featureFlagState,
      provider: 'supabase',
      request_source: 'auth_ui'
    };

    amplitude.track('password_recovery_requested', properties);
  } catch (error) {
    console.error('[Password Recovery Events] Failed to track password_recovery_requested:', error);
  }
}

/**
 * Track password_recovery_failed event
 * 
 * Se dispara: Error durante solicitud de password recovery
 * NO enviar mensajes de error crudos, solo códigos normalizados
 *
 * @param featureFlagState - Estado del feature flag
 * @param errorMessage - Mensaje de error (será normalizado a reason)
 */
export function trackPasswordRecoveryFailed(
  featureFlagState: boolean,
  errorMessage: string
): void {
  // No-op in test environment
  if (import.meta.env.MODE === 'test' || import.meta.env.VITEST) {
    return;
  }

  try {
    // Normalizar error message a reason code (NO enviar mensaje crudo)
    const { reason, retryable } = normalizeErrorToReason(errorMessage);

    const properties: PasswordRecoveryFailedProperties = {
      flow: 'password_recovery',
      feature_flag_state: featureFlagState,
      provider: 'supabase',
      request_source: 'auth_ui',
      reason,
      retryable
    };

    amplitude.track('password_recovery_failed', properties);
  } catch (error) {
    console.error('[Password Recovery Events] Failed to track password_recovery_failed:', error);
  }
}

/**
 * Normaliza mensajes de error a reason codes estructurados
 * 
 * Reglas:
 * - NO enviar mensajes de error crudos (pueden contener PII)
 * - Usar solo códigos definidos en PasswordRecoveryFailedProperties
 * - Determinar si el error es retryable
 *
 * @internal
 */
function normalizeErrorToReason(errorMessage: string): {
  reason: PasswordRecoveryFailedProperties['reason'];
  retryable: boolean;
} {
  const message = errorMessage.toLowerCase();

  // Feature deshabilitada (no retryable)
  if (
    message.includes('disabled') || 
    message.includes('not available') || 
    message.includes('no disponible')
  ) {
    return { reason: 'feature_disabled', retryable: false };
  }

  // Rate limited (retryable)
  if (
    message.includes('rate') || 
    message.includes('too many') || 
    message.includes('throttled')
  ) {
    return { reason: 'rate_limited', retryable: true };
  }

  // Request failed (retryable)
  if (
    message.includes('network') || 
    message.includes('timeout') || 
    message.includes('connection') ||
    message.includes('failed')
  ) {
    return { reason: 'request_failed', retryable: true };
  }

  // Error desconocido (retryable por defecto)
  return { reason: 'unknown_error', retryable: true };
}

