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

// Issue #680: Import roast mock factory for test isolation
const {
    createRoastSupabaseMock,
    createUserSubscriptionData,
    createRoastUsageData,
    createAnalysisUsageData  // Issue #680: Support analysis_usage table
} = require('../helpers/roastMockFactory');

describe('Roast API Integration Tests', () => {
    let mockServiceClient;
    // Issue #680: userId must match what getUserFromToken returns for 'valid-token'
    // getUserFromToken creates: 'mock-user-' + token.substring(0, 8) = 'mock-user-valid-to'
    const testUserId = 'mock-user-valid-to';
    const authToken = 'Bearer valid-token';

    beforeEach(() => {
        jest.clearAllMocks();

        // Set required environment variables
        process.env.FRONTEND_URL = 'https://test.example.com';

        // Issue #680: Get reference to the actual client used by routes
        const supabaseConfig = require('../../src/config/supabase');
        mockServiceClient = supabaseConfig.supabaseServiceClient;

        // Issue #680: Create default mock for all tests (can be overridden per test)
        const defaultMock = createRoastSupabaseMock({
            userSubscriptions: [
                createUserSubscriptionData({
                    userId: testUserId,
                    plan: 'free',
                    status: 'active'
                })
            ]
        });

        // Mutate the existing client's methods
        mockServiceClient.from = defaultMock.from;

        // Mock flags
        flags.isEnabled = jest.fn().mockImplementation((flag) => {
            switch (flag) {
                case 'ENABLE_REAL_OPENAI':
                    return false; // Use mock generator
                case 'ENABLE_PERSPECTIVE_API':
                    return false; // Use mock moderation
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
            // Issue #680: Create fresh mock with pre-configured data for this test
            const testMock = createRoastSupabaseMock({
                userSubscriptions: [
                    createUserSubscriptionData({
                        userId: testUserId,
                        plan: 'creator',
                        status: 'active'
                    })
                ]
            });

            // Mutate the existing client's methods (routes have const reference to it)
            mockServiceClient.from = testMock.from;

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
                    expect.stringContaining('Text is required'),
                    expect.stringContaining('Tone must be one of')
                ])
            });
        });

        it('should reject high toxicity content', async () => {
            // Issue #680: Fresh mock with test-specific data
            const testMock = createRoastSupabaseMock({
                userSubscriptions: [
                    createUserSubscriptionData({
                        userId: testUserId,
                        plan: 'free',
                        status: 'active'
                    })
                ]
            });

            mockServiceClient.from = testMock.from;

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
            // Issue #680: Fresh mock for this test with sequential call handling
            const testMock = createRoastSupabaseMock();
            // CodeRabbit #697: Preserve helper functions before overriding
            const originalFrom = testMock.from;
            let callCount = 0;

            // Customize from() for sequential calls (only affects this test)
            testMock.from = jest.fn((tableName) => {
                callCount++;

                // First call: user_subscriptions lookup
                if (callCount === 1 && tableName === 'user_subscriptions') {
                    return originalFrom._createBuilderWithData(tableName, {
                        data: createUserSubscriptionData({
                            userId: testUserId,
                            plan: 'creator',
                            status: 'active'
                        }),
                        error: null
                    });
                }

                // Second call: roast_usage count
                if (callCount === 2 && tableName === 'roast_usage') {
                    return originalFrom._createBuilderWithData(tableName, {
                        data: { count: 5 },
                        error: null
                    });
                }

                // Third call: roast_usage insert
                if (callCount === 3 && tableName === 'roast_usage') {
                    const builder = originalFrom._createBuilderWithData(tableName, { data: null, error: null });
                    builder.insert = jest.fn().mockResolvedValue({
                        data: [createRoastUsageData({  // CodeRabbit #3405814750: Supabase insert returns array
                            userId: testUserId,
                            count: 6
                        })],
                        error: null
                    });
                    return builder;
                }

                // Default
                return originalFrom._createBuilderWithData(tableName, { data: null, error: null });
            });
            // CodeRabbit #697: Copy helpers to new function
            Object.assign(testMock.from, originalFrom);

            mockServiceClient.from = testMock.from;

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
            expect(testMock.from).toHaveBeenCalledWith('roast_usage');
        });

        it('should reject when user has insufficient credits', async () => {
            // Issue #680: Fresh mock for this test
            const testMock = createRoastSupabaseMock();
            // CodeRabbit #697: Preserve helper functions before overriding
            const originalFrom = testMock.from;
            let callCount = 0;

            testMock.from = jest.fn((tableName) => {
                callCount++;

                // First call: user_subscriptions lookup
                if (callCount === 1 && tableName === 'user_subscriptions') {
                    return originalFrom._createBuilderWithData(tableName, {
                        data: createUserSubscriptionData({
                            userId: testUserId,
                            plan: 'free',
                            status: 'active'
                        }),
                        error: null
                    });
                }

                // Second call: roast_usage count - user at limit
                if (callCount === 2 && tableName === 'roast_usage') {
                    return originalFrom._createBuilderWithData(tableName, {
                        data: { count: 50 }, // At free plan limit
                        error: null
                    });
                }

                // Default
                return originalFrom._createBuilderWithData(tableName, { data: null, error: null });
            });
            // CodeRabbit #697: Copy helpers to new function
            Object.assign(testMock.from, originalFrom);

            mockServiceClient.from = testMock.from;

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
            // Issue #680: Fresh mock for this test
            const testMock = createRoastSupabaseMock();
            // CodeRabbit #697: Preserve helper functions before overriding
            const originalFrom = testMock.from;
            let callCount = 0;

            testMock.from = jest.fn((tableName) => {
                callCount++;

                // First call: user_subscriptions lookup
                if (callCount === 1 && tableName === 'user_subscriptions') {
                    return originalFrom._createBuilderWithData(tableName, {
                        data: createUserSubscriptionData({
                            userId: testUserId,
                            plan: 'creator',
                            status: 'active'
                        }),
                        error: null
                    });
                }

                // Second call: roast_usage count
                if (callCount === 2 && tableName === 'roast_usage') {
                    return originalFrom._createBuilderWithData(tableName, {
                        data: { count: 15 },
                        error: null
                    });
                }

                // Default
                return originalFrom._createBuilderWithData(tableName, { data: null, error: null });
            });
            // CodeRabbit #697: Copy helpers to new function
            Object.assign(testMock.from, originalFrom);

            mockServiceClient.from = testMock.from;

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
            // Issue #680: Fresh mock for error handling test
            const testMock = createRoastSupabaseMock();

            // Mock database error
            const mockErrorBuilder = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Database connection failed' }
                })
            };

            testMock.from.mockReturnValueOnce(mockErrorBuilder);
            mockServiceClient.from = testMock.from;

            const response = await request(app)
                .get('/api/roast/credits')
                .set('Authorization', authToken);

            expect(response.status).toBe(200); // Should fallback gracefully
            expect(response.body.data.plan).toBe('free'); // Default plan
        });

        it('should handle roast generation errors', async () => {
            // Issue #680: Fresh mock for error handling test
            const testMock = createRoastSupabaseMock();

            // Mock user subscription lookup
            const mockUserSubBuilder = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: createUserSubscriptionData({
                        userId: testUserId,
                        plan: 'creator',
                        status: 'active'
                    }),
                    error: null
                })
            };

            testMock.from.mockReturnValueOnce(mockUserSubBuilder);
            mockServiceClient.from = testMock.from;

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
