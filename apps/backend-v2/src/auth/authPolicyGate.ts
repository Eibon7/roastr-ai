/**
 * Auth Policy Gate V2
 *
 * Deterministic policy gate that decides whether an auth action is allowed
 * BEFORE any auth business logic runs.
 *
 * Issue: ROA-407 - A3 Auth Policy Wiring v2
 *
 * Philosophy:
 * - Policies decide (gate logic)
 * - Auth executes (business logic)
 * - Policies are checked BEFORE auth runs
 *
 * Policy Evaluation Order (STRICT):
 * 1. Feature Flags (highest priority)
 * 2. Account Status
 * 3. Rate Limit
 * 4. Abuse (lowest priority)
 *
 * Fail semantics: FAIL-CLOSED (block on error) unless explicitly specified
 */

import { loadSettings } from '../lib/loadSettings.js';
import { rateLimitService } from '../services/rateLimitService.js';
import { abuseDetectionServiceAdapter } from '../services/abuseDetectionServiceAdapter.js';
import { supabase } from '../lib/supabaseClient.js';
import { logger } from '../utils/logger.js';

/**
 * Auth actions that can be gated
 *
 * NOTE: Only actions with policy gate integration are included.
 * Other actions (logout, password_recovery, token_refresh) are handled
 * differently:
 * - logout: Protected by requireAuth middleware, no pre-check needed
 * - password_recovery: Not yet implemented (tracked separately)
 * - token_refresh: Handled by Supabase Auth directly
 */
export type AuthAction = 'login' | 'register' | 'magic_link';

/**
 * Policy types that can block an action (EXACT CONTRACT)
 */
export type PolicyType = 'feature_flag' | 'account_status' | 'rate_limit' | 'abuse';

/**
 * Context for policy evaluation
 */
export interface AuthPolicyContext {
  action: AuthAction;
  ip?: string;
  email?: string;
  userId?: string | null;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Result of policy evaluation
 */
export interface AuthPolicyResult {
  allowed: boolean;
  policy?: PolicyType;
  reason?: string;
  retryable: boolean;
  retryAfterSeconds?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Auth Policy Gate
 *
 * Evaluates policies in STRICT order and returns first blocking result.
 * If all policies pass, returns { allowed: true }.
 *
 * Policy Order (NON-NEGOTIABLE):
 * 1. Feature Flags
 * 2. Account Status
 * 3. Rate Limit
 * 4. Abuse
 */
export class AuthPolicyGate {
  /**
   * Check if an auth action is allowed by all policies
   */
  async check(context: AuthPolicyContext): Promise<AuthPolicyResult> {
    logger.debug('AuthPolicyGate: Checking policies', {
      action: context.action,
      ip: context.ip,
      email: context.email
    });

    // Policy 1: Feature Flags (highest priority)
    const featureFlagResult = await this.checkFeatureFlags(context);
    if (!featureFlagResult.allowed) {
      return featureFlagResult;
    }

    // Policy 2: Account Status
    const accountStatusResult = await this.checkAccountStatus(context);
    if (!accountStatusResult.allowed) {
      return accountStatusResult;
    }

    // Policy 3: Rate Limiting
    const rateLimitResult = await this.checkRateLimit(context);
    if (!rateLimitResult.allowed) {
      return rateLimitResult;
    }

    // Policy 4: Abuse (lowest priority)
    const abuseResult = await this.checkAbuse(context);
    if (!abuseResult.allowed) {
      return abuseResult;
    }

    // All policies passed
    logger.debug('AuthPolicyGate: All policies passed', {
      action: context.action
    });

    return {
      allowed: true,
      retryable: false
    };
  }

  /**
   * Policy 1: Feature Flags
   *
   * Check if the action is enabled via feature flags.
   * Fail-closed: block if settings cannot be loaded.
   */
  private async checkFeatureFlags(context: AuthPolicyContext): Promise<AuthPolicyResult> {
    try {
      const settings = await loadSettings();

      // Check specific feature flags per action
      switch (context.action) {
        case 'register':
          if (!settings?.feature_flags?.enable_user_registration) {
            logger.warn('AuthPolicyGate: Registration disabled by feature flag', {
              action: context.action
            });
            return {
              allowed: false,
              policy: 'feature_flag',
              reason: 'User registration is currently disabled',
              retryable: true
            };
          }
          break;

        case 'login':
          if (!settings?.auth?.login?.enabled) {
            logger.warn('AuthPolicyGate: Login disabled by feature flag', {
              action: context.action
            });
            return {
              allowed: false,
              policy: 'feature_flag',
              reason: 'Login is currently disabled',
              retryable: true
            };
          }
          break;

        case 'magic_link':
          if (!settings?.auth?.magic_link?.enabled) {
            logger.warn('AuthPolicyGate: Magic link disabled by feature flag', {
              action: context.action
            });
            return {
              allowed: false,
              policy: 'feature_flag',
              reason: 'Magic link authentication is currently disabled',
              retryable: true
            };
          }
          break;

        // Other actions (logout, token_refresh, password_recovery) are always allowed
        // unless explicitly disabled in settings
        default:
          break;
      }

      return { allowed: true, retryable: false };
    } catch (error) {
      // Fail-closed: if we can't load settings, block the action
      logger.error('AuthPolicyGate: Failed to load settings for feature flag check', {
        error: error instanceof Error ? error.message : 'Unknown error',
        action: context.action
      });

      return {
        allowed: false,
        policy: 'feature_flag',
        reason: 'Unable to verify feature availability',
        retryable: true
      };
    }
  }

  /**
   * Policy 2: Account Status
   *
   * Check if the user's account status allows the action.
   * Fail-closed: block if account status cannot be verified.
   *
   * Checks existing account state:
   * - active (must be true)
   * - suspended (must be false)
   *
   * Note: For actions without userId/email (rare), this policy is skipped.
   */
  private async checkAccountStatus(context: AuthPolicyContext): Promise<AuthPolicyResult> {
    // Skip account status check for register (no user exists yet)
    if (context.action === 'register') {
      return { allowed: true, retryable: false };
    }

    // Skip if no user identifier available
    if (!context.userId && !context.email) {
      return { allowed: true, retryable: false };
    }

    try {
      // Query user account status from database
      const { data: user, error } = await supabase
        .from('users')
        .select('id, email, active, suspended, suspended_reason')
        .or(context.userId ? `id.eq.${context.userId}` : `email.eq.${context.email}`)
        .single();

      if (error) {
        // Fail-closed: if we can't verify account status, block
        logger.error('AuthPolicyGate: Failed to query user account status', {
          error: error.message,
          action: context.action,
          userId: context.userId,
          email: context.email
        });

        return {
          allowed: false,
          policy: 'account_status',
          reason: 'Unable to verify account status',
          retryable: true
        };
      }

      // No user found - for actions other than register, this is an error state
      // But we let auth service handle "user not found" - not a policy concern
      if (!user) {
        return { allowed: true, retryable: false };
      }

      // Check if account is suspended
      if (user.suspended === true) {
        logger.warn('AuthPolicyGate: Account suspended', {
          action: context.action,
          userId: user.id,
          suspendedReason: user.suspended_reason
        });

        return {
          allowed: false,
          policy: 'account_status',
          reason: user.suspended_reason || 'Account has been suspended',
          retryable: false,
          metadata: {
            suspended: true,
            suspendedReason: user.suspended_reason
          }
        };
      }

      // Check if account is inactive
      if (user.active === false) {
        logger.warn('AuthPolicyGate: Account inactive', {
          action: context.action,
          userId: user.id
        });

        return {
          allowed: false,
          policy: 'account_status',
          reason: 'Account is inactive',
          retryable: false,
          metadata: {
            active: false
          }
        };
      }

      // Account status is good
      return { allowed: true, retryable: false };
    } catch (error) {
      // Fail-closed: if account status check throws, block
      logger.error('AuthPolicyGate: Account status check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        action: context.action,
        userId: context.userId,
        email: context.email
      });

      return {
        allowed: false,
        policy: 'account_status',
        reason: 'Unable to verify account status',
        retryable: true
      };
    }
  }

  /**
   * Policy 3: Rate Limiting
   *
   * Check if the action is rate limited.
   * Fail-closed: block if rate limit check fails.
   */
  private async checkRateLimit(context: AuthPolicyContext): Promise<AuthPolicyResult> {
    // Skip rate limit for logout and token refresh (low risk)
    if (context.action === 'logout' || context.action === 'token_refresh') {
      return { allowed: true, retryable: false };
    }

    try {
      // Build identifier (prefer user, fallback to email, fallback to IP)
      const identifier = context.userId || context.email || context.ip || 'unknown';

      // Map action to rate limit type
      const rateLimitType = this.mapActionToRateLimitType(context.action);
      if (!rateLimitType) {
        return { allowed: true, retryable: false };
      }

      // Check rate limit
      const result = rateLimitService.recordAttempt(rateLimitType, identifier);

      if (!result.allowed) {
        logger.warn('AuthPolicyGate: Rate limit exceeded', {
          action: context.action,
          identifier: identifier.substring(0, 10) + '...',
          blockedUntil: result.blockedUntil
        });

        const retryAfterSeconds = result.blockedUntil
          ? Math.ceil((result.blockedUntil - Date.now()) / 1000)
          : 900; // 15 minutes default

        return {
          allowed: false,
          policy: 'rate_limit',
          reason: 'Too many attempts. Please try again later.',
          retryable: true,
          retryAfterSeconds,
          metadata: {
            blockedUntil: result.blockedUntil
          }
        };
      }

      return { allowed: true, retryable: false };
    } catch (error) {
      // Fail-closed: if rate limit check fails, block
      logger.error('AuthPolicyGate: Rate limit check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        action: context.action
      });

      return {
        allowed: false,
        policy: 'rate_limit',
        reason: 'Unable to verify rate limit',
        retryable: true
      };
    }
  }

  /**
   * Policy 4: Abuse
   *
   * Check if the action is blocked by abuse detection.
   * Fail-closed: block if abuse check fails.
   */
  private async checkAbuse(context: AuthPolicyContext): Promise<AuthPolicyResult> {
    try {
      // Check with abuse detection service (via adapter)
      const isAbusive = await abuseDetectionServiceAdapter.checkRequest({
        ip: context.ip || 'unknown',
        email: context.email,
        userId: context.userId || undefined,
        action: context.action,
        userAgent: context.userAgent
      });

      if (isAbusive) {
        logger.warn('AuthPolicyGate: Abuse detected', {
          action: context.action,
          ip: context.ip,
          email: context.email
        });

        return {
          allowed: false,
          policy: 'abuse',
          reason: 'Request blocked due to suspicious activity',
          retryable: false // Abuse blocks are typically not retryable
        };
      }

      return { allowed: true, retryable: false };
    } catch (error) {
      // Fail-closed: if abuse check fails, block
      logger.error('AuthPolicyGate: Abuse check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        action: context.action
      });

      return {
        allowed: false,
        policy: 'abuse',
        reason: 'Unable to verify request safety',
        retryable: true
      };
    }
  }

  /**
   * Map auth action to rate limit type
   */
  private mapActionToRateLimitType(
    action: AuthAction
  ): 'login' | 'magic_link' | 'signup' | 'password_reset' | null {
    switch (action) {
      case 'login':
        return 'login';
      case 'register':
        return 'signup';
      case 'magic_link':
        return 'magic_link';
      case 'password_recovery':
        return 'password_reset';
      default:
        return null;
    }
  }
}

/**
 * Singleton instance
 */
export const authPolicyGate = new AuthPolicyGate();

/**
 * Helper function for easy usage in routes
 */
export async function checkAuthPolicy(context: AuthPolicyContext): Promise<AuthPolicyResult> {
  return authPolicyGate.check(context);
}
