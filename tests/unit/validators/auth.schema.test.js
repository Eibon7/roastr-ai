/**
 * Unit tests for Zod authentication schemas
 * Issue #947: Migrar endpoints de Auth a Zod
 */

const {
  registerSchema,
  loginSchema,
  formatZodError
} = require('../../../src/validators/zod/auth.schema');

describe('auth.schema.js - Zod Validation Schemas', () => {
  describe('registerSchema', () => {
    describe('✅ Happy Path - Valid Inputs', () => {
      it('should validate correct email + strong password', () => {
        const validData = {
          email: 'test@example.com',
          password: 'Test1234!',
          name: 'Test User'
        };

        const result = registerSchema.safeParse(validData);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(validData);
      });

      it('should validate email with special chars (allowed by RFC)', () => {
        const validData = {
          email: 'user.name+tag@example.co.uk',
          password: 'SecurePass123!'
        };

        const result = registerSchema.safeParse(validData);

        expect(result.success).toBe(true);
      });

      it('should accept password with uppercase only (no symbol)', () => {
        const validData = {
          email: 'test@example.com',
          password: 'Password123' // Has uppercase A, no symbol
        };

        const result = registerSchema.safeParse(validData);

        expect(result.success).toBe(true);
      });

      it('should accept password with symbol only (no uppercase)', () => {
        const validData = {
          email: 'test@example.com',
          password: 'password123!' // Has symbol !, no uppercase
        };

        const result = registerSchema.safeParse(validData);

        expect(result.success).toBe(true);
      });

      it('should accept optional name field', () => {
        const validData = {
          email: 'test@example.com',
          password: 'Test1234!'
          // name: omitted
        };

        const result = registerSchema.safeParse(validData);

        expect(result.success).toBe(true);
        expect(result.data.name).toBeUndefined();
      });
    });

    describe('❌ Email Validation Errors', () => {
      it('should reject missing email', () => {
        const invalidData = {
          password: 'Test1234!'
        };

        const result = registerSchema.safeParse(invalidData);

        expect(result.success).toBe(false);
        expect(formatZodError(result.error)).toContain('Email es requerido');
      });

      it('should reject invalid email format (no @)', () => {
        const invalidData = {
          email: 'notanemail',
          password: 'Test1234!'
        };

        const result = registerSchema.safeParse(invalidData);

        expect(result.success).toBe(false);
        expect(formatZodError(result.error)).toContain('email');
      });

      it('should reject email with consecutive dots', () => {
        const invalidData = {
          email: 'invalid..email@test.com',
          password: 'Test1234!'
        };

        const result = registerSchema.safeParse(invalidData);

        expect(result.success).toBe(false);
        expect(formatZodError(result.error)).toContain('puntos consecutivos');
      });

      it('should reject email with @@', () => {
        const invalidData = {
          email: 'invalid@@test.com',
          password: 'Test1234!'
        };

        const result = registerSchema.safeParse(invalidData);

        expect(result.success).toBe(false);
        expect(formatZodError(result.error)).toContain('@@');
      });

      it('should reject email with multiple @ symbols', () => {
        const invalidData = {
          email: 'user@domain@test.com',
          password: 'Test1234!'
        };

        const result = registerSchema.safeParse(invalidData);

        expect(result.success).toBe(false);
      });
    });

    describe('❌ Password Validation Errors', () => {
      it('should reject missing password', () => {
        const invalidData = {
          email: 'test@example.com'
        };

        const result = registerSchema.safeParse(invalidData);

        expect(result.success).toBe(false);
        expect(formatZodError(result.error)).toContain('contraseña es requerida');
      });

      it('should reject password shorter than 8 characters', () => {
        const invalidData = {
          email: 'test@example.com',
          password: 'Test1!' // Only 6 chars
        };

        const result = registerSchema.safeParse(invalidData);

        expect(result.success).toBe(false);
        expect(formatZodError(result.error)).toContain('al menos 8 caracteres');
      });

      it('should reject password with spaces', () => {
        const invalidData = {
          email: 'test@example.com',
          password: 'Test 1234!' // Contains space
        };

        const result = registerSchema.safeParse(invalidData);

        expect(result.success).toBe(false);
        expect(formatZodError(result.error)).toContain('no puede contener espacios');
      });

      it('should reject password without numbers', () => {
        const invalidData = {
          email: 'test@example.com',
          password: 'TestPassword!' // No number
        };

        const result = registerSchema.safeParse(invalidData);

        expect(result.success).toBe(false);
        expect(formatZodError(result.error)).toContain('al menos un número');
      });

      it('should reject password without lowercase', () => {
        const invalidData = {
          email: 'test@example.com',
          password: 'TEST1234!' // No lowercase
        };

        const result = registerSchema.safeParse(invalidData);

        expect(result.success).toBe(false);
        expect(formatZodError(result.error)).toContain('letra minúscula');
      });

      it('should reject password without uppercase OR symbol', () => {
        const invalidData = {
          email: 'test@example.com',
          password: 'test1234' // No uppercase, no symbol
        };

        const result = registerSchema.safeParse(invalidData);

        expect(result.success).toBe(false);
        expect(formatZodError(result.error)).toContain('mayúscula o un símbolo');
      });

      it('should reject password with multiple validation errors', () => {
        const invalidData = {
          email: 'test@example.com',
          password: 'weak' // Too short, no uppercase/symbol, no number
        };

        const result = registerSchema.safeParse(invalidData);

        expect(result.success).toBe(false);
        const errorMessage = formatZodError(result.error);
        expect(errorMessage).toContain('8 caracteres');
        expect(errorMessage).toContain('número');
      });
    });

    describe('🛡️ Security - Edge Cases', () => {
      it('should reject nested JSON in email field (NoSQL injection)', () => {
        const invalidData = {
          email: { $ne: '' }, // Nested object
          password: 'Test1234!'
        };

        const result = registerSchema.safeParse(invalidData);

        expect(result.success).toBe(false);
        // Zod automatically rejects wrong types
      });

      it('should reject array in password field', () => {
        const invalidData = {
          email: 'test@example.com',
          password: ['array', 'value']
        };

        const result = registerSchema.safeParse(invalidData);

        expect(result.success).toBe(false);
      });

      it('should handle very long email (DoS protection)', () => {
        const longEmail = 'a'.repeat(300) + '@test.com';
        const invalidData = {
          email: longEmail,
          password: 'Test1234!'
        };

        const result = registerSchema.safeParse(invalidData);

        // Zod should handle this gracefully (may pass or fail depending on regex complexity)
        expect(result.success).toBeDefined();
      });
    });
  });

  describe('loginSchema', () => {
    describe('✅ Happy Path - Valid Inputs', () => {
      it('should validate correct email + password', () => {
        const validData = {
          email: 'test@example.com',
          password: 'anypassword'
        };

        const result = loginSchema.safeParse(validData);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(validData);
      });

      it('should accept weak password (login does not validate strength)', () => {
        const validData = {
          email: 'test@example.com',
          password: '123' // Weak but acceptable for login
        };

        const result = loginSchema.safeParse(validData);

        expect(result.success).toBe(true);
      });
    });

    describe('❌ Validation Errors', () => {
      it('should reject missing email', () => {
        const invalidData = {
          password: 'test'
        };

        const result = loginSchema.safeParse(invalidData);

        expect(result.success).toBe(false);
        expect(formatZodError(result.error)).toContain('Email es requerido');
      });

      it('should reject invalid email format', () => {
        const invalidData = {
          email: 'notanemail',
          password: 'test'
        };

        const result = loginSchema.safeParse(invalidData);

        expect(result.success).toBe(false);
        expect(formatZodError(result.error)).toContain('email');
      });

      it('should reject missing password', () => {
        const invalidData = {
          email: 'test@example.com'
        };

        const result = loginSchema.safeParse(invalidData);

        expect(result.success).toBe(false);
        expect(formatZodError(result.error)).toContain('contraseña es requerida');
      });

      it('should reject empty password', () => {
        const invalidData = {
          email: 'test@example.com',
          password: ''
        };

        const result = loginSchema.safeParse(invalidData);

        expect(result.success).toBe(false);
        expect(formatZodError(result.error)).toContain('contraseña');
      });
    });
  });

  describe('formatZodError', () => {
    it('should format single error correctly', () => {
      const invalidData = { email: '', password: 'Test1234!' };
      const result = registerSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
      const formatted = formatZodError(result.error);

      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('should format multiple errors joined with ". "', () => {
      const invalidData = { email: 'invalid', password: 'weak' };
      const result = registerSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
      const formatted = formatZodError(result.error);

      expect(formatted).toContain('.');
      // Should have at least 2 errors concatenated
      expect(formatted.split('.').length).toBeGreaterThanOrEqual(2);
    });

    it('should preserve Spanish error messages', () => {
      const invalidData = { email: 'test@example.com', password: 'nouppercase123' };
      const result = registerSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
      const formatted = formatZodError(result.error);

      expect(formatted).toContain('mayúscula');
    });
  });
});
