/**
 * Roast Prompt Template Service
 * 
 * Manages the master prompt template for roast generation
 * with support for dynamic field replacement and version control.
 * 
 * This service integrates:
 * - Comment categorization
 * - Reference roasts from CSV
 * - User tone personalization
 * - Structured roast generation guidelines
 */

const { logger } = require('../utils/logger');
const CsvRoastService = require('./csvRoastService');

class RoastPromptTemplate {
  constructor() {
    this.csvService = new CsvRoastService();
    this.version = 'v1-roast-prompt';
    
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
   * Categorize comment based on content analysis
   * @param {string} comment - Original comment text
   * @param {Object} toxicityData - Toxicity analysis data
   * @returns {string} Comment category
   */
  categorizeComment(comment, toxicityData = {}) {
    const commentLower = comment.toLowerCase();
    
    // Category detection patterns
    const categoryPatterns = {
      'ataque personal': /\b(eres|pareces|tienes cara de|tu madre|tu familia)\b/i,
      'body shaming': /\b(gordo|flaco|feo|nariz|peso|cuerpo|físico)\b/i,
      'comentario machista': /\b(mujer|mujeres|feminazi|cocina|débil)\b/i,
      'comentario racista': /\b(raza|color|negro|blanco|extranjero|inmigrante)\b/i,
      'insulto genérico': /\b(idiota|estúpido|tonto|imbécil|basura|mierda)\b/i,
      'afirmación absurda': /\b(tierra plana|5g|chips|conspiración|illuminati)\b/i,
      'intento fallido de burla': /\b(jaja|lol|xd|😂|🤣)\b/i,
      'crítica sin fundamento': /\b(malo|horrible|peor|basura|no sirve)\b/i,
      'comentario político': /\b(izquierda|derecha|político|gobierno|presidente)\b/i,
      'spam o autopromición': /\b(sígueme|suscríbete|link|vendo|compra)\b/i
    };

    // Check toxicity categories if available
    if (toxicityData.categories && Array.isArray(toxicityData.categories)) {
      const toxicityCategoryMap = {
        'TOXICITY': 'comentario tóxico general',
        'SEVERE_TOXICITY': 'comentario severamente tóxico',
        'IDENTITY_ATTACK': 'ataque de identidad',
        'INSULT': 'insulto directo',
        'PROFANITY': 'lenguaje vulgar',
        'THREAT': 'amenaza'
      };

      for (const category of toxicityData.categories) {
        if (toxicityCategoryMap[category]) {
          return toxicityCategoryMap[category];
        }
      }
    }

    // Pattern matching
    for (const [category, pattern] of Object.entries(categoryPatterns)) {
      if (pattern.test(commentLower)) {
        return category;
      }
    }

    // Default category
    return 'comentario genérico negativo';
  }

  /**
   * Get reference roasts from CSV based on comment similarity
   * @param {string} comment - Original comment
   * @param {number} count - Number of reference roasts to include
   * @returns {Promise<string>} Formatted reference roasts
   */
  async getReferenceRoasts(comment, count = 3) {
    try {
      const allRoasts = await this.csvService.loadRoasts();
      
      // Get similar roasts based on keyword matching
      const similarRoasts = this.findSimilarRoasts(comment, allRoasts, count);
      
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
   * Find similar roasts based on comment content
   * @private
   */
  findSimilarRoasts(inputComment, allRoasts, count) {
    const inputLower = inputComment.toLowerCase();
    const inputWords = inputLower.split(/\s+/).filter(word => word.length > 2);
    
    // Score each roast by similarity
    const scoredRoasts = allRoasts.map(roast => {
      const roastLower = roast.comment.toLowerCase();
      let score = 0;
      
      // Word matching
      inputWords.forEach(word => {
        if (roastLower.includes(word)) {
          score += 1;
        }
      });
      
      // Category matching (simplified)
      const inputCategory = this.categorizeComment(inputComment);
      const roastCategory = this.categorizeComment(roast.comment);
      if (inputCategory === roastCategory) {
        score += 5;
      }
      
      return { ...roast, score };
    });
    
    // Sort by score and return top matches
    return scoredRoasts
      .sort((a, b) => b.score - a.score)
      .filter(roast => roast.score > 0)
      .slice(0, count);
  }

  /**
   * Map tone configuration to descriptive tone
   * @param {Object} config - User configuration
   * @returns {string} Descriptive tone
   */
  mapUserTone(config) {
    const toneMap = {
      'sarcastic': 'sarcástico y cortante',
      'ironic': 'irónico y sofisticado',
      'absurd': 'absurdo y surrealista',
      'witty': 'ingenioso y rápido',
      'clever': 'inteligente y calculado',
      'playful': 'juguetón y amigable'
    };

    const humorMap = {
      'witty': 'con humor ágil',
      'clever': 'con humor intelectual',
      'playful': 'con humor ligero'
    };

    let tone = toneMap[config.tone] || 'sarcástico';
    if (config.humor_type && humorMap[config.humor_type]) {
      tone += ` ${humorMap[config.humor_type]}`;
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
   * Sanitize input text to prevent prompt injection attacks
   * @param {string} input - Input text to sanitize
   * @returns {string} Sanitized text
   * @private
   */
  sanitizeInput(input) {
    if (typeof input !== 'string') {
      return String(input);
    }

    // Escape potential template injection patterns
    return input
      // Replace double curly braces that could be used for injection
      .replace(/\{\{/g, '(doble-llave-abierta)')
      .replace(/\}\}/g, '(doble-llave-cerrada)')
      // Replace single curly braces that could be problematic
      .replace(/\{/g, '(llave-abierta)')
      .replace(/\}/g, '(llave-cerrada)')
      // Limit length to prevent extremely long inputs
      .substring(0, 2000);
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

    if (originalComment.length > 2000) {
      throw new Error('originalComment exceeds maximum length of 2000 characters');
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
        includeReferences = true
      } = params;

      // Sanitize inputs to prevent injection attacks
      const sanitizedComment = this.sanitizeInput(originalComment);
      
      // Get dynamic field values
      const category = this.categorizeComment(sanitizedComment, toxicityData);
      const references = includeReferences 
        ? await this.getReferenceRoasts(sanitizedComment) 
        : 'Referencias desactivadas para este modo.';
      const userTone = this.mapUserTone(userConfig);

      // Sanitize all dynamic content
      const sanitizedCategory = this.sanitizeInput(category);
      const sanitizedReferences = this.sanitizeInput(references);
      const sanitizedUserTone = this.sanitizeInput(userTone);

      // Replace placeholders in master prompt
      let prompt = this.masterPrompt
        .replace('{{original_comment}}', sanitizedComment)
        .replace('{{comment_category}}', sanitizedCategory)
        .replace('{{reference_roasts_from_CSV}}', sanitizedReferences)
        .replace('{{user_tone}}', sanitizedUserTone);

      logger.info('Built roast prompt', {
        version: this.version,
        category: sanitizedCategory,
        hasReferences: includeReferences,
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
    const tone = userConfig?.tone || 'sarcastic';
    const toneGuides = {
      sarcastic: 'sarcástico pero ingenioso',
      ironic: 'irónico y sutil',
      absurd: 'absurdo y creativo'
    };

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

    return `Genera un roast ${toneGuides[tone] || 'ingenioso'} para este comentario. 
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