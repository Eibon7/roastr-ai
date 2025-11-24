const {
  formatZodErrors,
  validateBody,
  validateQuery,
  validateParams
} = require('../../../src/validators/zod/errorFormatter');
const { z } = require('zod');
const { logger } = require('../../../src/utils/logger');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    warn: jest.fn()
  }
}));

describe('Zod Error Formatter - Issue #948', () => {
  describe('formatZodErrors', () => {
    it('should format Zod errors into API-friendly structure', () => {
      const TestSchema = z.object({
        name: z.string().min(1, 'Name is required'),
        age: z.number().min(18, 'Must be 18 or older')
      });

      try {
        TestSchema.parse({ name: '', age: 15 });
      } catch (error) {
        const formatted = formatZodErrors(error);

        expect(formatted.success).toBe(false);
        expect(formatted.message).toBe('Validation failed');
        expect(formatted.errors).toHaveLength(2);
        expect(formatted.errors[0]).toHaveProperty('field');
        expect(formatted.errors[0]).toHaveProperty('message');
        expect(formatted.errors[0]).toHaveProperty('code');
      }
    });

    it('should format field paths correctly', () => {
      const TestSchema = z.object({
        user: z.object({
          email: z.string().email('Invalid email')
        })
      });

      try {
        TestSchema.parse({ user: { email: 'invalid' } });
      } catch (error) {
        const formatted = formatZodErrors(error);

        expect(formatted.errors[0].field).toBe('user.email');
      }
    });
  });

  describe('validateBody middleware', () => {
    it('should pass validation and attach validatedBody to request', () => {
      const TestSchema = z.object({
        username: z.string(),
        password: z.string()
      });

      const req = {
        body: { username: 'testuser', password: 'pass123' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const middleware = validateBody(TestSchema);
      middleware(req, res, next);

      expect(req.validatedBody).toEqual({
        username: 'testuser',
        password: 'pass123'
      });
      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 400 on validation failure', () => {
      const TestSchema = z.object({
        email: z.string().email()
      });

      const req = {
        body: { email: 'invalid-email' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const middleware = validateBody(TestSchema);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Validation failed',
          errors: expect.any(Array)
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should log validation failures', () => {
      const TestSchema = z.object({
        age: z.number()
      });

      const req = {
        body: { age: 'not-a-number' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const middleware = validateBody(TestSchema);
      middleware(req, res, next);

      expect(logger.warn).toHaveBeenCalledWith(
        'Zod body validation failed',
        expect.objectContaining({
          errors: expect.any(Array),
          body: req.body
        })
      );
    });

    it('should pass unexpected errors to next', () => {
      const req = {
        body: { test: 'data' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      // Create middleware with invalid schema to trigger unexpected error
      const badSchema = {
        parse: () => {
          const error = new Error('Unexpected error');
          error.name = 'UnexpectedError'; // Not ZodError
          throw error;
        }
      };

      const middleware = validateBody(badSchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('validateQuery middleware', () => {
    it('should pass validation and attach validatedQuery to request', () => {
      const TestSchema = z.object({
        page: z.string().regex(/^\d+$/).transform(Number),
        limit: z.string().regex(/^\d+$/).transform(Number).optional()
      });

      const req = {
        query: { page: '1', limit: '10' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const middleware = validateQuery(TestSchema);
      middleware(req, res, next);

      expect(req.validatedQuery).toEqual({
        page: 1,
        limit: 10
      });
      expect(next).toHaveBeenCalledWith();
    });

    it('should return 400 on query validation failure', () => {
      const TestSchema = z.object({
        sort: z.enum(['asc', 'desc'])
      });

      const req = {
        query: { sort: 'invalid' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const middleware = validateQuery(TestSchema);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errors: expect.any(Array)
        })
      );
    });

    it('should log query validation failures', () => {
      const TestSchema = z.object({
        id: z.string().uuid()
      });

      const req = {
        query: { id: 'not-a-uuid' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const middleware = validateQuery(TestSchema);
      middleware(req, res, next);

      expect(logger.warn).toHaveBeenCalledWith(
        'Query validation failed',
        expect.objectContaining({
          errors: expect.any(Array),
          query: req.query
        })
      );
    });

    it('should pass unexpected errors to next', () => {
      const req = { query: {} };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const badSchema = {
        parse: () => {
          const error = new Error('Unexpected');
          error.name = 'NotZodError';
          throw error;
        }
      };

      const middleware = validateQuery(badSchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('validateParams middleware', () => {
    it('should pass validation and attach validatedParams to request', () => {
      const TestSchema = z.object({
        id: z.string().uuid(),
        action: z.enum(['edit', 'delete'])
      });

      const req = {
        params: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          action: 'edit'
        }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const middleware = validateParams(TestSchema);
      middleware(req, res, next);

      expect(req.validatedParams).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440000',
        action: 'edit'
      });
      expect(next).toHaveBeenCalledWith();
    });

    it('should return 400 on params validation failure', () => {
      const TestSchema = z.object({
        id: z.string().uuid('Invalid UUID format')
      });

      const req = {
        params: { id: 'not-a-uuid' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const middleware = validateParams(TestSchema);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errors: expect.any(Array)
        })
      );
    });

    it('should log params validation failures', () => {
      const TestSchema = z.object({
        platform: z.enum(['twitter', 'youtube'])
      });

      const req = {
        params: { platform: 'invalid' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const middleware = validateParams(TestSchema);
      middleware(req, res, next);

      expect(logger.warn).toHaveBeenCalledWith(
        'Params validation failed',
        expect.objectContaining({
          errors: expect.any(Array),
          params: req.params
        })
      );
    });

    it('should pass unexpected errors to next', () => {
      const req = { params: {} };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const badSchema = {
        parse: () => {
          const error = new Error('Unexpected');
          error.name = 'SomeOtherError';
          throw error;
        }
      };

      const middleware = validateParams(badSchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});

