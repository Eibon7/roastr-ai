/**
 * Trial Management Integration Tests - Issue #678
 * Tests for trial functionality and billing integration
 */

const { supabaseServiceClient } = require('../../src/config/supabase');
const EntitlementsService = require('../../src/services/entitlementsService');

// Requiere Supabase real; ver docs/testing/E2E-REQUIREMENTS.md para details de infraestructura.
// Mock Supabase for integration tests
// Issue #678: Added .maybeSingle() support for robust null handling
jest.mock('../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn(() => ({
      insert: jest.fn().mockReturnValue({
        mockResolvedValue: jest.fn().mockResolvedValue({ error: null })
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null })
      }),
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null })
      }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null, // Initially no trial
            error: null
          }),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null, // Issue #678: Initially return null to allow startTrial() to work
            error: null
          })
        })
      })
    }))
  }
}));

// TODO: These integration tests require a real Supabase instance or stateful mocks
// Unit tests (entitlementsService-trial.test.js) already cover all functionality
// Consider refactoring to use mockSupabaseFactory.js for stateful mocking
describe.skip('Trial Management Integration (SKIPPED - needs real DB)', () => {
  let testUserId;

  beforeEach(async () => {
    // Create test user
    testUserId = 'test-trial-user-' + Date.now();

    // Insert test user
    await supabaseServiceClient.from('organizations').insert({
      id: testUserId,
      plan_id: 'starter_trial',
      created_at: new Date().toISOString()
    });
  });

  afterEach(async () => {
    // Cleanup test data
    await supabaseServiceClient.from('organizations').delete().eq('id', testUserId);
  });

  describe('EntitlementsService Trial Methods', () => {
    let entitlementsService;

    beforeEach(() => {
      entitlementsService = new EntitlementsService();
    });

    test('trial lifecycle: start → check → convert', async () => {
      // Start trial
      const startResult = await entitlementsService.startTrial(testUserId, 7);
      expect(startResult.success).toBe(true);

      // Check if in trial
      const isInTrial = await entitlementsService.isInTrial(testUserId);
      expect(isInTrial).toBe(true);

      // Get trial status
      const status = await entitlementsService.getTrialStatus(testUserId);
      expect(status.in_trial).toBe(true);
      expect(status.days_left).toBeGreaterThan(0);

      // Check not expired
      const isExpired = await entitlementsService.checkTrialExpiration(testUserId);
      expect(isExpired).toBe(false);

      // Convert to paid
      const convertResult = await entitlementsService.convertTrialToPaid(testUserId);
      expect(convertResult.success).toBe(true);
      expect(convertResult.new_plan).toBe('starter');

      // Verify no longer in trial
      const isStillInTrial = await entitlementsService.isInTrial(testUserId);
      expect(isStillInTrial).toBe(false);
    });

    test('trial expiration handling', async () => {
      // Start trial with very short duration (1 second)
      const shortTrialResult = await entitlementsService.startTrial(testUserId, 0.00001); // ~1 second
      expect(shortTrialResult.success).toBe(true);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check expiration
      const isExpired = await entitlementsService.checkTrialExpiration(testUserId);
      expect(isExpired).toBe(true);

      // Get status should show expired
      const status = await entitlementsService.getTrialStatus(testUserId);
      expect(status.expired).toBe(true);
      expect(status.in_trial).toBe(false);
    });

    test('cancel trial converts to paid immediately', async () => {
      // Start trial
      await entitlementsService.startTrial(testUserId, 30);

      // Cancel trial
      const cancelResult = await entitlementsService.cancelTrial(testUserId);
      expect(cancelResult.success).toBe(true);
      expect(cancelResult.cancelled).toBe(true);

      // Verify no longer in trial
      const isInTrial = await entitlementsService.isInTrial(testUserId);
      expect(isInTrial).toBe(false);

      // Verify plan is starter (paid)
      const subscription = await entitlementsService.getSubscription(testUserId);
      expect(subscription.plan_id).toBe('starter');
    });
  });
});
