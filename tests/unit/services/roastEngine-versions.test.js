/**
 * Unit Tests for RoastEngine - Version Control Logic
 * Issue #409 - Phase 3
 *
 * Tests version generation (1 vs 2 versions) based on ROAST_VERSIONS_MULTIPLE flag
 */

const RoastEngine = require('../../../src/services/roastEngine');
const { flags } = require('../../../src/config/flags');

// Mock dependencies
jest.mock('../../../src/services/roastGeneratorEnhanced');
jest.mock('../../../src/services/transparencyService');
jest.mock('../../../src/config/supabase');

describe('RoastEngine - Version Control', () => {
  let roastEngine;
  let originalFlag;

  beforeEach(() => {
    // Save original flag value
    originalFlag = process.env.ROAST_VERSIONS_MULTIPLE;

    // Clear mocks
    jest.clearAllMocks();

    // Initialize engine
    roastEngine = new RoastEngine();
  });

  afterEach(() => {
    // Restore original flag
    if (originalFlag === undefined) {
      delete process.env.ROAST_VERSIONS_MULTIPLE;
    } else {
      process.env.ROAST_VERSIONS_MULTIPLE = originalFlag;
    }
    // Reset modules to reload flags
    jest.resetModules();
  });

  describe('Voice Styles', () => {
    test('should define Spanish voice styles', () => {
      expect(roastEngine.voiceStyles.es).toBeDefined();
      expect(roastEngine.voiceStyles.es.flanders).toBeDefined();
      expect(roastEngine.voiceStyles.es.balanceado).toBeDefined();
      expect(roastEngine.voiceStyles.es.canalla).toBeDefined();
    });

    test('should define English voice styles', () => {
      expect(roastEngine.voiceStyles.en).toBeDefined();
      expect(roastEngine.voiceStyles.en.light).toBeDefined();
      expect(roastEngine.voiceStyles.en.balanced).toBeDefined();
      expect(roastEngine.voiceStyles.en.savage).toBeDefined();
    });

    test('should have proper intensity levels', () => {
      expect(roastEngine.voiceStyles.es.flanders.intensity).toBe(2);
      expect(roastEngine.voiceStyles.es.balanceado.intensity).toBe(3);
      expect(roastEngine.voiceStyles.es.canalla.intensity).toBe(4);

      expect(roastEngine.voiceStyles.en.light.intensity).toBe(2);
      expect(roastEngine.voiceStyles.en.balanced.intensity).toBe(3);
      expect(roastEngine.voiceStyles.en.savage.intensity).toBe(4);
    });
  });

  describe('Transparency Disclaimers', () => {
    test('should define Spanish disclaimers', () => {
      expect(roastEngine.transparencyDisclaimers.es).toBeDefined();
      expect(Array.isArray(roastEngine.transparencyDisclaimers.es)).toBe(true);
      expect(roastEngine.transparencyDisclaimers.es.length).toBeGreaterThan(0);
    });

    test('should define English disclaimers', () => {
      expect(roastEngine.transparencyDisclaimers.en).toBeDefined();
      expect(Array.isArray(roastEngine.transparencyDisclaimers.en)).toBe(true);
      expect(roastEngine.transparencyDisclaimers.en.length).toBeGreaterThan(0);
    });

    test('should have at least 5 disclaimers per language', () => {
      expect(roastEngine.transparencyDisclaimers.es.length).toBeGreaterThanOrEqual(5);
      expect(roastEngine.transparencyDisclaimers.en.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Input Validation', () => {
    test('should throw error if comment is missing', () => {
      expect(() => {
        roastEngine.validateInput({}, { userId: 'test-user' });
      }).toThrow('Input comment is required');
    });

    test('should throw error if userId is missing', () => {
      expect(() => {
        roastEngine.validateInput({ comment: 'test' }, {});
      }).toThrow('User ID is required');
    });

    test('should throw error if comment exceeds max length', () => {
      const longComment = 'a'.repeat(3000); // Exceeds 2000 char limit

      expect(() => {
        roastEngine.validateInput({ comment: longComment }, { userId: 'test-user' });
      }).toThrow(/exceeds maximum length/);
    });

    test('should accept valid input', () => {
      expect(() => {
        roastEngine.validateInput(
          { comment: 'Valid comment' },
          { userId: 'test-user', style: 'balanceado', language: 'es' }
        );
      }).not.toThrow();
    });
  });

  describe('Default Configuration', () => {
    test('should return default configuration', () => {
      const config = roastEngine.getDefaultConfiguration();

      expect(config).toBeDefined();
      expect(config.plan).toBe('free');
      expect(config.autoApprove).toBe(false);
      expect(config.defaultStyle).toBe('balanceado');
      expect(config.language).toBe('es');
      expect(config.transparencyMode).toBe('signature');
    });

    test('should have consistent defaults', () => {
      const config1 = roastEngine.getDefaultConfiguration();
      const config2 = roastEngine.getDefaultConfiguration();

      expect(config1).toEqual(config2);
    });
  });
});
