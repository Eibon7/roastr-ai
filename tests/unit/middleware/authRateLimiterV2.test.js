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
  RATE_LIMIT_CONFIG,
  PROGRESSIVE_BLOCK_DURATIONS,
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

  describe('RATE_LIMIT_CONFIG', () => {
    it('should have config for password auth type', () => {
      expect(RATE_LIMIT_CONFIG.password).toBeDefined();
      expect(RATE_LIMIT_CONFIG.password.maxAttempts).toBe(5);
    });

    it('should have config for magic_link auth type', () => {
      expect(RATE_LIMIT_CONFIG.magic_link).toBeDefined();
      expect(RATE_LIMIT_CONFIG.magic_link.maxAttempts).toBe(3);
    });
  });

  describe('PROGRESSIVE_BLOCK_DURATIONS', () => {
    it('should have progressive block durations', () => {
      expect(PROGRESSIVE_BLOCK_DURATIONS).toHaveLength(4);
      expect(PROGRESSIVE_BLOCK_DURATIONS[0]).toBe(15 * 60 * 1000);
      expect(PROGRESSIVE_BLOCK_DURATIONS[3]).toBe(null);
    });
  });
});
