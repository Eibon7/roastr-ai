import { createContext, useContext, useState, useEffect, useMemo } from 'react';

// Import locale data
import enLocale from '../locales/en.json';
import esLocale from '../locales/es.json';

const locales = {
  en: enLocale,
  es: esLocale
};

const I18nContext = createContext();

/**
 * I18n Provider Component
 * Provides internationalization context to the React app
 */
export const I18nProvider = ({ children, defaultLanguage = 'en' }) => {
  const [language, setLanguage] = useState(() => {
    // Get language from environment, localStorage, or use default
    const envLang = process.env.REACT_APP_LANG || process.env.REACT_APP_APP_LANG;
    const savedLang = typeof window !== 'undefined' ? localStorage.getItem('app-language') : null;

    return envLang || savedLang || defaultLanguage;
  });

  const supportedLanguages = ['en', 'es'];

  useEffect(() => {
    // Save language preference to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('app-language', language);
    }
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage: (lang) => {
        if (supportedLanguages.includes(lang)) {
          setLanguage(lang);
        }
      },
      supportedLanguages,
      locales
    }),
    [language]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

/**
 * Hook for using internationalization in React components
 * @returns {object} i18n utilities
 */
export const useI18n = () => {
  const context = useContext(I18nContext);

  if (!context) {
    // Fallback when used outside provider
    return {
      language: 'en',
      setLanguage: () => {},
      supportedLanguages: ['en', 'es'],
      t: (key, params = {}) => key,
      td: (domain, key, params = {}) => key,
      tl: (key, lang, params = {}) => key
    };
  }

  const { language, setLanguage, supportedLanguages, locales } = context;

  /**
   * Get translation from locale data
   * @param {string} key - Dot notation key
   * @param {string} lang - Language code
   * @returns {string|null} Translation or null if not found
   */
  const getTranslation = (key, lang) => {
    const locale = locales[lang];
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
  };

  /**
   * Interpolate parameters into translation string
   * @param {string} text - Text with placeholders like {param}
   * @param {object} params - Parameters to interpolate
   * @returns {string} Interpolated text
   */
  const interpolate = (text, params) => {
    if (!params || typeof params !== 'object') {
      return text;
    }

    return text.replace(/\{([^}]+)\}/g, (match, param) => {
      if (param in params) {
        return String(params[param]);
      }
      return match; // Return original placeholder if param not found
    });
  };

  /**
   * Translate a key with optional interpolation
   * @param {string} key - Translation key (dot notation)
   * @param {object} params - Interpolation parameters
   * @returns {string} Translated text or key if not found
   */
  const t = (key, params = {}) => {
    // Try to get translation in current language
    let translation = getTranslation(key, language);

    // Fallback to English if not found
    if (!translation && language !== 'en') {
      translation = getTranslation(key, 'en');
    }

    // Return key if no translation found
    if (!translation) {
      return key;
    }

    // Interpolate parameters
    return interpolate(translation, params);
  };

  /**
   * Translation function with explicit language
   * @param {string} key - Translation key
   * @param {string} lang - Language code
   * @param {object} params - Interpolation parameters
   * @returns {string} Translated text
   */
  const tl = (key, lang, params = {}) => {
    // Try to get translation in specified language
    let translation = getTranslation(key, lang);

    // Fallback to English if not found
    if (!translation && lang !== 'en') {
      translation = getTranslation(key, 'en');
    }

    // Return key if no translation found
    if (!translation) {
      return key;
    }

    // Interpolate parameters
    return interpolate(translation, params);
  };

  /**
   * Get translation for specific domain (convenience function)
   * @param {string} domain - Domain name (e.g., 'auth', 'ui')
   * @param {string} key - Key within domain
   * @param {object} params - Interpolation parameters
   * @returns {string} Translated text
   */
  const td = (domain, key, params = {}) => {
    return t(`${domain}.${key}`, params);
  };

  return {
    language,
    setLanguage,
    supportedLanguages,
    t,
    tl,
    td
  };
};
