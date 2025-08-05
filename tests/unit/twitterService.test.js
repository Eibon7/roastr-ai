/**
 * Tests unitarios para TwitterRoastBot
 * Valida el comportamiento del bot de Twitter con rate limiting y manejo de errores
 */

const TwitterRoastBot = require('../../src/services/twitter');
const fs = require('fs-extra');
const axios = require('axios');
const { 
  createMockTwitterUser, 
  createMockTweet, 
  createMockMentionsResponse,
  setMockEnvVars, 
  cleanupMocks,
  delay 
} = require('../helpers/testUtils');

// Mock de dependencias
jest.mock('twitter-api-v2');
jest.mock('fs-extra');
jest.mock('axios');

describe('TwitterRoastBot', () => {
  let bot;
  let mockTwitterClient;
  let mockBearerClient;
  let mockFs;
  let mockAxios;

  beforeAll(() => {
    setMockEnvVars();
  });

  beforeEach(() => {
    cleanupMocks();
    
    // Mock de Twitter API
    const { TwitterApi } = require('twitter-api-v2');
    
    mockTwitterClient = {
      v2: {
        me: jest.fn(),
        reply: jest.fn()
      }
    };
    
    mockBearerClient = {
      v2: {
        streamRules: jest.fn(),
        updateStreamRules: jest.fn(),
        searchStream: jest.fn(),
        userMentionTimeline: jest.fn()
      }
    };
    
    TwitterApi.mockImplementation((config) => {
      // Si tiene Bearer token, devolver bearer client
      if (typeof config === 'string') {
        return mockBearerClient;
      }
      // Si es objeto con keys, devolver client normal
      return mockTwitterClient;
    });

    // Mock de fs-extra
    mockFs = require('fs-extra');
    mockFs.ensureFile.mockResolvedValue(undefined);
    mockFs.pathExists.mockResolvedValue(true);
    mockFs.readFile.mockResolvedValue('{"processedTweetIds": []}');
    mockFs.writeJson.mockResolvedValue(undefined);
    mockFs.readJson.mockResolvedValue({ processedTweetIds: [] });

    // Mock de axios
    mockAxios = require('axios');
    mockAxios.post = jest.fn();

    bot = new TwitterRoastBot();
  });

  afterEach(() => {
    cleanupMocks();
  });

  describe('Constructor', () => {
    test('debe inicializarse correctamente con configuración válida', () => {
      expect(bot).toBeInstanceOf(TwitterRoastBot);
      expect(bot.client).toBeDefined();
      expect(bot.bearerClient).toBeDefined();
      expect(bot.rateLimits).toBeDefined();
      expect(bot.errorStats).toBeDefined();
    });

    test('debe configurar rate limits por defecto', () => {
      expect(bot.rateLimits.tweetsPerHour).toBe(10);
      expect(bot.rateLimits.minDelayBetweenTweets).toBe(5000);
      expect(bot.rateLimits.maxDelayBetweenTweets).toBe(30000);
      expect(bot.rateLimits.tweetsTimestamps).toEqual([]);
    });

    test('debe configurar tracking de errores', () => {
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

  describe('Tweet Processing', () => {
    beforeEach(() => {
      // Mock métodos necesarios
      bot.botUserId = '123456789';
      bot.botUsername = 'testbot';
    });

    test('isSelfTweet debe identificar tweets propios', () => {
      expect(bot.isSelfTweet('123456789')).toBe(true);
      expect(bot.isSelfTweet('987654321')).toBe(false);
    });

    test('processSingleTweet debe saltar si rate limit alcanzado', async () => {
      // Arrange
      jest.spyOn(bot, 'canSendTweet').mockReturnValue(false);
      const mockTweet = createMockTweet();
      
      // Act
      await bot.processSingleTweet(mockTweet);
      
      // Assert
      expect(mockFs.writeJson).not.toHaveBeenCalled(); // No mark as processed
    });

    test('processSingleTweet debe procesar tweet válido', async () => {
      // Arrange
      jest.spyOn(bot, 'canSendTweet').mockReturnValue(true);
      jest.spyOn(bot, 'isAllowedToRoast').mockResolvedValue(true);
      jest.spyOn(bot, 'generateRoast').mockResolvedValue('Test roast');
      jest.spyOn(bot, 'replyToTweet').mockResolvedValue({ data: { id: 'reply123' } });
      jest.spyOn(bot, 'recordTweetSent').mockImplementation(() => {});
      jest.spyOn(bot, 'markTweetAsProcessed').mockResolvedValue(undefined);
      
      const mockTweet = createMockTweet();
      
      // Act
      await bot.processSingleTweet(mockTweet);
      
      // Assert
      expect(bot.generateRoast).toHaveBeenCalledWith(mockTweet.text);
      expect(bot.replyToTweet).toHaveBeenCalledWith(mockTweet.id, 'Test roast');
      expect(bot.recordTweetSent).toHaveBeenCalled();
      expect(bot.markTweetAsProcessed).toHaveBeenCalledWith(mockTweet.id);
    });

    test('processSingleTweet debe saltar si contenido no permitido', async () => {
      // Arrange
      jest.spyOn(bot, 'canSendTweet').mockReturnValue(true);
      jest.spyOn(bot, 'isAllowedToRoast').mockResolvedValue(false);
      jest.spyOn(bot, 'markTweetAsProcessed').mockResolvedValue(undefined);
      jest.spyOn(bot, 'resetErrorTracking').mockImplementation(() => {});
      
      const mockTweet = createMockTweet();
      
      // Act
      await bot.processSingleTweet(mockTweet);
      
      // Assert
      expect(bot.markTweetAsProcessed).toHaveBeenCalledWith(mockTweet.id);
      expect(bot.resetErrorTracking).toHaveBeenCalled();
    });

    test('processSingleTweet debe manejar errores correctamente', async () => {
      // Arrange
      jest.spyOn(bot, 'canSendTweet').mockReturnValue(true);
      jest.spyOn(bot, 'isAllowedToRoast').mockRejectedValue(new Error('Test error'));
      jest.spyOn(bot, 'trackError').mockReturnValue(1000); // 1 segundo de backoff
      jest.spyOn(bot, 'sleep').mockResolvedValue(undefined);
      
      const mockTweet = createMockTweet();
      
      // Act
      await bot.processSingleTweet(mockTweet);
      
      // Assert
      expect(bot.trackError).toHaveBeenCalled();
      expect(bot.sleep).toHaveBeenCalledWith(1000);
    });
  });

  describe('Bot Initialization', () => {
    test('initializeBotInfo debe obtener información del usuario', async () => {
      // Arrange
      const mockUserData = createMockTwitterUser('123', 'testbot');
      mockTwitterClient.v2.me.mockResolvedValue(mockUserData);
      
      // Act
      const result = await bot.initializeBotInfo();
      
      // Assert
      expect(result).toEqual(mockUserData.data);
      expect(bot.botUserId).toBe('123');
      expect(bot.botUsername).toBe('testbot');
    });

    test('initializeBotInfo debe manejar errores de autenticación', async () => {
      // Arrange
      mockTwitterClient.v2.me.mockRejectedValue(new Error('Auth error'));
      
      // Act & Assert
      await expect(bot.initializeBotInfo()).rejects.toThrow('Auth error');
    });
  });

  describe('Roast Generation', () => {
    test('generateRoast debe llamar a la API correctamente', async () => {
      // Arrange
      const mockResponse = { data: { roast: 'Generated roast' } };
      mockAxios.post.mockResolvedValue(mockResponse);
      
      // Act
      const result = await bot.generateRoast('Test message');
      
      // Assert
      expect(result).toBe('Generated roast');
      expect(mockAxios.post).toHaveBeenCalledWith(
        `${bot.roastApiUrl}/roast`,
        { message: 'Test message' },
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          timeout: 15000
        })
      );
    });

    test('generateRoast debe reintentar en caso de error', async () => {
      // Arrange
      mockAxios.post
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { roast: 'Retry success' } });
      
      jest.spyOn(bot, 'sleep').mockResolvedValue(undefined);
      
      // Act
      const result = await bot.generateRoast('Test message');
      
      // Assert
      expect(result).toBe('Retry success');
      expect(mockAxios.post).toHaveBeenCalledTimes(2);
      expect(bot.sleep).toHaveBeenCalledWith(2000);
    });

    test('generateRoast debe fallar después de todos los reintentos', async () => {
      // Arrange
      mockAxios.post.mockRejectedValue(new Error('Persistent error'));
      jest.spyOn(bot, 'sleep').mockResolvedValue(undefined);
      
      // Act & Assert
      await expect(bot.generateRoast('Test message')).rejects.toThrow('Persistent error');
      expect(mockAxios.post).toHaveBeenCalledTimes(3); // 1 inicial + 2 reintentos
    });
  });

  describe('Processed Tweets Management', () => {
    test('getProcessedTweetIds debe leer del archivo', async () => {
      // Arrange
      const mockData = { processedTweetIds: ['123', '456'] };
      mockFs.readJson.mockResolvedValue(mockData);
      
      // Override the method to use our mock
      jest.spyOn(bot, 'getProcessedTweetIds').mockResolvedValue(['123', '456']);
      
      // Act
      const result = await bot.getProcessedTweetIds();
      
      // Assert
      expect(result).toEqual(['123', '456']);
    });

    test('markTweetAsProcessed debe añadir ID y mantener límite', async () => {
      // Arrange
      const existingIds = Array(1000).fill(0).map((_, i) => `tweet_${i}`);
      const mockData = { processedTweetIds: existingIds };
      mockFs.readJson.mockResolvedValue(mockData);
      mockFs.writeJson.mockResolvedValue(undefined);
      
      // Act
      await bot.markTweetAsProcessed('new_tweet_id');
      
      // Assert
      expect(mockFs.writeJson).toHaveBeenCalled();
      const writeCall = mockFs.writeJson.mock.calls[0];
      const writtenData = writeCall[1];
      expect(writtenData.processedTweetIds).toHaveLength(1000); // Mantiene límite
      expect(writtenData.processedTweetIds).toContain('new_tweet_id');
    });
  });

  describe('Validation', () => {
    test('validateConfig debe verificar variables requeridas', () => {
      expect(bot.validateConfig()).toBe(true);
    });

    test('validateConfig debe fallar si falta variable', () => {
      delete process.env.TWITTER_BEARER_TOKEN;
      
      const result = bot.validateConfig();
      
      expect(result).toBe(false);
      setMockEnvVars(); // Restaurar
    });
  });
});