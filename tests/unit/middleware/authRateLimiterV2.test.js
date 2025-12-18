/**
 * Auth Rate Limiter v2 Tests - ROA-359
 * Tests for enhanced rate limiting and abuse policy v2
 */

// Mock flags BEFORE importing modules that use it
const { vi } = require('vitest');
vi.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: vi.fn(),
    reload: vi.fn()
  }
}));

// Mock Redis/Upstash
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn(),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn(),
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
const { flags } = require('../../../src/config/flags');

describe('Auth Rate Limiter v2', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      path: '/api/auth/login',
      method: 'POST',
      body: { email: 'test@example.com', password: 'password123' },
      ip: '192.168.1.1',
      connection: { remoteAddress: '192.168.1.1' },
      headers: {}
    };

    mockRes = {
      status: jest.fn(() => mockRes),
      json: jest.fn(),
      statusCode: 200,
      end: jest.fn(function (chunk, encoding) {
        if (chunk) {
          this.statusCode = this.statusCode || 200;
        }
      })
    };

    mockNext = jest.fn();

    // Default flag states
    flags.isEnabled.mockImplementation((flag) => {
      switch (flag) {
        case 'ENABLE_RATE_LIMIT':
          return true;
        case 'ENABLE_AUTH_RATE_LIMIT_V2':
          return true;
        case 'DEBUG_RATE_LIMIT':
          return false;
        default:
          return false;
      }
    });

    // Set test environment
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

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

    it('should fallback to connection.remoteAddress', () => {
      const ip = getClientIP({
        connection: { remoteAddress: '192.168.1.3' }
      });
      expect(ip).toBe('192.168.1.3');
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

    it('should detect magic_link auth type from body', () => {
      const req = { path: '/api/auth/login', body: { magic_link: true } };
      expect(detectAuthType(req)).toBe('magic_link');
    });

    it('should detect oauth auth type from path', () => {
      const req = { path: '/api/auth/oauth/callback', body: {} };
      expect(detectAuthType(req)).toBe('oauth');
    });

    it('should detect oauth auth type from body', () => {
      const req = { path: '/api/auth/login', body: { oauth_provider: 'google' } };
      expect(detectAuthType(req)).toBe('oauth');
    });

    it('should detect password_reset auth type from path', () => {
      const req = { path: '/api/auth/reset-password', body: {} };
      expect(detectAuthType(req)).toBe('password_reset');
    });

    it('should detect password_reset auth type from body', () => {
      const req = { path: '/api/auth/login', body: { reset_password: true } };
      expect(detectAuthType(req)).toBe('password_reset');
    });
  });

  describe('RateLimitStoreV2', () => {
    let store;

    beforeEach(() => {
      store = new RateLimitStoreV2();
    });

    describe('getIPKey', () => {
      it('should generate consistent keys for same IP and auth type', () => {
        const key1 = store.getIPKey('192.168.1.1', 'password');
        const key2 = store.getIPKey('192.168.1.1', 'password');
        expect(key1).toBe(key2);
      });

      it('should generate different keys for different IPs', () => {
        const key1 = store.getIPKey('192.168.1.1', 'password');
        const key2 = store.getIPKey('192.168.1.2', 'password');
        expect(key1).not.toBe(key2);
      });

      it('should generate different keys for different auth types', () => {
        const key1 = store.getIPKey('192.168.1.1', 'password');
        const key2 = store.getIPKey('192.168.1.1', 'oauth');
        expect(key1).not.toBe(key2);
      });
    });

    describe('getEmailKey', () => {
      it('should generate consistent keys for same email and auth type', () => {
        const key1 = store.getEmailKey('test@example.com', 'password');
        const key2 = store.getEmailKey('test@example.com', 'password');
        expect(key1).toBe(key2);
      });

      it('should be case insensitive for emails', () => {
        const key1 = store.getEmailKey('Test@Example.com', 'password');
        const key2 = store.getEmailKey('test@example.com', 'password');
        expect(key1).toBe(key2);
      });

      it('should generate different keys for different emails', () => {
        const key1 = store.getEmailKey('test@example.com', 'password');
        const key2 = store.getEmailKey('other@example.com', 'password');
        expect(key1).not.toBe(key2);
      });
    });

    describe('getAttemptCount', () => {
      it('should return 0 for non-existent key', async () => {
        const count = await store.getAttemptCount('nonexistent:key');
        expect(count).toBe(0);
      });
    });

    describe('incrementAttempt', () => {
      it('should increment attempt count', async () => {
        const key = 'test:key';
        const count1 = await store.incrementAttempt(key, 60000);
        const count2 = await store.incrementAttempt(key, 60000);
        expect(count2).toBe(count1 + 1);
      });
    });

    describe('isBlocked', () => {
      it('should return not blocked for non-existent key', async () => {
        const result = await store.isBlocked('nonexistent:block:key');
        expect(result.blocked).toBe(false);
      });
    });

    describe('setBlock', () => {
      it('should set block with progressive duration for first offense', async () => {
        const key = 'test:block:key';
        const blockInfo = await store.setBlock(key, 1);
        expect(blockInfo.offenseCount).toBe(1);
        expect(blockInfo.expiresAt).toBeGreaterThan(Date.now());
      });

      it('should set block with longer duration for second offense', async () => {
        const key = 'test:block:key';
        const blockInfo = await store.setBlock(key, 2);
        expect(blockInfo.offenseCount).toBe(2);
        expect(blockInfo.expiresAt).toBeGreaterThan(Date.now());
      });
    });
  });

  describe('RATE_LIMIT_CONFIG', () => {
    it('should have config for password auth type', () => {
      expect(RATE_LIMIT_CONFIG.password).toBeDefined();
      expect(RATE_LIMIT_CONFIG.password.maxAttempts).toBe(5);
      expect(RATE_LIMIT_CONFIG.password.windowMs).toBe(15 * 60 * 1000);
    });

    it('should have config for magic_link auth type', () => {
      expect(RATE_LIMIT_CONFIG.magic_link).toBeDefined();
      expect(RATE_LIMIT_CONFIG.magic_link.maxAttempts).toBe(3);
      expect(RATE_LIMIT_CONFIG.magic_link.windowMs).toBe(60 * 60 * 1000);
    });

    it('should have config for oauth auth type', () => {
      expect(RATE_LIMIT_CONFIG.oauth).toBeDefined();
      expect(RATE_LIMIT_CONFIG.oauth.maxAttempts).toBe(10);
    });

    it('should have config for password_reset auth type', () => {
      expect(RATE_LIMIT_CONFIG.password_reset).toBeDefined();
      expect(RATE_LIMIT_CONFIG.password_reset.maxAttempts).toBe(3);
    });
  });

  describe('PROGRESSIVE_BLOCK_DURATIONS', () => {
    it('should have progressive block durations', () => {
      expect(PROGRESSIVE_BLOCK_DURATIONS).toHaveLength(4);
      expect(PROGRESSIVE_BLOCK_DURATIONS[0]).toBe(15 * 60 * 1000); // 15 minutes
      expect(PROGRESSIVE_BLOCK_DURATIONS[1]).toBe(60 * 60 * 1000); // 1 hour
      expect(PROGRESSIVE_BLOCK_DURATIONS[2]).toBe(24 * 60 * 60 * 1000); // 24 hours
      expect(PROGRESSIVE_BLOCK_DURATIONS[3]).toBe(null); // Permanent
    });
  });

  describe('authRateLimiterV2 middleware', () => {
    it('should skip rate limiting in test environment', () => {
      process.env.NODE_ENV = 'test';
      authRateLimiterV2(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip rate limiting if feature flag is disabled', () => {
      process.env.NODE_ENV = 'production';
      flags.isEnabled.mockReturnValue(false);
      authRateLimiterV2(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip rate limiting for non-auth endpoints', () => {
      process.env.NODE_ENV = 'production';
      mockReq.path = '/api/roast';
      mockReq.body = {};
      authRateLimiterV2(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip rate limiting if no email in body', () => {
      process.env.NODE_ENV = 'production';
      mockReq.body = {};
      authRateLimiterV2(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });
});

