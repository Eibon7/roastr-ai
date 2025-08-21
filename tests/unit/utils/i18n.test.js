const { I18n, t, tl, td } = require('../../../src/utils/i18n');

describe('I18n System', () => {
  describe('Module Loading', () => {
    it('should load i18n module without errors', () => {
      expect(I18n).toBeDefined();
      expect(typeof t).toBe('function');
      expect(typeof tl).toBe('function');
      expect(typeof td).toBe('function');
    });

    it('should create I18n instance', () => {
      const i18nInstance = new I18n();
      expect(i18nInstance).toBeDefined();
      expect(typeof i18nInstance.getCurrentLanguage).toBe('function');
      expect(typeof i18nInstance.getSupportedLanguages).toBe('function');
    });
  });

  describe('Fallback Behavior', () => {
    it('should return key if translation not found in any language', () => {
      const result = t('non.existent.key');
      expect(result).toBe('non.existent.key');
    });

    it('should handle null/undefined keys', () => {
      // The function should handle invalid inputs gracefully
      expect(() => t(null)).not.toThrow();
      expect(() => t(undefined)).not.toThrow();
    });
  });

  describe('Language Management', () => {
    let i18nInstance;
    
    beforeEach(() => {
      i18nInstance = new I18n();
    });

    it('should get current language', () => {
      const lang = i18nInstance.getCurrentLanguage();
      expect(['en', 'es']).toContain(lang);
    });

    it('should set language successfully', () => {
      const result = i18nInstance.setLanguage('es');
      expect(result).toBe(true);
      expect(i18nInstance.getCurrentLanguage()).toBe('es');
    });

    it('should reject unsupported language', () => {
      const result = i18nInstance.setLanguage('fr');
      expect(result).toBe(false);
      // Language should remain unchanged
      expect(['en', 'es']).toContain(i18nInstance.getCurrentLanguage());
    });

    it('should check if language is supported', () => {
      expect(i18nInstance.isLanguageSupported('en')).toBe(true);
      expect(i18nInstance.isLanguageSupported('es')).toBe(true);
      expect(i18nInstance.isLanguageSupported('fr')).toBe(false);
    });

    it('should get list of supported languages', () => {
      const languages = i18nInstance.getSupportedLanguages();
      expect(languages).toEqual(['en', 'es']);
    });
  });

  describe('Environment Configuration', () => {
    it('should respect environment language settings', () => {
      const originalEnv = process.env.APP_LANG;
      
      // Test APP_LANG
      process.env.APP_LANG = 'es';
      const newInstance = new I18n();
      expect(newInstance.getCurrentLanguage()).toBe('es');
      
      // Test invalid language falls back to default
      process.env.APP_LANG = 'invalid';
      const newInstance2 = new I18n();
      expect(newInstance2.getCurrentLanguage()).toBe('en');
      
      // Restore
      if (originalEnv !== undefined) {
        process.env.APP_LANG = originalEnv;
      } else {
        delete process.env.APP_LANG;
      }
    });
  });
});