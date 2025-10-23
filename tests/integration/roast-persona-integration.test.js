/**
 * Integration tests for Persona + Roast Generation integration (Issue #615)
 * Tests the complete flow from PersonaService → RoastGeneratorEnhanced → RoastPromptTemplate
 *
 * Verifies:
 * - Full persona integration (Pro+ plan with 3 fields)
 * - Partial persona integration (Starter plan with 2 fields)
 * - No persona (Free plan blocked)
 * - Null persona handling (graceful degradation)
 * - End-to-end data flow through all layers
 */

// Mock OpenAI SDK BEFORE importing services
const mockCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate
      }
    },
    models: {
      list: jest.fn().mockResolvedValue({
        data: [
          { id: 'gpt-4o-mini', created: 1677649963, object: 'model', owned_by: 'openai' },
          { id: 'gpt-4', created: 1687882411, object: 'model', owned_by: 'openai' }
        ]
      })
    }
  }));
});

jest.mock('../../src/services/csvRoastService', () => {
  return jest.fn().mockImplementation(() => ({
    loadRoasts: jest.fn().mockResolvedValue([
      { comment: 'Test comment 1', roast: 'Test roast 1' },
      { comment: 'Test comment 2', roast: 'Test roast 2' },
      { comment: 'Test comment 3', roast: 'Test roast 3' }
    ]),
    getReferenceRoasts: jest.fn().mockReturnValue(['Ref 1', 'Ref 2', 'Ref 3']),
    loadCsvData: jest.fn().mockResolvedValue(undefined)
  }));
});

jest.mock('../../src/services/costControl', () => ({
  trackUsage: jest.fn().mockResolvedValue(undefined),
  checkLimit: jest.fn().mockResolvedValue({ allowed: true })
}));

jest.mock('../../src/utils/featureFlags', () => ({
  isEnabled: jest.fn().mockReturnValue(false),
  initialize: jest.fn(),
}));

const RoastGeneratorEnhanced = require('../../src/services/roastGeneratorEnhanced');
const PersonaService = require('../../src/services/PersonaService');
const RoastPromptTemplate = require('../../src/services/roastPromptTemplate');

describe('Roast-Persona Integration (Issue #615)', () => {
  let roastGenerator;
  let promptTemplate;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default OpenAI mock for all tests
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Mock roast response' } }],
      usage: { prompt_tokens: 100, completion_tokens: 20 },
      model: 'gpt-4o-mini'
    });

    roastGenerator = new RoastGeneratorEnhanced();
    promptTemplate = new RoastPromptTemplate();
  });

  describe('Full Persona Integration (Pro+ Plan - 3 fields)', () => {
    test('should include all 3 persona fields in generated prompt', async () => {
      // Mock PersonaService to return full persona
      const mockPersona = {
        lo_que_me_define: 'Soy un desarrollador senior con 10 años de experiencia',
        lo_que_no_tolero: 'Comentarios racistas, sexistas o discriminatorios',
        lo_que_me_da_igual: 'Críticas a mi código si son constructivas'
      };

      jest.spyOn(PersonaService, 'getPersona').mockResolvedValue(mockPersona);

      // Build prompt manually to verify persona injection
      const prompt = await promptTemplate.buildPrompt({
        originalComment: 'Este código es horrible',
        toxicityData: { score: 0.6, categories: ['insult'] },
        userConfig: { tone: 'sarcastic' },
        includeReferences: true,
        persona: mockPersona
      });

      // Verify all 3 persona fields are present in prompt
      expect(prompt).toContain('🎯 CONTEXTO DEL USUARIO:');
      expect(prompt).toContain('- Lo que define al usuario: Soy un desarrollador senior con 10 años de experiencia');
      expect(prompt).toContain('- Lo que NO tolera: Comentarios racistas, sexistas o discriminatorios');
      expect(prompt).toContain('- Lo que le da igual: Críticas a mi código si son constructivas');

      // Verify persona placeholder replaced
      expect(prompt).not.toContain('{{persona_context}}');
    });

    test('should generate roast with persona context (Pro+ plan)', async () => {
      const mockPersona = {
        lo_que_me_define: 'Soy profesor universitario',
        lo_que_no_tolero: 'Faltas de respeto injustificadas',
        lo_que_me_da_igual: 'Opiniones sin fundamento'
      };

      // Override personaService.getPersona for roastGenerator
      roastGenerator.personaService.getPersona = jest.fn().mockResolvedValue(mockPersona);

      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Tu comentario necesita una clase de lógica básica.' } }],
        usage: { prompt_tokens: 120, completion_tokens: 25 },
        model: 'gpt-4o-mini'
      });

      const result = await roastGenerator.generateWithBasicModeration(
        'Esta universidad es mala',
        0.5,
        'sarcastic',
        {
          plan: 'pro',
          user_id: 'test-user-123',
          humor_type: 'witty',
          intensity_level: 'medium'
        }
      );

      // Verify PersonaService was called
      expect(roastGenerator.personaService.getPersona).toHaveBeenCalledWith('test-user-123');

      // Verify OpenAI was called
      expect(mockCreate).toHaveBeenCalled();

      // Get the prompt that was sent to OpenAI
      const calledPrompt = mockCreate.mock.calls[0][0].messages[0].content;

      // Verify persona context is in the prompt
      expect(calledPrompt).toContain('🎯 CONTEXTO DEL USUARIO:');
      expect(calledPrompt).toContain('- Lo que define al usuario: Soy profesor universitario');
      expect(calledPrompt).toContain('- Lo que NO tolera: Faltas de respeto injustificadas');
      expect(calledPrompt).toContain('- Lo que le da igual: Opiniones sin fundamento');

      // Verify result structure (returns string directly)
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toBe('Tu comentario necesita una clase de lógica básica.');
    });
  });

  describe('Partial Persona Integration (Starter Plan - 2 fields)', () => {
    test('should include only 2 persona fields (Starter plan)', async () => {
      const mockPersona = {
        lo_que_me_define: 'Soy médico',
        lo_que_no_tolero: 'Desinformación médica'
        // lo_que_me_da_igual: Not set (Starter plan restriction)
      };

      const prompt = await promptTemplate.buildPrompt({
        originalComment: 'Las vacunas causan autismo',
        toxicityData: { score: 0.8, categories: ['misinformation'] },
        userConfig: { tone: 'serious' },
        includeReferences: true,
        persona: mockPersona
      });

      // Verify only 2 fields present
      expect(prompt).toContain('🎯 CONTEXTO DEL USUARIO:');
      expect(prompt).toContain('- Lo que define al usuario: Soy médico');
      expect(prompt).toContain('- Lo que NO tolera: Desinformación médica');

      // Verify 3rd field NOT present
      expect(prompt).not.toContain('Lo que le da igual');
    });
  });

  describe('No Persona (Free Plan - Blocked)', () => {
    test('should handle null persona gracefully (Free plan)', async () => {
      // Override personaService to return null (Free plan blocked)
      roastGenerator.personaService.getPersona = jest.fn().mockResolvedValue(null);

      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Comentario genérico de respuesta.' } }],
        usage: { prompt_tokens: 80, completion_tokens: 15 },
        model: 'gpt-4o-mini'
      });

      const result = await roastGenerator.generateWithBasicModeration(
        'Esto es malo',
        0.4,
        'sarcastic',
        {
          plan: 'free',
          user_id: 'free-user-123',
          humor_type: 'witty',
          intensity_level: 'low'
        }
      );

      // Verify PersonaService was called
      expect(roastGenerator.personaService.getPersona).toHaveBeenCalledWith('free-user-123');

      // Get the prompt sent to OpenAI
      const calledPrompt = mockCreate.mock.calls[0][0].messages[0].content;

      // Verify persona section shows "No especificado"
      expect(calledPrompt).toContain('🎯 CONTEXTO DEL USUARIO:');
      expect(calledPrompt).toContain('No especificado');

      // Verify result structure (returns string directly)
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toBe('Comentario genérico de respuesta.');
    });

    test('should show "No especificado" when persona is null', async () => {
      const prompt = await promptTemplate.buildPrompt({
        originalComment: 'Test comment',
        toxicityData: { score: 0.3 },
        userConfig: { tone: 'witty' },
        includeReferences: false,
        persona: null // Free plan or no persona set
      });

      expect(prompt).toContain('🎯 CONTEXTO DEL USUARIO:');
      expect(prompt).toContain('No especificado');
      expect(prompt).not.toContain('{{persona_context}}');
    });
  });

  describe('Error Handling & Edge Cases', () => {
    test('should handle PersonaService errors gracefully', async () => {
      // Mock PersonaService to throw error
      roastGenerator.personaService.getPersona = jest.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      // Should throw error (no silent failure for DB errors)
      await expect(
        roastGenerator.generateWithBasicModeration(
          'Test comment',
          0.5,
          'sarcastic',
          {
            plan: 'pro',
            user_id: 'error-user',
            humor_type: 'clever',
            intensity_level: 'medium'
          }
        )
      ).rejects.toThrow('Database connection failed');
    });

    test('should handle empty persona object', async () => {
      const emptyPersona = {}; // All fields missing

      const prompt = await promptTemplate.buildPrompt({
        originalComment: 'Empty persona test',
        toxicityData: { score: 0.5 },
        userConfig: { tone: 'sarcastic' },
        includeReferences: false,
        persona: emptyPersona
      });

      // Should show "No especificado" for empty persona
      expect(prompt).toContain('🎯 CONTEXTO DEL USUARIO:');
      expect(prompt).toContain('No especificado');
    });

    test('should sanitize persona content to prevent injection', async () => {
      const maliciousPersona = {
        lo_que_me_define: 'Soy {{hacker}} que intenta {{injection}}',
        lo_que_no_tolero: 'Nada con {{placeholders}}',
        lo_que_me_da_igual: 'Todo {{esto}}'
      };

      const prompt = await promptTemplate.buildPrompt({
        originalComment: 'Injection test',
        toxicityData: { score: 0.5 },
        userConfig: { tone: 'witty' },
        includeReferences: false,
        persona: maliciousPersona
      });

      // Verify curly braces are escaped
      expect(prompt).toContain('Lo que define al usuario');
      expect(prompt).not.toContain('{{hacker}}');
      expect(prompt).not.toContain('{{injection}}');
      expect(prompt).not.toContain('{{placeholders}}');

      // Should contain escaped versions
      expect(prompt).toContain('hacker'); // Content preserved, braces escaped
      expect(prompt).toContain('injection');
    });
  });

  describe('End-to-End Integration', () => {
    test('should complete full flow: PersonaService → RoastGenerator → Prompt → OpenAI', async () => {
      const mockPersona = {
        lo_que_me_define: 'Soy ingeniero de software',
        lo_que_no_tolero: 'Código sin tests',
        lo_que_me_da_igual: 'Debates sobre tabs vs spaces'
      };

      roastGenerator.personaService.getPersona = jest.fn().mockResolvedValue(mockPersona);

      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Tu código es tan frágil como tus argumentos.' } }],
        usage: { prompt_tokens: 150, completion_tokens: 30 },
        model: 'gpt-4o-mini'
      });

      // Execute full generation flow
      const result = await roastGenerator.generateWithBasicModeration(
        'Los tests son una pérdida de tiempo',
        0.7,
        'sarcastic',
        {
          plan: 'pro',
          user_id: 'test-engineer-456',
          humor_type: 'witty',
          intensity_level: 'high'
        }
      );

      // Verify full flow executed
      expect(roastGenerator.personaService.getPersona).toHaveBeenCalledWith('test-engineer-456');
      expect(mockCreate).toHaveBeenCalled();

      // Verify prompt contains persona
      const calledPrompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(calledPrompt).toContain('🎯 CONTEXTO DEL USUARIO:');
      expect(calledPrompt).toContain('ingeniero de software');
      expect(calledPrompt).toContain('Código sin tests');
      expect(calledPrompt).toContain('tabs vs spaces');

      // Verify final result (returns string directly)
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toBe('Tu código es tan frágil como tus argumentos.');
    });
  });
});
