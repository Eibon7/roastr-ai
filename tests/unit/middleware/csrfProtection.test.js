/**
 * CSRF Protection Middleware Tests (Issue #924)
 * 
 * Tests for CSRF token generation, validation, and middleware
 */

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }
}));

// Mock flags
jest.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn((flag) => flag === 'ENABLE_CSRF_PROTECTION')
  }
}));

const {
  csrfProtection,
  CSRFProtection,
  csrfProtectionInstance
} = require('../../../src/middleware/csrfProtection');

const { logger } = require('../../../src/utils/logger');

describe('CSRF Protection Middleware', () => {
  let req, res, next;

  // Clean up the interval after all tests to prevent Jest from hanging
  afterAll(() => {
    if (csrfProtectionInstance && csrfProtectionInstance.cleanup) {
      csrfProtectionInstance.cleanup();
    }
  });

  beforeEach(() => {
    req = {
      method: 'GET',
      path: '/test',
      ip: '127.0.0.1',
      get: jest.fn((header) => {
        const headers = {
          'User-Agent': 'Test Agent'
        };
        return headers[header];
      }),
      sessionID: 'session123',
      session: null,
      body: {},
      query: {}
    };
    res = {
      cookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    
    // Clear token cache
    csrfProtectionInstance.tokenCache.clear();
  });

  describe('CSRFProtection class', () => {
    describe('generateToken', () => {
      test('should generate a 64-character hex token', () => {
        const token = csrfProtectionInstance.generateToken();
        
        expect(token).toHaveLength(64);
        expect(token).toMatch(/^[0-9a-fA-F]{64}$/);
      });

      test('should generate unique tokens', () => {
        const token1 = csrfProtectionInstance.generateToken();
        const token2 = csrfProtectionInstance.generateToken();
        
        expect(token1).not.toBe(token2);
      });
    });

    describe('storeToken', () => {
      test('should store token with timestamp', () => {
        const sessionId = 'session123';
        const token = csrfProtectionInstance.generateToken();
        
        csrfProtectionInstance.storeToken(sessionId, token);
        
        const stored = csrfProtectionInstance.tokenCache.get(sessionId);
        expect(stored).toBeDefined();
        expect(stored.token).toBe(token);
        expect(stored.timestamp).toBeDefined();
      });
    });

    describe('validateToken', () => {
      test('should return false for non-existent session', () => {
        const result = csrfProtectionInstance.validateToken('nonexistent', 'token123');
        
        expect(result).toBe(false);
      });

      test('should return false for expired token', () => {
        const sessionId = 'session123';
        const token = csrfProtectionInstance.generateToken();
        
        csrfProtectionInstance.storeToken(sessionId, token);
        
        // Manually expire token
        const stored = csrfProtectionInstance.tokenCache.get(sessionId);
        stored.timestamp = Date.now() - (3 * 60 * 60 * 1000); // 3 hours ago
        
        const result = csrfProtectionInstance.validateToken(sessionId, token);
        
        expect(result).toBe(false);
        expect(csrfProtectionInstance.tokenCache.has(sessionId)).toBe(false);
      });

      test('should return true for valid token', () => {
        const sessionId = 'session123';
        const token = csrfProtectionInstance.generateToken();
        
        csrfProtectionInstance.storeToken(sessionId, token);
        
        const result = csrfProtectionInstance.validateToken(sessionId, token);
        
        expect(result).toBe(true);
      });

      test('should return false for invalid token', () => {
        const sessionId = 'session123';
        const token = csrfProtectionInstance.generateToken();
        const invalidToken = csrfProtectionInstance.generateToken();
        
        csrfProtectionInstance.storeToken(sessionId, token);
        
        const result = csrfProtectionInstance.validateToken(sessionId, invalidToken);
        
        expect(result).toBe(false);
      });

      test('should handle non-hex token gracefully', () => {
        const sessionId = 'session123';
        const token = csrfProtectionInstance.generateToken();
        
        csrfProtectionInstance.storeToken(sessionId, token);
        
        const result = csrfProtectionInstance.validateToken(sessionId, 'not-hex-token');
        
        expect(result).toBe(false);
      });

      test('should handle token length mismatch', () => {
        const sessionId = 'session123';
        const token = csrfProtectionInstance.generateToken();
        
        csrfProtectionInstance.storeToken(sessionId, token);
        
        const result = csrfProtectionInstance.validateToken(sessionId, 'short');
        
        expect(result).toBe(false);
      });
    });

    describe('cleanupExpiredTokens', () => {
      test('should remove expired tokens', () => {
        const session1 = 'session1';
        const session2 = 'session2';
        const token1 = csrfProtectionInstance.generateToken();
        const token2 = csrfProtectionInstance.generateToken();
        
        csrfProtectionInstance.storeToken(session1, token1);
        csrfProtectionInstance.storeToken(session2, token2);
        
        // Expire session1
        const stored1 = csrfProtectionInstance.tokenCache.get(session1);
        stored1.timestamp = Date.now() - (3 * 60 * 60 * 1000);
        
        csrfProtectionInstance.cleanupExpiredTokens();
        
        expect(csrfProtectionInstance.tokenCache.has(session1)).toBe(false);
        expect(csrfProtectionInstance.tokenCache.has(session2)).toBe(true);
      });

      test('should log cleanup when tokens removed', () => {
        const session1 = 'session1';
        const token1 = csrfProtectionInstance.generateToken();
        
        csrfProtectionInstance.storeToken(session1, token1);
        
        // Expire token
        const stored = csrfProtectionInstance.tokenCache.get(session1);
        stored.timestamp = Date.now() - (3 * 60 * 60 * 1000);
        
        csrfProtectionInstance.cleanupExpiredTokens();
        
        expect(logger.debug).toHaveBeenCalledWith(
          'CSRF token cleanup completed',
          expect.objectContaining({ tokensRemoved: expect.any(Number) })
        );
      });
    });

    describe('getSessionId', () => {
      test('should use sessionID if available', () => {
        req.sessionID = 'session123';
        
        const sessionId = csrfProtectionInstance.getSessionId(req);
        
        expect(sessionId).toBe('session123');
      });

      test('should use session.id if sessionID not available', () => {
        req.sessionID = null;
        req.session = { id: 'session456' };
        
        const sessionId = csrfProtectionInstance.getSessionId(req);
        
        expect(sessionId).toBe('session456');
      });

      test('should generate hash from IP and User-Agent as fallback', () => {
        req.sessionID = null;
        req.session = null;
        req.ip = '127.0.0.1';
        req.get = jest.fn((header) => header === 'User-Agent' ? 'Test Agent' : null);
        
        const sessionId = csrfProtectionInstance.getSessionId(req);
        
        expect(sessionId).toHaveLength(64);
        expect(sessionId).toMatch(/^[0-9a-f]{64}$/);
      });
    });
  });

  describe('csrfProtection middleware', () => {
    test('should be disabled in test environment', () => {
      process.env.NODE_ENV = 'test';
      const middleware = csrfProtection();
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.cookie).not.toHaveBeenCalled();
      expect(req.csrfToken).toBeDefined();
    });

    test('should be disabled when feature flag is off', () => {
      process.env.NODE_ENV = 'production';
      const { flags } = require('../../../src/config/flags');
      flags.isEnabled.mockReturnValue(false);
      
      const middleware = csrfProtection();
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'CSRF protection disabled (test environment or feature flag)'
      );
    });

    test('should skip CSRF protection for configured paths', () => {
      process.env.NODE_ENV = 'production';
      const { flags } = require('../../../src/config/flags');
      flags.isEnabled.mockReturnValue(true);
      
      req.path = '/api/webhooks';
      req.method = 'POST';
      
      const middleware = csrfProtection({ skipPaths: ['/api/webhooks'] });
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should generate and set token for GET requests', () => {
      process.env.NODE_ENV = 'production';
      const { flags } = require('../../../src/config/flags');
      flags.isEnabled.mockReturnValue(true);
      
      req.method = 'GET';
      req.path = '/api/test';
      
      const middleware = csrfProtection();
      
      middleware(req, res, next);
      
      expect(res.cookie).toHaveBeenCalledWith(
        'csrf-token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: false,
          secure: true,
          sameSite: 'strict',
          maxAge: expect.any(Number)
        })
      );
      expect(req.csrfToken).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    test('should set secure flag in production', () => {
      process.env.NODE_ENV = 'production';
      const { flags } = require('../../../src/config/flags');
      flags.isEnabled.mockReturnValue(true);
      
      req.method = 'GET';
      
      const middleware = csrfProtection();
      
      middleware(req, res, next);
      
      expect(res.cookie).toHaveBeenCalledWith(
        'csrf-token',
        expect.any(String),
        expect.objectContaining({
          secure: true
        })
      );
    });

    test('should not set secure flag in development', () => {
      process.env.NODE_ENV = 'development';
      const { flags } = require('../../../src/config/flags');
      flags.isEnabled.mockReturnValue(true);
      
      req.method = 'GET';
      
      const middleware = csrfProtection();
      
      middleware(req, res, next);
      
      expect(res.cookie).toHaveBeenCalledWith(
        'csrf-token',
        expect.any(String),
        expect.objectContaining({
          secure: false
        })
      );
    });

    test('should reject POST request without token', () => {
      process.env.NODE_ENV = 'production';
      const { flags } = require('../../../src/config/flags');
      flags.isEnabled.mockReturnValue(true);
      
      req.method = 'POST';
      req.path = '/api/test';
      req.get = jest.fn(() => null);
      
      const middleware = csrfProtection();
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'CSRF token missing',
        code: 'CSRF_TOKEN_MISSING'
      });
      expect(logger.warn).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test('should accept token from x-csrf-token header', () => {
      process.env.NODE_ENV = 'production';
      const { flags } = require('../../../src/config/flags');
      flags.isEnabled.mockReturnValue(true);
      
      const sessionId = csrfProtectionInstance.getSessionId(req);
      const token = csrfProtectionInstance.generateToken();
      csrfProtectionInstance.storeToken(sessionId, token);
      
      req.method = 'POST';
      req.path = '/api/test';
      req.get = jest.fn((header) => {
        if (header === 'x-csrf-token') return token;
        return null;
      });
      
      const middleware = csrfProtection();
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should accept token from body._csrf', () => {
      process.env.NODE_ENV = 'production';
      const { flags } = require('../../../src/config/flags');
      flags.isEnabled.mockReturnValue(true);
      
      const sessionId = csrfProtectionInstance.getSessionId(req);
      const token = csrfProtectionInstance.generateToken();
      csrfProtectionInstance.storeToken(sessionId, token);
      
      req.method = 'POST';
      req.path = '/api/test';
      req.body = { _csrf: token };
      req.get = jest.fn(() => null);
      
      const middleware = csrfProtection();
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    test('should accept token from query._csrf', () => {
      process.env.NODE_ENV = 'production';
      const { flags } = require('../../../src/config/flags');
      flags.isEnabled.mockReturnValue(true);
      
      const sessionId = csrfProtectionInstance.getSessionId(req);
      const token = csrfProtectionInstance.generateToken();
      csrfProtectionInstance.storeToken(sessionId, token);
      
      req.method = 'POST';
      req.path = '/api/test';
      req.query = { _csrf: token };
      req.get = jest.fn(() => null);
      
      const middleware = csrfProtection();
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    test('should reject POST request with invalid token', () => {
      process.env.NODE_ENV = 'production';
      const { flags } = require('../../../src/config/flags');
      flags.isEnabled.mockReturnValue(true);
      
      const sessionId = csrfProtectionInstance.getSessionId(req);
      const token = csrfProtectionInstance.generateToken();
      csrfProtectionInstance.storeToken(sessionId, token);
      
      req.method = 'POST';
      req.path = '/api/test';
      req.get = jest.fn((header) => {
        if (header === 'x-csrf-token') return 'invalid-token';
        return null;
      });
      
      const middleware = csrfProtection();
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid CSRF token',
        code: 'CSRF_TOKEN_INVALID'
      });
      expect(logger.warn).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test('should skip validation for HEAD requests', () => {
      process.env.NODE_ENV = 'production';
      const { flags } = require('../../../src/config/flags');
      flags.isEnabled.mockReturnValue(true);
      
      req.method = 'HEAD';
      
      const middleware = csrfProtection({ ignoreMethods: ['GET', 'HEAD', 'OPTIONS'] });
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalled();
    });

    test('should skip validation for OPTIONS requests', () => {
      process.env.NODE_ENV = 'production';
      const { flags } = require('../../../src/config/flags');
      flags.isEnabled.mockReturnValue(true);
      
      req.method = 'OPTIONS';
      
      const middleware = csrfProtection({ ignoreMethods: ['GET', 'HEAD', 'OPTIONS'] });
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    test('should clear cleanup interval', () => {
      const instance = new CSRFProtection();
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      instance.cleanup();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });
});

