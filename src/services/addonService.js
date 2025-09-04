/**
 * Addon Service for managing user addon credits and features
 * Issue #260: Settings → Shop functionality
 */

const { supabaseServiceClient } = require('../config/supabase');
const logger = require('../utils/logger');

class AddonService {
    /**
     * Get user's available addon credits by category
     * @param {string} userId - User ID
     * @param {string} category - Addon category ('roasts', 'analysis')
     * @returns {Promise<number>} Available credits
     */
    async getUserAddonCredits(userId, category) {
        try {
            const { data: credits, error } = await supabaseServiceClient
                .rpc('get_user_addon_credits', {
                    p_user_id: userId,
                    p_addon_category: category
                });

            if (error) {
                logger.error('Failed to get user addon credits:', {
                    userId,
                    category,
                    error
                });
                return 0;
            }

            return credits || 0;
        } catch (error) {
            logger.error('Error getting user addon credits:', {
                userId,
                category,
                error: error.message
            });
            return 0;
        }
    }

    /**
     * Consume addon credits for a user
     * @param {string} userId - User ID
     * @param {string} category - Addon category ('roasts', 'analysis')
     * @param {number} amount - Amount of credits to consume
     * @returns {Promise<boolean>} Success status
     */
    async consumeAddonCredits(userId, category, amount = 1) {
        try {
            const { data: success, error } = await supabaseServiceClient
                .rpc('consume_addon_credits', {
                    p_user_id: userId,
                    p_addon_category: category,
                    p_amount: amount
                });

            if (error) {
                logger.error('Failed to consume addon credits:', {
                    userId,
                    category,
                    amount,
                    error
                });
                return false;
            }

            if (success) {
                logger.info('Addon credits consumed successfully:', {
                    userId,
                    category,
                    amount
                });
            } else {
                logger.warn('Insufficient addon credits:', {
                    userId,
                    category,
                    amount
                });
            }

            return success || false;
        } catch (error) {
            logger.error('Error consuming addon credits:', {
                userId,
                category,
                amount,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Check if user has an active feature addon
     * @param {string} userId - User ID
     * @param {string} featureKey - Feature key ('rqc_enabled', etc.)
     * @returns {Promise<boolean>} Feature status
     */
    async userHasFeatureAddon(userId, featureKey) {
        try {
            const { data: hasFeature, error } = await supabaseServiceClient
                .rpc('user_has_feature_addon', {
                    p_user_id: userId,
                    p_feature_key: featureKey
                });

            if (error) {
                logger.error('Failed to check user feature addon:', {
                    userId,
                    featureKey,
                    error
                });
                return false;
            }

            return hasFeature || false;
        } catch (error) {
            logger.error('Error checking user feature addon:', {
                userId,
                featureKey,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Get user's addon summary (credits and features)
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Addon summary
     */
    async getUserAddonSummary(userId) {
        try {
            const [roastCredits, analysisCredits, rqcEnabled] = await Promise.all([
                this.getUserAddonCredits(userId, 'roasts'),
                this.getUserAddonCredits(userId, 'analysis'),
                this.userHasFeatureAddon(userId, 'rqc_enabled')
            ]);

            return {
                credits: {
                    roasts: roastCredits,
                    analysis: analysisCredits
                },
                features: {
                    rqc_enabled: rqcEnabled
                }
            };
        } catch (error) {
            logger.error('Error getting user addon summary:', {
                userId,
                error: error.message
            });
            return {
                credits: { roasts: 0, analysis: 0 },
                features: { rqc_enabled: false }
            };
        }
    }

    /**
     * Check if user can perform an action (considering plan limits + addon credits)
     * @param {string} userId - User ID
     * @param {string} action - Action type ('roast', 'analysis')
     * @param {Object} planLimits - User's plan limits
     * @param {Object} currentUsage - User's current usage
     * @returns {Promise<Object>} Permission result
     */
    async canPerformAction(userId, action, planLimits, currentUsage) {
        try {
            const categoryMap = {
                'roast': 'roasts',
                'analysis': 'analysis'
            };

            const category = categoryMap[action];
            if (!category) {
                return { allowed: false, reason: 'Invalid action type' };
            }

            // Check plan limits first (handle irregular plurals)
            const planKeyMap = { roast: 'monthly_roasts_limit', analysis: 'monthly_analyses_limit' };
            const usageKeyMap = { roast: 'roasts_used', analysis: 'analyses_used' };
            const planLimit = planLimits[planKeyMap[action]] ?? planLimits.monthly_responses_limit ?? 0;
            const usage = currentUsage[usageKeyMap[action]] ?? currentUsage.monthly_responses_used ?? 0;

            if (usage < planLimit) {
                return { 
                    allowed: true, 
                    source: 'plan',
                    remaining: planLimit - usage
                };
            }

            // Check addon credits
            const addonCredits = await this.getUserAddonCredits(userId, category);
            if (addonCredits > 0) {
                return { 
                    allowed: true, 
                    source: 'addon',
                    remaining: addonCredits
                };
            }

            return { 
                allowed: false, 
                reason: 'Limit exceeded and no addon credits available',
                planLimit,
                usage,
                addonCredits
            };

        } catch (error) {
            logger.error('Error checking action permission:', {
                userId,
                action,
                error: error.message
            });
            return { allowed: false, reason: 'Error checking permissions' };
        }
    }

    /**
     * Record action usage (consume from plan or addon credits)
     * @param {string} userId - User ID
     * @param {string} action - Action type ('roast', 'analysis')
     * @param {Object} planLimits - User's plan limits
     * @param {Object} currentUsage - User's current usage
     * @returns {Promise<Object>} Usage result
     */
    async recordActionUsage(userId, action, planLimits, currentUsage) {
        try {
            const permission = await this.canPerformAction(userId, action, planLimits, currentUsage);
            
            if (!permission.allowed) {
                return { success: false, reason: permission.reason };
            }

            if (permission.source === 'addon') {
                // Consume addon credits
                const categoryMap = { 'roast': 'roasts', 'analysis': 'analysis' };
                const category = categoryMap[action];
                
                const consumed = await this.consumeAddonCredits(userId, category, 1);
                if (!consumed) {
                    return { success: false, reason: 'Failed to consume addon credits' };
                }

                return { 
                    success: true, 
                    source: 'addon',
                    creditsRemaining: permission.remaining - 1
                };
            } else {
                // Usage will be recorded by the calling service against plan limits
                return { 
                    success: true, 
                    source: 'plan',
                    planRemaining: permission.remaining - 1
                };
            }

        } catch (error) {
            logger.error('Error recording action usage:', {
                userId,
                action,
                error: error.message
            });
            return { success: false, reason: 'Error recording usage' };
        }
    }

    /**
     * Check if RQC (Roastr Quality Check) is enabled for user
     * @param {string} userId - User ID
     * @returns {Promise<boolean>} RQC status
     */
    async isRQCEnabled(userId) {
        return this.userHasFeatureAddon(userId, 'rqc_enabled');
    }

    /**
     * Get addon purchase history for user
     * @param {string} userId - User ID
     * @param {number} limit - Number of records to return
     * @returns {Promise<Array>} Purchase history
     */
    async getAddonPurchaseHistory(userId, limit = 10) {
        try {
            const { data: purchases, error } = await supabaseServiceClient
                .from('addon_purchase_history')
                .select(`
                    addon_key,
                    amount_cents,
                    currency,
                    status,
                    completed_at,
                    created_at
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                logger.error('Failed to get addon purchase history:', {
                    userId,
                    error
                });
                return [];
            }

            return purchases || [];
        } catch (error) {
            logger.error('Error getting addon purchase history:', {
                userId,
                error: error.message
            });
            return [];
        }
    }
}

module.exports = new AddonService();
