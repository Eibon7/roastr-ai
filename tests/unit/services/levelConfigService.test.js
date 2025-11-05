/**
 * Tests for Level Configuration Service (Issue #597)
 */

const levelConfigService = require('../../../src/services/levelConfigService');
const { supabaseServiceClient } = require('../../../src/config/supabase');

// Mock dependencies
jest.mock('../../../src/config/supabase');
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('LevelConfigService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRoastLevelConfig', () => {
    it('should return configuration for level 1 (Mild)', () => {
      const config = levelConfigService.getRoastLevelConfig(1);

      expect(config.name).toBe('Mild');
      expect(config.temperature).toBe(0.6);
      expect(config.allowProfanity).toBe(false);
      expect(config.maxLength).toBe(150);
    });

    it('should return configuration for level 3 (Moderate)', () => {
      const config = levelConfigService.getRoastLevelConfig(3);

      expect(config.name).toBe('Moderate');
      expect(config.temperature).toBe(0.8);
      expect(config.allowProfanity).toBe(true);
      expect(config.maxLength).toBe(250);
    });

    it('should return configuration for level 5 (Caustic)', () => {
      const config = levelConfigService.getRoastLevelConfig(5);

      expect(config.name).toBe('Caustic');
      expect(config.temperature).toBe(1.0);
      expect(config.allowProfanity).toBe(true);
      expect(config.maxLength).toBe(280);
    });

    it('should throw error for invalid level', () => {
      expect(() => levelConfigService.getRoastLevelConfig(0)).toThrow();
      expect(() => levelConfigService.getRoastLevelConfig(6)).toThrow();
    });
  });

  describe('getShieldLevelConfig', () => {
    it('should return configuration for level 1 (Tolerant)', () => {
      const config = levelConfigService.getShieldLevelConfig(1);

      expect(config.name).toBe('Tolerant');
      expect(config.threshold).toBe(0.85);
      expect(config.autoActions).toBe(false);
    });

    it('should return configuration for level 3 (Balanced)', () => {
      const config = levelConfigService.getShieldLevelConfig(3);

      expect(config.name).toBe('Balanced');
      expect(config.threshold).toBe(0.70);
      expect(config.autoActions).toBe(true);
    });

    it('should return configuration for level 5 (Strict)', () => {
      const config = levelConfigService.getShieldLevelConfig(5);

      expect(config.name).toBe('Strict');
      expect(config.threshold).toBe(0.50);
      expect(config.autoActions).toBe(true);
    });

    it('should throw error for invalid level', () => {
      expect(() => levelConfigService.getShieldLevelConfig(0)).toThrow();
      expect(() => levelConfigService.getShieldLevelConfig(6)).toThrow();
    });
  });

  describe('validateLevelAccess', () => {
    it('should allow free user to access level 3', async () => {
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { plan: 'free' },
              error: null
            })
          })
        })
      });

      const result = await levelConfigService.validateLevelAccess('user-id', 3, 3);

      expect(result.allowed).toBe(true);
      expect(result.maxAllowedRoastLevel).toBe(3);
      expect(result.maxAllowedShieldLevel).toBe(3);
    });

    it('should block free user from accessing level 4', async () => {
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { plan: 'free' },
              error: null
            })
          })
        })
      });

      const result = await levelConfigService.validateLevelAccess('user-id', 4, 3);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('roast_level_exceeds_plan');
      expect(result.message).toContain('pro');
    });

    it('should allow pro user to access level 4', async () => {
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { plan: 'pro' },
              error: null
            })
          })
        })
      });

      const result = await levelConfigService.validateLevelAccess('user-id', 4, 4);

      expect(result.allowed).toBe(true);
      expect(result.maxAllowedRoastLevel).toBe(4);
      expect(result.maxAllowedShieldLevel).toBe(4);
    });

    it('should allow creator_plus user to access level 5', async () => {
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { plan: 'creator_plus' },
              error: null
            })
          })
        })
      });

      const result = await levelConfigService.validateLevelAccess('user-id', 5, 5);

      expect(result.allowed).toBe(true);
      expect(result.maxAllowedRoastLevel).toBe(5);
      expect(result.maxAllowedShieldLevel).toBe(5);
    });
  });

  describe('getAvailableLevelsForUser', () => {
    it('should return levels 1-3 for free user', async () => {
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { plan: 'free' },
              error: null
            })
          })
        })
      });

      const result = await levelConfigService.getAvailableLevelsForUser('user-id');

      expect(result.plan).toBe('free');
      expect(result.roast.maxLevel).toBe(3);
      expect(result.shield.maxLevel).toBe(3);
      expect(Object.keys(result.roast.available)).toHaveLength(3);
      expect(Object.keys(result.shield.available)).toHaveLength(3);
    });

    it('should return levels 1-4 for pro user', async () => {
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { plan: 'pro' },
              error: null
            })
          })
        })
      });

      const result = await levelConfigService.getAvailableLevelsForUser('user-id');

      expect(result.plan).toBe('pro');
      expect(result.roast.maxLevel).toBe(4);
      expect(result.shield.maxLevel).toBe(4);
      expect(Object.keys(result.roast.available)).toHaveLength(4);
      expect(Object.keys(result.shield.available)).toHaveLength(4);
    });

    it('should return all levels 1-5 for creator_plus user', async () => {
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { plan: 'creator_plus' },
              error: null
            })
          })
        })
      });

      const result = await levelConfigService.getAvailableLevelsForUser('user-id');

      expect(result.plan).toBe('creator_plus');
      expect(result.roast.maxLevel).toBe(5);
      expect(result.shield.maxLevel).toBe(5);
      expect(Object.keys(result.roast.available)).toHaveLength(5);
      expect(Object.keys(result.shield.available)).toHaveLength(5);
    });
  });

  describe('getAllRoastLevels', () => {
    it('should return all roast level definitions', () => {
      const levels = levelConfigService.getAllRoastLevels();

      expect(Object.keys(levels)).toHaveLength(5);
      expect(levels[1].name).toBe('Mild');
      expect(levels[5].name).toBe('Caustic');
    });
  });

  describe('getAllShieldLevels', () => {
    it('should return all shield level definitions', () => {
      const levels = levelConfigService.getAllShieldLevels();

      expect(Object.keys(levels)).toHaveLength(5);
      expect(levels[1].name).toBe('Tolerant');
      expect(levels[5].name).toBe('Strict');
    });
  });

  describe('getPlanLevelLimits', () => {
    it('should return correct limits for free plan', () => {
      const limits = levelConfigService.getPlanLevelLimits('free');

      expect(limits.maxRoastLevel).toBe(3);
      expect(limits.maxShieldLevel).toBe(3);
    });

    it('should return correct limits for pro plan', () => {
      const limits = levelConfigService.getPlanLevelLimits('pro');

      expect(limits.maxRoastLevel).toBe(4);
      expect(limits.maxShieldLevel).toBe(4);
    });

    it('should return correct limits for creator_plus plan', () => {
      const limits = levelConfigService.getPlanLevelLimits('creator_plus');

      expect(limits.maxRoastLevel).toBe(5);
      expect(limits.maxShieldLevel).toBe(5);
    });

    it('should default to free plan for unknown plan', () => {
      const limits = levelConfigService.getPlanLevelLimits('unknown');

      expect(limits.maxRoastLevel).toBe(3);
      expect(limits.maxShieldLevel).toBe(3);
    });
  });
});
