const ShieldService = require('../../../src/services/shieldService');
const { createMockModerationInput, simulateToxicComment, setupTestUserWithPersona } = require('../../utils/testHelpers');

describe('ShieldService - Edge Cases', () => {
  let shieldService;

  beforeEach(() => {
    shieldService = new ShieldService();
    jest.clearAllMocks();
  });

  describe('Batch Processing Limits', () => {
    it('should handle batch limit when processing multiple comments', async () => {
      const comments = Array(150).fill(null).map((_, index) => 
        createMockModerationInput({
          commentId: `comment-${index}`,
          toxicityScore: 0.9
        })
      );

      const results = await shieldService.analyzeBatch(comments);
      
      expect(results).toHaveLength(100); // Should respect batch limit
      expect(results[0].processed).toBe(true);
    });

    it('should process remaining comments in next batch', async () => {
      const comments = Array(150).fill(null).map((_, index) => 
        createMockModerationInput({
          commentId: `comment-${index}`,
          toxicityScore: 0.9
        })
      );

      const batch1 = await shieldService.analyzeBatch(comments.slice(0, 100));
      const batch2 = await shieldService.analyzeBatch(comments.slice(100));
      
      expect(batch1).toHaveLength(100);
      expect(batch2).toHaveLength(50);
    });
  });

  describe('Invalid Tone Configuration', () => {
    it('should handle missing tone configuration gracefully', async () => {
      const input = createMockModerationInput({
        userConfig: null
      });

      const result = await shieldService.analyzeComment(input);
      
      expect(result.processed).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle corrupted tone configuration', async () => {
      const input = createMockModerationInput({
        userConfig: {
          tone: 123, // Invalid type
          humor_type: null,
          intensity_level: 'high' // Should be number
        }
      });

      const result = await shieldService.analyzeComment(input);
      
      expect(result.processed).toBe(true);
      expect(result.fallbackUsed).toBe(true);
    });

    it('should apply default configuration when user config fails validation', async () => {
      const input = createMockModerationInput({
        userConfig: {
          tone: Array(1000).fill('x').join(''), // Extremely long string
          intensity_level: -999
        }
      });

      const result = await shieldService.analyzeComment(input);
      
      expect(result.processed).toBe(true);
      expect(result.configUsed).toEqual(expect.objectContaining({
        tone: 'professional',
        intensity_level: 3
      }));
    });
  });

  describe('Queue Full Scenarios', () => {
    it('should handle queue full error and retry with backoff', async () => {
      const mockQueueService = {
        add: jest.fn()
          .mockRejectedValueOnce(new Error('Queue is full'))
          .mockResolvedValueOnce({ id: 'job123' })
      };

      shieldService.queueService = mockQueueService;

      const input = createMockModerationInput();
      const result = await shieldService.queueAction(input, 'block');

      expect(mockQueueService.add).toHaveBeenCalledTimes(2);
      expect(result.queued).toBe(true);
      expect(result.retries).toBe(1);
    });

    it('should fail after max retries when queue remains full', async () => {
      const mockQueueService = {
        add: jest.fn().mockRejectedValue(new Error('Queue is full'))
      };

      shieldService.queueService = mockQueueService;

      const input = createMockModerationInput();
      const result = await shieldService.queueAction(input, 'block');

      expect(mockQueueService.add).toHaveBeenCalledTimes(3); // Max retries
      expect(result.queued).toBe(false);
      expect(result.error).toContain('Queue is full');
    });
  });

  describe('Extreme Toxicity Scenarios', () => {
    it('should auto-escalate to report for extreme toxicity', async () => {
      const { comment, toxicityScore } = simulateToxicComment({
        toxicityLevel: 'extreme',
        categories: ['TOXICITY', 'THREAT', 'SEVERE_TOXICITY']
      });

      const input = createMockModerationInput({
        originalComment: comment,
        toxicityScore,
        toxicityCategories: ['TOXICITY', 'THREAT', 'SEVERE_TOXICITY']
      });

      const result = await shieldService.analyzeComment(input);
      
      expect(result.action).toBe('report');
      expect(result.autoEscalated).toBe(true);
      expect(result.priority).toBe(1);
    });

    it('should handle multi-language extreme toxicity', async () => {
      const languages = ['es', 'en'];
      
      for (const language of languages) {
        const { comment, toxicityScore } = simulateToxicComment({
          toxicityLevel: 'extreme',
          language
        });

        const input = createMockModerationInput({
          originalComment: comment,
          toxicityScore,
          language
        });

        const result = await shieldService.analyzeComment(input);
        
        expect(result.action).toBe('report');
        expect(result.language).toBe(language);
      }
    });
  });

  describe('Persona Integration Edge Cases', () => {
    it('should handle persona with empty tolerance lists', async () => {
      const { user, persona } = setupTestUserWithPersona({
        toleranceSettings: {
          no_tolero: [],
          lo_que_me_da_igual: [],
          auto_block_enabled: true
        }
      });

      const input = createMockModerationInput({
        userId: user.id,
        userPersona: persona
      });

      const result = await shieldService.analyzeWithPersona(input);
      
      expect(result.processed).toBe(true);
      expect(result.personaApplied).toBe(true);
    });

    it('should handle persona with conflicting rules', async () => {
      const { user, persona } = setupTestUserWithPersona({
        toleranceSettings: {
          no_tolero: ['politics', 'insults'],
          lo_que_me_da_igual: ['politics'], // Conflicting
          auto_block_enabled: true
        }
      });

      const input = createMockModerationInput({
        userId: user.id,
        userPersona: persona,
        originalComment: 'Your political views are stupid',
        toxicityCategories: ['INSULT', 'POLITICS']
      });

      const result = await shieldService.analyzeWithPersona(input);
      
      expect(result.conflictResolution).toBe('no_tolero_takes_precedence');
      expect(result.action).toBe('block');
    });
  });

  describe('Performance and Resource Limits', () => {
    it('should timeout long-running analysis', async () => {
      const slowAnalysis = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000))
      );

      shieldService.analyzeCommentWithTimeout = async (input, timeout = 5000) => {
        const timer = setTimeout(() => {
          throw new Error('Analysis timeout');
        }, timeout);

        try {
          await slowAnalysis();
          clearTimeout(timer);
        } catch (error) {
          clearTimeout(timer);
          return { processed: false, error: error.message, timedOut: true };
        }
      };

      const input = createMockModerationInput();
      const result = await shieldService.analyzeCommentWithTimeout(input);
      
      expect(result.timedOut).toBe(true);
      expect(result.error).toContain('timeout');
    });

    it('should handle memory pressure gracefully', async () => {
      // Simulate large payload
      const largeComment = 'x'.repeat(10000);
      const input = createMockModerationInput({
        originalComment: largeComment,
        metadata: {
          largeArray: Array(1000).fill({ data: 'test'.repeat(100) })
        }
      });

      const result = await shieldService.analyzeComment(input);
      
      expect(result.processed).toBe(true);
      expect(result.truncated).toBe(true);
      expect(result.originalLength).toBe(10000);
    });
  });

  describe('Concurrent Processing', () => {
    it('should handle concurrent analysis requests', async () => {
      const inputs = Array(10).fill(null).map((_, i) => 
        createMockModerationInput({ commentId: `concurrent-${i}` })
      );

      const results = await Promise.all(
        inputs.map(input => shieldService.analyzeComment(input))
      );

      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.processed).toBe(true);
        expect(result.commentId).toBe(`concurrent-${index}`);
      });
    });

    it('should maintain isolation between concurrent requests', async () => {
      const input1 = createMockModerationInput({
        commentId: 'user1',
        userConfig: { tone: 'aggressive' }
      });

      const input2 = createMockModerationInput({
        commentId: 'user2',
        userConfig: { tone: 'friendly' }
      });

      const [result1, result2] = await Promise.all([
        shieldService.analyzeComment(input1),
        shieldService.analyzeComment(input2)
      ]);

      expect(result1.configUsed.tone).toBe('aggressive');
      expect(result2.configUsed.tone).toBe('friendly');
    });
  });

  describe('Error Recovery', () => {
    it('should recover from database connection errors', async () => {
      const mockDb = {
        query: jest.fn()
          .mockRejectedValueOnce(new Error('Connection lost'))
          .mockResolvedValueOnce({ rows: [] })
      };

      shieldService.db = mockDb;

      const input = createMockModerationInput();
      const result = await shieldService.analyzeComment(input);

      expect(result.processed).toBe(true);
      expect(result.dbRetries).toBe(1);
    });

    it('should handle cascading failures gracefully', async () => {
      const mockServices = {
        perspective: jest.fn().mockRejectedValue(new Error('Perspective API down')),
        openai: jest.fn().mockRejectedValue(new Error('OpenAI API down')),
        fallback: jest.fn().mockResolvedValue({ score: 0.5 })
      };

      shieldService.analyzers = mockServices;

      const input = createMockModerationInput();
      const result = await shieldService.analyzeComment(input);

      expect(result.processed).toBe(true);
      expect(result.fallbackChain).toEqual(['perspective', 'openai', 'fallback']);
      expect(result.finalAnalyzer).toBe('fallback');
    });
  });
});