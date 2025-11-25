/**
 * LLM Fallbacks Tests
 * Issue #920: Portkey AI Gateway integration
 */

const {
  getFallbackChain,
  getNextFallback,
  fallbackChains
} = require('../../../../src/lib/llmClient/fallbacks');

describe('LLM Fallbacks', () => {
  describe('getFallbackChain', () => {
    test('should return fallback chain for valid mode', () => {
      const chain = getFallbackChain('flanders');
      expect(Array.isArray(chain)).toBe(true);
      expect(chain).toContain('openai');
    });

    test('should return fallback chain for nsfw mode', () => {
      const chain = getFallbackChain('nsfw');
      expect(chain).toEqual(['grok', 'openai']);
    });

    test('should return default chain for unknown mode', () => {
      const chain = getFallbackChain('unknown-mode');
      expect(chain).toEqual(['openai']);
    });

    test('should return default chain when mode not specified', () => {
      const chain = getFallbackChain();
      expect(chain).toEqual(['openai']);
    });

    test('should return correct chains for all modes', () => {
      expect(getFallbackChain('default')).toEqual(['openai']);
      expect(getFallbackChain('flanders')).toEqual(['openai']);
      expect(getFallbackChain('balanceado')).toEqual(['openai']);
      expect(getFallbackChain('canalla')).toEqual(['openai']);
      expect(getFallbackChain('nsfw')).toEqual(['grok', 'openai']);
    });
  });

  describe('getNextFallback', () => {
    test('should return next provider in chain', () => {
      const next = getNextFallback('nsfw', 'grok');
      expect(next).toBe('openai');
    });

    test('should return null when no more fallbacks', () => {
      const next = getNextFallback('nsfw', 'openai');
      expect(next).toBeNull();
    });

    test('should return null when provider not in chain', () => {
      const next = getNextFallback('flanders', 'grok');
      expect(next).toBeNull();
    });

    test('should return null for single-provider chain', () => {
      const next = getNextFallback('flanders', 'openai');
      expect(next).toBeNull();
    });

    test('should handle multi-provider fallback chain', () => {
      // For nsfw mode: grok -> openai
      expect(getNextFallback('nsfw', 'grok')).toBe('openai');
      expect(getNextFallback('nsfw', 'openai')).toBeNull();
    });
  });

  describe('fallbackChains configuration', () => {
    test('should have all required modes', () => {
      expect(fallbackChains).toHaveProperty('default');
      expect(fallbackChains).toHaveProperty('flanders');
      expect(fallbackChains).toHaveProperty('balanceado');
      expect(fallbackChains).toHaveProperty('canalla');
      expect(fallbackChains).toHaveProperty('nsfw');
    });

    test('should have arrays for all chains', () => {
      Object.values(fallbackChains).forEach((chain) => {
        expect(Array.isArray(chain)).toBe(true);
        expect(chain.length).toBeGreaterThan(0);
      });
    });

    test('should have openai as fallback for main modes', () => {
      expect(fallbackChains.default).toContain('openai');
      expect(fallbackChains.flanders).toContain('openai');
      expect(fallbackChains.balanceado).toContain('openai');
      expect(fallbackChains.canalla).toContain('openai');
    });

    test('should have grok as primary for nsfw mode', () => {
      expect(fallbackChains.nsfw[0]).toBe('grok');
      expect(fallbackChains.nsfw[1]).toBe('openai');
    });
  });
});
