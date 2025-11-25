/**
 * Centralized tone configuration
 * Single source of truth for response tone styles and backend validation
 *
 * Issue #973: Centralize tone enum to prevent duplication and drift
 *
 * This module exports:
 * - TONE_DEFINITIONS: Core tone definitions with metadata
 * - VALID_TONES: Canonical tone IDs (Flanders, Balanceado, Canalla)
 * - VALID_TONES_WITH_ALIASES: All valid inputs including aliases (for validation)
 * - TONE_DISPLAY_NAMES: Human-readable names per language
 * - TONE_DESCRIPTIONS: Descriptions per language
 * - normalizeTone(): Normalize any valid input to canonical form
 * - isValidTone(): Validate if a tone is valid
 */

// Core tone definitions with examples and descriptions - Frozen to prevent mutation
const TONE_DEFINITIONS = Object.freeze({
  FLANDERS: Object.freeze({
    id: 'Flanders',
    name: 'Flanders',
    description: 'Suave y amigable',
    descriptionEn: 'Gentle wit with subtle irony',
    intensity: 2,
    example: '"¡Vaya, qué comentario tan... creativo! 😄"'
  }),
  BALANCEADO: Object.freeze({
    id: 'Balanceado',
    name: 'Balanceado',
    description: 'Equilibrado y constructivo',
    descriptionEn: 'Perfect mix of humor and firmness',
    intensity: 3,
    example: '"Interesante perspectiva, aunque creo que se podría mejorar un poco."'
  }),
  CANALLA: Object.freeze({
    id: 'Canalla',
    name: 'Canalla',
    description: 'Directo y agresivo',
    descriptionEn: 'Direct and unfiltered, maximum impact',
    intensity: 4,
    example:
      '"¿En serio? Ese comentario necesita una ambulancia porque acaba de sufrir un accidente cerebrovascular."'
  })
});

// Array of valid tone IDs (canonical form) - Frozen to prevent mutation
const VALID_TONES = Object.freeze(Object.values(TONE_DEFINITIONS).map((tone) => tone.id));

/**
 * All valid tone inputs including aliases
 * Used for validation that accepts both canonical and alias forms
 * Issue #973: Single source of truth for all valid tone strings
 */
const VALID_TONES_WITH_ALIASES = Object.freeze([
  // Canonical forms (PascalCase)
  'Flanders',
  'Balanceado',
  'Canalla',
  // Lowercase aliases
  'flanders',
  'balanceado',
  'canalla',
  // English aliases
  'light',
  'balanced',
  'savage'
]);

/**
 * Tone display names for UI
 * Issue #973: Centralized display names per language
 */
const TONE_DISPLAY_NAMES = Object.freeze({
  es: Object.freeze({
    Flanders: 'Flanders',
    flanders: 'Flanders',
    light: 'Flanders',
    Balanceado: 'Balanceado',
    balanceado: 'Balanceado',
    balanced: 'Balanceado',
    Canalla: 'Canalla',
    canalla: 'Canalla',
    savage: 'Canalla'
  }),
  en: Object.freeze({
    Flanders: 'Light',
    flanders: 'Light',
    light: 'Light',
    Balanceado: 'Balanced',
    balanceado: 'Balanced',
    balanced: 'Balanced',
    Canalla: 'Savage',
    canalla: 'Savage',
    savage: 'Savage'
  })
});

/**
 * Tone descriptions for tooltips/help
 * Issue #973: Centralized descriptions per language
 */
const TONE_DESCRIPTIONS = Object.freeze({
  es: Object.freeze({
    Flanders: 'Tono amable pero con ironía sutil (2/5)',
    Balanceado: 'Equilibrio entre ingenio y firmeza (3/5)',
    Canalla: 'Directo y sin filtros, más picante (4/5)'
  }),
  en: Object.freeze({
    Flanders: 'Gentle wit with subtle irony (2/5)',
    Balanceado: 'Perfect mix of humor and firmness (3/5)',
    Canalla: 'Direct and unfiltered, maximum impact (4/5)'
  })
});

/**
 * Complete normalization map for all valid inputs to canonical form
 * Issue #973: Single source of truth for tone normalization
 */
const TONE_NORMALIZATION_MAP = Object.freeze({
  // Canonical forms
  Flanders: 'Flanders',
  Balanceado: 'Balanceado',
  Canalla: 'Canalla',
  // Lowercase
  flanders: 'Flanders',
  balanceado: 'Balanceado',
  canalla: 'Canalla',
  // English aliases
  light: 'Flanders',
  balanced: 'Balanceado',
  savage: 'Canalla'
});

/**
 * Normalize tone to canonical form - Ultra-optimized for performance
 * Uses single map with input trimming for O(1) lookups
 * Issue #973: Updated to use centralized TONE_NORMALIZATION_MAP
 *
 * @param {string} tone - Input tone (any case, may have whitespace)
 * @returns {string|null} - Canonical tone or null if invalid
 */
function normalizeTone(tone) {
  if (!tone || typeof tone !== 'string') {
    return null;
  }

  // Trim whitespace
  const trimmed = tone.trim();

  if (!trimmed) {
    return null;
  }

  // Try exact match first (handles PascalCase canonical forms)
  if (TONE_NORMALIZATION_MAP[trimmed]) {
    return TONE_NORMALIZATION_MAP[trimmed];
  }

  // Try lowercase match for case-insensitive lookup
  const lowercase = trimmed.toLowerCase();
  return TONE_NORMALIZATION_MAP[lowercase] || null;
}

/**
 * Validate if a tone is valid - Hardened against non-string inputs
 * @param {string} tone - Tone to validate
 * @param {boolean} strict - If true, only accepts canonical form
 * @returns {boolean}
 */
function isValidTone(tone, strict = false) {
  // Harden against non-string inputs in strict mode
  if (strict) {
    return typeof tone === 'string' && VALID_TONES.includes(tone);
  }
  return normalizeTone(tone) !== null;
}

/**
 * Get random tone from valid options
 * @returns {string} - Random valid tone
 */
function getRandomTone() {
  return VALID_TONES[Math.floor(Math.random() * VALID_TONES.length)];
}

/**
 * Get tone examples for frontend
 * @returns {Object} Map of tone ID to example
 */
function getToneExamples() {
  return Object.values(TONE_DEFINITIONS).reduce((acc, tone) => {
    acc[tone.id] = tone.example;
    return acc;
  }, {});
}

/**
 * Get display name for a tone in specified language
 * Issue #973: Centralized display name lookup
 *
 * @param {string} tone - Tone (canonical or alias)
 * @param {string} lang - Language code ('es' or 'en')
 * @returns {string} - Display name or canonical tone if not found
 */
function getToneDisplayName(tone, lang = 'es') {
  const normalized = normalizeTone(tone);
  if (!normalized) return tone;

  const displayNames = TONE_DISPLAY_NAMES[lang] || TONE_DISPLAY_NAMES.es;
  return displayNames[normalized] || normalized;
}

/**
 * Get description for a tone in specified language
 * Issue #973: Centralized description lookup
 *
 * @param {string} tone - Tone (canonical or alias)
 * @param {string} lang - Language code ('es' or 'en')
 * @returns {string} - Description or empty string if not found
 */
function getToneDescription(tone, lang = 'es') {
  const normalized = normalizeTone(tone);
  if (!normalized) return '';

  const descriptions = TONE_DESCRIPTIONS[lang] || TONE_DESCRIPTIONS.es;
  return descriptions[normalized] || '';
}

/**
 * Get intensity level for a tone (1-5 scale)
 * Issue #973: Centralized intensity lookup
 *
 * @param {string} tone - Tone (canonical or alias)
 * @returns {number} - Intensity level (2-4) or 3 as default
 */
function getToneIntensity(tone) {
  const normalized = normalizeTone(tone);
  if (!normalized) return 3; // Default to balanced intensity

  const definition = Object.values(TONE_DEFINITIONS).find((d) => d.id === normalized);
  return definition ? definition.intensity : 3;
}

module.exports = Object.freeze({
  // Constants
  TONE_DEFINITIONS,
  VALID_TONES,
  VALID_TONES_WITH_ALIASES,
  TONE_DISPLAY_NAMES,
  TONE_DESCRIPTIONS,
  TONE_NORMALIZATION_MAP,
  // Functions
  normalizeTone,
  isValidTone,
  getRandomTone,
  getToneExamples,
  getToneDisplayName,
  getToneDescription,
  getToneIntensity
});
