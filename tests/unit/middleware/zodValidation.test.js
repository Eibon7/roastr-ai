/**
 * Unit tests for Zod validation middleware
 * Issue #946 - Migration from manual validation to Zod
 * 
 * Tests cover:
 * - Successful validation with defaults
 * - Error formatting for client responses
 * - Multiple field validation errors
 * - Integration with Express request/response
 * - Unexpected error handling
 */

const { z } = require('zod');
const { validateRequest } = require('../../../src/middleware/zodValidation');
const { logger } = require('../../../src/utils/logger');

// Mock logger to prevent console output during tests
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Zod Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock request, response, next
    req = {
      body: {},
      path: '/test',
      method: 'POST',
      user: { id: 'test-user-id' }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();
  });

  describe('Successful Validation', () => {
    it('should pass valid data to next middleware', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });
      
      req.body = { name: 'John', age: 30 };
      
      const middleware = validateRequest(schema);
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should apply schema transformations (trim)', () => {
      const schema = z.object({
        text: z.string().trim()
      });
      
      req.body = { text: '  trimmed  ' };
      
      const middleware = validateRequest(schema);
      middleware(req, res, next);
      
      expect(req.body.text).toBe('trimmed');
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should apply default values', () => {
      const schema = z.object({
        name: z.string(),
        role: z.string().default('user')
      });
      
      req.body = { name: 'John' };
      
      const middleware = validateRequest(schema);
      middleware(req, res, next);
      
      expect(req.body.role).toBe('user');
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should replace req.body with parsed data', () => {
      const schema = z.object({
        count: z.number()
      });
      
      req.body = { count: 42 };
      const originalBody = req.body;
      
      const middleware = validateRequest(schema);
      middleware(req, res, next);
      
      expect(req.body).toEqual({ count: 42 });
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('Validation Errors', () => {
    it('should return 400 for validation errors', () => {
      const schema = z.object({
        email: z.string().email()
      });
      
      req.body = { email: 'invalid-email' };
      
      const middleware = validateRequest(schema);
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should format single field error correctly', () => {
      const schema = z.object({
        age: z.number().min(18, 'Must be 18 or older')
      });
      
      req.body = { age: 16 };
      
      const middleware = validateRequest(schema);
      middleware(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'age',
            message: 'Must be 18 or older',
            code: expect.any(String)
          })
        ]),
        timestamp: expect.any(String)
      });
    });

    it('should format multiple field errors correctly', () => {
      const schema = z.object({
        name: z.string().min(1, 'Name is required'),
        age: z.number().min(0, 'Age must be positive')
      });
      
      req.body = { name: '', age: -5 };
      
      const middleware = validateRequest(schema);
      middleware(req, res, next);
      
      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.details).toHaveLength(2);
      expect(jsonCall.details[0].field).toBe('name');
      expect(jsonCall.details[1].field).toBe('age');
    });

    it('should handle nested field errors', () => {
      const schema = z.object({
        user: z.object({
          email: z.string().email()
        })
      });
      
      req.body = { user: { email: 'invalid' } };
      
      const middleware = validateRequest(schema);
      middleware(req, res, next);
      
      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.details[0].field).toBe('user.email');
    });

    it('should handle missing required fields', () => {
      const schema = z.object({
        required: z.string()
      });
      
      req.body = {};
      
      const middleware = validateRequest(schema);
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed'
        })
      );
    });

    it('should handle wrong type errors', () => {
      const schema = z.object({
        count: z.number()
      });
      
      req.body = { count: 'not-a-number' };
      
      const middleware = validateRequest(schema);
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.details[0].field).toBe('count');
    });
  });

  describe('Logging', () => {
    it('should log validation errors with context', () => {
      const schema = z.object({
        email: z.string().email()
      });
      
      req.body = { email: 'invalid' };
      req.user = { id: 'user-123' };
      
      const middleware = validateRequest(schema);
      middleware(req, res, next);
      
      expect(logger.warn).toHaveBeenCalledWith('Zod validation failed', {
        errors: expect.any(Array),
        endpoint: '/test',
        method: 'POST',
        userId: 'user-123'
      });
    });

    it('should log validation errors without userId if not authenticated', () => {
      const schema = z.object({
        email: z.string().email()
      });
      
      req.body = { email: 'invalid' };
      delete req.user;
      
      const middleware = validateRequest(schema);
      middleware(req, res, next);
      
      expect(logger.warn).toHaveBeenCalledWith('Zod validation failed', {
        errors: expect.any(Array),
        endpoint: '/test',
        method: 'POST',
        userId: undefined
      });
    });

    it('should log unexpected errors', () => {
      // Create a schema that throws an unexpected error
      const schema = {
        parse: () => {
          throw new Error('Unexpected error');
        }
      };
      
      req.body = { test: 'data' };
      
      const middleware = validateRequest(schema);
      middleware(req, res, next);
      
      expect(logger.error).toHaveBeenCalledWith('Unexpected validation error', {
        error: 'Unexpected error',
        stack: expect.any(String),
        endpoint: '/test',
        method: 'POST',
        userId: 'test-user-id'
      });
    });
  });

  describe('Error Responses', () => {
    it('should include timestamp in error responses', () => {
      const schema = z.object({
        required: z.string()
      });
      
      req.body = {};
      
      const middleware = validateRequest(schema);
      middleware(req, res, next);
      
      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should include success: false in error responses', () => {
      const schema = z.object({
        required: z.string()
      });
      
      req.body = {};
      
      const middleware = validateRequest(schema);
      middleware(req, res, next);
      
      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.success).toBe(false);
    });

    it('should include details array in validation error responses', () => {
      const schema = z.object({
        email: z.string().email()
      });
      
      req.body = { email: 'invalid' };
      
      const middleware = validateRequest(schema);
      middleware(req, res, next);
      
      const jsonCall = res.json.mock.calls[0][0];
      expect(Array.isArray(jsonCall.details)).toBe(true);
      expect(jsonCall.details.length).toBeGreaterThan(0);
    });
  });

  describe('Unexpected Errors', () => {
    it('should return 500 for non-Zod errors', () => {
      const schema = {
        parse: () => {
          throw new Error('Unexpected error');
        }
      };
      
      req.body = { test: 'data' };
      
      const middleware = validateRequest(schema);
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        timestamp: expect.any(String)
      });
    });

    it('should not expose error details in unexpected errors', () => {
      const schema = {
        parse: () => {
          throw new Error('Internal server error');
        }
      };
      
      req.body = { test: 'data' };
      
      const middleware = validateRequest(schema);
      middleware(req, res, next);
      
      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.error).toBe('Validation error');
      expect(jsonCall).not.toHaveProperty('details');
    });
  });

  describe('Complex Schemas', () => {
    it('should handle optional fields', () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional()
      });
      
      req.body = { required: 'value' };
      
      const middleware = validateRequest(schema);
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.body.required).toBe('value');
      expect(req.body.optional).toBeUndefined();
    });

    it('should handle nullable fields', () => {
      const schema = z.object({
        field: z.string().nullable()
      });
      
      req.body = { field: null };
      
      const middleware = validateRequest(schema);
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.body.field).toBeNull();
    });

    it('should handle enum fields', () => {
      const schema = z.object({
        status: z.enum(['active', 'inactive'])
      });
      
      req.body = { status: 'active' };
      
      const middleware = validateRequest(schema);
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.body.status).toBe('active');
    });

    it('should reject invalid enum values', () => {
      const schema = z.object({
        status: z.enum(['active', 'inactive'])
      });
      
      req.body = { status: 'pending' };
      
      const middleware = validateRequest(schema);
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });
});

