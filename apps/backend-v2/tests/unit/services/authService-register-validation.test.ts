/**
 * AuthService.register() - Validation Edge Cases Tests v2 (ROA-377)
 *
 * Tests adicionales para validar edge cases de entrada que no están cubiertos
 * en los tests básicos de registro.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthError } from '../../../src/utils/authErrorTaxonomy';

const mockSignUp = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));
const mockAssertAuthEmailInfrastructureEnabled = vi.fn();

vi.mock('../../../src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signUp: mockSignUp
    },
    from: mockFrom
  }
}));

vi.mock('../../../src/services/authEmailService', () => ({
  assertAuthEmailInfrastructureEnabled: mockAssertAuthEmailInfrastructureEnabled,
  sendPasswordRecoveryEmailAfterPreflight: vi.fn()
}));

describe('AuthService.register - Validation Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertAuthEmailInfrastructureEnabled.mockResolvedValue({ provider: 'resend' });
  });

  describe('Email Validation Edge Cases', () => {
    it('rechaza email con caracteres de control (normalización)', async () => {
      const { AuthService } = await import('../../../src/services/authService');
      const svc = new AuthService();

      // Email con caracteres de control que deberían ser eliminados por normalización
      await expect(
        svc.register({
          email: 'user\x00@example.com', // NULL character
          password: 'ValidPassword123'
        })
      ).rejects.toBeInstanceOf(AuthError);
    });

    it('acepta email con caracteres especiales válidos', async () => {
      const { AuthService } = await import('../../../src/services/authService');
      const svc = new AuthService();

      mockSignUp.mockResolvedValueOnce({
        data: {
          user: { id: 'u1' },
          session: null
        },
        error: null
      });
      mockInsert.mockResolvedValueOnce({ error: null });

      // Email con caracteres especiales válidos (+, -, _, .)
      await expect(
        svc.register({
          email: 'user+tag@example.com',
          password: 'ValidPassword123'
        })
      ).resolves.toBeUndefined();
    });

    it('normaliza email con espacios (trim)', async () => {
      const { AuthService } = await import('../../../src/services/authService');
      const svc = new AuthService();

      mockSignUp.mockResolvedValueOnce({
        data: {
          user: { id: 'u1' },
          session: null
        },
        error: null
      });
      mockInsert.mockResolvedValueOnce({ error: null });

      // Email con espacios que deberían ser eliminados
      await expect(
        svc.register({
          email: '  user@example.com  ',
          password: 'ValidPassword123'
        })
      ).resolves.toBeUndefined();

      // Verificar que se normalizó el email
      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user@example.com'
        })
      );
    });

    it('normaliza email a minúsculas', async () => {
      const { AuthService } = await import('../../../src/services/authService');
      const svc = new AuthService();

      mockSignUp.mockResolvedValueOnce({
        data: {
          user: { id: 'u1' },
          session: null
        },
        error: null
      });
      mockInsert.mockResolvedValueOnce({ error: null });

      // Email en mayúsculas que debería ser normalizado
      await expect(
        svc.register({
          email: 'USER@EXAMPLE.COM',
          password: 'ValidPassword123'
        })
      ).resolves.toBeUndefined();

      // Verificar que se normalizó a minúsculas
      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user@example.com'
        })
      );
    });

    it('rechaza email sin formato válido', async () => {
      const { AuthService } = await import('../../../src/services/authService');
      const svc = new AuthService();

      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user@.com',
        'user.example.com',
        'user@@example.com',
        'user@example',
        'user@example..com'
      ];

      for (const email of invalidEmails) {
        await expect(
          svc.register({
            email,
            password: 'ValidPassword123'
          })
        ).rejects.toBeInstanceOf(AuthError);
      }
    });
  });

  describe('Password Validation Edge Cases', () => {
    it('acepta password con exactamente 8 caracteres (límite mínimo)', async () => {
      const { AuthService } = await import('../../../src/services/authService');
      const svc = new AuthService();

      mockSignUp.mockResolvedValueOnce({
        data: {
          user: { id: 'u1' },
          session: null
        },
        error: null
      });
      mockInsert.mockResolvedValueOnce({ error: null });

      // Password con exactamente 8 caracteres
      await expect(
        svc.register({
          email: 'user@example.com',
          password: '12345678' // 8 caracteres
        })
      ).resolves.toBeUndefined();
    });

    it('rechaza password con menos de 8 caracteres', async () => {
      const { AuthService } = await import('../../../src/services/authService');
      const svc = new AuthService();

      const shortPasswords = ['1234567', 'short', 'a', ''];

      for (const password of shortPasswords) {
        await expect(
          svc.register({
            email: 'user@example.com',
            password
          })
        ).rejects.toBeInstanceOf(AuthError);
      }
    });

    it('acepta password con exactamente 128 caracteres (límite máximo)', async () => {
      const { AuthService } = await import('../../../src/services/authService');
      const svc = new AuthService();

      mockSignUp.mockResolvedValueOnce({
        data: {
          user: { id: 'u1' },
          session: null
        },
        error: null
      });
      mockInsert.mockResolvedValueOnce({ error: null });

      // Password con exactamente 128 caracteres
      const longPassword = 'a'.repeat(128);
      await expect(
        svc.register({
          email: 'user@example.com',
          password: longPassword
        })
      ).resolves.toBeUndefined();
    });

    it('rechaza password con más de 128 caracteres', async () => {
      const { AuthService } = await import('../../../src/services/authService');
      const svc = new AuthService();

      // Password con 129 caracteres (límite excedido)
      const tooLongPassword = 'a'.repeat(129);

      await expect(
        svc.register({
          email: 'user@example.com',
          password: tooLongPassword
        })
      ).rejects.toBeInstanceOf(AuthError);
    });

    it('acepta password con caracteres especiales', async () => {
      const { AuthService } = await import('../../../src/services/authService');
      const svc = new AuthService();

      mockSignUp.mockResolvedValueOnce({
        data: {
          user: { id: 'u1' },
          session: null
        },
        error: null
      });
      mockInsert.mockResolvedValueOnce({ error: null });

      // Password con caracteres especiales
      await expect(
        svc.register({
          email: 'user@example.com',
          password: 'P@ssw0rd!@#$%^&*()'
        })
      ).resolves.toBeUndefined();
    });

    it('acepta password con solo números (si tiene >= 8 caracteres)', async () => {
      const { AuthService } = await import('../../../src/services/authService');
      const svc = new AuthService();

      mockSignUp.mockResolvedValueOnce({
        data: {
          user: { id: 'u1' },
          session: null
        },
        error: null
      });
      mockInsert.mockResolvedValueOnce({ error: null });

      // Password con solo números (8 caracteres)
      await expect(
        svc.register({
          email: 'user@example.com',
          password: '12345678'
        })
      ).resolves.toBeUndefined();
    });

    it('acepta password con solo letras (si tiene >= 8 caracteres)', async () => {
      const { AuthService } = await import('../../../src/services/authService');
      const svc = new AuthService();

      mockSignUp.mockResolvedValueOnce({
        data: {
          user: { id: 'u1' },
          session: null
        },
        error: null
      });
      mockInsert.mockResolvedValueOnce({ error: null });

      // Password con solo letras (8 caracteres)
      await expect(
        svc.register({
          email: 'user@example.com',
          password: 'password'
        })
      ).resolves.toBeUndefined();
    });
  });
});

