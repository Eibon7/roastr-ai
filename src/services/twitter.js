#!/usr/bin/env node

const { TwitterApi, ETwitterStreamEvent } = require('twitter-api-v2');
const { logger } = require('./../utils/logger'); // Issue #971: Added for console.log replacement
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

// Import BaseIntegration for unified integration management
const BaseIntegration = require('../integrations/base/BaseIntegration');

class TwitterRoastBot extends BaseIntegration {
  constructor(config) {
    // Get Twitter config from integrations or use defaults
    let twitterConfig;

    try {
      twitterConfig = config || require('../config/integrations').twitter;
    } catch (error) {
      // Fallback config if integrations config is not available
      twitterConfig = {
        enabled: true,
        tone: 'balanceado', // Issue #868: Default to balanceado
        // humorType removed (Issue #868)
        responseFrequency: 1.0,
        triggerWords: ['roast', 'burn', 'insult']
      };
    }

    // Call parent constructor
    super(twitterConfig);

    // Check if we're in test mode
    const isTestMode = process.env.NODE_ENV === 'test' || process.env.ENABLE_MOCK_MODE === 'true';

    // Validate config first (skip in test mode)
    if (!isTestMode) {
      if (!this.validateConfig()) {
        throw new Error('Invalid Twitter configuration');
      }
    }

    // Initialize Twitter client with OAuth 1.0a (for posting tweets)
    // Skip initialization in test mode if credentials are missing
    if (!isTestMode || (process.env.TWITTER_APP_KEY && process.env.TWITTER_APP_SECRET)) {
      this.client = new TwitterApi({
        appKey: process.env.TWITTER_APP_KEY || 'test-key',
        appSecret: process.env.TWITTER_APP_SECRET || 'test-secret',
        accessToken: process.env.TWITTER_ACCESS_TOKEN || 'test-token',
        accessSecret: process.env.TWITTER_ACCESS_SECRET || 'test-secret'
      });
    } else {
      // Create mock client for test mode
      this.client = {
        v2: {
          tweet: () => Promise.resolve({ data: { id: 'test-tweet-id' } })
        }
      };
    }

    // Bearer token client for reading mentions (OAuth 2.0)
    if (!isTestMode || process.env.TWITTER_BEARER_TOKEN) {
      this.bearerClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN || 'test-bearer');
    } else {
      // Create mock bearer client for test mode
      this.bearerClient = {
        v2: {
          search: () => Promise.resolve({ data: { data: [] } })
        }
      };
    }

    // Debug mode
    this.debug = process.env.DEBUG === 'true';

    // Bot user info (to avoid replying to self)
    this.botUserId = null;
    this.botUsername = null;

    // Stream reference
    this.stream = null;

    // Timeout/interval references for cleanup
    this.reconnectTimeout = null;
    this.pollingInterval = null;

    // File to store processed tweet IDs (deprecated - use processedMentionsFile)
    this.processedTweetsFile = path.join(__dirname, '../../data/processed_tweets.json');

    // File to store processed mention IDs (new approach for batch mode)
    this.processedMentionsFile = path.join(__dirname, '../../data/processed_mentions.json');

    // Batch polling configuration
    this.batchConfig = {
      intervalMinutes: parseInt(process.env.BATCH_INTERVAL_MINUTES) || 5,
      pollingActive: false,
      runMode: process.env.RUN_MODE || 'loop' // 'loop' or 'single'
    };

    // API endpoint for roast generation
    this.roastApiUrl =
      process.env.ROAST_API_URL || 'https://roastr-lhcp7seuh-eibon7s-projects.vercel.app';

    // Rate limiting configuration
    this.rateLimits = {
      tweetsPerHour: parseInt(process.env.MAX_TWEETS_PER_HOUR) || 10,
      minDelayBetweenTweets: parseInt(process.env.MIN_DELAY_BETWEEN_TWEETS) || 5000, // 5 seconds
      maxDelayBetweenTweets: parseInt(process.env.MAX_DELAY_BETWEEN_TWEETS) || 30000, // 30 seconds
      tweetsTimestamps: [] // Track when tweets were sent
    };

    // Error tracking and recovery
    this.errorStats = {
      consecutiveErrors: 0,
      lastErrorTime: null,
      maxConsecutiveErrors: 5,
      backoffMultiplier: 2,
      baseBackoffDelay: 5000 // 5 seconds
    };

    // Initialize processed tweets and mentions tracking
    this.initializeProcessedTweets();
    this.initializeProcessedMentions();
  }

  /**
   * Initialize the processed tweets file if it doesn't exist (legacy)
   */
  async initializeProcessedTweets() {
    try {
      await fs.ensureFile(this.processedTweetsFile);
      const exists = await fs.pathExists(this.processedTweetsFile);
      if (!exists || (await fs.readFile(this.processedTweetsFile, 'utf8')).trim() === '') {
        await fs.writeJson(this.processedTweetsFile, { processedTweetIds: [] }, { spaces: 2 });
      }
    } catch (error) {
      logger.error('❌ Error initializing processed tweets file:', error);
    }
  }

  /**
   * Initialize the processed mentions file for batch mode
   */
  async initializeProcessedMentions() {
    try {
      await fs.ensureFile(this.processedMentionsFile);
      const exists = await fs.pathExists(this.processedMentionsFile);
      if (!exists || (await fs.readFile(this.processedMentionsFile, 'utf8')).trim() === '') {
        await fs.writeJson(
          this.processedMentionsFile,
          {
            processedMentionIds: [],
            lastCheck: null,
            totalProcessed: 0
          },
          { spaces: 2 }
        );
        this.debugLog('✅ Initialized processed mentions file for batch mode');
      }
    } catch (error) {
      logger.error('❌ Error initializing processed mentions file:', error);
    }
  }

  /**
   * Get list of already processed tweet IDs
   */
  async getProcessedTweetIds() {
    try {
      const data = await fs.readJson(this.processedTweetsFile);
      return data.processedTweetIds || [];
    } catch (error) {
      logger.error('❌ Error reading processed tweets:', error);
      return [];
    }
  }

  /**
   * Add tweet ID to processed list (legacy)
   */
  async markTweetAsProcessed(tweetId) {
    try {
      const data = await fs.readJson(this.processedTweetsFile);
      if (!data.processedTweetIds) data.processedTweetIds = [];

      if (!data.processedTweetIds.includes(tweetId)) {
        data.processedTweetIds.push(tweetId);
        // Keep only last 1000 processed tweets to avoid file growing too large
        if (data.processedTweetIds.length > 1000) {
          data.processedTweetIds = data.processedTweetIds.slice(-1000);
        }
        await fs.writeJson(this.processedTweetsFile, data, { spaces: 2 });
      }
    } catch (error) {
      logger.error('❌ Error marking tweet as processed:', error);
    }
  }

  /**
   * Get list of already processed mention IDs
   */
  async getProcessedMentionIds() {
    try {
      const data = await fs.readJson(this.processedMentionsFile);
      return data.processedMentionIds || [];
    } catch (error) {
      logger.error('❌ Error reading processed mentions:', error);
      return [];
    }
  }

  /**
   * Add mention ID to processed list for batch mode
   */
  async markMentionAsProcessed(mentionId) {
    try {
      const data = await fs.readJson(this.processedMentionsFile);
      if (!data.processedMentionIds) data.processedMentionIds = [];

      if (!data.processedMentionIds.includes(mentionId)) {
        data.processedMentionIds.push(mentionId);
        data.totalProcessed = (data.totalProcessed || 0) + 1;
        data.lastProcessed = new Date().toISOString();

        // Keep only last 1000 processed mentions to avoid file growing too large
        if (data.processedMentionIds.length > 1000) {
          data.processedMentionIds = data.processedMentionIds.slice(-1000);
        }

        await fs.writeJson(this.processedMentionsFile, data, { spaces: 2 });
        this.debugLog(
          `📝 Marked mention ${mentionId} as processed (total: ${data.totalProcessed})`
        );
      }
    } catch (error) {
      logger.error('❌ Error marking mention as processed:', error);
    }
  }

  /**
   * Update last check timestamp for batch polling
   */
  async updateLastCheckTime() {
    try {
      const data = await fs.readJson(this.processedMentionsFile);
      data.lastCheck = new Date().toISOString();
      await fs.writeJson(this.processedMentionsFile, data, { spaces: 2 });
    } catch (error) {
      logger.error('❌ Error updating last check time:', error);
    }
  }

  /**
   * Log debug messages if debug mode is enabled
   */
  debugLog(message, ...args) {
    if (this.debug) {
      logger.info(`[TWITTER-DEBUG] ${new Date().toISOString()}: ${message}`, ...args);
    }
  }

  /**
   * Enhanced logging for important events
   */
  logEvent(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const prefix =
      level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';

    logger.info(`${prefix} [${timestamp}] ${message}`);

    if (this.debug && Object.keys(data).length > 0) {
      logger.info(`[TWITTER-DEBUG] Event data:`, JSON.stringify(data, null, 2));
    }
  }

  /**
   * Check if we can send a tweet based on rate limits
   */
  canSendTweet() {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // Clean old timestamps
    this.rateLimits.tweetsTimestamps = this.rateLimits.tweetsTimestamps.filter(
      (timestamp) => timestamp > oneHourAgo
    );

    // Check hourly limit
    if (this.rateLimits.tweetsTimestamps.length >= this.rateLimits.tweetsPerHour) {
      this.logEvent('warn', 'Rate limit reached', {
        currentCount: this.rateLimits.tweetsTimestamps.length,
        maxPerHour: this.rateLimits.tweetsPerHour,
        oldestTweetTime: new Date(this.rateLimits.tweetsTimestamps[0]).toISOString(),
        timeUntilReset:
          Math.ceil((this.rateLimits.tweetsTimestamps[0] + 60 * 60 * 1000 - now) / 1000 / 60) +
          ' minutes'
      });
      return false;
    }

    // Check minimum delay between tweets
    const lastTweetTime =
      this.rateLimits.tweetsTimestamps[this.rateLimits.tweetsTimestamps.length - 1];
    if (lastTweetTime && now - lastTweetTime < this.rateLimits.minDelayBetweenTweets) {
      this.debugLog(
        `⚠️ Too soon since last tweet: ${now - lastTweetTime}ms < ${this.rateLimits.minDelayBetweenTweets}ms`,
        {
          timeSinceLastTweet: now - lastTweetTime,
          minDelay: this.rateLimits.minDelayBetweenTweets,
          timeUntilNextAllowed:
            Math.ceil((this.rateLimits.minDelayBetweenTweets - (now - lastTweetTime)) / 1000) + 's'
        }
      );
      return false;
    }

    return true;
  }

  /**
   * Record that a tweet was sent
   */
  recordTweetSent() {
    this.rateLimits.tweetsTimestamps.push(Date.now());
    this.debugLog(
      `📝 Tweet recorded - Total in last hour: ${this.rateLimits.tweetsTimestamps.length}/${this.rateLimits.tweetsPerHour}`
    );
  }

  /**
   * Calculate dynamic delay between tweet processing attempts
   */
  getProcessingDelay() {
    const baseDelay =
      Math.random() *
        (this.rateLimits.maxDelayBetweenTweets - this.rateLimits.minDelayBetweenTweets) +
      this.rateLimits.minDelayBetweenTweets;

    // Add exponential backoff if we've had consecutive errors
    if (this.errorStats.consecutiveErrors > 0) {
      const backoffDelay =
        this.errorStats.baseBackoffDelay *
        Math.pow(this.errorStats.backoffMultiplier, this.errorStats.consecutiveErrors - 1);
      return Math.min(baseDelay + backoffDelay, 300000); // Max 5 minutes
    }

    return baseDelay;
  }

  /**
   * Reset error tracking after successful operation
   */
  resetErrorTracking() {
    if (this.errorStats.consecutiveErrors > 0) {
      this.debugLog(
        `✅ Error streak broken after ${this.errorStats.consecutiveErrors} consecutive errors`
      );
      this.errorStats.consecutiveErrors = 0;
      this.errorStats.lastErrorTime = null;
    }
  }

  /**
   * Track error and implement exponential backoff
   */
  trackError(error) {
    this.errorStats.consecutiveErrors++;
    this.errorStats.lastErrorTime = Date.now();

    this.debugLog(`❌ Error tracked - Consecutive errors: ${this.errorStats.consecutiveErrors}`);

    // If too many consecutive errors, implement longer backoff
    if (this.errorStats.consecutiveErrors >= this.errorStats.maxConsecutiveErrors) {
      const backoffTime =
        this.errorStats.baseBackoffDelay *
        Math.pow(this.errorStats.backoffMultiplier, this.errorStats.consecutiveErrors - 1);
      logger.warn(
        `⚠️ Too many consecutive errors (${this.errorStats.consecutiveErrors}). Backing off for ${backoffTime}ms`
      );
      return backoffTime;
    }

    return 0;
  }

  /**
   * Check if content is allowed to be roasted
   * STUB: Currently always returns true
   * TODO: Replace with actual Perspective API call
   */
  async isAllowedToRoast(text) {
    try {
      // STUB: Always return true for now
      this.debugLog('🔍 Checking if content is allowed to roast (STUB - always true)');
      this.debugLog('📝 Content:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));

      // TODO: Implement actual Perspective API call
      // Example skeleton for future implementation:
      /*
      const perspectiveResponse = await axios.post(
        `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${process.env.PERSPECTIVE_API_KEY}`,
        {
          requestedAttributes: {
            TOXICITY: {}
          },
          comment: {
            text: text
          }
        }
      );
      
      const toxicityScore = perspectiveResponse.data.attributeScores.TOXICITY.summaryScore.value;
      const isAllowed = toxicityScore > 0.7; // Threshold for toxicity
      
      this.debugLog(`🎯 Toxicity score: ${toxicityScore}, Allowed: ${isAllowed}`);
      return isAllowed;
      */

      return true; // STUB: Always allow for now
    } catch (error) {
      logger.error('❌ Error checking if content is allowed to roast:', error);
      return false; // Fail safe: don't roast if there's an error
    }
  }

  /**
   * Generate roast using the API with retry logic
   */
  async generateRoast(message, retries = 2) {
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        this.debugLog(
          '🔥 Generating roast for message:',
          message.substring(0, 100) + (message.length > 100 ? '...' : '')
        );
        this.debugLog(
          `📡 API Call attempt ${attempt}/${retries + 1} to: ${this.roastApiUrl}/roast`
        );

        const response = await axios.post(
          `${this.roastApiUrl}/roast`,
          {
            message: message
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.ROASTR_API_KEY || ''
            },
            timeout: 15000 // 15 second timeout
          }
        );

        this.debugLog(
          '✅ Roast generated successfully:',
          response.data.roast?.substring(0, 50) + '...'
        );
        return response.data.roast;
      } catch (error) {
        const isLastAttempt = attempt === retries + 1;
        const errorMsg = error.response?.data || error.message;

        if (isLastAttempt) {
          logger.error('❌ Error generating roast after all retries:', errorMsg);
          throw error;
        } else {
          logger.warn(`⚠️ Roast generation failed (attempt ${attempt}), retrying in 2 seconds...`);
          this.debugLog('Error details:', errorMsg);
          await this.sleep(2000);
        }
      }
    }
  }

  /**
   * Initialize bot user info to avoid self-replies
   */
  async initializeBotInfo() {
    try {
      // Use OAuth 1.0a client to get user info (Bearer token doesn't work for /users/me)
      const me = await this.client.v2.me();
      this.botUserId = me.data.id;
      this.botUsername = me.data.username;

      logger.info(`👤 Bot authenticated as: @${this.botUsername} (ID: ${this.botUserId})`);
      this.debugLog('Bot user info initialized successfully');

      return me.data;
    } catch (error) {
      logger.error('❌ Error initializing bot info:', error);
      logger.error('💡 Make sure your Twitter app has "Read and Write" permissions');
      throw error;
    }
  }

  /**
   * Authenticate method for BaseIntegration compatibility
   * This method is called by the IntegrationManager
   */
  async authenticate() {
    try {
      logger.info('🔐 Authenticating with Twitter API...');

      // Initialize bot user info (this also validates authentication)
      await this.initializeBotInfo();

      logger.info('✅ Twitter authentication successful');
      return true;
    } catch (error) {
      logger.error('❌ Twitter authentication failed:', error.message);
      throw error;
    }
  }

  /**
   * Initialize method for BaseIntegration compatibility
   * This method is called by the IntegrationManager
   */
  async initialize() {
    try {
      logger.info('🚀 Initializing Twitter integration...');

      // Call parent initialize method
      await super.initialize();

      logger.info('✅ Twitter integration initialized successfully');
      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize Twitter integration:', error.message);
      throw error;
    }
  }

  /**
   * Listen for mentions method for BaseIntegration compatibility
   * This method is called by the IntegrationManager for batch processing
   */
  async listenForMentions() {
    try {
      logger.info('👂 [TWITTER] Starting to listen for mentions in batch mode...');

      // Process recent mentions using existing batch logic
      const result = await this.processMentions();

      logger.info(`✅ [TWITTER] Batch processing completed`);
      return result;
    } catch (error) {
      logger.error('❌ [TWITTER] Error in batch mention processing:', error.message);
      throw error;
    }
  }

  /**
   * Post response method for BaseIntegration compatibility
   * This method is called by the IntegrationManager to post responses
   */
  async postResponse(parentId, response) {
    try {
      // Use existing replyToTweet method
      const result = await this.replyToTweet(parentId, response);

      // Update metrics
      this.metrics.responsesGenerated++;

      return result;
    } catch (error) {
      logger.error('❌ [TWITTER] Error posting response:', error.message);
      this.metrics.errorsEncountered++;
      throw error;
    }
  }

  /**
   * Check if tweet is from the bot itself (to avoid self-replies)
   */
  isSelfTweet(authorId) {
    return authorId === this.botUserId;
  }

  /**
   * Setup filtered stream for real-time mentions
   */
  async setupStream() {
    try {
      this.debugLog('🔧 Setting up Twitter stream...');

      // Delete existing rules first
      const rules = await this.bearerClient.v2.streamRules();
      if (rules.data?.length > 0) {
        this.debugLog('🗑️ Deleting existing stream rules...');
        await this.bearerClient.v2.updateStreamRules({
          delete: { ids: rules.data.map((rule) => rule.id) }
        });
      }

      // Add rule to track mentions to our bot account
      const streamRules = await this.bearerClient.v2.updateStreamRules({
        add: [{ value: `@${this.botUsername}`, tag: 'mentions-to-bot' }]
      });

      this.debugLog('✅ Stream rules set:', streamRules.data);
      logger.info(`📡 Stream configured to listen for mentions to @${this.botUsername}`);

      return streamRules;
    } catch (error) {
      logger.error('❌ Error setting up stream:', error);
      throw error;
    }
  }

  /**
   * Start listening to real-time mentions stream
   */
  async startStream() {
    try {
      logger.info('🚀 Starting real-time Twitter stream...');

      // Get the filtered stream
      this.stream = await this.bearerClient.v2.searchStream({
        'tweet.fields': ['created_at', 'author_id', 'conversation_id', 'referenced_tweets'],
        'user.fields': ['username', 'name'],
        expansions: ['author_id', 'referenced_tweets.id']
      });

      logger.info('✅ Stream started! Listening for mentions...');

      // Handle stream events
      this.stream.on(ETwitterStreamEvent.Data, async (tweet) => {
        await this.handleStreamTweet(tweet);
      });

      this.stream.on(ETwitterStreamEvent.DataError, (error) => {
        logger.error('❌ Stream data error:', error);
      });

      this.stream.on(ETwitterStreamEvent.ConnectionError, (error) => {
        logger.error('❌ Stream connection error:', error);
        this.debugLog('Attempting to reconnect in 5 seconds...');
        this.reconnectTimeout = setTimeout(() => this.reconnectStream(), 5000);
      });

      this.stream.on(ETwitterStreamEvent.ConnectionClosed, () => {
        logger.info('🔌 Stream connection closed');
      });

      return this.stream;
    } catch (error) {
      logger.error('❌ Error starting stream:', error);
      throw error;
    }
  }

  /**
   * Handle incoming tweet from stream
   */
  async handleStreamTweet(tweetData) {
    try {
      const tweet = tweetData.data;
      this.debugLog('📨 Received tweet from stream:', {
        id: tweet.id,
        text: tweet.text?.substring(0, 100) + '...',
        author_id: tweet.author_id
      });

      // Skip if it's from the bot itself
      if (this.isSelfTweet(tweet.author_id)) {
        this.debugLog('⏭️ Skipping self-tweet');
        return;
      }

      // Skip if already processed
      const processedIds = await this.getProcessedTweetIds();
      if (processedIds.includes(tweet.id)) {
        this.debugLog(`⏭️ Tweet ${tweet.id} already processed`);
        return;
      }

      logger.info(`\n🔍 Processing new mention: ${tweet.id}`);
      logger.info(`👤 From: ${tweetData.includes?.users?.[0]?.username || 'unknown'}`);
      logger.info(`📝 Text: "${tweet.text}"`);

      // Process the tweet
      await this.processSingleTweet(tweet);
    } catch (error) {
      logger.error('❌ Error handling stream tweet:', error);
    }
  }

  /**
   * Process a single tweet (extracted from processMentions for reuse)
   */
  async processSingleTweet(tweet) {
    try {
      this.processingStartTime = Date.now();

      // Check rate limits before processing
      if (!this.canSendTweet()) {
        logger.info(`⏸️ Rate limit reached for tweet ${tweet.id}, skipping for now`);
        return; // Don't mark as processed so we can retry later
      }

      // Check if content is allowed to be roasted
      const isAllowed = await this.isAllowedToRoast(tweet.text);

      if (!isAllowed) {
        logger.info(`❌ Tweet ${tweet.id} not allowed to be roasted`);
        await this.markTweetAsProcessed(tweet.id);
        await this.markMentionAsProcessed(tweet.id); // Also mark in new system
        this.resetErrorTracking(); // Reset errors for successful operation (even if no roast)
        return;
      }

      // Generate roast
      const roast = await this.generateRoast(tweet.text);
      this.logEvent('info', `Generated roast for tweet ${tweet.id}`, {
        tweetId: tweet.id,
        originalText: tweet.text.substring(0, 100) + (tweet.text.length > 100 ? '...' : ''),
        roastText: roast.substring(0, 100) + (roast.length > 100 ? '...' : '')
      });

      // Reply to tweet
      const reply = await this.replyToTweet(tweet.id, roast);

      // Record successful tweet send for rate limiting
      this.recordTweetSent();

      // Mark as processed (both systems)
      await this.markTweetAsProcessed(tweet.id);
      await this.markMentionAsProcessed(tweet.id);

      // Reset error tracking after successful processing
      this.resetErrorTracking();

      this.logEvent('success', `Successfully processed tweet ${tweet.id}`, {
        replyId: reply?.data?.id,
        processingTime: Date.now() - (this.processingStartTime || 0)
      });
    } catch (error) {
      this.logEvent('error', `Error processing tweet ${tweet.id}`, {
        tweetId: tweet.id,
        errorMessage: error.message,
        errorCode: error.code,
        errorType: error.type,
        processingTime: Date.now() - (this.processingStartTime || 0),
        consecutiveErrors: this.errorStats.consecutiveErrors + 1
      });

      // Track error and get backoff time if needed
      const backoffTime = this.trackError(error);

      if (backoffTime > 0) {
        this.logEvent('warn', `Backing off for ${backoffTime}ms due to consecutive errors`, {
          consecutiveErrors: this.errorStats.consecutiveErrors,
          backoffTime
        });
        await this.sleep(backoffTime);
      }

      // Don't mark as processed if there was an error, so we can retry later
    }
  }

  /**
   * Reconnect stream after connection error
   */
  async reconnectStream() {
    try {
      logger.info('🔄 Attempting to reconnect stream...');

      if (this.stream) {
        this.stream.close();
      }

      await this.sleep(2000);
      await this.startStream();
    } catch (error) {
      logger.error('❌ Error reconnecting stream:', error);
      this.reconnectTimeout = setTimeout(() => this.reconnectStream(), 10000); // Try again in 10 seconds
    }
  }

  /**
   * Get recent mentions of the authenticated user (legacy method for batch processing)
   */
  async getMentions() {
    try {
      this.debugLog('📡 Fetching recent mentions...');

      // Get mentions (tweets that mention the user)
      const mentions = await this.bearerClient.v2.userMentionTimeline(this.botUserId, {
        max_results: 10,
        'tweet.fields': ['created_at', 'author_id', 'conversation_id'],
        'user.fields': ['username'],
        expansions: ['author_id']
      });

      this.debugLog(`📬 Found ${mentions.data?.length || 0} recent mentions`);
      this.debugLog('Raw mentions response:', JSON.stringify(mentions, null, 2));
      return mentions;
    } catch (error) {
      logger.error('❌ Error fetching mentions:', error);
      throw error;
    }
  }

  /**
   * Get recent mentions for batch processing with better filtering
   */
  async getBatchMentions() {
    try {
      this.debugLog('📡 [BATCH] Fetching recent mentions...');

      // Get mentions (tweets that mention the user)
      const mentions = await this.bearerClient.v2.userMentionTimeline(this.botUserId, {
        max_results: 20, // Increased for better coverage in batch mode
        'tweet.fields': ['created_at', 'author_id', 'conversation_id', 'public_metrics'],
        'user.fields': ['username', 'name'],
        expansions: ['author_id']
        // Note: 'exclude' parameter not supported in Essential API tier
      });

      this.debugLog(`📬 [BATCH] Found ${mentions.data?.length || 0} recent mentions`);

      if (this.debug) {
        this.debugLog('[BATCH] Raw mentions response:', JSON.stringify(mentions, null, 2));
      }

      return mentions;
    } catch (error) {
      logger.error('❌ [BATCH] Error fetching mentions:', error);
      throw error;
    }
  }

  /**
   * Reply to a tweet with the generated roast
   */
  async replyToTweet(tweetId, roastText) {
    try {
      logger.info(`💬 Replying to tweet ${tweetId} with roast`);

      const reply = await this.client.v2.reply(roastText, tweetId);
      logger.info(`✅ Successfully replied with tweet ID: ${reply.data.id}`);

      return reply;
    } catch (error) {
      logger.error('❌ Error replying to tweet:', error);
      throw error;
    }
  }

  /**
   * Process mentions and reply with roasts (batch mode)
   */
  async processMentions() {
    try {
      logger.info('🚀 [BATCH] Starting to process mentions...');

      const mentions = await this.getBatchMentions();
      const processedMentionIds = await this.getProcessedMentionIds();

      if (!mentions.data || mentions.data.length === 0) {
        logger.info('📭 [BATCH] No mentions found');
        await this.updateLastCheckTime();
        return { processed: 0, skipped: 0, errors: 0 };
      }

      logger.info(`🔍 [BATCH] Processing ${mentions.data?.length || 0} mentions...`);
      this.debugLog(`[BATCH] Processed mention IDs in memory: ${processedMentionIds.length}`);

      let processed = 0,
        skipped = 0,
        errors = 0;

      for (const tweet of mentions.data && Array.isArray(mentions.data) ? mentions.data : []) {
        try {
          // Skip if already processed
          if (processedMentionIds.includes(tweet.id)) {
            this.debugLog(`⏭️ [BATCH] Skipping already processed mention: ${tweet.id}`);
            skipped++;
            continue;
          }

          // Skip if it's from the bot itself
          if (this.isSelfTweet(tweet.author_id)) {
            this.debugLog(`⏭️ [BATCH] Skipping self-tweet: ${tweet.id}`);
            skipped++;
            continue;
          }

          this.logEvent('info', `[BATCH] Processing mention ${tweet.id}`, {
            text: tweet.text?.substring(0, 100) + (tweet.text?.length > 100 ? '...' : ''),
            authorId: tweet.author_id,
            createdAt: tweet.created_at
          });

          // Use the extracted method for processing
          await this.processSingleTweet(tweet);
          processed++;

          // Add dynamic delay between replies to avoid rate limiting
          const delay = this.getProcessingDelay();
          this.debugLog(`⏳ [BATCH] Waiting ${delay}ms before processing next mention`);
          await this.sleep(delay);
        } catch (error) {
          this.logEvent('error', `[BATCH] Error processing mention ${tweet.id}`, {
            error: error.message,
            tweetId: tweet.id
          });
          errors++;
          // Continue with next tweet even if this one fails
        }
      }

      await this.updateLastCheckTime();

      this.logEvent('success', `[BATCH] Finished processing mentions`, {
        processed,
        skipped,
        errors,
        total: mentions.data?.length || 0
      });

      return { processed, skipped, errors };
    } catch (error) {
      logger.error('❌ [BATCH] Error in processMentions:', error);
      return { processed: 0, skipped: 0, errors: 1 };
    }
  }

  /**
   * Sleep utility function
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate required environment variables
   */
  validateConfig() {
    const required = [
      'TWITTER_BEARER_TOKEN',
      'TWITTER_APP_KEY',
      'TWITTER_APP_SECRET',
      'TWITTER_ACCESS_TOKEN',
      'TWITTER_ACCESS_SECRET'
    ];

    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      logger.error('❌ Missing required environment variables:', missing.join(', '));
      logger.error('💡 Please add them to your .env file');
      return false;
    }

    logger.info('✅ All required environment variables are set');
    return true;
  }

  /**
   * Run the bot in streaming mode (DEPRECATED - requires higher Twitter API tier)
   */
  async runStream() {
    logger.error('⚠️ STREAMING MODE IS DISABLED');
    logger.error(
      '📋 Streaming requires Twitter API v2 with elevated access (not available in Essential plan)'
    );
    logger.error('💡 Use batch mode instead: npm run twitter:batch');
    logger.error('🔄 For continuous operation, set up a cron job or use the polling batch mode');

    logger.info('\n🔄 Switching to batch polling mode...');
    await this.runBatchPolling();
  }

  /**
   * Run the bot in batch mode (one-time check)
   */
  async runBatch() {
    try {
      logger.info('🤖 Starting Roastr.ai Twitter Bot in BATCH mode...');

      // Initialize bot info
      await this.initializeBotInfo();

      // Process recent mentions
      const result = await this.processMentions();

      this.logEvent('success', 'Batch execution completed', result);
      return result;
    } catch (error) {
      logger.error('❌ Fatal error in batch mode:', error);
      process.exit(1);
    }
  }

  /**
   * Execute a single batch cycle (for cron jobs)
   */
  async runSingleCycle() {
    try {
      logger.info('🤖 Roastr.ai batch started - Mode: single');

      // Initialize bot info
      await this.initializeBotInfo();

      const cycleStart = Date.now();
      this.debugLog(`🔃 [SINGLE] Starting batch cycle at ${new Date().toISOString()}`);

      // Process mentions once
      const result = await this.processMentions();

      const cycleTime = Date.now() - cycleStart;
      this.logEvent('success', `[SINGLE] Batch cycle completed`, {
        ...result,
        cycleTimeMs: cycleTime,
        mode: 'single'
      });

      logger.info('✅ Roastr.ai batch completed successfully');
      return result;
    } catch (error) {
      logger.error('❌ Fatal error in single batch mode:', error);
      process.exit(1);
    }
  }

  /**
   * Run the bot in batch polling mode (continuous with intervals)
   */
  async runBatchPolling() {
    try {
      logger.info('🤖 Roastr.ai batch started - Mode: loop');
      logger.info(`⏰ Polling interval: ${this.batchConfig.intervalMinutes} minutes`);

      // Initialize bot info
      await this.initializeBotInfo();

      this.batchConfig.pollingActive = true;

      // Keep the process alive
      process.on('SIGINT', () => {
        logger.info('\n🛑 Shutting down batch polling gracefully...');
        this.batchConfig.pollingActive = false;
        process.exit(0);
      });

      logger.info('✅ Bot running in batch polling mode. Press Ctrl+C to stop.');

      // Main polling loop
      while (this.batchConfig.pollingActive) {
        try {
          const cycleStart = Date.now();
          this.debugLog(`🔃 [POLLING] Starting new cycle at ${new Date().toISOString()}`);

          const result = await this.processMentions();

          const cycleTime = Date.now() - cycleStart;
          this.logEvent('info', `[POLLING] Cycle completed`, {
            ...result,
            cycleTimeMs: cycleTime,
            nextCycleIn: `${this.batchConfig.intervalMinutes} minutes`
          });

          // Wait for next cycle
          const waitTimeMs = this.batchConfig.intervalMinutes * 60 * 1000;
          this.debugLog(
            `⏳ [POLLING] Waiting ${this.batchConfig.intervalMinutes} minutes until next cycle...`
          );

          await this.sleep(waitTimeMs);
        } catch (error) {
          this.logEvent('error', '[POLLING] Error in polling cycle', {
            error: error.message,
            nextRetryIn: '1 minute'
          });

          // Wait 1 minute before retry on error
          await this.sleep(60000);
        }
      }
    } catch (error) {
      logger.error('❌ Fatal error in batch polling mode:', error);
      process.exit(1);
    }
  }

  /**
   * Run the bot (default to batch mode for Essential API compatibility)
   */
  async run(mode = 'batch') {
    if (mode === 'batch') {
      // Check RUN_MODE to determine single vs loop execution
      if (this.batchConfig.runMode === 'single') {
        await this.runSingleCycle();
      } else {
        await this.runBatch();
      }
    } else if (mode === 'polling') {
      // Check RUN_MODE for polling mode as well
      if (this.batchConfig.runMode === 'single') {
        await this.runSingleCycle();
      } else {
        await this.runBatchPolling();
      }
    } else {
      // Stream mode is disabled, fallback to polling with RUN_MODE support
      logger.warn(
        '⚠️ Stream mode not available with Essential API plan, using batch polling instead'
      );
      if (this.batchConfig.runMode === 'single') {
        await this.runSingleCycle();
      } else {
        await this.runBatchPolling();
      }
    }
  }

  /**
   * Cleanup method to properly close all connections and timers
   * This is essential for preventing open handles in tests
   */
  async cleanup() {
    logger.info('🧹 Cleaning up Twitter service...');

    try {
      // Stop batch polling
      if (this.batchConfig && this.batchConfig.pollingActive) {
        this.batchConfig.pollingActive = false;
        logger.info('🛑 Stopped batch polling');
      }
    } catch (error) {
      logger.warn('⚠️ Error stopping batch polling:', error.message);
    }

    // Close stream connection
    if (this.stream) {
      try {
        this.stream.close();
        this.stream.removeAllListeners();
        this.stream = null;
        logger.info('🔌 Closed Twitter stream');
      } catch (error) {
        logger.warn('⚠️ Error closing stream:', error.message);
      }
    }

    // Clear any pending timeouts/intervals
    try {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
        logger.info('⏰ Cleared reconnect timeout');
      }

      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
        logger.info('⏰ Cleared polling interval');
      }
    } catch (error) {
      logger.warn('⚠️ Error clearing timeouts/intervals:', error.message);
    }

    logger.info('✅ Twitter service cleanup completed');

    // TODO: Implement cleanup timeout to prevent hanging cleanup operations
    // TODO: Add cleanup verification tests that check for resource leaks
  }
}

// Run the bot if this file is executed directly
if (require.main === module) {
  const bot = new TwitterRoastBot();

  // Check for command line argument to determine mode
  let mode = process.argv[2] || 'batch'; // Default to batch mode

  // Map legacy modes
  if (mode === 'stream') {
    mode = 'polling'; // Convert stream to polling for Essential API compatibility
    logger.info('🔄 Converting stream mode to batch polling for Essential API compatibility');
  }

  // Show current configuration
  const runMode = bot.batchConfig.runMode;
  logger.info(`🚀 Starting bot in ${mode.toUpperCase()} mode with RUN_MODE=${runMode}...`);

  if (runMode === 'single') {
    logger.info('📋 Single cycle mode: will execute once and exit (ideal for cron jobs)');
  } else {
    logger.info(
      `📋 Loop mode: will run continuously with ${bot.batchConfig.intervalMinutes} minute intervals`
    );
  }

  bot.run(mode);
}

module.exports = TwitterRoastBot;

/*
=================================================================================================
📚 ROASTR.AI TWITTER BOT - USAGE DOCUMENTATION
=================================================================================================

This Twitter bot supports two execution modes via the RUN_MODE environment variable:

🔄 LOOP MODE (default):
   - Runs continuously with configurable intervals
   - Suitable for long-running processes
   - Handles SIGINT gracefully for clean shutdown

⚡ SINGLE MODE:
   - Executes one batch cycle and exits
   - Perfect for cron jobs and scheduled tasks
   - Returns proper exit codes (0 = success, 1 = error)

-------------------------------------------------------------------------------------------------
🚀 EXECUTION EXAMPLES:
-------------------------------------------------------------------------------------------------

1. Default behavior (loop mode):
   npm run twitter:batch
   npm run twitter

2. Single cycle execution (cron job mode):
   RUN_MODE=single npm run twitter:batch
   RUN_MODE=single npm run twitter

3. Configure polling interval (loop mode only):
   BATCH_INTERVAL_MINUTES=10 npm run twitter

-------------------------------------------------------------------------------------------------
⏰ CRON JOB EXAMPLES:
-------------------------------------------------------------------------------------------------

Every 5 minutes:
0,5,10,15,20,25,30,35,40,45,50,55 * * * * cd /path/to/roastr-ai && RUN_MODE=single npm run twitter:batch >> /var/log/roastr-twitter.log 2>&1

Every 15 minutes with debug:
0,15,30,45 * * * * cd /path/to/roastr-ai && RUN_MODE=single DEBUG=true npm run twitter:batch >> /var/log/roastr-twitter-debug.log 2>&1

Every hour:
0 * * * * cd /path/to/roastr-ai && RUN_MODE=single npm run twitter:batch

-------------------------------------------------------------------------------------------------
🔧 ENVIRONMENT VARIABLES:
-------------------------------------------------------------------------------------------------

RUN_MODE=loop                    # Execution mode: 'loop' (continuous) or 'single' (one-time)
BATCH_INTERVAL_MINUTES=5         # Polling interval in minutes (loop mode only)
DEBUG=true                       # Enable detailed JSON logging
MAX_TWEETS_PER_HOUR=10          # Rate limiting: max tweets per hour
MIN_DELAY_BETWEEN_TWEETS=5000   # Rate limiting: minimum delay between tweets (ms)
MAX_DELAY_BETWEEN_TWEETS=30000  # Rate limiting: maximum delay between tweets (ms)

Required Twitter API credentials:
TWITTER_BEARER_TOKEN=your_bearer_token
TWITTER_APP_KEY=your_app_key
TWITTER_APP_SECRET=your_app_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_SECRET=your_access_secret

-------------------------------------------------------------------------------------------------
📊 LOG OUTPUT EXAMPLES:
-------------------------------------------------------------------------------------------------

Loop mode startup:
🤖 Roastr.ai batch started - Mode: loop
⏰ Polling interval: 5 minutes
👤 Bot authenticated as: @YourBot (ID: 123456789)
✅ Bot running in batch polling mode. Press Ctrl+C to stop.

Single mode execution:
🤖 Roastr.ai batch started - Mode: single
👤 Bot authenticated as: @YourBot (ID: 123456789)
🚀 [BATCH] Starting to process mentions...
📭 [BATCH] No mentions found
✅ [2025-08-05T18:00:00.000Z] [SINGLE] Batch cycle completed
✅ Roastr.ai batch completed successfully

-------------------------------------------------------------------------------------------------
🛠️ TROUBLESHOOTING:
-------------------------------------------------------------------------------------------------

1. Bot doesn't exit in single mode:
   - Check for unhandled promises or event listeners
   - Ensure no infinite loops in error handling

2. Cron job doesn't work:
   - Use absolute paths: cd /full/path/to/roastr-ai
   - Set proper environment variables in cron
   - Check cron logs: tail -f /var/log/cron

3. Rate limiting issues:
   - Adjust MAX_TWEETS_PER_HOUR and delay settings
   - Monitor Twitter API usage in developer portal
   - Consider increasing BATCH_INTERVAL_MINUTES for less frequent checks

=================================================================================================
*/
