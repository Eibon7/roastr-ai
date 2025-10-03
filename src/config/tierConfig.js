/**
 * Centralized Tier Configuration
 * Issue #368: CodeRabbit Round 6 Improvements
 * 
 * Extracts all hardcoded pricing, limits, and configuration data 
 * to a centralized location for better maintainability and consistency.
 */

/**
 * Tier pricing configuration with currency formatting
 */
const TIER_PRICING = {
    currency: '€',
    monthly: {
        free: 0,
        starter: 5,
        pro: 15,
        plus: 50
    },
    formatPrice: (amount) => amount === 0 ? 'Gratis' : `€${amount}/mes`,
    getPrice: (tier) => TIER_PRICING.monthly[tier] || 0,
    formatTierPrice: (tier) => TIER_PRICING.formatPrice(TIER_PRICING.getPrice(tier))
};

/**
 * Plan upgrade configuration and paths
 */
const UPGRADE_CONFIG = {
    upgradePaths: {
        free: ['starter', 'pro', 'plus'],
        starter: ['pro', 'plus'],
        pro: ['plus'],
        plus: []
    },
    downgradePaths: {
        plus: ['pro', 'starter', 'free'],
        pro: ['starter', 'free'],
        starter: ['free'],
        free: []
    },
    getNextTier: (currentTier) => {
        const paths = UPGRADE_CONFIG.upgradePaths[currentTier] || [];
        return paths[0] || null;
    },
    canUpgrade: (fromTier, toTier) => {
        const paths = UPGRADE_CONFIG.upgradePaths[fromTier] || [];
        return paths.includes(toTier);
    },
    canDowngrade: (fromTier, toTier) => {
        const paths = UPGRADE_CONFIG.downgradePaths[fromTier] || [];
        return paths.includes(toTier);
    }
};

/**
 * Usage warning thresholds
 */
const WARNING_THRESHOLDS = {
    percentage: {
        warning: 60,    // First warning at 60%
        critical: 80,   // Critical warning at 80%
        exceeded: 100   // Limit exceeded at 100%
    },
    getThresholdLevel: (usagePercentage) => {
        if (usagePercentage >= WARNING_THRESHOLDS.percentage.exceeded) return 'exceeded';
        if (usagePercentage >= WARNING_THRESHOLDS.percentage.critical) return 'critical';
        if (usagePercentage >= WARNING_THRESHOLDS.percentage.warning) return 'warning';
        return 'normal';
    }
};

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
    timeouts: {
        usage: 2 * 60 * 1000,      // 2 minutes for usage data
        tiers: 10 * 60 * 1000,     // 10 minutes for tier data
        limits: 30 * 60 * 1000     // 30 minutes for plan limits
    },
    invalidation: {
        delayMs: 100,              // Delay before clearing pending invalidations
        batchSize: 100             // Maximum batch size for bulk operations
    },
    cleanup: {
        intervalMs: 5 * 60 * 1000, // Cleanup every 5 minutes
        maxEntries: 1000           // Maximum cache entries
    }
};

/**
 * Supported platforms (centralized)
 */
const SUPPORTED_PLATFORMS = [
    'twitter', 'youtube', 'instagram', 'facebook', 
    'discord', 'twitch', 'reddit', 'tiktok', 'bluesky'
];

/**
 * Feature to property mappings for validation
 */
const FEATURE_MAPPINGS = {
    'shield': 'shieldEnabled',
    'custom_tones': 'customTones',
    'ENABLE_ORIGINAL_TONE': 'customTones',
    'embedded_judge': 'embeddedJudge',
    'analytics': 'analyticsEnabled',
    'api_access': 'apiAccess',
    'priority_support': 'prioritySupport',
    'dedicated_support': 'dedicatedSupport',
    'custom_prompts': 'customPrompts'
};

/**
 * Plan benefits descriptions for user messaging
 */
const PLAN_BENEFITS = {
    free: [
        '100 análisis por mes',
        '10 roasts por mes',
        '1 cuenta por red social',
        'Funcionalidades básicas'
    ],
    starter: [
        '1,000 análisis por mes',
        '10 roasts por mes',
        '1 cuenta por red social',
        'Shield habilitado'
    ],
    pro: [
        '10,000 análisis por mes',
        '1,000 roasts por mes',
        '2 cuentas por red social',
        'Shield + Tono Original'
    ],
    plus: [
        '100,000 análisis por mes',
        '5,000 roasts por mes',
        '2 cuentas por red social',
        'Shield + Tono Original + Juez Embebido'
    ]
};

/**
 * Feature requirements mapping
 */
const FEATURE_REQUIREMENTS = {
    'shield': ['starter', 'pro', 'plus'],
    'custom_tones': ['pro', 'plus'],
    'ENABLE_ORIGINAL_TONE': ['pro', 'plus'],
    'embedded_judge': ['plus'],
    'analytics': ['pro', 'plus'],
    'api_access': ['plus'],
    'priority_support': ['pro', 'plus'],
    'dedicated_support': ['plus'],
    'custom_prompts': ['pro', 'plus']
};

/**
 * Default tier limits exactly per SPEC 10
 */
const DEFAULT_TIER_LIMITS = {
    free: {
        maxRoasts: 10,
        monthlyResponsesLimit: 10,
        monthlyAnalysisLimit: 100,
        maxPlatforms: 1,
        integrationsLimit: 1,
        shieldEnabled: false,
        customPrompts: false,
        prioritySupport: false,
        apiAccess: false,
        analyticsEnabled: false,
        customTones: false,
        dedicatedSupport: false,
        embeddedJudge: false,
        monthlyTokensLimit: 50000,
        dailyApiCallsLimit: 100,
        ai_model: 'gpt-3.5-turbo'
    },
    starter: {
        maxRoasts: 10,
        monthlyResponsesLimit: 10,
        monthlyAnalysisLimit: 1000,
        maxPlatforms: 1,
        integrationsLimit: 1,
        shieldEnabled: true,
        customPrompts: false,
        prioritySupport: false,
        apiAccess: false,
        analyticsEnabled: false,
        customTones: false,
        dedicatedSupport: false,
        embeddedJudge: false,
        monthlyTokensLimit: 100000,
        dailyApiCallsLimit: 500,
        ai_model: 'gpt-4o'
    },
    pro: {
        maxRoasts: 1000,
        monthlyResponsesLimit: 1000,
        monthlyAnalysisLimit: 10000,
        maxPlatforms: 2,
        integrationsLimit: 2,
        shieldEnabled: true,
        customPrompts: true,
        prioritySupport: true,
        apiAccess: false,
        analyticsEnabled: true,
        customTones: true,
        dedicatedSupport: false,
        embeddedJudge: false,
        monthlyTokensLimit: 500000,
        dailyApiCallsLimit: 5000,
        ai_model: 'gpt-4o'
    },
    plus: {
        maxRoasts: 5000,
        monthlyResponsesLimit: 5000,
        monthlyAnalysisLimit: 100000,
        maxPlatforms: 2,
        integrationsLimit: 2,
        shieldEnabled: true,
        customPrompts: true,
        prioritySupport: true,
        apiAccess: true,
        analyticsEnabled: true,
        customTones: true,
        dedicatedSupport: true,
        embeddedJudge: true,
        monthlyTokensLimit: 2000000,
        dailyApiCallsLimit: 20000,
        ai_model: 'gpt-4o',
        rqc_embedded: true
    },
    custom: {
        maxRoasts: -1,
        monthlyResponsesLimit: -1,
        monthlyAnalysisLimit: -1,
        maxPlatforms: -1,
        integrationsLimit: -1,
        shieldEnabled: true,
        customPrompts: true,
        prioritySupport: true,
        apiAccess: true,
        analyticsEnabled: true,
        customTones: true,
        dedicatedSupport: true,
        embeddedJudge: true,
        monthlyTokensLimit: -1,
        dailyApiCallsLimit: -1,
        ai_model: 'gpt-4o',
        enterprise: true
    }
};

/**
 * Security configuration for fail-closed behavior
 */
const SECURITY_CONFIG = {
    failClosed: {
        forceInProduction: true,
        environmentVar: 'TIER_VALIDATION_FAIL_CLOSED',
        developmentOverride: 'TIER_VALIDATION_FAIL_OPEN'
    },
    retryPolicy: {
        maxRetries: 3,
        baseDelayMs: 1000,
        backoffMultiplier: 2
    },
    errorCodes: {
        database: ['ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND'],
        constraint: ['23503', '23505', '23514'],
        authorization: ['42501', '42601']
    }
};

/**
 * Validation helpers
 */
const VALIDATION_HELPERS = {
    isValidPlan: (plan) => {
        return ['free', 'starter', 'pro', 'plus', 'custom'].includes(plan);
    },
    
    isValidFeature: (feature) => {
        return Object.keys(FEATURE_REQUIREMENTS).includes(feature);
    },
    
    isValidPlatform: (platform) => {
        return SUPPORTED_PLATFORMS.includes(platform);
    },
    
    normalizePlan: (plan) => {
        if (typeof plan !== 'string') return 'free';
        const normalized = plan.toLowerCase().trim();
        return VALIDATION_HELPERS.isValidPlan(normalized) ? normalized : 'free';
    },
    
    getFeatureProperty: (feature) => {
        return FEATURE_MAPPINGS[feature] || null;
    },
    
    getRequiredPlans: (feature) => {
        return FEATURE_REQUIREMENTS[feature] || [];
    }
};

/**
 * Helper functions for tier validation
 */

/**
 * Get upgrade recommendation based on usage pattern
 * @param {string} usageType - Type of usage (analysis, roast, platform)  
 * @param {number} currentLimit - Current limit that was exceeded
 * @returns {string} Recommended tier
 */
function getUpgradeRecommendation(usageType, currentLimit) {
    const recommendations = {
        analysis: {
            100: 'starter',    // Free -> Starter
            1000: 'pro',       // Starter -> Pro
            10000: 'plus'      // Pro -> Plus
        },
        roast: {
            10: 'pro',         // Free/Starter -> Pro (both have 10 roasts)
            1000: 'plus'       // Pro -> Plus (1000 roasts)
        },
        platform: {
            1: 'pro'           // Free/Starter -> Pro (2 accounts per platform)
        }
    };
    
    const typeRecommendations = recommendations[usageType];
    if (!typeRecommendations) {
        return 'starter'; // Default recommendation
    }
    
    return typeRecommendations[currentLimit] || 'plus';
}

/**
 * Get plan benefits for messaging
 * @param {string} plan - Plan name
 * @returns {Array} Array of benefit strings
 */
function getPlanBenefits(plan) {
    return PLAN_BENEFITS[plan] || PLAN_BENEFITS.free;
}

/**
 * Get required plans for a feature
 * @param {string} feature - Feature name
 * @returns {Array} Array of plan names that support this feature
 */
function getRequiredPlansForFeature(feature) {
    return FEATURE_REQUIREMENTS[feature] || [];
}

/**
 * Check if platform is supported
 * @param {string} platform - Platform name
 * @returns {boolean} Whether platform is supported
 */
function isSupportedPlatform(platform) {
    return SUPPORTED_PLATFORMS.includes(platform);
};

module.exports = {
    TIER_PRICING,
    UPGRADE_CONFIG,
    WARNING_THRESHOLDS,
    CACHE_CONFIG,
    SUPPORTED_PLATFORMS,
    FEATURE_MAPPINGS,
    PLAN_BENEFITS,
    FEATURE_REQUIREMENTS,
    DEFAULT_TIER_LIMITS,
    SECURITY_CONFIG,
    VALIDATION_HELPERS,
    getUpgradeRecommendation,
    getPlanBenefits,
    getRequiredPlansForFeature,
    isSupportedPlatform
};