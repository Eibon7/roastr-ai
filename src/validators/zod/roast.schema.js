/**
 * Zod schemas for roast endpoint validation
 * Issue #946 - Migration from manual validation to Zod
 * Provides type-safe, declarative validation with improved error messages
 */

const { z } = require('zod');
const { VALIDATION_CONSTANTS } = require('../../config/validationConstants');
const { VALID_TONES } = require('../../config/tones');

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
    `Text must be less than ${VALIDATION_CONSTANTS.MAX_COMMENT_LENGTH} characters`
  );

/**
 * Tone schema - validates tone selection
 * Accepts canonical tone values (Flanders, Balanceado, Canalla)
 */
const toneSchema = z
  .enum(VALID_TONES, {
    errorMap: () => ({
      message: `Tone must be one of: ${VALID_TONES.join(', ')}`
    })
  })
  .default('Balanceado');

/**
 * Platform schema - validates platform selection
 * Supports normalization via normalizePlatform (e.g., 'X' → 'twitter')
 */
const platformSchema = z
  .enum(VALIDATION_CONSTANTS.VALID_PLATFORMS, {
    errorMap: () => ({
      message: `Platform must be one of: ${VALIDATION_CONSTANTS.VALID_PLATFORMS.join(', ')}`
    })
  })
  .default('twitter');

/**
 * Language schema - validates language selection
 * Supports BCP-47 normalization via normalizeLanguage
 */
const languageSchema = z
  .enum(VALIDATION_CONSTANTS.VALID_LANGUAGES, {
    errorMap: () => ({
      message: `Language must be one of: ${VALIDATION_CONSTANTS.VALID_LANGUAGES.join(', ')}`
    })
  })
  .default('es');

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
