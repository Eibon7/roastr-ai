/**
 * Auth Service - Email Verification Tests (ROA-373)
 *
 * Tests unitarios para verificación de email con Supabase Auth.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from '../../../src/services/authService.js';
import { supabase } from '../../../src/lib/supabaseClient.js';
import { AuthError, AUTH_ERROR_CODES } from '../../../src/utils/authErrorTaxonomy.js';

// Mock Supabase client
vi.mock('../../../src/lib/supabaseClient.js', () => ({
  supabase: {
    auth: {
      verifyOtp: vi.fn()
    }
  }
}));

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Mock analytics
vi.mock('../../../src/lib/analytics.js', () => ({
  trackEvent: vi.fn()
}));

describe('AuthService - verifyEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe verificar email con token válido', async () => {
    // Arrange
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      email_confirmed_at: new Date().toISOString()
    };

    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: { user: mockUser, session: null },
      error: null
    } as any);

    // Act
    const result = await authService.verifyEmail({
      token_hash: 'valid-token',
      type: 'email',
      request_id: 'test-request-123'
    });

    // Assert
    expect(result.success).toBe(true);
    expect(result.message).toBe('Email verified successfully');
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'valid-token',
      type: 'email'
    });
  });

  it('debe fallar con token vacío', async () => {
    // Arrange & Act & Assert
    await expect(
      authService.verifyEmail({
        token_hash: '',
        type: 'email',
        request_id: 'test-request-123'
      })
    ).rejects.toThrow(AuthError);

    await expect(
      authService.verifyEmail({
        token_hash: '',
        type: 'email',
        request_id: 'test-request-123'
      })
    ).rejects.toMatchObject({
      slug: AUTH_ERROR_CODES.TOKEN_INVALID
    });

    // Verify Supabase was not called
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('debe fallar con token inválido (Supabase error)', async () => {
    // Arrange
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: { user: null, session: null },
      error: {
        message: 'Token has expired or is invalid',
        status: 400
      }
    } as any);

    // Act & Assert
    await expect(
      authService.verifyEmail({
        token_hash: 'invalid-token',
        type: 'email',
        request_id: 'test-request-123'
      })
    ).rejects.toThrow(AuthError);

    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'invalid-token',
      type: 'email'
    });
  });

  it('debe fallar si Supabase no devuelve usuario', async () => {
    // Arrange
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: { user: null, session: null },
      error: null
    } as any);

    // Act & Assert
    await expect(
      authService.verifyEmail({
        token_hash: 'token-without-user',
        type: 'email',
        request_id: 'test-request-123'
      })
    ).rejects.toThrow(AuthError);

    await expect(
      authService.verifyEmail({
        token_hash: 'token-without-user',
        type: 'email',
        request_id: 'test-request-123'
      })
    ).rejects.toMatchObject({
      slug: AUTH_ERROR_CODES.TOKEN_INVALID
    });
  });

  it('debe trackear evento analytics en éxito', async () => {
    // Arrange
    const { trackEvent } = await import('../../../src/lib/analytics.js');
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      email_confirmed_at: new Date().toISOString()
    };

    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: { user: mockUser, session: null },
      error: null
    } as any);

    // Act
    await authService.verifyEmail({
      token_hash: 'valid-token',
      type: 'email',
      request_id: 'test-request-123'
    });

    // Assert
    expect(trackEvent).toHaveBeenCalledWith({
      userId: 'user-123',
      event: 'auth_email_verified',
      properties: expect.objectContaining({
        duration_ms: expect.any(Number)
      }),
      context: {
        flow: 'auth',
        request_id: 'test-request-123'
      }
    });
  });

  it('debe trackear evento analytics en fallo', async () => {
    // Arrange
    const { trackEvent } = await import('../../../src/lib/analytics.js');
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: { user: null, session: null },
      error: {
        message: 'Token has expired',
        status: 400
      }
    } as any);

    // Act & Assert
    await expect(
      authService.verifyEmail({
        token_hash: 'expired-token',
        type: 'email',
        request_id: 'test-request-123'
      })
    ).rejects.toThrow();

    expect(trackEvent).toHaveBeenCalledWith({
      event: 'auth_email_verify_failed',
      properties: expect.objectContaining({
        error_slug: expect.any(String),
        duration_ms: expect.any(Number)
      }),
      context: {
        flow: 'auth',
        request_id: 'test-request-123'
      }
    });
  });

  it('debe loguear éxito correctamente', async () => {
    // Arrange
    const { logger } = await import('../../../src/utils/logger.js');
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      email_confirmed_at: new Date().toISOString()
    };

    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: { user: mockUser, session: null },
      error: null
    } as any);

    // Act
    await authService.verifyEmail({
      token_hash: 'valid-token',
      type: 'email',
      request_id: 'test-request-123'
    });

    // Assert
    expect(logger.info).toHaveBeenCalledWith(
      'auth_email_verified',
      expect.objectContaining({
        request_id: 'test-request-123',
        user_id: 'user-123',
        duration_ms: expect.any(Number)
      })
    );
  });

  it('debe loguear fallo correctamente', async () => {
    // Arrange
    const { logger } = await import('../../../src/utils/logger.js');
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: { user: null, session: null },
      error: {
        message: 'Token has expired',
        status: 400
      }
    } as any);

    // Act & Assert
    await expect(
      authService.verifyEmail({
        token_hash: 'expired-token',
        type: 'email',
        request_id: 'test-request-123'
      })
    ).rejects.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      'auth_email_verify_failed',
      expect.objectContaining({
        request_id: 'test-request-123',
        error_slug: expect.any(String),
        duration_ms: expect.any(Number)
      })
    );
  });
});
