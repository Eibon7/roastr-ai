/**
 * Integration tests for roast API endpoints
 */

const request = require('supertest');

// IMPORTANT: Mock service dependencies BEFORE requiring the app
// Don't mock supabase - it has built-in mock mode via NODE_ENV
jest.mock('../../src/services/roastGeneratorEnhanced');
jest.mock('../../src/services/roastGeneratorMock');
jest.mock('../../src/services/perspectiveService');

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
        
        // Create stable builder instance
        const createStableBuilder = () => {
            const stableBuilder = {
                select: jest.fn(),
                eq: jest.fn(),
                single: jest.fn(),
                insert: jest.fn(),
                gte: jest.fn(),
                mockResolvedValue: jest.fn(),
                mockResolvedValueOnce: jest.fn()
            };

            stableBuilder.select.mockReturnValue(stableBuilder);
            stableBuilder.eq.mockReturnValue(stableBuilder);
            stableBuilder.gte.mockReturnValue(stableBuilder);
            stableBuilder.insert.mockReturnValue(stableBuilder);
            stableBuilder.single.mockReturnValue(stableBuilder);

            return stableBuilder;
        };

        // Mock Supabase service client
        mockServiceClient = {
            from: jest.fn(() => createStableBuilder()),
            rpc: jest.fn()
        };

        require('../../src/config/supabase').supabaseServiceClient = mockServiceClient;

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

        // Authentication is handled by built-in mock mode from setupIntegration.js
        // getUserFromToken() returns mock user when NODE_ENV=test
    });

    describe('POST /api/roast/preview', () => {
        it('should generate roast preview successfully', async () => {
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
            // Mock user subscription lookup
            const mockUserSubBuilder = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { plan: 'free', status: 'active' },
                    error: null
                })
            };
            
            mockServiceClient.from.mockReturnValueOnce(mockUserSubBuilder);

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
            // Mock user subscription lookup
            const mockUserSubBuilder = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { plan: 'creator', status: 'active' },
                    error: null
                })
            };

            // Mock usage check
            const mockUsageBuilder = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { count: 5 }, // Current usage
                    error: null
                })
            };

            // Mock usage recording
            const mockInsertBuilder = {
                insert: jest.fn().mockResolvedValue({
                    data: null,
                    error: null
                })
            };

            mockServiceClient.from
                .mockReturnValueOnce(mockUserSubBuilder)
                .mockReturnValueOnce(mockUsageBuilder)
                .mockReturnValueOnce(mockInsertBuilder);

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
            // Mock user subscription lookup
            const mockUserSubBuilder = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { plan: 'free', status: 'active' },
                    error: null
                })
            };

            // Mock usage check - user at limit
            const mockUsageBuilder = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { count: 50 }, // At free plan limit
                    error: null
                })
            };

            mockServiceClient.from
                .mockReturnValueOnce(mockUserSubBuilder)
                .mockReturnValueOnce(mockUsageBuilder);

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
            // Mock user subscription lookup
            const mockUserSubBuilder = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { plan: 'creator', status: 'active' },
                    error: null
                })
            };

            // Mock usage check
            const mockUsageBuilder = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { count: 15 },
                    error: null
                })
            };

            mockServiceClient.from
                .mockReturnValueOnce(mockUserSubBuilder)
                .mockReturnValueOnce(mockUsageBuilder);

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
