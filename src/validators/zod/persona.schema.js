/**
 * Persona Zod Validation Schemas
 *
 * Validates user persona data for endpoints:
 * - POST /api/persona - Create/update persona fields
 * - PATCH /api/persona - Partial update
 *
 * Security validations:
 * - XSS protection via DOMPurify sanitization (OWASP-recommended)
 * - Character limits (300 chars per field)
 * - String type enforcement
 * - Trim whitespace
 *
 * @see Issue #942 - Migration from express-validator to Zod
 * @see docs/nodes/persona.md for field specifications
 * @see PR #969 Review - Upgraded from regex to DOMPurify for comprehensive XSS protection
 */

const { z } = require('zod');
const DOMPurify = require('isomorphic-dompurify');

/**
 * Base schema for a single persona field
 *
 * Validations:
 * - Must be string
 * - Trim whitespace automatically
 * - Min 1 character (if provided)
 * - Max 300 characters
 * - XSS protection via DOMPurify (OWASP-recommended, parser-based)
 *
 * Security: DOMPurify provides comprehensive XSS protection covering:
 * - Script tags, event handlers (onclick, onload, onerror, etc.)
 * - JavaScript URIs (javascript:, data:, vbscript:)
 * - SVG/MathML injection vectors
 * - Malformed HTML that browsers might parse dangerously
 *
 * @type {z.ZodString}
 */
const personaFieldSchema = z
  .string({ required_error: 'Field must be a string' })
  .trim()
  .min(1, { message: 'Field cannot be empty' })
  .max(300, { message: 'Field must be 300 characters or less' })
  .refine(
    (val) => {
      // Use DOMPurify to sanitize the input
      // If sanitized output differs from original, it contained XSS
      const sanitized = DOMPurify.sanitize(val, {
        ALLOWED_TAGS: [], // Strip all HTML tags
        ALLOWED_ATTR: [], // Strip all attributes
        KEEP_CONTENT: true // Keep text content
      });

      // If sanitization changed the content, it contained unsafe patterns
      return sanitized === val;
    },
    {
      message:
        'Field contains potentially unsafe content (XSS detected). HTML tags and attributes are not allowed.'
    }
  );

/**
 * Schema for POST /api/persona
 *
 * Allows creation or update of persona fields.
 * At least one field must be provided.
 *
 * Fields:
 * - lo_que_me_define (identity) - Optional
 * - lo_que_no_tolero (intolerance/blocking) - Optional
 * - lo_que_me_da_igual (tolerance/allowlist) - Optional
 *
 * @type {z.ZodObject}
 * @example
 * // Valid input
 * {
 *   lo_que_me_define: "Soy developer sarcástico",
 *   lo_que_no_tolero: "Body shaming"
 * }
 *
 * // Invalid - no fields provided
 * {}
 *
 * // Invalid - empty field
 * { lo_que_me_define: "   " }
 */
const createPersonaSchema = z
  .object({
    lo_que_me_define: personaFieldSchema.optional(),
    lo_que_no_tolero: personaFieldSchema.optional(),
    lo_que_me_da_igual: personaFieldSchema.optional()
  })
  .refine((data) => data.lo_que_me_define || data.lo_que_no_tolero || data.lo_que_me_da_igual, {
    message: 'At least one persona field must be provided',
    path: ['_general'] // Custom path for global validation error
  });

/**
 * Schema for PATCH /api/persona (partial update)
 *
 * Same as createPersonaSchema but explicitly allows partial updates.
 * All fields optional, but at least one required.
 *
 * @type {z.ZodObject}
 * @example
 * // Valid - update only one field
 * { lo_que_me_define: "New identity text" }
 */
const updatePersonaSchema = createPersonaSchema; // Identical for now

/**
 * Strict schema for testing purposes
 *
 * Used in unit tests to verify edge cases.
 * Same as createPersonaSchema but with stricter refine.
 *
 * @type {z.ZodObject}
 */
const strictPersonaSchema = z
  .object({
    lo_que_me_define: personaFieldSchema.optional(),
    lo_que_no_tolero: personaFieldSchema.optional(),
    lo_que_me_da_igual: personaFieldSchema.optional()
  })
  .strict() // Reject unknown properties
  .refine((data) => data.lo_que_me_define || data.lo_que_no_tolero || data.lo_que_me_da_igual, {
    message: 'At least one persona field must be provided',
    path: ['_general']
  });

module.exports = {
  personaFieldSchema,
  createPersonaSchema,
  updatePersonaSchema,
  strictPersonaSchema
};
