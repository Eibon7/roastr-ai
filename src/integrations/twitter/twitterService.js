const TwitterRoastBot = require('../../services/twitter');
const { logger } = require('./../../utils/logger'); // Issue #971: Added for console.log replacement

/**
 * Twitter Service Adapter
 *
 * Bridges legacy TwitterRoastBot (src/services/twitter.js) with the new
 * integration path convention (src/integrations/{platform}/{platform}Service.js).
 *
 * This adapter allows PublisherWorker to load Twitter service using the same
 * path pattern as other 8 platforms, while maintaining backward compatibility
 * with existing codebase that uses the legacy bot.
 *
 * Architecture Decision:
 * - Legacy bot (src/services/twitter.js): 600+ lines, used in bot, collectors, OAuth
 * - Moving it would break 5+ dependent files
 * - Adapter pattern provides path consistency with zero breaking changes
 *
 * Future Migration:
 * Once all dependent code migrates to integration pattern, legacy bot can be
 * deprecated and this adapter can become the primary implementation.
 *
 * Related:
 * - Issue #410 (PublisherWorker Integration)
 * - CodeRabbit Review #3302108179 (Missing Twitter service path)
 *
 * @class TwitterService
 * @see {TwitterRoastBot} Legacy bot implementation
 */
class TwitterService {
  constructor() {
    try {
      // Instantiate legacy TwitterRoastBot
      // Note: TwitterRoastBot handles its own config loading from env vars
      this.bot = new TwitterRoastBot();

      // Expose required properties for PublisherWorker compatibility
      this.supportDirectPosting = true;
      this.supportModeration = false; // Twitter moderation handled separately

      // Platform metadata
      this.platform = 'twitter';
      this.displayName = 'Twitter';
    } catch (error) {
      logger.error('[TwitterService Adapter] Failed to initialize legacy bot:', error.message);
      throw new Error(`Twitter service adapter initialization failed: ${error.message}`);
    }
  }

  /**
   * Post response to Twitter as a reply to a tweet
   *
   * This method adapts PublisherWorker's call signature to the legacy bot's
   * postResponse method.
   *
   * @param {string} tweetId - ID of the original tweet to reply to
   * @param {string} responseText - Text content of the reply
   * @param {string} [userId] - User ID (optional, not used by legacy bot)
   * @returns {Promise<{success: boolean, responseId?: string, id?: string, error?: string}>}
   *
   * @example
   * const service = new TwitterService();
   * const result = await service.postResponse('1234567890', 'Great roast!');
   * // { success: true, responseId: '9876543210', id: '9876543210' }
   */
  async postResponse(tweetId, responseText, userId) {
    try {
      // Validate inputs
      if (!tweetId || typeof tweetId !== 'string') {
        throw new Error('tweetId is required and must be a string');
      }

      if (!responseText || typeof responseText !== 'string') {
        throw new Error('responseText is required and must be a string');
      }

      // Delegate to legacy bot's postResponse
      // Legacy signature: postResponse(parentId, response)
      const result = await this.bot.postResponse(tweetId, responseText);

      // Normalize response to PublisherWorker expected format
      // Legacy bot may return: { success, data: { id }, error }
      if (result.success) {
        const responseTweetId = result.data?.id || result.id;

        return {
          success: true,
          responseId: responseTweetId,
          id: responseTweetId
        };
      } else {
        return {
          success: false,
          error: result.error || 'Unknown error from legacy Twitter bot'
        };
      }
    } catch (error) {
      logger.error('[TwitterService Adapter] postResponse failed:', error.message);

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get platform capabilities
   *
   * @returns {Object} Platform capabilities object
   */
  getCapabilities() {
    return {
      directPosting: this.supportDirectPosting,
      moderation: this.supportModeration,
      characterLimit: 280,
      supportsMedia: true,
      supportsThreads: true,
      rateLimits: {
        postsPerHour: 300, // Twitter API rate limits
        postsPerDay: 2400
      }
    };
  }

  /**
   * Check if service is properly configured and ready
   *
   * @returns {boolean} True if service is ready
   */
  isReady() {
    return !!this.bot && this.bot.client !== undefined;
  }
}

module.exports = TwitterService;
