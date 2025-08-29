/**
 * Notifications routes for in-app notifications
 * Handles user notifications for billing, subscriptions, and system events
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const notificationService = require('../services/notificationService');
const { 
    notificationLimiter, 
    notificationMarkLimiter, 
    notificationDeleteLimiter 
} = require('../middleware/notificationRateLimiter');

const router = express.Router();

// Valid notification types
const VALID_NOTIFICATION_TYPES = [
    'payment_failed',
    'subscription_canceled',
    'upgrade_success',
    'subscription_status',
    'plan_change',
    'plan_change_blocked'
];

/**
 * GET /api/notifications
 * Get user notifications with cursor-based pagination for better performance
 * Query parameters:
 * - cursor: ISO timestamp of last item from previous page
 * - limit: Page size (default: 50, max: 100)
 * - status: Filter by status (unread, read, archived)
 * - type: Filter by notification type
 * - include_expired: Include expired notifications (default: false)
 */
router.get('/', notificationLimiter, authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            status,
            type,
            include_expired = 'false',
            limit = 50,
            cursor,
            // Legacy support for offset-based pagination
            offset
        } = req.query;

        // Validate parameters
        const parsedLimit = Math.min(parseInt(limit) || 50, 100); // Max 100
        const includeExpired = include_expired === 'true';

        if (status && !['unread', 'read', 'archived'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status. Must be unread, read, or archived'
            });
        }

        if (type && !VALID_NOTIFICATION_TYPES.includes(type)) {
            return res.status(400).json({
                success: false,
                error: `Invalid notification type. Must be one of: ${VALID_NOTIFICATION_TYPES.join(', ')}`
            });
        }

        // Validate cursor if provided
        if (cursor !== undefined && (!cursor.trim() || !Date.parse(cursor))) {
            return res.status(400).json({
                success: false,
                error: 'Invalid cursor. Must be a valid ISO timestamp'
            });
        }

        // Use cursor-based pagination if cursor is provided, otherwise fall back to offset
        const useCursorPagination = cursor !== undefined;
        
        const result = await notificationService.getUserNotifications(userId, {
            status,
            type,
            includeExpired,
            limit: parsedLimit,
            cursor: useCursorPagination ? cursor : undefined,
            offset: useCursorPagination ? undefined : (parseInt(offset) || 0)
        });

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        // Build pagination response
        const paginationResponse = {
            limit: parsedLimit,
            hasMore: result.hasMore
        };

        if (useCursorPagination) {
            paginationResponse.nextCursor = result.nextCursor || null;
        } else {
            // Legacy offset pagination
            const parsedOffset = parseInt(offset) || 0;
            paginationResponse.offset = parsedOffset;
        }

        res.json({
            success: true,
            data: {
                notifications: result.data,
                pagination: paginationResponse
            }
        });

    } catch (error) {
        logger.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch notifications'
        });
    }
});

/**
 * GET /api/notifications/count
 * Get unread notification count
 */
router.get('/count', notificationLimiter, authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await notificationService.getUnreadCount(userId);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        res.json({
            success: true,
            data: {
                unreadCount: result.count
            }
        });

    } catch (error) {
        logger.error('Error fetching notification count:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch notification count'
        });
    }
});

/**
 * POST /api/notifications/:id/mark-read
 * Mark a specific notification as read
 */
router.post('/:id/mark-read', notificationMarkLimiter, authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const notificationId = req.params.id;

        // Validate notification ID
        if (!notificationId || typeof notificationId !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Invalid notification ID'
            });
        }

        const result = await notificationService.markAsRead(userId, notificationId);

        if (!result.success) {
            if (result.error.includes('No rows found')) {
                return res.status(404).json({
                    success: false,
                    error: 'Notification not found'
                });
            }
            
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        res.json({
            success: true,
            data: {
                notification: result.data
            }
        });

    } catch (error) {
        logger.error('Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark notification as read'
        });
    }
});

/**
 * POST /api/notifications/mark-all-read
 * Mark all user notifications as read
 */
router.post('/mark-all-read', notificationMarkLimiter, authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await notificationService.markAllAsRead(userId);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        res.json({
            success: true,
            data: {
                markedAsRead: result.count
            }
        });

    } catch (error) {
        logger.error('Error marking all notifications as read:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark all notifications as read'
        });
    }
});

/**
 * GET /api/notifications/banners
 * Get active banner notifications that should be displayed prominently
 */
router.get('/banners', notificationLimiter, authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await notificationService.getUserNotifications(userId, {
            status: 'unread',
            includeExpired: false,
            limit: 10
        });

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        // Filter for banner notifications
        const bannerNotifications = result.data.filter(notification => 
            notification.show_banner === true
        );

        // Sort by priority
        const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
        bannerNotifications.sort((a, b) => 
            (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0)
        );

        res.json({
            success: true,
            data: {
                banners: bannerNotifications
            }
        });

    } catch (error) {
        logger.error('Error fetching banner notifications:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch banner notifications'
        });
    }
});

/**
 * DELETE /api/notifications/:id
 * Archive a notification (soft delete)
 */
router.delete('/:id', notificationDeleteLimiter, authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const notificationId = req.params.id;

        // Validate notification ID
        if (!notificationId || typeof notificationId !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Invalid notification ID'
            });
        }

        // Archive the notification instead of deleting
        const { supabaseServiceClient } = require('../config/supabase');
        const { data, error } = await supabaseServiceClient
            .from('user_notifications')
            .update({ status: 'archived' })
            .eq('id', notificationId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            if (error.details && error.details.includes('0 rows')) {
                return res.status(404).json({
                    success: false,
                    error: 'Notification not found'
                });
            }
            throw error;
        }

        logger.info('📝 Notification archived:', {
            userId,
            notificationId
        });

        res.json({
            success: true,
            data: {
                notification: data
            }
        });

    } catch (error) {
        logger.error('Error archiving notification:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to archive notification'
        });
    }
});

module.exports = router;