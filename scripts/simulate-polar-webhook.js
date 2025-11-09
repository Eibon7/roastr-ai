#!/usr/bin/env node
/**
 * Polar Webhook Simulator
 *
 * Simulates Polar webhook events for local testing without requiring actual Polar API calls.
 *
 * Usage:
 *   node scripts/simulate-polar-webhook.js order.created test@example.com
 *   node scripts/simulate-polar-webhook.js subscription.canceled test@example.com
 *
 * Environment Variables Required:
 *   - POLAR_WEBHOOK_SECRET: Secret for signing webhook payloads
 *   - POLAR_STARTER_PRICE_ID: Price ID for starter plan
 *   - POLAR_PRO_PRICE_ID: Price ID for pro plan
 *   - POLAR_PLUS_PRICE_ID: Price ID for plus plan
 *
 * Related: Issue #728 - Webhook business logic implementation
 */

const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, prefix, message) {
  console.log(`${color}[${prefix}]${colors.reset} ${message}`);
}

// Event payload generators
function generateOrderCreatedPayload(email, priceId = process.env.POLAR_STARTER_PRICE_ID) {
  return {
    type: 'order.created',
    id: `evt_${Date.now()}`,
    created_at: new Date().toISOString(),
    data: {
      id: `order_${Date.now()}`,
      customer_email: email,
      product_price_id: priceId,
      amount: 500, // €5.00 in cents
      currency: 'EUR',
      status: 'succeeded',
    },
  };
}

function generateSubscriptionCreatedPayload(email, priceId = process.env.POLAR_PRO_PRICE_ID) {
  return {
    type: 'subscription.created',
    id: `evt_${Date.now()}`,
    created_at: new Date().toISOString(),
    data: {
      id: `sub_${Date.now()}`,
      customer_email: email,
      product_price_id: priceId,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // +30 days
    },
  };
}

function generateSubscriptionUpdatedPayload(email, priceId = process.env.POLAR_PLUS_PRICE_ID) {
  return {
    type: 'subscription.updated',
    id: `evt_${Date.now()}`,
    created_at: new Date().toISOString(),
    data: {
      id: `sub_${Date.now()}`,
      customer_email: email,
      product_price_id: priceId,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  };
}

function generateSubscriptionCanceledPayload(email) {
  return {
    type: 'subscription.canceled',
    id: `evt_${Date.now()}`,
    created_at: new Date().toISOString(),
    data: {
      id: `sub_${Date.now()}`,
      customer_email: email,
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    },
  };
}

function generateCheckoutCreatedPayload(email, priceId = process.env.POLAR_STARTER_PRICE_ID) {
  return {
    type: 'checkout.created',
    id: `evt_${Date.now()}`,
    created_at: new Date().toISOString(),
    data: {
      id: `checkout_${Date.now()}`,
      customer_email: email,
      product_price_id: priceId,
      status: 'open',
    },
  };
}

/**
 * Calculate HMAC-SHA256 signature for webhook payload
 */
function calculateSignature(payload, secret) {
  if (!secret) {
    throw new Error('POLAR_WEBHOOK_SECRET environment variable not set');
  }

  const payloadString = JSON.stringify(payload);
  return crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');
}

/**
 * Send webhook event to local server
 */
async function sendWebhook(eventType, email, baseUrl = 'http://localhost:3000') {
  // Validate environment variables
  if (!process.env.POLAR_WEBHOOK_SECRET) {
    log(colors.red, 'ERROR', 'POLAR_WEBHOOK_SECRET not set in .env');
    process.exit(1);
  }

  // Generate appropriate payload
  let payload;
  switch (eventType) {
    case 'order.created':
      payload = generateOrderCreatedPayload(email);
      break;
    case 'subscription.created':
      payload = generateSubscriptionCreatedPayload(email);
      break;
    case 'subscription.updated':
      payload = generateSubscriptionUpdatedPayload(email);
      break;
    case 'subscription.canceled':
    case 'subscription.cancelled': // Support both spellings
      payload = generateSubscriptionCanceledPayload(email);
      break;
    case 'checkout.created':
      payload = generateCheckoutCreatedPayload(email);
      break;
    default:
      log(colors.red, 'ERROR', `Unknown event type: ${eventType}`);
      log(colors.yellow, 'HELP', 'Valid types: order.created, subscription.created, subscription.updated, subscription.canceled, checkout.created');
      process.exit(1);
  }

  // Calculate signature
  const signature = calculateSignature(payload, process.env.POLAR_WEBHOOK_SECRET);

  // Display event info
  log(colors.cyan, 'EVENT', `Type: ${payload.type}`);
  log(colors.cyan, 'EMAIL', email);
  log(colors.cyan, 'PAYLOAD', JSON.stringify(payload, null, 2));
  log(colors.blue, 'SIGNATURE', signature);

  try {
    // Send webhook request
    const response = await axios.post(
      `${baseUrl}/api/polar/webhook`,
      JSON.stringify(payload),
      {
        headers: {
          'Content-Type': 'application/json',
          'Polar-Signature': signature,
        },
      }
    );

    log(colors.green, 'SUCCESS', `Status: ${response.status}`);
    log(colors.green, 'RESPONSE', JSON.stringify(response.data, null, 2));
  } catch (error) {
    log(colors.red, 'ERROR', `Failed to send webhook: ${error.message}`);

    if (error.response) {
      log(colors.red, 'STATUS', error.response.status);
      log(colors.red, 'DATA', JSON.stringify(error.response.data, null, 2));
    } else if (error.code === 'ECONNREFUSED') {
      log(colors.yellow, 'HINT', 'Is the server running? Try: npm start');
    }

    process.exit(1);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
${colors.cyan}Polar Webhook Simulator${colors.reset}

Usage:
  node scripts/simulate-polar-webhook.js <event_type> <customer_email> [base_url]

Event Types:
  - order.created          (payment confirmed, activates subscription)
  - subscription.created   (new subscription)
  - subscription.updated   (plan change or status update)
  - subscription.canceled  (user canceled subscription)
  - checkout.created       (checkout session started, no action needed)

Examples:
  node scripts/simulate-polar-webhook.js order.created user@example.com
  node scripts/simulate-polar-webhook.js subscription.canceled user@example.com
  node scripts/simulate-polar-webhook.js order.created user@example.com http://localhost:4000

Environment Variables:
  POLAR_WEBHOOK_SECRET     (required)
  POLAR_STARTER_PRICE_ID   (required for order/subscription events)
  POLAR_PRO_PRICE_ID       (required for order/subscription events)
  POLAR_PLUS_PRICE_ID      (required for order/subscription events)
    `);
    process.exit(1);
  }

  const [eventType, email, baseUrl] = args;

  log(colors.blue, 'START', 'Simulating Polar webhook event...');
  await sendWebhook(eventType, email, baseUrl);
  log(colors.green, 'DONE', 'Webhook simulation complete');
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    log(colors.red, 'FATAL', error.message);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = {
  sendWebhook,
  calculateSignature,
  generateOrderCreatedPayload,
  generateSubscriptionCreatedPayload,
  generateSubscriptionUpdatedPayload,
  generateSubscriptionCanceledPayload,
  generateCheckoutCreatedPayload,
};
