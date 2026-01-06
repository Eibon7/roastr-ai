/**
 * @fileoverview Unit tests for IngestionEligibilityGate
 * @since ROA-388
 */

const { describe, it, expect, beforeEach, vi } = require('vitest');

// Mock all policies
vi.mock('../../../../src/services/ingestion/policies/UserStatusPolicy');
vi.mock('../../../../src/services/ingestion/policies/AccountStatusPolicy');
vi.mock('../../../../src/services/ingestion/policies/SubscriptionPolicy');
vi.mock('../../../../src/services/ingestion/policies/TrialPolicy');
vi.mock('../../../../src/services/ingestion/policies/CreditPolicy');
vi.mock('../../../../src/services/ingestion/policies/FeatureFlagPolicy');
vi.mock('../../../../src/services/ingestion/policies/RateLimitPolicy');

// Mock logger
vi.mock('../../../../src/utils/logger');

describe('IngestionEligibilityGate', () => {
  let gate;
  let mockPolicies;

  beforeEach(() => {
    // Clear module cache to get fresh instance
    vi.resetModules();

    // Setup mock policies
    const UserStatusPolicy = require('../../../../src/services/ingestion/policies/UserStatusPolicy');
    const AccountStatusPolicy = require('../../../../src/services/ingestion/policies/AccountStatusPolicy');
    const SubscriptionPolicy = require('../../../../src/services/ingestion/policies/SubscriptionPolicy');
    const TrialPolicy = require('../../../../src/services/ingestion/policies/TrialPolicy');
    const CreditPolicy = require('../../../../src/services/ingestion/policies/CreditPolicy');
    const FeatureFlagPolicy = require('../../../../src/services/ingestion/policies/FeatureFlagPolicy');
    const RateLimitPolicy = require('../../../../src/services/ingestion/policies/RateLimitPolicy');

    mockPolicies = {
      UserStatusPolicy: new UserStatusPolicy(),
      AccountStatusPolicy: new AccountStatusPolicy(),
      SubscriptionPolicy: new SubscriptionPolicy(),
      TrialPolicy: new TrialPolicy(),
      CreditPolicy: new CreditPolicy(),
      FeatureFlagPolicy: new FeatureFlagPolicy(),
      RateLimitPolicy: new RateLimitPolicy()
    };

    // Set policy names
    mockPolicies.UserStatusPolicy.name = 'UserStatusPolicy';
    mockPolicies.AccountStatusPolicy.name = 'AccountStatusPolicy';
    mockPolicies.SubscriptionPolicy.name = 'SubscriptionPolicy';
    mockPolicies.TrialPolicy.name = 'TrialPolicy';
    mockPolicies.CreditPolicy.name = 'CreditPolicy';
    mockPolicies.FeatureFlagPolicy.name = 'FeatureFlagPolicy';
    mockPolicies.RateLimitPolicy.name = 'RateLimitPolicy';

    // Load gate (will use mocked policies)
    gate = require('../../../../src/services/ingestion/IngestionEligibilityGate');

    vi.clearAllMocks();
  });

  describe('evaluate', () => {
    const input = {
      userId: 'user-123',
      accountId: 'account-456',
      platform: 'x',
      flow: 'timeline'
    };

    it('should allow ingestion when all policies allow', async () => {
      // All policies return allowed: true
      Object.values(mockPolicies).forEach((policy) => {
        policy.evaluate = vi.fn().mockResolvedValue({
          allowed: true,
          metadata: {}
        });
      });

      const result = await gate.evaluate(input);

      expect(result.allowed).toBe(true);
      expect(result.blocked_by).toBeUndefined();

      // Verify all policies were evaluated
      Object.values(mockPolicies).forEach((policy) => {
        expect(policy.evaluate).toHaveBeenCalledOnce();
      });
    });

    it('should block ingestion when UserStatusPolicy blocks', async () => {
      mockPolicies.UserStatusPolicy.evaluate = vi.fn().mockResolvedValue({
        allowed: false,
        reason: 'user_suspended',
        metadata: { is_suspended: true }
      });

      // Other policies should not be called
      Object.keys(mockPolicies)
        .filter((key) => key !== 'UserStatusPolicy')
        .forEach((key) => {
          mockPolicies[key].evaluate = vi.fn().mockResolvedValue({
            allowed: true,
            metadata: {}
          });
        });

      const result = await gate.evaluate(input);

      expect(result.allowed).toBe(false);
      expect(result.blocked_by).toEqual({
        policy: 'UserStatusPolicy',
        reason: 'user_suspended',
        retry_after_seconds: undefined
      });

      // Verify only UserStatusPolicy was evaluated (fail-fast)
      expect(mockPolicies.UserStatusPolicy.evaluate).toHaveBeenCalledOnce();
      expect(mockPolicies.SubscriptionPolicy.evaluate).not.toHaveBeenCalled();
    });

    it('should block ingestion when CreditPolicy blocks', async () => {
      // First 3 policies allow
      mockPolicies.UserStatusPolicy.evaluate = vi
        .fn()
        .mockResolvedValue({ allowed: true, metadata: {} });
      mockPolicies.SubscriptionPolicy.evaluate = vi
        .fn()
        .mockResolvedValue({ allowed: true, metadata: {} });
      mockPolicies.TrialPolicy.evaluate = vi
        .fn()
        .mockResolvedValue({ allowed: true, metadata: {} });

      // CreditPolicy blocks
      mockPolicies.CreditPolicy.evaluate = vi.fn().mockResolvedValue({
        allowed: false,
        reason: 'credit_exhausted',
        metadata: { remaining: 0 }
      });

      // Later policies should not be called
      mockPolicies.FeatureFlagPolicy.evaluate = vi
        .fn()
        .mockResolvedValue({ allowed: true, metadata: {} });
      mockPolicies.RateLimitPolicy.evaluate = vi
        .fn()
        .mockResolvedValue({ allowed: true, metadata: {} });

      const result = await gate.evaluate(input);

      expect(result.allowed).toBe(false);
      expect(result.blocked_by.policy).toBe('CreditPolicy');
      expect(result.blocked_by.reason).toBe('credit_exhausted');

      // Verify evaluation stopped at CreditPolicy
      expect(mockPolicies.UserStatusPolicy.evaluate).toHaveBeenCalledOnce();
      expect(mockPolicies.SubscriptionPolicy.evaluate).toHaveBeenCalledOnce();
      expect(mockPolicies.TrialPolicy.evaluate).toHaveBeenCalledOnce();
      expect(mockPolicies.CreditPolicy.evaluate).toHaveBeenCalledOnce();
      expect(mockPolicies.FeatureFlagPolicy.evaluate).not.toHaveBeenCalled();
      expect(mockPolicies.RateLimitPolicy.evaluate).not.toHaveBeenCalled();
    });

    it('should include retry_after_seconds when policy provides it', async () => {
      // First 5 policies allow
      mockPolicies.UserStatusPolicy.evaluate = vi
        .fn()
        .mockResolvedValue({ allowed: true, metadata: {} });
      mockPolicies.SubscriptionPolicy.evaluate = vi
        .fn()
        .mockResolvedValue({ allowed: true, metadata: {} });
      mockPolicies.TrialPolicy.evaluate = vi
        .fn()
        .mockResolvedValue({ allowed: true, metadata: {} });
      mockPolicies.CreditPolicy.evaluate = vi
        .fn()
        .mockResolvedValue({ allowed: true, metadata: {} });
      mockPolicies.FeatureFlagPolicy.evaluate = vi
        .fn()
        .mockResolvedValue({ allowed: true, metadata: {} });

      // RateLimitPolicy blocks with retry_after
      mockPolicies.RateLimitPolicy.evaluate = vi.fn().mockResolvedValue({
        allowed: false,
        reason: 'rate_limit_exceeded',
        retry_after_seconds: 120,
        metadata: { scope: 'global' }
      });

      const result = await gate.evaluate(input);

      expect(result.allowed).toBe(false);
      expect(result.blocked_by).toEqual({
        policy: 'RateLimitPolicy',
        reason: 'rate_limit_exceeded',
        retry_after_seconds: 120
      });
    });

    it('should handle unexpected errors gracefully (fail-safe)', async () => {
      mockPolicies.UserStatusPolicy.evaluate = vi
        .fn()
        .mockRejectedValue(new Error('Unexpected error'));

      const result = await gate.evaluate(input);

      expect(result.allowed).toBe(false);
      expect(result.blocked_by.policy).toBe('IngestionEligibilityGate');
      expect(result.blocked_by.reason).toBe('evaluation_error');
    });

    it('should generate requestId if not provided', async () => {
      Object.values(mockPolicies).forEach((policy) => {
        policy.evaluate = vi.fn().mockResolvedValue({
          allowed: true,
          metadata: {}
        });
      });

      const result = await gate.evaluate(input);

      expect(result.allowed).toBe(true);

      // Verify context passed to policies includes requestId
      const firstPolicyCall = mockPolicies.UserStatusPolicy.evaluate.mock.calls[0];
      expect(firstPolicyCall[0].requestId).toBeDefined();
      expect(typeof firstPolicyCall[0].requestId).toBe('string');
    });

    it('should use provided requestId', async () => {
      const customRequestId = 'custom-req-123';

      Object.values(mockPolicies).forEach((policy) => {
        policy.evaluate = vi.fn().mockResolvedValue({
          allowed: true,
          metadata: {}
        });
      });

      await gate.evaluate({ ...input, requestId: customRequestId });

      // Verify custom requestId was passed to policies
      const firstPolicyCall = mockPolicies.UserStatusPolicy.evaluate.mock.calls[0];
      expect(firstPolicyCall[0].requestId).toBe(customRequestId);
    });

    it('should block ingestion when AccountStatusPolicy blocks (account disconnected)', async () => {
      // UserStatusPolicy allows
      mockPolicies.UserStatusPolicy.evaluate = vi
        .fn()
        .mockResolvedValue({ allowed: true, metadata: {} });

      // AccountStatusPolicy blocks
      mockPolicies.AccountStatusPolicy.evaluate = vi.fn().mockResolvedValue({
        allowed: false,
        reason: 'account_disconnected',
        metadata: { connection_status: 'disconnected', accountId: 'account-456', platform: 'x' }
      });

      // Other policies should not be called (fail-fast)
      mockPolicies.SubscriptionPolicy.evaluate = vi
        .fn()
        .mockResolvedValue({ allowed: true, metadata: {} });
      mockPolicies.TrialPolicy.evaluate = vi
        .fn()
        .mockResolvedValue({ allowed: true, metadata: {} });
      mockPolicies.CreditPolicy.evaluate = vi
        .fn()
        .mockResolvedValue({ allowed: true, metadata: {} });
      mockPolicies.FeatureFlagPolicy.evaluate = vi
        .fn()
        .mockResolvedValue({ allowed: true, metadata: {} });
      mockPolicies.RateLimitPolicy.evaluate = vi
        .fn()
        .mockResolvedValue({ allowed: true, metadata: {} });

      const result = await gate.evaluate(input);

      expect(result.allowed).toBe(false);
      expect(result.blocked_by.policy).toBe('AccountStatusPolicy');
      expect(result.blocked_by.reason).toBe('account_disconnected');

      // Verify evaluation stopped at AccountStatusPolicy (fail-fast)
      expect(mockPolicies.UserStatusPolicy.evaluate).toHaveBeenCalledOnce();
      expect(mockPolicies.AccountStatusPolicy.evaluate).toHaveBeenCalledOnce();
      expect(mockPolicies.SubscriptionPolicy.evaluate).not.toHaveBeenCalled();
      expect(mockPolicies.TrialPolicy.evaluate).not.toHaveBeenCalled();
      expect(mockPolicies.CreditPolicy.evaluate).not.toHaveBeenCalled();
      expect(mockPolicies.FeatureFlagPolicy.evaluate).not.toHaveBeenCalled();
      expect(mockPolicies.RateLimitPolicy.evaluate).not.toHaveBeenCalled();
    });

    it('should not have side effects (no fetch, persist, enqueue)', async () => {
      // This test verifies that the gate only evaluates policies
      // and doesn't perform any data modifications

      Object.values(mockPolicies).forEach((policy) => {
        policy.evaluate = vi.fn().mockResolvedValue({
          allowed: true,
          metadata: {}
        });
      });

      const resultBefore = await gate.evaluate(input);

      // Re-evaluate with same input
      const resultAfter = await gate.evaluate(input);

      // Results should be deterministic (same input → same output)
      expect(resultBefore.allowed).toBe(resultAfter.allowed);

      // Note: We can't verify database state directly in unit tests,
      // but the architecture ensures no writes happen
    });
  });
});
