#!/usr/bin/env node

const { TwitterApi, ETwitterStreamEvent } = require('twitter-api-v2');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

class TwitterRoastBot {
  constructor() {
    // Validate config first
    if (!this.validateConfig()) {
      throw new Error('Invalid Twitter configuration');
    }

    // Initialize Twitter client with OAuth 1.0a (for posting tweets)
    this.client = new TwitterApi({
      appKey: process.env.TWITTER_APP_KEY,
      appSecret: process.env.TWITTER_APP_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });

    // Bearer token client for reading mentions (OAuth 2.0)
    this.bearerClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);

    // Debug mode
    this.debug = process.env.DEBUG === 'true';
    
    // Bot user info (to avoid replying to self)
    this.botUserId = null;
    this.botUsername = null;
    
    // Stream reference
    this.stream = null;

    // File to store processed tweet IDs
    this.processedTweetsFile = path.join(__dirname, '../../data/processed_tweets.json');
    
    // API endpoint for roast generation
    this.roastApiUrl = process.env.ROAST_API_URL || 'https://roastr-lhcp7seuh-eibon7s-projects.vercel.app';
    
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
    
    // Initialize processed tweets tracking
    this.initializeProcessedTweets();
  }

  /**
   * Initialize the processed tweets file if it doesn't exist
   */
  async initializeProcessedTweets() {
    try {
      await fs.ensureFile(this.processedTweetsFile);
      const exists = await fs.pathExists(this.processedTweetsFile);
      if (!exists || (await fs.readFile(this.processedTweetsFile, 'utf8')).trim() === '') {
        await fs.writeJson(this.processedTweetsFile, { processedTweetIds: [] }, { spaces: 2 });
      }
    } catch (error) {
      console.error('❌ Error initializing processed tweets file:', error);
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
      console.error('❌ Error reading processed tweets:', error);
      return [];
    }
  }

  /**
   * Add tweet ID to processed list
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
      console.error('❌ Error marking tweet as processed:', error);
    }
  }

  /**
   * Log debug messages if debug mode is enabled
   */
  debugLog(message, ...args) {
    if (this.debug) {
      console.log(`[TWITTER-DEBUG] ${new Date().toISOString()}: ${message}`, ...args);
    }
  }

  /**
   * Enhanced logging for important events
   */
  logEvent(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
    
    if (this.debug && Object.keys(data).length > 0) {
      console.log(`[TWITTER-DEBUG] Event data:`, JSON.stringify(data, null, 2));
    }
  }

  /**
   * Check if we can send a tweet based on rate limits
   */
  canSendTweet() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Clean old timestamps
    this.rateLimits.tweetsTimestamps = this.rateLimits.tweetsTimestamps.filter(
      timestamp => timestamp > oneHourAgo
    );
    
    // Check hourly limit
    if (this.rateLimits.tweetsTimestamps.length >= this.rateLimits.tweetsPerHour) {
      this.logEvent('warn', 'Rate limit reached', {
        currentCount: this.rateLimits.tweetsTimestamps.length,
        maxPerHour: this.rateLimits.tweetsPerHour,
        oldestTweetTime: new Date(this.rateLimits.tweetsTimestamps[0]).toISOString(),
        timeUntilReset: Math.ceil((this.rateLimits.tweetsTimestamps[0] + (60 * 60 * 1000) - now) / 1000 / 60) + ' minutes'
      });
      return false;
    }
    
    // Check minimum delay between tweets
    const lastTweetTime = this.rateLimits.tweetsTimestamps[this.rateLimits.tweetsTimestamps.length - 1];
    if (lastTweetTime && (now - lastTweetTime) < this.rateLimits.minDelayBetweenTweets) {
      this.debugLog(`⚠️ Too soon since last tweet: ${now - lastTweetTime}ms < ${this.rateLimits.minDelayBetweenTweets}ms`, {
        timeSinceLastTweet: now - lastTweetTime,
        minDelay: this.rateLimits.minDelayBetweenTweets,
        timeUntilNextAllowed: Math.ceil((this.rateLimits.minDelayBetweenTweets - (now - lastTweetTime)) / 1000) + 's'
      });
      return false;
    }
    
    return true;
  }
  
  /**
   * Record that a tweet was sent
   */
  recordTweetSent() {
    this.rateLimits.tweetsTimestamps.push(Date.now());
    this.debugLog(`📝 Tweet recorded - Total in last hour: ${this.rateLimits.tweetsTimestamps.length}/${this.rateLimits.tweetsPerHour}`);
  }
  
  /**
   * Calculate dynamic delay between tweet processing attempts
   */
  getProcessingDelay() {
    const baseDelay = Math.random() * (this.rateLimits.maxDelayBetweenTweets - this.rateLimits.minDelayBetweenTweets) + this.rateLimits.minDelayBetweenTweets;
    
    // Add exponential backoff if we've had consecutive errors
    if (this.errorStats.consecutiveErrors > 0) {
      const backoffDelay = this.errorStats.baseBackoffDelay * Math.pow(this.errorStats.backoffMultiplier, this.errorStats.consecutiveErrors - 1);
      return Math.min(baseDelay + backoffDelay, 300000); // Max 5 minutes
    }
    
    return baseDelay;
  }
  
  /**
   * Reset error tracking after successful operation
   */
  resetErrorTracking() {
    if (this.errorStats.consecutiveErrors > 0) {
      this.debugLog(`✅ Error streak broken after ${this.errorStats.consecutiveErrors} consecutive errors`);
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
      const backoffTime = this.errorStats.baseBackoffDelay * Math.pow(this.errorStats.backoffMultiplier, this.errorStats.consecutiveErrors - 1);
      console.warn(`⚠️ Too many consecutive errors (${this.errorStats.consecutiveErrors}). Backing off for ${backoffTime}ms`);
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
      console.error('❌ Error checking if content is allowed to roast:', error);
      return false; // Fail safe: don't roast if there's an error
    }
  }

  /**
   * Generate roast using the API with retry logic
   */
  async generateRoast(message, retries = 2) {
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        this.debugLog('🔥 Generating roast for message:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
        this.debugLog(`📡 API Call attempt ${attempt}/${retries + 1} to: ${this.roastApiUrl}/roast`);
        
        const response = await axios.post(`${this.roastApiUrl}/roast`, {
          message: message
        }, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ROASTR_API_KEY || ''
          },
          timeout: 15000 // 15 second timeout
        });

        this.debugLog('✅ Roast generated successfully:', response.data.roast?.substring(0, 50) + '...');
        return response.data.roast;
        
      } catch (error) {
        const isLastAttempt = attempt === retries + 1;
        const errorMsg = error.response?.data || error.message;
        
        if (isLastAttempt) {
          console.error('❌ Error generating roast after all retries:', errorMsg);
          throw error;
        } else {
          console.warn(`⚠️ Roast generation failed (attempt ${attempt}), retrying in 2 seconds...`);
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
      
      console.log(`👤 Bot authenticated as: @${this.botUsername} (ID: ${this.botUserId})`);
      this.debugLog('Bot user info initialized successfully');
      
      return me.data;
    } catch (error) {
      console.error('❌ Error initializing bot info:', error);
      console.error('💡 Make sure your Twitter app has "Read and Write" permissions');
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
          delete: { ids: rules.data.map(rule => rule.id) }
        });
      }

      // Add rule to track mentions to our bot account
      const streamRules = await this.bearerClient.v2.updateStreamRules({
        add: [
          { value: `@${this.botUsername}`, tag: 'mentions-to-bot' }
        ]
      });

      this.debugLog('✅ Stream rules set:', streamRules.data);
      console.log(`📡 Stream configured to listen for mentions to @${this.botUsername}`);
      
      return streamRules;
    } catch (error) {
      console.error('❌ Error setting up stream:', error);
      throw error;
    }
  }

  /**
   * Start listening to real-time mentions stream
   */
  async startStream() {
    try {
      console.log('🚀 Starting real-time Twitter stream...');
      
      // Get the filtered stream
      this.stream = await this.bearerClient.v2.searchStream({
        'tweet.fields': ['created_at', 'author_id', 'conversation_id', 'referenced_tweets'],
        'user.fields': ['username', 'name'],
        expansions: ['author_id', 'referenced_tweets.id']
      });

      console.log('✅ Stream started! Listening for mentions...');

      // Handle stream events
      this.stream.on(ETwitterStreamEvent.Data, async (tweet) => {
        await this.handleStreamTweet(tweet);
      });

      this.stream.on(ETwitterStreamEvent.DataError, (error) => {
        console.error('❌ Stream data error:', error);
      });

      this.stream.on(ETwitterStreamEvent.ConnectionError, (error) => {
        console.error('❌ Stream connection error:', error);
        this.debugLog('Attempting to reconnect in 5 seconds...');
        setTimeout(() => this.reconnectStream(), 5000);
      });

      this.stream.on(ETwitterStreamEvent.ConnectionClosed, () => {
        console.log('🔌 Stream connection closed');
      });

      return this.stream;
    } catch (error) {
      console.error('❌ Error starting stream:', error);
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

      console.log(`\n🔍 Processing new mention: ${tweet.id}`);
      console.log(`👤 From: ${tweetData.includes?.users?.[0]?.username || 'unknown'}`);
      console.log(`📝 Text: "${tweet.text}"`);

      // Process the tweet
      await this.processSingleTweet(tweet);

    } catch (error) {
      console.error('❌ Error handling stream tweet:', error);
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
        console.log(`⏸️ Rate limit reached for tweet ${tweet.id}, skipping for now`);
        return; // Don't mark as processed so we can retry later
      }

      // Check if content is allowed to be roasted
      const isAllowed = await this.isAllowedToRoast(tweet.text);
      
      if (!isAllowed) {
        console.log(`❌ Tweet ${tweet.id} not allowed to be roasted`);
        await this.markTweetAsProcessed(tweet.id);
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

      // Mark as processed
      await this.markTweetAsProcessed(tweet.id);

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
      console.log('🔄 Attempting to reconnect stream...');
      
      if (this.stream) {
        this.stream.close();
      }
      
      await this.sleep(2000);
      await this.startStream();
      
    } catch (error) {
      console.error('❌ Error reconnecting stream:', error);
      setTimeout(() => this.reconnectStream(), 10000); // Try again in 10 seconds
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
      console.error('❌ Error fetching mentions:', error);
      throw error;
    }
  }

  /**
   * Reply to a tweet with the generated roast
   */
  async replyToTweet(tweetId, roastText) {
    try {
      console.log(`💬 Replying to tweet ${tweetId} with roast`);
      
      const reply = await this.client.v2.reply(roastText, tweetId);
      console.log(`✅ Successfully replied with tweet ID: ${reply.data.id}`);
      
      return reply;
    } catch (error) {
      console.error('❌ Error replying to tweet:', error);
      throw error;
    }
  }

  /**
   * Process mentions and reply with roasts
   */
  async processMentions() {
    try {
      console.log('🚀 Starting to process mentions...');
      
      const mentions = await this.getMentions();
      const processedIds = await this.getProcessedTweetIds();

      if (!mentions.data || mentions.data.length === 0) {
        console.log('📭 No mentions found');
        return;
      }

      console.log(`🔍 Processing ${mentions.data?.length || 0} mentions...`);

      for (const tweet of (mentions.data || [])) {
        try {
          // Skip if already processed
          if (processedIds.includes(tweet.id)) {
            this.debugLog(`⏭️ Skipping already processed tweet: ${tweet.id}`);
            continue;
          }

          // Skip if it's from the bot itself
          if (this.isSelfTweet(tweet.author_id)) {
            this.debugLog(`⏭️ Skipping self-tweet: ${tweet.id}`);
            continue;
          }

          console.log(`\n🔍 Processing tweet ${tweet.id}: "${tweet.text}"`);

          // Use the extracted method for processing
          await this.processSingleTweet(tweet);

          // Add dynamic delay between replies to avoid rate limiting
          const delay = this.getProcessingDelay();
          this.debugLog(`⏳ Waiting ${delay}ms before processing next tweet`);
          await this.sleep(delay);

        } catch (error) {
          console.error(`❌ Error processing tweet ${tweet.id}:`, error);
          // Continue with next tweet even if this one fails
        }
      }

      console.log('🏁 Finished processing mentions');

    } catch (error) {
      console.error('❌ Error in processMentions:', error);
    }
  }

  /**
   * Sleep utility function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing.join(', '));
      console.error('💡 Please add them to your .env file');
      return false;
    }

    console.log('✅ All required environment variables are set');
    return true;
  }

  /**
   * Run the bot in streaming mode (persistent)
   */
  async runStream() {
    try {
      console.log('🤖 Starting Roastr.ai Twitter Bot in STREAMING mode...');
      
      // Initialize bot info
      await this.initializeBotInfo();
      
      // Setup and start stream
      await this.setupStream();
      await this.startStream();
      
      console.log('✅ Bot running in streaming mode. Press Ctrl+C to stop.');
      
      // Keep the process alive
      process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down gracefully...');
        if (this.stream) {
          this.stream.close();
        }
        process.exit(0);
      });
      
    } catch (error) {
      console.error('❌ Fatal error in streaming mode:', error);
      process.exit(1);
    }
  }

  /**
   * Run the bot in batch mode (one-time check)
   */
  async runBatch() {
    try {
      console.log('🤖 Starting Roastr.ai Twitter Bot in BATCH mode...');
      
      // Initialize bot info
      await this.initializeBotInfo();
      
      // Process recent mentions
      await this.processMentions();
      
      console.log('🎉 Batch execution completed');
    } catch (error) {
      console.error('❌ Fatal error in batch mode:', error);
      process.exit(1);
    }
  }

  /**
   * Run the bot (default to streaming mode)
   */
  async run(mode = 'stream') {
    if (mode === 'batch') {
      await this.runBatch();
    } else {
      await this.runStream();
    }
  }
}

// Run the bot if this file is executed directly
if (require.main === module) {
  const bot = new TwitterRoastBot();
  
  // Check for command line argument to determine mode
  const mode = process.argv[2] === 'batch' ? 'batch' : 'stream';
  console.log(`🚀 Starting bot in ${mode.toUpperCase()} mode...`);
  
  bot.run(mode);
}

module.exports = TwitterRoastBot;