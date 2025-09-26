/**
 * Unit tests for roast API endpoints
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies BEFORE requiring the routes
jest.mock('../../../src/middleware/auth');
jest.mock('../../../src/config/flags', () => ({
    flags: {
        isEnabled: jest.fn().mockReturnValue(false)
    }
}));
jest.mock('../../../src/services/roastGeneratorEnhanced');
jest.mock('../../../src/services/roastGeneratorMock', () => {
    return jest.fn().mockImplementation(() => ({
        generateRoast: jest.fn().mockResolvedValue({
            roast: 'Mocked roast response',
            metadata: {
                tone: 'sarcastic',
                intensity: 3,
                humorType: 'witty',
                preview: false,
                plan: 'free'
            }
        })
    }));
});
jest.mock('../../../src/services/roastEngine');
jest.mock('../../../src/services/perspectiveService');
jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
        update: jest.fn().mockResolvedValue({ data: {}, error: null })
    }
}));
jest.mock('../../../src/services/planService', () => ({
    getPlanFeatures: jest.fn().mockReturnValue({
        limits: {
            roastsPerMonth: 100
        }
    })
}));
jest.mock('../../../src/config/validationConstants', () => ({
    VALIDATION_CONSTANTS: {
        MAX_COMMENT_LENGTH: 2000,
        VALID_TONES: ['sarcastic', 'witty', 'dry', 'playful'],
        VALID_HUMOR_TYPES: ['witty', 'sarcastic', 'dry', 'playful'],
        MIN_INTENSITY: 1,
        MAX_INTENSITY: 5,
        VALID_PLATFORMS: ['twitter', 'youtube', 'instagram', 'facebook']
    },
    isValidStyle: jest.fn().mockReturnValue(true),
    isValidLanguage: jest.fn().mockReturnValue(true),
    isValidPlatform: jest.fn().mockReturnValue(true),
    normalizeLanguage: jest.fn(x => x),
    normalizeStyle: jest.fn(x => x),
    normalizePlatform: jest.fn(x => x),
    getValidStylesForLanguage: jest.fn().mockReturnValue(['sarcastic', 'witty'])
}));
jest.mock('../../../src/middleware/roastRateLimiter', () => ({
    createRoastRateLimiter: jest.fn().mockReturnValue((req, res, next) => next())
}));
jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

// Now require the modules after mocking
const roastRoutes = require('../../../src/routes/roast');
const { authenticateToken } = require('../../../src/middleware/auth');
const { flags } = require('../../../src/config/flags');

describe('Roast API Unit Tests', () => {
    let app;
    let mockUser;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup express app
        app = express();
        app.use(express.json());
        app.use('/api/roast', roastRoutes);

        // Mock user
        mockUser = {
            id: 'test-user-123',
            email: 'test@example.com'
        };

        // Mock authentication middleware
        authenticateToken.mockImplementation((req, res, next) => {
            req.user = mockUser;
            next();
        });

        // Mock flags
        flags.isEnabled.mockImplementation((flag) => {
            switch (flag) {
                case 'ENABLE_REAL_OPENAI':
                    return false; // Use mock by default
                case 'ENABLE_PERSPECTIVE_API':
                    return false; // Use mock by default
                case 'ENABLE_RATE_LIMIT':
                    return false; // Disable rate limiting for tests
                default:
                    return false;
            }
        });
    });

    describe('POST /api/roast/preview', () => {
        it.skip('should generate a roast preview successfully', async () => {
            const response = await request(app)
                .post('/api/roast/preview')
                .send({
                    text: 'This is a test message',
                    tone: 'sarcastic',
                    intensity: 3,
                    humorType: 'witty'
                });

            // Always log the response for debugging
            console.log('Response status:', response.status);
            console.log('Response body:', response.body);
            if (response.status !== 200) {
                console.log('Response text:', response.text);
            }

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                success: true,
                data: {
                    roast: expect.any(String),
                    metadata: {
                        tone: 'sarcastic',
                        intensity: 3,
                        humorType: 'witty',
                        preview: true,
                        plan: expect.any(String)
                    }
                },
                timestamp: expect.any(String)
            });
        });

        it.skip('should validate required text parameter', async () => {
            const response = await request(app)
                .post('/api/roast/preview')
                .send({
                    tone: 'sarcastic'
                });

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                success: false,
                error: 'Validation failed',
                details: expect.arrayContaining([
                    expect.stringContaining('Text is required')
                ])
            });
        });

        it.skip('should validate text length', async () => {
            const longText = 'a'.repeat(2001);
            const response = await request(app)
                .post('/api/roast/preview')
                .send({
                    text: longText
                });

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                success: false,
                error: 'Validation failed',
                details: expect.arrayContaining([
                    expect.stringContaining('less than 2000 characters')
                ])
            });
        });

        it.skip('should validate tone parameter', async () => {
            const response = await request(app)
                .post('/api/roast/preview')
                .send({
                    text: 'Test message',
                    tone: 'invalid-tone'
                });

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                success: false,
                error: 'Validation failed',
                details: expect.arrayContaining([
                    expect.stringContaining('Tone must be one of')
                ])
            });
        });

        it.skip('should validate intensity parameter', async () => {
            const response = await request(app)
                .post('/api/roast/preview')
                .send({
                    text: 'Test message',
                    intensity: 10
                });

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                success: false,
                error: 'Validation failed',
                details: expect.arrayContaining([
                    expect.stringContaining('Intensity must be a number between 1 and 5')
                ])
            });
        });

        it.skip('should handle empty text', async () => {
            const response = await request(app)
                .post('/api/roast/preview')
                .send({
                    text: '   '
                });

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                success: false,
                error: 'Validation failed',
                details: expect.arrayContaining([
                    expect.stringContaining('Text cannot be empty')
                ])
            });
        });

        it.skip('should use default values for optional parameters', async () => {
            const response = await request(app)
                .post('/api/roast/preview')
                .send({
                    text: 'Test message'
                });

            expect(response.status).toBe(200);
            expect(response.body.data.metadata).toMatchObject({
                tone: 'sarcastic',
                intensity: 3,
                humorType: 'witty'
            });
        });
    });

    describe('POST /api/roast/generate', () => {
        it.skip('should generate a roast and consume credits', async () => {
            const response = await request(app)
                .post('/api/roast/generate')
                .send({
                    text: 'This is a test message',
                    tone: 'witty'
                });

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                success: true,
                data: {
                    roast: expect.any(String),
                    metadata: {
                        tone: 'witty',
                        preview: false
                    },
                    credits: {
                        remaining: expect.any(Number),
                        limit: expect.any(Number),
                        used: expect.any(Number)
                    }
                }
            });
        });

        it.skip('should validate request parameters same as preview', async () => {
            const response = await request(app)
                .post('/api/roast/generate')
                .send({
                    tone: 'sarcastic'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/roast/credits', () => {
        it('should return user credit status', async () => {
            const response = await request(app)
                .get('/api/roast/credits');

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                success: true,
                data: {
                    plan: expect.any(String),
                    status: expect.any(String),
                    credits: {
                        remaining: expect.any(Number),
                        limit: expect.any(Number),
                        unlimited: expect.any(Boolean)
                    }
                }
            });
        });
    });

    describe('Authentication', () => {
        it('should require authentication for all endpoints', async () => {
            // Mock authentication failure
            authenticateToken.mockImplementation((req, res, next) => {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            });

            const endpoints = [
                { method: 'post', path: '/api/roast/preview' },
                { method: 'post', path: '/api/roast/generate' },
                { method: 'get', path: '/api/roast/credits' }
            ];

            for (const endpoint of endpoints) {
                const response = await request(app)[endpoint.method](endpoint.path)
                    .send({ text: 'test' });

                expect(response.status).toBe(401);
                expect(response.body).toMatchObject({
                    success: false,
                    error: 'Authentication required'
                });
            }
        });
    });
});

module.exports = {};
