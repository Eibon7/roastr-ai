/**
 * Rate Limiter Middleware Tests
 * Tests the login rate limiting functionality
 */

// Mock flags BEFORE importing modules that use it
jest.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn(),
    reload: jest.fn()
  }
}));

const {
  loginRateLimiter,
  getRateLimitMetrics,
  resetRateLimit,
  RateLimitStore,
  getClientIP,
  store
} = require('../../../src/middleware/rateLimiter');
const { flags } = require('../../../src/config/flags');

describe('Rate Limiter Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      path: '/auth/login',
      method: 'POST',
      body: { email: 'test@example.com' },
      ip: '192.168.1.1',
      connection: { remoteAddress: '192.168.1.1' },
      headers: {}
    };

    mockRes = {
      status: jest.fn(() => mockRes),
      json: jest.fn(),
      statusCode: 200,
      end: jest.fn()
    };

    mockNext = jest.fn();

    // Default flag states
    flags.isEnabled.mockImplementation((flag) => {
      switch (flag) {
        case 'ENABLE_RATE_LIMIT':
          return true;
        case 'ENABLE_MOCK_MODE':
          return false;
        case 'DEBUG_RATE_LIMIT':
          return false;
        default:
          return false;
      }
    });

    // Clear the store
    store.attempts.clear();
    store.blocked.clear();
    store.metrics = {
      totalAttempts: 0,
      blockedAttempts: 0,
      uniqueIPs: new Set(),
      recentBlocks: []
    };
  });

  describe('RateLimitStore', () => {
    let rateLimitStore;

    beforeEach(() => {
      rateLimitStore = new RateLimitStore();
    });

    describe('getKey', () => {
      it('should generate consistent keys for same IP and email', () => {
        const key1 = rateLimitStore.getKey('192.168.1.1', 'test@example.com');
        const key2 = rateLimitStore.getKey('192.168.1.1', 'test@example.com');
        expect(key1).toBe(key2);
      });

      it('should generate different keys for different IPs', () => {
        const key1 = rateLimitStore.getKey('192.168.1.1', 'test@example.com');
        const key2 = rateLimitStore.getKey('192.168.1.2', 'test@example.com');
        expect(key1).not.toBe(key2);
      });

      it('should generate different keys for different emails', () => {
        const key1 = rateLimitStore.getKey('192.168.1.1', 'test@example.com');
        const key2 = rateLimitStore.getKey('192.168.1.1', 'other@example.com');
        expect(key1).not.toBe(key2);
      });

      it('should be case insensitive for emails', () => {
        const key1 = rateLimitStore.getKey('192.168.1.1', 'test@example.com');
        const key2 = rateLimitStore.getKey('192.168.1.1', 'TEST@EXAMPLE.COM');
        expect(key1).toBe(key2);
      });
    });

    describe('isBlocked', () => {
      it('should return false for non-blocked key', () => {
        const result = rateLimitStore.isBlocked('non-existent-key');
        expect(result.blocked).toBe(false);
      });

      it('should return true for blocked key within time window', () => {
        const key = 'test-key';
        const expiresAt = Date.now() + 10000; // 10 seconds from now

        rateLimitStore.blocked.set(key, { expiresAt, blockedAt: Date.now() });

        const result = rateLimitStore.isBlocked(key);
        expect(result.blocked).toBe(true);
        expect(result.expiresAt).toBe(expiresAt);
        expect(result.remainingMs).toBeGreaterThan(0);
      });

      it('should clean up expired blocks', () => {
        const key = 'test-key';
        const expiresAt = Date.now() - 1000; // 1 second ago

        rateLimitStore.blocked.set(key, { expiresAt, blockedAt: Date.now() - 2000 });

        const result = rateLimitStore.isBlocked(key);
        expect(result.blocked).toBe(false);
        expect(rateLimitStore.blocked.has(key)).toBe(false);
      });
    });

    describe('recordAttempt', () => {
      const ip = '192.168.1.1';
      const key = 'test-key';

      it('should record first attempt correctly', () => {
        const result = rateLimitStore.recordAttempt(key, ip);

        expect(result.blocked).toBe(false);
        expect(result.attemptCount).toBe(1);
        expect(result.maxAttempts).toBe(5);
        expect(result.remainingAttempts).toBe(4);
        expect(rateLimitStore.metrics.totalAttempts).toBe(1);
        expect(rateLimitStore.metrics.uniqueIPs.has(ip)).toBe(true);
      });

      it('should increment attempt count', () => {
        rateLimitStore.recordAttempt(key, ip);
        rateLimitStore.recordAttempt(key, ip);
        const result = rateLimitStore.recordAttempt(key, ip);

        expect(result.attemptCount).toBe(3);
        expect(result.remainingAttempts).toBe(2);
      });

      it('should block after 5 attempts', () => {
        // Record 5 attempts
        for (let i = 0; i < 4; i++) {
          rateLimitStore.recordAttempt(key, ip);
        }

        const result = rateLimitStore.recordAttempt(key, ip);

        expect(result.blocked).toBe(true);
        expect(result.attemptCount).toBe(5);
        expect(result.expiresAt).toBeGreaterThan(Date.now());
        expect(rateLimitStore.metrics.blockedAttempts).toBe(1);
      });

      it('should reset attempt window after 15 minutes', () => {
        const oldAttempt = {
          count: 3,
          firstAttempt: Date.now() - 16 * 60 * 1000, // 16 minutes ago
          lastAttempt: Date.now() - 16 * 60 * 1000
        };

        rateLimitStore.attempts.set(key, oldAttempt);

        const result = rateLimitStore.recordAttempt(key, ip);

        expect(result.attemptCount).toBe(1); // Reset to 1
      });

      it('should track recent blocks', () => {
        // Record 5 attempts to trigger block
        for (let i = 0; i < 5; i++) {
          rateLimitStore.recordAttempt(key, ip);
        }

        expect(rateLimitStore.metrics.recentBlocks).toHaveLength(1);
        expect(rateLimitStore.metrics.recentBlocks[0]).toMatchObject({
          key,
          ip,
          attemptCount: 5
        });
      });

      it('should limit recent blocks to 100 entries', () => {
        // Create 101 blocks
        for (let i = 0; i < 101; i++) {
          const uniqueKey = `key-${i}`;
          const uniqueIp = `192.168.1.${i % 255}`;

          // Record 5 attempts for each key to trigger block
          for (let j = 0; j < 5; j++) {
            rateLimitStore.recordAttempt(uniqueKey, uniqueIp);
          }
        }

        expect(rateLimitStore.metrics.recentBlocks).toHaveLength(100);
      });
    });

    describe('recordSuccess', () => {
      it('should clear attempts and blocks for successful login', () => {
        const key = 'test-key';
        const ip = '192.168.1.1';

        // Record some attempts
        rateLimitStore.recordAttempt(key, ip);
        rateLimitStore.recordAttempt(key, ip);

        // Record success
        rateLimitStore.recordSuccess(key);

        expect(rateLimitStore.attempts.has(key)).toBe(false);
        expect(rateLimitStore.blocked.has(key)).toBe(false);
      });
    });

    describe('cleanup', () => {
      it('should remove old attempts', () => {
        const key = 'test-key';
        const oldAttempt = {
          count: 3,
          firstAttempt: Date.now() - 20 * 60 * 1000, // 20 minutes ago
          lastAttempt: Date.now() - 20 * 60 * 1000
        };

        rateLimitStore.attempts.set(key, oldAttempt);
        rateLimitStore.cleanup();

        expect(rateLimitStore.attempts.has(key)).toBe(false);
      });

      it('should remove expired blocks', () => {
        const key = 'test-key';
        const expiredBlock = {
          blockedAt: Date.now() - 2000,
          expiresAt: Date.now() - 1000 // 1 second ago
        };

        rateLimitStore.blocked.set(key, expiredBlock);
        rateLimitStore.cleanup();

        expect(rateLimitStore.blocked.has(key)).toBe(false);
      });
    });

    describe('getMetrics', () => {
      it('should return correct metrics', () => {
        const rateLimitStore = new RateLimitStore();
        const ip1 = '192.168.1.1';
        const ip2 = '192.168.1.2';

        // Record some attempts
        rateLimitStore.recordAttempt('key1', ip1);
        rateLimitStore.recordAttempt('key2', ip2);

        const metrics = rateLimitStore.getMetrics();

        expect(metrics.totalAttempts).toBe(2);
        expect(metrics.uniqueIPs).toBe(2);
        expect(metrics.activeAttempts).toBe(2);
        expect(metrics.currentlyBlocked).toBe(0);
      });
    });
  });

  describe('getClientIP', () => {
    it('should extract IP from req.ip', () => {
      const req = { ip: '192.168.1.100' };
      expect(getClientIP(req)).toBe('192.168.1.100');
    });

    it('should fall back to connection.remoteAddress', () => {
      const req = { connection: { remoteAddress: '192.168.1.101' } };
      expect(getClientIP(req)).toBe('192.168.1.101');
    });

    it('should fall back to socket.remoteAddress', () => {
      const req = { socket: { remoteAddress: '192.168.1.102' } };
      expect(getClientIP(req)).toBe('192.168.1.102');
    });

    it('should fall back to connection.socket.remoteAddress', () => {
      const req = {
        connection: {
          socket: { remoteAddress: '192.168.1.103' }
        }
      };
      expect(getClientIP(req)).toBe('192.168.1.103');
    });

    it('should default to localhost when no IP found', () => {
      const req = {};
      expect(getClientIP(req)).toBe('127.0.0.1');
    });
  });

  describe('loginRateLimiter middleware', () => {
    it('should pass through when rate limiting is disabled', async () => {
      flags.isEnabled.mockReturnValue(false);

      await loginRateLimiter(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should pass through for non-auth endpoints', async () => {
      mockReq.path = '/api/user/profile';

      await loginRateLimiter(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should pass through when no email provided', async () => {
      mockReq.body = {};

      await loginRateLimiter(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should block requests when rate limit exceeded', async () => {
      const email = 'blocked@example.com';
      const ip = '192.168.1.100';

      mockReq.body.email = email;
      mockReq.ip = ip;

      // Simulate 5 failed attempts
      for (let i = 0; i < 5; i++) {
        store.recordAttempt(store.getKey(ip, email), ip);
      }

      await loginRateLimiter(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Too many login attempts. Please try again later.',
        code: 'RATE_LIMITED',
        retryAfter: expect.any(Number),
        message: 'For security reasons, please wait before attempting to log in again.'
      });
    });

    it('should intercept failed login responses', async () => {
      const email = 'test@example.com';
      const ip = '192.168.1.1';

      mockReq.body.email = email;
      mockReq.ip = ip;

      // Mock failed response
      mockRes.statusCode = 401;
      const originalEnd = mockRes.end;
      mockRes.end = jest.fn();

      await loginRateLimiter(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();

      // Simulate failed login response
      mockRes.end('{"success": false}');

      // Should record the attempt
      const key = store.getKey(ip, email);
      const attemptInfo = store.attempts.get(key);
      expect(attemptInfo.count).toBe(1);
    });

    it('should reset attempts on successful login', async () => {
      const email = 'success@example.com';
      const ip = '192.168.1.1';

      mockReq.body.email = email;
      mockReq.ip = ip;

      // Pre-record some attempts
      const key = store.getKey(ip, email);
      store.recordAttempt(key, ip);
      store.recordAttempt(key, ip);

      // Mock successful response
      mockRes.statusCode = 200;
      mockRes.end = jest.fn();

      await loginRateLimiter(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();

      // Simulate successful response
      mockRes.end('{"success": true}');

      // Attempts should be cleared
      expect(store.attempts.has(key)).toBe(false);
      expect(store.blocked.has(key)).toBe(false);
    });

    it('should handle auth endpoint variations', async () => {
      const authEndpoints = ['/auth/login', '/api/auth/login', '/login', '/auth/signin'];

      for (const path of authEndpoints) {
        mockReq.path = path;
        mockReq.body.email = 'test@example.com';

        await loginRateLimiter(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        mockNext.mockClear();
      }
    });

    it('should detect POST requests with email in body', async () => {
      mockReq.method = 'POST';
      mockReq.path = '/api/custom-login';
      mockReq.body.email = 'test@example.com';

      await loginRateLimiter(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle username field as email fallback', async () => {
      mockReq.body = { username: 'user@example.com' };

      await loginRateLimiter(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should log debug information when enabled', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      flags.isEnabled.mockImplementation((flag) => {
        switch (flag) {
          case 'ENABLE_RATE_LIMIT':
          case 'DEBUG_RATE_LIMIT':
            return true;
          default:
            return false;
        }
      });

      const email = 'debug@example.com';
      const ip = '192.168.1.1';

      mockReq.body.email = email;
      mockReq.ip = ip;

      // Trigger block
      for (let i = 0; i < 5; i++) {
        store.recordAttempt(store.getKey(ip, email), ip);
      }

      await loginRateLimiter(mockReq, mockRes, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Blocked login attempt:',
        expect.objectContaining({ ip, remainingMs: expect.any(Number) })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getRateLimitMetrics endpoint', () => {
    it('should return metrics in mock mode', async () => {
      flags.isEnabled.mockImplementation((flag) => flag === 'ENABLE_MOCK_MODE');

      await getRateLimitMetrics(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          totalAttempts: expect.any(Number),
          blockedAttempts: expect.any(Number),
          uniqueIPs: expect.any(Number),
          activeAttempts: expect.any(Number),
          currentlyBlocked: expect.any(Number),
          rateLimitEnabled: expect.any(Boolean),
          timestamp: expect.any(Number)
        })
      });
    });

    it('should deny access outside mock mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production'; // Simulate non-test environment

      flags.isEnabled.mockReturnValue(false);

      await getRateLimitMetrics(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Metrics only available in mock mode'
      });

      process.env.NODE_ENV = originalEnv; // Restore
    });

    it('should work in test environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      flags.isEnabled.mockReturnValue(false);

      await getRateLimitMetrics(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('resetRateLimit endpoint', () => {
    beforeEach(() => {
      mockReq.body = {
        ip: '192.168.1.1',
        email: 'test@example.com'
      };
    });

    it('should reset rate limit for specific IP/email', async () => {
      flags.isEnabled.mockImplementation((flag) => flag === 'ENABLE_MOCK_MODE');

      const { ip, email } = mockReq.body;
      const key = store.getKey(ip, email);

      // Create some attempts
      store.recordAttempt(key, ip);
      store.recordAttempt(key, ip);

      await resetRateLimit(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Rate limit reset successfully',
        key
      });

      // Verify reset
      expect(store.attempts.has(key)).toBe(false);
      expect(store.blocked.has(key)).toBe(false);
    });

    it('should require IP and email parameters', async () => {
      flags.isEnabled.mockImplementation((flag) => flag === 'ENABLE_MOCK_MODE');

      mockReq.body = { ip: '192.168.1.1' }; // Missing email

      await resetRateLimit(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'IP and email are required'
      });
    });

    it('should deny access outside mock mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production'; // Simulate non-test environment

      flags.isEnabled.mockReturnValue(false);

      await resetRateLimit(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Rate limit reset only available in mock mode'
      });

      process.env.NODE_ENV = originalEnv; // Restore
    });

    it('should work in test environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      flags.isEnabled.mockReturnValue(false);

      await resetRateLimit(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Rate limit reset successfully',
        key: expect.any(String)
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle missing request body', async () => {
      mockReq.body = null;

      await loginRateLimiter(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle malformed email addresses', async () => {
      const malformedEmails = ['', ' ', 'not-an-email', 'test@', '@example.com'];

      for (const email of malformedEmails) {
        mockReq.body.email = email;
        await loginRateLimiter(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
        mockNext.mockClear();
      }
    });

    it('should handle response end interception errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      mockReq.body.email = 'test@example.com';
      mockReq.ip = '192.168.1.1';

      // Mock response.end to throw error
      const originalEnd = mockRes.end;
      mockRes.end = jest.fn(() => {
        throw new Error('End error');
      });

      await loginRateLimiter(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();

      // Trigger the intercepted end
      try {
        mockRes.end('test response');
      } catch (error) {
        // Expected to throw
      }

      // Should not crash the application
      expect(consoleSpy).not.toHaveBeenCalled();

      mockRes.end = originalEnd;
      consoleSpy.mockRestore();
    });

    it('should handle concurrent requests for same user', async () => {
      const email = 'concurrent@example.com';
      const ip = '192.168.1.1';

      const requests = Array(3)
        .fill(null)
        .map(() => ({
          ...mockReq,
          body: { email },
          ip
        }));

      const responses = requests.map(() => ({
        ...mockRes,
        status: jest.fn(() => mockRes),
        json: jest.fn(),
        statusCode: 401,
        end: jest.fn()
      }));

      // Process requests concurrently
      const promises = requests.map((req, i) => loginRateLimiter(req, responses[i], mockNext));

      await Promise.all(promises);

      // All should pass through middleware
      expect(mockNext).toHaveBeenCalledTimes(3);

      // Simulate all failing
      responses.forEach((res) => res.end('{"success": false}'));

      // Should record attempts correctly
      const key = store.getKey(ip, email);
      const attemptInfo = store.attempts.get(key);
      expect(attemptInfo.count).toBe(3);
    });

    it('should handle store cleanup during operation', () => {
      const email = 'cleanup@example.com';
      const ip = '192.168.1.1';
      const key = store.getKey(ip, email);

      // Record attempts
      store.recordAttempt(key, ip);
      store.recordAttempt(key, ip);

      // Trigger cleanup
      store.cleanup();

      // Should still work after cleanup
      const result = store.recordAttempt(key, ip);
      expect(result.attemptCount).toBe(3); // Continues counting as cleanup only removes old entries
    });
  });
});
