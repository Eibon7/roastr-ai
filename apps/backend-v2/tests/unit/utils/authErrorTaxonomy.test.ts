/**
 * Auth Error Taxonomy Tests
 */

import { describe, it, expect } from 'vitest';
import {
  AuthError,
  AUTH_ERROR_CODES,
  mapSupabaseError,
  mapPolicyResultToAuthError,
  isRetryableError,
  getRetryDelay
} from '../../../src/utils/authErrorTaxonomy';

describe('AuthError', () => {
  describe('constructor', () => {
    it('should create error with correct properties', () => {
      const error = new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('AuthError');
      expect(error.slug).toBe(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
      expect(error.http_status).toBe(401);
      expect(error.retryable).toBe(false);
      expect(error.user_message_key).toBe('auth.error.invalid_credentials');
      expect(error.category).toBe('auth');
    });

    it('should map AUTH_* slugs to correct http_status', () => {
      const error = new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
      expect(error.http_status).toBe(401);
    });

    it('should map AUTHZ_* slugs to 403', () => {
      const error = new AuthError(AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
      expect(error.http_status).toBe(403);
    });

    it('should map SESSION_* slugs to 401', () => {
      const error = new AuthError(AUTH_ERROR_CODES.SESSION_EXPIRED);
      expect(error.http_status).toBe(401);
    });

    it('should map TOKEN_* slugs to 401', () => {
      const error = new AuthError(AUTH_ERROR_CODES.TOKEN_EXPIRED);
      expect(error.http_status).toBe(401);
    });

    it('should map ACCOUNT_EMAIL_ALREADY_EXISTS to 409', () => {
      const error = new AuthError(AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS);
      expect(error.http_status).toBe(409);
    });

    it('should map other ACCOUNT_* slugs to 404/403 as defined', () => {
      const error = new AuthError(AUTH_ERROR_CODES.ACCOUNT_NOT_FOUND);
      expect(error.http_status).toBe(404);
    });
  });
});

describe('mapSupabaseError', () => {
  it('should map "already registered" to EMAIL_ALREADY_EXISTS', () => {
    const supabaseError = { message: 'User already registered' };
    const error = mapSupabaseError(supabaseError);

    expect(error.slug).toBe(AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS);
    expect(error.http_status).toBe(409);
  });

  it('should map "duplicate" to EMAIL_ALREADY_EXISTS', () => {
    const supabaseError = { message: 'duplicate key value' };
    const error = mapSupabaseError(supabaseError);

    expect(error.slug).toBe(AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS);
  });

  it('should map "Invalid login credentials" to INVALID_CREDENTIALS', () => {
    const supabaseError = { message: 'Invalid login credentials' };
    const error = mapSupabaseError(supabaseError);

    expect(error.slug).toBe(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
    expect(error.http_status).toBe(401);
  });

  it('should map "wrong password" to INVALID_CREDENTIALS', () => {
    const supabaseError = { message: 'wrong password' };
    const error = mapSupabaseError(supabaseError);

    expect(error.slug).toBe(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
  });

  it('should map "Email not confirmed" to EMAIL_NOT_CONFIRMED', () => {
    const supabaseError = { message: 'Email not confirmed' };
    const error = mapSupabaseError(supabaseError);

    expect(error.slug).toBe(AUTH_ERROR_CODES.EMAIL_NOT_CONFIRMED);
    expect(error.http_status).toBe(401);
  });

  it('should map "JWT expired" to TOKEN_EXPIRED', () => {
    const supabaseError = { message: 'JWT expired' };
    const error = mapSupabaseError(supabaseError);

    expect(error.slug).toBe(AUTH_ERROR_CODES.TOKEN_EXPIRED);
  });

  it('should map "invalid token" to TOKEN_INVALID', () => {
    const supabaseError = { message: 'invalid token signature' };
    const error = mapSupabaseError(supabaseError);

    expect(error.slug).toBe(AUTH_ERROR_CODES.TOKEN_INVALID);
  });

  it('should map "session" errors to SESSION_INVALID', () => {
    const supabaseError = { message: 'invalid session' };
    const error = mapSupabaseError(supabaseError);

    expect(error.slug).toBe(AUTH_ERROR_CODES.SESSION_INVALID);
  });

  it('should fail-closed (AUTH_UNKNOWN) for unknown errors', () => {
    const supabaseError = { message: 'unknown error' };
    const error = mapSupabaseError(supabaseError);

    expect(error.slug).toBe(AUTH_ERROR_CODES.UNKNOWN);
  });

  it('should handle errors without message', () => {
    const supabaseError = {};
    const error = mapSupabaseError(supabaseError);

    expect(error.slug).toBe(AUTH_ERROR_CODES.UNKNOWN);
  });
});

describe('mapPolicyResultToAuthError', () => {
  it('maps rate_limited to POLICY_RATE_LIMITED', () => {
    const error = mapPolicyResultToAuthError({ kind: 'rate_limited' });
    expect(error.slug).toBe(AUTH_ERROR_CODES.RATE_LIMITED);
    expect(error.http_status).toBe(429);
    expect(error.retryable).toBe(true);
  });

  it('maps blocked to POLICY_BLOCKED', () => {
    const error = mapPolicyResultToAuthError({ kind: 'blocked' });
    expect(error.slug).toBe(AUTH_ERROR_CODES.BLOCKED);
    expect(error.http_status).toBe(403);
    expect(error.retryable).toBe(false);
  });
});

describe('isRetryableError', () => {
  it('should return true for POLICY_RATE_LIMITED', () => {
    const error = new AuthError(AUTH_ERROR_CODES.RATE_LIMITED);
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return false for INVALID_CREDENTIALS', () => {
    const error = new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for EMAIL_NOT_CONFIRMED', () => {
    const error = new AuthError(AUTH_ERROR_CODES.EMAIL_NOT_CONFIRMED);
    expect(isRetryableError(error)).toBe(false);
  });
});

describe('getRetryDelay', () => {
  it('should return 15 minutes for POLICY_RATE_LIMITED', () => {
    const error = new AuthError(AUTH_ERROR_CODES.RATE_LIMITED);
    expect(getRetryDelay(error)).toBe(15 * 60 * 1000);
  });

  it('should return 0 for non-retryable errors', () => {
    const error = new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
    expect(getRetryDelay(error)).toBe(0);
  });
});
