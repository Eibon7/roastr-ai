/**
 * Tests unitarios simplificados para TwitterRoastBot
 * Usando mocks automáticos para evitar complejidades
 */

const { setMockEnvVars, cleanupMocks } = require('../helpers/testUtils');

// Mock las dependencias
jest.mock('twitter-api-v2');
jest.mock('fs-extra');
jest.mock('axios');

// Import después de los mocks
const TwitterRoastBot = require('../../src/services/twitter');

describe('TwitterRoastBot (Simplified)', () => {
  let bot;

  beforeAll(() => {
    setMockEnvVars();
  });

  beforeEach(() => {
    cleanupMocks();
  });

  afterEach(() => {
    cleanupMocks();
  });

  describe('Constructor', () => {
    test('debe inicializarse correctamente con configuración válida', () => {
      expect(() => {
        bot = new TwitterRoastBot();
      }).not.toThrow();
      
      expect(bot).toBeInstanceOf(TwitterRoastBot);
      expect(bot.rateLimits).toBeDefined();
      expect(bot.errorStats).toBeDefined();
    });

    test('debe configurar rate limits por defecto', () => {
      bot = new TwitterRoastBot();
      
      expect(bot.rateLimits.tweetsPerHour).toBe(10);
      expect(bot.rateLimits.minDelayBetweenTweets).toBe(5000);
      expect(bot.rateLimits.maxDelayBetweenTweets).toBe(30000);
      expect(bot.rateLimits.tweetsTimestamps).toEqual([]);
    });

    test('debe configurar tracking de errores', () => {
      bot = new TwitterRoastBot();
      
      expect(bot.errorStats.consecutiveErrors).toBe(0);
      expect(bot.errorStats.maxConsecutiveErrors).toBe(5);
      expect(bot.errorStats.backoffMultiplier).toBe(2);
      expect(bot.errorStats.baseBackoffDelay).toBe(5000);
    });

    test('debe lanzar error si falta configuración de Twitter', () => {
      delete process.env.TWITTER_BEARER_TOKEN;
      
      expect(() => {
        new TwitterRoastBot();
      }).toThrow('Invalid Twitter configuration');
      
      setMockEnvVars(); // Restaurar para otros tests
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      bot = new TwitterRoastBot();
    });

    test('canSendTweet debe devolver true inicialmente', () => {
      expect(bot.canSendTweet()).toBe(true);
    });

    test('canSendTweet debe devolver false si se alcanza el límite por hora', () => {
      // Simular que se enviaron 10 tweets en la última hora
      const now = Date.now();
      bot.rateLimits.tweetsTimestamps = Array(10).fill(now - 1000);
      
      expect(bot.canSendTweet()).toBe(false);
    });

    test('canSendTweet debe limpiar timestamps antiguos', () => {
      // Añadir timestamps antiguos (más de 1 hora)
      const oldTimestamp = Date.now() - (2 * 60 * 60 * 1000); // 2 horas atrás
      bot.rateLimits.tweetsTimestamps = [oldTimestamp];
      
      expect(bot.canSendTweet()).toBe(true);
      expect(bot.rateLimits.tweetsTimestamps).toHaveLength(0);
    });

    test('canSendTweet debe respetar delay mínimo entre tweets', () => {
      const recentTimestamp = Date.now() - 1000; // 1 segundo atrás
      bot.rateLimits.tweetsTimestamps = [recentTimestamp];
      
      expect(bot.canSendTweet()).toBe(false);
    });

    test('recordTweetSent debe añadir timestamp', () => {
      const initialLength = bot.rateLimits.tweetsTimestamps.length;
      
      bot.recordTweetSent();
      
      expect(bot.rateLimits.tweetsTimestamps).toHaveLength(initialLength + 1);
      expect(bot.rateLimits.tweetsTimestamps[bot.rateLimits.tweetsTimestamps.length - 1])
        .toBeCloseTo(Date.now(), -2); // Precisión de ~100ms
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      bot = new TwitterRoastBot();
    });

    test('resetErrorTracking debe limpiar errores consecutivos', () => {
      bot.errorStats.consecutiveErrors = 3;
      bot.errorStats.lastErrorTime = Date.now();
      
      bot.resetErrorTracking();
      
      expect(bot.errorStats.consecutiveErrors).toBe(0);
      expect(bot.errorStats.lastErrorTime).toBeNull();
    });

    test('trackError debe incrementar errores consecutivos', () => {
      const error = new Error('Test error');
      
      const backoffTime = bot.trackError(error);
      
      expect(bot.errorStats.consecutiveErrors).toBe(1);
      expect(bot.errorStats.lastErrorTime).toBeCloseTo(Date.now(), -2);
      expect(backoffTime).toBe(0); // No backoff para el primer error
    });

    test('trackError debe devolver backoff time después de muchos errores', () => {
      // Simular muchos errores consecutivos
      bot.errorStats.consecutiveErrors = 5;
      
      const backoffTime = bot.trackError(new Error('Test'));
      
      expect(backoffTime).toBeGreaterThan(0);
      expect(bot.errorStats.consecutiveErrors).toBe(6);
    });

    test('getProcessingDelay debe incluir backoff en caso de errores', () => {
      bot.errorStats.consecutiveErrors = 2;
      
      const delay = bot.getProcessingDelay();
      
      expect(delay).toBeGreaterThan(bot.rateLimits.minDelayBetweenTweets);
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      bot = new TwitterRoastBot();
      bot.botUserId = '123456789';
      bot.botUsername = 'testbot';
    });

    test('isSelfTweet debe identificar tweets propios', () => {
      expect(bot.isSelfTweet('123456789')).toBe(true);
      expect(bot.isSelfTweet('987654321')).toBe(false);
    });

    test('validateConfig debe verificar variables requeridas', () => {
      expect(bot.validateConfig()).toBe(true);
    });

    test('validateConfig debe fallar si falta variable', () => {
      delete process.env.TWITTER_BEARER_TOKEN;
      
      const result = bot.validateConfig();
      
      expect(result).toBe(false);
      setMockEnvVars(); // Restaurar
    });

    test('sleep debe ser una función', () => {
      expect(typeof bot.sleep).toBe('function');
    });

    test('debugLog debe ser una función', () => {
      expect(typeof bot.debugLog).toBe('function');
    });
  });
});