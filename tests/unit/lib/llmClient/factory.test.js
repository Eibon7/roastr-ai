/**
 * LLMClient Factory Tests
 * Issue #920: Portkey AI Gateway integration
 */

const LLMClient = require('../../../../src/lib/llmClient');
const mockMode = require('../../../../src/config/mockMode');

describe('LLMClient Factory', () => {
  beforeEach(() => {
    // Clear cache before each test
    LLMClient.clearCache();
  });

  afterEach(() => {
    LLMClient.clearCache();
  });

  describe('getInstance', () => {
    test('should return singleton instance for same mode', () => {
      const client1 = LLMClient.getInstance('default');
      const client2 = LLMClient.getInstance('default');
      
      expect(client1).toBe(client2);
    });

    test('should return different instances for different modes', () => {
      const client1 = LLMClient.getInstance('default');
      const client2 = LLMClient.getInstance('balanceado');
      
      expect(client1).not.toBe(client2);
      expect(client1.mode).toBe('default');
      expect(client2.mode).toBe('balanceado');
    });

    test('should use default mode when mode not specified', () => {
      const client = LLMClient.getInstance();
      
      expect(client.mode).toBe('default');
    });

    test('should fallback to default mode when invalid mode specified', () => {
      const client = LLMClient.getInstance('invalid-mode');
      
      expect(client.mode).toBe('default');
    });
  });

  describe('OpenAI-compatible interface', () => {
    test('should expose chat.completions.create', () => {
      const client = LLMClient.getInstance('default');
      
      expect(client.chat).toBeDefined();
      expect(client.chat.completions).toBeDefined();
      expect(typeof client.chat.completions.create).toBe('function');
    });

    test('should expose embeddings.create', () => {
      const client = LLMClient.getInstance('default');
      
      expect(client.embeddings).toBeDefined();
      expect(client.embeddings.create).toBeDefined();
      expect(typeof client.embeddings.create).toBe('function');
    });

    test('should expose responses.create for Responses API', () => {
      const client = LLMClient.getInstance('default');
      
      expect(client.responses).toBeDefined();
      expect(client.responses.create).toBeDefined();
      expect(typeof client.responses.create).toBe('function');
    });
  });

  describe('Portkey configuration', () => {
    test('should detect Portkey configuration', () => {
      const originalKey = process.env.PORTKEY_API_KEY;
      const originalProject = process.env.PORTKEY_PROJECT_ID;
      
      process.env.PORTKEY_API_KEY = 'test-key';
      process.env.PORTKEY_PROJECT_ID = 'test-project';
      
      const isConfigured = LLMClient.isPortkeyConfigured();
      expect(isConfigured).toBe(true);
      
      // Restore
      process.env.PORTKEY_API_KEY = originalKey;
      process.env.PORTKEY_PROJECT_ID = originalProject;
    });

    test('should return false when Portkey not configured', () => {
      const originalKey = process.env.PORTKEY_API_KEY;
      const originalProject = process.env.PORTKEY_PROJECT_ID;
      
      delete process.env.PORTKEY_API_KEY;
      delete process.env.PORTKEY_PROJECT_ID;
      
      const isConfigured = LLMClient.isPortkeyConfigured();
      expect(isConfigured).toBe(false);
      
      // Restore
      process.env.PORTKEY_API_KEY = originalKey;
      process.env.PORTKEY_PROJECT_ID = originalProject;
    });
  });

  describe('Mode validation', () => {
    test('should validate mode exists', () => {
      expect(LLMClient.modeExists('default')).toBe(true);
      expect(LLMClient.modeExists('flanders')).toBe(true);
      expect(LLMClient.modeExists('balanceado')).toBe(true);
      expect(LLMClient.modeExists('canalla')).toBe(true);
      expect(LLMClient.modeExists('nsfw')).toBe(true);
      expect(LLMClient.modeExists('invalid')).toBe(false);
    });

    test('should get available modes', () => {
      const modes = LLMClient.getAvailableModes();
      
      expect(Array.isArray(modes)).toBe(true);
      expect(modes.length).toBeGreaterThan(0);
      expect(modes).toContain('default');
      expect(modes).toContain('flanders');
      expect(modes).toContain('balanceado');
      expect(modes).toContain('canalla');
      expect(modes).toContain('nsfw');
    });
  });

  describe('Route configuration', () => {
    test('should get route for mode', () => {
      const route = LLMClient.getRoute('default');
      
      expect(route).toBeDefined();
      expect(route.provider).toBeDefined();
      expect(route.model).toBeDefined();
      expect(route.config).toBeDefined();
    });

    test('should return default route for invalid mode', () => {
      const route = LLMClient.getRoute('invalid-mode');
      
      expect(route.provider).toBe('openai');
      expect(route.model).toBe('gpt-5.1');
    });
  });
});

