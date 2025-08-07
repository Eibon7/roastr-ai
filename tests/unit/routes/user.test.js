/**
 * Tests unitarios para las rutas de usuario (/api/user)
 */

const request = require('supertest');
const express = require('express');
const userRoutes = require('../../../src/routes/user');

// Mock dependencies
jest.mock('../../../src/middleware/auth');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/config/supabase');

describe('User Routes Tests', () => {
    let app;
    let mockUserClient;
    let mockAuthenticateToken;

    beforeEach(() => {
        // Setup Express app
        app = express();
        app.use(express.json());
        
        // Mock authentication middleware
        mockAuthenticateToken = require('../../../src/middleware/auth').authenticateToken;
        mockAuthenticateToken.mockImplementation((req, res, next) => {
            req.user = { id: 'test-user-id' };
            req.accessToken = 'mock-access-token';
            next();
        });
        
        // Mock Supabase client
        mockUserClient = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            single: jest.fn()
        };
        
        const { createUserClient } = require('../../../src/config/supabase');
        createUserClient.mockReturnValue(mockUserClient);
        
        // Use user routes
        app.use('/api/user', userRoutes);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/user/integrations', () => {
        it('should return user integrations successfully', async () => {
            // Mock user organization query (first call)
            mockUserClient.single
                .mockResolvedValueOnce({
                    data: {
                        id: 'test-user-id',
                        organizations: [{ id: 'org-123' }]
                    },
                    error: null
                });
                
            // Mock integration configs query (second call - but not single, it's select with order)
            mockUserClient.select.mockReturnValueOnce(mockUserClient);
            mockUserClient.eq.mockReturnValueOnce(mockUserClient);
            mockUserClient.order.mockResolvedValueOnce({
                data: [
                    {
                        id: 'int-1',
                        platform: 'twitter',
                        enabled: true,
                        created_at: '2023-01-01',
                        updated_at: '2023-01-02',
                        settings: { tone: 'sarcastic' }
                    }
                ],
                error: null
            });

            const response = await request(app)
                .get('/api/user/integrations')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(9); // All 9 platforms
            expect(response.body.data.find(p => p.platform === 'twitter')).toMatchObject({
                platform: 'twitter',
                status: 'connected',
                enabled: true
            });
        });

        it('should return error if user organization not found', async () => {
            mockUserClient.single.mockResolvedValueOnce({
                data: null,
                error: { message: 'User not found' }
            });

            const response = await request(app)
                .get('/api/user/integrations')
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('User organization not found');
        });
    });

    describe('POST /api/user/integrations/connect', () => {
        beforeEach(() => {
            // Mock user organization query
            mockUserClient.single.mockResolvedValueOnce({
                data: {
                    id: 'test-user-id',
                    organizations: [{ id: 'org-123' }]
                },
                error: null
            });
        });

        it('should connect new platform successfully', async () => {
            // Mock no existing integration
            mockUserClient.single.mockResolvedValueOnce({
                data: null,
                error: { code: 'PGRST116' } // Not found
            });

            // Mock successful insert
            mockUserClient.single.mockResolvedValueOnce({
                data: {
                    id: 'new-integration-id',
                    platform: 'twitter',
                    enabled: true,
                    created_at: '2023-01-01',
                    updated_at: '2023-01-01'
                },
                error: null
            });

            const response = await request(app)
                .post('/api/user/integrations/connect')
                .send({ platform: 'twitter' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('twitter connected successfully');
            expect(response.body.data.platform).toBe('twitter');
            expect(response.body.data.status).toBe('connected');
        });

        it('should update existing platform successfully', async () => {
            // Mock existing integration
            mockUserClient.single
                .mockResolvedValueOnce({
                    data: {
                        id: 'existing-integration-id',
                        platform: 'twitter',
                        enabled: false,
                        settings: { old: 'data' }
                    },
                    error: null
                })
                .mockResolvedValueOnce({
                    data: {
                        id: 'existing-integration-id',
                        platform: 'twitter',
                        enabled: true,
                        updated_at: '2023-01-02'
                    },
                    error: null
                });

            const response = await request(app)
                .post('/api/user/integrations/connect')
                .send({ platform: 'twitter' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('connected');
            expect(mockUserClient.update).toHaveBeenCalled();
        });

        it('should return error for invalid platform', async () => {
            const response = await request(app)
                .post('/api/user/integrations/connect')
                .send({ platform: 'invalid-platform' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid platform');
        });

        it('should return error for missing platform', async () => {
            const response = await request(app)
                .post('/api/user/integrations/connect')
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Platform is required');
        });
    });

    describe('POST /api/user/integrations/disconnect', () => {
        beforeEach(() => {
            // Mock user organization query
            mockUserClient.single.mockResolvedValueOnce({
                data: {
                    id: 'test-user-id',
                    organizations: [{ id: 'org-123' }]
                },
                error: null
            });
        });

        it('should disconnect platform successfully', async () => {
            // Mock existing integration
            mockUserClient.single
                .mockResolvedValueOnce({
                    data: {
                        id: 'integration-id',
                        platform: 'twitter',
                        enabled: true,
                        settings: { access_token: 'token' }
                    },
                    error: null
                })
                .mockResolvedValueOnce({
                    data: {
                        id: 'integration-id',
                        platform: 'twitter',
                        enabled: false,
                        updated_at: '2023-01-02'
                    },
                    error: null
                });

            const response = await request(app)
                .post('/api/user/integrations/disconnect')
                .send({ platform: 'twitter' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('twitter disconnected successfully');
            expect(response.body.data.status).toBe('disconnected');
            expect(mockUserClient.update).toHaveBeenCalled();
        });

        it('should return error if integration not found', async () => {
            mockUserClient.single.mockResolvedValueOnce({
                data: null,
                error: { code: 'PGRST116' }
            });

            const response = await request(app)
                .post('/api/user/integrations/disconnect')
                .send({ platform: 'twitter' })
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Integration not found');
        });

        it('should return error for missing platform', async () => {
            const response = await request(app)
                .post('/api/user/integrations/disconnect')
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Platform is required');
        });
    });

    describe('POST /api/user/preferences', () => {
        it('should save user preferences successfully', async () => {
            // Mock user update
            mockUserClient.single
                .mockResolvedValueOnce({
                    data: {
                        id: 'test-user-id',
                        onboarding_complete: true,
                        preferences: {
                            humor_tone: 'sarcastic',
                            humor_style: 'witty',
                            response_frequency: 0.7
                        }
                    },
                    error: null
                })
                .mockResolvedValueOnce({
                    data: {
                        id: 'test-user-id',
                        organizations: [{ id: 'org-123' }]
                    },
                    error: null
                });

            const preferences = {
                preferred_platforms: ['twitter', 'instagram'],
                humor_tone: 'sarcastic',
                humor_style: 'witty',
                response_frequency: 0.7,
                auto_respond: true,
                shield_enabled: true
            };

            const response = await request(app)
                .post('/api/user/preferences')
                .send(preferences)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Preferences saved successfully');
            expect(response.body.data.user.onboarding_complete).toBe(true);
            expect(mockUserClient.update).toHaveBeenCalled();
        });

        it('should return error for invalid humor tone', async () => {
            const preferences = {
                humor_tone: 'invalid-tone',
                humor_style: 'witty'
            };

            const response = await request(app)
                .post('/api/user/preferences')
                .send(preferences)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid humor tone');
        });

        it('should return error for invalid humor style', async () => {
            const preferences = {
                humor_tone: 'sarcastic',
                humor_style: 'invalid-style'
            };

            const response = await request(app)
                .post('/api/user/preferences')
                .send(preferences)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid humor style');
        });

        it('should return error for invalid platforms', async () => {
            const preferences = {
                preferred_platforms: ['invalid-platform'],
                humor_tone: 'sarcastic',
                humor_style: 'witty'
            };

            const response = await request(app)
                .post('/api/user/preferences')
                .send(preferences)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid platforms');
        });

        it('should handle empty preferences with defaults', async () => {
            // Mock user update with defaults
            mockUserClient.single.mockResolvedValueOnce({
                data: {
                    id: 'test-user-id',
                    onboarding_complete: true,
                    preferences: {
                        humor_tone: 'sarcastic',
                        humor_style: 'witty',
                        response_frequency: 0.7,
                        preferred_platforms: []
                    }
                },
                error: null
            });

            const response = await request(app)
                .post('/api/user/preferences')
                .send({}) // Empty body, should use defaults
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(mockUserClient.update).toHaveBeenCalledWith({
                preferences: expect.objectContaining({
                    humor_tone: 'sarcastic',
                    humor_style: 'witty',
                    response_frequency: 0.7,
                    preferred_platforms: []
                }),
                onboarding_complete: true,
                updated_at: expect.any(String)
            });
        });
    });

    describe('GET /api/user/profile', () => {
        it('should return user profile successfully', async () => {
            mockUserClient.single.mockResolvedValueOnce({
                data: {
                    id: 'test-user-id',
                    email: 'test@example.com',
                    name: 'Test User',
                    plan: 'basic',
                    is_admin: false,
                    active: true,
                    onboarding_complete: true,
                    preferences: { humor_tone: 'sarcastic' },
                    created_at: '2023-01-01',
                    organizations: [{ id: 'org-123', name: 'Test Org', plan_id: 'basic' }]
                },
                error: null
            });

            const response = await request(app)
                .get('/api/user/profile')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe('test-user-id');
            expect(response.body.data.email).toBe('test@example.com');
            expect(response.body.data.onboarding_complete).toBe(true);
        });

        it('should return error if user not found', async () => {
            mockUserClient.single.mockResolvedValueOnce({
                data: null,
                error: { message: 'User not found' }
            });

            const response = await request(app)
                .get('/api/user/profile')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to retrieve user profile');
        });
    });

    describe('Authentication Middleware Integration', () => {
        it('should require authentication for all user routes', async () => {
            // Remove authentication middleware
            mockAuthenticateToken.mockImplementation((req, res, next) => {
                res.status(401).json({ error: 'Unauthorized' });
            });

            const routes = [
                '/api/user/integrations',
                '/api/user/profile'
            ];

            for (const route of routes) {
                const response = await request(app)
                    .get(route)
                    .expect(401);

                expect(response.body.error).toBe('Unauthorized');
            }
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            // Mock user organization query to succeed first
            mockUserClient.single.mockResolvedValueOnce({
                data: {
                    id: 'test-user-id',
                    organizations: [{ id: 'org-123' }]
                },
                error: null
            });
        });

        it('should handle database errors gracefully', async () => {
            mockUserClient.single.mockResolvedValueOnce({
                data: null,
                error: { message: 'Database connection failed' }
            });

            const response = await request(app)
                .get('/api/user/integrations')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to retrieve integrations');
        });

        it('should handle unexpected errors in preferences endpoint', async () => {
            mockUserClient.update.mockRejectedValueOnce(new Error('Unexpected error'));

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
    });
});