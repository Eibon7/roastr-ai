/**
 * Plan gating middleware for Roastr.ai
 * Restricts access to endpoints based on user subscription plan
 */

const { supabaseServiceClient, createUserClient } = require('../config/supabase');
const { logger } = require('../utils/logger');

// Plan hierarchy for upgrade checks
const PLAN_HIERARCHY = {
    'free': 0,
    'starter': 1,
    'pro': 2,
    'creator_plus': 3
};

// Plan limits and features
const PLAN_LIMITS = {
    free: {
        maxPlatforms: 1,
        maxRoastsPerMonth: 10,
        features: ['basic_roasts']
    },
    starter: {
        maxPlatforms: 1,
        maxRoastsPerMonth: 10,
        features: ['basic_roasts']
    },
    pro: {
        maxPlatforms: 2,
        maxRoastsPerMonth: 1000,
        features: ['basic_roasts', 'advanced_tones', 'analytics', 'priority_support']
    },
    creator_plus: {
        maxPlatforms: 2,
        maxRoastsPerMonth: 5000,
        features: ['basic_roasts', 'advanced_tones', 'analytics', 'priority_support', 'custom_tones', 'api_access', 'white_label']
    }
};

/**
 * Middleware to require a minimum plan level
 * @param {string|Array<string>} requiredPlan - Required plan(s) or minimum plan level
 * @param {Object} options - Additional options
 * @param {boolean} options.allowTrial - Allow trial users (default: true)
 * @param {string} options.feature - Specific feature to check
 */
function requirePlan(requiredPlan, options = {}) {
    const { allowTrial = true, feature } = options;

    return async (req, res, next) => {
        try {
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                    code: 'AUTH_REQUIRED'
                });
            }

            // Get user subscription from database
            const { data: subscription, error } = await supabaseServiceClient
                .from('user_subscriptions')
                .select('plan, status, trial_end, current_period_end')
                .eq('user_id', userId)
                .single();

            if (error) {
                logger.error('Error fetching user subscription:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to verify subscription',
                    code: 'SUBSCRIPTION_CHECK_FAILED'
                });
            }

            // Default to free plan if no subscription found
            const userPlan = subscription?.plan || 'free';
            const userStatus = subscription?.status || 'active';
            const trialEnd = subscription?.trial_end ? new Date(subscription.trial_end) : null;
            const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;

            // Check if user is in trial period
            const isInTrial = trialEnd && trialEnd > new Date();
            
            // Check if subscription is past due but within grace period
            const isGracePeriod = userStatus === 'past_due' && periodEnd && periodEnd > new Date();

            // Determine if user has access based on subscription status
            const hasActiveSubscription = userStatus === 'active' || 
                                        (allowTrial && isInTrial) || 
                                        isGracePeriod;

            if (!hasActiveSubscription) {
                return res.status(402).json({
                    success: false,
                    error: 'Active subscription required',
                    code: 'SUBSCRIPTION_INACTIVE',
                    details: {
                        currentPlan: userPlan,
                        status: userStatus,
                        isExpired: !hasActiveSubscription
                    }
                });
            }

            // Check specific feature access if requested
            if (feature) {
                const planFeatures = PLAN_LIMITS[userPlan]?.features || [];
                if (!planFeatures.includes(feature)) {
                    return res.status(403).json({
                        success: false,
                        error: `Feature '${feature}' requires a higher plan`,
                        code: 'FEATURE_NOT_AVAILABLE',
                        details: {
                            currentPlan: userPlan,
                            requiredFeature: feature,
                            availableFeatures: planFeatures
                        }
                    });
                }
            }

            // Check plan requirements
            if (Array.isArray(requiredPlan)) {
                // Exact plan match required
                if (!requiredPlan.includes(userPlan)) {
                    return res.status(403).json({
                        success: false,
                        error: `Plan upgrade required. Current: ${userPlan}, Required: ${requiredPlan.join(' or ')}`,
                        code: 'PLAN_UPGRADE_REQUIRED',
                        details: {
                            currentPlan: userPlan,
                            requiredPlans: requiredPlan,
                            upgradeUrl: '/billing.html'
                        }
                    });
                }
            } else {
                // Minimum plan level required
                const userPlanLevel = PLAN_HIERARCHY[userPlan] || 0;
                const requiredPlanLevel = PLAN_HIERARCHY[requiredPlan] || 0;

                if (userPlanLevel < requiredPlanLevel) {
                    return res.status(403).json({
                        success: false,
                        error: `Plan upgrade required. Current: ${userPlan}, Required: ${requiredPlan} or higher`,
                        code: 'PLAN_UPGRADE_REQUIRED',
                        details: {
                            currentPlan: userPlan,
                            requiredPlan: requiredPlan,
                            upgradeUrl: '/billing.html'
                        }
                    });
                }
            }

            // Add subscription info to request for use in handlers
            req.subscription = {
                plan: userPlan,
                status: userStatus,
                limits: PLAN_LIMITS[userPlan],
                isInTrial: isInTrial,
                trialEnd: trialEnd,
                periodEnd: periodEnd
            };

            logger.info('Plan access granted:', {
                userId,
                userPlan,
                requiredPlan,
                feature,
                status: userStatus
            });

            next();

        } catch (error) {
            logger.error('requirePlan middleware error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error while checking plan',
                code: 'PLAN_CHECK_ERROR'
            });
        }
    };
}

/**
 * Check if user can use a specific number of platforms
 */
function requirePlatformLimit(maxPlatforms) {
    return (req, res, next) => {
        const subscription = req.subscription;
        if (!subscription) {
            return res.status(500).json({
                success: false,
                error: 'Subscription middleware required before platform limit check'
            });
        }

        const userLimit = subscription.limits?.maxPlatforms || 0;
        if (userLimit !== -1 && maxPlatforms > userLimit) {
            return res.status(403).json({
                success: false,
                error: `Platform limit exceeded. Your plan allows ${userLimit} platforms, you're trying to use ${maxPlatforms}`,
                code: 'PLATFORM_LIMIT_EXCEEDED',
                details: {
                    currentPlan: subscription.plan,
                    platformLimit: userLimit,
                    requestedPlatforms: maxPlatforms,
                    upgradeUrl: '/billing.html'
                }
            });
        }

        next();
    };
}

/**
 * Check monthly roast usage limits
 */
async function checkRoastLimit(userId, incrementBy = 1) {
    try {
        const { data: subscription, error: subError } = await supabaseServiceClient
            .from('user_subscriptions')
            .select('plan')
            .eq('user_id', userId)
            .single();

        if (subError) {
            throw new Error(`Failed to fetch subscription: ${subError.message}`);
        }

        const plan = subscription?.plan || 'free';
        const limits = PLAN_LIMITS[plan];
        
        // Unlimited roasts for creator_plus
        if (limits.maxRoastsPerMonth === -1) {
            return { allowed: true, plan, limit: -1, current: 0 };
        }

        // Check current month usage
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data: usage, error: usageError } = await supabaseServiceClient
            .from('user_activities')
            .select('id')
            .eq('user_id', userId)
            .eq('activity_type', 'roast_generated')
            .gte('created_at', startOfMonth.toISOString());

        if (usageError) {
            throw new Error(`Failed to fetch usage: ${usageError.message}`);
        }

        const currentUsage = usage?.length || 0;
        const newUsage = currentUsage + incrementBy;

        return {
            allowed: newUsage <= limits.maxRoastsPerMonth,
            plan,
            limit: limits.maxRoastsPerMonth,
            current: currentUsage,
            afterIncrement: newUsage
        };

    } catch (error) {
        logger.error('Error checking roast limit:', error);
        throw error;
    }
}

module.exports = {
    requirePlan,
    requirePlatformLimit,
    checkRoastLimit,
    PLAN_LIMITS,
    PLAN_HIERARCHY
};