/**
 * Auth Feature Flags Loader (ROA-406)
 * 
 * SSOT v2 compliance:
 * - Fail-closed defaults (all false)
 * - NO environment variable fallbacks
 * - Single source of truth: SettingsLoader v2
 * 
 * Used by: auth routes to gate sensitive endpoints
 */

import { loadSettings } from './loadSettings.js';
import { logger } from '../utils/logger.js';
import { AuthError, AUTH_ERROR_CODES } from '../utils/authErrorTaxonomy.js';

/**
 * Auth feature flags defined in SSOT v2, section 3
 */
export interface AuthFlags {
  auth_enable_login: boolean;
  auth_enable_register: boolean;
  auth_enable_magic_link: boolean;
  auth_enable_password_recovery: boolean;
}

/**
 * Fail-closed defaults (SSOT v2 requirement)
 * All auth endpoints disabled by default for security
 */
const DEFAULT_AUTH_FLAGS: AuthFlags = {
  auth_enable_login: false,
  auth_enable_register: false,
  auth_enable_magic_link: false,
  auth_enable_password_recovery: false
};

/**
 * Carga los feature flags de autenticación desde SettingsLoader v2.
 * 
 * Behavior:
 * - Si SettingsLoader falla → devuelve defaults fail-closed
 * - Si los flags no están definidos → devuelve defaults fail-closed
 * - NO usa variables de entorno como fallback (SSOT v2 enforcement)
 * 
 * @returns {Promise<AuthFlags>} Feature flags de auth
 */
export async function loadAuthFlags(): Promise<AuthFlags> {
  try {
    const settings = await loadSettings();

    return {
      auth_enable_login:
        settings?.feature_flags?.auth_enable_login ?? DEFAULT_AUTH_FLAGS.auth_enable_login,
      auth_enable_register:
        settings?.feature_flags?.auth_enable_register ?? DEFAULT_AUTH_FLAGS.auth_enable_register,
      auth_enable_magic_link:
        settings?.feature_flags?.auth_enable_magic_link ?? DEFAULT_AUTH_FLAGS.auth_enable_magic_link,
      auth_enable_password_recovery:
        settings?.feature_flags?.auth_enable_password_recovery ??
        DEFAULT_AUTH_FLAGS.auth_enable_password_recovery
    };
  } catch (error) {
    logger.error('Failed to load auth feature flags from settings, using fail-closed defaults', {
      error
    });
    return DEFAULT_AUTH_FLAGS;
  }
}

/**
 * Verifica si un endpoint de autenticación está habilitado por feature flag.
 * 
 * Si el flag está deshabilitado, lanza AuthError con código AUTH_DISABLED.
 * 
 * @param {keyof AuthFlags} flag - Feature flag a verificar
 * @param {string} policy - Nombre de la política para logging
 * @returns {Promise<boolean>} true si está habilitado
 * @throws {AuthError} Si el endpoint está deshabilitado
 */
export async function isAuthEndpointEnabled(
  flag: keyof AuthFlags,
  policy: string
): Promise<boolean> {
  const flags = await loadAuthFlags();

  if (!flags[flag]) {
    logger.warn(`Auth endpoint disabled by feature flag: ${flag}`, { policy: `feature_flag:${policy}` });
    throw new AuthError(AUTH_ERROR_CODES.AUTH_DISABLED);
  }

  return true;
}
