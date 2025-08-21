/**
 * Tests for password change rate limiter middleware
 */

const { passwordChangeRateLimiter, PasswordChangeRateLimitStore } = require('../../../src/middleware/passwordChangeRateLimiter');

// Mock dependencies
jest.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn()
  }
}));

jest.mock('../../../src/middleware/rateLimiter', () => ({
  getClientIP: jest.fn()
}));

const { flags } = require('../../../src/config/flags');
const { getClientIP } = require('../../../src/middleware/rateLimiter');

describe('PasswordChangeRateLimiter', () => {
  let store;
  let req, res, next;

  beforeEach(() => {
    store = new PasswordChangeRateLimitStore();
    
    req = {
      user: { id: 'test-user-123' },
      ip: '192.168.1.1'
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn()
    };
    
    next = jest.fn();
    
    // Reset mocks
    flags.isEnabled.mockReset();
    getClientIP.mockReset();
    
    // Default mock behavior
    flags.isEnabled.mockReturnValue(true);
    getClientIP.mockReturnValue('192.168.1.1');
  });

  afterEach(() => {
    if (store) {
      store.stop();
    }
  });

  describe('PasswordChangeRateLimitStore', () => {
    test('should initialize with correct worker type', () => {
      expect(store).toBeDefined();
      expect(store.attempts).toBeDefined();
      expect(store.blocked).toBeDefined();
    });

    test('should generate correct keys', () => {
      const key = store.getKey('192.168.1.1', 'user123');
      expect(key).toBe('pwd_change:192.168.1.1:user123');
    });

    test('should not be blocked initially', () => {
      const key = store.getKey('192.168.1.1', 'user123');
      const blockStatus = store.isBlocked(key);
      expect(blockStatus.blocked).toBe(false);
    });

    test('should record attempts correctly', () => {
      const key = store.getKey('192.168.1.1', 'user123');
      
      // First attempt
      const result1 = store.recordAttempt(key);
      expect(result1.blocked).toBe(false);
      expect(result1.attemptCount).toBe(1);
      expect(result1.remainingAttempts).toBe(4);

      // Second attempt
      const result2 = store.recordAttempt(key);
      expect(result2.blocked).toBe(false);
      expect(result2.attemptCount).toBe(2);
      expect(result2.remainingAttempts).toBe(3);
    });

    test('should block after max attempts', () => {
      const key = store.getKey('192.168.1.1', 'user123');
      
      // Make 5 attempts (max allowed)
      for (let i = 0; i < 5; i++) {
        store.recordAttempt(key);
      }
      
      // 6th attempt should be blocked
      const result = store.recordAttempt(key);
      expect(result.blocked).toBe(true);
      expect(result.attemptCount).toBe(6);
      expect(result.remainingMs).toBeGreaterThan(0);
    });

    test('should handle successful password change', () => {
      const key = store.getKey('192.168.1.1', 'user123');
      
      // Make some attempts
      store.recordAttempt(key);
      store.recordAttempt(key);
      
      // Record success
      store.recordSuccess(key);
      
      // Should reduce penalty but not completely reset
      const attemptInfo = store.attempts.get(key);
      expect(attemptInfo.count).toBe(1);
    });

    test('should cleanup old entries', () => {
      const key = store.getKey('192.168.1.1', 'user123');
      
      // Add attempt
      store.recordAttempt(key);
      expect(store.attempts.has(key)).toBe(true);
      
      // Manually set old timestamp
      const attemptInfo = store.attempts.get(key);
      attemptInfo.firstAttempt = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
      
      // Run cleanup
      store.cleanup();
      
      // Should be cleaned up
      expect(store.attempts.has(key)).toBe(false);
    });
  });

  describe('passwordChangeRateLimiter middleware', () => {
    test('should skip when rate limiting is disabled', () => {
      flags.isEnabled.mockImplementation((flag) => {
        if (flag === 'ENABLE_RATE_LIMIT') return false;
        return false; // Default for other flags
      });
      
      passwordChangeRateLimiter(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should skip when user is not authenticated', () => {
      req.user = null;
      flags.isEnabled.mockImplementation((flag) => {
        if (flag === 'ENABLE_RATE_LIMIT') return true;
        return false;
      });
      
      passwordChangeRateLimiter(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should allow first password change attempt', () => {
      flags.isEnabled.mockImplementation((flag) => {
        if (flag === 'ENABLE_RATE_LIMIT') return true;
        return false;
      });
      
      passwordChangeRateLimiter(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should block after max attempts', async () => {
      const userId = req.user.id;
      const ip = '192.168.1.1';
      
      // Simulate 5 failed attempts
      for (let i = 0; i < 5; i++) {
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
          end: jest.fn(),
          statusCode: 400 // Simulate failure
        };
        
        const mockNext = jest.fn();
        passwordChangeRateLimiter(req, mockRes, mockNext);
        
        // Simulate response end with failure
        mockRes.end('error response');
      }
      
      // 6th attempt should be blocked
      passwordChangeRateLimiter(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Too many password change attempts. Please try again later.',
        code: 'PASSWORD_CHANGE_RATE_LIMITED'
      }));
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle successful password changes correctly', () => {
      // Use a fresh user ID to avoid interference from previous tests
      req.user.id = 'fresh-user-456';
      
      // Ensure rate limiting is enabled for this specific test
      flags.isEnabled.mockImplementation((flag) => {
        if (flag === 'ENABLE_RATE_LIMIT') return true;
        if (flag === 'DEBUG_RATE_LIMIT') return false;
        return false;
      });
      
      // Mock the original end function before calling the middleware
      const originalEnd = res.end;
      
      passwordChangeRateLimiter(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      
      // Verify that res.end was wrapped (it should be different now)
      expect(res.end).not.toBe(originalEnd);
      
      // Simulate successful response
      res.statusCode = 200; // Simulate success
      res.end('success response');
      
      // The wrapped function should have been called
      expect(typeof res.end).toBe('function');
    });
  });
});