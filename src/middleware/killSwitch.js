/**
 * Kill Switch Middleware
 * Issue #294: Kill Switch global y panel de control de feature flags para administradores
 * 
 * Provides middleware to check kill switch status before processing autopost operations
 * Includes caching for performance and real-time updates
 */

const { supabaseServiceClient } = require('../config/supabase');
const { logger } = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class KillSwitchService {
    constructor(options = {}) {
        this.cache = new Map();
        this.cacheTimeout = 30000; // 30 seconds cache
        this.lastCacheUpdate = 0;
        this.isInitialized = false;

        // Configuration for missing flag behavior
        this.config = {
            missingFlagBehavior: options.missingFlagBehavior || 'disable', // 'disable', 'enable', 'throw'
            defaultValues: options.defaultValues || {
                is_enabled: false,
                flag_value: false
            }
        };

        // Local cache file configuration
        this.localCacheConfig = {
            filePath: path.join(process.cwd(), '.cache', 'kill-switch-state.json'),
            tempFilePath: path.join(process.cwd(), '.cache', 'kill-switch-state.tmp'),
            ttlMinutes: options.localCacheTTL || 60, // 1 hour default TTL
            encryptionKey: options.encryptionKey || process.env.KILL_SWITCH_CACHE_KEY || 'default-key-change-in-production'
        };

        // Ensure cache directory exists
        this.ensureCacheDirectory();
    }

    /**
     * Ensure cache directory exists
     */
    async ensureCacheDirectory() {
        try {
            const cacheDir = path.dirname(this.localCacheConfig.filePath);
            await fs.mkdir(cacheDir, { recursive: true, mode: 0o700 });
        } catch (error) {
            logger.error('Failed to create cache directory', { error: error.message });
        }
    }

    /**
     * Encrypt data for local cache
     */
    encrypt(data) {
        try {
            const cipher = crypto.createCipher('aes-256-cbc', this.localCacheConfig.encryptionKey);
            let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            return encrypted;
        } catch (error) {
            logger.error('Failed to encrypt cache data', { error: error.message });
            return null;
        }
    }

    /**
     * Decrypt data from local cache
     */
    decrypt(encryptedData) {
        try {
            const decipher = crypto.createDecipher('aes-256-cbc', this.localCacheConfig.encryptionKey);
            let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return JSON.parse(decrypted);
        } catch (error) {
            logger.error('Failed to decrypt cache data', { error: error.message });
            return null;
        }
    }

    /**
     * Save kill switch state to local cache
     */
    async saveLocalCache(killSwitchState) {
        try {
            // Ensure cache directory exists before writing (handles race conditions during init)
            await this.ensureCacheDirectory();

            const cacheData = {
                killSwitchActive: killSwitchState,
                timestamp: Date.now(),
                version: 1
            };

            const encryptedData = this.encrypt(cacheData);
            if (!encryptedData) return false;

            // Atomic write: write to temp file then rename
            await fs.writeFile(this.localCacheConfig.tempFilePath, encryptedData, { mode: 0o600 });
            await fs.rename(this.localCacheConfig.tempFilePath, this.localCacheConfig.filePath);

            logger.debug('Kill switch state saved to local cache', { killSwitchActive: killSwitchState });
            return true;
        } catch (error) {
            logger.error('Failed to save local cache', { error: error.message });
            return false;
        }
    }

    /**
     * Load kill switch state from local cache
     */
    async loadLocalCache() {
        try {
            const encryptedData = await fs.readFile(this.localCacheConfig.filePath, 'utf8');
            const cacheData = this.decrypt(encryptedData);

            if (!cacheData) return null;

            // Check TTL
            const ageMinutes = (Date.now() - cacheData.timestamp) / (1000 * 60);
            if (ageMinutes > this.localCacheConfig.ttlMinutes) {
                logger.debug('Local cache expired', { ageMinutes, ttl: this.localCacheConfig.ttlMinutes });
                return null;
            }

            logger.debug('Kill switch state loaded from local cache', {
                killSwitchActive: cacheData.killSwitchActive,
                ageMinutes: Math.round(ageMinutes)
            });

            return cacheData.killSwitchActive;
        } catch (error) {
            if (error.code !== 'ENOENT') {
                logger.error('Failed to load local cache', { error: error.message });
            }
            return null;
        }
    }

    /**
     * Initialize the kill switch service
     */
    async initialize() {
        try {
            // Ensure cache directory exists before any cache operations
            await this.ensureCacheDirectory();
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
                this.isInitialized = true;
            } catch (error) {
                logger.warn('Cache refresh failed, using stale data', { error: error.message });
                // Keep isInitialized as false when refresh fails
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
                return this.handleMissingFlag(flagKey, error);
            }

            return {
                is_enabled: flag.is_enabled,
                flag_value: flag.flag_value,
                cached_at: Date.now()
            };
        } catch (error) {
            logger.error('Failed to get flag from database', { flagKey, error: error.message });
            return this.handleMissingFlag(flagKey, error);
        }
    }

    /**
     * Handle missing flag based on configuration
     */
    handleMissingFlag(flagKey, error = null) {
        const errorContext = {
            flagKey,
            missingFlagBehavior: this.config.missingFlagBehavior,
            error: error?.message || 'Flag not found'
        };

        logger.warn('Handling missing flag', errorContext);

        switch (this.config.missingFlagBehavior) {
            case 'enable':
                logger.info('Missing flag behavior: enabling flag by default', { flagKey });
                return {
                    is_enabled: true,
                    flag_value: true,
                    cached_at: Date.now()
                };

            case 'throw':
                logger.error('Missing flag behavior: throwing error', errorContext);
                throw new Error(`Feature flag '${flagKey}' not found and missingFlagBehavior is set to 'throw'`);

            case 'disable':
            default:
                logger.info('Missing flag behavior: disabling flag by default', { flagKey });
                return {
                    is_enabled: this.config.defaultValues.is_enabled,
                    flag_value: this.config.defaultValues.flag_value,
                    cached_at: Date.now()
                };
        }
    }

    /**
     * Check if the global kill switch is active
     * Uses local cache fallback when database is unavailable
     */
    async isKillSwitchActive() {
        try {
            const flag = await this.getFlag('KILL_SWITCH_AUTOPOST');
            const isActive = flag.is_enabled === true;

            // Update local cache with current state
            await this.saveLocalCache(isActive);

            return isActive;
        } catch (error) {
            logger.error('Error checking kill switch status from database', { error: error.message });

            // Try to load from local cache as fallback
            const cachedState = await this.loadLocalCache();
            if (cachedState !== null) {
                logger.warn('Using cached kill switch state due to database error', {
                    cachedState,
                    error: error.message
                });
                return cachedState;
            }

            // If no cache available, fail closed for kill switch (block operations)
            // This is the safe default for a kill switch - when in doubt, block
            logger.error('No cached kill switch state available, failing closed (blocking operations)', {
                error: error.message
            });
            return true;
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

// Auto-initialize the singleton on module import
killSwitchService.initialize().catch(error => {
    logger.error('Failed to auto-initialize kill switch service on import', { error: error.message });
    // Don't throw - allow graceful degradation
});

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
        // The isKillSwitchActive method now handles fallback logic internally
        // If it returns true due to error, we should block the request
        return res.status(503).json({
            success: false,
            error: 'Service temporarily unavailable',
            code: 'KILL_SWITCH_ERROR',
            message: 'Unable to verify system status, blocking operation for safety'
        });
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
            // Fail closed for safety - block the request if we can't verify status
            return res.status(503).json({
                success: false,
                error: 'Service temporarily unavailable',
                code: 'PLATFORM_CHECK_ERROR',
                message: 'Unable to verify platform autopost status, blocking operation for safety',
                platform
            });
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
        // Fail closed - block autopost if we can't check the status (safety first)
        return {
            blocked: true,
            reason: 'CHECK_FAILED',
            message: 'Could not verify autopost status, blocking operation for safety'
        };
    }
};

module.exports = {
    killSwitchService,
    checkKillSwitch,
    checkPlatformAutopost,
    shouldBlockAutopost
};
