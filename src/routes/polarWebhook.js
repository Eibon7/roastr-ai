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
const { logger } = require('../utils/logger'); // Issue #483: Use destructured import for test compatibility
const { sanitizePII } = require('../utils/piiSanitizer');
const { supabaseServiceClient } = require('../config/supabase');
const { getPlanFromProductId, getPlanFromPriceId } = require('../utils/polarHelpers');

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
  logger.info('[Polar Webhook] Checkout created', sanitizePII({
    checkout_id: event.data.id,
    customer_email: event.data.customer_email,
  }));

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
  // Polar may send product_price_id or product_id - handle both
  const {
    id: orderId,
    customer_email,
    product_price_id,
    product_id,
    amount,
    currency
  } = event.data;

  // Use product_id if available, fallback to product_price_id for backward compatibility
  const productId = product_id || product_price_id;

  logger.info('[Polar Webhook] Processing order.created', sanitizePII({
    order_id: orderId,
    customer_email,
    product_id: productId,
    amount,
    currency,
  }));

  try {
    // 1. Find user by email
    const { data: user, error: userError } = await supabaseServiceClient
      .from('users')
      .select('id, plan')
      .eq('email', customer_email)
      .single();

    if (userError || !user) {
      logger.error('[Polar Webhook] User not found', sanitizePII({
        customer_email,
        error: userError?.message
      }));
      return;
    }

    // 2. Map product_id to plan (handles starter→free, plus→creator_plus) - Updated Issue #808
    // Try new API first, fallback to legacy for backward compatibility
    const plan = productId ? (getPlanFromProductId(productId) || getPlanFromPriceId(productId)) : user.plan;

    logger.info('[Polar Webhook] Mapped plan from product_id', {
      product_id: productId,
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
      logger.error('[Polar Webhook] Failed to update user plan', {
        user_id: user.id,
        plan,
        error: updateError.message
      });
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
      logger.error('[Polar Webhook] Failed to upsert subscription', {
        user_id: user.id,
        plan,
        order_id: orderId,
        error: subError.message
      });
      throw new Error(`Failed to create subscription: ${subError.message}`);
    }

    logger.info('[Polar Webhook] ✅ Subscription activated successfully', {
      user_id: user.id,
      plan,
      order_id: orderId
    });

  } catch (error) {
    logger.error('[Polar Webhook] ❌ Failed to process order.created', sanitizePII({
      error: error.message,
      stack: error.stack,
      order_id: orderId,
      customer_email,
    }));
    // Don't throw - webhook handler should not fail
  }
}

/**
 * Handle subscription.created event
 */
async function handleSubscriptionCreated(event) {
  logger.info('[Polar Webhook] Subscription created', sanitizePII({
    subscription_id: event.data.id,
    customer_email: event.data.customer_email,
    status: event.data.status,
  }));

  // Polar sends both order.created and subscription.created
  // Delegate to handleOrderCreated to avoid duplication
  return handleOrderCreated(event);
}

/**
 * Handle subscription.updated event
 */
async function handleSubscriptionUpdated(event) {
  // Polar may send product_price_id or product_id - handle both
  const { id: subscriptionId, customer_email, product_price_id, product_id, status } = event.data;
  const productId = product_id || product_price_id; // Use product_id if available

  logger.info('[Polar Webhook] Processing subscription.updated', sanitizePII({
    subscription_id: subscriptionId,
    customer_email,
    status,
  }));

  try {
    // 1. Find user
    const { data: user, error: userError } = await supabaseServiceClient
      .from('users')
      .select('id, plan')
      .eq('email', customer_email)
      .single();

    if (userError || !user) {
      logger.error('[Polar Webhook] User not found', sanitizePII({ customer_email }));
      return;
    }

    // 2. Map new plan if product_id changed - Updated Issue #808
    const newPlan = productId ? (getPlanFromProductId(productId) || getPlanFromPriceId(productId)) : user.plan;

    // 3. Update user plan if changed
    if (newPlan !== user.plan) {
      const { error: userUpdateError } = await supabaseServiceClient
        .from('users')
        .update({ plan: newPlan, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (userUpdateError) {
        logger.error('[Polar Webhook] Failed to update user plan', {
          user_id: user.id,
          new_plan: newPlan,
          error: userUpdateError.message
        });
        throw new Error(`Failed to update user plan: ${userUpdateError.message}`);
      }
    }

    // 4. Update subscription status
    const { error: subUpdateError } = await supabaseServiceClient
      .from('user_subscriptions')
      .update({
        plan: newPlan,
        status: status === 'active' ? 'active' : 'past_due',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (subUpdateError) {
      logger.error('[Polar Webhook] Failed to update subscription', {
        user_id: user.id,
        new_plan: newPlan,
        status,
        error: subUpdateError.message
      });
      throw new Error(`Failed to update subscription: ${subUpdateError.message}`);
    }

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

  logger.info('[Polar Webhook] Processing subscription.canceled', sanitizePII({
    subscription_id: subscriptionId,
    customer_email,
  }));

  try {
    // 1. Find user
    const { data: user, error: userError } = await supabaseServiceClient
      .from('users')
      .select('id')
      .eq('email', customer_email)
      .single();

    if (userError || !user) {
      logger.error('[Polar Webhook] User not found', sanitizePII({ customer_email }));
      return;
    }

    // 2. Update subscription status (DO NOT DELETE - retain for audit)
    // Per TRIAL-MODEL.md: Plan remains unchanged, only status = 'canceled'
    const { error: subCancelError } = await supabaseServiceClient
      .from('user_subscriptions')
      .update({
        status: 'canceled',
        cancel_at_period_end: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (subCancelError) {
      logger.error('[Polar Webhook] Failed to update subscription to canceled', {
        user_id: user.id,
        error: subCancelError.message
      });
      throw new Error(`Failed to cancel subscription: ${subCancelError.message}`);
    }

    logger.info('[Polar Webhook] ✅ Subscription canceled successfully', {
      user_id: user.id,
      status: 'canceled',
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
