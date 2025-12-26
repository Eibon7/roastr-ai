/**
 * Auth Login Events - Analytics Tracking (ROA-362)
 *
 * Implementa tracking de analytics del flujo de login usando Amplitude,
 * siguiendo la taxonomía definida en ROA-357 (A2: Auth Events Taxonomy v2).
 *
 * Reglas estrictas:
 * - Usar SOLO la taxonomía definida en A2
 * - Usar helpers de identidad de A1 (analytics-identity.ts)
 * - NO crear eventos nuevos
 * - NO enviar PII (email, password, etc.)
 * - NO tocar backend ni UI
 * - Emitir eventos solo en puntos semánticos claros
 *
 * Dependencias:
 * - A1 (ROA-356): Analytics Identity Sync
 * - A2 (ROA-357): Auth Events Taxonomy v2
 * - B2: Login Frontend UI v2
 */

import * as amplitude from '@amplitude/unified';

/**
 * Common properties for all auth events
 * NO incluir PII (email, password, tokens)
 */
interface BaseAuthEventProperties {
  /** Flow identifier - always "auth_login" for login events */
  flow: 'auth_login';
  /** Authentication method used */
  method: 'email_password' | 'demo_mode' | 'magic_link' | 'oauth';
  /** UI variant for A/B testing */
  ui_variant?: string;
  /** Feature flags active during event */
  feature_flags?: string[];
}

/**
 * Properties for auth_login_succeeded event
 */
interface LoginSuccessProperties extends BaseAuthEventProperties {
  /** Where user will be redirected after login */
  redirect_to: string;
  /** Account state after successful login */
  account_state: 'active' | 'trial' | 'suspended' | 'new';
}

/**
 * Properties for auth_login_failed event
 */
interface LoginFailedProperties extends BaseAuthEventProperties {
  /** Normalized error code (NO raw error messages) */
  error_code: 
    | 'invalid_credentials' 
    | 'account_locked' 
    | 'account_suspended' 
    | 'network_error' 
    | 'unknown_error';
  /** Whether the error is retryable */
  retryable: boolean;
}

/**
 * Track auth_login_attempted event
 * 
 * Se dispara: Al submit del formulario de login
 * Un intento = un evento (no duplicar por re-render)
 *
 * @param method - Método de autenticación usado
 * @param uiVariant - Variante de UI (opcional, para A/B testing)
 */
export function trackLoginAttempted(
  method: BaseAuthEventProperties['method'],
  uiVariant?: string
): void {
  // No-op in test environment
  if (import.meta.env.MODE === 'test' || import.meta.env.VITEST) {
    return;
  }

  try {
    const properties: BaseAuthEventProperties = {
      flow: 'auth_login',
      method,
      ...(uiVariant && { ui_variant: uiVariant })
    };

    amplitude.track('auth_login_attempted', properties);
  } catch (error) {
    console.error('[Auth Events] Failed to track login attempted:', error);
  }
}

/**
 * Track auth_login_succeeded event
 * 
 * Se dispara: Respuesta 200 del backend después de login exitoso
 * IMPORTANTE: Identidad ya sincronizada en auth-context.tsx usando A1
 *
 * @param method - Método de autenticación usado
 * @param redirectTo - Ruta a la que se redirigirá al usuario
 * @param accountState - Estado de la cuenta del usuario
 * @param uiVariant - Variante de UI (opcional)
 */
export function trackLoginSucceeded(
  method: BaseAuthEventProperties['method'],
  redirectTo: string,
  accountState: LoginSuccessProperties['account_state'] = 'active',
  uiVariant?: string
): void {
  // No-op in test environment
  if (import.meta.env.MODE === 'test' || import.meta.env.VITEST) {
    return;
  }

  try {
    const properties: LoginSuccessProperties = {
      flow: 'auth_login',
      method,
      redirect_to: redirectTo,
      account_state: accountState,
      ...(uiVariant && { ui_variant: uiVariant })
    };

    amplitude.track('auth_login_succeeded', properties);
  } catch (error) {
    console.error('[Auth Events] Failed to track login succeeded:', error);
  }
}

/**
 * Track auth_login_failed event
 * 
 * Se dispara: Error controlado del backend durante login
 * NO enviar mensajes de error crudos, solo códigos normalizados
 *
 * @param method - Método de autenticación usado
 * @param errorMessage - Mensaje de error del backend (será normalizado)
 * @param uiVariant - Variante de UI (opcional)
 */
export function trackLoginFailed(
  method: BaseAuthEventProperties['method'],
  errorMessage: string,
  uiVariant?: string
): void {
  // No-op in test environment
  if (import.meta.env.MODE === 'test' || import.meta.env.VITEST) {
    return;
  }

  try {
    // Normalizar error message a error code (NO enviar mensaje crudo)
    const { errorCode, retryable } = normalizeErrorToCode(errorMessage);

    const properties: LoginFailedProperties = {
      flow: 'auth_login',
      method,
      error_code: errorCode,
      retryable,
      ...(uiVariant && { ui_variant: uiVariant })
    };

    amplitude.track('auth_login_failed', properties);
  } catch (error) {
    console.error('[Auth Events] Failed to track login failed:', error);
  }
}

/**
 * Normaliza mensajes de error del backend a códigos estructurados
 * 
 * Reglas:
 * - NO enviar mensajes de error crudos (pueden contener PII)
 * - Usar solo códigos definidos en LoginFailedProperties
 * - Determinar si el error es retryable
 *
 * @internal
 */
function normalizeErrorToCode(errorMessage: string): {
  errorCode: LoginFailedProperties['error_code'];
  retryable: boolean;
} {
  const message = errorMessage.toLowerCase();

  // Credenciales inválidas (no retryable)
  if (
    message.includes('invalid') || 
    message.includes('incorrect') || 
    message.includes('wrong') ||
    message.includes('credentials')
  ) {
    return { errorCode: 'invalid_credentials', retryable: false };
  }

  // Cuenta bloqueada (no retryable)
  if (message.includes('locked') || message.includes('blocked')) {
    return { errorCode: 'account_locked', retryable: false };
  }

  // Cuenta suspendida (no retryable)
  if (message.includes('suspended') || message.includes('disabled')) {
    return { errorCode: 'account_suspended', retryable: false };
  }

  // Error de red (retryable)
  if (
    message.includes('network') || 
    message.includes('timeout') || 
    message.includes('connection')
  ) {
    return { errorCode: 'network_error', retryable: true };
  }

  // Error desconocido (retryable por defecto)
  return { errorCode: 'unknown_error', retryable: true };
}
