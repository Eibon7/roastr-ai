/**
 * Auth Rate Limiter v2 Tests - ROA-359
 * Tests for enhanced rate limiting and abuse policy v2
 */

// Mock flags BEFORE importing modules that use it
vi.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: vi.fn(() => true),
    reload: vi.fn()
  }
}));

// Mock SettingsLoaderV2 - ROA-359: AC6 - Mock SSOT loader
const mockRateLimitConfig = {
  password: {
    windowMs: 15 * 60 * 1000,
    maxAttempts: 5,
    blockDurationMs: 15 * 60 * 1000
  },
  magic_link: {
    windowMs: 60 * 60 * 1000,
    maxAttempts: 3,
    blockDurationMs: 60 * 60 * 1000
  },
  oauth: {
    windowMs: 15 * 60 * 1000,
    maxAttempts: 10,
    blockDurationMs: 15 * 60 * 1000
  },
  password_reset: {
    windowMs: 60 * 60 * 1000,
    maxAttempts: 3,
    blockDurationMs: 60 * 60 * 1000
  }
};

const mockBlockDurations = [
  15 * 60 * 1000,
  60 * 60 * 1000,
  24 * 60 * 60 * 1000,
  null
];

const mockAbuseDetectionThresholds = {
  multi_ip: 3,
  multi_email: 5,
  burst: 10,
  slow_attack: 20
};

vi.mock('../../../src/services/settingsLoaderV2', () => ({
  default: {
    getValue: vi.fn((key) => {
      if (key === 'rate_limit.auth') {
        return Promise.resolve(mockRateLimitConfig);
      }
      if (key === 'rate_limit.auth.block_durations') {
        return Promise.resolve(mockBlockDurations);
      }
      if (key === 'abuse_detection.thresholds') {
        return Promise.resolve(mockAbuseDetectionThresholds);
      }
      return Promise.resolve(undefined);
    }),
    invalidateCache: vi.fn()
  }
}));

// Mock Abuse Detection Service
const mockDetectAbuse = vi.fn().mockResolvedValue({
  multiIPAbuse: false,
  multiEmailAbuse: false,
  burstAttack: false,
  slowAttack: false,
  riskScore: 0
});

vi.mock('../../../src/services/abuseDetectionService', () => ({
  detectAbuse: mockDetectAbuse,
  AbuseDetectionStore: vi.fn()
}));

// Mock Audit Log Service
vi.mock('../../../src/services/auditLogService', () => ({
  default: {
    logEvent: vi.fn().mockResolvedValue(true)
  }
}));

// Mock Redis/Upstash
const mockRedisMethods = {
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
  pexpire: vi.fn().mockResolvedValue(1),
  sadd: vi.fn().mockResolvedValue(1),
  smembers: vi.fn().mockResolvedValue([])
};

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => mockRedisMethods)
}));

const {
  authRateLimiterV2,
  RateLimitStoreV2,
  getRateLimitConfig,
  getProgressiveBlockDurations,
  getAbuseDetectionConfig,
  getMetrics,
  FALLBACK_RATE_LIMIT_CONFIG,
  FALLBACK_PROGRESSIVE_BLOCK_DURATIONS,
  FALLBACK_ABUSE_DETECTION_THRESHOLDS,
  getClientIP,
  detectAuthType
} = require('../../../src/middleware/authRateLimiterV2');

const { detectAbuse } = require('../../../src/services/abuseDetectionService');
const auditLogService = require('../../../src/services/auditLogService');

describe('Auth Rate Limiter v2', () => {
  describe('getClientIP', () => {
    it('should extract IP from req.ip', () => {
      const ip = getClientIP({ ip: '192.168.1.1' });
      expect(ip).toBe('192.168.1.1');
    });

    it('should extract IP from x-forwarded-for header', () => {
      const ip = getClientIP({
        headers: { 'x-forwarded-for': '192.168.1.2, 10.0.0.1' }
      });
      expect(ip).toBe('192.168.1.2');
    });

    it('should fallback to 127.0.0.1 if no IP found', () => {
      const ip = getClientIP({});
      expect(ip).toBe('127.0.0.1');
    });
  });

  describe('detectAuthType', () => {
    it('should detect password auth type', () => {
      const req = { path: '/api/auth/login', body: {} };
      expect(detectAuthType(req)).toBe('password');
    });

    it('should detect magic_link auth type from path', () => {
      const req = { path: '/api/auth/magic-link', body: {} };
      expect(detectAuthType(req)).toBe('magic_link');
    });
  });

  describe('Rate Limit Config (SSOT)', () => {
    it('should load config from SSOT', async () => {
      const config = await getRateLimitConfig();
      expect(config.password).toBeDefined();
      expect(config.password.maxAttempts).toBe(5);
    });

    it('should have config for magic_link auth type from SSOT', async () => {
      const config = await getRateLimitConfig();
      expect(config.magic_link).toBeDefined();
      expect(config.magic_link.maxAttempts).toBe(3);
    });
  });

  describe('Progressive Block Durations (SSOT)', () => {
    it('should load block durations from SSOT', async () => {
      const durations = await getProgressiveBlockDurations();
      expect(durations).toHaveLength(4);
      expect(durations[0]).toBe(15 * 60 * 1000);
      expect(durations[3]).toBe(null);
    });
  });

  describe('Abuse Detection Config (SSOT)', () => {
    it('should load abuse detection thresholds from SSOT', async () => {
      const config = await getAbuseDetectionConfig();
      expect(config).toBeDefined();
      expect(config.multi_ip).toBe(3);
      expect(config.multi_email).toBe(5);
      expect(config.burst).toBe(10);
      expect(config.slow_attack).toBe(20);
    });

    it('should use fallback if SSOT not available', async () => {
      const settingsLoader = require('../../../src/services/settingsLoaderV2');
      const originalGetValue = settingsLoader.getValue;
      
      // Mock getValue to return undefined for abuse_detection.thresholds
      settingsLoader.getValue = vi.fn((key) => {
        if (key === 'abuse_detection.thresholds') {
          return Promise.resolve(undefined);
        }
        // Use original mock for other keys
        return originalGetValue(key);
      });
      
      const config = await getAbuseDetectionConfig();
      expect(config).toEqual(FALLBACK_ABUSE_DETECTION_THRESHOLDS);
      
      // Restore original
      settingsLoader.getValue = originalGetValue;
    });
  });

  describe('RateLimitStoreV2 - Memory Leak Prevention', () => {
    let store;

    beforeEach(() => {
      store = new RateLimitStoreV2();
    });

    it('should track attempt timers and prevent duplicates', async () => {
      const key = 'test:attempt:key';
      const windowMs = 1000;

      // First increment
      await store.incrementAttempt(key, windowMs);
      expect(store.attemptTimers.has(key)).toBe(true);
      const firstTimer = store.attemptTimers.get(key);

      // Second increment should clear first timer
      await store.incrementAttempt(key, windowMs);
      expect(store.attemptTimers.has(key)).toBe(true);
      const secondTimer = store.attemptTimers.get(key);
      expect(secondTimer).not.toBe(firstTimer);

      // Cleanup
      clearTimeout(secondTimer);
      store.attemptTimers.delete(key);
    });

    it('should track block timers and prevent duplicates', async () => {
      const key = 'test:block:key';
      const blockDurations = [1000, 2000, 3000, null];

      // First block
      await store.setBlock(key, 1, blockDurations);
      expect(store.blockTimers.has(key)).toBe(true);
      const firstTimer = store.blockTimers.get(key);

      // Second block should clear first timer
      await store.setBlock(key, 2, blockDurations);
      expect(store.blockTimers.has(key)).toBe(true);
      const secondTimer = store.blockTimers.get(key);
      expect(secondTimer).not.toBe(firstTimer);

      // Cleanup
      clearTimeout(secondTimer);
      store.blockTimers.delete(key);
    });

    it('should clean up timers when resetting attempts', async () => {
      const ipKey = 'test:ip:key';
      const emailKey = 'test:email:key';
      const windowMs = 1000;

      // Create timers
      await store.incrementAttempt(ipKey, windowMs);
      await store.incrementAttempt(emailKey, windowMs);
      expect(store.attemptTimers.has(ipKey)).toBe(true);
      expect(store.attemptTimers.has(emailKey)).toBe(true);

      // Reset should clean up timers
      await store.resetAttempts(ipKey, emailKey);
      expect(store.attemptTimers.has(ipKey)).toBe(false);
      expect(store.attemptTimers.has(emailKey)).toBe(false);
    });
  });

  describe('Rate Limiting - Normal Flow', () => {
    let store;
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
      store = new RateLimitStoreV2();
      vi.clearAllMocks();
      mockReq = {
        path: '/api/auth/login',
        method: 'POST',
        body: { email: 'test@example.com' },
        ip: '192.168.1.1',
        id: 'test-request-id'
      };
      mockRes = {
        statusCode: 200,
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        end: vi.fn()
      };
      mockNext = vi.fn();
      process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should allow requests under rate limit', async () => {
      const ipKey = store.getIPKey('192.168.1.1', 'password');
      const emailKey = store.getEmailKey('test@example.com', 'password');
      
      // Set attempts below limit
      await store.incrementAttempt(ipKey, 15 * 60 * 1000);
      await store.incrementAttempt(ipKey, 15 * 60 * 1000);
      
      const ipAttempts = await store.getAttemptCount(ipKey);
      const emailAttempts = await store.getAttemptCount(emailKey);
      
      expect(ipAttempts).toBeLessThan(5);
      expect(emailAttempts).toBeLessThan(5);
    });

    it('should block after exceeding rate limit', async () => {
      const ipKey = store.getIPKey('192.168.1.1', 'password');
      const emailKey = store.getEmailKey('test@example.com', 'password');
      const blockKey = store.getIPBlockKey('192.168.1.1', 'password');
      const blockDurations = [15 * 60 * 1000, 60 * 60 * 1000, 24 * 60 * 60 * 1000, null];
      
      // Exceed limit
      for (let i = 0; i < 6; i++) {
        await store.incrementAttempt(ipKey, 15 * 60 * 1000);
      }
      
      const attempts = await store.getAttemptCount(ipKey);
      expect(attempts).toBeGreaterThanOrEqual(5);
      
      // Set block
      await store.setBlock(blockKey, 1, blockDurations);
      const blockInfo = await store.isBlocked(blockKey);
      expect(blockInfo.blocked).toBe(true);
    });
  });

  describe('Progressive Blocking', () => {
    let store;

    beforeEach(() => {
      store = new RateLimitStoreV2();
    });

    it('should apply 15min block for 1st offense', async () => {
      const blockKey = 'test:block:1st';
      const blockDurations = [15 * 60 * 1000, 60 * 60 * 1000, 24 * 60 * 60 * 1000, null];
      
      await store.setBlock(blockKey, 1, blockDurations);
      const blockInfo = await store.isBlocked(blockKey);
      
      expect(blockInfo.blocked).toBe(true);
      expect(blockInfo.offenseCount).toBe(1);
      expect(blockInfo.expiresAt).toBeGreaterThan(Date.now());
      expect(blockInfo.expiresAt - Date.now()).toBeLessThanOrEqual(15 * 60 * 1000 + 1000); // Allow 1s tolerance
    });

    it('should apply 1h block for 2nd offense', async () => {
      const blockKey = 'test:block:2nd';
      const blockDurations = [15 * 60 * 1000, 60 * 60 * 1000, 24 * 60 * 60 * 1000, null];
      
      await store.setBlock(blockKey, 2, blockDurations);
      const blockInfo = await store.isBlocked(blockKey);
      
      expect(blockInfo.blocked).toBe(true);
      expect(blockInfo.offenseCount).toBe(2);
      expect(blockInfo.expiresAt - Date.now()).toBeLessThanOrEqual(60 * 60 * 1000 + 1000);
    });

    it('should apply 24h block for 3rd offense', async () => {
      const blockKey = 'test:block:3rd';
      const blockDurations = [15 * 60 * 1000, 60 * 60 * 1000, 24 * 60 * 60 * 1000, null];
      
      await store.setBlock(blockKey, 3, blockDurations);
      const blockInfo = await store.isBlocked(blockKey);
      
      expect(blockInfo.blocked).toBe(true);
      expect(blockInfo.offenseCount).toBe(3);
      expect(blockInfo.expiresAt - Date.now()).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 1000);
    });

    it('should apply permanent block for 4th+ offense', async () => {
      const blockKey = 'test:block:permanent';
      const blockDurations = [15 * 60 * 1000, 60 * 60 * 1000, 24 * 60 * 60 * 1000, null];
      
      await store.setBlock(blockKey, 4, blockDurations);
      const blockInfo = await store.isBlocked(blockKey);
      
      expect(blockInfo.blocked).toBe(true);
      expect(blockInfo.offenseCount).toBe(4);
      expect(blockInfo.expiresAt).toBeNull(); // Permanent
      expect(blockInfo.remainingMs).toBeNull(); // Permanent
    });
  });

  describe('Redis vs Memory Fallback', () => {
    let store;

    beforeEach(() => {
      store = new RateLimitStoreV2();
    });

    it('should use memory fallback when Redis unavailable', async () => {
      store.isRedisAvailable = false;
      const key = 'test:memory:key';
      
      await store.incrementAttempt(key, 1000);
      const count = await store.getAttemptCount(key);
      
      expect(count).toBe(1);
      expect(store.memoryStore.has(key)).toBe(true);
    });

    it('should indicate readiness with memory fallback', () => {
      store.isRedisAvailable = false;
      expect(store.isReady()).toBe(true);
    });
  });

  describe('Abuse Detection Integration', () => {
    it('should detect abuse patterns when enabled', async () => {
      // Verify abuse detection service exists and can be called
      const { detectAbuse } = require('../../../src/services/abuseDetectionService');
      
      // Call the service (will use mock)
      const patterns = await detectAbuse('192.168.1.1', 'test@example.com', 'password');
      
      // Verify patterns structure
      expect(patterns).toHaveProperty('riskScore');
      expect(patterns).toHaveProperty('multiIPAbuse');
      expect(patterns).toHaveProperty('multiEmailAbuse');
      expect(patterns).toHaveProperty('burstAttack');
      expect(patterns).toHaveProperty('slowAttack');
      
      // Verify types
      expect(typeof patterns.riskScore).toBe('number');
      expect(typeof patterns.multiIPAbuse).toBe('boolean');
      expect(typeof patterns.multiEmailAbuse).toBe('boolean');
      expect(typeof patterns.burstAttack).toBe('boolean');
      expect(typeof patterns.slowAttack).toBe('boolean');
      
      // Verify default mock returns expected structure (riskScore: 0 by default)
      expect(patterns.riskScore).toBeGreaterThanOrEqual(0);
      expect(patterns.riskScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Feature Flag OFF', () => {
    it('should skip rate limiting when feature flag is disabled', () => {
      const { flags } = require('../../../src/config/flags');
      
      // Mock flags.isEnabled to return false for ENABLE_RATE_LIMIT
      const originalIsEnabled = flags.isEnabled;
      flags.isEnabled = vi.fn((flag) => {
        if (flag === 'ENABLE_RATE_LIMIT') return false;
        return true;
      });
      
      const mockReq = {
        path: '/api/auth/login',
        method: 'POST',
        body: { email: 'test@example.com' }
      };
      const mockRes = {};
      const mockNext = vi.fn();
      
      process.env.NODE_ENV = 'production';
      authRateLimiterV2(mockReq, mockRes, mockNext);
      
      // Should call next immediately when flag is off
      expect(mockNext).toHaveBeenCalled();
      
      // Reset mock
      flags.isEnabled = originalIsEnabled;
      process.env.NODE_ENV = 'test';
    });
  });

  describe('Metrics', () => {
    it('should expose metrics', () => {
      const metrics = getMetrics();
      
      expect(metrics).toHaveProperty('auth_rate_limit_hits_total');
      expect(metrics).toHaveProperty('auth_blocks_active');
      expect(metrics).toHaveProperty('auth_abuse_events_total');
      expect(metrics).toHaveProperty('last_reset');
    });
  });
});
