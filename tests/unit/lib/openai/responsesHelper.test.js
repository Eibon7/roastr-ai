/**
 * Tests for OpenAI Responses API Helper
 * Issue #858: Prompt caching con GPT-5.1
 */

const { callOpenAIWithCaching } = require('../../../../src/lib/openai/responsesHelper');
const aiUsageLogger = require('../../../../src/services/aiUsageLogger');

// Mock dependencies
jest.mock('../../../../src/services/aiUsageLogger');
jest.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('callOpenAIWithCaching', () => {
  let mockOpenAIClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock OpenAI client
    mockOpenAIClient = {
      responses: {
        create: jest.fn()
      },
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };
    
    // Mock aiUsageLogger
    aiUsageLogger.logUsage = jest.fn().mockResolvedValue(undefined);
  });

  describe('Responses API (when available)', () => {
    test('should use Responses API when input string provided and model supports it', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'test response' } }],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          input_cached_tokens: 80,
          total_tokens: 150
        }
      };
      
      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);
      
      const result = await callOpenAIWithCaching(mockOpenAIClient, {
        model: 'gpt-5.1',
        input: 'test prompt',
        max_tokens: 150,
        temperature: 0.8,
        prompt_cache_retention: '24h',
        loggingContext: {
          userId: 'user-123',
          plan: 'pro',
          endpoint: 'roast'
        }
      });
      
      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith({
        model: 'gpt-5.1',
        input: 'test prompt',
        prompt_cache_retention: '24h',
        max_tokens: 150,
        temperature: 0.8
      });
      
      expect(result.content).toBe('test response');
      expect(result.usage.input_cached_tokens).toBe(80);
      expect(result.method).toBe('responses_api');
    });

    test('should extract cached tokens from Responses API', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'response' } }],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          input_cached_tokens: 90,
          total_tokens: 150
        }
      };
      
      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);
      
      const result = await callOpenAIWithCaching(mockOpenAIClient, {
        model: 'gpt-5.1',
        input: 'test',
        loggingContext: { userId: 'user-123' }
      });
      
      expect(result.usage.input_cached_tokens).toBe(90);
      expect(aiUsageLogger.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          cachedTokens: 90
        })
      );
    });

    test('should log usage metrics when userId provided', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'response' } }],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          input_cached_tokens: 80
        }
      };
      
      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);
      
      await callOpenAIWithCaching(mockOpenAIClient, {
        model: 'gpt-5.1',
        input: 'test',
        loggingContext: {
          userId: 'user-123',
          plan: 'pro',
          endpoint: 'roast'
        }
      });
      
      expect(aiUsageLogger.logUsage).toHaveBeenCalledWith({
        userId: 'user-123',
        orgId: null,
        model: 'gpt-5.1',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 80,
        plan: 'pro',
        endpoint: 'roast'
      });
    });
  });

  describe('Fallback to chat.completions', () => {
    test('should fallback to chat.completions when Responses API fails', async () => {
      const responsesError = new Error('Responses API not available');
      mockOpenAIClient.responses.create.mockRejectedValue(responsesError);
      
      const chatResponse = {
        choices: [{ message: { content: 'fallback response' } }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      };
      
      mockOpenAIClient.chat.completions.create.mockResolvedValue(chatResponse);
      
      const result = await callOpenAIWithCaching(mockOpenAIClient, {
        model: 'gpt-4o',
        input: 'test prompt',
        loggingContext: { userId: 'user-123' }
      });
      
      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalled();
      expect(result.content).toBe('fallback response');
      expect(result.method).toBe('chat_completions');
    });

    test('should use messages array when provided for chat.completions', async () => {
      const chatResponse = {
        choices: [{ message: { content: 'response' } }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50
        }
      };
      
      mockOpenAIClient.chat.completions.create.mockResolvedValue(chatResponse);
      
      await callOpenAIWithCaching(mockOpenAIClient, {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'system prompt' },
          { role: 'user', content: 'user message' }
        ],
        loggingContext: { userId: 'user-123' }
      });
      
      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'system', content: 'system prompt' },
            { role: 'user', content: 'user message' }
          ])
        })
      );
    });

    test('should convert input string to messages when Responses API not available', async () => {
      const chatResponse = {
        choices: [{ message: { content: 'response' } }],
        usage: { prompt_tokens: 100, completion_tokens: 50 }
      };
      
      mockOpenAIClient.responses = undefined; // Responses API not available
      mockOpenAIClient.chat.completions.create.mockResolvedValue(chatResponse);
      
      await callOpenAIWithCaching(mockOpenAIClient, {
        model: 'gpt-4o',
        input: 'test prompt',
        loggingContext: { userId: 'user-123' }
      });
      
      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'system', content: 'test prompt' }
          ])
        })
      );
    });
  });

  describe('Error handling', () => {
    test('should throw error when both APIs fail', async () => {
      const error = new Error('API failure');
      mockOpenAIClient.responses.create.mockRejectedValue(error);
      mockOpenAIClient.chat.completions.create.mockRejectedValue(error);
      
      await expect(callOpenAIWithCaching(mockOpenAIClient, {
        model: 'gpt-5.1',
        input: 'test',
        loggingContext: { userId: 'user-123' }
      })).rejects.toThrow('API failure');
    });

    test('should not log usage when logging fails', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'response' } }],
        usage: { input_tokens: 100, output_tokens: 50 }
      };
      
      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);
      aiUsageLogger.logUsage.mockRejectedValue(new Error('Logging failed'));
      
      // Should not throw, just log error
      const result = await callOpenAIWithCaching(mockOpenAIClient, {
        model: 'gpt-5.1',
        input: 'test',
        loggingContext: { userId: 'user-123' }
      });
      
      expect(result.content).toBe('response');
    });
  });

  describe('Usage extraction', () => {
    test('should handle different usage formats from Responses API', async () => {
      const formats = [
        { input_tokens: 100, output_tokens: 50, input_cached_tokens: 80 },
        { prompt_tokens: 100, completion_tokens: 50, input_cached_tokens: 80 }
      ];
      
      for (const usage of formats) {
        const mockResponse = {
          choices: [{ message: { content: 'response' } }],
          usage
        };
        
        mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);
        
        const result = await callOpenAIWithCaching(mockOpenAIClient, {
          model: 'gpt-5.1',
          input: 'test',
          loggingContext: { userId: 'user-123' }
        });
        
        expect(result.usage.input_tokens).toBeGreaterThan(0);
        expect(result.usage.output_tokens).toBeGreaterThan(0);
      }
    });

    test('should default to 0 for missing usage fields', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'response' } }],
        usage: {}
      };
      
      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse);
      
      const result = await callOpenAIWithCaching(mockOpenAIClient, {
        model: 'gpt-5.1',
        input: 'test',
        loggingContext: { userId: 'user-123' }
      });
      
      expect(result.usage.input_tokens).toBe(0);
      expect(result.usage.output_tokens).toBe(0);
      expect(result.usage.input_cached_tokens).toBe(0);
    });
  });
});

