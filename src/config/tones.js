/**
 * Centralized tone configuration
 * Single source of truth for response tone styles and backend validation
 */

// Core tone definitions with examples and descriptions
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

// Array of valid tone IDs (canonical form)
const VALID_TONES = Object.values(TONE_DEFINITIONS).map(tone => tone.id);

// Pre-computed tone mapping for O(1) lookup performance
// Includes all possible case variations to avoid runtime string operations
const TONE_MAP = {
  // Canonical forms (identity mapping)
  'Flanders': 'Flanders',
  'Balanceado': 'Balanceado',
  'Canalla': 'Canalla',
  
  // Lowercase forms (from Admin UI and API)
  'flanders': 'Flanders',
  'balanceado': 'Balanceado',
  'canalla': 'Canalla',
  
  // Uppercase forms
  'FLANDERS': 'Flanders',
  'BALANCEADO': 'Balanceado',
  'CANALLA': 'Canalla',
  
  // Mixed case variations
  'FlAnDeRs': 'Flanders',
  'BaLaNcEaDo': 'Balanceado',
  'CaNaLlA': 'Canalla'
};

// Pre-computed lowercase map for faster case-insensitive lookups
const TONE_MAP_LOWERCASE = Object.keys(TONE_MAP).reduce((map, key) => {
  map[key.toLowerCase()] = TONE_MAP[key];
  return map;
}, {});

/**
 * Normalize tone to canonical form - Optimized for performance
 * Uses pre-computed maps for O(1) lookups instead of string iterations
 * @param {string} tone - Input tone (any case)
 * @returns {string|null} - Canonical tone or null if invalid
 */
function normalizeTone(tone) {
  if (!tone || typeof tone !== 'string') {
    return null;
  }
  
  // Direct lookup first (fastest path)
  if (TONE_MAP[tone]) {
    return TONE_MAP[tone];
  }
  
  // Case-insensitive lookup using pre-computed lowercase map
  return TONE_MAP_LOWERCASE[tone.toLowerCase()] || null;
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

module.exports = {
  TONE_DEFINITIONS,
  VALID_TONES,
  TONE_MAP,
  normalizeTone,
  isValidTone,
  getRandomTone,
  getToneExamples
};