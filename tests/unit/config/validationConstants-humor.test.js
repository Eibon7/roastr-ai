/**
 * Unit Tests for Humor Type Validation
 * Issue #717 - Phase 1
 *
 * Tests humor type validation, normalization, and edge cases
 */

const {
  VALIDATION_CONSTANTS,
  isValidHumorType,
  normalizeHumorType,
  getValidHumorTypes
} = require('../../../src/config/validationConstants');

describe('Humor Type Validation', () => {
  describe('VALIDATION_CONSTANTS.VALID_HUMOR_TYPES', () => {
    test('should be frozen to prevent mutation', () => {
      expect(Object.isFrozen(VALIDATION_CONSTANTS.VALID_HUMOR_TYPES)).toBe(true);
    });

    test('should contain exactly 5 humor types', () => {
      expect(VALIDATION_CONSTANTS.VALID_HUMOR_TYPES).toHaveLength(5);
    });

    test('should include all expected humor types', () => {
      const expected = ['witty', 'clever', 'sarcastic', 'playful', 'observational'];
      expect(VALIDATION_CONSTANTS.VALID_HUMOR_TYPES).toEqual(expect.arrayContaining(expected));
    });

    test('should be lowercase for consistency', () => {
      VALIDATION_CONSTANTS.VALID_HUMOR_TYPES.forEach(type => {
        expect(type).toBe(type.toLowerCase());
      });
    });
  });

  describe('normalizeHumorType()', () => {
    describe('valid humor types', () => {
      test('should normalize case-insensitive input', () => {
        expect(normalizeHumorType('WITTY')).toBe('witty');
        expect(normalizeHumorType('witty')).toBe('witty');
        expect(normalizeHumorType('Witty')).toBe('witty');

        expect(normalizeHumorType('CLEVER')).toBe('clever');
        expect(normalizeHumorType('clever')).toBe('clever');
        expect(normalizeHumorType('Clever')).toBe('clever');

        expect(normalizeHumorType('SARCASTIC')).toBe('sarcastic');
        expect(normalizeHumorType('sarcastic')).toBe('sarcastic');

        expect(normalizeHumorType('PLAYFUL')).toBe('playful');
        expect(normalizeHumorType('playful')).toBe('playful');

        expect(normalizeHumorType('OBSERVATIONAL')).toBe('observational');
        expect(normalizeHumorType('observational')).toBe('observational');
      });

      test('should handle whitespace', () => {
        expect(normalizeHumorType('  witty  ')).toBe('witty');
        expect(normalizeHumorType('  clever  ')).toBe('clever');
        expect(normalizeHumorType('\tsarcastic\n')).toBe('sarcastic');
      });

      test('should handle mixed case with whitespace', () => {
        expect(normalizeHumorType('  WiTtY  ')).toBe('witty');
        expect(normalizeHumorType('  ClEvEr  ')).toBe('clever');
      });
    });

    describe('invalid humor types', () => {
      test('should return null for invalid humor types', () => {
        expect(normalizeHumorType('invalid')).toBeNull();
        expect(normalizeHumorType('funny')).toBeNull();
        expect(normalizeHumorType('hilarious')).toBeNull();
        expect(normalizeHumorType('xyz123')).toBeNull();
      });

      test('should return null for empty strings', () => {
        expect(normalizeHumorType('')).toBeNull();
        expect(normalizeHumorType('   ')).toBeNull();
        expect(normalizeHumorType('\t\n')).toBeNull();
      });

      test('should return null for null/undefined', () => {
        expect(normalizeHumorType(null)).toBeNull();
        expect(normalizeHumorType(undefined)).toBeNull();
      });

      test('should be type-safe for non-strings', () => {
        expect(normalizeHumorType(123)).toBeNull();
        expect(normalizeHumorType({})).toBeNull();
        expect(normalizeHumorType([])).toBeNull();
        expect(normalizeHumorType(true)).toBeNull();
      });
    });

    describe('performance', () => {
      test('should complete in O(1) time', () => {
        const iterations = 10000;
        const start = Date.now();

        for (let i = 0; i < iterations; i++) {
          normalizeHumorType('witty');
          normalizeHumorType('CLEVER');
          normalizeHumorType('  sarcastic  ');
        }

        const elapsed = Date.now() - start;
        // Should complete 30,000 normalizations in less than 100ms
        expect(elapsed).toBeLessThan(100);
      });
    });
  });

  describe('isValidHumorType()', () => {
    describe('valid humor types', () => {
      test('should accept all valid humor types', () => {
        expect(isValidHumorType('witty')).toBe(true);
        expect(isValidHumorType('clever')).toBe(true);
        expect(isValidHumorType('sarcastic')).toBe(true);
        expect(isValidHumorType('playful')).toBe(true);
        expect(isValidHumorType('observational')).toBe(true);
      });

      test('should be case-insensitive', () => {
        expect(isValidHumorType('WITTY')).toBe(true);
        expect(isValidHumorType('Clever')).toBe(true);
        expect(isValidHumorType('SARCASTIC')).toBe(true);
        expect(isValidHumorType('playful')).toBe(true);
      });

      test('should handle whitespace', () => {
        expect(isValidHumorType('  witty  ')).toBe(true);
        expect(isValidHumorType('\tclever\n')).toBe(true);
      });
    });

    describe('invalid humor types', () => {
      test('should reject invalid humor types', () => {
        expect(isValidHumorType('invalid')).toBe(false);
        expect(isValidHumorType('funny')).toBe(false);
        expect(isValidHumorType('hilarious')).toBe(false);
      });

      test('should reject empty strings', () => {
        expect(isValidHumorType('')).toBe(false);
        expect(isValidHumorType('   ')).toBe(false);
      });

      test('should be type-safe for null/undefined', () => {
        expect(isValidHumorType(null)).toBe(false);
        expect(isValidHumorType(undefined)).toBe(false);
      });

      test('should be type-safe for non-strings', () => {
        expect(isValidHumorType(123)).toBe(false);
        expect(isValidHumorType({})).toBe(false);
        expect(isValidHumorType([])).toBe(false);
        expect(isValidHumorType(true)).toBe(false);
      });
    });
  });

  describe('getValidHumorTypes()', () => {
    test('should return array of valid humor types', () => {
      const types = getValidHumorTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types).toHaveLength(5);
    });

    test('should return all expected types', () => {
      const types = getValidHumorTypes();
      expect(types).toContain('witty');
      expect(types).toContain('clever');
      expect(types).toContain('sarcastic');
      expect(types).toContain('playful');
      expect(types).toContain('observational');
    });

    test('should return frozen array', () => {
      const types = getValidHumorTypes();
      expect(Object.isFrozen(types)).toBe(true);
    });

    test('should return same reference on multiple calls', () => {
      const types1 = getValidHumorTypes();
      const types2 = getValidHumorTypes();
      expect(types1).toBe(types2);
    });
  });

  describe('Integration with defaults', () => {
    test('DEFAULT HUMOR_TYPE should be valid', () => {
      const defaultHumorType = VALIDATION_CONSTANTS.DEFAULTS.HUMOR_TYPE;
      expect(isValidHumorType(defaultHumorType)).toBe(true);
    });

    test('DEFAULT HUMOR_TYPE should be witty', () => {
      expect(VALIDATION_CONSTANTS.DEFAULTS.HUMOR_TYPE).toBe('witty');
    });
  });

  describe('Edge cases and security', () => {
    test('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      expect(isValidHumorType(longString)).toBe(false);
    });

    test('should handle special characters', () => {
      expect(isValidHumorType('witty!')).toBe(false);
      expect(isValidHumorType('clever@')).toBe(false);
      expect(isValidHumorType('sarcastic#')).toBe(false);
    });

    test('should handle unicode characters', () => {
      expect(isValidHumorType('wïtty')).toBe(false);
      expect(isValidHumorType('cléver')).toBe(false);
    });

    test('should handle SQL injection attempts', () => {
      expect(isValidHumorType("witty'; DROP TABLE users;--")).toBe(false);
      expect(isValidHumorType("clever' OR '1'='1")).toBe(false);
    });
  });
});
