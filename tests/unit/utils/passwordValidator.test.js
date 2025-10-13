/**
 * Tests for passwordValidator.js
 * Validates password security requirements without mocks
 *
 * Target Coverage: 90%+
 * Test Count: 40+ tests
 */

const { validatePassword, getPasswordStrength, PASSWORD_REQUIREMENTS } = require('../../../src/utils/passwordValidator');

describe('passwordValidator - validatePassword', () => {
  describe('Happy Path - Valid Passwords', () => {
    it('should accept password with all requirements met', () => {
      const result = validatePassword('Password123');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept password with uppercase letter', () => {
      const result = validatePassword('Abc12345');

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should accept password with symbol instead of uppercase', () => {
      const result = validatePassword('abc123!@');

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should accept password with multiple symbols', () => {
      const result = validatePassword('abc123!@#$%^');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept very long password', () => {
      const longPassword = 'aB1' + 'x'.repeat(100) + '!';
      const result = validatePassword(longPassword);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Null/Undefined/Empty Cases', () => {
    it('should reject null password', () => {
      const result = validatePassword(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La contraseña es requerida');
      expect(result.errors).toHaveLength(1);
    });

    it('should reject undefined password', () => {
      const result = validatePassword(undefined);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La contraseña es requerida');
    });

    it('should reject empty string password', () => {
      const result = validatePassword('');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La contraseña es requerida');
    });
  });

  describe('Minimum Length Requirement', () => {
    it('should reject password with 7 characters (below minimum)', () => {
      const result = validatePassword('Abc123!');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La contraseña debe tener al menos 8 caracteres');
    });

    it('should accept password with exactly 8 characters (boundary)', () => {
      const result = validatePassword('Abc1234!');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password with 1 character', () => {
      const result = validatePassword('A');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject password with 3 characters', () => {
      const result = validatePassword('Ab1');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La contraseña debe tener al menos 8 caracteres');
    });
  });

  describe('No Spaces Requirement', () => {
    it('should reject password with space at beginning', () => {
      const result = validatePassword(' Password123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La contraseña no puede contener espacios');
    });

    it('should reject password with space in middle', () => {
      const result = validatePassword('Pass word123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La contraseña no puede contener espacios');
    });

    it('should reject password with space at end', () => {
      const result = validatePassword('Password123 ');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La contraseña no puede contener espacios');
    });

    it('should reject password with multiple spaces', () => {
      const result = validatePassword('Pass  word  123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La contraseña no puede contener espacios');
    });

    it('should reject password with tab character', () => {
      const result = validatePassword('Pass\tword123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La contraseña no puede contener espacios');
    });

    it('should reject password with newline', () => {
      const result = validatePassword('Pass\nword123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La contraseña no puede contener espacios');
    });
  });

  describe('Number Requirement', () => {
    it('should reject password without numbers', () => {
      const result = validatePassword('Password!');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La contraseña debe contener al menos un número');
    });

    it('should accept password with number at beginning', () => {
      const result = validatePassword('1Password!');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept password with number at end', () => {
      const result = validatePassword('Password1!');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept password with multiple numbers', () => {
      const result = validatePassword('P1a2s3s4!');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Lowercase Letter Requirement', () => {
    it('should reject password without lowercase letters', () => {
      const result = validatePassword('PASSWORD123!');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La contraseña debe contener al menos una letra minúscula');
    });

    it('should accept password with one lowercase letter', () => {
      const result = validatePassword('PASSWORDa123!');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept password with multiple lowercase letters', () => {
      const result = validatePassword('password123!');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Uppercase or Symbol Requirement', () => {
    it('should reject password without uppercase or symbol', () => {
      const result = validatePassword('password123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La contraseña debe contener al menos una letra mayúscula o un símbolo');
    });

    it('should accept password with uppercase letter', () => {
      const result = validatePassword('Password123');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept password with symbol', () => {
      const result = validatePassword('password123!');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept password with both uppercase and symbol', () => {
      const result = validatePassword('Password123!');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept password with various symbols (@)', () => {
      const result = validatePassword('password123@');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept password with various symbols (#)', () => {
      const result = validatePassword('password123#');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept password with various symbols ($)', () => {
      const result = validatePassword('password123$');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept password with various symbols (%)', () => {
      const result = validatePassword('password123%');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Multiple Validation Errors', () => {
    it('should return all errors for completely invalid password', () => {
      const result = validatePassword('abc');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain('La contraseña debe tener al menos 8 caracteres');
      expect(result.errors).toContain('La contraseña debe contener al menos un número');
      expect(result.errors).toContain('La contraseña debe contener al menos una letra mayúscula o un símbolo');
    });

    it('should return multiple errors for password missing number and uppercase/symbol', () => {
      const result = validatePassword('password');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La contraseña debe contener al menos un número');
      expect(result.errors).toContain('La contraseña debe contener al menos una letra mayúscula o un símbolo');
    });

    it('should return error for short password with space', () => {
      const result = validatePassword('Abc 12!');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La contraseña debe tener al menos 8 caracteres');
      expect(result.errors).toContain('La contraseña no puede contener espacios');
    });
  });

  describe('Edge Cases and Special Characters', () => {
    it('should accept password with underscore', () => {
      const result = validatePassword('password_123');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept password with hyphen', () => {
      const result = validatePassword('password-123');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept password with brackets', () => {
      const result = validatePassword('password[123]');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept password with parentheses', () => {
      const result = validatePassword('password(123)');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept password with dot', () => {
      const result = validatePassword('password.123');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept password with comma', () => {
      const result = validatePassword('password,123');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

describe('passwordValidator - getPasswordStrength', () => {
  describe('Null/Undefined/Empty Cases', () => {
    it('should return 0 for null password', () => {
      expect(getPasswordStrength(null)).toBe(0);
    });

    it('should return 0 for undefined password', () => {
      expect(getPasswordStrength(undefined)).toBe(0);
    });

    it('should return 0 for empty string', () => {
      expect(getPasswordStrength('')).toBe(0);
    });
  });

  describe('Length-based Strength', () => {
    it('should return low strength for password < 8 characters', () => {
      const strength = getPasswordStrength('abc123');
      // Password < 8 chars gets 0 points for length, but may get points for complexity
      expect(strength).toBeGreaterThanOrEqual(0);
      expect(strength).toBeLessThanOrEqual(2);
    });

    it('should increase strength for password >= 8 characters', () => {
      const strength = getPasswordStrength('abcdefgh');
      expect(strength).toBeGreaterThan(0);
    });

    it('should increase strength for password >= 12 characters', () => {
      const strength12 = getPasswordStrength('abcdefghijkl');
      const strength8 = getPasswordStrength('abcdefgh');

      expect(strength12).toBeGreaterThanOrEqual(strength8);
    });
  });

  describe('Complexity-based Strength', () => {
    it('should give higher strength for mixed case', () => {
      const mixedCase = getPasswordStrength('AbCdEfGh');
      const lowerCase = getPasswordStrength('abcdefgh');

      expect(mixedCase).toBeGreaterThan(lowerCase);
    });

    it('should give higher strength when including numbers', () => {
      const withNumbers = getPasswordStrength('abcdefgh123');
      const withoutNumbers = getPasswordStrength('abcdefgh');

      expect(withNumbers).toBeGreaterThan(withoutNumbers);
    });

    it('should give higher strength when including symbols', () => {
      const withSymbols = getPasswordStrength('abcdefgh!@#');
      const withoutSymbols = getPasswordStrength('abcdefgh');

      expect(withSymbols).toBeGreaterThan(withoutSymbols);
    });

    it('should cap strength at 4', () => {
      const veryComplexPassword = 'Aa1!@#$%^&*()_+VeryLongPasswordWithEverything123456789';
      const strength = getPasswordStrength(veryComplexPassword);

      expect(strength).toBeLessThanOrEqual(4);
    });
  });

  describe('Strength Levels', () => {
    it('should return 1-2 for weak password', () => {
      const strength = getPasswordStrength('abcdefgh');

      expect(strength).toBeGreaterThanOrEqual(1);
      expect(strength).toBeLessThanOrEqual(2);
    });

    it('should return 2-3 for medium password', () => {
      const strength = getPasswordStrength('Abcdefgh123');

      expect(strength).toBeGreaterThanOrEqual(2);
      expect(strength).toBeLessThanOrEqual(3);
    });

    it('should return 3-4 for strong password', () => {
      const strength = getPasswordStrength('Abcdefgh123!');

      expect(strength).toBeGreaterThanOrEqual(3);
      expect(strength).toBeLessThanOrEqual(4);
    });

    it('should return 4 for very strong password', () => {
      const strength = getPasswordStrength('Abcdefghijkl123!@#');

      expect(strength).toBe(4);
    });
  });

  describe('Real-world Password Examples', () => {
    it('should evaluate common weak password', () => {
      expect(getPasswordStrength('password')).toBeLessThanOrEqual(1);
    });

    it('should evaluate common medium password', () => {
      expect(getPasswordStrength('Password123')).toBeGreaterThanOrEqual(2);
    });

    it('should evaluate strong password', () => {
      expect(getPasswordStrength('MyP@ssw0rd2024')).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('passwordValidator - PASSWORD_REQUIREMENTS export', () => {
  it('should export PASSWORD_REQUIREMENTS object', () => {
    expect(PASSWORD_REQUIREMENTS).toBeDefined();
    expect(typeof PASSWORD_REQUIREMENTS).toBe('object');
  });

  it('should have correct minLength', () => {
    expect(PASSWORD_REQUIREMENTS.minLength).toBe(8);
  });

  it('should have requireNumber as true', () => {
    expect(PASSWORD_REQUIREMENTS.requireNumber).toBe(true);
  });

  it('should have requireLowercase as true', () => {
    expect(PASSWORD_REQUIREMENTS.requireLowercase).toBe(true);
  });

  it('should have requireUppercaseOrSymbol as true', () => {
    expect(PASSWORD_REQUIREMENTS.requireUppercaseOrSymbol).toBe(true);
  });

  it('should have noSpaces as true', () => {
    expect(PASSWORD_REQUIREMENTS.noSpaces).toBe(true);
  });
});
