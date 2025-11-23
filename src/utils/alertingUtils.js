const path = require('path');
const { logger } = require('./logger');

/**
 * Internationalization utility for alerting system
 *
 * Provides simple translation capabilities for alert messages and CLI text.
 * Supports English (en) and Spanish (es) with fallback to English.
 * Uses JSON locale files for translations.
 */
class AlertingI18n {
  constructor() {
    this.defaultLanguage = 'en';
    this.supportedLanguages = ['en', 'es'];
    this.locales = new Map();
    this.currentLanguage = this.getConfiguredLanguage();

    // Load supported locales
    this.loadLocales();
  }

  /**
   * Get configured language from environment with fallback
   */
  getConfiguredLanguage() {
    const envLang = process.env.ALERT_LANG;

    if (envLang && this.supportedLanguages.includes(envLang.toLowerCase())) {
      return envLang.toLowerCase();
    }

    return this.defaultLanguage;
  }

  /**
   * Load all locale files
   */
  loadLocales() {
    for (const lang of this.supportedLanguages) {
      try {
        const localePath = path.join(__dirname, '..', 'locales', `${lang}.json`);
        const localeData = require(localePath);
        this.locales.set(lang, localeData);

        this.log('debug', `Loaded locale: ${lang}`, {
          keys: Object.keys(localeData).length
        });
      } catch (error) {
        this.log('warn', `Failed to load locale: ${lang}`, {
          error: error.message
        });

        // If we can't load the default language, this is critical
        if (lang === this.defaultLanguage) {
          this.log('error', 'Critical: Cannot load default language locale', {
            language: this.defaultLanguage,
            error: error.message
          });
        }
      }
    }
  }

  /**
   * Translate a key with optional interpolation
   *
   * @param {string} key - Translation key (dot notation, e.g., 'alert.titles.worker_error')
   * @param {string|object} langOrParams - Language code or interpolation parameters
   * @param {object} params - Interpolation parameters (if langOrParams is language)
   * @returns {string} Translated text or key if not found
   */
  t(key, langOrParams = {}, params = {}) {
    // Handle function overloading: t(key, params) vs t(key, lang, params)
    let language = this.currentLanguage;
    let interpolationParams = {};

    if (typeof langOrParams === 'string') {
      language = langOrParams;
      interpolationParams = params;
    } else if (typeof langOrParams === 'object') {
      interpolationParams = langOrParams;
    }

    // Validate language
    if (!this.supportedLanguages.includes(language)) {
      language = this.defaultLanguage;
    }

    // Try to get translation in requested language
    let translation = this.getTranslation(key, language);

    // Fallback to default language if not found
    if (!translation && language !== this.defaultLanguage) {
      translation = this.getTranslation(key, this.defaultLanguage);

      this.log('debug', 'Translation fallback used', {
        key,
        requestedLanguage: language,
        fallbackLanguage: this.defaultLanguage
      });
    }

    // Return key if no translation found
    if (!translation) {
      this.log('warn', 'Translation not found', { key, language });
      return key;
    }

    // Interpolate parameters
    return this.interpolate(translation, interpolationParams);
  }

  /**
   * Get translation from locale data
   *
   * @param {string} key - Dot notation key
   * @param {string} language - Language code
   * @returns {string|null} Translation or null if not found
   */
  getTranslation(key, language) {
    const locale = this.locales.get(language);
    if (!locale) return null;

    // Navigate through nested object using dot notation
    const keys = key.split('.');
    let current = locale;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return null;
      }
    }

    return typeof current === 'string' ? current : null;
  }

  /**
   * Interpolate parameters into translation string
   *
   * @param {string} text - Text with placeholders like {param}
   * @param {object} params - Parameters to interpolate
   * @returns {string} Interpolated text
   */
  interpolate(text, params) {
    if (!params || typeof params !== 'object') {
      return text;
    }

    return text.replace(/\{([^}]+)\}/g, (match, param) => {
      if (param in params) {
        return String(params[param]);
      }

      // Log missing parameter
      this.log('debug', 'Missing interpolation parameter', {
        param,
        text: text.substring(0, 50) + '...'
      });

      return match; // Return original placeholder if param not found
    });
  }

  /**
   * Set the current language
   *
   * @param {string} language - Language code
   * @returns {boolean} True if language was set, false if not supported
   */
  setLanguage(language) {
    if (!this.supportedLanguages.includes(language)) {
      this.log('warn', 'Unsupported language requested', {
        language,
        supported: this.supportedLanguages
      });
      return false;
    }

    this.currentLanguage = language;

    this.log('info', 'Language changed', {
      language,
      previousLanguage: this.currentLanguage
    });

    return true;
  }

  /**
   * Get current language
   *
   * @returns {string} Current language code
   */
  getCurrentLanguage() {
    return this.currentLanguage;
  }

  /**
   * Get default language
   *
   * @returns {string} Default language code
   */
  getDefaultLanguage() {
    return this.defaultLanguage;
  }

  /**
   * Get list of supported languages
   *
   * @returns {string[]} Array of supported language codes
   */
  getSupportedLanguages() {
    return [...this.supportedLanguages];
  }

  /**
   * Check if a language is supported
   *
   * @param {string} language - Language code to check
   * @returns {boolean} True if supported
   */
  isLanguageSupported(language) {
    return this.supportedLanguages.includes(language);
  }

  /**
   * Get translation statistics
   *
   * @returns {object} Statistics about loaded locales
   */
  getStats() {
    const stats = {
      currentLanguage: this.currentLanguage,
      defaultLanguage: this.defaultLanguage,
      supportedLanguages: this.supportedLanguages,
      loadedLocales: Array.from(this.locales.keys()),
      localeStats: {}
    };

    // Count keys in each locale
    for (const [lang, locale] of this.locales.entries()) {
      stats.localeStats[lang] = this.countKeys(locale);
    }

    return stats;
  }

  /**
   * Count keys in nested object (for statistics)
   *
   * @param {object} obj - Object to count keys in
   * @returns {number} Total key count
   */
  countKeys(obj) {
    let count = 0;

    function traverse(current) {
      for (const key in current) {
        if (typeof current[key] === 'object' && current[key] !== null) {
          traverse(current[key]);
        } else {
          count++;
        }
      }
    }

    traverse(obj);
    return count;
  }

  /**
   * Reload all locales (useful for development)
   */
  reloadLocales() {
    this.locales.clear();
    this.loadLocales();

    this.log('info', 'Locales reloaded', {
      loadedLocales: Array.from(this.locales.keys())
    });
  }

  /**
   * Logging utility
   */
  log(level, message, metadata = {}) {
    if (logger && typeof logger[level] === 'function') {
      logger[level](`[AlertingI18n] ${message}`, metadata);
    } else {
      console.log(`[${level.toUpperCase()}] AlertingI18n: ${message}`, metadata);
    }
  }
}

// Create singleton instance
const alertingI18n = new AlertingI18n();

/**
 * Main translation function (shorthand)
 *
 * @param {string} key - Translation key
 * @param {string|object} langOrParams - Language or parameters
 * @param {object} params - Parameters (if second argument is language)
 * @returns {string} Translated text
 */
function t(key, langOrParams, params) {
  return alertingI18n.t(key, langOrParams, params);
}

/**
 * Translation function with explicit language
 *
 * @param {string} key - Translation key
 * @param {string} language - Language code
 * @param {object} params - Interpolation parameters
 * @returns {string} Translated text
 */
function tl(key, language, params = {}) {
  return alertingI18n.t(key, language, params);
}

module.exports = {
  AlertingI18n,
  alertingI18n,
  t,
  tl
};
