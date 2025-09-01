/**
 * Rate limiting middleware specifically for roast generation endpoints
 * Implements IPv6-safe rate limiting with different limits for authenticated vs anonymous users
 */

const flags = require('../config/flags');
const { logger } = require('../utils/logger');

// In-memory store for rate limiting (consider Redis for production)
class RoastRateLimitStore {
    constructor() {
        this.store = new Map();
        this.cleanup();
    }

    // Clean up expired entries every 5 minutes
    cleanup() {
        setInterval(() => {
            const now = Date.now();
            for (const [key, data] of this.store.entries()) {
                if (now > data.resetTime) {
                    this.store.delete(key);
                }
            }
        }, 5 * 60 * 1000);
    }

    getKey(ip, userId = null) {
        // Use userId if authenticated, otherwise use IP
        return userId ? `user:${userId}` : `ip:${this.normalizeIP(ip)}`;
    }

    // Normalize IPv6 addresses to handle different representations
    normalizeIP(ip) {
        if (!ip) return 'unknown';
        
        // Handle IPv4-mapped IPv6 addresses
        if (ip.startsWith('::ffff:')) {
            return ip.substring(7); // Extract IPv4 part
        }
        
        // Handle IPv6 addresses - normalize to compressed form
        if (ip.includes(':')) {
            try {
                // Simple IPv6 normalization - remove leading zeros and compress
                return ip.split(':')
                    .map(segment => segment.replace(/^0+/, '') || '0')
                    .join(':')
                    .replace(/(:0)+:/, '::')
                    .replace(/^:/, '::');
            } catch (error) {
                logger.warn('Failed to normalize IPv6 address:', ip);
                return ip;
            }
        }
        
        return ip;
    }

    get(key) {
        const data = this.store.get(key);
        if (!data) return null;
        
        const now = Date.now();
        if (now > data.resetTime) {
            this.store.delete(key);
            return null;
        }
        
        return data;
    }

    increment(key, windowMs, maxRequests) {
        const now = Date.now();
        const data = this.get(key);
        
        if (!data) {
            // First request in window
            const newData = {
                count: 1,
                resetTime: now + windowMs,
                firstRequest: now
            };
            this.store.set(key, newData);
            return newData;
        }
        
        // Increment existing count
        data.count++;
        this.store.set(key, data);
        return data;
    }

    getRemainingTime(key) {
        const data = this.get(key);
        if (!data) return 0;
        
        return Math.max(0, data.resetTime - Date.now());
    }
}

const store = new RoastRateLimitStore();

/**
 * Extract client IP address with IPv6 support
 */
function getClientIP(req) {
    // Check various headers for the real IP
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        // Take the first IP if there are multiple
        const ip = forwarded.split(',')[0].trim();
        return ip;
    }
    
    return req.headers['x-real-ip'] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress ||
           req.ip ||
           'unknown';
}

/**
 * Create rate limiter for roast endpoints
 */
function createRoastRateLimiter(options = {}) {
    const config = {
        // Authenticated users get higher limits
        authenticatedLimit: options.authenticatedLimit || 30, // 30 requests per window
        anonymousLimit: options.anonymousLimit || 5, // 5 requests per window
        windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
        skipSuccessfulRequests: options.skipSuccessfulRequests || false,
        skipFailedRequests: options.skipFailedRequests || true,
        ...options
    };

    return (req, res, next) => {
        // Skip rate limiting if disabled
        if (!flags.isEnabled('ENABLE_RATE_LIMIT')) {
            return next();
        }

        const ip = getClientIP(req);
        const userId = req.user?.id;
        const isAuthenticated = !!userId;
        
        // Determine limits based on authentication status
        const maxRequests = isAuthenticated ? config.authenticatedLimit : config.anonymousLimit;
        const key = store.getKey(ip, userId);
        
        // Get current usage
        const current = store.increment(key, config.windowMs, maxRequests);
        
        // Check if limit exceeded
        if (current.count > maxRequests) {
            const remainingMs = store.getRemainingTime(key);
            const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
            
            logger.warn('Roast rate limit exceeded', {
                ip,
                userId,
                key,
                count: current.count,
                limit: maxRequests,
                remainingMs,
                isAuthenticated
            });

            return res.status(429).json({
                success: false,
                error: 'Rate limit exceeded',
                details: {
                    limit: maxRequests,
                    windowMs: config.windowMs,
                    retryAfter: remainingMinutes,
                    message: isAuthenticated 
                        ? `You have exceeded the rate limit of ${maxRequests} requests per ${config.windowMs / 60000} minutes. Please try again in ${remainingMinutes} minutes.`
                        : `Rate limit exceeded. Please sign in for higher limits or try again in ${remainingMinutes} minutes.`
                },
                timestamp: new Date().toISOString()
            });
        }

        // Add rate limit headers
        res.set({
            'X-RateLimit-Limit': maxRequests,
            'X-RateLimit-Remaining': Math.max(0, maxRequests - current.count),
            'X-RateLimit-Reset': new Date(current.resetTime).toISOString(),
            'X-RateLimit-Window': config.windowMs
        });

        // Log rate limit info for debugging
        if (flags.isEnabled('DEBUG_RATE_LIMIT')) {
            logger.debug('Roast rate limit check', {
                ip,
                userId,
                key,
                count: current.count,
                limit: maxRequests,
                remaining: maxRequests - current.count,
                isAuthenticated
            });
        }

        next();
    };
}

/**
 * Create rate limiter with custom configuration for different endpoints
 */
function createCustomRoastRateLimiter(authenticatedLimit, anonymousLimit, windowMs = 15 * 60 * 1000) {
    return createRoastRateLimiter({
        authenticatedLimit,
        anonymousLimit,
        windowMs
    });
}

module.exports = {
    createRoastRateLimiter,
    createCustomRoastRateLimiter,
    RoastRateLimitStore
};
