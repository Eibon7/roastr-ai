/**
 * @fileoverview Unit tests for CreditPolicy
 * @since ROA-388
 */

const { describe, it, expect, beforeEach, vi } = require('vitest');
const CreditPolicy = require('../../../../../src/services/ingestion/policies/CreditPolicy');

// Mock costControl
vi.mock('../../../../../src/services/costControl');
const costControl = require('../../../../../src/services/costControl');

// Mock logger
vi.mock('../../../../../src/utils/logger');

describe('CreditPolicy', () => {
  let policy;
  let context;

  beforeEach(() => {
    policy = new CreditPolicy();
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
    it('should allow ingestion when user has credits remaining', async () => {
      costControl.getUsage.mockResolvedValue({
        analysis_remaining: 100,
        analysis_limit: 1000,
        analysis_used: 900
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(true);
      expect(result.metadata.remaining).toBe(100);
      expect(result.metadata.limit).toBe(1000);
      expect(result.reason).toBeUndefined();
    });

    it('should block ingestion when user has zero credits', async () => {
      costControl.getUsage.mockResolvedValue({
        analysis_remaining: 0,
        analysis_limit: 1000,
        analysis_used: 1000
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('credit_exhausted');
      expect(result.metadata.remaining).toBe(0);
      expect(result.metadata.limit).toBe(1000);
      expect(result.metadata.used).toBe(1000);
      expect(result.retry_after_seconds).toBeUndefined();
    });

    it('should block ingestion when user has negative credits', async () => {
      costControl.getUsage.mockResolvedValue({
        analysis_remaining: -5,
        analysis_limit: 1000,
        analysis_used: 1005
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('credit_exhausted');
    });

    it('should block when usage data cannot be fetched', async () => {
      costControl.getUsage.mockResolvedValue(null);

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('credit_verification_error');
      expect(result.metadata.error).toBeDefined();
    });

    it('should block on unexpected errors (fail-safe)', async () => {
      costControl.getUsage.mockRejectedValue(new Error('Database connection failed'));

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('credit_policy_error');
      expect(result.metadata.error).toBe('Database connection failed');
    });
  });
});
