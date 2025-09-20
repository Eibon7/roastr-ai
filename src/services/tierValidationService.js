/**
 * Tier Validation Service - SPEC 10
 * Runtime validation of subscription tiers with usage limits and feature gating
 * 
 * Implements:
 * - Free: 100 análisis / 10 roasts, 1 cuenta por red, sin Shield/Original Tone
 * - Starter: 1,000 análisis / 100 roasts, 1 cuenta por red, Shield ON
 * - Pro: 10,000 análisis / 1,000 roasts, 2 cuentas por red, Shield + Original Tone
 * - Plus: 100,000 análisis / 5,000 roasts, 2 cuentas por red, Shield + Original Tone + Embedded Judge
 */

const { supabaseServiceClient } = require('../config/supabase');
const planLimitsService = require('./planLimitsService');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

class TierValidationService {
    constructor() {
        // Cache for performance
        this.usageCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Validate if user can perform an action based on their tier
     * @param {string} userId - User ID
     * @param {string} action - Action type (analysis, roast, platform_add)
     * @param {Object} options - Additional options
     * @returns {Object} { allowed: boolean, reason?: string, upgradeRequired?: string, currentUsage?: Object }
     */
    async validateAction(userId, action, options = {}) {
        try {
            const userTier = await this.getUserTier(userId);
            const currentUsage = await this.getCurrentUsage(userId);
            const tierLimits = await planLimitsService.getPlanLimits(userTier.plan);

            const validation = this.checkActionLimits(action, tierLimits, currentUsage, options);

            if (!validation.allowed) {
                // Log the blocked action with minimal metadata
                logger.info('Action blocked by tier limits', {
                    userId,
                    tier: userTier.plan,
                    action,
                    reason: validation.reason,
                    timestamp: new Date().toISOString()
                });
            }

            return {
                ...validation,
                currentTier: userTier.plan,
                currentUsage: this.sanitizeUsageForResponse(currentUsage)
            };

        } catch (error) {
            logger.error('Error validating tier action:', error);
            
            // Check for specific database errors that should fail closed
            if (error.code === 'ETIMEDOUT' || 
                error.code === 'ECONNREFUSED' || 
                error.message?.includes('Connection') ||
                error.message?.includes('timeout')) {
                return {
                    allowed: false,
                    reason: 'Validation error - failing closed for security',
                    message: 'Unable to validate action at this time'
                };
            }
            
            // Default to allowing the action on error to avoid blocking users
            return { 
                allowed: true, 
                error: 'Validation service temporarily unavailable',
                fallback: true 
            };
        }
    }

    /**
     * Check if a feature is available for the user's tier
     * @param {string} userId - User ID  
     * @param {string} feature - Feature name (shield, original_tone, embedded_judge)
     * @returns {Object} { available: boolean, reason?: string }
     */
    async validateFeature(userId, feature) {
        try {
            const userTier = await this.getUserTier(userId);
            const tierLimits = await planLimitsService.getPlanLimits(userTier.plan);

            return this.checkFeatureAccess(feature, tierLimits, userTier.plan);

        } catch (error) {
            logger.error('Error validating tier feature:', error);
            // Default to not available on error for security
            return { 
                available: false, 
                reason: 'Feature validation temporarily unavailable' 
            };
        }
    }

    /**
     * Check action limits against tier configuration
     * @private
     */
    checkActionLimits(action, tierLimits, currentUsage, options) {
        switch (action) {
            case 'analysis':
                return this.checkAnalysisLimits(tierLimits, currentUsage);
            
            case 'roast':
                return this.checkRoastLimits(tierLimits, currentUsage);
            
            case 'platform_add':
                const { platform } = options;
                return this.checkPlatformLimits(tierLimits, currentUsage, platform);
            
            default:
                return { allowed: true, reason: 'Unknown action type' };
        }
    }

    /**
     * Check analysis limits (100 free, 1,000 starter, 10,000 pro, 100,000 plus)
     * @private
     */
    checkAnalysisLimits(tierLimits, currentUsage) {
        const monthlyLimit = tierLimits.monthlyAnalysisLimit;
        const currentAnalysis = currentUsage.analysisThisMonth || 0;

        if (monthlyLimit === -1) {
            return { allowed: true }; // Unlimited
        }

        if (currentAnalysis >= monthlyLimit) {
            return {
                allowed: false,
                reason: 'monthly_analysis_limit_exceeded',
                message: this.getAnalysisLimitMessage(monthlyLimit, currentAnalysis),
                upgradeRequired: this.getUpgradeRecommendation('analysis', monthlyLimit)
            };
        }

        return { allowed: true };
    }

    /**
     * Check roast limits (10 free, 100 starter, 1,000 pro, 5,000 plus)
     * @private
     */
    checkRoastLimits(tierLimits, currentUsage) {
        const monthlyLimit = tierLimits.monthlyResponsesLimit;
        const currentRoasts = currentUsage.roastsThisMonth || 0;

        if (monthlyLimit === -1) {
            return { allowed: true }; // Unlimited
        }

        if (currentRoasts >= monthlyLimit) {
            return {
                allowed: false,
                reason: 'monthly_roast_limit_exceeded',
                message: this.getRoastLimitMessage(monthlyLimit, currentRoasts),
                upgradeRequired: this.getUpgradeRecommendation('roast', monthlyLimit)
            };
        }

        return { allowed: true };
    }

    /**
     * Check platform limits (1 account per network for free/starter, 2 for pro/plus)
     * @private
     */
    checkPlatformLimits(tierLimits, currentUsage, platform) {
        const platformLimit = tierLimits.integrationsLimit;
        const currentAccounts = currentUsage.platformAccounts?.[platform] || 0;

        if (platformLimit === -1) {
            return { allowed: true }; // Unlimited
        }

        if (currentAccounts >= platformLimit) {
            return {
                allowed: false,
                reason: 'platform_account_limit_exceeded',
                message: this.getPlatformLimitMessage(platform, platformLimit, currentAccounts),
                upgradeRequired: this.getUpgradeRecommendation('platform', platformLimit)
            };
        }

        return { allowed: true };
    }

    /**
     * Check feature access based on tier
     * @private
     */
    checkFeatureAccess(feature, tierLimits, tierPlan) {
        // Feature mappings for validation
        const featureMap = {
            'shield': 'shieldEnabled',
            'custom_tones': 'customTones', 
            'original_tone': 'customPrompts',
            'embedded_judge': 'embeddedJudge',
            'analytics': 'analyticsEnabled',
            'api_access': 'apiAccess',
            'priority_support': 'prioritySupport'
        };

        const featureProperty = featureMap[feature];
        
        if (!featureProperty) {
            // Fail-closed for unknown features (CodeRabbit Round 5 improvement)
            return {
                available: false,
                reason: 'unknown_feature',
                message: `Feature '${feature}' is not recognized`
            };
        }

        const hasAccess = Boolean(tierLimits[featureProperty]);
        
        if (hasAccess) {
            return { available: true };
        } else {
            return {
                available: false,
                reason: 'tier_limitation',
                message: `Feature '${feature}' requires a higher tier plan`,
                currentPlan: tierPlan,
                requiredPlans: this.getRequiredPlansForFeature(feature)
            };
        }
    }

    /**
     * Get user tier information with UTC date handling (CodeRabbit Round 5)
     * @param {string} userId - User ID
     * @returns {Promise<Object>} User tier data with UTC handling
     */
    async getUserTierWithUTC(userId) {
        try {
            // Check cache first
            const cached = this.getCachedUserTier(userId);
            if (cached) {
                return cached;
            }

            // Fetch from database
            const { data, error } = await supabaseServiceClient
                .from('user_subscriptions')
                .select('plan, status, current_period_start, current_period_end, upgraded_at')
                .eq('user_id', userId)
                .single();

            if (error) {
                logger.warn('No subscription found for user, defaulting to free:', error);
                return this.getDefaultUserTier();
            }

            // Enhanced plan normalization (CodeRabbit Round 5 improvement)  
            const normalizedPlan = this.normalizePlan(data.plan);
            
            const userTier = {
                plan: normalizedPlan,
                status: data.status || 'active',
                periodStart: data.current_period_start,
                periodEnd: data.current_period_end,
                upgradedAt: data.upgraded_at
            };

            // Cache the result
            this.setCachedUserTier(userId, userTier);

            return userTier;

        } catch (error) {
            logger.error('Error getting user tier:', error);
            return this.getDefaultUserTier();
        }
    }

    /**
     * Get user's current tier information
     * @private
     */
    async getUserTier(userId) {
        const { data: subscription, error } = await supabaseServiceClient
            .from('user_subscriptions')
            .select('plan, status, current_period_start, current_period_end')
            .eq('user_id', userId)
            .single();

        if (error || !subscription) {
            return {
                plan: 'free',
                status: 'active',
                isActive: true
            };
        }

        const isActive = subscription.status === 'active' || 
                        subscription.status === 'trialing' ||
                        (subscription.status === 'past_due' && 
                         new Date(subscription.current_period_end) > new Date());

        return {
            plan: subscription.plan,
            status: subscription.status,
            isActive,
            periodStart: subscription.current_period_start,
            periodEnd: subscription.current_period_end
        };
    }

    /**
     * Get user usage statistics for current billing cycle (CodeRabbit Round 5)
     * @param {string} userId - User ID
     * @param {Object} userTier - User tier information
     * @returns {Promise<Object>} Usage data
     */
    async getUserUsage(userId, userTier) {
        try {
            // Calculate effective cycle start (accounting for upgrades)
            const cycleStart = await this.computeEffectiveCycleStart(userTier, userId);
            const cycleEnd = new Date(userTier.periodEnd);

            // Get usage from database
            const { data, error } = await supabaseServiceClient
                .from('user_usage_tracking')
                .select('roasts_this_month, analysis_this_month, platform_accounts')
                .eq('user_id', userId)
                .gte('period_start', cycleStart.toISOString())
                .single();

            if (error || !data) {
                return this.getDefaultUsage();
            }

            return {
                roastsThisMonth: data.roasts_this_month || 0,
                analysisThisMonth: data.analysis_this_month || 0,
                platformAccounts: data.platform_accounts || {}
            };

        } catch (error) {
            logger.error('Error getting user usage:', error);
            return this.getDefaultUsage();
        }
    }

    /**
     * Get current usage for the billing cycle
     * @private
     */
    async getCurrentUsage(userId) {
        // Check cache first
        const cached = this.getCachedUsage(userId);
        if (cached) {
            return cached;
        }

        const userTier = await this.getUserTier(userId);
        
        // Calculate cycle start (monthly cycle for all plans)
        const cycleStart = userTier.periodStart ? 
            new Date(userTier.periodStart) : 
            this.getMonthStart();

        // Get usage from database
        const usage = await this.fetchUsageFromDatabase(userId, cycleStart);
        
        // Cache the result
        this.setCachedUsage(userId, usage);
        
        return usage;
    }

    /**
     * Fetch usage data from database
     * @private
     */
    async fetchUsageFromDatabase(userId, cycleStart) {
        try {
            // Get roast count
            const { data: roasts, error: roastError } = await supabaseServiceClient
                .from('user_activities')
                .select('id')
                .eq('user_id', userId)
                .eq('activity_type', 'roast_generated')
                .gte('created_at', cycleStart.toISOString());

            // Get analysis count
            const { data: analysis, error: analysisError } = await supabaseServiceClient
                .from('analysis_usage')
                .select('quantity')
                .eq('user_id', userId)
                .gte('created_at', cycleStart.toISOString());

            // Get platform accounts
            const { data: platforms, error: platformError } = await supabaseServiceClient
                .from('user_integrations')
                .select('platform, status')
                .eq('user_id', userId)
                .eq('status', 'active');

            if (roastError || analysisError || platformError) {
                logger.warn('Error fetching usage data:', { roastError, analysisError, platformError });
            }

            const roastsThisMonth = roasts?.length || 0;
            const analysisThisMonth = analysis?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
            
            // Group platform accounts
            const platformAccounts = {};
            platforms?.forEach(platform => {
                platformAccounts[platform.platform] = (platformAccounts[platform.platform] || 0) + 1;
            });

            return {
                roastsThisMonth,
                analysisThisMonth,
                platformAccounts,
                cycleStart: cycleStart.toISOString()
            };

        } catch (error) {
            logger.error('Error fetching usage from database:', error);
            return {
                roastsThisMonth: 0,
                analysisThisMonth: 0,
                platformAccounts: {},
                cycleStart: cycleStart.toISOString()
            };
        }
    }

    /**
     * Handle tier upgrade - reset limits immediately
     */
    async handleTierUpgrade(userId, newTier, oldTier) {
        try {
            logger.info('Processing tier upgrade:', {
                userId,
                oldTier,
                newTier,
                timestamp: new Date().toISOString()
            });

            // Clear usage cache to force refresh
            this.usageCache.delete(userId);

            // Reset usage counters immediately
            await this.resetUsageCounters(userId);

            return { success: true, message: 'Límites reseteados inmediatamente tras upgrade' };

        } catch (error) {
            logger.error('Error handling tier upgrade:', error);
            throw error;
        }
    }

    /**
     * Handle tier downgrade - apply in next cycle
     */
    async handleTierDowngrade(userId, newTier, oldTier) {
        try {
            logger.info('Processing tier downgrade:', {
                userId,
                oldTier,
                newTier,
                timestamp: new Date().toISOString()
            });

            // Mark downgrade as pending for next cycle
            await supabaseServiceClient
                .from('pending_plan_changes')
                .insert({
                    user_id: userId,
                    current_plan: oldTier,
                    new_plan: newTier,
                    change_type: 'downgrade',
                    effective_date: this.getNextCycleStart(),
                    created_at: new Date().toISOString()
                });

            return { 
                success: true, 
                message: 'Downgrade aplicará en el siguiente ciclo de facturación',
                effectiveDate: this.getNextCycleStart()
            };

        } catch (error) {
            logger.error('Error handling tier downgrade:', error);
            throw error;
        }
    }

    /**
     * Reset usage counters (for upgrades)
     * @private
     */
    async resetUsageCounters(userId) {
        const cycleStart = new Date().toISOString();
        
        // Reset in analysis_usage table
        await supabaseServiceClient
            .from('analysis_usage')
            .update({ quantity: 0, updated_at: cycleStart })
            .eq('user_id', userId)
            .gte('created_at', this.getMonthStart().toISOString());

        // Note: roast count comes from user_activities which we don't reset
        // but we track cycle start for counting
    }

    /**
     * Get start of current month
     * @private
     */
    getMonthStart() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }

    /**
     * Get start of next billing cycle
     * @private
     */
    getNextCycleStart() {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return nextMonth.toISOString();
    }

    /**
     * Cache usage data
     * @private
     */
    setCachedUsage(userId, usage) {
        this.usageCache.set(userId, {
            data: usage,
            timestamp: Date.now()
        });
    }

    /**
     * Get cached usage if valid
     * @private
     */
    getCachedUsage(userId) {
        const cached = this.usageCache.get(userId);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    /**
     * Sanitize usage data for client response
     * @private
     */
    sanitizeUsageForResponse(usage) {
        return {
            roastsThisMonth: usage.roastsThisMonth,
            analysisThisMonth: usage.analysisThisMonth,
            platformAccounts: Object.keys(usage.platformAccounts || {}).length
        };
    }

    /**
     * Generate user-friendly limit messages
     * @private
     */
    getAnalysisLimitMessage(limit, current) {
        return `Has alcanzado tu límite mensual de ${limit} análisis. Has usado ${current}/${limit}.`;
    }

    getRoastLimitMessage(limit, current) {
        return `Has alcanzado tu límite mensual de ${limit} roasts. Has usado ${current}/${limit}.`;
    }

    getPlatformLimitMessage(platform, limit, current) {
        return `Has alcanzado tu límite de ${limit} cuenta(s) para ${platform}. Tienes ${current}/${limit} activa(s).`;
    }

    /**
     * Get upgrade recommendation based on usage pattern
     * @private
     */
    getUpgradeRecommendation(usageType, currentLimit) {
        if (usageType === 'analysis' && currentLimit <= 100) return 'starter';
        if (usageType === 'analysis' && currentLimit <= 1000) return 'pro';
        if (usageType === 'roast' && currentLimit <= 10) return 'starter';
        if (usageType === 'roast' && currentLimit <= 100) return 'pro';
        if (usageType === 'platform' && currentLimit <= 1) return 'pro';
        return 'plus';
    }

    /**
     * Get next cycle start in UTC (CodeRabbit Round 5)
     * @param {string} periodEndIso - Optional period end ISO string
     * @returns {string} Next cycle start ISO string
     */
    getNextCycleStartUTC(periodEndIso) {
        if (periodEndIso) {
            // Calculate from provided period end - return next day
            const periodEnd = new Date(periodEndIso);
            const nextDay = new Date(periodEnd.getTime() + 24 * 60 * 60 * 1000);
            // Set to start of day
            nextDay.setUTCHours(0, 0, 0, 0);
            return nextDay.toISOString();
        } else {
            // Calculate from current date - next month
            const now = new Date();
            const nextMonth = now.getUTCMonth() + 1;
            const year = nextMonth > 11 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
            const month = nextMonth > 11 ? 0 : nextMonth;

            const nextCycleStart = new Date(Date.UTC(year, month, 1));
            return nextCycleStart.toISOString();
        }
    }

    /**
     * Compute effective cycle start accounting for upgrade resets (CodeRabbit Round 5)
     * @param {Object} userTier - User tier data
     * @param {string} userId - User ID
     * @returns {Promise<Date>} Effective cycle start date
     */
    async computeEffectiveCycleStart(userTier, userId) {
        try {
            // Check if there's an upgrade reset marker
            const { data, error } = await supabaseServiceClient
                .from('tier_reset_markers')
                .select('reset_timestamp')
                .eq('user_id', userId)
                .single();

            if (error || !data) {
                // No reset marker, use billing period start
                return new Date(userTier.periodStart);
            }

            const resetDate = new Date(data.reset_timestamp);
            const billingStart = new Date(userTier.periodStart);

            // Use the later of the two dates
            return resetDate > billingStart ? resetDate : billingStart;

        } catch (error) {
            logger.error('Error computing effective cycle start:', error);
            // Fallback to billing period start
            return new Date(userTier.periodStart);
        }
    }

    /**
     * Handle tier downgrade with enhanced billing period handling (CodeRabbit Round 5)
     * @param {string} userId - User ID
     * @param {string} newPlan - New plan ID
     * @param {string} oldPlan - Previous plan ID
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<Object>} Downgrade result
     */
    async handleTierDowngradeEnhanced(userId, newPlan, oldPlan, metadata) {
        try {
            // Get current billing period end
            const { data: tierData, error: tierError } = await supabaseServiceClient
                .from('user_subscriptions')
                .select('current_period_end')
                .eq('user_id', userId)
                .single();

            if (tierError) {
                throw tierError;
            }

            // Schedule the downgrade for the end of the billing period
            const downgradeSchedule = {
                user_id: userId,
                scheduled_plan: newPlan,
                current_plan: oldPlan,
                effective_date: tierData.current_period_end,
                created_at: new Date().toISOString(),
                metadata: {
                    ...metadata,
                    type: 'tier_downgrade',
                    service_version: 'tier_validation_v1'
                }
            };

            const { data, error } = await supabaseServiceClient
                .from('tier_change_schedule')
                .upsert(downgradeSchedule);

            if (error) {
                throw error;
            }

            return {
                success: true,
                billingPeriodEnd: tierData.current_period_end,
                effectiveDate: tierData.current_period_end,
                newPlan,
                oldPlan
            };

        } catch (error) {
            logger.error('Error in handleTierDowngradeEnhanced:', error);
            throw error;
        }
    }

    /**
     * Record usage action atomically (CodeRabbit Round 5)
     * @param {string} userId - User ID
     * @param {string} actionType - Action type
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<boolean>} Success status
     */
    async recordUsageActionAtomic(userId, actionType, metadata = {}) {
        try {
            const { data, error } = await supabaseServiceClient
                .from('user_activity_log')
                .insert({
                    user_id: userId,
                    activity_type: actionType,
                    metadata: {
                        ...metadata,
                        service_version: 'tier_validation_v1',
                        timestamp: new Date().toISOString()
                    },
                    created_at: new Date().toISOString()
                });

            if (error) {
                logger.error('Error recording usage action:', error);
                return false;
            }

            return true;

        } catch (error) {
            logger.error('Error in recordUsageActionAtomic:', error);
            return false;
        }
    }

    /**
     * Record multiple usage actions in batch (CodeRabbit Round 5)
     * @param {string} userId - User ID
     * @param {Array} actions - Array of action objects
     * @returns {Promise<Object>} Batch result
     */
    async recordUsageActionsBatch(userId, actions) {
        if (!actions || actions.length === 0) {
            return { success: 0, failed: 0 };
        }

        let successCount = 0;
        let failedCount = 0;

        try {
            const records = actions.map(action => ({
                user_id: userId,
                activity_type: action.actionType,
                metadata: {
                    ...action.metadata,
                    service_version: 'tier_validation_v1',
                    timestamp: new Date().toISOString()
                },
                created_at: new Date().toISOString()
            }));

            const { data, error } = await supabaseServiceClient
                .from('user_activity_log')
                .insert(records);

            if (error) {
                logger.error('Error in batch recording:', error);
                failedCount = actions.length;
            } else {
                successCount = actions.length;
            }

        } catch (error) {
            logger.error('Error in recordUsageActionsBatch:', error);
            failedCount = actions.length;
        }

        return { success: successCount, failed: failedCount };
    }

    /**
     * Normalize plan value to valid plan ID (CodeRabbit Round 5)
     * @private
     */
    normalizePlan(plan) {
        const validPlans = ['free', 'starter', 'pro', 'plus'];
        if (typeof plan === 'string' && validPlans.includes(plan.toLowerCase())) {
            return plan.toLowerCase();
        }
        return 'free'; // Default to free for invalid plans
    }

    /**
     * Get required plans for a specific feature
     * @private
     */
    getRequiredPlansForFeature(feature) {
        const featureRequirements = {
            'shield': ['starter', 'pro', 'plus'],
            'custom_tones': ['pro', 'plus'],
            'original_tone': ['pro', 'plus'],
            'embedded_judge': ['plus'],
            'analytics': ['pro', 'plus'],
            'api_access': ['plus'],
            'priority_support': ['pro', 'plus']
        };

        return featureRequirements[feature] || [];
    }

    /**
     * Cache management methods (CodeRabbit Round 5)
     * @private
     */
    getCachedUserTier(userId) {
        if (this.lastCacheRefresh && 
            Date.now() - this.lastCacheRefresh > this.cacheTimeout) {
            this.usageCache.clear();
            this.lastCacheRefresh = null;
        }

        return this.usageCache.get(`tier_${userId}`);
    }

    setCachedUserTier(userId, tierData) {
        this.usageCache.set(`tier_${userId}`, tierData);
        if (!this.lastCacheRefresh) {
            this.lastCacheRefresh = Date.now();
        }
    }

    /**
     * Get default values (CodeRabbit Round 5)
     * @private
     */
    getDefaultUserTier() {
        return {
            plan: 'free',
            status: 'active',
            periodStart: new Date().toISOString(),
            periodEnd: this.getNextCycleStartUTC()
        };
    }

    getDefaultUsage() {
        return {
            roastsThisMonth: 0,
            analysisThisMonth: 0,
            platformAccounts: {}
        };
    }

    /**
     * Sanitize usage data for API response (CodeRabbit Round 5)
     * @param {Object} usage - Raw usage data
     * @returns {Object} Sanitized usage data
     */
    sanitizeUsageForResponse(usage) {
        if (!usage) {
            return {
                roastsThisMonth: 0,
                analysisThisMonth: 0,
                platformAccountsByPlatform: {},
                totalActivePlatformAccounts: 0,
                platformAccounts: 0
            };
        }

        // Handle invalid platformAccounts data gracefully
        let platformAccounts = {};
        if (usage.platformAccounts && typeof usage.platformAccounts === 'object' && !Array.isArray(usage.platformAccounts)) {
            platformAccounts = usage.platformAccounts;
        }

        const totalActiveAccounts = Object.values(platformAccounts)
            .reduce((sum, count) => sum + (Number(count) || 0), 0);
        const uniquePlatforms = Object.keys(platformAccounts).length;

        return {
            roastsThisMonth: Number(usage.roastsThisMonth) || 0,
            analysisThisMonth: Number(usage.analysisThisMonth) || 0,
            platformAccountsByPlatform: platformAccounts,
            totalActivePlatformAccounts: totalActiveAccounts,
            platformAccounts: uniquePlatforms // Legacy field for backward compatibility
        };
    }

    /**
     * Clear cache (useful for testing)
     */
    clearCache() {
        this.usageCache.clear();
        this.lastCacheRefresh = null;
    }
}

// Export singleton instance
module.exports = new TierValidationService();