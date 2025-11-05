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
 *
 * Related: Issue #728 - Webhook business logic implementation
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const logger = require('../utils/logger');
const { supabaseServiceClient } = require('../config/supabase');
const { getPlanFromPriceId } = require('../utils/polarHelpers');

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

  // NOTE: No action needed for checkout.created
  // Wait for order.created event which confirms payment
}

/**
 * Handle order.created event (payment confirmed)
 *
 * This is the critical event that confirms payment was successful.
 * Updates user plan and creates/updates subscription record in database.
 */
async function handleOrderCreated(event) {
  const {
    id: orderId,
    customer_email,
    product_price_id,
    amount,
    currency
  } = event.data;

  logger.info('[Polar Webhook] Processing order.created', {
    order_id: orderId,
    customer_email,
    price_id: product_price_id,
    amount,
    currency,
  });

  try {
    // 1. Find user by email
    const { data: user, error: userError } = await supabaseServiceClient
      .from('users')
      .select('id, plan')
      .eq('email', customer_email)
      .single();

    if (userError || !user) {
      logger.error('[Polar Webhook] User not found', {
        customer_email,
        error: userError?.message
      });
      return;
    }

    // 2. Map price_id to plan (handles starter→basic, plus→creator_plus)
    const plan = getPlanFromPriceId(product_price_id);

    logger.info('[Polar Webhook] Mapped plan from price_id', {
      price_id: product_price_id,
      plan,
      user_id: user.id,
      previous_plan: user.plan
    });

    // 3. Update user plan
    const { error: updateError } = await supabaseServiceClient
      .from('users')
      .update({
        plan,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      throw new Error(`Failed to update user plan: ${updateError.message}`);
    }

    // 4. Upsert subscription record
    // NOTE: Reusing stripe_* columns for Polar data (temporary)
    // Future migration will rename to payment_provider_* columns
    const { error: subError } = await supabaseServiceClient
      .from('user_subscriptions')
      .upsert({
        user_id: user.id,
        stripe_customer_id: customer_email, // Use email as identifier
        stripe_subscription_id: orderId, // Store Polar order ID
        plan,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: null, // Polar may not provide this in order.created
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (subError) {
      throw new Error(`Failed to create subscription: ${subError.message}`);
    }

    logger.info('[Polar Webhook] ✅ Subscription activated successfully', {
      user_id: user.id,
      plan,
      order_id: orderId
    });

  } catch (error) {
    logger.error('[Polar Webhook] ❌ Failed to process order.created', {
      error: error.message,
      stack: error.stack,
      order_id: orderId,
      customer_email,
    });
    // Don't throw - webhook handler should not fail
  }
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

  // Polar sends both order.created and subscription.created
  // Delegate to handleOrderCreated to avoid duplication
  return handleOrderCreated(event);
}

/**
 * Handle subscription.updated event
 */
async function handleSubscriptionUpdated(event) {
  const { id: subscriptionId, customer_email, product_price_id, status } = event.data;

  logger.info('[Polar Webhook] Processing subscription.updated', {
    subscription_id: subscriptionId,
    customer_email,
    status,
  });

  try {
    // 1. Find user
    const { data: user, error: userError } = await supabaseServiceClient
      .from('users')
      .select('id, plan')
      .eq('email', customer_email)
      .single();

    if (userError || !user) {
      logger.error('[Polar Webhook] User not found', { customer_email });
      return;
    }

    // 2. Map new plan if price_id changed
    const newPlan = product_price_id ? getPlanFromPriceId(product_price_id) : user.plan;

    // 3. Update user plan if changed
    if (newPlan !== user.plan) {
      await supabaseServiceClient
        .from('users')
        .update({ plan: newPlan, updated_at: new Date().toISOString() })
        .eq('id', user.id);
    }

    // 4. Update subscription status
    await supabaseServiceClient
      .from('user_subscriptions')
      .update({
        plan: newPlan,
        status: status === 'active' ? 'active' : 'past_due',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    logger.info('[Polar Webhook] ✅ Subscription updated successfully', {
      user_id: user.id,
      new_plan: newPlan,
      status,
    });

  } catch (error) {
    logger.error('[Polar Webhook] ❌ Failed to process subscription.updated', {
      error: error.message,
      subscription_id: subscriptionId,
    });
  }
}

/**
 * Handle subscription.canceled event
 */
async function handleSubscriptionCanceled(event) {
  const { id: subscriptionId, customer_email } = event.data;

  logger.info('[Polar Webhook] Processing subscription.canceled', {
    subscription_id: subscriptionId,
    customer_email,
  });

  try {
    // 1. Find user
    const { data: user, error: userError } = await supabaseServiceClient
      .from('users')
      .select('id')
      .eq('email', customer_email)
      .single();

    if (userError || !user) {
      logger.error('[Polar Webhook] User not found', { customer_email });
      return;
    }

    // 2. Downgrade user to basic plan
    await supabaseServiceClient
      .from('users')
      .update({
        plan: 'basic',
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    // 3. Update subscription status (DO NOT DELETE - retain for audit)
    await supabaseServiceClient
      .from('user_subscriptions')
      .update({
        status: 'canceled',
        cancel_at_period_end: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    logger.info('[Polar Webhook] ✅ Subscription canceled successfully', {
      user_id: user.id,
      downgraded_to: 'basic',
    });

  } catch (error) {
    logger.error('[Polar Webhook] ❌ Failed to process subscription.canceled', {
      error: error.message,
      subscription_id: subscriptionId,
    });
  }
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
