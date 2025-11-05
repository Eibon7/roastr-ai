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
const logger = require('../utils/logger');

// Initialize Polar client
const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
});

/**
 * POST /api/checkout
 *
 * Creates a new checkout session with Polar
 *
 * Request Body:
 * @param {string} customer_email - Customer's email address
 * @param {string} price_id - Polar price ID for the product
 * @param {object} metadata - Optional metadata to attach to the checkout
 *
 * Response:
 * @returns {object} checkout - Full checkout object including checkout_url
 */
router.post('/checkout', async (req, res) => {
  try {
    const { customer_email, price_id, metadata } = req.body;

    // Validation
    if (!customer_email || !price_id) {
      logger.warn('[Polar] Missing required fields in checkout request', {
        hasEmail: !!customer_email,
        hasPriceId: !!price_id,
      });
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'customer_email and price_id are required',
      });
    }

    // Validate environment variables
    if (!process.env.POLAR_ACCESS_TOKEN) {
      logger.error('[Polar] POLAR_ACCESS_TOKEN not configured');
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Polar integration is not properly configured',
      });
    }

    logger.info('[Polar] Creating checkout session', {
      customer_email,
      price_id,
      hasMetadata: !!metadata,
    });

    // Create checkout session
    // Polar SDK expects products as an array of price ID strings
    const checkout = await polar.checkouts.create({
      products: [price_id],
      customerEmail: customer_email,
      successUrl: process.env.POLAR_SUCCESS_URL || `${req.protocol}://${req.get('host')}/success?checkout_id={CHECKOUT_ID}`,
      metadata: metadata || {},
    });

    logger.info('[Polar] Checkout session created successfully', {
      checkout_id: checkout.id,
      checkout_url: checkout.url,
    });

    // Return the checkout object (includes checkout_url)
    res.json({
      success: true,
      checkout: {
        id: checkout.id,
        url: checkout.url,
        customer_email: checkout.customerEmail,
        price_id: checkout.productPriceId,
        status: checkout.status,
      },
    });

  } catch (error) {
    logger.error('[Polar] Error creating checkout session', {
      error: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
    });

    res.status(500).json({
      error: 'Checkout creation failed',
      message: error.message || 'An error occurred while creating the checkout session',
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
      status: checkout.status,
    });

    res.json({
      success: true,
      checkout: {
        id: checkout.id,
        status: checkout.status,
        customer_email: checkout.customerEmail,
        price_id: checkout.productPriceId,
        amount: checkout.amount,
        currency: checkout.currency,
      },
    });

  } catch (error) {
    logger.error('[Polar] Error retrieving checkout session', {
      checkout_id: req.params.id,
      error: error.message,
    });

    res.status(error.statusCode || 500).json({
      error: 'Failed to retrieve checkout',
      message: error.message,
    });
  }
});

module.exports = router;
