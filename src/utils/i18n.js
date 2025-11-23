const path = require('path');
const { logger } = require('./logger');

/**
 * Generic Internationalization utility for Roastr.ai
 *
 * Thread-safe implementation without global state management.
 * Provides comprehensive translation capabilities for the entire application.
 * Supports English (en) and Spanish (es) with fallback to English.
 * Uses JSON locale files organized by domain for translations.
 */
class I18n {
  constructor() {
    this.defaultLanguage = 'en';
    this.supportedLanguages = ['en', 'es'];
    this.locales = new Map();

    // Load supported locales
    this.loadLocales();
  }

  /**
   * Get configured language from environment with fallback
   */
  getConfiguredLanguage() {
    const envLang = process.env.APP_LANG || process.env.ALERT_LANG; // Backward compatibility

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
   * Translate a key with explicit language parameter (thread-safe)
   *
   * @param {string} key - Translation key (dot notation, e.g., 'auth.login.title')
   * @param {string} language - Language code
   * @param {object} params - Interpolation parameters
   * @returns {string} Translated text or key if not found
   */
  t(key, language = this.defaultLanguage, params = {}) {
    // Validate inputs
    if (!key || typeof key !== 'string') {
      return String(key);
    }

    // Validate language
    if (!language || !this.supportedLanguages.includes(language)) {
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
    return this.interpolate(translation, params);
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
   * Get current language from environment (for backwards compatibility)
   */
  getCurrentLanguage() {
    const envLang = process.env.APP_LANG || process.env.ALERT_LANG;

    if (envLang && this.supportedLanguages.includes(envLang.toLowerCase())) {
      return envLang.toLowerCase();
    }

    return this.defaultLanguage;
  }

  /**
   * Set language (backwards compatibility - deprecated)
   * WARNING: This method is deprecated to avoid race conditions in concurrent applications
   * Use explicit language parameter in t() method instead
   */
  setLanguage(language) {
    this.log(
      'warn',
      'setLanguage() is deprecated to avoid race conditions. Use t(key, language, params) instead.',
      {
        language,
        calledFrom: new Error().stack.split('\n')[2]
      }
    );
    return this.isLanguageSupported(language);
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
      currentLanguage: this.getCurrentLanguage(),
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
   * Get available domains from a specific locale
   *
   * @param {string} language - Language code (optional, defaults to default language)
   * @returns {string[]} Array of available domains
   */
  getAvailableDomains(language = this.defaultLanguage) {
    const locale = this.locales.get(language) || this.locales.get(this.defaultLanguage);
    return locale ? Object.keys(locale).filter((key) => key !== '_comment') : [];
  }

  /**
   * Check if a domain exists
   *
   * @param {string} domain - Domain name to check
   * @param {string} language - Language code (optional)
   * @returns {boolean} True if domain exists
   */
  hasDomain(domain, language = this.defaultLanguage) {
    return this.getAvailableDomains(language).includes(domain);
  }

  /**
   * Get all keys for a specific domain
   *
   * @param {string} domain - Domain name
   * @param {string} language - Language code (optional)
   * @returns {object} Object with all keys in the domain
   */
  getDomainKeys(domain, language = this.defaultLanguage) {
    const locale = this.locales.get(language) || this.locales.get(this.defaultLanguage);
    return locale && locale[domain] ? locale[domain] : {};
  }

  /**
   * Logging utility
   */
  log(level, message, metadata = {}) {
    if (logger && typeof logger[level] === 'function') {
      logger[level](`[I18n] ${message}`, metadata);
    } else {
      console.log(`[${level.toUpperCase()}] I18n: ${message}`, metadata);
    }
  }
}

// Create singleton instance
const i18n = new I18n();

/**
 * Main translation function with explicit language parameter (thread-safe)
 *
 * @param {string} key - Translation key
 * @param {string} language - Language code
 * @param {object} params - Interpolation parameters
 * @returns {string} Translated text
 */
function t(key, language = i18n.getDefaultLanguage(), params = {}) {
  return i18n.t(key, language, params);
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
  return i18n.t(key, language, params);
}

/**
 * Get translation for specific domain (convenience function)
 *
 * @param {string} domain - Domain name (e.g., 'auth', 'ui')
 * @param {string} key - Key within domain
 * @param {string} language - Language code (optional)
 * @param {object} params - Interpolation parameters
 * @returns {string} Translated text
 */
function td(domain, key, language = i18n.getDefaultLanguage(), params = {}) {
  return i18n.t(`${domain}.${key}`, language, params);
}

module.exports = {
  I18n,
  i18n,
  t,
  tl,
  td
};
