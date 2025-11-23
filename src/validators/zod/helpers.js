/**
 * Zod Validation Helpers
 * Issue #943: Helper para formatear errores Zod
 *
 * Provides consistent error formatting for Zod validation errors
 */

const { logger } = require('../../utils/logger');

/**
 * Format Zod validation error into user-friendly message
 * @param {import('zod').ZodError} zodError - Zod validation error
 * @returns {string} Formatted error message
 */
function formatZodError(zodError) {
  // Get first error (most relevant)
  const firstError = zodError.errors[0];

  if (!firstError) {
    return 'Validation error occurred';
  }

  // Format path for nested fields
  const path = firstError.path.length > 0 ? `${firstError.path.join('.')}: ` : '';

  // Return formatted message
  return `${path}${firstError.message}`;
}

/**
 * Format Zod validation error into detailed JSON response
 * @param {import('zod').ZodError} zodError - Zod validation error
 * @returns {Object} Detailed error object
 */
function formatZodErrorDetailed(zodError) {
  return {
    error: 'Validation failed',
    details: zodError.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }))
  };
}

/**
 * Validate request body with Zod schema (middleware-style helper)
 * @param {import('zod').ZodSchema} schema - Zod schema
 * @param {Object} data - Data to validate
 * @returns {Object} { success: boolean, data?: any, error?: string }
 */
function validateWithZod(schema, data) {
  try {
    const validation = schema.safeParse(data);

    if (!validation.success) {
      const errorMessage = formatZodError(validation.error);
      logger.warn('Zod validation failed:', errorMessage);

      return {
        success: false,
        error: errorMessage,
        zodError: validation.error // Include for debugging
      };
    }

    return {
      success: true,
      data: validation.data
    };
  } catch (error) {
    logger.error('Error during Zod validation:', error);
    return {
      success: false,
      error: 'Internal validation error'
    };
  }
}

/**
 * Create Express middleware for Zod validation
 * @param {import('zod').ZodSchema} schema - Zod schema
 * @returns {Function} Express middleware
 */
function zodValidationMiddleware(schema) {
  return (req, res, next) => {
    const validation = validateWithZod(schema, req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    // Attach validated data to req.validatedBody
    req.validatedBody = validation.data;
    next();
  };
}

module.exports = {
  formatZodError,
  formatZodErrorDetailed,
  validateWithZod,
  zodValidationMiddleware
};
