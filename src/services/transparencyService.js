/**
 * User-Configurable Transparency Service (Issue #193)
 * 
 * This service handles AI transparency based on user preferences:
 * - bio: User adds disclaimer to their bio, no modification to roasts
 * - signature: Fixed signature appended to all roasts  
 * - creative: Random creative disclaimers appended to roasts
 * 
 * Backwards compatible with existing unified approach for migration.
 * 
 * Features:
 * - User-configurable transparency modes
 * - Bio text suggestions with copy functionality
 * - Creative disclaimers pool management
 * - Language detection and localization
 */

const { supabaseServiceClient } = require('../config/supabase');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');
const {
  CHARACTER_LIMIT_THRESHOLD,
  SHORT_SIGNATURE_PROBABILITY,
  BIO_RECOMMENDATION_TEXT,
  SHORT_SIGNATURES,
  CREATIVE_DISCLAIMERS,
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  LANGUAGE_PATTERNS,
  LANGUAGE_DETECTION_THRESHOLD,
  STATS_RETENTION_HOURS,
  LOG_LEVEL,
  LOG_MESSAGES
} = require('../config/transparencyConfig');

class TransparencyService {
  constructor() {
    // Use static configuration instead of recreating pools
    this.config = {
      characterLimitThreshold: CHARACTER_LIMIT_THRESHOLD,
      shortSignatureProbability: SHORT_SIGNATURE_PROBABILITY,
      defaultLanguage: DEFAULT_LANGUAGE,
      supportedLanguages: SUPPORTED_LANGUAGES,
      statsRetentionHours: STATS_RETENTION_HOURS
    };
  }

  /**
   * Detect language of given text using pattern matching (Issue #199)
   * @param {string} text - Text to analyze
   * @returns {string} - Detected language code or default language
   */
  detectLanguage(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return this.config.defaultLanguage;
    }

    const cleanText = text.toLowerCase().trim();
    const scores = {};
    
    // Initialize scores for supported languages
    this.config.supportedLanguages.forEach(lang => {
      scores[lang] = 0;
    });

    // Count pattern matches for each language
    for (const [language, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
      if (!this.config.supportedLanguages.includes(language)) continue;
      
      patterns.forEach(pattern => {
        const matches = cleanText.match(pattern);
        if (matches) {
          scores[language] += matches.length;
        }
      });
    }

    // Calculate total matches and find the language with highest score
    const totalMatches = Object.values(scores).reduce((sum, score) => sum + score, 0);
    
    if (totalMatches === 0) {
      return this.config.defaultLanguage;
    }

    // Find language with highest confidence
    let bestLanguage = this.config.defaultLanguage;
    let bestScore = 0;
    
    for (const [language, score] of Object.entries(scores)) {
      const confidence = score / totalMatches;
      if (confidence > bestScore && confidence >= LANGUAGE_DETECTION_THRESHOLD) {
        bestScore = confidence;
        bestLanguage = language;
      }
    }

    logger[LOG_LEVEL.LANGUAGE_DETECTED](LOG_MESSAGES.es.LANGUAGE_DETECTED, {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      detectedLanguage: bestLanguage,
      confidence: Math.round(bestScore * 100) / 100,
      scores
    });

    return bestLanguage;
  }

  /**
   * Get user's transparency mode from database (Issue #193)
   * @param {string} userId - User ID
   * @returns {Promise<string>} - Transparency mode ('bio', 'signature', 'creative')
   */
  async getUserTransparencyMode(userId) {
    try {
      if (!flags.isEnabled('ENABLE_SUPABASE')) {
        // In mock mode, return bio as default
        return 'bio';
      }

      const { data, error } = await supabaseServiceClient
        .from('users')
        .select('transparency_mode')
        .eq('id', userId)
        .single();

      if (error) {
        logger[LOG_LEVEL.DATABASE_ERROR]('Error fetching user transparency mode:', error);
        return 'bio'; // Default fallback
      }

      return data?.transparency_mode || 'bio';
      
    } catch (error) {
      logger[LOG_LEVEL.DATABASE_ERROR]('Error in getUserTransparencyMode:', error);
      return 'bio'; // Default fallback
    }
  }

  /**
   * Select disclaimer based on rotation logic and character constraints
   * @param {string} language - Language code (es, en)
   * @param {number} roastLength - Current roast character count
   * @param {number} platformLimit - Platform character limit (e.g., 280 for Twitter)
   * @returns {Object} - { disclaimer, type }
   */
  selectDisclaimer(language = this.config.defaultLanguage, roastLength = 0, platformLimit = null) {
    // Use static pools from configuration to avoid recreation
    const shortPool = SHORT_SIGNATURES[language] || SHORT_SIGNATURES[this.config.defaultLanguage];
    const creativePool = CREATIVE_DISCLAIMERS[language] || CREATIVE_DISCLAIMERS[this.config.defaultLanguage];
    
    // If approaching character limit, always use short signature (configurable threshold)
    if (platformLimit && roastLength > platformLimit * this.config.characterLimitThreshold) {
      const disclaimer = shortPool[Math.floor(Math.random() * shortPool.length)];
      return { disclaimer, type: 'short' };
    }
    
    // Normal rotation: configurable probability for short vs creative
    const useShort = Math.random() < this.config.shortSignatureProbability;
    
    if (useShort) {
      const disclaimer = shortPool[Math.floor(Math.random() * shortPool.length)];
      return { disclaimer, type: 'short' };
    } else {
      const disclaimer = creativePool[Math.floor(Math.random() * creativePool.length)];
      return { disclaimer, type: 'creative' };
    }
  }

  /**
   * Apply transparency disclaimer based on user's preference (Issue #193)
   * @param {string} roastText - Original roast text
   * @param {string} userId - User ID to fetch transparency preference
   * @param {string} language - Language code (es, en) - optional, will auto-detect if not provided
   * @param {number} platformLimit - Platform character limit (optional)
   * @param {string} originalComment - Original comment for language detection (optional)
   * @returns {Promise<Object>} - { finalText, disclaimerType, disclaimer, detectedLanguage, transparencyMode, bioText }
   */
  async applyTransparencyDisclaimer(roastText, userId, language = null, platformLimit = null, originalComment = null) {
    try {
      // Auto-detect language if not provided
      let finalLanguage = language;
      if (!finalLanguage) {
        // Try to detect from original comment first, then from roast text
        const textToAnalyze = originalComment || roastText;
        finalLanguage = this.detectLanguage(textToAnalyze);
      }
      
      // Get user's transparency mode preference
      const userTransparencyMode = await this.getUserTransparencyMode(userId);
      
      // Handle each transparency mode according to Issue #193
      let finalText = roastText;
      let disclaimerType = null;
      let disclaimer = null;
      let bioText = null;
      
      switch (userTransparencyMode) {
        case 'bio':
          // No modification to roast - user should add disclaimer to bio
          finalText = roastText;
          disclaimerType = 'bio';
          disclaimer = null;
          bioText = this.getBioText(finalLanguage);
          break;
          
        case 'signature':
          // Append fixed signature
          disclaimer = finalLanguage === 'es' ? '— Generado por Roastr.AI' : '— Generated by Roastr.AI';
          finalText = roastText + '\n\n' + disclaimer;
          disclaimerType = 'signature';
          break;
          
        case 'creative':
          // Append random creative disclaimer from pool
          const creativePool = CREATIVE_DISCLAIMERS[finalLanguage] || CREATIVE_DISCLAIMERS[this.config.defaultLanguage];
          disclaimer = creativePool[Math.floor(Math.random() * creativePool.length)];
          finalText = roastText + '\n\n' + disclaimer;
          disclaimerType = 'creative';
          break;
          
        default:
          // Fallback to bio mode
          finalText = roastText;
          disclaimerType = 'bio';
          disclaimer = null;
          bioText = this.getBioText(finalLanguage);
      }

      logger[LOG_LEVEL.DISCLAIMER_APPLIED](LOG_MESSAGES.es.DISCLAIMER_APPLIED, {
        userId: userId.substring(0, 8) + '...',
        transparencyMode: userTransparencyMode,
        disclaimerType: disclaimerType,
        language: finalLanguage,
        languageSource: language ? 'provided' : 'detected',
        roastLength: roastText.length,
        finalLength: finalText.length,
        platformLimit
      });

      return {
        finalText,
        disclaimerType,
        disclaimer,
        detectedLanguage: finalLanguage,
        transparencyMode: userTransparencyMode,
        bioText
      };

    } catch (error) {
      logger[LOG_LEVEL.SERVICE_ERROR](LOG_MESSAGES.es.SERVICE_ERROR, error);
      
      // Safe fallback - default to bio mode (Issue #193)
      const fallbackLanguage = language || this.config.defaultLanguage;
      const bioText = this.getBioText(fallbackLanguage);
      
      return {
        finalText: roastText, // No modification for bio mode
        disclaimerType: 'bio',
        disclaimer: null,
        detectedLanguage: fallbackLanguage,
        transparencyMode: 'bio',
        bioText
      };
    }
  }

  /**
   * Get bio recommendation text for a given language (Issue #196, Enhanced #199)
   * @param {string} language - Language code
   * @returns {string} - Bio recommendation text
   */
  getBioText(language = this.config.defaultLanguage) {
    return BIO_RECOMMENDATION_TEXT[language] || BIO_RECOMMENDATION_TEXT[this.config.defaultLanguage];
  }

  /**
   * Get transparency explanation and options for frontend (Issue #193)
   * @param {string} language - Language code
   * @returns {Object} - Transparency explanation with 3 configurable options
   */
  getTransparencyExplanation(language = 'es') {
    const explanations = {
      es: {
        title: 'Transparencia de IA',
        description: 'Por cumplimiento de las políticas de OpenAI y redes sociales, puedes elegir cómo identificar que algunas respuestas son generadas por Roastr. No es una obligación pesada, sino una opción de personalización.',
        options: [
          {
            value: 'bio',
            title: 'Aviso en Bio (recomendado)',
            description: 'Añades el texto sugerido en tu bio. Los roasts no incluyen ningún aviso adicional.',
            isDefault: true,
            bioText: this.getBioText(language),
            buttonText: 'Copiar texto'
          },
          {
            value: 'signature',
            title: 'Firma clásica',
            description: 'Cada roast termina con "— Generado por Roastr.AI".',
            isDefault: false
          },
          {
            value: 'creative',
            title: 'Disclaimers creativos',
            description: 'Cada roast termina con un disclaimer aleatorio divertido del pool predefinido.',
            isDefault: false
          }
        ]
      },
      en: {
        title: 'AI Transparency',
        description: 'To comply with OpenAI and social media policies, you can choose how to identify that some responses are generated by Roastr. It\'s not a heavy obligation, but a personalization option.',
        options: [
          {
            value: 'bio',
            title: 'Bio Notice (recommended)',
            description: 'You add the suggested text to your bio. Roasts don\'t include any additional notice.',
            isDefault: true,
            bioText: this.getBioText(language),
            buttonText: 'Copy text'
          },
          {
            value: 'signature',
            title: 'Classic signature',
            description: 'Each roast ends with "— Generated by Roastr.AI".',
            isDefault: false
          },
          {
            value: 'creative',
            title: 'Creative disclaimers',
            description: 'Each roast ends with a random funny disclaimer from the predefined pool.',
            isDefault: false
          }
        ]
      }
    };

    return explanations[language] || explanations.es;
  }

  /**
   * DEPRECATED: Legacy method kept for backwards compatibility
   * @deprecated Use getTransparencyExplanation() instead
   */
  getTransparencyOptions(language = 'es') {
    // Return empty array since options are no longer selectable
    logger[LOG_LEVEL.LANGUAGE_DETECTION_FAILED]('getTransparencyOptions() is deprecated - all roasts now include disclaimers');
    return [];
  }

  /**
   * Get complete transparency information for frontend in single call (Issue #199)
   * Optimizes multiple separate calls into one method with optional caching
   * @param {string} language - Language code
   * @param {string} userId - User ID for logging
   * @returns {Promise<Object>} - Complete transparency information
   */
  async getTransparencyInfo(language = this.config.defaultLanguage, userId = null) {
    const startTime = Date.now();
    
    try {
      // Get synchronous data (no DB calls)
      const explanation = this.getTransparencyExplanation(language);
      const bioText = this.getBioText(language);
      
      // Get async stats data (with error handling)
      let stats = null;
      try {
        stats = await this.getUsageStats();
      } catch (error) {
        logger[LOG_LEVEL.TRANSPARENCY_STATS_MISSING]('Failed to get transparency stats in unified call', { 
          userId: userId ? userId.substring(0, 8) + '...' : 'unknown',
          error: error.message 
        });
      }
      
      const processingTime = Date.now() - startTime;
      
      logger[LOG_LEVEL.TRANSPARENCY_INFO_RETRIEVED]('🚀 Unified transparency info retrieved', {
        userId: userId ? userId.substring(0, 8) + '...' : 'unknown',
        language,
        hasStats: !!stats,
        processingTimeMs: processingTime
      });
      
      return {
        explanation,
        bioText,
        stats,
        meta: {
          processingTimeMs: processingTime,
          language,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger[LOG_LEVEL.SERVICE_ERROR]('Error getting unified transparency info:', error);
      
      // Return safe fallback with minimal data
      return {
        explanation: this.getTransparencyExplanation(language),
        bioText: this.getBioText(language),
        stats: null,
        meta: {
          processingTimeMs: Date.now() - startTime,
          language,
          timestamp: new Date().toISOString(),
          error: error.message
        }
      };
    }
  }

  /**
   * Update disclaimer usage statistics with retry logic (Issue #196, Enhanced #199)
   * @param {string} disclaimerText - The disclaimer that was used
   * @param {string} disclaimerType - Type: 'short' or 'creative'
   * @param {string} language - Language code
   * @param {Object} options - Retry and fallback options
   * @returns {Promise<Object>} - Result with success/failure information
   */
  async updateDisclaimerStats(disclaimerText, disclaimerType, language = 'es', options = {}) {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      fallbackToLocal = true,
      context = {}
    } = options;
    
    const startTime = Date.now();
    let lastError = null;
    
    // Early validation
    if (!disclaimerText || typeof disclaimerText !== 'string') {
      return {
        success: false,
        reason: 'invalid_disclaimer_text',
        processingTimeMs: Date.now() - startTime
      };
    }
    
    // If Supabase is disabled, return success but log locally if fallback is enabled
    if (!flags.isEnabled('ENABLE_SUPABASE')) {
      if (fallbackToLocal) {
        logger[LOG_LEVEL.STATS_UPDATE_FALLBACK]('📊 Disclaimer stats (local fallback)', {
          disclaimerText: disclaimerText.substring(0, 50) + (disclaimerText.length > 50 ? '...' : ''),
          disclaimerType,
          language,
          context,
          timestamp: new Date().toISOString()
        });
      }
      
      return {
        success: true,
        reason: 'supabase_disabled_fallback_used',
        processingTimeMs: Date.now() - startTime
      };
    }

    // Retry logic with exponential backoff
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await supabaseServiceClient
          .from('transparency_disclaimer_usage')
          .insert([{
            disclaimer_text: disclaimerText,
            disclaimer_type: disclaimerType,
            language: language,
            used_at: new Date().toISOString(),
            context_data: context.organizationId ? { organizationId: context.organizationId } : null
          }]);

        // Success - log and return
        logger[LOG_LEVEL.STATS_UPDATED]('📊 Disclaimer stats updated', {
          disclaimerType,
          language,
          attempt,
          processingTimeMs: Date.now() - startTime,
          context
        });

        return {
          success: true,
          attempt,
          processingTimeMs: Date.now() - startTime
        };

      } catch (error) {
        lastError = error;
        
        // Log each failure
        logger[LOG_LEVEL.STATS_UPDATE_RETRY](`📊 Disclaimer stats update failed (attempt ${attempt}/${maxRetries})`, {
          disclaimerType,
          language,
          attempt,
          error: error.message,
          context
        });

        // If not the last attempt, wait before retrying
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed - use fallback if enabled
    if (fallbackToLocal) {
      logger[LOG_LEVEL.STATS_UPDATE_FALLBACK]('📊 All retries failed, using local fallback logging', {
        disclaimerText: disclaimerText.substring(0, 50) + (disclaimerText.length > 50 ? '...' : ''),
        disclaimerType,
        language,
        finalError: lastError.message,
        context,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: false,
        reason: 'max_retries_exceeded_fallback_used',
        error: lastError.message,
        processingTimeMs: Date.now() - startTime
      };
    }

    // Complete failure
    logger[LOG_LEVEL.DATABASE_ERROR]('📊 Disclaimer stats update completely failed', {
      disclaimerType,
      language,
      error: lastError.message,
      context,
      processingTimeMs: Date.now() - startTime
    });

    return {
      success: false,
      reason: 'max_retries_exceeded_no_fallback',
      error: lastError.message,
      processingTimeMs: Date.now() - startTime
    };
  }

  /**
   * Get statistics about disclaimer usage rotation
   * @returns {Promise<Object>} - Usage statistics
   */
  async getUsageStats() {
    try {
      if (!flags.isEnabled('ENABLE_SUPABASE')) {
        return {
          shortSignatureUsage: 70,
          creativeDisclaimerUsage: 30,
          totalDisclaimers: 100
        };
      }

      const retentionMs = this.config.statsRetentionHours * 60 * 60 * 1000;
      const { data, error } = await supabaseServiceClient
        .from('transparency_disclaimer_usage')
        .select('disclaimer_type')
        .gte('used_at', new Date(Date.now() - retentionMs).toISOString());

      if (error) throw error;

      const total = data.length;
      const shortCount = data.filter(item => item.disclaimer_type === 'short').length;
      const creativeCount = data.filter(item => item.disclaimer_type === 'creative').length;

      return {
        shortSignatureUsage: total > 0 ? Math.round((shortCount / total) * 100) : 70,
        creativeDisclaimerUsage: total > 0 ? Math.round((creativeCount / total) * 100) : 30,
        totalDisclaimers: total
      };

    } catch (error) {
      logger[LOG_LEVEL.DATABASE_ERROR]('Failed to get usage stats:', error);
      return {
        shortSignatureUsage: 70,
        creativeDisclaimerUsage: 30,
        totalDisclaimers: 0
      };
    }
  }
}

module.exports = new TransparencyService();