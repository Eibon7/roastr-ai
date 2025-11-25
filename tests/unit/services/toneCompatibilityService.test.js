/**
 * Tests for Tone Compatibility Service (Issue #872)
 *
 * Ensures backward compatibility during migration from legacy
 * (humor_type + intensity_level) to new 3-tone system
 */

const toneCompatibilityService = require('../../../src/services/toneCompatibilityService');

describe('ToneCompatibilityService - Issue #872', () => {
  describe('Legacy to New Tone Mapping', () => {
    test('should map low intensity to flanders', () => {
      const config = { humor_type: 'witty', intensity_level: 1 };
      const tone = toneCompatibilityService.mapLegacyToNewTone(config);
      expect(tone).toBe('flanders');
    });

    test('should map medium intensity to balanceado', () => {
      const config = { humor_type: 'witty', intensity_level: 3 };
      const tone = toneCompatibilityService.mapLegacyToNewTone(config);
      expect(tone).toBe('balanceado');
    });

    test('should map high intensity to canalla', () => {
      const config = { humor_type: 'direct', intensity_level: 5 };
      const tone = toneCompatibilityService.mapLegacyToNewTone(config);
      expect(tone).toBe('canalla');
    });

    test('should map sarcastic humor_type with intensity 3 to canalla', () => {
      const config = { humor_type: 'sarcastic', intensity_level: 3 };
      const tone = toneCompatibilityService.mapLegacyToNewTone(config);
      expect(tone).toBe('canalla');
    });

    test('should map playful humor_type with intensity 3 to flanders', () => {
      const config = { humor_type: 'playful', intensity_level: 3 };
      const tone = toneCompatibilityService.mapLegacyToNewTone(config);
      expect(tone).toBe('flanders');
    });

    test('should use defaults when no config provided', () => {
      const tone = toneCompatibilityService.mapLegacyToNewTone({});
      expect(tone).toBe('balanceado');
    });
  });

  describe('New Tone to Legacy Mapping', () => {
    test('should map flanders to legacy format', () => {
      const legacy = toneCompatibilityService.mapNewToneToLegacy('flanders');
      expect(legacy).toEqual({
        humor_type: 'witty',
        intensity_level: 2
      });
    });

    test('should map balanceado to legacy format', () => {
      const legacy = toneCompatibilityService.mapNewToneToLegacy('balanceado');
      expect(legacy).toEqual({
        humor_type: 'sarcastic',
        intensity_level: 3
      });
    });

    test('should map canalla to legacy format', () => {
      const legacy = toneCompatibilityService.mapNewToneToLegacy('canalla');
      expect(legacy).toEqual({
        humor_type: 'direct',
        intensity_level: 4
      });
    });

    test('should handle EN aliases', () => {
      expect(toneCompatibilityService.mapNewToneToLegacy('light')).toEqual({
        humor_type: 'witty',
        intensity_level: 2
      });
      expect(toneCompatibilityService.mapNewToneToLegacy('balanced')).toEqual({
        humor_type: 'sarcastic',
        intensity_level: 3
      });
      expect(toneCompatibilityService.mapNewToneToLegacy('savage')).toEqual({
        humor_type: 'direct',
        intensity_level: 4
      });
    });
  });

  describe('Config Normalization', () => {
    test('should normalize config with new tone', () => {
      const normalized = toneCompatibilityService.normalizeConfig({
        tone: 'canalla'
      });

      expect(normalized.tone).toBe('canalla');
      expect(normalized.humor_type).toBe('direct');
      expect(normalized.intensity_level).toBe(4);
    });

    test('should normalize config with legacy parameters', () => {
      const normalized = toneCompatibilityService.normalizeConfig({
        humor_type: 'playful',
        intensity_level: 2
      });

      expect(normalized.tone).toBe('flanders');
      expect(normalized.humor_type).toBe('playful');
      expect(normalized.intensity_level).toBe(2);
    });

    test('should normalize config with style parameter', () => {
      const normalized = toneCompatibilityService.normalizeConfig({
        style: 'balanceado'
      });

      expect(normalized.tone).toBe('balanceado');
      expect(normalized.humor_type).toBe('sarcastic');
      expect(normalized.intensity_level).toBe(3);
    });

    test('should preserve other config properties', () => {
      const normalized = toneCompatibilityService.normalizeConfig({
        tone: 'flanders',
        language: 'es',
        platform: 'twitter',
        custom: 'value'
      });

      expect(normalized.language).toBe('es');
      expect(normalized.platform).toBe('twitter');
      expect(normalized.custom).toBe('value');
    });

    test('should prefer explicit tone over legacy params', () => {
      const normalized = toneCompatibilityService.normalizeConfig({
        tone: 'flanders',
        humor_type: 'direct', // Conflicting
        intensity_level: 5 // Conflicting
      });

      // Should use explicit tone, not legacy
      expect(normalized.tone).toBe('flanders');
    });
  });

  describe('Tone Validation', () => {
    test('should validate new tones (ES)', () => {
      expect(toneCompatibilityService.isValidNewTone('flanders')).toBe(true);
      expect(toneCompatibilityService.isValidNewTone('balanceado')).toBe(true);
      expect(toneCompatibilityService.isValidNewTone('canalla')).toBe(true);
    });

    test('should validate new tones (EN)', () => {
      expect(toneCompatibilityService.isValidNewTone('light')).toBe(true);
      expect(toneCompatibilityService.isValidNewTone('balanced')).toBe(true);
      expect(toneCompatibilityService.isValidNewTone('savage')).toBe(true);
    });

    test('should reject invalid tones', () => {
      expect(toneCompatibilityService.isValidNewTone('invalid')).toBe(false);
      expect(toneCompatibilityService.isValidNewTone('witty')).toBe(false);
      expect(toneCompatibilityService.isValidNewTone('direct')).toBe(false);
    });
  });

  describe('Tone Intensity', () => {
    test('should return correct intensity for each tone', () => {
      expect(toneCompatibilityService.getToneIntensity('flanders')).toBe(2);
      expect(toneCompatibilityService.getToneIntensity('balanceado')).toBe(3);
      expect(toneCompatibilityService.getToneIntensity('canalla')).toBe(4);
    });

    test('should handle EN aliases', () => {
      expect(toneCompatibilityService.getToneIntensity('light')).toBe(2);
      expect(toneCompatibilityService.getToneIntensity('balanced')).toBe(3);
      expect(toneCompatibilityService.getToneIntensity('savage')).toBe(4);
    });

    test('should default to 3 for unknown tones', () => {
      expect(toneCompatibilityService.getToneIntensity('unknown')).toBe(3);
    });
  });

  describe('Display Names', () => {
    test('should return ES display names', () => {
      expect(toneCompatibilityService.getToneDisplayName('flanders', 'es')).toBe('Flanders');
      expect(toneCompatibilityService.getToneDisplayName('balanceado', 'es')).toBe('Balanceado');
      expect(toneCompatibilityService.getToneDisplayName('canalla', 'es')).toBe('Canalla');
    });

    test('should return EN display names', () => {
      expect(toneCompatibilityService.getToneDisplayName('flanders', 'en')).toBe('Light');
      expect(toneCompatibilityService.getToneDisplayName('balanceado', 'en')).toBe('Balanced');
      expect(toneCompatibilityService.getToneDisplayName('canalla', 'en')).toBe('Savage');
    });

    test('should handle EN tone IDs', () => {
      expect(toneCompatibilityService.getToneDisplayName('light', 'en')).toBe('Light');
      expect(toneCompatibilityService.getToneDisplayName('balanced', 'en')).toBe('Balanced');
      expect(toneCompatibilityService.getToneDisplayName('savage', 'en')).toBe('Savage');
    });

    test('should default to ES for unknown language', () => {
      // Issue #973: Now returns Spanish display name as fallback for unknown language
      expect(toneCompatibilityService.getToneDisplayName('flanders', 'fr')).toBe('Flanders');
    });
  });

  // Issue #972: Tests for normalizeTone() method
  describe('normalizeTone() - Issue #972', () => {
    describe('Valid canonical tones (ES)', () => {
      test('should return flanders for "flanders"', () => {
        expect(toneCompatibilityService.normalizeTone('flanders')).toBe('flanders');
      });

      test('should return balanceado for "balanceado"', () => {
        expect(toneCompatibilityService.normalizeTone('balanceado')).toBe('balanceado');
      });

      test('should return canalla for "canalla"', () => {
        expect(toneCompatibilityService.normalizeTone('canalla')).toBe('canalla');
      });
    });

    describe('Valid alias tones (EN)', () => {
      test('should normalize "light" to "flanders"', () => {
        expect(toneCompatibilityService.normalizeTone('light')).toBe('flanders');
      });

      test('should normalize "balanced" to "balanceado"', () => {
        expect(toneCompatibilityService.normalizeTone('balanced')).toBe('balanceado');
      });

      test('should normalize "savage" to "canalla"', () => {
        expect(toneCompatibilityService.normalizeTone('savage')).toBe('canalla');
      });
    });

    describe('Case insensitivity', () => {
      test('should normalize uppercase tones', () => {
        expect(toneCompatibilityService.normalizeTone('FLANDERS')).toBe('flanders');
        expect(toneCompatibilityService.normalizeTone('BALANCEADO')).toBe('balanceado');
        expect(toneCompatibilityService.normalizeTone('CANALLA')).toBe('canalla');
      });

      test('should normalize mixed case tones', () => {
        expect(toneCompatibilityService.normalizeTone('Flanders')).toBe('flanders');
        expect(toneCompatibilityService.normalizeTone('BalanceAdo')).toBe('balanceado');
        expect(toneCompatibilityService.normalizeTone('SaVaGe')).toBe('canalla');
      });

      test('should normalize mixed case aliases', () => {
        expect(toneCompatibilityService.normalizeTone('Light')).toBe('flanders');
        expect(toneCompatibilityService.normalizeTone('Balanced')).toBe('balanceado');
        expect(toneCompatibilityService.normalizeTone('Savage')).toBe('canalla');
      });
    });

    describe('Whitespace handling', () => {
      test('should trim leading whitespace', () => {
        expect(toneCompatibilityService.normalizeTone('  flanders')).toBe('flanders');
        expect(toneCompatibilityService.normalizeTone('  savage')).toBe('canalla');
      });

      test('should trim trailing whitespace', () => {
        expect(toneCompatibilityService.normalizeTone('flanders  ')).toBe('flanders');
        expect(toneCompatibilityService.normalizeTone('light  ')).toBe('flanders');
      });

      test('should trim both leading and trailing whitespace', () => {
        expect(toneCompatibilityService.normalizeTone('  balanceado  ')).toBe('balanceado');
        expect(toneCompatibilityService.normalizeTone('  balanced  ')).toBe('balanceado');
      });
    });

    describe('Invalid tones', () => {
      test('should return null for invalid tone', () => {
        expect(toneCompatibilityService.normalizeTone('invalid')).toBeNull();
      });

      test('should return null for legacy humor_type values', () => {
        expect(toneCompatibilityService.normalizeTone('witty')).toBeNull();
        expect(toneCompatibilityService.normalizeTone('sarcastic')).toBeNull();
        expect(toneCompatibilityService.normalizeTone('direct')).toBeNull();
        expect(toneCompatibilityService.normalizeTone('playful')).toBeNull();
      });

      test('should return null for random strings', () => {
        expect(toneCompatibilityService.normalizeTone('random')).toBeNull();
        expect(toneCompatibilityService.normalizeTone('foobar')).toBeNull();
        expect(toneCompatibilityService.normalizeTone('test')).toBeNull();
      });
    });

    describe('Null/undefined/empty handling', () => {
      test('should return null for null input', () => {
        expect(toneCompatibilityService.normalizeTone(null)).toBeNull();
      });

      test('should return null for undefined input', () => {
        expect(toneCompatibilityService.normalizeTone(undefined)).toBeNull();
      });

      test('should return null for empty string', () => {
        expect(toneCompatibilityService.normalizeTone('')).toBeNull();
      });

      test('should return null for whitespace-only string', () => {
        expect(toneCompatibilityService.normalizeTone('   ')).toBeNull();
      });

      test('should return null for non-string types', () => {
        expect(toneCompatibilityService.normalizeTone(123)).toBeNull();
        expect(toneCompatibilityService.normalizeTone({})).toBeNull();
        expect(toneCompatibilityService.normalizeTone([])).toBeNull();
      });
    });
  });

  describe('Backward Compatibility Scenarios', () => {
    test('should handle old API call with humor_type only', () => {
      const normalized = toneCompatibilityService.normalizeConfig({
        humor_type: 'witty'
      });

      expect(normalized.tone).toBe('balanceado'); // Default intensity 3
      expect(normalized.humor_type).toBe('witty');
    });

    test('should handle old API call with intensity_level only', () => {
      const normalized = toneCompatibilityService.normalizeConfig({
        intensity_level: 2
      });

      expect(normalized.tone).toBe('flanders'); // Intensity 2 → flanders
      expect(normalized.intensity_level).toBe(2);
    });

    test('should handle completely empty config', () => {
      const normalized = toneCompatibilityService.normalizeConfig();

      expect(normalized.tone).toBe('balanceado'); // Default
      expect(normalized.humor_type).toBe('sarcastic'); // Default from balanceado mapping
      expect(normalized.intensity_level).toBe(3); // Default
    });
  });
});
