/**
 * Plan Limits Service
 * Issue #99: Database-based plan limit configuration
 * Provides centralized access to plan limits with caching support
 */

const { supabaseServiceClient } = require('../config/supabase');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

class PlanLimitsService {
    constructor() {
        // Cache plan limits to reduce database queries
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.lastCacheRefresh = null;
    }

    /**
     * Get plan limits from database with caching
     * @param {string} planId - Plan ID (free, pro, creator_plus, custom)
     * @returns {Object} Plan limits configuration
     */
    async getPlanLimits(planId) {
        try {
            // Check cache first
            const cached = this.getCachedLimits(planId);
            if (cached) {
                return cached;
            }

            // Fetch from database
            const { data, error } = await supabaseServiceClient
                .from('plan_limits')
                .select('*')
                .eq('plan_id', planId)
                .single();

            if (error) {
                logger.error('Failed to fetch plan limits:', error);
                // Fall back to free plan limits if error
                return this.getDefaultLimits(planId);
            }

            // Transform database fields to match existing interface
            const limits = {
                maxRoasts: data.max_roasts,
                monthlyResponsesLimit: data.monthly_responses_limit,
                maxPlatforms: data.max_platforms,
                integrationsLimit: data.integrations_limit,
                shieldEnabled: data.shield_enabled,
                customPrompts: data.custom_prompts,
                prioritySupport: data.priority_support,
                apiAccess: data.api_access,
                analyticsEnabled: data.analytics_enabled,
                customTones: data.custom_tones,
                dedicatedSupport: data.dedicated_support,
                monthlyTokensLimit: data.monthly_tokens_limit,
                dailyApiCallsLimit: data.daily_api_calls_limit,
                ...data.settings // Merge any additional settings from JSON
            };

            // Cache the result
            this.setCachedLimits(planId, limits);

            return limits;

        } catch (error) {
            logger.error('Error in getPlanLimits:', error);
            return this.getDefaultLimits(planId);
        }
    }

    /**
     * Get all plan limits at once (for comparison views)
     * @returns {Object} All plan limits keyed by plan ID
     */
    async getAllPlanLimits() {
        try {
            const { data, error } = await supabaseServiceClient
                .from('plan_limits')
                .select('*')
                .order('plan_id');

            if (error) {
                logger.error('Failed to fetch all plan limits:', error);
                return this.getDefaultAllLimits();
            }

            // Transform to object keyed by plan_id
            const allLimits = {};
            data.forEach(planLimit => {
                allLimits[planLimit.plan_id] = {
                    maxRoasts: planLimit.max_roasts,
                    monthlyResponsesLimit: planLimit.monthly_responses_limit,
                    maxPlatforms: planLimit.max_platforms,
                    integrationsLimit: planLimit.integrations_limit,
                    shieldEnabled: planLimit.shield_enabled,
                    customPrompts: planLimit.custom_prompts,
                    prioritySupport: planLimit.priority_support,
                    apiAccess: planLimit.api_access,
                    analyticsEnabled: planLimit.analytics_enabled,
                    customTones: planLimit.custom_tones,
                    dedicatedSupport: planLimit.dedicated_support,
                    monthlyTokensLimit: planLimit.monthly_tokens_limit,
                    dailyApiCallsLimit: planLimit.daily_api_calls_limit,
                    ...planLimit.settings
                };
            });

            return allLimits;

        } catch (error) {
            logger.error('Error in getAllPlanLimits:', error);
            return this.getDefaultAllLimits();
        }
    }

    /**
     * Update plan limits (admin only)
     * @param {string} planId - Plan ID
     * @param {Object} updates - Limit updates
     * @param {string} updatedBy - User ID making the update
     * @returns {Object} Updated limits
     */
    async updatePlanLimits(planId, updates, updatedBy) {
        try {
            // Map updates to database fields
            const dbUpdates = {};
            if (updates.maxRoasts !== undefined) dbUpdates.max_roasts = updates.maxRoasts;
            if (updates.monthlyResponsesLimit !== undefined) dbUpdates.monthly_responses_limit = updates.monthlyResponsesLimit;
            if (updates.maxPlatforms !== undefined) dbUpdates.max_platforms = updates.maxPlatforms;
            if (updates.integrationsLimit !== undefined) dbUpdates.integrations_limit = updates.integrationsLimit;
            if (updates.shieldEnabled !== undefined) dbUpdates.shield_enabled = updates.shieldEnabled;
            if (updates.customPrompts !== undefined) dbUpdates.custom_prompts = updates.customPrompts;
            if (updates.prioritySupport !== undefined) dbUpdates.priority_support = updates.prioritySupport;
            if (updates.apiAccess !== undefined) dbUpdates.api_access = updates.apiAccess;
            if (updates.analyticsEnabled !== undefined) dbUpdates.analytics_enabled = updates.analyticsEnabled;
            if (updates.customTones !== undefined) dbUpdates.custom_tones = updates.customTones;
            if (updates.dedicatedSupport !== undefined) dbUpdates.dedicated_support = updates.dedicatedSupport;
            if (updates.monthlyTokensLimit !== undefined) dbUpdates.monthly_tokens_limit = updates.monthlyTokensLimit;
            if (updates.dailyApiCallsLimit !== undefined) dbUpdates.daily_api_calls_limit = updates.dailyApiCallsLimit;

            // Add updater info
            dbUpdates.updated_by = updatedBy;

            const { data, error } = await supabaseServiceClient
                .from('plan_limits')
                .update(dbUpdates)
                .eq('plan_id', planId)
                .select()
                .single();

            if (error) {
                logger.error('Failed to update plan limits:', error);
                throw error;
            }

            // Clear cache for this plan
            this.cache.delete(planId);
            
            logger.info('Plan limits updated:', {
                planId,
                updatedBy,
                changes: Object.keys(updates)
            });

            return this.getPlanLimits(planId);

        } catch (error) {
            logger.error('Error updating plan limits:', error);
            throw error;
        }
    }

    /**
     * Check if a specific limit is exceeded
     * @param {string} planId - Plan ID
     * @param {string} limitType - Type of limit to check
     * @param {number} currentUsage - Current usage value
     * @returns {boolean} Whether limit is exceeded
     */
    async checkLimit(planId, limitType, currentUsage) {
        try {
            const limits = await this.getPlanLimits(planId);
            
            let limitValue;
            switch (limitType) {
                case 'roasts':
                    limitValue = limits.maxRoasts;
                    break;
                case 'platforms':
                    limitValue = limits.maxPlatforms;
                    break;
                case 'monthly_responses':
                    limitValue = limits.monthlyResponsesLimit;
                    break;
                case 'integrations':
                    limitValue = limits.integrationsLimit;
                    break;
                case 'monthly_tokens':
                    limitValue = limits.monthlyTokensLimit;
                    break;
                case 'daily_api_calls':
                    limitValue = limits.dailyApiCallsLimit;
                    break;
                default:
                    logger.warn('Unknown limit type:', limitType);
                    return false;
            }

            // -1 means unlimited
            if (limitValue === -1) {
                return false;
            }

            return currentUsage >= limitValue;

        } catch (error) {
            logger.error('Error checking limit:', error);
            // Default to not exceeded on error
            return false;
        }
    }

    /**
     * Get cached limits
     * @private
     */
    getCachedLimits(planId) {
        // Check if cache needs refresh
        if (this.lastCacheRefresh && 
            Date.now() - this.lastCacheRefresh > this.cacheTimeout) {
            this.cache.clear();
            this.lastCacheRefresh = null;
        }

        return this.cache.get(planId);
    }

    /**
     * Set cached limits
     * @private
     */
    setCachedLimits(planId, limits) {
        this.cache.set(planId, limits);
        if (!this.lastCacheRefresh) {
            this.lastCacheRefresh = Date.now();
        }
    }

    /**
     * Get default limits (fallback for errors)
     * @private
     */
    getDefaultLimits(planId) {
        const defaults = {
            free: {
                maxRoasts: 100,
                monthlyResponsesLimit: 100,
                maxPlatforms: 1,
                integrationsLimit: 2,
                shieldEnabled: false,
                customPrompts: false,
                prioritySupport: false,
                apiAccess: false,
                analyticsEnabled: false,
                customTones: false,
                dedicatedSupport: false,
                monthlyTokensLimit: 10000,
                dailyApiCallsLimit: 100
            },
            pro: {
                maxRoasts: 1000,
                monthlyResponsesLimit: 1000,
                maxPlatforms: 5,
                integrationsLimit: 5,
                shieldEnabled: true,
                customPrompts: false,
                prioritySupport: true,
                apiAccess: false,
                analyticsEnabled: true,
                customTones: false,
                dedicatedSupport: false,
                monthlyTokensLimit: 100000,
                dailyApiCallsLimit: 1000
            },
            creator_plus: {
                maxRoasts: -1,
                monthlyResponsesLimit: 5000,
                maxPlatforms: -1,
                integrationsLimit: 999,
                shieldEnabled: true,
                customPrompts: true,
                prioritySupport: true,
                apiAccess: true,
                analyticsEnabled: true,
                customTones: true,
                dedicatedSupport: true,
                monthlyTokensLimit: 500000,
                dailyApiCallsLimit: -1
            },
            custom: {
                maxRoasts: -1,
                monthlyResponsesLimit: 999999,
                maxPlatforms: -1,
                integrationsLimit: 999,
                shieldEnabled: true,
                customPrompts: true,
                prioritySupport: true,
                apiAccess: true,
                analyticsEnabled: true,
                customTones: true,
                dedicatedSupport: true,
                monthlyTokensLimit: -1,
                dailyApiCallsLimit: -1
            }
        };

        return defaults[planId] || defaults.free;
    }

    /**
     * Get default limits for all plans
     * @private
     */
    getDefaultAllLimits() {
        return {
            free: this.getDefaultLimits('free'),
            pro: this.getDefaultLimits('pro'),
            creator_plus: this.getDefaultLimits('creator_plus'),
            custom: this.getDefaultLimits('custom')
        };
    }

    /**
     * Clear the cache (useful for testing or forcing refresh)
     */
    clearCache() {
        this.cache.clear();
        this.lastCacheRefresh = null;
        logger.debug('Plan limits cache cleared');
    }
}

// Export singleton instance
module.exports = new PlanLimitsService();