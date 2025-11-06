/**
 * Polar E2E Test Helpers
 *
 * Helper functions for E2E testing of Polar checkout flow.
 * Includes user creation, webhook simulation, and database queries.
 *
 * Issue #729: E2E test for complete Polar checkout flow
 */

const crypto = require('crypto');
const { supabaseServiceClient } = require('../../src/config/supabase');
const logger = require('../../src/utils/logger');

/**
 * Create a test user in the database
 *
 * @param {string} email - User email
 * @param {string} plan - Initial plan (default: 'basic')
 * @returns {Promise<{id: string, email: string, plan: string}>}
 */
async function createTestUser(email, plan = 'basic') {
  try {
    const { data, error} = await supabaseServiceClient
      .from('users')
      .insert({
        email,
        plan: plan,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    logger.info('[Polar E2E] Created test user', { email, id: data.id });
    return data;
  } catch (error) {
    logger.error('[Polar E2E] Failed to create test user', { email, error: error.message });
    throw error;
  }
}

/**
 * Get user from database by email
 *
 * @param {string} email - User email
 * @returns {Promise<object|null>}
 */
async function getUserFromDB(email) {
  try {
    const { data, error } = await supabaseServiceClient
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw error;
    }

    return data;
  } catch (error) {
    logger.error('[Polar E2E] Failed to get user from DB', { email, error: error.message });
    throw error;
  }
}

/**
 * Get subscription from database by user ID
 *
 * @param {string} userId - User ID
 * @returns {Promise<object|null>}
 */
async function getSubscriptionFromDB(userId) {
  try {
    const { data, error } = await supabaseServiceClient
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw error;
    }

    return data;
  } catch (error) {
    logger.error('[Polar E2E] Failed to get subscription from DB', { userId, error: error.message });
    throw error;
  }
}

/**
 * Delete test user from database
 *
 * @param {string} email - User email
 * @returns {Promise<void>}
 */
async function deleteTestUser(email) {
  try {
    // Delete subscriptions first (foreign key constraint)
    const user = await getUserFromDB(email);
    if (user) {
      await supabaseServiceClient
        .from('user_subscriptions')
        .delete()
        .eq('user_id', user.id);

      // Delete user
      await supabaseServiceClient
        .from('users')
        .delete()
        .eq('email', email);

      logger.info('[Polar E2E] Deleted test user', { email });
    }
  } catch (error) {
    logger.error('[Polar E2E] Failed to delete test user', { email, error: error.message });
    // Don't throw - cleanup should be best effort
  }
}

/**
 * Generate HMAC signature for webhook payload
 *
 * @param {object} payload - Webhook payload
 * @param {string} secret - Webhook secret
 * @returns {string} - HMAC signature
 */
function generateWebhookSignature(payload, secret) {
  const payloadString = JSON.stringify(payload);
  return crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');
}

/**
 * Simulate Polar webhook event
 *
 * @param {string} eventType - Event type (e.g., 'order.created')
 * @param {object} eventData - Event data
 * @param {object} options - Options
 * @param {string} options.baseURL - Base URL for API (default: http://localhost:3000)
 * @param {string} options.webhookSecret - Webhook secret for signature
 * @returns {Promise<Response>}
 */
async function simulatePolarWebhook(eventType, eventData, options = {}) {
  const baseURL = options.baseURL || process.env.BASE_URL || 'http://localhost:3000';
  const webhookSecret = options.webhookSecret || process.env.POLAR_WEBHOOK_SECRET;

  const payload = {
    type: eventType,
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    data: eventData,
    created_at: new Date().toISOString()
  };

  const signature = webhookSecret ? generateWebhookSignature(payload, webhookSecret) : null;

  const headers = {
    'Content-Type': 'application/json'
  };

  if (signature) {
    headers['Polar-Signature'] = signature;
  }

  try {
    const response = await fetch(`${baseURL}/api/polar/webhook`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    logger.info('[Polar E2E] Simulated webhook', {
      eventType,
      statusCode: response.status,
      hasSignature: !!signature
    });

    return response;
  } catch (error) {
    logger.error('[Polar E2E] Failed to simulate webhook', {
      eventType,
      error: error.message
    });
    throw error;
  }
}

/**
 * Wait for condition to be true (polling with timeout)
 *
 * @param {Function} condition - Async function that returns true when condition is met
 * @param {object} options - Options
 * @param {number} options.timeout - Timeout in ms (default: 10000)
 * @param {number} options.interval - Polling interval in ms (default: 500)
 * @returns {Promise<void>}
 */
async function waitFor(condition, options = {}) {
  const timeout = options.timeout || 10000;
  const interval = options.interval || 500;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const result = await condition();
      if (result) {
        return;
      }
    } catch (error) {
      // Continue waiting
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Create a unique test email
 *
 * @param {string} prefix - Email prefix (default: 'e2e-test')
 * @returns {string} - Unique email
 */
function createTestEmail(prefix = 'e2e-test') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}-${timestamp}-${random}@test.roastr.ai`;
}

module.exports = {
  createTestUser,
  getUserFromDB,
  getSubscriptionFromDB,
  deleteTestUser,
  generateWebhookSignature,
  simulatePolarWebhook,
  waitFor,
  createTestEmail
};
