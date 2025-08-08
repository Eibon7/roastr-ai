/**
 * Sistema robusto de carga de variables de entorno
 * 
 * Funcionalidad:
 * - Carga .env.local cuando NODE_ENV=development
 * - Carga .env.production cuando NODE_ENV=production  
 * - En Vercel/producción cloud: usa variables del sistema (no archivos)
 * - Centraliza toda la configuración de entorno
 * - Proporciona validación y valores por defecto
 */

const path = require('path');
const fs = require('fs');

// Detectar entorno
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_VERCEL = process.env.VERCEL === '1';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_DEVELOPMENT = NODE_ENV === 'development';

/**
 * Carga archivos .env basado en el entorno
 */
function loadEnvironmentFiles() {
    // En Vercel u otros entornos cloud, no cargar archivos
    if (IS_VERCEL) {
        console.log('🌐 Entorno cloud detectado (Vercel) - usando variables del sistema');
        return;
    }

    const rootDir = path.join(__dirname, '../../');
    let envFile = null;

    // Determinar qué archivo .env cargar
    if (IS_DEVELOPMENT) {
        envFile = path.join(rootDir, '.env.local');
        console.log('🔧 Modo desarrollo - cargando .env.local');
    } else if (IS_PRODUCTION) {
        envFile = path.join(rootDir, '.env.production');
        console.log('🚀 Modo producción - cargando .env.production');
    }

    // Cargar archivo si existe
    if (envFile && fs.existsSync(envFile)) {
        require('dotenv').config({ path: envFile });
        console.log(`✅ Variables cargadas desde: ${path.basename(envFile)}`);
    } else if (envFile) {
        console.warn(`⚠️  Archivo no encontrado: ${path.basename(envFile)}`);
        
        // Fallback a .env genérico
        const fallbackEnv = path.join(rootDir, '.env');
        if (fs.existsSync(fallbackEnv)) {
            require('dotenv').config({ path: fallbackEnv });
            console.log('📁 Fallback: usando .env genérico');
        }
    }
}

/**
 * Configuración centralizada de variables de entorno
 */
const ENV_CONFIG = {
    // Información del entorno
    environment: {
        NODE_ENV,
        IS_VERCEL,
        IS_PRODUCTION,
        IS_DEVELOPMENT,
        PORT: parseInt(process.env.PORT || '3000', 10)
    },

    // Base de datos y cache
    database: {
        SUPABASE_URL: process.env.SUPABASE_URL || '',
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
        UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || '',
        UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || '',
        REDIS_URL: process.env.REDIS_URL || ''
    },

    // APIs de AI y moderación
    ai: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        PERSPECTIVE_API_KEY: process.env.PERSPECTIVE_API_KEY || ''
    },

    // Stripe configuración
    stripe: {
        STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
        
        // URLs de redirección
        APP_BASE_URL: process.env.APP_BASE_URL || (IS_DEVELOPMENT ? 'http://localhost:3000' : ''),
        STRIPE_SUCCESS_URL: process.env.STRIPE_SUCCESS_URL || '',
        STRIPE_CANCEL_URL: process.env.STRIPE_CANCEL_URL || '',
        STRIPE_PORTAL_RETURN_URL: process.env.STRIPE_PORTAL_RETURN_URL || '',
        
        // Lookup keys para planes
        STRIPE_PRICE_LOOKUP_FREE: process.env.STRIPE_PRICE_LOOKUP_FREE || 'plan_free_monthly',
        STRIPE_PRICE_LOOKUP_PRO: process.env.STRIPE_PRICE_LOOKUP_PRO || 'plan_pro_monthly',
        STRIPE_PRICE_LOOKUP_CREATOR: process.env.STRIPE_PRICE_LOOKUP_CREATOR || 'plan_creator_monthly'
    },

    // Integraciones de plataformas sociales
    integrations: {
        TWITTER_BEARER_TOKEN: process.env.TWITTER_BEARER_TOKEN || '',
        TWITTER_APP_KEY: process.env.TWITTER_APP_KEY || '',
        TWITTER_APP_SECRET: process.env.TWITTER_APP_SECRET || '',
        TWITTER_ACCESS_TOKEN: process.env.TWITTER_ACCESS_TOKEN || '',
        TWITTER_ACCESS_SECRET: process.env.TWITTER_ACCESS_SECRET || '',
        
        YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || '',
        INSTAGRAM_ACCESS_TOKEN: process.env.INSTAGRAM_ACCESS_TOKEN || '',
        FACEBOOK_ACCESS_TOKEN: process.env.FACEBOOK_ACCESS_TOKEN || '',
        DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || '',
        
        TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID || '',
        TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET || '',
        REDDIT_CLIENT_ID: process.env.REDDIT_CLIENT_ID || '',
        REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET || '',
        
        INTEGRATIONS_ENABLED: process.env.INTEGRATIONS_ENABLED || 'twitter,youtube,bluesky',
        MAX_CONCURRENT_INTEGRATIONS: parseInt(process.env.MAX_CONCURRENT_INTEGRATIONS || '3', 10)
    },

    // Configuración de aplicación
    app: {
        ROASTR_API_KEY: process.env.ROASTR_API_KEY || '',
        ROAST_API_URL: process.env.ROAST_API_URL || '',
        BILLING_ENABLED: process.env.BILLING_ENABLED === 'true',
        SHIELD_ENABLED: process.env.ROASTR_SHIELD_ENABLED === 'true',
        ROASTR_MODE: process.env.ROASTR_MODE || 'normal'
    },

    // Logging y debug
    logging: {
        DEBUG: process.env.DEBUG === 'true',
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
        LOG_ROTATION: process.env.LOG_ROTATION === 'true'
    }
};

/**
 * Valida variables críticas según el entorno
 */
function validateEnvironment() {
    // Skip validation in test environment
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
        return;
    }
    
    const errors = [];
    const warnings = [];

    // Variables críticas para DESARROLLO
    if (IS_DEVELOPMENT) {
        const devRequired = [
            { key: 'SUPABASE_URL', value: ENV_CONFIG.database.SUPABASE_URL },
            { key: 'SUPABASE_ANON_KEY', value: ENV_CONFIG.database.SUPABASE_ANON_KEY },
            { key: 'OPENAI_API_KEY', value: ENV_CONFIG.ai.OPENAI_API_KEY },
            { key: 'STRIPE_SECRET_KEY', value: ENV_CONFIG.stripe.STRIPE_SECRET_KEY },
            { key: 'STRIPE_WEBHOOK_SECRET', value: ENV_CONFIG.stripe.STRIPE_WEBHOOK_SECRET },
            { key: 'STRIPE_SUCCESS_URL', value: ENV_CONFIG.stripe.STRIPE_SUCCESS_URL },
            { key: 'STRIPE_CANCEL_URL', value: ENV_CONFIG.stripe.STRIPE_CANCEL_URL },
            { key: 'STRIPE_PORTAL_RETURN_URL', value: ENV_CONFIG.stripe.STRIPE_PORTAL_RETURN_URL }
        ];

        devRequired.forEach(({ key, value }) => {
            if (!value) {
                errors.push(`❌ Falta ${key} en .env.local`);
            }
        });
    }

    // Variables críticas para PRODUCCIÓN
    if (IS_PRODUCTION && !IS_VERCEL) {
        const prodRequired = [
            { key: 'SUPABASE_URL', value: ENV_CONFIG.database.SUPABASE_URL },
            { key: 'SUPABASE_ANON_KEY', value: ENV_CONFIG.database.SUPABASE_ANON_KEY },
            { key: 'SUPABASE_SERVICE_KEY', value: ENV_CONFIG.database.SUPABASE_SERVICE_KEY },
            { key: 'OPENAI_API_KEY', value: ENV_CONFIG.ai.OPENAI_API_KEY },
            { key: 'STRIPE_SECRET_KEY', value: ENV_CONFIG.stripe.STRIPE_SECRET_KEY },
            { key: 'STRIPE_WEBHOOK_SECRET', value: ENV_CONFIG.stripe.STRIPE_WEBHOOK_SECRET },
            { key: 'STRIPE_SUCCESS_URL', value: ENV_CONFIG.stripe.STRIPE_SUCCESS_URL },
            { key: 'STRIPE_CANCEL_URL', value: ENV_CONFIG.stripe.STRIPE_CANCEL_URL },
            { key: 'STRIPE_PORTAL_RETURN_URL', value: ENV_CONFIG.stripe.STRIPE_PORTAL_RETURN_URL },
            { key: 'ROASTR_API_KEY', value: ENV_CONFIG.app.ROASTR_API_KEY },
            { key: 'PERSPECTIVE_API_KEY', value: ENV_CONFIG.ai.PERSPECTIVE_API_KEY }
        ];

        prodRequired.forEach(({ key, value }) => {
            if (!value) {
                errors.push(`❌ Falta ${key} en .env.production`);
            }
        });

        // Validar APIs de redes sociales obligatorias en producción
        const socialRequired = [
            { key: 'TWITTER_BEARER_TOKEN', value: ENV_CONFIG.integrations.TWITTER_BEARER_TOKEN },
            { key: 'YOUTUBE_API_KEY', value: ENV_CONFIG.integrations.YOUTUBE_API_KEY }
        ];

        socialRequired.forEach(({ key, value }) => {
            if (!value) {
                warnings.push(`⚠️  ${key} no configurado en producción`);
            }
        });
    }

    // Validar que Stripe keys sean del entorno correcto
    if (ENV_CONFIG.stripe.STRIPE_SECRET_KEY) {
        const isTestKey = ENV_CONFIG.stripe.STRIPE_SECRET_KEY.startsWith('sk_test_');
        const isLiveKey = ENV_CONFIG.stripe.STRIPE_SECRET_KEY.startsWith('sk_live_');
        
        if (IS_DEVELOPMENT && !isTestKey) {
            warnings.push('⚠️  Usando clave LIVE de Stripe en desarrollo');
        }
        if (IS_PRODUCTION && !isLiveKey) {
            errors.push('❌ Debe usar clave LIVE de Stripe en producción');
        }
    }

    // Reportar errores y abortar si es necesario
    if (errors.length > 0) {
        console.error('\n❌ ERRORES CRÍTICOS DE CONFIGURACIÓN:');
        errors.forEach(error => console.error(`   ${error}`));
        console.error('\n🚫 La aplicación no puede arrancar con estos errores.\n');
        
        if (IS_PRODUCTION || errors.some(e => e.includes('SUPABASE_URL') || e.includes('OPENAI_API_KEY'))) {
            throw new Error(`Configuración inválida: ${errors.join(', ')}`);
        }
    }

    // Mostrar advertencias
    if (warnings.length > 0) {
        console.warn('\n⚠️  ADVERTENCIAS DE CONFIGURACIÓN:');
        warnings.forEach(warning => console.warn(`   ${warning}`));
        console.warn('');
    }

    // Mensaje de éxito
    if (errors.length === 0) {
        const env = IS_VERCEL ? 'Vercel' : NODE_ENV;
        console.log(`✅ Configuración validada correctamente para: ${env}`);
    }
}

/**
 * Obtiene información de diagnóstico del entorno
 */
function getDiagnostics() {
    return {
        environment: {
            NODE_ENV,
            IS_VERCEL,
            IS_PRODUCTION,
            IS_DEVELOPMENT,
            platform: process.platform,
            nodeVersion: process.version
        },
        configStatus: {
            hasSupabaseUrl: !!ENV_CONFIG.database.SUPABASE_URL,
            hasSupabaseServiceKey: !!ENV_CONFIG.database.SUPABASE_SERVICE_KEY,
            hasOpenAI: !!ENV_CONFIG.ai.OPENAI_API_KEY,
            hasStripeKeys: !!(ENV_CONFIG.stripe.STRIPE_SECRET_KEY && ENV_CONFIG.stripe.STRIPE_PUBLISHABLE_KEY),
            billingEnabled: ENV_CONFIG.app.BILLING_ENABLED,
            shieldEnabled: ENV_CONFIG.app.SHIELD_ENABLED,
            enabledIntegrations: ENV_CONFIG.integrations.INTEGRATIONS_ENABLED.split(',')
        },
        urls: {
            appBaseUrl: ENV_CONFIG.stripe.APP_BASE_URL,
            hasRedisUrl: !!ENV_CONFIG.database.REDIS_URL || !!ENV_CONFIG.database.UPSTASH_REDIS_REST_URL
        }
    };
}

/**
 * Inicialización del sistema de entorno
 */
function initializeEnvironment() {
    console.log(`🔧 Inicializando entorno: ${NODE_ENV}`);
    
    // Cargar archivos .env apropiados
    loadEnvironmentFiles();
    
    // Validar configuración
    validateEnvironment();
    
    console.log(`🌍 Entorno configurado para: ${IS_VERCEL ? 'Vercel' : NODE_ENV}`);
}

// Inicializar automáticamente al importar
initializeEnvironment();

// Exportar configuración y utilidades
module.exports = {
    // Configuración completa
    ENV_CONFIG,
    
    // Información del entorno
    NODE_ENV,
    IS_VERCEL,
    IS_PRODUCTION,
    IS_DEVELOPMENT,
    
    // Utilidades
    validateEnvironment,
    getDiagnostics,
    loadEnvironmentFiles,
    
    // Acceso directo a secciones comunes
    database: ENV_CONFIG.database,
    stripe: ENV_CONFIG.stripe,
    ai: ENV_CONFIG.ai,
    integrations: ENV_CONFIG.integrations,
    app: ENV_CONFIG.app,
    logging: ENV_CONFIG.logging
};