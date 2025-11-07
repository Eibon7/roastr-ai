/**
 * CSRF Middleware Tests (Issue #745)
 *
 * Tests for Double Submit Cookie CSRF protection implementation.
 * Validates token generation, cookie setting, and validation logic.
 */

// Mock QueueService to prevent database connection issues
jest.mock('../../../src/services/queueService', () => {
  return jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    addJob: jest.fn(),
    getQueueStatus: jest.fn()
  }));
});

// Mock Supabase client
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }))
    }))
  }
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }
}));

const { generateCsrfToken, setCsrfToken, validateCsrfToken, getCsrfToken } = require('../../../src/middleware/csrf');

describe('CSRF Middleware', () => {
  describe('generateCsrfToken', () => {
    test('should generate a 64-character hex token', () => {
      const token = generateCsrfToken();

      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should generate unique tokens', () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('setCsrfToken', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        cookies: {},
        path: '/api/admin/test',
        method: 'GET'
      };
      res = {
        cookie: jest.fn(),
        setHeader: jest.fn()
      };
      next = jest.fn();
    });

    test('should generate and set new token when none exists', () => {
      setCsrfToken(req, res, next);

      expect(res.cookie).toHaveBeenCalledWith(
        'csrf-token',
        expect.stringMatching(/^[a-f0-9]{64}$/),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000
        })
      );
      expect(res.setHeader).toHaveBeenCalledWith('X-CSRF-Token', expect.any(String));
      expect(next).toHaveBeenCalled();
    });

    test('should expose existing token in header when cookie present', () => {
      const existingToken = generateCsrfToken();
      req.cookies = { 'csrf-token': existingToken };

      setCsrfToken(req, res, next);

      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('X-CSRF-Token', existingToken);
      expect(next).toHaveBeenCalled();
    });

    test('should set secure flag in production', () => {
      process.env.NODE_ENV = 'production';

      setCsrfToken(req, res, next);

      expect(res.cookie).toHaveBeenCalledWith(
        'csrf-token',
        expect.any(String),
        expect.objectContaining({
          secure: true
        })
      );

      process.env.NODE_ENV = 'test';
    });

    test('should not set secure flag in development', () => {
      process.env.NODE_ENV = 'development';

      setCsrfToken(req, res, next);

      expect(res.cookie).toHaveBeenCalledWith(
        'csrf-token',
        expect.any(String),
        expect.objectContaining({
          secure: false
        })
      );

      process.env.NODE_ENV = 'test';
    });
  });

  describe('validateCsrfToken', () => {
    let req, res, next;
    const validToken = generateCsrfToken();

    beforeEach(() => {
      req = {
        method: 'POST',
        path: '/api/admin/test',
        cookies: { 'csrf-token': validToken },
        headers: { 'x-csrf-token': validToken },
        user: { id: 'user-123' }
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
      process.env.NODE_ENV = 'development';
    });

    describe('Safe methods (GET, HEAD, OPTIONS)', () => {
      test('should skip validation for GET requests', () => {
        req.method = 'GET';
        req.headers = {}; // No CSRF token

        validateCsrfToken(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      test('should skip validation for HEAD requests', () => {
        req.method = 'HEAD';
        req.headers = {}; // No CSRF token

        validateCsrfToken(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      test('should skip validation for OPTIONS requests', () => {
        req.method = 'OPTIONS';
        req.headers = {}; // No CSRF token

        validateCsrfToken(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });

    describe('Test environment bypass', () => {
      test('should skip validation in test environment', () => {
        process.env.NODE_ENV = 'test';
        req.headers = {}; // No CSRF token
        req.cookies = {}; // No CSRF cookie

        validateCsrfToken(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();

        process.env.NODE_ENV = 'development';
      });
    });

    describe('Valid CSRF token', () => {
      test('should pass validation when tokens match', () => {
        validateCsrfToken(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      test('should accept both X-CSRF-Token and csrf-token headers', () => {
        req.headers = { 'csrf-token': validToken };
        delete req.headers['x-csrf-token'];

        validateCsrfToken(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });

    describe('Missing CSRF token', () => {
      test('should reject when cookie token is missing', () => {
        req.cookies = {};

        validateCsrfToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'CSRF_TOKEN_MISSING',
          message: 'CSRF token is required for this operation'
        });
        expect(next).not.toHaveBeenCalled();
      });

      test('should reject when header token is missing', () => {
        req.headers = {};

        validateCsrfToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'CSRF_TOKEN_MISSING',
          message: 'CSRF token is required for this operation'
        });
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe('Invalid CSRF token', () => {
      test('should reject when tokens do not match', () => {
        req.headers['x-csrf-token'] = generateCsrfToken(); // Different token

        validateCsrfToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'CSRF_TOKEN_INVALID',
          message: 'Invalid CSRF token'
        });
        expect(next).not.toHaveBeenCalled();
      });

      test('should reject when token lengths differ', () => {
        req.headers['x-csrf-token'] = 'short';

        validateCsrfToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'CSRF_TOKEN_INVALID',
          message: 'Invalid CSRF token'
        });
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe('State-modifying methods', () => {
      const methods = ['POST', 'PUT', 'PATCH', 'DELETE'];

      methods.forEach(method => {
        test(`should validate CSRF token for ${method} requests`, () => {
          req.method = method;
          req.headers = {}; // No CSRF token

          validateCsrfToken(req, res, next);

          expect(res.status).toHaveBeenCalledWith(403);
          expect(next).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('getCsrfToken', () => {
    test('should return token from cookies', () => {
      const token = generateCsrfToken();
      const req = {
        cookies: { 'csrf-token': token }
      };

      expect(getCsrfToken(req)).toBe(token);
    });

    test('should return null when no cookie present', () => {
      const req = { cookies: {} };

      expect(getCsrfToken(req)).toBeNull();
    });

    test('should return null when cookies undefined', () => {
      const req = {};

      expect(getCsrfToken(req)).toBeNull();
    });
  });
});
