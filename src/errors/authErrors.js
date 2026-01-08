/**
 * @fileoverview Auth Error Codes V2 - ROA-523, ROA-405
 * @module errors/authErrors
 * 
 * Taxonomía de errores de autenticación v2.
 * Contrato estable para backend + frontend sin PII ni detalles internos.
 * 
 * SSOT Reference: Section 12.4.1 (Auth Error Taxonomy V2)
 */

/**
 * Códigos de error de autenticación v2
 * @enum {string}
 */
const AUTH_ERROR_CODES = {
  // Rate Limiting - ROA-523
  AUTH_RATE_LIMITED: 'AUTH_RATE_LIMITED',       // Temporary block por rate limiting
  AUTH_ACCOUNT_BLOCKED: 'AUTH_ACCOUNT_BLOCKED', // Permanent block (requiere intervención manual)
  
  // Credenciales / Autenticación
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_EMAIL_NOT_CONFIRMED: 'AUTH_EMAIL_NOT_CONFIRMED',
  AUTH_ACCOUNT_DISABLED: 'AUTH_ACCOUNT_DISABLED',
  
  // Token / Sesión
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  
  // Password
  AUTH_WEAK_PASSWORD: 'AUTH_WEAK_PASSWORD',
  AUTH_PASSWORD_REUSED: 'AUTH_PASSWORD_REUSED',
  
  // Validación de entrada
  AUTH_INVALID_EMAIL: 'AUTH_INVALID_EMAIL',
  AUTH_MISSING_FIELDS: 'AUTH_MISSING_FIELDS',
  
  // Genéricos
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  AUTH_SERVER_ERROR: 'AUTH_SERVER_ERROR'
};

/**
 * Mensajes de error genéricos (sin revelar detalles internos)
 * @type {Object.<string, string>}
 */
const AUTH_ERROR_MESSAGES = {
  [AUTH_ERROR_CODES.AUTH_RATE_LIMITED]: 
    'Too many attempts. Please try again later.',
  [AUTH_ERROR_CODES.AUTH_ACCOUNT_BLOCKED]: 
    'Your account has been temporarily blocked. Please contact support.',
  [AUTH_ERROR_CODES.AUTH_INVALID_CREDENTIALS]: 
    'Invalid email or password.',
  [AUTH_ERROR_CODES.AUTH_EMAIL_NOT_CONFIRMED]: 
    'Please confirm your email before logging in.',
  [AUTH_ERROR_CODES.AUTH_ACCOUNT_DISABLED]: 
    'This account has been disabled.',
  [AUTH_ERROR_CODES.AUTH_INVALID_TOKEN]: 
    'Invalid authentication token.',
  [AUTH_ERROR_CODES.AUTH_TOKEN_EXPIRED]: 
    'Your session has expired. Please log in again.',
  [AUTH_ERROR_CODES.AUTH_SESSION_EXPIRED]: 
    'Your session has expired. Please log in again.',
  [AUTH_ERROR_CODES.AUTH_WEAK_PASSWORD]: 
    'Password does not meet security requirements.',
  [AUTH_ERROR_CODES.AUTH_PASSWORD_REUSED]: 
    'You cannot reuse a recent password.',
  [AUTH_ERROR_CODES.AUTH_INVALID_EMAIL]: 
    'Invalid email address.',
  [AUTH_ERROR_CODES.AUTH_MISSING_FIELDS]: 
    'Required fields are missing.',
  [AUTH_ERROR_CODES.AUTH_UNAUTHORIZED]: 
    'You are not authorized to perform this action.',
  [AUTH_ERROR_CODES.AUTH_SERVER_ERROR]: 
    'An error occurred. Please try again.'
};

/**
 * Clase de error de autenticación con tipado y metadata
 */
class AuthError extends Error {
  /**
   * @param {string} code - Código de error (AUTH_ERROR_CODES)
   * @param {string} [message] - Mensaje opcional (por defecto usa AUTH_ERROR_MESSAGES)
   * @param {Object} [metadata] - Metadata adicional (NO PII)
   * @param {boolean} [retryable=false] - Si el usuario puede reintentar
   * @param {number} [retryAfterSeconds] - Segundos hasta poder reintentar
   */
  constructor(code, message, metadata = {}, retryable = false, retryAfterSeconds = null) {
    const errorMessage = message || AUTH_ERROR_MESSAGES[code] || 'Authentication error';
    super(errorMessage);
    
    this.name = 'AuthError';
    this.code = code;
    this.metadata = metadata;
    this.retryable = retryable;
    this.retryAfterSeconds = retryAfterSeconds;
    
    // Mantener stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthError);
    }
  }
  
  /**
   * Convertir a formato JSON para respuesta HTTP
   * @returns {Object}
   */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.retryAfterSeconds && { retryAfterSeconds: this.retryAfterSeconds }),
      ...(Object.keys(this.metadata).length > 0 && { metadata: this.metadata })
    };
  }
}

/**
 * Factory para crear AuthErrors específicos de rate limiting
 */
const createRateLimitError = (policyResult) => {
  const isTemporary = policyResult.block_type === 'temporary';
  const code = isTemporary 
    ? AUTH_ERROR_CODES.AUTH_RATE_LIMITED 
    : AUTH_ERROR_CODES.AUTH_ACCOUNT_BLOCKED;
  
  return new AuthError(
    code,
    AUTH_ERROR_MESSAGES[code],
    { policy: 'rate_limit', scope: 'auth' },
    isTemporary, // Solo temporary es retryable
    policyResult.retry_after_seconds
  );
};

module.exports = {
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
  AuthError,
  createRateLimitError
};

