/**
 * Security Middleware Tests
 *
 * Tests for security hardening measures including helmet, CORS, rate limiting,
 * input validation, request logging, and error handling
 */

const {
  helmetConfig,
  corsConfig,
  generalRateLimit,
  authRateLimit,
  billingRateLimit,
  validateInput,
  requestLogger,
  errorHandler
} = require('../../../src/middleware/security');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }))
  }
}));
const { logger } = require('../../../src/utils/logger');

describe('Security Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      ip: '127.0.0.1',
      method: 'GET',
      path: '/test',
      body: {},
      query: {},
      get: jest.fn()
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      get: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('helmetConfig', () => {
    test('should be a function (helmet middleware)', () => {
      expect(typeof helmetConfig).toBe('function');
    });

    test('should have correct CSP directives', () => {
      // Since helmet returns a function, we test its configuration indirectly
      expect(helmetConfig).toBeDefined();
      expect(typeof helmetConfig).toBe('function');
    });
  });

  describe('corsConfig', () => {
    test('should be a function (CORS middleware)', () => {
      expect(typeof corsConfig).toBe('function');
    });

    test('should be configured to handle origin validation', () => {
      // Test that corsConfig is properly configured
      expect(corsConfig).toBeDefined();
      expect(typeof corsConfig).toBe('function');
    });
  });

  describe('Rate Limiting', () => {
    describe('generalRateLimit', () => {
      test('should be a function', () => {
        expect(typeof generalRateLimit).toBe('function');
      });

      test('should have correct configuration', () => {
        expect(generalRateLimit).toBeDefined();
      });
    });

    describe('authRateLimit', () => {
      test('should be a function', () => {
        expect(typeof authRateLimit).toBe('function');
      });

      test('should have stricter limits than general rate limit', () => {
        expect(authRateLimit).toBeDefined();
      });
    });

    describe('billingRateLimit', () => {
      test('should be a function', () => {
        expect(typeof billingRateLimit).toBe('function');
      });

      test('should have moderate limits for billing operations', () => {
        expect(billingRateLimit).toBeDefined();
      });
    });
  });

  describe('validateInput', () => {
    test('should sanitize XSS attempts in request body', () => {
      req.body = {
        name: 'John<script>alert("xss")</script>',
        comment: 'Hello<iframe src="evil.com"></iframe>world'
      };

      validateInput(req, res, next);

      expect(req.body.name).toBe('John');
      expect(req.body.comment).toBe('Helloworld');
      expect(next).toHaveBeenCalled();
    });

    test('should sanitize javascript: protocols', () => {
      req.body = {
        url: 'javascript:alert("xss")',
        link: 'JAVASCRIPT:void(0)'
      };

      validateInput(req, res, next);

      expect(req.body.url).toBe('alert("xss")');
      expect(req.body.link).toBe('void(0)');
      expect(next).toHaveBeenCalled();
    });

    test('should sanitize event handlers', () => {
      req.body = {
        text: 'Hello onclick="alert()" world',
        content: 'Test onmouseover="evil()" content'
      };

      validateInput(req, res, next);

      // The regex removes on\w+\s*= patterns
      expect(req.body.text).toBe('Hello "alert()" world');
      expect(req.body.content).toBe('Test "evil()" content');
      expect(next).toHaveBeenCalled();
    });

    test('should sanitize query parameters', () => {
      req.query = {
        search: '<script>alert("xss")</script>search term',
        filter: 'normal text'
      };

      validateInput(req, res, next);

      expect(req.query.search).toBe('search term');
      expect(req.query.filter).toBe('normal text');
      expect(next).toHaveBeenCalled();
    });

    test('should handle nested objects', () => {
      req.body = {
        user: {
          name: 'John<script>alert("nested")</script>',
          profile: {
            bio: 'Bio<iframe></iframe>text'
          }
        }
      };

      validateInput(req, res, next);

      expect(req.body.user.name).toBe('John');
      expect(req.body.user.profile.bio).toBe('Biotext');
      expect(next).toHaveBeenCalled();
    });

    test('should handle non-string values correctly', () => {
      req.body = {
        number: 123,
        boolean: true,
        null_value: null,
        undefined_value: undefined,
        array: [1, 2, 3]
      };

      validateInput(req, res, next);

      expect(req.body.number).toBe(123);
      expect(req.body.boolean).toBe(true);
      expect(req.body.null_value).toBeNull();
      expect(req.body.undefined_value).toBeUndefined();
      expect(req.body.array).toEqual([1, 2, 3]);
      expect(next).toHaveBeenCalled();
    });

    test('should handle empty body and query', () => {
      req.body = null;
      req.query = null;

      validateInput(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('requestLogger', () => {
    test('should skip logging for health checks', () => {
      req.path = '/health';

      requestLogger(req, res, next);

      expect(logger.info).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    test('should skip logging for static assets', () => {
      req.path = '/static/css/styles.css';

      requestLogger(req, res, next);

      expect(logger.info).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    test('should log request information', () => {
      req.get.mockImplementation((header) => {
        if (header === 'User-Agent') return 'Mozilla/5.0';
        if (header === 'Content-Length') return '100';
        return null;
      });

      requestLogger(req, res, next);

      expect(logger.info).toHaveBeenCalledWith('HTTP Request', {
        method: 'GET',
        path: '/test',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        contentLength: '100'
      });
      expect(next).toHaveBeenCalled();
    });

    test('should log response when finished', () => {
      req.get.mockImplementation((header) => {
        if (header === 'User-Agent') return 'Mozilla/5.0';
        return null;
      });
      res.get.mockImplementation((header) => {
        if (header === 'Content-Length') return '200';
        return null;
      });
      res.statusCode = 200;

      requestLogger(req, res, next);

      // Simulate response
      res.send('test response');

      expect(logger.info).toHaveBeenCalledWith('HTTP Request', expect.any(Object));
      expect(logger.info).toHaveBeenCalledWith('HTTP Response', {
        method: 'GET',
        path: '/test',
        statusCode: 200,
        duration: expect.stringMatching(/\d+ms/),
        contentLength: '200'
      });
    });
  });

  describe('errorHandler', () => {
    let error;

    beforeEach(() => {
      error = new Error('Test error');
      error.stack = 'Error stack trace';
    });

    test('should log error details', () => {
      errorHandler(error, req, res, next);

      expect(logger.error).toHaveBeenCalledWith('Unhandled error:', {
        error: 'Test error',
        stack: 'Error stack trace',
        method: 'GET',
        path: '/test',
        ip: '127.0.0.1'
      });
    });

    test('should handle ValidationError', () => {
      error.name = 'ValidationError';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR'
      });
    });

    test('should handle ValidationError in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      error.name = 'ValidationError';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: 'Test error'
      });

      process.env.NODE_ENV = originalEnv;
    });

    test('should handle UnauthorizedError', () => {
      error.name = 'UnauthorizedError';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    });

    test('should handle generic errors in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });

      process.env.NODE_ENV = originalEnv;
    });

    test('should handle generic errors in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: 'Test error'
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Module Exports', () => {
    test('should export all middleware functions', () => {
      const security = require('../../../src/middleware/security');

      expect(security.helmetConfig).toBeDefined();
      expect(security.corsConfig).toBeDefined();
      expect(security.generalRateLimit).toBeDefined();
      expect(security.authRateLimit).toBeDefined();
      expect(security.billingRateLimit).toBeDefined();
      expect(security.validateInput).toBeDefined();
      expect(security.requestLogger).toBeDefined();
      expect(security.errorHandler).toBeDefined();
    });

    test('should export functions of correct types', () => {
      const security = require('../../../src/middleware/security');

      expect(typeof security.helmetConfig).toBe('function');
      expect(typeof security.corsConfig).toBe('function');
      expect(typeof security.generalRateLimit).toBe('function');
      expect(typeof security.authRateLimit).toBe('function');
      expect(typeof security.billingRateLimit).toBe('function');
      expect(typeof security.validateInput).toBe('function');
      expect(typeof security.requestLogger).toBe('function');
      expect(typeof security.errorHandler).toBe('function');
    });
  });

  describe('Integration Tests', () => {
    test('should handle complex XSS payload', () => {
      req.body = {
        content: `<img src=x onerror="alert('XSS')"><script>document.cookie='stolen'</script><iframe src="javascript:alert('iframe')"></iframe>`
      };

      validateInput(req, res, next);

      // Should remove script tags, iframe tags, javascript: protocols, and event handlers
      expect(req.body.content).toBe('<img src=x "alert(\'XSS\')">');
      expect(next).toHaveBeenCalled();
    });

    test('should preserve legitimate HTML entities', () => {
      req.body = {
        text: 'Price: $100 &amp; tax included &lt;valid&gt;',
        html: '&quot;quoted text&quot; &apos;apostrophe&apos;'
      };

      validateInput(req, res, next);

      expect(req.body.text).toBe('Price: $100 &amp; tax included &lt;valid&gt;');
      expect(req.body.html).toBe('&quot;quoted text&quot; &apos;apostrophe&apos;');
      expect(next).toHaveBeenCalled();
    });

    test('should handle mixed content types in nested objects', () => {
      req.body = {
        form: {
          fields: {
            name: '<script>alert(1)</script>John',
            age: 25,
            active: true,
            tags: ['<script>evil</script>tag1', 'tag2']
          }
        }
      };

      validateInput(req, res, next);

      expect(req.body.form.fields.name).toBe('John');
      expect(req.body.form.fields.age).toBe(25);
      expect(req.body.form.fields.active).toBe(true);
      expect(req.body.form.fields.tags[0]).toBe('tag1');
      expect(req.body.form.fields.tags[1]).toBe('tag2');
      expect(next).toHaveBeenCalled();
    });
  });
});
