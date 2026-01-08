/**
 * @fileoverview Auth Actions Constants - ROA-523
 * @module constants/authActions
 * 
 * Definición de acciones de autenticación para rate limiting policy.
 * Estas constantes se usan en el wiring Auth → RateLimitPolicyGlobal.
 * 
 * SSOT Reference: Section 12.4 (Auth Rate Limiting)
 */

/**
 * Acciones de autenticación soportadas por RateLimitPolicyGlobal
 * Estas deben coincidir con las acciones definidas en SSOT v2 sección 12.6
 * 
 * @enum {string}
 */
const AUTH_ACTIONS = {
  LOGIN: 'auth_login',
  REGISTER: 'auth_register',
  PASSWORD_RECOVERY: 'auth_password_recovery',
  MAGIC_LINK: 'auth_magic_link'
};

/**
 * Tipos de autenticación para RateLimitPolicyGlobal
 * Estos se mapean a los scopes del policy global
 * 
 * @enum {string}
 */
const AUTH_TYPES = {
  PASSWORD: 'password',
  MAGIC_LINK: 'magic_link',
  PASSWORD_RESET: 'password_reset'
};

/**
 * Scope para todas las acciones de Auth
 * @constant {string}
 */
const AUTH_SCOPE = 'auth';

module.exports = {
  AUTH_ACTIONS,
  AUTH_TYPES,
  AUTH_SCOPE
};

