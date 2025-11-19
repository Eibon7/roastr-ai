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
        intensity_level: 5    // Conflicting
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
      expect(toneCompatibilityService.getToneDisplayName('flanders', 'fr')).toBe('flanders');
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

