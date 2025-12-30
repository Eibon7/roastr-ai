/**
 * AuthService — Password Recovery privacy (ROA-409)
 *
 * Requirements:
 * - "Emails indistinguibles" for non-existing email (anti-enumeration)
 * - Fail-closed when auth email infra is disabled (even if email doesn't exist)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_ERROR_CODES } from '../../../src/utils/authErrorTaxonomy.js';

// Mock analytics dependency used by backend-v2 analytics module
vi.mock('@amplitude/analytics-node', () => ({
  init: vi.fn(),
  track: vi.fn(),
  flush: vi.fn().mockResolvedValue(undefined)
}));

const { mockListUsers, mockAssertInfra, mockSendAfterPreflight } = vi.hoisted(() => ({
  mockListUsers: vi.fn(),
  mockAssertInfra: vi.fn(),
  mockSendAfterPreflight: vi.fn()
}));

vi.mock('../../../src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      admin: {
        listUsers: mockListUsers
      }
    }
  }
}));

vi.mock('../../../src/services/rateLimitService', () => ({
  rateLimitService: {
    recordAttempt: vi.fn(() => ({ allowed: true, blockedUntil: null }))
  }
}));

vi.mock('../../../src/services/abuseDetectionService', () => ({
  abuseDetectionService: {
    recordAttempt: vi.fn(() => ({ isAbuse: false, patterns: [] }))
  }
}));

vi.mock('../../../src/services/authEmailService', () => ({
  assertAuthEmailInfrastructureEnabled: mockAssertInfra,
  sendPasswordRecoveryEmailAfterPreflight: mockSendAfterPreflight
}));

import { authService } from '../../../src/services/authService.js';
import { AuthError } from '../../../src/utils/authErrorTaxonomy.js';

describe('AuthService.requestPasswordRecovery (ROA-409)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('NO revela si el email existe: devuelve success homogéneo y NO envía email si no existe', async () => {
    mockAssertInfra.mockResolvedValueOnce({ provider: 'resend' });
    mockListUsers.mockResolvedValueOnce({ data: { users: [] }, error: null });

    const result = await authService.requestPasswordRecovery({
      email: 'missing@example.com',
      ip: '1.1.1.1',
      request_id: 'req_anti_enum'
    });

    expect(result).toEqual({
      success: true,
      message: 'If this email exists, a password recovery link has been sent'
    });
    expect(mockSendAfterPreflight).not.toHaveBeenCalled();
  });

  it('fail-closed si la infraestructura de email está deshabilitada, incluso si el email no existe', async () => {
    mockAssertInfra.mockRejectedValueOnce(new AuthError(AUTH_ERROR_CODES.AUTH_EMAIL_DISABLED));

    await expect(
      authService.requestPasswordRecovery({
        email: 'missing@example.com',
        ip: '1.1.1.1',
        request_id: 'req_disabled'
      })
    ).rejects.toHaveProperty('slug', AUTH_ERROR_CODES.AUTH_EMAIL_DISABLED);
  });
});
