/**
 * Abuse Detection Service - ROA-359
 *
 * Detects abuse patterns for authentication:
 * - Burst attacks (many attempts in short window)
 * - Slow attacks (distributed attempts over time)
 * - Multi-IP abuse for same email
 * - Multi-email abuse from same IP
 *
 * ROA-359: AC2 + AC4 - Basic abuse detection without ML
 */

const crypto = require('crypto');
const { logger } = require('../utils/logger');
const { Redis } = require('@upstash/redis');

/**
 * Abuse Detection Store
 * Tracks patterns for abuse detection
 */
class AbuseDetectionStore {
  constructor() {
    this.redis = null;
    this.memoryStore = new Map();
    this.isRedisAvailable = false;
    // ROA-359: Timer registry to prevent memory leaks
    this.trackingTimers = new Map(); // Track timers for tracking keys (IPs/emails)
    this.burstTimers = new Map(); // Track timers for burst detection keys
    this.slowAttackTimers = new Map(); // Track timers for slow attack keys
    this.initializeRedis();
  }

  async initializeRedis() {
    try {
      const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
      const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

      if (redisUrl && redisToken) {
        this.redis = new Redis({
          url: redisUrl,
          token: redisToken
        });
        await this.redis.ping();
        this.isRedisAvailable = true;
      }
    } catch (error) {
      logger.warn('Abuse Detection: Redis not available, using memory store', {
        error: error.message
      });
      this.isRedisAvailable = false;
    }
  }

  /**
   * Get key for tracking IPs per email
   */
  getEmailIPsKey(email) {
    const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').substring(0, 16);
    return `abuse:email:${emailHash}:ips`;
  }

  /**
   * Get key for tracking emails per IP
   */
  getIPEmailsKey(ip) {
    return `abuse:ip:${ip}:emails`;
  }

  /**
   * Get key for burst detection (attempts in short window)
   */
  getBurstKey(ip, email, authType) {
    const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').substring(0, 16);
    return `abuse:burst:${authType}:${ip}:${emailHash}`;
  }

  /**
   * Get key for slow attack detection (distributed attempts)
   */
  getSlowAttackKey(ip, email, authType) {
    const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').substring(0, 16);
    return `abuse:slow:${authType}:${ip}:${emailHash}`;
  }

  /**
   * Track IP for email
   * ROA-359: Memory leak fix - tracks timers to prevent leaks
   */
  async trackIPForEmail(email, ip, ttlMs = 24 * 60 * 60 * 1000) {
    const key = this.getEmailIPsKey(email);
    if (this.isRedisAvailable && this.redis) {
      try {
        await this.redis.sadd(key, ip);
        await this.redis.pexpire(key, ttlMs);
      } catch (error) {
        logger.warn('Abuse Detection: Redis track IP failed', { error: error.message });
        const ips = this.memoryStore.get(key) || new Set();
        ips.add(ip);
        this.memoryStore.set(key, ips);
        
        // ROA-359: Clear existing timer before creating new one
        if (this.trackingTimers.has(key)) {
          clearTimeout(this.trackingTimers.get(key));
        }
        
        const timer = setTimeout(() => {
          this.memoryStore.delete(key);
          this.trackingTimers.delete(key);
        }, ttlMs);
        
        this.trackingTimers.set(key, timer);
      }
    } else {
      const ips = this.memoryStore.get(key) || new Set();
      ips.add(ip);
      this.memoryStore.set(key, ips);
      
      // ROA-359: Clear existing timer before creating new one
      if (this.trackingTimers.has(key)) {
        clearTimeout(this.trackingTimers.get(key));
      }
      
      const timer = setTimeout(() => {
        this.memoryStore.delete(key);
        this.trackingTimers.delete(key);
      }, ttlMs);
      
      this.trackingTimers.set(key, timer);
    }
  }

  /**
   * Track email for IP
   * ROA-359: Memory leak fix - tracks timers to prevent leaks
   */
  async trackEmailForIP(ip, email, ttlMs = 24 * 60 * 60 * 1000) {
    const key = this.getIPEmailsKey(ip);
    const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').substring(0, 16);
    
    if (this.isRedisAvailable && this.redis) {
      try {
        await this.redis.sadd(key, emailHash);
        await this.redis.pexpire(key, ttlMs);
      } catch (error) {
        logger.warn('Abuse Detection: Redis track email failed', { error: error.message });
        const emails = this.memoryStore.get(key) || new Set();
        emails.add(emailHash);
        this.memoryStore.set(key, emails);
        
        // ROA-359: Clear existing timer before creating new one
        if (this.trackingTimers.has(key)) {
          clearTimeout(this.trackingTimers.get(key));
        }
        
        const timer = setTimeout(() => {
          this.memoryStore.delete(key);
          this.trackingTimers.delete(key);
        }, ttlMs);
        
        this.trackingTimers.set(key, timer);
      }
    } else {
      const emails = this.memoryStore.get(key) || new Set();
      emails.add(emailHash);
      this.memoryStore.set(key, emails);
      
      // ROA-359: Clear existing timer before creating new one
      if (this.trackingTimers.has(key)) {
        clearTimeout(this.trackingTimers.get(key));
      }
      
      const timer = setTimeout(() => {
        this.memoryStore.delete(key);
        this.trackingTimers.delete(key);
      }, ttlMs);
      
      this.trackingTimers.set(key, timer);
    }
  }

  /**
   * Get unique IPs for email
   */
  async getIPsForEmail(email) {
    const key = this.getEmailIPsKey(email);
    if (this.isRedisAvailable && this.redis) {
      try {
        const ips = await this.redis.smembers(key);
        return ips || [];
      } catch (error) {
        logger.warn('Abuse Detection: Redis get IPs failed', { error: error.message });
        const ips = this.memoryStore.get(key);
        return ips ? Array.from(ips) : [];
      }
    }
    const ips = this.memoryStore.get(key);
    return ips ? Array.from(ips) : [];
  }

  /**
   * Get unique emails for IP
   */
  async getEmailsForIP(ip) {
    const key = this.getIPEmailsKey(ip);
    if (this.isRedisAvailable && this.redis) {
      try {
        const emails = await this.redis.smembers(key);
        return emails || [];
      } catch (error) {
        logger.warn('Abuse Detection: Redis get emails failed', { error: error.message });
        const emails = this.memoryStore.get(key);
        return emails ? Array.from(emails) : [];
      }
    }
    const emails = this.memoryStore.get(key);
    return emails ? Array.from(emails) : [];
  }

  /**
   * Record burst attempt
   * ROA-359: Memory leak fix - tracks timers to prevent leaks
   */
  async recordBurstAttempt(ip, email, authType, windowMs = 60 * 1000) {
    const key = this.getBurstKey(ip, email, authType);
    if (this.isRedisAvailable && this.redis) {
      try {
        const count = await this.redis.incr(key);
        await this.redis.pexpire(key, windowMs);
        return count;
      } catch (error) {
        logger.warn('Abuse Detection: Redis burst record failed', { error: error.message });
        const count = (this.memoryStore.get(key) || 0) + 1;
        this.memoryStore.set(key, count);
        
        // ROA-359: Clear existing timer before creating new one
        if (this.burstTimers.has(key)) {
          clearTimeout(this.burstTimers.get(key));
        }
        
        const timer = setTimeout(() => {
          this.memoryStore.delete(key);
          this.burstTimers.delete(key);
        }, windowMs);
        
        this.burstTimers.set(key, timer);
        return count;
      }
    }
    
    const count = (this.memoryStore.get(key) || 0) + 1;
    this.memoryStore.set(key, count);
    
    // ROA-359: Clear existing timer before creating new one
    if (this.burstTimers.has(key)) {
      clearTimeout(this.burstTimers.get(key));
    }
    
    const timer = setTimeout(() => {
      this.memoryStore.delete(key);
      this.burstTimers.delete(key);
    }, windowMs);
    
    this.burstTimers.set(key, timer);
    return count;
  }

  /**
   * Get burst count
   */
  async getBurstCount(ip, email, authType) {
    const key = this.getBurstKey(ip, email, authType);
    if (this.isRedisAvailable && this.redis) {
      try {
        const count = await this.redis.get(key);
        return count ? parseInt(count, 10) : 0;
      } catch (error) {
        logger.warn('Abuse Detection: Redis get burst failed', { error: error.message });
        return this.memoryStore.get(key) || 0;
      }
    }
    return this.memoryStore.get(key) || 0;
  }

  /**
   * Record slow attack attempt (distributed over longer window)
   * ROA-359: Memory leak fix - tracks timers to prevent leaks
   */
  async recordSlowAttackAttempt(ip, email, authType, windowMs = 60 * 60 * 1000) {
    const key = this.getSlowAttackKey(ip, email, authType);
    if (this.isRedisAvailable && this.redis) {
      try {
        const count = await this.redis.incr(key);
        await this.redis.pexpire(key, windowMs);
        return count;
      } catch (error) {
        logger.warn('Abuse Detection: Redis slow attack record failed', { error: error.message });
        const count = (this.memoryStore.get(key) || 0) + 1;
        this.memoryStore.set(key, count);
        
        // ROA-359: Clear existing timer before creating new one
        if (this.slowAttackTimers.has(key)) {
          clearTimeout(this.slowAttackTimers.get(key));
        }
        
        const timer = setTimeout(() => {
          this.memoryStore.delete(key);
          this.slowAttackTimers.delete(key);
        }, windowMs);
        
        this.slowAttackTimers.set(key, timer);
        return count;
      }
    }
    
    const count = (this.memoryStore.get(key) || 0) + 1;
    this.memoryStore.set(key, count);
    
    // ROA-359: Clear existing timer before creating new one
    if (this.slowAttackTimers.has(key)) {
      clearTimeout(this.slowAttackTimers.get(key));
    }
    
    const timer = setTimeout(() => {
      this.memoryStore.delete(key);
      this.slowAttackTimers.delete(key);
    }, windowMs);
    
    this.slowAttackTimers.set(key, timer);
    return count;
  }

  /**
   * Get slow attack count
   */
  async getSlowAttackCount(ip, email, authType) {
    const key = this.getSlowAttackKey(ip, email, authType);
    if (this.isRedisAvailable && this.redis) {
      try {
        const count = await this.redis.get(key);
        return count ? parseInt(count, 10) : 0;
      } catch (error) {
        logger.warn('Abuse Detection: Redis get slow attack failed', { error: error.message });
        return this.memoryStore.get(key) || 0;
      }
    }
    return this.memoryStore.get(key) || 0;
  }
}

const abuseStore = new AbuseDetectionStore();

/**
 * Detect abuse patterns
 * ROA-359: AC2 - Basic abuse detection without ML
 */
async function detectAbuse(ip, email, authType, config = {}) {
  const {
    multiIPThreshold = 3, // Different IPs for same email
    multiEmailThreshold = 5, // Different emails for same IP
    burstThreshold = 10, // Attempts in 1 minute
    slowAttackThreshold = 20 // Attempts in 1 hour
  } = config;

  const patterns = {
    multiIPAbuse: false,
    multiEmailAbuse: false,
    burstAttack: false,
    slowAttack: false,
    riskScore: 0
  };

  try {
    // Track relationships
    await abuseStore.trackIPForEmail(email, ip);
    await abuseStore.trackEmailForIP(ip, email);

    // Check multi-IP abuse (same email, different IPs)
    const ipsForEmail = await abuseStore.getIPsForEmail(email);
    if (ipsForEmail.length >= multiIPThreshold) {
      patterns.multiIPAbuse = true;
      patterns.riskScore += 30;
    }

    // Check multi-email abuse (same IP, different emails)
    const emailsForIP = await abuseStore.getEmailsForIP(ip);
    if (emailsForIP.length >= multiEmailThreshold) {
      patterns.multiEmailAbuse = true;
      patterns.riskScore += 30;
    }

    // Check burst attack
    const burstCount = await abuseStore.recordBurstAttempt(ip, email, authType, 60 * 1000);
    if (burstCount >= burstThreshold) {
      patterns.burstAttack = true;
      patterns.riskScore += 40;
    }

    // Check slow attack
    const slowCount = await abuseStore.recordSlowAttackAttempt(ip, email, authType, 60 * 60 * 1000);
    if (slowCount >= slowAttackThreshold) {
      patterns.slowAttack = true;
      patterns.riskScore += 20;
    }

    // Cap risk score at 100
    patterns.riskScore = Math.min(patterns.riskScore, 100);

    return patterns;
  } catch (error) {
    logger.error('Abuse Detection: Error detecting abuse patterns', {
      error: error.message,
      ip,
      email: email ? email.substring(0, 3) + '***' : 'unknown',
      authType
    });
    return patterns; // Return empty patterns on error
  }
}

module.exports = {
  detectAbuse,
  AbuseDetectionStore
};

