const EmbeddingsService = require('../../../src/services/embeddingsService');

// Mock OpenAI
jest.mock('openai');

describe('EmbeddingsService', () => {
  let embeddingsService;
  
  beforeEach(() => {
    // Reset environment to enable mock mode for consistent testing
    process.env.NODE_ENV = 'test';
    embeddingsService = new EmbeddingsService();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    embeddingsService.clearCache();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(embeddingsService.model).toBe('text-embedding-3-small');
      expect(embeddingsService.dimensions).toBe(1536);
      expect(embeddingsService.thresholds.intolerance).toBe(0.85);
      expect(embeddingsService.thresholds.identity).toBe(0.80);
      expect(embeddingsService.thresholds.tolerance).toBe(0.80);
    });

    it('should initialize cache and stats', () => {
      expect(embeddingsService.embeddingCache).toBeDefined();
      expect(embeddingsService.stats.embeddings_generated).toBe(0);
      expect(embeddingsService.stats.cache_hits).toBe(0);
    });
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for valid text', async () => {
      const text = 'This is a test comment';
      const embedding = await embeddingsService.generateEmbedding(text);
      
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536);
      expect(embeddingsService.stats.embeddings_generated).toBe(1);
    });

    it('should use cache for repeated requests', async () => {
      const text = 'This is a test comment';
      
      // First call - should generate
      const embedding1 = await embeddingsService.generateEmbedding(text);
      expect(embeddingsService.stats.cache_misses).toBe(1);
      expect(embeddingsService.stats.cache_hits).toBe(0);
      
      // Second call - should use cache
      const embedding2 = await embeddingsService.generateEmbedding(text);
      expect(embeddingsService.stats.cache_hits).toBe(1);
      expect(embedding1).toEqual(embedding2);
    });

    it('should throw error for invalid input', async () => {
      await expect(embeddingsService.generateEmbedding('')).rejects.toThrow('Text must be a non-empty string');
      await expect(embeddingsService.generateEmbedding(null)).rejects.toThrow('Text must be a non-empty string');
      await expect(embeddingsService.generateEmbedding(123)).rejects.toThrow('Text must be a non-empty string');
    });

    it('should throw error for text that is too long', async () => {
      const longText = 'a'.repeat(8001);
      await expect(embeddingsService.generateEmbedding(longText)).rejects.toThrow('Text too long for embedding generation');
    });
  });

  describe('generateEmbeddings (batch)', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = ['First comment', 'Second comment', 'Third comment'];
      const embeddings = await embeddingsService.generateEmbeddings(texts);
      
      expect(embeddings).toHaveLength(3);
      expect(embeddings.every(emb => Array.isArray(emb) && emb.length === 1536)).toBe(true);
      expect(embeddingsService.stats.embeddings_generated).toBe(3);
    });

    it('should throw error for invalid input', async () => {
      await expect(embeddingsService.generateEmbeddings([])).rejects.toThrow('Texts must be a non-empty array');
      await expect(embeddingsService.generateEmbeddings(null)).rejects.toThrow('Texts must be a non-empty array');
    });
  });

  describe('calculateCosineSimilarity', () => {
    it('should calculate similarity between identical vectors', () => {
      const vector = [1, 0, 0];
      const similarity = embeddingsService.calculateCosineSimilarity(vector, vector);
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should calculate similarity between orthogonal vectors', () => {
      const vector1 = [1, 0, 0];
      const vector2 = [0, 1, 0];
      const similarity = embeddingsService.calculateCosineSimilarity(vector1, vector2);
      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('should calculate similarity between opposite vectors', () => {
      const vector1 = [1, 0, 0];
      const vector2 = [-1, 0, 0];
      const similarity = embeddingsService.calculateCosineSimilarity(vector1, vector2);
      expect(similarity).toBeCloseTo(-1.0, 5);
    });

    it('should throw error for mismatched dimensions', () => {
      const vector1 = [1, 0];
      const vector2 = [1, 0, 0];
      expect(() => embeddingsService.calculateCosineSimilarity(vector1, vector2))
        .toThrow('Embeddings must have the same dimensions');
    });

    it('should throw error for invalid input', () => {
      expect(() => embeddingsService.calculateCosineSimilarity(null, [1, 0]))
        .toThrow('Embeddings must be arrays');
      expect(() => embeddingsService.calculateCosineSimilarity([1, 0], 'invalid'))
        .toThrow('Embeddings must be arrays');
    });
  });

  describe('processPersonaText', () => {
    it('should process comma-separated persona text', async () => {
      const personaText = 'calvo, alto, programador, mexicano';
      const result = await embeddingsService.processPersonaText(personaText);
      
      expect(result).toHaveLength(4);
      expect(result[0].term).toBe('calvo');
      expect(result[0].embedding).toBeDefined();
      expect(Array.isArray(result[0].embedding)).toBe(true);
      expect(result[0].processed_at).toBeDefined();
    });

    it('should process semicolon-separated persona text', async () => {
      const personaText = 'developer; remote worker; coffee lover';
      const result = await embeddingsService.processPersonaText(personaText);
      
      expect(result).toHaveLength(3);
      expect(result.map(r => r.term)).toEqual(['developer', 'remote worker', 'coffee lover']);
    });

    it('should filter out very short terms', async () => {
      const personaText = 'a, bb, good term, x';
      const result = await embeddingsService.processPersonaText(personaText);
      
      expect(result).toHaveLength(1);
      expect(result[0].term).toBe('good term');
    });

    it('should limit to 20 terms', async () => {
      const terms = Array.from({ length: 25 }, (_, i) => `term${i + 1}`);
      const personaText = terms.join(', ');
      const result = await embeddingsService.processPersonaText(personaText);
      
      expect(result).toHaveLength(20);
    });

    it('should return empty array for invalid input', async () => {
      expect(await embeddingsService.processPersonaText('')).toEqual([]);
      expect(await embeddingsService.processPersonaText(null)).toEqual([]);
      expect(await embeddingsService.processPersonaText('a, b')).toEqual([]); // All terms too short
    });
  });

  describe('findSemanticMatches', () => {
    let mockPersonaTerms;

    beforeEach(async () => {
      // Create mock persona terms with embeddings
      mockPersonaTerms = [
        {
          term: 'calvo',
          embedding: await embeddingsService.generateEmbedding('calvo')
        },
        {
          term: 'programador',
          embedding: await embeddingsService.generateEmbedding('programador')
        },
        {
          term: 'alto',
          embedding: await embeddingsService.generateEmbedding('alto')
        }
      ];
    });

    it('should find matches above threshold', async () => {
      const commentText = 'Este programador está loco';
      const result = await embeddingsService.findSemanticMatches(
        commentText, 
        mockPersonaTerms, 
        'identity'
      );
      
      expect(result.matches).toBeDefined();
      expect(result.maxSimilarity).toBeGreaterThan(0);
      expect(result.avgSimilarity).toBeGreaterThan(0);
      expect(result.threshold).toBe(0.80);
      expect(result.totalComparisons).toBe(3);
    });

    it('should handle different match types with different thresholds', async () => {
      const commentText = 'Test comment';
      
      const intoleranceResult = await embeddingsService.findSemanticMatches(
        commentText, mockPersonaTerms, 'intolerance'
      );
      const toleranceResult = await embeddingsService.findSemanticMatches(
        commentText, mockPersonaTerms, 'tolerance'
      );
      
      expect(intoleranceResult.threshold).toBe(0.85);
      expect(toleranceResult.threshold).toBe(0.80);
    });

    it('should return empty results for no matches', async () => {
      const commentText = 'completely unrelated content about cars and weather';
      const result = await embeddingsService.findSemanticMatches(
        commentText, 
        mockPersonaTerms, 
        'identity'
      );
      
      expect(result.matches).toHaveLength(0);
      expect(result.maxSimilarity).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty or invalid input', async () => {
      const result1 = await embeddingsService.findSemanticMatches('', mockPersonaTerms, 'identity');
      expect(result1.matches).toHaveLength(0);
      
      const result2 = await embeddingsService.findSemanticMatches('test', [], 'identity');
      expect(result2.matches).toHaveLength(0);
      
      const result3 = await embeddingsService.findSemanticMatches('test', null, 'identity');
      expect(result3.matches).toHaveLength(0);
    });

    it('should sort matches by similarity (highest first)', async () => {
      // Use terms with different similarities
      const commentText = 'programador calvo alto';
      const result = await embeddingsService.findSemanticMatches(
        commentText, 
        mockPersonaTerms, 
        'identity'
      );
      
      if (result.matches.length > 1) {
        for (let i = 0; i < result.matches.length - 1; i++) {
          expect(result.matches[i].similarity).toBeGreaterThanOrEqual(result.matches[i + 1].similarity);
        }
      }
    });
  });

  describe('cache management', () => {
    it('should implement LRU cache behavior', async () => {
      // Set a small max cache size for testing
      embeddingsService.maxCacheSize = 2;
      
      await embeddingsService.generateEmbedding('first');
      await embeddingsService.generateEmbedding('second');
      expect(embeddingsService.embeddingCache.size).toBe(2);
      
      // This should evict the first entry
      await embeddingsService.generateEmbedding('third');
      expect(embeddingsService.embeddingCache.size).toBe(2);
      
      // First entry should be evicted, so this should be a cache miss
      await embeddingsService.generateEmbedding('first');
      expect(embeddingsService.stats.cache_misses).toBe(4); // first, second, third, first again
    });

    it('should clear cache correctly', async () => {
      await embeddingsService.generateEmbedding('test1');
      await embeddingsService.generateEmbedding('test2');
      expect(embeddingsService.embeddingCache.size).toBe(2);
      
      embeddingsService.clearCache();
      expect(embeddingsService.embeddingCache.size).toBe(0);
    });
  });

  describe('threshold management', () => {
    it('should update thresholds correctly', () => {
      const newThresholds = {
        intolerance: 0.90,
        identity: 0.85
      };
      
      embeddingsService.updateThresholds(newThresholds);
      
      expect(embeddingsService.thresholds.intolerance).toBe(0.90);
      expect(embeddingsService.thresholds.identity).toBe(0.85);
      expect(embeddingsService.thresholds.tolerance).toBe(0.80); // Should remain unchanged
    });
  });

  describe('statistics', () => {
    it('should track statistics correctly', async () => {
      const initialStats = embeddingsService.getStats();
      expect(initialStats.embeddings_generated).toBe(0);
      expect(initialStats.cache_hits).toBe(0);
      expect(initialStats.cache_misses).toBe(0);
      
      await embeddingsService.generateEmbedding('test');
      await embeddingsService.generateEmbedding('test'); // Should hit cache
      
      const updatedStats = embeddingsService.getStats();
      expect(updatedStats.embeddings_generated).toBe(1);
      expect(updatedStats.cache_hits).toBe(1);
      expect(updatedStats.cache_misses).toBe(1);
      expect(updatedStats.cache_hit_rate).toBe(0.5);
    });

    it('should include configuration in stats', () => {
      const stats = embeddingsService.getStats();
      expect(stats.model).toBe('text-embedding-3-small');
      expect(stats.dimensions).toBe(1536);
      expect(stats.thresholds).toEqual(embeddingsService.thresholds);
    });
  });

  describe('health check', () => {
    it('should return healthy status when working correctly', async () => {
      const health = await embeddingsService.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.model).toBe('text-embedding-3-small');
      expect(health.dimensions).toBe(1536);
      expect(health.stats).toBeDefined();
      expect(health.lastTest).toBeDefined();
    });

    it('should handle health check errors gracefully', async () => {
      // Temporarily break the service
      const originalClient = embeddingsService.client;
      embeddingsService.client = null;
      
      const health = await embeddingsService.healthCheck();
      
      expect(health.status).toBe('unhealthy');
      expect(health.error).toBeDefined();
      expect(health.stats).toBeDefined();
      
      // Restore the client
      embeddingsService.client = originalClient;
    });
  });

  describe('mock embedding generation', () => {
    it('should generate deterministic mock embeddings', () => {
      const text = 'test text';
      const embedding1 = embeddingsService.generateMockEmbedding(text);
      const embedding2 = embeddingsService.generateMockEmbedding(text);
      
      expect(embedding1).toEqual(embedding2);
      expect(embedding1.length).toBe(1536);
      
      // Check that embedding is normalized
      const magnitude = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0));
      expect(magnitude).toBeCloseTo(1.0, 5);
    });

    it('should generate different embeddings for different texts', () => {
      const embedding1 = embeddingsService.generateMockEmbedding('text1');
      const embedding2 = embeddingsService.generateMockEmbedding('text2');
      
      expect(embedding1).not.toEqual(embedding2);
    });
  });

  describe('error handling', () => {
    it('should handle semantic matching errors gracefully', async () => {
      const invalidPersonaTerms = [
        { term: 'test', embedding: null }, // Invalid embedding
        { term: 'test2', embedding: 'invalid' } // Invalid embedding format
      ];
      
      const result = await embeddingsService.findSemanticMatches(
        'test comment',
        invalidPersonaTerms,
        'identity'
      );
      
      expect(result.matches).toHaveLength(0);
      expect(result.error).toBeUndefined(); // Should not error, just skip invalid embeddings
    });

    it('should handle processPersonaText errors gracefully', async () => {
      // Test with extremely long text that might cause issues
      const longText = 'a'.repeat(1000);
      
      try {
        const result = await embeddingsService.processPersonaText(longText);
        expect(Array.isArray(result)).toBe(true);
      } catch (error) {
        // If it throws, it should be a meaningful error
        expect(error.message).toContain('embedding generation failed');
      }
    });
  });
});

describe('EmbeddingsService Integration Tests', () => {
  let embeddingsService;
  
  beforeEach(() => {
    embeddingsService = new EmbeddingsService();
  });
  
  afterEach(() => {
    embeddingsService.clearCache();
  });

  describe('Real-world persona scenarios', () => {
    it('should handle Spanish identity terms', async () => {
      const personaText = 'programador, mexicano, calvo, alto, introvertido';
      const result = await embeddingsService.processPersonaText(personaText);
      
      expect(result).toHaveLength(5);
      expect(result.every(r => r.embedding && r.embedding.length === 1536)).toBe(true);
    });

    it('should find semantic matches for related terms', async () => {
      const personaTerms = await embeddingsService.processPersonaText('developer, programmer, coder');
      const commentText = 'This software engineer is terrible';
      
      const result = await embeddingsService.findSemanticMatches(
        commentText,
        personaTerms,
        'identity'
      );
      
      // Even with mock embeddings, we should get some structure back
      expect(result.maxSimilarity).toBeGreaterThanOrEqual(0);
      expect(result.avgSimilarity).toBeGreaterThanOrEqual(0);
      expect(result.totalComparisons).toBe(3);
    });

    it('should handle mixed language persona terms', async () => {
      const personaText = 'developer, programador, engineer, ingeniero';
      const result = await embeddingsService.processPersonaText(personaText);
      
      expect(result).toHaveLength(4);
      expect(result.map(r => r.term)).toEqual(['developer', 'programador', 'engineer', 'ingeniero']);
    });
  });

  describe('Performance characteristics', () => {
    it('should handle moderate load efficiently', async () => {
      const startTime = Date.now();
      const promises = [];
      
      // Generate 10 embeddings concurrently
      for (let i = 0; i < 10; i++) {
        promises.push(embeddingsService.generateEmbedding(`test comment ${i}`));
      }
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      expect(results).toHaveLength(10);
      expect(results.every(r => Array.isArray(r) && r.length === 1536)).toBe(true);
      
      // Should complete in reasonable time (adjust based on your requirements)
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max
    });

    it('should benefit from caching', async () => {
      const text = 'repeated text for caching test';
      
      const startTime1 = Date.now();
      await embeddingsService.generateEmbedding(text);
      const firstCallTime = Date.now() - startTime1;
      
      const startTime2 = Date.now();
      await embeddingsService.generateEmbedding(text);
      const secondCallTime = Date.now() - startTime2;
      
      // Second call should be faster due to caching
      expect(secondCallTime).toBeLessThanOrEqual(firstCallTime);
      expect(embeddingsService.stats.cache_hits).toBe(1);
    });
  });
});