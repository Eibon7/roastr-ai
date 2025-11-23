/**
 * Unit Tests - Tier Upgrade Service (SPEC 10)
 * Tests for immediate upgrades and deferred downgrades
 */

const tierUpgradeService = require('../../../src/services/tierUpgradeService');
const tierValidationService = require('../../../src/services/tierValidationService');

// Mock external dependencies
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    rpc: jest.fn(),
    order: jest.fn().mockReturnThis()
  }
}));

jest.mock('../../../src/services/tierValidationService');
jest.mock('../../../src/utils/logger', () => ({
  logger: {
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
  }
}));

describe('TierUpgradeService', () => {
  let mockSupabase;

  beforeEach(() => {
    mockSupabase = require('../../../src/config/supabase').supabaseServiceClient;
    jest.clearAllMocks();
  });

  describe('processTierChange', () => {
    const mockUserId = 'user-123';

    beforeEach(() => {
      // Mock current tier
      mockSupabase.single.mockResolvedValue({
        data: { plan: 'free' },
        error: null
      });
    });

    describe('Upgrades', () => {
      it('should process upgrade immediately', async () => {
        // Mock successful upgrade
        mockSupabase.rpc.mockResolvedValue({
          data: { success: true },
          error: null
        });

        tierValidationService.handleTierUpgrade.mockResolvedValue({
          success: true,
          message: 'Límites reseteados'
        });

        const result = await tierUpgradeService.processTierChange(mockUserId, 'pro', {
          triggeredBy: 'payment_success'
        });

        expect(result.success).toBe(true);
        expect(result.appliedImmediately).toBe(true);
        expect(result.usageLimitsReset).toBe(true);
        expect(result.previousTier).toBe('free');
        expect(result.newTier).toBe('pro');

        // Should call upgrade handler
        expect(tierValidationService.handleTierUpgrade).toHaveBeenCalledWith(
          mockUserId,
          'pro',
          'free'
        );
      });

      it('should handle upgrade error gracefully', async () => {
        mockSupabase.rpc.mockRejectedValue(new Error('Database error'));

        await expect(tierUpgradeService.processTierChange(mockUserId, 'pro')).rejects.toThrow(
          'Database error'
        );
      });
    });

    describe('Downgrades', () => {
      beforeEach(() => {
        // Mock current pro tier
        mockSupabase.single.mockResolvedValue({
          data: { plan: 'pro' },
          error: null
        });
      });

      it('should schedule downgrade for next billing cycle', async () => {
        // Mock successful downgrade scheduling
        mockSupabase.insert.mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'change-123' },
              error: null
            })
          })
        });

        tierValidationService.handleTierDowngrade.mockResolvedValue({
          success: true
        });

        const result = await tierUpgradeService.processTierChange(mockUserId, 'starter', {
          reason: 'cost_reduction'
        });

        expect(result.success).toBe(true);
        expect(result.appliedImmediately).toBe(false);
        expect(result.scheduledChangeId).toBe('change-123');
        expect(result.usageLimitsReset).toBe(false);

        // Should schedule for future
        expect(result.effectiveDate).toBeDefined();
        expect(new Date(result.effectiveDate)).toBeInstanceOf(Date);
      });

      it('should insert pending change record', async () => {
        mockSupabase.insert.mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'change-123' },
              error: null
            })
          })
        });

        await tierUpgradeService.processTierChange(mockUserId, 'starter');

        expect(mockSupabase.from).toHaveBeenCalledWith('pending_plan_changes');
        expect(mockSupabase.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            user_id: mockUserId,
            current_plan: 'pro',
            new_plan: 'starter',
            change_type: 'downgrade'
          })
        );
      });
    });

    describe('No Change', () => {
      it('should handle same tier request', async () => {
        const result = await tierUpgradeService.processTierChange(
          mockUserId,
          'free' // Same as current
        );

        expect(result.success).toBe(true);
        expect(result.message).toBe('Ya tienes este plan activo');
        expect(result.currentTier).toBe('free');
        expect(result.newTier).toBe('free');
      });
    });
  });

  describe('cancelPendingDowngrade', () => {
    const mockUserId = 'user-123';

    it('should cancel pending downgrade successfully', async () => {
      mockSupabase.update.mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: [{ id: 'change-123', new_plan: 'starter' }],
          error: null
        })
      });

      const result = await tierUpgradeService.cancelPendingDowngrade(mockUserId);

      expect(result.success).toBe(true);
      expect(result.cancelledChanges).toBe(1);
      expect(mockSupabase.update).toHaveBeenCalledWith({
        processed: true,
        processed_at: expect.any(String),
        reason: 'cancelled_by_user'
      });
    });

    it('should handle no pending changes', async () => {
      mockSupabase.update.mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: [],
          error: null
        })
      });

      const result = await tierUpgradeService.cancelPendingDowngrade(mockUserId);

      expect(result.success).toBe(false);
      expect(result.message).toBe('No hay downgrades pendientes para cancelar');
    });
  });

  describe('validateTierChangeEligibility', () => {
    const mockUserId = 'user-123';

    beforeEach(() => {
      mockSupabase.single.mockResolvedValue({
        data: { plan: 'pro' },
        error: null
      });

      // Mock no pending changes
      mockSupabase.select.mockResolvedValue({
        data: [],
        error: null
      });
    });

    it('should validate eligible upgrade', async () => {
      const result = await tierUpgradeService.validateTierChangeEligibility(mockUserId, 'plus');

      expect(result.eligible).toBe(true);
      expect(result.changeType).toBe('upgrade');
      expect(result.currentTier).toBe('pro');
      expect(result.newTier).toBe('plus');
    });

    it('should block change when pending changes exist', async () => {
      // Mock pending changes
      mockSupabase.select.mockResolvedValue({
        data: [{ id: 'change-123', new_plan: 'starter' }],
        error: null
      });

      const result = await tierUpgradeService.validateTierChangeEligibility(mockUserId, 'plus');

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('pending_changes_exist');
      expect(result.pendingChanges).toHaveLength(1);
    });

    describe('Downgrade Eligibility', () => {
      beforeEach(() => {
        // Mock current usage
        tierValidationService.getCurrentUsage = jest.fn().mockResolvedValue({
          roastsThisMonth: 50,
          analysisThisMonth: 5000
        });

        // Mock plan limits service
        require('../../../src/services/planLimitsService').getPlanLimits = jest
          .fn()
          .mockResolvedValue({
            monthlyResponsesLimit: 100,
            monthlyAnalysisLimit: 1000
          });
      });

      it('should allow downgrade when usage is within new limits', async () => {
        tierValidationService.getCurrentUsage.mockResolvedValue({
          roastsThisMonth: 50,
          analysisThisMonth: 500 // Under starter limit of 1000
        });

        const result = await tierUpgradeService.validateTierChangeEligibility(
          mockUserId,
          'starter'
        );

        expect(result.eligible).toBe(true);
        expect(result.changeType).toBe('downgrade');
      });

      it('should block downgrade when usage exceeds new limits', async () => {
        tierValidationService.getCurrentUsage.mockResolvedValue({
          roastsThisMonth: 50,
          analysisThisMonth: 5000 // Exceeds starter limit of 1000
        });

        const result = await tierUpgradeService.validateTierChangeEligibility(
          mockUserId,
          'starter'
        );

        expect(result.eligible).toBe(false);
        expect(result.reason).toBe('usage_exceeds_new_limits');
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].type).toBe('analysis_usage');
      });
    });
  });

  describe('processDuePlanChanges', () => {
    it('should process due plan changes successfully', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 3, // 3 changes processed
        error: null
      });

      const result = await tierUpgradeService.processDuePlanChanges();

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(3);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('process_pending_plan_changes');
    });

    it('should handle processing errors', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Processing failed'));

      await expect(tierUpgradeService.processDuePlanChanges()).rejects.toThrow('Processing failed');
    });
  });

  describe('Plan Hierarchy', () => {
    const hierarchyTests = [
      { from: 'free', to: 'starter', expected: 'upgrade' },
      { from: 'free', to: 'pro', expected: 'upgrade' },
      { from: 'free', to: 'plus', expected: 'upgrade' },
      { from: 'starter', to: 'pro', expected: 'upgrade' },
      { from: 'starter', to: 'plus', expected: 'upgrade' },
      { from: 'pro', to: 'plus', expected: 'upgrade' },
      { from: 'plus', to: 'pro', expected: 'downgrade' },
      { from: 'pro', to: 'starter', expected: 'downgrade' },
      { from: 'pro', to: 'free', expected: 'downgrade' },
      { from: 'starter', to: 'free', expected: 'downgrade' },
      { from: 'free', to: 'free', expected: 'no_change' },
      { from: 'pro', to: 'pro', expected: 'no_change' }
    ];

    hierarchyTests.forEach((test) => {
      it(`should identify ${test.from} to ${test.to} as ${test.expected}`, () => {
        const changeType = tierUpgradeService.determineChangeType(test.from, test.to);
        expect(changeType).toBe(test.expected);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with no subscription (defaults to free)', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // Not found
      });

      const result = await tierUpgradeService.processTierChange('user-123', 'pro');

      expect(result.previousTier).toBe('free');
      expect(result.newTier).toBe('pro');
      expect(result.appliedImmediately).toBe(true);
    });

    it('should handle invalid tier gracefully', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { plan: 'free' },
        error: null
      });

      await expect(
        tierUpgradeService.processTierChange('user-123', 'invalid_tier')
      ).rejects.toThrow();
    });
  });
});
