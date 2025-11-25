const { logger } = require('../../utils/logger');

/**
 * Format Zod validation errors for API responses
 *
 * Converts Zod error format to a structured API-friendly format
 * compatible with express-validator error structure.
 *
 * @param {import('zod').ZodError} zodError - Zod validation error
 * @returns {Object} Formatted error response
 *
 * @example
 * // Input: ZodError with errors array
 * // Output: { success: false, errors: [...], message: 'Validation failed' }
 */
function formatZodErrors(zodError) {
  const errors = zodError.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code
  }));

  return {
    success: false,
    errors,
    message: 'Validation failed'
  };
}

/**
 * Express middleware to validate request body with Zod schema
 *
 * Validates req.body against provided Zod schema.
 * On success, attaches validated data to req.validatedBody.
 * On failure, returns 400 with formatted errors.
 *
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware function
 *
 * @example
 * const { validateBody } = require('./validators/zod/errorFormatter');
 * const { OAuthConnectionSchema } = require('./validators/zod/social.schema');
 *
 * router.post('/connect',
 *   validateBody(OAuthConnectionSchema),
 *   async (req, res) => {
 *     const { code, state } = req.validatedBody; // Validated data
 *     // Handle connection...
 *   }
 * );
 */
function validateBody(schema) {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.body);
      req.validatedBody = validated; // Attach validated data to request
      next();
    } catch (error) {
      if (error.name === 'ZodError') {
        logger.warn('Zod body validation failed', {
          errors: error.errors,
          body: req.body
        });
        return res.status(400).json(formatZodErrors(error));
      }
      // Pass unexpected errors to error handler
      next(error);
    }
  };
}

/**
 * Express middleware to validate request query params with Zod schema
 *
 * Validates req.query against provided Zod schema.
 * On success, attaches validated data to req.validatedQuery.
 * On failure, returns 400 with formatted errors.
 *
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware function
 *
 * @example
 * const { validateQuery } = require('./validators/zod/errorFormatter');
 * const { z } = require('zod');
 *
 * const PaginationSchema = z.object({
 *   page: z.string().regex(/^\d+$/).transform(Number).optional(),
 *   limit: z.string().regex(/^\d+$/).transform(Number).optional()
 * });
 *
 * router.get('/posts',
 *   validateQuery(PaginationSchema),
 *   async (req, res) => {
 *     const { page, limit } = req.validatedQuery; // Validated query params
 *     // Handle request...
 *   }
 * );
 */
function validateQuery(schema) {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.query);
      req.validatedQuery = validated; // Attach validated query to request
      next();
    } catch (error) {
      if (error.name === 'ZodError') {
        logger.warn('Query validation failed', {
          errors: error.errors,
          query: req.query
        });
        return res.status(400).json(formatZodErrors(error));
      }
      // Pass unexpected errors to error handler
      next(error);
    }
  };
}

/**
 * Express middleware to validate request params with Zod schema
 *
 * Validates req.params against provided Zod schema.
 * On success, attaches validated data to req.validatedParams.
 * On failure, returns 400 with formatted errors.
 *
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware function
 *
 * @example
 * const { validateParams } = require('./validators/zod/errorFormatter');
 * const { z } = require('zod');
 *
 * const IdParamSchema = z.object({
 *   id: z.string().uuid('Invalid UUID format')
 * });
 *
 * router.get('/posts/:id',
 *   validateParams(IdParamSchema),
 *   async (req, res) => {
 *     const { id } = req.validatedParams; // Validated UUID
 *     // Handle request...
 *   }
 * );
 */
function validateParams(schema) {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.params);
      req.validatedParams = validated; // Attach validated params to request
      next();
    } catch (error) {
      if (error.name === 'ZodError') {
        logger.warn('Params validation failed', {
          errors: error.errors,
          params: req.params
        });
        return res.status(400).json(formatZodErrors(error));
      }
      // Pass unexpected errors to error handler
      next(error);
    }
  };
}

module.exports = {
  formatZodErrors,
  validateBody,
  validateQuery,
  validateParams
};
