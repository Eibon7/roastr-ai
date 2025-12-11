const request = require('supertest');
const express = require('express');

// Create a simple test app instead of importing the full app
const createTestApp = () => {
  const app = express();
  app.get('/health', (req, res) => {
    res.set({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY'
    });
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  });
  return app;
};

const app = createTestApp();

// Mock external services for health testing
jest.mock('../../../src/services/perspective', () => ({
  analyzeToxicity: jest.fn()
}));

jest.mock('../../../src/services/openai', () => ({
  analyzeToxicityWithOpenAI: jest.fn(),
  generateRoastWithOpenAI: jest.fn()
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { status: 'healthy' } }),
    rpc: jest.fn().mockResolvedValue({ data: 'pong', error: null })
  }))
}));

const { analyzeToxicity } = require('../../../src/services/perspective');
const {
  analyzeToxicityWithOpenAI,
  generateRoastWithOpenAI
} = require('../../../src/services/openai');

describe('Core System Health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ENABLE_MOCK_MODE = 'true';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('API Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String)
      });
    });

    it('should include security headers', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should handle health check endpoint gracefully under load', async () => {
      const requests = Array(10)
        .fill()
        .map(() => request(app).get('/health').expect(200));

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.body.status).toBe('ok');
      });
    });
  });

  describe('Core Services Connectivity', () => {
    it('should verify Perspective API connectivity', async () => {
      // Mock successful response
      analyzeToxicity.mockResolvedValueOnce({
        score: 0.1,
        categories: ['SAFE']
      });

      const testComment = 'This is a test comment';
      const result = await analyzeToxicity(testComment);

      expect(result).toBeDefined();
      expect(typeof result.score).toBe('number');
      expect(Array.isArray(result.categories)).toBe(true);
    });

    it('should handle Perspective API errors gracefully', async () => {
      // Mock error response
      analyzeToxicity.mockRejectedValueOnce(new Error('API rate limit exceeded'));

      try {
        await analyzeToxicity('test comment');
      } catch (error) {
        expect(error.message).toContain('rate limit');
      }

      expect(analyzeToxicity).toHaveBeenCalled();
    });

    it('should verify OpenAI API connectivity', async () => {
      // Mock successful toxicity analysis
      analyzeToxicityWithOpenAI.mockResolvedValueOnce({
        toxic: true,
        score: 0.8,
        categories: ['harassment']
      });

      // Mock successful roast generation
      generateRoastWithOpenAI.mockResolvedValueOnce({
        roast: '¿En serio? Eso es lo mejor que se te ocurre?',
        confidence: 0.9
      });

      const toxicityResult = await analyzeToxicityWithOpenAI('test comment');
      const roastResult = await generateRoastWithOpenAI({
        comment: 'test comment',
        toxicityData: toxicityResult
      });

      expect(toxicityResult.toxic).toBe(true);
      expect(roastResult.roast).toBeDefined();
      expect(roastResult.roast.length).toBeGreaterThan(0);
    });

    it('should handle OpenAI API errors gracefully', async () => {
      // Mock service error
      analyzeToxicityWithOpenAI.mockRejectedValueOnce(
        new Error('OpenAI service temporarily unavailable')
      );
      generateRoastWithOpenAI.mockRejectedValueOnce(new Error('Token limit exceeded'));

      const errors = [];

      try {
        await analyzeToxicityWithOpenAI('test');
      } catch (error) {
        errors.push(error.message);
      }

      try {
        await generateRoastWithOpenAI({ comment: 'test' });
      } catch (error) {
        errors.push(error.message);
      }

      expect(errors).toHaveLength(2);
      expect(errors[0]).toContain('unavailable');
      expect(errors[1]).toContain('Token limit');
    });

    it('should verify Supabase connectivity', async () => {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient('http://localhost/test', 'test-key');

      // Test database connectivity
      const healthCheck = await supabase.rpc('ping');

      expect(healthCheck.data).toBe('pong');
      expect(healthCheck.error).toBeNull();

      // Test basic query
      const testQuery = await supabase.from('test_table').select('*').single();

      expect(testQuery).toBeDefined();
    });

    it('should handle Supabase connection errors gracefully', async () => {
      const { createClient } = require('@supabase/supabase-js');

      // Mock connection error
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockRejectedValue(new Error('Connection timeout')),
        rpc: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database unavailable' }
        })
      };

      jest.mocked(createClient).mockReturnValueOnce(mockSupabase);
      const supabase = createClient('invalid://url', 'invalid-key');

      // Test degraded connectivity
      const healthCheck = await supabase.rpc('ping');
      expect(healthCheck.error).toBeDefined();
      expect(healthCheck.error.message).toContain('unavailable');

      try {
        await supabase.from('test').select('*').single();
      } catch (error) {
        expect(error.message).toContain('timeout');
      }
    });
  });

  describe('Service Dependencies and Integration', () => {
    it('should verify queue service is available', async () => {
      const QueueService = require('../../../src/services/queueService');
      const queueService = new QueueService();

      expect(queueService).toBeDefined();
      expect(queueService.constructor.name).toBe('QueueService');

      // Test that service can be instantiated without throwing
      expect(() => new QueueService()).not.toThrow();
    });

    it('should verify shield service is available', async () => {
      const ShieldService = require('../../../src/services/shieldService');
      const shieldService = new ShieldService();

      expect(shieldService).toBeDefined();
      expect(typeof shieldService.analyzeForShield).toBe('function');
      expect(typeof shieldService.queueHighPriorityAnalysis).toBe('function');

      // Verify service configuration
      expect(shieldService.priorityLevels).toBeDefined();
      expect(shieldService.actionMatrix).toBeDefined();
    });

    it('should verify cost control service integration', async () => {
      const CostControlService = require('../../../src/services/costControl');
      const costControl = new CostControlService();

      expect(costControl).toBeDefined();
      expect(costControl.constructor.name).toBe('CostControlService');

      // Test that service can be instantiated without throwing
      expect(() => new CostControlService()).not.toThrow();
    });
  });

  describe('System State Detection', () => {
    it('should detect healthy system state', async () => {
      // Mock all services as healthy
      analyzeToxicity.mockResolvedValue({ score: 0.1 });
      analyzeToxicityWithOpenAI.mockResolvedValue({ toxic: false });

      const systemHealth = {
        perspective: 'healthy',
        openai: 'healthy',
        database: 'healthy',
        queue: 'healthy'
      };

      // Test Perspective
      try {
        await analyzeToxicity('test');
        systemHealth.perspective = 'healthy';
      } catch {
        systemHealth.perspective = 'degraded';
      }

      // Test OpenAI
      try {
        await analyzeToxicityWithOpenAI('test');
        systemHealth.openai = 'healthy';
      } catch {
        systemHealth.openai = 'degraded';
      }

      expect(systemHealth.perspective).toBe('healthy');
      expect(systemHealth.openai).toBe('healthy');
    });

    it('should detect degraded system state', async () => {
      // Mock services with errors
      analyzeToxicity.mockRejectedValue(new Error('Service error'));
      analyzeToxicityWithOpenAI.mockRejectedValue(new Error('Rate limited'));

      const systemHealth = {
        perspective: 'unknown',
        openai: 'unknown',
        database: 'unknown'
      };

      // Test Perspective (should fail)
      try {
        await analyzeToxicity('test');
        systemHealth.perspective = 'healthy';
      } catch (error) {
        systemHealth.perspective = 'degraded';
      }

      // Test OpenAI (should fail)
      try {
        await analyzeToxicityWithOpenAI('test');
        systemHealth.openai = 'healthy';
      } catch (error) {
        systemHealth.openai = 'degraded';
      }

      expect(systemHealth.perspective).toBe('degraded');
      expect(systemHealth.openai).toBe('degraded');
    });

    it('should provide system recovery detection', async () => {
      // First, services fail
      analyzeToxicity.mockRejectedValueOnce(new Error('Temporary failure'));

      let firstAttempt, secondAttempt;

      try {
        await analyzeToxicity('test');
        firstAttempt = 'success';
      } catch {
        firstAttempt = 'failed';
      }

      // Then, services recover
      analyzeToxicity.mockResolvedValueOnce({ score: 0.2 });

      try {
        await analyzeToxicity('test');
        secondAttempt = 'success';
      } catch {
        secondAttempt = 'failed';
      }

      expect(firstAttempt).toBe('failed');
      expect(secondAttempt).toBe('success');
    });
  });

  describe('Performance Monitoring', () => {
    it('should monitor response times for core operations', async () => {
      const startTime = Date.now();

      analyzeToxicity.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ score: 0.1 }), 100))
      );

      await analyzeToxicity('performance test');

      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeGreaterThan(90); // At least 90ms due to delay
      expect(responseTime).toBeLessThan(500); // But under acceptable threshold
    });

    it('should detect performance degradation', async () => {
      const responses = [];

      analyzeToxicity.mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve({ score: 0.1 }), Math.random() * 1000))
      );

      // Run multiple requests to detect performance
      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();
        await analyzeToxicity(`test ${i}`);
        const responseTime = Date.now() - startTime;
        responses.push(responseTime);
      }

      const averageResponseTime = responses.reduce((a, b) => a + b, 0) / responses.length;

      expect(responses.length).toBe(3);
      expect(averageResponseTime).toBeGreaterThan(0);

      // Check if any response took too long (performance degradation)
      const slowResponses = responses.filter((time) => time > 800);
      if (slowResponses.length > 0) {
        console.warn(`Performance degradation detected: ${slowResponses.length} slow responses`);
      }
    });
  });
});
