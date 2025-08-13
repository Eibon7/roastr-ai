/**
 * Extended coverage tests for user routes
 * Focus on edge cases and uncovered paths in mock mode
 */

const request = require('supertest');
const express = require('express');

// Mock Supabase client
const mockSupabaseServiceClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis()
};

const mockUserClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis()
};

const mockCreateUserClient = jest.fn().mockReturnValue(mockUserClient);

jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: mockSupabaseServiceClient,
    createUserClient: mockCreateUserClient
}));

// Mock integrations service with more specific control
const mockIntegrationsService = {
    getUserIntegrations: jest.fn(),
    connectIntegration: jest.fn(),
    disconnectIntegration: jest.fn()
};

jest.mock('../../../src/services/mockIntegrationsService', () => {
    return jest.fn().mockImplementation(() => mockIntegrationsService);
});

// Mock auth middleware
const mockAuthenticateToken = jest.fn((req, res, next) => {
    req.user = {
        id: 'test-user-id',
        email: 'test@example.com'
    };
    req.accessToken = 'test-access-token';
    next();
});

jest.mock('../../../src/middleware/auth', () => ({
    authenticateToken: mockAuthenticateToken
}));

// Mock logger
const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
};

jest.mock('../../../src/utils/logger', () => ({
    logger: mockLogger
}));

// Mock flags with more control
const mockFlags = {
    isEnabled: jest.fn()
};

jest.mock('../../../src/config/flags', () => ({
    flags: mockFlags
}));

const userRoutes = require('../../../src/routes/user');

describe('User Routes Extended Coverage Tests', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Default mock behaviors
        mockFlags.isEnabled.mockImplementation((flag) => {
            return flag === 'ENABLE_SUPABASE' ? false : true; // SUPABASE disabled by default for mock mode
        });
        
        // Reset Supabase client mocks
        mockSupabaseServiceClient.from.mockReturnThis();
        mockSupabaseServiceClient.select.mockReturnThis();
        mockSupabaseServiceClient.eq.mockReturnThis();
        mockSupabaseServiceClient.single.mockReturnValue(Promise.resolve({ data: null, error: null }));
        
        // Reset user client mocks
        mockUserClient.from.mockReturnThis();
        mockUserClient.select.mockReturnThis();
        mockUserClient.eq.mockReturnThis();
        mockUserClient.single.mockReturnValue(Promise.resolve({ data: null, error: null }));
        mockUserClient.update.mockReturnThis();
        mockUserClient.insert.mockReturnThis();
        
        // Reset integrations service
        mockIntegrationsService.getUserIntegrations.mockResolvedValue({
            success: true,
            data: []
        });
        mockIntegrationsService.connectIntegration.mockResolvedValue({
            success: true,
            data: { platform: 'twitter', connected: true }
        });
        mockIntegrationsService.disconnectIntegration.mockResolvedValue({
            success: true,
            data: { platform: 'twitter', connected: false }
        });

        // Setup Express app
        app = express();
        app.use(express.json());
        app.use('/api/user', userRoutes);
    });

    describe('GET /api/user/integrations - Error paths', () => {
        it('should handle service failure', async () => {
            mockIntegrationsService.getUserIntegrations.mockResolvedValueOnce({
                success: false,
                error: 'Service unavailable'
            });

            const response = await request(app)
                .get('/api/user/integrations')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Service unavailable');
        });

        it('should handle service exception', async () => {
            mockIntegrationsService.getUserIntegrations.mockRejectedValueOnce(
                new Error('Connection timeout')
            );

            const response = await request(app)
                .get('/api/user/integrations')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to retrieve integrations');
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Get user integrations error:',
                'Connection timeout'
            );
        });
    });

    describe('POST /api/user/integrations/connect - Error paths', () => {
        it('should handle service failure', async () => {
            mockIntegrationsService.connectIntegration.mockResolvedValueOnce({
                success: false,
                error: 'OAuth failed'
            });

            const response = await request(app)
                .post('/api/user/integrations/connect')
                .send({ platform: 'twitter' })
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('OAuth failed');
        });

        it('should handle service exception', async () => {
            mockIntegrationsService.connectIntegration.mockRejectedValueOnce(
                new Error('Network error')
            );

            const response = await request(app)
                .post('/api/user/integrations/connect')
                .send({ platform: 'twitter' })
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to connect platform');
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Connect platform integration error:',
                'Network error'
            );
        });

        it('should execute setTimeout callback for OAuth logging', (done) => {
            mockIntegrationsService.connectIntegration.mockResolvedValueOnce({
                success: true,
                data: { platform: 'twitter', connected: true }
            });

            request(app)
                .post('/api/user/integrations/connect')
                .send({ platform: 'twitter' })
                .expect(200)
                .then(() => {
                    // Wait for setTimeout to execute
                    setTimeout(() => {
                        expect(mockLogger.info).toHaveBeenCalledWith(
                            'Mock OAuth completed for platform:',
                            expect.objectContaining({
                                userId: expect.stringContaining('test-use...'),
                                platform: 'twitter'
                            })
                        );
                        done();
                    }, 1100);
                })
                .catch(done);
        });
    });

    describe('POST /api/user/integrations/disconnect - Error paths', () => {
        it('should handle service failure', async () => {
            mockIntegrationsService.disconnectIntegration.mockResolvedValueOnce({
                success: false,
                error: 'Platform not connected'
            });

            const response = await request(app)
                .post('/api/user/integrations/disconnect')
                .send({ platform: 'twitter' })
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Platform not connected');
        });

        it('should handle service exception', async () => {
            mockIntegrationsService.disconnectIntegration.mockRejectedValueOnce(
                new Error('API error')
            );

            const response = await request(app)
                .post('/api/user/integrations/disconnect')
                .send({ platform: 'twitter' })
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to disconnect platform');
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Disconnect platform integration error:',
                'API error'
            );
        });
    });

    describe('POST /api/user/preferences - Supabase enabled path', () => {
        it('should handle Supabase enabled path with user update error', async () => {
            // Enable Supabase flag
            mockFlags.isEnabled.mockImplementation((flag) => flag === 'ENABLE_SUPABASE');

            // Mock user update failure
            mockUserClient.update.mockReturnThis();
            mockUserClient.eq.mockReturnThis();
            mockUserClient.select.mockReturnThis();
            mockUserClient.single.mockResolvedValueOnce({
                data: null,
                error: { message: 'Database error' }
            });

            const response = await request(app)
                .post('/api/user/preferences')
                .send({
                    humor_tone: 'sarcastic',
                    humor_style: 'witty'
                })
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to save preferences');
        });

        it('should handle Supabase enabled path with successful user update', async () => {
            // Enable Supabase flag
            mockFlags.isEnabled.mockImplementation((flag) => flag === 'ENABLE_SUPABASE');

            // Mock successful user update
            const mockUpdatedUser = {
                id: 'test-user-id',
                onboarding_complete: true,
                preferences: {
                    humor_tone: 'sarcastic',
                    humor_style: 'witty',
                    response_frequency: 0.7,
                    auto_respond: true,
                    shield_enabled: true,
                    preferred_platforms: ['twitter'],
                    onboarding_completed_at: new Date().toISOString()
                }
            };

            mockUserClient.update.mockReturnThis();
            mockUserClient.eq.mockReturnThis();
            mockUserClient.select.mockReturnThis();
            mockUserClient.single.mockResolvedValueOnce({
                data: mockUpdatedUser,
                error: null
            });

            const response = await request(app)
                .post('/api/user/preferences')
                .send({
                    humor_tone: 'sarcastic',
                    humor_style: 'witty'
                    // No preferred_platforms to skip the integration creation
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.user.id).toBe('test-user-id');
        });

        it('should handle platform integration creation with organization found', async () => {
            // Enable Supabase flag
            mockFlags.isEnabled.mockImplementation((flag) => flag === 'ENABLE_SUPABASE');

            // Mock successful user update
            mockUserClient.update.mockReturnThis();
            mockUserClient.eq.mockReturnThis();
            mockUserClient.select.mockReturnThis();
            mockUserClient.single
                .mockResolvedValueOnce({
                    // First call: user update
                    data: { id: 'test-user-id', onboarding_complete: true },
                    error: null
                })
                .mockResolvedValueOnce({
                    // Second call: get user org
                    data: { id: 'test-user-id', organizations: [{ id: 'org-123' }] },
                    error: null
                })
                .mockResolvedValueOnce({
                    // Third call: check existing integration
                    data: null,
                    error: { code: 'PGRST116' } // Not found
                });

            // Mock successful integration creation
            mockUserClient.insert.mockReturnThis();
            mockUserClient.single.mockResolvedValueOnce({
                data: { id: 'integration-123', platform: 'twitter' },
                error: null
            });

            const response = await request(app)
                .post('/api/user/preferences')
                .send({
                    humor_tone: 'sarcastic',
                    humor_style: 'witty',
                    preferred_platforms: ['twitter']
                })
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should handle integration check error', async () => {
            // Enable Supabase flag
            mockFlags.isEnabled.mockImplementation((flag) => flag === 'ENABLE_SUPABASE');

            // Mock successful user update
            mockUserClient.update.mockReturnThis();
            mockUserClient.eq.mockReturnThis();
            mockUserClient.select.mockReturnThis();
            mockUserClient.single
                .mockResolvedValueOnce({
                    data: { id: 'test-user-id', onboarding_complete: true },
                    error: null
                })
                .mockResolvedValueOnce({
                    data: { id: 'test-user-id', organizations: [{ id: 'org-123' }] },
                    error: null
                })
                .mockResolvedValueOnce({
                    data: null,
                    error: { message: 'Database connection failed' }
                });

            const response = await request(app)
                .post('/api/user/preferences')
                .send({
                    humor_tone: 'sarcastic', 
                    humor_style: 'witty',
                    preferred_platforms: ['twitter']
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Error checking existing integration:',
                'Database connection failed'
            );
        });

        it('should handle integration creation failure', async () => {
            // Enable Supabase flag
            mockFlags.isEnabled.mockImplementation((flag) => flag === 'ENABLE_SUPABASE');

            // Mock successful user update
            mockUserClient.update.mockReturnThis();
            mockUserClient.eq.mockReturnThis();
            mockUserClient.select.mockReturnThis();
            mockUserClient.single
                .mockResolvedValueOnce({
                    data: { id: 'test-user-id', onboarding_complete: true },
                    error: null
                })
                .mockResolvedValueOnce({
                    data: { id: 'test-user-id', organizations: [{ id: 'org-123' }] },
                    error: null
                })
                .mockResolvedValueOnce({
                    data: null,
                    error: { code: 'PGRST116' }
                });

            // Mock integration creation failure
            mockUserClient.insert.mockReturnThis();
            mockUserClient.single.mockResolvedValueOnce({
                data: null,
                error: { message: 'Insert failed' }
            });

            const response = await request(app)
                .post('/api/user/preferences')
                .send({
                    humor_tone: 'sarcastic',
                    humor_style: 'witty', 
                    preferred_platforms: ['twitter']
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Failed to create integration config for twitter:',
                'Insert failed'
            );
        });

        it('should handle existing integration found', async () => {
            // Enable Supabase flag
            mockFlags.isEnabled.mockImplementation((flag) => flag === 'ENABLE_SUPABASE');

            // Mock successful user update
            mockUserClient.update.mockReturnThis();
            mockUserClient.eq.mockReturnThis();
            mockUserClient.select.mockReturnThis();
            mockUserClient.single
                .mockResolvedValueOnce({
                    data: { id: 'test-user-id', onboarding_complete: true },
                    error: null
                })
                .mockResolvedValueOnce({
                    data: { id: 'test-user-id', organizations: [{ id: 'org-123' }] },
                    error: null
                })
                .mockResolvedValueOnce({
                    data: { id: 'existing-integration-123' },
                    error: null
                });

            const response = await request(app)
                .post('/api/user/preferences')
                .send({
                    humor_tone: 'sarcastic',
                    humor_style: 'witty',
                    preferred_platforms: ['twitter']
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            // Should not try to create new integration since one exists
            expect(mockUserClient.insert).not.toHaveBeenCalled();
        });

        it('should handle organization error', async () => {
            // Enable Supabase flag
            mockFlags.isEnabled.mockImplementation((flag) => flag === 'ENABLE_SUPABASE');

            // Mock successful user update
            mockUserClient.update.mockReturnThis();
            mockUserClient.eq.mockReturnThis();
            mockUserClient.select.mockReturnThis();
            mockUserClient.single
                .mockResolvedValueOnce({
                    data: { id: 'test-user-id', onboarding_complete: true },
                    error: null
                })
                .mockResolvedValueOnce({
                    data: null,
                    error: { message: 'Organization not found' }
                });

            const response = await request(app)
                .post('/api/user/preferences')
                .send({
                    humor_tone: 'sarcastic',
                    humor_style: 'witty',
                    preferred_platforms: ['twitter']
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            // Should not try to create integrations when org lookup fails
        });
    });

    describe('POST /api/user/preferences - Exception handling', () => {
        it('should handle unexpected exception', async () => {
            // Mock createUserClient to throw error
            mockCreateUserClient.mockImplementationOnce(() => {
                throw new Error('Client creation failed');
            });

            const response = await request(app)
                .post('/api/user/preferences')
                .send({
                    humor_tone: 'sarcastic',
                    humor_style: 'witty'
                })
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to save preferences');
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Save user preferences error:',
                'Client creation failed'
            );
        });
    });

    describe('GET /api/user/profile - Error handling', () => {
        it('should handle user profile database error', async () => {
            mockUserClient.single.mockResolvedValueOnce({
                data: null,
                error: { message: 'User not found' }
            });

            const response = await request(app)
                .get('/api/user/profile')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to retrieve user profile');
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Get user profile error:',
                'Failed to fetch user profile: User not found'
            );
        });
    });
});