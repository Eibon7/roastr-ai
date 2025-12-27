/**
 * Tests for Auth Error Taxonomy v2
 *
 * @file tests/unit/authErrorTaxonomy.test.js
 */

import { describe, it, expect } from 'vitest';
import {
  AUTH_ERROR_CODES,
  ERROR_METADATA,
  AuthError,
  classifySupabaseError,
  createAuthErrorFromSupabase,
  isRetryableError,
  getRetryDelay
} from '../../src/utils/authErrorTaxonomy.js';

describe('Auth Error Taxonomy v2', () => {
  describe('AUTH_ERROR_CODES', () => {
    it('should have all required error codes', () => {
      expect(AUTH_ERROR_CODES.TOKEN_MISSING).toBe('AUTH_TOKEN_MISSING');
      expect(AUTH_ERROR_CODES.TOKEN_EXPIRED).toBe('AUTH_TOKEN_EXPIRED');
      expect(AUTH_ERROR_CODES.INVALID_CREDENTIALS).toBe('AUTH_INVALID_CREDENTIALS');
      expect(AUTH_ERROR_CODES.ADMIN_REQUIRED).toBe('AUTHZ_ADMIN_REQUIRED');
      expect(AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED).toBe('AUTH_RATE_LIMIT_EXCEEDED');
    });

    it('should have metadata for all error codes', () => {
      Object.values(AUTH_ERROR_CODES).forEach((code) => {
        expect(ERROR_METADATA[code]).toBeDefined();
        expect(ERROR_METADATA[code].httpStatus).toBeDefined();
        expect(ERROR_METADATA[code].severity).toBeDefined();
        expect(ERROR_METADATA[code].userMessage).toBeDefined();
        expect(ERROR_METADATA[code].action).toBeDefined();
      });
    });
  });

  describe('AuthError class', () => {
    it('should create error with correct properties', () => {
      const error = new AuthError(AUTH_ERROR_CODES.TOKEN_EXPIRED);

      expect(error.code).toBe(AUTH_ERROR_CODES.TOKEN_EXPIRED);
      expect(error.httpStatus).toBe(401);
      expect(error.severity).toBe('LOW');
      expect(error.retryable).toBe(true);
      expect(error.userMessage).toBe('Session expired');
      expect(error.action).toBe('REFRESH_TOKEN');
      expect(error.timestamp).toBeDefined();
    });

    it('should allow custom message', () => {
      const error = new AuthError(AUTH_ERROR_CODES.TOKEN_EXPIRED, 'Custom expired message');

      expect(error.userMessage).toBe('Custom expired message');
      expect(error.message).toBe('Custom expired message');
    });

    it('should include details in JSON', () => {
      const error = new AuthError(AUTH_ERROR_CODES.TOKEN_EXPIRED, null, { userId: '123' });

      const json = error.toJSON();
      expect(json.details).toEqual({ userId: '123' });
      expect(json.code).toBe(AUTH_ERROR_CODES.TOKEN_EXPIRED);
      expect(json.httpStatus).toBe(401);
      expect(json.retryable).toBe(true);
    });

    it('should throw error for unknown code', () => {
      expect(() => {
        new AuthError('UNKNOWN_CODE');
      }).toThrow('Unknown auth error code');
    });
  });

  describe('classifySupabaseError', () => {
    it('should classify token expired errors', () => {
      const error = { message: 'JWT expired', status: 401 };
      expect(classifySupabaseError(error)).toBe(AUTH_ERROR_CODES.TOKEN_EXPIRED);
    });

    it('should classify invalid token errors', () => {
      const error = { message: 'Invalid token', status: 401 };
      expect(classifySupabaseError(error)).toBe(AUTH_ERROR_CODES.TOKEN_INVALID);
    });

    it('should classify invalid credentials', () => {
      const error = { message: 'Invalid login credentials', status: 401 };
      expect(classifySupabaseError(error)).toBe(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
    });

    it('should classify email not verified', () => {
      const error = { message: 'Email not confirmed', status: 401 };
      expect(classifySupabaseError(error)).toBe(AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED);
    });

    it('should classify magic link expired', () => {
      const error = { message: 'Magic link expired', status: 401 };
      expect(classifySupabaseError(error)).toBe(AUTH_ERROR_CODES.MAGIC_LINK_EXPIRED);
    });

    it('should classify email already exists', () => {
      const error = { message: 'User already registered', status: 400 };
      expect(classifySupabaseError(error)).toBe(AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS);
    });

    it('should classify rate limit errors', () => {
      const error = { message: 'Rate limit exceeded', status: 429 };
      expect(classifySupabaseError(error)).toBe(AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED);
    });

    it('should default to service unavailable for unknown errors', () => {
      const error = { message: 'Unknown error', status: 500 };
      expect(classifySupabaseError(error)).toBe(AUTH_ERROR_CODES.AUTH_SERVICE_UNAVAILABLE);
    });

    it('should handle null error', () => {
      expect(classifySupabaseError(null)).toBeNull();
    });
  });

  describe('createAuthErrorFromSupabase', () => {
    it('should create AuthError from Supabase error', () => {
      const supabaseError = { message: 'JWT expired', status: 401 };
      const authError = createAuthErrorFromSupabase(supabaseError);

      expect(authError).toBeInstanceOf(AuthError);
      expect(authError.code).toBe(AUTH_ERROR_CODES.TOKEN_EXPIRED);
      expect(authError.details.originalError).toBe('JWT expired');
    });

    it('should use fallback code when classification fails', () => {
      const supabaseError = { message: 'Unknown error', status: 500 };
      // classifySupabaseError will return AUTH_SERVICE_UNAVAILABLE for unknown errors
      // but we can test that fallback is used when classification returns null
      const authError = createAuthErrorFromSupabase(
        null, // null error should use fallback
        AUTH_ERROR_CODES.DATABASE_ERROR
      );

      expect(authError.code).toBe(AUTH_ERROR_CODES.DATABASE_ERROR);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for retryable errors', () => {
      const error = new AuthError(AUTH_ERROR_CODES.TOKEN_EXPIRED);
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const error = new AuthError(AUTH_ERROR_CODES.TOKEN_MISSING);
      expect(isRetryableError(error)).toBe(false);
    });

    it('should handle error objects with code', () => {
      const error = { code: AUTH_ERROR_CODES.TOKEN_EXPIRED };
      expect(isRetryableError(error)).toBe(true);
    });
  });

  describe('getRetryDelay', () => {
    it('should return 0 for token expired (immediate retry)', () => {
      const error = new AuthError(AUTH_ERROR_CODES.TOKEN_EXPIRED);
      const delay = getRetryDelay(error);
      // Should return 0 for immediate retry with refresh
      expect(delay).toBe(0);
    });

    it('should return delay for rate limit errors', () => {
      const error = new AuthError(AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED);
      expect(getRetryDelay(error)).toBe(60);
    });

    it('should return null for non-retryable errors', () => {
      const error = new AuthError(AUTH_ERROR_CODES.TOKEN_MISSING);
      expect(getRetryDelay(error)).toBeNull();
    });

    it('should return default delay for unknown retryable errors', () => {
      const error = { code: AUTH_ERROR_CODES.AUTH_SERVICE_UNAVAILABLE };
      expect(getRetryDelay(error)).toBe(30);
    });
  });

  describe('Error metadata consistency', () => {
    it('should have consistent httpStatus for error categories', () => {
      // All TOKEN_* errors should be 401 (except system errors)
      const tokenErrors = Object.values(AUTH_ERROR_CODES).filter(
        (code) =>
          code.startsWith('AUTH_TOKEN_') && code !== AUTH_ERROR_CODES.TOKEN_GENERATION_FAILED
      );
      tokenErrors.forEach((code) => {
        expect(ERROR_METADATA[code].httpStatus).toBe(401);
      });

      // All AUTHZ_* errors should be 403
      const authzErrors = Object.values(AUTH_ERROR_CODES).filter((code) =>
        code.startsWith('AUTHZ_')
      );
      authzErrors.forEach((code) => {
        expect(ERROR_METADATA[code].httpStatus).toBe(403);
      });
    });

    it('should have appropriate severity levels', () => {
      const criticalErrors = [AUTH_ERROR_CODES.DATABASE_ERROR];
      criticalErrors.forEach((code) => {
        expect(ERROR_METADATA[code].severity).toBe('CRITICAL');
      });

      const highErrors = [
        AUTH_ERROR_CODES.ACCOUNT_LOCKED,
        AUTH_ERROR_CODES.ACCOUNT_DISABLED,
        AUTH_ERROR_CODES.SUPERADMIN_REQUIRED
      ];
      highErrors.forEach((code) => {
        expect(['HIGH', 'CRITICAL']).toContain(ERROR_METADATA[code].severity);
      });
    });
  });
});
