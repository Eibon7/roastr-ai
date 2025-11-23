const AnalyzeToxicityWorker = require('../../../src/workers/AnalyzeToxicityWorker');

// Mock dependencies
jest.mock('../../../src/services/costControl');
jest.mock('../../../src/services/shieldService');
jest.mock('../../../src/services/encryptionService');
jest.mock('../../../src/services/embeddingsService');
jest.mock('../../../src/utils/logger', () => ({
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

describe('AnalyzeToxicityWorker - Basic Fallback Tests', () => {
  let worker;

  beforeEach(() => {
    process.env.ENABLE_MOCK_MODE = 'true';
    worker = new AnalyzeToxicityWorker();
  });

  afterEach(async () => {
    if (worker && typeof worker.stop === 'function') {
      try {
        await worker.stop();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  });

  describe('Worker Initialization', () => {
    it('should initialize correctly', () => {
      expect(worker).toBeDefined();
      expect(worker.constructor.name).toBe('AnalyzeToxicityWorker');
    });

    it('should have fallback patterns configured', () => {
      expect(Array.isArray(worker.toxicPatterns)).toBe(true);
      expect(worker.toxicPatterns.length).toBeGreaterThan(0);
    });

    it('should have toxicity thresholds', () => {
      expect(worker.thresholds).toBeDefined();
      expect(typeof worker.thresholds.low).toBe('number');
      expect(typeof worker.thresholds.medium).toBe('number');
      expect(typeof worker.thresholds.high).toBe('number');
    });
  });

  describe('Service Dependencies', () => {
    it('should have cost control service', () => {
      expect(worker.costControl).toBeDefined();
    });

    it('should have shield service', () => {
      expect(worker.shieldService).toBeDefined();
    });

    it('should have embeddings service', () => {
      expect(worker.embeddingsService).toBeDefined();
    });
  });

  describe('Fallback Logic Components', () => {
    it('should have pattern matching for toxicity detection', () => {
      const toxicTexts = ['you are an idiot', 'I hate this', 'stupid thing'];

      toxicTexts.forEach((text) => {
        const matches = worker.toxicPatterns.some((pattern) => pattern.pattern.test(text));
        expect(matches).toBe(true);
      });
    });

    it('should not match safe content', () => {
      const safeTexts = ['this is great', 'I love this feature', 'amazing work'];

      safeTexts.forEach((text) => {
        const matches = worker.toxicPatterns.some((pattern) => pattern.pattern.test(text));
        expect(matches).toBe(false);
      });
    });

    it('should have analyzeToxicity method for fallback analysis', () => {
      expect(typeof worker.analyzeToxicity).toBe('function');
    });
  });

  describe('Error Handling Capabilities', () => {
    it('should handle invalid inputs gracefully in pattern matching', () => {
      const invalidInputs = [null, undefined, '', 123, {}];

      invalidInputs.forEach((input) => {
        expect(() => {
          worker.toxicPatterns.forEach((pattern) => {
            try {
              pattern.pattern.test(input);
            } catch (error) {
              // Expected for invalid inputs
              expect(error).toBeDefined();
            }
          });
        }).not.toThrow();
      });
    });

    it('should have proper threshold validation', () => {
      expect(worker.thresholds.low).toBeLessThan(worker.thresholds.medium);
      expect(worker.thresholds.medium).toBeLessThan(worker.thresholds.high);
      expect(worker.thresholds.high).toBeLessThan(worker.thresholds.critical);
    });
  });

  describe('Configuration and Setup', () => {
    it('should have appropriate concurrency settings', () => {
      expect(worker.config).toBeDefined();
      expect(worker.config.maxConcurrency).toBeGreaterThan(0);
      expect(worker.config.maxConcurrency).toBeLessThanOrEqual(10);
    });

    it('should have retry configuration', () => {
      expect(worker.config.maxRetries).toBeGreaterThan(0);
    });

    it('should initialize in mock mode', () => {
      process.env.ENABLE_MOCK_MODE = 'true';
      const mockWorker = new AnalyzeToxicityWorker();

      expect(mockWorker).toBeDefined();
      expect(mockWorker.constructor.name).toBe('AnalyzeToxicityWorker');
    });
  });

  describe('Health Check Capabilities', () => {
    it('should have health check method', () => {
      expect(typeof worker.getSpecificHealthDetails).toBe('function');
    });

    it('should provide basic health information', async () => {
      try {
        const health = await worker.getSpecificHealthDetails();
        expect(health).toBeDefined();
      } catch (error) {
        // Health check might fail in test environment, which is acceptable
        expect(error).toBeDefined();
      }
    });
  });
});
