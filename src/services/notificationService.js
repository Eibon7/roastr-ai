/**
 * In-app notification service for user events
 * Manages notifications for billing, subscriptions, and system events
 */

const { supabaseServiceClient } = require('../config/supabase');
const { logger } = require('../utils/logger');

class NotificationService {
  /**
   * Create a new notification
   * @param {Object} notification - Notification data
   * @param {string} notification.userId - Target user ID
   * @param {string} notification.type - Notification type
   * @param {string} notification.title - Notification title
   * @param {string} notification.message - Notification message
   * @param {Object} notification.metadata - Additional metadata
   * @param {string} notification.priority - Priority level (low, normal, high, urgent)
   * @param {boolean} notification.showBanner - Show as banner/alert
   * @param {string} notification.bannerVariant - Banner style
   * @param {boolean} notification.actionRequired - Action required flag
   * @param {string} notification.actionUrl - Action URL
   * @param {string} notification.actionText - Action button text
   * @param {Date} notification.expiresAt - Expiration date
   * @returns {Promise<Object>} Created notification
   */
  async createNotification({
    userId,
    type,
    title,
    message,
    metadata = {},
    priority = 'normal',
    showBanner = false,
    bannerVariant = 'info',
    actionRequired = false,
    actionUrl = null,
    actionText = null,
    expiresAt = null
  }) {
    try {
      const { data, error } = await supabaseServiceClient
        .from('user_notifications')
        .insert({
          user_id: userId,
          type,
          title,
          message,
          metadata,
          priority,
          show_banner: showBanner,
          banner_variant: bannerVariant,
          action_required: actionRequired,
          action_url: actionUrl,
          action_text: actionText,
          expires_at: expiresAt?.toISOString() || null
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('📝 Notification created:', {
        userId,
        type,
        title,
        priority,
        showBanner
      });

      return { success: true, data };
    } catch (error) {
      logger.error('📝 Failed to create notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create payment failed notification
   * @param {string} userId - User ID
   * @param {Object} subscriptionData - Subscription details
   * @returns {Promise<Object>} Result
   */
  async createPaymentFailedNotification(userId, subscriptionData) {
    return await this.createNotification({
      userId,
      type: 'payment_failed',
      title: 'Payment Failed',
      message: `Your payment for the ${subscriptionData.planName} plan could not be processed. Please update your payment method to avoid service interruption.`,
      metadata: {
        planName: subscriptionData.planName,
        failedAmount: subscriptionData.failedAmount,
        nextAttemptDate: subscriptionData.nextAttemptDate
      },
      priority: 'high',
      showBanner: true,
      bannerVariant: 'error',
      actionRequired: true,
      actionUrl: process.env.STRIPE_PORTAL_RETURN_URL || '/billing',
      actionText: 'Update Payment Method',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
  }

  /**
   * Create subscription canceled notification
   * @param {string} userId - User ID
   * @param {Object} subscriptionData - Subscription details
   * @returns {Promise<Object>} Result
   */
  async createSubscriptionCanceledNotification(userId, subscriptionData) {
    return await this.createNotification({
      userId,
      type: 'subscription_canceled',
      title: 'Subscription Canceled',
      message: `Your ${subscriptionData.planName} subscription has been canceled. You'll retain access until ${subscriptionData.accessUntilDate}.`,
      metadata: {
        planName: subscriptionData.planName,
        cancellationDate: subscriptionData.cancellationDate,
        accessUntilDate: subscriptionData.accessUntilDate
      },
      priority: 'normal',
      showBanner: true,
      bannerVariant: 'warning',
      actionRequired: false,
      actionUrl: process.env.STRIPE_PORTAL_RETURN_URL || '/billing',
      actionText: 'Reactivate Subscription',
      expiresAt: new Date(subscriptionData.accessUntilDate)
    });
  }

  /**
   * Create upgrade success notification
   * @param {string} userId - User ID
   * @param {Object} subscriptionData - Subscription details
   * @returns {Promise<Object>} Result
   */
  async createUpgradeSuccessNotification(userId, subscriptionData) {
    return await this.createNotification({
      userId,
      type: 'upgrade_success',
      title: 'Plan Upgraded Successfully!',
      message: `Welcome to ${subscriptionData.newPlanName}! Your new features are now active and ready to use.`,
      metadata: {
        oldPlanName: subscriptionData.oldPlanName,
        newPlanName: subscriptionData.newPlanName,
        newFeatures: subscriptionData.newFeatures,
        activationDate: subscriptionData.activationDate
      },
      priority: 'normal',
      showBanner: true,
      bannerVariant: 'success',
      actionRequired: false,
      actionUrl: process.env.APP_URL || '/dashboard',
      actionText: 'Explore New Features',
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
    });
  }

  /**
   * Create subscription status notification (past_due, etc.)
   * @param {string} userId - User ID
   * @param {Object} statusData - Status details
   * @returns {Promise<Object>} Result
   */
  async createSubscriptionStatusNotification(userId, statusData) {
    let title, message, priority, bannerVariant, actionRequired;

    switch (statusData.status) {
      case 'past_due':
        title = 'Payment Past Due';
        message = `Your subscription payment is past due. Please update your payment method to restore full access.`;
        priority = 'high';
        bannerVariant = 'error';
        actionRequired = true;
        break;
      case 'unpaid':
        title = 'Subscription Suspended';
        message = `Your subscription has been suspended due to unpaid invoices. Update your payment to reactivate.`;
        priority = 'urgent';
        bannerVariant = 'error';
        actionRequired = true;
        break;
      case 'incomplete':
        title = 'Setup Required';
        message = `Your subscription setup is incomplete. Please complete the setup to activate your plan.`;
        priority = 'high';
        bannerVariant = 'warning';
        actionRequired = true;
        break;
      default:
        title = 'Subscription Status Update';
        message = `Your subscription status has been updated to ${statusData.status}.`;
        priority = 'normal';
        bannerVariant = 'info';
        actionRequired = false;
    }

    return await this.createNotification({
      userId,
      type: 'subscription_status',
      title,
      message,
      metadata: {
        status: statusData.status,
        planName: statusData.planName
      },
      priority,
      showBanner: true,
      bannerVariant,
      actionRequired,
      actionUrl: process.env.STRIPE_PORTAL_RETURN_URL || '/billing',
      actionText: 'Manage Billing',
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
    });
  }

  /**
   * Create plan change notification
   * @param {string} userId - User ID
   * @param {Object} changeData - Plan change details
   * @returns {Promise<Object>} Result
   */
  async createPlanChangeNotification(userId, changeData) {
    const isUpgrade = changeData.changeType === 'upgrade';
    const title = isUpgrade ? 'Plan Upgraded!' : 'Plan Changed';
    const message = isUpgrade
      ? `You've successfully upgraded from ${changeData.oldPlanName} to ${changeData.newPlanName}. Enjoy your new features!`
      : `Your plan has been changed from ${changeData.oldPlanName} to ${changeData.newPlanName}.`;

    return await this.createNotification({
      userId,
      type: 'plan_change',
      title,
      message,
      metadata: {
        oldPlanName: changeData.oldPlanName,
        newPlanName: changeData.newPlanName,
        changeType: changeData.changeType,
        effectiveDate: new Date().toLocaleDateString()
      },
      priority: 'normal',
      showBanner: true,
      bannerVariant: isUpgrade ? 'success' : 'info',
      actionRequired: false,
      actionUrl: '/dashboard',
      actionText: 'View Dashboard',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });
  }

  /**
   * Create plan change blocked notification
   * @param {string} userId - User ID
   * @param {Object} blockData - Blocked change details
   * @returns {Promise<Object>} Result
   */
  async createPlanChangeBlockedNotification(userId, blockData) {
    return await this.createNotification({
      userId,
      type: 'plan_change_blocked',
      title: 'Plan Change Blocked',
      message: `Unable to change from ${blockData.oldPlan} to ${blockData.newPlan}. ${blockData.reason}`,
      metadata: {
        oldPlan: blockData.oldPlan,
        newPlan: blockData.newPlan,
        reason: blockData.reason,
        warnings: blockData.warnings
      },
      priority: 'high',
      showBanner: true,
      bannerVariant: 'warning',
      actionRequired: true,
      actionUrl: '/usage',
      actionText: 'View Usage',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
  }

  /**
   * Get user notifications with cursor-based pagination
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @param {string} options.status - Filter by status (unread, read, archived)
   * @param {string} options.type - Filter by type
   * @param {boolean} options.includeExpired - Include expired notifications
   * @param {number} options.limit - Result limit
   * @param {string} options.cursor - Cursor for pagination (ISO timestamp)
   * @param {number} options.offset - Result offset (legacy support)
   * @returns {Promise<Object>} Notifications list with pagination info
   */
  async getUserNotifications(
    userId,
    {
      status = null,
      type = null,
      includeExpired = false,
      limit = 50,
      cursor = null,
      offset = 0
    } = {}
  ) {
    const startTime = Date.now();
    try {
      let query = supabaseServiceClient
        .from('user_notifications')
        .select('*')
        .eq('user_id', userId);

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }

      if (type) {
        query = query.eq('type', type);
      }

      if (!includeExpired) {
        query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
      }

      // Apply cursor-based pagination if cursor is provided
      if (cursor) {
        // For cursor-based pagination, fetch records created before the cursor
        query = query
          .lt('created_at', cursor)
          .order('created_at', { ascending: false })
          .limit(limit + 1); // Fetch one extra to check if there are more
      } else {
        // Legacy offset-based pagination
        query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const notifications = data || [];

      // For cursor-based pagination, check if there are more results
      let hasMore = false;
      let nextCursor = null;

      if (cursor) {
        hasMore = notifications.length > limit;
        if (hasMore) {
          // Remove the extra record and set the next cursor
          notifications.pop();
        }
        // Fix nextCursor assignment: only set cursor when hasMore AND notifications exist
        nextCursor =
          notifications.length > 0 && hasMore
            ? notifications[notifications.length - 1]?.created_at
            : null;
      } else {
        // Legacy: hasMore detection for offset pagination
        // This is less accurate but maintains backward compatibility
        hasMore = notifications.length === limit;
      }

      // Log query duration for performance monitoring
      const queryDuration = Date.now() - startTime;
      const paginationType = cursor !== null ? 'cursor' : 'offset';

      logger.info('📝 Notifications query completed:', {
        userId: userId.substring(0, 8) + '***', // Safe logging
        paginationType,
        cursor: cursor ? cursor.substring(0, 19) + '...' : null,
        limit,
        resultCount: notifications.length,
        hasMore,
        queryDuration: `${queryDuration}ms`,
        filters: { status, type, includeExpired }
      });

      return {
        success: true,
        data: notifications,
        hasMore,
        nextCursor
      };
    } catch (error) {
      logger.error('📝 Failed to get user notifications:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark notification as read
   * @param {string} userId - User ID
   * @param {string} notificationId - Notification ID
   * @returns {Promise<Object>} Result
   */
  async markAsRead(userId, notificationId) {
    try {
      const { data, error } = await supabaseServiceClient
        .from('user_notifications')
        .update({
          status: 'read',
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('📝 Notification marked as read:', {
        userId,
        notificationId
      });

      return { success: true, data };
    } catch (error) {
      logger.error('📝 Failed to mark notification as read:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result
   */
  async markAllAsRead(userId) {
    try {
      const { data, error } = await supabaseServiceClient
        .from('user_notifications')
        .update({
          status: 'read',
          read_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('status', 'unread');

      if (error) {
        throw error;
      }

      logger.info('📝 All notifications marked as read:', {
        userId,
        updated: data?.length || 0
      });

      return { success: true, count: data?.length || 0 };
    } catch (error) {
      logger.error('📝 Failed to mark all notifications as read:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get unread notification count
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Count result
   */
  async getUnreadCount(userId) {
    try {
      const { count, error } = await supabaseServiceClient
        .from('user_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'unread')
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

      if (error) {
        throw error;
      }

      return { success: true, count: count || 0 };
    } catch (error) {
      logger.error('📝 Failed to get unread count:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up expired notifications
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupExpired() {
    try {
      const { error } = await supabaseServiceClient.rpc('cleanup_expired_notifications');

      if (error) {
        throw error;
      }

      logger.info('📝 Expired notifications cleaned up');
      return { success: true };
    } catch (error) {
      logger.error('📝 Failed to cleanup expired notifications:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
module.exports = new NotificationService();
