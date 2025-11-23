/**
 * Error Handling Middleware Tests (Issue #924)
 * 
 * Tests for comprehensive error handling, logging, and recovery
 * with security-conscious error reporting
 */

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  },
  SafeUtils: {
    safeString: jest.fn((str, maxLen) => str ? str.substring(0, maxLen) : ''),
    safeUserIdPrefix: jest.fn((id) => id ? id.substring(0, 8) : null)
  }
}));

// Mock flags
jest.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn((flag) => flag === 'DEBUG')
  }
}));

const {
  errorHandler,
  notFoundHandler,
  asyncWrapper,
  classifyError,
  generateErrorId,
  buildErrorContext,
  buildErrorResponse,
  BaseError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  BusinessLogicError,
  ExternalAPIError,
  DatabaseError,
  SecurityError,
  ERROR_TYPES,
  ERROR_SEVERITY
} = require('../../../src/middleware/errorHandling');

const { logger } = require('../../../src/utils/logger');

describe('Error Handling Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'GET',
      url: '/test',
      originalUrl: '/test',
      ip: '127.0.0.1',
      get: jest.fn((header) => {
        const headers = {
          'User-Agent': 'Test Agent',
          'Content-Type': 'application/json',
          'Content-Length': '100',
          'Origin': 'https://example.com',
          'Referer': 'https://example.com/page'
        };
        return headers[header];
      }),
      user: null,
      sessionID: 'session123',
      responseTime: 50
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      headersSent: false,
      set: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  describe('classifyError', () => {
    test('should classify by status code 400 as VALIDATION_ERROR', () => {
      const error = new Error('Invalid input');
      const classification = classifyError(error, 400);
      
      expect(classification.type).toBe(ERROR_TYPES.VALIDATION_ERROR);
      expect(classification.severity).toBe(ERROR_SEVERITY.MEDIUM);
    });

    test('should classify by status code 401 as AUTHENTICATION_ERROR', () => {
      const error = new Error('Unauthorized');
      const classification = classifyError(error, 401);
      
      expect(classification.type).toBe(ERROR_TYPES.AUTHENTICATION_ERROR);
      expect(classification.severity).toBe(ERROR_SEVERITY.MEDIUM);
    });

    test('should classify by status code 403 as AUTHORIZATION_ERROR', () => {
      const error = new Error('Forbidden');
      const classification = classifyError(error, 403);
      
      expect(classification.type).toBe(ERROR_TYPES.AUTHORIZATION_ERROR);
      expect(classification.severity).toBe(ERROR_SEVERITY.MEDIUM);
    });

    test('should classify by status code 429 as RATE_LIMIT_ERROR', () => {
      const error = new Error('Too many requests');
      const classification = classifyError(error, 429);
      
      expect(classification.type).toBe(ERROR_TYPES.RATE_LIMIT_ERROR);
      expect(classification.severity).toBe(ERROR_SEVERITY.MEDIUM);
    });

    test('should classify by status code 500 as SYSTEM_ERROR', () => {
      const error = new Error('Internal error');
      const classification = classifyError(error, 500);
      
      expect(classification.type).toBe(ERROR_TYPES.SYSTEM_ERROR);
      expect(classification.severity).toBe(ERROR_SEVERITY.HIGH);
    });

    test('should classify by error message pattern - validation', () => {
      const error = new Error('Invalid input provided');
      const classification = classifyError(error, 600); // Use unmapped status code
      
      expect(classification.type).toBe(ERROR_TYPES.VALIDATION_ERROR);
      expect(classification.severity).toBe(ERROR_SEVERITY.LOW);
    });

    test('should classify by error message pattern - authentication', () => {
      const error = new Error('Authentication required');
      const classification = classifyError(error, 600); // Use unmapped status code
      
      expect(classification.type).toBe(ERROR_TYPES.AUTHENTICATION_ERROR);
      expect(classification.severity).toBe(ERROR_SEVERITY.MEDIUM);
    });

    test('should classify by error message pattern - authorization', () => {
      const error = new Error('Permission denied');
      const classification = classifyError(error, 600); // Use unmapped status code
      
      expect(classification.type).toBe(ERROR_TYPES.AUTHORIZATION_ERROR);
      expect(classification.severity).toBe(ERROR_SEVERITY.MEDIUM);
    });

    test('should classify by error message pattern - rate limit', () => {
      const error = new Error('Rate limit exceeded');
      const classification = classifyError(error, 600); // Use unmapped status code
      
      expect(classification.type).toBe(ERROR_TYPES.RATE_LIMIT_ERROR);
      expect(classification.severity).toBe(ERROR_SEVERITY.LOW);
    });

    test('should classify by error message pattern - database', () => {
      const error = new Error('Database connection failed');
      const classification = classifyError(error, 600); // Use unmapped status code
      
      expect(classification.type).toBe(ERROR_TYPES.DATABASE_ERROR);
      expect(classification.severity).toBe(ERROR_SEVERITY.HIGH);
    });

    test('should classify by error message pattern - external API', () => {
      const error = new Error('API timeout occurred');
      const classification = classifyError(error, 600); // Use unmapped status code
      
      expect(classification.type).toBe(ERROR_TYPES.EXTERNAL_API_ERROR);
      expect(classification.severity).toBe(ERROR_SEVERITY.MEDIUM);
    });

    test('should classify by error message pattern - security', () => {
      const error = new Error('Security violation detected');
      const classification = classifyError(error, 600); // Use unmapped status code
      
      expect(classification.type).toBe(ERROR_TYPES.SECURITY_ERROR);
      expect(classification.severity).toBe(ERROR_SEVERITY.HIGH);
    });

    test('should default to SYSTEM_ERROR for unknown errors', () => {
      const error = new Error('Unknown error');
      const classification = classifyError(error, 500);
      
      expect(classification.type).toBe(ERROR_TYPES.SYSTEM_ERROR);
      expect(classification.severity).toBe(ERROR_SEVERITY.HIGH);
    });
  });

  describe('generateErrorId', () => {
    test('should generate unique error IDs', () => {
      const id1 = generateErrorId();
      const id2 = generateErrorId();
      
      expect(id1).toMatch(/^err_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^err_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('buildErrorContext', () => {
    test('should build comprehensive error context', () => {
      const error = new Error('Test error');
      error.statusCode = 400;
      const classification = { type: ERROR_TYPES.VALIDATION_ERROR, severity: ERROR_SEVERITY.LOW };
      
      req.user = { id: 'user123', plan: 'pro' };
      
      const context = buildErrorContext(req, error, classification);
      
      expect(context.method).toBe('GET');
      expect(context.url).toBe('/test');
      expect(context.ip).toBe('127.0.0.1');
      expect(context.userId).toBeDefined();
      expect(context.errorType).toBe(ERROR_TYPES.VALIDATION_ERROR);
      expect(context.errorSeverity).toBe(ERROR_SEVERITY.LOW);
      expect(context.statusCode).toBe(400);
      expect(context.isAuthenticated).toBe(true);
      expect(context.userPlan).toBe('pro');
    });

    test('should handle missing user', () => {
      const error = new Error('Test error');
      const classification = { type: ERROR_TYPES.SYSTEM_ERROR, severity: ERROR_SEVERITY.HIGH };
      
      const context = buildErrorContext(req, error, classification);
      
      expect(context.isAuthenticated).toBe(false);
      expect(context.userId).toBeNull();
    });
  });

  describe('buildErrorResponse', () => {
    test('should build safe error response for production', () => {
      process.env.NODE_ENV = 'production';
      const classification = { type: ERROR_TYPES.VALIDATION_ERROR };
      const errorId = generateErrorId();
      
      const response = buildErrorResponse(classification, errorId);
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid input provided');
      expect(response.code).toBe(ERROR_TYPES.VALIDATION_ERROR);
      expect(response.errorId).toBe(errorId);
      expect(response.debug).toBeUndefined();
      process.env.NODE_ENV = 'test';
    });

    test('should include debug info in development', () => {
      process.env.NODE_ENV = 'development';
      const classification = { type: ERROR_TYPES.SYSTEM_ERROR };
      const errorId = generateErrorId();
      const originalError = new Error('Test error');
      originalError.stack = 'Error stack trace';
      
      const response = buildErrorResponse(classification, errorId, originalError);
      
      expect(response.debug).toBeDefined();
      expect(response.debug.message).toBe('Test error');
      expect(response.debug.stack).toBeDefined();
      process.env.NODE_ENV = 'test';
    });

    test('should add retryable flag for retryable errors', () => {
      const classification = { type: ERROR_TYPES.EXTERNAL_API_ERROR };
      const errorId = generateErrorId();
      
      const response = buildErrorResponse(classification, errorId);
      
      expect(response.retryable).toBe(true);
      expect(response.retryAfter).toBeDefined();
    });
  });

  // Note: calculateRetryDelay and attemptErrorRecovery are internal functions
  // They are tested indirectly through buildErrorResponse and errorHandler

  describe('errorHandler middleware', () => {
    test('should handle error and send response', async () => {
      const error = new ValidationError('Invalid input');
      const handler = errorHandler();
      
      await handler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    test('should skip if response already sent', async () => {
      res.headersSent = true;
      const error = new Error('Test error');
      const handler = errorHandler();
      
      await handler(error, req, res, next);
      
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should use error statusCode if available', async () => {
      const error = new Error('Test error');
      error.statusCode = 404;
      const handler = errorHandler();
      
      await handler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('should attempt recovery when enabled', async () => {
      const error = new Error('Rate limit exceeded');
      error.statusCode = 429;
      const handler = errorHandler({ enableRecovery: true });
      
      await handler(error, req, res, next);
      
      expect(res.set).toHaveBeenCalledWith('Retry-After', expect.any(String));
    });

    test('should not attempt recovery when disabled', async () => {
      const error = new Error('Test error');
      const handler = errorHandler({ enableRecovery: false });
      
      await handler(error, req, res, next);
      
      expect(res.set).not.toHaveBeenCalled();
    });

    // Note: Handler error case is tested implicitly through normal error handling
    // The try-catch block in errorHandler ensures graceful degradation

    test('should track errors when enabled', async () => {
      const error = new Error('Test error');
      const handler = errorHandler({ enableErrorTracking: true });
      
      await handler(error, req, res, next);
      
      expect(logger.debug).toHaveBeenCalledWith(
        'Error tracked',
        expect.any(Object)
      );
    });
  });

  describe('asyncWrapper', () => {
    test('should wrap async function and catch errors', async () => {
      const asyncFn = async (req, res, next) => {
        throw new Error('Async error');
      };
      
      const wrapped = asyncWrapper(asyncFn);
      
      await wrapped(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should pass through successful async function', async () => {
      const asyncFn = async (req, res, next) => {
        res.json({ success: true });
      };
      
      const wrapped = asyncWrapper(asyncFn);
      
      await wrapped(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle synchronous function', () => {
      const syncFn = (req, res, next) => {
        next();
      };
      
      const wrapped = asyncWrapper(syncFn);
      
      wrapped(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Error Classes', () => {
    test('BaseError should set statusCode and errorType', () => {
      const error = new BaseError('Test error', 400, ERROR_TYPES.VALIDATION_ERROR);
      
      expect(error.statusCode).toBe(400);
      expect(error.errorType).toBe(ERROR_TYPES.VALIDATION_ERROR);
      expect(error.timestamp).toBeDefined();
      expect(error.message).toBe('Test error');
    });

    test('ValidationError should have correct defaults', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });
      
      expect(error.statusCode).toBe(400);
      expect(error.errorType).toBe(ERROR_TYPES.VALIDATION_ERROR);
      expect(error.details).toEqual({ field: 'email' });
    });

    test('AuthenticationError should have correct defaults', () => {
      const error = new AuthenticationError();
      
      expect(error.statusCode).toBe(401);
      expect(error.errorType).toBe(ERROR_TYPES.AUTHENTICATION_ERROR);
      expect(error.message).toBe('Authentication required');
    });

    test('AuthorizationError should have correct defaults', () => {
      const error = new AuthorizationError();
      
      expect(error.statusCode).toBe(403);
      expect(error.errorType).toBe(ERROR_TYPES.AUTHORIZATION_ERROR);
      expect(error.message).toBe('Insufficient permissions');
    });

    test('BusinessLogicError should have correct defaults', () => {
      const error = new BusinessLogicError('Conflict', { reason: 'duplicate' });
      
      expect(error.statusCode).toBe(409);
      expect(error.errorType).toBe(ERROR_TYPES.BUSINESS_LOGIC_ERROR);
      expect(error.details).toEqual({ reason: 'duplicate' });
    });

    test('ExternalAPIError should have service property', () => {
      const error = new ExternalAPIError('API failed', 'openai');
      
      expect(error.statusCode).toBe(502);
      expect(error.errorType).toBe(ERROR_TYPES.EXTERNAL_API_ERROR);
      expect(error.service).toBe('openai');
    });

    test('DatabaseError should have operation property', () => {
      const error = new DatabaseError('Query failed', 'select');
      
      expect(error.statusCode).toBe(500);
      expect(error.errorType).toBe(ERROR_TYPES.DATABASE_ERROR);
      expect(error.operation).toBe('select');
    });

    test('SecurityError should have violation property', () => {
      const error = new SecurityError('Security violation', 'injection');
      
      expect(error.statusCode).toBe(403);
      expect(error.errorType).toBe(ERROR_TYPES.SECURITY_ERROR);
      expect(error.violation).toBe('injection');
    });
  });

  describe('notFoundHandler', () => {
    test('should create ValidationError for 404', () => {
      notFoundHandler(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(404);
      expect(error.message).toContain('Route not found');
    });
  });
});

