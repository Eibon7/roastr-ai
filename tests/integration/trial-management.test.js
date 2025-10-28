/**
 * Trial Management Integration Tests - Issue #678
 * Tests for trial functionality and billing integration
 */

const request = require('supertest');
const { createTestApp } = require('../helpers/testApp');
const { supabaseServiceClient } = require('../../src/config/supabase');
const EntitlementsService = require('../../src/services/entitlementsService');

describe('Trial Management Integration', () => {
  let app;
  let testUser;
  let authToken;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    // Create test user
    testUser = {
      id: 'test-trial-user-' + Date.now(),
      email: 'trial-test@example.com',
      plan: 'starter_trial'
    };

    // Insert test user
    await supabaseServiceClient.from('organizations').insert({
      id: testUser.id,
      plan_id: 'starter_trial',
      created_at: new Date().toISOString()
    });

    // Mock auth token
    authToken = 'mock-jwt-token-for-trial-tests';
  });

  afterEach(async () => {
    // Cleanup test data
    await supabaseServiceClient
      .from('organizations')
      .delete()
      .eq('id', testUser.id);
  });

  describe('POST /api/billing/start-trial', () => {
    test('starts trial for user not in trial', async () => {
      // First ensure user is not in trial
      await supabaseServiceClient
        .from('organizations')
        .update({
          plan_id: 'starter',
          trial_starts_at: null,
          trial_ends_at: null
        })
        .eq('id', testUser.id);

      const response = await request(app)
        .post('/api/billing/start-trial')
        .set('Authorization', `Bearer ${authToken}`)
        .set('user', JSON.stringify({ id: testUser.id, email: testUser.email }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Trial started successfully');
      expect(response.body.data.trial_ends_at).toBeDefined();
      expect(response.body.data.duration_days).toBe(30);
    });

    test('fails if user already in trial', async () => {
      // Set user as in trial
      await supabaseServiceClient
        .from('organizations')
        .update({
          plan_id: 'starter_trial',
          trial_starts_at: new Date().toISOString(),
          trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('id', testUser.id);

      const response = await request(app)
        .post('/api/billing/start-trial')
        .set('Authorization', `Bearer ${authToken}`)
        .set('user', JSON.stringify({ id: testUser.id, email: testUser.email }));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User is already in trial period');
    });

    test('requires authentication', async () => {
      const response = await request(app)
        .post('/api/billing/start-trial');

      expect(response.status).toBe(401);
    });
  });

  describe('EntitlementsService Trial Methods', () => {
    let entitlementsService;

    beforeEach(() => {
      entitlementsService = new EntitlementsService();
    });

    test('trial lifecycle: start → check → convert', async () => {
      // Start trial
      const startResult = await entitlementsService.startTrial(testUser.id, 7);
      expect(startResult.success).toBe(true);

      // Check if in trial
      const isInTrial = await entitlementsService.isInTrial(testUser.id);
      expect(isInTrial).toBe(true);

      // Get trial status
      const status = await entitlementsService.getTrialStatus(testUser.id);
      expect(status.in_trial).toBe(true);
      expect(status.days_left).toBeGreaterThan(0);

      // Check not expired
      const isExpired = await entitlementsService.checkTrialExpiration(testUser.id);
      expect(isExpired).toBe(false);

      // Convert to paid
      const convertResult = await entitlementsService.convertTrialToPaid(testUser.id);
      expect(convertResult.success).toBe(true);
      expect(convertResult.new_plan).toBe('starter');

      // Verify no longer in trial
      const isStillInTrial = await entitlementsService.isInTrial(testUser.id);
      expect(isStillInTrial).toBe(false);
    });

    test('trial expiration handling', async () => {
      // Start trial with very short duration (1 second)
      const shortTrialResult = await entitlementsService.startTrial(testUser.id, 0.00001); // ~1 second
      expect(shortTrialResult.success).toBe(true);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check expiration
      const isExpired = await entitlementsService.checkTrialExpiration(testUser.id);
      expect(isExpired).toBe(true);

      // Get status should show expired
      const status = await entitlementsService.getTrialStatus(testUser.id);
      expect(status.expired).toBe(true);
      expect(status.in_trial).toBe(false);
    });

    test('cancel trial converts to paid immediately', async () => {
      // Start trial
      await entitlementsService.startTrial(testUser.id, 30);

      // Cancel trial
      const cancelResult = await entitlementsService.cancelTrial(testUser.id);
      expect(cancelResult.success).toBe(true);
      expect(cancelResult.cancelled).toBe(true);

      // Verify no longer in trial
      const isInTrial = await entitlementsService.isInTrial(testUser.id);
      expect(isInTrial).toBe(false);

      // Verify plan is starter (paid)
      const subscription = await entitlementsService.getSubscription(testUser.id);
      expect(subscription.plan_id).toBe('starter');
    });
  });
});
