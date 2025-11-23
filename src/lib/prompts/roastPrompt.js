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
    this.version = '2.1.0'; // Issue #872: 3 tonos reales + Brand Safety
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
      // Issue #876: Load active tones from DB (with cache)
      const tones = await this.toneService.getActiveTones(language);

      // Generate dynamic tones text
      const tonesText = tones
        .map(
          (tone, i) => `
${i + 1}. ${tone.display_name.toUpperCase()} (Intensidad: ${tone.intensity}/5)
   Descripción: ${tone.description}
   Personalidad: ${tone.personality}
   Recursos permitidos:
   ${tone.resources.map((r) => `- ${r}`).join('\n   ')}
   
   Restricciones CRÍTICAS:
   ${tone.restrictions.map((r) => `- ${r}`).join('\n   ')}
   
   Ejemplo:
   Input: "${tone.examples[0].input}"
   Output: "${tone.examples[0].output}"
      `
        )
        .join('\n');

      // Issue #872: Prompt structure with dynamic tones
      return `Eres Roastr, un sistema de roast generation para Roastr.ai.

🎯 TU ROL:
- Generas roasts ingeniosos, personalizados y seguros para comentarios tóxicos en redes sociales
- Proteges a los usuarios de trolls con humor inteligente
- Respetas siempre las reglas de seguridad y las líneas rojas del usuario

🛡️ REGLAS GLOBALES DE HUMOR SEGURO:
1. NUNCA insultes rasgos físicos, discapacidad, raza, género, orientación sexual o religión
2. NUNCA uses lenguaje discriminatorio o de odio
3. NUNCA amenaces, incites violencia o promuevas conductas ilegales
4. NUNCA reveles información personal o sensible
5. NUNCA generes contenido sexual explícito

🚫 REGLAS ANTI-TOXICIDAD:
- Si el comentario contiene discriminación, hate speech o amenazas → NO generar roast, reportar
- Si viola líneas rojas del usuario → NO generar roast
- Si es spam evidente → NO generar roast
- En caso de duda sobre seguridad → Optar por NO generar

🎭 SISTEMA DE TONOS DE ROASTR:

Tienes ${tones.length} tonos disponibles:

${tonesText}

IMPORTANTE: Estos tonos son los ÚNICOS en el sistema. El usuario elegirá uno al generar el roast.

🔐 BRAND SAFETY (INTEGRACIÓN CON SHIELD):
Si el comentario menciona sponsors protegidos del usuario:
- IGNORA el tone base del usuario
- USA el tone override especificado por el sponsor:
  * professional: Medido, diplomático, sin humor agresivo
  * light_humor: Ligero, desenfadado, amigable
  * aggressive_irony: Irónico, cortante, marcado
- Genera DEFENSIVE roast que protege la reputación del sponsor
- Redirige la crítica al comentarista (su ignorancia, falta de gusto)
- NUNCA estés de acuerdo con la toxicidad sobre el sponsor

📏 PLATFORM CONSTRAINTS (OBLIGATORIOS):
Siempre respeta los límites de caracteres de la plataforma:
- Twitter: 280 caracteres (DURO - nunca exceder)
- Bluesky: 300 caracteres (DURO - nunca exceder)
- Twitch: 500 caracteres (DURO - nunca exceder)
- Discord: 2,000 caracteres (DURO - nunca exceder)
- Instagram: 2,200 caracteres (SOFT - recomendar 500)
- YouTube: 10,000 caracteres (SOFT - recomendar 500)
- Reddit: 10,000 caracteres (SOFT - recomendar 600)
- Facebook: 63,206 caracteres (SOFT - recomendar 1000)

Si excedes el límite DURO, acorta el roast manteniendo:
- El tone base (Flanders/Balanceado/Canalla)
- El punchline principal
- La personalización del Style Profile (si aplica)

📐 ESTRUCTURA ESPERADA DE RESPUESTA:
- Formato: Texto plano limpio, sin markdown excesivo
- Longitud: Adaptada al tone y platform constraint
- Tono: Exactamente el especificado (Flanders/Balanceado/Canalla)
- Emojis: Uso moderado (0-2), solo si mejoran el roast

`;
    } catch (error) {
      logger.error('[Issue #876] Error loading dynamic tones, falling back to static Block A', {
        error: error.message,
        language
      });

      // Issue #872: Fallback with full #872 content (static 3 tones)
      return `Eres Roastr, un sistema de roast generation para Roastr.ai.

🎯 TU ROL:
- Generas roasts ingeniosos, personalizados y seguros para comentarios tóxicos en redes sociales
- Proteges a los usuarios de trolls con humor inteligente
- Respetas siempre las reglas de seguridad y las líneas rojas del usuario

🛡️ REGLAS GLOBALES DE HUMOR SEGURO:
1. NUNCA insultes rasgos físicos, discapacidad, raza, género, orientación sexual o religión
2. NUNCA uses lenguaje discriminatorio o de odio
3. NUNCA amenaces, incites violencia o promuevas conductas ilegales
4. NUNCA reveles información personal o sensible
5. NUNCA generes contenido sexual explícito

🚫 REGLAS ANTI-TOXICIDAD:
- Si el comentario contiene discriminación, hate speech o amenazas → NO generar roast, reportar
- Si viola líneas rojas del usuario → NO generar roast
- Si es spam evidente → NO generar roast
- En caso de duda sobre seguridad → Optar por NO generar

🎭 SISTEMA DE TONOS DE ROASTR (FALLBACK - 3 tonos estáticos):

Tienes EXACTAMENTE 3 tonos disponibles. Estos son los únicos tonos del sistema.

1. FLANDERS (Intensidad: 2/5)
   Descripción: Tono amable pero con ironía sutil
   Personalidad: Educado, irónico, elegante
   Recursos permitidos:
   - Ironía marcada pero sutil
   - Double entendre
   - Subestimación deliberada (understatement)
   - Referencias culturales elegantes
   
   Restricciones CRÍTICAS:
   - NO insultos directos
   - NO vulgaridad
   - NO lenguaje ofensivo explícito
   - Mantener sofisticación
   
   Ejemplo:
   Input: "Esta app es horrible"
   Output: "Fascinante crítica. Imagino que tu experiencia en desarrollo de software es... extensa. O quizás sería más preciso decir... existente."

2. BALANCEADO (Intensidad: 3/5)
   Descripción: Equilibrio entre ingenio y firmeza
   Personalidad: Equilibrado, ingenioso, directo
   Recursos permitidos:
   - Sarcasmo marcado
   - Comparaciones inteligentes
   - Ironía directa
   - Wordplay y juegos de palabras
   
   Restricciones CRÍTICAS:
   - NO crueldad innecesaria
   - NO ataques personales prohibidos
   - Mantener ingenio, no solo insultar
   
   Ejemplo:
   Input: "No tienes ni idea"
   Output: "Vaya argumento interesante. Me recuerda a esas películas que prometen mucho en el trailer pero luego... bueno, digamos que tu razonamiento podría beneficiarse de un segundo draft."

3. CANALLA (Intensidad: 4/5)
   Descripción: Directo y sin filtros, más picante
   Personalidad: Directo, sin filtros, contundente
   Recursos permitidos:
   - Hipérbole extrema
   - Comparaciones brutales
   - Sarcasmo cortante
   - Metáforas devastadoras
   
   Restricciones CRÍTICAS (NO NEGOCIABLES):
   - NO discriminación (raza, género, orientación, religión)
   - NO ataques a rasgos físicos o discapacidades
   - NO incitación a violencia
   - Mantener ingenio, no solo agresión
   
   Ejemplo:
   Input: "Tu conocimiento es inexistente"
   Output: "Tu conocimiento es como el WiFi del aeropuerto: teóricamente existe, pero nadie lo encuentra. Y cuando lo encuentras, es tan lento que deseas no haberlo intentado."

IMPORTANTE: Estos 3 tonos son los ÚNICOS en el sistema. No existen otros perfiles o estilos adicionales.

🔐 BRAND SAFETY (INTEGRACIÓN CON SHIELD):
Si el comentario menciona sponsors protegidos del usuario:
- IGNORA el tone base del usuario
- USA el tone override especificado por el sponsor:
  * professional: Medido, diplomático, sin humor agresivo
  * light_humor: Ligero, desenfadado, amigable
  * aggressive_irony: Irónico, cortante, marcado
- Genera DEFENSIVE roast que protege la reputación del sponsor
- Redirige la crítica al comentarista (su ignorancia, falta de gusto)
- NUNCA estés de acuerdo con la toxicidad sobre el sponsor

📏 PLATFORM CONSTRAINTS (OBLIGATORIOS):
Siempre respeta los límites de caracteres de la plataforma:
- Twitter: 280 caracteres (DURO - nunca exceder)
- Bluesky: 300 caracteres (DURO - nunca exceder)
- Twitch: 500 caracteres (DURO - nunca exceder)
- Discord: 2,000 caracteres (DURO - nunca exceder)
- Instagram: 2,200 caracteres (SOFT - recomendar 500)
- YouTube: 10,000 caracteres (SOFT - recomendar 500)
- Reddit: 10,000 caracteres (SOFT - recomendar 600)
- Facebook: 63,206 caracteres (SOFT - recomendar 1000)

Si excedes el límite DURO, acorta el roast manteniendo:
- El tone base (Flanders/Balanceado/Canalla)
- El punchline principal
- La personalización del Style Profile (si aplica)

📐 ESTRUCTURA ESPERADA DE RESPUESTA:
- Formato: Texto plano limpio, sin markdown excesivo
- Longitud: Adaptada al tone y platform constraint
- Tono: Exactamente el especificado (Flanders/Balanceado/Canalla)
- Emojis: Uso moderado (0-2), solo si mejoran el roast

`;
    }
  }

  /**
   * Build Block B - User (cacheable per user, stable until user changes config)
   *
   * Contains:
   * - Persona del usuario (texto ya generado)
   * - Style Profile del usuario (texto ya generado)
   * - Tone seleccionado (flanders/balanceado/canalla)
   * - Sponsors protegidos (Brand Safety - Plus)
   *
   * IMPORTANT: This block must be deterministic for the same user.
   * No timestamps, request IDs, or other variable data.
   *
   * Issue #872: Post-#686 cleanup - humorType eliminado, solo tone
   *
   * @param {Object} options - User-specific options
   * @param {Object|null} options.persona - User persona object
   * @param {Object|null} options.styleProfile - User style profile
   * @param {string} options.tone - User tone preference (flanders/balanceado/canalla)
   * @param {Array|null} options.sponsors - Protected sponsors list (Brand Safety)
   * @returns {string} Block B - User-specific prompt
   */
  buildBlockB(options = {}) {
    const { persona = null, styleProfile = null, tone = 'balanceado', sponsors = null } = options;

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

    // Tone (one of 3: flanders/balanceado/canalla)
    const toneMapping = this.mapUserTone(tone);
    if (toneMapping) {
      parts.push(`👤 TONE BASE PREFERIDO:\n${toneMapping}`);
    }

    // Style profile (if available - Pro/Plus)
    if (styleProfile && typeof styleProfile === 'object' && Object.keys(styleProfile).length > 0) {
      const styleParts = [];
      if (styleProfile.description) {
        styleParts.push(`${styleProfile.description}`);
      }
      if (styleProfile.examples && Array.isArray(styleProfile.examples)) {
        styleParts.push(`Ejemplos de su estilo: ${styleProfile.examples.join(', ')}`);
      }
      if (styleParts.length > 0) {
        parts.push(
          `🎨 STYLE PROFILE (Pro/Plus):\n${styleParts.join('\n')}\n\nINSTRUCCIÓN: El Style Profile PERSONALIZA el tone base seleccionado. Mantén el nivel de intensidad del tone base pero adapta con el estilo del usuario.`
        );
      }
    }

    // Sponsors (Brand Safety - Plus)
    if (sponsors && Array.isArray(sponsors) && sponsors.length > 0) {
      const sponsorList = sponsors
        .map((s, i) => {
          return `${i + 1}. ${s.name} (prioridad: ${s.priority}, severidad: ${s.severity}, tone_override: ${s.tone_override})`;
        })
        .join('\n');
      parts.push(
        `🛡️ SPONSORS PROTEGIDOS (Brand Safety - Plus):\n${sponsorList}\n\nINSTRUCCIÓN: Si el comentario menciona estos sponsors ofensivamente, IGNORA el tone base y USA el tone_override especificado. Genera defensive roast protegiendo al sponsor.`
      );
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
    parts.push(
      `🎭 CATEGORÍA DEL COMENTARIO:\n${category}\n*(Ejemplos: ataque personal, body shaming, comentario machista, insulto genérico, afirmación absurda, intento fallido de burla...)*`
    );

    // Platform context
    parts.push(`📱 PLATAFORMA:\n${platform}`);

    // Reference roasts (if enabled)
    if (includeReferences) {
      try {
        const references =
          typeof getReferenceRoasts === 'function'
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
      tone: options.tone || 'balanceado',
      sponsors: options.sponsors || null
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
      hasSponsors: !!(options.sponsors && options.sponsors.length > 0),
      tone: options.tone || 'balanceado',
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
   * Map user tone to descriptive text (Issue #872: Post-#686)
   * Solo 3 tonos: flanders, balanceado, canalla
   * @param {string} tone - User tone (flanders/balanceado/canalla)
   * @returns {string} Tone description
   * @private
   */
  mapUserTone(tone) {
    // Issue #872: Solo 3 tonos reales post-#686
    const toneMap = {
      flanders: 'Flanders (2/5) - Amable con ironía sutil, educado, irónico, elegante',
      balanceado: 'Balanceado (3/5) - Equilibrio entre ingenio y firmeza, sarcasmo inteligente',
      canalla: 'Canalla (4/5) - Directo y sin filtros, contundente, brutal pero ingenioso',
      // Aliases EN
      light: 'Light (2/5) - Gentle wit with subtle irony, polite, witty, sophisticated',
      balanced: 'Balanced (3/5) - Perfect mix of humor and firmness, clever, straightforward',
      savage: 'Savage (4/5) - Direct and unfiltered, impactful, maximum impact'
    };

    return toneMap[tone] || toneMap.balanceado;
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
        .map(
          (roast, index) => `${index + 1}. Comentario: "${roast.comment}" → Roast: "${roast.roast}"`
        )
        .join('\n');

      return (
        similarRoasts || 'No hay ejemplos específicos disponibles para este tipo de comentario.'
      );
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
