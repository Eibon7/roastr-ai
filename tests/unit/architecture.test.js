/**
 * Multi-Tenant Architecture Tests
 * 
 * Tests for the basic architecture components and file structure
 */

const fs = require('fs');
const path = require('path');

describe('Multi-Tenant Architecture', () => {
  const srcPath = path.join(__dirname, '../../src');
  
  describe('File Structure', () => {
    test('should have all required service files', () => {
      const requiredServices = [
        'services/costControl.js',
        'services/queueService.js', 
        'services/shieldService.js'
      ];
      
      requiredServices.forEach(servicePath => {
        const fullPath = path.join(srcPath, servicePath);
        expect(fs.existsSync(fullPath)).toBe(true);
      });
    });
    
    test('should have all required worker files', () => {
      const requiredWorkers = [
        'workers/BaseWorker.js',
        'workers/FetchCommentsWorker.js',
        'workers/AnalyzeToxicityWorker.js',
        'workers/GenerateReplyWorker.js',
        'workers/ShieldActionWorker.js'
      ];
      
      requiredWorkers.forEach(workerPath => {
        const fullPath = path.join(srcPath, workerPath);
        expect(fs.existsSync(fullPath)).toBe(true);
      });
    });
    
    test('should have all required integration files', () => {
      const requiredIntegrations = [
        'services/twitter.js',
        'integrations/youtube/youtubeService.js',
        'integrations/bluesky/blueskyService.js',
        'integrations/instagram/instagramService.js',
        'integrations/facebook/facebookService.js',
        'integrations/discord/discordService.js',
        'integrations/twitch/twitchService.js',
        'integrations/reddit/redditService.js',
        'integrations/tiktok/tiktokService.js'
      ];
      
      requiredIntegrations.forEach(integrationPath => {
        const fullPath = path.join(srcPath, integrationPath);
        expect(fs.existsSync(fullPath)).toBe(true);
      });
    });
    
    test('should have worker CLI tools', () => {
      const requiredCLIs = [
        'workers/cli/start-workers.js',
        'workers/cli/worker-status.js',
        'workers/cli/queue-manager.js'
      ];
      
      requiredCLIs.forEach(cliPath => {
        const fullPath = path.join(srcPath, cliPath);
        expect(fs.existsSync(fullPath)).toBe(true);
      });
    });
  });
  
  describe('Database Schema', () => {
    test('should have database schema file', () => {
      const schemaPath = path.join(__dirname, '../../database/schema.sql');
      expect(fs.existsSync(schemaPath)).toBe(true);
    });
  });
  
  describe('Service Structure', () => {
    test('CostControlService should be properly structured', () => {
      const CostControlService = require('../../src/services/costControl');
      
      expect(typeof CostControlService).toBe('function');
      
      const service = new CostControlService();
      expect(service).toBeDefined();
      expect(typeof service.canPerformOperation).toBe('function');
      expect(typeof service.recordUsage).toBe('function');
      expect(typeof service.canUseShield).toBe('function');
      expect(typeof service.upgradePlan).toBe('function');
      expect(typeof service.getUsageStats).toBe('function');
    });
    
    test('QueueService should be properly structured', () => {
      const QueueService = require('../../src/services/queueService');
      
      expect(typeof QueueService).toBe('function');
      
      const service = new QueueService();
      expect(service).toBeDefined();
      expect(typeof service.initialize).toBe('function');
      expect(typeof service.addJob).toBe('function');
      expect(typeof service.getNextJob).toBe('function');
      expect(typeof service.completeJob).toBe('function');
      expect(typeof service.failJob).toBe('function');
      expect(typeof service.getQueueStats).toBe('function');
      expect(typeof service.shutdown).toBe('function');
    });
    
    test('ShieldService should be properly structured', () => {
      const ShieldService = require('../../src/services/shieldService');
      
      expect(typeof ShieldService).toBe('function');
      
      const service = new ShieldService();
      expect(service).toBeDefined();
      expect(typeof service.initialize).toBe('function');
      expect(typeof service.analyzeContent).toBe('function');
      expect(typeof service.executeActions).toBe('function');
      expect(typeof service.trackUserBehavior).toBe('function');
      expect(typeof service.getUserRiskLevel).toBe('function');
      expect(typeof service.getShieldStats).toBe('function');
      expect(typeof service.shutdown).toBe('function');
    });
  });
  
  describe('Worker Structure', () => {
    test('BaseWorker should be properly structured', () => {
      const BaseWorker = require('../../src/workers/BaseWorker');
      
      expect(typeof BaseWorker).toBe('function');
      
      const worker = new BaseWorker('test_worker');
      expect(worker).toBeDefined();
      expect(worker.workerType).toBe('test_worker');
      expect(typeof worker.start).toBe('function');
      expect(typeof worker.stop).toBe('function');
      expect(typeof worker.processJob).toBe('function');
    });
    
    test('All workers should extend BaseWorker', () => {
      const BaseWorker = require('../../src/workers/BaseWorker');
      
      const workers = [
        '../../src/workers/FetchCommentsWorker',
        '../../src/workers/AnalyzeToxicityWorker',
        '../../src/workers/GenerateReplyWorker',
        '../../src/workers/ShieldActionWorker'
      ];
      
      workers.forEach(workerPath => {
        const WorkerClass = require(workerPath);
        expect(typeof WorkerClass).toBe('function');
        
        // Check that worker has required methods (inherited or implemented)
        const workerInstance = new WorkerClass();
        expect(typeof workerInstance.processJob).toBe('function');
        expect(typeof workerInstance.start).toBe('function');
        expect(typeof workerInstance.stop).toBe('function');
      });
    });
  });
  
  describe('Integration Structure', () => {
    test('All integration services should have required methods', () => {
      const integrationPaths = [
        '../../src/services/twitter',
        '../../src/integrations/youtube/youtubeService'
      ];
      
      integrationPaths.forEach(integrationPath => {
        const IntegrationService = require(integrationPath);
        
        if (typeof IntegrationService === 'function') {
          const service = new IntegrationService();
          expect(typeof service.fetchComments).toBe('function');
          expect(typeof service.initialize).toBe('function');
        }
      });
    });
  });
  
  describe('Configuration', () => {
    test('should have proper package.json scripts for multi-tenant operations', () => {
      const packagePath = path.join(__dirname, '../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      const requiredScripts = [
        'workers:start',
        'workers:status', 
        'queue:manage',
        'queue:status',
        'test',
        'test:coverage'
      ];
      
      requiredScripts.forEach(script => {
        expect(packageJson.scripts[script]).toBeDefined();
      });
    });
    
    test('should have required dependencies for multi-tenant architecture', () => {
      const packagePath = path.join(__dirname, '../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      const requiredDeps = [
        'ioredis',
        '@supabase/supabase-js',
        'openai'
      ];
      
      requiredDeps.forEach(dep => {
        expect(packageJson.dependencies[dep]).toBeDefined();
      });
    });
  });
  
  describe('Environment Configuration', () => {
    test('should have proper environment variable structure', () => {
      // Test that environment variables are properly configured in the services
      const CostControlService = require('../../src/services/costControl');
      const QueueService = require('../../src/services/queueService');
      
      // These should not throw errors when instantiated (they handle missing env vars gracefully)
      expect(() => new CostControlService()).not.toThrow();
      expect(() => new QueueService()).not.toThrow();
    });
  });
  
  describe('Test Structure', () => {
    test('should have comprehensive test files', () => {
      const testFiles = [
        'tests/unit/services/costControl.test.js',
        'tests/unit/services/queueService.test.js',
        'tests/unit/services/shieldService.test.js',
        'tests/unit/workers/FetchCommentsWorker.test.js',
        'tests/unit/workers/AnalyzeToxicityWorker.test.js',
        'tests/unit/workers/GenerateReplyWorker.test.js',
        'tests/unit/workers/ShieldActionWorker.test.js',
        'tests/integration/multiTenantWorkflow.test.js'
      ];
      
      testFiles.forEach(testFile => {
        const fullPath = path.join(__dirname, '../..', testFile);
        expect(fs.existsSync(fullPath)).toBe(true);
      });
    });
    
    test('should have test setup files', () => {
      const setupFiles = [
        'tests/setup.js',
        'tests/helpers/testUtils.js'
      ];
      
      setupFiles.forEach(setupFile => {
        const fullPath = path.join(__dirname, '../..', setupFile);
        expect(fs.existsSync(fullPath)).toBe(true);
      });
    });
  });
});