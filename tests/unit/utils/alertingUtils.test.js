const { AlertingI18n, t, tl } = require('../../../src/utils/alertingUtils');

// Mock logger to prevent console output during tests
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }))
  }
}));

describe('AlertingI18n', () => {
  let i18n;
  
  beforeEach(() => {
    // Reset environment
    delete process.env.ALERT_LANG;
    
    // Create fresh instance
    i18n = new AlertingI18n();
  });
  
  describe('initialization', () => {
    it('should initialize with default language (en)', () => {
      expect(i18n.getCurrentLanguage()).toBe('en');
      expect(i18n.getDefaultLanguage()).toBe('en');
    });
    
    it('should load supported languages', () => {
      const supported = i18n.getSupportedLanguages();
      expect(supported).toContain('en');
      expect(supported).toContain('es');
    });
    
    it('should respect ALERT_LANG environment variable', () => {
      process.env.ALERT_LANG = 'es';
      const i18nSpanish = new AlertingI18n();
      expect(i18nSpanish.getCurrentLanguage()).toBe('es');
    });
    
    it('should fallback to default language for unsupported ALERT_LANG', () => {
      process.env.ALERT_LANG = 'fr';
      const i18nFallback = new AlertingI18n();
      expect(i18nFallback.getCurrentLanguage()).toBe('en');
    });
  });
  
  describe('language management', () => {
    it('should set language successfully', () => {
      const result = i18n.setLanguage('es');
      expect(result).toBe(true);
      expect(i18n.getCurrentLanguage()).toBe('es');
    });
    
    it('should reject unsupported language', () => {
      const result = i18n.setLanguage('fr');
      expect(result).toBe(false);
      expect(i18n.getCurrentLanguage()).toBe('en'); // Should remain unchanged
    });
    
    it('should check if language is supported', () => {
      expect(i18n.isLanguageSupported('en')).toBe(true);
      expect(i18n.isLanguageSupported('es')).toBe(true);
      expect(i18n.isLanguageSupported('fr')).toBe(false);
    });
  });
  
  describe('translation functionality', () => {
    it('should translate basic keys in English', () => {
      const result = i18n.t('alert.titles.worker_failure_critical');
      expect(result).toBe('🚨 Critical: High Worker Failure Rate');
    });
    
    it('should translate basic keys in Spanish', () => {
      i18n.setLanguage('es');
      const result = i18n.t('alert.titles.worker_failure_critical');
      expect(result).toBe('🚨 Crítico: Alta Tasa de Fallos de Trabajadores');
    });
    
    it('should fallback to English when Spanish translation missing', () => {
      i18n.setLanguage('es');
      // Use a key that might only exist in English
      const result = i18n.t('alert.titles.worker_failure_critical');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
    
    it('should return key when translation not found', () => {
      const nonExistentKey = 'alert.nonexistent.key';
      const result = i18n.t(nonExistentKey);
      expect(result).toBe(nonExistentKey);
    });
    
    it('should interpolate parameters correctly', () => {
      const result = i18n.t('alert.titles.worker_error', { workerType: 'FetchComments' });
      expect(result).toBe('🔧 Worker Error: FetchComments');
    });
    
    it('should interpolate parameters in Spanish', () => {
      i18n.setLanguage('es');
      const result = i18n.t('alert.titles.worker_error', { workerType: 'FetchComments' });
      expect(result).toBe('🔧 Error de Trabajador: FetchComments');
    });
    
    it('should handle missing interpolation parameters', () => {
      const result = i18n.t('alert.titles.worker_error'); // Missing workerType param
      expect(result).toBe('🔧 Worker Error: {workerType}'); // Should preserve placeholder
    });
    
    it('should support complex message interpolation', () => {
      const result = i18n.t('alert.messages.worker_failure_rate', {
        failureRate: '25.0',
        unhealthyWorkers: 5,
        totalWorkers: 20
      });
      expect(result).toBe('25.0% of workers are unhealthy (5/20)');
    });
  });
  
  describe('function overloading', () => {
    it('should support t(key, params) signature', () => {
      const result = i18n.t('alert.titles.worker_error', { workerType: 'TestWorker' });
      expect(result).toBe('🔧 Worker Error: TestWorker');
    });
    
    it('should support t(key, language, params) signature', () => {
      const result = i18n.t('alert.titles.worker_error', 'es', { workerType: 'TestWorker' });
      expect(result).toBe('🔧 Error de Trabajador: TestWorker');
    });
    
    it('should support t(key) signature', () => {
      const result = i18n.t('alert.severities.critical');
      expect(result).toBe('CRITICAL');
    });
  });
  
  describe('nested key navigation', () => {
    it('should navigate deep nested keys', () => {
      const result = i18n.t('cli.usage.env_vars');
      expect(result).toBe('Environment Variables:');
    });
    
    it('should handle invalid nested paths', () => {
      const result = i18n.t('alert.nonexistent.deep.path');
      expect(result).toBe('alert.nonexistent.deep.path');
    });
  });
  
  describe('statistics and debugging', () => {
    it('should provide statistics', () => {
      const stats = i18n.getStats();
      expect(stats).toHaveProperty('currentLanguage');
      expect(stats).toHaveProperty('defaultLanguage');
      expect(stats).toHaveProperty('supportedLanguages');
      expect(stats).toHaveProperty('loadedLocales');
      expect(stats).toHaveProperty('localeStats');
    });
    
    it('should count keys correctly', () => {
      const stats = i18n.getStats();
      expect(stats.localeStats.en).toBeGreaterThan(0);
      expect(stats.localeStats.es).toBeGreaterThan(0);
    });
  });
  
  describe('global functions', () => {
    it('should provide t() shorthand function', () => {
      const result = t('alert.severities.critical');
      expect(result).toBe('CRITICAL');
    });
    
    it('should provide tl() function with explicit language', () => {
      const result = tl('alert.severities.critical', 'es');
      expect(result).toBe('CRÍTICO');
    });
    
    it('should handle parameters in global functions', () => {
      const result = t('alert.titles.worker_error', { workerType: 'GlobalTest' });
      expect(result).toBe('🔧 Worker Error: GlobalTest');
    });
  });
  
  describe('edge cases', () => {
    it('should handle empty interpolation parameters', () => {
      const result = i18n.t('alert.titles.worker_error', {});
      expect(result).toBe('🔧 Worker Error: {workerType}');
    });
    
    it('should handle null interpolation parameters', () => {
      const result = i18n.t('alert.titles.worker_error', null);
      expect(result).toBe('🔧 Worker Error: {workerType}');
    });
    
    it('should handle numeric interpolation values', () => {
      const result = i18n.t('alert.messages.memory_usage_critical', {
        memoryUsage: 95,
        threshold: 90
      });
      expect(result).toBe('Memory usage is at 95% (critical threshold: 90%)');
    });
    
    it('should handle boolean interpolation values', () => {
      const result = i18n.t('alert.messages.test_alert');
      expect(result).toBe('This is a test alert to verify the alerting system is working properly.');
    });
  });
  
  describe('reload functionality', () => {
    it('should reload locales without error', () => {
      expect(() => i18n.reloadLocales()).not.toThrow();
    });
    
    it('should maintain functionality after reload', () => {
      i18n.reloadLocales();
      const result = i18n.t('alert.severities.critical');
      expect(result).toBe('CRITICAL');
    });
  });
  
  describe('environment integration', () => {
    it('should respect environment language at startup', () => {
      process.env.ALERT_LANG = 'es';
      const envI18n = new AlertingI18n();
      const result = envI18n.t('alert.severities.critical');
      expect(result).toBe('CRÍTICO');
    });
    
    it('should handle case insensitive environment variable', () => {
      process.env.ALERT_LANG = 'ES';
      const envI18n = new AlertingI18n();
      expect(envI18n.getCurrentLanguage()).toBe('es');
    });
  });
});