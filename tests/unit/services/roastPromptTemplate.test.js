const RoastPromptTemplate = require('../../../src/services/roastPromptTemplate');

// Mock the CSV service to avoid file system dependencies
jest.mock('../../../src/services/csvRoastService', () => {
  return jest.fn().mockImplementation(() => ({
    loadRoasts: jest.fn().mockResolvedValue([
      { comment: 'Esta comida está mala', roast: 'Tu paladar es más exigente que un crítico michelin con problemas digestivos 🍽️' },
      { comment: 'Esta película es horrible', roast: 'Tu crítica cinematográfica tiene la profundidad de un charco después de la lluvia 🎬' },
      { comment: 'No me gusta este diseño', roast: 'Tu sentido del diseño es tan bueno como el de alguien que decora con papel tapiz de los 70s 🎨' }
    ])
  }));
});

describe('RoastPromptTemplate', () => {
  let promptTemplate;

  beforeEach(() => {
    promptTemplate = new RoastPromptTemplate();
  });

  describe('categorizeComment', () => {
    test('should categorize personal attacks', () => {
      const comment = 'Eres un idiota';
      const category = promptTemplate.categorizeComment(comment);
      expect(category).toBe('ataque personal');
    });

    test('should categorize body shaming', () => {
      const comment = 'Estás muy gordo';
      const category = promptTemplate.categorizeComment(comment);
      expect(category).toBe('body shaming');
    });

    test('should categorize generic insults', () => {
      const comment = 'Qué idiota';
      const category = promptTemplate.categorizeComment(comment);
      expect(category).toBe('insulto genérico');
    });

    test('should categorize absurd claims', () => {
      const comment = 'La tierra plana es real';
      const category = promptTemplate.categorizeComment(comment);
      expect(category).toBe('afirmación absurda');
    });

    test('should use toxicity categories when available', () => {
      const comment = 'Test comment';
      const toxicityData = { categories: ['INSULT'] };
      const category = promptTemplate.categorizeComment(comment, toxicityData);
      expect(category).toBe('insulto directo');
    });

    test('should default to generic negative comment', () => {
      const comment = 'This is just a comment';
      const category = promptTemplate.categorizeComment(comment);
      expect(category).toBe('comentario genérico negativo');
    });
  });

  describe('mapUserTone', () => {
    test('should map basic tones correctly', () => {
      const config = { tone: 'sarcastic', humor_type: 'witty' };
      const tone = promptTemplate.mapUserTone(config);
      expect(tone).toBe('sarcástico y cortante con humor ágil');
    });

    test('should include intensity levels', () => {
      const config = { tone: 'ironic', intensity_level: 1 };
      const tone = promptTemplate.mapUserTone(config);
      expect(tone).toContain('suave y amigable');
    });

    test('should include custom style prompts', () => {
      const config = { 
        tone: 'clever', 
        custom_style_prompt: 'Usa referencias pop culture' 
      };
      const tone = promptTemplate.mapUserTone(config);
      expect(tone).toContain('Estilo personalizado: Usa referencias pop culture');
    });
  });

  describe('getReferenceRoasts', () => {
    test('should return formatted reference roasts', async () => {
      const comment = 'Esta comida está mala';
      const references = await promptTemplate.getReferenceRoasts(comment, 2);
      
      expect(references).toContain('1. Comentario:');
      expect(references).toContain('Tu paladar es más exigente');
    });

    test('should handle no matches gracefully', async () => {
      // Mock to return empty array
      promptTemplate.csvService.loadRoasts.mockResolvedValueOnce([]);
      
      const comment = 'Completely unrelated comment';
      const references = await promptTemplate.getReferenceRoasts(comment);
      
      expect(references).toBe('No hay ejemplos específicos disponibles para este tipo de comentario.');
    });
  });

  describe('buildPrompt', () => {
    test('should build complete prompt with all placeholders replaced', async () => {
      const params = {
        originalComment: 'Esta aplicación es horrible',
        toxicityData: { score: 0.5, categories: ['TOXICITY'] },
        userConfig: { 
          tone: 'sarcastic', 
          humor_type: 'witty', 
          intensity_level: 3 
        },
        includeReferences: true
      };

      const prompt = await promptTemplate.buildPrompt(params);

      // Check that all placeholders are replaced
      expect(prompt).toContain('Esta aplicación es horrible');
      expect(prompt).not.toContain('{{original_comment}}');
      expect(prompt).not.toContain('{{comment_category}}');
      expect(prompt).not.toContain('{{reference_roasts_from_CSV}}');
      expect(prompt).not.toContain('{{user_tone}}');

      // Check content structure
      expect(prompt).toContain('💬 COMENTARIO ORIGINAL:');
      expect(prompt).toContain('🎭 CATEGORÍA DEL COMENTARIO:');
      expect(prompt).toContain('📚 EJEMPLOS DE ROASTS BIEN EJECUTADOS:');
      expect(prompt).toContain('👤 TONO PERSONAL');
      expect(prompt).toContain('✍️ RESPUESTA:');
    });

    test('should handle free plan without references', async () => {
      const params = {
        originalComment: 'Test comment',
        userConfig: { tone: 'sarcastic' },
        includeReferences: false
      };

      const prompt = await promptTemplate.buildPrompt(params);
      expect(prompt).toContain('Referencias desactivadas para este modo');
    });

    test('should use fallback prompt on error', async () => {
      // Force an error in getReferenceRoasts
      const mockTemplate = new RoastPromptTemplate();
      mockTemplate.getReferenceRoasts = jest.fn().mockRejectedValue(new Error('Test error'));
      
      const params = {
        originalComment: 'Test comment',
        userConfig: { tone: 'sarcastic' }
      };

      const prompt = await mockTemplate.buildPrompt(params);
      expect(prompt).toContain('Genera un roast');
      expect(prompt).toContain('Test comment');
    });
  });

  describe('getVersion', () => {
    test('should return correct version', () => {
      const version = promptTemplate.getVersion();
      expect(version).toBe('v1-roast-prompt');
    });
  });

  describe('findSimilarRoasts', () => {
    test('should find similar roasts based on keywords', () => {
      const allRoasts = [
        { comment: 'Esta comida está mala', roast: 'Test roast 1' },
        { comment: 'La película es aburrida', roast: 'Test roast 2' },
        { comment: 'No me gusta la comida', roast: 'Test roast 3' }
      ];

      const similar = promptTemplate.findSimilarRoasts('La comida está horrible', allRoasts, 2);
      
      expect(similar).toHaveLength(2);
      expect(similar[0].comment).toContain('comida');
    });
  });
});