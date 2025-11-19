/**
 * Roast Prompt Builder with Cacheable Blocks (A/B/C Structure)
 * 
 * Issue #858: Prompt caching con GPT-5.1
 * 
 * This module structures prompts into three cacheable blocks:
 * - Block A (Global): Static meta-prompt, rules, structure (100% cacheable across all users)
 * - Block B (User): Persona, style profile, user-specific rules (cacheable per user)
 * - Block C (Dynamic): Comment, platform, request-specific flags (not cacheable)
 * 
 * The blocks are concatenated deterministically to enable prompt caching
 * with GPT-5.1's Responses API (prompt_cache_retention: "24h").
 * 
 * @module lib/prompts/roastPrompt
 */

const { logger } = require('../../utils/logger');
const constants = require('../../config/constants');
const CsvRoastService = require('../../services/csvRoastService');
const { getToneConfigService } = require('../../services/toneConfigService'); // Issue #876

/**
 * RoastPromptBuilder - Builds prompts with cacheable block structure
 * 
 * @class RoastPromptBuilder
 */
class RoastPromptBuilder {
  constructor() {
    this.version = '2.0.0'; // Issue #858: Prompt caching structure
    this.csvService = new CsvRoastService();
    this.toneService = getToneConfigService(); // Issue #876: Dynamic tone system
  }

  /**
   * Build Block A - Global (100% static, cacheable across all users)
   * 
   * Contains:
   * - Meta-prompt de Roastr (rol del modelo, estilo general)
   * - Sistema de tonos dinámico (Issue #876)
   * - Reglas globales de humor seguro
   * - Estructura esperada de la respuesta
   * - Políticas generales multi-plataforma
   * 
   * NOTE (Issue #876): Now async to load dynamic tones from DB.
   * Cache is managed at toneConfigService level (5min TTL).
   * 
   * @param {string} language - Language code (es, en)
   * @returns {Promise<string>} Block A - Global prompt
   */
  async buildBlockA(language = 'es') {
    try {
      // Load active tones from DB (with cache)
      const tones = await this.toneService.getActiveTones(language);

      // Generate dynamic tones text
      const tonesText = tones.map((tone, i) => `
${i + 1}. ${tone.display_name.toUpperCase()} (Intensidad: ${tone.intensity}/5)
   Descripción: ${tone.description}
   Personalidad: ${tone.personality}
   Recursos permitidos:
   ${tone.resources.map(r => `- ${r}`).join('\n   ')}
   
   Restricciones CRÍTICAS:
   ${tone.restrictions.map(r => `- ${r}`).join('\n   ')}
   
   Ejemplo:
   Input: "${tone.examples[0].input}"
   Output: "${tone.examples[0].output}"
      `).join('\n');

      return `Tu tarea es generar una respuesta sarcástica e ingeniosa —un roast— dirigida a un comentario ofensivo o ridículo en redes sociales.

🎭 SISTEMA DE TONOS DE ROASTR:

Tienes ${tones.length} tonos disponibles:

${tonesText}

IMPORTANTE: Estos tonos son los ÚNICOS en el sistema. El usuario elegirá uno al generar el roast.

🧾 CONTEXTO:

- El siguiente comentario ha sido publicado por un usuario de internet y merece una respuesta que:
  - No sea violenta ni insultante de forma gratuita.
  - Sea provocadora, pero con estilo.
  - Responda con inteligencia, ironía o un giro inesperado.
  - En algunos casos, se permite el humor absurdo o meta-humor.
  - Idealmente, el roast debería hacer que el autor original quede en evidencia ante los demás sin necesidad de agresividad directa.

🔥 CARACTERÍSTICAS DE UN BUEN ROAST APLICADAS:
- Inteligente, con doble sentido o ironía
- Cortante sin ser cruel
- Sorprendente (evita lo obvio)
- Breve, pero con punch
- Estilo claro, como si viniera de alguien ingenioso con confianza

📎 INSTRUCCIONES FINALES:
- El roast debe ser una única frase breve (máximo 25 palabras).
- No repitas literalmente nada del comentario original.
- Si el comentario es absurdo, se permite usar humor absurdo como respuesta.
- NO uses groserías explícitas a menos que el estilo personal lo permita.

`;
    } catch (error) {
      logger.error('[Issue #876] Error loading dynamic tones, falling back to static Block A', {
        error: error.message,
        language
      });

      // Fallback to static Block A if DB load fails
      return `Tu tarea es generar una respuesta sarcástica e ingeniosa —un roast— dirigida a un comentario ofensivo o ridículo en redes sociales.

🧾 CONTEXTO:

- El siguiente comentario ha sido publicado por un usuario de internet y merece una respuesta que:
  - No sea violenta ni insultante de forma gratuita.
  - Sea provocadora, pero con estilo.
  - Responda con inteligencia, ironía o un giro inesperado.
  - En algunos casos, se permite el humor absurdo o meta-humor.
  - Idealmente, el roast debería hacer que el autor original quede en evidencia ante los demás sin necesidad de agresividad directa.

🔥 CARACTERÍSTICAS DE UN BUEN ROAST APLICADAS:
- Inteligente, con doble sentido o ironía
- Cortante sin ser cruel
- Sorprendente (evita lo obvio)
- Breve, pero con punch
- Estilo claro, como si viniera de alguien ingenioso con confianza

📎 INSTRUCCIONES FINALES:
- El roast debe ser una única frase breve (máximo 25 palabras).
- No repitas literalmente nada del comentario original.
- Si el comentario es absurdo, se permite usar humor absurdo como respuesta.
- NO uses groserías explícitas a menos que el estilo personal lo permita.

`;
    }
  }

  /**
   * Build Block B - User (cacheable per user, stable until user changes config)
   * 
   * Contains:
   * - Persona del usuario (texto ya generado)
   * - Style Profile del usuario (texto ya generado)
   * - Reglas del Shield específicas del usuario (si aplica)
   * 
   * IMPORTANT: This block must be deterministic for the same user.
   * No timestamps, request IDs, or other variable data.
   * 
   * @param {Object} options - User-specific options
   * @param {Object|null} options.persona - User persona object
   * @param {Object|null} options.styleProfile - User style profile
   * @param {string} options.tone - User tone preference
   * @param {string} options.humorType - User humor type preference
   * @returns {string} Block B - User-specific prompt
   */
  buildBlockB(options = {}) {
    const { persona = null, styleProfile = null, tone = 'sarcastic', humorType = 'witty' } = options;

    const parts = [];

    // Persona context (if available)
    if (persona && typeof persona === 'object') {
      const personaParts = [];
      
      if (persona.lo_que_me_define && persona.lo_que_me_define.trim()) {
        personaParts.push(`- Lo que define al usuario: ${persona.lo_que_me_define.trim()}`);
      }
      
      if (persona.lo_que_no_tolero && persona.lo_que_no_tolero.trim()) {
        personaParts.push(`- Lo que NO tolera: ${persona.lo_que_no_tolero.trim()}`);
      }
      
      if (persona.lo_que_me_da_igual && persona.lo_que_me_da_igual.trim()) {
        personaParts.push(`- Lo que le da igual: ${persona.lo_que_me_da_igual.trim()}`);
      }

      if (personaParts.length > 0) {
        parts.push(`🎯 CONTEXTO DEL USUARIO:\n${personaParts.join('\n')}`);
      }
    }

    // Style profile and tone
    const toneMapping = this.mapUserTone({ tone, humor_type: humorType });
    if (toneMapping && toneMapping !== 'No especificado') {
      parts.push(`👤 TONO PERSONAL:\n${toneMapping}`);
    }

    // Style profile (if available)
    if (styleProfile && typeof styleProfile === 'object' && Object.keys(styleProfile).length > 0) {
      const styleParts = [];
      if (styleProfile.description) {
        styleParts.push(`Descripción: ${styleProfile.description}`);
      }
      if (styleProfile.examples && Array.isArray(styleProfile.examples)) {
        styleParts.push(`Ejemplos: ${styleProfile.examples.join(', ')}`);
      }
      if (styleParts.length > 0) {
        parts.push(`🎨 ESTILO PERSONALIZADO:\n${styleParts.join('\n')}`);
      }
    }

    return parts.length > 0 ? parts.join('\n\n') + '\n\n' : '';
  }

  /**
   * Build Block C - Dynamic (not cacheable, changes per request)
   * 
   * Contains:
   * - Comentario concreto a analizar/roastear
   * - Plataforma de origen
   * - Flags específicos de esa petición
   * - Categoría del comentario (derived from comment)
   * - Referencias de roasts (if enabled)
   * 
   * @param {Object} options - Request-specific options
   * @param {string} options.comment - Original comment to roast
   * @param {string} options.platform - Platform (twitter, youtube, etc.)
   * @param {Object} options.toxicityData - Toxicity analysis data
   * @param {boolean} options.includeReferences - Whether to include reference roasts
   * @param {Function} options.getReferenceRoasts - Function to get reference roasts (optional)
   * @returns {Promise<string>} Block C - Dynamic prompt
   */
  async buildBlockC(options = {}) {
    const {
      comment,
      platform = 'twitter',
      toxicityData = {},
      includeReferences = false,
      getReferenceRoasts = null
    } = options;

    if (!comment || typeof comment !== 'string') {
      throw new Error('Comment is required for Block C');
    }

    const parts = [];

    // Sanitize comment to prevent injection
    const sanitizedComment = this.sanitizeInput(comment);

    // Original comment
    parts.push(`💬 COMENTARIO ORIGINAL:\n"""\n${sanitizedComment}\n"""`);

    // Category (derived from comment and toxicity data)
    const category = this.categorizeComment(sanitizedComment, toxicityData);
    parts.push(`🎭 CATEGORÍA DEL COMENTARIO:\n${category}\n*(Ejemplos: ataque personal, body shaming, comentario machista, insulto genérico, afirmación absurda, intento fallido de burla...)*`);

    // Platform context
    parts.push(`📱 PLATAFORMA:\n${platform}`);

    // Reference roasts (if enabled)
    if (includeReferences) {
      try {
        const references = typeof getReferenceRoasts === 'function'
          ? await getReferenceRoasts(sanitizedComment)
          : await this.getReferenceRoasts(sanitizedComment);
        
        if (references && references.trim()) {
          parts.push(`📚 EJEMPLOS DE ROASTS BIEN EJECUTADOS:\n${references}`);
        }
      } catch (error) {
        logger.warn('Failed to get reference roasts for Block C', { error: error.message });
        // Continue without references
      }
    }

    parts.push(`\n✍️ RESPUESTA:`);

    return parts.join('\n\n');
  }

  /**
   * Build complete prompt by concatenating blocks A + B + C
   * 
   * The concatenation must be deterministic to enable caching.
   * 
   * NOTE (Issue #876): Now awaits Block A for dynamic tone loading
   * 
   * @param {Object} options - Complete options for all blocks
   * @returns {Promise<string>} Complete prompt ready for AI
   */
  async buildCompletePrompt(options = {}) {
    const language = options.language || 'es';
    
    // Issue #876: Block A is now async (loads tones from DB)
    const blockA = await this.buildBlockA(language);
    
    const blockB = this.buildBlockB({
      persona: options.persona,
      styleProfile: options.styleProfile,
      tone: options.tone || 'sarcastic',
      humorType: options.humorType || 'witty'
    });
    
    const blockC = await this.buildBlockC({
      comment: options.comment,
      platform: options.platform || 'twitter',
      toxicityData: options.toxicityData || {},
      includeReferences: options.includeReferences !== false,
      getReferenceRoasts: options.getReferenceRoasts
    });

    const completePrompt = blockA + blockB + blockC;

    logger.info('Built complete prompt with cacheable blocks', {
      version: this.version,
      blockASize: blockA.length,
      blockBSize: blockB.length,
      blockCSize: blockC.length,
      totalSize: completePrompt.length,
      hasPersona: !!options.persona,
      hasStyleProfile: !!options.styleProfile,
      platform: options.platform
    });

    return completePrompt;
  }

  /**
   * Categorize comment based on content analysis
   * @param {string} comment - Comment text
   * @param {Object} toxicityData - Toxicity analysis data
   * @returns {string} Comment category
   * @private
   */
  categorizeComment(comment, toxicityData = {}) {
    const commentLower = comment.toLowerCase();

    // Check toxicity categories if available
    if (toxicityData.categories && Array.isArray(toxicityData.categories)) {
      for (const category of toxicityData.categories) {
        if (constants.TOXICITY_CATEGORY_MAP && constants.TOXICITY_CATEGORY_MAP[category]) {
          return constants.TOXICITY_CATEGORY_MAP[category];
        }
      }
    }

    // Pattern matching using centralized patterns
    if (constants.CATEGORY_PATTERNS) {
      for (const [category, pattern] of Object.entries(constants.CATEGORY_PATTERNS)) {
        if (pattern.test && pattern.test(commentLower)) {
          return category;
        }
      }
    }

    // Default category
    return constants.COMMENT_CATEGORIES?.GENERIC_NEGATIVE || 'comentario genérico negativo';
  }

  /**
   * Map user tone to descriptive text
   * @param {Object} config - User config with tone and humor_type
   * @returns {string} Tone description
   * @private
   */
  mapUserTone(config) {
    const { tone = 'sarcastic', humor_type = 'witty' } = config;

    const toneMap = {
      sarcastic: 'Sarcástico e irónico, con doble sentido',
      subtle: 'Sutil e intelectual, con ironía elegante',
      direct: 'Directo y cortante, sin rodeos',
      witty: 'Ingenioso y ocurrente, con juegos de palabras',
      clever: 'Inteligente y sofisticado, con referencias culturales'
    };

    const humorMap = {
      witty: 'con humor ingenioso',
      clever: 'con inteligencia',
      dark: 'con humor negro ligero',
      absurd: 'con humor absurdo'
    };

    const toneDesc = toneMap[tone] || toneMap.sarcastic;
    const humorDesc = humorMap[humor_type] || humorMap.witty;

    return `${toneDesc}, ${humorDesc}`;
  }

  /**
   * Sanitize input to prevent prompt injection attacks
   * @param {string} input - Input text
   * @returns {string} Sanitized text
   * @private
   */
  sanitizeInput(input) {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Remove potential injection patterns
    let sanitized = input
      .replace(/```/g, '') // Remove code blocks
      .replace(/\[SYSTEM\]/gi, '') // Remove system markers
      .replace(/\[USER\]/gi, '') // Remove user markers
      .replace(/\[INST\]/gi, '') // Remove instruction markers
      .trim();

    // Limit length to prevent abuse
    const maxLength = constants.MAX_INPUT_LENGTH || 2000;
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength) + '...';
    }

    return sanitized;
  }

  /**
   * Get reference roasts from CSV (helper method)
   * @param {string} comment - Comment to find similar roasts for
   * @returns {Promise<string>} Formatted reference roasts
   * @private
   */
  async getReferenceRoasts(comment) {
    try {
      const allRoasts = await this.csvService.loadRoasts();
      const count = constants.DEFAULT_REFERENCE_COUNT || 3;
      
      // Simple similarity matching (can be enhanced)
      const similarRoasts = allRoasts
        .slice(0, Math.min(count, allRoasts.length))
        .map((roast, index) => `${index + 1}. Comentario: "${roast.comment}" → Roast: "${roast.roast}"`)
        .join('\n');
      
      return similarRoasts || 'No hay ejemplos específicos disponibles para este tipo de comentario.';
    } catch (error) {
      logger.warn('Failed to load reference roasts', { error: error.message });
      return 'Ejemplos no disponibles en este momento.';
    }
  }

  /**
   * Get version for tracking
   * @returns {string} Version
   */
  getVersion() {
    return this.version;
  }
}

module.exports = RoastPromptBuilder;

