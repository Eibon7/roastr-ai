/**
 * Polar Checkout Routes
 *
 * Handles checkout session creation and webhook events from Polar.
 *
 * Environment Variables Required:
 * - POLAR_ACCESS_TOKEN: Your Polar API access token
 * - POLAR_SUCCESS_URL: URL to redirect after successful checkout
 * - POLAR_WEBHOOK_SECRET: Secret for validating webhook signatures (optional but recommended)
 */

const express = require('express');
const router = express.Router();
const { Polar } = require('@polar-sh/sdk');
const { logger } = require('../utils/logger'); // Issue #483: Use destructured import for test compatibility
const { sanitizePII } = require('../utils/piiSanitizer');
const { validateZodSchema, checkoutSchema } = require('../validators/zod/billing.schema'); // Issue #945: Zod validation

// Initialize Polar client
const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN
});

// Allowed Product IDs - only these can be used for checkout
// This prevents authorization bypass where users could purchase arbitrary products
// Updated: Issue #808 - Changed from PRICE_ID (Stripe) to PRODUCT_ID (Polar)
const ALLOWED_PRODUCT_IDS = new Set(
  (process.env.POLAR_ALLOWED_PRODUCT_IDS || process.env.POLAR_ALLOWED_PRICE_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
);

// Log configuration status on startup
if (ALLOWED_PRODUCT_IDS.size === 0) {
  logger.warn(
    '[Polar] POLAR_ALLOWED_PRODUCT_IDS not configured - product validation disabled (INSECURE!)'
  );
} else {
  logger.info('[Polar] Product ID allowlist configured', {
    allowedCount: ALLOWED_PRODUCT_IDS.size
  });
}

/**
 * POST /api/checkout
 *
 * Creates a new checkout session with Polar
 *
 * Request Body:
 * @param {string} customer_email - Customer's email address (validated by Zod)
 * @param {string} product_id - Polar product ID (validated by Zod as UUID)
 * @param {object} metadata - Optional metadata to attach to the checkout
 *
 * Response:
 * @returns {object} checkout - Full checkout object including checkout_url
 *
 * Issue #945: Migrated to Zod validation (replaces manual validation)
 */
router.post('/checkout', validateZodSchema(checkoutSchema, 'body'), async (req, res) => {
  try {
    // Zod middleware validates and attaches req.validatedData
    // Support both product_id (new) and price_id (legacy) for backward compatibility
    const { customer_email, product_id, price_id, metadata } = req.validatedData;
    const productId = product_id || price_id; // Fallback to price_id for legacy support

    // Validate environment variables
    if (!process.env.POLAR_ACCESS_TOKEN) {
      logger.error('[Polar] POLAR_ACCESS_TOKEN not configured');
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Polar integration is not properly configured'
      });
    }

    // Validate product_id against allowlist (Security: prevent authorization bypass)
    if (ALLOWED_PRODUCT_IDS.size > 0 && !ALLOWED_PRODUCT_IDS.has(productId)) {
      logger.warn(
        '[Polar] Rejected checkout with unauthorized product_id',
        sanitizePII({
          product_id: productId,
          customer_email,
          allowedCount: ALLOWED_PRODUCT_IDS.size
        })
      );
      return res.status(400).json({
        error: 'Unauthorized product',
        message: 'The selected plan is not available for purchase.'
      });
    }

    logger.info(
      '[Polar] Creating checkout session',
      sanitizePII({
        customer_email,
        product_id: productId,
        hasMetadata: !!metadata
      })
    );

    // Create checkout session
    // Polar SDK expects products as an array of product ID strings
    const checkout = await polar.checkouts.create({
      products: [productId],
      customerEmail: customer_email,
      successUrl:
        process.env.POLAR_SUCCESS_URL ||
        `${req.protocol}://${req.get('host')}/success?checkout_id={CHECKOUT_ID}`,
      metadata: metadata || {}
    });

    logger.info('[Polar] Checkout session created successfully', {
      checkout_id: checkout.id,
      checkout_url: checkout.url
    });

    // Return the checkout object (includes checkout_url for backward compatibility)
    res.json({
      success: true,
      checkout_url: checkout.url, // Backward compatibility with tests expecting top-level checkout_url
      checkout: {
        id: checkout.id,
        url: checkout.url,
        customer_email: checkout.customerEmail,
        product_id: checkout.productPriceId || checkout.productId, // Polar may return either field
        status: checkout.status
      }
    });
  } catch (error) {
    logger.error('[Polar] Error creating checkout session', {
      error: error.message,
      stack: error.stack,
      statusCode: error.statusCode
    });

    res.status(500).json({
      error: 'Checkout creation failed',
      message: error.message || 'An error occurred while creating the checkout session'
    });
  }
});

/**
 * GET /api/checkout/:id
 *
 * Retrieves a checkout session by ID
 *
 * @param {string} id - Checkout session ID
 *
 * @returns {object} checkout - Checkout session details
 */
router.get('/checkout/:id', async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('[Polar] Retrieving checkout session', { checkout_id: id });

    const checkout = await polar.checkouts.get({ id });

    logger.info('[Polar] Checkout session retrieved', {
      checkout_id: checkout.id,
      status: checkout.status
    });

    res.json({
      success: true,
      checkout: {
        id: checkout.id,
        status: checkout.status,
        customer_email: checkout.customerEmail,
        product_id: checkout.productPriceId || checkout.productId, // Polar may return either field
        amount: checkout.amount,
        currency: checkout.currency
      }
    });
  } catch (error) {
    logger.error('[Polar] Error retrieving checkout session', {
      checkout_id: req.params.id,
      error: error.message
    });

    res.status(error.statusCode || 500).json({
      error: 'Failed to retrieve checkout',
      message: error.message
    });
  }
});

module.exports = router;
