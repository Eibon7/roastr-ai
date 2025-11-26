/**
 * Zod Validation Schemas for Billing (Polar Integration)
 *
 * Provides strict validation for:
 * - Checkout session creation
 * - Webhook events (order.created, subscription.*, checkout.*)
 * - Email, UUID, and event structure validation
 *
 * Why Zod instead of express-validator:
 * - Type-safe validation with TypeScript-like DX
 * - Composable schemas (reusable event structures)
 * - Better error messages for debugging
 * - NO dependency on Express req/res objects
 *
 * Security: Prevents event spoofing, data corruption, and invalid activations
 *
 * Related: Issue #945 - Migrate Polar billing endpoints to Zod
 */

const { z } = require('zod');
const { logger } = require('../../utils/logger');

// ============================================================================
// Base Schemas - Reusable Building Blocks
// ============================================================================

/**
 * Strict email validation using Zod's built-in .email()
 * More robust than regex (handles edge cases like unicode domains)
 */
const emailSchema = z.string().email({ message: 'Invalid email format' });

/**
 * UUID validation for product_id, price_id, order_id, etc.
 * Polar uses UUIDs for all resource identifiers
 */
const uuidSchema = z.string().uuid({ message: 'Invalid UUID format' });

/**
 * Valid plan names matching database constraints
 * See: database/migrations/*_plans.sql
 */
const planSchema = z.enum(['free', 'starter_trial', 'starter', 'pro', 'plus', 'creator_plus'], {
  errorMap: () => ({
    message:
      'Invalid plan name. Must be one of: free, starter_trial, starter, pro, plus, creator_plus'
  })
});

/**
 * Subscription status matching Polar API
 */
const subscriptionStatusSchema = z.enum(
  ['active', 'trialing', 'past_due', 'canceled', 'incomplete'],
  {
    errorMap: () => ({ message: 'Invalid subscription status' })
  }
);

/**
 * ISO 8601 datetime string
 */
const datetimeSchema = z.string().datetime({ message: 'Invalid ISO 8601 datetime format' });

// ============================================================================
// Checkout Schemas
// ============================================================================

/**
 * POST /api/checkout request body
 *
 * Validates checkout session creation request
 *
 * @example
 * {
 *   customer_email: "user@example.com",
 *   product_id: "550e8400-e29b-41d4-a716-446655440000",
 *   metadata: { user_id: "123", plan: "pro" }
 * }
 */
const checkoutSchema = z
  .object({
    customer_email: emailSchema,
    // Issue #1020: Improved validation for empty strings and null values
    product_id: z
      .string()
      .min(1, { message: 'product_id cannot be empty' })
      .uuid({ message: 'Invalid UUID format' })
      .optional()
      .or(z.undefined())
      .or(z.null()), // New Polar API (preferred)
    price_id: z
      .string()
      .min(1, { message: 'price_id cannot be empty' })
      .uuid({ message: 'Invalid UUID format' })
      .optional()
      .or(z.undefined())
      .or(z.null()), // Legacy fallback
    metadata: z.record(z.unknown()).optional() // Flexible metadata (any key-value pairs)
  })
  .refine((data) => data.product_id || data.price_id, {
    message: 'Either product_id or price_id must be provided',
    path: ['product_id']
  });

// ============================================================================
// Webhook Event Schemas
// ============================================================================

/**
 * Polar webhook event types
 * Based on: https://docs.polar.sh/api/webhooks/events
 */
const polarEventTypes = z.enum([
  'checkout.created',
  'checkout.updated',
  'order.created',
  'subscription.created',
  'subscription.updated',
  'subscription.canceled',
  'subscription.cancelled' // Handle both spellings (Polar uses British English)
]);

/**
 * Base webhook event structure
 * All Polar webhook events follow this shape
 */
const webhookBaseSchema = z.object({
  type: polarEventTypes,
  id: uuidSchema, // Event ID (not order/subscription ID)
  data: z.object({}).passthrough() // Will be validated by specific event schemas
});

/**
 * checkout.created event
 *
 * Fired when a checkout session is created (not yet paid)
 *
 * @example
 * {
 *   type: "checkout.created",
 *   id: "evt_...",
 *   data: {
 *     id: "checkout_...",
 *     customer_email: "user@example.com",
 *     product_id: "550e8400-..."
 *   }
 * }
 */
const checkoutCreatedSchema = webhookBaseSchema.extend({
  type: z.literal('checkout.created'),
  data: z
    .object({
      id: uuidSchema,
      customer_email: emailSchema,
      product_id: uuidSchema.optional(),
      product_price_id: uuidSchema.optional(), // Legacy field
      status: z.string().optional(),
      amount: z.number().int().positive().optional(),
      currency: z.string().length(3).optional() // ISO 4217 (USD, EUR, etc.)
    })
    .refine((data) => data.product_id || data.product_price_id, {
      message: 'Either product_id or product_price_id required'
    })
});

/**
 * order.created event (CRITICAL - PAYMENT CONFIRMED)
 *
 * This is the event that confirms payment was successful
 * MUST activate subscription here
 *
 * @example
 * {
 *   type: "order.created",
 *   id: "evt_...",
 *   data: {
 *     id: "order_...",
 *     customer_email: "user@example.com",
 *     product_id: "550e8400-...",
 *     amount: 500,
 *     currency: "USD"
 *   }
 * }
 */
const orderCreatedSchema = webhookBaseSchema.extend({
  type: z.literal('order.created'),
  data: z
    .object({
      id: uuidSchema, // Order ID
      customer_email: emailSchema,
      product_id: uuidSchema.optional(), // New API
      product_price_id: uuidSchema.optional(), // Legacy
      amount: z.number().int().positive(), // Amount in cents
      currency: z.string().length(3), // ISO 4217
      status: z.string().optional(),
      created_at: datetimeSchema.optional()
    })
    .refine((data) => data.product_id || data.product_price_id, {
      message: 'Either product_id or product_price_id required'
    })
});

/**
 * subscription.created event
 *
 * Fired when a subscription is created (may fire alongside order.created)
 *
 * @example
 * {
 *   type: "subscription.created",
 *   id: "evt_...",
 *   data: {
 *     id: "sub_...",
 *     customer_email: "user@example.com",
 *     product_id: "550e8400-...",
 *     status: "active",
 *     current_period_start: "2025-11-24T00:00:00Z",
 *     current_period_end: "2025-12-24T00:00:00Z"
 *   }
 * }
 */
const subscriptionCreatedSchema = webhookBaseSchema.extend({
  type: z.literal('subscription.created'),
  data: z
    .object({
      id: uuidSchema, // Subscription ID
      customer_email: emailSchema,
      product_id: uuidSchema.optional(), // New API
      product_price_id: uuidSchema.optional(), // Legacy
      status: subscriptionStatusSchema,
      current_period_start: datetimeSchema.optional(),
      current_period_end: datetimeSchema.optional(),
      cancel_at_period_end: z.boolean().optional(),
      created_at: datetimeSchema.optional()
    })
    .refine((data) => data.product_id || data.product_price_id, {
      message: 'Either product_id or product_price_id required'
    })
});

/**
 * subscription.updated event
 *
 * Fired when subscription status/plan changes
 *
 * @example
 * {
 *   type: "subscription.updated",
 *   id: "evt_...",
 *   data: {
 *     id: "sub_...",
 *     customer_email: "user@example.com",
 *     product_id: "new_product_id", // Plan changed
 *     status: "past_due" // Status changed
 *   }
 * }
 */
const subscriptionUpdatedSchema = webhookBaseSchema.extend({
  type: z.literal('subscription.updated'),
  data: z
    .object({
      id: uuidSchema,
      customer_email: emailSchema,
      product_id: uuidSchema.optional(),
      product_price_id: uuidSchema.optional(),
      status: subscriptionStatusSchema,
      current_period_start: datetimeSchema.optional(),
      current_period_end: datetimeSchema.optional(),
      cancel_at_period_end: z.boolean().optional(),
      updated_at: datetimeSchema.optional()
    })
    .refine((data) => data.product_id || data.product_price_id, {
      message: 'Either product_id or product_price_id required'
    })
});

/**
 * subscription.canceled / subscription.cancelled event
 *
 * Fired when subscription is canceled (handle both spellings)
 *
 * @example
 * {
 *   type: "subscription.canceled",
 *   id: "evt_...",
 *   data: {
 *     id: "sub_...",
 *     customer_email: "user@example.com",
 *     status: "canceled",
 *     canceled_at: "2025-11-24T12:00:00Z"
 *   }
 * }
 */
const subscriptionCanceledSchema = webhookBaseSchema.extend({
  type: z.enum(['subscription.canceled', 'subscription.cancelled']),
  data: z.object({
    id: uuidSchema,
    customer_email: emailSchema,
    status: z.enum(['canceled', 'cancelled']),
    canceled_at: datetimeSchema.optional(),
    cancel_at_period_end: z.boolean().optional()
  })
});

/**
 * Union schema for all webhook events
 * Validates webhook and discriminates by event type
 */
const webhookSchema = z.discriminatedUnion('type', [
  checkoutCreatedSchema,
  orderCreatedSchema,
  subscriptionCreatedSchema,
  subscriptionUpdatedSchema,
  subscriptionCanceledSchema
]);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format Zod validation errors into user-friendly structure
 *
 * @param {z.ZodError} error - Zod validation error
 * @returns {Array<{field: string, message: string, code: string}>}
 *
 * @example
 * // Input: ZodError with 2 issues
 * // Output: [
 * //   { field: "customer_email", message: "Invalid email format", code: "invalid_string" },
 * //   { field: "product_id", message: "Invalid UUID format", code: "invalid_string" }
 * // ]
 */
function formatZodError(error) {
  return error.errors.map((err) => ({
    field: err.path.join('.') || 'root',
    message: err.message,
    code: err.code
  }));
}

/**
 * Validate checkout request body
 *
 * @param {object} data - Request body
 * @returns {{ success: true, data: object } | { success: false, errors: Array }}
 */
function validateCheckout(data) {
  try {
    const validated = checkoutSchema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('[Billing Validation] Checkout validation failed', {
        errors: formatZodError(error),
        received: data
      });
      return { success: false, errors: formatZodError(error) };
    }
    throw error;
  }
}

/**
 * Validate webhook event
 *
 * @param {object} data - Webhook event payload
 * @returns {{ success: true, data: object, eventType: string } | { success: false, errors: Array }}
 */
function validateWebhook(data) {
  try {
    const validated = webhookSchema.parse(data);
    return {
      success: true,
      data: validated,
      eventType: validated.type
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('[Billing Validation] Webhook validation failed', {
        errors: formatZodError(error),
        receivedType: data?.type,
        receivedId: data?.id
      });
      return { success: false, errors: formatZodError(error) };
    }
    throw error;
  }
}

/**
 * Express middleware factory for Zod validation
 *
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {string} source - Where to get data from ('body', 'query', 'params')
 * @returns {Function} Express middleware
 *
 * @example
 * router.post('/checkout', validateZodSchema(checkoutSchema, 'body'), handler);
 */
function validateZodSchema(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const data = req[source];
      const validated = schema.parse(data);

      // Attach validated data to request (type-safe)
      req.validatedData = validated;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn(`[Billing Validation] ${source} validation failed`, {
          path: req.path,
          method: req.method,
          errors: formatZodError(error)
        });

        // Issue #1020: Map Zod errors to legacy error messages for test compatibility
        const firstError = error.errors[0];
        let errorMessage = 'Validation failed';
        let messageDetail = 'Request data does not match expected format';

        // Map specific Zod errors to legacy error messages
        if (firstError) {
          const fieldName = firstError.path[0];
          const errorCode = firstError.code;
          const errorMsg = firstError.message;

          // Handle email validation errors
          if (fieldName === 'customer_email' && errorCode === 'invalid_string') {
            errorMessage = 'Invalid email';
            messageDetail = 'Please provide a valid email address';
          }
          // Handle price_id/product_id validation errors (UUID format)
          else if (
            (fieldName === 'price_id' || fieldName === 'product_id') &&
            errorCode === 'invalid_string'
          ) {
            // Check if it's empty string error or invalid UUID
            if (errorMsg.includes('cannot be empty')) {
              errorMessage = 'Missing required fields';
              messageDetail = 'Please provide all required fields';
            } else {
              errorMessage = 'Invalid price_id';
              messageDetail = 'The selected plan is not available for purchase.';
            }
          }
          // Handle missing fields (undefined/null)
          else if (
            errorCode === 'invalid_type' &&
            (firstError.received === 'undefined' || firstError.received === 'null')
          ) {
            errorMessage = 'Missing required fields';
            messageDetail = 'Please provide all required fields';
          }
          // Handle refine errors (custom validation for product_id or price_id)
          else if (errorCode === 'custom' && errorMsg.includes('product_id or price_id')) {
            errorMessage = 'Missing required fields';
            messageDetail = 'Either product_id or price_id must be provided';
          }
          // Handle too_small errors (empty strings)
          else if (
            errorCode === 'too_small' &&
            (fieldName === 'price_id' || fieldName === 'product_id')
          ) {
            errorMessage = 'Missing required fields';
            messageDetail = 'Please provide all required fields';
          }
        }

        return res.status(400).json({
          error: errorMessage,
          message: messageDetail,
          details: formatZodError(error)
        });
      }

      // Unexpected error (not validation-related)
      logger.error('[Billing Validation] Unexpected validation error', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        error: 'Internal validation error',
        message: 'An unexpected error occurred during validation'
      });
    }
  };
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Schemas
  checkoutSchema,
  webhookSchema,
  checkoutCreatedSchema,
  orderCreatedSchema,
  subscriptionCreatedSchema,
  subscriptionUpdatedSchema,
  subscriptionCanceledSchema,
  polarEventTypes,
  planSchema,
  subscriptionStatusSchema,

  // Helper functions
  formatZodError,
  validateCheckout,
  validateWebhook,
  validateZodSchema
};
