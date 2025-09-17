/**
 * Centralized tone configuration
 * Single source of truth for response tone styles and backend validation
 */

// Core tone definitions with examples and descriptions - Frozen to prevent mutation
const TONE_DEFINITIONS = Object.freeze({
  FLANDERS: Object.freeze({
    id: 'Flanders',
    name: 'Flanders',
    description: 'Suave y amigable',
    example: '"¡Vaya, qué comentario tan... creativo! 😄"'
  }),
  BALANCEADO: Object.freeze({
    id: 'Balanceado',
    name: 'Balanceado',
    description: 'Equilibrado y constructivo',
    example: '"Interesante perspectiva, aunque creo que se podría mejorar un poco."'
  }),
  CANALLA: Object.freeze({
    id: 'Canalla',
    name: 'Canalla',
    description: 'Directo y agresivo',
    example: '"¿En serio? Ese comentario necesita una ambulancia porque acaba de sufrir un accidente cerebrovascular."'
  })
});

// Array of valid tone IDs (canonical form) - Frozen to prevent mutation
const VALID_TONES = Object.freeze(Object.values(TONE_DEFINITIONS).map(tone => tone.id));

// Optimized tone normalization with minimal map and O(1) performance
// Only include canonical forms to reduce memory footprint
const TONE_MAP_CANONICAL = Object.freeze({
  'flanders': 'Flanders',
  'balanceado': 'Balanceado', 
  'canalla': 'Canalla'
});

/**
 * Normalize tone to canonical form - Ultra-optimized for performance
 * Uses single lowercase map with input trimming for O(1) lookups
 * @param {string} tone - Input tone (any case, may have whitespace)
 * @returns {string|null} - Canonical tone or null if invalid
 */
function normalizeTone(tone) {
  if (!tone || typeof tone !== 'string') {
    return null;
  }
  
  // Trim whitespace and convert to lowercase for single lookup
  const normalizedInput = tone.trim().toLowerCase();
  
  if (!normalizedInput) {
    return null;
  }
  
  // Single O(1) lookup in optimized map
  return TONE_MAP_CANONICAL[normalizedInput] || null;
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

module.exports = Object.freeze({
  TONE_DEFINITIONS,
  VALID_TONES,
  normalizeTone,
  isValidTone,
  getRandomTone,
  getToneExamples
});