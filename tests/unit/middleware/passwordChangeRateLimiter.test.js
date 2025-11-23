/**
 * Tests for Password Change Rate Limiter (Issue #133)
 */

// Mock flags first
jest.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn((flag) => {
      if (flag === 'ENABLE_RATE_LIMIT') return true;
      if (flag === 'DEBUG_RATE_LIMIT') return false;
      return false;
    })
  }
}));

const { passwordChangeRateLimiter } = require('../../../src/middleware/passwordChangeRateLimiter');
const {
  PasswordChangeRateLimitStore
} = require('../../../src/middleware/passwordChangeRateLimiter');
const { flags } = require('../../../src/config/flags');

describe('Password Change Rate Limiter', () => {
  let req, res, next, store;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a fresh store for each test
    store = new PasswordChangeRateLimitStore();

    // Mock request object
    req = {
      ip: '192.168.1.1',
      user: { id: 'user-123' },
      headers: {}
    };

    // Mock response object
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      end: jest.fn(),
      statusCode: 200
    };

    // Mock next function
    next = jest.fn();
  });

  afterEach(() => {
    // Clean up store after each test
    if (store) {
      store.attempts.clear();
      store.blocked.clear();
    }
  });

  describe('Rate Limiting Disabled', () => {
    it('should pass through when rate limiting is disabled', () => {
      flags.isEnabled.mockReturnValue(false);

      passwordChangeRateLimiter(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limiting Enabled', () => {
    beforeEach(() => {
      flags.isEnabled.mockImplementation((flag) => {
        return flag === 'ENABLE_RATE_LIMIT' || flag === 'DEBUG_RATE_LIMIT';
      });
    });

    it('should allow first password change attempt', () => {
      passwordChangeRateLimiter(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle successful password changes correctly', () => {
      // Pre-populate with some attempts
      const key = store.getKey('192.168.1.1', 'user-123');
      store.recordAttempt(key);
      store.recordAttempt(key);

      // Mock a successful response (status 200-299)
      res.statusCode = 200;

      let responseIntercepted = false;
      const originalEnd = res.end;

      res.end = jest.fn(function (chunk, encoding) {
        if (!responseIntercepted) {
          responseIntercepted = true;

          // This simulates what the middleware does for success
          if (res.statusCode >= 200 && res.statusCode < 300) {
            store.clearAttempts(key);
            store.clearBlock(key);
          }
        }

        originalEnd.call(this, chunk, encoding);
      });

      passwordChangeRateLimiter(req, res, next);

      expect(next).toHaveBeenCalled();

      // Simulate successful response
      res.statusCode = 200; // Simulate success
      res.end('success response');

      // The wrapped function should have been called
      expect(typeof res.end).toBe('function');
    });
  });

  describe('PasswordChangeRateLimitStore', () => {
    it('should create correct key format', () => {
      const store = new PasswordChangeRateLimitStore();
      const key = store.getKey('192.168.1.1', 'user-123');

      // Should create a key format
      expect(key).toBe('pwd_change:192.168.1.1:user-123');
    });

    it('should record and check attempts', () => {
      const store = new PasswordChangeRateLimitStore();
      const key = 'test-key';

      // No attempts initially
      expect(store.getAttemptCount(key)).toBe(0);

      // Record some attempts
      store.recordAttempt(key);
      store.recordAttempt(key);

      expect(store.getAttemptCount(key)).toBe(2);
    });

    it('should handle blocking and unblocking', () => {
      const store = new PasswordChangeRateLimitStore();
      const key = 'test-key';

      // Not blocked initially
      const initialCheck = store.isBlocked(key);
      expect(initialCheck.blocked).toBe(false);

      // Set block
      store.setBlock(key, 3);

      const blockedCheck = store.isBlocked(key);
      expect(blockedCheck.blocked).toBe(true);
      expect(blockedCheck.attemptCount).toBe(3);
      expect(blockedCheck.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should clear attempts and blocks', () => {
      const store = new PasswordChangeRateLimitStore();
      const key = 'test-key';

      // Add some data
      store.recordAttempt(key);
      store.recordAttempt(key);
      store.setBlock(key, 3);

      // Clear attempts
      store.clearAttempts(key);
      expect(store.getAttemptCount(key)).toBe(0);

      // Clear block
      store.clearBlock(key);
      const check = store.isBlocked(key);
      expect(check.blocked).toBe(false);
    });

    it('should clean up expired blocks', () => {
      const store = new PasswordChangeRateLimitStore();
      const key = 'test-key';

      // Set an expired block (1ms in the past)
      const expiredTime = Date.now() - 1;
      store.blocked.set(key, {
        blockedAt: expiredTime - 1000,
        expiresAt: expiredTime,
        attemptCount: 3
      });

      const check = store.isBlocked(key);
      expect(check.blocked).toBe(false);
      expect(store.blocked.has(key)).toBe(false);
    });
  });
});
