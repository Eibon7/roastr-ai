/**
 * @fileoverview Unit tests for AccountStatusPolicy
 * @since ROA-394
 */

const AccountStatusPolicy = require('../../../../../src/services/ingestion/policies/AccountStatusPolicy');

// Create mock functions BEFORE mocking the module
const mockSingle = vi.fn();
const mockEq3 = vi.fn(() => ({ single: mockSingle }));
const mockEq2 = vi.fn(() => ({ eq: mockEq3 }));
const mockEq1 = vi.fn(() => ({ eq: mockEq2 }));
const mockSelect = vi.fn(() => ({ eq: mockEq1 }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

// Mock supabaseServiceClient
vi.mock('../../../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: mockFrom
  }
}));

// Mock logger
vi.mock('../../../../../src/utils/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
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

    vi.clearAllMocks();
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

    it('should block ingestion for account with OAuth error (object)', async () => {
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

    it('should block ingestion for account with OAuth error (string legacy)', async () => {
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
      expect(result.metadata.accountId).toBe('account-456');
      expect(result.metadata.platform).toBe('x');
    });

    it('should block when account is not found (PGRST116)', async () => {
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
      expect(result.reason).toBe('account_status_unknown');
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

    it('should not expose PII in returned metadata', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'DB_ERROR', message: 'Connection timeout' }
      });

      const result = await policy.evaluate(context);

      // Verify error is handled and metadata doesn't expose PII
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('account_status_unknown');
      expect(result.metadata.error).toBe('Connection timeout');
      // Ensure no PII in metadata
      expect(result.metadata).not.toHaveProperty('email');
      expect(result.metadata).not.toHaveProperty('password');
      expect(result.metadata).not.toHaveProperty('oauth_token');
    });
  });
});
