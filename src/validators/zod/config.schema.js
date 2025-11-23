/**
 * Zod Validation Schemas for Config Endpoints
 * Issue #943: Migrar endpoints de config a Zod (P0 - Crítico)
 *
 * Validates roast_level and shield_level for PUT /api/config/:platform
 */

const { z } = require('zod');

/**
 * Roast Level Schema
 * Validates roast_level (1-5, integer)
 * Controls roasting intensity and behavior
 */
const roastLevelSchema = z
  .number({
    required_error: 'roast_level is required',
    invalid_type_error: 'roast_level must be a number'
  })
  .int('roast_level must be an integer')
  .min(1, 'roast_level must be between 1 and 5')
  .max(5, 'roast_level must be between 1 and 5');

/**
 * Shield Level Schema
 * Validates shield_level (1-5, integer)
 * Controls shield/moderation aggressiveness
 */
const shieldLevelSchema = z
  .number({
    required_error: 'shield_level is required',
    invalid_type_error: 'shield_level must be a number'
  })
  .int('shield_level must be an integer')
  .min(1, 'shield_level must be between 1 and 5')
  .max(5, 'shield_level must be between 1 and 5');

/**
 * Platform Config Schema
 * Validates full platform configuration payload
 * Issue #943: Zod validation for critical config endpoints
 */
const platformConfigSchema = z
  .object({
    // Basic config
    enabled: z.boolean().optional(),

    // Tone configuration (Issue #872: New 3-tone system)
    tone: z.enum(['flanders', 'balanceado', 'canalla', 'light', 'balanced', 'savage']).optional(),

    // Response frequency
    response_frequency: z.number().min(0.0).max(1.0).optional(),

    // Trigger words
    trigger_words: z.array(z.string()).optional(),

    // Shield configuration
    shield_enabled: z.boolean().optional(),
    shield_config: z
      .object({
        auto_actions: z.boolean().optional(),
        mute_enabled: z.boolean().optional(),
        block_enabled: z.boolean().optional(),
        report_enabled: z.boolean().optional()
      })
      .optional(),

    // Generic config object
    config: z.record(z.any()).optional(),

    // Critical: roast_level and shield_level (Issue #943)
    roast_level: roastLevelSchema.optional(),
    shield_level: shieldLevelSchema.optional()
  })
  .strict(); // Reject unknown properties

/**
 * Roast Level Update Schema
 * For dedicated roast-level endpoint (if created in future)
 */
const roastLevelUpdateSchema = z
  .object({
    roast_level: roastLevelSchema,
    organization_id: z.string().uuid().optional() // Multi-tenant support
  })
  .strict();

/**
 * Shield Level Update Schema
 * For dedicated shield-level endpoint (if created in future)
 */
const shieldLevelUpdateSchema = z
  .object({
    shield_level: shieldLevelSchema,
    organization_id: z.string().uuid().optional() // Multi-tenant support
  })
  .strict();

module.exports = {
  roastLevelSchema,
  shieldLevelSchema,
  platformConfigSchema,
  roastLevelUpdateSchema,
  shieldLevelUpdateSchema
};
