/**
 * Centralized tone configuration
 * Single source of truth for response tone styles
 */

// Core tone definitions
const TONE_DEFINITIONS = {
  FLANDERS: {
    id: 'Flanders',
    name: 'Flanders',
    description: 'Suave y amigable',
    example: '"¡Vaya, qué comentario tan... creativo! 😄"'
  },
  BALANCEADO: {
    id: 'Balanceado',
    name: 'Balanceado',
    description: 'Equilibrado y constructivo',
    example: '"Interesante perspectiva, aunque creo que se podría mejorar un poco."'
  },
  CANALLA: {
    id: 'Canalla',
    name: 'Canalla',
    description: 'Directo y agresivo',
    example: '"¿En serio? Ese comentario necesita una ambulancia porque acaba de sufrir un accidente cerebrovascular."'
  }
};

// Array of valid tone IDs
const VALID_TONES = Object.values(TONE_DEFINITIONS).map(tone => tone.id);

// Mapping for case-insensitive validation
const TONE_MAP = {
  // Lowercase mappings
  'flanders': 'Flanders',
  'balanceado': 'Balanceado',
  'canalla': 'Canalla',
  // Uppercase mappings
  'FLANDERS': 'Flanders',
  'BALANCEADO': 'Balanceado',
  'CANALLA': 'Canalla',
  // Canonical mappings (identity)
  'Flanders': 'Flanders',
  'Balanceado': 'Balanceado',
  'Canalla': 'Canalla'
};

/**
 * Normalize tone to canonical form
 * @param {string} tone - Tone in any case
 * @returns {string|null} Canonical tone or null if invalid
 */
function normalizeTone(tone) {
  if (!tone || typeof tone !== 'string') {
    return null;
  }
  return TONE_MAP[tone] || TONE_MAP[tone.toLowerCase()] || null;
}

/**
 * Validate if a tone is valid
 * @param {string} tone - Tone to validate
 * @param {boolean} strict - If true, only accepts canonical form
 * @returns {boolean}
 */
function isValidTone(tone, strict = false) {
  if (strict) {
    return VALID_TONES.includes(tone);
  }
  return normalizeTone(tone) !== null;
}

/**
 * Get random tone
 * @returns {string} Random canonical tone
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

module.exports = {
  TONE_DEFINITIONS,
  VALID_TONES,
  TONE_MAP,
  normalizeTone,
  isValidTone,
  getRandomTone,
  getToneExamples
};