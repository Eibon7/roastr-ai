/**
 * Tests for Roast Validation Endpoint - SPEC 8 Issue #364
 * POST /api/roast/:id/validate
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('../../../src/services/styleValidator');
jest.mock('../../../src/config/supabase');
jest.mock('../../../src/services/planService');
jest.mock('../../../src/utils/logger');

const StyleValidator = require('../../../src/services/styleValidator');
const { supabaseServiceClient } = require('../../../src/config/supabase');
const { getPlanFeatures } = require('../../../src/services/planService');
const { logger } = require('../../../src/utils/logger');

// Mock middleware
const mockAuthenticateToken = jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id', orgId: 'test-org-id' };
    next();
});

const mockRoastRateLimit = jest.fn((req, res, next) => next());

jest.mock('../../../src/middleware/auth', () => ({
    authenticateToken: mockAuthenticateToken,
    optionalAuth: jest.fn((req, res, next) => next())
}));

jest.mock('../../../src/middleware/roastRateLimiter', () => ({
    createRoastRateLimiter: () => mockRoastRateLimit
}));

// Mock express-rate-limit
jest.mock('express-rate-limit', () => {
    return jest.fn(() => (req, res, next) => next());
});

jest.mock('../../../src/config/validationConstants', () => ({
    VALIDATION_CONSTANTS: {
        MAX_COMMENT_LENGTH: 2000,
        MIN_COMMENT_LENGTH: 1,
        VALID_LANGUAGES: ['es', 'en'],
        VALID_PLATFORMS: ['twitter', 'instagram', 'facebook'],
        VALID_STYLES: {
            es: ['flanders', 'balanceado', 'canalla'],
            en: ['light', 'balanced', 'savage']
        },
        MIN_INTENSITY: 1,
        MAX_INTENSITY: 5,
        DEFAULTS: {
            STYLE: 'balanceado'
        }
    },
    isValidStyle: jest.fn(() => true),
    isValidLanguage: jest.fn(() => true),
    isValidPlatform: jest.fn(() => true),
    normalizeLanguage: jest.fn((lang) => lang || 'es'),
    normalizeStyle: jest.fn((style) => style || 'balanceado'),
    normalizePlatform: jest.fn((platform) => platform || 'twitter'),
    getValidStylesForLanguage: jest.fn(() => ['flanders', 'balanceado', 'canalla'])
}));

describe('POST /api/roast/:id/validate - SPEC 8 Issue #364', () => {
    let app;
    let mockValidator;
    let mockRpc;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Setup express app
        app = express();
        app.use(express.json());

        // Mock StyleValidator
        mockValidator = {
            validate: jest.fn()
        };
        StyleValidator.mockImplementation(() => mockValidator);

        // Mock Supabase RPC function
        mockRpc = jest.fn();
        supabaseServiceClient.rpc = mockRpc;
        supabaseServiceClient.from = jest.fn().mockReturnThis();
        supabaseServiceClient.insert = jest.fn().mockResolvedValue({ data: null, error: null });
        supabaseServiceClient.select = jest.fn().mockReturnThis();
        supabaseServiceClient.eq = jest.fn().mockReturnThis();
        supabaseServiceClient.single = jest.fn().mockResolvedValue({
            data: { plan: 'pro', status: 'active' },
            error: null
        });

        // Mock plan features
        getPlanFeatures.mockReturnValue({
            limits: { roastsPerMonth: 1000 }
        });

        // Mock logger
        logger.info = jest.fn();
        logger.error = jest.fn();
        logger.warn = jest.fn();

        // Import and setup routes after mocks
        const roastRoutes = require('../../../src/routes/roast');
        app.use('/api/roast', roastRoutes);
    });

    describe('Basic Request Validation', () => {
        it('should reject request without authentication', async () => {
            // Remove auth mock temporarily
            mockAuthenticateToken.mockImplementation((req, res, next) => {
                res.status(401).json({ error: 'Unauthorized' });
            });

            const response = await request(app)
                .post('/api/roast/test-roast-id/validate')
                .send({ text: 'Valid roast text' });

            expect(response.status).toBe(401);
        });

        it('should reject request without text', async () => {
            const response = await request(app)
                .post('/api/roast/test-roast-id/validate')
                .send({ platform: 'twitter' });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Text is required and must be a string');
        });

        it('should reject request with invalid text type', async () => {
            const response = await request(app)
                .post('/api/roast/test-roast-id/validate')
                .send({ text: 123, platform: 'twitter' });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Text is required and must be a string');
        });

        it('should reject request without roast ID', async () => {
            const response = await request(app)
                .post('/api/roast//validate')
                .send({ text: 'Valid text' });

            expect(response.status).toBe(404); // Route not found
        });

        it('should use default platform if not provided', async () => {
            // Mock successful credit consumption
            mockRpc.mockResolvedValue({
                data: {
                    success: true,
                    hasCredits: true,
                    remaining: 999,
                    limit: 1000,
                    used: 1,
                    unlimited: false
                },
                error: null
            });

            // Mock successful validation
            mockValidator.validate.mockReturnValue({
                valid: true,
                errors: [],
                warnings: [],
                metadata: { textLength: 10, validationTime: 50 }
            });

            const response = await request(app)
                .post('/api/roast/test-roast-id/validate')
                .send({ text: 'Valid text' });

            expect(response.status).toBe(200);
            expect(mockValidator.validate).toHaveBeenCalledWith('Valid text', 'twitter');
        });
    });

    describe('Credit Consumption', () => {
        it('should consume 1 credit before validation', async () => {
            // Mock successful credit consumption
            mockRpc.mockResolvedValue({
                data: {
                    success: true,
                    hasCredits: true,
                    remaining: 999,
                    limit: 1000,
                    used: 1,
                    unlimited: false
                },
                error: null
            });

            // Mock successful validation
            mockValidator.validate.mockReturnValue({
                valid: true,
                errors: [],
                warnings: [],
                metadata: { textLength: 10, validationTime: 50 }
            });

            const response = await request(app)
                .post('/api/roast/test-roast-id/validate')
                .send({ text: 'Valid roast text', platform: 'twitter' });

            expect(response.status).toBe(200);
            expect(mockRpc).toHaveBeenCalledWith('consume_roast_credits', {
                p_user_id: 'test-user-id',
                p_plan: 'pro',
                p_monthly_limit: 1000,
                p_metadata: {
                    method: 'style_validation',
                    roastId: 'test-roast-id',
                    platform: 'twitter',
                    textLength: 16,
                    timestamp: expect.any(String)
                }
            });
        });

        it('should return 402 when insufficient credits', async () => {
            // Mock credit consumption failure
            mockRpc.mockResolvedValue({
                data: {
                    success: false,
                    hasCredits: false,
                    remaining: 0,
                    limit: 1000,
                    used: 1000,
                    unlimited: false
                },
                error: null
            });

            const response = await request(app)
                .post('/api/roast/test-roast-id/validate')
                .send({ text: 'Valid roast text', platform: 'twitter' });

            expect(response.status).toBe(402);
            expect(response.body.error).toBe('Insufficient credits for validation');
            expect(response.body.details.remaining).toBe(0);
            expect(response.body.details.limit).toBe(1000);
        });

        it('should consume credit regardless of validation result', async () => {
            // Mock successful credit consumption
            mockRpc.mockResolvedValue({
                data: {
                    success: true,
                    hasCredits: true,
                    remaining: 999,
                    limit: 1000,
                    used: 1,
                    unlimited: false
                },
                error: null
            });

            // Mock validation failure
            mockValidator.validate.mockReturnValue({
                valid: false,
                errors: [{ rule: 'NO_EMPTY_TEXT', message: 'El Roast no puede estar vacío' }],
                warnings: [],
                metadata: { textLength: 0, validationTime: 25 }
            });

            const response = await request(app)
                .post('/api/roast/test-roast-id/validate')
                .send({ text: '', platform: 'twitter' });

            expect(response.status).toBe(200); // Still successful, just invalid
            expect(response.body.success).toBe(true);
            expect(response.body.data.validation.valid).toBe(false);
            expect(response.body.data.credits.consumed).toBe(1);
            expect(mockRpc).toHaveBeenCalled(); // Credit was consumed
        });
    });

    describe('Validation Logic', () => {
        beforeEach(() => {
            // Mock successful credit consumption for all validation tests
            mockRpc.mockResolvedValue({
                data: {
                    success: true,
                    hasCredits: true,
                    remaining: 999,
                    limit: 1000,
                    used: 1,
                    unlimited: false
                },
                error: null
            });
        });

        it('should return successful validation result', async () => {
            mockValidator.validate.mockReturnValue({
                valid: true,
                errors: [],
                warnings: [],
                metadata: { textLength: 20, validationTime: 50 }
            });

            const response = await request(app)
                .post('/api/roast/test-roast-id/validate')
                .send({ text: 'Valid roast content', platform: 'instagram' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.roastId).toBe('test-roast-id');
            expect(response.body.data.platform).toBe('instagram');
            expect(response.body.data.validation.valid).toBe(true);
            expect(response.body.data.validation.errors).toHaveLength(0);
            expect(response.body.data.validation.warnings).toHaveLength(0);
        });

        it('should return validation failure with errors', async () => {
            mockValidator.validate.mockReturnValue({
                valid: false,
                errors: [
                    { rule: 'CHARACTER_LIMIT', message: 'Tu Roast supera el límite de 280 caracteres' },
                    { rule: 'NO_SPAM', message: 'El Roast no puede ser spam' }
                ],
                warnings: [],
                metadata: { textLength: 300, validationTime: 75 }
            });

            const response = await request(app)
                .post('/api/roast/test-roast-id/validate')
                .send({ text: 'a'.repeat(300), platform: 'twitter' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.validation.valid).toBe(false);
            expect(response.body.data.validation.errors).toHaveLength(2);
            expect(response.body.data.validation.errors[0].rule).toBe('CHARACTER_LIMIT');
            expect(response.body.data.validation.errors[1].rule).toBe('NO_SPAM');
        });

        it('should return validation warnings', async () => {
            mockValidator.validate.mockReturnValue({
                valid: true,
                errors: [],
                warnings: [
                    { rule: 'STYLE_WARNING', message: 'Consider improving the style' }
                ],
                metadata: { textLength: 50, validationTime: 30 }
            });

            const response = await request(app)
                .post('/api/roast/test-roast-id/validate')
                .send({ text: 'Roast with warnings', platform: 'twitter' });

            expect(response.status).toBe(200);
            expect(response.body.data.validation.warnings).toHaveLength(1);
            expect(response.body.data.validation.warnings[0].message).toBe('Consider improving the style');
        });

        it('should pass correct parameters to validator', async () => {
            mockValidator.validate.mockReturnValue({
                valid: true,
                errors: [],
                warnings: [],
                metadata: { textLength: 15, validationTime: 25 }
            });

            await request(app)
                .post('/api/roast/test-roast-id/validate')
                .send({ text: 'Test roast text', platform: 'youtube' });

            expect(mockValidator.validate).toHaveBeenCalledWith('Test roast text', 'youtube');
        });
    });

    describe('Usage Recording', () => {
        beforeEach(() => {
            // Mock successful credit consumption
            mockRpc.mockResolvedValue({
                data: {
                    success: true,
                    hasCredits: true,
                    remaining: 999,
                    limit: 1000,
                    used: 1,
                    unlimited: false
                },
                error: null
            });

            mockValidator.validate.mockReturnValue({
                valid: true,
                errors: [],
                warnings: [],
                metadata: { textLength: 20, validationTime: 50 }
            });
        });

        it('should record analysis usage with GDPR-compliant metadata', async () => {
            await request(app)
                .post('/api/roast/test-roast-id/validate')
                .send({ text: 'Test roast for usage', platform: 'twitter' });

            expect(supabaseServiceClient.from).toHaveBeenCalledWith('analysis_usage');
            expect(supabaseServiceClient.insert).toHaveBeenCalledWith({
                user_id: 'test-user-id',
                count: 1,
                metadata: {
                    type: 'style_validation',
                    roastId: 'test-roast-id',
                    platform: 'twitter',
                    textLength: 19,
                    valid: true,
                    errorsCount: 0,
                    warningsCount: 0,
                    processingTimeMs: expect.any(Number)
                },
                created_at: expect.any(String)
            });
        });

        it('should continue if usage recording fails', async () => {
            // Mock usage recording failure
            supabaseServiceClient.insert.mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .post('/api/roast/test-roast-id/validate')
                .send({ text: 'Test roast', platform: 'twitter' });

            expect(response.status).toBe(200); // Should still succeed
            expect(logger.warn).toHaveBeenCalledWith('Failed to record validation usage', expect.any(Object));
        });
    });

    describe('Error Handling', () => {
        it('should handle validator initialization failure', async () => {
            // Mock credit consumption success
            mockRpc.mockResolvedValue({
                data: { success: true, hasCredits: true, remaining: 999 },
                error: null
            });

            // Mock StyleValidator constructor failure
            StyleValidator.mockImplementation(() => {
                throw new Error('Validator initialization failed');
            });

            const response = await request(app)
                .post('/api/roast/test-roast-id/validate')
                .send({ text: 'Test text', platform: 'twitter' });

            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Validation service temporarily unavailable');
        });

        it('should handle validation service errors', async () => {
            // Mock credit consumption success
            mockRpc.mockResolvedValue({
                data: { success: true, hasCredits: true, remaining: 999 },
                error: null
            });

            // Mock validator failure
            mockValidator.validate.mockImplementation(() => {
                throw new Error('Validation service error');
            });

            const response = await request(app)
                .post('/api/roast/test-roast-id/validate')
                .send({ text: 'Test text', platform: 'twitter' });

            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Validation service temporarily unavailable');
        });

        it('should handle credit consumption RPC errors', async () => {
            // Mock RPC error
            mockRpc.mockResolvedValue({
                data: null,
                error: { message: 'RPC function error' }
            });

            const response = await request(app)
                .post('/api/roast/test-roast-id/validate')
                .send({ text: 'Test text', platform: 'twitter' });

            expect(response.status).toBe(402);
            expect(response.body.error).toBe('Insufficient credits for validation');
        });

        it('should handle database connection errors', async () => {
            // Mock database connection failure
            supabaseServiceClient.single.mockRejectedValue(new Error('Database connection failed'));

            const response = await request(app)
                .post('/api/roast/test-roast-id/validate')
                .send({ text: 'Test text', platform: 'twitter' });

            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Validation service temporarily unavailable');
        });
    });

    describe('GDPR Compliance', () => {
        beforeEach(() => {
            mockRpc.mockResolvedValue({
                data: { success: true, hasCredits: true, remaining: 999 },
                error: null
            });

            mockValidator.validate.mockReturnValue({
                valid: false,
                errors: [{ rule: 'NO_SPAM', message: 'Spam detected' }],
                warnings: [],
                metadata: { textLength: 10, validationTime: 25 }
            });
        });

        it('should log only metadata, not sensitive content', async () => {
            await request(app)
                .post('/api/roast/test-roast-id/validate')
                .send({ text: 'Sensitive roast content', platform: 'twitter' });

            // Check that logger.info was called with metadata only
            expect(logger.info).toHaveBeenCalledWith('Style validation completed', expect.objectContaining({
                userId: 'test-user-id',
                roastId: 'test-roast-id',
                platform: 'twitter',
                textLength: 23,
                valid: false,
                errorsCount: 1,
                warningsCount: 0,
                processingTimeMs: expect.any(Number),
                creditsConsumed: 1,
                creditsRemaining: 999
            }));

            // Ensure no actual text content was logged
            const logCalls = logger.info.mock.calls;
            logCalls.forEach(call => {
                expect(JSON.stringify(call)).not.toContain('Sensitive roast content');
            });
        });

        it('should not include text content in usage recording', async () => {
            await request(app)
                .post('/api/roast/test-roast-id/validate')
                .send({ text: 'Private user content', platform: 'twitter' });

            const insertCall = supabaseServiceClient.insert.mock.calls[0][0];
            expect(JSON.stringify(insertCall)).not.toContain('Private user content');
            expect(insertCall.metadata.textLength).toBe(20); // Only length, not content
        });
    });

    describe('Performance', () => {
        it('should respond within reasonable time', async () => {
            mockRpc.mockResolvedValue({
                data: { success: true, hasCredits: true, remaining: 999 },
                error: null
            });

            mockValidator.validate.mockReturnValue({
                valid: true,
                errors: [],
                warnings: [],
                metadata: { textLength: 10, validationTime: 25 }
            });

            const start = Date.now();
            const response = await request(app)
                .post('/api/roast/test-roast-id/validate')
                .send({ text: 'Quick test', platform: 'twitter' });
            const end = Date.now();

            expect(response.status).toBe(200);
            expect(end - start).toBeLessThan(1000); // Less than 1 second
        });

        it('should include processing time in response', async () => {
            mockRpc.mockResolvedValue({
                data: { success: true, hasCredits: true, remaining: 999 },
                error: null
            });

            mockValidator.validate.mockReturnValue({
                valid: true,
                errors: [],
                warnings: [],
                metadata: { textLength: 10, validationTime: 25 }
            });

            const response = await request(app)
                .post('/api/roast/test-roast-id/validate')
                .send({ text: 'Timing test', platform: 'twitter' });

            expect(response.body.data.validation.metadata.processingTimeMs).toBeGreaterThan(0);
        });
    });
});