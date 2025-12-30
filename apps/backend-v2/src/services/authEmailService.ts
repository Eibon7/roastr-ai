/**
 * Auth Email Infrastructure (V2) — ROA-409
 *
 * Goals:
 * - Fail-closed: if disabled/misconfigured, requests fail (no simulated success)
 * - No HTML generation in backend-v2 (Supabase templates / provider-managed)
 * - No PII in logs (emails truncated)
 * - Stable error slugs (Auth Error Handling v2)
 * - Observability events (snake_case, no PII)
 */

import { supabase } from '../lib/supabaseClient.js';
import { loadAuthFlags } from '../lib/authFlags.js';
import { trackEvent } from '../lib/analytics.js';
import { AuthError, AUTH_ERROR_CODES } from '../utils/authErrorTaxonomy.js';
import { logger } from '../utils/logger.js';
import { truncateEmailForLog } from '../utils/pii.js';

export type AuthEmailFlow = 'register' | 'recovery';

export type AuthEmailProvider = 'resend';

export type AuthEmailContext = {
  request_id?: string;
};

function getProvider(): AuthEmailProvider {
  // Supabase Auth sends transactional emails via configured SMTP.
  // In Roastr v2, the configured provider is Resend.
  return 'resend';
}

function isHttps(url: string): boolean {
  return /^https:\/\//i.test(url);
}

function getRedirectUrlOrThrow(): string {
  const redirectUrl = process.env.SUPABASE_REDIRECT_URL;
  if (!redirectUrl) {
    throw new AuthError(AUTH_ERROR_CODES.AUTH_EMAIL_SEND_FAILED, { cause: 'missing_redirect_url' });
  }

  try {
    // Basic validation (throws if invalid)
    // eslint-disable-next-line no-new
    new URL(redirectUrl);
  } catch {
    throw new AuthError(AUTH_ERROR_CODES.AUTH_EMAIL_SEND_FAILED, { cause: 'invalid_redirect_url' });
  }

  if (process.env.NODE_ENV === 'production' && !isHttps(redirectUrl)) {
    throw new AuthError(AUTH_ERROR_CODES.AUTH_EMAIL_SEND_FAILED, {
      cause: 'redirect_url_must_be_https_in_production'
    });
  }

  return redirectUrl;
}

function assertAuthEmailEnvOrThrow(): void {
  // Required by infra contract (even if Supabase uses SMTP under the hood).
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;

  if (!apiKey || !from) {
    throw new AuthError(AUTH_ERROR_CODES.AUTH_EMAIL_SEND_FAILED, { cause: 'missing_email_env' });
  }
}

function mapProviderError(error: unknown): AuthError {
  const rawMessage = (error as any)?.message?.toString?.() || '';
  const message = rawMessage.toLowerCase();
  const status = (error as any)?.status ?? (error as any)?.statusCode ?? (error as any)?.code;

  if (status === 429 || message.includes('too many requests') || message.includes('rate_limit')) {
    return new AuthError(AUTH_ERROR_CODES.AUTH_EMAIL_RATE_LIMITED, { cause: error });
  }

  return new AuthError(AUTH_ERROR_CODES.AUTH_EMAIL_PROVIDER_ERROR, { cause: error });
}

async function assertAuthEmailEnabledOrThrow(flow: AuthEmailFlow): Promise<void> {
  const flags = await loadAuthFlags();

  if (!flags.auth_enable_emails) {
    throw new AuthError(AUTH_ERROR_CODES.AUTH_EMAIL_DISABLED, { cause: 'flag:auth_enable_emails' });
  }

  if (flow === 'register' && !flags.auth_enable_register) {
    throw new AuthError(AUTH_ERROR_CODES.AUTH_EMAIL_DISABLED, {
      cause: 'flag:auth_enable_register'
    });
  }

  if (flow === 'recovery' && !flags.auth_enable_password_recovery) {
    throw new AuthError(AUTH_ERROR_CODES.AUTH_EMAIL_DISABLED, {
      cause: 'flag:auth_enable_password_recovery'
    });
  }
}

function trackSafe(event: string, payload: Parameters<typeof trackEvent>[0]): void {
  try {
    trackEvent(payload);
  } catch {
    logger.warn('analytics.track_failed', { event });
  }
}

function logContext(flow: AuthEmailFlow, email: string, context?: AuthEmailContext): Record<string, any> {
  return {
    request_id: context?.request_id,
    flow,
    email: truncateEmailForLog(email)
  };
}

export async function assertAuthEmailInfrastructureEnabled(
  flow: AuthEmailFlow,
  email: string,
  context: AuthEmailContext = {}
): Promise<{ provider: AuthEmailProvider }> {
  const provider = getProvider();

  try {
    await assertAuthEmailEnabledOrThrow(flow);
    assertAuthEmailEnvOrThrow();

    return { provider };
  } catch (error) {
    const authError = error instanceof AuthError ? error : mapProviderError(error);

    logger.warn('auth_email_blocked', {
      ...logContext(flow, email, context),
      reason: authError.slug
    });

    trackSafe('auth_email_blocked', {
      event: 'auth_email_blocked',
      properties: {
        reason: authError.slug
      },
      context: {
        flow: 'auth',
        request_id: context.request_id
      }
    });

    throw authError;
  }
}

/**
 * Send password recovery email via Supabase Auth (SMTP provider = Resend).
 *
 * @param email - target email
 * @param context - request context (no PII)
 */
export async function sendPasswordRecoveryEmail(
  email: string,
  context: AuthEmailContext = {}
): Promise<void> {
  const flow: AuthEmailFlow = 'recovery';
  await assertAuthEmailInfrastructureEnabled(flow, email, context);
  await sendPasswordRecoveryEmailAfterPreflight(email, context);
}

/**
 * Same as sendPasswordRecoveryEmail, but assumes preflight already ran:
 * - feature flags checked
 * - required env validated
 *
 * Useful to keep anti-enumeration logic in AuthService while still
 * failing closed when email infra is disabled/misconfigured.
 */
export async function sendPasswordRecoveryEmailAfterPreflight(
  email: string,
  context: AuthEmailContext = {}
): Promise<void> {
  const flow: AuthEmailFlow = 'recovery';
  const provider = getProvider();

  logger.info('auth_email_requested', logContext(flow, email, context));
  trackSafe('auth_email_requested', {
    event: 'auth_email_requested',
    properties: {
      flow,
      provider
    },
    context: {
      flow: 'auth',
      request_id: context.request_id
    }
  });

  try {
    const redirectTo = getRedirectUrlOrThrow();
    const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), { redirectTo });

    if (error) throw error;

    logger.info('auth_email_sent', logContext(flow, email, context));
    trackSafe('auth_email_sent', {
      event: 'auth_email_sent',
      properties: { flow },
      context: {
        flow: 'auth',
        request_id: context.request_id
      }
    });
  } catch (error) {
    const mapped = error instanceof AuthError ? error : mapProviderError(error);

    logger.error('auth_email_failed', {
      ...logContext(flow, email, context),
      error_slug: mapped.slug
    });

    trackSafe('auth_email_failed', {
      event: 'auth_email_failed',
      properties: {
        error_slug: mapped.slug
      },
      context: {
        flow: 'auth',
        request_id: context.request_id
      }
    });

    throw mapped;
  }
}

