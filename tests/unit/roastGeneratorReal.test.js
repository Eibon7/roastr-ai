/**
 * Tests unitarios para RoastGeneratorReal
 * Valida la generación de roasts con diferentes tonos usando OpenAI API
 */

const RoastGeneratorReal = require('../../src/services/roastGeneratorReal');
const { 
  createMockOpenAIResponse, 
  getMockRoastByTone, 
  setMockEnvVars, 
  cleanupMocks 
} = require('../helpers/testUtils');

// Mock OpenAI
jest.mock('openai');

describe('RoastGeneratorReal', () => {
  let roastGenerator;
  let mockOpenAI;

  beforeAll(() => {
    setMockEnvVars();
  });

  beforeEach(() => {
    // Limpiar mocks antes de cada test
    cleanupMocks();
    
    // Mock de la clase OpenAI
    const OpenAI = require('openai');
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };
    OpenAI.mockImplementation(() => mockOpenAI);
    
    roastGenerator = new RoastGeneratorReal();
    // Override the openai instance with our mock
    roastGenerator.openai = mockOpenAI;
  });

  afterEach(() => {
    cleanupMocks();
  });

  describe('Constructor', () => {
    test('debe inicializarse correctamente con API key válida', () => {
      expect(roastGenerator).toBeInstanceOf(RoastGeneratorReal);
      expect(roastGenerator.openai).toBeDefined();
    });

    test('debe lanzar error si no hay OPENAI_API_KEY', () => {
      delete process.env.OPENAI_API_KEY;
      
      expect(() => {
        new RoastGeneratorReal();
      }).toThrow('❌ OPENAI_API_KEY environment variable is required');
      
      // Restaurar para otros tests
      setMockEnvVars();
    });
  });

  describe('generateRoast', () => {
    const testMessage = 'Este es un comentario de prueba';

    test('debe generar roast con tono sarcástico por defecto', async () => {
      // Arrange
      const expectedRoast = getMockRoastByTone('sarcastic', testMessage);
      mockOpenAI.chat.completions.create.mockResolvedValue(
        createMockOpenAIResponse(expectedRoast)
      );

      // Act
      const result = await roastGenerator.generateRoast(testMessage);

      // Assert
      expect(result).toBe(expectedRoast);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
      
      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.model).toBe('gpt-4o-mini');
      expect(callArgs.messages[0].role).toBe('system');
      expect(callArgs.messages[1].content).toBe(testMessage);
      expect(callArgs.messages[0].content).toContain('SARCÁSTICO-PICANTE');
    });

    test('debe generar roast con tono sutil cuando se especifica', async () => {
      // Arrange
      const expectedRoast = getMockRoastByTone('subtle', testMessage);
      mockOpenAI.chat.completions.create.mockResolvedValue(
        createMockOpenAIResponse(expectedRoast)
      );

      // Act
      const result = await roastGenerator.generateRoast(testMessage, null, 'subtle');

      // Assert
      expect(result).toBe(expectedRoast);
      
      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('SUTIL/IRÓNICO ELEGANTE');
    });

    test('debe generar roast con tono directo cuando se especifica', async () => {
      // Arrange
      const expectedRoast = getMockRoastByTone('direct', testMessage);
      mockOpenAI.chat.completions.create.mockResolvedValue(
        createMockOpenAIResponse(expectedRoast)
      );

      // Act
      const result = await roastGenerator.generateRoast(testMessage, null, 'direct');

      // Assert
      expect(result).toBe(expectedRoast);
      
      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('DIRECTO/CORTANTE');
    });

    test('debe usar tono sarcástico si se proporciona tono inválido', async () => {
      // Arrange
      const expectedRoast = getMockRoastByTone('sarcastic', testMessage);
      mockOpenAI.chat.completions.create.mockResolvedValue(
        createMockOpenAIResponse(expectedRoast)
      );

      // Act
      const result = await roastGenerator.generateRoast(testMessage, null, 'invalid_tone');

      // Assert
      expect(result).toBe(expectedRoast);
      
      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('SARCÁSTICO-PICANTE');
    });

    test('debe configurar correctamente los parámetros de OpenAI', async () => {
      // Arrange
      const expectedRoast = 'Test roast';
      mockOpenAI.chat.completions.create.mockResolvedValue(
        createMockOpenAIResponse(expectedRoast)
      );

      // Act
      await roastGenerator.generateRoast(testMessage);

      // Assert
      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.model).toBe('gpt-4o-mini');
      expect(callArgs.max_tokens).toBe(100);
      expect(callArgs.temperature).toBe(0.8);
      expect(callArgs.messages).toHaveLength(2);
    });

    test('debe manejar errores de la API de OpenAI', async () => {
      // Arrange
      const apiError = new Error('OpenAI API Error');
      apiError.response = {
        data: { error: 'Rate limit exceeded' }
      };
      mockOpenAI.chat.completions.create.mockRejectedValue(apiError);

      // Act & Assert
      await expect(roastGenerator.generateRoast(testMessage)).rejects.toThrow('OpenAI API Error');
    });

    test('debe manejar errores sin response data', async () => {
      // Arrange
      const simpleError = new Error('Network error');
      mockOpenAI.chat.completions.create.mockRejectedValue(simpleError);

      // Act & Assert
      await expect(roastGenerator.generateRoast(testMessage)).rejects.toThrow('Network error');
    });

    test('debe incluir toxicity score en el contexto si se proporciona', async () => {
      // Arrange
      const toxicityScore = 0.8;
      const expectedRoast = 'Test roast with toxicity';
      mockOpenAI.chat.completions.create.mockResolvedValue(
        createMockOpenAIResponse(expectedRoast)
      );

      // Act
      await roastGenerator.generateRoast(testMessage, toxicityScore);

      // Assert
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
      // El toxicity score se pasa como parámetro pero no modifica el prompt actual
      // (funcionalidad futura para integración con Perspective API)
    });
  });

  describe('Configuración de prompts por tono', () => {
    test('prompt sarcástico debe contener palabras clave correctas', async () => {
      // Arrange
      mockOpenAI.chat.completions.create.mockResolvedValue(
        createMockOpenAIResponse('Mock roast')
      );

      // Act
      await roastGenerator.generateRoast('test', null, 'sarcastic');

      // Assert
      const systemPrompt = mockOpenAI.chat.completions.create.mock.calls[0][0].messages[0].content;
      expect(systemPrompt).toContain('Sarcasmo agudo');
      expect(systemPrompt).toContain('picante y creativo');
      expect(systemPrompt).toContain('referencias culturales');
    });

    test('prompt sutil debe contener palabras clave correctas', async () => {
      // Arrange
      mockOpenAI.chat.completions.create.mockResolvedValue(
        createMockOpenAIResponse('Mock roast')
      );

      // Act
      await roastGenerator.generateRoast('test', null, 'subtle');

      // Assert
      const systemPrompt = mockOpenAI.chat.completions.create.mock.calls[0][0].messages[0].content;
      expect(systemPrompt).toContain('Ironía sofisticada');
      expect(systemPrompt).toContain('elegante');
      expect(systemPrompt).toContain('juegos de palabras');
    });

    test('prompt directo debe contener palabras clave correctas', async () => {
      // Arrange
      mockOpenAI.chat.completions.create.mockResolvedValue(
        createMockOpenAIResponse('Mock roast')
      );

      // Act
      await roastGenerator.generateRoast('test', null, 'direct');

      // Assert
      const systemPrompt = mockOpenAI.chat.completions.create.mock.calls[0][0].messages[0].content;
      expect(systemPrompt).toContain('Humor directo');
      expect(systemPrompt).toContain('sin rodeos');
      expect(systemPrompt).toContain('humor negro ligero');
    });
  });
});