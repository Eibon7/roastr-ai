/**
 * Unified Transparency Service (Issue #196, Enhanced Issue #199)
 * 
 * This service handles mandatory transparency disclaimers for all AI-generated roasts.
 * All roasts now include disclaimers with 70% short signatures, 30% creative disclaimers.
 * Bio recommendation remains as optional user guidance.
 * 
 * Optimizations (Issue #199):
 * - Static pools to avoid recreation on each instance
 * - Configurable constants instead of magic numbers
 * - Improved performance and maintainability
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
   * Apply mandatory transparency disclaimer to ALL roasts (Issue #196, Enhanced #199)
   * @param {string} roastText - Original roast text
   * @param {string} userId - User ID (kept for compatibility, not used for decision)
   * @param {string} language - Language code (es, en) - optional, will auto-detect if not provided
   * @param {number} platformLimit - Platform character limit (optional)
   * @param {string} originalComment - Original comment for language detection (optional)
   * @returns {Promise<Object>} - { finalText, disclaimerType, disclaimer, detectedLanguage }
   */
  async applyTransparencyDisclaimer(roastText, userId, language = null, platformLimit = null, originalComment = null) {
    try {
      // Auto-detect language if not provided (Issue #199)
      let finalLanguage = language;
      if (!finalLanguage) {
        // Try to detect from original comment first, then from roast text
        const textToAnalyze = originalComment || roastText;
        finalLanguage = this.detectLanguage(textToAnalyze);
      }
      
      // All roasts now get disclaimers - select based on rotation logic
      const { disclaimer, type } = this.selectDisclaimer(finalLanguage, roastText.length, platformLimit);
      
      const finalText = roastText + '\n\n' + disclaimer;

      logger[LOG_LEVEL.DISCLAIMER_APPLIED](LOG_MESSAGES.es.DISCLAIMER_APPLIED, {
        userId: userId.substring(0, 8) + '...',
        disclaimerType: type,
        language: finalLanguage,
        languageSource: language ? 'provided' : 'detected',
        roastLength: roastText.length,
        finalLength: finalText.length,
        platformLimit
      });

      return {
        finalText,
        disclaimerType: type,
        disclaimer,
        detectedLanguage: finalLanguage,
        // Legacy compatibility - all roasts now have disclaimers
        transparencyMode: 'unified',
        bioText: null
      };

    } catch (error) {
      logger[LOG_LEVEL.SERVICE_ERROR](LOG_MESSAGES.es.SERVICE_ERROR, error);
      
      // Safe fallback - always return with short signature
      const fallbackLanguage = language || this.config.defaultLanguage;
      const shortPool = SHORT_SIGNATURES[fallbackLanguage] || SHORT_SIGNATURES[this.config.defaultLanguage];
      const fallbackDisclaimer = shortPool[0]; // Use first short signature as fallback
      
      return {
        finalText: roastText + '\n\n' + fallbackDisclaimer,
        disclaimerType: 'short',
        disclaimer: fallbackDisclaimer,
        detectedLanguage: fallbackLanguage,
        transparencyMode: 'unified',
        bioText: null
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
   * Get transparency explanation for frontend (Issue #196)
   * @param {string} language - Language code
   * @returns {Object} - Unified transparency explanation
   */
  getTransparencyExplanation(language = 'es') {
    const explanations = {
      es: {
        title: 'Transparencia en las respuestas',
        description: 'Por políticas de transparencia, todas las respuestas automáticas incluyen un aviso de que son generadas por IA. Además, puedes añadir en tu bio el texto sugerido para dar mayor visibilidad y protección.',
        bioRecommendation: this.getBioText(language),
        buttonText: 'Copiar texto para bio'
      },
      en: {
        title: 'Response transparency',
        description: 'Due to transparency policies, all automatic responses include a notice that they are AI-generated. Additionally, you can add the suggested text to your bio for greater visibility and protection.',
        bioRecommendation: this.getBioText(language),
        buttonText: 'Copy text for bio'
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