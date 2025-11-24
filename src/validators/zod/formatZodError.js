/**
 * Zod Error Formatter
 *
 * Converts Zod validation errors to consistent API response format.
 * Maintains compatibility with existing express-validator error format.
 *
 * @see Issue #942 - Zod migration for persona endpoints
 * @see Issue #944 - Zod migration for toggle endpoints
 * @see docs/plan/issue-942.md for error format specification
 */

const { z } = require('zod');

/**
 * Format Zod validation error to API-consistent format
 *
 * Transforms Zod's error structure to match the format used by express-validator,
 * ensuring no breaking changes for frontend consumers.
 *
 * @param {z.ZodError} zodError - Zod validation error object
 * @returns {Object} Formatted error response
 *
 * @example
 * // Zod error input
 * const zodError = {
 *   issues: [
 *     {
 *       code: 'too_big',
 *       maximum: 300,
 *       path: ['lo_que_me_define'],
 *       message: 'Field must be 300 characters or less'
 *     }
 *   ]
 * };
 *
 * // Output (consistent with express-validator format)
 * {
 *   success: false,
 *   errors: [
 *     {
 *       field: 'lo_que_me_define',
 *       message: 'Field must be 300 characters or less',
 *       code: 'TOO_BIG'
 *     }
 *   ],
 *   code: 'VALIDATION_ERROR'
 * }
 */
function formatZodError(zodError) {
  // Validate input is a ZodError
  if (!(zodError instanceof z.ZodError)) {
    throw new TypeError('formatZodError expects a ZodError instance');
  }

  return {
    success: false,
    errors: zodError.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join('.') : '_general',
      message: issue.message,
      code: issue.code.toUpperCase(),
      ...(issue.path.length === 0 && { type: 'global' }) // Mark global errors
    })),
    code: 'VALIDATION_ERROR'
  };
}

/**
 * Check if error is a Zod validation error
 *
 * Type guard for identifying Zod errors in error handlers.
 *
 * @param {*} error - Error object to check
 * @returns {boolean} True if error is ZodError
 *
 * @example
 * try {
 *   schema.parse(data);
 * } catch (error) {
 *   if (isZodError(error)) {
 *     return res.status(400).json(formatZodError(error));
 *   }
 *   // Handle other errors
 * }
 */
function isZodError(error) {
  return error instanceof z.ZodError;
}

/**
 * Extract field names from Zod error
 *
 * Useful for logging or analytics.
 *
 * @param {z.ZodError} zodError - Zod validation error
 * @returns {string[]} Array of field names with errors
 *
 * @example
 * const fields = getErrorFields(zodError);
 * // ['lo_que_me_define', 'lo_que_no_tolero']
 */
function getErrorFields(zodError) {
  if (!(zodError instanceof z.ZodError)) {
    return [];
  }

  return zodError.issues
    .map((issue) => (issue.path.length > 0 ? issue.path.join('.') : null))
    .filter(Boolean);
}

/**
 * Get first error message (for simple error display)
 *
 * Returns the first validation error message, useful for UIs that
 * only display one error at a time.
 *
 * @param {z.ZodError} zodError - Zod validation error
 * @returns {string} First error message
 *
 * @example
 * const message = getFirstErrorMessage(zodError);
 * // "Field must be 300 characters or less"
 */
function getFirstErrorMessage(zodError) {
  if (!(zodError instanceof z.ZodError) || zodError.issues.length === 0) {
    return 'Validation failed';
  }

  return zodError.issues[0].message;
}

/**
 * Safe wrapper for Zod parsing with automatic error formatting
 *
 * Issue #944: Helper function for toggle endpoints
 *
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @param {any} data - Data to validate
 * @returns {{success: boolean, data?: any, error?: Object}} Result object
 *
 * @example
 * const result = safeParse(roastingToggleSchema, req.body);
 *
 * if (!result.success) {
 *   return res.status(400).json(result.error);
 * }
 *
 * // Use validated data
 * const { enabled, organization_id } = result.data;
 */
function safeParse(schema, data) {
  const result = schema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      error: formatZodError(result.error)
    };
  }

  return {
    success: true,
    data: result.data
  };
}

module.exports = {
  formatZodError,
  isZodError,
  getErrorFields,
  getFirstErrorMessage,
  safeParse
};
