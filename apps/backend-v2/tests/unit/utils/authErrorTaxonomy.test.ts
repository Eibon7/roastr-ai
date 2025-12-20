/**
 * Auth Error Taxonomy Tests
 */

import { describe, it, expect } from 'vitest';
import {
  AuthError,
  AUTH_ERROR_CODES,
  mapSupabaseError,
  isRetryableError,
  getRetryDelay
} from '../../../src/utils/authErrorTaxonomy';

describe('AuthError', () => {
  describe('constructor', () => {
    it('should create error with correct properties', () => {
      const error = new AuthError(
        AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        'Test message'
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('AuthError');
      expect(error.code).toBe(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBe(401);
    });

    it('should use code as message if message not provided', () => {
      const error = new AuthError(AUTH_ERROR_CODES.TOKEN_EXPIRED);

      expect(error.message).toBe(AUTH_ERROR_CODES.TOKEN_EXPIRED);
    });

    it('should map AUTH_* codes to 401', () => {
      const error = new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
      expect(error.statusCode).toBe(401);
    });

    it('should map AUTHZ_* codes to 403', () => {
      const error = new AuthError(AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
      expect(error.statusCode).toBe(403);
    });

    it('should map SESSION_* codes to 401', () => {
      const error = new AuthError(AUTH_ERROR_CODES.SESSION_EXPIRED);
      expect(error.statusCode).toBe(401);
    });

    it('should map TOKEN_* codes to 401', () => {
      const error = new AuthError(AUTH_ERROR_CODES.TOKEN_EXPIRED);
      expect(error.statusCode).toBe(401);
    });

    it('should map ACCOUNT_EMAIL_ALREADY_EXISTS to 409', () => {
      const error = new AuthError(AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS);
      expect(error.statusCode).toBe(409);
    });

    it('should map other ACCOUNT_* codes to 404', () => {
      const error = new AuthError(AUTH_ERROR_CODES.ACCOUNT_NOT_FOUND);
      expect(error.statusCode).toBe(404);
    });
  });

  describe('details', () => {
    it('should store additional details', () => {
      const details = { foo: 'bar' };
      const error = new AuthError(
        AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        'Test',
        details
      );

      expect(error.details).toEqual(details);
    });
  });
});

describe('mapSupabaseError', () => {
  it('should map "already registered" to EMAIL_ALREADY_EXISTS', () => {
    const supabaseError = { message: 'User already registered' };
    const error = mapSupabaseError(supabaseError);

    expect(error.code).toBe(AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS);
    expect(error.statusCode).toBe(409);
  });

  it('should map "duplicate" to EMAIL_ALREADY_EXISTS', () => {
    const supabaseError = { message: 'duplicate key value' };
    const error = mapSupabaseError(supabaseError);

    expect(error.code).toBe(AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS);
  });

  it('should map "Invalid login credentials" to INVALID_CREDENTIALS', () => {
    const supabaseError = { message: 'Invalid login credentials' };
    const error = mapSupabaseError(supabaseError);

    expect(error.code).toBe(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
    expect(error.statusCode).toBe(401);
  });

  it('should map "wrong password" to INVALID_CREDENTIALS', () => {
    const supabaseError = { message: 'wrong password' };
    const error = mapSupabaseError(supabaseError);

    expect(error.code).toBe(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
  });

  it('should map "Email not confirmed" to EMAIL_NOT_VERIFIED', () => {
    const supabaseError = { message: 'Email not confirmed' };
    const error = mapSupabaseError(supabaseError);

    expect(error.code).toBe(AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED);
    expect(error.statusCode).toBe(401);
  });

  it('should map "expired" to TOKEN_EXPIRED', () => {
    const supabaseError = { message: 'JWT expired' };
    const error = mapSupabaseError(supabaseError);

    expect(error.code).toBe(AUTH_ERROR_CODES.TOKEN_EXPIRED);
  });

  it('should map "invalid token" to TOKEN_INVALID', () => {
    const supabaseError = { message: 'invalid token signature' };
    const error = mapSupabaseError(supabaseError);

    expect(error.code).toBe(AUTH_ERROR_CODES.TOKEN_INVALID);
  });

  it('should map "session" errors to SESSION_INVALID', () => {
    const supabaseError = { message: 'invalid session' };
    const error = mapSupabaseError(supabaseError);

    expect(error.code).toBe(AUTH_ERROR_CODES.SESSION_INVALID);
  });

  it('should fallback to INVALID_CREDENTIALS for unknown errors', () => {
    const supabaseError = { message: 'unknown error' };
    const error = mapSupabaseError(supabaseError);

    expect(error.code).toBe(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
  });

  it('should handle errors without message', () => {
    const supabaseError = {};
    const error = mapSupabaseError(supabaseError);

    expect(error.code).toBe(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
  });

  it('should preserve original error in details', () => {
    const supabaseError = { message: 'test error', foo: 'bar' };
    const error = mapSupabaseError(supabaseError);

    expect(error.details).toEqual(supabaseError);
  });
});

describe('isRetryableError', () => {
  it('should return true for RATE_LIMIT_EXCEEDED', () => {
    const error = new AuthError(AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED);
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return false for INVALID_CREDENTIALS', () => {
    const error = new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for TOKEN_EXPIRED', () => {
    const error = new AuthError(AUTH_ERROR_CODES.TOKEN_EXPIRED);
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for EMAIL_NOT_VERIFIED', () => {
    const error = new AuthError(AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED);
    expect(isRetryableError(error)).toBe(false);
  });
});

describe('getRetryDelay', () => {
  it('should return 15 minutes for RATE_LIMIT_EXCEEDED', () => {
    const error = new AuthError(AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED);
    expect(getRetryDelay(error)).toBe(15 * 60 * 1000);
  });

  it('should return 0 for non-retryable errors', () => {
    const error = new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
    expect(getRetryDelay(error)).toBe(0);
  });

  it('should return 0 for TOKEN_EXPIRED', () => {
    const error = new AuthError(AUTH_ERROR_CODES.TOKEN_EXPIRED);
    expect(getRetryDelay(error)).toBe(0);
  });
});
