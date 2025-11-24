/**
 * Instagram Content Collector for Stylecard Generation
 * Collects recent posts and captions for style analysis
 */

const axios = require('axios');
const logger = require('../../utils/logger');

class InstagramCollector {
  constructor() {
    this.baseURL = 'https://graph.instagram.com';
    this.rateLimits = {
      userMedia: { requests: 200, window: 60 * 60 * 1000 } // 200 requests per hour
    };

    this.lastRequestTimes = new Map();
  }

  /**
   * Collect recent content from Instagram
   * @param {Object} config - Integration configuration with Instagram credentials
   * @param {number} maxContent - Maximum number of content items to collect
   * @param {string} languageFilter - Language filter (optional)
   * @returns {Array} Array of content objects
   */
  async collectRecentContent(config, maxContent = 50, languageFilter = null) {
    try {
      logger.info('Starting Instagram content collection', {
        maxContent,
        languageFilter,
        hasAccessToken: !!config.access_token
      });

      // Get user's recent media
      const userContent = await this.getUserMedia(config, maxContent, languageFilter);

      logger.info('Instagram content collection completed', {
        contentCollected: userContent.length,
        maxRequested: maxContent
      });

      return userContent;
    } catch (error) {
      logger.error('Failed to collect Instagram content', {
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
   * Get user's media posts
   * @private
   */
  async getUserMedia(config, maxContent, languageFilter) {
    try {
      if (!config.access_token) {
        throw new Error('Instagram access token not configured');
      }

      // Respect rate limits
      await this.respectRateLimit('userMedia');

      // Get user's media
      const response = await axios.get(`${this.baseURL}/me/media`, {
        params: {
          fields: 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count',
          access_token: config.access_token,
          limit: Math.min(maxContent, 25) // Instagram API limit per request
        }
      });

      const contentItems = [];

      for (const media of response.data.data || []) {
        // Skip if no caption
        if (!media.caption || media.caption.trim().length < 10) {
          continue;
        }

        // Skip video content if we only want text
        if (media.media_type === 'VIDEO' && !media.caption) {
          continue;
        }

        // Basic language detection (simplified)
        const detectedLanguage = this.detectLanguage(media.caption);
        if (languageFilter && detectedLanguage !== languageFilter) {
          continue;
        }

        // Clean caption text (remove excessive hashtags and mentions)
        const cleanCaption = this.cleanCaption(media.caption);
        if (cleanCaption.length < 10) {
          continue;
        }

        const contentItem = {
          id: media.id,
          platform: 'instagram',
          type: 'post',
          text: cleanCaption,
          language: detectedLanguage,
          created_at: new Date(media.timestamp),
          engagement: this.calculateEngagement(media),
          metadata: {
            media_type: media.media_type,
            media_url: media.media_url,
            permalink: media.permalink,
            like_count: media.like_count || 0,
            comments_count: media.comments_count || 0,
            original_caption: media.caption
          }
        };

        contentItems.push(contentItem);

        // Stop if we've collected enough content
        if (contentItems.length >= maxContent) {
          break;
        }
      }

      // If we need more content and there's a next page, fetch it
      if (contentItems.length < maxContent && response.data.paging?.next) {
        const nextPageContent = await this.getNextPage(
          response.data.paging.next,
          maxContent - contentItems.length,
          languageFilter
        );
        contentItems.push(...nextPageContent);
      }

      return contentItems;
    } catch (error) {
      logger.error('Failed to get Instagram media', {
        error: error.message,
        response: error.response?.data
      });

      // Handle rate limiting
      if (error.response?.status === 429) {
        logger.warn('Instagram rate limit exceeded, returning partial results');
        return [];
      }

      throw error;
    }
  }

  /**
   * Get next page of results
   * @private
   */
  async getNextPage(nextUrl, remainingCount, languageFilter) {
    try {
      await this.respectRateLimit('userMedia');

      const response = await axios.get(nextUrl);
      const contentItems = [];

      for (const media of response.data.data || []) {
        if (contentItems.length >= remainingCount) break;

        if (!media.caption || media.caption.trim().length < 10) continue;

        const detectedLanguage = this.detectLanguage(media.caption);
        if (languageFilter && detectedLanguage !== languageFilter) continue;

        const cleanCaption = this.cleanCaption(media.caption);
        if (cleanCaption.length < 10) continue;

        const contentItem = {
          id: media.id,
          platform: 'instagram',
          type: 'post',
          text: cleanCaption,
          language: detectedLanguage,
          created_at: new Date(media.timestamp),
          engagement: this.calculateEngagement(media),
          metadata: {
            media_type: media.media_type,
            like_count: media.like_count || 0,
            comments_count: media.comments_count || 0
          }
        };

        contentItems.push(contentItem);
      }

      return contentItems;
    } catch (error) {
      logger.warn('Failed to get Instagram next page', { error: error.message });
      return [];
    }
  }

  /**
   * Clean Instagram caption text
   * @private
   */
  cleanCaption(caption) {
    if (!caption) return '';

    // Remove excessive hashtags (keep first few)
    const hashtagPattern = /#\w+/g;
    const hashtags = caption.match(hashtagPattern) || [];
    let cleanText = caption;

    if (hashtags.length > 3) {
      // Keep only first 3 hashtags
      const keepHashtags = hashtags.slice(0, 3);
      cleanText = caption.replace(hashtagPattern, '');
      cleanText += ' ' + keepHashtags.join(' ');
    }

    // Remove excessive mentions (keep first few)
    const mentionPattern = /@\w+/g;
    const mentions = cleanText.match(mentionPattern) || [];
    if (mentions.length > 2) {
      const keepMentions = mentions.slice(0, 2);
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

    // Simple Spanish detection
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
      'le',
      'da',
      'su',
      'por',
      'son',
      'con',
      'para',
      'al',
      'del',
      'los',
      'las'
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
   * Calculate engagement score for Instagram post
   * @private
   */
  calculateEngagement(media) {
    const likes = media.like_count || 0;
    const comments = media.comments_count || 0;

    // Weighted engagement score (comments are more valuable)
    return likes + comments * 5;
  }

  /**
   * Respect Instagram API rate limits
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
      logger.debug('Waiting for Instagram rate limit', {
        endpoint,
        waitTimeMs: waitTime
      });
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTimes.set(endpoint, Date.now());
  }

  /**
   * Validate Instagram configuration
   */
  validateConfig(config) {
    if (!config.access_token) {
      throw new Error('Missing Instagram access token');
    }
    return true;
  }

  /**
   * Test Instagram connection
   */
  async testConnection(config) {
    try {
      this.validateConfig(config);

      const response = await axios.get(`${this.baseURL}/me`, {
        params: {
          fields: 'id,username',
          access_token: config.access_token
        }
      });

      return {
        success: true,
        user: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  /**
   * Get platform-specific metadata
   */
  getPlatformInfo() {
    return {
      name: 'Instagram',
      maxContentPerRequest: 25,
      rateLimitWindow: 60, // minutes
      rateLimitRequests: 200,
      supportedContentTypes: ['post'],
      requiresAuth: true,
      authType: 'oauth2'
    };
  }
}

module.exports = new InstagramCollector();
