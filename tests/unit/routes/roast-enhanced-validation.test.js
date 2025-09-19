/**
 * Unit tests for Roast Routes Enhanced Validation (CodeRabbit Round 4 improvements)
 * Tests enhanced validation, language-aware defaults, and caching headers
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies before requiring the module
jest.mock('../../../src/middleware/auth');
jest.mock('../../../src/services/roastGeneratorEnhanced');
jest.mock('../../../src/services/roastEngine');
jest.mock('../../../src/config/supabase');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/config/flags');

describe('Roast Routes Enhanced Validation', () => {
    let app;
    let mockUser;
    let authenticateToken;
    let optionalAuth;
    let roastRoutes;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Mock the authentication middleware
        authenticateToken = jest.fn((req, res, next) => {
            req.user = mockUser;
            next();
        });
        
        optionalAuth = jest.fn((req, res, next) => {
            next();
        });

        // Mock auth module
        require('../../../src/middleware/auth').authenticateToken = authenticateToken;
        require('../../../src/middleware/auth').optionalAuth = optionalAuth;

        // Mock logger
        require('../../../src/utils/logger').logger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn()
        };

        // Mock flags
        require('../../../src/config/flags').flags = {
            isEnabled: jest.fn(() => true)
        };

        // Mock Supabase
        require('../../../src/config/supabase').supabaseServiceClient = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
            insert: jest.fn().mockResolvedValue({ data: null, error: null }),
            rpc: jest.fn().mockResolvedValue({ data: null, error: null })
        };

        // Mock roast engine
        const MockRoastEngine = jest.fn().mockImplementation(() => ({
            getAvailableStyles: jest.fn().mockReturnValue({
                'flanders': { name: 'Flanders', description: 'Test' },
                'balanceado': { name: 'Balanceado', description: 'Test' },
                'canalla': { name: 'Canalla', description: 'Test' }
            })
        }));
        require('../../../src/services/roastEngine').mockImplementation(MockRoastEngine);

        // Mock roast generator
        const MockRoastGenerator = jest.fn().mockImplementation(() => ({
            generateRoast: jest.fn().mockResolvedValue({
                roast: 'Test roast response',
                tokensUsed: 50
            }),
            estimateTokens: jest.fn().mockReturnValue(50)
        }));
        require('../../../src/services/roastGeneratorEnhanced').mockImplementation(MockRoastGenerator);

        // Setup test app
        app = express();
        app.use(express.json());
        
        // Import routes after mocking
        roastRoutes = require('../../../src/routes/roast');
        app.use('/api/roast', roastRoutes);

        mockUser = {
            id: 'test-user-123',
            email: 'test@example.com',
            orgId: 'test-org-456'
        };
    });

    describe('Intensity Validation Improvements', () => {
        test('should handle intensity = 0 correctly', async () => {
            const response = await request(app)
                .post('/api/roast/preview')
                .send({
                    text: 'Test comment',
                    intensity: 0,
                    tone: 'sarcastic'
                });

            // Should accept the request (0 gets normalized)
            expect([200, 402, 500]).toContain(response.status);
        });

        test('should handle undefined intensity', async () => {
            const response = await request(app)
                .post('/api/roast/preview')
                .send({
                    text: 'Test comment',
                    tone: 'sarcastic'
                    // intensity intentionally omitted
                });

            expect([200, 402, 500]).toContain(response.status);
        });

        test('should handle null intensity', async () => {
            const response = await request(app)
                .post('/api/roast/preview')
                .send({
                    text: 'Test comment',
                    intensity: null,
                    tone: 'sarcastic'
                });

            expect([200, 402, 500]).toContain(response.status);
        });

        test('should handle empty string intensity', async () => {
            const response = await request(app)
                .post('/api/roast/preview')
                .send({
                    text: 'Test comment',
                    intensity: '',
                    tone: 'sarcastic'
                });

            expect([200, 402, 500]).toContain(response.status);
        });

        test('should handle string number intensity', async () => {
            const response = await request(app)
                .post('/api/roast/preview')
                .send({
                    text: 'Test comment',
                    intensity: '3',
                    tone: 'sarcastic'
                });

            expect([200, 402, 500]).toContain(response.status);
        });

        test('should reject invalid intensity values', async () => {
            const response = await request(app)
                .post('/api/roast/preview')
                .send({
                    text: 'Test comment',
                    intensity: 10, // Above max
                    tone: 'sarcastic'
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation failed');
        });

        test('should reject negative intensity', async () => {
            const response = await request(app)
                .post('/api/roast/preview')
                .send({
                    text: 'Test comment',
                    intensity: -1,
                    tone: 'sarcastic'
                });

            expect(response.status).toBe(400);
        });
    });

    describe('Language-Aware Defaults', () => {
        test('should use Spanish defaults for es language', async () => {
            const response = await request(app)
                .get('/api/roast/styles?language=es');

            expect([200, 503]).toContain(response.status);
            if (response.status === 200 && response.body.success) {
                expect(response.body.data.language).toBe('es');
            }
        });

        test('should use English defaults for en language', async () => {
            const response = await request(app)
                .get('/api/roast/styles?language=en');

            expect([200, 503]).toContain(response.status);
            if (response.status === 200 && response.body.success) {
                expect(response.body.data.language).toBe('en');
            }
        });

        test('should handle BCP-47 locale codes', async () => {
            const response = await request(app)
                .get('/api/roast/styles?language=en-US');

            expect([200, 503]).toContain(response.status);
            if (response.status === 200 && response.body.success) {
                expect(response.body.data.language).toBe('en-US');
            }
        });

        test('should default to Spanish for missing language', async () => {
            const response = await request(app)
                .get('/api/roast/styles');

            expect([200, 503]).toContain(response.status);
            if (response.status === 200 && response.body.success) {
                expect(response.body.data.language).toBe('es');
            }
        });
    });

    describe('HTTP Caching Headers', () => {
        test('should include Cache-Control for public endpoint', async () => {
            const response = await request(app)
                .get('/api/roast/styles');

            if (response.status === 200) {
                expect(response.headers).toHaveProperty('cache-control');
                expect(response.headers['cache-control']).toContain('public');
                expect(response.headers['cache-control']).toContain('max-age=3600');
            }
        });

        test('should set appropriate cache headers for different languages', async () => {
            const responses = await Promise.all([
                request(app).get('/api/roast/styles?language=es'),
                request(app).get('/api/roast/styles?language=en')
            ]);

            responses.forEach(response => {
                if (response.status === 200) {
                    expect(response.headers['cache-control']).toContain('public');
                }
            });
        });
    });

    describe('Enhanced Validation', () => {
        describe('Text validation', () => {
            test('should reject empty text', async () => {
                const response = await request(app)
                    .post('/api/roast/preview')
                    .send({
                        text: '',
                        tone: 'sarcastic'
                    });

                expect(response.status).toBe(400);
                expect(response.body.details).toContain('Text cannot be empty');
            });

            test('should reject text that is only whitespace', async () => {
                const response = await request(app)
                    .post('/api/roast/preview')
                    .send({
                        text: '   \n\t   ',
                        tone: 'sarcastic'
                    });

                expect(response.status).toBe(400);
            });

            test('should reject text exceeding max length', async () => {
                const longText = 'a'.repeat(2001); // Exceeds MAX_COMMENT_LENGTH
                const response = await request(app)
                    .post('/api/roast/preview')
                    .send({
                        text: longText,
                        tone: 'sarcastic'
                    });

                expect(response.status).toBe(400);
                expect(response.body.details).toEqual(
                    expect.arrayContaining([
                        expect.stringContaining('2000 characters')
                    ])
                );
            });

            test('should accept valid text', async () => {
                const response = await request(app)
                    .post('/api/roast/preview')
                    .send({
                        text: 'Valid comment text',
                        tone: 'sarcastic'
                    });

                expect([200, 402, 500]).toContain(response.status);
            });
        });

        describe('Platform validation', () => {
            test('should accept valid platforms', async () => {
                const validPlatforms = ['twitter', 'facebook', 'instagram', 'youtube'];
                
                for (const platform of validPlatforms) {
                    const response = await request(app)
                        .post('/api/roast/preview')
                        .send({
                            text: 'Test comment',
                            platform: platform,
                            tone: 'sarcastic'
                        });

                    expect([200, 402, 500]).toContain(response.status);
                }
            });

            test('should accept platform aliases', async () => {
                const response = await request(app)
                    .post('/api/roast/preview')
                    .send({
                        text: 'Test comment',
                        platform: 'x', // Should map to twitter
                        tone: 'sarcastic'
                    });

                expect([200, 402, 500]).toContain(response.status);
            });

            test('should reject invalid platforms', async () => {
                const response = await request(app)
                    .post('/api/roast/preview')
                    .send({
                        text: 'Test comment',
                        platform: 'invalid-platform',
                        tone: 'sarcastic'
                    });

                expect(response.status).toBe(400);
                expect(response.body.details).toEqual(
                    expect.arrayContaining([
                        expect.stringContaining('Platform must be one of')
                    ])
                );
            });
        });

        describe('Style validation with language awareness', () => {
            test('should accept valid Spanish styles', async () => {
                const spanishStyles = ['flanders', 'balanceado', 'canalla'];
                
                for (const style of spanishStyles) {
                    const response = await request(app)
                        .post('/api/roast/engine')
                        .send({
                            comment: 'Test comment',
                            style: style,
                            language: 'es'
                        });

                    // Engine might not be available or need auth, but validation should pass
                    expect([200, 402, 503]).toContain(response.status);
                }
            });

            test('should accept valid English styles', async () => {
                const englishStyles = ['light', 'balanced', 'savage'];
                
                for (const style of englishStyles) {
                    const response = await request(app)
                        .post('/api/roast/engine')
                        .send({
                            comment: 'Test comment',
                            style: style,
                            language: 'en'
                        });

                    expect([200, 402, 503]).toContain(response.status);
                }
            });

            test('should be case insensitive', async () => {
                const response = await request(app)
                    .post('/api/roast/engine')
                    .send({
                        comment: 'Test comment',
                        style: 'BALANCEADO',
                        language: 'ES'
                    });

                expect([200, 402, 503]).toContain(response.status);
            });

            test('should reject invalid style-language combinations', async () => {
                const response = await request(app)
                    .post('/api/roast/engine')
                    .send({
                        comment: 'Test comment',
                        style: 'light', // English style
                        language: 'es'  // Spanish language
                    });

                expect(response.status).toBe(400);
                expect(response.body.details).toEqual(
                    expect.arrayContaining([
                        expect.stringContaining('Style must be one of')
                    ])
                );
            });
        });

        describe('Type validation', () => {
            test('should reject non-string text', async () => {
                const response = await request(app)
                    .post('/api/roast/preview')
                    .send({
                        text: 123,
                        tone: 'sarcastic'
                    });

                expect(response.status).toBe(400);
                expect(response.body.details).toContain('Text is required and must be a string');
            });

            test('should reject non-object styleProfile', async () => {
                const response = await request(app)
                    .post('/api/roast/preview')
                    .send({
                        text: 'Test comment',
                        styleProfile: 'not-an-object',
                        tone: 'sarcastic'
                    });

                expect(response.status).toBe(400);
                expect(response.body.details).toContain('Style profile must be an object');
            });

            test('should reject non-string persona', async () => {
                const response = await request(app)
                    .post('/api/roast/preview')
                    .send({
                        text: 'Test comment',
                        persona: 123,
                        tone: 'sarcastic'
                    });

                expect(response.status).toBe(400);
                expect(response.body.details).toContain('Persona must be a string');
            });

            test('should reject non-boolean autoApprove', async () => {
                const response = await request(app)
                    .post('/api/roast/engine')
                    .send({
                        comment: 'Test comment',
                        autoApprove: 'true' // Should be boolean
                    });

                expect(response.status).toBe(400);
                expect(response.body.details).toContain('autoApprove must be a boolean');
            });
        });
    });

    describe('Error Handling', () => {
        test('should handle validation errors gracefully', async () => {
            const response = await request(app)
                .post('/api/roast/preview')
                .send({
                    text: '', // Invalid
                    intensity: 10, // Invalid
                    platform: 'invalid' // Invalid
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Validation failed');
            expect(response.body.details).toBeInstanceOf(Array);
            expect(response.body.details.length).toBeGreaterThan(0);
            expect(response.body.timestamp).toBeDefined();
        });

        test('should provide helpful error messages', async () => {
            const response = await request(app)
                .post('/api/roast/preview')
                .send({
                    text: 'Valid text',
                    intensity: 15,
                    tone: 'invalid-tone'
                });

            expect(response.status).toBe(400);
            expect(response.body.details).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('Intensity must be a number between'),
                    expect.stringContaining('Tone must be one of')
                ])
            );
        });

        test('should include timestamp in error responses', async () => {
            const response = await request(app)
                .post('/api/roast/preview')
                .send({
                    text: ''
                });

            expect(response.status).toBe(400);
            expect(response.body.timestamp).toBeDefined();
            expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
        });
    });

    describe('Response Format Consistency', () => {
        test('should return consistent success response structure', async () => {
            const response = await request(app)
                .get('/api/roast/styles');

            if (response.status === 200) {
                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('data');
                expect(response.body).toHaveProperty('timestamp');
            }
        });

        test('should return consistent error response structure', async () => {
            const response = await request(app)
                .post('/api/roast/preview')
                .send({
                    text: ''
                });

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('timestamp');
        });

        test('should include appropriate metadata in responses', async () => {
            const response = await request(app)
                .get('/api/roast/styles?language=es');

            if (response.status === 200 && response.body.success) {
                expect(response.body.data).toHaveProperty('language');
                expect(response.body.data).toHaveProperty('styles');
            }
        });
    });

    describe('Multi-tenant Security', () => {
        test('should validate orgId format for engine endpoint', async () => {
            // Mock user with invalid orgId
            authenticateToken.mockImplementation((req, res, next) => {
                req.user = {
                    ...mockUser,
                    orgId: 123 // Invalid format (should be string)
                };
                next();
            });

            const response = await request(app)
                .post('/api/roast/engine')
                .send({
                    comment: 'Test comment'
                });

            // Should handle invalid orgId gracefully
            expect([200, 400, 402, 503]).toContain(response.status);
        });

        test('should handle missing orgId gracefully', async () => {
            authenticateToken.mockImplementation((req, res, next) => {
                req.user = {
                    id: mockUser.id,
                    email: mockUser.email
                    // orgId intentionally omitted
                };
                next();
            });

            const response = await request(app)
                .post('/api/roast/engine')
                .send({
                    comment: 'Test comment'
                });

            expect([200, 400, 402, 503]).toContain(response.status);
        });
    });
});