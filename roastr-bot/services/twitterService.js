/**
 * Twitter Service for Roastr.ai Twitter Bot
 * Handles Twitter API connections, mention fetching, and tweet responses
 */

const { TwitterApi } = require('twitter-api-v2');
const logger = require('../utils/logger');
const filters = require('../utils/filters');

class TwitterService {
  constructor(config = {}) {
    // Twitter API credentials
    this.credentials = {
      appKey: config.appKey || process.env.TWITTER_APP_KEY,
      appSecret: config.appSecret || process.env.TWITTER_APP_SECRET,
      accessToken: config.accessToken || process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: config.accessSecret || process.env.TWITTER_ACCESS_SECRET,
      bearerToken: config.bearerToken || process.env.TWITTER_BEARER_TOKEN
    };

    // Validate credentials
    this._validateCredentials();

    // Initialize Twitter clients
    this._initializeClients();

    // Configuration
    this.isDryRun = process.env.DRY_RUN === 'true';
    this.botUserId = null;
    this.botUsername = null;
    this.lastMentionId = null; // For pagination

    logger.debug('🐦 TwitterService inicializado', {
      isDryRun: this.isDryRun,
      hasCredentials: this._hasValidCredentials()
    });
  }

  /**
   * Validate Twitter API credentials
   * @private
   */
  _validateCredentials() {
    const required = ['appKey', 'appSecret', 'accessToken', 'accessSecret'];
    const missing = required.filter(key => !this.credentials[key]);

    if (missing.length > 0) {
      const errorMsg = `Missing Twitter credentials: ${missing.join(', ')}`;
      logger.error('❌ ' + errorMsg);
      throw new Error(errorMsg);
    }

    if (!this.credentials.bearerToken) {
      logger.warn('⚠️ TWITTER_BEARER_TOKEN not provided, some features may be limited');
    }
  }

  /**
   * Check if valid credentials are available
   * @returns {boolean} True if credentials are valid
   * @private
   */
  _hasValidCredentials() {
    return !!(this.credentials.appKey && this.credentials.appSecret && 
              this.credentials.accessToken && this.credentials.accessSecret);
  }

  /**
   * Initialize Twitter API clients
   * @private
   */
  _initializeClients() {
    try {
      // OAuth 1.0a client for posting tweets and user context operations
      this.client = new TwitterApi({
        appKey: this.credentials.appKey,
        appSecret: this.credentials.appSecret,
        accessToken: this.credentials.accessToken,
        accessSecret: this.credentials.accessSecret,
      });

      // Bearer token client for reading public data (if available)
      if (this.credentials.bearerToken) {
        this.bearerClient = new TwitterApi(this.credentials.bearerToken);
      }

      logger.debug('✅ Twitter clients initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Twitter clients:', error.message);
      throw error;
    }
  }

  /**
   * Initialize bot user information
   * This must be called before processing mentions
   */
  async initialize() {
    try {
      logger.info('🚀 Initializing Twitter bot...');

      // Get bot user information
      const me = await this.client.v2.me();
      this.botUserId = me.data.id;
      this.botUsername = me.data.username;

      // Configure filters with bot user ID
      filters.setBotUserId(this.botUserId);

      logger.info(`👤 Bot authenticated as @${this.botUsername} (ID: ${this.botUserId})`);
      logger.debug('✅ Bot initialization completed');

      return {
        id: this.botUserId,
        username: this.botUsername
      };
    } catch (error) {
      logger.error('❌ Failed to initialize bot:', error.message);
      throw error;
    }
  }

  /**
   * Get recent mentions of the bot account
   * @param {object} options - Fetching options
   * @returns {Promise<Array>} Array of mention objects
   */
  async getMentions(options = {}) {
    try {
      if (!this.botUserId) {
        throw new Error('Bot not initialized. Call initialize() first.');
      }

      logger.debug('📡 Fetching mentions...');

      // Build query parameters
      const queryParams = {
        max_results: Math.min(options.maxResults || 10, 100), // Twitter API limit
        'tweet.fields': ['created_at', 'author_id', 'conversation_id', 'lang', 'public_metrics'],
        'user.fields': ['username', 'name', 'verified'],
        expansions: ['author_id']
      };

      // Use pagination if we have a last mention ID
      if (options.sinceId || this.lastMentionId) {
        queryParams.since_id = options.sinceId || this.lastMentionId;
      }

      // Fetch mentions
      const mentions = await this.client.v2.userMentionTimeline(this.botUserId, queryParams);

      const mentionCount = mentions.data?.length || 0;
      logger.debug(`📬 Retrieved ${mentionCount} mentions`);

      // Update last mention ID for pagination
      if (mentions.data && mentions.data.length > 0) {
        this.lastMentionId = mentions.data[0].id;
      }

      return mentions.data || [];
    } catch (error) {
      logger.error('❌ Failed to fetch mentions:', error.message);
      
      // Handle rate limiting
      if (error.rateLimit) {
        const resetTime = new Date(error.rateLimit.reset * 1000);
        logger.warn(`⏰ Rate limit reached. Resets at ${resetTime.toISOString()}`);
      }
      
      throw error;
    }
  }

  /**
   * Filter mentions that should be processed
   * @param {Array} mentions - Raw mentions from Twitter API
   * @returns {Array} Filtered mentions ready for processing
   */
  filterMentions(mentions) {
    if (!Array.isArray(mentions)) {
      logger.warn('⚠️ Invalid mentions array provided to filter');
      return [];
    }

    const filteredMentions = mentions.filter(mention => {
      const shouldProcess = filters.shouldProcessMention(mention);
      
      if (shouldProcess) {
        logger.logMentionReceived(mention);
      }
      
      return shouldProcess;
    });

    logger.debug(`🔍 Filtered ${mentions.length} mentions → ${filteredMentions.length} to process`);
    return filteredMentions;
  }

  /**
   * Reply to a Twitter mention with a roast
   * @param {string} mentionId - ID of the original mention
   * @param {string} roastText - The roast text to reply with
   * @returns {Promise<object>} Tweet response object
   */
  async replyToMention(mentionId, roastText) {
    try {
      if (!mentionId || !roastText) {
        throw new Error('Both mentionId and roastText are required');
      }

      logger.debug(`💬 Preparing reply to ${mentionId}:`, roastText);

      // Check for dry run mode
      if (this.isDryRun) {
        logger.info('🧪 DRY RUN MODE: Would reply to', mentionId, 'with:', roastText);
        return {
          id: 'dry-run-' + Date.now(),
          text: roastText,
          dry_run: true
        };
      }

      // Ensure roast text fits Twitter's character limit
      const maxLength = 280;
      let tweetText = roastText;
      
      if (tweetText.length > maxLength) {
        // Truncate and add ellipsis, leaving space for ellipsis
        tweetText = tweetText.substring(0, maxLength - 3) + '...';
        logger.warn(`⚠️ Roast truncated to fit Twitter limit: ${tweetText.length} chars`);
      }

      // Post the reply
      const reply = await this.client.v2.reply(tweetText, mentionId);
      
      logger.info(`✅ Successfully replied to ${mentionId}`);
      logger.logTweetResponse(mentionId, reply.data.id);

      return reply.data;
    } catch (error) {
      logger.error(`❌ Failed to reply to ${mentionId}:`, error.message);
      
      // Handle specific Twitter API errors
      if (error.code === 403) {
        logger.error('🔒 Reply forbidden - check account permissions or tweet availability');
      } else if (error.code === 429) {
        logger.error('⏰ Rate limit exceeded - slow down posting');
      }
      
      throw error;
    }
  }

  /**
   * Process a single mention: extract text, mark as processed
   * @param {object} mention - Twitter mention object
   * @returns {object} Processed mention data
   */
  processMention(mention) {
    try {
      // Extract clean text for roasting
      const cleanText = filters.extractCleanText(mention.text);
      
      // Mark as processed immediately to avoid duplicates
      filters.markAsProcessed(mention.id);

      const processedData = {
        id: mention.id,
        authorId: mention.author_id,
        originalText: mention.text,
        cleanText: cleanText,
        createdAt: mention.created_at,
        language: mention.lang
      };

      logger.debug('✅ Mention processed:', {
        id: processedData.id,
        cleanText: processedData.cleanText.substring(0, 50) + '...'
      });

      return processedData;
    } catch (error) {
      logger.error(`❌ Failed to process mention ${mention.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Get bot statistics
   * @returns {object} Bot statistics
   */
  getStats() {
    return {
      botUserId: this.botUserId,
      botUsername: this.botUsername,
      processedMentions: filters.getProcessedCount(),
      lastMentionId: this.lastMentionId,
      isDryRun: this.isDryRun
    };
  }

  /**
   * Test Twitter API connectivity
   * @returns {Promise<boolean>} True if connection is successful
   */
  async testConnection() {
    try {
      logger.debug('🔍 Testing Twitter API connection...');
      const me = await this.client.v2.me();
      logger.info('✅ Twitter API connection successful');
      return true;
    } catch (error) {
      logger.error('❌ Twitter API connection failed:', error.message);
      return false;
    }
  }

  // TODO: Future enhancements for multi-account support

  /**
   * Future: Initialize service for a specific client account
   * This would be used when supporting multiple client accounts
   * @param {object} accountCredentials - Client-specific Twitter credentials
   * @param {object} accountConfig - Client-specific configuration
   */
  async initializeForAccount(accountCredentials, accountConfig) {
    // TODO: Implement multi-account initialization
    // This would:
    // 1. Validate account-specific credentials
    // 2. Create dedicated Twitter clients for this account
    // 3. Set account-specific filters and rules
    // 4. Initialize account-specific rate limiting
    // 5. Set up account-specific logging/monitoring
    
    logger.debug('🏢 Multi-account support not yet implemented');
    throw new Error('Multi-account support not yet implemented');
  }

  /**
   * Future: Get mentions for a specific client account
   * @param {string} accountId - Client account identifier
   * @param {object} options - Fetching options
   */
  async getMentionsForAccount(accountId, options = {}) {
    // TODO: Implement account-specific mention fetching
    // This would maintain separate pagination and processing state per account
    
    logger.debug('🏢 Account-specific mention fetching not yet implemented');
    throw new Error('Account-specific functionality not yet implemented');
  }

  /**
   * Future: Reply using specific account credentials
   * @param {string} accountId - Client account identifier
   * @param {string} mentionId - Mention to reply to
   * @param {string} roastText - Roast text
   */
  async replyAsAccount(accountId, mentionId, roastText) {
    // TODO: Implement account-specific replies
    // This would use the appropriate client instance for the account
    
    logger.debug('🏢 Account-specific replies not yet implemented');
    throw new Error('Account-specific functionality not yet implemented');
  }
}

module.exports = TwitterService;