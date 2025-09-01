/**
 * Kill Switch Middleware
 * Issue #294: Kill Switch global y panel de control de feature flags para administradores
 * 
 * Provides middleware to check kill switch status before processing autopost operations
 * Includes caching for performance and real-time updates
 */

const { supabaseServiceClient } = require('../config/supabase');
const { logger } = require('../utils/logger');

class KillSwitchService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 30000; // 30 seconds cache
        this.lastCacheUpdate = 0;
        this.isInitialized = false;
    }

    /**
     * Initialize the kill switch service
     */
    async initialize() {
        try {
            await this.refreshCache();
            this.isInitialized = true;
            logger.info('Kill switch service initialized');
        } catch (error) {
            logger.error('Failed to initialize kill switch service', { error: error.message });
            // Don't throw - allow graceful degradation
        }
    }

    /**
     * Refresh the feature flags cache
     */
    async refreshCache() {
        try {
            const { data: flags, error } = await supabaseServiceClient
                .from('feature_flags')
                .select('flag_key, is_enabled, flag_value')
                .in('flag_key', [
                    'KILL_SWITCH_AUTOPOST',
                    'ENABLE_AUTOPOST',
                    'AUTOPOST_TWITTER',
                    'AUTOPOST_YOUTUBE',
                    'AUTOPOST_INSTAGRAM',
                    'AUTOPOST_FACEBOOK',
                    'AUTOPOST_DISCORD',
                    'AUTOPOST_TWITCH',
                    'AUTOPOST_REDDIT',
                    'AUTOPOST_TIKTOK',
                    'AUTOPOST_BLUESKY'
                ]);

            if (error) {
                throw error;
            }

            // Update cache
            this.cache.clear();
            flags.forEach(flag => {
                this.cache.set(flag.flag_key, {
                    is_enabled: flag.is_enabled,
                    flag_value: flag.flag_value,
                    cached_at: Date.now()
                });
            });

            this.lastCacheUpdate = Date.now();
            
            logger.debug('Kill switch cache refreshed', {
                flagsCount: flags.length,
                killSwitchActive: this.isKillSwitchActive()
            });

        } catch (error) {
            logger.error('Failed to refresh kill switch cache', { error: error.message });
            throw error;
        }
    }

    /**
     * Check if cache needs refresh
     */
    needsCacheRefresh() {
        return Date.now() - this.lastCacheUpdate > this.cacheTimeout;
    }

    /**
     * Get flag value from cache or database
     */
    async getFlag(flagKey) {
        if (!this.isInitialized || this.needsCacheRefresh()) {
            try {
                await this.refreshCache();
            } catch (error) {
                logger.warn('Cache refresh failed, using stale data', { error: error.message });
            }
        }

        const cached = this.cache.get(flagKey);
        if (cached) {
            return cached;
        }

        // Fallback to direct database query
        try {
            const { data: flag, error } = await supabaseServiceClient
                .from('feature_flags')
                .select('flag_key, is_enabled, flag_value')
                .eq('flag_key', flagKey)
                .single();

            if (error || !flag) {
                logger.warn('Flag not found', { flagKey });
                return { is_enabled: false, flag_value: false };
            }

            return {
                is_enabled: flag.is_enabled,
                flag_value: flag.flag_value,
                cached_at: Date.now()
            };
        } catch (error) {
            logger.error('Failed to get flag from database', { flagKey, error: error.message });
            return { is_enabled: false, flag_value: false };
        }
    }

    /**
     * Check if the global kill switch is active
     */
    async isKillSwitchActive() {
        try {
            const flag = await this.getFlag('KILL_SWITCH_AUTOPOST');
            return flag.is_enabled === true;
        } catch (error) {
            logger.error('Error checking kill switch status', { error: error.message });
            // Fail open - if we can't check the kill switch, don't block operations
            return false;
        }
    }

    /**
     * Check if autopost is enabled globally
     */
    async isAutopostEnabled() {
        try {
            const flag = await this.getFlag('ENABLE_AUTOPOST');
            return flag.is_enabled === true;
        } catch (error) {
            logger.error('Error checking autopost status', { error: error.message });
            // Fail open - if we can't check autopost status, allow operations
            return true;
        }
    }

    /**
     * Check if autopost is enabled for a specific platform
     */
    async isPlatformAutopostEnabled(platform) {
        try {
            const platformKey = `AUTOPOST_${platform.toUpperCase()}`;
            const flag = await this.getFlag(platformKey);
            return flag.is_enabled === true;
        } catch (error) {
            logger.error('Error checking platform autopost status', { platform, error: error.message });
            // Fail open - if we can't check platform status, allow operations
            return true;
        }
    }

    /**
     * Invalidate cache (called when flags are updated)
     */
    invalidateCache() {
        this.cache.clear();
        this.lastCacheUpdate = 0;
        logger.info('Kill switch cache invalidated');
    }
}

// Singleton instance
const killSwitchService = new KillSwitchService();

/**
 * Middleware to check kill switch before autopost operations
 */
const checkKillSwitch = async (req, res, next) => {
    try {
        const isKillSwitchActive = await killSwitchService.isKillSwitchActive();
        
        if (isKillSwitchActive) {
            logger.warn('Autopost operation blocked by kill switch', {
                path: req.path,
                method: req.method,
                userAgent: req.get('User-Agent'),
                ip: req.ip
            });
            
            return res.status(503).json({
                success: false,
                error: 'Autopost operations are currently disabled',
                code: 'KILL_SWITCH_ACTIVE',
                message: 'All automatic posting has been temporarily disabled by the administrator'
            });
        }

        // Also check if autopost is enabled globally
        const isAutopostEnabled = await killSwitchService.isAutopostEnabled();
        if (!isAutopostEnabled) {
            logger.warn('Autopost operation blocked - autopost disabled', {
                path: req.path,
                method: req.method
            });
            
            return res.status(503).json({
                success: false,
                error: 'Autopost is currently disabled',
                code: 'AUTOPOST_DISABLED',
                message: 'Automatic posting is currently disabled'
            });
        }

        next();
    } catch (error) {
        logger.error('Kill switch middleware error', { error: error.message });
        // In case of error, allow the request to proceed (fail open)
        // This prevents the kill switch from breaking the system if there's a DB issue
        next();
    }
};

/**
 * Middleware to check platform-specific autopost settings
 */
const checkPlatformAutopost = (platform) => {
    return async (req, res, next) => {
        try {
            // First check global kill switch
            const isKillSwitchActive = await killSwitchService.isKillSwitchActive();
            if (isKillSwitchActive) {
                return res.status(503).json({
                    success: false,
                    error: 'Autopost operations are currently disabled',
                    code: 'KILL_SWITCH_ACTIVE'
                });
            }

            // Check platform-specific setting
            const isPlatformEnabled = await killSwitchService.isPlatformAutopostEnabled(platform);
            if (!isPlatformEnabled) {
                logger.warn('Platform autopost blocked', {
                    platform,
                    path: req.path,
                    method: req.method
                });
                
                return res.status(503).json({
                    success: false,
                    error: `Autopost is disabled for ${platform}`,
                    code: 'PLATFORM_AUTOPOST_DISABLED',
                    platform
                });
            }

            next();
        } catch (error) {
            logger.error('Platform autopost middleware error', { 
                platform, 
                error: error.message 
            });
            // Fail open
            next();
        }
    };
};

/**
 * Function to check kill switch in worker processes
 */
const shouldBlockAutopost = async (platform = null) => {
    try {
        // Check global kill switch
        const isKillSwitchActive = await killSwitchService.isKillSwitchActive();
        if (isKillSwitchActive) {
            return {
                blocked: true,
                reason: 'KILL_SWITCH_ACTIVE',
                message: 'Global kill switch is active'
            };
        }

        // Check global autopost setting
        const isAutopostEnabled = await killSwitchService.isAutopostEnabled();
        if (!isAutopostEnabled) {
            return {
                blocked: true,
                reason: 'AUTOPOST_DISABLED',
                message: 'Autopost is globally disabled'
            };
        }

        // Check platform-specific setting if platform is provided
        if (platform) {
            const isPlatformEnabled = await killSwitchService.isPlatformAutopostEnabled(platform);
            if (!isPlatformEnabled) {
                return {
                    blocked: true,
                    reason: 'PLATFORM_AUTOPOST_DISABLED',
                    message: `Autopost is disabled for ${platform}`,
                    platform
                };
            }
        }

        return {
            blocked: false,
            reason: null,
            message: 'Autopost is allowed'
        };
    } catch (error) {
        logger.error('Error checking autopost status', { error: error.message, platform });
        // Fail open - allow autopost if we can't check the status
        return {
            blocked: false,
            reason: 'CHECK_FAILED',
            message: 'Could not verify autopost status, allowing operation'
        };
    }
};

module.exports = {
    killSwitchService,
    checkKillSwitch,
    checkPlatformAutopost,
    shouldBlockAutopost
};
