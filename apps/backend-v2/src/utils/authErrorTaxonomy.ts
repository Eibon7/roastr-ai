/**
 * Auth Error Taxonomy v2
 * 
 * Sistema completo de taxonomía de errores de autenticación
 * basado en SSOT v2 y ROA-372.
 * 
 * Categorías:
 * - AUTH_*: Errores de autenticación (401)
 * - AUTHZ_*: Errores de autorización (403)
 * - SESSION_*: Errores de sesión
 * - TOKEN_*: Errores de tokens
 * - ACCOUNT_*: Errores de cuenta
 */

export const AUTH_ERROR_CODES = {
  // AUTH_* - Errores de autenticación (401)
  INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'AUTH_EMAIL_NOT_VERIFIED',
  ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
  RATE_LIMIT_EXCEEDED: 'AUTH_RATE_LIMIT_EXCEEDED',
  
  // AUTHZ_* - Errores de autorización (403)
  INSUFFICIENT_PERMISSIONS: 'AUTHZ_INSUFFICIENT_PERMISSIONS',
  ROLE_NOT_ALLOWED: 'AUTHZ_ROLE_NOT_ALLOWED',
  MAGIC_LINK_NOT_ALLOWED: 'AUTHZ_MAGIC_LINK_NOT_ALLOWED',
  
  // SESSION_* - Errores de sesión
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_INVALID: 'SESSION_INVALID',
  SESSION_REVOKED: 'SESSION_REVOKED',
  INACTIVITY_TIMEOUT: 'SESSION_INACTIVITY_TIMEOUT',
  
  // TOKEN_* - Errores de tokens
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_MISSING: 'TOKEN_MISSING',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  
  // ACCOUNT_* - Errores de cuenta
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  ACCOUNT_DELETED: 'ACCOUNT_DELETED',
  EMAIL_ALREADY_EXISTS: 'ACCOUNT_EMAIL_ALREADY_EXISTS'
} as const;

export type AuthErrorCode = typeof AUTH_ERROR_CODES[keyof typeof AUTH_ERROR_CODES];

export class AuthError extends Error {
  code: AuthErrorCode;
  statusCode: number;
  details?: unknown;

  constructor(code: AuthErrorCode, message?: string, details?: unknown) {
    super(message || code);
    this.name = 'AuthError';
    this.code = code;
    this.details = details;
    
    // Mapear código a HTTP status code
    if (code.startsWith('AUTH_')) {
      this.statusCode = 401;
    } else if (code.startsWith('AUTHZ_')) {
      this.statusCode = 403;
    } else if (code.startsWith('SESSION_') || code.startsWith('TOKEN_')) {
      this.statusCode = 401;
    } else if (code.startsWith('ACCOUNT_')) {
      this.statusCode = code === 'ACCOUNT_EMAIL_ALREADY_EXISTS' ? 409 : 404;
    } else {
      this.statusCode = 500;
    }
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Mapea errores de Supabase a AuthError
 */
export function mapSupabaseError(error: any): AuthError {
  const message = error?.message || 'Unknown error';
  
  // Email ya existe
  if (message.includes('already registered') || message.includes('duplicate')) {
    return new AuthError(
      AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS,
      'An account with this email already exists',
      error
    );
  }
  
  // Credenciales inválidas
  if (message.includes('Invalid login credentials') || message.includes('wrong password')) {
    return new AuthError(
      AUTH_ERROR_CODES.INVALID_CREDENTIALS,
      'Invalid email or password',
      error
    );
  }
  
  // Email no verificado
  if (message.includes('Email not confirmed')) {
    return new AuthError(
      AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED,
      'Please verify your email before logging in',
      error
    );
  }
  
  // Token expirado
  if (message.includes('expired') || message.includes('JWT expired')) {
    return new AuthError(
      AUTH_ERROR_CODES.TOKEN_EXPIRED,
      'Your session has expired. Please log in again',
      error
    );
  }
  
  // Token inválido
  if (message.includes('invalid') && message.includes('token')) {
    return new AuthError(
      AUTH_ERROR_CODES.TOKEN_INVALID,
      'Invalid authentication token',
      error
    );
  }
  
  // Sesión inválida
  if (message.includes('session')) {
    return new AuthError(
      AUTH_ERROR_CODES.SESSION_INVALID,
      'Invalid session',
      error
    );
  }
  
  // Fallback
  return new AuthError(
    AUTH_ERROR_CODES.INVALID_CREDENTIALS,
    'Authentication failed',
    error
  );
}

/**
 * Determina si un error es retryable
 */
export function isRetryableError(error: AuthError): boolean {
  const retryableCodes = [
    AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED
  ];
  return retryableCodes.includes(error.code);
}

/**
 * Obtiene el delay recomendado para retry
 */
export function getRetryDelay(error: AuthError): number {
  if (error.code === AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED) {
    return 15 * 60 * 1000; // 15 minutos
  }
  return 0;
}
