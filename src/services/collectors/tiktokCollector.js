/**
 * TikTok Content Collector for Stylecard Generation
 * Note: TikTok API access is limited, this is a placeholder implementation
 */

const axios = require('axios');
const logger = require('../../utils/logger');

class TikTokCollector {
  constructor() {
    this.baseURL = 'https://open-api.tiktok.com';
    this.rateLimits = {
      userVideos: { requests: 1000, window: 24 * 60 * 60 * 1000 } // 1000 requests per day
    };

    this.lastRequestTimes = new Map();
  }

  /**
   * Collect recent content from TikTok
   * Note: TikTok API requires special approval and has limited access
   * @param {Object} config - Integration configuration with TikTok credentials
   * @param {number} maxContent - Maximum number of content items to collect
   * @param {string} languageFilter - Language filter (optional)
   * @returns {Array} Array of content objects
   */
  async collectRecentContent(config, maxContent = 50, languageFilter = null) {
    try {
      logger.info('Starting TikTok content collection', {
        maxContent,
        languageFilter,
        hasAccessToken: !!config.access_token
      });

      // Check if TikTok API is available
      if (!process.env.TIKTOK_CLIENT_KEY || !config.access_token) {
        logger.warn('TikTok API not properly configured, using fallback method');
        return await this.fallbackContentCollection(config, maxContent);
      }

      // Get user's TikTok content
      const userContent = await this.getUserVideos(config, maxContent, languageFilter);

      logger.info('TikTok content collection completed', {
        contentCollected: userContent.length,
        maxRequested: maxContent
      });

      return userContent;
    } catch (error) {
      logger.error('Failed to collect TikTok content', {
        error: error.message,
        stack: error.stack,
        maxContent,
        languageFilter
      });

      // Try fallback method
      return await this.fallbackContentCollection(config, maxContent);
    }
  }

  /**
   * Get user's TikTok videos via API
   * @private
   */
  async getUserVideos(config, maxContent, languageFilter) {
    try {
      // Respect rate limits
      await this.respectRateLimit('userVideos');

      // TikTok API call to get user videos
      const response = await axios.post(
        `${this.baseURL}/v2/video/list/`,
        {
          max_count: Math.min(maxContent, 20), // TikTok API limit
          cursor: 0
        },
        {
          headers: {
            Authorization: `Bearer ${config.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const contentItems = [];

      for (const video of response.data.data?.videos || []) {
        // Extract caption/description
        const caption = video.title || video.video_description || '';

        if (!caption || caption.trim().length < 10) continue;

        // Basic language detection
        const detectedLanguage = this.detectLanguage(caption);
        if (languageFilter && detectedLanguage !== languageFilter) continue;

        // Clean caption
        const cleanCaption = this.cleanCaption(caption);
        if (cleanCaption.length < 10) continue;

        const contentItem = {
          id: video.video_id,
          platform: 'tiktok',
          type: 'video',
          text: cleanCaption,
          language: detectedLanguage,
          created_at: new Date(video.create_time * 1000),
          engagement: this.calculateEngagement(video),
          metadata: {
            duration: video.duration,
            view_count: video.view_count || 0,
            like_count: video.like_count || 0,
            comment_count: video.comment_count || 0,
            share_count: video.share_count || 0,
            video_url: video.share_url
          }
        };

        contentItems.push(contentItem);

        if (contentItems.length >= maxContent) break;
      }

      return contentItems;
    } catch (error) {
      logger.error('Failed to get TikTok videos via API', {
        error: error.message,
        response: error.response?.data
      });

      if (error.response?.status === 429) {
        logger.warn('TikTok rate limit exceeded');
        return [];
      }

      throw error;
    }
  }

  /**
   * Fallback content collection method
   * This would be used when API access is not available
   * @private
   */
  async fallbackContentCollection(config, maxContent) {
    logger.info('Using TikTok fallback content collection method');

    // In a real implementation, this might:
    // 1. Ask user to manually provide recent video captions
    // 2. Use web scraping (with proper rate limiting and respect for ToS)
    // 3. Integrate with third-party TikTok analytics tools

    // For now, return empty array and log that manual input is needed
    logger.warn('TikTok content collection requires manual input or API access', {
      username: config.username,
      suggestion: 'Consider asking user to manually provide recent video captions'
    });

    return [];
  }

  /**
   * Clean TikTok caption text
   * @private
   */
  cleanCaption(caption) {
    if (!caption) return '';

    // Remove excessive hashtags (keep first few)
    const hashtagPattern = /#\w+/g;
    const hashtags = caption.match(hashtagPattern) || [];
    let cleanText = caption;

    if (hashtags.length > 5) {
      const keepHashtags = hashtags.slice(0, 5);
      cleanText = caption.replace(hashtagPattern, '');
      cleanText += ' ' + keepHashtags.join(' ');
    }

    // Remove excessive mentions
    const mentionPattern = /@\w+/g;
    const mentions = cleanText.match(mentionPattern) || [];
    if (mentions.length > 3) {
      const keepMentions = mentions.slice(0, 3);
      cleanText = cleanText.replace(mentionPattern, '');
      cleanText += ' ' + keepMentions.join(' ');
    }

    // Remove URLs
    cleanText = cleanText.replace(/https?:\/\/[^\s]+/g, '');

    // Clean up whitespace
    cleanText = cleanText.replace(/\s+/g, ' ').trim();

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
      'para',
      'con',
      'por'
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
      'with'
    ];

    const words = text.toLowerCase().split(/\s+/);
    const spanishCount = words.filter((word) => spanishWords.includes(word)).length;
    const englishCount = words.filter((word) => englishWords.includes(word)).length;

    if (spanishCount > englishCount) return 'es';
    if (englishCount > spanishCount) return 'en';
    return 'unknown';
  }

  /**
   * Calculate engagement score for TikTok video
   * @private
   */
  calculateEngagement(video) {
    const likes = video.like_count || 0;
    const comments = video.comment_count || 0;
    const shares = video.share_count || 0;
    const views = video.view_count || 0;

    // TikTok engagement formula (weighted)
    const engagementRate = views > 0 ? ((likes + comments * 2 + shares * 3) / views) * 100 : 0;
    return Math.round(engagementRate * 100); // Scale up for comparison
  }

  /**
   * Respect TikTok API rate limits
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
      logger.debug('Waiting for TikTok rate limit', {
        endpoint,
        waitTimeMs: waitTime
      });
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTimes.set(endpoint, Date.now());
  }

  /**
   * Validate TikTok configuration
   */
  validateConfig(config) {
    // TikTok API requires special approval, so we're more lenient here
    if (!config.username && !config.access_token) {
      throw new Error('Missing TikTok username or access token');
    }
    return true;
  }

  /**
   * Test TikTok connection
   */
  async testConnection(config) {
    try {
      this.validateConfig(config);

      if (!config.access_token) {
        return {
          success: false,
          error: 'TikTok API access token required',
          suggestion: 'TikTok API requires special approval. Consider manual content input.'
        };
      }

      // Simple test - try to get user info
      const response = await axios.get(`${this.baseURL}/v2/user/info/`, {
        headers: {
          Authorization: `Bearer ${config.access_token}`
        }
      });

      return {
        success: true,
        user: response.data.data?.user || { username: config.username }
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        suggestion: 'Consider using manual content input for TikTok'
      };
    }
  }

  /**
   * Get platform-specific metadata
   */
  getPlatformInfo() {
    return {
      name: 'TikTok',
      maxContentPerRequest: 20,
      rateLimitWindow: 1440, // minutes (24 hours)
      rateLimitRequests: 1000,
      supportedContentTypes: ['video'],
      requiresAuth: true,
      authType: 'oauth2',
      specialRequirements: 'API access requires TikTok approval',
      fallbackAvailable: true
    };
  }
}

module.exports = new TikTokCollector();
