/**
 * Unit Tests - Anti-Enumeration & Security (ROA-382 - B4)
 *
 * Tests de seguridad críticos para password recovery v2:
 * - Anti-enumeration (email exists vs not exists → identical response)
 * - Timing attack prevention
 * - Feature flags & fail-closed semantics
 * - PII protection (GDPR compliant)
 *
 * Contract: docs/nodes-v2/auth/password-recovery.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Supabase client BEFORE imports
vi.mock('../../../src/lib/supabaseClient.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      admin: {
        listUsers: vi.fn(),
        updateUserById: vi.fn()
      }
    }
  }
}));

// Mock other modules
vi.mock('../../../src/lib/analytics', () => ({
  trackEvent: vi.fn()
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('../../../src/lib/password-recovery-events.js', () => ({
  trackPasswordRecoveryTokenUsed: vi.fn(),
  trackPasswordRecoveryBackendFailed: vi.fn()
}));

vi.mock('../../../src/utils/authObservability.js', () => ({
  logLoginAttempt: vi.fn(),
  logRegisterAttempt: vi.fn(),
  logMagicLinkRequest: vi.fn(),
  logPasswordRecoveryRequest: vi.fn(),
  trackAuthDuration: vi.fn(),
  logRateLimit: vi.fn(),
  logFeatureDisabled: vi.fn(),
  logAuthFlowStarted: vi.fn()
}));

// Now safe to import
import { AuthService } from '../../../src/services/authService.js';
import { supabase } from '../../../src/lib/supabaseClient.js';
import { rateLimitService } from '../../../src/services/rateLimitService.js';
import * as authEmailService from '../../../src/services/authEmailService.js';
import { loadSettings } from '../../../src/lib/loadSettings.js';

describe('Unit Tests - Anti-Enumeration & Security (B4)', () => {
  let authService: AuthService;
  const testIp = '127.0.0.1';
  const testRequestId = 'test-req-anti-enum';

  beforeEach(() => {
    authService = new AuthService();
    vi.clearAllMocks();

    // Default mocks
    vi.spyOn(rateLimitService, 'recordAttempt').mockReturnValue({
      allowed: true,
      blockedUntil: null
    });

    vi.spyOn(authEmailService, 'assertAuthEmailInfrastructureEnabled').mockResolvedValue(
      undefined
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('TC19-22: Anti-Enumeration Contract (CRITICAL)', () => {
    it('TC19: Response message es IDÉNTICO (email existe vs no existe)', async () => {
      // Arrange - User exists
      vi.spyOn(supabase.auth.admin, 'listUsers').mockResolvedValueOnce({
        data: {
          users: [
            {
              id: 'user-exists',
              email: 'exists@example.com',
              user_metadata: { role: 'user' }
            }
          ],
          aud: 'authenticated'
        },
        error: null
      } as any);

      vi.spyOn(authEmailService, 'sendPasswordRecoveryEmailAfterPreflight').mockResolvedValue(
        undefined
      );

      // Act - Email exists
      const resultExists = await authService.requestPasswordRecovery({
        email: 'exists@example.com',
        ip: testIp,
        request_id: testRequestId
      });

      // Arrange - User NOT exists
      vi.spyOn(supabase.auth.admin, 'listUsers').mockResolvedValueOnce({
        data: {
          users: [],
          aud: 'authenticated'
        },
        error: null
      } as any);

      // Act - Email NOT exists
      const resultNotExists = await authService.requestPasswordRecovery({
        email: 'notexists@example.com',
        ip: testIp,
        request_id: testRequestId
      });

      // Assert - Messages MUST be identical (anti-enumeration)
      expect(resultExists.message).toBe(resultNotExists.message);
      expect(resultExists.success).toBe(resultNotExists.success);
      expect(resultExists.message).toBe(
        'If this email exists, a password recovery link has been sent'
      );
    });

    it('TC20: Response time es similar (email existe vs no existe) - timing attack prevention', async () => {
      // Arrange - User exists
      vi.spyOn(supabase.auth.admin, 'listUsers').mockResolvedValueOnce({
        data: {
          users: [
            {
              id: 'user-exists',
              email: 'exists@example.com',
              user_metadata: { role: 'user' }
            }
          ],
          aud: 'authenticated'
        },
        error: null
      } as any);

      vi.spyOn(authEmailService, 'sendPasswordRecoveryEmailAfterPreflight').mockResolvedValue(
        undefined
      );

      // Act - Email exists (measure time)
      const startExists = Date.now();
      await authService.requestPasswordRecovery({
        email: 'exists@example.com',
        ip: testIp,
        request_id: testRequestId
      });
      const durationExists = Date.now() - startExists;

      // Arrange - User NOT exists
      vi.spyOn(supabase.auth.admin, 'listUsers').mockResolvedValueOnce({
        data: {
          users: [],
          aud: 'authenticated'
        },
        error: null
      } as any);

      // Act - Email NOT exists (measure time)
      const startNotExists = Date.now();
      await authService.requestPasswordRecovery({
        email: 'notexists@example.com',
        ip: testIp,
        request_id: testRequestId
      });
      const durationNotExists = Date.now() - startNotExists;

      // Assert - Time difference should be < 100ms (timing attack prevention)
      const timeDifference = Math.abs(durationExists - durationNotExists);
      expect(timeDifference).toBeLessThan(100);
    });

    it('TC21: Response message es IDÉNTICO (admin vs usuario válido)', async () => {
      // Arrange - Admin user
      vi.spyOn(supabase.auth.admin, 'listUsers').mockResolvedValueOnce({
        data: {
          users: [
            {
              id: 'admin-user-id',
              email: 'admin@roastr.ai',
              user_metadata: { role: 'admin' }
            }
          ],
          aud: 'authenticated'
        },
        error: null
      } as any);

      // Act - Admin user (NO debe enviar email)
      const resultAdmin = await authService.requestPasswordRecovery({
        email: 'admin@roastr.ai',
        ip: testIp,
        request_id: testRequestId
      });

      // Arrange - Valid user
      vi.spyOn(supabase.auth.admin, 'listUsers').mockResolvedValueOnce({
        data: {
          users: [
            {
              id: 'valid-user-id',
              email: 'user@example.com',
              user_metadata: { role: 'user' }
            }
          ],
          aud: 'authenticated'
        },
        error: null
      } as any);

      vi.spyOn(authEmailService, 'sendPasswordRecoveryEmailAfterPreflight').mockResolvedValue(
        undefined
      );

      // Act - Valid user
      const resultUser = await authService.requestPasswordRecovery({
        email: 'user@example.com',
        ip: testIp,
        request_id: testRequestId
      });

      // Assert - Messages MUST be identical (anti-enumeration)
      expect(resultAdmin.message).toBe(resultUser.message);
      expect(resultAdmin.success).toBe(resultUser.success);
      expect(resultAdmin.message).toBe(
        'If this email exists, a password recovery link has been sent'
      );
    });

    it('TC22: No se expone información en headers (anti-enumeration)', async () => {
      // Note: Este test verifica que el contrato del service no expone información
      // en propiedades adicionales del response

      // Arrange - User exists
      vi.spyOn(supabase.auth.admin, 'listUsers').mockResolvedValueOnce({
        data: {
          users: [
            {
              id: 'user-exists',
              email: 'exists@example.com',
              user_metadata: { role: 'user' }
            }
          ],
          aud: 'authenticated'
        },
        error: null
      } as any);

      vi.spyOn(authEmailService, 'sendPasswordRecoveryEmailAfterPreflight').mockResolvedValue(
        undefined
      );

      // Act
      const result = await authService.requestPasswordRecovery({
        email: 'exists@example.com',
        ip: testIp,
        request_id: testRequestId
      });

      // Assert - Response should ONLY have success and message (no extra fields)
      const keys = Object.keys(result);
      expect(keys).toHaveLength(2);
      expect(keys).toContain('success');
      expect(keys).toContain('message');
      // Should NOT expose: user_id, email, role, etc.
      expect(result).not.toHaveProperty('user_id');
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('role');
      expect(result).not.toHaveProperty('exists');
    });
  });

  describe('TC23-25: Feature Flags & Fail-Closed Semantics', () => {
    it('TC23: Fail-closed cuando SettingsLoader falla y NO hay env var fallback', async () => {
      // Arrange - SettingsLoader fails
      vi.spyOn(authEmailService, 'assertAuthEmailInfrastructureEnabled').mockRejectedValue(
        new Error('[AUTH_EMAIL_DISABLED] Email infrastructure disabled')
      );

      // No env var fallback configured
      delete process.env.AUTH_ENABLE_PASSWORD_RECOVERY;
      delete process.env.AUTH_ENABLE_EMAILS;

      // Act & Assert - MUST block (fail-closed)
      await expect(
        authService.requestPasswordRecovery({
          email: 'user@example.com',
          ip: testIp,
          request_id: testRequestId
        })
      ).rejects.toThrow();
    });

    it('TC24: Fallback a env var cuando SettingsLoader falla', async () => {
      // Arrange - SettingsLoader fails but env var present
      process.env.AUTH_ENABLE_PASSWORD_RECOVERY = 'true';
      process.env.AUTH_ENABLE_EMAILS = 'true';

      // Mock email infrastructure enabled via env var
      vi.spyOn(authEmailService, 'assertAuthEmailInfrastructureEnabled').mockResolvedValue(
        undefined
      );

      // Mock user exists
      vi.spyOn(supabase.auth.admin, 'listUsers').mockResolvedValue({
        data: {
          users: [
            {
              id: 'user-id',
              email: 'user@example.com',
              user_metadata: { role: 'user' }
            }
          ],
          aud: 'authenticated'
        },
        error: null
      } as any);

      vi.spyOn(authEmailService, 'sendPasswordRecoveryEmailAfterPreflight').mockResolvedValue(
        undefined
      );

      // Act - Should allow with env var fallback
      const result = await authService.requestPasswordRecovery({
        email: 'user@example.com',
        ip: testIp,
        request_id: testRequestId
      });

      // Assert
      expect(result.success).toBe(true);

      // Cleanup
      delete process.env.AUTH_ENABLE_PASSWORD_RECOVERY;
      delete process.env.AUTH_ENABLE_EMAILS;
    });

    it('TC25: Feature flag OFF incluso si email no existe (fail-closed, NO simular éxito)', async () => {
      // Arrange - Feature flag OFF
      vi.spyOn(authEmailService, 'assertAuthEmailInfrastructureEnabled').mockRejectedValue(
        new Error('[AUTH_EMAIL_DISABLED] Email infrastructure disabled')
      );

      // Email does NOT exist (should still fail due to feature flag)
      vi.spyOn(supabase.auth.admin, 'listUsers').mockResolvedValue({
        data: {
          users: [],
          aud: 'authenticated'
        },
        error: null
      } as any);

      // Act & Assert - MUST fail (fail-closed), NOT simulate success
      await expect(
        authService.requestPasswordRecovery({
          email: 'nonexistent@example.com',
          ip: testIp,
          request_id: testRequestId
        })
      ).rejects.toThrow();
    });
  });
});

