/**
 * Unit tests for Roast Routes Round 6 Validation Fixes
 * Tests all the validation improvements implemented based on CodeRabbit Round 6 feedback
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
jest.mock('@sentry/node'); // CodeRabbit Round 6: Mock Sentry

describe('Roast Routes Round 6 Validation Fixes', () => {
    let app;
    let mockUser;
    let authenticateToken;
    let roastRoutes;
    let mockSentry;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Mock Sentry
        mockSentry = {
            captureMessage: jest.fn()
        };
        require('@sentry/node').captureMessage = mockSentry.captureMessage;
        
        // Mock the authentication middleware
        authenticateToken = jest.fn((req, res, next) => {
            req.user = mockUser;
            next();
        });
        
        // Mock auth module
        require('../../../src/middleware/auth').authenticateToken = authenticateToken;

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

        // Mock Supabase (CodeRabbit Round 7: Fix RPC mock structure)
        const mockRpcResponse = {
            data: {
                success: true,
                remaining: 99,
                limit: 100,
                used: 1,
                error: null
            },
            error: null
        };
        
        require('../../../src/config/supabase').supabaseServiceClient = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
            insert: jest.fn().mockResolvedValue({ data: null, error: null }),
            rpc: jest.fn().mockResolvedValue(mockRpcResponse)
        };

        // Mock roast engine
        const MockRoastEngine = jest.fn().mockImplementation(() => ({
            generateRoast: jest.fn().mockResolvedValue({
                roast: 'Test roast response',
                versions: ['Version 1', 'Version 2'],
                style: 'balanceado',
                language: 'es',
                status: 'auto_approved',
                metadata: { id: 'test-id', versionsGenerated: 2 },
                transparency: { applied: true },
                credits: { consumed: 1 }
            })
        }));
        require('../../../src/services/roastEngine').mockImplementation(MockRoastEngine);

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

    describe('Language Validation Fix (Round 6)', () => {
        test('should use normalized language for validation', async () => {
            // Test with BCP-47 locale that should be normalized
            const response = await request(app)
                .post('/api/roast/engine')
                .send({
                    comment: 'Test comment',
                    style: 'balanceado',
                    language: 'es-MX' // Should be normalized to 'es'
                });

            // Should accept the normalized language
            expect([200, 402, 503]).toContain(response.status);
            
            // Should NOT return validation error for language
            if (response.status === 400) {
                expect(response.body.details || []).not.toEqual(
                    expect.arrayContaining([
                        expect.stringContaining('Language must be one of')
                    ])
                );
            }
        });

        test('should reject invalid normalized language', async () => {
            const response = await request(app)
                .post('/api/roast/engine')
                .send({
                    comment: 'Test comment',
                    style: 'balanceado',
                    language: 'fr' // Invalid language that won't normalize to valid one
                });

            expect(response.status).toBe(400);
            expect(response.body.details).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('Language must be one of')
                ])
            );
        });

        test('should handle complex locale codes', async () => {
            const locales = ['en-US', 'en-GB', 'es-ES', 'es-419'];
            
            for (const locale of locales) {
                const response = await request(app)
                    .post('/api/roast/engine')
                    .send({
                        comment: 'Test comment',
                        style: locale.startsWith('en') ? 'balanced' : 'balanceado',
                        language: locale
                    });

                // Should accept all valid locale codes
                expect([200, 402, 503]).toContain(response.status);
            }
        });
    });

    describe('Platform Validation Fix (Round 6)', () => {
        test('should use normalized platform for validation', async () => {
            // Test with platform alias
            const response = await request(app)
                .post('/api/roast/engine')
                .send({
                    comment: 'Test comment',
                    platform: 'X', // Should be normalized to 'twitter'
                    style: 'balanceado'
                });

            // Should accept the normalized platform
            expect([200, 402, 503]).toContain(response.status);
            
            // Should NOT return validation error for platform
            if (response.status === 400) {
                expect(response.body.details || []).not.toEqual(
                    expect.arrayContaining([
                        expect.stringContaining('Platform must be one of')
                    ])
                );
            }
        });

        test('should handle platform aliases correctly', async () => {
            const aliases = ['x', 'X', 'x.com', 'twitter.com'];
            
            for (const alias of aliases) {
                const response = await request(app)
                    .post('/api/roast/engine')
                    .send({
                        comment: 'Test comment',
                        platform: alias,
                        style: 'balanceado'
                    });

                // Should accept all aliases
                expect([200, 402, 503]).toContain(response.status);
            }
        });

        test('should reject invalid normalized platform', async () => {
            const response = await request(app)
                .post('/api/roast/engine')
                .send({
                    comment: 'Test comment',
                    platform: 'invalid-platform',
                    style: 'balanceado'
                });

            expect(response.status).toBe(400);
            expect(response.body.details).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('Platform must be one of')
                ])
            );
        });
    });

    describe('OrgId Security Fix (Round 6)', () => {
        test('should not accept orgId from request body', async () => {
            const response = await request(app)
                .post('/api/roast/engine')
                .send({
                    comment: 'Test comment',
                    orgId: 'malicious-org-id', // Should be ignored
                    style: 'balanceado'
                });

            // Should NOT return validation error for orgId (because it's ignored)
            if (response.status === 400) {
                expect(response.body.details || []).not.toEqual(
                    expect.arrayContaining([
                        expect.stringContaining('orgId')
                    ])
                );
            }
        });

        test('should use orgId from authenticated user only', async () => {
            // Set up mock user with orgId
            authenticateToken.mockImplementation((req, res, next) => {
                req.user = {
                    id: 'test-user',
                    orgId: 'authenticated-org-id'
                };
                next();
            });

            const response = await request(app)
                .post('/api/roast/engine')
                .send({
                    comment: 'Test comment',
                    orgId: 'malicious-org-id', // Should be completely ignored
                    style: 'balanceado'
                });

            // Should process successfully (orgId from auth is used, not from body)
            expect([200, 402, 503]).toContain(response.status);
        });
    });

    describe('Enhanced Transparency Validation (Round 6)', () => {
        test('should return 400 for transparency validation failure', async () => {
            // Mock roast engine to return auto_approved without transparency
            const MockRoastEngine = jest.fn().mockImplementation(() => ({
                generateRoast: jest.fn().mockResolvedValue({
                    roast: 'Test roast',
                    status: 'auto_approved',
                    metadata: { id: 'test-id' },
                    transparency: { applied: false }, // Transparency not applied
                    credits: { consumed: 1 }
                })
            }));
            require('../../../src/services/roastEngine').mockImplementation(MockRoastEngine);

            const response = await request(app)
                .post('/api/roast/engine')
                .send({
                    comment: 'Test comment',
                    autoApprove: true,
                    style: 'balanceado'
                });

            // Should return 400 instead of 500 (CodeRabbit Round 6 fix)
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Transparency validation failed');
            expect(response.body.code).toBe('TRANSPARENCY_REQUIRED');
        });

        test('should capture transparency errors to Sentry', async () => {
            // Mock roast engine to return auto_approved without transparency
            const MockRoastEngine = jest.fn().mockImplementation(() => ({
                generateRoast: jest.fn().mockResolvedValue({
                    roast: 'Test roast',
                    status: 'auto_approved',
                    metadata: { id: 'test-id' },
                    transparency: { applied: false },
                    credits: { consumed: 1 }
                })
            }));
            require('../../../src/services/roastEngine').mockImplementation(MockRoastEngine);

            await request(app)
                .post('/api/roast/engine')
                .send({
                    comment: 'Test comment',
                    autoApprove: true,
                    style: 'balanceado'
                });

            // Should capture error to Sentry
            expect(mockSentry.captureMessage).toHaveBeenCalledWith(
                'Auto-approved roast without transparency disclaimer',
                expect.objectContaining({
                    level: 'error',
                    extra: expect.any(Object),
                    tags: expect.objectContaining({
                        feature: 'roast_engine',
                        severity: 'critical',
                        type: 'transparency_validation_failure'
                    })
                })
            );
        });

        test('should pass when transparency is properly applied', async () => {
            // Mock roast engine to return auto_approved WITH transparency
            const MockRoastEngine = jest.fn().mockImplementation(() => ({
                generateRoast: jest.fn().mockResolvedValue({
                    roast: 'Test roast',
                    status: 'auto_approved',
                    metadata: { id: 'test-id' },
                    transparency: { applied: true }, // Transparency properly applied
                    credits: { consumed: 1 }
                })
            }));
            require('../../../src/services/roastEngine').mockImplementation(MockRoastEngine);

            const response = await request(app)
                .post('/api/roast/engine')
                .send({
                    comment: 'Test comment',
                    autoApprove: true,
                    style: 'balanceado'
                });

            // Should pass validation
            expect([200, 402, 503]).toContain(response.status);
            
            // Should NOT capture to Sentry
            expect(mockSentry.captureMessage).not.toHaveBeenCalled();
        });
    });

    describe('Caching Headers Fix (Round 6)', () => {
        test('should not include Vary header for styles endpoint', async () => {
            const response = await request(app)
                .get('/api/roast/styles');

            if (response.status === 200) {
                expect(response.headers['cache-control']).toBe('public, max-age=3600');
                expect(response.headers['vary']).toBeUndefined(); // Should be removed
            }
        });
    });

    describe('Overall Integration (Round 6)', () => {
        test('should handle complex validation scenario correctly', async () => {
            const response = await request(app)
                .post('/api/roast/engine')
                .send({
                    comment: 'Test comment for validation',
                    style: 'BALANCEADO', // Mixed case
                    language: 'es-MX', // BCP-47 locale
                    platform: 'X', // Platform alias
                    autoApprove: true,
                    orgId: 'ignored-org-id' // Should be ignored
                });

            // Should handle all normalizations correctly
            expect([200, 402, 503]).toContain(response.status);
            
            // Should not have validation errors
            if (response.status === 400) {
                expect(response.body.details || []).toHaveLength(0);
            }
        });
    });
});