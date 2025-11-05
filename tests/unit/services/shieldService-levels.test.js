/**
 * Tests for ShieldService shield_level integration (Issue #597)
 */

const ShieldService = require('../../../src/services/shieldService');

// Mock dependencies
jest.mock('../../../src/config/supabase');
jest.mock('../../../src/services/costControl');
jest.mock('../../../src/services/queueService');
jest.mock('../../../src/services/levelConfigService');
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('ShieldService - Shield Level Integration', () => {
  let shieldService;

  beforeEach(() => {
    // Mock levelConfigService to return test configurations
    const levelConfigService = require('../../../src/services/levelConfigService');
    levelConfigService.getShieldLevelConfig = jest.fn((level) => {
      const configs = {
        1: { name: 'Tolerant', threshold: 0.85, autoActions: false },
        2: { name: 'Balanced-Tolerant', threshold: 0.78, autoActions: false },
        3: { name: 'Balanced', threshold: 0.70, autoActions: true },
        4: { name: 'Balanced-Strict', threshold: 0.60, autoActions: true },
        5: { name: 'Strict', threshold: 0.50, autoActions: true }
      };
      if (!configs[level]) throw new Error('Invalid level');
      return configs[level];
    });

    shieldService = new ShieldService({ enabled: true });
    jest.clearAllMocks();
  });

  describe('applyShieldLevelThreshold', () => {
    it('should apply tolerant threshold (level 1, τ=0.85)', () => {
      const analysisResult = {
        toxicity_score: 0.80,
        severity_level: 'medium'
      };

      const adjusted = shieldService.applyShieldLevelThreshold(analysisResult, 1);

      // Score 0.80 < 0.85 threshold, so should be low severity
      expect(adjusted.severity_level).toBe('low');
    });

    it('should apply balanced threshold (level 3, τ=0.70)', () => {
      const analysisResult = {
        toxicity_score: 0.75,
        severity_level: 'low'
      };

      const adjusted = shieldService.applyShieldLevelThreshold(analysisResult, 3);

      // Score 0.75 > 0.70 threshold, so should be escalated
      expect(adjusted.severity_level).toBe('medium');
    });

    it('should apply strict threshold (level 5, τ=0.50)', () => {
      const analysisResult = {
        toxicity_score: 0.55,
        severity_level: 'low'
      };

      const adjusted = shieldService.applyShieldLevelThreshold(analysisResult, 5);

      // Score 0.55 > 0.50 threshold, strict level escalates to high
      expect(adjusted.severity_level).toBe('high');
    });

    it('should escalate to critical for very high toxicity', () => {
      const analysisResult = {
        toxicity_score: 0.96,
        severity_level: 'high'
      };

      const adjusted = shieldService.applyShieldLevelThreshold(analysisResult, 3);

      expect(adjusted.severity_level).toBe('critical');
    });

    it('should not mutate original analysis result', () => {
      const analysisResult = {
        toxicity_score: 0.75,
        severity_level: 'low'
      };

      const adjusted = shieldService.applyShieldLevelThreshold(analysisResult, 3);

      expect(analysisResult.severity_level).toBe('low'); // Original unchanged
      expect(adjusted.severity_level).not.toBe('low'); // Adjusted changed
    });

    it('should handle invalid shield level gracefully', () => {
      const analysisResult = {
        toxicity_score: 0.75,
        severity_level: 'medium'
      };

      // Mock levelConfigService to throw error
      const levelConfigService = require('../../../src/services/levelConfigService');
      levelConfigService.getShieldLevelConfig = jest.fn().mockImplementation(() => {
        throw new Error('Invalid level');
      });

      const adjusted = shieldService.applyShieldLevelThreshold(analysisResult, 99);

      // Should return original on error
      expect(adjusted.severity_level).toBe('medium');
    });
  });

  describe('Shield level scenarios', () => {
    it('should block content at level 5 (Strict) that would pass at level 1 (Tolerant)', () => {
      const analysisResult = {
        toxicity_score: 0.60, // Between 0.50 (strict) and 0.85 (tolerant)
        severity_level: 'low'
      };

      // Level 1 (Tolerant, τ=0.85) - should not block
      const tolerantResult = shieldService.applyShieldLevelThreshold(analysisResult, 1);
      expect(tolerantResult.severity_level).toBe('low');

      // Level 5 (Strict, τ=0.50) - should block
      const strictResult = shieldService.applyShieldLevelThreshold(analysisResult, 5);
      expect(strictResult.severity_level).not.toBe('low');
      expect(['medium', 'high'].includes(strictResult.severity_level)).toBe(true);
    });

    it('should apply different escalation at balanced-strict (level 4)', () => {
      const analysisResult = {
        toxicity_score: 0.65,
        severity_level: 'low'
      };

      // Level 3 (Balanced, τ=0.70) - below threshold
      const balancedResult = shieldService.applyShieldLevelThreshold(analysisResult, 3);
      expect(balancedResult.severity_level).toBe('low');

      // Level 4 (Balanced-Strict, τ=0.60) - above threshold
      const strictBalancedResult = shieldService.applyShieldLevelThreshold(analysisResult, 4);
      expect(strictBalancedResult.severity_level).toBe('high'); // Escalates to high at level 4
    });

    it('should escalate to high for high toxicity at strict levels', () => {
      const analysisResult = {
        toxicity_score: 0.88,
        severity_level: 'medium'
      };

      const result = shieldService.applyShieldLevelThreshold(analysisResult, 5);

      // Score 0.88 >= 0.85, should be at least high
      expect(result.severity_level).toBe('high');
    });

    it('should use default level 3 when no level specified', () => {
      const analysisResult = {
        toxicity_score: 0.75,
        severity_level: 'low'
      };

      const result = shieldService.applyShieldLevelThreshold(analysisResult); // No level param

      // Should use default level 3 (τ=0.70)
      // 0.75 > 0.70, so should escalate
      expect(result.severity_level).not.toBe('low');
    });
  });
});
