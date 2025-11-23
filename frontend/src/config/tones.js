/**
 * Centralized tone configuration for frontend
 * Synchronized with backend tone definitions
 */

// Core tone definitions
export const TONE_DEFINITIONS = {
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
    example:
      '"¿En serio? Ese comentario necesita una ambulancia porque acaba de sufrir un accidente cerebrovascular."'
  }
};

// Array of valid tone IDs (canonical form)
export const VALID_TONES = Object.values(TONE_DEFINITIONS).map((tone) => tone.id);

// Tone options for dropdowns
export const TONE_OPTIONS = VALID_TONES;

// Tone examples map
export const TONE_EXAMPLES = Object.values(TONE_DEFINITIONS).reduce((acc, tone) => {
  acc[tone.id] = tone.example;
  return acc;
}, {});

// Get random tone
export const getRandomTone = () => {
  return VALID_TONES[Math.floor(Math.random() * VALID_TONES.length)];
};

// Default tone
export const DEFAULT_TONE = 'Balanceado';
