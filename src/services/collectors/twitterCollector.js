/**
 * Twitter Content Collector for Stylecard Generation
 * Collects recent tweets and replies for style analysis
 */

const { TwitterApi } = require('twitter-api-v2');
const logger = require('../../utils/logger');

class TwitterCollector {
  constructor() {
    this.rateLimits = {
      userTweets: { requests: 300, window: 15 * 60 * 1000 }, // 300 requests per 15 minutes
      userTimeline: { requests: 1500, window: 15 * 60 * 1000 }
    };
    
    this.lastRequestTimes = new Map();
  }

  /**
   * Collect recent content from Twitter
   * @param {Object} config - Integration configuration with Twitter credentials
   * @param {number} maxContent - Maximum number of content items to collect
   * @param {string} languageFilter - Language filter (optional)
   * @returns {Array} Array of content objects
   */
  async collectRecentContent(config, maxContent = 50, languageFilter = null) {
    try {
      logger.info('Starting Twitter content collection', {
        maxContent,
        languageFilter,
        hasCredentials: !!(config.access_token && config.access_token_secret)
      });

      // Initialize Twitter client
      const client = this.initializeClient(config);
      
      // Get user's own tweets and replies
      const userContent = await this.getUserContent(client, maxContent, languageFilter);
      
      logger.info('Twitter content collection completed', {
        contentCollected: userContent.length,
        maxRequested: maxContent
      });

      return userContent;

    } catch (error) {
      logger.error('Failed to collect Twitter content', {
        error: error.message,
        stack: error.stack,
        maxContent,
        languageFilter
      });

      // Return empty array instead of throwing to allow other platforms to continue
      return [];
    }
  }

  /**
   * Initialize Twitter API client
   * @private
   */
  initializeClient(config) {
    if (!config.access_token || !config.access_token_secret) {
      throw new Error('Twitter access tokens not configured');
    }

    return new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: config.access_token,
      accessSecret: config.access_token_secret,
    });
  }

  /**
   * Get user's own content (tweets and replies)
   * @private
   */
  async getUserContent(client, maxContent, languageFilter) {
    try {
      // Get authenticated user info
      const user = await client.v2.me();
      const userId = user.data.id;

      // Respect rate limits
      await this.respectRateLimit('userTweets');

      // Fetch user's recent tweets
      const tweets = await client.v2.userTimeline(userId, {
        max_results: Math.min(maxContent, 100), // Twitter API limit
        exclude: ['retweets'], // Exclude retweets to get original content
        'tweet.fields': [
          'created_at',
          'public_metrics',
          'lang',
          'context_annotations',
          'conversation_id',
          'in_reply_to_user_id'
        ],
        expansions: ['referenced_tweets.id']
      });

      const contentItems = [];

      for (const tweet of tweets.data || []) {
        // Skip if language filter is specified and doesn't match
        if (languageFilter && tweet.lang !== languageFilter) {
          continue;
        }

        // Skip very short tweets or retweets
        if (!tweet.text || tweet.text.length < 10 || tweet.text.startsWith('RT @')) {
          continue;
        }

        // Skip tweets with only URLs or mentions
        const cleanText = tweet.text.replace(/(https?:\/\/[^\s]+|@\w+|#\w+)/g, '').trim();
        if (cleanText.length < 10) {
          continue;
        }

        const contentItem = {
          id: tweet.id,
          platform: 'twitter',
          type: tweet.in_reply_to_user_id ? 'reply' : 'tweet',
          text: tweet.text,
          language: tweet.lang,
          created_at: new Date(tweet.created_at),
          engagement: this.calculateEngagement(tweet.public_metrics),
          metadata: {
            conversation_id: tweet.conversation_id,
            is_reply: !!tweet.in_reply_to_user_id,
            public_metrics: tweet.public_metrics,
            context_annotations: tweet.context_annotations || []
          }
        };

        contentItems.push(contentItem);

        // Stop if we've collected enough content
        if (contentItems.length >= maxContent) {
          break;
        }
      }

      return contentItems;

    } catch (error) {
      logger.error('Failed to get user Twitter content', {
        error: error.message,
        code: error.code,
        rateLimit: error.rateLimit
      });

      // Handle rate limiting
      if (error.code === 429) {
        logger.warn('Twitter rate limit exceeded, returning partial results');
        return [];
      }

      throw error;
    }
  }

  /**
   * Calculate engagement score for a tweet
   * @private
   */
  calculateEngagement(metrics) {
    if (!metrics) return 0;
    
    const {
      retweet_count = 0,
      like_count = 0,
      reply_count = 0,
      quote_count = 0
    } = metrics;

    // Weighted engagement score
    return (like_count * 1) + (retweet_count * 2) + (reply_count * 3) + (quote_count * 2);
  }

  /**
   * Respect Twitter API rate limits
   * @private
   */
  async respectRateLimit(endpoint) {
    const limits = this.rateLimits[endpoint];
    if (!limits) return;

    const now = Date.now();
    const lastRequest = this.lastRequestTimes.get(endpoint) || 0;
    const timeSinceLastRequest = now - lastRequest;

    // If we're making requests too quickly, wait
    const minInterval = limits.window / limits.requests;
    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      logger.debug('Waiting for Twitter rate limit', {
        endpoint,
        waitTimeMs: waitTime
      });
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTimes.set(endpoint, Date.now());
  }

  /**
   * Validate Twitter configuration
   */
  validateConfig(config) {
    const required = ['access_token', 'access_token_secret'];
    const missing = required.filter(field => !config[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing Twitter configuration: ${missing.join(', ')}`);
    }

    return true;
  }

  /**
   * Test Twitter connection
   */
  async testConnection(config) {
    try {
      this.validateConfig(config);
      const client = this.initializeClient(config);
      
      // Simple test - get user info
      const user = await client.v2.me();
      
      return {
        success: true,
        user: {
          id: user.data.id,
          username: user.data.username,
          name: user.data.name
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get platform-specific metadata
   */
  getPlatformInfo() {
    return {
      name: 'Twitter',
      maxContentPerRequest: 100,
      rateLimitWindow: 15, // minutes
      rateLimitRequests: 300,
      supportedContentTypes: ['tweet', 'reply'],
      requiresAuth: true,
      authType: 'oauth1'
    };
  }
}

module.exports = new TwitterCollector();
