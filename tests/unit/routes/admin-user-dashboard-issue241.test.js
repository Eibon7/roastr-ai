const request = require('supertest');
const express = require('express');
const adminRoutes = require('../../../src/routes/admin');

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
        update: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn()
    }
}));

jest.mock('../../../src/middleware/isAdmin', () => ({
    isAdminMiddleware: (req, res, next) => {
        req.user = { id: 'admin-123', email: 'admin@test.com' };
        next();
    }
}));

jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock('../../../src/services/planLimitsService', () => ({
    getAllPlanLimits: jest.fn(),
    getPlanLimits: jest.fn(),
    updatePlanLimits: jest.fn(),
    clearCache: jest.fn()
}));

describe('Admin User Dashboard Routes - Issue #241', () => {
    let app;
    let mockSupabaseClient;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/admin', adminRoutes);
        
        const { supabaseServiceClient } = require('../../../src/config/supabase');
        mockSupabaseClient = supabaseServiceClient;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('PATCH /api/admin/users/:userId/config', () => {
        test('should update user configuration successfully', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
                plan: 'pro',
                tone: 'balanceado',
                shield_enabled: true,
                auto_reply_enabled: false
            };

            mockSupabaseClient.update.mockReturnValue(mockSupabaseClient);
            mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
            mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
            mockSupabaseClient.single.mockResolvedValue({
                data: mockUser,
                error: null
            });

            const updateData = {
                plan: 'creator_plus',
                tone: 'canalla',
                shieldEnabled: false,
                autoReplyEnabled: true,
                persona: {
                    defines: 'Soy sarcástico',
                    doesntTolerate: 'La mentira',
                    doesntCare: 'El clima'
                }
            };

            const response = await request(app)
                .patch('/api/admin/users/user-123/config')
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.user).toEqual(mockUser);
            expect(mockSupabaseClient.update).toHaveBeenCalledWith({
                plan: 'creator_plus',
                tone: 'canalla',
                shield_enabled: false,
                auto_reply_enabled: true,
                persona_defines: 'Soy sarcástico',
                persona_doesnt_tolerate: 'La mentira',
                persona_doesnt_care: 'El clima'
            });
        });

        test('should return error when user not found', async () => {
            mockSupabaseClient.update.mockReturnValue(mockSupabaseClient);
            mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
            mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
            mockSupabaseClient.single.mockResolvedValue({
                data: null,
                error: { message: 'User not found' }
            });

            const response = await request(app)
                .patch('/api/admin/users/nonexistent/config')
                .send({ plan: 'pro' })
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to update user configuration');
        });

        test('should validate required userId parameter', async () => {
            const response = await request(app)
                .patch('/api/admin/users//config')
                .send({ plan: 'pro' })
                .expect(404); // Express will return 404 for invalid route

            // Route won't match without userId, so we expect 404
        });
    });

    describe('POST /api/admin/users/:userId/reauth-integrations', () => {
        test('should invalidate user integration tokens successfully', async () => {
            const mockUser = { id: 'user-123', email: 'test@example.com' };

            // Mock user lookup
            mockSupabaseClient.from.mockImplementation((table) => {
                if (table === 'users') {
                    return {
                        select: () => ({
                            eq: () => ({
                                single: () => Promise.resolve({
                                    data: mockUser,
                                    error: null
                                })
                            })
                        })
                    };
                }
                // Mock integration token updates
                return {
                    update: () => ({
                        eq: () => Promise.resolve({ error: null })
                    })
                };
            });

            const response = await request(app)
                .post('/api/admin/users/user-123/reauth-integrations')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.message).toContain('Integration tokens invalidated');
            expect(response.body.data.message).toContain(mockUser.email);
        });

        test('should return error when user not found', async () => {
            mockSupabaseClient.from.mockReturnValue({
                select: () => ({
                    eq: () => ({
                        single: () => Promise.resolve({
                            data: null,
                            error: { message: 'User not found' }
                        })
                    })
                })
            });

            const response = await request(app)
                .post('/api/admin/users/nonexistent/reauth-integrations')
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('User not found');
        });
    });

    describe('GET /api/admin/users/:userId/activity', () => {
        test('should fetch user activity data successfully', async () => {
            const mockUser = { id: 'user-123', email: 'test@example.com' };
            const mockRoasts = [
                {
                    id: 'roast-1',
                    original_comment: 'Test comment',
                    roast_response: 'Test roast',
                    platform: 'twitter',
                    created_at: '2024-01-15T10:00:00Z'
                }
            ];
            const mockShieldIntercepts = [
                {
                    id: 'shield-1',
                    comment_text: 'Toxic comment',
                    platform: 'youtube',
                    action_taken: 'blocked',
                    created_at: '2024-01-15T09:00:00Z'
                }
            ];
            const mockIntegrations = [
                {
                    platform: 'twitter',
                    status: 'connected',
                    handle: 'testuser'
                }
            ];

            mockSupabaseClient.from.mockImplementation((table) => {
                switch (table) {
                    case 'users':
                        return {
                            select: () => ({
                                eq: () => ({
                                    single: () => Promise.resolve({
                                        data: mockUser,
                                        error: null
                                    })
                                })
                            })
                        };
                    case 'roast_responses':
                        return {
                            select: () => ({
                                eq: () => ({
                                    order: () => ({
                                        limit: () => Promise.resolve({
                                            data: mockRoasts,
                                            error: null
                                        })
                                    })
                                })
                            })
                        };
                    case 'shield_actions':
                        return {
                            select: () => ({
                                eq: () => ({
                                    order: () => ({
                                        limit: () => Promise.resolve({
                                            data: mockShieldIntercepts,
                                            error: null
                                        })
                                    })
                                })
                            })
                        };
                    case 'user_integrations':
                        return {
                            select: () => ({
                                eq: () => Promise.resolve({
                                    data: mockIntegrations,
                                    error: null
                                })
                            })
                        };
                }
            });

            const response = await request(app)
                .get('/api/admin/users/user-123/activity')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.user).toEqual(mockUser);
            expect(response.body.data.recent_roasts).toEqual(mockRoasts);
            expect(response.body.data.shield_intercepts).toEqual(mockShieldIntercepts);
            expect(response.body.data.integrations_status).toEqual(mockIntegrations);
        });

        test('should handle missing user gracefully', async () => {
            mockSupabaseClient.from.mockReturnValue({
                select: () => ({
                    eq: () => ({
                        single: () => Promise.resolve({
                            data: null,
                            error: { message: 'User not found' }
                        })
                    })
                })
            });

            const response = await request(app)
                .get('/api/admin/users/nonexistent/activity')
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('User not found');
        });

        test('should handle database errors gracefully', async () => {
            mockSupabaseClient.from.mockImplementation((table) => {
                if (table === 'users') {
                    return {
                        select: () => ({
                            eq: () => ({
                                single: () => Promise.resolve({
                                    data: { id: 'user-123', email: 'test@example.com' },
                                    error: null
                                })
                            })
                        })
                    };
                }
                // Simulate database errors for other tables
                return {
                    select: () => ({
                        eq: () => ({
                            order: () => ({
                                limit: () => Promise.resolve({
                                    data: null,
                                    error: { message: 'Database error' }
                                })
                            }),
                            single: () => Promise.resolve({
                                data: null,
                                error: { message: 'Database error' }
                            })
                        })
                    })
                };
            });

            const response = await request(app)
                .get('/api/admin/users/user-123/activity')
                .expect(200);

            // Should still return success but with empty arrays
            expect(response.body.success).toBe(true);
            expect(response.body.data.recent_roasts).toEqual([]);
            expect(response.body.data.shield_intercepts).toEqual([]);
            expect(response.body.data.integrations_status).toEqual([]);
        });

        test('should respect limit parameter', async () => {
            const mockUser = { id: 'user-123', email: 'test@example.com' };

            mockSupabaseClient.from.mockImplementation((table) => {
                if (table === 'users') {
                    return {
                        select: () => ({
                            eq: () => ({
                                single: () => Promise.resolve({
                                    data: mockUser,
                                    error: null
                                })
                            })
                        })
                    };
                }
                return {
                    select: () => ({
                        eq: () => ({
                            order: () => ({
                                limit: jest.fn().mockResolvedValue({
                                    data: [],
                                    error: null
                                })
                            })
                        })
                    })
                };
            });

            await request(app)
                .get('/api/admin/users/user-123/activity?limit=5')
                .expect(200);

            // Verify that limit was called with correct value
            const limitCalls = mockSupabaseClient.from().select().eq().order().limit.mock.calls;
            expect(limitCalls.length).toBe(2); // Called for roasts and shield intercepts
            expect(limitCalls[0][0]).toBe(5);
            expect(limitCalls[1][0]).toBe(5);
        });
    });
});