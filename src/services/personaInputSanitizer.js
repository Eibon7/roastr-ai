const { logger } = require('../utils/logger');

/**
 * Persona Input Sanitizer Service
 * 
 * Validates and sanitizes Roastr Persona input fields to prevent prompt injection attacks.
 * Uses the same detection patterns as GatekeeperService but with different behavior:
 * - Invalid inputs are rejected and return null
 * - Valid personal descriptions are preserved exactly as written
 * 
 * @class PersonaInputSanitizer
 */
class PersonaInputSanitizer {
  constructor() {
    this.suspiciousPatterns = this.initializeInjectionPatterns();
  }

  /**
   * Initialize prompt injection detection patterns
   * Uses the same patterns as GatekeeperService for consistency
   */
  initializeInjectionPatterns() {
    return [
      // Direct instruction manipulation (English and Spanish)
      { pattern: /ignore\s+(all\s+)?((previous|prior|above)\s+)?instructions?/i, weight: 1.0, category: 'instruction_override' },
      { pattern: /ignora\s+(todas\s+las\s+)?(instrucciones|reglas)/i, weight: 1.0, category: 'instruction_override' },
      { pattern: /ignora\s+lo\s+que\s+te\s+digan/i, weight: 1.0, category: 'instruction_override' },
      { pattern: /forget\s+(everything|all|your\s+instructions?)/i, weight: 1.0, category: 'instruction_override' },
      { pattern: /olvida\s+(todo|tu\s+rol)/i, weight: 1.0, category: 'instruction_override' },
      { pattern: /disregard\s+(all\s+)?(previous|prior|above|your)\s+instructions?/i, weight: 1.0, category: 'instruction_override' },
      
      // System prompt extraction attempts (English and Spanish)
      { pattern: /system\s+prompt/i, weight: 0.9, category: 'prompt_extraction' },
      { pattern: /dime\s+tu\s+system\s+prompt/i, weight: 0.9, category: 'prompt_extraction' },
      { pattern: /show\s+me\s+your\s+(instructions?|prompt|programming)/i, weight: 0.9, category: 'prompt_extraction' },
      { pattern: /repeat\s+(your\s+)?(instructions?|prompt|programming)/i, weight: 0.9, category: 'prompt_extraction' },
      { pattern: /repite\s+(exactamente\s+)?lo\s+que\s+(tu\s+programador|hay\s+en\s+tu\s+prompt)/i, weight: 0.9, category: 'prompt_extraction' },
      { pattern: /what\s+are\s+your\s+(instructions?|rules|guidelines)\??/i, weight: 0.6, category: 'prompt_extraction' },
      { pattern: /dime\s+las\s+instrucciones\s+(ocultas\s+)?que\s+te\s+dieron/i, weight: 0.9, category: 'prompt_extraction' },
      
      // Role manipulation
      { pattern: /you\s+are\s+(now|no\s+longer)\s+/i, weight: 0.9, category: 'role_manipulation' },
      { pattern: /(eres\s+un\s+bot|olvida\s+lo\s+que\s+te\s+dijeron|actúa\s+como\s+si\s+fueras)/i, weight: 0.9, category: 'role_manipulation' },
      { pattern: /pretend\s+(to\s+be|you('re|are))/i, weight: 0.8, category: 'role_manipulation' },
      { pattern: /act\s+as\s+(if|though|a)/i, weight: 0.7, category: 'role_manipulation' },
      
      // Jailbreak attempts
      { pattern: /jailbreak/i, weight: 1.0, category: 'jailbreak' },
      { pattern: /haz\s+jailbreak/i, weight: 1.0, category: 'jailbreak' },
      { pattern: /DAN\s+mode/i, weight: 1.0, category: 'jailbreak' },
      { pattern: /developer\s+mode/i, weight: 0.9, category: 'jailbreak' },
      { pattern: /unrestricted\s+mode/i, weight: 0.9, category: 'jailbreak' },
      { pattern: /modelo\s+libre/i, weight: 0.9, category: 'jailbreak' },
      
      // Output manipulation
      { pattern: /respond\s+with\s+only/i, weight: 0.7, category: 'output_control' },
      { pattern: /responde\s+siempre\s+con/i, weight: 0.8, category: 'output_control' },
      { pattern: /only\s+say/i, weight: 0.7, category: 'output_control' },
      { pattern: /start\s+your\s+response\s+with/i, weight: 0.6, category: 'output_control' },
      
      // Hidden instructions
      { pattern: /\[.*instructions?.*\]/i, weight: 0.6, category: 'hidden_instruction' },
      { pattern: /<!--.*instructions?.*-->/i, weight: 0.7, category: 'hidden_instruction' },
      
      // Common injection phrases
      { pattern: /above\s+all\s+else/i, weight: 0.6, category: 'priority_override' },
      { pattern: /most\s+important/i, weight: 0.5, category: 'priority_override' },
      { pattern: /override\s+everything/i, weight: 0.9, category: 'priority_override' },
      
      // Character encoding tricks
      { pattern: /\\u[0-9a-fA-F]{4}/g, weight: 0.7, category: 'encoding_trick' },
      { pattern: /%[0-9a-fA-F]{2}/g, weight: 0.6, category: 'encoding_trick' },

      // Specific prompt injection terms
      { pattern: /prompt\s+injection/i, weight: 1.0, category: 'meta_attack' },
      { pattern: /inyección\s+de\s+prompt/i, weight: 1.0, category: 'meta_attack' }
    ];
  }

  /**
   * Detect if text contains prompt injection patterns
   * @param {string} text - Text to analyze
   * @returns {Object} Detection result with score and matched patterns
   */
  detectPromptInjection(text) {
    if (!text || typeof text !== 'string') {
      return {
        hasInjection: false,
        score: 0,
        matches: [],
        indicators: {}
      };
    }

    const matches = [];
    let totalScore = 0;

    // Check against all patterns
    for (const rule of this.suspiciousPatterns) {
      const matchCount = (text.match(rule.pattern) || []).length;
      if (matchCount > 0) {
        const score = rule.weight * matchCount;
        totalScore += score;
        matches.push({
          pattern: rule.pattern.source,
          category: rule.category,
          weight: rule.weight,
          count: matchCount,
          score
        });
      }
    }

    // Additional heuristics for suspicious indicators
    const suspiciousIndicators = {
      hasMultipleNewlines: (text.match(/\n/g) || []).length > 5, // More permissive for persona descriptions
      hasCodeBlocks: /```|~~~/.test(text),
      unusualLength: text.length > 500, // Higher threshold for persona text
      repeatedPhrases: this.detectRepeatedPhrases(text)
    };

    // Adjust score based on indicators
    if (suspiciousIndicators.hasCodeBlocks) totalScore += 0.5;
    if (suspiciousIndicators.repeatedPhrases) totalScore += 0.4;

    return {
      hasInjection: totalScore >= 0.5, // Same threshold as Gatekeeper
      score: Math.min(totalScore, 1.0),
      matches,
      indicators: suspiciousIndicators
    };
  }

  /**
   * Detect repeated phrases that might indicate injection attempts
   */
  detectRepeatedPhrases(text) {
    const words = text.toLowerCase().split(/\s+/);
    const phrases = [];
    
    // Check for repeated 3-word phrases
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = words.slice(i, i + 3).join(' ');
      phrases.push(phrase);
    }

    const phraseCount = {};
    phrases.forEach(phrase => {
      phraseCount[phrase] = (phraseCount[phrase] || 0) + 1;
    });

    return Object.values(phraseCount).some(count => count > 2);
  }

  /**
   * Main sanitization function for Roastr Persona inputs
   * @param {string} text - Input text to sanitize
   * @returns {string|null} Sanitized text or null if invalid
   */
  sanitizePersonaInput(text) {
    // Handle null/undefined cases
    if (text === null || text === undefined) {
      return text;
    }
    
    // Handle non-string cases
    if (typeof text !== 'string') {
      return null;
    }

    const trimmedText = text.trim();
    if (trimmedText === '') {
      return text; // Preserve empty strings as-is
    }

    // Basic length validation (more permissive for persona text)
    if (trimmedText.length > 1000) {
      logger.warn('Persona input rejected: too long', { 
        length: trimmedText.length,
        preview: trimmedText.substring(0, 100)
      });
      return null;
    }

    // Detect prompt injection attempts
    const detection = this.detectPromptInjection(trimmedText);
    
    if (detection.hasInjection) {
      logger.warn('Persona input rejected: prompt injection detected', {
        score: detection.score,
        matches: detection.matches.map(m => ({ 
          category: m.category, 
          count: m.count 
        })),
        preview: trimmedText.substring(0, 100)
      });
      return null;
    }

    // Additional validation for obviously non-personal content
    if (this.containsNonPersonalContent(trimmedText)) {
      logger.warn('Persona input rejected: non-personal content detected', {
        preview: trimmedText.substring(0, 100)
      });
      return null;
    }

    // Text passes all validations - return as-is
    return text;
  }

  /**
   * Detect content that is obviously not personal description
   */
  containsNonPersonalContent(text) {
    const nonPersonalPatterns = [
      /function\s*\w*\s*\(/i,          // JavaScript function (anywhere in text)
      /^\s*def\s+\w+\s*\(/i,          // Python function
      /^\s*<[^>]+>/i,                 // HTML tags
      /^\s*SELECT\s+.+FROM/i,         // SQL queries
      /^\s*import\s+/i,               // Import statements
      /^\s*#include\s*</i,            // C includes
      /^\s*console\.(log|error)/i,    // Console statements
      /^\s*print\s*\(/i,              // Print statements
      /^\s*echo\s+/i,                 // Shell commands
      /^\s*curl\s+/i,                 // HTTP commands
      /^\s*GET\s+\/|POST\s+\//i,      // HTTP requests
      /^\s*\{.*".*".*\}/i,            // JSON objects (simple heuristic)
    ];

    return nonPersonalPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Validate that text describes personal characteristics or preferences
   * This is a more advanced validation that could be expanded
   */
  isValidPersonalDescription(text) {
    if (!text || typeof text !== 'string') return false;
    
    const trimmedText = text.trim().toLowerCase();
    
    // Too short to be meaningful
    if (trimmedText.length < 3) return false;
    
    // Contains personal indicators (expandable)
    const personalIndicators = [
      /\b(soy|me|mi|mis|yo|my|i|me)\b/i,                    // Personal pronouns
      /\b(gusta|molesta|afecta|importa|like|love|hate)\b/i, // Personal preferences
      /\b(trans|gay|lesbian|straight|hetero)\b/i,           // Identity terms
      /\b(vegana?|carnívora?|vegetariana?)\b/i,             // Dietary preferences
      /\b(gamer|deportista|artista|estudiante)\b/i,         // Activities/roles
      /\b(peso|altura|pelo|calvicie|appearance)\b/i,        // Physical characteristics
      /\b(política|religión|football|música)\b/i,           // Topics of interest/sensitivity
    ];

    const hasPersonalIndicators = personalIndicators.some(pattern => pattern.test(trimmedText));
    
    // If it has personal indicators, it's likely valid
    return hasPersonalIndicators;
  }

  /**
   * Get user-friendly error message for rejected input
   * @param {string} text - The rejected input
   * @returns {string} Error message to show to user
   */
  getValidationErrorMessage(text) {
    if (!text || text.trim() === '') return 'El texto no puede estar vacío';
    
    if (text.length > 1000) {
      return 'El texto es demasiado largo. Máximo 1000 caracteres.';
    }
    
    const detection = this.detectPromptInjection(text);
    if (detection.hasInjection) {
      return 'El texto contiene instrucciones no permitidas. Por favor, describe solo aspectos de tu persona o tus preferencias.';
    }
    
    if (this.containsNonPersonalContent(text)) {
      return 'El texto no parece ser una descripción personal válida. Por favor, describe solo aspectos de tu persona.';
    }
    
    return 'El texto contiene contenido no válido para un campo de descripción personal.';
  }
}

module.exports = PersonaInputSanitizer;