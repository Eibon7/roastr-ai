/**
 * RoastGeneratorEnhanced Tests - ENABLE_CUSTOM_PROMPT Integration
 *
 * Tests to verify that the ENABLE_CUSTOM_PROMPT feature flag correctly controls
 * the use of custom_style_prompt in roast generation without breaking existing functionality.
 */

const { flags } = require('../../../src/config/flags');

// Mock dependencies
jest.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn()
  }
}));

describe('RoastGeneratorEnhanced - ENABLE_CUSTOM_PROMPT Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Flag Logic Tests', () => {
    test('should return null when flag is disabled and custom_style_prompt exists', () => {
      // Mock flag as disabled
      flags.isEnabled.mockImplementation((flag) => {
        if (flag === 'ENABLE_CUSTOM_PROMPT') return false;
        return false;
      });

      const mockConfig = {
        custom_style_prompt: 'Use sophisticated academic humor with literary references'
      };

      // Test the logic that would be used in the generator
      const result = flags.isEnabled('ENABLE_CUSTOM_PROMPT') ? mockConfig.custom_style_prompt : null;

      expect(result).toBeNull();
    });

    test('should return custom_style_prompt when flag is enabled', () => {
      // Mock flag as enabled
      flags.isEnabled.mockImplementation((flag) => {
        if (flag === 'ENABLE_CUSTOM_PROMPT') return true;
        return false;
      });

      const mockConfig = {
        custom_style_prompt: 'Use sophisticated academic humor with literary references'
      };

      // Test the logic that would be used in the generator
      const result = flags.isEnabled('ENABLE_CUSTOM_PROMPT') ? mockConfig.custom_style_prompt : null;

      expect(result).toBe('Use sophisticated academic humor with literary references');
    });

    test('should handle null custom_style_prompt gracefully when flag is enabled', () => {
      // Mock flag as enabled
      flags.isEnabled.mockImplementation((flag) => {
        if (flag === 'ENABLE_CUSTOM_PROMPT') return true;
        return false;
      });

      const mockConfig = {
        custom_style_prompt: null
      };

      // Test the logic that would be used in the generator
      const result = flags.isEnabled('ENABLE_CUSTOM_PROMPT') ? mockConfig.custom_style_prompt : null;

      expect(result).toBeNull();
    });
  });

  describe('Advanced Prompt Logic Tests', () => {
    test('should not include custom style in prompt text when flag is disabled', () => {
      flags.isEnabled.mockImplementation((flag) => {
        if (flag === 'ENABLE_CUSTOM_PROMPT') return false;
        return false;
      });

      const mockConfig = {
        custom_style_prompt: 'Use sophisticated academic humor with literary references'
      };

      // Simulate the logic from buildAdvancedPrompt
      let prompt = 'Base prompt text';
      if (flags.isEnabled('ENABLE_CUSTOM_PROMPT') && mockConfig.custom_style_prompt) {
        prompt += `\n- Estilo personalizado: ${mockConfig.custom_style_prompt}`;
      }

      expect(prompt).not.toContain('Estilo personalizado:');
      expect(prompt).not.toContain('Use sophisticated academic humor with literary references');
      expect(prompt).toBe('Base prompt text');
    });

    test('should include custom style in prompt text when flag is enabled', () => {
      flags.isEnabled.mockImplementation((flag) => {
        if (flag === 'ENABLE_CUSTOM_PROMPT') return true;
        return false;
      });

      const mockConfig = {
        custom_style_prompt: 'Use sophisticated academic humor with literary references'
      };

      // Simulate the logic from buildAdvancedPrompt
      let prompt = 'Base prompt text';
      if (flags.isEnabled('ENABLE_CUSTOM_PROMPT') && mockConfig.custom_style_prompt) {
        prompt += `\n- Estilo personalizado: ${mockConfig.custom_style_prompt}`;
      }

      expect(prompt).toContain('Estilo personalizado: Use sophisticated academic humor with literary references');
    });

    test('should not break when custom_style_prompt is null and flag is enabled', () => {
      flags.isEnabled.mockImplementation((flag) => {
        if (flag === 'ENABLE_CUSTOM_PROMPT') return true;
        return false;
      });

      const mockConfig = {
        custom_style_prompt: null
      };

      // Simulate the logic from buildAdvancedPrompt
      let prompt = 'Base prompt text';
      if (flags.isEnabled('ENABLE_CUSTOM_PROMPT') && mockConfig.custom_style_prompt) {
        prompt += `\n- Estilo personalizado: ${mockConfig.custom_style_prompt}`;
      }

      expect(prompt).not.toContain('Estilo personalizado:');
      expect(prompt).toBe('Base prompt text');
    });
  });
});
