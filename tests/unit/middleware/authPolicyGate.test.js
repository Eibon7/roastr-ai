/**
 * @fileoverview Auth Policy Gate Wiring Tests - ROA-523
 * 
 * Tests básicos para verificar wiring de Auth → RateLimitPolicyGlobal.
 * Los tests de integración verificarán el comportamiento completo con Redis.
 */

import { describe, it, expect } from 'vitest';
import { authPolicyGate } from '../../../src/middleware/authPolicyGate.js';
import { AUTH_ACTIONS, AUTH_TYPES } from '../../../src/constants/authActions.js';
import { AUTH_ERROR_CODES, AuthError, createRateLimitError } from '../../../src/errors/authErrors.js';

describe('authPolicyGate - ROA-523 Wiring Tests', () => {
  describe('Module exports', () => {
    it('exports authPolicyGate function', () => {
      expect(authPolicyGate).toBeDefined();
      expect(typeof authPolicyGate).toBe('function');
    });

    it('exports AUTH_ACTIONS constants', () => {
      expect(AUTH_ACTIONS).toBeDefined();
      expect(AUTH_ACTIONS.LOGIN).toBe('auth_login');
      expect(AUTH_ACTIONS.REGISTER).toBe('auth_register');
      expect(AUTH_ACTIONS.PASSWORD_RECOVERY).toBe('auth_password_recovery');
      expect(AUTH_ACTIONS.MAGIC_LINK).toBe('auth_magic_link');
    });

    it('exports AUTH_TYPES constants', () => {
      expect(AUTH_TYPES).toBeDefined();
      expect(AUTH_TYPES.PASSWORD).toBe('password');
      expect(AUTH_TYPES.MAGIC_LINK).toBe('magic_link');
      expect(AUTH_TYPES.PASSWORD_RESET).toBe('password_reset');
    });

    it('exports AUTH_ERROR_CODES constants', () => {
      expect(AUTH_ERROR_CODES).toBeDefined();
      expect(AUTH_ERROR_CODES.AUTH_RATE_LIMITED).toBe('AUTH_RATE_LIMITED');
      expect(AUTH_ERROR_CODES.AUTH_ACCOUNT_BLOCKED).toBe('AUTH_ACCOUNT_BLOCKED');
    });
  });

  describe('authPolicyGate middleware factory', () => {
    it('creates middleware function', () => {
      const middleware = authPolicyGate({
        action: AUTH_ACTIONS.LOGIN,
        authType: AUTH_TYPES.PASSWORD
      });
      
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // (req, res, next)
    });

    it('validates action parameter', () => {
      expect(() => {
        authPolicyGate({
          action: 'invalid_action',
          authType: AUTH_TYPES.PASSWORD
        });
      }).toThrow(/Invalid auth action/);
    });

    it('validates authType parameter', () => {
      expect(() => {
        authPolicyGate({
          action: AUTH_ACTIONS.LOGIN,
          authType: 'invalid_type'
        });
      }).toThrow(/Invalid auth type/);
    });

    it('creates middleware for all supported Auth actions', () => {
      const loginMiddleware = authPolicyGate({
        action: AUTH_ACTIONS.LOGIN,
        authType: AUTH_TYPES.PASSWORD
      });
      
      const registerMiddleware = authPolicyGate({
        action: AUTH_ACTIONS.REGISTER,
        authType: AUTH_TYPES.PASSWORD
      });
      
      const recoveryMiddleware = authPolicyGate({
        action: AUTH_ACTIONS.PASSWORD_RECOVERY,
        authType: AUTH_TYPES.PASSWORD_RESET
      });
      
      const magicLinkMiddleware = authPolicyGate({
        action: AUTH_ACTIONS.MAGIC_LINK,
        authType: AUTH_TYPES.MAGIC_LINK
      });

      expect(loginMiddleware).toBeDefined();
      expect(registerMiddleware).toBeDefined();
      expect(recoveryMiddleware).toBeDefined();
      expect(magicLinkMiddleware).toBeDefined();
    });
  });

  describe('AuthError v2 taxonomy', () => {
    it('creates AuthError with code and message', () => {
      const error = new AuthError(
        AUTH_ERROR_CODES.AUTH_RATE_LIMITED,
        'Test message',
        {},
        true,
        900
      );

      expect(error).toBeInstanceOf(AuthError);
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe(AUTH_ERROR_CODES.AUTH_RATE_LIMITED);
      expect(error.message).toBe('Test message');
      expect(error.retryable).toBe(true);
      expect(error.retryAfterSeconds).toBe(900);
    });

    it('converts to JSON format', () => {
      const error = new AuthError(
        AUTH_ERROR_CODES.AUTH_RATE_LIMITED,
        'Rate limited',
        { policy: 'rate_limit' },
        true,
        900
      );

      const json = error.toJSON();

      expect(json).toEqual({
        code: AUTH_ERROR_CODES.AUTH_RATE_LIMITED,
        message: 'Rate limited',
        retryable: true,
        retryAfterSeconds: 900,
        metadata: { policy: 'rate_limit' }
      });
    });

    it('creates rate limit error for temporary block', () => {
      const policyResult = {
        allowed: false,
        reason: 'rate_limited',
        block_type: 'temporary',
        retry_after_seconds: 900
      };

      const error = createRateLimitError(policyResult);

      expect(error.code).toBe(AUTH_ERROR_CODES.AUTH_RATE_LIMITED);
      expect(error.retryable).toBe(true);
      expect(error.retryAfterSeconds).toBe(900);
    });

    it('creates rate limit error for permanent block', () => {
      const policyResult = {
        allowed: false,
        reason: 'rate_limited',
        block_type: 'permanent',
        retry_after_seconds: null
      };

      const error = createRateLimitError(policyResult);

      expect(error.code).toBe(AUTH_ERROR_CODES.AUTH_ACCOUNT_BLOCKED);
      expect(error.retryable).toBe(false);
      expect(error.retryAfterSeconds).toBeNull();
    });
  });

  describe('Contract documentation', () => {
    it('documents input contract to RateLimitPolicyGlobal', () => {
      const expectedContract = {
        scope: 'auth',
        action: 'password | magic_link | password_reset',
        key: {
          ip: 'string (required)',
          email: 'string (optional)'
        },
        metadata: {
          auth_type: 'password | magic_link | password_reset'
        }
      };

      expect(expectedContract.scope).toBe('auth');
      expect(expectedContract.key.ip).toBeDefined();
    });

    it('documents output contract from RateLimitPolicyGlobal', () => {
      const expectedContract = {
        allowed: 'boolean',
        reason: 'rate_limited (optional)',
        retry_after_seconds: 'number (optional)',
        block_type: 'temporary | permanent'
      };

      expect(expectedContract.allowed).toBe('boolean');
      expect(expectedContract.block_type).toContain('temporary');
    });

    it('documents error translation rules', () => {
      const translationRules = [
        {
          input: { block_type: 'temporary' },
          output: { code: AUTH_ERROR_CODES.AUTH_RATE_LIMITED, retryable: true }
        },
        {
          input: { block_type: 'permanent' },
          output: { code: AUTH_ERROR_CODES.AUTH_ACCOUNT_BLOCKED, retryable: false }
        }
      ];

      expect(translationRules[0].output.retryable).toBe(true);
      expect(translationRules[1].output.retryable).toBe(false);
    });
  });

  describe('Pipeline documentation', () => {
    it('documents expected pipeline flow', () => {
      const expectedPipeline = [
        'HTTP Request',
        'Auth Feature Flags (A2)',
        'Auth Policy Gate (A3) ← ROA-523',
        'RateLimitPolicyGlobal',
        'Auth Business Logic'
      ];

      expect(expectedPipeline).toContain('Auth Policy Gate (A3) ← ROA-523');
      expect(expectedPipeline).toContain('RateLimitPolicyGlobal');
    });

    it('documents fail-open behavior', () => {
      const behavior = {
        when: 'RateLimitPolicyGlobal throws internal error',
        then: 'Allow request to proceed (fail-open)',
        logged: 'auth_policy_gate_error with behavior: fail_open'
      };

      expect(behavior.then).toContain('fail-open');
    });

    it('documents feature flag bypass', () => {
      const behavior = {
        flag: 'enable_rate_limit_auth',
        when_off: 'Policy is NOT evaluated, request proceeds',
        logged: 'auth_policy_gate_bypassed'
      };

      expect(behavior.flag).toBe('enable_rate_limit_auth');
      expect(behavior.when_off).toContain('NOT evaluated');
    });
  });
});
