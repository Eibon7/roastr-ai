/**
 * @fileoverview Unit tests for FeatureFlagPolicy
 * @since ROA-388
 */

const { describe, it, expect, beforeEach, vi } = require('vitest');
const FeatureFlagPolicy = require('../../../../../src/services/ingestion/policies/FeatureFlagPolicy');

// Mock featureFlagService
vi.mock('../../../../../src/services/featureFlagService');
const featureFlagService = require('../../../../../src/services/featureFlagService');

// Mock logger
vi.mock('../../../../../src/utils/logger');

describe('FeatureFlagPolicy', () => {
  let policy;
  let context;

  beforeEach(() => {
    policy = new FeatureFlagPolicy();
    context = {
      userId: 'user-123',
      accountId: 'account-456',
      platform: 'x',
      flow: 'timeline',
      requestId: 'req-789'
    };
    vi.clearAllMocks();
  });

  describe('evaluate', () => {
    it('should allow ingestion when global and account flags are enabled', async () => {
      featureFlagService.isEnabled
        .mockResolvedValueOnce(true) // Global flag
        .mockResolvedValueOnce(true); // Account flag

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(true);
      expect(result.metadata.ingestion_enabled).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should block when global flag is disabled', async () => {
      featureFlagService.isEnabled.mockResolvedValueOnce(false); // Global flag

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('feature_disabled');
      expect(result.metadata.scope).toBe('global');
      expect(result.metadata.flag).toBe('ingestion_enabled');
      expect(result.metadata.value).toBe(false);
    });

    it('should block when account flag is disabled', async () => {
      featureFlagService.isEnabled
        .mockResolvedValueOnce(true) // Global flag
        .mockResolvedValueOnce(false); // Account flag

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('feature_disabled');
      expect(result.metadata.scope).toBe('account');
      expect(result.metadata.flag).toBe('ingestion_enabled');
      expect(result.metadata.value).toBe(false);
    });

    it('should block on unexpected errors (fail-safe)', async () => {
      featureFlagService.isEnabled.mockRejectedValue(new Error('Service unavailable'));

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('feature_flag_error');
      expect(result.metadata.error).toBe('Service unavailable');
    });

    it('should be retryable (no retry_after_seconds)', async () => {
      featureFlagService.isEnabled.mockResolvedValueOnce(false); // Global flag

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('feature_disabled');
      expect(result.retry_after_seconds).toBeUndefined();
      // Flag can be enabled later, so it's implicitly retryable
    });
  });
});
