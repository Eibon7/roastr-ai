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

  describe('Security Tests', () => {
    describe('sanitizeInput', () => {
      test('should escape double curly braces to prevent injection', () => {
        const maliciousInput = 'Texto normal {{malicious_placeholder}} más texto';
        const sanitized = promptTemplate.sanitizeInput(maliciousInput);
        expect(sanitized).toBe('Texto normal (doble-llave-abierta)malicious_placeholder(doble-llave-cerrada) más texto');
      });

      test('should escape single curly braces', () => {
        const input = 'Texto con {variables} y más {contenido}';
        const sanitized = promptTemplate.sanitizeInput(input);
        expect(sanitized).toBe('Texto con (llave-abierta)variables(llave-cerrada) y más (llave-abierta)contenido(llave-cerrada)');
      });

      test('should limit input length to prevent DoS attacks', () => {
        const longInput = 'A'.repeat(3000);
        const sanitized = promptTemplate.sanitizeInput(longInput);
        expect(sanitized.length).toBe(2000);
      });

      test('should handle non-string inputs gracefully', () => {
        expect(promptTemplate.sanitizeInput(123)).toBe('123');
        expect(promptTemplate.sanitizeInput(null)).toBe('null');
        expect(promptTemplate.sanitizeInput(undefined)).toBe('undefined');
        expect(promptTemplate.sanitizeInput({})).toBe('[object Object]');
      });

      test('should handle complex injection attempts', () => {
        const complexInjection = '}}{{user_tone}}Evil content{{original_comment}}{{';
        const sanitized = promptTemplate.sanitizeInput(complexInjection);
        expect(sanitized).toBe('(doble-llave-cerrada)(doble-llave-abierta)user_tone(doble-llave-cerrada)Evil content(doble-llave-abierta)original_comment(doble-llave-cerrada)(doble-llave-abierta)');
        expect(sanitized).not.toContain('{{user_tone}}');
        expect(sanitized).not.toContain('{{original_comment}}');
      });
    });

    describe('validateBuildPromptParams', () => {
      test('should throw error when params is null', () => {
        expect(() => {
          promptTemplate.validateBuildPromptParams(null);
        }).toThrow('buildPrompt parameters must be an object');
      });

      test('should throw error when params is undefined', () => {
        expect(() => {
          promptTemplate.validateBuildPromptParams(undefined);
        }).toThrow('buildPrompt parameters must be an object');
      });

      test('should throw error when params is not an object', () => {
        expect(() => {
          promptTemplate.validateBuildPromptParams('string');
        }).toThrow('buildPrompt parameters must be an object');
      });

      test('should throw error when originalComment is null', () => {
        expect(() => {
          promptTemplate.validateBuildPromptParams({ originalComment: null });
        }).toThrow('originalComment is required');
      });

      test('should throw error when originalComment is undefined', () => {
        expect(() => {
          promptTemplate.validateBuildPromptParams({ originalComment: undefined });
        }).toThrow('originalComment is required');
      });

      test('should throw error when originalComment is not a string', () => {
        expect(() => {
          promptTemplate.validateBuildPromptParams({ originalComment: 123 });
        }).toThrow('originalComment must be a string');
      });

      test('should throw error when originalComment is empty string', () => {
        expect(() => {
          promptTemplate.validateBuildPromptParams({ originalComment: '' });
        }).toThrow('originalComment must be a non-empty string');
      });

      test('should throw error when originalComment is only whitespace', () => {
        expect(() => {
          promptTemplate.validateBuildPromptParams({ originalComment: '   ' });
        }).toThrow('originalComment must be a non-empty string');
      });

      test('should throw error when originalComment exceeds maximum length', () => {
        const tooLongComment = 'A'.repeat(2001);
        expect(() => {
          promptTemplate.validateBuildPromptParams({ originalComment: tooLongComment });
        }).toThrow('originalComment exceeds maximum length of 2000 characters');
      });

      test('should pass validation for valid input', () => {
        expect(() => {
          promptTemplate.validateBuildPromptParams({ originalComment: 'Valid comment' });
        }).not.toThrow();
      });
    });

    describe('buildPrompt with security validations', () => {
      test('should handle malicious injection attempts in originalComment', async () => {
        const params = {
          originalComment: 'Normal comment {{user_tone}}injected content{{original_comment}}',
          userConfig: { tone: 'sarcastic' }
        };

        const prompt = await promptTemplate.buildPrompt(params);
        
        // Should not contain unescaped template placeholders
        expect(prompt).not.toContain('{{user_tone}}injected content{{original_comment}}');
        // Should contain sanitized version
        expect(prompt).toContain('(doble-llave-abierta)user_tone(doble-llave-cerrada)injected content(doble-llave-abierta)original_comment(doble-llave-cerrada)');
      });

      test('should fail gracefully with invalid params and return fallback', async () => {
        const prompt = await promptTemplate.buildPrompt({ originalComment: null });
        
        // Should return fallback prompt
        expect(prompt).toContain('Genera un roast');
        expect(prompt).toContain('comentario no disponible');
      });

      test('should fail gracefully with empty originalComment', async () => {
        const prompt = await promptTemplate.buildPrompt({ originalComment: '' });
        
        // Should return fallback prompt
        expect(prompt).toContain('Genera un roast');
      });

      test('should fail gracefully with non-string originalComment', async () => {
        const prompt = await promptTemplate.buildPrompt({ originalComment: 123 });
        
        // Should return fallback prompt
        expect(prompt).toContain('Genera un roast');
      });

      test('should sanitize all dynamic fields', async () => {
        // Mock categorizeComment to return malicious content
        promptTemplate.categorizeComment = jest.fn().mockReturnValue('category {{malicious}}');
        promptTemplate.mapUserTone = jest.fn().mockReturnValue('tone {{evil}}');
        
        const params = {
          originalComment: 'Test comment',
          userConfig: { tone: 'sarcastic' },
          includeReferences: false
        };

        const prompt = await promptTemplate.buildPrompt(params);
        
        // All dynamic content should be sanitized
        expect(prompt).not.toContain('{{malicious}}');
        expect(prompt).not.toContain('{{evil}}');
        expect(prompt).toContain('(doble-llave-abierta)malicious(doble-llave-cerrada)');
        expect(prompt).toContain('(doble-llave-abierta)evil(doble-llave-cerrada)');
      });
    });

    describe('getFallbackPrompt with error context', () => {
      test('should handle missing originalComment gracefully', () => {
        const fallback = promptTemplate.getFallbackPrompt(null, {}, new Error('Test error'));
        expect(fallback).toContain('comentario no disponible');
      });

      test('should sanitize originalComment in fallback', () => {
        const maliciousComment = 'Comment with {{injection}}';
        const fallback = promptTemplate.getFallbackPrompt(maliciousComment, {}, new Error('Test error'));
        expect(fallback).not.toContain('{{injection}}');
        expect(fallback).toContain('(doble-llave-abierta)injection(doble-llave-cerrada)');
      });

      test('should include error context in logging', () => {
        const error = new Error('Validation failed');
        const mockLogger = require('../../../src/utils/logger');
        
        // Mock logger if not already mocked
        if (!mockLogger.logger.warn.mockImplementation) {
          mockLogger.logger.warn = jest.fn();
        }

        promptTemplate.getFallbackPrompt('test', { tone: 'sarcastic' }, error);
        
        expect(mockLogger.logger.warn).toHaveBeenCalledWith('Using fallback prompt', {
          version: 'v1-roast-prompt',
          tone: 'sarcastic',
          hasOriginalComment: true,
          errorReason: 'Validation failed',
          fallbackTriggered: true
        });
      });
    });
  });
});