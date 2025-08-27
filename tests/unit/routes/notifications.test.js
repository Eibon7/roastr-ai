/**
 * Unit tests for notifications routes
 * Tests notification endpoint validation and functionality
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('../../../src/middleware/auth', () => ({
    authenticateToken: jest.fn((req, res, next) => {
        req.user = { id: 'test-user-id', email: 'test@example.com' };
        next();
    })
}));

jest.mock('../../../src/services/notificationService', () => ({
    getUserNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn()
}));

jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: {
        from: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn()
    }
}));

const notificationService = require('../../../src/services/notificationService');
const notificationsRoutes = require('../../../src/routes/notifications');
const { supabaseServiceClient } = require('../../../src/config/supabase');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/notifications', notificationsRoutes);

describe('Notifications Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/notifications', () => {
        describe('Type parameter validation', () => {
            it('should accept valid notification types', async () => {
                const validTypes = [
                    'payment_failed',
                    'subscription_canceled', 
                    'upgrade_success',
                    'subscription_status',
                    'plan_change',
                    'plan_change_blocked'
                ];

                for (const type of validTypes) {
                    notificationService.getUserNotifications.mockResolvedValueOnce({
                        success: true,
                        data: [],
                        hasMore: false,
                        nextCursor: null
                    });

                    const response = await request(app)
                        .get(`/api/notifications?type=${type}`)
                        .expect(200);

                    expect(response.body).toEqual({
                        success: true,
                        data: {
                            notifications: [],
                            pagination: {
                                limit: 50,
                                hasMore: false,
                                offset: 0
                            }
                        }
                    });

                    expect(notificationService.getUserNotifications).toHaveBeenCalledWith('test-user-id', {
                        status: undefined,
                        type: type,
                        includeExpired: false,
                        limit: 50,
                        cursor: undefined,
                        offset: 0
                    });
                }
            });

            it('should return 400 for invalid notification type', async () => {
                const response = await request(app)
                    .get('/api/notifications?type=invalid_type')
                    .expect(400);

                expect(response.body).toEqual({
                    success: false,
                    error: 'Invalid notification type. Must be one of: payment_failed, subscription_canceled, upgrade_success, subscription_status, plan_change, plan_change_blocked'
                });

                expect(notificationService.getUserNotifications).not.toHaveBeenCalled();
            });

            it('should return 400 for arbitrary type values', async () => {
                const invalidTypes = [
                    'hack_attempt',
                    'sql_injection',
                    '../../../etc/passwd',
                    '<script>alert("xss")</script>',
                    'DROP TABLE users;',
                    '%00',
                    'null',
                    'undefined'
                ];

                for (const type of invalidTypes) {
                    const response = await request(app)
                        .get(`/api/notifications?type=${encodeURIComponent(type)}`)
                        .expect(400);

                    expect(response.body).toEqual({
                        success: false,
                        error: 'Invalid notification type. Must be one of: payment_failed, subscription_canceled, upgrade_success, subscription_status, plan_change, plan_change_blocked'
                    });

                    expect(notificationService.getUserNotifications).not.toHaveBeenCalled();
                }
            });

            it('should accept request without type parameter', async () => {
                notificationService.getUserNotifications.mockResolvedValueOnce({
                    success: true,
                    data: [],
                    hasMore: false,
                    nextCursor: null
                });

                const response = await request(app)
                    .get('/api/notifications')
                    .expect(200);

                expect(response.body).toEqual({
                    success: true,
                    data: {
                        notifications: [],
                        pagination: {
                            limit: 50,
                            hasMore: false,
                            offset: 0
                        }
                    }
                });

                expect(notificationService.getUserNotifications).toHaveBeenCalledWith('test-user-id', {
                    status: undefined,
                    type: undefined,
                    includeExpired: false,
                    limit: 50,
                    cursor: undefined,
                    offset: 0
                });
            });
        });

        describe('Status parameter validation', () => {
            it('should accept valid status values', async () => {
                const validStatuses = ['unread', 'read', 'archived'];

                for (const status of validStatuses) {
                    notificationService.getUserNotifications.mockResolvedValueOnce({
                        success: true,
                        data: [],
                        hasMore: false,
                        nextCursor: null
                    });

                    const response = await request(app)
                        .get(`/api/notifications?status=${status}`)
                        .expect(200);

                    expect(response.body.success).toBe(true);
                }
            });

            it('should return 400 for invalid status', async () => {
                const response = await request(app)
                    .get('/api/notifications?status=invalid_status')
                    .expect(400);

                expect(response.body).toEqual({
                    success: false,
                    error: 'Invalid status. Must be unread, read, or archived'
                });
            });
        });

        describe('Combined parameter validation', () => {
            it('should validate both type and status parameters', async () => {
                // Invalid type with valid status
                let response = await request(app)
                    .get('/api/notifications?type=invalid&status=unread')
                    .expect(400);

                expect(response.body.error).toContain('Invalid notification type');

                // Valid type with invalid status
                response = await request(app)
                    .get('/api/notifications?type=payment_failed&status=invalid')
                    .expect(400);

                expect(response.body.error).toContain('Invalid status');

                // Both valid
                notificationService.getUserNotifications.mockResolvedValueOnce({
                    success: true,
                    data: [],
                    hasMore: false,
                    nextCursor: null
                });

                response = await request(app)
                    .get('/api/notifications?type=payment_failed&status=unread')
                    .expect(200);

                expect(response.body.success).toBe(true);
            });
        });

        describe('Error handling', () => {
            it('should handle service errors gracefully', async () => {
                notificationService.getUserNotifications.mockResolvedValueOnce({
                    success: false,
                    error: 'Database connection failed'
                });

                const response = await request(app)
                    .get('/api/notifications')
                    .expect(500);

                expect(response.body).toEqual({
                    success: false,
                    error: 'Database connection failed'
                });
            });

            it('should handle unexpected errors', async () => {
                notificationService.getUserNotifications.mockRejectedValueOnce(new Error('Unexpected error'));

                const response = await request(app)
                    .get('/api/notifications')
                    .expect(500);

                expect(response.body).toEqual({
                    success: false,
                    error: 'Failed to fetch notifications'
                });
            });
        });

        describe('Cursor-based pagination', () => {
            it('should use cursor pagination when cursor is provided', async () => {
                const cursor = '2024-01-01T12:00:00.000Z';
                notificationService.getUserNotifications.mockResolvedValueOnce({
                    success: true,
                    data: [
                        { id: 'notif-1', created_at: '2024-01-01T11:00:00.000Z' },
                        { id: 'notif-2', created_at: '2024-01-01T10:00:00.000Z' }
                    ],
                    hasMore: true,
                    nextCursor: '2024-01-01T10:00:00.000Z'
                });

                const response = await request(app)
                    .get(`/api/notifications?cursor=${encodeURIComponent(cursor)}&limit=2`)
                    .expect(200);

                expect(response.body).toEqual({
                    success: true,
                    data: {
                        notifications: [
                            { id: 'notif-1', created_at: '2024-01-01T11:00:00.000Z' },
                            { id: 'notif-2', created_at: '2024-01-01T10:00:00.000Z' }
                        ],
                        pagination: {
                            limit: 2,
                            hasMore: true,
                            nextCursor: '2024-01-01T10:00:00.000Z'
                        }
                    }
                });

                expect(notificationService.getUserNotifications).toHaveBeenCalledWith('test-user-id', {
                    status: undefined,
                    type: undefined,
                    includeExpired: false,
                    limit: 2,
                    cursor: cursor,
                    offset: undefined
                });
            });

            it('should fall back to offset pagination when cursor is not provided', async () => {
                notificationService.getUserNotifications.mockResolvedValueOnce({
                    success: true,
                    data: [
                        { id: 'notif-1', created_at: '2024-01-01T12:00:00.000Z' }
                    ],
                    hasMore: false,
                    nextCursor: null
                });

                const response = await request(app)
                    .get('/api/notifications?offset=10&limit=1')
                    .expect(200);

                expect(response.body).toEqual({
                    success: true,
                    data: {
                        notifications: [
                            { id: 'notif-1', created_at: '2024-01-01T12:00:00.000Z' }
                        ],
                        pagination: {
                            limit: 1,
                            hasMore: false,
                            offset: 10
                        }
                    }
                });

                expect(notificationService.getUserNotifications).toHaveBeenCalledWith('test-user-id', {
                    status: undefined,
                    type: undefined,
                    includeExpired: false,
                    limit: 1,
                    cursor: undefined,
                    offset: 10
                });
            });

            it('should return 400 for invalid cursor format', async () => {
                const response = await request(app)
                    .get('/api/notifications?cursor=invalid-timestamp')
                    .expect(400);

                expect(response.body).toEqual({
                    success: false,
                    error: 'Invalid cursor. Must be a valid ISO timestamp'
                });

                expect(notificationService.getUserNotifications).not.toHaveBeenCalled();
            });

            it('should return 400 for empty cursor string', async () => {
                const response = await request(app)
                    .get('/api/notifications?cursor=')
                    .expect(400);

                expect(response.body).toEqual({
                    success: false,
                    error: 'Invalid cursor. Must be a valid ISO timestamp'
                });

                expect(notificationService.getUserNotifications).not.toHaveBeenCalled();
            });

            it('should return 400 for cursor with only whitespace', async () => {
                const response = await request(app)
                    .get('/api/notifications?cursor=   ')
                    .expect(400);

                expect(response.body).toEqual({
                    success: false,
                    error: 'Invalid cursor. Must be a valid ISO timestamp'
                });

                expect(notificationService.getUserNotifications).not.toHaveBeenCalled();
            });

            it('should combine cursor pagination with filters', async () => {
                const cursor = '2024-01-01T12:00:00.000Z';
                notificationService.getUserNotifications.mockResolvedValueOnce({
                    success: true,
                    data: [
                        { 
                            id: 'notif-1', 
                            created_at: '2024-01-01T11:00:00.000Z', 
                            status: 'unread',
                            type: 'payment_failed'
                        }
                    ],
                    hasMore: false,
                    nextCursor: '2024-01-01T11:00:00.000Z'
                });

                const response = await request(app)
                    .get(`/api/notifications?cursor=${encodeURIComponent(cursor)}&status=unread&type=payment_failed&include_expired=true`)
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data.notifications).toHaveLength(1);
                expect(response.body.data.pagination.nextCursor).toBe('2024-01-01T11:00:00.000Z');

                expect(notificationService.getUserNotifications).toHaveBeenCalledWith('test-user-id', {
                    status: 'unread',
                    type: 'payment_failed',
                    includeExpired: true,
                    limit: 50,
                    cursor: cursor,
                    offset: undefined
                });
            });

            it('should handle cursor with no more results', async () => {
                const cursor = '2024-01-01T12:00:00.000Z';
                notificationService.getUserNotifications.mockResolvedValueOnce({
                    success: true,
                    data: [],
                    hasMore: false,
                    nextCursor: null
                });

                const response = await request(app)
                    .get(`/api/notifications?cursor=${encodeURIComponent(cursor)}`)
                    .expect(200);

                expect(response.body).toEqual({
                    success: true,
                    data: {
                        notifications: [],
                        pagination: {
                            limit: 50,
                            hasMore: false,
                            nextCursor: null
                        }
                    }
                });
            });

            it('should set nextCursor=null when hasMore=false even with data', async () => {
                const cursor = '2024-01-01T12:00:00.000Z';
                notificationService.getUserNotifications.mockResolvedValueOnce({
                    success: true,
                    data: [
                        { id: 'notif-1', created_at: '2024-01-01T11:00:00.000Z' }
                    ],
                    hasMore: false,
                    nextCursor: null // Properly set to null when hasMore is false
                });

                const response = await request(app)
                    .get(`/api/notifications?cursor=${encodeURIComponent(cursor)}`)
                    .expect(200);

                expect(response.body).toEqual({
                    success: true,
                    data: {
                        notifications: [
                            { id: 'notif-1', created_at: '2024-01-01T11:00:00.000Z' }
                        ],
                        pagination: {
                            limit: 50,
                            hasMore: false,
                            nextCursor: null
                        }
                    }
                });

                expect(notificationService.getUserNotifications).toHaveBeenCalledWith('test-user-id', {
                    status: undefined,
                    type: undefined,
                    includeExpired: false,
                    limit: 50,
                    cursor: cursor,
                    offset: undefined
                });
            });

            it('should respect limit parameter with cursor pagination', async () => {
                const cursor = '2024-01-01T12:00:00.000Z';
                notificationService.getUserNotifications.mockResolvedValueOnce({
                    success: true,
                    data: Array.from({ length: 100 }, (_, i) => ({
                        id: `notif-${i}`,
                        created_at: `2024-01-01T${11-Math.floor(i/10)}:${i%10}0:00.000Z`
                    })),
                    hasMore: true,
                    nextCursor: '2024-01-01T01:00:00.000Z'
                });

                const response = await request(app)
                    .get(`/api/notifications?cursor=${encodeURIComponent(cursor)}&limit=150`)
                    .expect(200);

                // Should cap limit at 100
                expect(notificationService.getUserNotifications).toHaveBeenCalledWith('test-user-id', 
                    expect.objectContaining({
                        limit: 100
                    })
                );

                expect(response.body.data.pagination.limit).toBe(100);
            });
        });
    });
});