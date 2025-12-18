/**
 * Analytics Cache Service (ROA-356)
 * 
 * Service for managing analytics cache invalidation.
 * Separated from routes to allow easier testing and reuse.
 */

const { logger } = require('../utils/logger');

// These will be set by the analytics router
let analyticsCache = null;
let userIdCacheIndex = null;

/**
 * Initialize the cache service with references to cache structures
 * @param {Map} cache - The analytics cache Map
 * @param {Map} index - The userId cache index Map
 */
function initialize(cache, index) {
  analyticsCache = cache;
  userIdCacheIndex = index;
}

/**
 * Invalidate analytics cache for a specific user
 * This is called when user's persona (identity) changes to ensure analytics reflect latest data
 * @param {string} userId - User UUID whose cache should be invalidated
 */
function invalidateAnalyticsCache(userId) {
  if (!userId) {
    logger.warn('invalidateAnalyticsCache called without userId');
    return;
  }

  if (!analyticsCache || !userIdCacheIndex) {
    logger.warn('Analytics cache service not initialized');
    return;
  }

  const keysToInvalidate = userIdCacheIndex.get(userId);
  if (!keysToInvalidate || keysToInvalidate.size === 0) {
    logger.debug('No cache entries to invalidate for user', { userId });
    return;
  }

  let invalidatedCount = 0;
  for (const key of keysToInvalidate) {
    if (analyticsCache.has(key)) {
      analyticsCache.delete(key);
      invalidatedCount++;
    }
  }

  // Clean up index
  userIdCacheIndex.delete(userId);

  logger.info('Analytics cache invalidated for user', {
    userId,
    invalidatedCount,
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  initialize,
  invalidateAnalyticsCache
};

