/**
 * Central constants for the RoastPromptTemplate system
 * 
 * Consolidates hardcoded values to improve maintainability
 * and performance across the roast generation system.
 * 
 * Issue #128: Centralize constants for better code organization
 */

// Template and versioning constants
const TEMPLATE_VERSION = 'v1-roast-prompt';
const DEFAULT_REFERENCE_COUNT = 3;
const MAX_INPUT_LENGTH = 2000;

// Cache and performance settings
const CSV_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
const WORD_MIN_LENGTH = 2; // Minimum word length for similarity matching
const CATEGORY_SCORE_BOOST = 5; // Points added for matching category

// Similarity algorithm constants
const SIMILARITY_SCORE_THRESHOLD = 0;
const DEFAULT_TONE = 'sarcastic';

// Platform constraints (character limits)
const PLATFORM_LIMITS = {
  twitter: { maxLength: 280 },
  instagram: { maxLength: 2200 },
  facebook: { maxLength: 63206 },
  linkedin: { maxLength: 3000 },
  tiktok: { maxLength: 2200 },
  youtube: { maxLength: 10000 },
  discord: { maxLength: 2000 },
  reddit: { maxLength: 40000 },
  bluesky: { maxLength: 300 },
  default: { maxLength: 1000 }
};

// Comment categories for classification
const COMMENT_CATEGORIES = {
  PERSONAL_ATTACK: 'ataque personal',
  BODY_SHAMING: 'body shaming', 
  SEXIST_COMMENT: 'comentario machista',
  RACIST_COMMENT: 'comentario racista',
  GENERIC_INSULT: 'insulto genérico',
  ABSURD_CLAIM: 'afirmación absurda',
  FAILED_MOCKERY: 'intento fallido de burla',
  UNFOUNDED_CRITICISM: 'crítica sin fundamento',
  POLITICAL_COMMENT: 'comentario político',
  SPAM_SELF_PROMOTION: 'spam o autopromición',
  GENERIC_NEGATIVE: 'comentario genérico negativo'
};

// Category detection patterns
const CATEGORY_PATTERNS = {
  [COMMENT_CATEGORIES.PERSONAL_ATTACK]: /\b(eres|pareces|tienes cara de|tu madre|tu familia)\b/i,
  [COMMENT_CATEGORIES.BODY_SHAMING]: /\b(gordo|flaco|feo|nariz|peso|cuerpo|físico)\b/i,
  [COMMENT_CATEGORIES.SEXIST_COMMENT]: /\b(mujer|mujeres|feminazi|cocina|débil)\b/i,
  [COMMENT_CATEGORIES.RACIST_COMMENT]: /\b(raza|color|negro|blanco|extranjero|inmigrante)\b/i,
  [COMMENT_CATEGORIES.GENERIC_INSULT]: /\b(idiota|estúpido|tonto|imbécil|basura|mierda)\b/i,
  [COMMENT_CATEGORIES.ABSURD_CLAIM]: /\b(tierra plana|5g|chips|conspiración|illuminati)\b/i,
  [COMMENT_CATEGORIES.FAILED_MOCKERY]: /\b(jaja|lol|xd|😂|🤣)\b/i,
  [COMMENT_CATEGORIES.UNFOUNDED_CRITICISM]: /\b(malo|horrible|peor|basura|no sirve)\b/i,
  [COMMENT_CATEGORIES.POLITICAL_COMMENT]: /\b(izquierda|derecha|político|gobierno|presidente)\b/i,
  [COMMENT_CATEGORIES.SPAM_SELF_PROMOTION]: /\b(sígueme|suscríbete|link|vendo|compra)\b/i
};

// Toxicity category mappings
const TOXICITY_CATEGORY_MAP = {
  TOXICITY: 'comentario tóxico general',
  SEVERE_TOXICITY: 'comentario severamente tóxico', 
  IDENTITY_ATTACK: 'ataque de identidad',
  INSULT: 'insulto directo',
  PROFANITY: 'lenguaje vulgar',
  THREAT: 'amenaza'
};

// Tone mapping configurations
// Issue #868: Solo mantener tonos oficiales (Flanders, Balanceado, Canalla)
// Eliminado: Humor Type (witty, clever, playful) - redundante con Style Profile
const TONE_MAP = {
  flanders: 'amable pero irónico, tono sutil',
  balanceado: 'equilibrio entre ingenio y firmeza',
  canalla: 'directo y sin filtros, más picante',
  // Legacy tonos (mantener por compatibilidad temporal)
  sarcastic: 'sarcástico y cortante',
  ironic: 'irónico y sofisticado', 
  absurd: 'absurdo y surrealista'
};

// Tone guides for fallback prompts
const TONE_GUIDES = {
  sarcastic: 'sarcástico pero ingenioso',
  ironic: 'irónico y sutil',
  absurd: 'absurdo y creativo'
};

// Sanitization patterns for security
const SANITIZATION_PATTERNS = {
  DOUBLE_CURLY_OPEN: /\{\{/g,
  DOUBLE_CURLY_CLOSE: /\}\}/g,
  SINGLE_CURLY_OPEN: /\{/g,
  SINGLE_CURLY_CLOSE: /\}/g
};

const SANITIZATION_REPLACEMENTS = {
  DOUBLE_CURLY_OPEN: '(doble-llave-abierta)',
  DOUBLE_CURLY_CLOSE: '(doble-llave-cerrada)',
  SINGLE_CURLY_OPEN: '(llave-abierta)',
  SINGLE_CURLY_CLOSE: '(llave-cerrada)'
};

// CSV processing constants
const CSV_REQUIRED_COLUMNS = ['comment', 'roast'];
const DEFAULT_CSV_DELIMITER = ',';

// Performance optimization constants
const SIMILARITY_ALGORITHM_VERSION = '2.0'; // Optimized version marker
const WORD_FREQUENCY_THRESHOLD = 3; // Words that appear in 3+ roasts get indexed
const INDEX_REBUILD_INTERVAL = 10 * 60 * 1000; // 10 minutes

module.exports = {
  // Template constants
  TEMPLATE_VERSION,
  DEFAULT_REFERENCE_COUNT,
  MAX_INPUT_LENGTH,
  
  // Cache and performance  
  CSV_CACHE_EXPIRY,
  WORD_MIN_LENGTH,
  CATEGORY_SCORE_BOOST,
  SIMILARITY_SCORE_THRESHOLD,
  DEFAULT_TONE,
  
  // Platform limits
  PLATFORM_LIMITS,
  
  // Categories and patterns
  COMMENT_CATEGORIES,
  CATEGORY_PATTERNS,
  TOXICITY_CATEGORY_MAP,
  
  // Tone configuration (Issue #868: Humor Type eliminado)
  TONE_MAP,
  TONE_GUIDES,
  
  // Security
  SANITIZATION_PATTERNS,
  SANITIZATION_REPLACEMENTS,
  
  // CSV processing
  CSV_REQUIRED_COLUMNS,
  DEFAULT_CSV_DELIMITER,
  
  // Performance optimization
  SIMILARITY_ALGORITHM_VERSION,
  WORD_FREQUENCY_THRESHOLD,
  INDEX_REBUILD_INTERVAL
};