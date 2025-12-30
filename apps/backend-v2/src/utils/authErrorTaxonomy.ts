/**
 * Auth Error Handling (V2) — ROA-405
 *
 * ⚠️ Contrato público (backend → frontend):
 * - Nunca devolver mensajes técnicos ni PII
 * - Frontend resuelve por `slug` (NO por http_status)
 *
 * Public error payload (body):
 * {
 *   success: false,
 *   error: { slug: 'AUTH_INVALID_CREDENTIALS', retryable: false },
 *   request_id: 'uuid'
 * }
 */

export type AuthErrorCategory = 'auth' | 'authz' | 'session' | 'token' | 'account' | 'policy';

export type AuthErrorSlug =
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_EMAIL_NOT_CONFIRMED'
  | 'AUTH_ACCOUNT_LOCKED'
  | 'AUTH_DISABLED'
  | 'AUTH_EMAIL_DISABLED'
  | 'AUTH_EMAIL_PROVIDER_ERROR'
  | 'AUTH_EMAIL_RATE_LIMITED'
  | 'AUTH_EMAIL_SEND_FAILED'
  | 'AUTH_UNKNOWN'
  | 'AUTHZ_INSUFFICIENT_PERMISSIONS'
  | 'AUTHZ_ROLE_NOT_ALLOWED'
  | 'AUTHZ_MAGIC_LINK_NOT_ALLOWED'
  | 'AUTHZ_ADMIN_REQUIRED'
  | 'SESSION_EXPIRED'
  | 'SESSION_INVALID'
  | 'SESSION_REVOKED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'TOKEN_MISSING'
  | 'TOKEN_REVOKED'
  | 'ACCOUNT_NOT_FOUND'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_BANNED'
  | 'ACCOUNT_DELETED'
  | 'ACCOUNT_EMAIL_ALREADY_EXISTS'
  | 'ACCOUNT_BLOCKED'
  | 'POLICY_RATE_LIMITED'
  | 'POLICY_ABUSE_DETECTED'
  | 'POLICY_BLOCKED'
  | 'POLICY_INVALID_REQUEST'
  | 'POLICY_NOT_FOUND';

export type AuthErrorV2 = {
  slug: AuthErrorSlug;
  http_status: number;
  retryable: boolean;
  user_message_key: string;
  category: AuthErrorCategory;
};

export const AUTH_ERROR_TAXONOMY: Record<AuthErrorSlug, AuthErrorV2> = {
  AUTH_INVALID_CREDENTIALS: {
    slug: 'AUTH_INVALID_CREDENTIALS',
    http_status: 401,
    retryable: false,
    user_message_key: 'auth.error.invalid_credentials',
    category: 'auth'
  },
  AUTH_EMAIL_NOT_CONFIRMED: {
    slug: 'AUTH_EMAIL_NOT_CONFIRMED',
    http_status: 401,
    retryable: false,
    user_message_key: 'auth.error.email_not_confirmed',
    category: 'auth'
  },
  AUTH_ACCOUNT_LOCKED: {
    slug: 'AUTH_ACCOUNT_LOCKED',
    http_status: 401,
    retryable: false,
    user_message_key: 'auth.error.account_locked',
    category: 'auth'
  },
  AUTH_DISABLED: {
    slug: 'AUTH_DISABLED',
    http_status: 401,
    retryable: true,
    user_message_key: 'auth.error.auth_disabled',
    category: 'auth'
  },
  AUTH_EMAIL_DISABLED: {
    slug: 'AUTH_EMAIL_DISABLED',
    http_status: 403,
    retryable: false,
    user_message_key: 'auth.error.email_disabled',
    category: 'auth'
  },
  AUTH_EMAIL_PROVIDER_ERROR: {
    slug: 'AUTH_EMAIL_PROVIDER_ERROR',
    http_status: 502,
    retryable: true,
    user_message_key: 'auth.error.email_provider_error',
    category: 'auth'
  },
  AUTH_EMAIL_RATE_LIMITED: {
    slug: 'AUTH_EMAIL_RATE_LIMITED',
    http_status: 429,
    retryable: true,
    user_message_key: 'auth.error.email_rate_limited',
    category: 'auth'
  },
  AUTH_EMAIL_SEND_FAILED: {
    slug: 'AUTH_EMAIL_SEND_FAILED',
    http_status: 500,
    retryable: false,
    user_message_key: 'auth.error.email_send_failed',
    category: 'auth'
  },
  AUTH_UNKNOWN: {
    slug: 'AUTH_UNKNOWN',
    http_status: 500,
    retryable: false,
    user_message_key: 'auth.error.unknown',
    category: 'auth'
  },

  AUTHZ_INSUFFICIENT_PERMISSIONS: {
    slug: 'AUTHZ_INSUFFICIENT_PERMISSIONS',
    http_status: 403,
    retryable: false,
    user_message_key: 'auth.error.insufficient_permissions',
    category: 'authz'
  },
  AUTHZ_ROLE_NOT_ALLOWED: {
    slug: 'AUTHZ_ROLE_NOT_ALLOWED',
    http_status: 403,
    retryable: false,
    user_message_key: 'auth.error.role_not_allowed',
    category: 'authz'
  },
  AUTHZ_MAGIC_LINK_NOT_ALLOWED: {
    slug: 'AUTHZ_MAGIC_LINK_NOT_ALLOWED',
    http_status: 403,
    retryable: false,
    user_message_key: 'auth.error.magic_link_not_allowed',
    category: 'authz'
  },
  AUTHZ_ADMIN_REQUIRED: {
    slug: 'AUTHZ_ADMIN_REQUIRED',
    http_status: 403,
    retryable: false,
    user_message_key: 'auth.error.admin_required',
    category: 'authz'
  },

  SESSION_EXPIRED: {
    slug: 'SESSION_EXPIRED',
    http_status: 401,
    retryable: true,
    user_message_key: 'auth.error.session_expired',
    category: 'session'
  },
  SESSION_INVALID: {
    slug: 'SESSION_INVALID',
    http_status: 401,
    retryable: false,
    user_message_key: 'auth.error.session_invalid',
    category: 'session'
  },
  SESSION_REVOKED: {
    slug: 'SESSION_REVOKED',
    http_status: 401,
    retryable: false,
    user_message_key: 'auth.error.session_revoked',
    category: 'session'
  },

  TOKEN_EXPIRED: {
    slug: 'TOKEN_EXPIRED',
    http_status: 401,
    retryable: true,
    user_message_key: 'auth.error.token_expired',
    category: 'token'
  },
  TOKEN_INVALID: {
    slug: 'TOKEN_INVALID',
    http_status: 401,
    retryable: false,
    user_message_key: 'auth.error.token_invalid',
    category: 'token'
  },
  TOKEN_MISSING: {
    slug: 'TOKEN_MISSING',
    http_status: 401,
    retryable: false,
    user_message_key: 'auth.error.token_missing',
    category: 'token'
  },
  TOKEN_REVOKED: {
    slug: 'TOKEN_REVOKED',
    http_status: 401,
    retryable: false,
    user_message_key: 'auth.error.token_revoked',
    category: 'token'
  },

  ACCOUNT_NOT_FOUND: {
    slug: 'ACCOUNT_NOT_FOUND',
    http_status: 404,
    retryable: false,
    user_message_key: 'auth.error.account_not_found',
    category: 'account'
  },
  ACCOUNT_SUSPENDED: {
    slug: 'ACCOUNT_SUSPENDED',
    http_status: 403,
    retryable: false,
    user_message_key: 'auth.error.account_suspended',
    category: 'account'
  },
  ACCOUNT_BANNED: {
    slug: 'ACCOUNT_BANNED',
    http_status: 403,
    retryable: false,
    user_message_key: 'auth.error.account_banned',
    category: 'account'
  },
  ACCOUNT_DELETED: {
    slug: 'ACCOUNT_DELETED',
    http_status: 404,
    retryable: false,
    user_message_key: 'auth.error.account_deleted',
    category: 'account'
  },
  ACCOUNT_EMAIL_ALREADY_EXISTS: {
    slug: 'ACCOUNT_EMAIL_ALREADY_EXISTS',
    http_status: 409,
    retryable: false,
    user_message_key: 'auth.error.email_already_exists',
    category: 'account'
  },
  ACCOUNT_BLOCKED: {
    slug: 'ACCOUNT_BLOCKED',
    http_status: 403,
    retryable: false,
    user_message_key: 'auth.error.account_blocked',
    category: 'account'
  },

  POLICY_RATE_LIMITED: {
    slug: 'POLICY_RATE_LIMITED',
    http_status: 429,
    retryable: true,
    user_message_key: 'auth.error.rate_limited',
    category: 'policy'
  },
  POLICY_ABUSE_DETECTED: {
    slug: 'POLICY_ABUSE_DETECTED',
    http_status: 403,
    retryable: false,
    user_message_key: 'auth.error.abuse_detected',
    category: 'policy'
  },
  POLICY_BLOCKED: {
    slug: 'POLICY_BLOCKED',
    http_status: 403,
    retryable: false,
    user_message_key: 'auth.error.policy_blocked',
    category: 'policy'
  },
  POLICY_INVALID_REQUEST: {
    slug: 'POLICY_INVALID_REQUEST',
    http_status: 400,
    retryable: false,
    user_message_key: 'auth.error.invalid_request',
    category: 'policy'
  },
  POLICY_NOT_FOUND: {
    slug: 'POLICY_NOT_FOUND',
    http_status: 404,
    retryable: false,
    user_message_key: 'auth.error.not_found',
    category: 'policy'
  }
};

/**
 * Back-compat export used across backend-v2 + frontend.
 * ⚠️ Values are the stable slugs (AuthErrorSlug).
 */
export const AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'AUTH_EMAIL_NOT_CONFIRMED',
  EMAIL_NOT_CONFIRMED: 'AUTH_EMAIL_NOT_CONFIRMED',
  ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
  AUTH_DISABLED: 'AUTH_DISABLED',
  AUTH_EMAIL_DISABLED: 'AUTH_EMAIL_DISABLED',
  AUTH_EMAIL_PROVIDER_ERROR: 'AUTH_EMAIL_PROVIDER_ERROR',
  AUTH_EMAIL_RATE_LIMITED: 'AUTH_EMAIL_RATE_LIMITED',
  AUTH_EMAIL_SEND_FAILED: 'AUTH_EMAIL_SEND_FAILED',
  UNKNOWN: 'AUTH_UNKNOWN',

  INSUFFICIENT_PERMISSIONS: 'AUTHZ_INSUFFICIENT_PERMISSIONS',
  ROLE_NOT_ALLOWED: 'AUTHZ_ROLE_NOT_ALLOWED',
  MAGIC_LINK_NOT_ALLOWED: 'AUTHZ_MAGIC_LINK_NOT_ALLOWED',
  ADMIN_REQUIRED: 'AUTHZ_ADMIN_REQUIRED',

  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_INVALID: 'SESSION_INVALID',
  SESSION_REVOKED: 'SESSION_REVOKED',

  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_MISSING: 'TOKEN_MISSING',
  TOKEN_REVOKED: 'TOKEN_REVOKED',

  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  ACCOUNT_BANNED: 'ACCOUNT_BANNED',
  ACCOUNT_DELETED: 'ACCOUNT_DELETED',
  EMAIL_ALREADY_EXISTS: 'ACCOUNT_EMAIL_ALREADY_EXISTS',
  ACCOUNT_BLOCKED: 'ACCOUNT_BLOCKED',

  RATE_LIMITED: 'POLICY_RATE_LIMITED',
  ABUSE_DETECTED: 'POLICY_ABUSE_DETECTED',
  BLOCKED: 'POLICY_BLOCKED',
  INVALID_REQUEST: 'POLICY_INVALID_REQUEST',
  NOT_FOUND: 'POLICY_NOT_FOUND'
} as const satisfies Record<string, AuthErrorSlug>;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

export function getAuthErrorBySlug(slug: AuthErrorSlug): AuthErrorV2 {
  return AUTH_ERROR_TAXONOMY[slug];
}

export class AuthError extends Error {
  readonly slug: AuthErrorSlug;
  readonly http_status: number;
  readonly retryable: boolean;
  readonly user_message_key: string;
  readonly category: AuthErrorCategory;
  readonly cause?: unknown;

  constructor(slug: AuthErrorSlug, options?: { cause?: unknown }) {
    super(slug);
    this.name = 'AuthError';
    this.slug = slug;
    this.cause = options?.cause;

    const def = getAuthErrorBySlug(slug);
    this.http_status = def.http_status;
    this.retryable = def.retryable;
    this.user_message_key = def.user_message_key;
    this.category = def.category;

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Public error contract for API responses.
   */
  toPublicError(): { slug: AuthErrorSlug; retryable: boolean } {
    return { slug: this.slug, retryable: this.retryable };
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

export function failClosedAuthError(cause?: unknown): AuthError {
  return new AuthError(AUTH_ERROR_CODES.UNKNOWN, { cause });
}

/**
 * Mapea errores de Supabase a AuthError (V2).
 *
 * Reglas:
 * - ❌ No exponer mensajes de Supabase al frontend
 * - ✅ Slug estable + retryable explícito
 * - ✅ Fail-closed (AUTH_UNKNOWN) si no se reconoce
 */
export function mapSupabaseError(error: unknown): AuthError {
  const rawMessage = (error as any)?.message?.toString?.() || '';
  const message = rawMessage.toLowerCase();

  // Email ya existe (signup/register)
  if (
    message.includes('already registered') ||
    message.includes('already exists') ||
    message.includes('email address already') ||
    message.includes('duplicate')
  ) {
    return new AuthError(AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS, { cause: error });
  }

  // Credenciales inválidas (anti-enumeration)
  if (message.includes('invalid login credentials') || message.includes('wrong password')) {
    return new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS, { cause: error });
  }

  // Email no confirmado
  if (message.includes('email not confirmed') || message.includes('not confirmed')) {
    return new AuthError(AUTH_ERROR_CODES.EMAIL_NOT_CONFIRMED, { cause: error });
  }

  // Rate limit (infra/policy)
  if (
    message.includes('too many requests') ||
    message.includes('rate_limit') ||
    message.includes('over_request_rate_limit')
  ) {
    return new AuthError(AUTH_ERROR_CODES.RATE_LIMITED, { cause: error });
  }

  // Token expirado
  if (message.includes('jwt expired') || (message.includes('expired') && message.includes('jwt'))) {
    return new AuthError(AUTH_ERROR_CODES.TOKEN_EXPIRED, { cause: error });
  }

  // Token inválido
  if (message.includes('token') && message.includes('invalid')) {
    return new AuthError(AUTH_ERROR_CODES.TOKEN_INVALID, { cause: error });
  }
  if (message.includes('invalid jwt') || (message.includes('jwt') && message.includes('invalid'))) {
    return new AuthError(AUTH_ERROR_CODES.TOKEN_INVALID, { cause: error });
  }

  // Sesión inválida
  if (message.includes('session')) {
    return new AuthError(AUTH_ERROR_CODES.SESSION_INVALID, { cause: error });
  }

  return failClosedAuthError(error);
}

export type PolicyResultV2 =
  | { kind: 'rate_limited'; blocked_until?: number | null }
  | { kind: 'blocked' }
  | { kind: 'invalid_request' };

/**
 * Mapea decisiones de policy → AuthError (V2).
 */
export function mapPolicyResultToAuthError(result: PolicyResultV2): AuthError {
  switch (result.kind) {
    case 'rate_limited':
      return new AuthError(AUTH_ERROR_CODES.RATE_LIMITED, { cause: result });
    case 'blocked':
      return new AuthError(AUTH_ERROR_CODES.BLOCKED, { cause: result });
    case 'invalid_request':
      return new AuthError(AUTH_ERROR_CODES.INVALID_REQUEST, { cause: result });
    default:
      return failClosedAuthError(result);
  }
}

/**
 * Helper: retryable explicit (never inferred).
 */
export function isRetryableError(error: AuthError | AuthErrorSlug): boolean {
  const slug = typeof error === 'string' ? error : error.slug;
  return AUTH_ERROR_TAXONOMY[slug]?.retryable ?? false;
}

/**
 * Backoff recommendations (optional).
 * Frontend SHOULD prefer Retry-After header when provided.
 */
export function getRetryDelay(error: AuthError | AuthErrorSlug): number {
  const slug = typeof error === 'string' ? error : error.slug;
  if (slug === AUTH_ERROR_CODES.RATE_LIMITED) {
    return 15 * 60 * 1000;
  }
  return 0;
}
