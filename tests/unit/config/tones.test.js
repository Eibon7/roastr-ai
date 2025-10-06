/**
 * Unit Tests for Tone Configuration
 * Issue #409 - Phase 3
 *
 * Tests tone normalization, validation, and utilities
 */

const {
  TONE_DEFINITIONS,
  VALID_TONES,
  normalizeTone,
  isValidTone,
  getRandomTone,
  getToneExamples
} = require('../../../src/config/tones');

describe('Tone Configuration', () => {
  describe('TONE_DEFINITIONS', () => {
    test('should be frozen to prevent mutation', () => {
      expect(Object.isFrozen(TONE_DEFINITIONS)).toBe(true);
      expect(Object.isFrozen(TONE_DEFINITIONS.FLANDERS)).toBe(true);
      expect(Object.isFrozen(TONE_DEFINITIONS.BALANCEADO)).toBe(true);
      expect(Object.isFrozen(TONE_DEFINITIONS.CANALLA)).toBe(true);
    });

    test('should have all required properties', () => {
      ['FLANDERS', 'BALANCEADO', 'CANALLA'].forEach(key => {
        expect(TONE_DEFINITIONS[key]).toBeDefined();
        expect(TONE_DEFINITIONS[key].id).toBeDefined();
        expect(TONE_DEFINITIONS[key].name).toBeDefined();
        expect(TONE_DEFINITIONS[key].description).toBeDefined();
        expect(TONE_DEFINITIONS[key].example).toBeDefined();
      });
    });
  });

  describe('VALID_TONES', () => {
    test('should be frozen', () => {
      expect(Object.isFrozen(VALID_TONES)).toBe(true);
    });

    test('should contain exactly 3 tones', () => {
      expect(VALID_TONES).toHaveLength(3);
      expect(VALID_TONES).toContain('Flanders');
      expect(VALID_TONES).toContain('Balanceado');
      expect(VALID_TONES).toContain('Canalla');
    });
  });

  describe('normalizeTone()', () => {
    describe('valid tones', () => {
      test('should normalize case-insensitive input', () => {
        expect(normalizeTone('FLANDERS')).toBe('Flanders');
        expect(normalizeTone('flanders')).toBe('Flanders');
        expect(normalizeTone('Flanders')).toBe('Flanders');

        expect(normalizeTone('BALANCEADO')).toBe('Balanceado');
        expect(normalizeTone('balanceado')).toBe('Balanceado');
        expect(normalizeTone('Balanceado')).toBe('Balanceado');

        expect(normalizeTone('CANALLA')).toBe('Canalla');
        expect(normalizeTone('canalla')).toBe('Canalla');
        expect(normalizeTone('Canalla')).toBe('Canalla');
      });

      test('should handle whitespace', () => {
        expect(normalizeTone('  Flanders  ')).toBe('Flanders');
        expect(normalizeTone('  balanceado  ')).toBe('Balanceado');
        expect(normalizeTone('\tcanalla\n')).toBe('Canalla');
      });

      test('should handle mixed case with whitespace', () => {
        expect(normalizeTone('  FlAnDeRs  ')).toBe('Flanders');
        expect(normalizeTone('  BaLaNcEaDo  ')).toBe('Balanceado');
      });
    });

    describe('invalid tones', () => {
      test('should return null for invalid tones', () => {
        expect(normalizeTone('invalid')).toBeNull();
        expect(normalizeTone('savage')).toBeNull();
        expect(normalizeTone('light')).toBeNull();
        expect(normalizeTone('xyz123')).toBeNull();
      });

      test('should return null for empty strings', () => {
        expect(normalizeTone('')).toBeNull();
        expect(normalizeTone('   ')).toBeNull();
        expect(normalizeTone('\t\n')).toBeNull();
      });

      test('should return null for null/undefined', () => {
        expect(normalizeTone(null)).toBeNull();
        expect(normalizeTone(undefined)).toBeNull();
      });

      test('should be type-safe for non-strings', () => {
        expect(normalizeTone(123)).toBeNull();
        expect(normalizeTone({})).toBeNull();
        expect(normalizeTone([])).toBeNull();
        expect(normalizeTone(true)).toBeNull();
      });
    });

    describe('performance', () => {
      test('should complete in O(1) time', () => {
        const iterations = 10000;
        const start = Date.now();

        for (let i = 0; i < iterations; i++) {
          normalizeTone('flanders');
          normalizeTone('BALANCEADO');
          normalizeTone('  canalla  ');
        }

        const elapsed = Date.now() - start;
        // Should complete 30,000 normalizations in less than 100ms
        expect(elapsed).toBeLessThan(100);
      });
    });
  });

  describe('isValidTone()', () => {
    describe('non-strict mode (default)', () => {
      test('should accept normalized tones', () => {
        expect(isValidTone('Flanders')).toBe(true);
        expect(isValidTone('Balanceado')).toBe(true);
        expect(isValidTone('Canalla')).toBe(true);
      });

      test('should accept case-insensitive input', () => {
        expect(isValidTone('FLANDERS')).toBe(true);
        expect(isValidTone('flanders')).toBe(true);
        expect(isValidTone('balanceado')).toBe(true);
        expect(isValidTone('CANALLA')).toBe(true);
      });

      test('should reject invalid tones', () => {
        expect(isValidTone('invalid')).toBe(false);
        expect(isValidTone('savage')).toBe(false);
        expect(isValidTone('')).toBe(false);
        expect(isValidTone(null)).toBe(false);
      });
    });

    describe('strict mode', () => {
      test('should require canonical form', () => {
        expect(isValidTone('Flanders', true)).toBe(true);
        expect(isValidTone('Balanceado', true)).toBe(true);
        expect(isValidTone('Canalla', true)).toBe(true);
      });

      test('should reject non-canonical forms', () => {
        expect(isValidTone('flanders', true)).toBe(false);
        expect(isValidTone('FLANDERS', true)).toBe(false);
        expect(isValidTone('  Flanders  ', true)).toBe(false);
      });

      test('should be type-safe in strict mode', () => {
        expect(isValidTone(123, true)).toBe(false);
        expect(isValidTone({}, true)).toBe(false);
        expect(isValidTone(null, true)).toBe(false);
      });
    });
  });

  describe('getRandomTone()', () => {
    test('should return a valid tone', () => {
      const tone = getRandomTone();
      expect(VALID_TONES).toContain(tone);
    });

    test('should return different tones over multiple calls', () => {
      const tones = new Set();
      for (let i = 0; i < 100; i++) {
        tones.add(getRandomTone());
      }

      // Over 100 calls, should get at least 2 different tones
      expect(tones.size).toBeGreaterThanOrEqual(2);
    });

    test('should only return tones from VALID_TONES', () => {
      for (let i = 0; i < 50; i++) {
        const tone = getRandomTone();
        expect(VALID_TONES).toContain(tone);
      }
    });
  });

  describe('getToneExamples()', () => {
    test('should return examples for all tones', () => {
      const examples = getToneExamples();

      expect(examples.Flanders).toBeDefined();
      expect(examples.Balanceado).toBeDefined();
      expect(examples.Canalla).toBeDefined();
    });

    test('should return strings as examples', () => {
      const examples = getToneExamples();

      expect(typeof examples.Flanders).toBe('string');
      expect(typeof examples.Balanceado).toBe('string');
      expect(typeof examples.Canalla).toBe('string');
    });

    test('should return non-empty examples', () => {
      const examples = getToneExamples();

      expect(examples.Flanders.length).toBeGreaterThan(0);
      expect(examples.Balanceado.length).toBeGreaterThan(0);
      expect(examples.Canalla.length).toBeGreaterThan(0);
    });
  });
});
