/**
 * Worker notification service for plan changes and limit updates
 * Handles real-time worker reconfiguration when user plans change
 */

const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');
const planLimitsService = require('./planLimitsService');

class WorkerNotificationService {
    constructor() {
        this.subscribers = new Map(); // In-memory subscribers for development
        this.init();
    }

    /**
     * Initialize worker notification service
     */
    init() {
        // In production, this would connect to Redis pub/sub or message queue
        logger.info('🔄 Worker notification service initialized');
    }

    /**
     * Notify workers of plan changes
     * @param {string} userId - User ID
     * @param {string} oldPlan - Previous plan
     * @param {string} newPlan - New plan
     * @param {string} status - Subscription status
     */
    async notifyPlanChange(userId, oldPlan, newPlan, status) {
        const message = {
            type: 'PLAN_CHANGE',
            userId,
            oldPlan,
            newPlan,
            status,
            timestamp: new Date().toISOString(),
            limits: await this.getPlanLimits(newPlan, status)
        };

        try {
            // In development/test, use in-memory notifications
            if (process.env.NODE_ENV !== 'production') {
                this.notifyInMemory('plan_changes', message);
            } else {
                // In production, use Redis pub/sub
                await this.publishToRedis('plan_changes', message);
            }

            logger.info('🔄 Plan change notification sent:', {
                userId,
                oldPlan,
                newPlan,
                status
            });

            return { success: true };
        } catch (error) {
            logger.error('🔄 Failed to notify plan change:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Notify workers of subscription status changes
     * @param {string} userId - User ID
     * @param {string} plan - Current plan
     * @param {string} status - New subscription status
     */
    async notifyStatusChange(userId, plan, status) {
        const message = {
            type: 'STATUS_CHANGE',
            userId,
            plan,
            status,
            timestamp: new Date().toISOString(),
            limits: await this.getPlanLimits(plan, status)
        };

        try {
            if (process.env.NODE_ENV !== 'production') {
                this.notifyInMemory('status_changes', message);
            } else {
                await this.publishToRedis('status_changes', message);
            }

            logger.info('🔄 Status change notification sent:', {
                userId,
                plan,
                status
            });

            return { success: true };
        } catch (error) {
            logger.error('🔄 Failed to notify status change:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get plan limits configuration from database
     * @param {string} plan - Plan name
     * @param {string} status - Subscription status
     * @returns {Object} Plan limits
     */
    async getPlanLimits(plan, status) {
        try {
            // Get limits from database via planLimitsService
            const planLimits = await planLimitsService.getPlanLimits(plan);
            
            // If subscription is not active, apply trial plan limits (most restrictive)
            if (status !== 'active') {
                const trialLimits = await planLimitsService.getPlanLimits('starter_trial');
                return {
                    ...planLimits,
                    ...trialLimits,
                    suspended: true
                };
            }

            return planLimits;
        } catch (error) {
            logger.error('Failed to get plan limits:', error);
            // Fallback to hardcoded defaults on error
            return this.getFallbackLimits(plan, status);
        }
    }

    /**
     * Get fallback limits (used when database is unavailable)
     * Issue #841: Now reads from planService.js (single source of truth)
     * @private
     */
    getFallbackLimits(plan, status) {
        // Use planService.js as single source of truth
        const { getPlanLimits } = require('./planService');
        
        const planLimits = getPlanLimits(plan) || getPlanLimits('starter_trial');

        if (status !== 'active') {
            const trialLimits = getPlanLimits('starter_trial');
            return {
                ...planLimits,
                ...trialLimits,
                suspended: true
            };
        }

        return planLimits;
    }

    /**
     * Notify in-memory subscribers (for development)
     * @param {string} channel - Channel name
     * @param {Object} message - Message data
     */
    notifyInMemory(channel, message) {
        const channelSubscribers = this.subscribers.get(channel) || [];
        
        for (const callback of channelSubscribers) {
            try {
                callback(message);
            } catch (error) {
                logger.error('🔄 Error in subscriber callback:', error);
            }
        }

        logger.debug('🔄 In-memory notification sent:', {
            channel,
            subscribers: channelSubscribers.length,
            messageType: message.type
        });
    }

    /**
     * Publish to Redis (for production)
     * @param {string} channel - Redis channel
     * @param {Object} message - Message data
     */
    async publishToRedis(channel, message) {
        // This would be implemented with actual Redis client in production
        try {
            // const redis = require('./redisClient');
            // await redis.publish(`worker:${channel}`, JSON.stringify(message));
            
            logger.info('🔄 Redis notification would be sent:', {
                channel: `worker:${channel}`,
                messageType: message.type
            });
        } catch (error) {
            logger.error('🔄 Redis publish error:', error);
            throw error;
        }
    }

    /**
     * Subscribe to plan changes (for development)
     * @param {string} channel - Channel name
     * @param {Function} callback - Callback function
     */
    subscribe(channel, callback) {
        if (!this.subscribers.has(channel)) {
            this.subscribers.set(channel, []);
        }
        
        this.subscribers.get(channel).push(callback);
        
        logger.info('🔄 Subscriber added:', {
            channel,
            totalSubscribers: this.subscribers.get(channel).length
        });
    }

    /**
     * Unsubscribe from channel
     * @param {string} channel - Channel name
     * @param {Function} callback - Callback function to remove
     */
    unsubscribe(channel, callback) {
        const channelSubscribers = this.subscribers.get(channel);
        if (channelSubscribers) {
            const index = channelSubscribers.indexOf(callback);
            if (index > -1) {
                channelSubscribers.splice(index, 1);
            }
        }
    }

    /**
     * Get current subscriber stats
     * @returns {Object} Subscriber statistics
     */
    getStats() {
        const stats = {};
        for (const [channel, subscribers] of this.subscribers.entries()) {
            stats[channel] = subscribers.length;
        }
        
        return {
            channels: Object.keys(stats).length,
            totalSubscribers: Object.values(stats).reduce((sum, count) => sum + count, 0),
            channelStats: stats
        };
    }

    /**
     * Notify workers to reload user configuration
     * @param {string} userId - User ID
     * @param {Object} config - Configuration changes
     */
    async notifyConfigChange(userId, config) {
        const message = {
            type: 'CONFIG_CHANGE',
            userId,
            config,
            timestamp: new Date().toISOString()
        };

        try {
            if (process.env.NODE_ENV !== 'production') {
                this.notifyInMemory('config_changes', message);
            } else {
                await this.publishToRedis('config_changes', message);
            }

            logger.info('🔄 Config change notification sent:', {
                userId,
                configKeys: Object.keys(config)
            });

            return { success: true };
        } catch (error) {
            logger.error('🔄 Failed to notify config change:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Broadcast system-wide notification to all workers
     * @param {Object} message - System message
     */
    async broadcastSystemMessage(message) {
        const systemMessage = {
            type: 'SYSTEM_MESSAGE',
            ...message,
            timestamp: new Date().toISOString()
        };

        try {
            if (process.env.NODE_ENV !== 'production') {
                this.notifyInMemory('system_messages', systemMessage);
            } else {
                await this.publishToRedis('system_messages', systemMessage);
            }

            logger.info('🔄 System message broadcast:', {
                messageType: message.type || 'GENERAL',
                content: message.content?.substring(0, 50) + '...'
            });

            return { success: true };
        } catch (error) {
            logger.error('🔄 Failed to broadcast system message:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Notify workers of roasting state changes (Issue #596)
     * @param {string} userId - User ID
     * @param {boolean} enabled - Whether roasting is enabled
     * @param {Object} metadata - Additional metadata (reason, etc.)
     */
    async notifyRoastingStateChange(userId, enabled, metadata = {}) {
        const message = {
            type: 'ROASTING_STATE_CHANGE',
            userId,
            enabled,
            timestamp: new Date().toISOString(),
            ...metadata
        };

        try {
            if (process.env.NODE_ENV !== 'production') {
                this.notifyInMemory('roasting_state_changes', message);
            } else {
                await this.publishToRedis('roasting_state_changes', message);
            }

            logger.info('🔄 Roasting state change notification sent:', {
                userId,
                enabled,
                reason: metadata.reason
            });

            return { success: true };
        } catch (error) {
            logger.error('🔄 Failed to notify roasting state change:', error);
            return { success: false, error: error.message };
        }
    }
}

// Export singleton instance
module.exports = new WorkerNotificationService();