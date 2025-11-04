const { t } = require('../../src/utils/i18n');

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }))
  }
}));

describe('I18n Alerting Integration', () => {
  beforeEach(() => {
    // Reset environment for each test
    delete process.env.APP_LANG;
    delete process.env.ALERT_LANG;
  });
  
  describe('AlertingService integration', () => {
    it('should provide all required alert title translations', () => {
      const requiredTitles = [
        'worker_failure_critical',
        'worker_failure_warning', 
        'worker_error',
        'queue_depth_critical',
        'queue_depth_warning',
        'memory_usage_critical',
        'memory_usage_warning',
        'response_time_critical',
        'response_time_warning',
        'cost_critical',
        'cost_warning',
        'health_check_error',
        'test_alert'
      ];
      
      for (const title of requiredTitles) {
        const englishResult = t(`alert.titles.${title}`);
        const spanishResult = t(`alert.titles.${title}`, 'es');
        
        expect(englishResult).not.toBe(`alert.titles.${title}`); // Should not return the key
        expect(spanishResult).not.toBe(`alert.titles.${title}`); // Should not return the key
        expect(englishResult.length).toBeGreaterThan(0);
        expect(spanishResult.length).toBeGreaterThan(0);
        expect(englishResult).not.toBe(spanishResult); // Should be different languages
      }
    });
    
    it('should provide all required alert message translations', () => {
      const requiredMessages = [
        'worker_failure_rate',
        'worker_error_detail',
        'queue_depth_critical',
        'queue_depth_warning',
        'memory_usage_critical',
        'memory_usage_warning',
        'response_time_critical',
        'response_time_warning',
        'cost_critical',
        'cost_warning',
        'health_check_error',
        'test_alert'
      ];
      
      for (const message of requiredMessages) {
        const englishResult = t(`alert.messages.${message}`);
        const spanishResult = t(`alert.messages.${message}`, 'es');
        
        expect(englishResult).not.toBe(`alert.messages.${message}`);
        expect(spanishResult).not.toBe(`alert.messages.${message}`);
        expect(englishResult.length).toBeGreaterThan(0);
        expect(spanishResult.length).toBeGreaterThan(0);
      }
    });
    
    it('should provide severity translations', () => {
      const severities = ['critical', 'warning', 'info'];
      
      for (const severity of severities) {
        const englishResult = t(`alert.severities.${severity}`);
        const spanishResult = t(`alert.severities.${severity}`, 'es');
        
        expect(englishResult).toBe(severity.toUpperCase());
        expect(spanishResult).not.toBe(severity.toUpperCase()); // Should be translated
        expect(spanishResult.length).toBeGreaterThan(0);
      }
    });
    
    it('should provide field label translations', () => {
      const fields = ['severity', 'timestamp'];
      
      for (const field of fields) {
        const englishResult = t(`alert.fields.${field}`);
        const spanishResult = t(`alert.fields.${field}`, 'es');
        
        expect(englishResult).not.toBe(`alert.fields.${field}`);
        expect(spanishResult).not.toBe(`alert.fields.${field}`);
        expect(englishResult).not.toBe(spanishResult);
      }
    });
  });
  
  describe('CLI integration', () => {
    it('should provide all CLI health command translations', () => {
      const healthKeys = [
        'fetching',
        'failed', 
        'cannot_connect',
        'status',
        'overall',
        'uptime',
        'memory',
        'services',
        'workers',
        'queues'
      ];
      
      for (const key of healthKeys) {
        const englishResult = t(`cli.health.${key}`);
        const spanishResult = t(`cli.health.${key}`, 'es');
        
        expect(englishResult).not.toBe(`cli.health.${key}`);
        expect(spanishResult).not.toBe(`cli.health.${key}`);
        expect(englishResult).not.toBe(spanishResult);
      }
    });
    
    it('should provide CLI alert command translations', () => {
      const alertKeys = [
        'sending',
        'sent_successfully',
        'not_sent',
        'auth_required',
        'test_failed',
        'cannot_connect',
        'severity',
        'title',
        'message'
      ];
      
      for (const key of alertKeys) {
        const englishResult = t(`cli.alerts.${key}`);
        const spanishResult = t(`cli.alerts.${key}`, 'es');
        
        expect(englishResult).not.toBe(`cli.alerts.${key}`);
        expect(spanishResult).not.toBe(`cli.alerts.${key}`);
        // Some keys might be the same (like single words), so we don't test for difference
      }
    });
    
    it('should provide CLI usage translations', () => {
      const usageKeys = [
        'title',
        'usage',
        'commands',
        'examples'
      ];
      
      for (const key of usageKeys) {
        const englishResult = t(`cli.usage.${key}`);
        const spanishResult = t(`cli.usage.${key}`, 'es');
        
        expect(englishResult).not.toBe(`cli.usage.${key}`);
        expect(spanishResult).not.toBe(`cli.usage.${key}`);
      }
    });
  });
  
  describe('parameter interpolation integration', () => {
    it('should correctly interpolate alert parameters in both languages', () => {
      const params = {
        workerType: 'FetchCommentsWorker',
        error: 'Connection timeout'
      };
      
      const englishResult = t('alert.messages.worker_error_detail', params);
      const spanishResult = t('alert.messages.worker_error_detail', 'es', params);
      
      expect(englishResult).toContain('FetchCommentsWorker');
      expect(englishResult).toContain('Connection timeout');
      expect(spanishResult).toContain('FetchCommentsWorker'); 
      expect(spanishResult).toContain('Connection timeout');
      
      // Should contain language-specific text
      expect(englishResult).toContain('Worker');
      expect(spanishResult).toContain('trabajador'); // Spanish for worker
    });
    
    it('should handle numeric parameters in alerts', () => {
      const params = {
        memoryUsage: 87,
        threshold: 80
      };
      
      const englishResult = t('alert.messages.memory_usage_warning', params);
      const spanishResult = t('alert.messages.memory_usage_warning', 'es', params);
      
      expect(englishResult).toContain('87');
      expect(englishResult).toContain('80');
      expect(spanishResult).toContain('87');
      expect(spanishResult).toContain('80');
    });
    
    it('should handle CLI parameter interpolation', () => {
      const params = { severity: 'warning' };
      
      const englishResult = t('cli.alerts.sending', params);
      const spanishResult = t('cli.alerts.sending', 'es', params);
      
      expect(englishResult).toContain('warning');
      expect(spanishResult).toContain('warning');
    });
  });
  
  describe('environment variable integration', () => {
    it('should use Spanish translations when APP_LANG=es', () => {
      process.env.APP_LANG = 'es';
      
      // Need to reload module to pick up env var
      jest.resetModules();
      const { t: tWithEnv } = require('../../src/utils/i18n');
      
      const result = tWithEnv('alert.severities.critical');
      expect(result).toBe('CRÍTICO');
    });

    it('should maintain backward compatibility with ALERT_LANG', () => {
      process.env.ALERT_LANG = 'es';
      
      // Need to reload module to pick up env var
      jest.resetModules();
      const { t: tWithEnv } = require('../../src/utils/i18n');
      
      const result = tWithEnv('alert.severities.critical');
      expect(result).toBe('CRÍTICO');
    });
    
    it('should fallback to English for invalid APP_LANG', () => {
      process.env.APP_LANG = 'invalid';
      
      jest.resetModules();
      const { t: tWithEnv } = require('../../src/utils/i18n');
      
      const result = tWithEnv('alert.severities.critical');
      expect(result).toBe('CRITICAL');
    });
  });
  
  describe('real-world alert scenarios', () => {
    it('should generate complete worker failure alert in English', () => {
      const title = t('alert.titles.worker_failure_critical');
      const message = t('alert.messages.worker_failure_rate', {
        failureRate: '30.0',
        unhealthyWorkers: 3,
        totalWorkers: 10
      });
      
      expect(title).toBe('🚨 Critical: High Worker Failure Rate');
      expect(message).toBe('30.0% of workers are unhealthy (3/10)');
    });
    
    it('should generate complete worker failure alert in Spanish', () => {
      const title = t('alert.titles.worker_failure_critical', 'es');
      const message = t('alert.messages.worker_failure_rate', 'es', {
        failureRate: '30.0',
        unhealthyWorkers: 3,
        totalWorkers: 10
      });
      
      expect(title).toBe('🚨 Crítico: Alta Tasa de Fallos de Trabajadores');
      expect(message).toBe('30.0% de los trabajadores están en mal estado (3/10)');
    });
    
    it('should generate complete queue depth alert', () => {
      const englishTitle = t('alert.titles.queue_depth_warning', { queueType: 'fetch_comments' });
      const spanishTitle = t('alert.titles.queue_depth_warning', 'es', { queueType: 'fetch_comments' });
      
      const englishMessage = t('alert.messages.queue_depth_warning', {
        queueType: 'fetch_comments',
        depth: 750,
        threshold: 500
      });
      
      const spanishMessage = t('alert.messages.queue_depth_warning', 'es', {
        queueType: 'fetch_comments', 
        depth: 750,
        threshold: 500
      });
      
      expect(englishTitle).toContain('fetch_comments');
      expect(spanishTitle).toContain('fetch_comments');
      expect(englishMessage).toContain('750');
      expect(spanishMessage).toContain('750');
      expect(englishMessage).toContain('500');
      expect(spanishMessage).toContain('500');
    });
  });
});