/**
 * LLM Transformers Tests
 * Issue #920: Portkey AI Gateway integration
 */

const {
  transformChatCompletion,
  transformEmbedding,
  extractMetadata
} = require('../../../../src/lib/llmClient/transformers');

describe('LLM Transformers', () => {
  describe('transformChatCompletion', () => {
    test('should return OpenAI-compatible response as-is', () => {
      const openAIResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Test response'
            },
            finish_reason: 'stop'
          }
        ],
        usage: { total_tokens: 10 },
        model: 'gpt-5.1'
      };

      const result = transformChatCompletion(openAIResponse);
      expect(result).toEqual(openAIResponse);
    });

    test('should transform Portkey response format', () => {
      const portkeyResponse = {
        content: 'Portkey response',
        usage: { total_tokens: 15 },
        model: 'gpt-5.1',
        _portkey: {
          mode: 'balanceado',
          provider: 'openai'
        }
      };

      const result = transformChatCompletion(portkeyResponse);
      expect(result.choices).toBeDefined();
      expect(result.choices[0].message.content).toBe('Portkey response');
      expect(result.choices[0].message.role).toBe('assistant');
      expect(result.choices[0].finish_reason).toBe('stop');
      expect(result.usage).toEqual({ total_tokens: 15 });
      expect(result.model).toBe('gpt-5.1');
    });

    test('should handle response with content but no choices', () => {
      const response = {
        content: 'Simple response',
        model: 'test-model'
      };

      const result = transformChatCompletion(response);
      expect(result.choices).toBeDefined();
      expect(result.choices[0].message.content).toBe('Simple response');
    });

    test('should return response as-is if no transformation needed', () => {
      const response = {
        data: 'some data'
      };

      const result = transformChatCompletion(response);
      expect(result).toEqual(response);
    });
  });

  describe('transformEmbedding', () => {
    test('should return OpenAI-compatible embedding as-is', () => {
      const openAIEmbedding = {
        data: [
          {
            embedding: [0.1, 0.2, 0.3],
            index: 0
          }
        ],
        usage: { total_tokens: 5 },
        model: 'text-embedding-3-small'
      };

      const result = transformEmbedding(openAIEmbedding);
      expect(result).toEqual(openAIEmbedding);
    });

    test('should transform Portkey embedding format', () => {
      const portkeyEmbedding = {
        embedding: [0.1, 0.2, 0.3],
        usage: { total_tokens: 5 },
        model: 'text-embedding-3-small',
        _portkey: {
          mode: 'default',
          provider: 'openai'
        }
      };

      const result = transformEmbedding(portkeyEmbedding);
      expect(result.data).toBeDefined();
      expect(result.data[0].embedding).toEqual([0.1, 0.2, 0.3]);
      expect(result.data[0].index).toBe(0);
      expect(result.usage).toEqual({ total_tokens: 5 });
      expect(result.model).toBe('text-embedding-3-small');
    });

    test('should return response as-is if no transformation needed', () => {
      const response = {
        other: 'data'
      };

      const result = transformEmbedding(response);
      expect(result).toEqual(response);
    });
  });

  describe('extractMetadata', () => {
    test('should extract Portkey metadata from response', () => {
      const response = {
        _portkey: {
          mode: 'balanceado',
          provider: 'openai',
          fallbackUsed: false,
          metadata: {
            latency: 150,
            cacheHit: true
          }
        }
      };

      const metadata = extractMetadata(response);
      expect(metadata.mode).toBe('balanceado');
      expect(metadata.provider).toBe('openai');
      expect(metadata.fallbackUsed).toBe(false);
      expect(metadata.metadata.latency).toBe(150);
      expect(metadata.metadata.cacheHit).toBe(true);
    });

    test('should return default values when no Portkey metadata', () => {
      const response = {
        choices: [{ message: { content: 'test' } }]
      };

      const metadata = extractMetadata(response);
      expect(metadata.mode).toBe('default');
      expect(metadata.provider).toBe('openai');
      expect(metadata.fallbackUsed).toBe(false);
      expect(metadata.metadata).toEqual({});
    });

    test('should handle partial Portkey metadata', () => {
      const response = {
        _portkey: {
          mode: 'canalla',
          provider: 'grok'
        }
      };

      const metadata = extractMetadata(response);
      expect(metadata.mode).toBe('canalla');
      expect(metadata.provider).toBe('grok');
      expect(metadata.fallbackUsed).toBe(false);
      expect(metadata.metadata).toEqual({});
    });

    test('should handle fallbackUsed flag', () => {
      const response = {
        _portkey: {
          mode: 'nsfw',
          provider: 'openai',
          fallbackUsed: true,
          originalProvider: 'grok'
        }
      };

      const metadata = extractMetadata(response);
      expect(metadata.fallbackUsed).toBe(true);
      expect(metadata.provider).toBe('openai');
    });
  });
});
