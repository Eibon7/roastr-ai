/**
 * Polar Webhook Handler
 *
 * Receives and processes webhook events from Polar for payment confirmations,
 * subscription updates, and other billing events.
 *
 * Environment Variables Required:
 * - POLAR_WEBHOOK_SECRET: Secret for validating webhook signatures (highly recommended)
 *
 * Supported Events:
 * - checkout.created: New checkout session created
 * - checkout.updated: Checkout session updated
 * - order.created: Order successfully created (payment confirmed)
 * - subscription.created: New subscription created
 * - subscription.updated: Subscription updated
 * - subscription.canceled: Subscription canceled
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Verify Polar webhook signature
 *
 * @param {string} payload - Raw request body
 * @param {string} signature - Signature from Polar-Signature header
 * @param {string} secret - Webhook secret
 * @returns {boolean} - True if signature is valid
 */
function verifyWebhookSignature(payload, signature, secret) {
  if (!secret) {
    logger.warn('[Polar Webhook] POLAR_WEBHOOK_SECRET not configured - skipping signature verification');
    return true; // Allow in development, but log warning
  }

  if (!signature) {
    logger.error('[Polar Webhook] Missing signature header');
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Ensure buffers are same length before comparison to prevent crash
    if (signature.length !== expectedSignature.length) {
      logger.error('[Polar Webhook] Signature length mismatch', {
        received: signature.length,
        expected: expectedSignature.length
      });
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error('[Polar Webhook] Error verifying signature', { error: error.message });
    return false;
  }
}

/**
 * Handle checkout.created event
 */
async function handleCheckoutCreated(event) {
  logger.info('[Polar Webhook] Checkout created', {
    checkout_id: event.data.id,
    customer_email: event.data.customer_email,
  });

  // TODO: Add your logic here
  // Example: Create pending order in database
}

/**
 * Handle order.created event (payment confirmed)
 */
async function handleOrderCreated(event) {
  logger.info('[Polar Webhook] Order created - Payment confirmed', {
    order_id: event.data.id,
    customer_email: event.data.customer_email,
    amount: event.data.amount,
    currency: event.data.currency,
  });

  // TODO: Add your logic here
  // Example:
  // 1. Update user's subscription status in database
  // 2. Activate premium features
  // 3. Send confirmation email
  // 4. Update analytics
}

/**
 * Handle subscription.created event
 */
async function handleSubscriptionCreated(event) {
  logger.info('[Polar Webhook] Subscription created', {
    subscription_id: event.data.id,
    customer_email: event.data.customer_email,
    status: event.data.status,
  });

  // TODO: Add your logic here
  // Example: Update user's subscription in database
}

/**
 * Handle subscription.updated event
 */
async function handleSubscriptionUpdated(event) {
  logger.info('[Polar Webhook] Subscription updated', {
    subscription_id: event.data.id,
    status: event.data.status,
  });

  // TODO: Add your logic here
  // Example: Update subscription status, handle plan changes
}

/**
 * Handle subscription.canceled event
 */
async function handleSubscriptionCanceled(event) {
  logger.info('[Polar Webhook] Subscription canceled', {
    subscription_id: event.data.id,
    customer_email: event.data.customer_email,
  });

  // TODO: Add your logic here
  // Example:
  // 1. Update subscription status to 'canceled'
  // 2. Schedule access revocation at end of billing period
  // 3. Send cancellation confirmation email
}

/**
 * POST /api/polar/webhook
 *
 * Receives webhook events from Polar
 *
 * Headers:
 * - Polar-Signature: HMAC signature for verification
 *
 * Body: Raw JSON event data
 */
router.post('/polar/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Get signature from header
    const signature = req.headers['polar-signature'];
    const rawBody = req.body.toString('utf8');

    // Verify signature
    const isValid = verifyWebhookSignature(
      rawBody,
      signature,
      process.env.POLAR_WEBHOOK_SECRET
    );

    if (!isValid) {
      logger.error('[Polar Webhook] Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse event
    const event = JSON.parse(rawBody);

    logger.info('[Polar Webhook] Received event', {
      type: event.type,
      id: event.id,
    });

    // Route to appropriate handler
    switch (event.type) {
      case 'checkout.created':
        await handleCheckoutCreated(event);
        break;

      case 'order.created':
        await handleOrderCreated(event);
        break;

      case 'subscription.created':
        await handleSubscriptionCreated(event);
        break;

      case 'subscription.updated':
        await handleSubscriptionUpdated(event);
        break;

      case 'subscription.canceled':
      case 'subscription.cancelled': // Handle both spellings
        await handleSubscriptionCanceled(event);
        break;

      default:
        logger.warn('[Polar Webhook] Unhandled event type', { type: event.type });
    }

    // Always return 200 to acknowledge receipt
    res.json({ received: true });

  } catch (error) {
    logger.error('[Polar Webhook] Error processing webhook', {
      error: error.message,
      stack: error.stack,
    });

    // Still return 200 to avoid retries for parsing errors
    res.status(200).json({ received: true, error: error.message });
  }
});

module.exports = router;
