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
 * - Update response record with platform_response_id and posted_at
 * - Comprehensive logging of all attempts and outcomes
 *
 * Error Classification:
 * - 429 (Rate Limit) → Retry with exponential backoff
 * - 5xx (Server Error) → Retry with exponential backoff
 * - 4xx (Client Error, except 429) → Permanent failure, move to DLQ
 * - Network/Timeout → Retry
 *
 * Idempotency:
 * - Before publishing, check if response.platform_response_id exists
 * - If exists, skip publication (already published)
 * - Prevents duplicate posts from retries or concurrent jobs
 *
 * Related Issue: #456 (PublisherWorker Implementation)
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
   * @param {string} job.payload.response_id - ID of response to publish
   * @param {string} job.payload.organization_id - Organization ID
   * @param {string} job.payload.comment_id - Comment ID (to get platform info)
   * @returns {Object} Publication result
   */
  async _processJobInternal(job) {
    const { response_id, organization_id, platform, response_text, comment_id } =
      job.payload || job.data || {};
    const startTime = Date.now();

    this.log('info', 'Processing publication job', {
      jobId: job.id,
      responseId: response_id,
      organizationId: organization_id,
      attempt: job.attempts || 1,
      maxRetries: this.config.maxRetries
    });

    try {
      // 1. Fetch response details
      const response = await this.fetchResponse(response_id, organization_id);

      if (!response) {
        throw this.createPermanentError('Response not found', {
          responseId: response_id,
          organizationId: organization_id
        });
      }

      // 2. Fetch comment details to get platform and platform_comment_id
      const comment = await this.fetchComment(comment_id || response.comment_id, organization_id);

      if (!comment) {
        const error = this.createPermanentError('Comment not found', {
          commentId: comment_id || response.comment_id,
          organizationId: organization_id
        });
        error.statusCode = 404;
        throw error;
      }

      // Use platform from comment if not in payload
      const responsePlatform = platform || comment.platform;

      // 3. Idempotency check - skip if already published
      if (response.platform_response_id) {
        const duration = Date.now() - startTime;
        this.log('info', 'Skipping duplicate publication (idempotency)', {
          responseId: response_id,
          existingPostId: response.platform_response_id,
          platform: responsePlatform,
          duration
        });

        return {
          success: true,
          skipped: true,
          reason: 'already_published',
          postId: response.platform_response_id,
          duration
        };
      }

      // 4. Validate required fields
      const responseText = response_text || response.response_text;
      if (!responseText || !responsePlatform) {
        throw this.createPermanentError('Missing required response fields', {
          hasText: !!responseText,
          hasPlatform: !!responsePlatform,
          responseId: response_id
        });
      }

      // 5. Publish to platform
      const publishResult = await this.publishToPlatform(
        {
          response,
          comment,
          platform: responsePlatform,
          responseText
        },
        job.attempts || 1
      );

      // 6. Update database with publication details
      await this.updateResponseRecord(response_id, publishResult.postId);

      const duration = Date.now() - startTime;

      this.log('info', 'Publication successful', {
        responseId: response_id,
        postId: publishResult.postId,
        platform: responsePlatform,
        duration,
        attempt: job.attempts || 1
      });

      return {
        success: true,
        postId: publishResult.postId,
        platform: responsePlatform,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // Classify error and determine if retriable
      const classifiedError = this.classifyError(error, job.attempts || 1);

      this.log('error', 'Publication failed', {
        responseId: response_id,
        organizationId: organization_id,
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
   * Fetch response record from database
   */
  async fetchResponse(responseId, organizationId) {
    const query = this.supabase
      .from('responses')
      .select(
        'id, response_text, comment_id, platform_response_id, posted_at, post_status, organization_id'
      )
      .eq('id', responseId);

    if (organizationId) {
      query.eq('organization_id', organizationId);
    }

    const { data, error } = await query.single();

    if (error) {
      this.log('error', 'Failed to fetch response', {
        responseId,
        organizationId,
        error: error.message
      });
      throw error;
    }

    return data;
  }

  /**
   * Fetch comment record from database
   */
  async fetchComment(commentId, organizationId) {
    const { data, error } = await this.supabase
      .from('comments')
      .select(
        'id, platform, platform_comment_id, platform_user_id, platform_username, original_text, metadata'
      )
      .eq('id', commentId)
      .eq('organization_id', organizationId)
      .single();

    if (error) {
      this.log('error', 'Failed to fetch comment', {
        commentId,
        organizationId,
        error: error.message
      });
      return null;
    }

    return data;
  }

  /**
   * Publish response to platform
   */
  async publishToPlatform({ response, comment, platform, responseText }, attempt) {
    const service = await this.getPlatformService(platform);

    if (!service) {
      throw this.createPermanentError('Platform service not available', {
        platform,
        responseId: response.id
      });
    }

    // Check if platform supports direct posting
    if (!service.supportDirectPosting) {
      this.log('warn', 'Platform does not support direct posting', {
        platform,
        responseId: response.id
      });

      throw this.createPermanentError('Platform does not support direct posting', {
        platform
      });
    }

    try {
      this.log('info', 'Publishing to platform', {
        platform,
        responseId: response.id,
        textLength: responseText.length,
        attempt
      });

      // Call platform service's postResponse method with platform-specific arguments
      // Each platform has its own signature - we adapt here
      const publishResponse = await this.callPlatformPostResponse(service, platform, {
        response,
        comment,
        responseText
      });

      if (!publishResponse.success) {
        throw new Error(publishResponse.error || 'Platform API returned success: false');
      }

      return {
        success: true,
        postId: publishResponse.responseId || publishResponse.id || publishResponse.postId,
        publishedAt: new Date().toISOString()
      };
    } catch (error) {
      // Enhance error with platform context
      error.platform = platform;
      error.responseId = response.id;
      throw error;
    }
  }

  /**
   * Call platform postResponse with platform-specific arguments
   * Adapter pattern to handle different platform service signatures
   */
  async callPlatformPostResponse(service, platform, { response, comment, responseText }) {
    const platformLower = platform.toLowerCase();

    // Platform-specific argument mapping
    switch (platformLower) {
      case 'discord':
        // Discord: postResponse(originalMessage, responseText)
        // originalMessage needs id and channelId at minimum
        if (!comment.metadata?.channelId) {
          throw this.createPermanentError('Missing required Discord metadata: channelId', {
            commentId: comment.platform_comment_id,
            platform: platformLower
          });
        }
        return await service.postResponse(
          {
            id: comment.platform_comment_id,
            channelId: comment.metadata.channelId,
            content: comment.original_text || ''
          },
          responseText
        );

      case 'youtube':
        // YouTube: postResponse(commentId, responseText)
        return await service.postResponse(comment.platform_comment_id, responseText);

      case 'facebook':
      case 'instagram':
        // Facebook/Instagram: postResponse(postId, commentId, responseText)
        // Validate that postId is semantically correct (not parentId if it represents different entity)
        const postId = comment.metadata?.postId;
        if (!postId && comment.metadata?.parentId) {
          // Only use parentId if it's confirmed to be a post ID, not a comment ID
          this.log('warn', 'Using parentId as postId - verify semantic correctness', {
            platform: platformLower,
            commentId: comment.platform_comment_id,
            parentId: comment.metadata.parentId
          });
        }
        if (!postId && !comment.metadata?.parentId) {
          throw this.createPermanentError('Missing required Facebook/Instagram metadata: postId', {
            commentId: comment.platform_comment_id,
            platform: platformLower
          });
        }
        return await service.postResponse(
          postId || comment.metadata?.parentId,
          comment.platform_comment_id,
          responseText
        );

      case 'twitter':
        // Twitter: postResponse(tweetId, responseText, userId)
        return await service.postResponse(
          comment.platform_comment_id,
          responseText,
          comment.platform_user_id
        );

      case 'reddit':
        // Reddit: postResponse(subreddit, commentId, responseText)
        if (!comment.metadata?.subreddit) {
          throw this.createPermanentError('Missing required Reddit metadata: subreddit', {
            commentId: comment.platform_comment_id,
            platform: platformLower
          });
        }
        return await service.postResponse(
          comment.metadata.subreddit,
          comment.platform_comment_id,
          responseText
        );

      case 'twitch':
        // Twitch: postResponse(channelId, commentId, responseText)
        return await service.postResponse(
          comment.metadata?.channelId || comment.metadata?.parentId,
          comment.platform_comment_id,
          responseText
        );

      case 'tiktok':
        // TikTok: postResponse(videoId, commentId, responseText)
        return await service.postResponse(
          comment.metadata?.videoId || comment.metadata?.parentId,
          comment.platform_comment_id,
          responseText
        );

      case 'bluesky':
        // Bluesky: postResponse(uri, responseText)
        return await service.postResponse(
          comment.metadata?.uri || comment.platform_comment_id,
          responseText
        );

      default:
        // Fallback: Try generic object signature (backwards compatibility)
        this.log('warn', 'Using generic object signature for unknown platform', {
          platform: platformLower
        });
        return await service.postResponse({
          text: responseText,
          parentId: comment.platform_comment_id,
          responseId: response.id
        });
    }
  }

  /**
   * Update response record with publication details
   * Uses atomic update to prevent race conditions (TOCTOU)
   * Only updates if platform_response_id is still null
   */
  async updateResponseRecord(responseId, platformResponseId) {
    const postedAt = new Date().toISOString();

    // Atomic update: only update if platform_response_id is still null
    // This prevents race conditions when multiple jobs process the same response concurrently
    const { data, error } = await this.supabase
      .from('responses')
      .update({
        platform_response_id: platformResponseId,
        posted_at: postedAt,
        post_status: 'posted'
      })
      .eq('id', responseId)
      .is('platform_response_id', null) // Only update if still null (atomic check-and-set)
      .select();

    if (error) {
      this.log('error', 'Failed to update response record', {
        responseId,
        platformResponseId,
        error: error.message
      });
      throw error;
    }

    if (!data || data.length === 0) {
      // Check if already published (race condition avoided)
      const existing = await this.fetchResponse(responseId, null);
      if (existing?.platform_response_id) {
        this.log('info', 'Response already published (race condition avoided)', {
          responseId,
          existingPostId: existing.platform_response_id
        });
        return existing;
      }
      throw new Error(`Failed to update response ${responseId}: no rows affected`);
    }

    this.log('info', 'Response record updated with publication details', {
      responseId,
      platformResponseId,
      postedAt
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
      const isTimeout =
        error.message?.includes('timeout') ||
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
