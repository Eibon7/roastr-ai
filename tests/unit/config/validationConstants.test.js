/**
 * Unit tests for Validation Constants (CodeRabbit Round 4 improvements)
 * Tests BCP-47 locale support, immutability, platform normalization, and edge cases
 */

const {
  VALIDATION_CONSTANTS,
  normalizeStyle,
  normalizeLanguage,
  normalizePlatform,
  isValidStyle,
  isValidLanguage,
  isValidPlatform,
  getValidStylesForLanguage
} = require('../../../src/config/validationConstants');

describe('Validation Constants', () => {
  describe('VALIDATION_CONSTANTS object', () => {
    test('should be frozen to prevent mutations', () => {
      expect(Object.isFrozen(VALIDATION_CONSTANTS)).toBe(true);
    });

    test('should have all required properties', () => {
      expect(VALIDATION_CONSTANTS).toHaveProperty('MAX_COMMENT_LENGTH');
      expect(VALIDATION_CONSTANTS).toHaveProperty('VALID_STYLES');
      expect(VALIDATION_CONSTANTS).toHaveProperty('VALID_LANGUAGES');
      expect(VALIDATION_CONSTANTS).toHaveProperty('VALID_PLATFORMS');
      expect(VALIDATION_CONSTANTS).toHaveProperty('DEFAULTS');
    });

    test('should have immutable nested objects', () => {
      expect(Object.isFrozen(VALIDATION_CONSTANTS.VALID_STYLES)).toBe(true);
      expect(Object.isFrozen(VALIDATION_CONSTANTS.VALID_STYLES.es)).toBe(true);
      expect(Object.isFrozen(VALIDATION_CONSTANTS.VALID_STYLES.en)).toBe(true);
      expect(Object.isFrozen(VALIDATION_CONSTANTS.VALID_LANGUAGES)).toBe(true);
      expect(Object.isFrozen(VALIDATION_CONSTANTS.VALID_PLATFORMS)).toBe(true);
      expect(Object.isFrozen(VALIDATION_CONSTANTS.DEFAULTS)).toBe(true);
    });

    test('should prevent modification attempts', () => {
      const originalMaxLength = VALIDATION_CONSTANTS.MAX_COMMENT_LENGTH;

      // Attempt to modify should throw in strict mode (Node.js default behavior)
      expect(() => {
        VALIDATION_CONSTANTS.MAX_COMMENT_LENGTH = 5000;
      }).toThrow();

      // Value should remain unchanged
      expect(VALIDATION_CONSTANTS.MAX_COMMENT_LENGTH).toBe(originalMaxLength);
    });
  });

  describe('normalizeStyle', () => {
    test('should normalize style to lowercase', () => {
      expect(normalizeStyle('BALANCEADO')).toBe('balanceado');
      expect(normalizeStyle('Balanced')).toBe('balanced');
      expect(normalizeStyle('SAVAGE')).toBe('savage');
    });

    test('should trim whitespace', () => {
      expect(normalizeStyle('  balanceado  ')).toBe('balanceado');
      expect(normalizeStyle('\tcanalla\n')).toBe('canalla');
    });

    test('should handle null and undefined', () => {
      expect(normalizeStyle(null)).toBeNull();
      expect(normalizeStyle(undefined)).toBeNull();
      expect(normalizeStyle('')).toBeNull();
    });

    test('should handle edge cases', () => {
      expect(normalizeStyle('bAlAnCeAdO')).toBe('balanceado');
      expect(normalizeStyle('LIGHT')).toBe('light');
    });
  });

  describe('normalizeLanguage with BCP-47 support', () => {
    test('should normalize basic language codes', () => {
      expect(normalizeLanguage('ES')).toBe('es');
      expect(normalizeLanguage('EN')).toBe('en');
      expect(normalizeLanguage('es')).toBe('es');
      expect(normalizeLanguage('en')).toBe('en');
    });

    test('should handle BCP-47 locale codes', () => {
      expect(normalizeLanguage('en-US')).toBe('en');
      expect(normalizeLanguage('en-GB')).toBe('en');
      expect(normalizeLanguage('es-MX')).toBe('es');
      expect(normalizeLanguage('es-ES')).toBe('es');
      expect(normalizeLanguage('es-AR')).toBe('es');
    });

    test('should trim whitespace from locale codes', () => {
      expect(normalizeLanguage('  en-US  ')).toBe('en');
      expect(normalizeLanguage('\tes-MX\n')).toBe('es');
    });

    test('should handle complex BCP-47 tags', () => {
      expect(normalizeLanguage('en-US-POSIX')).toBe('en');
      expect(normalizeLanguage('es-419')).toBe('es'); // Latin America
      expect(normalizeLanguage('en-CA')).toBe('en');
    });

    test('should return default for invalid input', () => {
      expect(normalizeLanguage(null)).toBe('es');
      expect(normalizeLanguage(undefined)).toBe('es');
      expect(normalizeLanguage('')).toBe('es');
      expect(normalizeLanguage('invalid')).toBe('invalid');
    });

    test('should handle case variations in BCP-47', () => {
      expect(normalizeLanguage('EN-us')).toBe('en');
      expect(normalizeLanguage('Es-mx')).toBe('es');
      expect(normalizeLanguage('EN-GB')).toBe('en');
    });
  });

  describe('normalizePlatform with alias support', () => {
    test('should normalize platform names', () => {
      expect(normalizePlatform('TWITTER')).toBe('twitter');
      expect(normalizePlatform('Facebook')).toBe('facebook');
      expect(normalizePlatform('INSTAGRAM')).toBe('instagram');
    });

    test('should handle platform aliases', () => {
      expect(normalizePlatform('X')).toBe('twitter');
      expect(normalizePlatform('x')).toBe('twitter');
      expect(normalizePlatform('X.com')).toBe('twitter');
      expect(normalizePlatform('x.com')).toBe('twitter');
    });

    test('should trim whitespace', () => {
      expect(normalizePlatform('  twitter  ')).toBe('twitter');
      expect(normalizePlatform('\tx\n')).toBe('twitter');
    });

    test('should handle null and undefined', () => {
      expect(normalizePlatform(null)).toBe('twitter');
      expect(normalizePlatform(undefined)).toBe('twitter');
      expect(normalizePlatform('')).toBe('twitter');
    });
  });

  describe('isValidStyle', () => {
    test('should validate Spanish styles', () => {
      expect(isValidStyle('flanders', 'es')).toBe(true);
      expect(isValidStyle('balanceado', 'es')).toBe(true);
      expect(isValidStyle('canalla', 'es')).toBe(true);
    });

    test('should validate English styles', () => {
      expect(isValidStyle('light', 'en')).toBe(true);
      expect(isValidStyle('balanced', 'en')).toBe(true);
      expect(isValidStyle('savage', 'en')).toBe(true);
    });

    test('should be case insensitive', () => {
      expect(isValidStyle('BALANCEADO', 'es')).toBe(true);
      expect(isValidStyle('Light', 'en')).toBe(true);
      expect(isValidStyle('SAVAGE', 'EN')).toBe(true);
    });

    test('should handle whitespace', () => {
      expect(isValidStyle('  balanceado  ', 'es')).toBe(true);
      expect(isValidStyle('\tlight\n', 'en')).toBe(true);
    });

    test('should reject invalid styles', () => {
      expect(isValidStyle('invalid', 'es')).toBe(false);
      expect(isValidStyle('light', 'es')).toBe(false); // English style with Spanish language
      expect(isValidStyle('balanceado', 'en')).toBe(false); // Spanish style with English language
    });

    test('should handle BCP-47 language codes', () => {
      expect(isValidStyle('balanceado', 'es-MX')).toBe(true);
      expect(isValidStyle('light', 'en-US')).toBe(true);
      expect(isValidStyle('savage', 'en-GB')).toBe(true);
    });

    test('should default to Spanish for missing language', () => {
      expect(isValidStyle('balanceado')).toBe(true);
      expect(isValidStyle('light')).toBe(false); // English style with default Spanish
    });
  });

  describe('isValidLanguage', () => {
    test('should validate basic language codes', () => {
      expect(isValidLanguage('es')).toBe(true);
      expect(isValidLanguage('en')).toBe(true);
      expect(isValidLanguage('ES')).toBe(true);
      expect(isValidLanguage('EN')).toBe(true);
    });

    test('should handle BCP-47 locale codes', () => {
      expect(isValidLanguage('en-US')).toBe(true);
      expect(isValidLanguage('es-MX')).toBe(true);
      expect(isValidLanguage('en-GB')).toBe(true);
      expect(isValidLanguage('es-ES')).toBe(true);
    });

    test('should reject invalid languages', () => {
      expect(isValidLanguage('fr')).toBe(false);
      expect(isValidLanguage('de')).toBe(false);
      expect(isValidLanguage('invalid')).toBe(false);
    });

    test('should handle edge cases', () => {
      expect(isValidLanguage('')).toBe(true); // Normalizes to default 'es'
      expect(isValidLanguage(null)).toBe(true); // Normalizes to default 'es'
      expect(isValidLanguage(undefined)).toBe(true); // Normalizes to default 'es'
    });
  });

  describe('isValidPlatform', () => {
    test('should validate standard platforms', () => {
      expect(isValidPlatform('twitter')).toBe(true);
      expect(isValidPlatform('facebook')).toBe(true);
      expect(isValidPlatform('instagram')).toBe(true);
      expect(isValidPlatform('youtube')).toBe(true);
      expect(isValidPlatform('tiktok')).toBe(true);
      expect(isValidPlatform('reddit')).toBe(true);
      expect(isValidPlatform('discord')).toBe(true);
      expect(isValidPlatform('twitch')).toBe(true);
      expect(isValidPlatform('bluesky')).toBe(true);
    });

    test('should validate platform aliases', () => {
      expect(isValidPlatform('x')).toBe(true); // Maps to twitter
      expect(isValidPlatform('X')).toBe(true);
      expect(isValidPlatform('x.com')).toBe(true);
      expect(isValidPlatform('X.com')).toBe(true);
    });

    test('should be case insensitive', () => {
      expect(isValidPlatform('TWITTER')).toBe(true);
      expect(isValidPlatform('Facebook')).toBe(true);
      expect(isValidPlatform('INSTAGRAM')).toBe(true);
    });

    test('should reject invalid platforms', () => {
      expect(isValidPlatform('invalid')).toBe(false);
      expect(isValidPlatform('linkedin')).toBe(false);
      expect(isValidPlatform('snapchat')).toBe(false);
    });

    test('should handle edge cases', () => {
      expect(isValidPlatform('')).toBe(true); // Normalizes to default 'twitter'
      expect(isValidPlatform(null)).toBe(true); // Normalizes to default 'twitter'
      expect(isValidPlatform(undefined)).toBe(true); // Normalizes to default 'twitter'
    });
  });

  describe('getValidStylesForLanguage', () => {
    test('should return Spanish styles for es', () => {
      const styles = getValidStylesForLanguage('es');
      expect(styles).toEqual(['flanders', 'balanceado', 'canalla']);
    });

    test('should return English styles for en', () => {
      const styles = getValidStylesForLanguage('en');
      expect(styles).toEqual(['light', 'balanced', 'savage']);
    });

    test('should handle BCP-47 locale codes', () => {
      expect(getValidStylesForLanguage('es-MX')).toEqual(['flanders', 'balanceado', 'canalla']);
      expect(getValidStylesForLanguage('en-US')).toEqual(['light', 'balanced', 'savage']);
    });

    test('should default to Spanish for invalid languages', () => {
      expect(getValidStylesForLanguage('fr')).toEqual(['flanders', 'balanceado', 'canalla']);
      expect(getValidStylesForLanguage('invalid')).toEqual(['flanders', 'balanceado', 'canalla']);
    });

    test('should default to Spanish for missing parameter', () => {
      expect(getValidStylesForLanguage()).toEqual(['flanders', 'balanceado', 'canalla']);
    });
  });

  describe('Integration tests', () => {
    test('should work together for complete validation flow', () => {
      // Test Spanish flow
      const spanishStyle = 'BALANCEADO';
      const spanishLang = 'es-MX';
      const platform = 'X';

      const normalizedStyle = normalizeStyle(spanishStyle);
      const normalizedLang = normalizeLanguage(spanishLang);
      const normalizedPlatform = normalizePlatform(platform);

      expect(normalizedStyle).toBe('balanceado');
      expect(normalizedLang).toBe('es');
      expect(normalizedPlatform).toBe('twitter');

      expect(isValidStyle(normalizedStyle, normalizedLang)).toBe(true);
      expect(isValidLanguage(spanishLang)).toBe(true);
      expect(isValidPlatform(platform)).toBe(true);
    });

    test('should handle mixed case and whitespace in validation chain', () => {
      const style = '  LIGHT  ';
      const language = '  EN-US  ';
      const platform = '  TWITTER  ';

      expect(isValidStyle(style, language)).toBe(true);
      expect(isValidLanguage(language)).toBe(true);
      expect(isValidPlatform(platform)).toBe(true);
    });

    test('should reject invalid combinations', () => {
      // Spanish style with English language should fail
      expect(isValidStyle('balanceado', 'en')).toBe(false);

      // English style with Spanish language should fail
      expect(isValidStyle('light', 'es')).toBe(false);

      // Invalid platform should fail
      expect(isValidPlatform('invalid-platform')).toBe(false);
    });
  });

  describe('Performance and edge cases', () => {
    test('should handle empty strings consistently', () => {
      expect(normalizeStyle('')).toBeNull();
      expect(normalizeLanguage('')).toBe('es'); // Uses default
      expect(normalizePlatform('')).toBe('twitter'); // Uses default
    });

    test('should handle special characters', () => {
      expect(normalizeStyle('bałanceado')).toBe('bałanceado');
      expect(normalizeLanguage('es-419')).toBe('es'); // Latin America code
    });

    test('should handle very long inputs', () => {
      const longString = 'a'.repeat(1000);
      expect(normalizeStyle(longString)).toBe(longString);
      expect(normalizeLanguage(longString)).toBe(longString);
    });

    test('should handle non-string inputs gracefully', () => {
      expect(normalizeStyle(123)).toBe('123');
      expect(normalizeLanguage(456)).toBe('456');
      expect(normalizePlatform(789)).toBe('789');
    });
  });
});
