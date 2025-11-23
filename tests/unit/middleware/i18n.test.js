const request = require('supertest');
const express = require('express');
const {
  detectLanguage,
  i18nHelpers,
  parseAcceptLanguage,
  isValidLanguageCode
} = require('../../../src/middleware/i18n');

describe('I18n Middleware', () => {
  let app;

  beforeEach(() => {
    // Create a fresh Express app for each test
    app = express();
    app.use(express.json());
  });

  describe('parseAcceptLanguage', () => {
    it('should parse simple language', () => {
      const result = parseAcceptLanguage('en');
      expect(result).toEqual([{ code: 'en', quality: 1 }]);
    });

    it('should parse multiple languages with quality values', () => {
      const result = parseAcceptLanguage('en-US,en;q=0.9,es;q=0.8,fr;q=0.7');
      expect(result).toEqual([
        { code: 'en-US', quality: 1 },
        { code: 'en', quality: 0.9 },
        { code: 'es', quality: 0.8 },
        { code: 'fr', quality: 0.7 }
      ]);
    });

    it('should handle malformed input', () => {
      const result = parseAcceptLanguage('');
      expect(result).toEqual([]);

      const result2 = parseAcceptLanguage(null);
      expect(result2).toEqual([]);
    });

    it('should filter out zero quality languages', () => {
      const result = parseAcceptLanguage('en;q=1,fr;q=0');
      expect(result).toEqual([{ code: 'en', quality: 1 }]);
    });
  });

  describe('isValidLanguageCode', () => {
    it('should validate correct language codes', () => {
      expect(isValidLanguageCode('en')).toBe(true);
      expect(isValidLanguageCode('es')).toBe(true);
      expect(isValidLanguageCode('fr')).toBe(true);
    });

    it('should reject invalid language codes', () => {
      expect(isValidLanguageCode('eng')).toBe(false);
      expect(isValidLanguageCode('e')).toBe(false);
      expect(isValidLanguageCode('EN')).toBe(false);
      expect(isValidLanguageCode('123')).toBe(false);
      expect(isValidLanguageCode('')).toBe(false);
      expect(isValidLanguageCode(null)).toBe(false);
    });
  });

  describe('detectLanguage middleware', () => {
    beforeEach(() => {
      app.use(detectLanguage);
      app.get('/test', (req, res) => {
        res.json({ language: req.language });
      });
    });

    it('should detect English from Accept-Language header', async () => {
      const response = await request(app).get('/test').set('Accept-Language', 'en-US,en;q=0.9');

      expect(response.status).toBe(200);
      expect(response.body.language).toBe('en');
    });

    it('should detect Spanish from Accept-Language header', async () => {
      const response = await request(app)
        .get('/test')
        .set('Accept-Language', 'es-ES,es;q=0.9,en;q=0.8');

      expect(response.status).toBe(200);
      expect(response.body.language).toBe('es');
    });

    it('should fall back to default language for unsupported languages', async () => {
      const response = await request(app)
        .get('/test')
        .set('Accept-Language', 'fr-FR,fr;q=0.9,de;q=0.8');

      expect(response.status).toBe(200);
      expect(response.body.language).toBe('en'); // Default fallback
    });

    it('should handle missing Accept-Language header', async () => {
      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body.language).toBe('en');
    });

    it('should handle malformed Accept-Language header', async () => {
      const response = await request(app)
        .get('/test')
        .set('Accept-Language', 'invalid-header-format');

      expect(response.status).toBe(200);
      expect(response.body.language).toBe('en');
    });

    it('should prioritize user language preference over header', async () => {
      // Create a new app with user middleware first
      const testApp = express();

      // Add user preference middleware first
      testApp.use((req, res, next) => {
        req.user = { language: 'es' };
        next();
      });

      testApp.use(detectLanguage);
      testApp.get('/test', (req, res) => {
        res.json({ language: req.language });
      });

      const response = await request(testApp).get('/test').set('Accept-Language', 'en-US');

      expect(response.status).toBe(200);
      expect(response.body.language).toBe('es');
    });

    it('should handle quality values correctly', async () => {
      const response = await request(app)
        .get('/test')
        .set('Accept-Language', 'fr;q=0.9,es;q=0.8,en;q=0.1');

      expect(response.status).toBe(200);
      expect(response.body.language).toBe('es'); // Should pick Spanish over English
    });

    it('should validate and reject invalid language codes', async () => {
      const response = await request(app).get('/test').set('Accept-Language', 'invalid123,eng,en');

      expect(response.status).toBe(200);
      expect(response.body.language).toBe('en'); // Should skip invalid codes
    });
  });

  describe('i18nHelpers middleware', () => {
    beforeEach(() => {
      app.use(detectLanguage);
      app.use(i18nHelpers);
      app.get('/test', (req, res) => {
        res.json({
          language: res.locals.currentLanguage,
          supportedLanguages: res.locals.supportedLanguages,
          translationTest: res.locals.t('ui.common.success')
        });
      });
    });

    it('should add i18n helpers to response locals', async () => {
      const response = await request(app).get('/test').set('Accept-Language', 'es');

      expect(response.status).toBe(200);
      expect(response.body.language).toBe('es');
      expect(response.body.supportedLanguages).toEqual(['en', 'es']);
      expect(typeof response.body.translationTest).toBe('string');
    });

    it('should handle translation function in templates', async () => {
      const response = await request(app).get('/test').set('Accept-Language', 'en');

      expect(response.status).toBe(200);
      expect(response.body.translationTest).toBe('Success');
    });
  });

  describe('Error handling', () => {
    it('should handle errors gracefully in detectLanguage', async () => {
      // Mock logger to avoid console output during tests
      const originalLog = console.log;
      console.log = jest.fn();

      app.use((req, res, next) => {
        // Simulate an error condition
        req.headers['accept-language'] = { invalid: 'object' };
        next();
      });

      app.use(detectLanguage);
      app.get('/test', (req, res) => {
        res.json({ language: req.language });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body.language).toBe('en'); // Should fall back to default

      // Restore console.log
      console.log = originalLog;
    });
  });
});
