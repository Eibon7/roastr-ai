const { logger } = require('../utils/logger');
const fs = require('fs');
const path = require('path');

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
   * Dynamically loads patterns from JSON configuration file
   */
  initializeInjectionPatterns() {
    try {
      // Load patterns from external JSON file
      const patternsPath = path.join(__dirname, '../config/injection-patterns.json');
      const patternsData = this.loadPatternsFromFile(patternsPath);

      if (patternsData && this.validatePatternsData(patternsData)) {
        logger.info('Successfully loaded injection patterns from external config', {
          version: patternsData.version,
          patternCount: patternsData.patterns.length
        });
        return this.convertJsonPatternsToRegex(patternsData.patterns);
      }

      // Fall back to hardcoded patterns if file loading fails
      logger.warn('External patterns file invalid or missing, falling back to hardcoded patterns');
      return this.getFallbackPatterns();
    } catch (error) {
      logger.error('Error loading injection patterns from file, using fallback', {
        error: error.message
      });
      return this.getFallbackPatterns();
    }
  }

  /**
   * Load patterns from JSON file with error handling
   */
  loadPatternsFromFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        logger.warn('Patterns file does not exist', { path: filePath });
        return null;
      }

      const rawData = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(rawData);
    } catch (error) {
      logger.error('Failed to load or parse patterns file', {
        path: filePath,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Validate that patterns data has required structure and fields
   */
  validatePatternsData(data) {
    if (!data || typeof data !== 'object') {
      logger.error('Patterns data is not a valid object');
      return false;
    }

    if (!Array.isArray(data.patterns)) {
      logger.error('Patterns data missing patterns array');
      return false;
    }

    // Validate each pattern has required fields
    for (let i = 0; i < data.patterns.length; i++) {
      const pattern = data.patterns[i];
      if (!this.validatePattern(pattern, i)) {
        return false;
      }
    }

    logger.info('All patterns validated successfully', { count: data.patterns.length });
    return true;
  }

  /**
   * Validate individual pattern object
   */
  validatePattern(pattern, index) {
    const required = ['pattern', 'weight', 'category'];

    for (const field of required) {
      if (!(field in pattern)) {
        logger.error(`Pattern ${index} missing required field: ${field}`, { pattern });
        return false;
      }
    }

    if (typeof pattern.pattern !== 'string' || pattern.pattern.trim() === '') {
      logger.error(`Pattern ${index} has invalid pattern string`, { pattern: pattern.pattern });
      return false;
    }

    if (typeof pattern.weight !== 'number' || pattern.weight < 0 || pattern.weight > 1) {
      logger.error(`Pattern ${index} has invalid weight`, { weight: pattern.weight });
      return false;
    }

    if (typeof pattern.category !== 'string' || pattern.category.trim() === '') {
      logger.error(`Pattern ${index} has invalid category`, { category: pattern.category });
      return false;
    }

    return true;
  }

  /**
   * Convert JSON patterns to RegExp objects
   */
  convertJsonPatternsToRegex(jsonPatterns) {
    return jsonPatterns
      .map((p) => {
        try {
          return {
            pattern: new RegExp(p.pattern, p.flags || ''),
            weight: p.weight,
            category: p.category,
            description: p.description
          };
        } catch (error) {
          logger.error('Failed to create RegExp for pattern', {
            pattern: p.pattern,
            flags: p.flags,
            error: error.message
          });
          return null;
        }
      })
      .filter((p) => p !== null);
  }

  /**
   * Fallback patterns (same as original hardcoded patterns)
   * Used when external JSON file is unavailable or invalid
   */
  getFallbackPatterns() {
    return [
      // Direct instruction manipulation (English and Spanish)
      {
        pattern: /ignore\s+(all\s+)?((previous|prior|above)\s+)?instructions?/i,
        weight: 1.0,
        category: 'instruction_override'
      },
      {
        pattern: /ignora\s+(todas\s+las\s+)?(instrucciones|reglas)/i,
        weight: 1.0,
        category: 'instruction_override'
      },
      { pattern: /ignora\s+lo\s+que\s+te\s+digan/i, weight: 1.0, category: 'instruction_override' },
      {
        pattern: /forget\s+(everything|all|your\s+instructions?)/i,
        weight: 1.0,
        category: 'instruction_override'
      },
      { pattern: /olvida\s+(todo|tu\s+rol)/i, weight: 1.0, category: 'instruction_override' },
      {
        pattern: /disregard\s+(all\s+)?(previous|prior|above|your)\s+instructions?/i,
        weight: 1.0,
        category: 'instruction_override'
      },

      // System prompt extraction attempts (English and Spanish)
      { pattern: /system\s+prompt/i, weight: 0.9, category: 'prompt_extraction' },
      { pattern: /dime\s+tu\s+system\s+prompt/i, weight: 0.9, category: 'prompt_extraction' },
      {
        pattern: /show\s+me\s+your\s+(instructions?|prompt|programming)/i,
        weight: 0.9,
        category: 'prompt_extraction'
      },
      {
        pattern: /repeat\s+(your\s+)?(instructions?|prompt|programming)/i,
        weight: 0.9,
        category: 'prompt_extraction'
      },
      {
        pattern: /repite\s+(exactamente\s+)?lo\s+que\s+(tu\s+programador|hay\s+en\s+tu\s+prompt)/i,
        weight: 0.9,
        category: 'prompt_extraction'
      },
      {
        pattern: /what\s+are\s+your\s+(instructions?|rules|guidelines)\??/i,
        weight: 0.6,
        category: 'prompt_extraction'
      },
      {
        pattern: /dime\s+las\s+instrucciones\s+(ocultas\s+)?que\s+te\s+dieron/i,
        weight: 0.9,
        category: 'prompt_extraction'
      },

      // Role manipulation
      { pattern: /you\s+are\s+(now|no\s+longer)\s+/i, weight: 0.9, category: 'role_manipulation' },
      {
        pattern: /(eres\s+un\s+bot|olvida\s+lo\s+que\s+te\s+dijeron|actúa\s+como\s+si\s+fueras)/i,
        weight: 0.9,
        category: 'role_manipulation'
      },
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
    phrases.forEach((phrase) => {
      phraseCount[phrase] = (phraseCount[phrase] || 0) + 1;
    });

    return Object.values(phraseCount).some((count) => count > 2);
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
        matches: detection.matches.map((m) => ({
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
   * Enhanced with contextual analysis and improved pattern detection
   */
  containsNonPersonalContent(text) {
    // First, check if it looks like legitimate personal tech description
    if (this.isLegitimatePersonalTechDescription(text)) {
      return false;
    }

    // Core non-personal patterns (enhanced)
    const corePatterns = [
      // Programming constructs - more comprehensive
      /\bfunction\s*\w*\s*\(/i, // JavaScript functions (anywhere)
      /\b(const|let|var)\s+\w+\s*=/i, // Variable declarations
      /\bdef\s+\w+\s*\(/i, // Python functions (anywhere)
      /\bclass\s+\w+/i, // Class definitions
      /\b(if|else|for|while|return|break)\s*[\(\{]/i, // Control structures

      // SQL injection patterns (enhanced with context)
      /\b(SELECT)\s+.*\bFROM\b/i, // SELECT with FROM (more specific)
      /\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\s+/i,
      /\bUNION\s+SELECT/i,
      /\bWHERE\s+.*[=<>].*['"]/i, // WHERE with conditions and quotes

      // HTML/XML (more specific)
      /<[a-zA-Z][^>]*>/, // HTML tags
      /<(script|iframe|img|div|span)[^>]*>/i, // Specific dangerous tags

      // Shell commands (enhanced)
      /\b(bash|sh|cmd|powershell)\s+-[a-z]/i, // Shell interpreters with flags
      /\b(curl|wget|nc|nmap|sqlmap)\s+/i, // Network tools
      /\b(rm|del|rmdir)\s+/i, // File deletion
      /\|\s*(sh|bash|cmd)/i, // Pipe to shell
      /^\s*echo\s+/i, // Echo commands (start of line)
      /^\s*(GET|POST)\s+\//i, // HTTP methods (start of line)

      // Template/Expression injection
      /\{\{.*\}\}/, // Template expressions
      /\$\{.*\}/, // Template literals
      /\#set\(\$\w+/i, // Velocity templates

      // Encoding/Eval patterns
      /\b(eval|exec|system)\s*\(/i, // Code execution
      /\b(atob|btoa|base64)\s*\(/i, // Encoding functions
      /\\u[0-9a-fA-F]{4}/, // Unicode escapes
      /%[0-9a-fA-F]{2}/, // URL encoding

      // JSON with suspicious patterns
      /\{"?__proto__"?\s*:/i, // Prototype pollution
      /\{"?constructor"?\s*:/i, // Constructor pollution

      // Console/Debug statements (stricter)
      /\bconsole\.(log|error|warn|debug)\s*\(/i, // Console methods
      /\bprint\s*\(/, // Print statements (Python/others)

      // Import/Include statements (stricter)
      /\b(import|from|include|require)\s+['"][^'"]+['"]/i, // Quoted imports
      /\#include\s*<[^>]+>/i, // C includes

      // DOM manipulation and browser APIs
      /\b(document|window)\.(querySelector|getElementById|innerHTML|location)/i,
      /\b(localStorage|sessionStorage|eval|setTimeout|setInterval)\s*\(/i,

      // Environment variables and shell patterns
      /\bexport\s+\w+=.*;\s*\$\w+/i, // export VAR=value; $VAR
      /\$\{\w+\}/, // ${VARIABLE}

      // JSON objects (stricter pattern)
      /^\s*\{\s*"[^"]+"\s*:\s*"[^"]+"/i // Starting with JSON-like structure
    ];

    // Context-based analysis
    const contextAnalysis = this.analyzeContentContext(text);

    // If it has high code density and low personal indicators, likely code
    if (contextAnalysis.codeDensity > 0.3 && contextAnalysis.personalIndicators < 0.2) {
      return true;
    }

    // Check against all patterns
    return corePatterns.some((pattern) => pattern.test(text));
  }

  /**
   * Analyze if text is a legitimate personal description that mentions technical terms
   */
  isLegitimatePersonalTechDescription(text) {
    // Personal context indicators
    const personalContexts = [
      /\b(soy|me|mi|trabajo|experiencia|años|especializo|dedico)\b/gi,
      /\b(my|i\s+am|work|experience|years|specialize|passionate)\b/gi,
      /\b(trabajo\s+(con|en|como)|experiencia\s+en|me\s+gusta)\b/gi,
      /\b(work\s+with|experience\s+with|passionate\s+about)\b/gi
    ];

    const hasPersonalContext = personalContexts.some(
      (pattern) => (text.match(pattern) || []).length > 0
    );

    // Technical terms that are OK in personal context
    const technicalInPersonalContext = [
      /\b(JavaScript|Python|HTML|CSS|SQL|programming|desarrollo|programación)\b/gi,
      /\b(frontend|backend|full.stack|developer|desarrollador)\b/gi,
      /\b(framework|library|API|database|servidor|server)\b/gi,
      /\b(React|Node\.js|Express|MongoDB|PostgreSQL|Django)\b/gi,
      /\b(web|aplicaciones|sistemas|tecnología|technology)\b/gi
    ];

    const hasTechnicalTerms = technicalInPersonalContext.some(
      (pattern) => (text.match(pattern) || []).length > 0
    );

    // If it has personal context AND technical terms, it's likely legitimate
    return hasPersonalContext && hasTechnicalTerms;
  }

  /**
   * Analyze content context to distinguish code from natural language
   */
  analyzeContentContext(text) {
    const length = text.length;
    if (length === 0) return { codeDensity: 0, personalIndicators: 0 };

    // Code density indicators
    const codeIndicators = [
      /[{}();]/g, // Code punctuation
      /[=+\-*/<>!&|]/g, // Operators
      /["'`]/g, // String delimiters
      /\b[A-Z_][A-Z0-9_]*\b/g, // Constants/screaming snake case
      /\b(var|let|const|def|class|if|for|function|return)\b/g // Keywords
    ];

    const codeMatches = codeIndicators.reduce((total, pattern) => {
      return total + (text.match(pattern) || []).length;
    }, 0);

    // Personal language indicators
    const personalIndicators = [
      /\b(soy|me|mi|mis|yo|trabajo|gusta|molesta|años)\b/gi,
      /\b(my|i|me|work|like|love|hate|years|experience)\b/gi,
      /\b(passionate|dedicated|professional|career|specialist)\b/gi
    ];

    const personalMatches = personalIndicators.reduce((total, pattern) => {
      return total + (text.match(pattern) || []).length;
    }, 0);

    return {
      codeDensity: Math.min(codeMatches / length, 1.0),
      personalIndicators: Math.min(personalMatches / length, 1.0)
    };
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
      /\b(soy|me|mi|mis|yo|my|i|me)\b/i, // Personal pronouns
      /\b(gusta|molesta|afecta|importa|like|love|hate)\b/i, // Personal preferences
      /\b(trans|gay|lesbian|straight|hetero)\b/i, // Identity terms
      /\b(vegana?|carnívora?|vegetariana?)\b/i, // Dietary preferences
      /\b(gamer|deportista|artista|estudiante)\b/i, // Activities/roles
      /\b(peso|altura|pelo|calvicie|appearance)\b/i, // Physical characteristics
      /\b(política|religión|football|música)\b/i // Topics of interest/sensitivity
    ];

    const hasPersonalIndicators = personalIndicators.some((pattern) => pattern.test(trimmedText));

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
