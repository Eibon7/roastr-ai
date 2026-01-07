/**
 * @fileoverview Redis client wrapper for Upstash Redis
 * @module lib/redis
 * @since ROA-392
 * 
 * Provides a centralized Redis client for the application.
 * Uses Upstash Redis in production, with fallback to mock for testing.
 */

const { Redis } = require('@upstash/redis');
const { mockMode } = require('../config/mockMode');

let redisClient = null;

/**
 * Get or create Redis client
 * @returns {Redis} Redis client instance
 */
function getRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  // Check if running in mock mode
  if (mockMode.enabled) {
    // Return mock Redis client for testing
    return createMockRedisClient();
  }

  // Production: Use Upstash Redis
  const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    console.warn(
      'Redis credentials not found. Using mock Redis client. ' +
        'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for production.'
    );
    return createMockRedisClient();
  }

  redisClient = new Redis({
    url: UPSTASH_REDIS_REST_URL,
    token: UPSTASH_REDIS_REST_TOKEN
  });

  return redisClient;
}

/**
 * Create mock Redis client for testing/development
 * @returns {Object} Mock Redis client
 */
function createMockRedisClient() {
  // In-memory storage for mock
  const storage = new Map();

  return {
    // Sorted set operations
    async zadd(key, score, member) {
      if (!storage.has(key)) {
        storage.set(key, []);
      }
      const set = storage.get(key);
      set.push({ score, member });
      return set.length;
    },

    async zremrangebyscore(key, min, max) {
      if (!storage.has(key)) {
        return 0;
      }
      const set = storage.get(key);
      const filtered = set.filter((item) => item.score < min || item.score > max);
      const removed = set.length - filtered.length;
      storage.set(key, filtered);
      return removed;
    },

    async zcard(key) {
      if (!storage.has(key)) {
        return 0;
      }
      return storage.get(key).length;
    },

    async zrange(key, start, stop, ...options) {
      if (!storage.has(key)) {
        return [];
      }
      const set = storage.get(key);
      const sorted = [...set].sort((a, b) => a.score - b.score);
      const slice = sorted.slice(start, stop + 1);

      // Check if WITHSCORES option is passed
      const withScores = options.includes('WITHSCORES');
      if (withScores) {
        return slice.flatMap((item) => [item.member, item.score.toString()]);
      }

      return slice.map((item) => item.member);
    },

    async expire(key, seconds) {
      // Mock: Just acknowledge, no actual expiry in memory
      return 1;
    },

    async del(key) {
      if (storage.has(key)) {
        storage.delete(key);
        return 1;
      }
      return 0;
    },

    // For testing: clear all storage
    _clearAll() {
      storage.clear();
    }
  };
}

// Export singleton instance
module.exports = getRedisClient();

