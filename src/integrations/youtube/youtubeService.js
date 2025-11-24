const BaseIntegration = require('../base/BaseIntegration');
const { logger } = require('./../../utils/logger'); // Issue #971: Added for console.log replacement
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class YouTubeService extends BaseIntegration {
  constructor(config) {
    super(config);

    // YouTube API configuration (using API Key for simplicity)
    this.apiKey = process.env.YOUTUBE_API_KEY;
    this.channelId = process.env.YOUTUBE_CHANNEL_ID;
    this.monitoredVideos = process.env.YOUTUBE_MONITORED_VIDEOS?.split(',') || [];
    this.triggerWords = process.env.YOUTUBE_TRIGGER_WORDS?.split(',') || [
      'roast',
      'burn',
      'insult',
      'comeback'
    ];
    this.maxResponsesPerHour = parseInt(process.env.YOUTUBE_MAX_RESPONSES_PER_HOUR) || 5;

    // API endpoint for roast generation
    this.roastApiUrl =
      process.env.ROAST_API_URL || 'https://roastr-lhcp7seuh-eibon7s-projects.vercel.app';

    // File tracking processed comments
    this.processedCommentsFile = path.join(__dirname, '../../../data/processed_youtube.json');

    // Rate limiting
    this.rateLimits = {
      responsesPerHour: this.maxResponsesPerHour,
      minDelayBetweenResponses: 10000, // 10 seconds between responses
      responsesTimestamps: []
    };

    // Error tracking
    this.errorStats = {
      consecutiveErrors: 0,
      lastErrorTime: null,
      maxConsecutiveErrors: 5
    };

    // Initialize tracking
    this.initializeProcessedComments();
  }

  /**
   * Initialize processed comments tracking
   */
  async initializeProcessedComments() {
    try {
      await fs.ensureFile(this.processedCommentsFile);
      const exists = await fs.pathExists(this.processedCommentsFile);
      if (!exists || (await fs.readFile(this.processedCommentsFile, 'utf8')).trim() === '') {
        await fs.writeJson(
          this.processedCommentsFile,
          {
            processedCommentIds: [],
            lastCheck: null,
            totalProcessed: 0,
            platform: 'youtube'
          },
          { spaces: 2 }
        );
      }
    } catch (error) {
      logger.error('❌ Error initializing processed comments file:', error);
    }
  }

  /**
   * Get processed comment IDs
   */
  async getProcessedCommentIds() {
    try {
      const data = await fs.readJson(this.processedCommentsFile);
      return data.processedCommentIds || [];
    } catch (error) {
      logger.error('❌ Error reading processed comments:', error);
      return [];
    }
  }

  /**
   * Mark comment as processed
   */
  async markCommentAsProcessed(commentId) {
    try {
      const data = await fs.readJson(this.processedCommentsFile);
      if (!data.processedCommentIds) data.processedCommentIds = [];

      if (!data.processedCommentIds.includes(commentId)) {
        data.processedCommentIds.push(commentId);
        data.totalProcessed = (data.totalProcessed || 0) + 1;
        data.lastProcessed = new Date().toISOString();

        // Keep only last 1000 processed comments
        if (data.processedCommentIds.length > 1000) {
          data.processedCommentIds = data.processedCommentIds.slice(-1000);
        }

        await fs.writeJson(this.processedCommentsFile, data, { spaces: 2 });
        this.debugLog(
          `📝 Marked comment ${commentId} as processed (total: ${data.totalProcessed})`
        );
      }
    } catch (error) {
      logger.error('❌ Error marking comment as processed:', error);
    }
  }

  /**
   * Update last check timestamp
   */
  async updateLastCheckTime() {
    try {
      const data = await fs.readJson(this.processedCommentsFile);
      data.lastCheck = new Date().toISOString();
      await fs.writeJson(this.processedCommentsFile, data, { spaces: 2 });
    } catch (error) {
      logger.error('❌ Error updating last check time:', error);
    }
  }

  /**
   * Authenticate with YouTube API using API Key
   */
  async authenticate() {
    try {
      this.debugLog('Authenticating with YouTube API...');

      if (!this.apiKey) {
        throw new Error('YouTube API Key is required');
      }

      // Initialize YouTube API client
      const { google } = require('googleapis');
      this.youtube = google.youtube({
        version: 'v3',
        auth: this.apiKey
      });

      // Test authentication with a simple API call
      await this.youtube.search.list({
        part: 'snippet',
        type: 'video',
        maxResults: 1,
        q: 'test'
      });

      logger.info('✅ YouTube API authentication successful');
      return true;
    } catch (error) {
      logger.error('❌ YouTube authentication failed:', error.message);
      throw error;
    }
  }

  /**
   * Start listening for new comments on monitored videos (batch mode)
   */
  async listenForMentions() {
    try {
      logger.info('👂 Starting YouTube comment monitoring in batch mode...');

      if (this.monitoredVideos.length === 0) {
        logger.info('⚠️ No monitored videos configured');
        return;
      }

      // Process all monitored videos once
      await this.runBatch();

      logger.info(
        `✅ Batch processing completed for ${this.monitoredVideos.length} YouTube videos`
      );
    } catch (error) {
      logger.error('❌ Failed to start YouTube monitoring:', error.message);
      throw error;
    }
  }

  /**
   * Run batch processing for all monitored videos
   */
  async runBatch() {
    try {
      this.debugLog('Running YouTube batch processing...');

      const processedCommentIds = await this.getProcessedCommentIds();
      let totalNewComments = 0;
      let totalResponses = 0;

      for (const videoId of this.monitoredVideos) {
        try {
          this.debugLog(`Processing video: ${videoId}`);

          const comments = await this.getRecentComments(videoId);
          const newComments = comments.filter(
            (comment) => !processedCommentIds.includes(comment.id)
          );

          this.debugLog(`Found ${newComments.length} new comments for video ${videoId}`);
          totalNewComments += newComments.length;

          for (const comment of newComments) {
            if (await this.shouldProcessComment(comment)) {
              await this.processComment(comment);
              totalResponses++;

              // Respect rate limits
              await this.sleep(this.rateLimits.minDelayBetweenResponses);

              // Check hourly rate limit
              if (totalResponses >= this.rateLimits.responsesPerHour) {
                logger.info('⚠️ Hourly rate limit reached, stopping batch');
                break;
              }
            }

            // Mark as processed even if not responded to
            await this.markCommentAsProcessed(comment.id);
          }

          // Add delay between video checks
          await this.sleep(2000);
        } catch (videoError) {
          logger.error(`❌ Error processing video ${videoId}:`, videoError.message);
          this.errorStats.consecutiveErrors++;
        }
      }

      await this.updateLastCheckTime();

      logger.info(
        `✅ Batch completed: ${totalNewComments} new comments, ${totalResponses} responses generated`
      );
    } catch (error) {
      logger.error('❌ Error in batch processing:', error.message);
      throw error;
    }
  }

  /**
   * Get recent comments for a specific video
   */
  async getRecentComments(videoId) {
    try {
      this.debugLog(`Getting recent comments for video: ${videoId}`);

      const response = await this.youtube.commentThreads.list({
        part: 'snippet',
        videoId: videoId,
        maxResults: 100,
        order: 'time'
      });

      const comments = [];

      if (response.data.items) {
        for (const thread of response.data.items) {
          const snippet = thread.snippet.topLevelComment.snippet;

          comments.push({
            id: thread.snippet.topLevelComment.id,
            text: snippet.textDisplay || snippet.textOriginal,
            author: snippet.authorDisplayName,
            videoId: videoId,
            publishedAt: snippet.publishedAt,
            parentId: thread.id,
            raw: thread
          });
        }
      }

      this.debugLog(`Retrieved ${comments.length} comments for video ${videoId}`);
      return comments;
    } catch (error) {
      logger.error(`❌ Error getting comments for video ${videoId}:`, error.message);

      // Handle quota exceeded or other API errors
      if (error.message.includes('quota')) {
        throw new Error('YouTube API quota exceeded');
      }

      return [];
    }
  }

  /**
   * Process a YouTube comment and generate response if needed
   */
  async processComment(comment) {
    try {
      this.debugLog(
        `Processing comment from ${comment.author}: ${comment.text.substring(0, 50)}...`
      );

      // Call base class method first
      await super.processComment(comment);

      // Generate roast
      const roast = await this.generateRoast(comment.text);

      if (roast) {
        // Post response (currently dummy implementation)
        await this.postResponse(comment.id, roast);

        logger.info(`✅ [YOUTUBE] Generated response for comment from ${comment.author}`);
        this.metrics.responsesGenerated++;
      }
    } catch (error) {
      logger.error('❌ Error processing YouTube comment:', error.message);
      this.metrics.errorsEncountered++;
      throw error;
    }
  }

  /**
   * Post a response to a YouTube comment (dummy implementation for now)
   */
  async postResponse(commentId, responseText) {
    try {
      this.debugLog(
        `[DUMMY] Posting response to comment ${commentId}: ${responseText.substring(0, 50)}...`
      );

      // Dummy implementation - in real scenario would post to YouTube
      // const response = await this.youtube.comments.insert({
      //   part: 'snippet',
      //   requestBody: {
      //     snippet: {
      //       parentId: commentId,
      //       textOriginal: responseText
      //     }
      //   }
      // });

      logger.info(`✅ [DUMMY] Posted YouTube reply to comment ${commentId}:`);
      logger.info(`   📝 Response: "${responseText}"`);

      return true;
    } catch (error) {
      logger.error(`❌ Failed to post YouTube response:`, error.message);
      throw error;
    }
  }

  /**
   * Check if we should process/respond to a comment
   */
  async shouldProcessComment(comment) {
    try {
      // Check if comment contains trigger words
      const hasTriggerWords = this.shouldRespondToComment(comment.text);
      if (!hasTriggerWords) {
        this.debugLog(`Comment from ${comment.author} has no trigger words`);
        return false;
      }

      // Check rate limits
      if (!this.canPostResponse()) {
        this.debugLog('Rate limit reached, skipping comment');
        return false;
      }

      // Check global filters (length, banned words, etc.)
      if (!this.passesGlobalFilters(comment.text)) {
        this.debugLog(`Comment from ${comment.author} failed global filters`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('❌ Error checking if should process comment:', error.message);
      return false;
    }
  }

  /**
   * Check if we should respond to a comment based on trigger words
   */
  shouldRespondToComment(commentText) {
    const triggerWords = this.triggerWords || ['roast', 'burn', 'insult', 'comeback'];
    const lowerText = commentText.toLowerCase();

    return triggerWords.some((word) => lowerText.includes(word));
  }

  /**
   * Check if we can post a response (rate limiting)
   */
  canPostResponse() {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // Clean old timestamps
    this.rateLimits.responsesTimestamps = this.rateLimits.responsesTimestamps.filter(
      (timestamp) => timestamp > oneHourAgo
    );

    // Check if under hourly limit
    return this.rateLimits.responsesTimestamps.length < this.rateLimits.responsesPerHour;
  }

  /**
   * Check global filters
   */
  passesGlobalFilters(text) {
    // Length checks
    const minLength = 5;
    const maxLength = 2000;

    if (text.length < minLength || text.length > maxLength) {
      return false;
    }

    // Check for banned words
    const bannedWords = ['spam', 'bot', 'fake'];
    const lowerText = text.toLowerCase();

    return !bannedWords.some((word) => lowerText.includes(word));
  }

  /**
   * Generate roast using Roastr API
   */
  async generateRoast(commentText) {
    try {
      this.debugLog(`Generating roast for: ${commentText.substring(0, 50)}...`);

      const axios = require('axios');

      const response = await axios.post(
        `${this.roastApiUrl}/roast`,
        {
          message: commentText
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ROASTR_API_KEY || 'default-key'
          },
          timeout: 15000
        }
      );

      if (response.data && response.data.roast) {
        this.debugLog(`Generated roast: ${response.data.roast.substring(0, 50)}...`);
        return response.data.roast;
      }

      throw new Error('No roast in API response');
    } catch (error) {
      logger.error('❌ Error generating roast:', error.message);

      // Fallback roast
      return `¡Vaya comentario más original! Seguro que tardaste horas en pensarlo. 🔥`;
    }
  }

  /**
   * Add a video to monitoring list
   */
  addVideoToMonitor(videoId) {
    if (!this.monitoredVideos.includes(videoId)) {
      this.monitoredVideos.push(videoId);
      logger.info(`➕ Added video ${videoId} to monitoring list`);
    }
  }

  /**
   * Remove a video from monitoring list
   */
  removeVideoFromMonitor(videoId) {
    const index = this.monitoredVideos.indexOf(videoId);
    if (index > -1) {
      this.monitoredVideos.splice(index, 1);
      logger.info(`➖ Removed video ${videoId} from monitoring list`);
    }
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown() {
    if (this.commentPollingInterval) {
      clearInterval(this.commentPollingInterval);
    }

    await super.shutdown();
  }
}

module.exports = YouTubeService;
