/**
 * Tests for Roast Validation Endpoint - GDPR & Performance Tests
 * POST /api/roast/:id/validate
 *
 * Issue #754: These tests are separated from roast-validation-issue364.test.js
 * to avoid Jest module cache issues. These tests modify mock state in ways that
 * cause failures when run in the same suite as other tests, but pass individually.
 *
 * Solution: Separate file ensures isolated module loading context.
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies - Issue #483: Fix StyleValidator mock as constructor (Pattern #11)
const mockValidatorInstance = {
    validate: jest.fn(),
    validateTone: jest.fn(),
    validateComment: jest.fn(),
    getToneCategory: jest.fn(),
    getCharacterLimits: jest.fn().mockReturnValue({ twitter: 280, default: 2000 }),
    normalizePlatform: jest.fn((p) => p || 'twitter')
};

jest.mock('../../../src/services/styleValidator', () => {
    return jest.fn().mockImplementation(() => mockValidatorInstance);
});
jest.mock('../../../src/config/supabase');
jest.mock('../../../src/services/planService', () => ({
    getPlanFeatures: jest.fn()
}));
jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        child: jest.fn(() => ({
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn()
        }))
    }
}));

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

describe('POST /api/roast/:id/validate - GDPR & Performance Tests', () => {
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
        mockValidator = mockValidatorInstance;

        // Mock Supabase RPC function
        mockRpc = jest.fn();
        supabaseServiceClient.rpc = mockRpc;

        // Table-aware mock - track which table is being queried
        supabaseServiceClient._currentTable = '';
        supabaseServiceClient.from = jest.fn().mockImplementation((table) => {
            supabaseServiceClient._currentTable = table;
            return supabaseServiceClient;
        });
        supabaseServiceClient.insert = jest.fn().mockResolvedValue({ data: null, error: null });
        supabaseServiceClient.select = jest.fn().mockReturnThis();
        supabaseServiceClient.eq = jest.fn().mockReturnThis();
        supabaseServiceClient.single = jest.fn().mockImplementation(() => {
            // Return different data based on which table is being queried
            if (supabaseServiceClient._currentTable === 'roasts') {
                return Promise.resolve({
                    data: { user_id: 'test-user-id', content: 'Original roast content' },
                    error: null
                });
            }
            // Default: user_subscriptions table
            return Promise.resolve({
                data: { plan: 'pro', status: 'active' },
                error: null
            });
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

    describe('GDPR Compliance', () => {
        beforeEach(() => {
            // Clear mock call history for assertions
            logger.info.mockClear();
            logger.error.mockClear();
            logger.warn.mockClear();
            supabaseServiceClient.insert.mockClear();

            // Configure mocks for these specific tests
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

            // Issue #618 - Add defensive check for mock.calls array
            // Issue #628 - CodeRabbit: Use idiomatic Jest matcher
            expect(supabaseServiceClient.insert).toHaveBeenCalled();
            const insertCall = supabaseServiceClient.insert.mock.calls[0][0];
            expect(JSON.stringify(insertCall)).not.toContain('Private user content');
            expect(insertCall.metadata.textLength).toBe(20); // Only length, not content
        });
    });

    describe('Performance', () => {
        beforeEach(() => {
            // Clear mock call history for assertions
            logger.info.mockClear();
            logger.error.mockClear();
            logger.warn.mockClear();
        });

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

            // Issue #754: Check that processingTimeMs exists and is a valid number
            // In fast test environments with instant mocks, this can be 0ms
            expect(response.body.data.validation.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
            expect(typeof response.body.data.validation.metadata.processingTimeMs).toBe('number');
        });
    });
});
