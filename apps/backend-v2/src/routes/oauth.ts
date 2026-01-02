/**
 * OAuth Routes v2 (Infra Only)
 *
 * SCOPE: Infraestructura OAuth sin providers reales.
 *
 * Implementado:
 * - Feature flag validation
 * - Provider enum validation
 * - Error contracts (OAUTH_DISABLED, OAUTH_PROVIDER_NOT_SUPPORTED)
 *
 * NO implementado (post-MVP):
 * - SDKs OAuth (X, YouTube, Google)
 * - Token exchange
 * - State parameter validation con Redis
 * - PKCE flow
 */

import { Router, Request, Response } from 'express';
import { AuthError, AUTH_ERROR_CODES } from '../utils/authErrorTaxonomy.js';
import { sendAuthError } from '../utils/authErrorResponse.js';
import { logger } from '../utils/logger.js';
import { isAuthEndpointEnabled } from '../lib/authFlags.js';

const router = Router();

/**
 * OAuth Providers soportados (enum contractual)
 *
 * v2 MVP: x, youtube
 * Futuro: instagram, facebook, discord, etc.
 */
const SUPPORTED_OAUTH_PROVIDERS = ['x', 'youtube'] as const;
type OAuthProvider = (typeof SUPPORTED_OAUTH_PROVIDERS)[number];

function isSupportedProvider(provider: string): provider is OAuthProvider {
  return SUPPORTED_OAUTH_PROVIDERS.includes(provider as any);
}

/**
 * POST /api/v2/auth/oauth/:provider
 * OAuth initiation endpoint (infra only)
 *
 * Request: POST /api/v2/auth/oauth/x
 * Response: 501 Not Implemented (providers post-MVP)
 *
 * Validaciones:
 * - Feature flag: auth_enable_oauth
 * - Provider soportado: x | youtube
 *
 * Errores:
 * - OAUTH_DISABLED (si feature flag OFF)
 * - OAUTH_PROVIDER_NOT_SUPPORTED (si provider no válido)
 * - NOT_IMPLEMENTED (provider válido pero no implementado aún)
 */
router.post('/oauth/:provider', async (req: Request, res: Response) => {
  const { provider } = req.params;

  try {
    // Feature flag check: auth_enable_oauth
    await isAuthEndpointEnabled('auth_enable_oauth', 'oauth').catch(() => {
      logger.warn('OAuth disabled by feature flag', { provider });
      throw new AuthError(AUTH_ERROR_CODES.AUTH_DISABLED, { cause: 'oauth_disabled' });
    });

    // Validate provider
    if (!provider || typeof provider !== 'string') {
      return sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.INVALID_REQUEST), {
        log: { policy: 'validation:oauth' }
      });
    }

    if (!isSupportedProvider(provider)) {
      logger.warn('Unsupported OAuth provider', { provider });
      return sendAuthError(
        req,
        res,
        new AuthError(AUTH_ERROR_CODES.INVALID_REQUEST, {
          cause: `Provider '${provider}' not supported. Supported: ${SUPPORTED_OAUTH_PROVIDERS.join(', ')}`
        }),
        {
          log: { policy: 'validation:oauth:provider' }
        }
      );
    }

    // OAuth infra ready, but providers not implemented (post-MVP)
    logger.info('OAuth endpoint reached (provider not implemented)', { provider });

    return res.status(501).json({
      success: false,
      error: {
        slug: 'NOT_IMPLEMENTED',
        message: `OAuth provider '${provider}' is supported but not implemented yet (post-MVP).`,
        provider,
        supported_providers: SUPPORTED_OAUTH_PROVIDERS
      }
    });
  } catch (error) {
    return sendAuthError(req, res, error, { log: { policy: 'oauth:init' } });
  }
});

/**
 * GET /api/v2/auth/oauth/:provider/callback
 * OAuth callback endpoint (infra only)
 *
 * Response: 501 Not Implemented (providers post-MVP)
 */
router.get('/oauth/:provider/callback', async (req: Request, res: Response) => {
  const { provider } = req.params;

  try {
    // Feature flag check
    await isAuthEndpointEnabled('auth_enable_oauth', 'oauth').catch(() => {
      throw new AuthError(AUTH_ERROR_CODES.AUTH_DISABLED, { cause: 'oauth_disabled' });
    });

    if (!isSupportedProvider(provider)) {
      return sendAuthError(
        req,
        res,
        new AuthError(AUTH_ERROR_CODES.INVALID_REQUEST, {
          cause: `Provider '${provider}' not supported`
        }),
        {
          log: { policy: 'validation:oauth:callback' }
        }
      );
    }

    // OAuth callback infra ready, but providers not implemented (post-MVP)
    logger.info('OAuth callback reached (provider not implemented)', { provider });

    return res.status(501).json({
      success: false,
      error: {
        slug: 'NOT_IMPLEMENTED',
        message: `OAuth callback for '${provider}' not implemented yet (post-MVP).`
      }
    });
  } catch (error) {
    return sendAuthError(req, res, error, { log: { policy: 'oauth:callback' } });
  }
});

export default router;
