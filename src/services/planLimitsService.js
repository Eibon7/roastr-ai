/**
 * Plan Limits Service
 * Issue #99: Database-based plan limit configuration
 * Provides centralized access to plan limits with caching support
 */

const { supabaseServiceClient } = require('../config/supabase');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');
const { 
    DEFAULT_TIER_LIMITS, 
    SECURITY_CONFIG, 
    VALIDATION_HELPERS,
    CACHE_CONFIG 
} = require('../config/tierConfig');

class PlanLimitsService {
    constructor() {
        // Cache plan limits to reduce database queries
        this.cache = new Map();
        this.cacheTimeout = CACHE_CONFIG.timeouts.limits;
        this.lastCacheRefresh = null;
    }

    /**
     * Get plan limits from database with caching
     * @param {string} planId - Plan ID (free, starter, pro, plus, custom)
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
                
                // Enhanced fail-closed security (CodeRabbit Round 7)
                const isProductionOrSecure = process.env.NODE_ENV === 'production' || 
                                           process.env.PLAN_LIMITS_FAIL_CLOSED === 'true';
                
                if (isProductionOrSecure) {
                    logger.error('Plan limits fetch failed - failing closed for security', {
                        planId,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                    return this.getDefaultLimits('starter_trial'); // Always use starter_trial (most restrictive) for security
                }
                
                // Only allow fail-open in development with explicit flag
                const allowFailOpen = process.env.NODE_ENV !== 'production' && 
                                     process.env.PLAN_LIMITS_FAIL_OPEN === 'true';
                
                if (allowFailOpen) {
                    logger.warn('Plan limits fetch failed, using defaults (development only)', {
                        planId,
                        warning: 'This should never happen in production'
                    });
                    return this.getDefaultLimits(planId);
                }
                
                // Default fail-closed behavior
                logger.error('Plan limits fetch failed - failing closed for security (default)', {
                    planId,
                    error: error.message
                });
                return this.getDefaultLimits('starter_trial');
            }

            // Transform database fields to match existing interface
            const limits = {
                maxRoasts: data.max_roasts,
                monthlyResponsesLimit: data.monthly_responses_limit,
                monthlyAnalysisLimit: data.monthly_analysis_limit,
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
            
            // Enhanced fail-closed security (CodeRabbit Round 7)
            const isProductionOrSecure = process.env.NODE_ENV === 'production' || 
                                       process.env.PLAN_LIMITS_FAIL_CLOSED === 'true';
            
            if (isProductionOrSecure) {
                logger.error('Plan limits service error - failing closed for security', {
                    planId,
                    error: error.message,
                    stack: error.stack,
                    timestamp: new Date().toISOString()
                });
                return this.getDefaultLimits('starter_trial');
            }
            
            // Only allow fail-open in development with explicit flag
            const allowFailOpen = process.env.NODE_ENV !== 'production' && 
                                 process.env.PLAN_LIMITS_FAIL_OPEN === 'true';
            
            if (allowFailOpen) {
                logger.warn('Plan limits service error, using defaults (development only)', {
                    planId,
                    warning: 'This should never happen in production'
                });
                return this.getDefaultLimits(planId);
            }
            
            // Default fail-closed behavior
            logger.error('Plan limits service error - failing closed for security (default)', {
                planId,
                error: error.message
            });
            return this.getDefaultLimits('starter_trial');
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
                
                // Enhanced fail-closed security (CodeRabbit Round 7)
                const isProductionOrSecure = process.env.NODE_ENV === 'production' || 
                                           process.env.PLAN_LIMITS_FAIL_CLOSED === 'true';
                
                if (isProductionOrSecure) {
                    logger.error('All plan limits fetch failed - failing closed for security', {
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                    return { free: this.getDefaultLimits('starter_trial') };
                }
                
                // Only allow fail-open in development with explicit flag
                const allowFailOpen = process.env.NODE_ENV !== 'production' && 
                                     process.env.PLAN_LIMITS_FAIL_OPEN === 'true';
                
                if (allowFailOpen) {
                    logger.warn('All plan limits fetch failed, using defaults (development only)', {
                        warning: 'This should never happen in production'
                    });
                    return this.getDefaultAllLimits();
                }
                
                // Default fail-closed behavior
                logger.error('All plan limits fetch failed - failing closed for security (default)', {
                    error: error.message
                });
                return { free: this.getDefaultLimits('starter_trial') };
            }

            // Transform to object keyed by plan_id
            const allLimits = {};
            data.forEach(planLimit => {
                allLimits[planLimit.plan_id] = {
                    maxRoasts: planLimit.max_roasts,
                    monthlyResponsesLimit: planLimit.monthly_responses_limit,
                    monthlyAnalysisLimit: planLimit.monthly_analysis_limit,
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
            
            // Enhanced fail-closed security (CodeRabbit Round 7)
            const isProductionOrSecure = process.env.NODE_ENV === 'production' || 
                                       process.env.PLAN_LIMITS_FAIL_CLOSED === 'true';
            
            if (isProductionOrSecure) {
                logger.error('All plan limits service error - failing closed for security', {
                    error: error.message,
                    stack: error.stack,
                    timestamp: new Date().toISOString()
                });
                return { free: this.getDefaultLimits('starter_trial') };
            }
            
            // Only allow fail-open in development with explicit flag
            const allowFailOpen = process.env.NODE_ENV !== 'production' && 
                                 process.env.PLAN_LIMITS_FAIL_OPEN === 'true';
            
            if (allowFailOpen) {
                logger.warn('All plan limits service error, using defaults (development only)', {
                    warning: 'This should never happen in production'
                });
                return this.getDefaultAllLimits();
            }
            
            // Default fail-closed behavior
            logger.error('All plan limits service error - failing closed for security (default)', {
                error: error.message
            });
            return { free: this.getDefaultLimits('starter_trial') };
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
            if (updates.monthlyAnalysisLimit !== undefined) dbUpdates.monthly_analysis_limit = updates.monthlyAnalysisLimit;
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
                case 'monthly_analysis':
                    limitValue = limits.monthlyAnalysisLimit;
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
            
            // Enhanced fail-closed security (CodeRabbit Round 7)
            const isProductionOrSecure = process.env.NODE_ENV === 'production' || 
                                       process.env.PLAN_LIMITS_FAIL_CLOSED === 'true';
            
            if (isProductionOrSecure) {
                logger.error('Plan limits check failed - failing closed for security', {
                    planId,
                    limitType,
                    currentUsage,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
                return true; // Deny action for security
            }
            
            // Only allow fail-open in development with explicit flag
            const allowFailOpen = process.env.NODE_ENV !== 'production' && 
                                 process.env.PLAN_LIMITS_FAIL_OPEN === 'true';
            
            if (allowFailOpen) {
                logger.warn('Plan limits check failed, allowing (development only)', {
                    planId,
                    limitType,
                    currentUsage,
                    warning: 'This should never happen in production'
                });
                return false; // Allow action in development
            }
            
            // Default fail-closed behavior
            logger.error('Plan limits check failed - failing closed for security (default)', {
                planId,
                limitType,
                currentUsage,
                error: error.message
            });
            return true; // Deny action for security
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
     * Get default limits (fallback for errors) - uses centralized configuration
     * @private
     */
    getDefaultLimits(planId) {
        return DEFAULT_TIER_LIMITS[planId] || DEFAULT_TIER_LIMITS.free;
    }

    /**
     * Get default limits for all plans - uses centralized configuration
     * @private
     */
    getDefaultAllLimits() {
        return DEFAULT_TIER_LIMITS;
    }

    /**
     * Clear the cache (useful for testing or forcing refresh)
     */
    clearCache() {
        this.cache.clear();
        this.lastCacheRefresh = null;
        logger.debug('Plan limits cache cleared');
    }

    // ROUND 4 FIX: Plan-specific auto-approval capabilities
    /**
     * Get daily auto-approval limits for an organization
     * ROUND 4 FIX: Thread plan-specific limits through rate limit checks
     */
    async getDailyAutoApprovalLimits(organizationId) {
        try {
            // Get organization plan
            const orgResult = await supabaseServiceClient
                .from('organizations')
                .select('plan')
                .eq('id', organizationId)
                .single();

            if (orgResult.error || !orgResult.data) {
                logger.error('Failed to get organization plan for auto-approval limits', {
                    organizationId,
                    error: orgResult.error?.message,
                    reason: 'organization_query_failed'
                });
                // Fail closed - return most restrictive limits
                return {
                    daily: 0,
                    hourly: 0,
                    plan: 'starter_trial',
                    features: { autoApproval: false }
                };
            }

            const plan = orgResult.data.plan;
            const limits = await this.getPlanLimits(plan);

            // ROUND 4 FIX: Map plan limits to auto-approval specific limits
            const autoApprovalLimits = this.getAutoApprovalLimitsForPlan(plan, limits);

            logger.debug('Retrieved auto-approval limits for organization', {
                organizationId,
                plan,
                limits: {
                    daily: autoApprovalLimits.daily,
                    hourly: autoApprovalLimits.hourly,
                    autoApproval: autoApprovalLimits.features.autoApproval
                }
            });

            return {
                daily: autoApprovalLimits.daily,
                hourly: autoApprovalLimits.hourly,
                plan,
                features: autoApprovalLimits.features
            };

        } catch (error) {
            logger.error('Error getting daily auto-approval limits - defaulting to free', {
                organizationId,
                error: error.message,
                reason: 'system_error'
            });
            
            // Fail closed - return most restrictive limits
            return {
                daily: 0,
                hourly: 0,
                plan: 'starter_trial',
                features: { autoApproval: false }
            };
        }
    }

    /**
     * ROUND 4 FIX: Get auto-approval specific limits based on plan
     * @private
     */
    getAutoApprovalLimitsForPlan(plan, planLimits) {
        // ROUND 4 FIX: Plan-specific auto-approval caps
        const autoApprovalMappings = {
            free: {
                features: { autoApproval: false },
                daily: 0,
                hourly: 0
            },
            starter: {
                features: { autoApproval: true },
                daily: Math.min(50, planLimits.dailyApiCallsLimit || 50),
                hourly: Math.min(10, Math.floor((planLimits.dailyApiCallsLimit || 50) / 24))
            },
            pro: {
                features: { autoApproval: true },
                daily: Math.min(200, planLimits.dailyApiCallsLimit || 200),
                hourly: Math.min(30, Math.floor((planLimits.dailyApiCallsLimit || 200) / 24))
            },
            plus: {
                features: { autoApproval: true },
                daily: Math.min(500, planLimits.dailyApiCallsLimit || 500),
                hourly: Math.min(50, Math.floor((planLimits.dailyApiCallsLimit || 500) / 24))
            },
            creator_plus: {
                features: { autoApproval: true },
                daily: Math.min(1000, planLimits.dailyApiCallsLimit || 1000),
                hourly: Math.min(100, Math.floor((planLimits.dailyApiCallsLimit || 1000) / 24))
            }
        };

        const normalizedPlan = this.normalizePlan(plan);
        return autoApprovalMappings[normalizedPlan] || autoApprovalMappings.free;
    }

    /**
     * ROUND 4 FIX: Check if plan supports auto-approval
     */
    async supportsAutoApproval(organizationId) {
        try {
            const limits = await this.getDailyAutoApprovalLimits(organizationId);
            return limits.features.autoApproval;
        } catch (error) {
            logger.error('Error checking auto-approval support - failing closed', {
                organizationId,
                error: error.message
            });
            return false;
        }
    }

    /**
     * ROUND 4 FIX: Get current auto-approval usage for an organization
     */
    async getCurrentAutoApprovalUsage(organizationId) {
        try {
            const now = new Date();
            const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

            const [dailyResult, hourlyResult] = await Promise.all([
                supabaseServiceClient
                    .from('roast_approvals')
                    .select('id', { count: 'exact' })
                    .eq('organization_id', organizationId)
                    .gte('created_at', dayAgo.toISOString()),
                supabaseServiceClient
                    .from('roast_approvals')
                    .select('id', { count: 'exact' })
                    .eq('organization_id', organizationId)
                    .gte('created_at', hourAgo.toISOString())
            ]);

            if (dailyResult.error || hourlyResult.error) {
                logger.error('Error getting current auto-approval usage', {
                    organizationId,
                    dailyError: dailyResult.error?.message,
                    hourlyError: hourlyResult.error?.message
                });
                throw new Error('Failed to get auto-approval usage data');
            }

            return {
                daily: dailyResult.count || 0,
                hourly: hourlyResult.count || 0,
                timestamp: now.toISOString()
            };

        } catch (error) {
            logger.error('Error getting current auto-approval usage', {
                organizationId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * ROUND 4 FIX: Check if organization can auto-approve more content
     */
    async canAutoApprove(organizationId) {
        try {
            const [limits, usage] = await Promise.all([
                this.getDailyAutoApprovalLimits(organizationId),
                this.getCurrentAutoApprovalUsage(organizationId)
            ]);

            // Check if plan supports auto-approval
            if (!limits.features.autoApproval) {
                return {
                    allowed: false,
                    reason: 'plan_does_not_support_auto_approval',
                    plan: limits.plan
                };
            }

            // Check daily limits
            if (usage.daily >= limits.daily) {
                return {
                    allowed: false,
                    reason: 'daily_limit_exceeded',
                    usage: usage.daily,
                    limit: limits.daily,
                    plan: limits.plan
                };
            }

            // Check hourly limits
            if (usage.hourly >= limits.hourly) {
                return {
                    allowed: false,
                    reason: 'hourly_limit_exceeded',
                    usage: usage.hourly,
                    limit: limits.hourly,
                    plan: limits.plan
                };
            }

            return {
                allowed: true,
                usage,
                limits,
                plan: limits.plan
            };

        } catch (error) {
            logger.error('Error checking if can auto-approve - failing closed', {
                organizationId,
                error: error.message
            });
            return {
                allowed: false,
                reason: 'system_error',
                error: error.message
            };
        }
    }

    /**
     * ROUND 4 FIX: Normalize plan name for consistent lookups
     * @private
     */
    normalizePlan(plan) {
        if (!plan || typeof plan !== 'string') {
            return 'starter_trial';
        }

        const normalized = plan.toLowerCase().trim();
        
        // Handle plan aliases
        const planAliases = {
            'basic': 'starter',
            'premium': 'pro',
            'enterprise': 'plus',
            'creator': 'creator_plus'
        };

        return planAliases[normalized] || normalized;
    }
}

// Export singleton instance
module.exports = new PlanLimitsService();