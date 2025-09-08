/**
 * Twitch Content Collector for Stylecard Generation
 * Collects recent stream titles, descriptions, and chat messages for style analysis
 */

const axios = require('axios');
const logger = require('../../utils/logger');

class TwitchCollector {
  constructor() {
    this.baseURL = 'https://api.twitch.tv/helix';
    this.rateLimits = {
      streams: { requests: 800, window: 60 * 1000 }, // 800 requests per minute
      videos: { requests: 800, window: 60 * 1000 },
      users: { requests: 800, window: 60 * 1000 }
    };
    
    this.lastRequestTimes = new Map();
  }

  /**
   * Collect recent content from Twitch
   * @param {Object} config - Integration configuration with Twitch credentials
   * @param {number} maxContent - Maximum number of content items to collect
   * @param {string} languageFilter - Language filter (optional)
   * @returns {Array} Array of content objects
   */
  async collectRecentContent(config, maxContent = 50, languageFilter = null) {
    try {
      logger.info('Starting Twitch content collection', {
        maxContent,
        languageFilter,
        hasAccessToken: !!config.access_token
      });

      // Get access token if needed
      const accessToken = await this.ensureAccessToken(config);

      // Get user's Twitch content
      const userContent = await this.getUserContent(config, accessToken, maxContent, languageFilter);
      
      logger.info('Twitch content collection completed', {
        contentCollected: userContent.length,
        maxRequested: maxContent
      });

      return userContent;

    } catch (error) {
      logger.error('Failed to collect Twitch content', {
        error: error.message,
        stack: error.stack,
        maxContent,
        languageFilter
      });

      return [];
    }
  }

  /**
   * Ensure we have a valid access token
   * @private
   */
  async ensureAccessToken(config) {
    if (config.access_token) {
      return config.access_token;
    }

    // Get app access token using client credentials
    if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
      throw new Error('Twitch client credentials not configured');
    }

    try {
      const response = await axios.post('https://id.twitch.tv/oauth2/token', {
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
      });

      return response.data.access_token;

    } catch (error) {
      logger.error('Failed to get Twitch access token', { error: error.message });
      throw error;
    }
  }

  /**
   * Get user's Twitch content
   * @private
   */
  async getUserContent(config, accessToken, maxContent, languageFilter) {
    try {
      // Get user info first
      const userId = await this.getUserId(config.username, accessToken);
      
      const contentItems = [];

      // Get recent videos (VODs)
      const videos = await this.getUserVideos(userId, accessToken, maxContent);
      contentItems.push(...videos);

      // Get recent clips if we need more content
      if (contentItems.length < maxContent) {
        const clips = await this.getUserClips(userId, accessToken, maxContent - contentItems.length);
        contentItems.push(...clips);
      }

      // Filter by language if specified
      const filteredContent = languageFilter 
        ? contentItems.filter(item => item.language === languageFilter)
        : contentItems;

      return filteredContent.slice(0, maxContent);

    } catch (error) {
      logger.error('Failed to get Twitch user content', {
        username: config.username,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get user ID from username
   * @private
   */
  async getUserId(username, accessToken) {
    await this.respectRateLimit('users');

    const response = await axios.get(`${this.baseURL}/users`, {
      params: { login: username },
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID
      }
    });

    if (!response.data.data || response.data.data.length === 0) {
      throw new Error(`Twitch user not found: ${username}`);
    }

    return response.data.data[0].id;
  }

  /**
   * Get user's recent videos
   * @private
   */
  async getUserVideos(userId, accessToken, maxCount) {
    try {
      await this.respectRateLimit('videos');

      const response = await axios.get(`${this.baseURL}/videos`, {
        params: {
          user_id: userId,
          first: Math.min(maxCount, 20), // Twitch API limit
          type: 'all'
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Client-Id': process.env.TWITCH_CLIENT_ID
        }
      });

      const contentItems = [];

      for (const video of response.data.data || []) {
        // Combine title and description
        const fullText = `${video.title}\n\n${video.description || ''}`.trim();
        
        if (fullText.length < 20) continue;

        // Clean the text
        const cleanText = this.cleanStreamText(fullText);
        if (cleanText.length < 20) continue;

        // Detect language
        const detectedLanguage = this.detectLanguage(cleanText);

        const contentItem = {
          id: video.id,
          platform: 'twitch',
          type: 'video',
          text: cleanText,
          language: detectedLanguage,
          created_at: new Date(video.created_at),
          engagement: video.view_count || 0,
          metadata: {
            title: video.title,
            description: video.description,
            duration: video.duration,
            view_count: video.view_count,
            video_url: video.url,
            thumbnail_url: video.thumbnail_url,
            stream_id: video.stream_id
          }
        };

        contentItems.push(contentItem);
      }

      return contentItems;

    } catch (error) {
      logger.error('Failed to get Twitch videos', { error: error.message });
      return [];
    }
  }

  /**
   * Get user's recent clips
   * @private
   */
  async getUserClips(userId, accessToken, maxCount) {
    try {
      await this.respectRateLimit('videos');

      const response = await axios.get(`${this.baseURL}/clips`, {
        params: {
          broadcaster_id: userId,
          first: Math.min(maxCount, 20),
          started_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // Last 30 days
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Client-Id': process.env.TWITCH_CLIENT_ID
        }
      });

      const contentItems = [];

      for (const clip of response.data.data || []) {
        const title = clip.title || '';
        
        if (title.length < 10) continue;

        const cleanText = this.cleanStreamText(title);
        if (cleanText.length < 10) continue;

        const detectedLanguage = this.detectLanguage(cleanText);

        const contentItem = {
          id: clip.id,
          platform: 'twitch',
          type: 'clip',
          text: cleanText,
          language: detectedLanguage,
          created_at: new Date(clip.created_at),
          engagement: clip.view_count || 0,
          metadata: {
            title: clip.title,
            duration: clip.duration,
            view_count: clip.view_count,
            clip_url: clip.url,
            thumbnail_url: clip.thumbnail_url,
            creator_name: clip.creator_name
          }
        };

        contentItems.push(contentItem);
      }

      return contentItems;

    } catch (error) {
      logger.error('Failed to get Twitch clips', { error: error.message });
      return [];
    }
  }

  /**
   * Clean stream text (titles, descriptions)
   * @private
   */
  cleanStreamText(text) {
    if (!text) return '';

    // Remove URLs
    let cleanText = text.replace(/https?:\/\/[^\s]+/g, '');
    
    // Remove excessive hashtags
    const hashtagPattern = /#\w+/g;
    const hashtags = cleanText.match(hashtagPattern) || [];
    if (hashtags.length > 3) {
      const keepHashtags = hashtags.slice(0, 3);
      cleanText = cleanText.replace(hashtagPattern, '');
      cleanText += ' ' + keepHashtags.join(' ');
    }

    // Remove common streaming boilerplate
    const boilerplatePatterns = [
      /follow.*stream/gi,
      /subscribe.*channel/gi,
      /hit.*follow/gi,
      /drop.*follow/gi,
      /!socials/gi,
      /!discord/gi
    ];

    boilerplatePatterns.forEach(pattern => {
      cleanText = cleanText.replace(pattern, '');
    });

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

    const spanishWords = ['el', 'la', 'de', 'que', 'y', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'hola', 'como', 'para'];
    const englishWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with'];

    const words = text.toLowerCase().split(/\s+/);
    const spanishCount = words.filter(word => spanishWords.includes(word)).length;
    const englishCount = words.filter(word => englishWords.includes(word)).length;

    if (spanishCount > englishCount) return 'es';
    if (englishCount > spanishCount) return 'en';
    return 'unknown';
  }

  /**
   * Respect Twitch API rate limits
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
      logger.debug('Waiting for Twitch rate limit', {
        endpoint,
        waitTimeMs: waitTime
      });
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTimes.set(endpoint, Date.now());
  }

  /**
   * Validate Twitch configuration
   */
  validateConfig(config) {
    if (!config.username) {
      throw new Error('Missing Twitch username');
    }
    
    if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
      throw new Error('Twitch client credentials not configured');
    }

    return true;
  }

  /**
   * Test Twitch connection
   */
  async testConnection(config) {
    try {
      this.validateConfig(config);
      
      const accessToken = await this.ensureAccessToken(config);
      const userId = await this.getUserId(config.username, accessToken);

      return {
        success: true,
        user: {
          id: userId,
          username: config.username
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
      name: 'Twitch',
      maxContentPerRequest: 20,
      rateLimitWindow: 1, // minutes
      rateLimitRequests: 800,
      supportedContentTypes: ['video', 'clip'],
      requiresAuth: true,
      authType: 'oauth2'
    };
  }
}

module.exports = new TwitchCollector();
