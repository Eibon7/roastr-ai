/**
 * Unit Tests for Tone Configuration
 * Issue #409 - Phase 3
 * Issue #973 - Centralized tone enum
 *
 * Tests tone normalization, validation, and utilities
 */

const {
  TONE_DEFINITIONS,
  VALID_TONES,
  VALID_TONES_WITH_ALIASES,
  TONE_DISPLAY_NAMES,
  TONE_DESCRIPTIONS,
  normalizeTone,
  isValidTone,
  getRandomTone,
  getToneExamples,
  getToneDisplayName,
  getToneDescription,
  getToneIntensity
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
      ['FLANDERS', 'BALANCEADO', 'CANALLA'].forEach((key) => {
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

    describe('English aliases (Issue #973)', () => {
      test('should normalize English aliases to canonical form', () => {
        expect(normalizeTone('light')).toBe('Flanders');
        expect(normalizeTone('Light')).toBe('Flanders');
        expect(normalizeTone('LIGHT')).toBe('Flanders');

        expect(normalizeTone('balanced')).toBe('Balanceado');
        expect(normalizeTone('Balanced')).toBe('Balanceado');
        expect(normalizeTone('BALANCED')).toBe('Balanceado');

        expect(normalizeTone('savage')).toBe('Canalla');
        expect(normalizeTone('Savage')).toBe('Canalla');
        expect(normalizeTone('SAVAGE')).toBe('Canalla');
      });
    });

    describe('invalid tones', () => {
      test('should return null for invalid tones', () => {
        expect(normalizeTone('invalid')).toBeNull();
        expect(normalizeTone('xyz123')).toBeNull();
        expect(normalizeTone('unknown')).toBeNull();
        expect(normalizeTone('aggressive')).toBeNull();
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

      test('should accept English aliases (Issue #973)', () => {
        expect(isValidTone('light')).toBe(true);
        expect(isValidTone('balanced')).toBe(true);
        expect(isValidTone('savage')).toBe(true);
      });

      test('should reject invalid tones', () => {
        expect(isValidTone('invalid')).toBe(false);
        expect(isValidTone('unknown')).toBe(false);
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

  // Issue #973: New tests for centralized constants
  describe('VALID_TONES_WITH_ALIASES (Issue #973)', () => {
    test('should be frozen', () => {
      expect(Object.isFrozen(VALID_TONES_WITH_ALIASES)).toBe(true);
    });

    test('should contain canonical forms', () => {
      expect(VALID_TONES_WITH_ALIASES).toContain('Flanders');
      expect(VALID_TONES_WITH_ALIASES).toContain('Balanceado');
      expect(VALID_TONES_WITH_ALIASES).toContain('Canalla');
    });

    test('should contain lowercase forms', () => {
      expect(VALID_TONES_WITH_ALIASES).toContain('flanders');
      expect(VALID_TONES_WITH_ALIASES).toContain('balanceado');
      expect(VALID_TONES_WITH_ALIASES).toContain('canalla');
    });

    test('should contain English aliases', () => {
      expect(VALID_TONES_WITH_ALIASES).toContain('light');
      expect(VALID_TONES_WITH_ALIASES).toContain('balanced');
      expect(VALID_TONES_WITH_ALIASES).toContain('savage');
    });

    test('should have exactly 9 values (3 canonical + 3 lowercase + 3 English)', () => {
      expect(VALID_TONES_WITH_ALIASES).toHaveLength(9);
    });
  });

  describe('TONE_DISPLAY_NAMES (Issue #973)', () => {
    test('should have Spanish and English display names', () => {
      expect(TONE_DISPLAY_NAMES.es).toBeDefined();
      expect(TONE_DISPLAY_NAMES.en).toBeDefined();
    });

    test('should map all aliases to display names in Spanish', () => {
      expect(TONE_DISPLAY_NAMES.es.Flanders).toBe('Flanders');
      expect(TONE_DISPLAY_NAMES.es.flanders).toBe('Flanders');
      expect(TONE_DISPLAY_NAMES.es.light).toBe('Flanders');
      expect(TONE_DISPLAY_NAMES.es.Balanceado).toBe('Balanceado');
      expect(TONE_DISPLAY_NAMES.es.balanceado).toBe('Balanceado');
      expect(TONE_DISPLAY_NAMES.es.balanced).toBe('Balanceado');
      expect(TONE_DISPLAY_NAMES.es.Canalla).toBe('Canalla');
      expect(TONE_DISPLAY_NAMES.es.canalla).toBe('Canalla');
      expect(TONE_DISPLAY_NAMES.es.savage).toBe('Canalla');
    });

    test('should map all aliases to display names in English', () => {
      expect(TONE_DISPLAY_NAMES.en.Flanders).toBe('Light');
      expect(TONE_DISPLAY_NAMES.en.flanders).toBe('Light');
      expect(TONE_DISPLAY_NAMES.en.light).toBe('Light');
      expect(TONE_DISPLAY_NAMES.en.Balanceado).toBe('Balanced');
      expect(TONE_DISPLAY_NAMES.en.balanceado).toBe('Balanced');
      expect(TONE_DISPLAY_NAMES.en.balanced).toBe('Balanced');
      expect(TONE_DISPLAY_NAMES.en.Canalla).toBe('Savage');
      expect(TONE_DISPLAY_NAMES.en.canalla).toBe('Savage');
      expect(TONE_DISPLAY_NAMES.en.savage).toBe('Savage');
    });
  });

  describe('TONE_DESCRIPTIONS (Issue #973)', () => {
    test('should have Spanish and English descriptions', () => {
      expect(TONE_DESCRIPTIONS.es).toBeDefined();
      expect(TONE_DESCRIPTIONS.en).toBeDefined();
    });

    test('should have descriptions for all canonical tones in Spanish', () => {
      expect(TONE_DESCRIPTIONS.es.Flanders).toBeDefined();
      expect(TONE_DESCRIPTIONS.es.Balanceado).toBeDefined();
      expect(TONE_DESCRIPTIONS.es.Canalla).toBeDefined();
    });

    test('should have descriptions for all canonical tones in English', () => {
      expect(TONE_DESCRIPTIONS.en.Flanders).toBeDefined();
      expect(TONE_DESCRIPTIONS.en.Balanceado).toBeDefined();
      expect(TONE_DESCRIPTIONS.en.Canalla).toBeDefined();
    });

    test('descriptions should include intensity level', () => {
      expect(TONE_DESCRIPTIONS.es.Flanders).toMatch(/2\/5/);
      expect(TONE_DESCRIPTIONS.es.Balanceado).toMatch(/3\/5/);
      expect(TONE_DESCRIPTIONS.es.Canalla).toMatch(/4\/5/);
    });
  });

  describe('getToneDisplayName() (Issue #973)', () => {
    test('should return Spanish display name by default', () => {
      expect(getToneDisplayName('flanders')).toBe('Flanders');
      expect(getToneDisplayName('balanceado')).toBe('Balanceado');
      expect(getToneDisplayName('canalla')).toBe('Canalla');
    });

    test('should return English display name when specified', () => {
      expect(getToneDisplayName('flanders', 'en')).toBe('Light');
      expect(getToneDisplayName('balanceado', 'en')).toBe('Balanced');
      expect(getToneDisplayName('canalla', 'en')).toBe('Savage');
    });

    test('should normalize aliases before lookup', () => {
      expect(getToneDisplayName('light', 'es')).toBe('Flanders');
      expect(getToneDisplayName('savage', 'es')).toBe('Canalla');
      expect(getToneDisplayName('balanced', 'en')).toBe('Balanced');
    });

    test('should return input for invalid tones', () => {
      expect(getToneDisplayName('invalid')).toBe('invalid');
    });
  });

  describe('getToneDescription() (Issue #973)', () => {
    test('should return Spanish description by default', () => {
      expect(getToneDescription('flanders')).toContain('amable');
      expect(getToneDescription('balanceado')).toContain('Equilibrio');
      expect(getToneDescription('canalla')).toContain('Directo');
    });

    test('should return English description when specified', () => {
      expect(getToneDescription('flanders', 'en')).toContain('Gentle');
      expect(getToneDescription('balanceado', 'en')).toContain('mix');
      expect(getToneDescription('canalla', 'en')).toContain('Direct');
    });

    test('should return empty string for invalid tones', () => {
      expect(getToneDescription('invalid')).toBe('');
    });
  });

  describe('getToneIntensity() (Issue #973)', () => {
    test('should return correct intensity for each tone', () => {
      expect(getToneIntensity('flanders')).toBe(2);
      expect(getToneIntensity('Flanders')).toBe(2);
      expect(getToneIntensity('light')).toBe(2);

      expect(getToneIntensity('balanceado')).toBe(3);
      expect(getToneIntensity('Balanceado')).toBe(3);
      expect(getToneIntensity('balanced')).toBe(3);

      expect(getToneIntensity('canalla')).toBe(4);
      expect(getToneIntensity('Canalla')).toBe(4);
      expect(getToneIntensity('savage')).toBe(4);
    });

    test('should return default intensity (3) for invalid tones', () => {
      expect(getToneIntensity('invalid')).toBe(3);
      expect(getToneIntensity(null)).toBe(3);
    });
  });

  // Issue #973: Consistency tests
  describe('Consistency with other modules (Issue #973)', () => {
    test('VALID_TONES should be subset of VALID_TONES_WITH_ALIASES', () => {
      VALID_TONES.forEach((tone) => {
        expect(VALID_TONES_WITH_ALIASES).toContain(tone);
      });
    });

    test('all VALID_TONES_WITH_ALIASES should normalize to a VALID_TONE', () => {
      VALID_TONES_WITH_ALIASES.forEach((alias) => {
        const normalized = normalizeTone(alias);
        expect(normalized).not.toBeNull();
        expect(VALID_TONES).toContain(normalized);
      });
    });

    test('TONE_DEFINITIONS keys should match VALID_TONES', () => {
      const definitionIds = Object.values(TONE_DEFINITIONS).map((d) => d.id);
      expect(definitionIds.sort()).toEqual([...VALID_TONES].sort());
    });

    test('all VALID_TONES should have display names in both languages', () => {
      VALID_TONES.forEach((tone) => {
        expect(TONE_DISPLAY_NAMES.es[tone]).toBeDefined();
        expect(TONE_DISPLAY_NAMES.en[tone]).toBeDefined();
      });
    });

    test('all VALID_TONES should have descriptions in both languages', () => {
      VALID_TONES.forEach((tone) => {
        expect(TONE_DESCRIPTIONS.es[tone]).toBeDefined();
        expect(TONE_DESCRIPTIONS.en[tone]).toBeDefined();
      });
    });

    test('all TONE_DEFINITIONS should have intensity field', () => {
      Object.values(TONE_DEFINITIONS).forEach((def) => {
        expect(def.intensity).toBeDefined();
        expect(typeof def.intensity).toBe('number');
        expect(def.intensity).toBeGreaterThanOrEqual(1);
        expect(def.intensity).toBeLessThanOrEqual(5);
      });
    });
  });

  // Issue #973: Cross-module consistency test (AC#6 requirement)
  describe('Cross-module tone consistency (Issue #973)', () => {
    test('VALID_STYLES should match VALID_TONES_WITH_ALIASES', () => {
      const { VALIDATION_CONSTANTS } = require('../../../src/config/validationConstants');

      // ES tones should be lowercase canonical forms
      expect(VALIDATION_CONSTANTS.VALID_STYLES.es).toEqual(['flanders', 'balanceado', 'canalla']);

      // EN tones should be English aliases
      expect(VALIDATION_CONSTANTS.VALID_STYLES.en).toEqual(['light', 'balanced', 'savage']);

      // All VALID_STYLES values should exist in VALID_TONES_WITH_ALIASES
      const allStyles = [
        ...VALIDATION_CONSTANTS.VALID_STYLES.es,
        ...VALIDATION_CONSTANTS.VALID_STYLES.en
      ];

      allStyles.forEach((style) => {
        expect(VALID_TONES_WITH_ALIASES).toContain(style);
      });
    });

    test('VALID_STYLES should be derived from VALID_TONES_WITH_ALIASES (no drift)', () => {
      const { VALIDATION_CONSTANTS } = require('../../../src/config/validationConstants');

      // Verify ES styles are subset of VALID_TONES_WITH_ALIASES
      VALIDATION_CONSTANTS.VALID_STYLES.es.forEach((style) => {
        expect(VALID_TONES_WITH_ALIASES).toContain(style);
      });

      // Verify EN styles are subset of VALID_TONES_WITH_ALIASES
      VALIDATION_CONSTANTS.VALID_STYLES.en.forEach((style) => {
        expect(VALID_TONES_WITH_ALIASES).toContain(style);
      });

      // Verify no extra styles exist that aren't in VALID_TONES_WITH_ALIASES
      const allStyles = [
        ...VALIDATION_CONSTANTS.VALID_STYLES.es,
        ...VALIDATION_CONSTANTS.VALID_STYLES.en
      ];
      const uniqueStyles = [...new Set(allStyles)];

      expect(uniqueStyles.length).toBe(allStyles.length); // No duplicates
      uniqueStyles.forEach((style) => {
        expect(VALID_TONES_WITH_ALIASES).toContain(style);
      });
    });
  });
});
