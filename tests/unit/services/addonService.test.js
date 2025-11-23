/**
 * Unit tests for AddonService
 * Issue #260: Settings → Shop functionality
 */

const { createSupabaseMock } = require('../../helpers/supabaseMockFactory');

// ============================================================================
// STEP 1: Create mocks BEFORE jest.mock() calls (Issue #892 - Fix Supabase Mock Pattern)
// ============================================================================

// Create Supabase mock with defaults
const mockSupabase = createSupabaseMock(
  {
    addon_purchase_history: []
  },
  {
    // RPC functions
    get_user_addon_credits: { data: 0, error: null },
    consume_addon_credits: { data: true, error: null },
    user_has_feature_addon: { data: false, error: null }
  }
);

// Mock Supabase client
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));

// Mock logger (addonService uses require('logger') directly, not destructured)
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

// ============================================================================
// STEP 3: Require modules AFTER mocks are configured
// ============================================================================

const addonService = require('../../../src/services/addonService');

describe('AddonService', () => {
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Supabase mock to defaults
    mockSupabase._reset();
  });

  describe('getUserAddonCredits', () => {
    it('should return user addon credits for valid category', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 150,
        error: null
      });

      const credits = await addonService.getUserAddonCredits(mockUserId, 'roasts');

      expect(credits).toBe(150);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_user_addon_credits', {
        p_user_id: mockUserId,
        p_addon_category: 'roasts'
      });
    });

    it('should return 0 when database error occurs', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const credits = await addonService.getUserAddonCredits(mockUserId, 'roasts');

      expect(credits).toBe(0);
    });

    it('should return 0 when no credits found', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null
      });

      const credits = await addonService.getUserAddonCredits(mockUserId, 'roasts');

      expect(credits).toBe(0);
    });
  });

  describe('consumeAddonCredits', () => {
    it('should successfully consume addon credits', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: true,
        error: null
      });

      const result = await addonService.consumeAddonCredits(mockUserId, 'roasts', 5);

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('consume_addon_credits', {
        p_user_id: mockUserId,
        p_addon_category: 'roasts',
        p_amount: 5
      });
    });

    it('should return false when insufficient credits', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: false,
        error: null
      });

      const result = await addonService.consumeAddonCredits(mockUserId, 'roasts', 10);

      expect(result).toBe(false);
    });

    it('should default to consuming 1 credit when amount not specified', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: true,
        error: null
      });

      await addonService.consumeAddonCredits(mockUserId, 'roasts');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('consume_addon_credits', {
        p_user_id: mockUserId,
        p_addon_category: 'roasts',
        p_amount: 1
      });
    });

    it('should return false for invalid amount parameter', async () => {
      const result1 = await addonService.consumeAddonCredits(mockUserId, 'roasts', 0);
      const result2 = await addonService.consumeAddonCredits(mockUserId, 'roasts', -1);
      const result3 = await addonService.consumeAddonCredits(mockUserId, 'roasts', 1.5);
      const result4 = await addonService.consumeAddonCredits(mockUserId, 'roasts', 'invalid');

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
      expect(result4).toBe(false);

      // Should not call the RPC for invalid amounts
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe('userHasFeatureAddon', () => {
    it('should return true when user has active feature', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: true,
        error: null
      });

      const hasFeature = await addonService.userHasFeatureAddon(mockUserId, 'rqc_enabled');

      expect(hasFeature).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('user_has_feature_addon', {
        p_user_id: mockUserId,
        p_feature_key: 'rqc_enabled'
      });
    });

    it('should return false when user does not have feature', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: false,
        error: null
      });

      const hasFeature = await addonService.userHasFeatureAddon(mockUserId, 'rqc_enabled');

      expect(hasFeature).toBe(false);
    });
  });

  describe('getUserAddonSummary', () => {
    it('should return complete addon summary', async () => {
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: 100, error: null }) // roast credits
        .mockResolvedValueOnce({ data: 5000, error: null }) // analysis credits
        .mockResolvedValueOnce({ data: true, error: null }); // rqc enabled

      const summary = await addonService.getUserAddonSummary(mockUserId);

      expect(summary).toEqual({
        credits: {
          roasts: 100,
          analysis: 5000
        },
        features: {
          rqc_enabled: true
        }
      });
    });

    it('should return default values when errors occur', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Database error'));

      const summary = await addonService.getUserAddonSummary(mockUserId);

      expect(summary).toEqual({
        credits: {
          roasts: 0,
          analysis: 0
        },
        features: {
          rqc_enabled: false
        }
      });
    });
  });

  describe('canPerformAction', () => {
    const mockPlanLimits = { monthly_responses_limit: 100 };
    const mockCurrentUsage = { monthly_responses_used: 95 };

    it('should allow action when within plan limits', async () => {
      const planLimits = { monthly_responses_limit: 100 };
      const currentUsage = { monthly_responses_used: 50 };

      const result = await addonService.canPerformAction(
        mockUserId,
        'roast',
        planLimits,
        currentUsage
      );

      expect(result).toEqual({
        allowed: true,
        source: 'plan',
        remaining: 50
      });
    });

    it('should allow action using addon credits when plan limit exceeded', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 25,
        error: null
      });

      const planLimits = { monthly_responses_limit: 100 };
      const currentUsage = { monthly_responses_used: 100 }; // Plan limit exceeded

      const result = await addonService.canPerformAction(
        mockUserId,
        'roast',
        planLimits,
        currentUsage
      );

      expect(result).toEqual({
        allowed: true,
        source: 'addon',
        remaining: 25
      });
    });

    it('should deny action when both plan and addon limits exceeded', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 0,
        error: null
      });

      const planLimits = { monthly_responses_limit: 100 };
      const currentUsage = { monthly_responses_used: 100 }; // Plan limit exceeded

      const result = await addonService.canPerformAction(
        mockUserId,
        'roast',
        planLimits,
        currentUsage
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Limit exceeded and no addon credits available');
    });

    it('should deny action for invalid action type', async () => {
      const result = await addonService.canPerformAction(
        mockUserId,
        'invalid_action',
        mockPlanLimits,
        mockCurrentUsage
      );

      expect(result).toEqual({
        allowed: false,
        reason: 'Invalid action type'
      });
    });
  });

  describe('recordActionUsage', () => {
    it('should record usage from addon credits when plan limit exceeded', async () => {
      // Mock the atomic behavior: consumeAddonCredits then getUserAddonCredits
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: true, error: null }) // consumeAddonCredits
        .mockResolvedValueOnce({ data: 9, error: null }); // getUserAddonCredits (after consumption)

      const planLimits = { monthly_responses_limit: 100 };
      const currentUsage = { monthly_responses_used: 100 };

      const result = await addonService.recordActionUsage(
        mockUserId,
        'roast',
        planLimits,
        currentUsage
      );

      expect(result.success).toBe(true);
      expect(result.source).toBe('addon');
      expect(result.creditsRemaining).toBe(9);
    });

    it('should record usage from plan when within limits', async () => {
      const planLimits = { monthly_responses_limit: 100 };
      const currentUsage = { monthly_responses_used: 50 };

      const result = await addonService.recordActionUsage(
        mockUserId,
        'roast',
        planLimits,
        currentUsage
      );

      expect(result.success).toBe(true);
      expect(result.source).toBe('plan');
      expect(result.planRemaining).toBe(49);
    });
  });

  describe('isRQCEnabled', () => {
    it('should return RQC status for user', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: true,
        error: null
      });

      const isEnabled = await addonService.isRQCEnabled(mockUserId);

      expect(isEnabled).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('user_has_feature_addon', {
        p_user_id: mockUserId,
        p_feature_key: 'rqc_enabled'
      });
    });
  });

  describe('getAddonPurchaseHistory', () => {
    it('should return purchase history for user', async () => {
      const mockPurchases = [
        {
          addon_key: 'roasts_100',
          amount_cents: 499,
          currency: 'USD',
          status: 'completed',
          completed_at: '2024-01-15T10:00:00Z',
          created_at: '2024-01-15T09:55:00Z'
        }
      ];

      // Configure mockSupabase.from to return a mock that works with the service
      const mockTableBuilder = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() =>
                Promise.resolve({
                  data: mockPurchases,
                  error: null
                })
              )
            }))
          }))
        }))
      };
      mockSupabase.from.mockReturnValue(mockTableBuilder);

      const history = await addonService.getAddonPurchaseHistory(mockUserId, 5);

      expect(history).toEqual(mockPurchases);
      expect(mockSupabase.from).toHaveBeenCalledWith('addon_purchase_history');
    });

    it('should return empty array when no purchases found', async () => {
      const mockTableBuilder = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() =>
                Promise.resolve({
                  data: null,
                  error: null
                })
              )
            }))
          }))
        }))
      };
      mockSupabase.from.mockReturnValue(mockTableBuilder);

      const history = await addonService.getAddonPurchaseHistory(mockUserId);

      expect(history).toEqual([]);
    });

    it('should use default limit of 10 when not specified', async () => {
      const limitMock = jest.fn().mockResolvedValue({ data: [], error: null });
      const mockTableBuilder = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: limitMock
            }))
          }))
        }))
      };
      mockSupabase.from.mockReturnValue(mockTableBuilder);

      await addonService.getAddonPurchaseHistory(mockUserId);

      expect(limitMock).toHaveBeenCalledWith(10);
    });
  });
});
