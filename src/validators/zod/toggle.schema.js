/**
 * Zod Validation Schemas for Toggle Endpoints
 *
 * Issue #944: Migrar endpoints de Toggle (Roasting/Shield) a Zod
 *
 * Validates critical state-changing endpoints that affect workers and queue processing:
 * - POST /api/roasting/toggle
 * - POST /api/shield/toggle
 *
 * Why P0:
 * - Changes system state in real-time
 * - Workers depend on these states (Redis → jobs)
 * - Invalid values can break worker processing
 * - Affects queue system and multi-tenant isolation
 */

const { z } = require('zod');

/**
 * Base schema for toggle endpoints
 *
 * Common fields shared by all toggle operations:
 * - enabled: Boolean (strict, no string coercion)
 * - organization_id: UUID (validated format)
 */
const toggleBaseSchema = z.object({
  /**
   * Toggle state
   * Must be a boolean (not string "true"/"false")
   */
  enabled: z.boolean({
    required_error: 'enabled is required',
    invalid_type_error: 'enabled must be a boolean (true or false)'
  }),

  /**
   * Organization ID for multi-tenant isolation
   * Must be a valid UUID (RFC 4122 compliant)
   */
  organization_id: z
    .string({
      required_error: 'organization_id is required'
    })
    .uuid({
      message: 'organization_id must be a valid UUID'
    })
});

/**
 * Schema for POST /api/roasting/toggle
 *
 * Controls roast generation for an organization.
 * Workers check this state before generating roasts.
 */
const roastingToggleSchema = toggleBaseSchema.extend({
  /**
   * Optional reason for disabling roasting
   * Used for audit trail and debugging
   */
  reason: z
    .string()
    .min(1, 'reason cannot be empty if provided')
    .max(500, 'reason cannot exceed 500 characters')
    .optional()
});

/**
 * Schema for POST /api/shield/toggle
 *
 * Controls Shield automated moderation for an organization.
 * Workers check this state before executing Shield actions.
 */
const shieldToggleSchema = toggleBaseSchema.extend({
  /**
   * Optional reason for disabling shield
   * Used for audit trail and debugging
   */
  reason: z
    .string()
    .min(1, 'reason cannot be empty if provided')
    .max(500, 'reason cannot exceed 500 characters')
    .optional()
});

module.exports = {
  toggleBaseSchema,
  roastingToggleSchema,
  shieldToggleSchema
};
