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
  email: z.string({
      required_error: 'Email es requerido',
      invalid_type_error: 'Email debe ser texto'
    })
    .min(1, 'Email es requerido')
    .email('Formato de email inválido')
    .refine((email) => !email.includes('..'), {
      message: 'El email no puede contener puntos consecutivos'
    })
    .refine((email) => !email.includes('@@'), {
      message: 'El email no puede contener @@'
    })
    .refine((email) => {
      // Additional email validation to match existing regex
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      return emailRegex.test(email);
    }, {
      message: 'Formato de email inválido'
    }),
  
  password: z.string({
      required_error: 'La contraseña es requerida',
      invalid_type_error: 'La contraseña debe ser texto'
    })
    .min(1, 'La contraseña es requerida')
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .refine((password) => !/\s/.test(password), {
      message: 'La contraseña no puede contener espacios'
    })
    .refine((password) => /\d/.test(password), {
      message: 'La contraseña debe contener al menos un número'
    })
    .refine((password) => /[a-z]/.test(password), {
      message: 'La contraseña debe contener al menos una letra minúscula'
    })
    .refine((password) => {
      const hasUppercase = /[A-Z]/.test(password);
      const hasSymbol = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
      return hasUppercase || hasSymbol;
    }, {
      message: 'La contraseña debe contener al menos una letra mayúscula o un símbolo'
    }),
  
  name: z.string().optional()
});

/**
 * Login endpoint validation schema
 * Validates email format and non-empty password
 */
const loginSchema = z.object({
  email: z.string({
      required_error: 'Email es requerido',
      invalid_type_error: 'Email debe ser texto'
    })
    .min(1, 'Email es requerido')
    .email('Formato de email inválido'),
  
  password: z.string({
      required_error: 'La contraseña es requerida',
      invalid_type_error: 'La contraseña debe ser texto'
    })
    .min(1, 'La contraseña es requerida')
});

/**
 * Format Zod validation errors into user-friendly messages
 * @param {import('zod').ZodError} zodError - Zod validation error object
 * @returns {string} - Formatted error message(s) joined with '. '
 */
const formatZodError = (zodError) => {
  return zodError.errors.map(err => err.message).join('. ');
};

module.exports = {
  registerSchema,
  loginSchema,
  formatZodError
};

