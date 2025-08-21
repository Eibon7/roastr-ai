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
                        count: 0
                    });

                    const response = await request(app)
                        .get(`/api/notifications?type=${type}`)
                        .expect(200);

                    expect(response.body).toEqual({
                        success: true,
                        data: {
                            notifications: [],
                            count: 0,
                            pagination: {
                                limit: 50,
                                offset: 0,
                                hasMore: false
                            }
                        }
                    });

                    expect(notificationService.getUserNotifications).toHaveBeenCalledWith('test-user-id', {
                        status: undefined,
                        type: type,
                        includeExpired: false,
                        limit: 50,
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
                    count: 0
                });

                const response = await request(app)
                    .get('/api/notifications')
                    .expect(200);

                expect(response.body).toEqual({
                    success: true,
                    data: {
                        notifications: [],
                        count: 0,
                        pagination: {
                            limit: 50,
                            offset: 0,
                            hasMore: false
                        }
                    }
                });

                expect(notificationService.getUserNotifications).toHaveBeenCalledWith('test-user-id', {
                    status: undefined,
                    type: undefined,
                    includeExpired: false,
                    limit: 50,
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
                        count: 0
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
                    count: 0
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
    });
});