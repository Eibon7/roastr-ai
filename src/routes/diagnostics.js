/**
 * Rutas de diagnóstico del sistema
 * Solo disponibles en modo desarrollo
 */

const express = require('express');
const router = express.Router();
const { getDiagnostics, NODE_ENV, IS_DEVELOPMENT } = require('../config/env');

// Middleware para permitir solo en desarrollo
const requireDevelopment = (req, res, next) => {
    if (!IS_DEVELOPMENT) {
        return res.status(404).json({
            success: false,
            error: 'Endpoint not available in production'
        });
    }
    next();
};

/**
 * GET /api/diagnostics/env
 * Muestra información de configuración del entorno
 */
router.get('/env', requireDevelopment, async (req, res) => {
    try {
        const diagnostics = getDiagnostics();
        
        res.json({
            success: true,
            message: 'Diagnósticos de entorno',
            timestamp: new Date().toISOString(),
            data: diagnostics
        });
    } catch (error) {
        console.error('Error en diagnósticos:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener diagnósticos',
            details: error.message
        });
    }
});

/**
 * GET /api/diagnostics/health
 * Health check básico del sistema
 */
router.get('/health', requireDevelopment, async (req, res) => {
    try {
        const { database, stripe, ai } = require('../config/env');
        
        // Verificar conexiones básicas
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: NODE_ENV,
            checks: {
                supabase: {
                    configured: !!(database.SUPABASE_URL && database.SUPABASE_SERVICE_KEY),
                    status: 'unknown' // Se podría hacer ping real
                },
                stripe: {
                    configured: !!(stripe.STRIPE_SECRET_KEY && stripe.STRIPE_PUBLISHABLE_KEY),
                    webhookConfigured: !!stripe.STRIPE_WEBHOOK_SECRET
                },
                openai: {
                    configured: !!ai.OPENAI_API_KEY
                },
                redis: {
                    configured: !!(database.UPSTASH_REDIS_REST_URL || database.REDIS_URL)
                }
            }
        };
        
        // Determinar estado general
        const criticalServices = ['supabase'];
        const hasCriticalIssues = criticalServices.some(service => 
            !health.checks[service]?.configured
        );
        
        if (hasCriticalIssues) {
            health.status = 'unhealthy';
        }
        
        res.json({
            success: true,
            data: health
        });
        
    } catch (error) {
        console.error('Error en health check:', error);
        res.status(500).json({
            success: false,
            error: 'Error en health check',
            details: error.message
        });
    }
});

/**
 * GET /api/diagnostics/config
 * Muestra configuración sanitizada (sin secretos)
 */
router.get('/config', requireDevelopment, async (req, res) => {
    try {
        const { ENV_CONFIG } = require('../config/env');
        
        // Crear versión sanitizada de la configuración
        const sanitizedConfig = {
            environment: ENV_CONFIG.environment,
            database: {
                hasSupabaseUrl: !!ENV_CONFIG.database.SUPABASE_URL,
                hasSupabaseServiceKey: !!ENV_CONFIG.database.SUPABASE_SERVICE_KEY,
                hasSupabaseAnonKey: !!ENV_CONFIG.database.SUPABASE_ANON_KEY,
                hasRedis: !!(ENV_CONFIG.database.UPSTASH_REDIS_REST_URL || ENV_CONFIG.database.REDIS_URL)
            },
            ai: {
                hasOpenAI: !!ENV_CONFIG.ai.OPENAI_API_KEY,
                hasPerspective: !!ENV_CONFIG.ai.PERSPECTIVE_API_KEY
            },
            stripe: {
                hasPublishableKey: !!ENV_CONFIG.stripe.STRIPE_PUBLISHABLE_KEY,
                hasSecretKey: !!ENV_CONFIG.stripe.STRIPE_SECRET_KEY,
                hasWebhookSecret: !!ENV_CONFIG.stripe.STRIPE_WEBHOOK_SECRET,
                appBaseUrl: ENV_CONFIG.stripe.APP_BASE_URL,
                successUrl: ENV_CONFIG.stripe.STRIPE_SUCCESS_URL,
                cancelUrl: ENV_CONFIG.stripe.STRIPE_CANCEL_URL,
                portalReturnUrl: ENV_CONFIG.stripe.STRIPE_PORTAL_RETURN_URL,
                lookupKeys: {
                    free: ENV_CONFIG.stripe.STRIPE_PRICE_LOOKUP_FREE,
                    pro: ENV_CONFIG.stripe.STRIPE_PRICE_LOOKUP_PRO,
                    creator: ENV_CONFIG.stripe.STRIPE_PRICE_LOOKUP_CREATOR
                }
            },
            integrations: {
                enabled: ENV_CONFIG.integrations.INTEGRATIONS_ENABLED,
                maxConcurrent: ENV_CONFIG.integrations.MAX_CONCURRENT_INTEGRATIONS,
                platforms: {
                    twitter: {
                        hasBearerToken: !!ENV_CONFIG.integrations.TWITTER_BEARER_TOKEN,
                        hasAppKeys: !!(ENV_CONFIG.integrations.TWITTER_APP_KEY && ENV_CONFIG.integrations.TWITTER_APP_SECRET),
                        hasAccessTokens: !!(ENV_CONFIG.integrations.TWITTER_ACCESS_TOKEN && ENV_CONFIG.integrations.TWITTER_ACCESS_SECRET)
                    },
                    youtube: {
                        hasApiKey: !!ENV_CONFIG.integrations.YOUTUBE_API_KEY
                    },
                    instagram: {
                        hasAccessToken: !!ENV_CONFIG.integrations.INSTAGRAM_ACCESS_TOKEN
                    },
                    facebook: {
                        hasAccessToken: !!ENV_CONFIG.integrations.FACEBOOK_ACCESS_TOKEN
                    },
                    discord: {
                        hasBotToken: !!ENV_CONFIG.integrations.DISCORD_BOT_TOKEN
                    },
                    twitch: {
                        hasClientCredentials: !!(ENV_CONFIG.integrations.TWITCH_CLIENT_ID && ENV_CONFIG.integrations.TWITCH_CLIENT_SECRET)
                    },
                    reddit: {
                        hasClientCredentials: !!(ENV_CONFIG.integrations.REDDIT_CLIENT_ID && ENV_CONFIG.integrations.REDDIT_CLIENT_SECRET)
                    }
                }
            },
            app: ENV_CONFIG.app,
            logging: ENV_CONFIG.logging
        };
        
        res.json({
            success: true,
            message: 'Configuración del sistema (sanitizada)',
            timestamp: new Date().toISOString(),
            data: sanitizedConfig
        });
        
    } catch (error) {
        console.error('Error obteniendo configuración:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener configuración',
            details: error.message
        });
    }
});

module.exports = router;