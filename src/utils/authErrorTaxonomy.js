/**
 * Auth Error Taxonomy v2
 * 
 * Comprehensive taxonomy for authentication and authorization errors
 * with specific error codes, messages, and handling strategies.
 * 
 * @version 2.0
 * @author Roastr.ai Team
 */

const { logger } = require('./logger');

/**
 * Authentication Error Codes
 * 
 * Categorías:
 * - AUTH_*: Errores de autenticación (401)
 * - AUTHZ_*: Errores de autorización (403)
 * - SESSION_*: Errores de sesión
 * - TOKEN_*: Errores de tokens
 * - ACCOUNT_*: Errores de cuenta
 */
const AUTH_ERROR_CODES = {
  // Token Errors (401)
  TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
  TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  TOKEN_REVOKED: 'AUTH_TOKEN_REVOKED',
  TOKEN_MALFORMED: 'AUTH_TOKEN_MALFORMED',
  TOKEN_SIGNATURE_INVALID: 'AUTH_TOKEN_SIGNATURE_INVALID',
  
  // Session Errors (401)
  SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  SESSION_INVALID: 'AUTH_SESSION_INVALID',
  SESSION_NOT_FOUND: 'AUTH_SESSION_NOT_FOUND',
  SESSION_REVOKED: 'AUTH_SESSION_REVOKED',
  
  // Credential Errors (401)
  INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  EMAIL_NOT_FOUND: 'AUTH_EMAIL_NOT_FOUND',
  PASSWORD_INCORRECT: 'AUTH_PASSWORD_INCORRECT',
  ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
  ACCOUNT_DISABLED: 'AUTH_ACCOUNT_DISABLED',
  
  // Verification Errors (401)
  EMAIL_NOT_VERIFIED: 'AUTH_EMAIL_NOT_VERIFIED',
  MAGIC_LINK_EXPIRED: 'AUTH_MAGIC_LINK_EXPIRED',
  MAGIC_LINK_INVALID: 'AUTH_MAGIC_LINK_INVALID',
  MAGIC_LINK_ALREADY_USED: 'AUTH_MAGIC_LINK_ALREADY_USED',
  
  // Registration Errors (400/401)
  EMAIL_ALREADY_EXISTS: 'AUTH_EMAIL_ALREADY_EXISTS',
  PASSWORD_TOO_WEAK: 'AUTH_PASSWORD_TOO_WEAK',
  INVALID_EMAIL_FORMAT: 'AUTH_INVALID_EMAIL_FORMAT',
  SIGNUP_DISABLED: 'AUTH_SIGNUP_DISABLED',
  
  // Authorization Errors (403)
  INSUFFICIENT_PERMISSIONS: 'AUTHZ_INSUFFICIENT_PERMISSIONS',
  ADMIN_REQUIRED: 'AUTHZ_ADMIN_REQUIRED',
  SUPERADMIN_REQUIRED: 'AUTHZ_SUPERADMIN_REQUIRED',
  RESOURCE_ACCESS_DENIED: 'AUTHZ_RESOURCE_ACCESS_DENIED',
  ORGANIZATION_ACCESS_DENIED: 'AUTHZ_ORGANIZATION_ACCESS_DENIED',
  PLAN_FEATURE_RESTRICTED: 'AUTHZ_PLAN_FEATURE_RESTRICTED',
  
  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED: 'AUTH_RATE_LIMIT_EXCEEDED',
  TOO_MANY_LOGIN_ATTEMPTS: 'AUTH_TOO_MANY_LOGIN_ATTEMPTS',
  TOO_MANY_SIGNUP_ATTEMPTS: 'AUTH_TOO_MANY_SIGNUP_ATTEMPTS',
  TOO_MANY_PASSWORD_RESETS: 'AUTH_TOO_MANY_PASSWORD_RESETS',
  
  // System Errors (500)
  AUTH_SERVICE_UNAVAILABLE: 'AUTH_SERVICE_UNAVAILABLE',
  TOKEN_GENERATION_FAILED: 'AUTH_TOKEN_GENERATION_FAILED',
  SESSION_CREATION_FAILED: 'AUTH_SESSION_CREATION_FAILED',
  DATABASE_ERROR: 'AUTH_DATABASE_ERROR'
};

/**
 * Error Code Metadata
 * 
 * Define metadata para cada código de error:
 * - httpStatus: HTTP status code
 * - severity: LOW, MEDIUM, HIGH, CRITICAL
 * - retryable: Si el error es recuperable
 * - userMessage: Mensaje seguro para mostrar al usuario
 * - logLevel: Nivel de log apropiado
 * - action: Acción recomendada para el cliente
 */
const ERROR_METADATA = {
  [AUTH_ERROR_CODES.TOKEN_MISSING]: {
    httpStatus: 401,
    severity: 'MEDIUM',
    retryable: false,
    userMessage: 'Authentication required',
    logLevel: 'warn',
    action: 'REQUIRE_LOGIN'
  },
  [AUTH_ERROR_CODES.TOKEN_INVALID]: {
    httpStatus: 401,
    severity: 'MEDIUM',
    retryable: false,
    userMessage: 'Invalid authentication token',
    logLevel: 'warn',
    action: 'REQUIRE_LOGIN'
  },
  [AUTH_ERROR_CODES.TOKEN_EXPIRED]: {
    httpStatus: 401,
    severity: 'LOW',
    retryable: true,
    userMessage: 'Session expired',
    logLevel: 'info',
    action: 'REFRESH_TOKEN'
  },
  [AUTH_ERROR_CODES.TOKEN_REVOKED]: {
    httpStatus: 401,
    severity: 'MEDIUM',
    retryable: false,
    userMessage: 'Session revoked',
    logLevel: 'warn',
    action: 'REQUIRE_LOGIN'
  },
  [AUTH_ERROR_CODES.TOKEN_MALFORMED]: {
    httpStatus: 401,
    severity: 'MEDIUM',
    retryable: false,
    userMessage: 'Invalid authentication token',
    logLevel: 'warn',
    action: 'REQUIRE_LOGIN'
  },
  [AUTH_ERROR_CODES.TOKEN_SIGNATURE_INVALID]: {
    httpStatus: 401,
    severity: 'HIGH',
    retryable: false,
    userMessage: 'Invalid authentication token',
    logLevel: 'error',
    action: 'REQUIRE_LOGIN'
  },
  [AUTH_ERROR_CODES.SESSION_EXPIRED]: {
    httpStatus: 401,
    severity: 'LOW',
    retryable: true,
    userMessage: 'Session expired',
    logLevel: 'info',
    action: 'REFRESH_TOKEN'
  },
  [AUTH_ERROR_CODES.SESSION_INVALID]: {
    httpStatus: 401,
    severity: 'MEDIUM',
    retryable: false,
    userMessage: 'Invalid session',
    logLevel: 'warn',
    action: 'REQUIRE_LOGIN'
  },
  [AUTH_ERROR_CODES.SESSION_NOT_FOUND]: {
    httpStatus: 401,
    severity: 'MEDIUM',
    retryable: false,
    userMessage: 'Session not found',
    logLevel: 'warn',
    action: 'REQUIRE_LOGIN'
  },
  [AUTH_ERROR_CODES.SESSION_REVOKED]: {
    httpStatus: 401,
    severity: 'MEDIUM',
    retryable: false,
    userMessage: 'Session revoked',
    logLevel: 'warn',
    action: 'REQUIRE_LOGIN'
  },
  [AUTH_ERROR_CODES.INVALID_CREDENTIALS]: {
    httpStatus: 401,
    severity: 'MEDIUM',
    retryable: false,
    userMessage: 'Invalid email or password',
    logLevel: 'warn',
    action: 'SHOW_ERROR'
  },
  [AUTH_ERROR_CODES.EMAIL_NOT_FOUND]: {
    httpStatus: 401,
    severity: 'LOW',
    retryable: false,
    userMessage: 'Invalid email or password', // Anti-enumeration
    logLevel: 'info',
    action: 'SHOW_ERROR'
  },
  [AUTH_ERROR_CODES.PASSWORD_INCORRECT]: {
    httpStatus: 401,
    severity: 'LOW',
    retryable: false,
    userMessage: 'Invalid email or password', // Anti-enumeration
    logLevel: 'info',
    action: 'SHOW_ERROR'
  },
  [AUTH_ERROR_CODES.ACCOUNT_LOCKED]: {
    httpStatus: 401,
    severity: 'HIGH',
    retryable: false,
    userMessage: 'Account temporarily locked due to multiple failed login attempts',
    logLevel: 'warn',
    action: 'SHOW_ERROR'
  },
  [AUTH_ERROR_CODES.ACCOUNT_DISABLED]: {
    httpStatus: 401,
    severity: 'HIGH',
    retryable: false,
    userMessage: 'Account disabled. Please contact support',
    logLevel: 'error',
    action: 'SHOW_ERROR'
  },
  [AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED]: {
    httpStatus: 401,
    severity: 'MEDIUM',
    retryable: false,
    userMessage: 'Please verify your email address',
    logLevel: 'info',
    action: 'REQUIRE_VERIFICATION'
  },
  [AUTH_ERROR_CODES.MAGIC_LINK_EXPIRED]: {
    httpStatus: 401,
    severity: 'LOW',
    retryable: true,
    userMessage: 'Magic link expired. Please request a new one',
    logLevel: 'info',
    action: 'REQUEST_NEW_LINK'
  },
  [AUTH_ERROR_CODES.MAGIC_LINK_INVALID]: {
    httpStatus: 401,
    severity: 'MEDIUM',
    retryable: false,
    userMessage: 'Invalid magic link',
    logLevel: 'warn',
    action: 'REQUEST_NEW_LINK'
  },
  [AUTH_ERROR_CODES.MAGIC_LINK_ALREADY_USED]: {
    httpStatus: 401,
    severity: 'LOW',
    retryable: false,
    userMessage: 'Magic link already used. Please request a new one',
    logLevel: 'info',
    action: 'REQUEST_NEW_LINK'
  },
  [AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS]: {
    httpStatus: 409,
    severity: 'LOW',
    retryable: false,
    userMessage: 'An account with this email already exists',
    logLevel: 'info',
    action: 'SHOW_ERROR'
  },
  [AUTH_ERROR_CODES.PASSWORD_TOO_WEAK]: {
    httpStatus: 400,
    severity: 'LOW',
    retryable: false,
    userMessage: 'Password does not meet security requirements',
    logLevel: 'info',
    action: 'SHOW_ERROR'
  },
  [AUTH_ERROR_CODES.INVALID_EMAIL_FORMAT]: {
    httpStatus: 400,
    severity: 'LOW',
    retryable: false,
    userMessage: 'Invalid email format',
    logLevel: 'info',
    action: 'SHOW_ERROR'
  },
  [AUTH_ERROR_CODES.SIGNUP_DISABLED]: {
    httpStatus: 403,
    severity: 'MEDIUM',
    retryable: false,
    userMessage: 'Registration is currently disabled',
    logLevel: 'warn',
    action: 'SHOW_ERROR'
  },
  [AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS]: {
    httpStatus: 403,
    severity: 'MEDIUM',
    retryable: false,
    userMessage: 'Insufficient permissions',
    logLevel: 'warn',
    action: 'SHOW_ERROR'
  },
  [AUTH_ERROR_CODES.ADMIN_REQUIRED]: {
    httpStatus: 403,
    severity: 'MEDIUM',
    retryable: false,
    userMessage: 'Admin access required',
    logLevel: 'warn',
    action: 'SHOW_ERROR'
  },
  [AUTH_ERROR_CODES.SUPERADMIN_REQUIRED]: {
    httpStatus: 403,
    severity: 'HIGH',
    retryable: false,
    userMessage: 'Superadmin access required',
    logLevel: 'error',
    action: 'SHOW_ERROR'
  },
  [AUTH_ERROR_CODES.RESOURCE_ACCESS_DENIED]: {
    httpStatus: 403,
    severity: 'MEDIUM',
    retryable: false,
    userMessage: 'Access denied to this resource',
    logLevel: 'warn',
    action: 'SHOW_ERROR'
  },
  [AUTH_ERROR_CODES.ORGANIZATION_ACCESS_DENIED]: {
    httpStatus: 403,
    severity: 'MEDIUM',
    retryable: false,
    userMessage: 'Access denied to this organization',
    logLevel: 'warn',
    action: 'SHOW_ERROR'
  },
  [AUTH_ERROR_CODES.PLAN_FEATURE_RESTRICTED]: {
    httpStatus: 403,
    severity: 'LOW',
    retryable: false,
    userMessage: 'This feature is not available in your current plan',
    logLevel: 'info',
    action: 'SHOW_UPGRADE_PROMPT'
  },
  [AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED]: {
    httpStatus: 429,
    severity: 'LOW',
    retryable: true,
    userMessage: 'Too many requests. Please try again later',
    logLevel: 'warn',
    action: 'RETRY_AFTER_DELAY'
  },
  [AUTH_ERROR_CODES.TOO_MANY_LOGIN_ATTEMPTS]: {
    httpStatus: 429,
    severity: 'MEDIUM',
    retryable: true,
    userMessage: 'Too many login attempts. Please try again later',
    logLevel: 'warn',
    action: 'RETRY_AFTER_DELAY'
  },
  [AUTH_ERROR_CODES.TOO_MANY_SIGNUP_ATTEMPTS]: {
    httpStatus: 429,
    severity: 'MEDIUM',
    retryable: true,
    userMessage: 'Too many signup attempts. Please try again later',
    logLevel: 'warn',
    action: 'RETRY_AFTER_DELAY'
  },
  [AUTH_ERROR_CODES.TOO_MANY_PASSWORD_RESETS]: {
    httpStatus: 429,
    severity: 'MEDIUM',
    retryable: true,
    userMessage: 'Too many password reset requests. Please try again later',
    logLevel: 'warn',
    action: 'RETRY_AFTER_DELAY'
  },
  [AUTH_ERROR_CODES.AUTH_SERVICE_UNAVAILABLE]: {
    httpStatus: 503,
    severity: 'HIGH',
    retryable: true,
    userMessage: 'Authentication service temporarily unavailable',
    logLevel: 'error',
    action: 'RETRY_AFTER_DELAY'
  },
  [AUTH_ERROR_CODES.TOKEN_GENERATION_FAILED]: {
    httpStatus: 500,
    severity: 'HIGH',
    retryable: true,
    userMessage: 'Failed to generate authentication token',
    logLevel: 'error',
    action: 'RETRY_AFTER_DELAY'
  },
  [AUTH_ERROR_CODES.SESSION_CREATION_FAILED]: {
    httpStatus: 500,
    severity: 'HIGH',
    retryable: true,
    userMessage: 'Failed to create session',
    logLevel: 'error',
    action: 'RETRY_AFTER_DELAY'
  },
  [AUTH_ERROR_CODES.DATABASE_ERROR]: {
    httpStatus: 500,
    severity: 'CRITICAL',
    retryable: true,
    userMessage: 'Internal server error',
    logLevel: 'error',
    action: 'RETRY_AFTER_DELAY'
  }
};

/**
 * AuthError Class
 * 
 * Custom error class for authentication errors with taxonomy support
 */
class AuthError extends Error {
  constructor(code, message = null, details = null) {
    const metadata = ERROR_METADATA[code];
    if (!metadata) {
      throw new Error(`Unknown auth error code: ${code}`);
    }

    const userMessage = message || metadata.userMessage;
    super(userMessage);

    this.name = 'AuthError';
    this.code = code;
    this.httpStatus = metadata.httpStatus;
    this.severity = metadata.severity;
    this.retryable = metadata.retryable;
    this.userMessage = userMessage;
    this.logLevel = metadata.logLevel;
    this.action = metadata.action;
    this.details = details;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON() {
    return {
      success: false,
      error: this.userMessage,
      code: this.code,
      httpStatus: this.httpStatus,
      retryable: this.retryable,
      action: this.action,
      timestamp: this.timestamp,
      ...(this.details && { details: this.details })
    };
  }

  /**
   * Log the error with appropriate level
   */
  log(context = {}) {
    const logData = {
      code: this.code,
      message: this.message,
      severity: this.severity,
      httpStatus: this.httpStatus,
      retryable: this.retryable,
      ...context
    };

    switch (this.logLevel) {
      case 'error':
        logger.error(`Auth Error [${this.code}]:`, logData);
        break;
      case 'warn':
        logger.warn(`Auth Warning [${this.code}]:`, logData);
        break;
      case 'info':
        logger.info(`Auth Info [${this.code}]:`, logData);
        break;
      default:
        logger.debug(`Auth Debug [${this.code}]:`, logData);
    }
  }
}

/**
 * Classify Supabase Auth Error
 * 
 * Maps Supabase auth errors to our taxonomy
 */
function classifySupabaseError(supabaseError) {
  if (!supabaseError) {
    return null;
  }

  const message = supabaseError.message?.toLowerCase() || '';
  const status = supabaseError.status;

  // Token errors
  if (message.includes('jwt expired') || message.includes('token expired')) {
    return AUTH_ERROR_CODES.TOKEN_EXPIRED;
  }
  if (message.includes('invalid token') || message.includes('jwt malformed')) {
    return AUTH_ERROR_CODES.TOKEN_INVALID;
  }
  if (message.includes('jwt signature')) {
    return AUTH_ERROR_CODES.TOKEN_SIGNATURE_INVALID;
  }

  // Session errors
  if (message.includes('session not found') || message.includes('session expired')) {
    return AUTH_ERROR_CODES.SESSION_EXPIRED;
  }

  // Credential errors
  if (message.includes('invalid login credentials') || message.includes('invalid password')) {
    return AUTH_ERROR_CODES.INVALID_CREDENTIALS;
  }
  if (message.includes('user not found')) {
    return AUTH_ERROR_CODES.EMAIL_NOT_FOUND;
  }

  // Email verification
  if (message.includes('email not confirmed') || message.includes('email not verified')) {
    return AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED;
  }

  // Magic link errors
  if (message.includes('magic link') && message.includes('expired')) {
    return AUTH_ERROR_CODES.MAGIC_LINK_EXPIRED;
  }
  if (message.includes('magic link') && message.includes('invalid')) {
    return AUTH_ERROR_CODES.MAGIC_LINK_INVALID;
  }

  // Registration errors
  if (message.includes('user already registered') || message.includes('email already exists')) {
    return AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS;
  }
  if (message.includes('password') && (message.includes('weak') || message.includes('short'))) {
    return AUTH_ERROR_CODES.PASSWORD_TOO_WEAK;
  }
  if (message.includes('invalid email')) {
    return AUTH_ERROR_CODES.INVALID_EMAIL_FORMAT;
  }

  // Rate limiting
  if (status === 429 || message.includes('rate limit') || message.includes('too many')) {
    return AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED;
  }

  // Default based on status
  if (status === 401) {
    return AUTH_ERROR_CODES.INVALID_CREDENTIALS;
  }
  if (status === 403) {
    return AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS;
  }

  return AUTH_ERROR_CODES.AUTH_SERVICE_UNAVAILABLE;
}

/**
 * Create AuthError from Supabase error
 */
function createAuthErrorFromSupabase(supabaseError, fallbackCode = null) {
  const code = classifySupabaseError(supabaseError) || fallbackCode || AUTH_ERROR_CODES.AUTH_SERVICE_UNAVAILABLE;
  return new AuthError(code, supabaseError?.message || null, {
    originalError: supabaseError?.message,
    supabaseStatus: supabaseError?.status
  });
}

/**
 * Check if error is retryable
 */
function isRetryableError(error) {
  if (error instanceof AuthError) {
    return error.retryable;
  }
  if (error.code && ERROR_METADATA[error.code]) {
    return ERROR_METADATA[error.code].retryable;
  }
  return false;
}

/**
 * Get retry delay for error (in seconds)
 */
function getRetryDelay(error) {
  if (!isRetryableError(error)) {
    return null;
  }

  const code = error.code || error;
  const delays = {
    [AUTH_ERROR_CODES.TOKEN_EXPIRED]: 0, // Immediate retry with refresh
    [AUTH_ERROR_CODES.SESSION_EXPIRED]: 0, // Immediate retry with refresh
    [AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED]: 60,
    [AUTH_ERROR_CODES.TOO_MANY_LOGIN_ATTEMPTS]: 300, // 5 minutes
    [AUTH_ERROR_CODES.TOO_MANY_SIGNUP_ATTEMPTS]: 300,
    [AUTH_ERROR_CODES.TOO_MANY_PASSWORD_RESETS]: 600, // 10 minutes
    [AUTH_ERROR_CODES.AUTH_SERVICE_UNAVAILABLE]: 30,
    [AUTH_ERROR_CODES.TOKEN_GENERATION_FAILED]: 5,
    [AUTH_ERROR_CODES.SESSION_CREATION_FAILED]: 5,
    [AUTH_ERROR_CODES.DATABASE_ERROR]: 10
  };

  return delays[code] !== undefined ? delays[code] : null;
}

module.exports = {
  AUTH_ERROR_CODES,
  ERROR_METADATA,
  AuthError,
  classifySupabaseError,
  createAuthErrorFromSupabase,
  isRetryableError,
  getRetryDelay
};

