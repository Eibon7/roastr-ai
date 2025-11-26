/**
 * Zod validation schemas for authentication endpoints
 * Replaces manual validation in src/routes/auth.js (Issue #947)
 *
 * @see https://zod.dev/
 */

const { z } = require('zod');

/**
 * Register endpoint validation schema
 * Validates email format, password strength, and optional name field
 */
const registerSchema = z.object({
  email: z
    .string({
      required_error: 'Email and password are required',
      invalid_type_error: 'Email must be a string'
    })
    .min(1, 'Email and password are required')
    .email('Invalid email format')
    .refine((email) => !email.includes('..'), {
      message: 'Email cannot contain consecutive dots'
    })
    .refine((email) => !email.includes('@@'), {
      message: 'Email cannot contain @@'
    })
    .refine(
      (email) => {
        // Additional email validation to match existing regex
        const emailRegex =
          /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return emailRegex.test(email);
      },
      {
        message: 'Invalid email format'
      }
    ),

  password: z
    .string({
      required_error: 'Email and password are required',
      invalid_type_error: 'Password must be a string'
    })
    .min(1, 'Email and password are required')
    .min(8, 'Password must be at least 8 characters long')
    .refine((password) => !/\s/.test(password), {
      message: 'Password cannot contain spaces'
    })
    .refine((password) => /\d/.test(password), {
      message: 'Password must contain at least one number'
    })
    .refine((password) => /[a-z]/.test(password), {
      message: 'Password must contain at least one lowercase letter'
    })
    .refine(
      (password) => {
        const hasUppercase = /[A-Z]/.test(password);
        const hasSymbol = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
        return hasUppercase || hasSymbol;
      },
      {
        message: 'Password must contain at least one uppercase letter or symbol'
      }
    ),

  name: z.string().optional()
});

/**
 * Login endpoint validation schema
 * Validates email format and non-empty password
 */
const loginSchema = z.object({
  email: z
    .string({
      required_error: 'Email and password are required',
      invalid_type_error: 'Email must be a string'
    })
    .min(1, 'Email and password are required')
    .email('Invalid email format'),

  password: z
    .string({
      required_error: 'Email and password are required',
      invalid_type_error: 'Password must be a string'
    })
    .min(1, 'Email and password are required')
});

/**
 * Format Zod validation errors into user-friendly messages
 * @param {import('zod').ZodError} zodError - Zod validation error object
 * @returns {string} - Formatted error message(s) joined with '. '
 */
const formatZodError = (zodError) => {
  return zodError.errors.map((err) => err.message).join('. ');
};

module.exports = {
  registerSchema,
  loginSchema,
  formatZodError
};
