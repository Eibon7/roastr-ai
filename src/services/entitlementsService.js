/**
 * EntitlementsService - Issue #168
 * 
 * Manages user entitlements based on Stripe Price metadata
 * - Reads plan limits and features from Stripe Price metadata
 * - Persists entitlements to account_entitlements table
 * - Provides usage checking and enforcement
 * - Handles monthly usage counter resets
 */

const { supabaseServiceClient } = require('../config/supabase');
const StripeWrapper = require('./stripeWrapper');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

class EntitlementsService {
    constructor() {
        this.stripeWrapper = null;
        
        if (flags.isEnabled('ENABLE_BILLING')) {
            this.stripeWrapper = new StripeWrapper(process.env.STRIPE_SECRET_KEY);
        }
    }

    /**
     * Set user entitlements based on Stripe Price metadata
     * @param {string} userId - User ID
     * @param {string} stripePriceId - Stripe Price ID
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Result with success/error info
     */
    async setEntitlementsFromStripePrice(userId, stripePriceId, options = {}) {
        try {
            if (!this.stripeWrapper) {
                throw new Error('Stripe integration not enabled');
            }

            // Fetch price with metadata from Stripe
            const price = await this.stripeWrapper.prices.retrieve(stripePriceId, {
                expand: ['product']
            });

            if (!price) {
                throw new Error(`Price ${stripePriceId} not found`);
            }

            // Extract entitlements from price metadata
            const entitlements = this._extractEntitlementsFromPrice(price);
            
            // Persist to database
            const result = await this._persistEntitlements(userId, {
                ...entitlements,
                stripe_price_id: stripePriceId,
                stripe_product_id: price.product.id,
                metadata: {
                    updated_from: 'stripe_price',
                    price_lookup_key: price.lookup_key,
                    product_name: price.product.name,
                    updated_at: new Date().toISOString(),
                    ...options.metadata
                }
            });

            logger.info('Entitlements updated from Stripe Price', {
                userId,
                stripePriceId,
                planName: entitlements.plan_name,
                analysisLimit: entitlements.analysis_limit_monthly,
                roastLimit: entitlements.roast_limit_monthly
            });

            return {
                success: true,
                entitlements: result,
                source: 'stripe_price'
            };

        } catch (error) {
            logger.error('Failed to set entitlements from Stripe Price', {
                userId,
                stripePriceId,
                error: error.message
            });

            return {
                success: false,
                error: error.message,
                fallback_applied: await this._applyFallbackEntitlements(userId)
            };
        }
    }

    /**
     * Set entitlements directly (for free plans or manual updates)
     * @param {string} userId - User ID  
     * @param {Object} entitlements - Entitlements object
     * @returns {Promise<Object>} Result with success/error info
     */
    async setEntitlements(userId, entitlements) {
        try {
            const result = await this._persistEntitlements(userId, {
                ...entitlements,
                metadata: {
                    updated_from: 'direct',
                    updated_at: new Date().toISOString(),
                    ...entitlements.metadata
                }
            });

            logger.info('Entitlements updated directly', {
                userId,
                planName: entitlements.plan_name,
                analysisLimit: entitlements.analysis_limit_monthly,
                roastLimit: entitlements.roast_limit_monthly
            });

            return {
                success: true,
                entitlements: result,
                source: 'direct'
            };

        } catch (error) {
            logger.error('Failed to set entitlements directly', {
                userId,
                error: error.message
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get user entitlements
     * @param {string} userId - User ID
     * @returns {Promise<Object>} User entitlements or null
     */
    async getEntitlements(userId) {
        try {
            const { data, error } = await supabaseServiceClient
                .from('account_entitlements')
                .select('*')
                .eq('account_id', userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No entitlements found, return default free plan
                    return this._getDefaultEntitlements(userId);
                }
                throw error;
            }

            return data;

        } catch (error) {
            logger.error('Failed to get entitlements', {
                userId,
                error: error.message
            });

            // Return default entitlements on error
            return this._getDefaultEntitlements(userId);
        }
    }

    /**
     * Check if user can perform an action (analysis or roast)
     * @param {string} userId - User ID
     * @param {string} actionType - 'analysis' or 'roasts'
     * @returns {Promise<Object>} Result with allowed status and remaining usage
     */
    async checkUsageLimit(userId, actionType) {
        try {
            // Validate action type
            if (!['analysis', 'roasts'].includes(actionType)) {
                throw new Error(`Invalid action type: ${actionType}. Must be 'analysis' or 'roasts'`);
            }

            // Check using database function
            const { data, error } = await supabaseServiceClient
                .rpc('check_usage_limit', {
                    user_id: userId,
                    usage_type: actionType
                });

            if (error) {
                throw error;
            }

            const isAllowed = data === true;

            // Get current usage and limits for detailed response
            const [entitlements, usage] = await Promise.all([
                this.getEntitlements(userId),
                this.getCurrentUsage(userId)
            ]);

            const limitField = actionType === 'analysis' ? 'analysis_limit_monthly' : 'roast_limit_monthly';
            const usageField = actionType === 'analysis' ? 'analysis_used' : 'roasts_used';
            
            const limit = entitlements[limitField];
            const used = usage[usageField] || 0;
            const remaining = limit === -1 ? -1 : Math.max(0, limit - used);

            return {
                allowed: isAllowed,
                limit,
                used,
                remaining,
                action_type: actionType,
                unlimited: limit === -1,
                period_start: usage.period_start,
                period_end: usage.period_end
            };

        } catch (error) {
            logger.error('Failed to check usage limit', {
                userId,
                actionType,
                error: error.message
            });

            // Fail safe - deny on error
            return {
                allowed: false,
                error: error.message,
                action_type: actionType
            };
        }
    }

    /**
     * Increment usage counter
     * @param {string} userId - User ID
     * @param {string} actionType - 'analysis' or 'roasts'
     * @param {number} incrementBy - Amount to increment (default: 1)
     * @returns {Promise<Object>} Result with success status
     */
    async incrementUsage(userId, actionType, incrementBy = 1) {
        try {
            // Validate action type
            if (!['analysis', 'roasts'].includes(actionType)) {
                throw new Error(`Invalid action type: ${actionType}. Must be 'analysis' or 'roasts'`);
            }

            // Use database function to increment
            const { data, error } = await supabaseServiceClient
                .rpc('increment_usage', {
                    user_id: userId,
                    usage_type: actionType,
                    increment_by: incrementBy
                });

            if (error) {
                throw error;
            }

            logger.info('Usage incremented', {
                userId,
                actionType,
                incrementBy,
                success: data
            });

            return {
                success: data === true,
                action_type: actionType,
                incremented_by: incrementBy
            };

        } catch (error) {
            logger.error('Failed to increment usage', {
                userId,
                actionType,
                incrementBy,
                error: error.message
            });

            return {
                success: false,
                error: error.message,
                action_type: actionType
            };
        }
    }

    /**
     * Get current usage for user
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Current usage counters
     */
    async getCurrentUsage(userId) {
        try {
            const { data, error } = await supabaseServiceClient
                .from('usage_counters')
                .select('*')
                .eq('account_id', userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No usage record found, return zeros
                    return {
                        account_id: userId,
                        analysis_used: 0,
                        roasts_used: 0,
                        period_start: new Date().toISOString().split('T')[0],
                        period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
                    };
                }
                throw error;
            }

            return data;

        } catch (error) {
            logger.error('Failed to get current usage', {
                userId,
                error: error.message
            });

            // Return safe defaults on error
            return {
                account_id: userId,
                analysis_used: 0,
                roasts_used: 0,
                period_start: new Date().toISOString().split('T')[0],
                period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
            };
        }
    }

    /**
     * Reset monthly usage counters (for cron job)
     * @returns {Promise<Object>} Result with number of accounts reset
     */
    async resetMonthlyUsageCounters() {
        try {
            const { data, error } = await supabaseServiceClient
                .rpc('reset_monthly_usage_counters');

            if (error) {
                throw error;
            }

            logger.info('Monthly usage counters reset', {
                accounts_reset: data,
                reset_date: new Date().toISOString()
            });

            return {
                success: true,
                accounts_reset: data,
                reset_date: new Date().toISOString()
            };

        } catch (error) {
            logger.error('Failed to reset monthly usage counters', {
                error: error.message
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Extract entitlements from Stripe Price metadata
     * @private
     * @param {Object} price - Stripe Price object
     * @returns {Object} Entitlements object
     */
    _extractEntitlementsFromPrice(price) {
        const metadata = price.metadata || {};
        const productMetadata = price.product?.metadata || {};
        
        // Combine price and product metadata, with price taking precedence
        const combinedMetadata = { ...productMetadata, ...metadata };

        // Define default values based on lookup key or product name
        let defaults = this._getPlanDefaults(price.lookup_key || price.product?.name || '');

        return {
            analysis_limit_monthly: parseInt(combinedMetadata.analysis_limit_monthly || defaults.analysis_limit_monthly),
            roast_limit_monthly: parseInt(combinedMetadata.roast_limit_monthly || defaults.roast_limit_monthly),
            model: combinedMetadata.model || defaults.model,
            shield_enabled: combinedMetadata.shield_enabled === 'true' || defaults.shield_enabled,
            rqc_mode: combinedMetadata.rqc_mode || defaults.rqc_mode,
            plan_name: combinedMetadata.plan_name || defaults.plan_name
        };
    }

    /**
     * Get plan defaults based on lookup key or name
     * @private
     * @param {string} identifier - Price lookup key or product name
     * @returns {Object} Default entitlements
     */
    _getPlanDefaults(identifier) {
        const lowerIdentifier = identifier.toLowerCase();

        if (lowerIdentifier.includes('starter')) {
            return {
                analysis_limit_monthly: 1000,
                roast_limit_monthly: 10,
                model: 'gpt-4o',
                shield_enabled: true,
                rqc_mode: 'basic',
                plan_name: 'starter'
            };
        } else if (lowerIdentifier.includes('pro')) {
            return {
                analysis_limit_monthly: 10000,
                roast_limit_monthly: 1000,
                model: 'gpt-4',
                shield_enabled: true,
                rqc_mode: 'advanced',
                plan_name: 'pro'
            };
        } else if (lowerIdentifier.includes('creator') || lowerIdentifier.includes('plus')) {
            return {
                analysis_limit_monthly: 100000,
                roast_limit_monthly: 5000,
                model: 'gpt-4',
                shield_enabled: true,
                rqc_mode: 'premium',
                plan_name: 'creator_plus'
            };
        } else if (lowerIdentifier.includes('custom') || lowerIdentifier.includes('enterprise')) {
            return {
                analysis_limit_monthly: -1, // Unlimited
                roast_limit_monthly: -1, // Unlimited
                model: 'gpt-4',
                shield_enabled: true,
                rqc_mode: 'premium',
                plan_name: 'custom'
            };
        } else {
            // Default to free plan
            return {
                analysis_limit_monthly: 100,
                roast_limit_monthly: 10,
                model: 'gpt-3.5-turbo',
                shield_enabled: false,
                rqc_mode: 'basic',
                plan_name: 'free'
            };
        }
    }

    /**
     * Persist entitlements to database
     * @private
     * @param {string} userId - User ID
     * @param {Object} entitlements - Entitlements to persist
     * @returns {Promise<Object>} Persisted entitlements
     */
    async _persistEntitlements(userId, entitlements) {
        const { data, error } = await supabaseServiceClient
            .from('account_entitlements')
            .upsert({
                account_id: userId,
                ...entitlements,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Get default entitlements for free plan
     * @private
     * @param {string} userId - User ID
     * @returns {Object} Default entitlements
     */
    _getDefaultEntitlements(userId) {
        return {
            account_id: userId,
            analysis_limit_monthly: 100,
            roast_limit_monthly: 10,
            model: 'gpt-3.5-turbo',
            shield_enabled: false,
            rqc_mode: 'basic',
            stripe_price_id: null,
            stripe_product_id: null,
            plan_name: 'free',
            metadata: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }

    /**
     * Apply fallback entitlements when Stripe fails
     * @private
     * @param {string} userId - User ID
     * @returns {Promise<boolean>} Success status
     */
    async _applyFallbackEntitlements(userId) {
        try {
            const fallbackEntitlements = this._getDefaultEntitlements(userId);
            await this._persistEntitlements(userId, {
                ...fallbackEntitlements,
                metadata: {
                    fallback_applied: true,
                    original_error: 'stripe_fetch_failed',
                    applied_at: new Date().toISOString()
                }
            });

            logger.warn('Applied fallback entitlements due to Stripe failure', {
                userId
            });

            return true;
        } catch (error) {
            logger.error('Failed to apply fallback entitlements', {
                userId,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Get usage summary for user (for admin/analytics)
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Usage summary with entitlements
     */
    async getUsageSummary(userId) {
        try {
            const [entitlements, usage] = await Promise.all([
                this.getEntitlements(userId),
                this.getCurrentUsage(userId)
            ]);

            return {
                user_id: userId,
                entitlements,
                usage,
                utilization: {
                    analysis: {
                        used: usage.analysis_used || 0,
                        limit: entitlements.analysis_limit_monthly,
                        percentage: entitlements.analysis_limit_monthly === -1 ? 0 : 
                            Math.round(((usage.analysis_used || 0) / entitlements.analysis_limit_monthly) * 100),
                        unlimited: entitlements.analysis_limit_monthly === -1
                    },
                    roasts: {
                        used: usage.roasts_used || 0,
                        limit: entitlements.roast_limit_monthly,
                        percentage: entitlements.roast_limit_monthly === -1 ? 0 : 
                            Math.round(((usage.roasts_used || 0) / entitlements.roast_limit_monthly) * 100),
                        unlimited: entitlements.roast_limit_monthly === -1
                    }
                },
                period: {
                    start: usage.period_start,
                    end: usage.period_end,
                    days_remaining: Math.ceil((new Date(usage.period_end) - new Date()) / (1000 * 60 * 60 * 24))
                }
            };

        } catch (error) {
            logger.error('Failed to get usage summary', {
                userId,
                error: error.message
            });

            throw error;
        }
    }

    // ============================================================================
    // TRIAL MANAGEMENT METHODS - Issue #678
    // ============================================================================

    /**
     * Check if user is in trial period
     * @param {string} userId - User ID
     * @returns {Promise<boolean>} True if user has active trial
     */
    async isInTrial(userId) {
        try {
            const subscription = await this.getSubscription(userId);
            if (!subscription?.trial_ends_at) return false;

            const now = new Date();
            const trialEnd = new Date(subscription.trial_ends_at);

            return trialEnd > now;
        } catch (error) {
            logger.error('Failed to check trial status', {
                userId,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Start trial for user
     * @param {string} userId - User ID
     * @param {number} durationDays - Trial duration in days (default: 30)
     * @returns {Promise<Object>} Trial start result
     */
    async startTrial(userId, durationDays = 30) {
        try {
            // Validate user has no active trial
            const isAlreadyInTrial = await this.isInTrial(userId);
            if (isAlreadyInTrial) {
                throw new Error('User is already in trial period');
            }

            const trialEndsAt = new Date();
            trialEndsAt.setDate(trialEndsAt.getDate() + durationDays);

            const { error } = await supabaseServiceClient
                .from('organizations')
                .update({
                    plan_id: 'starter_trial',
                    trial_starts_at: new Date().toISOString(),
                    trial_ends_at: trialEndsAt.toISOString()
                })
                .eq('id', userId);

            if (error) {
                throw new Error(`Failed to start trial: ${error.message}`);
            }

            logger.info('Trial started successfully', {
                userId,
                trialEndsAt: trialEndsAt.toISOString(),
                durationDays
            });

            return {
                success: true,
                trial_ends_at: trialEndsAt.toISOString(),
                duration_days: durationDays
            };

        } catch (error) {
            logger.error('Failed to start trial', {
                userId,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Check if trial has expired and needs conversion
     * @param {string} userId - User ID
     * @returns {Promise<boolean>} True if trial has expired
     */
    async checkTrialExpiration(userId) {
        try {
            const subscription = await this.getSubscription(userId);
            if (!subscription?.trial_ends_at) return false;

            const now = new Date();
            const trialEnd = new Date(subscription.trial_ends_at);

            return trialEnd < now;
        } catch (error) {
            logger.error('Failed to check trial expiration', {
                userId,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Cancel trial for user
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Cancel result
     */
    async cancelTrial(userId) {
        try {
            const { error } = await supabaseServiceClient
                .from('organizations')
                .update({
                    plan_id: 'starter', // Convert to paid immediately
                    trial_starts_at: null,
                    trial_ends_at: null
                })
                .eq('id', userId);

            if (error) {
                throw new Error(`Failed to cancel trial: ${error.message}`);
            }

            logger.info('Trial cancelled successfully', { userId });

            return { success: true, cancelled: true };

        } catch (error) {
            logger.error('Failed to cancel trial', {
                userId,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Convert trial to paid starter
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Conversion result
     */
    async convertTrialToPaid(userId) {
        try {
            // TODO:Polar - Integrate with Polar billing when ready
            // For now, just update the plan_id

            const { error } = await supabaseServiceClient
                .from('organizations')
                .update({
                    plan_id: 'starter',
                    trial_starts_at: null,
                    trial_ends_at: null
                })
                .eq('id', userId);

            if (error) {
                throw new Error(`Failed to convert trial to paid: ${error.message}`);
            }

            logger.info('Trial converted to paid successfully', { userId });

            return {
                success: true,
                converted: true,
                new_plan: 'starter'
            };

        } catch (error) {
            logger.error('Failed to convert trial to paid', {
                userId,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Get trial status details
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Trial status details
     */
    async getTrialStatus(userId) {
        try {
            const subscription = await this.getSubscription(userId);

            if (!subscription?.trial_starts_at) {
                return { in_trial: false };
            }

            const now = new Date();
            const trialStart = new Date(subscription.trial_starts_at);
            const trialEnd = new Date(subscription.trial_ends_at);
            const isActive = trialEnd > now;

            const daysLeft = isActive ?
                Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)) : 0;

            return {
                in_trial: isActive,
                trial_starts_at: subscription.trial_starts_at,
                trial_ends_at: subscription.trial_ends_at,
                days_left: daysLeft,
                expired: trialEnd < now
            };

        } catch (error) {
            logger.error('Failed to get trial status', {
                userId,
                error: error.message
            });

            throw error;
        }
    }
}

module.exports = EntitlementsService;