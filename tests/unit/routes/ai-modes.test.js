/**
 * AI Modes API Routes Tests
 * Issue #920: Portkey AI Gateway integration
 */

const request = require('supertest');
const express = require('express');
const aiModesRoutes = require('../../../src/routes/ai-modes');
const { authenticateToken } = require('../../../src/middleware/auth');

// Mock authentication middleware
jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id' };
    next();
  })
}));

// Mock LLMClient
jest.mock('../../../src/lib/llmClient', () => ({
  getAvailableModes: jest.fn(() => ['default', 'flanders', 'balanceado', 'canalla', 'nsfw']),
  getRoute: jest.fn((mode) => {
    const routes = {
      default: { provider: 'openai', model: 'gpt-5.1', config: { temperature: 0.8 } },
      flanders: { provider: 'openai', model: 'gpt-5.1', config: { temperature: 0.7 } },
      balanceado: { provider: 'openai', model: 'gpt-5.1', config: { temperature: 0.8 } },
      canalla: { provider: 'openai', model: 'gpt-5.1', config: { temperature: 0.9 } },
      nsfw: { provider: 'grok', model: 'grok-beta', config: { temperature: 0.9 } }
    };
    return routes[mode] || routes.default;
  }),
  getFallbackChain: jest.fn((mode) => {
    if (mode === 'nsfw') return ['grok', 'openai'];
    return ['openai'];
  })
}));

describe('AI Modes API Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/ai-modes', aiModesRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/ai-modes', () => {
    test('should return list of available AI modes', async () => {
      const response = await request(app).get('/api/ai-modes').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    test('should include all required modes', async () => {
      const response = await request(app).get('/api/ai-modes').expect(200);

      const modeIds = response.body.data.map((mode) => mode.id);
      expect(modeIds).toContain('default');
      expect(modeIds).toContain('flanders');
      expect(modeIds).toContain('balanceado');
      expect(modeIds).toContain('canalla');
      expect(modeIds).toContain('nsfw');
    });

    test('should include mode metadata', async () => {
      const response = await request(app).get('/api/ai-modes').expect(200);

      const flandersMode = response.body.data.find((m) => m.id === 'flanders');
      expect(flandersMode).toBeDefined();
      expect(flandersMode.name).toBe('Flanders');
      expect(flandersMode.description).toBeDefined();
      expect(flandersMode.intensity).toBe(2);
      expect(flandersMode.provider).toBe('openai');
      expect(flandersMode.model).toBe('gpt-5.1');
      expect(flandersMode.temperature).toBe(0.7);
    });

    test('should include fallback chain for each mode', async () => {
      const response = await request(app).get('/api/ai-modes').expect(200);

      const nsfwMode = response.body.data.find((m) => m.id === 'nsfw');
      expect(nsfwMode.fallbackChain).toEqual(['grok', 'openai']);

      const balanceadoMode = response.body.data.find((m) => m.id === 'balanceado');
      expect(balanceadoMode.fallbackChain).toEqual(['openai']);
    });

    test('should mark NSFW mode as unavailable when Grok not configured', async () => {
      // Mock environment without Grok
      const originalGrok = process.env.GROK_API_KEY;
      const originalPortkey = process.env.PORTKEY_API_KEY;
      delete process.env.GROK_API_KEY;
      delete process.env.PORTKEY_API_KEY;

      const response = await request(app).get('/api/ai-modes').expect(200);

      const nsfwMode = response.body.data.find((m) => m.id === 'nsfw');
      expect(nsfwMode.available).toBe(false);

      // Restore
      if (originalGrok) process.env.GROK_API_KEY = originalGrok;
      if (originalPortkey) process.env.PORTKEY_API_KEY = originalPortkey;
    });

    test('should require authentication', async () => {
      // Mock auth to fail
      authenticateToken.mockImplementationOnce((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      await request(app).get('/api/ai-modes').expect(401);
    });

    test('should handle errors gracefully', async () => {
      const LLMClient = require('../../../src/lib/llmClient');
      LLMClient.getAvailableModes.mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      const response = await request(app).get('/api/ai-modes').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });
});
