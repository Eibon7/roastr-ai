/**
 * Unit Tests - Zod Error Formatter
 *
 * Tests error formatting utilities for consistent API responses.
 *
 * @see Issue #942 - Migration to Zod validation
 * @see src/validators/zod/formatZodError.js
 */

const { z } = require('zod');
const {
  formatZodError,
  isZodError,
  getErrorFields,
  getFirstErrorMessage
} = require('../../../src/validators/zod/formatZodError');

describe('Zod Error Formatter - Unit Tests', () => {
  describe('formatZodError', () => {
    it('should format single field error correctly', () => {
      const schema = z.object({
        field1: z.string().min(5, 'Must be at least 5 characters')
      });

      try {
        schema.parse({ field1: 'abc' });
        fail('Should have thrown ZodError');
      } catch (error) {
        const formatted = formatZodError(error);

        expect(formatted).toEqual({
          success: false,
          errors: [
            {
              field: 'field1',
              message: 'Must be at least 5 characters',
              code: 'TOO_SMALL'
            }
          ],
          code: 'VALIDATION_ERROR'
        });
      }
    });

    it('should format multiple field errors correctly', () => {
      const schema = z.object({
        field1: z.string().min(5),
        field2: z.string().max(10)
      });

      try {
        schema.parse({ field1: 'abc', field2: 'a'.repeat(15) });
        fail('Should have thrown ZodError');
      } catch (error) {
        const formatted = formatZodError(error);

        expect(formatted.success).toBe(false);
        expect(formatted.code).toBe('VALIDATION_ERROR');
        expect(formatted.errors).toHaveLength(2);
        expect(formatted.errors[0].field).toBe('field1');
        expect(formatted.errors[1].field).toBe('field2');
      }
    });

    it('should format global error (no specific field)', () => {
      const schema = z.object({}).refine(() => false, {
        message: 'At least one field required',
        path: [] // Empty path = global error
      });

      try {
        schema.parse({});
        fail('Should have thrown ZodError');
      } catch (error) {
        const formatted = formatZodError(error);

        expect(formatted.errors[0].field).toBe('_general');
        expect(formatted.errors[0].type).toBe('global');
        expect(formatted.errors[0].message).toBe('At least one field required');
      }
    });

    it('should handle nested field paths', () => {
      const schema = z.object({
        user: z.object({
          name: z.string().min(1)
        })
      });

      try {
        schema.parse({ user: { name: '' } });
        fail('Should have thrown ZodError');
      } catch (error) {
        const formatted = formatZodError(error);

        expect(formatted.errors[0].field).toBe('user.name');
      }
    });

    it('should throw TypeError if input is not ZodError', () => {
      const regularError = new Error('Regular error');
      expect(() => formatZodError(regularError)).toThrow(TypeError);
      expect(() => formatZodError(regularError)).toThrow(/ZodError instance/);
    });

    it('should uppercase error codes', () => {
      const schema = z.string().max(5);

      try {
        schema.parse('toolong');
        fail('Should have thrown ZodError');
      } catch (error) {
        const formatted = formatZodError(error);
        expect(formatted.errors[0].code).toBe('TOO_BIG');
        expect(formatted.errors[0].code).not.toBe('too_big');
      }
    });

    it('should maintain error message exactly as provided', () => {
      const customMessage = 'Custom error message with special chars: áéíóú';
      const schema = z.string().refine(() => false, { message: customMessage });

      try {
        schema.parse('test');
        fail('Should have thrown ZodError');
      } catch (error) {
        const formatted = formatZodError(error);
        expect(formatted.errors[0].message).toBe(customMessage);
      }
    });
  });

  describe('isZodError', () => {
    it('should return true for ZodError instances', () => {
      const schema = z.string();
      try {
        schema.parse(123);
      } catch (error) {
        expect(isZodError(error)).toBe(true);
      }
    });

    it('should return false for regular errors', () => {
      const regularError = new Error('Regular error');
      expect(isZodError(regularError)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isZodError(null)).toBe(false);
      expect(isZodError(undefined)).toBe(false);
      expect(isZodError('string')).toBe(false);
      expect(isZodError(123)).toBe(false);
      expect(isZodError({})).toBe(false);
    });
  });

  describe('getErrorFields', () => {
    it('should extract field names from single error', () => {
      const schema = z.object({
        field1: z.string().min(5)
      });

      try {
        schema.parse({ field1: 'abc' });
      } catch (error) {
        const fields = getErrorFields(error);
        expect(fields).toEqual(['field1']);
      }
    });

    it('should extract field names from multiple errors', () => {
      const schema = z.object({
        field1: z.string().min(5),
        field2: z.string().max(10),
        field3: z.number()
      });

      try {
        schema.parse({ field1: 'abc', field2: 'a'.repeat(15), field3: 'not-a-number' });
      } catch (error) {
        const fields = getErrorFields(error);
        expect(fields).toHaveLength(3);
        expect(fields).toContain('field1');
        expect(fields).toContain('field2');
        expect(fields).toContain('field3');
      }
    });

    it('should handle nested field paths', () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string().min(1)
          })
        })
      });

      try {
        schema.parse({ user: { profile: { name: '' } } });
      } catch (error) {
        const fields = getErrorFields(error);
        expect(fields).toEqual(['user.profile.name']);
      }
    });

    it('should filter out global errors (no path)', () => {
      const schema = z.object({}).refine(() => false, {
        message: 'Global error',
        path: [] // No specific field
      });

      try {
        schema.parse({});
      } catch (error) {
        const fields = getErrorFields(error);
        expect(fields).toEqual([]);
      }
    });

    it('should return empty array for non-ZodError', () => {
      const regularError = new Error('Regular error');
      expect(getErrorFields(regularError)).toEqual([]);
    });
  });

  describe('getFirstErrorMessage', () => {
    it('should return first error message', () => {
      const schema = z.object({
        field1: z.string().min(5, 'First error'),
        field2: z.string().max(10, 'Second error')
      });

      try {
        schema.parse({ field1: 'abc', field2: 'a'.repeat(15) });
      } catch (error) {
        const message = getFirstErrorMessage(error);
        expect(message).toBe('First error');
      }
    });

    it('should return default message for non-ZodError', () => {
      const regularError = new Error('Regular error');
      const message = getFirstErrorMessage(regularError);
      expect(message).toBe('Validation failed');
    });

    it('should return default message for ZodError with no issues', () => {
      // Create a ZodError manually with no issues (edge case)
      const zodError = new z.ZodError([]);
      const message = getFirstErrorMessage(zodError);
      expect(message).toBe('Validation failed');
    });

    it('should handle custom error messages correctly', () => {
      const customMessage = 'Custom error: Field is required!';
      const schema = z.string().min(1, customMessage);

      try {
        schema.parse('');
      } catch (error) {
        const message = getFirstErrorMessage(error);
        expect(message).toBe(customMessage);
      }
    });
  });

  describe('Integration with createPersonaSchema', () => {
    const { createPersonaSchema } = require('../../../src/validators/zod/persona.schema');

    it('should format persona validation errors correctly', () => {
      try {
        createPersonaSchema.parse({});
        fail('Should have thrown ZodError');
      } catch (error) {
        const formatted = formatZodError(error);

        expect(formatted.success).toBe(false);
        expect(formatted.code).toBe('VALIDATION_ERROR');
        expect(formatted.errors[0].message).toMatch(/at least one/i);
      }
    });

    it('should format persona field length errors correctly', () => {
      try {
        createPersonaSchema.parse({
          lo_que_me_define: 'a'.repeat(301)
        });
        fail('Should have thrown ZodError');
      } catch (error) {
        const formatted = formatZodError(error);

        expect(formatted.errors[0].field).toBe('lo_que_me_define');
        expect(formatted.errors[0].message).toMatch(/300 characters/i);
        expect(formatted.errors[0].code).toBe('TOO_BIG');
      }
    });

    it('should format XSS detection errors correctly', () => {
      try {
        createPersonaSchema.parse({
          lo_que_me_define: '<script>alert(1)</script>'
        });
        fail('Should have thrown ZodError');
      } catch (error) {
        const formatted = formatZodError(error);

        expect(formatted.errors[0].field).toBe('lo_que_me_define');
        expect(formatted.errors[0].message).toMatch(/unsafe content/i);
        expect(formatted.errors[0].code).toBe('CUSTOM');
      }
    });
  });

  describe('Backwards compatibility with express-validator format', () => {
    it('should match express-validator error structure', () => {
      // Expected format from express-validator (Issue #942)
      const expectedFormat = {
        success: false,
        errors: expect.arrayContaining([
          expect.objectContaining({
            field: expect.any(String),
            message: expect.any(String),
            code: expect.any(String)
          })
        ]),
        code: 'VALIDATION_ERROR'
      };

      const schema = z.object({
        field1: z.string().min(5)
      });

      try {
        schema.parse({ field1: 'abc' });
      } catch (error) {
        const formatted = formatZodError(error);
        expect(formatted).toMatchObject(expectedFormat);
      }
    });
  });
});

