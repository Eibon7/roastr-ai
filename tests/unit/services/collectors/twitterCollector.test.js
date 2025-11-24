/**
 * Tests for TwitterCollector - Issue #293
 */

const twitterCollector = require('../../../../src/services/collectors/twitterCollector');

// Mock twitter-api-v2
jest.mock('twitter-api-v2', () => ({
  TwitterApi: jest.fn().mockImplementation(() => ({
    v2: {
      me: jest.fn(),
      userTimeline: jest.fn()
    }
  }))
}));

describe('TwitterCollector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TWITTER_API_KEY = 'test-api-key';
    process.env.TWITTER_API_SECRET = 'test-api-secret';
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const config = {
        access_token: 'test-token',
        access_token_secret: 'test-secret'
      };

      expect(() => twitterCollector.validateConfig(config)).not.toThrow();
    });

    it('should throw error for missing access token', () => {
      const config = {
        access_token_secret: 'test-secret'
      };

      expect(() => twitterCollector.validateConfig(config)).toThrow(
        'Missing Twitter configuration: access_token'
      );
    });

    it('should throw error for missing access token secret', () => {
      const config = {
        access_token: 'test-token'
      };

      expect(() => twitterCollector.validateConfig(config)).toThrow(
        'Missing Twitter configuration: access_token_secret'
      );
    });
  });

  describe('collectRecentContent', () => {
    it('should collect and filter Twitter content', async () => {
      const mockTweets = {
        data: [
          {
            id: '1',
            text: 'This is a great tweet about technology!',
            lang: 'en',
            created_at: '2023-01-01T00:00:00.000Z',
            public_metrics: {
              like_count: 10,
              retweet_count: 5,
              reply_count: 2,
              quote_count: 1
            }
          },
          {
            id: '2',
            text: 'RT @someone: This is a retweet',
            lang: 'en',
            created_at: '2023-01-01T00:00:00.000Z',
            public_metrics: { like_count: 0 }
          },
          {
            id: '3',
            text: 'Short',
            lang: 'en',
            created_at: '2023-01-01T00:00:00.000Z',
            public_metrics: { like_count: 1 }
          }
        ]
      };

      const mockClient = {
        v2: {
          me: jest.fn().mockResolvedValue({ data: { id: 'user123' } }),
          userTimeline: jest.fn().mockResolvedValue(mockTweets)
        }
      };

      // Mock the initializeClient method
      twitterCollector.initializeClient = jest.fn().mockReturnValue(mockClient);

      const config = {
        access_token: 'test-token',
        access_token_secret: 'test-secret'
      };

      const result = await twitterCollector.collectRecentContent(config, 10, 'en');

      expect(result).toHaveLength(1); // Only the first tweet should pass filters
      expect(result[0].text).toBe('This is a great tweet about technology!');
      expect(result[0].platform).toBe('twitter');
      expect(result[0].type).toBe('tweet');
      expect(result[0].engagement).toBe(28); // 10*1 + 5*2 + 2*3 + 1*2 = 10 + 10 + 6 + 2 = 28
    });

    it('should handle API errors gracefully', async () => {
      const config = {
        access_token: 'test-token',
        access_token_secret: 'test-secret'
      };

      twitterCollector.initializeClient = jest.fn().mockImplementation(() => {
        throw new Error('API Error');
      });

      const result = await twitterCollector.collectRecentContent(config, 10);

      expect(result).toEqual([]); // Should return empty array on error
    });

    it('should filter by language when specified', async () => {
      const mockTweets = {
        data: [
          {
            id: '1',
            text: 'This is an English tweet',
            lang: 'en',
            created_at: '2023-01-01T00:00:00.000Z',
            public_metrics: { like_count: 10 }
          },
          {
            id: '2',
            text: 'Este es un tweet en español',
            lang: 'es',
            created_at: '2023-01-01T00:00:00.000Z',
            public_metrics: { like_count: 5 }
          }
        ]
      };

      const mockClient = {
        v2: {
          me: jest.fn().mockResolvedValue({ data: { id: 'user123' } }),
          userTimeline: jest.fn().mockResolvedValue(mockTweets)
        }
      };

      twitterCollector.initializeClient = jest.fn().mockReturnValue(mockClient);

      const config = {
        access_token: 'test-token',
        access_token_secret: 'test-secret'
      };

      const result = await twitterCollector.collectRecentContent(config, 10, 'es');

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Este es un tweet en español');
      expect(result[0].language).toBe('es');
    });
  });

  describe('calculateEngagement', () => {
    it('should calculate engagement score correctly', () => {
      const metrics = {
        like_count: 10,
        retweet_count: 5,
        reply_count: 3,
        quote_count: 2
      };

      const engagement = twitterCollector.calculateEngagement(metrics);

      // 10*1 + 5*2 + 3*3 + 2*2 = 10 + 10 + 9 + 4 = 33
      expect(engagement).toBe(33);
    });

    it('should handle missing metrics', () => {
      const engagement = twitterCollector.calculateEngagement(null);
      expect(engagement).toBe(0);
    });

    it('should handle partial metrics', () => {
      const metrics = {
        like_count: 5,
        retweet_count: 2
        // missing reply_count and quote_count
      };

      const engagement = twitterCollector.calculateEngagement(metrics);

      // 5*1 + 2*2 + 0*3 + 0*2 = 5 + 4 = 9
      expect(engagement).toBe(9);
    });
  });

  describe('respectRateLimit', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should wait when rate limit is exceeded', async () => {
      // Set up rate limit tracking
      const now = Date.now();
      twitterCollector.lastRequestTimes.set('userTweets', now - 100); // 100ms ago

      const startTime = Date.now();
      const waitPromise = twitterCollector.respectRateLimit('userTweets');

      // Fast-forward time to simulate waiting
      jest.advanceTimersByTime(200);

      await waitPromise;

      // Check that the last request time was updated
      expect(twitterCollector.lastRequestTimes.get('userTweets')).toBeGreaterThan(now);
    }, 15000); // Increase timeout

    it('should not wait when rate limit is not exceeded', async () => {
      // Clear any previous requests
      twitterCollector.lastRequestTimes.delete('userTweets');

      const startTime = Date.now();
      await twitterCollector.respectRateLimit('userTweets');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const mockClient = {
        v2: {
          me: jest.fn().mockResolvedValue({
            data: {
              id: 'user123',
              username: 'testuser',
              name: 'Test User'
            }
          })
        }
      };

      twitterCollector.initializeClient = jest.fn().mockReturnValue(mockClient);

      const config = {
        access_token: 'test-token',
        access_token_secret: 'test-secret'
      };

      const result = await twitterCollector.testConnection(config);

      expect(result.success).toBe(true);
      expect(result.user.username).toBe('testuser');
    });

    it('should handle connection failure', async () => {
      twitterCollector.initializeClient = jest.fn().mockImplementation(() => {
        throw new Error('Authentication failed');
      });

      const config = {
        access_token: 'invalid-token',
        access_token_secret: 'invalid-secret'
      };

      const result = await twitterCollector.testConnection(config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed');
    });
  });

  describe('getPlatformInfo', () => {
    it('should return correct platform information', () => {
      const info = twitterCollector.getPlatformInfo();

      expect(info.name).toBe('Twitter');
      expect(info.maxContentPerRequest).toBe(100);
      expect(info.requiresAuth).toBe(true);
      expect(info.authType).toBe('oauth1');
      expect(info.supportedContentTypes).toContain('tweet');
      expect(info.supportedContentTypes).toContain('reply');
    });
  });

  describe('Content Filtering', () => {
    it('should filter out retweets', async () => {
      const mockTweets = {
        data: [
          {
            id: '1',
            text: 'RT @someone: This is a retweet and should be filtered',
            lang: 'en',
            created_at: '2023-01-01T00:00:00.000Z',
            public_metrics: { like_count: 10 }
          },
          {
            id: '2',
            text: 'This is an original tweet and should be kept',
            lang: 'en',
            created_at: '2023-01-01T00:00:00.000Z',
            public_metrics: { like_count: 5 }
          }
        ]
      };

      const mockClient = {
        v2: {
          me: jest.fn().mockResolvedValue({ data: { id: 'user123' } }),
          userTimeline: jest.fn().mockResolvedValue(mockTweets)
        }
      };

      twitterCollector.initializeClient = jest.fn().mockReturnValue(mockClient);

      const config = {
        access_token: 'test-token',
        access_token_secret: 'test-secret'
      };

      const result = await twitterCollector.collectRecentContent(config, 10);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('This is an original tweet and should be kept');
    });

    it('should filter out tweets with only URLs and mentions', async () => {
      const mockTweets = {
        data: [
          {
            id: '1',
            text: '@user1 @user2 https://example.com',
            lang: 'en',
            created_at: '2023-01-01T00:00:00.000Z',
            public_metrics: { like_count: 10 }
          },
          {
            id: '2',
            text: 'This tweet has actual content beyond just mentions and links',
            lang: 'en',
            created_at: '2023-01-01T00:00:00.000Z',
            public_metrics: { like_count: 5 }
          }
        ]
      };

      const mockClient = {
        v2: {
          me: jest.fn().mockResolvedValue({ data: { id: 'user123' } }),
          userTimeline: jest.fn().mockResolvedValue(mockTweets)
        }
      };

      twitterCollector.initializeClient = jest.fn().mockReturnValue(mockClient);

      const config = {
        access_token: 'test-token',
        access_token_secret: 'test-secret'
      };

      const result = await twitterCollector.collectRecentContent(config, 10);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('This tweet has actual content beyond just mentions and links');
    });
  });
});
