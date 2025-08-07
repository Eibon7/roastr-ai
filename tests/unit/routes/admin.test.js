const request = require('supertest');
const express = require('express');
const adminRoutes = require('../../../src/routes/admin');

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: {
        from: jest.fn(),
        auth: {
            admin: {
                createUser: jest.fn(),
                listUsers: jest.fn(),
                deleteUser: jest.fn()
            }
        }
    }
}));

jest.mock('../../../src/middleware/isAdmin', () => ({
    isAdminMiddleware: (req, res, next) => {
        // Mock admin user
        req.user = {
            id: 'admin-123',
            email: 'admin@test.com',
            name: 'Admin User',
            is_admin: true
        };
        req.accessToken = 'valid-token';
        next();
    }
}));

jest.mock('../../../src/utils/logger', () => ({
    logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn()
    }
}));

jest.mock('child_process', () => ({
    exec: jest.fn()
}));

const { supabaseServiceClient } = require('../../../src/config/supabase');
const { exec } = require('child_process');

describe('Admin Routes', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/admin', adminRoutes);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Set default environment variables
        process.env.INTEGRATIONS_ENABLED = 'twitter,youtube,bluesky';
        process.env.SHIELD_ENABLED = 'true';
        process.env.DEBUG = 'false';
        process.env.NODE_ENV = 'test';
    });

    describe('GET /api/admin/dashboard', () => {
        test('should return dashboard data successfully', async () => {
            // Mock users query
            const mockUsersQuery = {
                select: jest.fn(() => ({
                    order: jest.fn(() => Promise.resolve({
                        data: [
                            { id: '1', is_admin: false, active: true, created_at: '2024-01-01' },
                            { id: '2', is_admin: true, active: true, created_at: '2024-01-15' },
                            { id: '3', is_admin: false, active: false, created_at: '2024-02-01' }
                        ],
                        error: null
                    }))
                }))
            };

            // Mock activities query
            const mockActivitiesQuery = {
                select: jest.fn(() => ({
                    gte: jest.fn(() => ({
                        order: jest.fn(() => ({
                            limit: jest.fn(() => Promise.resolve({
                                data: [
                                    { id: '1', platform: 'twitter', created_at: '2024-01-01' },
                                    { id: '2', platform: 'youtube', created_at: '2024-01-02' }
                                ],
                                error: null
                            }))
                        }))
                    }))
                }))
            };

            supabaseServiceClient.from
                .mockReturnValueOnce(mockUsersQuery)
                .mockReturnValueOnce(mockActivitiesQuery);

            const response = await request(app)
                .get('/api/admin/dashboard')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('users');
            expect(response.body.data).toHaveProperty('activity');
            expect(response.body.data).toHaveProperty('integrations');
            expect(response.body.data).toHaveProperty('system');

            expect(response.body.data.users.total).toBe(3);
            expect(response.body.data.users.active).toBe(2);
            expect(response.body.data.users.admins).toBe(1);
        });

        test('should handle database errors gracefully', async () => {
            const mockQuery = {
                select: jest.fn(() => ({
                    order: jest.fn(() => Promise.resolve({
                        data: null,
                        error: { message: 'Database error' }
                    }))
                }))
            };

            supabaseServiceClient.from.mockReturnValue(mockQuery);

            const response = await request(app)
                .get('/api/admin/dashboard')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to fetch dashboard data');
        });
    });

    describe('GET /api/admin/users', () => {
        test('should return users list with filters', async () => {
            const mockQuery = {
                select: jest.fn(() => ({
                    or: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            order: jest.fn(() => ({
                                range: jest.fn(() => Promise.resolve({
                                    data: [
                                        {
                                            id: 'user-1',
                                            email: 'user1@test.com',
                                            name: 'User One',
                                            is_admin: false,
                                            active: true,
                                            plan: 'basic'
                                        }
                                    ],
                                    error: null,
                                    count: 1
                                }))
                            }))
                        }))
                    }))
                }))
            };

            supabaseServiceClient.from.mockReturnValue(mockQuery);

            const response = await request(app)
                .get('/api/admin/users?search=user1&active_only=true&limit=10&offset=0')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.users).toHaveLength(1);
            expect(response.body.data.pagination).toHaveProperty('total', 1);
        });

        test('should handle empty results', async () => {
            const mockQuery = {
                select: jest.fn(() => ({
                    order: jest.fn(() => ({
                        range: jest.fn(() => Promise.resolve({
                            data: [],
                            error: null,
                            count: 0
                        }))
                    }))
                }))
            };

            supabaseServiceClient.from.mockReturnValue(mockQuery);

            const response = await request(app)
                .get('/api/admin/users')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.users).toHaveLength(0);
        });
    });

    describe('POST /api/admin/users/:userId/toggle-admin', () => {
        test('should toggle admin status successfully', async () => {
            const userId = 'user-123';

            // Mock current user fetch
            const mockFetchQuery = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        single: jest.fn(() => Promise.resolve({
                            data: {
                                email: 'user@test.com',
                                name: 'Test User',
                                is_admin: false
                            },
                            error: null
                        }))
                    }))
                }))
            };

            // Mock update query
            const mockUpdateQuery = {
                update: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        select: jest.fn(() => ({
                            single: jest.fn(() => Promise.resolve({
                                data: {
                                    id: userId,
                                    email: 'user@test.com',
                                    is_admin: true
                                },
                                error: null
                            }))
                        }))
                    }))
                }))
            };

            supabaseServiceClient.from
                .mockReturnValueOnce(mockFetchQuery)
                .mockReturnValueOnce(mockUpdateQuery);

            const response = await request(app)
                .post(`/api/admin/users/${userId}/toggle-admin`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.message).toContain('promovido a administrador');
        });

        test('should handle user not found', async () => {
            const userId = 'nonexistent-user';

            const mockQuery = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        single: jest.fn(() => Promise.resolve({
                            data: null,
                            error: { message: 'User not found' }
                        }))
                    }))
                }))
            };

            supabaseServiceClient.from.mockReturnValue(mockQuery);

            const response = await request(app)
                .post(`/api/admin/users/${userId}/toggle-admin`)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('User not found');
        });
    });

    describe('POST /api/admin/users/:userId/toggle-active', () => {
        test('should toggle active status successfully', async () => {
            const userId = 'user-123';

            // Mock current user fetch
            const mockFetchQuery = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        single: jest.fn(() => Promise.resolve({
                            data: {
                                email: 'user@test.com',
                                name: 'Test User',
                                active: true
                            },
                            error: null
                        }))
                    }))
                }))
            };

            // Mock update query
            const mockUpdateQuery = {
                update: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        select: jest.fn(() => ({
                            single: jest.fn(() => Promise.resolve({
                                data: {
                                    id: userId,
                                    email: 'user@test.com',
                                    active: false
                                },
                                error: null
                            }))
                        }))
                    }))
                }))
            };

            supabaseServiceClient.from
                .mockReturnValueOnce(mockFetchQuery)
                .mockReturnValueOnce(mockUpdateQuery);

            const response = await request(app)
                .post(`/api/admin/users/${userId}/toggle-active`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.message).toContain('desactivado exitosamente');
        });
    });

    describe('POST /api/admin/integrations/test', () => {
        test('should execute integration test successfully', async () => {
            const mockExec = exec;
            mockExec.mockImplementation((command, options, callback) => {
                const stdout = '✅ Integration test completed successfully';
                callback(null, stdout, '');
            });

            const response = await request(app)
                .post('/api/admin/integrations/test')
                .send({ platforms: 'twitter,youtube' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.output).toContain('Integration test completed successfully');
            expect(mockExec).toHaveBeenCalledWith(
                'INTEGRATIONS_ENABLED=twitter,youtube npm run integrations:test',
                expect.any(Object),
                expect.any(Function)
            );
        });

        test('should handle integration test failure', async () => {
            const mockExec = exec;
            mockExec.mockImplementation((command, options, callback) => {
                const error = new Error('Test failed');
                callback(error, '', 'Integration test failed');
            });

            const response = await request(app)
                .post('/api/admin/integrations/test')
                .send({})
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Test execution failed');
        });
    });

    describe('GET /api/admin/config', () => {
        test('should return system configuration', async () => {
            // Mock database config query
            const mockQuery = {
                select: jest.fn(() => ({
                    limit: jest.fn(() => Promise.resolve({
                        data: [
                            {
                                platform: 'twitter',
                                enabled: true,
                                tone: 'sarcastic',
                                response_frequency: 1.0
                            }
                        ],
                        error: null
                    }))
                }))
            };

            supabaseServiceClient.from.mockReturnValue(mockQuery);

            const response = await request(app)
                .get('/api/admin/config')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('env_config');
            expect(response.body.data).toHaveProperty('database_config');
            expect(response.body.data.env_config.integrations.enabled).toBe('twitter,youtube,bluesky');
        });
    });

    describe('GET /api/admin/logs', () => {
        test('should return logs successfully', async () => {
            const mockQuery = {
                select: jest.fn(() => ({
                    order: jest.fn(() => ({
                        limit: jest.fn(() => Promise.resolve({
                            data: [
                                {
                                    id: '1',
                                    level: 'info',
                                    category: 'integration',
                                    message: 'Test log entry',
                                    platform: 'twitter',
                                    created_at: '2024-01-01T12:00:00Z'
                                }
                            ],
                            error: null
                        }))
                    }))
                }))
            };

            supabaseServiceClient.from.mockReturnValue(mockQuery);

            const response = await request(app)
                .get('/api/admin/logs?type=integration&limit=50')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.logs).toHaveLength(1);
            expect(response.body.data.filtered_by).toBe('integration');
        });

        test('should handle logs fetch error with fallback data', async () => {
            const mockQuery = {
                select: jest.fn(() => ({
                    order: jest.fn(() => ({
                        limit: jest.fn(() => Promise.resolve({
                            data: null,
                            error: { message: 'Table not found' }
                        }))
                    }))
                }))
            };

            supabaseServiceClient.from.mockReturnValue(mockQuery);

            const response = await request(app)
                .get('/api/admin/logs')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.logs).toHaveLength(2); // Sample logs
        });
    });

    describe('GET /api/admin/logs/download', () => {
        test('should download logs as text file', async () => {
            const mockQuery = {
                select: jest.fn(() => ({
                    order: jest.fn(() => ({
                        limit: jest.fn(() => Promise.resolve({
                            data: [
                                {
                                    id: '1',
                                    level: 'info',
                                    category: 'integration',
                                    message: 'Test log entry',
                                    platform: 'twitter',
                                    created_at: '2024-01-01T12:00:00Z',
                                    metadata: { test: 'data' }
                                }
                            ],
                            error: null
                        }))
                    }))
                }))
            };

            supabaseServiceClient.from.mockReturnValue(mockQuery);

            const response = await request(app)
                .get('/api/admin/logs/download')
                .expect(200);

            expect(response.header['content-type']).toBe('text/plain; charset=utf-8');
            expect(response.header['content-disposition']).toMatch(/attachment; filename="roastr-logs-/);
            expect(response.text).toContain('Roastr.ai Admin Panel - Logs Export');
            expect(response.text).toContain('Test log entry');
        });
    });
});