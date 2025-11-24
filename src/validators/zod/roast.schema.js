/**
 * Zod schemas for roast endpoint validation
 * Issue #946 - Migration from manual validation to Zod
 * Provides type-safe, declarative validation with improved error messages
 */

const { z } = require('zod');
const {
  VALIDATION_CONSTANTS,
  normalizeLanguage,
  normalizePlatform
} = require('../../config/validationConstants');
const { VALID_TONES, normalizeTone } = require('../../config/tones');

// Base schemas for reusable validation rules

/**
 * Text schema - validates roast text input
 * Applies trim, min/max length validation
 */
const textSchema = z
  .string({
    required_error: 'Text is required',
    invalid_type_error: 'Text must be a string'
  })
  .trim()
  .min(VALIDATION_CONSTANTS.MIN_COMMENT_LENGTH, 'Text cannot be empty')
  .max(
    VALIDATION_CONSTANTS.MAX_COMMENT_LENGTH,
    `Text must be at most ${VALIDATION_CONSTANTS.MAX_COMMENT_LENGTH} characters`
  );

/**
 * Tone schema - validates tone selection
 * Accepts canonical tone values (Flanders, Balanceado, Canalla)
 * Normalizes aliases: 'flanders' → 'Flanders', 'balanced' → 'Balanceado', etc.
 */
const toneSchema = z.preprocess(
  (val) => {
    if (val === undefined || val === null)
      return normalizeTone(VALIDATION_CONSTANTS.DEFAULTS.STYLE);
    const normalized = normalizeTone(val);
    return normalized || val; // Return original if normalization fails (will be caught by enum)
  },
  z.enum(VALID_TONES, {
    errorMap: () => ({
      message: `Tone must be one of: ${VALID_TONES.join(', ')}`
    })
  })
);

/**
 * Platform schema - validates platform selection
 * Normalizes aliases: 'X' → 'twitter', 'x.com' → 'twitter', etc.
 * CRITICAL: Maintains backward compatibility with platform aliases
 */
const platformSchema = z.preprocess(
  (val) => {
    if (val === undefined || val === null) return VALIDATION_CONSTANTS.DEFAULTS.PLATFORM;
    return normalizePlatform(val); // Always returns normalized value or default
  },
  z.enum(VALIDATION_CONSTANTS.VALID_PLATFORMS, {
    errorMap: () => ({
      message: `Platform must be one of: ${VALIDATION_CONSTANTS.VALID_PLATFORMS.join(', ')}`
    })
  })
);

/**
 * Language schema - validates language selection
 * Normalizes BCP-47 locales: 'en-US' → 'en', 'es-MX' → 'es', etc.
 * CRITICAL: Maintains backward compatibility with BCP-47 locale codes
 */
const languageSchema = z.preprocess(
  (val) => {
    if (val === undefined || val === null) return VALIDATION_CONSTANTS.DEFAULTS.LANGUAGE;
    return normalizeLanguage(val); // Always returns normalized value or default
  },
  z.enum(VALIDATION_CONSTANTS.VALID_LANGUAGES, {
    errorMap: () => ({
      message: `Language must be one of: ${VALIDATION_CONSTANTS.VALID_LANGUAGES.join(', ')}`
    })
  })
);

/**
 * Style profile schema - validates style profile object
 * Passthrough allows any additional properties for flexibility
 */
const styleProfileSchema = z.object({}).passthrough().optional();

/**
 * Persona schema - validates persona string
 */
const personaSchema = z.string().optional();

/**
 * Comment ID schema - validates optional comment identifier
 */
const commentIdSchema = z.string().optional().nullable();

/**
 * Auto-approve schema - validates boolean flag
 */
const autoApproveSchema = z.boolean().default(false);

// Endpoint-specific schemas

/**
 * Schema for POST /api/roast/preview
 * Preview roast generation without consuming credits
 */
const roastPreviewSchema = z.object({
  text: textSchema,
  tone: toneSchema,
  styleProfile: styleProfileSchema,
  persona: personaSchema,
  platform: platformSchema
});

/**
 * Schema for POST /api/roast/generate
 * Generate roast and consume user credits
 */
const roastGenerateSchema = z.object({
  text: textSchema,
  tone: toneSchema
});

/**
 * Schema for POST /api/roast/engine
 * Advanced roast generation using Roast Engine (SPEC 7)
 */
const roastEngineSchema = z.object({
  comment: textSchema,
  style: toneSchema,
  language: languageSchema,
  autoApprove: autoApproveSchema,
  platform: platformSchema,
  commentId: commentIdSchema
});

/**
 * Schema for POST /api/roast/:id/validate
 * Validate edited roast content (SPEC 8)
 */
const roastValidateSchema = z.object({
  text: textSchema,
  platform: platformSchema
});

module.exports = {
  roastPreviewSchema,
  roastGenerateSchema,
  roastEngineSchema,
  roastValidateSchema,
  // Export base schemas for testing
  textSchema,
  toneSchema,
  platformSchema,
  languageSchema
};
