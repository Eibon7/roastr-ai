const BaseWorker = require('./BaseWorker');
const CostControlService = require('../services/costControl');
const advancedLogger = require('../utils/advancedLogger');

/**
 * Fetch Comments Worker
 * 
 * Responsible for fetching comments from various platforms:
 * - Twitter mentions and replies
 * - YouTube video comments
 * - Instagram post comments
 * - Discord server messages
 * - Other social media platforms
 * 
 * This worker operates at high frequency and handles platform-specific
 * API calls while respecting rate limits and cost controls.
 */
class FetchCommentsWorker extends BaseWorker {
  constructor(options = {}) {
    super('fetch_comments', {
      maxConcurrency: 5, // Higher concurrency for fetch operations
      pollInterval: 2000, // Fast polling for real-time responses
      maxRetries: 2, // Quick fail for fetch operations
      ...options
    });
    
    this.costControl = new CostControlService();
    this.platformClients = new Map();
    this.platformServices = new Map();
    this._integrationConfigOverride = null;
    
    // Initialize platform clients
    this.initializePlatformClients();
  }
  
  /**
   * Get worker-specific health details
   */
  async getSpecificHealthDetails() {
    const details = {
      platformClients: {},
      rateLimits: {},
      lastFetchCounts: {}
    };
    
    // Check each platform client status
    for (const [platform, client] of this.platformClients.entries()) {
      details.platformClients[platform] = {
        initialized: !!client,
        status: client ? 'available' : 'not configured'
      };
      
      // Add rate limit info if available
      if (this.rateLimitInfo && this.rateLimitInfo[platform]) {
        details.rateLimits[platform] = this.rateLimitInfo[platform];
      }
      
      // Add last fetch counts if available
      if (this.lastFetchCounts && this.lastFetchCounts[platform]) {
        details.lastFetchCounts[platform] = this.lastFetchCounts[platform];
      }
    }
    
    // Add cost control status
    details.costControl = {
      enabled: !!this.costControl,
      lastCheck: this.lastCostCheckTime || null
    };
    
    return details;
  }
  
  /**
   * Initialize clients for different platforms
   */
  initializePlatformClients() {
    // Twitter client
    if (process.env.TWITTER_BEARER_TOKEN) {
      const { TwitterApi } = require('twitter-api-v2');
      this.platformClients.set('twitter', new TwitterApi(process.env.TWITTER_BEARER_TOKEN, {
        appKey: process.env.TWITTER_APP_KEY,
        appSecret: process.env.TWITTER_APP_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET
      }));
    }
    
    // YouTube client
    if (process.env.YOUTUBE_API_KEY) {
      const { google } = require('googleapis');
      const youtube = google.youtube({
        version: 'v3',
        auth: process.env.YOUTUBE_API_KEY
      });
      this.platformClients.set('youtube', youtube);
    }
    
    // Bluesky client
    if (process.env.BLUESKY_HANDLE && process.env.BLUESKY_PASSWORD) {
      // Note: Bluesky client would be initialized here
      // const BlueskyClient = require('@bluesky/api');
      // this.platformClients.set('bluesky', new BlueskyClient(...));
      this.log('info', 'Bluesky client configuration detected (implementation pending)');
    }
    
    // Instagram client
    if (process.env.INSTAGRAM_ACCESS_TOKEN) {
      // Note: Instagram Basic Display API client
      this.log('info', 'Instagram client configuration detected (implementation pending)');
    }
  }
  
  /**
   * Internal process fetch job (called by retry wrapper)
   */
  async _processJobInternal(job) {
    // Extract correlation ID for observability (Issue #417)
    const correlationId = (job.payload && job.payload.correlationId) || null;

    // Extract organization/platform info - support multiple structures for backwards compatibility:
    // 1. At job root level (job.organization_id)
    // 2. In job.payload (job.payload.organization_id)
    const organization_id = job.organization_id || (job.payload && job.payload.organization_id);
    const platform = job.platform || (job.payload && job.payload.platform);
    const integration_config_id = job.integration_config_id || (job.payload && job.payload.integration_config_id);

    // Log job start with correlation context (Issue #417)
    advancedLogger.logJobLifecycle(this.workerName, job.id, 'started', {
      correlationId,
      tenantId: organization_id,
      platform,
      integrationConfigId: integration_config_id
    });

    // Extract platform-specific payload
    // Support multiple structures:
    // 1. job.payload.payload (nested) - for tests that wrap platform data
    // 2. job.payload - for platform-specific data directly
    // 3. job itself - for tests that put everything at root level
    let platformPayload;
    if (job.payload && job.payload.payload) {
      platformPayload = job.payload.payload;  // Nested structure
    } else if (job.payload && (job.payload.video_ids || job.payload.since_id || job.payload.test_case || job.payload.scenario || job.payload.comment_data)) {
      platformPayload = job.payload;  // Direct payload structure
    } else if (job.video_ids || job.since_id || job.test_case || job.scenario || job.comment_data) {
      platformPayload = job;  // Root level structure (legacy tests)
    } else {
      platformPayload = job.payload || job;  // Default fallback
    }

    // Check cost control limits with enhanced tracking
    const canProcess = await this.costControl.canPerformOperation(
      organization_id,
      'fetch_comment',
      1, // quantity
      platform
    );

    if (!canProcess.allowed) {
      throw new Error(`Organization ${organization_id} has reached limits: ${canProcess.reason}`);
    }

    // Get integration configuration
    const integrationConfig = await this.getIntegrationConfig(
      organization_id,
      platform,
      integration_config_id
    );

    if (!integrationConfig || !integrationConfig.enabled) {
      throw new Error(`Integration ${platform} is not enabled for organization ${organization_id}`);
    }

    // Fetch comments based on platform (pass platform-specific payload)
    const fetchResult = await this.fetchCommentsFromPlatform(
      platform,
      integrationConfig,
      platformPayload
    );

    const commentsArray = Array.isArray(fetchResult)
      ? fetchResult
      : Array.isArray(fetchResult?.comments)
        ? fetchResult.comments
        : [];
    const metadata = typeof fetchResult === 'object' && !Array.isArray(fetchResult)
      ? fetchResult
      : {};
    
    // Process and store comments
    const storedComments = await this.storeComments(
      organization_id,
      integration_config_id,
      platform,
      commentsArray
    );
    
    // Record usage with enhanced tracking
    await this.costControl.recordUsage(
      organization_id,
      platform,
      'fetch_comment',
      {
        commentsCount: storedComments.length,
        jobId: job.id,
        integrationConfigId: integration_config_id,
        fetchTime: Date.now(),
        rateLimitInfo: this.rateLimitInfo?.[platform] || {}
      },
      null, // userId - not applicable for comment fetching
      storedComments.length // quantity - number of comments fetched
    );
    
    // Queue analysis jobs for new comments
    await this.queueAnalysisJobs(organization_id, storedComments, correlationId);

    const duplicates = commentsArray.length - storedComments.length;
    const newCommentsCount = storedComments.length;

    const result = {
      success: true,
      summary: `Fetched ${newCommentsCount} new comments from ${platform}`,
      commentsCount: newCommentsCount,
      newComments: newCommentsCount,
      duplicates: duplicates < 0 ? 0 : duplicates,
      queuedForAnalysis: newCommentsCount,
      hasMore: metadata.hasMore ?? metadata.has_more ?? false,
      nextToken: metadata.nextToken ?? metadata.nextPageToken ?? metadata.token ?? null,
      platform,
      organizationId: organization_id
    };

    // Log job completion with correlation context (Issue #417)
    advancedLogger.logJobLifecycle(this.workerName, job.id, 'completed', {
      correlationId,
      tenantId: organization_id,
      platform,
      commentsCount: storedComments.length
    }, result);

    return result;
  }
  
  /**
   * Get integration configuration from database
   */
  async getIntegrationConfig(organizationId, platform, configId) {
    if (this._integrationConfigOverride) {
      return this._integrationConfigOverride;
    }

    try {
    const { data: config, error } = await this.supabase
      .from('integration_configs')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('platform', platform)
      .eq('id', configId)
      .single();
      
      if (error) throw error;
      return config;
      
    } catch (error) {
      this.log('error', 'Failed to get integration config', {
        organizationId,
        platform,
        configId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Fetch comments from specific platform
   */
  async fetchCommentsFromPlatform(platform, config, payload) {
    const platformService = this.platformServices.get(platform);
    if (platformService && typeof platformService.fetchComments === 'function') {
      return platformService.fetchComments(this._buildServicePayload(platform, config, payload));
    }

    const platformClient = this.platformClients.get(platform);
    
    if (!platformClient) {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    
    switch (platform) {
      case 'twitter':
        return await this.fetchTwitterComments(platformClient, config, payload);
      case 'youtube':
        return await this.fetchYouTubeComments(platformClient, config, payload);
      case 'bluesky':
        return await this.fetchBlueskyComments(platformClient, config, payload);
      case 'instagram':
        return await this.fetchInstagramComments(platformClient, config, payload);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }
  
  /**
   * Fetch Twitter mentions and replies
   */
  async fetchTwitterComments(client, config, payload) {
    try {
      const mentions = await client.v2.userMentionTimeline('me', {
        max_results: 50,
        'tweet.fields': ['created_at', 'author_id', 'public_metrics', 'context_annotations'],
        'user.fields': ['username', 'name', 'verified'],
        expansions: ['author_id'],
        since_id: payload.since_id
      });
      
      const comments = [];
      
      for (const tweet of mentions.data?.data || []) {
        comments.push({
          platform: 'twitter',
          platform_comment_id: tweet.id,
          platform_user_id: tweet.author_id,
          platform_username: mentions.includes?.users?.find(u => u.id === tweet.author_id)?.username,
          original_text: tweet.text,
          metadata: {
            created_at: tweet.created_at,
            public_metrics: tweet.public_metrics,
            context_annotations: tweet.context_annotations
          }
        });
      }
      
      return comments;
      
    } catch (error) {
      this.log('error', 'Failed to fetch Twitter comments', { error: error.message });
      throw new Error(`Twitter API error: ${error.message}`);
    }
  }
  
  /**
   * Fetch YouTube video comments
   */
  async fetchYouTubeComments(client, config, payload) {
    try {
      const videoIds = payload.video_ids || config.config.monitored_videos || [];
      const comments = [];
      
      for (const videoId of videoIds) {
        try {
          const response = await client.commentThreads.list({
            part: ['snippet', 'replies'],
            videoId: videoId,
            maxResults: 20,
            order: 'time'
          });
          
          for (const thread of response.data.items || []) {
            const comment = thread.snippet.topLevelComment.snippet;
            
            comments.push({
              platform: 'youtube',
              platform_comment_id: thread.id,
              platform_user_id: comment.authorChannelId?.value,
              platform_username: comment.authorDisplayName,
              original_text: comment.textDisplay,
              metadata: {
                videoId: videoId,
                publishedAt: comment.publishedAt,
                likeCount: comment.likeCount,
                canReply: comment.canReply
              }
            });
          }
          
        } catch (videoError) {
          this.log('warn', 'Failed to fetch comments for video', {
            videoId,
            error: videoError.message
          });
        }
      }
      
      return comments;
      
    } catch (error) {
      this.log('error', 'Failed to fetch YouTube comments', { error: error.message });
      throw new Error(`YouTube API error: ${error.message}`);
    }
  }
  
  /**
   * Fetch Bluesky posts and replies
   */
  async fetchBlueskyComments(client, config, payload) {
    this.log('info', 'Bluesky comment fetching not yet implemented');
    return [];
  }

  /**
   * Fetch Instagram post comments
   */
  async fetchInstagramComments(client, config, payload) {
    this.log('info', 'Instagram comment fetching not yet implemented');
    return [];
  }
  
  /**
   * Store comments in database
   */
  async storeComments(organizationId, integrationConfigId, platform, comments) {
    if (!comments.length) return [];

    const storedComments = [];

    for (const comment of comments) {
      try {
        // Check if comment already exists
        const { data: existing } = await this.supabase
          .from('comments')
          .select('id')
          .eq('platform_comment_id', comment.platform_comment_id)
          .single();

        if (existing && existing.id) {
          continue; // Skip duplicate
        }

        // Insert new comment
        const insertQuery = await this.supabase
          .from('comments')
          .insert({
            organization_id: organizationId,
            integration_config_id: integrationConfigId,
            platform: comment.platform,
            platform_comment_id: comment.platform_comment_id,
            platform_user_id: comment.platform_user_id,
            platform_username: comment.platform_username,
            original_text: comment.original_text,
            metadata: comment.metadata,
            status: 'pending'
          });

        let stored;
        let insertError;

        if (insertQuery && typeof insertQuery.select === 'function') {
          const selectResult = await insertQuery.select().single();
          stored = selectResult.data;
          insertError = selectResult.error;
        } else {
          stored = insertQuery?.data;
          insertError = insertQuery?.error;
        }

        if (insertError) {
          this.log('warn', 'Failed to store comment', {
            commentId: comment.platform_comment_id,
            error: insertError.message || insertError
          });
          continue;
        }

        storedComments.push(stored || comment);
        
      } catch (error) {
        this.log('warn', 'Error processing comment', {
          commentId: comment.platform_comment_id,
          error: error.message
        });
      }
    }
    
    return storedComments;
  }
  
  /**
   * Queue analysis jobs for new comments
   */
  async queueAnalysisJobs(organizationId, comments, correlationId) {
    const analysisJobs = comments.map(comment => ({
      organization_id: organizationId,
      job_type: 'analyze_toxicity',
      priority: 5, // Normal priority for analysis
      payload: {
        comment_id: comment.id,
        organization_id: organizationId,
        platform: comment.platform,
        text: comment.original_text,
        correlationId // Propagate correlation ID (Issue #417)
      },
      max_attempts: 3
    }));
    
    if (analysisJobs.length === 0) return;
    
    try {
      if (this.redis) {
        // Use Redis queue for better performance
        const pipeline = this.redis.pipeline();
        
        for (const job of analysisJobs) {
          pipeline.rpush('roastr:jobs:analyze_toxicity', JSON.stringify(job));
        }
        
        await pipeline.exec();
        
      } else if (this.queueService && typeof this.queueService.addJob === 'function') {
        await Promise.all(
          analysisJobs.map(job =>
            this.queueService.addJob(job.job_type, job.payload, job.priority)
          )
        );
      } else {
        // Use database queue as fallback
        const { error } = await this.supabase
          .from('job_queue')
          .insert(analysisJobs);
        
        if (error) throw error;
      }
      
      this.log('info', 'Queued analysis jobs', {
        count: analysisJobs.length,
        organizationId
      });
      
    } catch (error) {
      this.log('error', 'Failed to queue analysis jobs', {
        count: analysisJobs.length,
        error: error.message
      });
    }
  }

  /**
   * Test helper: override integration config for deterministic tests
   */
  setIntegrationConfigOverride(config) {
    this._integrationConfigOverride = config;
  }

  /**
   * Store a single comment (compatibility helper for tests)
   */
  async storeComment(comment, job) {
    if (!comment || !job) {
      throw new Error('Missing comment or job metadata');
    }

    const organizationId = job.organization_id;
    const platform = job.platform;

    const { data: existing, error: selectError } = await this.supabase
      .from('comments')
      .select('id')
      .eq('platform_comment_id', comment.id)
      .single();

    if (selectError) {
      throw new Error(selectError.message || JSON.stringify(selectError));
    }

    if (existing) {
      return { stored: false, duplicate: true };
    }

    const { error: insertError } = await this.supabase
      .from('comments')
      .insert({
        organization_id: organizationId,
        platform,
        platform_comment_id: comment.id,
        platform_user_id: comment.author_id,
        original_text: comment.text,
        metadata: comment.metadata || {}
      });

    if (insertError) {
      throw insertError;
    }

    return { stored: true, duplicate: false };
  }

  /**
   * Queue a single comment for toxicity analysis (compatibility helper)
   */
  async queueForAnalysis(comment, job) {
    if (!comment || !job) {
      throw new Error('Missing comment or job metadata');
    }

    const payload = {
      organization_id: job.organization_id,
      platform: job.platform,
      comment_id: comment.id,
      text: comment.text,
      author_id: comment.author_id
    };

    return await this.queueService.addJob('analyze_toxicity', payload, 3);
  }

  /**
   * Initialize platform services that expose initialize()
   */
  async initializePlatformServices() {
    const services = Array.from(this.platformServices.values());
    for (const service of services) {
      if (service && typeof service.initialize === 'function') {
        await service.initialize();
      }
    }
  }

  /**
   * Normalize raw comment data for testing helpers
   */
  normalizeCommentData(comment, platform) {
    if (!comment) return null;

    if (platform === 'twitter') {
      return {
        id: comment.id,
        text: comment.text,
        author_id: comment.author_id,
        created_at: comment.created_at,
        metrics: {
          likes: comment.public_metrics?.like_count ?? 0,
          replies: comment.public_metrics?.reply_count ?? 0,
          retweets: comment.public_metrics?.retweet_count ?? 0
        },
        language: comment.lang ?? 'und'
      };
    }

    if (platform === 'youtube') {
      return {
        id: comment.id,
        text: comment.snippet?.textDisplay,
        author_id: comment.snippet?.authorChannelId?.value,
        created_at: comment.snippet?.publishedAt,
        metrics: {
          likes: comment.snippet?.likeCount ?? 0
        }
      };
    }

    return comment;
  }

  /**
   * Build a normalized payload for platform services
   */
  _buildServicePayload(platform, config, payload) {
    if (platform === 'twitter') {
      return {
        postId: payload.post_id,
        sinceId: payload.since_id,
        maxResults: payload.max_results
      };
    }

    if (platform === 'youtube') {
      return {
        videoId: payload.video_id,
        pageToken: payload.page_token
      };
    }

    return { ...(payload || {}) };
  }
}

module.exports = FetchCommentsWorker;