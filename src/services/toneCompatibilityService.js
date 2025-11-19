/**
 * Tone Compatibility Service
 * 
 * Issue #872: Provides backward compatibility layer for transitioning from
 * legacy system (humor_type + intensity_level) to new 3-tone system
 * (flanders, balanceado, canalla).
 * 
 * This service ensures that all existing code continues to work while
 * gradually migrating to the new system.
 */

const { logger } = require('../utils/logger');

class ToneCompatibilityService {
  constructor() {
    this.deprecationWarningsLogged = new Set();
  }

  /**
   * Map legacy config (humor_type + intensity_level) to new tone
   * 
   * Issue #872: This allows old code to continue working by automatically
   * converting legacy parameters to new tone IDs.
   * 
   * @param {Object} config - Legacy config
   * @param {string} config.humor_type - Legacy humor type (witty/clever/playful/sarcastic)
   * @param {number} config.intensity_level - Legacy intensity (1-5)
   * @param {string} config.tone - New tone (if already using new system)
   * @param {string} config.style - Voice style (flanders/balanceado/canalla)
   * @returns {string} New tone ID (flanders/balanceado/canalla)
   */
  mapLegacyToNewTone(config = {}) {
    // If already using new tone system, return it
    if (config.tone && this.isValidNewTone(config.tone)) {
      return config.tone;
    }

    // If using voice style, map it directly
    if (config.style) {
      const styleToTone = {
        'flanders': 'flanders',
        'light': 'flanders',
        'balanceado': 'balanceado',
        'balanced': 'balanceado',
        'canalla': 'canalla',
        'savage': 'canalla'
      };
      if (styleToTone[config.style]) {
        return styleToTone[config.style];
      }
    }

    // Map legacy humor_type + intensity_level to new tone
    const humor_type = config.humor_type || 'witty';
    const intensity_level = config.intensity_level || 3;

    // Log deprecation warning (only once per combination)
    const key = `${humor_type}_${intensity_level}`;
    if (!this.deprecationWarningsLogged.has(key)) {
      logger.warn('DEPRECATION: humor_type and intensity_level are deprecated. Use tone instead.', {
        humor_type,
        intensity_level,
        new_tone: this.getLegacyMapping(humor_type, intensity_level),
        migration_guide: 'https://github.com/roastr-ai/roastr-ai/issues/872'
      });
      this.deprecationWarningsLogged.add(key);
    }

    return this.getLegacyMapping(humor_type, intensity_level);
  }

  /**
   * Get new tone from legacy humor_type + intensity_level combination
   * @private
   */
  getLegacyMapping(humor_type, intensity_level) {
    // Intensity determines base tone
    // 1-2 → Flanders (gentle)
    // 3   → Balanceado (balanced)
    // 4-5 → Canalla (savage)
    
    if (intensity_level <= 2) {
      return 'flanders';
    } else if (intensity_level >= 4) {
      return 'canalla';
    } else {
      // intensity 3 - check humor_type for fine-tuning
      const aggressiveTypes = ['sarcastic', 'direct', 'savage'];
      const gentleTypes = ['playful', 'subtle', 'light'];
      
      if (aggressiveTypes.includes(humor_type)) {
        return 'canalla';
      } else if (gentleTypes.includes(humor_type)) {
        return 'flanders';
      }
      
      return 'balanceado'; // Default for intensity 3
    }
  }

  /**
   * Map new tone back to legacy format (for APIs that still return legacy)
   * 
   * @param {string} tone - New tone ID (flanders/balanceado/canalla)
   * @returns {Object} Legacy format { humor_type, intensity_level }
   */
  mapNewToneToLegacy(tone) {
    const legacyMap = {
      'flanders': { humor_type: 'witty', intensity_level: 2 },
      'light': { humor_type: 'witty', intensity_level: 2 },
      'balanceado': { humor_type: 'sarcastic', intensity_level: 3 },
      'balanced': { humor_type: 'sarcastic', intensity_level: 3 },
      'canalla': { humor_type: 'direct', intensity_level: 4 },
      'savage': { humor_type: 'direct', intensity_level: 4 }
    };

    return legacyMap[tone] || { humor_type: 'witty', intensity_level: 3 };
  }

  /**
   * Normalize config to ensure it has a valid tone
   * 
   * This is the main entry point for all code that needs to work with tones.
   * It accepts any combination of old/new parameters and returns normalized config.
   * 
   * @param {Object} config - Input config (may have tone, style, humor_type, or intensity_level)
   * @returns {Object} Normalized config with tone
   */
  normalizeConfig(config = {}) {
    const tone = this.mapLegacyToNewTone(config);
    const legacy = this.mapNewToneToLegacy(tone);

    return {
      // New system (primary)
      tone,
      // Legacy system (for backward compatibility)
      humor_type: config.humor_type || legacy.humor_type,
      intensity_level: config.intensity_level || legacy.intensity_level,
      // Preserve other config
      ...config
    };
  }

  /**
   * Check if a tone is valid in the new 3-tone system
   * @param {string} tone - Tone to check
   * @returns {boolean} True if valid
   */
  isValidNewTone(tone) {
    const validTones = ['flanders', 'light', 'balanceado', 'balanced', 'canalla', 'savage'];
    return validTones.includes(tone);
  }

  /**
   * Get intensity level for a tone (for display purposes)
   * @param {string} tone - New tone ID
   * @returns {number} Intensity (1-5)
   */
  getToneIntensity(tone) {
    const intensityMap = {
      'flanders': 2,
      'light': 2,
      'balanceado': 3,
      'balanced': 3,
      'canalla': 4,
      'savage': 4
    };
    return intensityMap[tone] || 3;
  }

  /**
   * Get display name for tone
   * @param {string} tone - Tone ID
   * @param {string} language - Language (es/en)
   * @returns {string} Display name
   */
  getToneDisplayName(tone, language = 'es') {
    const displayNames = {
      es: {
        'flanders': 'Flanders',
        'light': 'Flanders',
        'balanceado': 'Balanceado',
        'balanced': 'Balanceado',
        'canalla': 'Canalla',
        'savage': 'Canalla'
      },
      en: {
        'flanders': 'Light',
        'light': 'Light',
        'balanceado': 'Balanced',
        'balanced': 'Balanced',
        'canalla': 'Savage',
        'savage': 'Savage'
      }
    };
    return displayNames[language]?.[tone] || tone;
  }
}

// Singleton instance
const toneCompatibilityService = new ToneCompatibilityService();

module.exports = toneCompatibilityService;

