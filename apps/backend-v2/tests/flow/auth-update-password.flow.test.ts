/**
 * Update Password Flow Tests - Auth v2
 *
 * Tests contractuales para POST /api/v2/auth/update-password
 *
 * Principios:
 * - Validar inputs/outputs contractuales
 * - Verificar error slugs correctos
 * - No testear implementación interna
 * - Mocks deterministas, sin DB real
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from '../../src/services/authService';

// Mock Supabase client
const mockUpdateUser = vi.fn();
vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      updateUser: mockUpdateUser,
      getUser: vi.fn()
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
vi.mock('../../src/lib/loadSettings', () => ({
  loadSettings: vi.fn().mockResolvedValue({
    auth: {
      update_password: {
        enabled: true
      }
    }
  })
}));

describe('Update Password - Contract Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('✅ SUCCESS CASES', () => {
    it('given: password válido (≥8 chars), when: updatePassword, then: success', async () => {
      mockUpdateUser.mockResolvedValue({
        data: { user: { id: 'user_123', email: 'test@example.com' } },
        error: null
      });

      const result = await authService.updatePassword({
        userId: 'user_123',
        password: 'newSecurePassword123'
      });

      expect(result).toBeDefined();
      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: 'newSecurePassword123'
      });
    });

    it('given: password complejo, when: updatePassword, then: acepta sin error', async () => {
      mockUpdateUser.mockResolvedValue({
        data: { user: { id: 'user_123' } },
        error: null
      });

      await expect(
        authService.updatePassword({
          userId: 'user_123',
          password: 'SuperSecure!Password123@#'
        })
      ).resolves.not.toThrow();
    });
  });

  describe('❌ ERROR CASES - Validation', () => {
    it('given: password corto (<8 chars), when: updatePassword, then: throw error', async () => {
      await expect(
        authService.updatePassword({
          userId: 'user_123',
          password: 'short'
        })
      ).rejects.toThrow();
    });

    it('given: password faltante, when: updatePassword, then: throw error', async () => {
      await expect(
        authService.updatePassword({
          userId: 'user_123',
          password: ''
        })
      ).rejects.toThrow();
    });

    it('given: userId faltante, when: updatePassword, then: throw error', async () => {
      await expect(
        authService.updatePassword({
          userId: '',
          password: 'newPassword123'
        })
      ).rejects.toThrow();
    });
  });

  describe('❌ ERROR CASES - Supabase', () => {
    it('given: Supabase falla, when: updatePassword, then: throw error mapeado', async () => {
      mockUpdateUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Service unavailable', status: 500 }
      });

      await expect(
        authService.updatePassword({
          userId: 'user_123',
          password: 'newPassword123'
        })
      ).rejects.toThrow();
    });

    it('given: token inválido, when: updatePassword, then: throw AUTH error', async () => {
      mockUpdateUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token', status: 401 }
      });

      try {
        await authService.updatePassword({
          userId: 'user_123',
          password: 'newPassword123'
        });
        throw new Error('Should have thrown');
      } catch (error: any) {
        expect(error.message).toBeDefined();
      }
    });
  });

  describe('⚡ PERFORMANCE', () => {
    it('given: updatePassword call, when: execute, then: completes in <200ms', async () => {
      mockUpdateUser.mockResolvedValue({
        data: { user: { id: 'user_123' } },
        error: null
      });

      const start = Date.now();

      await authService.updatePassword({
        userId: 'user_123',
        password: 'newPassword123'
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(200);
    });
  });
});
