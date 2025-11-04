/**
 * Integration Tests for Tone Mapping in RoastPromptTemplate
 * Issue #717 - Phase 3
 *
 * Tests integration of tone + humor_type + intensity_level in roast generation
 */

const RoastPromptTemplate = require('../../../src/services/roastPromptTemplate');
const constants = require('../../../src/config/constants');

describe('RoastPromptTemplate - Tone Mapping Integration', () => {
  let template;

  beforeEach(() => {
    template = new RoastPromptTemplate();
  });

  describe('mapUserTone() - Basic functionality', () => {
    test('should return default tone for empty config', () => {
      const result = template.mapUserTone({});
      expect(result).toBe('sarcástico y cortante');
    });

    test('should map valid tone from config', () => {
      const result = template.mapUserTone({ tone: 'sarcastic' });
      expect(result).toBe('sarcástico y cortante');
    });

    test('should handle invalid tone by falling back to default', () => {
      const result = template.mapUserTone({ tone: 'invalid' });
      expect(result).toBe('sarcástico y cortante');
    });

    test('should handle null tone by falling back to default', () => {
      const result = template.mapUserTone({ tone: null });
      expect(result).toBe('sarcástico y cortante');
    });
  });

  describe('mapUserTone() - Tone variations', () => {
    test('should map sarcastic tone', () => {
      const result = template.mapUserTone({ tone: 'sarcastic' });
      expect(result).toContain('sarcástico y cortante');
    });

    test('should map ironic tone', () => {
      const result = template.mapUserTone({ tone: 'ironic' });
      expect(result).toContain('irónico y sofisticado');
    });

    test('should map absurd tone', () => {
      const result = template.mapUserTone({ tone: 'absurd' });
      expect(result).toContain('absurdo y surrealista');
    });

    test('should map witty tone', () => {
      const result = template.mapUserTone({ tone: 'witty' });
      expect(result).toContain('ingenioso y rápido');
    });

    test('should map clever tone', () => {
      const result = template.mapUserTone({ tone: 'clever' });
      expect(result).toContain('inteligente y calculado');
    });

    test('should map playful tone', () => {
      const result = template.mapUserTone({ tone: 'playful' });
      expect(result).toContain('juguetón y amigable');
    });
  });

  describe('mapUserTone() - Humor type modifiers', () => {
    test('should add witty humor modifier', () => {
      const result = template.mapUserTone({
        tone: 'sarcastic',
        humor_type: 'witty'
      });
      expect(result).toContain('con humor ágil');
    });

    test('should add clever humor modifier', () => {
      const result = template.mapUserTone({
        tone: 'sarcastic',
        humor_type: 'clever'
      });
      expect(result).toContain('con humor intelectual');
    });

    test('should add playful humor modifier', () => {
      const result = template.mapUserTone({
        tone: 'sarcastic',
        humor_type: 'playful'
      });
      expect(result).toContain('con humor ligero');
    });

    test('should handle invalid humor_type gracefully', () => {
      const result = template.mapUserTone({
        tone: 'sarcastic',
        humor_type: 'invalid'
      });
      // Should have base tone but no humor modifier
      expect(result).toContain('sarcástico y cortante');
      expect(result).not.toContain('con humor');
    });

    test('should handle null humor_type gracefully', () => {
      const result = template.mapUserTone({
        tone: 'sarcastic',
        humor_type: null
      });
      expect(result).toContain('sarcástico y cortante');
      expect(result).not.toContain('con humor');
    });
  });

  describe('mapUserTone() - Tone + Humor combinations (matrix)', () => {
    const tones = ['sarcastic', 'ironic', 'absurd', 'witty', 'clever', 'playful'];
    const humorTypes = ['witty', 'clever', 'playful'];

    tones.forEach(tone => {
      humorTypes.forEach(humorType => {
        test(`should combine ${tone} + ${humorType}`, () => {
          const result = template.mapUserTone({ tone, humor_type: humorType });

          // Should contain base tone description
          expect(result).toContain(constants.TONE_MAP[tone]);

          // Should contain humor modifier
          expect(result).toContain(constants.HUMOR_MAP[humorType]);

          // Should be non-empty
          expect(result.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('mapUserTone() - Intensity level modifiers', () => {
    describe('low intensity (1-2)', () => {
      test('should add "suave y amigable" for level 1', () => {
        const result = template.mapUserTone({
          tone: 'sarcastic',
          intensity_level: 1
        });
        expect(result).toContain('suave y amigable');
      });

      test('should add "suave y amigable" for level 2', () => {
        const result = template.mapUserTone({
          tone: 'sarcastic',
          intensity_level: 2
        });
        expect(result).toContain('suave y amigable');
      });
    });

    describe('medium intensity (3)', () => {
      test('should NOT add intensity modifier for level 3', () => {
        const result = template.mapUserTone({
          tone: 'sarcastic',
          intensity_level: 3
        });
        expect(result).not.toContain('suave y amigable');
        expect(result).not.toContain('directo y sin filtros');
      });
    });

    describe('high intensity (4-5)', () => {
      test('should add "directo y sin filtros" for level 4', () => {
        const result = template.mapUserTone({
          tone: 'sarcastic',
          intensity_level: 4
        });
        expect(result).toContain('directo y sin filtros');
      });

      test('should add "directo y sin filtros" for level 5', () => {
        const result = template.mapUserTone({
          tone: 'sarcastic',
          intensity_level: 5
        });
        expect(result).toContain('directo y sin filtros');
      });
    });

    describe('invalid intensity', () => {
      test('should handle intensity 0 gracefully', () => {
        const result = template.mapUserTone({
          tone: 'sarcastic',
          intensity_level: 0
        });
        // Should have base tone, no intensity modifier
        expect(result).toContain('sarcástico y cortante');
        expect(result).not.toContain('suave y amigable');
        expect(result).not.toContain('directo y sin filtros');
      });

      test('should handle intensity 6 gracefully', () => {
        const result = template.mapUserTone({
          tone: 'sarcastic',
          intensity_level: 6
        });
        expect(result).toContain('sarcástico y cortante');
      });

      test('should handle null intensity gracefully', () => {
        const result = template.mapUserTone({
          tone: 'sarcastic',
          intensity_level: null
        });
        expect(result).toContain('sarcástico y cortante');
      });
    });
  });

  describe('mapUserTone() - Full combinations', () => {
    test('should combine tone + humor + low intensity', () => {
      const result = template.mapUserTone({
        tone: 'witty',
        humor_type: 'clever',
        intensity_level: 1
      });

      expect(result).toContain('ingenioso y rápido');
      expect(result).toContain('con humor intelectual');
      expect(result).toContain('suave y amigable');
    });

    test('should combine tone + humor + high intensity', () => {
      const result = template.mapUserTone({
        tone: 'sarcastic',
        humor_type: 'witty',
        intensity_level: 5
      });

      expect(result).toContain('sarcástico y cortante');
      expect(result).toContain('con humor ágil');
      expect(result).toContain('directo y sin filtros');
    });

    test('should combine tone + humor + medium intensity (no modifier)', () => {
      const result = template.mapUserTone({
        tone: 'playful',
        humor_type: 'playful',
        intensity_level: 3
      });

      expect(result).toContain('juguetón y amigable');
      expect(result).toContain('con humor ligero');
      expect(result).not.toContain('suave y amigable');
      expect(result).not.toContain('directo y sin filtros');
    });

    test('should handle all fields null/undefined', () => {
      const result = template.mapUserTone({
        tone: null,
        humor_type: undefined,
        intensity_level: null
      });

      // Should return default tone only
      expect(result).toBe('sarcástico y cortante');
    });
  });

  describe('mapUserTone() - Custom style prompt', () => {
    test('should append custom style prompt if provided', () => {
      const result = template.mapUserTone({
        tone: 'sarcastic',
        custom_style_prompt: 'Fan de los 90s, referencias retro'
      });

      expect(result).toContain('sarcástico y cortante');
      expect(result).toContain('. Estilo personalizado: Fan de los 90s, referencias retro');
    });

    test('should handle custom style with humor_type', () => {
      const result = template.mapUserTone({
        tone: 'witty',
        humor_type: 'clever',
        custom_style_prompt: 'Estilo geek y tecnológico'
      });

      expect(result).toContain('ingenioso y rápido');
      expect(result).toContain('con humor intelectual');
      expect(result).toContain('. Estilo personalizado: Estilo geek y tecnológico');
    });

    test('should handle custom style with intensity', () => {
      const result = template.mapUserTone({
        tone: 'sarcastic',
        intensity_level: 5,
        custom_style_prompt: 'Muy directo, sin rodeos'
      });

      expect(result).toContain('sarcástico y cortante');
      expect(result).toContain('directo y sin filtros');
      expect(result).toContain('. Estilo personalizado: Muy directo, sin rodeos');
    });

    test('should handle empty custom style prompt', () => {
      const result = template.mapUserTone({
        tone: 'sarcastic',
        custom_style_prompt: ''
      });

      expect(result).toContain('sarcástico y cortante');
      expect(result).not.toContain('Estilo personalizado');
    });

    test('should handle null custom style prompt', () => {
      const result = template.mapUserTone({
        tone: 'sarcastic',
        custom_style_prompt: null
      });

      expect(result).toContain('sarcástico y cortante');
      expect(result).not.toContain('Estilo personalizado');
    });
  });

  describe('mapUserTone() - Edge cases', () => {
    test('should handle config with extra unexpected fields', () => {
      const result = template.mapUserTone({
        tone: 'sarcastic',
        extra_field: 'should be ignored',
        another_field: 123
      });

      expect(result).toContain('sarcástico y cortante');
    });

    test('should handle config with all fields present', () => {
      const result = template.mapUserTone({
        tone: 'clever',
        humor_type: 'witty',
        intensity_level: 4,
        custom_style_prompt: 'Estilo completo'
      });

      expect(result).toContain('inteligente y calculado');
      expect(result).toContain('con humor ágil');
      expect(result).toContain('directo y sin filtros');
      expect(result).toContain('. Estilo personalizado: Estilo completo');
    });

    test('should produce deterministic output for same config', () => {
      const config = {
        tone: 'sarcastic',
        humor_type: 'witty',
        intensity_level: 3
      };

      const result1 = template.mapUserTone(config);
      const result2 = template.mapUserTone(config);

      expect(result1).toBe(result2);
    });
  });

  describe('mapUserTone() - Security', () => {
    test('should handle custom_style_prompt with special characters', () => {
      const result = template.mapUserTone({
        tone: 'sarcastic',
        custom_style_prompt: 'Estilo <script>alert("xss")</script>'
      });

      // Should still work, not crash
      expect(result).toBeDefined();
      expect(result).toContain('sarcástico y cortante');
    });

    test('should handle very long custom_style_prompt', () => {
      const longPrompt = 'A'.repeat(5000);
      const result = template.mapUserTone({
        tone: 'sarcastic',
        custom_style_prompt: longPrompt
      });

      // Should handle gracefully
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle SQL injection attempt in custom_style_prompt', () => {
      const result = template.mapUserTone({
        tone: 'sarcastic',
        custom_style_prompt: "'; DROP TABLE users;--"
      });

      expect(result).toBeDefined();
      expect(result).toContain('sarcástico y cortante');
    });
  });

  describe('mapUserTone() - Type safety', () => {
    test('should handle numeric tone value', () => {
      const result = template.mapUserTone({ tone: 123 });
      expect(result).toBe('sarcástico y cortante'); // Falls back to default
    });

    test('should handle boolean tone value', () => {
      const result = template.mapUserTone({ tone: true });
      expect(result).toBe('sarcástico y cortante');
    });

    test('should handle object tone value', () => {
      const result = template.mapUserTone({ tone: {} });
      expect(result).toBe('sarcástico y cortante');
    });

    test('should handle string intensity_level', () => {
      const result = template.mapUserTone({
        tone: 'sarcastic',
        intensity_level: '4'
      });

      // Should parse string to number and work
      expect(result).toContain('directo y sin filtros');
    });
  });

  describe('mapUserTone() - Performance', () => {
    test('should complete 1000 mappings quickly', () => {
      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        template.mapUserTone({
          tone: 'sarcastic',
          humor_type: 'witty',
          intensity_level: 3
        });
      }

      const elapsed = Date.now() - start;
      // Should complete 1000 mappings in less than 100ms
      expect(elapsed).toBeLessThan(100);
    });
  });
});
