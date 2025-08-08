/**
 * Tests unitarios para rutas de diagnóstico
 */

const request = require('supertest');
const express = require('express');

// Mock del sistema de entorno
jest.mock('../../../src/config/env', () => ({
    IS_DEVELOPMENT: true,
    NODE_ENV: 'development',
    getDiagnostics: jest.fn(() => ({
        environment: {
            NODE_ENV: 'development',
            IS_VERCEL: false,
            IS_PRODUCTION: false,
            IS_DEVELOPMENT: true,
            platform: 'linux',
            nodeVersion: 'v18.17.0'
        },
        configStatus: {
            hasSupabaseUrl: true,
            hasSupabaseServiceKey: true,
            hasOpenAI: true,
            hasStripeKeys: true,
            billingEnabled: true,
            shieldEnabled: false,
            enabledIntegrations: ['twitter', 'youtube']
        },
        urls: {
            appBaseUrl: 'http://localhost:3000',
            hasRedisUrl: true
        }
    })),
    ENV_CONFIG: {
        environment: {
            NODE_ENV: 'development',
            IS_VERCEL: false,
            IS_PRODUCTION: false,
            IS_DEVELOPMENT: true,
            PORT: 3000
        },
        database: {
            SUPABASE_URL: 'https://test.supabase.co',
            SUPABASE_SERVICE_KEY: 'service_key',
            SUPABASE_ANON_KEY: 'anon_key',
            UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io',
            UPSTASH_REDIS_REST_TOKEN: 'token'
        },
        ai: {
            OPENAI_API_KEY: 'sk-test-123',
            PERSPECTIVE_API_KEY: 'perspective-123'
        },
        stripe: {
            STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
            STRIPE_SECRET_KEY: 'sk_test_123',
            STRIPE_WEBHOOK_SECRET: 'whsec_123',
            APP_BASE_URL: 'http://localhost:3000',
            STRIPE_SUCCESS_URL: 'http://localhost:3000/success',
            STRIPE_CANCEL_URL: 'http://localhost:3000/cancel',
            STRIPE_PORTAL_RETURN_URL: 'http://localhost:3000/billing',
            STRIPE_PRICE_LOOKUP_FREE: 'plan_free_monthly',
            STRIPE_PRICE_LOOKUP_PRO: 'plan_pro_monthly',
            STRIPE_PRICE_LOOKUP_CREATOR: 'plan_creator_monthly'
        },
        integrations: {
            TWITTER_BEARER_TOKEN: 'bearer_token',
            TWITTER_APP_KEY: 'app_key',
            INTEGRATIONS_ENABLED: 'twitter,youtube',
            MAX_CONCURRENT_INTEGRATIONS: 3
        },
        app: {
            BILLING_ENABLED: true,
            SHIELD_ENABLED: false,
            ROASTR_MODE: 'normal'
        },
        logging: {
            DEBUG: true,
            LOG_LEVEL: 'debug'
        }
    }
}));

const diagnosticsRoutes = require('../../../src/routes/diagnostics');

describe('Diagnostics Routes Tests', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/diagnostics', diagnosticsRoutes);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Development Environment Routes', () => {
        it('should return environment diagnostics in development', async () => {
            const response = await request(app)
                .get('/api/diagnostics/env')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Diagnósticos de entorno');
            expect(response.body.data).toHaveProperty('environment');
            expect(response.body.data).toHaveProperty('configStatus');
            expect(response.body.data).toHaveProperty('urls');
            expect(response.body.timestamp).toBeDefined();
        });

        it('should return health check in development', async () => {
            const response = await request(app)
                .get('/api/diagnostics/health')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('status');
            expect(response.body.data).toHaveProperty('timestamp');
            expect(response.body.data).toHaveProperty('environment');
            expect(response.body.data).toHaveProperty('checks');
            
            expect(response.body.data.checks).toHaveProperty('supabase');
            expect(response.body.data.checks).toHaveProperty('stripe');
            expect(response.body.data.checks).toHaveProperty('openai');
            expect(response.body.data.checks).toHaveProperty('redis');
        });

        it('should return sanitized config in development', async () => {
            const response = await request(app)
                .get('/api/diagnostics/config')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Configuración del sistema (sanitizada)');
            expect(response.body.data).toHaveProperty('environment');
            expect(response.body.data).toHaveProperty('database');
            expect(response.body.data).toHaveProperty('stripe');
            
            // Verificar que no se exponen secretos
            expect(response.body.data.database).not.toHaveProperty('SUPABASE_SERVICE_KEY');
            expect(response.body.data.stripe).not.toHaveProperty('STRIPE_SECRET_KEY');
            
            // Verificar que sí se exponen indicadores de configuración
            expect(response.body.data.database.hasSupabaseUrl).toBe(true);
            expect(response.body.data.stripe.hasSecretKey).toBe(true);
        });

        it('should include platform integration status in config', async () => {
            const response = await request(app)
                .get('/api/diagnostics/config')
                .expect(200);

            expect(response.body.data.integrations).toHaveProperty('platforms');
            expect(response.body.data.integrations.platforms).toHaveProperty('twitter');
            expect(response.body.data.integrations.platforms).toHaveProperty('youtube');
            expect(response.body.data.integrations.platforms).toHaveProperty('instagram');
            
            expect(response.body.data.integrations.platforms.twitter.hasBearerToken).toBe(true);
            expect(response.body.data.integrations.platforms.youtube.hasApiKey).toBe(false);
        });
    });

    describe('Production Environment Restrictions', () => {
        beforeEach(() => {
            // Mock production environment
            jest.doMock('../../../src/config/env', () => ({
                ...jest.requireActual('../../../src/config/env'),
                IS_DEVELOPMENT: false,
                NODE_ENV: 'production'
            }));
        });

        afterEach(() => {
            jest.resetModules();
        });

        it('should return 404 for diagnostics routes in production', async () => {
            // Re-import with production mock
            const diagnosticsRoutes = require('../../../src/routes/diagnostics');
            const prodApp = express();
            prodApp.use(express.json());
            prodApp.use('/api/diagnostics', diagnosticsRoutes);

            const response = await request(prodApp)
                .get('/api/diagnostics/env')
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Endpoint not available in production');
        });

        it('should return 404 for health check in production', async () => {
            const diagnosticsRoutes = require('../../../src/routes/diagnostics');
            const prodApp = express();
            prodApp.use(express.json());
            prodApp.use('/api/diagnostics', diagnosticsRoutes);

            const response = await request(prodApp)
                .get('/api/diagnostics/health')
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Endpoint not available in production');
        });

        it('should return 404 for config endpoint in production', async () => {
            const diagnosticsRoutes = require('../../../src/routes/diagnostics');
            const prodApp = express();
            prodApp.use(express.json());
            prodApp.use('/api/diagnostics', diagnosticsRoutes);

            const response = await request(prodApp)
                .get('/api/diagnostics/config')
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Endpoint not available in production');
        });
    });

    describe('Health Check Logic', () => {
        it('should report healthy status when all critical services configured', async () => {
            const response = await request(app)
                .get('/api/diagnostics/health')
                .expect(200);

            expect(response.body.data.status).toBe('healthy');
            expect(response.body.data.checks.supabase.configured).toBe(true);
        });

        it('should report unhealthy status when critical services missing', async () => {
            // Mock missing critical services
            jest.doMock('../../../src/config/env', () => ({
                ...jest.requireActual('../../../src/config/env'),
                database: {
                    SUPABASE_URL: '',
                    SUPABASE_SERVICE_KEY: ''
                }
            }));

            // Need to re-require the route to pick up new mock
            jest.resetModules();
            const diagnosticsRoutes = require('../../../src/routes/diagnostics');
            
            const testApp = express();
            testApp.use(express.json());
            testApp.use('/api/diagnostics', diagnosticsRoutes);

            const response = await request(testApp)
                .get('/api/diagnostics/health')
                .expect(200);

            expect(response.body.data.status).toBe('unhealthy');
            expect(response.body.data.checks.supabase.configured).toBe(false);
        });
    });

    describe('Error Handling', () => {
        it('should handle errors in diagnostics endpoint gracefully', async () => {
            // Mock getDiagnostics to throw an error
            const { getDiagnostics } = require('../../../src/config/env');
            getDiagnostics.mockImplementationOnce(() => {
                throw new Error('Diagnostics error');
            });

            const response = await request(app)
                .get('/api/diagnostics/env')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Error al obtener diagnósticos');
            expect(response.body.details).toBe('Diagnostics error');
        });

        it('should handle errors in health endpoint gracefully', async () => {
            // Mock environment to throw error
            jest.doMock('../../../src/config/env', () => {
                throw new Error('Config error');
            });

            // Re-import to trigger error
            jest.resetModules();

            const response = await request(app)
                .get('/api/diagnostics/health')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Error en health check');
        });

        it('should handle errors in config endpoint gracefully', async () => {
            // Mock ENV_CONFIG to be undefined
            jest.doMock('../../../src/config/env', () => ({
                IS_DEVELOPMENT: true,
                ENV_CONFIG: undefined
            }));

            jest.resetModules();

            const response = await request(app)
                .get('/api/diagnostics/config')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Error al obtener configuración');
        });
    });

    describe('Response Format Validation', () => {
        it('should return properly formatted timestamps', async () => {
            const response = await request(app)
                .get('/api/diagnostics/env')
                .expect(200);

            const timestamp = new Date(response.body.timestamp);
            expect(timestamp).toBeInstanceOf(Date);
            expect(timestamp.getTime()).not.toBeNaN();
        });

        it('should include all required fields in health response', async () => {
            const response = await request(app)
                .get('/api/diagnostics/health')
                .expect(200);

            const data = response.body.data;
            expect(data).toHaveProperty('status');
            expect(data).toHaveProperty('timestamp');
            expect(data).toHaveProperty('environment');
            expect(data).toHaveProperty('checks');
            
            expect(['healthy', 'unhealthy']).toContain(data.status);
            expect(typeof data.environment).toBe('string');
            expect(typeof data.checks).toBe('object');
        });

        it('should sanitize sensitive information in config endpoint', async () => {
            const response = await request(app)
                .get('/api/diagnostics/config')
                .expect(200);

            const data = response.body.data;
            
            // Verificar que no hay claves secretas expuestas
            const sensitiveKeys = [
                'SUPABASE_SERVICE_KEY',
                'STRIPE_SECRET_KEY',
                'OPENAI_API_KEY',
                'TWITTER_ACCESS_TOKEN',
                'TWITTER_ACCESS_SECRET'
            ];
            
            const dataStr = JSON.stringify(data);
            sensitiveKeys.forEach(key => {
                expect(dataStr).not.toContain(key);
            });
            
            // Verificar que sí hay indicadores de configuración
            expect(data.database.hasSupabaseUrl).toBeDefined();
            expect(data.stripe.hasSecretKey).toBeDefined();
            expect(data.ai.hasOpenAI).toBeDefined();
        });
    });
});