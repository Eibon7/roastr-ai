const crypto = require('crypto');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

class ResponseCache {
  constructor() {
    this.cache = new Map();
    this.maxCacheSize = 1000; // Maximum number of cached responses
    this.defaultTtl = 5 * 60 * 1000; // 5 minutes default TTL
    this.accessTimes = new Map(); // For LRU eviction
    
    // Clean up expired entries every 2 minutes
    setInterval(() => this.cleanupExpired(), 2 * 60 * 1000);
  }

  generateKey(req) {
    const keyData = {
      method: req.method,
      url: req.originalUrl || req.url,
      query: req.query,
      userId: req.user?.id,
      orgId: req.user?.organization_id
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }

  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.accessTimes.delete(key);
      return null;
    }
    
    // Update access time for LRU
    this.accessTimes.set(key, Date.now());
    
    return entry;
  }

  set(key, data, ttl = this.defaultTtl) {
    // Enforce cache size limit with LRU eviction
    if (this.cache.size >= this.maxCacheSize) {
      this.evictLeastRecentlyUsed();
    }
    
    const entry = {
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      ttl
    };
    
    this.cache.set(key, entry);
    this.accessTimes.set(key, Date.now());
    
    logger.debug('Response cached', {
      key: key.substring(0, 16) + '...',
      size: JSON.stringify(data).length,
      ttl
    });
  }

  evictLeastRecentlyUsed() {
    let oldestTime = Date.now();
    let oldestKey = null;
    
    for (const [key, accessTime] of this.accessTimes.entries()) {
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessTimes.delete(oldestKey);
      logger.debug('Evicted LRU cache entry', { key: oldestKey.substring(0, 16) + '...' });
    }
  }

  cleanupExpired() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        this.accessTimes.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug('Cache cleanup completed', { 
        entriesRemoved: cleaned, 
        cacheSize: this.cache.size 
      });
    }
  }

  clear() {
    this.cache.clear();
    this.accessTimes.clear();
    logger.info('Response cache cleared');
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      memoryUsage: this.getMemoryUsage()
    };
  }

  getMemoryUsage() {
    let totalSize = 0;
    for (const [key, entry] of this.cache.entries()) {
      totalSize += key.length;
      totalSize += JSON.stringify(entry).length;
    }
    return totalSize;
  }
}

const responseCacheInstance = new ResponseCache();

const responseCache = (options = {}) => {
  const {
    ttl = 5 * 60 * 1000, // 5 minutes default
    skipPaths = ['/health', '/api/health', '/api/webhooks'],
    skipMethods = ['POST', 'PUT', 'DELETE', 'PATCH'],
    onlyPaths = [], // If specified, only cache these paths
    enabled = flags.isEnabled('ENABLE_RESPONSE_CACHE')
  } = options;

  // Disable caching in test environment or if feature flag is off
  if (process.env.NODE_ENV === 'test' || !enabled) {
    logger.info('Response caching disabled (test environment or feature flag)');
    return (req, res, next) => next();
  }

  return (req, res, next) => {
    // Skip caching for certain paths
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Skip caching for certain methods
    if (skipMethods.includes(req.method)) {
      return next();
    }

    // If onlyPaths is specified, only cache those paths
    if (onlyPaths.length > 0 && !onlyPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Skip caching for authenticated admin routes
    if (req.path.startsWith('/api/admin')) {
      return next();
    }

    const cacheKey = responseCacheInstance.generateKey(req);
    const cachedResponse = responseCacheInstance.get(cacheKey);

    if (cachedResponse) {
      logger.debug('Cache hit', {
        path: req.path,
        method: req.method,
        key: cacheKey.substring(0, 16) + '...'
      });

      // Set cache headers
      res.set({
        'X-Cache': 'HIT',
        'X-Cache-TTL': Math.ceil((cachedResponse.expiresAt - Date.now()) / 1000),
        'Cache-Control': `public, max-age=${Math.ceil(cachedResponse.ttl / 1000)}`
      });

      return res.status(cachedResponse.data.statusCode || 200)
                .json(cachedResponse.data.body);
    }

    // Cache miss - intercept response
    const originalJson = res.json;
    const originalSend = res.send;
    
    res.json = function(body) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        responseCacheInstance.set(cacheKey, {
          statusCode: res.statusCode,
          body
        }, ttl);
        
        res.set({
          'X-Cache': 'MISS',
          'Cache-Control': `public, max-age=${Math.ceil(ttl / 1000)}`
        });
      }
      
      return originalJson.call(this, body);
    };

    res.send = function(body) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
          responseCacheInstance.set(cacheKey, {
            statusCode: res.statusCode,
            body: parsedBody
          }, ttl);
          
          res.set({
            'X-Cache': 'MISS',
            'Cache-Control': `public, max-age=${Math.ceil(ttl / 1000)}`
          });
        } catch (e) {
          // If body is not JSON, don't cache
          logger.debug('Skipping cache for non-JSON response');
        }
      }
      
      return originalSend.call(this, body);
    };

    next();
  };
};

module.exports = {
  responseCache,
  ResponseCache,
  responseCacheInstance
};