/**
 * Integration tests for roast API endpoints
 */

const request = require('supertest');

// IMPORTANT: Mock service dependencies BEFORE requiring the app
// Don't mock supabase - it has built-in mock mode via NODE_ENV
jest.mock('../../src/services/roastGeneratorEnhanced');
jest.mock('../../src/services/roastGeneratorMock');
jest.mock('../../src/services/perspectiveService');

// Mock logger to prevent winston module loading issues - Issue #618 Pattern #10
jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

// Now require the app - supabase will use mock mode from setupIntegration.js
const { app } = require('../../src/index');
const { supabaseServiceClient } = require('../../src/config/supabase');
const flags = require('../../src/config/flags');

describe('Roast API Integration Tests', () => {
    let mockServiceClient;
    const testUserId = 'test-user-123';
    const authToken = 'Bearer valid-token';

    beforeEach(() => {
        jest.clearAllMocks();

        // Set required environment variables
        process.env.FRONTEND_URL = 'https://test.example.com';

        // Create builder factory that can be customized per-test
        const createBuilder = (resolveValue = { data: null, error: null }) => {
            const builder = {
                select: jest.fn(),
                eq: jest.fn(),
                single: jest.fn(),
                insert: jest.fn(),
                gte: jest.fn()
            };

            builder.select.mockReturnValue(builder);
            builder.eq.mockReturnValue(builder);
            builder.gte.mockReturnValue(builder);
            builder.insert.mockReturnValue(builder);
            builder.single.mockResolvedValue(resolveValue);

            return builder;
        };

        // Mock Supabase service client with flexible builder creation
        // Issue #698: Comprehensive mocking for all tables + RPC
        mockServiceClient = {
            from: jest.fn((tableName) => {
                // Return table-specific default data (Issue #698)
                if (tableName === 'user_subscriptions') {
                    return createBuilder({
                        data: { plan: 'free', status: 'active' },
                        error: null
                    });
                }
                if (tableName === 'analysis_usage') {
                    return createBuilder({
                        data: { count: 0 },  // No usage by default
                        error: null
                    });
                }
                if (tableName === 'roast_usage') {
                    return createBuilder({
                        data: { count: 0 },  // No usage by default
                        error: null
                    });
                }
                // Default for unknown tables
                return createBuilder({ data: null, error: null });
            }),
            rpc: jest.fn((functionName, params) => {
                // Issue #698: Mock RPC calls for stored procedures
                if (functionName === 'consume_roast_credits') {
                    return Promise.resolve({
                        data: {
                            success: true,
                            hasCredits: true,
                            remaining: 45,
                            limit: 50,
                            used: 5,
                            unlimited: false
                        },
                        error: null
                    });
                }
                // Default: RPC not mocked
                return Promise.resolve({
                    data: null,
                    error: { message: `RPC ${functionName} not mocked` }
                });
            }),
            _createBuilder: createBuilder // Expose for test use
        };

        require('../../src/config/supabase').supabaseServiceClient = mockServiceClient;

        // Mock flags - Issue #698: Enable PerspectiveService so mocks work
        flags.isEnabled = jest.fn().mockImplementation((flag) => {
            switch (flag) {
                case 'ENABLE_REAL_OPENAI':
                    return false; // Use mock generator
                case 'ENABLE_PERSPECTIVE_API':
                    return true; // Enable to allow perspective mocks to work (Issue #698)
                case 'ENABLE_RATE_LIMIT':
                    return false; // Disable rate limiting for tests
                default:
                    return false;
            }
        });

        // Mock roast generators with default implementations
        const RoastGeneratorMock = require('../../src/services/roastGeneratorMock');
        RoastGeneratorMock.prototype.generateRoast = jest.fn().mockResolvedValue({
            roast: 'This is a mock roast response for testing purposes.',
            metadata: {
                processingTimeMs: 50,
                model: 'mock',
                tokensUsed: 0
            }
        });

        const RoastGeneratorEnhanced = require('../../src/services/roastGeneratorEnhanced');
        RoastGeneratorEnhanced.prototype.generateRoast = jest.fn().mockResolvedValue({
            roast: 'This is a mock enhanced roast response.',
            metadata: {
                processingTimeMs: 100,
                model: 'mock-enhanced',
                tokensUsed: 0
            }
        });

        // Mock perspective service with default safe response
        const PerspectiveService = require('../../src/services/perspectiveService');
        PerspectiveService.prototype.analyzeText = jest.fn().mockResolvedValue({
            toxicity: 0.1,
            safe: true,
            categories: []
        });

        // Authentication is handled by built-in mock mode from setupIntegration.js
        // getUserFromToken() returns mock user when NODE_ENV=test
    });

    describe('POST /api/roast/preview', () => {
        it('should generate roast preview successfully', async () => {
            // Mock database calls - Issue #698: Mock ALL tables needed
            mockServiceClient.from = jest.fn((tableName) => {
                if (tableName === 'user_subscriptions') {
                    return mockServiceClient._createBuilder({
                        data: { plan: 'creator', status: 'active' },
                        error: null
                    });
                }
                if (tableName === 'analysis_usage') {
                    return mockServiceClient._createBuilder({
                        data: { count: 5 },  // Low usage
                        error: null
                    });
                }
                if (tableName === 'roast_usage') {
                    return mockServiceClient._createBuilder({
                        data: { count: 10 },  // Some usage
                        error: null
                    });
                }
                return mockServiceClient._createBuilder({ data: null, error: null });
            });

            const response = await request(app)
                .post('/api/roast/preview')
                .set('Authorization', authToken)
                .send({
                    text: 'This is a test message for roasting',
                    tone: 'sarcastic',
                    intensity: 3,
                    humorType: 'witty'
                });

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
                        safe: true,
                        plan: 'creator'
                    }
                },
                timestamp: expect.any(String)
            });

            // Verify roast content
            expect(response.body.data.roast.length).toBeGreaterThan(10);
            expect(response.body.data.metadata.toxicityScore).toBeDefined();
            expect(response.body.data.metadata.processingTimeMs).toBeDefined();
        });

        it('should handle validation errors', async () => {
            const response = await request(app)
                .post('/api/roast/preview')
                .set('Authorization', authToken)
                .send({
                    text: '', // Empty text
                    tone: 'invalid-tone'
                });

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                success: false,
                error: 'Validation failed',
                details: expect.arrayContaining([
                    expect.stringContaining('Text cannot be empty'),
                    expect.stringContaining('Tone must be one of')
                ])
            });
        });

        it('should reject high toxicity content', async () => {
            // Mock database calls - Issue #698: Mock ALL tables needed
            mockServiceClient.from = jest.fn((tableName) => {
                if (tableName === 'user_subscriptions') {
                    return mockServiceClient._createBuilder({
                        data: { plan: 'free', status: 'active' },
                        error: null
                    });
                }
                if (tableName === 'analysis_usage') {
                    return mockServiceClient._createBuilder({
                        data: { count: 5 },
                        error: null
                    });
                }
                if (tableName === 'roast_usage') {
                    return mockServiceClient._createBuilder({
                        data: { count: 0 },
                        error: null
                    });
                }
                return mockServiceClient._createBuilder({ data: null, error: null });
            });

            // Mock high toxicity content analysis
            const PerspectiveService = require('../../src/services/perspectiveService');
            PerspectiveService.prototype.analyzeText = jest.fn().mockResolvedValue({
                toxicity: 0.8, // High toxicity
                safe: false,
                categories: ['toxicity', 'insult']
            });

            const response = await request(app)
                .post('/api/roast/preview')
                .set('Authorization', authToken)
                .send({
                    text: 'Some highly toxic content here'
                });

            expect(response.status).toBe(400);
            expect(response.body).toMatchObject({
                success: false,
                error: 'Content not suitable for roasting',
                details: {
                    toxicityScore: 0.8,
                    categories: expect.arrayContaining(['toxicity', 'insult'])
                }
            });
        });
    });

    describe('POST /api/roast/generate', () => {
        it('should generate roast and consume credits', async () => {
            // Mock database calls - Issue #698: Simplified table-based mocking
            mockServiceClient.from = jest.fn((tableName) => {
                if (tableName === 'user_subscriptions') {
                    return mockServiceClient._createBuilder({
                        data: { plan: 'creator', status: 'active' },
                        error: null
                    });
                }
                if (tableName === 'analysis_usage') {
                    return mockServiceClient._createBuilder({
                        data: { count: 3 },  // Low usage
                        error: null
                    });
                }
                if (tableName === 'roast_usage') {
                    return mockServiceClient._createBuilder({
                        data: { count: 5 },  // Low usage, has credits
                        error: null
                    });
                }
                return mockServiceClient._createBuilder({ data: null, error: null });
            });

            // Issue #698: Mock RPC call for credit consumption (CRITICAL!)
            mockServiceClient.rpc = jest.fn((functionName, params) => {
                if (functionName === 'consume_roast_credits') {
                    return Promise.resolve({
                        data: {
                            success: true,
                            hasCredits: true,
                            remaining: 44,  // Had 50, consumed 1, now 44 (plus previous 5)
                            limit: 50,
                            used: 6,
                            unlimited: false
                        },
                        error: null
                    });
                }
                return Promise.resolve({ data: null, error: { message: 'RPC not mocked' } });
            });

            const response = await request(app)
                .post('/api/roast/generate')
                .set('Authorization', authToken)
                .send({
                    text: 'Generate a real roast for this',
                    tone: 'witty',
                    intensity: 4
                });

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                success: true,
                data: {
                    roast: expect.any(String),
                    metadata: {
                        tone: 'witty',
                        intensity: 4,
                        preview: false
                    },
                    credits: {
                        remaining: expect.any(Number),
                        limit: expect.any(Number),
                        used: expect.any(Number)
                    }
                }
            });

            // Verify usage was recorded
            expect(mockServiceClient.from).toHaveBeenCalledWith('roast_usage');
        });

        it('should reject when user has insufficient credits', async () => {
            // Track which call we're on
            let callCount = 0;

            // Mock sequential database calls
            mockServiceClient.from = jest.fn((tableName) => {
                callCount++;

                // First call: user_subscriptions lookup
                if (callCount === 1 && tableName === 'user_subscriptions') {
                    return mockServiceClient._createBuilder({
                        data: { plan: 'free', status: 'active' },
                        error: null
                    });
                }

                // Second call: roast_usage count - user at limit
                if (callCount === 2 && tableName === 'roast_usage') {
                    return mockServiceClient._createBuilder({
                        data: { count: 50 }, // At free plan limit
                        error: null
                    });
                }

                // Default
                return mockServiceClient._createBuilder({ data: null, error: null });
            });

            const response = await request(app)
                .post('/api/roast/generate')
                .set('Authorization', authToken)
                .send({
                    text: 'This should be rejected due to credits'
                });

            expect(response.status).toBe(402);
            expect(response.body).toMatchObject({
                success: false,
                error: 'Insufficient credits',
                details: {
                    remaining: 0,
                    limit: expect.any(Number),
                    used: expect.any(Number),
                    plan: 'free'
                }
            });
        });
    });

    describe('GET /api/roast/credits', () => {
        it('should return user credit status', async () => {
            // Mock database calls - Issue #698: Simplified table-based mocking
            mockServiceClient.from = jest.fn((tableName) => {
                if (tableName === 'user_subscriptions') {
                    return mockServiceClient._createBuilder({
                        data: { plan: 'creator', status: 'active' },
                        error: null
                    });
                }
                if (tableName === 'roast_usage') {
                    return mockServiceClient._createBuilder({
                        data: { count: 15 },  // Used 15 credits
                        error: null
                    });
                }
                // Return defaults for other tables
                return mockServiceClient._createBuilder({ data: null, error: null });
            });

            const response = await request(app)
                .get('/api/roast/credits')
                .set('Authorization', authToken);

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                success: true,
                data: {
                    plan: 'creator',
                    status: 'active',
                    credits: {
                        remaining: expect.any(Number),
                        limit: expect.any(Number),
                        used: 15,
                        unlimited: expect.any(Boolean)
                    }
                }
            });
        });
    });

    describe('Error handling', () => {
        it('should handle database errors gracefully', async () => {
            // Mock database error
            const mockErrorBuilder = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Database connection failed' }
                })
            };

            mockServiceClient.from.mockReturnValueOnce(mockErrorBuilder);

            const response = await request(app)
                .get('/api/roast/credits')
                .set('Authorization', authToken);

            expect(response.status).toBe(200); // Should fallback gracefully
            expect(response.body.data.plan).toBe('free'); // Default plan
        });

        it('should handle roast generation errors', async () => {
            // Mock user subscription lookup
            const mockUserSubBuilder = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { plan: 'creator', status: 'active' },
                    error: null
                })
            };

            mockServiceClient.from.mockReturnValueOnce(mockUserSubBuilder);

            // Mock roast generator error
            const RoastGeneratorMock = require('../../src/services/roastGeneratorMock');
            RoastGeneratorMock.prototype.generateRoast = jest.fn().mockRejectedValue(
                new Error('Roast generation failed')
            );

            const response = await request(app)
                .post('/api/roast/preview')
                .set('Authorization', authToken)
                .send({
                    text: 'This should cause an error'
                });

            expect(response.status).toBe(500);
            expect(response.body).toMatchObject({
                success: false,
                error: 'Failed to generate roast preview'
            });
        });
    });
});

module.exports = {};
