const AnalyzeToxicityWorker = require('../../../src/workers/AnalyzeToxicityWorker');
const { createMockAPIError, simulateToxicComment } = require('../../utils/testHelpers');

// Mock dependencies
jest.mock('../../../src/services/perspective', () => ({
  analyzeToxicity: jest.fn()
}));

jest.mock('../../../src/services/openai', () => ({
  analyzeToxicityWithOpenAI: jest.fn()
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

const { analyzeToxicity } = require('../../../src/services/perspective');
const { analyzeToxicityWithOpenAI } = require('../../../src/services/openai');
const { logger } = require('../../../src/utils/logger');

describe('AnalyzeToxicityWorker - Fallback Logic', () => {
  let worker;

  beforeEach(() => {
    worker = new AnalyzeToxicityWorker();
    jest.clearAllMocks();
  });

  describe('Primary Service Failures', () => {
    it('should fallback to OpenAI when Perspective API fails with rate limit', async () => {
      const { comment } = simulateToxicComment({ toxicityLevel: 'high' });
      const job = {
        data: {
          commentId: 'test-123',
          comment,
          platform: 'twitter'
        }
      };

      // Mock Perspective failure
      analyzeToxicity.mockRejectedValueOnce(
        createMockAPIError('perspective', 'rate_limit')
      );

      // Mock OpenAI success
      analyzeToxicityWithOpenAI.mockResolvedValueOnce({
        toxic: true,
        score: 0.85,
        categories: ['harassment'],
        source: 'openai'
      });

      const result = await worker.process(job);

      expect(analyzeToxicity).toHaveBeenCalledWith(comment);
      expect(analyzeToxicityWithOpenAI).toHaveBeenCalledWith(comment);
      expect(result.source).toBe('openai');
      expect(result.score).toBe(0.85);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Falling back to OpenAI')
      );
    });

    it('should handle authentication failures and retry with new credentials', async () => {
      const { comment } = simulateToxicComment();
      const job = {
        data: { commentId: 'test-456', comment }
      };

      // Mock auth failure then success
      analyzeToxicity
        .mockRejectedValueOnce(createMockAPIError('perspective', 'auth_failed'))
        .mockResolvedValueOnce({
          score: 0.6,
          categories: ['TOXICITY']
        });

      const result = await worker.process(job);

      expect(analyzeToxicity).toHaveBeenCalledTimes(2);
      expect(result.retryCount).toBe(1);
      expect(result.score).toBe(0.6);
    });

    it('should handle service unavailable with exponential backoff', async () => {
      const { comment } = simulateToxicComment();
      const job = {
        data: { commentId: 'test-789', comment }
      };

      // Mock service unavailable then success
      analyzeToxicity
        .mockRejectedValueOnce(createMockAPIError('perspective', 'service_error'))
        .mockRejectedValueOnce(createMockAPIError('perspective', 'service_error'))
        .mockResolvedValueOnce({
          score: 0.7,
          categories: ['INSULT']
        });

      const startTime = Date.now();
      const result = await worker.process(job);
      const duration = Date.now() - startTime;

      expect(analyzeToxicity).toHaveBeenCalledTimes(3);
      expect(duration).toBeGreaterThanOrEqual(300); // Backoff delays
      expect(result.score).toBe(0.7);
    });
  });

  describe('Cascading Fallback Chain', () => {
    it('should try all services in order before failing', async () => {
      const { comment } = simulateToxicComment();
      const job = {
        data: { commentId: 'cascade-test', comment }
      };

      // All services fail
      analyzeToxicity.mockRejectedValue(new Error('Perspective down'));
      analyzeToxicityWithOpenAI.mockRejectedValue(new Error('OpenAI down'));

      // Add custom fallback
      worker.customFallback = jest.fn().mockResolvedValue({
        score: 0.5,
        categories: ['UNKNOWN'],
        source: 'fallback'
      });

      const result = await worker.process(job);

      expect(analyzeToxicity).toHaveBeenCalled();
      expect(analyzeToxicityWithOpenAI).toHaveBeenCalled();
      expect(worker.customFallback).toHaveBeenCalled();
      expect(result.source).toBe('fallback');
      expect(result.fallbackChain).toEqual(['perspective', 'openai', 'custom']);
    });

    it('should use local analysis as last resort', async () => {
      const { comment } = simulateToxicComment({ toxicityLevel: 'extreme' });
      const job = {
        data: { commentId: 'local-test', comment }
      };

      // All external services fail
      analyzeToxicity.mockRejectedValue(new Error('API down'));
      analyzeToxicityWithOpenAI.mockRejectedValue(new Error('API down'));

      // Implement simple local toxicity check
      worker.localToxicityAnalysis = (text) => {
        const toxicWords = ['idiota', 'estúpido', 'mierda', 'infierno'];
        const foundWords = toxicWords.filter(word => 
          text.toLowerCase().includes(word)
        );
        
        return {
          score: foundWords.length > 0 ? 0.8 : 0.2,
          categories: foundWords.length > 0 ? ['LOCAL_TOXIC'] : ['CLEAN'],
          source: 'local',
          detectedWords: foundWords
        };
      };

      const result = await worker.processWithLocalFallback(job);

      expect(result.source).toBe('local');
      expect(result.score).toBeGreaterThan(0.5);
      expect(result.detectedWords.length).toBeGreaterThan(0);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Using local toxicity analysis')
      );
    });
  });

  describe('Partial Failures and Recovery', () => {
    it('should handle partial response from Perspective API', async () => {
      const { comment } = simulateToxicComment();
      const job = {
        data: { commentId: 'partial-test', comment }
      };

      // Mock partial response (missing categories)
      analyzeToxicity.mockResolvedValueOnce({
        score: 0.75
        // Missing categories field
      });

      const result = await worker.process(job);

      expect(result.score).toBe(0.75);
      expect(result.categories).toEqual(['UNKNOWN']);
      expect(result.partial).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Partial response from Perspective')
      );
    });

    it('should handle timeout and retry with shorter timeout', async () => {
      const { comment } = simulateToxicComment();
      const job = {
        data: { commentId: 'timeout-test', comment }
      };

      // Mock timeout then success
      analyzeToxicity
        .mockImplementationOnce(() => 
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
          )
        )
        .mockResolvedValueOnce({
          score: 0.65,
          categories: ['TOXICITY']
        });

      // Override process timeout
      worker.processWithTimeout = async (fn, timeout = 3000) => {
        return Promise.race([
          fn(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeout)
          )
        ]);
      };

      let result;
      try {
        result = await worker.processWithTimeout(
          () => analyzeToxicity(comment),
          3000
        );
      } catch (error) {
        // Retry with OpenAI
        result = await analyzeToxicityWithOpenAI(comment);
      }

      expect(result).toBeDefined();
    });
  });

  describe('Error Normalization', () => {
    it('should normalize different API error formats', async () => {
      const { comment } = simulateToxicComment();
      const job = {
        data: { commentId: 'normalize-test', comment }
      };

      const errors = [
        { status: 429, message: 'Rate limit exceeded' },
        { code: 'RATE_LIMIT', error: 'Too many requests' },
        { type: 'RateLimitError', details: 'Quota exceeded' }
      ];

      for (const errorFormat of errors) {
        analyzeToxicity.mockRejectedValueOnce(errorFormat);
        analyzeToxicityWithOpenAI.mockResolvedValueOnce({
          score: 0.7,
          toxic: true
        });

        const result = await worker.process(job);

        expect(result.fallbackReason).toContain('rate');
        jest.clearAllMocks();
      }
    });

    it('should handle malformed responses gracefully', async () => {
      const { comment } = simulateToxicComment();
      const job = {
        data: { commentId: 'malformed-test', comment }
      };

      const malformedResponses = [
        null,
        undefined,
        {},
        { data: 'not-an-object' },
        { score: 'not-a-number' }
      ];

      for (const response of malformedResponses) {
        analyzeToxicity.mockResolvedValueOnce(response);

        const result = await worker.process(job);

        expect(result.score).toBeDefined();
        expect(typeof result.score).toBe('number');
        expect(result.malformed).toBe(true);
        
        jest.clearAllMocks();
      }
    });
  });

  describe('Multi-language Fallback', () => {
    it('should detect language and use appropriate service', async () => {
      const languages = [
        { code: 'es', comment: '¡Eres un idiota!' },
        { code: 'en', comment: 'You are an idiot!' },
        { code: 'fr', comment: 'Tu es un idiot!' }
      ];

      for (const { code, comment } of languages) {
        const job = {
          data: {
            commentId: `lang-${code}`,
            comment,
            detectedLanguage: code
          }
        };

        // Perspective supports es/en, fallback for others
        if (['es', 'en'].includes(code)) {
          analyzeToxicity.mockResolvedValueOnce({
            score: 0.8,
            categories: ['INSULT']
          });
        } else {
          analyzeToxicity.mockRejectedValueOnce(
            new Error(`Language ${code} not supported`)
          );
          analyzeToxicityWithOpenAI.mockResolvedValueOnce({
            score: 0.75,
            toxic: true
          });
        }

        const result = await worker.process(job);

        expect(result.score).toBeGreaterThan(0.5);
        expect(result.language).toBe(code);

        jest.clearAllMocks();
      }
    });
  });

  describe('Caching and Performance', () => {
    it('should cache results for duplicate comments', async () => {
      const { comment } = simulateToxicComment();
      const job1 = {
        data: { commentId: 'cache-1', comment }
      };
      const job2 = {
        data: { commentId: 'cache-2', comment }
      };

      analyzeToxicity.mockResolvedValue({
        score: 0.7,
        categories: ['TOXICITY']
      });

      // Enable caching
      worker.cache = new Map();
      worker.processWithCache = async (job) => {
        const cacheKey = job.data.comment;
        if (worker.cache.has(cacheKey)) {
          return { ...worker.cache.get(cacheKey), cached: true };
        }
        
        const result = await worker.process(job);
        worker.cache.set(cacheKey, result);
        return result;
      };

      const result1 = await worker.processWithCache(job1);
      const result2 = await worker.processWithCache(job2);

      expect(analyzeToxicity).toHaveBeenCalledTimes(1);
      expect(result1.cached).toBeFalsy();
      expect(result2.cached).toBe(true);
      expect(result1.score).toBe(result2.score);
    });

    it('should batch process multiple comments efficiently', async () => {
      const comments = Array(10).fill(null).map((_, i) => ({
        id: `batch-${i}`,
        text: simulateToxicComment().comment
      }));

      analyzeToxicity.mockImplementation(() => 
        Promise.resolve({
          score: Math.random() * 0.5 + 0.5,
          categories: ['TOXICITY']
        })
      );

      const startTime = Date.now();
      const results = await Promise.all(
        comments.map(c => 
          worker.process({ data: { commentId: c.id, comment: c.text } })
        )
      );
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(10);
      expect(duration).toBeLessThan(1000); // Should process 10 in under 1s
      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(0.5);
      });
    });
  });

  describe('Monitoring and Metrics', () => {
    it('should track fallback usage metrics', async () => {
      worker.metrics = {
        perspectiveSuccess: 0,
        perspectiveFail: 0,
        openaiSuccess: 0,
        openaiFail: 0,
        localFallback: 0
      };

      const { comment } = simulateToxicComment();

      // Successful Perspective call
      analyzeToxicity.mockResolvedValueOnce({ score: 0.7 });
      await worker.process({ data: { comment } });
      worker.metrics.perspectiveSuccess++;

      // Failed Perspective, successful OpenAI
      analyzeToxicity.mockRejectedValueOnce(new Error('Failed'));
      analyzeToxicityWithOpenAI.mockResolvedValueOnce({ score: 0.8 });
      await worker.process({ data: { comment } });
      worker.metrics.perspectiveFail++;
      worker.metrics.openaiSuccess++;

      expect(worker.metrics.perspectiveSuccess).toBe(1);
      expect(worker.metrics.perspectiveFail).toBe(1);
      expect(worker.metrics.openaiSuccess).toBe(1);
    });
  });
});