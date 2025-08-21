const { OpenAI } = require('openai');
const { mockMode } = require('../config/mockMode');

/**
 * Embeddings Service
 * 
 * Handles generation and comparison of text embeddings for semantic matching
 * in Roastr Persona system. Provides semantic understanding for:
 * - Lo que me define (identity terms)
 * - Lo que no tolero (intolerance terms) 
 * - Lo que me da igual (tolerance terms)
 * 
 * Issue #151: Semantic enrichment with embeddings for improved accuracy
 */
class EmbeddingsService {
  constructor() {
    this.initializeClient();
    
    // Model configuration
    this.model = 'text-embedding-3-small'; // OpenAI's efficient embedding model
    this.dimensions = 1536; // Default dimensions for text-embedding-3-small
    
    // Similarity thresholds for different types of matching
    this.thresholds = {
      intolerance: 0.85,    // High threshold for auto-blocking (strict matching)
      identity: 0.80,       // Medium-high threshold for personal attacks
      tolerance: 0.80       // Medium-high threshold for false positive reduction
    };
    
    // Cache for embeddings to reduce API calls
    this.embeddingCache = new Map();
    this.maxCacheSize = 1000;
    
    // Performance tracking
    this.stats = {
      embeddings_generated: 0,
      cache_hits: 0,
      cache_misses: 0,
      similarity_comparisons: 0,
      api_calls: 0,
      errors: 0
    };
  }
  
  /**
   * Initialize OpenAI client
   */
  initializeClient() {
    if (mockMode.isMockMode) {
      this.client = this.createMockClient();
      this.logger?.info('Mock embeddings client initialized');
    } else if (process.env.OPENAI_API_KEY) {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      this.logger?.info('OpenAI embeddings client initialized');
    } else {
      this.logger?.warn('No OpenAI API key found, embeddings service will use fallback mode');
      this.client = null;
    }
  }
  
  /**
   * Create mock client for testing
   */
  createMockClient() {
    return {
      embeddings: {
        create: async ({ input }) => {
          // Generate deterministic mock embeddings based on input text
          const mockEmbedding = this.generateMockEmbedding(input);
          
          return {
            data: [{
              embedding: mockEmbedding,
              index: 0,
              object: 'embedding'
            }],
            model: 'text-embedding-3-small',
            object: 'list',
            usage: {
              prompt_tokens: Math.ceil(input.length / 4),
              total_tokens: Math.ceil(input.length / 4)
            }
          };
        }
      }
    };
  }
  
  /**
   * Generate deterministic mock embedding for testing
   */
  generateMockEmbedding(text) {
    const embedding = new Array(this.dimensions).fill(0);
    
    // Create a simple hash-based embedding for consistency
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Fill embedding with pseudo-random values based on hash
    for (let i = 0; i < this.dimensions; i++) {
      hash = ((hash * 1103515245) + 12345) & 0x7fffffff;
      embedding[i] = (hash / 0x7fffffff) * 2 - 1; // Normalize to [-1, 1]
    }
    
    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }
  
  /**
   * Generate embedding for text
   * @param {string} text - Text to generate embedding for
   * @param {Object} options - Options for embedding generation
   * @returns {Promise<Array<number>>} - Embedding vector
   */
  async generateEmbedding(text, options = {}) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Text must be a non-empty string');
    }
    
    // Validate text length (OpenAI has token limits)
    if (text.length > 8000) {
      throw new Error('Text too long for embedding generation (max 8000 characters)');
    }
    
    const cacheKey = this.getCacheKey(text, options);
    
    // Check cache first
    if (this.embeddingCache.has(cacheKey)) {
      this.stats.cache_hits++;
      return this.embeddingCache.get(cacheKey);
    }
    
    this.stats.cache_misses++;
    
    try {
      if (!this.client) {
        throw new Error('OpenAI client not initialized');
      }
      
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text.trim(),
        dimensions: options.dimensions || this.dimensions
      });
      
      const embedding = response.data[0].embedding;
      
      // Cache the result
      this.cacheEmbedding(cacheKey, embedding);
      
      this.stats.embeddings_generated++;
      this.stats.api_calls++;
      
      return embedding;
      
    } catch (error) {
      this.stats.errors++;
      this.logger?.error('Failed to generate embedding', {
        error: error.message,
        textLength: text.length,
        model: this.model
      });
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }
  
  /**
   * Generate embeddings for multiple texts in batch
   * @param {Array<string>} texts - Array of texts to generate embeddings for
   * @param {Object} options - Options for embedding generation
   * @returns {Promise<Array<Array<number>>>} - Array of embedding vectors
   */
  async generateEmbeddings(texts, options = {}) {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Texts must be a non-empty array');
    }
    
    // Process in batches to avoid API limits
    const batchSize = options.batchSize || 100;
    const embeddings = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(text => this.generateEmbedding(text, options));
      
      try {
        const batchEmbeddings = await Promise.all(batchPromises);
        embeddings.push(...batchEmbeddings);
      } catch (error) {
        this.logger?.error('Batch embedding generation failed', {
          batchStart: i,
          batchSize: batch.length,
          error: error.message
        });
        throw error;
      }
    }
    
    return embeddings;
  }
  
  /**
   * Calculate cosine similarity between two embeddings
   * @param {Array<number>} embedding1 - First embedding vector
   * @param {Array<number>} embedding2 - Second embedding vector
   * @returns {number} - Cosine similarity score (-1 to 1)
   */
  calculateCosineSimilarity(embedding1, embedding2) {
    if (!Array.isArray(embedding1) || !Array.isArray(embedding2)) {
      throw new Error('Embeddings must be arrays');
    }
    
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }
    
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }
    
    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);
    
    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }
    
    this.stats.similarity_comparisons++;
    return dotProduct / (magnitude1 * magnitude2);
  }
  
  /**
   * Find semantic matches between comment text and persona terms
   * @param {string} commentText - Text to analyze
   * @param {Array<Object>} personaTermsWithEmbeddings - Array of {term, embedding} objects
   * @param {string} matchType - Type of matching ('intolerance', 'identity', 'tolerance')
   * @returns {Promise<Object>} - Match results with similarities and matched terms
   */
  async findSemanticMatches(commentText, personaTermsWithEmbeddings, matchType = 'identity') {
    if (!commentText || !Array.isArray(personaTermsWithEmbeddings)) {
      return { matches: [], maxSimilarity: 0, avgSimilarity: 0 };
    }
    
    try {
      // Generate embedding for comment text
      const commentEmbedding = await this.generateEmbedding(commentText);
      
      const threshold = this.thresholds[matchType] || 0.80;
      const matches = [];
      const similarities = [];
      
      // Compare with each persona term embedding
      for (const { term, embedding } of personaTermsWithEmbeddings) {
        if (!embedding || !Array.isArray(embedding)) {
          continue;
        }
        
        const similarity = this.calculateCosineSimilarity(commentEmbedding, embedding);
        similarities.push(similarity);
        
        if (similarity >= threshold) {
          matches.push({
            term,
            similarity: Math.round(similarity * 1000) / 1000, // Round to 3 decimals
            type: 'semantic_match'
          });
        }
      }
      
      // Sort matches by similarity (highest first)
      matches.sort((a, b) => b.similarity - a.similarity);
      
      const maxSimilarity = similarities.length > 0 ? Math.max(...similarities) : 0;
      const avgSimilarity = similarities.length > 0 ? 
        similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length : 0;
      
      return {
        matches,
        maxSimilarity: Math.round(maxSimilarity * 1000) / 1000,
        avgSimilarity: Math.round(avgSimilarity * 1000) / 1000,
        threshold,
        totalComparisons: similarities.length
      };
      
    } catch (error) {
      this.logger?.error('Semantic matching failed', {
        error: error.message,
        commentLength: commentText.length,
        personaTermsCount: personaTermsWithEmbeddings.length,
        matchType
      });
      
      return { 
        matches: [], 
        maxSimilarity: 0, 
        avgSimilarity: 0, 
        error: error.message 
      };
    }
  }
  
  /**
   * Process persona text and generate embeddings for individual terms
   * @param {string} personaText - Raw persona text (comma/semicolon separated)
   * @returns {Promise<Array<Object>>} - Array of {term, embedding} objects
   */
  async processPersonaText(personaText) {
    if (!personaText || typeof personaText !== 'string') {
      return [];
    }
    
    // Split and clean terms
    const terms = personaText
      .split(/[,;]+/)
      .map(term => term.trim())
      .filter(term => term.length > 2) // Filter very short terms
      .slice(0, 20); // Limit to 20 terms to control costs
    
    if (terms.length === 0) {
      return [];
    }
    
    try {
      const embeddings = await this.generateEmbeddings(terms);
      
      return terms.map((term, index) => ({
        term,
        embedding: embeddings[index],
        processed_at: new Date().toISOString()
      }));
      
    } catch (error) {
      this.logger?.error('Failed to process persona text', {
        error: error.message,
        termsCount: terms.length,
        personaLength: personaText.length
      });
      throw error;
    }
  }
  
  /**
   * Get cache key for embedding
   */
  getCacheKey(text, options = {}) {
    const optionsStr = JSON.stringify(options);
    return `${text}:${optionsStr}`;
  }
  
  /**
   * Cache embedding result
   */
  cacheEmbedding(key, embedding) {
    // Implement LRU-style cache management
    if (this.embeddingCache.size >= this.maxCacheSize) {
      const firstKey = this.embeddingCache.keys().next().value;
      this.embeddingCache.delete(firstKey);
    }
    
    this.embeddingCache.set(key, embedding);
  }
  
  /**
   * Clear embedding cache
   */
  clearCache() {
    this.embeddingCache.clear();
    this.logger?.info('Embedding cache cleared');
  }
  
  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      cache_size: this.embeddingCache.size,
      cache_hit_rate: this.stats.cache_hits + this.stats.cache_misses > 0 
        ? Math.round((this.stats.cache_hits / (this.stats.cache_hits + this.stats.cache_misses)) * 100) / 100
        : 0,
      model: this.model,
      dimensions: this.dimensions,
      thresholds: this.thresholds
    };
  }
  
  /**
   * Update similarity thresholds
   * @param {Object} newThresholds - New threshold values
   */
  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    this.logger?.info('Similarity thresholds updated', this.thresholds);
  }
  
  /**
   * Test embeddings service health
   */
  async healthCheck() {
    try {
      const testText = 'Test embedding generation';
      const embedding = await this.generateEmbedding(testText);
      
      return {
        status: 'healthy',
        model: this.model,
        dimensions: embedding.length,
        stats: this.getStats(),
        lastTest: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        stats: this.getStats(),
        lastTest: new Date().toISOString()
      };
    }
  }
}

module.exports = EmbeddingsService;