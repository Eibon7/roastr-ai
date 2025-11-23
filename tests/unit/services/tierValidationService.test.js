/**
 * Unit Tests - Tier Validation Service (SPEC 10)
 * Tests for tier limit validation and feature gating
 */

const tierValidationService = require('../../../src/services/tierValidationService');
const planLimitsService = require('../../../src/services/planLimitsService');
const { flags } = require('../../../src/config/flags');

// Mock external dependencies
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    gte: jest.fn().mockReturnThis(),
    rpc: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis()
  }
}));

jest.mock('../../../src/services/planLimitsService');
jest.mock('../../../src/config/flags');
jest.mock('../../../src/utils/logger');

describe('TierValidationService', () => {
  let mockSupabase;

  beforeEach(() => {
    mockSupabase = require('../../../src/config/supabase').supabaseServiceClient;
    jest.clearAllMocks();
    tierValidationService.clearCache();
  });

  describe('validateAction', () => {
    const mockUser = 'user-123';

    beforeEach(() => {
      // Mock user tier
      mockSupabase.single.mockResolvedValue({
        data: { plan: 'free', status: 'active' },
        error: null
      });

      // Mock plan limits
      planLimitsService.getPlanLimits.mockResolvedValue({
        monthlyAnalysisLimit: 100,
        monthlyResponsesLimit: 10,
        integrationsLimit: 1,
        shieldEnabled: false,
        customTones: false,
        embeddedJudge: false
      });
    });

    describe('Analysis Limits', () => {
      it('should allow analysis when under free tier limit (100)', async () => {
        // Mock current usage - under limit
        mockSupabase.select.mockResolvedValueOnce({
          data: [{ quantity: 50 }],
          error: null
        });

        const result = await tierValidationService.validateAction(mockUser, 'analysis');

        expect(result.allowed).toBe(true);
        expect(result.currentTier).toBe('free');
      });

      it('should block analysis when free tier limit exceeded (100)', async () => {
        // Mock current usage - at limit
        mockSupabase.select.mockResolvedValueOnce({
          data: [{ quantity: 100 }],
          error: null
        });

        const result = await tierValidationService.validateAction(mockUser, 'analysis');

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('monthly_analysis_limit_exceeded');
        expect(result.upgradeRequired).toBe('starter');
      });

      it('should allow unlimited analysis for plus tier', async () => {
        // Mock plus tier user
        mockSupabase.single.mockResolvedValue({
          data: { plan: 'plus', status: 'active' },
          error: null
        });

        planLimitsService.getPlanLimits.mockResolvedValue({
          monthlyAnalysisLimit: -1, // Unlimited
          monthlyResponsesLimit: 5000,
          integrationsLimit: 2,
          shieldEnabled: true,
          customTones: true,
          embeddedJudge: true
        });

        const result = await tierValidationService.validateAction(mockUser, 'analysis');

        expect(result.allowed).toBe(true);
      });
    });

    describe('Roast Limits', () => {
      it('should allow roast when under free tier limit (10)', async () => {
        // Mock roast usage - under limit
        mockSupabase.select.mockResolvedValueOnce({
          data: new Array(5), // 5 roasts
          error: null
        });

        const result = await tierValidationService.validateAction(mockUser, 'roast');

        expect(result.allowed).toBe(true);
      });

      it('should block roast when free tier limit exceeded (10)', async () => {
        // Mock roast usage - at limit
        mockSupabase.select.mockResolvedValueOnce({
          data: new Array(10), // 10 roasts
          error: null
        });

        const result = await tierValidationService.validateAction(mockUser, 'roast');

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('monthly_roast_limit_exceeded');
        expect(result.upgradeRequired).toBe('starter');
      });
    });

    describe('Platform Limits', () => {
      it('should allow platform addition when under free tier limit (1)', async () => {
        // Mock no existing platforms
        mockSupabase.select.mockResolvedValueOnce({
          data: [],
          error: null
        });

        const result = await tierValidationService.validateAction(mockUser, 'platform_add', {
          platform: 'twitter'
        });

        expect(result.allowed).toBe(true);
      });

      it('should block platform addition when free tier limit exceeded (1)', async () => {
        // Mock existing platform
        mockSupabase.select.mockResolvedValueOnce({
          data: [{ platform: 'twitter', status: 'active' }],
          error: null
        });

        const result = await tierValidationService.validateAction(mockUser, 'platform_add', {
          platform: 'twitter'
        });

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('platform_account_limit_exceeded');
        expect(result.upgradeRequired).toBe('pro');
      });
    });

    describe('Error Handling', () => {
      it('should allow action on database error (fallback)', async () => {
        mockSupabase.single.mockRejectedValue(new Error('Database error'));

        const result = await tierValidationService.validateAction(mockUser, 'analysis');

        expect(result.allowed).toBe(true);
        expect(result.fallback).toBe(true);
        expect(result.error).toBe('Validation service temporarily unavailable');
      });
    });
  });

  describe('validateFeature', () => {
    const mockUser = 'user-123';

    describe('Shield Feature', () => {
      it('should deny Shield access for free tier', async () => {
        mockSupabase.single.mockResolvedValue({
          data: { plan: 'free', status: 'active' },
          error: null
        });

        planLimitsService.getPlanLimits.mockResolvedValue({
          shieldEnabled: false
        });

        const result = await tierValidationService.validateFeature(mockUser, 'shield');

        expect(result.available).toBe(false);
        expect(result.reason).toBe('shield_requires_starter_or_higher');
        expect(result.upgradeRequired).toBe('starter');
      });

      it('should allow Shield access for starter tier', async () => {
        mockSupabase.single.mockResolvedValue({
          data: { plan: 'starter', status: 'active' },
          error: null
        });

        planLimitsService.getPlanLimits.mockResolvedValue({
          shieldEnabled: true
        });

        const result = await tierValidationService.validateFeature(mockUser, 'shield');

        expect(result.available).toBe(true);
      });
    });

    describe('Original Tone Feature', () => {
      it('should deny Original Tone access for starter tier', async () => {
        mockSupabase.single.mockResolvedValue({
          data: { plan: 'starter', status: 'active' },
          error: null
        });

        planLimitsService.getPlanLimits.mockResolvedValue({
          customTones: false
        });

        const result = await tierValidationService.validateFeature(
          mockUser,
          'ENABLE_ORIGINAL_TONE'
        );

        expect(result.available).toBe(false);
        expect(result.reason).toBe('tier_limitation');
        expect(result.upgradeRequired).toBe('pro');
      });

      it('should allow Original Tone access for pro tier', async () => {
        mockSupabase.single.mockResolvedValue({
          data: { plan: 'pro', status: 'active' },
          error: null
        });

        planLimitsService.getPlanLimits.mockResolvedValue({
          customTones: true
        });

        const result = await tierValidationService.validateFeature(
          mockUser,
          'ENABLE_ORIGINAL_TONE'
        );

        expect(result.available).toBe(true);
      });
    });

    describe('Embedded Judge Feature', () => {
      it('should deny Embedded Judge access for pro tier', async () => {
        mockSupabase.single.mockResolvedValue({
          data: { plan: 'pro', status: 'active' },
          error: null
        });

        planLimitsService.getPlanLimits.mockResolvedValue({
          embeddedJudge: false
        });

        const result = await tierValidationService.validateFeature(mockUser, 'embedded_judge');

        expect(result.available).toBe(false);
        expect(result.reason).toBe('embedded_judge_requires_plus');
        expect(result.upgradeRequired).toBe('plus');
      });

      it('should deny Embedded Judge when feature flag disabled', async () => {
        mockSupabase.single.mockResolvedValue({
          data: { plan: 'plus', status: 'active' },
          error: null
        });

        planLimitsService.getPlanLimits.mockResolvedValue({
          embeddedJudge: true
        });

        flags.isEnabled.mockReturnValue(false);

        const result = await tierValidationService.validateFeature(mockUser, 'embedded_judge');

        expect(result.available).toBe(false);
        expect(result.reason).toBe('embedded_judge_not_available_yet');
      });

      it('should allow Embedded Judge for plus tier when flag enabled', async () => {
        mockSupabase.single.mockResolvedValue({
          data: { plan: 'plus', status: 'active' },
          error: null
        });

        planLimitsService.getPlanLimits.mockResolvedValue({
          embeddedJudge: true
        });

        flags.isEnabled.mockReturnValue(true);

        const result = await tierValidationService.validateFeature(mockUser, 'embedded_judge');

        expect(result.available).toBe(true);
      });
    });
  });

  describe('Tier Limits Per SPEC 10', () => {
    const testCases = [
      {
        tier: 'free',
        analysisLimit: 100,
        roastLimit: 10,
        platformLimit: 1,
        shieldEnabled: false,
        originalToneEnabled: false,
        embeddedJudgeEnabled: false
      },
      {
        tier: 'starter',
        analysisLimit: 1000,
        roastLimit: 100,
        platformLimit: 1,
        shieldEnabled: true,
        originalToneEnabled: false,
        embeddedJudgeEnabled: false
      },
      {
        tier: 'pro',
        analysisLimit: 10000,
        roastLimit: 1000,
        platformLimit: 2,
        shieldEnabled: true,
        originalToneEnabled: true,
        embeddedJudgeEnabled: false
      },
      {
        tier: 'plus',
        analysisLimit: 100000,
        roastLimit: 5000,
        platformLimit: 2,
        shieldEnabled: true,
        originalToneEnabled: true,
        embeddedJudgeEnabled: true
      }
    ];

    testCases.forEach((testCase) => {
      describe(`${testCase.tier.toUpperCase()} Tier`, () => {
        beforeEach(() => {
          mockSupabase.single.mockResolvedValue({
            data: { plan: testCase.tier, status: 'active' },
            error: null
          });

          planLimitsService.getPlanLimits.mockResolvedValue({
            monthlyAnalysisLimit: testCase.analysisLimit,
            monthlyResponsesLimit: testCase.roastLimit,
            integrationsLimit: testCase.platformLimit,
            shieldEnabled: testCase.shieldEnabled,
            customTones: testCase.originalToneEnabled,
            embeddedJudge: testCase.embeddedJudgeEnabled
          });
        });

        it(`should enforce ${testCase.analysisLimit} analysis limit`, async () => {
          // Mock usage at limit
          mockSupabase.select.mockResolvedValueOnce({
            data: [{ quantity: testCase.analysisLimit }],
            error: null
          });

          const result = await tierValidationService.validateAction('user-123', 'analysis');
          expect(result.allowed).toBe(false);
        });

        it(`should enforce ${testCase.roastLimit} roast limit`, async () => {
          // Mock usage at limit
          mockSupabase.select.mockResolvedValueOnce({
            data: new Array(testCase.roastLimit),
            error: null
          });

          const result = await tierValidationService.validateAction('user-123', 'roast');
          expect(result.allowed).toBe(false);
        });

        it(`should ${testCase.shieldEnabled ? 'allow' : 'deny'} Shield access`, async () => {
          const result = await tierValidationService.validateFeature('user-123', 'shield');
          expect(result.available).toBe(testCase.shieldEnabled);
        });

        it(`should ${testCase.originalToneEnabled ? 'allow' : 'deny'} Original Tone access`, async () => {
          const result = await tierValidationService.validateFeature(
            'user-123',
            'ENABLE_ORIGINAL_TONE'
          );
          expect(result.available).toBe(testCase.originalToneEnabled);
        });
      });
    });
  });

  describe('Usage Tracking', () => {
    it('should cache usage data for performance', async () => {
      const mockUser = 'user-123';

      mockSupabase.single.mockResolvedValue({
        data: { plan: 'free', status: 'active' },
        error: null
      });

      // First call
      await tierValidationService.validateAction(mockUser, 'analysis');

      // Second call should use cache
      await tierValidationService.validateAction(mockUser, 'analysis');

      // Database should only be called once for usage
      expect(mockSupabase.select).toHaveBeenCalledTimes(1);
    });

    it('should handle billing cycle calculation correctly', async () => {
      const mockUser = 'user-123';

      mockSupabase.single.mockResolvedValue({
        data: {
          plan: 'pro',
          status: 'active',
          current_period_start: '2024-01-01T00:00:00Z',
          current_period_end: '2024-02-01T00:00:00Z'
        },
        error: null
      });

      await tierValidationService.validateAction(mockUser, 'analysis');

      // Should query usage from period start
      expect(mockSupabase.gte).toHaveBeenCalledWith(
        'created_at',
        expect.stringContaining('2024-01-01')
      );
    });
  });
});
