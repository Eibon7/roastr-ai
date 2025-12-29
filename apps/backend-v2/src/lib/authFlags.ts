/**
 * Auth Feature Flags Loader (ROA-406)
 *
 * Carga feature flags de autenticación desde SSOT v2 vía SettingsLoader.
 * 
 * **Reglas críticas:**
 * - SSOT v2 es la única fuente de verdad (no env vars fallback)
 * - Fail-closed por default (false para todos los flags)
 * - No permite valores hardcoded
 * 
 * @module authFlags
 */

import { loadSettings } from '../lib/loadSettings.js';
import { logger } from '../utils/logger.js';

/**
 * Auth feature flags definidos en SSOT v2 sección 3.2
 */
export interface AuthFlags {
  /** Habilita POST /api/v2/auth/login (email + password) */
  auth_enable_login: boolean;
  
  /** Habilita POST /api/v2/auth/register (nuevo registro) */
  auth_enable_register: boolean;
  
  /** Habilita POST /api/v2/auth/magic-link (passwordless) */
  auth_enable_magic_link: boolean;
  
  /** Habilita POST /api/v2/auth/password-recovery (reset password) */
  auth_enable_password_recovery: boolean;
}

/**
 * Default values: Fail-closed (false) para todos los flags de auth
 * 
 * Según SSOT v2 sección 3.3:
 * - Todos los auth endpoints están disabled por default
 * - Deben habilitarse explícitamente desde admin_settings
 */
const DEFAULT_AUTH_FLAGS: AuthFlags = {
  auth_enable_login: false,
  auth_enable_register: false,
  auth_enable_magic_link: false,
  auth_enable_password_recovery: false
};

/**
 * Carga auth feature flags desde SSOT v2
 * 
 * **Fail-closed behavior:**
 * - Si loadSettings() falla → devuelve defaults (todos false)
 * - Si flag no definido en SSOT → devuelve false
 * - NO hay fallback a env vars
 * 
 * @returns AuthFlags con valores desde SSOT o defaults fail-closed
 * 
 * @example
 * const flags = await loadAuthFlags();
 * if (!flags.auth_enable_login) {
 *   throw new AuthError(AUTH_ERROR_CODES.AUTH_DISABLED);
 * }
 */
export async function loadAuthFlags(): Promise<AuthFlags> {
  try {
    const settings = await loadSettings();
    
    // Extract auth flags desde feature_flags namespace
    const featureFlags = settings?.feature_flags || {};
    
    return {
      auth_enable_login: featureFlags.auth_enable_login ?? DEFAULT_AUTH_FLAGS.auth_enable_login,
      auth_enable_register: featureFlags.auth_enable_register ?? DEFAULT_AUTH_FLAGS.auth_enable_register,
      auth_enable_magic_link: featureFlags.auth_enable_magic_link ?? DEFAULT_AUTH_FLAGS.auth_enable_magic_link,
      auth_enable_password_recovery: featureFlags.auth_enable_password_recovery ?? DEFAULT_AUTH_FLAGS.auth_enable_password_recovery
    };
  } catch (error) {
    // Fail-closed: si no se puede cargar settings, devolver defaults (todos false)
    logger.warn('auth_flags.load_failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      defaults_applied: true
    });
    
    return DEFAULT_AUTH_FLAGS;
  }
}

/**
 * Verifica si un auth endpoint específico está habilitado
 * 
 * @param endpoint - Nombre del endpoint ('login' | 'register' | 'magic_link' | 'password_recovery')
 * @returns true si el endpoint está habilitado, false otherwise
 * 
 * @example
 * if (!(await isAuthEndpointEnabled('login'))) {
 *   throw new AuthError(AUTH_ERROR_CODES.AUTH_DISABLED);
 * }
 */
export async function isAuthEndpointEnabled(
  endpoint: 'login' | 'register' | 'magic_link' | 'password_recovery'
): Promise<boolean> {
  const flags = await loadAuthFlags();
  
  const flagMap: Record<typeof endpoint, keyof AuthFlags> = {
    login: 'auth_enable_login',
    register: 'auth_enable_register',
    magic_link: 'auth_enable_magic_link',
    password_recovery: 'auth_enable_password_recovery'
  };
  
  return flags[flagMap[endpoint]];
}

