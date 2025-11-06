/**
 * Polar Checkout Flow E2E Tests
 *
 * Tests the Polar webhook flow and database updates.
 *
 * Test Coverage:
 * - Webhook processes order.created event
 * - Database updates with new subscription
 * - Webhook idempotency (no duplicate subscriptions)
 * - Webhook security (signature validation)
 *
 * Note: These tests focus on webhook processing since creating real Polar checkout sessions
 * requires valid Polar API credentials and real email addresses.
 *
 * Issue #729: E2E test for complete Polar checkout flow
 */

const { test, expect } = require('@playwright/test');
const {
  createTestUser,
  getUserFromDB,
  getSubscriptionFromDB,
  deleteTestUser,
  simulatePolarWebhook,
  waitFor,
  createTestEmail
} = require('../helpers/polarE2EHelpers');

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const POLAR_PRO_PRICE_ID = process.env.POLAR_PRO_PRICE_ID || 'price_test_pro';

test.describe('Polar Webhook Flow E2E', () => {
  let testEmail;
  let testUser;

  test.beforeEach(async () => {
    // Create unique test email for this test
    testEmail = createTestEmail('polar-webhook');

    // Create test user with basic plan (free tier)
    testUser = await createTestUser(testEmail, 'basic');
  });

  test.afterEach(async () => {
    // Cleanup: Delete test user and subscriptions
    if (testEmail) {
      await deleteTestUser(testEmail);
    }
  });

  test('webhook processes order.created and updates database', async ({ request }) => {
    console.log(`[Test] Created test user: ${testEmail} (ID: ${testUser.id})`);

    // Simulate Polar webhook (order.created event)
    const webhookPayload = {
      id: `order_test_${Date.now()}`,
      customer_email: testEmail,
      amount: 1500, // €15.00
      currency: 'EUR',
      product_price_id: POLAR_PRO_PRICE_ID,
      status: 'succeeded',
      metadata: {
        user_id: testUser.id,
        plan: 'pro'
      }
    };

    const webhookResponse = await simulatePolarWebhook('order.created', webhookPayload, {
      baseURL: BASE_URL
    });

    expect(webhookResponse.ok).toBeTruthy();
    console.log('[Test] Webhook processed successfully');

    // Wait for webhook processing to complete and database to update
    await waitFor(async () => {
      const user = await getUserFromDB(testEmail);
      return user && user.plan === 'pro';
    }, { timeout: 5000, interval: 500 });

    // Verify user plan was upgraded
    const updatedUser = await getUserFromDB(testEmail);
    expect(updatedUser).toBeTruthy();
    expect(updatedUser.plan).toBe('pro');
    console.log('[Test] User plan upgraded to pro');

    // Verify subscription was created
    const subscription = await getSubscriptionFromDB(testUser.id);
    expect(subscription).toBeTruthy();
    expect(subscription.status).toBe('active');
    expect(subscription.plan).toBe('pro');
    console.log('[Test] Subscription created successfully');
  });

  test('webhook idempotency: duplicate order.created events', async ({ request }) => {
    // Send first webhook
    const webhookPayload = {
      id: `order_test_${Date.now()}`,
      customer_email: testEmail,
      amount: 1500,
      currency: 'EUR',
      product_price_id: POLAR_PRO_PRICE_ID,
      status: 'succeeded',
      metadata: {
        user_id: testUser.id,
        plan: 'pro'
      }
    };

    const webhook1 = await simulatePolarWebhook('order.created', webhookPayload, {
      baseURL: BASE_URL
    });
    expect(webhook1.ok).toBeTruthy();

    // Wait for processing
    await waitFor(async () => {
      const user = await getUserFromDB(testEmail);
      return user && user.plan === 'pro';
    }, { timeout: 5000 });

    // Get subscription count after first webhook
    const { supabaseServiceClient } = require('../../src/config/supabase');
    const { data: subscriptions1 } = await supabaseServiceClient
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', testUser.id);

    const subscriptionCount1 = subscriptions1?.length || 0;
    console.log(`[Test] Subscription count after first webhook: ${subscriptionCount1}`);

    // Send duplicate webhook with same payload
    const webhook2 = await simulatePolarWebhook('order.created', webhookPayload, {
      baseURL: BASE_URL
    });
    expect(webhook2.ok).toBeTruthy();

    // Wait a bit for potential duplicate processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify no duplicate subscription was created
    const { data: subscriptions2 } = await supabaseServiceClient
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', testUser.id);

    const subscriptionCount2 = subscriptions2?.length || 0;
    console.log(`[Test] Subscription count after duplicate webhook: ${subscriptionCount2}`);

    // Should be same count (idempotent)
    expect(subscriptionCount2).toBe(subscriptionCount1);
    console.log('[Test] Webhook idempotency verified - no duplicate subscription');
  });

  test('webhook updates user plan correctly for different tiers', async ({ request }) => {
    // Test that different price IDs map to correct plans
    const priceIdToPlan = {
      [process.env.POLAR_PRO_PRICE_ID || 'price_test_pro']: 'pro',
      [process.env.POLAR_PLUS_PRICE_ID || 'price_test_plus']: 'creator_plus'
    };

    for (const [priceId, expectedPlan] of Object.entries(priceIdToPlan)) {
      const webhookPayload = {
        id: `order_test_${Date.now()}_${priceId}`,
        customer_email: testEmail,
        amount: 1500,
        currency: 'EUR',
        product_price_id: priceId,
        status: 'succeeded'
      };

      await simulatePolarWebhook('order.created', webhookPayload, {
        baseURL: BASE_URL
      });

      // Wait for processing
      await waitFor(async () => {
        const user = await getUserFromDB(testEmail);
        return user && user.plan === expectedPlan;
      }, { timeout: 5000 });

      const user = await getUserFromDB(testEmail);
      expect(user.plan).toBe(expectedPlan);
      console.log(`[Test] Plan ${priceId} → ${expectedPlan} verified`);
    }
  });
});

test.describe('Polar Webhook Security', () => {
  let testEmail;
  let testUser;

  test.beforeEach(async () => {
    testEmail = createTestEmail('polar-webhook-security');
    testUser = await createTestUser(testEmail, 'basic');
  });

  test.afterEach(async () => {
    if (testEmail) {
      await deleteTestUser(testEmail);
    }
  });

  test('webhook without signature is rejected (if secret configured)', async ({ request }) => {
    // Only test if webhook secret is configured
    if (!process.env.POLAR_WEBHOOK_SECRET) {
      console.log('[Test] POLAR_WEBHOOK_SECRET not configured - skipping signature test');
      return;
    }

    const webhookPayload = {
      type: 'order.created',
      id: `evt_test_${Date.now()}`,
      data: {
        customer_email: testEmail,
        amount: 1500,
        currency: 'EUR'
      }
    };

    const response = await request.post(`${BASE_URL}/api/polar/webhook`, {
      data: webhookPayload
      // No Polar-Signature header
    });

    // Should reject webhook without signature
    expect(response.status()).toBe(401);
    console.log('[Test] Webhook without signature rejected');
  });

  test('webhook with invalid signature is rejected', async ({ request }) => {
    if (!process.env.POLAR_WEBHOOK_SECRET) {
      console.log('[Test] POLAR_WEBHOOK_SECRET not configured - skipping signature test');
      return;
    }

    const webhookPayload = {
      type: 'order.created',
      id: `evt_test_${Date.now()}`,
      data: {
        customer_email: testEmail,
        amount: 1500,
        currency: 'EUR'
      }
    };

    const response = await request.post(`${BASE_URL}/api/polar/webhook`, {
      headers: {
        'Polar-Signature': 'invalid_signature_12345'
      },
      data: webhookPayload
    });

    expect(response.status()).toBe(401);
    console.log('[Test] Webhook with invalid signature rejected');
  });

  test('webhook logs non-existent user error gracefully', async ({ request }) => {
    const nonExistentEmail = 'nonexistent-' + createTestEmail('test');

    const webhookPayload = {
      id: `order_test_${Date.now()}`,
      customer_email: nonExistentEmail,
      amount: 1500,
      currency: 'EUR',
      product_price_id: POLAR_PRO_PRICE_ID,
      status: 'succeeded'
    };

    const webhookResponse = await simulatePolarWebhook('order.created', webhookPayload, {
      baseURL: BASE_URL
    });

    // Webhook should still return 200 (to avoid retries)
    expect(webhookResponse.ok).toBeTruthy();

    // But user should not be created
    const user = await getUserFromDB(nonExistentEmail);
    expect(user).toBeFalsy();
    console.log('[Test] Webhook handled non-existent user gracefully');
  });
});
