/**
 * Zod validation middleware for Express
 * Issue #946 - Centralized validation with improved error messages
 *
 * Provides middleware factory for validating request bodies with Zod schemas
 * Features:
 * - Automatic error formatting for client responses
 * - Detailed field-level error messages
 * - Integration with logging system
 * - Graceful error handling
 */

const { logger } = require('../utils/logger');

/**
 * Create Express middleware for Zod schema validation
 *
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware function
 *
 * @example
 * router.post('/endpoint', validateRequest(mySchema), handler);
 */
function validateRequest(schema) {
  return (req, res, next) => {
    try {
      // Parse and validate request body with Zod
      // This applies transformations (trim, defaults) and validates types/constraints
      const parsed = schema.parse(req.body);

      // Replace req.body with validated and transformed data
      // Ensures downstream handlers receive clean, validated data with defaults applied
      req.body = parsed;

      next();
    } catch (error) {
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        // Format Zod errors into client-friendly structure
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        logger.warn('Zod validation failed', {
          errors: formattedErrors,
          endpoint: req.path,
          method: req.method,
          userId: req.user?.id
        });

        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: formattedErrors,
          timestamp: new Date().toISOString()
        });
      }

      // Handle unexpected validation errors
      logger.error('Unexpected validation error', {
        error: error.message,
        stack: error.stack,
        endpoint: req.path,
        method: req.method,
        userId: req.user?.id
      });

      return res.status(500).json({
        success: false,
        error: 'Validation error',
        timestamp: new Date().toISOString()
      });
    }
  };
}

module.exports = { validateRequest };
