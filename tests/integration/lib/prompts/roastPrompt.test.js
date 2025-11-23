/**
 * Integration Tests: RoastPrompt Dynamic Tone Integration
 *
 * Tests that roastPrompt.js correctly integrates with ToneConfigService
 * to dynamically load tones in Block A.
 *
 * Issue #876: Dynamic Roast Tone Configuration System
 */

const { RoastPromptBuilder } = require('../../../../src/lib/prompts/roastPrompt');
const { getToneConfigService } = require('../../../../src/services/toneConfigService');

// Mock dependencies
jest.mock('../../../../src/services/toneConfigService');
jest.mock('../../../../src/utils/logger');

describe('RoastPrompt Dynamic Tone Integration Tests', () => {
  let promptBuilder;
  let mockToneService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock tone service
    mockToneService = {
      getActiveTones: jest.fn(),
      invalidateCache: jest.fn()
    };
    getToneConfigService.mockReturnValue(mockToneService);

    promptBuilder = new RoastPromptBuilder();
  });

  describe('buildBlockA with dynamic tones', () => {
    it('should load tones from ToneConfigService and include them in Block A', async () => {
      const mockTones = [
        {
          name: 'flanders',
          display_name: 'Flanders',
          description: 'Tono amable e irónico',
          intensity: 2,
          personality: 'Educado, irónico, elegante',
          resources: ['Ironía sutil', 'Double entendre'],
          restrictions: ['NO insultos directos', 'NO vulgaridad'],
          examples: [{ input: 'Eres tonto', output: 'Oh, qué observación tan... original.' }]
        },
        {
          name: 'balanceado',
          display_name: 'Balanceado',
          description: 'Equilibrio perfecto',
          intensity: 3,
          personality: 'Ingenioso, equilibrado',
          resources: ['Juegos de palabras', 'Referencias pop'],
          restrictions: ['NO vulgaridad excesiva'],
          examples: [
            {
              input: 'Comentario absurdo',
              output: 'Y el premio al comentario más obvio es para...'
            }
          ]
        }
      ];

      mockToneService.getActiveTones.mockResolvedValue(mockTones);

      const blockA = await promptBuilder.buildBlockA('es');

      expect(mockToneService.getActiveTones).toHaveBeenCalledWith('es');
      expect(blockA).toContain('FLANDERS');
      expect(blockA).toContain('BALANCEADO');
      expect(blockA).toContain('Intensidad: 2/5');
      expect(blockA).toContain('Intensidad: 3/5');
      expect(blockA).toContain('Tono amable e irónico');
      expect(blockA).toContain('Equilibrio perfecto');
      expect(blockA).toContain('Ironía sutil');
      expect(blockA).toContain('Juegos de palabras');
      expect(blockA).toContain('NO insultos directos');
      expect(blockA).toContain('NO vulgaridad excesiva');
    });

    it('should work with English language', async () => {
      const mockTonesEN = [
        {
          name: 'light',
          display_name: 'Light',
          description: 'Gentle and witty',
          intensity: 2,
          personality: 'Polite, ironic',
          resources: ['Subtle irony'],
          restrictions: ['NO direct insults'],
          examples: [{ input: 'You are dumb', output: 'What an... original observation.' }]
        }
      ];

      mockToneService.getActiveTones.mockResolvedValue(mockTonesEN);

      const blockA = await promptBuilder.buildBlockA('en');

      expect(mockToneService.getActiveTones).toHaveBeenCalledWith('en');
      expect(blockA).toContain('LIGHT');
      expect(blockA).toContain('Gentle and witty');
      expect(blockA).toContain('Subtle irony');
    });

    it('should fallback to static Block A if tone service fails', async () => {
      mockToneService.getActiveTones.mockRejectedValue(new Error('DB connection failed'));

      const blockA = await promptBuilder.buildBlockA('es');

      expect(mockToneService.getActiveTones).toHaveBeenCalled();
      expect(blockA).toContain('Tu tarea es generar una respuesta sarcástica');
      expect(blockA).not.toContain('FLANDERS'); // Should not include dynamic tones
    });

    it('should handle empty tones array gracefully', async () => {
      mockToneService.getActiveTones.mockResolvedValue([]);

      const blockA = await promptBuilder.buildBlockA('es');

      expect(blockA).toContain('Tienes 0 tonos disponibles');
    });
  });

  describe('buildCompletePrompt with dynamic tones', () => {
    it('should await buildBlockA and include dynamic tones in complete prompt', async () => {
      const mockTones = [
        {
          name: 'canalla',
          display_name: 'Canalla',
          description: 'Directo y sin filtros',
          intensity: 4,
          personality: 'Picante, directo',
          resources: ['Sarcasmo crudo'],
          restrictions: ['NO tabúes absolutos'],
          examples: [{ input: 'Comentario troll', output: 'Vaya, otro experto de internet...' }]
        }
      ];

      mockToneService.getActiveTones.mockResolvedValue(mockTones);

      const completePrompt = await promptBuilder.buildCompletePrompt({
        comment: 'Test comment',
        platform: 'twitter',
        tone: 'canalla',
        language: 'es'
      });

      expect(mockToneService.getActiveTones).toHaveBeenCalledWith('es');
      expect(completePrompt).toContain('CANALLA');
      expect(completePrompt).toContain('Directo y sin filtros');
      expect(completePrompt).toContain('Test comment');
    });

    it('should work with default language (es) if not specified', async () => {
      const mockTones = [
        {
          name: 'flanders',
          display_name: 'Flanders',
          description: 'Tono amable',
          intensity: 2,
          personality: 'Educado',
          resources: ['Ironía'],
          restrictions: ['NO insultos'],
          examples: [{ input: 'input', output: 'output' }]
        }
      ];

      mockToneService.getActiveTones.mockResolvedValue(mockTones);

      await promptBuilder.buildCompletePrompt({
        comment: 'Test',
        platform: 'twitter'
      });

      expect(mockToneService.getActiveTones).toHaveBeenCalledWith('es');
    });

    it('should handle tone service failures and still generate prompt', async () => {
      mockToneService.getActiveTones.mockRejectedValue(new Error('Service down'));

      const completePrompt = await promptBuilder.buildCompletePrompt({
        comment: 'Test comment',
        platform: 'twitter'
      });

      expect(completePrompt).toContain('Tu tarea es generar una respuesta sarcástica');
      expect(completePrompt).toContain('Test comment');
    });
  });

  describe('Cache integration', () => {
    it('should leverage ToneConfigService cache for repeated calls', async () => {
      const mockTones = [
        {
          name: 'flanders',
          display_name: 'Flanders',
          description: 'Tono amable',
          intensity: 2,
          personality: 'Educado',
          resources: ['Ironía'],
          restrictions: ['NO insultos'],
          examples: [{ input: 'input', output: 'output' }]
        }
      ];

      mockToneService.getActiveTones.mockResolvedValue(mockTones);

      // First call
      await promptBuilder.buildBlockA('es');
      expect(mockToneService.getActiveTones).toHaveBeenCalledTimes(1);

      // Second call (should use cache if implemented in ToneConfigService)
      await promptBuilder.buildBlockA('es');
      expect(mockToneService.getActiveTones).toHaveBeenCalledTimes(2);

      // Note: Cache behavior is tested in toneConfigService.test.js
      // Here we just verify the service is called correctly
    });
  });

  describe('Backward compatibility', () => {
    it('should maintain existing prompt structure with dynamic tones', async () => {
      const mockTones = [
        {
          name: 'flanders',
          display_name: 'Flanders',
          description: 'Tono amable',
          intensity: 2,
          personality: 'Educado',
          resources: ['Ironía'],
          restrictions: ['NO insultos'],
          examples: [{ input: 'input', output: 'output' }]
        }
      ];

      mockToneService.getActiveTones.mockResolvedValue(mockTones);

      const completePrompt = await promptBuilder.buildCompletePrompt({
        comment: 'Test comment',
        platform: 'twitter',
        tone: 'sarcastic',
        language: 'es'
      });

      // Should still contain all key sections
      expect(completePrompt).toContain('Tu tarea es generar una respuesta sarcástica');
      expect(completePrompt).toContain('SISTEMA DE TONOS');
      expect(completePrompt).toContain('CARACTERÍSTICAS DE UN BUEN ROAST');
      expect(completePrompt).toContain('Test comment');
    });
  });
});
