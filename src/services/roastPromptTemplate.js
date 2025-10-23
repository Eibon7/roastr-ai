/**
 * Roast Prompt Template Service
 * 
 * Manages the master prompt template for roast generation with optimized
 * performance, centralized configuration, and advanced similarity matching.
 * 
 * Features:
 * - Comment categorization with pattern matching
 * - Optimized reference roasts from CSV with O(n log n) similarity algorithm  
 * - User tone personalization with centralized mapping
 * - Structured roast generation guidelines
 * - Security protection against prompt injection
 * - Platform-aware constraints and formatting
 * 
 * Issue #128: Performance optimizations and code quality improvements
 */

const { logger } = require('../utils/logger');
const CsvRoastService = require('./csvRoastService');
const constants = require('../config/constants');
const { getPlatformLimit, validateRoastForPlatform } = require('../config/platforms');

/**
 * RoastPromptTemplate - Optimized roast generation system
 * 
 * @class RoastPromptTemplate
 * @description Advanced prompt template system with performance optimizations,
 * security protections, and platform-aware generation capabilities.
 * 
 * Features:
 * - O(n log n) similarity algorithm with word frequency indexing
 * - Centralized constants and configuration management
 * - Security protection against prompt injection attacks
 * - Platform-specific constraints and formatting
 * - Chunked CSV loading for memory optimization
 * - Comprehensive error handling and fallback system
 * 
 * @example
 * ```javascript
 * const template = new RoastPromptTemplate();
 * 
 * const prompt = await template.buildPrompt({
 *   originalComment: "Esta aplicación es horrible",
 *   toxicityData: { score: 0.8, categories: ['TOXICITY'] },
 *   userConfig: { 
 *     tone: 'sarcastic',
 *     intensity_level: 3,
 *     platform: 'twitter'
 *   },
 *   includeReferences: true
 * });
 * ```
 * 
 * @since 1.0.0 (Issue #122 - Master Prompt Integration)
 * @version 2.0.0 (Issue #128 - Performance & Quality Improvements)
 */
class RoastPromptTemplate {
  /**
   * Initialize RoastPromptTemplate with optimized configuration
   * 
   * @constructor
   */
  constructor() {
    this.csvService = new CsvRoastService();
    this.version = constants.TEMPLATE_VERSION;
    
    // Performance optimization: Word frequency index for O(n log n) similarity
    this.wordFrequencyIndex = new Map();
    this.lastIndexRebuild = 0;
    
    // Master prompt template with placeholders
    this.masterPrompt = `Tu tarea es generar una respuesta sarcástica e ingeniosa —un roast— dirigida a un comentario ofensivo o ridículo en redes sociales.

🧾 CONTEXTO:

- El siguiente comentario ha sido publicado por un usuario de internet y merece una respuesta que:
  - No sea violenta ni insultante de forma gratuita.
  - Sea provocadora, pero con estilo.
  - Responda con inteligencia, ironía o un giro inesperado.
  - En algunos casos, se permite el humor absurdo o meta-humor.
  - Idealmente, el roast debería hacer que el autor original quede en evidencia ante los demás sin necesidad de agresividad directa.

💬 COMENTARIO ORIGINAL:
"""
{{original_comment}}
"""

🎭 CATEGORÍA DEL COMENTARIO:
{{comment_category}}
*(Ejemplos: ataque personal, body shaming, comentario machista, insulto genérico, afirmación absurda, intento fallido de burla...)*

🎯 CONTEXTO DEL USUARIO:
{{persona_context}}

🔥 CARACTERÍSTICAS DE UN BUEN ROAST APLICADAS:
- Inteligente, con doble sentido o ironía
- Cortante sin ser cruel
- Sorprendente (evita lo obvio)
- Breve, pero con punch
- Estilo claro, como si viniera de alguien ingenioso con confianza

📚 EJEMPLOS DE ROASTS BIEN EJECUTADOS:
{{reference_roasts_from_CSV}}

👤 TONO PERSONAL (si aplica):
{{user_tone}}  
*(Ejemplos: intelectual y condescendiente, despreocupado y payaso, ácido y preciso, amable pero demoledor...)*

📎 INSTRUCCIONES FINALES:
- El roast debe ser una única frase breve (máximo 25 palabras).
- No repitas literalmente nada del comentario original.
- Si el comentario es absurdo, se permite usar humor absurdo como respuesta.
- NO uses groserías explícitas a menos que el estilo personal lo permita.

✍️ RESPUESTA:`;
  }

  /**
   * Categorize comment based on content analysis using centralized patterns
   * @param {string} comment - Original comment text
   * @param {Object} toxicityData - Toxicity analysis data
   * @returns {string} Comment category
   */
  categorizeComment(comment, toxicityData = {}) {
    const commentLower = comment.toLowerCase();

    // Check toxicity categories if available (higher priority)
    if (toxicityData.categories && Array.isArray(toxicityData.categories)) {
      for (const category of toxicityData.categories) {
        if (constants.TOXICITY_CATEGORY_MAP[category]) {
          return constants.TOXICITY_CATEGORY_MAP[category];
        }
      }
    }

    // Pattern matching using centralized patterns
    for (const [category, pattern] of Object.entries(constants.CATEGORY_PATTERNS)) {
      if (pattern.test(commentLower)) {
        return category;
      }
    }

    // Default category
    return constants.COMMENT_CATEGORIES.GENERIC_NEGATIVE;
  }

  /**
   * Get reference roasts from CSV based on optimized similarity matching
   * @param {string} comment - Original comment
   * @param {number} count - Number of reference roasts to include  
   * @returns {Promise<string>} Formatted reference roasts
   */
  async getReferenceRoasts(comment, count = constants.DEFAULT_REFERENCE_COUNT) {
    try {
      const allRoasts = await this.csvService.loadRoasts();
      
      // Build/rebuild word frequency index if needed
      await this.ensureWordIndex(allRoasts);
      
      // Get similar roasts using optimized algorithm
      const similarRoasts = this.findSimilarRoastsOptimized(comment, allRoasts, count);
      
      // Format reference roasts
      if (similarRoasts.length === 0) {
        return 'No hay ejemplos específicos disponibles para este tipo de comentario.';
      }

      return similarRoasts
        .map((roast, index) => `${index + 1}. Comentario: "${roast.comment}" → Roast: "${roast.roast}"`)
        .join('\n');
    } catch (error) {
      logger.warn('Failed to load reference roasts:', error);
      return 'Ejemplos no disponibles en este momento.';
    }
  }

  /**
   * Build/ensure word frequency index for optimized similarity matching
   * @param {Array} allRoasts - All available roasts
   * @private
   */
  async ensureWordIndex(allRoasts) {
    const now = Date.now();
    
    // Rebuild index if too old or empty
    if (this.wordFrequencyIndex.size === 0 || 
        (now - this.lastIndexRebuild) > constants.INDEX_REBUILD_INTERVAL) {
      
      logger.info('Building word frequency index for optimized similarity matching');
      this.wordFrequencyIndex.clear();
      
      // Build word frequency map
      const wordCount = new Map();
      
      allRoasts.forEach((roast, roastIndex) => {
        const words = roast.comment.toLowerCase()
          .split(/\s+/)
          .filter(word => word.length > (allRoasts.length < 100 ? 1 : constants.WORD_MIN_LENGTH));
        
        words.forEach(word => {
          if (!wordCount.has(word)) {
            wordCount.set(word, new Set());
          }
          wordCount.get(word).add(roastIndex);
        });
      });
      
      // Keep only frequent words for index (adaptive threshold for small datasets)
      const adaptiveThreshold = allRoasts.length < 100 ? 1 : constants.WORD_FREQUENCY_THRESHOLD;
      wordCount.forEach((roastIndices, word) => {
        if (roastIndices.size >= adaptiveThreshold) {
          this.wordFrequencyIndex.set(word, roastIndices);
        }
      });
      
      this.lastIndexRebuild = now;
      logger.info(`Word index built with ${this.wordFrequencyIndex.size} frequent words`);
    }
  }

  /**
   * Optimized similarity matching using pre-built index (O(n log n) complexity)
   * @param {string} inputComment - Input comment to match
   * @param {Array} allRoasts - All available roasts
   * @param {number} count - Number of results to return
   * @returns {Array} Top matching roasts sorted by similarity score
   * @private
   */
  findSimilarRoastsOptimized(inputComment, allRoasts, count) {
    const inputLower = inputComment.toLowerCase();
    const inputWords = inputLower.split(/\s+/)
      .filter(word => word.length > 1); // Use same threshold as temporary index
    
    // Score accumulator using Map for O(1) access
    const scoreMap = new Map();
    
    // Fast word-based scoring using index
    inputWords.forEach(word => {
      if (this.wordFrequencyIndex.has(word)) {
        const matchingRoastIndices = this.wordFrequencyIndex.get(word);
        matchingRoastIndices.forEach(roastIndex => {
          const currentScore = scoreMap.get(roastIndex) || 0;
          scoreMap.set(roastIndex, currentScore + 1);
        });
      }
    });
    
    // Category matching (higher weight)  
    const inputCategory = this.categorizeComment(inputComment);
    
    // Convert to array and add category scores
    const scoredResults = [];
    scoreMap.forEach((wordScore, roastIndex) => {
      const roast = allRoasts[roastIndex];
      let totalScore = wordScore;
      
      // Category bonus
      const roastCategory = this.categorizeComment(roast.comment);
      if (inputCategory === roastCategory) {
        totalScore += constants.CATEGORY_SCORE_BOOST;
      }
      
      scoredResults.push({ ...roast, score: totalScore });
    });
    
    // Sort by score (O(n log n)) and return top matches
    return scoredResults
      .sort((a, b) => b.score - a.score)
      .filter(roast => roast.score > constants.SIMILARITY_SCORE_THRESHOLD)
      .slice(0, count);
  }

  /**
   * Legacy similarity method kept for backward compatibility
   * @deprecated Use findSimilarRoastsOptimized instead
   * @private
   */
  findSimilarRoasts(inputComment, allRoasts, count) {
    // For backward compatibility, build a quick temporary index if needed
    if (this.wordFrequencyIndex.size === 0) {
      this.buildTemporaryIndex(allRoasts);
    }
    return this.findSimilarRoastsOptimized(inputComment, allRoasts, count);
  }

  /**
   * Build a temporary word index for testing or small datasets
   * @param {Array} allRoasts - Roasts to index
   * @private
   */
  buildTemporaryIndex(allRoasts) {
    const wordCount = new Map();
    
    allRoasts.forEach((roast, roastIndex) => {
      const words = roast.comment.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 1); // Less strict for small datasets
      
      words.forEach(word => {
        if (!wordCount.has(word)) {
          wordCount.set(word, new Set());
        }
        wordCount.get(word).add(roastIndex);
      });
    });
    
    // For temporary index, use all words (not just frequent ones)
    wordCount.forEach((roastIndices, word) => {
      this.wordFrequencyIndex.set(word, roastIndices);
    });
  }

  /**
   * Map tone configuration to descriptive tone using centralized mappings
   * @param {Object} config - User configuration
   * @returns {string} Descriptive tone
   */
  mapUserTone(config) {
    let tone = constants.TONE_MAP[config.tone] || constants.TONE_MAP.sarcastic;
    
    if (config.humor_type && constants.HUMOR_MAP[config.humor_type]) {
      tone += ` ${constants.HUMOR_MAP[config.humor_type]}`;
    }

    // Add intensity level description
    if (config.intensity_level) {
      if (config.intensity_level <= 2) {
        tone += ', suave y amigable';
      } else if (config.intensity_level >= 4) {
        tone += ', directo y sin filtros';
      }
    }

    // Add custom style if available
    if (config.custom_style_prompt) {
      tone += `. Estilo personalizado: ${config.custom_style_prompt}`;
    }

    return tone;
  }

  /**
   * Build persona context for prompt injection (Issue #615)
   * Formats user persona fields into structured context for roast generation.
   * Handles null/partial personas gracefully with fallback values.
   *
   * @param {Object|null} persona - User persona object with fields:
   *   - lo_que_me_define: User's identity/definition
   *   - lo_que_no_tolero: User's intolerances/boundaries
   *   - lo_que_me_da_igual: User's tolerances (Pro+ only)
   * @returns {string} Formatted persona context or "No especificado" if null/empty
   */
  buildPersonaContext(persona) {
    // Return fallback for null/undefined/non-object personas
    if (!persona || typeof persona !== 'object' || Array.isArray(persona)) {
      return 'No especificado';
    }

    const contextParts = [];

    // Add lo_que_me_define if present and non-empty
    if (persona.lo_que_me_define && persona.lo_que_me_define.trim()) {
      contextParts.push(`- Lo que define al usuario: ${persona.lo_que_me_define.trim()}`);
    }

    // Add lo_que_no_tolero if present and non-empty
    if (persona.lo_que_no_tolero && persona.lo_que_no_tolero.trim()) {
      contextParts.push(`- Lo que NO tolera: ${persona.lo_que_no_tolero.trim()}`);
    }

    // Add lo_que_me_da_igual if present and non-empty (Pro+ only)
    if (persona.lo_que_me_da_igual && persona.lo_que_me_da_igual.trim()) {
      contextParts.push(`- Lo que le da igual: ${persona.lo_que_me_da_igual.trim()}`);
    }

    // Return formatted context or fallback if no valid fields
    return contextParts.length > 0 ? contextParts.join('\n') : 'No especificado';
  }

  /**
   * Sanitize input text to prevent prompt injection attacks using centralized patterns
   * @param {string} input - Input text to sanitize
   * @returns {string} Sanitized text
   * @private
   */
  sanitizeInput(input) {
    if (typeof input !== 'string') {
      return String(input);
    }

    // Escape potential template injection patterns using centralized replacements
    return input
      .replace(constants.SANITIZATION_PATTERNS.DOUBLE_CURLY_OPEN, constants.SANITIZATION_REPLACEMENTS.DOUBLE_CURLY_OPEN)
      .replace(constants.SANITIZATION_PATTERNS.DOUBLE_CURLY_CLOSE, constants.SANITIZATION_REPLACEMENTS.DOUBLE_CURLY_CLOSE)
      .replace(constants.SANITIZATION_PATTERNS.SINGLE_CURLY_OPEN, constants.SANITIZATION_REPLACEMENTS.SINGLE_CURLY_OPEN)
      .replace(constants.SANITIZATION_PATTERNS.SINGLE_CURLY_CLOSE, constants.SANITIZATION_REPLACEMENTS.SINGLE_CURLY_CLOSE)
      // Limit length using centralized constant
      .substring(0, constants.MAX_INPUT_LENGTH);
  }

  /**
   * Validate input parameters for buildPrompt
   * @param {Object} params - Parameters to validate
   * @throws {Error} If validation fails
   * @private
   */
  validateBuildPromptParams(params) {
    if (!params || typeof params !== 'object') {
      throw new Error('buildPrompt parameters must be an object');
    }

    const { originalComment } = params;

    // Validate originalComment
    if (originalComment === null || originalComment === undefined) {
      throw new Error('originalComment is required');
    }

    if (typeof originalComment !== 'string') {
      throw new Error('originalComment must be a string');
    }

    if (originalComment.trim().length === 0) {
      throw new Error('originalComment must be a non-empty string');
    }

    if (originalComment.length > constants.MAX_INPUT_LENGTH) {
      throw new Error(`originalComment exceeds maximum length of ${constants.MAX_INPUT_LENGTH} characters`);
    }
  }

  /**
   * Build the complete prompt with all dynamic fields replaced
   * @param {Object} params - Parameters for prompt generation
   * @returns {Promise<string>} Complete prompt ready for AI
   */
  async buildPrompt(params) {
    try {
      // Validate input parameters
      this.validateBuildPromptParams(params);

      const {
        originalComment,
        toxicityData = {},
        userConfig = {},
        includeReferences = true,
        persona = null // Issue #615: Add persona parameter (optional)
      } = params;

      // Sanitize inputs to prevent injection attacks
      const sanitizedComment = this.sanitizeInput(originalComment);

      // Get dynamic field values
      const category = this.categorizeComment(sanitizedComment, toxicityData);
      const references = includeReferences
        ? await this.getReferenceRoasts(sanitizedComment)
        : 'Referencias desactivadas para este modo.';
      const userTone = this.mapUserTone(userConfig);

      // Issue #615: Build and sanitize persona context
      const personaContext = this.buildPersonaContext(persona);

      // Sanitize all dynamic content
      const sanitizedCategory = this.sanitizeInput(category);
      const sanitizedReferences = this.sanitizeInput(references);
      const sanitizedUserTone = this.sanitizeInput(userTone);
      const sanitizedPersonaContext = this.sanitizeInput(personaContext); // Issue #615

      // Replace placeholders in master prompt
      let prompt = this.masterPrompt
        .replace('{{original_comment}}', sanitizedComment)
        .replace('{{comment_category}}', sanitizedCategory)
        .replace('{{persona_context}}', sanitizedPersonaContext) // Issue #615
        .replace('{{reference_roasts_from_CSV}}', sanitizedReferences)
        .replace('{{user_tone}}', sanitizedUserTone);

      logger.info('Built roast prompt', {
        version: this.version,
        category: sanitizedCategory,
        hasReferences: includeReferences,
        hasPersona: !!persona, // Issue #615: Log if persona present
        userTone: userConfig.tone,
        sanitized: true
      });

      return prompt;
    } catch (error) {
      logger.error('Error building prompt:', {
        error: error.message,
        stack: error.stack,
        version: this.version,
        params: {
          hasOriginalComment: !!params?.originalComment,
          originalCommentType: typeof params?.originalComment,
          originalCommentLength: params?.originalComment?.length || 0
        }
      });
      
      // Return a fallback prompt with error context
      return this.getFallbackPrompt(params?.originalComment, params?.userConfig, error);
    }
  }

  /**
   * Get a simplified fallback prompt with error context
   * @param {string} originalComment - Original comment (if available)
   * @param {Object} userConfig - User configuration (if available) 
   * @param {Error} error - Error that triggered fallback (optional)
   * @private
   */
  getFallbackPrompt(originalComment, userConfig = {}, error = null) {
    const tone = userConfig?.tone || constants.DEFAULT_TONE;

    // Sanitize the original comment for fallback use
    let sanitizedComment = 'comentario no disponible';
    if (originalComment && typeof originalComment === 'string') {
      sanitizedComment = this.sanitizeInput(originalComment);
    }

    // Log fallback usage with context
    logger.warn('Using fallback prompt', {
      version: this.version,
      tone,
      hasOriginalComment: !!originalComment,
      errorReason: error?.message || 'Unknown error',
      fallbackTriggered: true
    });

    return `Genera un roast ${constants.TONE_GUIDES[tone] || 'ingenioso'} para este comentario. 
Sé breve (máximo 25 palabras), inteligente y evita ser cruel o usar groserías.

Comentario: "${sanitizedComment}"

Roast:`;
  }

  /**
   * Get prompt version for tracking
   */
  getVersion() {
    return this.version;
  }
}

module.exports = RoastPromptTemplate;