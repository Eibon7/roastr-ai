/**
 * Auth Email Infrastructure (V2) — ROA-409
 *
 * Minimal unit tests required by issue:
 * - Email NOT sent if flag OFF (fail-closed)
 * - Email sent when flag ON
 * - Provider error maps to stable slug
 * - No PII in logs (email truncated)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_ERROR_CODES } from '../../../src/utils/authErrorTaxonomy.js';
import { logger } from '../../../src/utils/logger.js';
import { trackEvent } from '../../../src/lib/analytics.js';

const { mockResetPasswordForEmail, mockLoadAuthFlags } = vi.hoisted(() => ({
  mockResetPasswordForEmail: vi.fn(),
  mockLoadAuthFlags: vi.fn()
}));

vi.mock('../../../src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail
    }
  }
}));

vi.mock('../../../src/lib/authFlags', () => ({
  loadAuthFlags: mockLoadAuthFlags
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('../../../src/lib/analytics', () => ({
  trackEvent: vi.fn()
}));

import { sendPasswordRecoveryEmail } from '../../../src/services/authEmailService.js';

describe('authEmailService (ROA-409)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.AUTH_EMAIL_FROM = 'Roastr <noreply@roastr.ai>';
    process.env.SUPABASE_REDIRECT_URL = 'http://localhost:3000/auth/callback';
    process.env.NODE_ENV = 'test';
  });

  it('NO envía email si auth_enable_emails está OFF (fail-closed)', async () => {
    mockLoadAuthFlags.mockResolvedValueOnce({
      auth_enable_emails: false,
      auth_enable_password_recovery: true,
      auth_enable_register: true,
      auth_enable_login: true,
      auth_enable_magic_link: true
    });

    await expect(
      sendPasswordRecoveryEmail('user@example.com', { request_id: 'req_123' })
    ).rejects.toMatchObject({ slug: AUTH_ERROR_CODES.AUTH_EMAIL_DISABLED });

    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'auth_email_blocked',
        properties: { reason: AUTH_ERROR_CODES.AUTH_EMAIL_DISABLED }
      })
    );
  });

  it('envía email cuando flags ON y env/config OK', async () => {
    mockLoadAuthFlags.mockResolvedValueOnce({
      auth_enable_emails: true,
      auth_enable_password_recovery: true,
      auth_enable_register: true,
      auth_enable_login: true,
      auth_enable_magic_link: true
    });

    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });

    await expect(
      sendPasswordRecoveryEmail('user@example.com', { request_id: 'req_456' })
    ).resolves.toBeUndefined();

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'http://localhost:3000/auth/callback'
    });

    expect(trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'auth_email_requested',
        properties: expect.objectContaining({ flow: 'recovery', provider: 'resend' })
      })
    );
    expect(trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'auth_email_sent',
        properties: { flow: 'recovery' }
      })
    );

    // No PII: email must be truncated in logs
    expect(logger.info).toHaveBeenCalledWith(
      'auth_email_requested',
      expect.objectContaining({ email: 'use***@' })
    );
  });

  it('mapea error del proveedor a AUTH_EMAIL_RATE_LIMITED', async () => {
    mockLoadAuthFlags.mockResolvedValueOnce({
      auth_enable_emails: true,
      auth_enable_password_recovery: true,
      auth_enable_register: true,
      auth_enable_login: true,
      auth_enable_magic_link: true
    });

    mockResetPasswordForEmail.mockResolvedValueOnce({ error: new Error('Too many requests') });

    await expect(
      sendPasswordRecoveryEmail('user@example.com', { request_id: 'req_789' })
    ).rejects.toHaveProperty('slug', AUTH_ERROR_CODES.AUTH_EMAIL_RATE_LIMITED);

    expect(trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'auth_email_failed',
        properties: { error_slug: AUTH_ERROR_CODES.AUTH_EMAIL_RATE_LIMITED }
      })
    );
  });

  it('falla con AUTH_EMAIL_SEND_FAILED si falta redirect URL (sin llamar al proveedor)', async () => {
    mockLoadAuthFlags.mockResolvedValueOnce({
      auth_enable_emails: true,
      auth_enable_password_recovery: true,
      auth_enable_register: true,
      auth_enable_login: true,
      auth_enable_magic_link: true
    });

    delete process.env.SUPABASE_REDIRECT_URL;

    await expect(sendPasswordRecoveryEmail('user@example.com')).rejects.toHaveProperty(
      'slug',
      AUTH_ERROR_CODES.AUTH_EMAIL_SEND_FAILED
    );

    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });
});
