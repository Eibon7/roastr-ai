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

vi.mock('../../../src/services/settingsLoaderV2', () => ({
  default: {
    getValue: vi.fn((key) => {
      if (key === 'rate_limit.auth') {
        return Promise.resolve(mockRateLimitConfig);
      }
      if (key === 'rate_limit.auth.block_durations') {
        return Promise.resolve(mockBlockDurations);
      }
      return Promise.resolve(undefined);
    }),
    invalidateCache: vi.fn()
  }
}));

// Mock Redis/Upstash
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    pexpire: vi.fn().mockResolvedValue(1)
  }))
}));

const {
  authRateLimiterV2,
  RateLimitStoreV2,
  getRateLimitConfig,
  getProgressiveBlockDurations,
  FALLBACK_RATE_LIMIT_CONFIG,
  FALLBACK_PROGRESSIVE_BLOCK_DURATIONS,
  getClientIP,
  detectAuthType
} = require('../../../src/middleware/authRateLimiterV2');

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
});
