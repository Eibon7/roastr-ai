/**
 * Redis Client for Upstash (v2)
 *
 * Provides Redis/Upstash client for backend-v2 services.
 * Used by:
 * - rateLimitService (rate limiting auth endpoints)
 * - Future services requiring Redis
 *
 * SSOT v2 - Sección 11: Infrastructure
 */

import { Redis } from '@upstash/redis';
import { logger } from '../utils/logger.js';

let redisClient: Redis | null = null;
let isRedisAvailable = false;

/**
 * Initialize Redis client (Upstash REST SDK)
 * @returns {boolean} True if Redis is available
 */
export function initializeRedis(): boolean {
  try {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!redisUrl || !redisToken) {
      logger.warn('redis_not_configured', {
        reason: 'Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN',
        fallback: 'in-memory'
      });
      return false;
    }

    redisClient = new Redis({
      url: redisUrl,
      token: redisToken
    });

    isRedisAvailable = true;

    logger.info('redis_initialized', {
      url: redisUrl.replace(/\/\/.*@/, '//<REDACTED>@'), // Hide credentials
      provider: 'upstash'
    });

    return true;
  } catch (error: any) {
    logger.error('redis_init_failed', {
      error: error.message,
      fallback: 'in-memory'
    });
    return false;
  }
}

/**
 * Get Redis client (Upstash REST SDK)
 * @returns {Redis | null} Redis client or null if not available
 */
export function getRedisClient(): Redis | null {
  return redisClient;
}

/**
 * Check if Redis is available
 * @returns {boolean} True if Redis client is available
 */
export function isRedisClientAvailable(): boolean {
  return isRedisAvailable;
}

/**
 * Ping Redis to check connectivity
 * @returns {Promise<boolean>} True if Redis is reachable
 */
export async function pingRedis(): Promise<boolean> {
  if (!redisClient) {
    return false;
  }

  try {
    await redisClient.ping();
    return true;
  } catch (error: any) {
    logger.error('redis_ping_failed', {
      error: error.message
    });
    isRedisAvailable = false;
    return false;
  }
}

