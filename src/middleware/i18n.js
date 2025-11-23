const { i18n } = require('../utils/i18n');
const { logger } = require('../utils/logger');

/**
 * Middleware to detect and set user language from Accept-Language header
 *
 * Supports:
 * - Accept-Language header parsing
 * - Quality value (q) parsing
 * - Fallback to default language
 * - User preference from database (if available)
 */
function detectLanguage(req, res, next) {
  try {
    // First check if user has a saved language preference
    if (req.user && req.user.language && i18n.isLanguageSupported(req.user.language)) {
      req.language = req.user.language;
      return next();
    }

    // Parse Accept-Language header
    const acceptLanguage = req.headers['accept-language'];

    if (!acceptLanguage) {
      req.language = i18n.getDefaultLanguage();
      return next();
    }

    // Parse the header value
    const languages = parseAcceptLanguage(acceptLanguage);

    // Find the first supported language
    for (const lang of languages) {
      const langCode = lang.code.toLowerCase().split('-')[0]; // Handle en-US -> en

      // Validate language code format (simple regex for safety)
      if (!isValidLanguageCode(langCode)) {
        logger.debug('Invalid language code format', { langCode });
        continue;
      }

      if (i18n.isLanguageSupported(langCode)) {
        req.language = langCode;

        logger.debug('Language detected from Accept-Language header', {
          acceptLanguage,
          detectedLanguage: langCode,
          userId: req.user?.id
        });

        return next();
      }
    }

    // No supported language found, use default
    req.language = i18n.getDefaultLanguage();
    next();
  } catch (error) {
    logger.error('Error detecting language', {
      error: error.message,
      acceptLanguage: req.headers['accept-language']
    });

    // On error, use default language
    req.language = i18n.getDefaultLanguage();
    next();
  }
}

/**
 * Parse Accept-Language header
 *
 * @param {string} acceptLanguage - Accept-Language header value
 * @returns {Array} Array of language objects sorted by quality
 */
function parseAcceptLanguage(acceptLanguage) {
  if (!acceptLanguage || typeof acceptLanguage !== 'string') {
    return [];
  }

  // Split by comma and parse each language
  const languages = acceptLanguage
    .split(',')
    .map((lang) => {
      const parts = lang.trim().split(';');
      const code = parts[0];

      // Extract quality value (default to 1)
      let quality = 1;
      if (parts[1]) {
        const qMatch = parts[1].match(/q=([0-9.]+)/);
        if (qMatch) {
          quality = parseFloat(qMatch[1]) || 0;
        }
      }

      return { code, quality };
    })
    .filter((lang) => lang.code && lang.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  return languages;
}

/**
 * Validate language code format
 *
 * @param {string} langCode - Language code to validate
 * @returns {boolean} True if valid language code format
 */
function isValidLanguageCode(langCode) {
  // Simple regex for ISO 639-1 language codes (2 lowercase letters)
  return /^[a-z]{2}$/.test(langCode);
}

/**
 * Express helper to get translated text in views
 *
 * Usage in templates:
 * <%= t('auth.login.title') %>
 * <%= t('plan.validation.roasts_exceed_limit', { current: 100, limit: 50 }) %>
 */
function i18nHelpers(req, res, next) {
  // Add translation function to response locals for use in templates
  res.locals.t = (key, params) => {
    const language = req.language || i18n.getDefaultLanguage();
    return i18n.t(key, language, params);
  };

  res.locals.currentLanguage = req.language || i18n.getDefaultLanguage();
  res.locals.supportedLanguages = i18n.getSupportedLanguages();

  next();
}

/**
 * API endpoint to get available translations
 * Useful for frontend applications
 */
function getTranslations(req, res) {
  const language = req.language || i18n.getDefaultLanguage();
  const domain = req.query.domain;

  try {
    let translations;

    if (domain && i18n.hasDomain(domain, language)) {
      // Return specific domain translations
      translations = i18n.getDomainKeys(domain, language);
    } else {
      // Return all translations for the language
      const locale = i18n.locales.get(language);
      translations = locale || {};
    }

    res.json({
      success: true,
      language,
      translations,
      availableDomains: i18n.getAvailableDomains(language)
    });
  } catch (error) {
    logger.error('Error getting translations', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve translations'
    });
  }
}

/**
 * API endpoint to set user language preference
 * Validates language code, updates session and database
 * @param {Object} req - Express request object
 * @param {string} req.body.language - Language code to set
 * @param {Object} req.user - Authenticated user object (optional)
 * @param {Object} res - Express response object
 * @returns {Promise<void>} JSON response with success status
 */
async function setLanguage(req, res) {
  const { language } = req.body;
  const currentLanguage = req.language || i18n.getDefaultLanguage();

  if (!language) {
    return res.status(400).json({
      success: false,
      error: i18n.t('forms.validation.required', currentLanguage)
    });
  }

  // Validate language code format
  if (!isValidLanguageCode(language)) {
    return res.status(400).json({
      success: false,
      error: i18n.t('forms.validation.unsupported_language', currentLanguage),
      supportedLanguages: i18n.getSupportedLanguages()
    });
  }

  if (!i18n.isLanguageSupported(language)) {
    return res.status(400).json({
      success: false,
      error: i18n.t('forms.validation.unsupported_language', currentLanguage),
      supportedLanguages: i18n.getSupportedLanguages()
    });
  }

  try {
    // Store in session if available
    if (req.session) {
      req.session.language = language;
    }

    // Save to user preferences in database if user is authenticated
    if (req.user) {
      try {
        const { supabaseServiceClient } = require('../config/supabase');

        // Update user's language preference
        const { error: updateError } = await supabaseServiceClient
          .from('users')
          .update({
            language: language,
            updated_at: new Date().toISOString()
          })
          .eq('id', req.user.id);

        if (updateError) {
          logger.warn('Failed to save user language preference', {
            userId: req.user.id,
            language,
            error: updateError.message
          });
        } else {
          logger.debug('User language preference saved', {
            userId: req.user.id,
            language
          });
        }
      } catch (dbError) {
        logger.warn('Error saving language preference to database', {
          userId: req.user.id,
          language,
          error: dbError.message
        });
      }
    }

    res.json({
      success: true,
      language,
      message: i18n.t('ui.common.success', language)
    });
  } catch (error) {
    logger.error('Error setting language', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to set language preference'
    });
  }
}

module.exports = {
  detectLanguage,
  i18nHelpers,
  getTranslations,
  setLanguage,
  parseAcceptLanguage, // Exported for testing
  isValidLanguageCode // Exported for testing
};
