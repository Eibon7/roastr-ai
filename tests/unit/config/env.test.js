/**
 * Tests unitarios para el sistema de configuración de entorno
 */

const fs = require('fs');
const path = require('path');

// Mock filesystem y process.env antes de importar
jest.mock('fs');
jest.mock('path');

describe('Environment Configuration System', () => {
    let originalEnv;
    let envConfig;
    
    beforeEach(() => {
        // Guardar entorno original
        originalEnv = { ...process.env };
        
        // Limpiar process.env para tests
        Object.keys(process.env).forEach(key => {
            if (key.startsWith('NODE_ENV') || 
                key.startsWith('VERCEL') || 
                key.startsWith('SUPABASE_') ||
                key.startsWith('STRIPE_') ||
                key.startsWith('OPENAI_')) {
                delete process.env[key];
            }
        });
        
        // Limpiar require cache
        jest.resetModules();
        
        // Mock dotenv
        jest.doMock('dotenv', () => ({
            config: jest.fn()
        }));
    });
    
    afterEach(() => {
        // Restaurar entorno original
        process.env = { ...originalEnv };
        jest.clearAllMocks();
        jest.resetModules();
    });
    
    describe('Environment Detection', () => {
        it('should detect development environment correctly', () => {
            process.env.NODE_ENV = 'development';
            
            const { NODE_ENV, IS_DEVELOPMENT, IS_PRODUCTION, IS_VERCEL } = require('../../../src/config/env');
            
            expect(NODE_ENV).toBe('development');
            expect(IS_DEVELOPMENT).toBe(true);
            expect(IS_PRODUCTION).toBe(false);
            expect(IS_VERCEL).toBe(false);
        });
        
        it('should detect production environment correctly', () => {
            process.env.NODE_ENV = 'production';
            
            const { NODE_ENV, IS_DEVELOPMENT, IS_PRODUCTION, IS_VERCEL } = require('../../../src/config/env');
            
            expect(NODE_ENV).toBe('production');
            expect(IS_DEVELOPMENT).toBe(false);
            expect(IS_PRODUCTION).toBe(true);
            expect(IS_VERCEL).toBe(false);
        });
        
        it('should detect Vercel environment correctly', () => {
            process.env.NODE_ENV = 'production';
            process.env.VERCEL = '1';
            
            const { NODE_ENV, IS_DEVELOPMENT, IS_PRODUCTION, IS_VERCEL } = require('../../../src/config/env');
            
            expect(NODE_ENV).toBe('production');
            expect(IS_DEVELOPMENT).toBe(false);
            expect(IS_PRODUCTION).toBe(true);
            expect(IS_VERCEL).toBe(true);
        });
        
        it('should default to development when NODE_ENV is not set', () => {
            // NODE_ENV no está configurado
            
            const { NODE_ENV, IS_DEVELOPMENT } = require('../../../src/config/env');
            
            expect(NODE_ENV).toBe('development');
            expect(IS_DEVELOPMENT).toBe(true);
        });
    });
    
    describe('File Loading Logic', () => {
        beforeEach(() => {
            // Mock path.join para devolver rutas predecibles
            path.join.mockImplementation((...parts) => parts.join('/'));
            
            // Mock fs.existsSync
            fs.existsSync = jest.fn();
        });
        
        it('should load .env.local in development mode', () => {
            process.env.NODE_ENV = 'development';
            fs.existsSync.mockReturnValue(true);
            
            const dotenv = require('dotenv');
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            
            // Importar el módulo después de configurar mocks
            require('../../../src/config/env');
            
            expect(dotenv.config).toHaveBeenCalledWith({ 
                path: expect.stringContaining('.env.local') 
            });
            
            consoleSpy.mockRestore();
        });
        
        it('should load .env.production in production mode', () => {
            process.env.NODE_ENV = 'production';
            fs.existsSync.mockReturnValue(true);
            
            const dotenv = require('dotenv');
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            
            require('../../../src/config/env');
            
            expect(dotenv.config).toHaveBeenCalledWith({ 
                path: expect.stringContaining('.env.production') 
            });
            
            consoleSpy.mockRestore();
        });
        
        it('should not load files in Vercel environment', () => {
            process.env.NODE_ENV = 'production';
            process.env.VERCEL = '1';
            
            const dotenv = require('dotenv');
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            
            require('../../../src/config/env');
            
            expect(dotenv.config).not.toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Vercel'));
            
            consoleSpy.mockRestore();
        });
        
        it('should fallback to .env when specific file does not exist', () => {
            process.env.NODE_ENV = 'development';
            
            // .env.local no existe, pero .env sí
            fs.existsSync.mockImplementation((filePath) => {
                return filePath.includes('.env') && !filePath.includes('.env.local');
            });
            
            const dotenv = require('dotenv');
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            
            require('../../../src/config/env');
            
            expect(dotenv.config).toHaveBeenCalledWith({ 
                path: expect.stringContaining('.env') 
            });
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('no encontrado'));
            
            consoleSpy.mockRestore();
            consoleLogSpy.mockRestore();
        });
    });
    
    describe('Configuration Structure', () => {
        beforeEach(() => {
            // Configurar variables de entorno para tests
            process.env.NODE_ENV = 'development';
            process.env.PORT = '3000';
            process.env.SUPABASE_URL = 'https://test.supabase.co';
            process.env.STRIPE_SECRET_KEY = 'sk_test_123';
            process.env.OPENAI_API_KEY = 'sk-test-openai-123';
            
            // Mock fs para evitar cargar archivos reales
            fs.existsSync.mockReturnValue(false);
        });
        
        it('should provide complete ENV_CONFIG structure', () => {
            const { ENV_CONFIG } = require('../../../src/config/env');
            
            expect(ENV_CONFIG).toHaveProperty('environment');
            expect(ENV_CONFIG).toHaveProperty('database');
            expect(ENV_CONFIG).toHaveProperty('ai');
            expect(ENV_CONFIG).toHaveProperty('stripe');
            expect(ENV_CONFIG).toHaveProperty('integrations');
            expect(ENV_CONFIG).toHaveProperty('app');
            expect(ENV_CONFIG).toHaveProperty('logging');
        });
        
        it('should correctly map environment variables to config sections', () => {
            const { ENV_CONFIG } = require('../../../src/config/env');
            
            expect(ENV_CONFIG.environment.NODE_ENV).toBe('development');
            expect(ENV_CONFIG.environment.PORT).toBe(3000);
            expect(ENV_CONFIG.database.SUPABASE_URL).toBe('https://test.supabase.co');
            expect(ENV_CONFIG.stripe.STRIPE_SECRET_KEY).toBe('sk_test_123');
            expect(ENV_CONFIG.ai.OPENAI_API_KEY).toBe('sk-test-openai-123');
        });
        
        it('should provide default values when env vars are not set', () => {
            // Limpiar todas las variables
            Object.keys(process.env).forEach(key => delete process.env[key]);
            process.env.NODE_ENV = 'development';
            
            const { ENV_CONFIG } = require('../../../src/config/env');
            
            expect(ENV_CONFIG.environment.PORT).toBe(3000);
            expect(ENV_CONFIG.stripe.STRIPE_PRICE_LOOKUP_FREE).toBe('plan_free_monthly');
            expect(ENV_CONFIG.integrations.INTEGRATIONS_ENABLED).toBe('twitter,youtube,bluesky');
        });
    });
    
    describe('Validation Logic', () => {
        let consoleSpy, consoleErrorSpy, consoleWarnSpy;
        
        beforeEach(() => {
            consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            fs.existsSync.mockReturnValue(false);
        });
        
        afterEach(() => {
            consoleSpy.mockRestore();
            consoleErrorSpy.mockRestore();
            consoleWarnSpy.mockRestore();
        });
        
        it('should validate critical variables in production', () => {
            process.env.NODE_ENV = 'production';
            // Temporarily disable test skip for this test
            delete process.env.JEST_WORKER_ID;
            
            // Mock console.error to prevent actual error output
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            
            expect(() => {
                require('../../../src/config/env');
            }).toThrow(expect.stringContaining('Configuración inválida'));
            
            consoleErrorSpy.mockRestore();
        });
        
        it('should not throw in development with missing variables', () => {
            process.env.NODE_ENV = 'development';
            
            expect(() => {
                require('../../../src/config/env');
            }).not.toThrow();
        });
        
        it('should validate billing configuration when enabled', () => {
            process.env.NODE_ENV = 'development';
            process.env.BILLING_ENABLED = 'true';
            // No configurar STRIPE_SECRET_KEY
            
            require('../../../src/config/env');
            
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('STRIPE_SECRET_KEY'));
        });
        
        it('should show warnings for missing integration credentials', () => {
            process.env.NODE_ENV = 'development';
            process.env.INTEGRATIONS_ENABLED = 'twitter';
            // No configurar credenciales de Twitter
            
            require('../../../src/config/env');
            
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Twitter'));
        });
        
        it('should pass validation with all required variables', () => {
            process.env.NODE_ENV = 'development';
            process.env.SUPABASE_URL = 'https://test.supabase.co';
            process.env.SUPABASE_SERVICE_KEY = 'service_key';
            process.env.OPENAI_API_KEY = 'sk-openai-123';
            process.env.BILLING_ENABLED = 'true';
            process.env.STRIPE_SECRET_KEY = 'sk_test_123';
            process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123';
            
            require('../../../src/config/env');
            
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('validada correctamente'));
        });
    });
    
    describe('Diagnostics Function', () => {
        beforeEach(() => {
            fs.existsSync.mockReturnValue(false);
            process.env.NODE_ENV = 'development';
            process.env.SUPABASE_URL = 'https://test.supabase.co';
            process.env.OPENAI_API_KEY = 'sk-openai-123';
        });
        
        it('should return comprehensive diagnostics', () => {
            const { getDiagnostics } = require('../../../src/config/env');
            
            const diagnostics = getDiagnostics();
            
            expect(diagnostics).toHaveProperty('environment');
            expect(diagnostics).toHaveProperty('configStatus');
            expect(diagnostics).toHaveProperty('urls');
            
            expect(diagnostics.environment.NODE_ENV).toBe('development');
            expect(diagnostics.configStatus.hasSupabaseUrl).toBe(true);
            expect(diagnostics.configStatus.hasOpenAI).toBe(true);
        });
        
        it('should correctly identify missing configurations', () => {
            // Limpiar variables
            delete process.env.SUPABASE_URL;
            delete process.env.OPENAI_API_KEY;
            
            const { getDiagnostics } = require('../../../src/config/env');
            
            const diagnostics = getDiagnostics();
            
            expect(diagnostics.configStatus.hasSupabaseUrl).toBe(false);
            expect(diagnostics.configStatus.hasOpenAI).toBe(false);
        });
    });
    
    describe('Direct Access Properties', () => {
        beforeEach(() => {
            fs.existsSync.mockReturnValue(false);
            process.env.NODE_ENV = 'development';
            process.env.SUPABASE_URL = 'https://test.supabase.co';
            process.env.STRIPE_SECRET_KEY = 'sk_test_123';
        });
        
        it('should provide direct access to config sections', () => {
            const { database, stripe, ai, integrations, app, logging } = require('../../../src/config/env');
            
            expect(database).toBeDefined();
            expect(database.SUPABASE_URL).toBe('https://test.supabase.co');
            
            expect(stripe).toBeDefined();
            expect(stripe.STRIPE_SECRET_KEY).toBe('sk_test_123');
            
            expect(ai).toBeDefined();
            expect(integrations).toBeDefined();
            expect(app).toBeDefined();
            expect(logging).toBeDefined();
        });
    });
});