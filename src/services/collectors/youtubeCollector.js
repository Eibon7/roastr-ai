/**
 * YouTube Content Collector for Stylecard Generation
 * Collects recent video descriptions and comments for style analysis
 */

const { google } = require('googleapis');
const logger = require('../../utils/logger');

class YouTubeCollector {
  constructor() {
    this.youtube = google.youtube('v3');
    this.rateLimits = {
      search: { requests: 100, window: 24 * 60 * 60 * 1000 }, // 100 requests per day
      videos: { requests: 1000000, window: 24 * 60 * 60 * 1000 } // 1M quota units per day
    };

    this.lastRequestTimes = new Map();
  }

  /**
   * Collect recent content from YouTube
   * @param {Object} config - Integration configuration with YouTube credentials
   * @param {number} maxContent - Maximum number of content items to collect
   * @param {string} languageFilter - Language filter (optional)
   * @returns {Array} Array of content objects
   */
  async collectRecentContent(config, maxContent = 50, languageFilter = null) {
    try {
      logger.info('Starting YouTube content collection', {
        maxContent,
        languageFilter,
        hasApiKey: !!process.env.YOUTUBE_API_KEY
      });

      // Initialize YouTube API
      this.youtube = google.youtube({
        version: 'v3',
        auth: process.env.YOUTUBE_API_KEY
      });

      // Get user's channel content
      const userContent = await this.getUserContent(config, maxContent, languageFilter);

      logger.info('YouTube content collection completed', {
        contentCollected: userContent.length,
        maxRequested: maxContent
      });

      return userContent;
    } catch (error) {
      logger.error('Failed to collect YouTube content', {
        error: error.message,
        stack: error.stack,
        maxContent,
        languageFilter
      });

      return [];
    }
  }

  /**
   * Get user's YouTube content
   * @private
   */
  async getUserContent(config, maxContent, languageFilter) {
    try {
      if (!config.channel_id && !config.channel_handle) {
        throw new Error('YouTube channel ID or handle not configured');
      }

      // Get channel info first
      let channelId = config.channel_id;
      if (!channelId && config.channel_handle) {
        channelId = await this.getChannelIdFromHandle(config.channel_handle);
      }

      // Respect rate limits
      await this.respectRateLimit('search');

      // Get recent videos from the channel
      const videosResponse = await this.youtube.search.list({
        part: 'id,snippet',
        channelId: channelId,
        type: 'video',
        order: 'date',
        maxResults: Math.min(maxContent, 50),
        publishedAfter: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() // Last 90 days
      });

      const contentItems = [];

      for (const video of videosResponse.data.items || []) {
        const snippet = video.snippet;

        // Skip if no description or title
        if (!snippet.description && !snippet.title) continue;

        // Combine title and description for analysis
        const fullText = `${snippet.title}\n\n${snippet.description || ''}`.trim();

        // Skip very short content
        if (fullText.length < 20) continue;

        // Basic language detection
        const detectedLanguage = this.detectLanguage(fullText);
        if (languageFilter && detectedLanguage !== languageFilter) continue;

        // Clean the text
        const cleanText = this.cleanVideoText(fullText);
        if (cleanText.length < 20) continue;

        const contentItem = {
          id: video.id.videoId,
          platform: 'youtube',
          type: 'video',
          text: cleanText,
          language: detectedLanguage,
          created_at: new Date(snippet.publishedAt),
          engagement: 0, // We'd need additional API calls to get view counts
          metadata: {
            title: snippet.title,
            description: snippet.description,
            channel_title: snippet.channelTitle,
            thumbnail: snippet.thumbnails?.default?.url,
            video_url: `https://www.youtube.com/watch?v=${video.id.videoId}`
          }
        };

        contentItems.push(contentItem);

        if (contentItems.length >= maxContent) break;
      }

      return contentItems;
    } catch (error) {
      logger.error('Failed to get YouTube content', {
        error: error.message,
        code: error.code
      });

      if (error.code === 403) {
        logger.warn('YouTube API quota exceeded or access denied');
        return [];
      }

      throw error;
    }
  }

  /**
   * Get channel ID from handle
   * @private
   */
  async getChannelIdFromHandle(handle) {
    try {
      const response = await this.youtube.search.list({
        part: 'snippet',
        q: handle,
        type: 'channel',
        maxResults: 1
      });

      if (response.data.items && response.data.items.length > 0) {
        return response.data.items[0].snippet.channelId;
      }

      throw new Error(`Channel not found for handle: ${handle}`);
    } catch (error) {
      logger.error('Failed to get channel ID from handle', {
        handle,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Clean video text (title + description)
   * @private
   */
  cleanVideoText(text) {
    if (!text) return '';

    // Remove URLs
    let cleanText = text.replace(/https?:\/\/[^\s]+/g, '');

    // Remove excessive hashtags (keep first few)
    const hashtagPattern = /#\w+/g;
    const hashtags = cleanText.match(hashtagPattern) || [];
    if (hashtags.length > 5) {
      const keepHashtags = hashtags.slice(0, 5);
      cleanText = cleanText.replace(hashtagPattern, '');
      cleanText += '\n' + keepHashtags.join(' ');
    }

    // Remove excessive mentions
    cleanText = cleanText.replace(/@\w+/g, '');

    // Remove common YouTube boilerplate
    const boilerplatePatterns = [
      /suscríbete.*canal/gi,
      /subscribe.*channel/gi,
      /dale.*like/gi,
      /hit.*bell/gi,
      /notification.*bell/gi,
      /follow.*social/gi
    ];

    boilerplatePatterns.forEach((pattern) => {
      cleanText = cleanText.replace(pattern, '');
    });

    // Clean up whitespace
    cleanText = cleanText
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();

    return cleanText;
  }

  /**
   * Simple language detection
   * @private
   */
  detectLanguage(text) {
    if (!text) return 'unknown';

    const spanishWords = [
      'el',
      'la',
      'de',
      'que',
      'y',
      'en',
      'un',
      'es',
      'se',
      'no',
      'te',
      'lo',
      'hola',
      'como',
      'para',
      'con',
      'por',
      'este',
      'esta'
    ];
    const englishWords = [
      'the',
      'be',
      'to',
      'of',
      'and',
      'a',
      'in',
      'that',
      'have',
      'i',
      'it',
      'for',
      'not',
      'on',
      'with',
      'he',
      'as',
      'you',
      'do',
      'at'
    ];

    const words = text.toLowerCase().split(/\s+/);
    const spanishCount = words.filter((word) => spanishWords.includes(word)).length;
    const englishCount = words.filter((word) => englishWords.includes(word)).length;

    if (spanishCount > englishCount) return 'es';
    if (englishCount > spanishCount) return 'en';
    return 'unknown';
  }

  /**
   * Respect YouTube API rate limits
   * @private
   */
  async respectRateLimit(endpoint) {
    const limits = this.rateLimits[endpoint];
    if (!limits) return;

    const now = Date.now();
    const lastRequest = this.lastRequestTimes.get(endpoint) || 0;
    const timeSinceLastRequest = now - lastRequest;

    const minInterval = limits.window / limits.requests;
    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      logger.debug('Waiting for YouTube rate limit', {
        endpoint,
        waitTimeMs: waitTime
      });
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTimes.set(endpoint, Date.now());
  }

  /**
   * Validate YouTube configuration
   */
  validateConfig(config) {
    if (!config.channel_id && !config.channel_handle) {
      throw new Error('Missing YouTube channel ID or handle');
    }

    if (!process.env.YOUTUBE_API_KEY) {
      throw new Error('YouTube API key not configured');
    }

    return true;
  }

  /**
   * Test YouTube connection
   */
  async testConnection(config) {
    try {
      this.validateConfig(config);

      let channelId = config.channel_id;
      if (!channelId && config.channel_handle) {
        channelId = await this.getChannelIdFromHandle(config.channel_handle);
      }

      const response = await this.youtube.channels.list({
        part: 'snippet,statistics',
        id: channelId
      });

      if (response.data.items && response.data.items.length > 0) {
        const channel = response.data.items[0];
        return {
          success: true,
          channel: {
            id: channel.id,
            title: channel.snippet.title,
            subscriberCount: channel.statistics.subscriberCount,
            videoCount: channel.statistics.videoCount
          }
        };
      }

      return {
        success: false,
        error: 'Channel not found'
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
      name: 'YouTube',
      maxContentPerRequest: 50,
      rateLimitWindow: 1440, // minutes (24 hours)
      rateLimitRequests: 100,
      supportedContentTypes: ['video'],
      requiresAuth: false,
      authType: 'api_key'
    };
  }
}

module.exports = new YouTubeCollector();
