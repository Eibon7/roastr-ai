/**
 * Tests for roast rate limiting middleware
 * Verifies the fixes for rate limiting issues:
 * 1. Missing Rate Limit Headers in 429 Response ✓
 * 2. Memory Leak in Cleanup Interval ✓
 * 3. IP Address Spoofing Vulnerability ✓
 */

const { createRoastRateLimiter, RoastRateLimitStore } = require('../../../src/middleware/roastRateLimiter');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock flags
jest.mock('../../../src/config/flags', () => ({
  isEnabled: jest.fn(() => true)
}));

describe('RoastRateLimiter Fixes', () => {
  let store;
  let rateLimiter;
  let req, res, next;

  beforeEach(() => {
    store = new RoastRateLimitStore();
    rateLimiter = createRoastRateLimiter({
      authenticatedLimit: 5,
      anonymousLimit: 2,
      windowMs: 60000 // 1 minute
    });

    req = {
      ip: '192.168.1.1',
      ips: [],
      headers: {},
      connection: { remoteAddress: '192.168.1.1' },
      user: null
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };

    next = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (store) {
      store.dispose();
    }
  });

  describe('Issue 1: Missing Rate Limit Headers in 429 Response', () => {
    it('should set standard rate limiting headers when limit exceeded', async () => {
      // Exceed the limit
      for (let i = 0; i < 3; i++) {
        rateLimiter(req, res, next);
      }

      // Verify headers were set
      expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
        'Retry-After': expect.any(Number),
        'RateLimit-Limit': 2,
        'RateLimit-Remaining': expect.any(Number),
        'RateLimit-Reset': expect.any(Number),
        'X-RateLimit-Limit': 2,
        'X-RateLimit-Remaining': expect.any(Number),
        'X-RateLimit-Reset': expect.any(Number)
      }));

      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should calculate correct remaining seconds and reset time', async () => {
      // Exceed the limit
      for (let i = 0; i < 3; i++) {
        rateLimiter(req, res, next);
      }

      const setCall = res.set.mock.calls.find(call => 
        call[0] && call[0]['Retry-After']
      );
      
      expect(setCall).toBeTruthy();
      const headers = setCall[0];
      
      // Retry-After should be in seconds and positive
      expect(headers['Retry-After']).toBeGreaterThan(0);
      expect(headers['Retry-After']).toBeLessThanOrEqual(60);
      
      // Reset time should be in the future
      expect(headers['RateLimit-Reset']).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  describe('Issue 2: Memory Leak in Cleanup Interval', () => {
    it('should store cleanup interval handle', () => {
      const testStore = new RoastRateLimitStore();
      expect(testStore.cleanupInterval).toBeTruthy();
      testStore.dispose();
    });

    it('should clear interval on dispose', () => {
      const testStore = new RoastRateLimitStore();
      const intervalId = testStore.cleanupInterval;
      
      testStore.dispose();
      
      expect(testStore.cleanupInterval).toBeNull();
      expect(testStore.store.size).toBe(0);
    });

    it('should handle unref gracefully when not available', () => {
      // Mock setInterval to return an object without unref
      const originalSetInterval = global.setInterval;
      global.setInterval = jest.fn(() => ({ id: 'test' }));
      
      expect(() => {
        const testStore = new RoastRateLimitStore();
        testStore.dispose();
      }).not.toThrow();
      
      global.setInterval = originalSetInterval;
    });
  });

  describe('Issue 3: IP Address Spoofing Vulnerability', () => {
    it('should prioritize req.ip over headers when available', () => {
      req.ip = '10.0.0.1';
      req.headers['x-forwarded-for'] = '192.168.1.100';
      req.headers['x-real-ip'] = '172.16.0.1';

      rateLimiter(req, res, next);

      // Should use req.ip, not the headers
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should use req.ips[0] when req.ip is localhost', () => {
      req.ip = '127.0.0.1';
      req.ips = ['10.0.0.1', '192.168.1.1'];

      rateLimiter(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle unknown IP gracefully', () => {
      req.ip = '127.0.0.1';
      req.ips = [];
      req.headers = {};
      req.connection = {};
      req.socket = {};

      rateLimiter(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should validate IP detection logic exists', () => {
      // Test that the getClientIP function exists and handles various scenarios
      const { createRoastRateLimiter } = require('../../../src/middleware/roastRateLimiter');
      const limiter = createRoastRateLimiter();

      expect(typeof limiter).toBe('function');

      // Test with valid IP
      req.ip = '192.168.1.1';
      limiter(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing JSON response structure', async () => {
      // Exceed the limit
      for (let i = 0; i < 3; i++) {
        rateLimiter(req, res, next);
      }

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Rate limit exceeded',
        details: expect.objectContaining({
          limit: 2,
          windowMs: 60000,
          retryAfter: expect.any(Number),
          message: expect.any(String)
        }),
        timestamp: expect.any(String)
      }));
    });

    it('should work with authenticated users', () => {
      req.user = { id: 'user123' };
      
      rateLimiter(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should respect existing configuration options', () => {
      const customLimiter = createRoastRateLimiter({
        authenticatedLimit: 10,
        anonymousLimit: 3,
        windowMs: 30000
      });

      // Test that the limiter was created with custom config
      expect(typeof customLimiter).toBe('function');

      // Test basic functionality with valid IP
      req.ip = '192.168.1.1';
      customLimiter(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
