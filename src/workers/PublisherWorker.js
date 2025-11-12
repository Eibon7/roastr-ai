const BaseWorker = require('./BaseWorker');

/**
 * Publisher Worker - Publishes roast responses to social media platforms
 *
 * Responsibilities:
 * - Process post_response queue jobs
 * - Check idempotency (skip if already published)
 * - Select and call correct platform service
 * - Handle rate limits (429 errors) with exponential backoff
 * - Retry on transient errors (5xx)
 * - Update roast record with platform_post_id and published_at
 * - Comprehensive logging of all attempts and outcomes
 *
 * Error Classification:
 * - 429 (Rate Limit) → Retry with exponential backoff
 * - 5xx (Server Error) → Retry with exponential backoff
 * - 4xx (Client Error, except 429) → Permanent failure, move to DLQ
 * - Network/Timeout → Retry
 *
 * Idempotency:
 * - Before publishing, check if roast.platform_post_id exists
 * - If exists, skip publication (already published)
 * - Prevents duplicate posts from retries or concurrent jobs
 *
 * Related Issue: #410 (Publisher Integration Tests)
 */
class PublisherWorker extends BaseWorker {
  constructor(options = {}) {
    super('post_response', {
      maxRetries: 3,
      retryDelay: 2000, // 2s base delay for exponential backoff
      maxConcurrency: 2, // Limit concurrent publications to avoid rate limits
      pollInterval: 2000, // Poll every 2s
      ...options
    });

    // Platform service cache
    this.platformServices = {};

    // Error thresholds
    this.RATE_LIMIT_STATUS = 429;
    this.SERVER_ERROR_MIN = 500;
    this.CLIENT_ERROR_MIN = 400;
    this.CLIENT_ERROR_MAX = 499;
  }

  /**
   * Internal job processing method (required by BaseWorker)
   *
   * @param {Object} job - Job from post_response queue
   * @param {string} job.data.roastId - ID of roast to publish
   * @param {string} job.data.organizationId - Organization ID
   * @returns {Object} Publication result
   */
  async _processJobInternal(job) {
    const { roastId, organizationId } = job.data;
    const startTime = Date.now();

    this.log('info', 'Processing publication job', {
      jobId: job.id,
      roastId,
      organizationId,
      attempt: job.attempts || 1,
      maxRetries: this.config.maxRetries
    });

    try {
      // 1. Fetch roast details
      const roast = await this.fetchRoast(roastId, organizationId);

      if (!roast) {
        throw this.createPermanentError('Roast not found', {
          roastId,
          organizationId
        });
      }

      // 2. Idempotency check - skip if already published
      if (roast.platform_post_id) {
        const duration = Date.now() - startTime;
        this.log('info', 'Skipping duplicate publication (idempotency)', {
          roastId,
          existingPostId: roast.platform_post_id,
          platform: roast.platform,
          duration
        });

        return {
          success: true,
          skipped: true,
          reason: 'already_published',
          postId: roast.platform_post_id,
          duration
        };
      }

      // 3. Validate required fields
      if (!roast.roast_text || !roast.platform) {
        throw this.createPermanentError('Missing required roast fields', {
          hasText: !!roast.roast_text,
          hasPlatform: !!roast.platform,
          roastId
        });
      }

      // 4. Publish to platform
      const publishResult = await this.publishToplatform(roast, job.attempts || 1);

      // 5. Update database with publication details
      await this.updateRoastRecord(roast.id, publishResult.postId);

      const duration = Date.now() - startTime;

      this.log('info', 'Publication successful', {
        roastId,
        postId: publishResult.postId,
        platform: roast.platform,
        duration,
        attempt: job.attempts || 1
      });

      return {
        success: true,
        postId: publishResult.postId,
        platform: roast.platform,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      // Classify error and determine if retriable
      const classifiedError = this.classifyError(error, job.attempts || 1);

      this.log('error', 'Publication failed', {
        roastId,
        organizationId,
        error: error.message,
        errorType: classifiedError.type,
        retriable: classifiedError.retriable,
        statusCode: error.statusCode || error.response?.status,
        attempt: job.attempts || 1,
        maxRetries: this.config.maxRetries,
        duration
      });

      throw classifiedError.error;
    }
  }

  /**
   * Fetch roast record from database
   */
  async fetchRoast(roastId, organizationId) {
    const { data, error } = await this.supabase
      .from('roasts')
      .select('id, roast_text, platform, platform_post_id, published_at, original_comment_id')
      .eq('id', roastId)
      .eq('organization_id', organizationId)
      .single();

    if (error) {
      this.log('error', 'Failed to fetch roast', {
        roastId,
        organizationId,
        error: error.message
      });
      throw error;
    }

    return data;
  }

  /**
   * Publish roast to platform
   */
  async publishToplatform(roast, attempt) {
    const service = await this.getPlatformService(roast.platform);

    if (!service) {
      throw this.createPermanentError('Platform service not available', {
        platform: roast.platform,
        roastId: roast.id
      });
    }

    // Check if platform supports direct posting
    if (!service.supportDirectPosting) {
      this.log('warn', 'Platform does not support direct posting', {
        platform: roast.platform,
        roastId: roast.id
      });

      throw this.createPermanentError('Platform does not support direct posting', {
        platform: roast.platform
      });
    }

    try {
      this.log('info', 'Publishing to platform', {
        platform: roast.platform,
        roastId: roast.id,
        textLength: roast.roast_text.length,
        attempt
      });

      // Call platform service's postResponse method with platform-specific arguments
      // Each platform has its own signature - we adapt here
      const response = await this.callPlatformPostResponse(
        service,
        roast.platform,
        roast
      );

      if (!response.success) {
        throw new Error(response.error || 'Platform API returned success: false');
      }

      return {
        success: true,
        postId: response.responseId || response.id || response.postId,
        publishedAt: new Date().toISOString()
      };

    } catch (error) {
      // Enhance error with platform context
      error.platform = roast.platform;
      error.roastId = roast.id;
      throw error;
    }
  }

  /**
   * Call platform postResponse with platform-specific arguments
   * Adapter pattern to handle different platform service signatures
   */
  async callPlatformPostResponse(service, platform, roast) {
    const platformLower = platform.toLowerCase();

    // Platform-specific argument mapping
    switch (platformLower) {
      case 'discord':
        // Discord: postResponse(originalMessage, responseText)
        // originalMessage needs id and channelId at minimum
        return await service.postResponse(
          {
            id: roast.original_comment_id,
            channelId: roast.channel_id || 'unknown',
            content: roast.original_text || ''
          },
          roast.roast_text
        );

      case 'youtube':
        // YouTube: postResponse(commentId, responseText)
        return await service.postResponse(
          roast.original_comment_id,
          roast.roast_text
        );

      case 'facebook':
      case 'instagram':
        // Facebook/Instagram: postResponse(postId, commentId, responseText)
        return await service.postResponse(
          roast.post_id || roast.parent_id,
          roast.original_comment_id,
          roast.roast_text
        );

      case 'twitter':
        // Twitter: postResponse(tweetId, responseText, userId)
        return await service.postResponse(
          roast.original_comment_id,
          roast.roast_text,
          roast.user_id
        );

      case 'reddit':
        // Reddit: postResponse(subreddit, commentId, responseText)
        return await service.postResponse(
          roast.subreddit || 'roastr',
          roast.original_comment_id,
          roast.roast_text
        );

      case 'twitch':
        // Twitch: postResponse(channelId, commentId, responseText)
        return await service.postResponse(
          roast.channel_id || roast.parent_id,
          roast.original_comment_id,
          roast.roast_text
        );

      case 'tiktok':
        // TikTok: postResponse(videoId, commentId, responseText)
        return await service.postResponse(
          roast.video_id || roast.parent_id,
          roast.original_comment_id,
          roast.roast_text
        );

      case 'bluesky':
        // Bluesky: postResponse(uri, responseText)
        return await service.postResponse(
          roast.uri || roast.original_comment_id,
          roast.roast_text
        );

      default:
        // Fallback: Try generic object signature (backwards compatibility)
        this.log('warn', 'Using generic object signature for unknown platform', {
          platform: platformLower
        });
        return await service.postResponse({
          text: roast.roast_text,
          parentId: roast.original_comment_id,
          roastId: roast.id
        });
    }
  }

  /**
   * Update roast record with publication details
   */
  async updateRoastRecord(roastId, platformPostId) {
    const publishedAt = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('roasts')
      .update({
        platform_post_id: platformPostId,
        published_at: publishedAt,
        status: 'published'
      })
      .eq('id', roastId)
      .select();

    if (error) {
      this.log('error', 'Failed to update roast record', {
        roastId,
        platformPostId,
        error: error.message
      });
      throw error;
    }

    if (!data || data.length === 0) {
      throw new Error(`Failed to update roast ${roastId}: no rows affected`);
    }

    this.log('info', 'Roast record updated with publication details', {
      roastId,
      platformPostId,
      publishedAt
    });

    return data[0];
  }

  /**
   * Get platform service instance
   */
  async getPlatformService(platform) {
    // Cache platform services to avoid reloading
    if (this.platformServices[platform]) {
      return this.platformServices[platform];
    }

    try {
      let ServiceClass;

      switch (platform.toLowerCase()) {
        case 'discord':
          ServiceClass = require('../integrations/discord/discordService');
          break;
        case 'twitter':
          ServiceClass = require('../integrations/twitter/twitterService');
          break;
        case 'youtube':
          ServiceClass = require('../integrations/youtube/youtubeService');
          break;
        case 'reddit':
          ServiceClass = require('../integrations/reddit/redditService');
          break;
        case 'twitch':
          ServiceClass = require('../integrations/twitch/twitchService');
          break;
        case 'facebook':
          ServiceClass = require('../integrations/facebook/facebookService');
          break;
        case 'instagram':
          ServiceClass = require('../integrations/instagram/instagramService');
          break;
        case 'tiktok':
          ServiceClass = require('../integrations/tiktok/tiktokService');
          break;
        case 'bluesky':
          ServiceClass = require('../integrations/bluesky/blueskyService');
          break;
        default:
          this.log('warn', 'Unknown platform', { platform });
          return null;
      }

      // Instantiate service
      const service = new ServiceClass();

      // Cache for future use
      this.platformServices[platform] = service;

      this.log('info', 'Platform service loaded', {
        platform,
        supportDirectPosting: service.supportDirectPosting,
        supportModeration: service.supportModeration
      });

      return service;

    } catch (error) {
      this.log('error', 'Failed to load platform service', {
        platform,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Classify error and determine retry strategy
   *
   * Error Types:
   * - RATE_LIMIT (429): Retry with exponential backoff
   * - SERVER_ERROR (5xx): Retry with exponential backoff
   * - CLIENT_ERROR (4xx except 429): Permanent failure
   * - NETWORK_ERROR: Retry with exponential backoff
   */
  classifyError(error, currentAttempt) {
    const statusCode = error.statusCode || error.response?.status;

    // Rate limit error (429)
    if (statusCode === this.RATE_LIMIT_STATUS) {
      const retryAfter = error.response?.headers?.['retry-after'] || 60;

      return {
        type: 'RATE_LIMIT',
        retriable: true,
        error: this.createRetriableError('Rate limit exceeded', {
          statusCode,
          retryAfter,
          currentAttempt,
          message: error.message
        })
      };
    }

    // Server error (5xx)
    if (statusCode >= this.SERVER_ERROR_MIN) {
      return {
        type: 'SERVER_ERROR',
        retriable: true,
        error: this.createRetriableError('Platform server error', {
          statusCode,
          currentAttempt,
          message: error.message
        })
      };
    }

    // Client error (4xx except 429)
    if (statusCode >= this.CLIENT_ERROR_MIN && statusCode <= this.CLIENT_ERROR_MAX) {
      return {
        type: 'CLIENT_ERROR',
        retriable: false,
        error: this.createPermanentError('Platform client error', {
          statusCode,
          currentAttempt,
          message: error.message
        })
      };
    }

    // Network/timeout errors (no status code)
    if (!statusCode) {
      const isTimeout = error.message?.includes('timeout') ||
                       error.code === 'ETIMEDOUT' ||
                       error.code === 'ECONNRESET';

      if (isTimeout) {
        return {
          type: 'NETWORK_TIMEOUT',
          retriable: true,
          error: this.createRetriableError('Network timeout', {
            currentAttempt,
            code: error.code,
            message: error.message
          })
        };
      }

      // Other network errors
      return {
        type: 'NETWORK_ERROR',
        retriable: true,
        error: this.createRetriableError('Network error', {
          currentAttempt,
          code: error.code,
          message: error.message
        })
      };
    }

    // Unknown error - treat as retriable to be safe
    return {
      type: 'UNKNOWN',
      retriable: true,
      error: this.createRetriableError('Unknown error', {
        currentAttempt,
        message: error.message
      })
    };
  }

  /**
   * Create a retriable error
   */
  createRetriableError(message, metadata = {}) {
    const error = new Error(message);
    error.retriable = true;
    error.metadata = metadata;
    return error;
  }

  /**
   * Create a permanent error (non-retriable)
   */
  createPermanentError(message, metadata = {}) {
    const error = new Error(message);
    error.retriable = false;
    error.permanent = true;
    error.metadata = metadata;
    return error;
  }

  /**
   * Log helper with worker context
   * Uses BaseWorker's log() method which delegates to advancedLogger
   * This override adds PublisherWorker-specific context
   */
  log(level, message, metadata = {}) {
    // Use BaseWorker's log method with PublisherWorker context
    super.log(level, message, {
      component: 'PublisherWorker',
      ...metadata
    });
  }
}

module.exports = PublisherWorker;
