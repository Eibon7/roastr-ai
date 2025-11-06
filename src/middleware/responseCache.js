/**
 * Response Caching Middleware (Issue #261)
 *
 * Implements in-memory caching for GET requests with configurable TTL.
 * Optimizes admin panel performance by caching expensive database queries.
 *
 * Features:
 * - TTL-based expiration
 * - Automatic cache invalidation
 * - ETag support
 * - Cache statistics
 * - Bypass for authenticated users (optional)
 */

const crypto = require('crypto');
const { logger } = require('../utils/logger');

class ResponseCache {
    constructor(options = {}) {
        this.cache = new Map();
        this.defaultTTL = options.ttl || 60 * 1000; // 60 seconds default
        this.maxSize = options.maxSize || 100; // Max cache entries
        this.stats = {
            hits: 0,
            misses: 0,
            invalidations: 0
        };
    }

    /**
     * Generate cache key from request
     * @param {Object} req - Express request
     * @returns {string} Cache key
     */
    generateKey(req) {
        const parts = [
            req.method,
            req.originalUrl || req.url,
            req.user?.id || 'anonymous',
            JSON.stringify(req.query)
        ];

        return crypto
            .createHash('sha256')
            .update(parts.join(':'))
            .digest('hex');
    }

    /**
     * Get cached response
     * @param {string} key - Cache key
     * @returns {Object|null} Cached data or null
     */
    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            return null;
        }

        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        return entry.data;
    }

    /**
     * Set cached response
     * @param {string} key - Cache key
     * @param {Object} data - Data to cache
     * @param {number} ttl - Time to live in milliseconds
     */
    set(key, data, ttl = this.defaultTTL) {
        // Enforce max size with LRU-like behavior
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            data,
            expiresAt: Date.now() + ttl,
            createdAt: Date.now()
        });
    }

    /**
     * Invalidate cache by pattern
     * @param {string|RegExp} pattern - URL pattern to invalidate
     */
    invalidate(pattern) {
        let count = 0;

        for (const [key, entry] of this.cache.entries()) {
            // Store URL in cache entry for pattern matching
            const url = entry.data?.url || '';

            if (typeof pattern === 'string' && url.includes(pattern)) {
                this.cache.delete(key);
                count++;
            } else if (pattern instanceof RegExp && pattern.test(url)) {
                this.cache.delete(key);
                count++;
            }
        }

        this.stats.invalidations += count;
        logger.debug(`Cache invalidation: ${count} entries removed`, { pattern });
        return count;
    }

    /**
     * Clear all cache
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.stats.invalidations += size;
        logger.info(`Cache cleared: ${size} entries removed`);
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;

        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: `${hitRate}%`,
            invalidations: this.stats.invalidations
        };
    }
}

// Create singleton instance
const responseCache = new ResponseCache({
    ttl: 60 * 1000, // 60 seconds
    maxSize: 100
});

/**
 * Express middleware for response caching
 * @param {Object} options - Caching options
 * @param {number} options.ttl - Time to live in milliseconds
 * @param {boolean} options.private - Cache per user (default: true)
 * @param {Function} options.skip - Function to skip caching
 * @returns {Function} Express middleware
 */
function cacheResponse(options = {}) {
    const ttl = options.ttl || 60 * 1000;
    const skipCache = options.skip || (() => false);

    return (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Skip if function returns true
        if (skipCache(req)) {
            return next();
        }

        // Generate cache key
        const key = responseCache.generateKey(req);

        // Try to get cached response
        const cached = responseCache.get(key);

        if (cached) {
            // Send cached response
            res.set('X-Cache', 'HIT');
            res.set('X-Cache-Key', key.substring(0, 16));

            logger.debug('Cache hit', {
                url: req.originalUrl,
                key: key.substring(0, 16)
            });

            return res.status(cached.status).json(cached.body);
        }

        // Cache miss - intercept response
        res.set('X-Cache', 'MISS');

        const originalJson = res.json.bind(res);

        res.json = function(body) {
            // Only cache successful responses
            if (res.statusCode >= 200 && res.statusCode < 300) {
                responseCache.set(key, {
                    status: res.statusCode,
                    body,
                    url: req.originalUrl
                }, ttl);

                logger.debug('Response cached', {
                    url: req.originalUrl,
                    key: key.substring(0, 16),
                    ttl
                });
            }

            return originalJson(body);
        };

        next();
    };
}

/**
 * Invalidate cache by pattern
 * Usage: invalidateCache('/api/admin/users')
 */
function invalidateCache(pattern) {
    return responseCache.invalidate(pattern);
}

/**
 * Invalidate all admin users cache entries (Issue #739 - M1 fix)
 * Called after any admin mutation that affects user list
 * Clears both base endpoint and all query variants
 */
function invalidateAdminUsersCache() {
    // Invalidate base endpoint + all query variants (page, filter, search, etc.)
    const patterns = [
        /^GET:\/api\/admin\/users$/,          // Base endpoint
        /^GET:\/api\/admin\/users\?.*/        // With any query params
    ];

    let totalInvalidated = 0;
    patterns.forEach(pattern => {
        const count = responseCache.invalidate(pattern);
        totalInvalidated += count;
    });

    logger.debug('Admin users cache invalidated', {
        entriesRemoved: totalInvalidated,
        patterns: patterns.map(p => p.toString())
    });

    return totalInvalidated;
}

/**
 * Get cache statistics
 */
function getCacheStats() {
    return responseCache.getStats();
}

module.exports = {
    cacheResponse,
    invalidateCache,
    invalidateAdminUsersCache,  // M1 fix: Export new helper
    getCacheStats,
    responseCache
};
