/**
 * @fileoverview Unit tests for AccountStatusPolicy
 * @since ROA-394
 */

// Vitest globals enabled in vitest.config.ts - no need to import describe, it, expect
const AccountStatusPolicy = require('../../../../../src/services/ingestion/policies/AccountStatusPolicy');

// Mock Supabase config
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock('../../../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: mockFrom
  }
}));

// Mock logger
vi.mock('../../../../../src/utils/logger', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('AccountStatusPolicy', () => {
  let policy;
  let context;

  beforeEach(() => {
    policy = new AccountStatusPolicy();
    context = {
      userId: 'user-123',
      accountId: 'account-456',
      platform: 'x',
      flow: 'timeline',
      requestId: 'req-789'
    };

    // Reset mocks
    vi.clearAllMocks();

    // Setup mock chain
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnThis();
    mockEq.single = mockSingle;
  });

  describe('evaluate', () => {
    it('should allow ingestion for connected account with valid OAuth', async () => {
      mockSingle.mockResolvedValue({
        data: {
          connection_status: 'connected',
          oauth_error: null
        },
        error: null
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(true);
      expect(result.metadata.connection_status).toBe('connected');
      expect(result.metadata.accountId).toBe('account-456');
      expect(result.metadata.platform).toBe('x');
      expect(result.reason).toBeUndefined();
    });

    it('should block ingestion for disconnected account', async () => {
      mockSingle.mockResolvedValue({
        data: {
          connection_status: 'disconnected',
          oauth_error: null
        },
        error: null
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('account_disconnected');
      expect(result.metadata.connection_status).toBe('disconnected');
      expect(result.metadata.accountId).toBe('account-456');
      expect(result.metadata.platform).toBe('x');
    });

    it('should block ingestion for account with OAuth error', async () => {
      mockSingle.mockResolvedValue({
        data: {
          connection_status: 'connected',
          oauth_error: { type: 'invalid_token', message: 'Token expired' }
        },
        error: null
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('account_oauth_error');
      expect(result.metadata.oauth_error_type).toBe('invalid_token');
      expect(result.metadata.accountId).toBe('account-456');
      expect(result.metadata.platform).toBe('x');
    });

    it('should block when account is not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows returned' }
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('account_not_found');
      expect(result.metadata.accountId).toBe('account-456');
      expect(result.metadata.platform).toBe('x');
    });

    it('should block when account cannot be fetched (DB error)', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'DB_ERROR', message: 'Connection timeout' }
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('account_status_unknown');
      expect(result.metadata.error).toBe('Connection timeout');
    });

    it('should block on unexpected errors (fail-safe)', async () => {
      mockSingle.mockRejectedValue(new Error('Unexpected error'));

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('account_status_error');
      expect(result.metadata.error).toBe('Unexpected error');
    });

    it('should block when accountId is missing from context', async () => {
      context.accountId = undefined;

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('account_context_missing');
      expect(result.metadata.missing).toBe('accountId');
    });

    it('should block when platform is missing from context', async () => {
      context.platform = undefined;

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('account_context_missing');
      expect(result.metadata.missing).toBe('platform');
    });

    it('should handle OAuth error as string (legacy)', async () => {
      mockSingle.mockResolvedValue({
        data: {
          connection_status: 'connected',
          oauth_error: 'Token expired'
        },
        error: null
      });

      const result = await policy.evaluate(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('account_oauth_error');
      expect(result.metadata.oauth_error_type).toBe('unknown');
    });

    it('should not expose PII in logs', async () => {
      const logger = require('../../../../../src/utils/logger').default;

      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'DB_ERROR', message: 'Connection timeout' }
      });

      await policy.evaluate(context);

      // Verify logger was called (structure check)
      expect(logger.error).toHaveBeenCalled();

      // Verify no sensitive data in logged metadata
      const logCall = logger.error.mock.calls[0];
      if (logCall && logCall[1]) {
        expect(logCall[1]).not.toHaveProperty('email');
        expect(logCall[1]).not.toHaveProperty('password');
        expect(logCall[1]).not.toHaveProperty('oauth_token');
      }
    });
  });
});
