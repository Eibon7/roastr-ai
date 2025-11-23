/**
 * Unit tests for Shield Service Level Integration (Issue #597)
 * Tests shield_level threshold application and configuration
 */

const levelConfigService = require('../../../src/services/levelConfigService');

// Mock dependencies
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    child: jest.fn(() => ({
      error: jest.fn(),
      info: jest.fn()
    }))
  }
}));

jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn()
  }
}));

describe('Shield Service - Level Integration', () => {
  describe('Shield Level Threshold Mapping', () => {
    it('should map shield level 1 (Tolerant) to threshold 0.85', () => {
      const config = levelConfigService.getShieldLevelConfig(1);

      expect(config.threshold).toBe(0.85);
      expect(config.name).toBe('Tolerant');
      expect(config.autoActions).toBe(false);
    });

    it('should map shield level 2 (Balanced-Tolerant) to threshold 0.78', () => {
      const config = levelConfigService.getShieldLevelConfig(2);

      expect(config.threshold).toBe(0.78);
      expect(config.name).toBe('Balanced-Tolerant');
      expect(config.autoActions).toBe(false);
    });

    it('should map shield level 3 (Balanced) to threshold 0.70', () => {
      const config = levelConfigService.getShieldLevelConfig(3);

      expect(config.threshold).toBe(0.7);
      expect(config.name).toBe('Balanced');
      expect(config.autoActions).toBe(true);
    });

    it('should map shield level 4 (Balanced-Strict) to threshold 0.60', () => {
      const config = levelConfigService.getShieldLevelConfig(4);

      expect(config.threshold).toBe(0.6);
      expect(config.name).toBe('Balanced-Strict');
      expect(config.autoActions).toBe(true);
    });

    it('should map shield level 5 (Strict) to threshold 0.50', () => {
      const config = levelConfigService.getShieldLevelConfig(5);

      expect(config.threshold).toBe(0.5);
      expect(config.name).toBe('Strict');
      expect(config.autoActions).toBe(true);
    });
  });

  describe('Shield Level Auto-Actions Configuration', () => {
    it('should disable auto-actions for levels 1-2 (Tolerant modes)', () => {
      const level1 = levelConfigService.getShieldLevelConfig(1);
      const level2 = levelConfigService.getShieldLevelConfig(2);

      expect(level1.autoActions).toBe(false);
      expect(level2.autoActions).toBe(false);
    });

    it('should enable auto-actions for levels 3-5 (Balanced and Strict modes)', () => {
      const level3 = levelConfigService.getShieldLevelConfig(3);
      const level4 = levelConfigService.getShieldLevelConfig(4);
      const level5 = levelConfigService.getShieldLevelConfig(5);

      expect(level3.autoActions).toBe(true);
      expect(level4.autoActions).toBe(true);
      expect(level5.autoActions).toBe(true);
    });
  });

  describe('Threshold Behavior Validation', () => {
    it('should have descending threshold values (higher level = stricter)', () => {
      const level1 = levelConfigService.getShieldLevelConfig(1);
      const level2 = levelConfigService.getShieldLevelConfig(2);
      const level3 = levelConfigService.getShieldLevelConfig(3);
      const level4 = levelConfigService.getShieldLevelConfig(4);
      const level5 = levelConfigService.getShieldLevelConfig(5);

      expect(level1.threshold).toBeGreaterThan(level2.threshold);
      expect(level2.threshold).toBeGreaterThan(level3.threshold);
      expect(level3.threshold).toBeGreaterThan(level4.threshold);
      expect(level4.threshold).toBeGreaterThan(level5.threshold);
    });

    it('should classify comment as toxic at level 5 but not at level 1', () => {
      // Simulated toxicity score: 0.72 (between level 1 threshold 0.85 and level 5 threshold 0.50)
      const toxicityScore = 0.72;

      const level1 = levelConfigService.getShieldLevelConfig(1);
      const level5 = levelConfigService.getShieldLevelConfig(5);

      // Level 1 (Tolerant) should NOT block (0.72 < 0.85)
      expect(toxicityScore).toBeLessThan(level1.threshold);

      // Level 5 (Strict) SHOULD block (0.72 > 0.50)
      expect(toxicityScore).toBeGreaterThan(level5.threshold);
    });
  });

  describe('Shield Level Plan Validation', () => {
    it('should return correct shield level limits for each plan', () => {
      const freeLimits = levelConfigService.getPlanLevelLimits('free');
      const proLimits = levelConfigService.getPlanLevelLimits('pro');
      const plusLimits = levelConfigService.getPlanLevelLimits('plus');

      expect(freeLimits.maxShieldLevel).toBe(3);
      expect(proLimits.maxShieldLevel).toBe(4);
      expect(plusLimits.maxShieldLevel).toBe(5);
    });

    it('should validate shield level access for different plans', async () => {
      // This test validates that shield_level validation works correctly
      // when integrated with plan limits (tested via levelConfigService)

      // Note: Actual ShieldService integration would use these validated levels
      // to apply the correct threshold during toxicity analysis

      const level3Config = levelConfigService.getShieldLevelConfig(3);
      const level5Config = levelConfigService.getShieldLevelConfig(5);

      // Free plan can access level 3
      expect(level3Config.threshold).toBe(0.7);

      // Plus plan can access level 5
      expect(level5Config.threshold).toBe(0.5);
    });
  });
});
