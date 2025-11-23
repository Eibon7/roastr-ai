/**
 * Unit Tests - Persona Zod Schema
 *
 * Tests validation logic for persona endpoints.
 * Covers happy path, error cases, and edge cases.
 *
 * @see Issue #942 - Migration to Zod validation
 * @see src/validators/zod/persona.schema.js
 */

const { z } = require('zod');
const {
  personaFieldSchema,
  createPersonaSchema,
  updatePersonaSchema,
  strictPersonaSchema
} = require('../../../src/validators/zod/persona.schema');

describe('Persona Zod Schema - Unit Tests', () => {
  describe('personaFieldSchema (base field validation)', () => {
    it('should validate valid string input', () => {
      const input = 'Soy developer sarcástico';
      expect(() => personaFieldSchema.parse(input)).not.toThrow();
    });

    it('should trim whitespace from input', () => {
      const input = '  Soy developer sarcástico  ';
      const result = personaFieldSchema.parse(input);
      expect(result).toBe('Soy developer sarcástico');
    });

    it('should accept exactly 300 characters', () => {
      const input = 'a'.repeat(300);
      expect(() => personaFieldSchema.parse(input)).not.toThrow();
    });

    it('should reject empty string after trim', () => {
      const input = '   ';
      expect(() => personaFieldSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should reject string exceeding 300 characters', () => {
      const input = 'a'.repeat(301);
      expect(() => personaFieldSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should reject non-string input', () => {
      expect(() => personaFieldSchema.parse(123)).toThrow(z.ZodError);
      expect(() => personaFieldSchema.parse(null)).toThrow(z.ZodError);
      expect(() => personaFieldSchema.parse(undefined)).toThrow(z.ZodError);
      expect(() => personaFieldSchema.parse([])).toThrow(z.ZodError);
      expect(() => personaFieldSchema.parse({})).toThrow(z.ZodError);
    });

    describe('XSS detection (DOMPurify-based)', () => {
      it('should reject <script> tags', () => {
        const input = 'Hola <script>alert(1)</script>';
        expect(() => personaFieldSchema.parse(input)).toThrow(z.ZodError);
        expect(() => personaFieldSchema.parse(input)).toThrow(/unsafe content/i);
      });

      it('should reject HTML tags with event handlers', () => {
        const input = '<img src=x onerror=alert(1)>';
        expect(() => personaFieldSchema.parse(input)).toThrow(z.ZodError);
        expect(() => personaFieldSchema.parse(input)).toThrow(/unsafe content/i);
      });

      it('should reject anchor tags with javascript: protocol', () => {
        const input = 'Click <a href="javascript:void(0)">here</a>';
        expect(() => personaFieldSchema.parse(input)).toThrow(z.ZodError);
        expect(() => personaFieldSchema.parse(input)).toThrow(/unsafe content/i);
      });

      it('should reject case-insensitive HTML tags', () => {
        expect(() => personaFieldSchema.parse('<SCRIPT>alert(1)</SCRIPT>')).toThrow();
        expect(() => personaFieldSchema.parse('<IMG src=x ONERROR=alert(1)>')).toThrow();
        expect(() => personaFieldSchema.parse('<svg onload=alert(1)>')).toThrow();
      });

      it('should accept plain text XSS patterns (safe outside HTML context)', () => {
        // These are only dangerous when used in HTML attributes/URIs
        // As plain text in encrypted persona data (used for prompts), they are safe
        expect(() => personaFieldSchema.parse('JAVASCRIPT:alert(1)')).not.toThrow();
        expect(() => personaFieldSchema.parse('OnErRoR=alert(1)')).not.toThrow();
        expect(() => personaFieldSchema.parse('onclick=alert(1)')).not.toThrow();
      });

      it('should reject iframe and embed tags', () => {
        expect(() => personaFieldSchema.parse('<iframe src="evil.com"></iframe>')).toThrow();
        expect(() => personaFieldSchema.parse('<embed src="evil.swf">')).toThrow();
      });
    });

    describe('Edge cases', () => {
      it('should accept unicode characters', () => {
        const input = 'Soy developer 🚀 español';
        expect(() => personaFieldSchema.parse(input)).not.toThrow();
      });

      it('should accept special characters (non-XSS)', () => {
        const input = 'Humor: sarcástico, irónico & mordaz';
        expect(() => personaFieldSchema.parse(input)).not.toThrow();
      });

      it('should accept newlines and multiline text', () => {
        const input = 'Línea 1\nLínea 2\nLínea 3';
        expect(() => personaFieldSchema.parse(input)).not.toThrow();
      });
    });
  });

  describe('createPersonaSchema (POST /api/persona)', () => {
    it('should validate with one field provided', () => {
      const input = { lo_que_me_define: 'Soy developer' };
      expect(() => createPersonaSchema.parse(input)).not.toThrow();
    });

    it('should validate with two fields provided', () => {
      const input = {
        lo_que_me_define: 'Soy developer',
        lo_que_no_tolero: 'Body shaming'
      };
      expect(() => createPersonaSchema.parse(input)).not.toThrow();
    });

    it('should validate with all three fields provided', () => {
      const input = {
        lo_que_me_define: 'Soy developer sarcástico',
        lo_que_no_tolero: 'Body shaming, racismo',
        lo_que_me_da_igual: 'Humor negro, palabrotas'
      };
      expect(() => createPersonaSchema.parse(input)).not.toThrow();
    });

    it('should reject when no fields provided', () => {
      const input = {};
      expect(() => createPersonaSchema.parse(input)).toThrow(z.ZodError);
      expect(() => createPersonaSchema.parse(input)).toThrow(/at least one/i);
    });

    it('should reject when all fields are empty strings', () => {
      const input = {
        lo_que_me_define: '   ',
        lo_que_no_tolero: '  ',
        lo_que_me_da_igual: ''
      };
      expect(() => createPersonaSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should allow optional fields to be omitted', () => {
      const input = { lo_que_me_define: 'Test' };
      const result = createPersonaSchema.parse(input);
      expect(result.lo_que_no_tolero).toBeUndefined();
      expect(result.lo_que_me_da_igual).toBeUndefined();
    });

    it('should trim all fields automatically', () => {
      const input = {
        lo_que_me_define: '  Soy developer  ',
        lo_que_no_tolero: '  Body shaming  ',
        lo_que_me_da_igual: '  Humor negro  '
      };
      const result = createPersonaSchema.parse(input);
      expect(result.lo_que_me_define).toBe('Soy developer');
      expect(result.lo_que_no_tolero).toBe('Body shaming');
      expect(result.lo_que_me_da_igual).toBe('Humor negro');
    });

    describe('Validation error details', () => {
      it('should provide detailed error for character limit', () => {
        const input = { lo_que_me_define: 'a'.repeat(301) };
        try {
          createPersonaSchema.parse(input);
          fail('Should have thrown ZodError');
        } catch (error) {
          expect(error).toBeInstanceOf(z.ZodError);
          expect(error.issues[0].message).toMatch(/300 characters/i);
          expect(error.issues[0].path).toContain('lo_que_me_define');
        }
      });

      it('should provide detailed error for XSS detection', () => {
        const input = { lo_que_me_define: '<script>alert(1)</script>' };
        try {
          createPersonaSchema.parse(input);
          fail('Should have thrown ZodError');
        } catch (error) {
          expect(error).toBeInstanceOf(z.ZodError);
          expect(error.issues[0].message).toMatch(/unsafe content/i);
          expect(error.issues[0].path).toContain('lo_que_me_define');
        }
      });

      it('should provide error for missing all fields', () => {
        const input = {};
        try {
          createPersonaSchema.parse(input);
          fail('Should have thrown ZodError');
        } catch (error) {
          expect(error).toBeInstanceOf(z.ZodError);
          expect(error.issues[0].message).toMatch(/at least one/i);
          expect(error.issues[0].path).toContain('_general');
        }
      });
    });
  });

  describe('updatePersonaSchema (PATCH /api/persona)', () => {
    it('should validate partial updates', () => {
      const input = { lo_que_me_define: 'Updated identity' };
      expect(() => updatePersonaSchema.parse(input)).not.toThrow();
    });

    it('should allow updating single field', () => {
      const input = { lo_que_no_tolero: 'Updated intolerance' };
      expect(() => updatePersonaSchema.parse(input)).not.toThrow();
    });

    it('should reject empty partial update', () => {
      const input = {};
      expect(() => updatePersonaSchema.parse(input)).toThrow(z.ZodError);
    });
  });

  describe('strictPersonaSchema (strict mode)', () => {
    it('should reject unknown properties', () => {
      const input = {
        lo_que_me_define: 'Test',
        unknown_field: 'Should not be here'
      };
      expect(() => strictPersonaSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should accept valid input without unknown properties', () => {
      const input = {
        lo_que_me_define: 'Test',
        lo_que_no_tolero: 'Test 2'
      };
      expect(() => strictPersonaSchema.parse(input)).not.toThrow();
    });
  });

  describe('Performance and security', () => {
    it('should handle very long input efficiently', () => {
      const input = { lo_que_me_define: 'a'.repeat(299) };
      const start = Date.now();
      createPersonaSchema.parse(input);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(50); // Should be very fast (<50ms)
    });

    it('should not expose internal error details', () => {
      const input = { lo_que_me_define: 123 }; // Wrong type
      try {
        createPersonaSchema.parse(input);
        fail('Should have thrown ZodError');
      } catch (error) {
        expect(error).toBeInstanceOf(z.ZodError);
        // Error message should be generic, not exposing internals
        expect(error.issues[0].message).not.toMatch(/internal|stack|trace/i);
      }
    });
  });
});

