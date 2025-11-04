/**
 * Unit Tests for Intensity Level Validation
 * Issue #717 - Phase 2
 *
 * Tests intensity level validation, range checking, and description mapping
 */

const {
  VALIDATION_CONSTANTS,
  isValidIntensity,
  normalizeIntensity,
  getIntensityDescription,
  getIntensityRange
} = require('../../../src/config/validationConstants');

describe('Intensity Level Validation', () => {
  describe('VALIDATION_CONSTANTS intensity range', () => {
    test('MIN_INTENSITY should be 1', () => {
      expect(VALIDATION_CONSTANTS.MIN_INTENSITY).toBe(1);
    });

    test('MAX_INTENSITY should be 5', () => {
      expect(VALIDATION_CONSTANTS.MAX_INTENSITY).toBe(5);
    });

    test('DEFAULT INTENSITY should be within valid range', () => {
      const defaultIntensity = VALIDATION_CONSTANTS.DEFAULTS.INTENSITY;
      expect(defaultIntensity).toBeGreaterThanOrEqual(VALIDATION_CONSTANTS.MIN_INTENSITY);
      expect(defaultIntensity).toBeLessThanOrEqual(VALIDATION_CONSTANTS.MAX_INTENSITY);
    });

    test('DEFAULT INTENSITY should be 3', () => {
      expect(VALIDATION_CONSTANTS.DEFAULTS.INTENSITY).toBe(3);
    });
  });

  describe('normalizeIntensity()', () => {
    describe('valid intensities', () => {
      test('should accept integers 1-5', () => {
        expect(normalizeIntensity(1)).toBe(1);
        expect(normalizeIntensity(2)).toBe(2);
        expect(normalizeIntensity(3)).toBe(3);
        expect(normalizeIntensity(4)).toBe(4);
        expect(normalizeIntensity(5)).toBe(5);
      });

      test('should convert string numbers to integers', () => {
        expect(normalizeIntensity('1')).toBe(1);
        expect(normalizeIntensity('2')).toBe(2);
        expect(normalizeIntensity('3')).toBe(3);
        expect(normalizeIntensity('4')).toBe(4);
        expect(normalizeIntensity('5')).toBe(5);
      });

      test('should handle string numbers with whitespace', () => {
        expect(normalizeIntensity('  1  ')).toBe(1);
        expect(normalizeIntensity('\t3\n')).toBe(3);
      });
    });

    describe('invalid intensities', () => {
      test('should return null for out-of-range values', () => {
        expect(normalizeIntensity(0)).toBeNull();
        expect(normalizeIntensity(6)).toBeNull();
        expect(normalizeIntensity(-1)).toBeNull();
        expect(normalizeIntensity(10)).toBeNull();
        expect(normalizeIntensity(100)).toBeNull();
      });

      test('should return null for decimal values', () => {
        expect(normalizeIntensity(1.5)).toBeNull();
        expect(normalizeIntensity(2.7)).toBeNull();
        expect(normalizeIntensity(3.14)).toBeNull();
      });

      test('should return null for null/undefined', () => {
        expect(normalizeIntensity(null)).toBeNull();
        expect(normalizeIntensity(undefined)).toBeNull();
      });

      test('should return null for non-numeric values', () => {
        expect(normalizeIntensity('abc')).toBeNull();
        expect(normalizeIntensity('high')).toBeNull();
        expect(normalizeIntensity({})).toBeNull();
        expect(normalizeIntensity([])).toBeNull();
        expect(normalizeIntensity(true)).toBeNull();
      });

      test('should return null for empty strings', () => {
        expect(normalizeIntensity('')).toBeNull();
        expect(normalizeIntensity('   ')).toBeNull();
      });
    });

    describe('boundary conditions', () => {
      test('should accept exactly MIN_INTENSITY (1)', () => {
        expect(normalizeIntensity(1)).toBe(1);
      });

      test('should accept exactly MAX_INTENSITY (5)', () => {
        expect(normalizeIntensity(5)).toBe(5);
      });

      test('should reject MIN_INTENSITY - 1 (0)', () => {
        expect(normalizeIntensity(0)).toBeNull();
      });

      test('should reject MAX_INTENSITY + 1 (6)', () => {
        expect(normalizeIntensity(6)).toBeNull();
      });
    });
  });

  describe('isValidIntensity()', () => {
    describe('valid intensities', () => {
      test('should accept integers 1-5', () => {
        expect(isValidIntensity(1)).toBe(true);
        expect(isValidIntensity(2)).toBe(true);
        expect(isValidIntensity(3)).toBe(true);
        expect(isValidIntensity(4)).toBe(true);
        expect(isValidIntensity(5)).toBe(true);
      });

      test('should accept string numbers', () => {
        expect(isValidIntensity('1')).toBe(true);
        expect(isValidIntensity('3')).toBe(true);
        expect(isValidIntensity('5')).toBe(true);
      });

      test('should handle whitespace in string numbers', () => {
        expect(isValidIntensity('  2  ')).toBe(true);
        expect(isValidIntensity('\t4\n')).toBe(true);
      });
    });

    describe('invalid intensities', () => {
      test('should reject out-of-range values', () => {
        expect(isValidIntensity(0)).toBe(false);
        expect(isValidIntensity(6)).toBe(false);
        expect(isValidIntensity(-1)).toBe(false);
        expect(isValidIntensity(10)).toBe(false);
      });

      test('should reject decimal values', () => {
        expect(isValidIntensity(1.5)).toBe(false);
        expect(isValidIntensity(3.14)).toBe(false);
      });

      test('should reject non-numeric values', () => {
        expect(isValidIntensity('abc')).toBe(false);
        expect(isValidIntensity('high')).toBe(false);
        expect(isValidIntensity(null)).toBe(false);
        expect(isValidIntensity(undefined)).toBe(false);
      });
    });
  });

  describe('getIntensityDescription()', () => {
    describe('low intensity (1-2)', () => {
      test('should return "suave y amigable" for level 1', () => {
        const desc = getIntensityDescription(1);
        expect(desc).toBe('suave y amigable');
      });

      test('should return "suave y amigable" for level 2', () => {
        const desc = getIntensityDescription(2);
        expect(desc).toBe('suave y amigable');
      });
    });

    describe('medium intensity (3)', () => {
      test('should return empty string for level 3 (default)', () => {
        const desc = getIntensityDescription(3);
        expect(desc).toBe('');
      });
    });

    describe('high intensity (4-5)', () => {
      test('should return "directo y sin filtros" for level 4', () => {
        const desc = getIntensityDescription(4);
        expect(desc).toBe('directo y sin filtros');
      });

      test('should return "directo y sin filtros" for level 5', () => {
        const desc = getIntensityDescription(5);
        expect(desc).toBe('directo y sin filtros');
      });
    });

    describe('edge cases', () => {
      test('should handle invalid levels gracefully', () => {
        expect(getIntensityDescription(0)).toBe('');
        expect(getIntensityDescription(6)).toBe('');
        expect(getIntensityDescription(null)).toBe('');
        expect(getIntensityDescription(undefined)).toBe('');
      });

      test('should handle string numbers', () => {
        expect(getIntensityDescription('1')).toBe('suave y amigable');
        expect(getIntensityDescription('5')).toBe('directo y sin filtros');
      });
    });
  });

  describe('getIntensityRange()', () => {
    test('should return min and max intensity', () => {
      const range = getIntensityRange();
      expect(range).toHaveProperty('min');
      expect(range).toHaveProperty('max');
    });

    test('should return correct range values', () => {
      const range = getIntensityRange();
      expect(range.min).toBe(1);
      expect(range.max).toBe(5);
    });

    test('should return frozen object', () => {
      const range = getIntensityRange();
      expect(Object.isFrozen(range)).toBe(true);
    });
  });

  describe('Integration tests', () => {
    test('all levels should map to valid descriptions', () => {
      for (let level = 1; level <= 5; level++) {
        const desc = getIntensityDescription(level);
        expect(typeof desc).toBe('string');
        // Description should be one of: '', 'suave y amigable', 'directo y sin filtros'
        expect(['', 'suave y amigable', 'directo y sin filtros']).toContain(desc);
      }
    });

    test('normalization should be consistent with validation', () => {
      for (let level = 1; level <= 5; level++) {
        expect(normalizeIntensity(level)).toBe(level);
        expect(isValidIntensity(level)).toBe(true);
      }

      // Invalid values should be consistent
      expect(normalizeIntensity(0)).toBeNull();
      expect(isValidIntensity(0)).toBe(false);

      expect(normalizeIntensity(6)).toBeNull();
      expect(isValidIntensity(6)).toBe(false);
    });
  });

  describe('Edge cases and security', () => {
    test('should handle very large numbers', () => {
      expect(isValidIntensity(999999)).toBe(false);
      expect(isValidIntensity(-999999)).toBe(false);
    });

    test('should handle Infinity', () => {
      expect(isValidIntensity(Infinity)).toBe(false);
      expect(isValidIntensity(-Infinity)).toBe(false);
    });

    test('should handle NaN', () => {
      expect(isValidIntensity(NaN)).toBe(false);
    });

    test('should handle scientific notation', () => {
      expect(isValidIntensity(1e10)).toBe(false);
      expect(isValidIntensity(1e-10)).toBe(false);
    });

    test('should handle string injection attempts', () => {
      expect(isValidIntensity("5'; DROP TABLE users;--")).toBe(false);
      expect(isValidIntensity("3' OR '1'='1")).toBe(false);
    });
  });

  describe('Performance', () => {
    test('should complete validations in O(1) time', () => {
      const iterations = 10000;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        isValidIntensity(1);
        isValidIntensity(3);
        isValidIntensity(5);
      }

      const elapsed = Date.now() - start;
      // Should complete 30,000 validations in less than 200ms
      expect(elapsed).toBeLessThan(200);
    });
  });
});
