/**
 * Unit tests for Level Configuration Service (Issue #597)
 * Tests roast/shield level configurations and plan-based validation
 */

// Mock Supabase BEFORE requiring the service
jest.mock('../../../src/config/supabase', () => {
  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn()
  };

  return {
    supabaseServiceClient: mockSupabaseClient
  };
});

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

const levelConfigService = require('../../../src/services/levelConfigService');
const { supabaseServiceClient } = require('../../../src/config/supabase');

describe('LevelConfigService - Roast Levels', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRoastLevelConfig', () => {
    it('should return config for level 1 (Mild)', () => {
      const config = levelConfigService.getRoastLevelConfig(1);

      expect(config).toEqual({
        name: 'Mild',
        description: 'Light sarcasm, no profanity, gentle humor',
        temperature: 0.6,
        allowProfanity: false,
        maxLength: 150,
        intensityMultiplier: 0.5
      });
    });

    it('should return config for level 3 (Moderate)', () => {
      const config = levelConfigService.getRoastLevelConfig(3);

      expect(config).toEqual({
        name: 'Moderate',
        description: 'Intense sarcasm, profanity allowed, strong humor',
        temperature: 0.8,
        allowProfanity: true,
        maxLength: 250,
        intensityMultiplier: 0.9
      });
    });

    it('should return config for level 5 (Caustic)', () => {
      const config = levelConfigService.getRoastLevelConfig(5);

      expect(config).toEqual({
        name: 'Caustic',
        description: 'Maximum intensity, no restrictions, brutal honesty',
        temperature: 1.0,
        allowProfanity: true,
        maxLength: 280,
        intensityMultiplier: 1.3
      });
    });

    it('should throw error for invalid level (0)', () => {
      expect(() => levelConfigService.getRoastLevelConfig(0)).toThrow(
        'Invalid roast level: 0. Must be between 1 and 5.'
      );
    });

    it('should throw error for invalid level (6)', () => {
      expect(() => levelConfigService.getRoastLevelConfig(6)).toThrow(
        'Invalid roast level: 6. Must be between 1 and 5.'
      );
    });
  });
});

describe('LevelConfigService - Shield Levels', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getShieldLevelConfig', () => {
    it('should return config for level 1 (Tolerant)', () => {
      const config = levelConfigService.getShieldLevelConfig(1);

      expect(config).toEqual({
        name: 'Tolerant',
        description: 'Blocks only highly toxic content',
        threshold: 0.85,
        autoActions: false
      });
    });

    it('should return config for level 3 (Balanced)', () => {
      const config = levelConfigService.getShieldLevelConfig(3);

      expect(config).toEqual({
        name: 'Balanced',
        description: 'Standard moderation',
        threshold: 0.7,
        autoActions: true
      });
    });

    it('should return config for level 5 (Strict)', () => {
      const config = levelConfigService.getShieldLevelConfig(5);

      expect(config).toEqual({
        name: 'Strict',
        description: 'Blocks most potentially harmful content',
        threshold: 0.5,
        autoActions: true
      });
    });

    it('should throw error for invalid shield level', () => {
      expect(() => levelConfigService.getShieldLevelConfig(10)).toThrow(
        'Invalid shield level: 10. Must be between 1 and 5.'
      );
    });
  });
});

describe('LevelConfigService - Plan Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateLevelAccess', () => {
    it('should allow free plan user to access level 3', async () => {
      supabaseServiceClient.single.mockResolvedValue({
        data: { plan: 'free' },
        error: null
      });

      const result = await levelConfigService.validateLevelAccess('user-123', 3, 3);

      expect(result).toEqual({
        allowed: true,
        currentPlan: 'free',
        maxAllowedRoastLevel: 3,
        maxAllowedShieldLevel: 3
      });
    });

    it('should reject free plan user accessing level 4', async () => {
      supabaseServiceClient.single.mockResolvedValue({
        data: { plan: 'free' },
        error: null
      });

      const result = await levelConfigService.validateLevelAccess('user-123', 4, 3);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('roast_level_exceeds_plan');
      expect(result.maxAllowedRoastLevel).toBe(3);
      expect(result.currentPlan).toBe('free');
    });

    it('should allow plus plan user to access level 5', async () => {
      supabaseServiceClient.single.mockResolvedValue({
        data: { plan: 'plus' },
        error: null
      });

      const result = await levelConfigService.validateLevelAccess('user-456', 5, 5);

      expect(result).toEqual({
        allowed: true,
        currentPlan: 'plus',
        maxAllowedRoastLevel: 5,
        maxAllowedShieldLevel: 5
      });
    });

    it('should allow pro plan user to access level 4', async () => {
      supabaseServiceClient.single.mockResolvedValue({
        data: { plan: 'pro' },
        error: null
      });

      const result = await levelConfigService.validateLevelAccess('user-789', 4, 4);

      expect(result).toEqual({
        allowed: true,
        currentPlan: 'pro',
        maxAllowedRoastLevel: 4,
        maxAllowedShieldLevel: 4
      });
    });

    it('should reject invalid roast level (0)', async () => {
      supabaseServiceClient.single.mockResolvedValue({
        data: { plan: 'pro' },
        error: null
      });

      const result = await levelConfigService.validateLevelAccess('user-123', 0, 3);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('invalid_roast_level');
      expect(result.message).toContain('must be between 1 and 5');
    });

    it('should reject invalid shield level (6)', async () => {
      supabaseServiceClient.single.mockResolvedValue({
        data: { plan: 'pro' },
        error: null
      });

      const result = await levelConfigService.validateLevelAccess('user-123', 3, 6);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('invalid_shield_level');
      expect(result.message).toContain('must be between 1 and 5');
    });
  });

  describe('getRequiredPlanForLevel', () => {
    it('should return "free" for level 1', () => {
      expect(levelConfigService.getRequiredPlanForLevel(1)).toBe('free');
    });

    it('should return "free" for level 3', () => {
      expect(levelConfigService.getRequiredPlanForLevel(3)).toBe('free');
    });

    it('should return "pro" for level 4', () => {
      expect(levelConfigService.getRequiredPlanForLevel(4)).toBe('pro');
    });

    it('should return "creator_plus" for level 5', () => {
      expect(levelConfigService.getRequiredPlanForLevel(5)).toBe('creator_plus');
    });
  });

  describe('getPlanLevelLimits', () => {
    it('should return correct limits for plus plan', () => {
      const limits = levelConfigService.getPlanLevelLimits('plus');

      expect(limits).toEqual({
        maxRoastLevel: 5,
        maxShieldLevel: 5
      });
    });

    it('should return correct limits for pro plan', () => {
      const limits = levelConfigService.getPlanLevelLimits('pro');

      expect(limits).toEqual({
        maxRoastLevel: 4,
        maxShieldLevel: 4
      });
    });

    it('should fall back to free limits for unknown plan', () => {
      const limits = levelConfigService.getPlanLevelLimits('unknown-plan');

      expect(limits).toEqual({
        maxRoastLevel: 3,
        maxShieldLevel: 3
      });
    });
  });
});
