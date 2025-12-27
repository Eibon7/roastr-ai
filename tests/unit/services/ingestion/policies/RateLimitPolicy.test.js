/**
 * @fileoverview Unit tests for RateLimitPolicy
 * @since ROA-388
 */

const { describe, it, expect, beforeEach, vi } = require('vitest');
const RateLimitPolicy = require('../../../../../src/services/ingestion/policies/RateLimitPolicy');

// Mock redis
const mockRedis = {
  zremrangebyscore: vi.fn(),
  zcard: vi.fn(),
  zrange: vi.fn(),
  zadd: vi.fn(),
  expire: vi.fn()
};

vi.mock('../../../../../src/lib/redis', () => mockRedis);

// Mock logger
vi.mock('../../../../../src/utils/logger');

describe('RateLimitPolicy', () => {
  let policy;
  let context;

  beforeEach(() => {
    policy = new RateLimitPolicy();
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
    it('should allow when all rate limits OK', async () => {
      // All checks return count below limit
      mockRedis.zremrangebyscore.mockResolvedValue();
      mockRedis.zcard.mockResolvedValue(10); // Below limits
      mockRedis.zadd.mockResolvedValue();
      mockRedis.expire.mockResolvedValue();

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(true);
      expect(result.metadata.rate_limits_ok).toBe(true);

      // Verify Redis calls for all 3 levels
      expect(mockRedis.zremrangebyscore).toHaveBeenCalledTimes(3); // global, user, account
      expect(mockRedis.zcard).toHaveBeenCalledTimes(3);
      expect(mockRedis.zadd).toHaveBeenCalledTimes(3);
      expect(mockRedis.expire).toHaveBeenCalledTimes(3);
    });

    it('should block on global rate limit exceeded with retry_after', async () => {
      const oldestTimestamp = Date.now() - 1800000; // 30 min ago

      mockRedis.zremrangebyscore.mockResolvedValue();
      mockRedis.zcard.mockResolvedValueOnce(1000); // Global limit reached
      mockRedis.zrange.mockResolvedValue(['entry-1', oldestTimestamp.toString()]);

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('rate_limit_exceeded');
      expect(result.retry_after_seconds).toBeGreaterThan(0);
      expect(result.retry_after_seconds).toBeLessThanOrEqual(1800); // ~30 min
      expect(result.metadata.scope).toBe('global');
      expect(result.metadata.limit).toBe(1000);

      // Should not check user/account limits after global fails
      expect(mockRedis.zcard).toHaveBeenCalledTimes(1);
    });

    it('should block on user rate limit exceeded with retry_after', async () => {
      const oldestTimestamp = Date.now() - 600000; // 10 min ago

      mockRedis.zremrangebyscore.mockResolvedValue();
      mockRedis.zcard
        .mockResolvedValueOnce(50) // Global OK
        .mockResolvedValueOnce(100); // User limit reached
      mockRedis.zrange.mockResolvedValue(['entry-1', oldestTimestamp.toString()]);

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('rate_limit_exceeded');
      expect(result.retry_after_seconds).toBeGreaterThan(0);
      expect(result.metadata.scope).toBe('user');
      expect(result.metadata.limit).toBe(100);

      // Should not check account limit after user fails
      expect(mockRedis.zcard).toHaveBeenCalledTimes(2);
    });

    it('should block on account rate limit exceeded with retry_after', async () => {
      const oldestTimestamp = Date.now() - 300000; // 5 min ago

      mockRedis.zremrangebyscore.mockResolvedValue();
      mockRedis.zcard
        .mockResolvedValueOnce(50) // Global OK
        .mockResolvedValueOnce(50) // User OK
        .mockResolvedValueOnce(50); // Account limit reached
      mockRedis.zrange.mockResolvedValue(['entry-1', oldestTimestamp.toString()]);

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('rate_limit_exceeded');
      expect(result.retry_after_seconds).toBeGreaterThan(0);
      expect(result.metadata.scope).toBe('account');
      expect(result.metadata.limit).toBe(50);

      expect(mockRedis.zcard).toHaveBeenCalledTimes(3);
    });

    it('should verify sliding window pruning (zremrangebyscore)', async () => {
      const now = Date.now();
      const windowMs = 3600000; // 1 hour

      mockRedis.zremrangebyscore.mockResolvedValue();
      mockRedis.zcard.mockResolvedValue(10);
      mockRedis.zadd.mockResolvedValue();
      mockRedis.expire.mockResolvedValue();

      await policy.evaluate(context);

      // Verify zremrangebyscore was called with correct window
      const calls = mockRedis.zremrangebyscore.mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      calls.forEach((call) => {
        const [key, minScore, maxScore] = call;
        expect(key).toMatch(/^ingestion:(global|user:|account:)/);
        expect(minScore).toBe(0);
        expect(maxScore).toBeLessThanOrEqual(now);
        expect(maxScore).toBeGreaterThan(now - windowMs - 1000); // Allow 1s tolerance
      });
    });

    it('should verify count increment (zadd + expire)', async () => {
      mockRedis.zremrangebyscore.mockResolvedValue();
      mockRedis.zcard.mockResolvedValue(10);
      mockRedis.zadd.mockResolvedValue();
      mockRedis.expire.mockResolvedValue();

      await policy.evaluate(context);

      // Verify zadd was called with timestamp
      const zaddCalls = mockRedis.zadd.mock.calls;
      expect(zaddCalls.length).toBe(3); // global, user, account

      zaddCalls.forEach((call) => {
        const [key, timestamp, value] = call;
        expect(key).toMatch(/^ingestion:(global|user:|account:)/);
        expect(typeof timestamp).toBe('number');
        expect(value).toBe(`${timestamp}`);
      });

      // Verify expire was called with correct TTL
      const expireCalls = mockRedis.expire.mock.calls;
      expect(expireCalls.length).toBe(3);

      expireCalls.forEach((call) => {
        const [key, ttl] = call;
        expect(key).toMatch(/^ingestion:(global|user:|account:)/);
        expect(ttl).toBe(3600); // 1 hour in seconds
      });
    });

    it('should calculate retry_after correctly based on oldest entry', async () => {
      const now = Date.now();
      const oldestTimestamp = now - 1800000; // 30 minutes ago
      const expectedRetryAfter = Math.ceil((oldestTimestamp + 3600000 - now) / 1000);

      mockRedis.zremrangebyscore.mockResolvedValue();
      mockRedis.zcard.mockResolvedValue(1000); // Limit reached
      mockRedis.zrange.mockResolvedValue(['entry-1', oldestTimestamp.toString()]);

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.retry_after_seconds).toBeCloseTo(expectedRetryAfter, -1); // Within 10s
    });

    it('should fail-safe on Redis errors (block with retry_after)', async () => {
      mockRedis.zremrangebyscore.mockRejectedValue(new Error('Redis connection failed'));

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('rate_limit_error');
      expect(result.metadata.error).toBe('Redis connection failed');
    });

    it('should use correct Redis keys for each level', async () => {
      mockRedis.zremrangebyscore.mockResolvedValue();
      mockRedis.zcard.mockResolvedValue(10);
      mockRedis.zadd.mockResolvedValue();
      mockRedis.expire.mockResolvedValue();

      await policy.evaluate(context);

      // Check global key
      expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
        'ingestion:global',
        expect.any(Number),
        expect.any(Number)
      );

      // Check user key
      expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
        'ingestion:user:user-123',
        expect.any(Number),
        expect.any(Number)
      );

      // Check account key
      expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
        'ingestion:account:account-456:x',
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should handle Redis zrange with no results gracefully', async () => {
      mockRedis.zremrangebyscore.mockResolvedValue();
      mockRedis.zcard.mockResolvedValue(1000); // Limit reached
      mockRedis.zrange.mockResolvedValue([]); // Empty result

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('rate_limit_exceeded');
      expect(result.retry_after_seconds).toBeGreaterThan(0);
    });
  });
});
