#!/usr/bin/env node

/**
 * Simulate Polar Webhook Events
 *
 * This script sends mock webhook events to your local server
 * for testing webhook handlers without needing to complete actual payments.
 *
 * Usage:
 *   node scripts/simulate-polar-webhook.js <event-type>
 *
 * Examples:
 *   node scripts/simulate-polar-webhook.js order.created
 *   node scripts/simulate-polar-webhook.js subscription.created
 *   node scripts/simulate-polar-webhook.js subscription.canceled
 */

const http = require('http');

// Mock webhook events
const mockEvents = {
  'checkout.created': {
    type: 'checkout.created',
    id: 'evt_mock_checkout_created_123',
    created_at: new Date().toISOString(),
    data: {
      id: 'checkout_mock_123',
      customer_email: 'test@example.com',
      status: 'open',
      product_price_id: 'price_mock_pro_monthly',
      amount: 1500,
      currency: 'usd',
      created_at: new Date().toISOString(),
    },
  },

  'order.created': {
    type: 'order.created',
    id: 'evt_mock_order_created_456',
    created_at: new Date().toISOString(),
    data: {
      id: 'order_mock_456',
      customer_email: 'test@example.com',
      amount: 1500,
      currency: 'usd',
      product_price_id: 'price_mock_pro_monthly',
      status: 'succeeded',
      created_at: new Date().toISOString(),
    },
  },

  'subscription.created': {
    type: 'subscription.created',
    id: 'evt_mock_sub_created_789',
    created_at: new Date().toISOString(),
    data: {
      id: 'sub_mock_789',
      customer_email: 'test@example.com',
      status: 'active',
      product_price_id: 'price_mock_pro_monthly',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      created_at: new Date().toISOString(),
    },
  },

  'subscription.updated': {
    type: 'subscription.updated',
    id: 'evt_mock_sub_updated_101',
    created_at: new Date().toISOString(),
    data: {
      id: 'sub_mock_789',
      customer_email: 'test@example.com',
      status: 'active',
      product_price_id: 'price_mock_plus_monthly', // Upgraded plan
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  },

  'subscription.canceled': {
    type: 'subscription.canceled',
    id: 'evt_mock_sub_canceled_202',
    created_at: new Date().toISOString(),
    data: {
      id: 'sub_mock_789',
      customer_email: 'test@example.com',
      status: 'canceled',
      product_price_id: 'price_mock_pro_monthly',
      canceled_at: new Date().toISOString(),
    },
  },
};

// Get event type from command line argument
const eventType = process.argv[2];

// Show help if no event type provided
if (!eventType) {
  console.log('');
  console.log('🧪 Polar Webhook Event Simulator');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/simulate-polar-webhook.js <event-type>');
  console.log('');
  console.log('Available event types:');
  Object.keys(mockEvents).forEach((type) => {
    console.log(`  - ${type}`);
  });
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/simulate-polar-webhook.js order.created');
  console.log('  node scripts/simulate-polar-webhook.js subscription.canceled');
  console.log('');
  process.exit(0);
}

// Check if event type is valid
if (!mockEvents[eventType]) {
  console.error('');
  console.error(`❌ Error: Unknown event type "${eventType}"`);
  console.error('');
  console.error('Available event types:');
  Object.keys(mockEvents).forEach((type) => {
    console.log(`  - ${type}`);
  });
  console.error('');
  process.exit(1);
}

// Get the mock event
const event = mockEvents[eventType];
const payload = JSON.stringify(event);

// Webhook endpoint configuration
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/polar/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Polar-Signature': 'mock_signature_for_dev', // Mock signature
  },
};

console.log('');
console.log('📡 Sending mock webhook event...');
console.log('');
console.log('Event Type:', eventType);
console.log('Event ID:', event.id);
console.log('Customer Email:', event.data.customer_email);
console.log('');
console.log('Payload:');
console.log(JSON.stringify(event, null, 2));
console.log('');

// Send the request
const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ Webhook sent successfully!');
      console.log('');
      console.log('Response:', data);
      console.log('');
      console.log('Check your server logs for webhook processing output.');
      console.log('');
    } else {
      console.error('❌ Webhook failed!');
      console.error('');
      console.error('Status Code:', res.statusCode);
      console.error('Response:', data);
      console.error('');
    }
  });
});

req.on('error', (error) => {
  console.error('');
  console.error('❌ Error sending webhook:');
  console.error('');
  console.error(error.message);
  console.error('');
  console.error('Make sure your server is running on http://localhost:3000');
  console.error('Start it with: npm start');
  console.error('');
  process.exit(1);
});

// Send the payload
req.write(payload);
req.end();
