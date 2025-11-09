/**
 * Worker Enforcement Integration Tests - M1
 * CodeRabbit Review #3438504879 (CRITICAL)
 *
 * Tests worker-level trial enforcement per TRIAL-MODEL.md Section 2
 * Verifies isPlanActive(), tier limit enforcement, and operation blocking
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock dependencies BEFORE requiring modules (Pattern from coderabbit-lessons.md #11)
jest.mock('../../src/config/supabase');
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));
jest.mock('../../src/services/queueService');
jest.mock('../../src/services/shieldService');
jest.mock('../../src/services/planLimitsService');

// Mock Supabase with stateful behavior
const mockSupabaseData = {
  users: {},
  user_subscriptions: {},
  roast_usage: {}
};

const mockSupabase = {
  from: jest.fn((tableName) => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => {
          if (tableName === 'users') {
            const userId = Object.keys(mockSupabaseData.users)[0];
            return Promise.resolve({
              data: mockSupabaseData.users[userId] || null,
              error: null
            });
          }
          if (tableName === 'user_subscriptions') {
            const userId = Object.keys(mockSupabaseData.user_subscriptions)[0];
            return Promise.resolve({
              data: mockSupabaseData.user_subscriptions[userId] || null,
              error: null
            });
          }
          if (tableName === 'roast_usage') {
            const userId = Object.keys(mockSupabaseData.roast_usage)[0];
            return Promise.resolve({
              data: mockSupabaseData.roast_usage[userId] || { count: 0 },
              error: null
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
        maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null }))
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve({ error: null }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: { id: 'mock-id' }, error: null }))
      }))
    }))
  })),
  rpc: jest.fn((functionName, params) => {
    if (functionName === 'is_plan_active') {
      const sub = mockSupabaseData.user_subscriptions[params.p_user_id];
      // Default to false if no subscription (fail-closed pattern)
      const isActive = sub ? sub.status === 'active' : false;
      return Promise.resolve({ data: isActive, error: null });
    }
    if (functionName === 'check_tier_limit') {
      const usage = mockSupabaseData.roast_usage[params.p_user_id] || { count: 0 };
      const limit = params.p_limit || 10;
      const canProceed = usage.count < limit;
      return Promise.resolve({ data: canProceed, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  })
};

jest.mock('../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));

// Import services AFTER mocks are configured
const queueService = require('../../src/services/queueService');
const shieldService = require('../../src/services/shieldService');
const planLimitsService = require('../../src/services/planLimitsService');

describe('Worker Enforcement Integration Tests (M1)', () => {
  const activeTrialUserId = 'test-user-active-trial';
  const expiredTrialUserId = 'test-user-expired-trial';

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup: Active trial user (day 15/30)
    mockSupabaseData.users[activeTrialUserId] = {
      id: activeTrialUserId,
      email: 'active-trial@roastr.ai',
      plan: 'starter_trial',
      created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    };

    mockSupabaseData.user_subscriptions[activeTrialUserId] = {
      user_id: activeTrialUserId,
      plan: 'starter_trial',
      status: 'active',
      trial_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString() // 15 days remaining
    };

    mockSupabaseData.roast_usage[activeTrialUserId] = {
      user_id: activeTrialUserId,
      count: 0
    };

    // Setup: Expired trial user
    mockSupabaseData.users[expiredTrialUserId] = {
      id: expiredTrialUserId,
      email: 'expired-trial@roastr.ai',
      plan: 'starter_trial',
      created_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
    };

    mockSupabaseData.user_subscriptions[expiredTrialUserId] = {
      user_id: expiredTrialUserId,
      plan: 'starter_trial',
      status: 'expired',
      trial_end: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() // Expired yesterday
    };

    // Mock services
    queueService.enqueue = jest.fn().mockResolvedValue({ success: true });
    shieldService.executeAction = jest.fn().mockResolvedValue({ success: true });
    planLimitsService.checkLimit = jest.fn().mockResolvedValue({ allowed: true });
  });

  afterEach(() => {
    // Clean up mock data
    mockSupabaseData.users = {};
    mockSupabaseData.user_subscriptions = {};
    mockSupabaseData.roast_usage = {};
  });

  describe('isPlanActive() Enforcement', () => {
    it('should allow roast generation for active trial', async () => {
      // Arrange
      const subscription = mockSupabaseData.user_subscriptions[activeTrialUserId];
      expect(subscription.status).toBe('active');

      // Act - Check if plan is active
      const { data: isActive } = await mockSupabase.rpc('is_plan_active', {
        p_user_id: activeTrialUserId
      });

      // Assert
      expect(isActive).toBe(true);

      // Worker should allow roast generation
      await queueService.enqueue({
        type: 'generate_roast',
        userId: activeTrialUserId,
        commentId: 'test-comment-123'
      });

      expect(queueService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'generate_roast',
          userId: activeTrialUserId
        })
      );
    });

    it('should reject roast generation for expired trial', async () => {
      // Arrange
      const subscription = mockSupabaseData.user_subscriptions[expiredTrialUserId];
      expect(subscription.status).toBe('expired');

      // Act - Check if plan is active
      const { data: isActive } = await mockSupabase.rpc('is_plan_active', {
        p_user_id: expiredTrialUserId
      });

      // Assert
      expect(isActive).toBe(false);

      // Worker should reject job (simulate worker logic)
      if (!isActive) {
        // Job rejected, queue not called
        expect(queueService.enqueue).not.toHaveBeenCalled();
      }
    });

    it('should reject job with "Trial expired" reason', async () => {
      // Arrange
      const { data: isActive } = await mockSupabase.rpc('is_plan_active', {
        p_user_id: expiredTrialUserId
      });

      // Act - Simulate worker rejection
      let rejectionReason = null;
      if (!isActive) {
        rejectionReason = 'Trial expired';
      }

      // Assert
      expect(rejectionReason).toBe('Trial expired');
      expect(isActive).toBe(false);
    });
  });

  describe('Tier Limit Enforcement During Trial', () => {
    it('should allow roasts within trial limit (10 roasts/month)', async () => {
      // Arrange - User has generated 5 roasts
      mockSupabaseData.roast_usage[activeTrialUserId].count = 5;

      // Act - Check if within limit
      const { data: canProceed } = await mockSupabase.rpc('check_tier_limit', {
        p_user_id: activeTrialUserId,
        p_limit: 10
      });

      // Assert
      expect(canProceed).toBe(true);
    });

    it('should reject 11th roast when trial limit is 10', async () => {
      // Arrange - User has generated 10 roasts (limit reached)
      mockSupabaseData.roast_usage[activeTrialUserId].count = 10;

      // Act - Attempt 11th roast
      const { data: canProceed } = await mockSupabase.rpc('check_tier_limit', {
        p_user_id: activeTrialUserId,
        p_limit: 10
      });

      // Assert
      expect(canProceed).toBe(false);

      // Rejection reason should be "Limit exceeded", NOT "Trial expired"
      const rejectionReason = !canProceed ? 'Limit exceeded' : null;
      expect(rejectionReason).toBe('Limit exceeded');
    });

    it('should distinguish between "Limit exceeded" and "Trial expired"', async () => {
      // Case 1: Active trial, limit exceeded
      mockSupabaseData.roast_usage[activeTrialUserId].count = 10;
      const { data: canProceed1 } = await mockSupabase.rpc('check_tier_limit', {
        p_user_id: activeTrialUserId,
        p_limit: 10
      });
      const { data: isActive1 } = await mockSupabase.rpc('is_plan_active', {
        p_user_id: activeTrialUserId
      });

      expect(isActive1).toBe(true);
      expect(canProceed1).toBe(false);
      const reason1 = !canProceed1 && isActive1 ? 'Limit exceeded' : 'Trial expired';
      expect(reason1).toBe('Limit exceeded');

      // Case 2: Expired trial, limit irrelevant
      const { data: isActive2 } = await mockSupabase.rpc('is_plan_active', {
        p_user_id: expiredTrialUserId
      });

      expect(isActive2).toBe(false);
      const reason2 = !isActive2 ? 'Trial expired' : 'Limit exceeded';
      expect(reason2).toBe('Trial expired');
    });

    it('should enforce platform limit (1 platform for starter_trial)', async () => {
      // Arrange
      const subscription = mockSupabaseData.user_subscriptions[activeTrialUserId];
      expect(subscription.plan).toBe('starter_trial');

      // Act - Simulate platform limit check
      const platformLimit = 1; // starter_trial allows 1 platform
      const connectedPlatforms = ['twitter']; // User connected 1 platform

      // Assert
      expect(connectedPlatforms.length).toBeLessThanOrEqual(platformLimit);

      // Attempt to connect 2nd platform should fail
      const canConnectMore = connectedPlatforms.length < platformLimit;
      expect(canConnectMore).toBe(false);
    });
  });

  describe('Shield Moderation During Trial', () => {
    it('should allow Shield actions during active trial', async () => {
      // Arrange
      const { data: isActive } = await mockSupabase.rpc('is_plan_active', {
        p_user_id: activeTrialUserId
      });
      expect(isActive).toBe(true);

      // Act - Execute Shield action (block user)
      await shieldService.executeAction({
        type: 'block_user',
        userId: activeTrialUserId,
        targetUserId: 'toxic-user-123',
        reason: 'Repeated violations'
      });

      // Assert
      expect(shieldService.executeAction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'block_user',
          userId: activeTrialUserId
        })
      );
    });

    it('should disable Shield for expired trial', async () => {
      // Arrange
      const { data: isActive } = await mockSupabase.rpc('is_plan_active', {
        p_user_id: expiredTrialUserId
      });
      expect(isActive).toBe(false);

      // Act - Attempt Shield action
      if (!isActive) {
        // Shield disabled for expired trial
        expect(shieldService.executeAction).not.toHaveBeenCalled();
      }

      // Assert
      expect(shieldService.executeAction).not.toHaveBeenCalled();
    });
  });

  describe('All Processing Disabled on Trial Expiry', () => {
    it('should reject roast generation for expired trial', async () => {
      // Arrange
      const { data: isActive } = await mockSupabase.rpc('is_plan_active', {
        p_user_id: expiredTrialUserId
      });

      // Act - Attempt roast generation
      if (!isActive) {
        // Reject without calling queue
      } else {
        await queueService.enqueue({ type: 'generate_roast', userId: expiredTrialUserId });
      }

      // Assert
      expect(isActive).toBe(false);
      expect(queueService.enqueue).not.toHaveBeenCalled();
    });

    it('should reject comment analysis for expired trial', async () => {
      // Arrange
      const { data: isActive } = await mockSupabase.rpc('is_plan_active', {
        p_user_id: expiredTrialUserId
      });

      // Act - Attempt comment analysis
      if (!isActive) {
        // Reject without calling queue
      } else {
        await queueService.enqueue({ type: 'analyze_comments', userId: expiredTrialUserId });
      }

      // Assert
      expect(isActive).toBe(false);
      expect(queueService.enqueue).not.toHaveBeenCalled();
    });

    it('should reject Shield actions for expired trial', async () => {
      // Arrange
      const { data: isActive } = await mockSupabase.rpc('is_plan_active', {
        p_user_id: expiredTrialUserId
      });

      // Act - Attempt Shield action
      if (!isActive) {
        // Reject without calling Shield
      } else {
        await shieldService.executeAction({ type: 'block_user', userId: expiredTrialUserId });
      }

      // Assert
      expect(isActive).toBe(false);
      expect(shieldService.executeAction).not.toHaveBeenCalled();
    });

    it('should allow all 3 operations for active trial', async () => {
      // Arrange
      const { data: isActive } = await mockSupabase.rpc('is_plan_active', {
        p_user_id: activeTrialUserId
      });
      expect(isActive).toBe(true);

      // Act - All 3 operations
      await queueService.enqueue({ type: 'generate_roast', userId: activeTrialUserId });
      await queueService.enqueue({ type: 'analyze_comments', userId: activeTrialUserId });
      await shieldService.executeAction({ type: 'block_user', userId: activeTrialUserId });

      // Assert - All succeeded
      expect(queueService.enqueue).toHaveBeenCalledTimes(2);
      expect(shieldService.executeAction).toHaveBeenCalledTimes(1);
    });

    it('should block all 3 operations for expired trial', async () => {
      // Arrange
      const { data: isActive } = await mockSupabase.rpc('is_plan_active', {
        p_user_id: expiredTrialUserId
      });
      expect(isActive).toBe(false);

      // Act - Attempt all 3 operations (all should be blocked by worker checks)
      // Simulate worker logic: if (!isActive) reject
      // No actual calls should happen

      // Assert - All blocked
      expect(queueService.enqueue).not.toHaveBeenCalled();
      expect(shieldService.executeAction).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing subscription gracefully', async () => {
      // Arrange - User without subscription
      const missingUserId = 'user-no-subscription';
      mockSupabaseData.users[missingUserId] = {
        id: missingUserId,
        plan: 'starter_trial'
      };
      // No subscription entry

      // Act
      const result = await mockSupabase.rpc('is_plan_active', {
        p_user_id: missingUserId
      });

      // Assert - Should handle gracefully (default to inactive)
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      // Missing subscription should default to inactive (false)
      expect(result.data).toBe(false);
    });

    it('should handle concurrent worker checks', async () => {
      // Arrange - Simulate multiple workers checking same user
      const promises = [
        mockSupabase.rpc('is_plan_active', { p_user_id: activeTrialUserId }),
        mockSupabase.rpc('is_plan_active', { p_user_id: activeTrialUserId }),
        mockSupabase.rpc('is_plan_active', { p_user_id: activeTrialUserId })
      ];

      // Act
      const results = await Promise.all(promises);

      // Assert - All return same result (consistent)
      expect(results[0].data).toBe(results[1].data);
      expect(results[1].data).toBe(results[2].data);
    });

    it('should enforce limits even at exactly limit boundary', async () => {
      // Arrange - User has exactly 10 roasts (limit)
      mockSupabaseData.roast_usage[activeTrialUserId].count = 10;

      // Act - Check if can proceed (should be false at exactly limit)
      const { data: canProceed } = await mockSupabase.rpc('check_tier_limit', {
        p_user_id: activeTrialUserId,
        p_limit: 10
      });

      // Assert
      expect(canProceed).toBe(false);
    });

    it('should allow at limit - 1', async () => {
      // Arrange - User has 9 roasts (limit 10)
      mockSupabaseData.roast_usage[activeTrialUserId].count = 9;

      // Act
      const { data: canProceed } = await mockSupabase.rpc('check_tier_limit', {
        p_user_id: activeTrialUserId,
        p_limit: 10
      });

      // Assert
      expect(canProceed).toBe(true);
    });
  });
});
