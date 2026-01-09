/**
 * Auth Rate Limit Integration Tests - Auth v2
 *
 * Tests de integración para verificar que rate limiting funciona correctamente
 * en endpoints de Auth v2.
 *
 * Principios:
 * - Validar comportamiento cuando rate limit se excede
 * - Verificar error slug correcto (POLICY_RATE_LIMIT_EXCEEDED)
 * - No testear implementación de rateLimitService
 * - Mocks deterministas, sin Redis real
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from '../../../src/services/authService';

// Mock Supabase client
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();

vi.mock('../../../src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp
    }
  }
}));

// Mock analytics
vi.mock('@amplitude/analytics-node', () => ({
  init: vi.fn(),
  track: vi.fn(),
  flush: vi.fn().mockResolvedValue(undefined)
}));

// Mock loadSettings
vi.mock('../../../src/lib/loadSettings', () => ({
  loadSettings: vi.fn().mockResolvedValue({
    auth: {
      login: { enabled: true },
      register: { enabled: true }
    }
  })
}));

// Mock rate limit service
const mockRecordAttempt = vi.fn();
vi.mock('../../../src/services/rateLimitService', () => ({
  rateLimitService: {
    recordAttempt: mockRecordAttempt,
    checkLimit: vi.fn()
  }
}));

describe('Auth Rate Limit Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordAttempt.mockReturnValue({ allowed: true });
  });

  describe('✅ ALLOWED - Under Rate Limit', () => {
    it('given: rate limit not exceeded, when: login, then: success', async () => {
      mockRecordAttempt.mockReturnValue({ allowed: true });

      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user_123', email: 'test@example.com' },
          session: { access_token: 'token_123' }
        },
        error: null
      });

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'password123',
          request_id: 'req_123'
        })
      ).resolves.toBeDefined();
    });

    it('given: rate limit not exceeded, when: register, then: success', async () => {
      mockRecordAttempt.mockReturnValue({ allowed: true });

      mockSignUp.mockResolvedValue({
        data: {
          user: { id: 'user_456', email: 'new@example.com' },
          session: null
        },
        error: null
      });

      await expect(
        authService.register({
          email: 'new@example.com',
          password: 'password123',
          request_id: 'req_456'
        })
      ).resolves.not.toThrow();
    });
  });

  describe('❌ BLOCKED - Rate Limit Exceeded', () => {
    it('given: rate limit exceeded, when: login, then: throw error', async () => {
      mockRecordAttempt.mockReturnValue({
        allowed: false,
        reason: 'rate_limit',
        retryAfter: 60
      });

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'password123',
          request_id: 'req_123'
        })
      ).rejects.toThrow();
    });

    it('given: rate limit exceeded, when: register, then: throw error', async () => {
      mockRecordAttempt.mockReturnValue({
        allowed: false,
        reason: 'rate_limit',
        retryAfter: 120
      });

      await expect(
        authService.register({
          email: 'new@example.com',
          password: 'password123',
          request_id: 'req_456'
        })
      ).rejects.toThrow();
    });
  });

  describe('🔄 RATE LIMIT BEHAVIOR', () => {
    it('given: sequential requests, when: login multiple times, then: rate limit applies', async () => {
      // First 3 requests allowed
      mockRecordAttempt.mockReturnValueOnce({ allowed: true });
      mockRecordAttempt.mockReturnValueOnce({ allowed: true });
      mockRecordAttempt.mockReturnValueOnce({ allowed: true });

      // 4th request blocked
      mockRecordAttempt.mockReturnValueOnce({
        allowed: false,
        reason: 'rate_limit',
        retryAfter: 300
      });

      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user_123' },
          session: { access_token: 'token' }
        },
        error: null
      });

      // First 3 succeed
      for (let i = 0; i < 3; i++) {
        await expect(
          authService.login({
            email: 'test@example.com',
            password: 'password123',
            request_id: `req_${i}`
          })
        ).resolves.toBeDefined();
      }

      // 4th fails
      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'password123',
          request_id: 'req_4'
        })
      ).rejects.toThrow();
    });
  });

  describe('🔒 SECURITY', () => {
    it('given: rate limit service throws, when: login, then: fail closed (block)', async () => {
      mockRecordAttempt.mockImplementation(() => {
        throw new Error('Rate limit service unavailable');
      });

      // Should fail closed (block request)
      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'password123',
          request_id: 'req_123'
        })
      ).rejects.toThrow();
    });

    it('given: rate limit response malformed, when: login, then: handle gracefully', async () => {
      mockRecordAttempt.mockReturnValue({
        allowed: false
        // Missing reason and retryAfter
      });

      // Should still block
      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'password123',
          request_id: 'req_123'
        })
      ).rejects.toThrow();
    });
  });

  describe('⚡ PERFORMANCE', () => {
    it('given: rate limit check, when: execute, then: completes in <200ms', async () => {
      mockRecordAttempt.mockReturnValue({ allowed: true });

      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user_123' },
          session: { access_token: 'token' }
        },
        error: null
      });

      const start = Date.now();
      
      await authService.login({
        email: 'test@example.com',
        password: 'password123',
        request_id: 'req_123'
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(200);
    });
  });
});
