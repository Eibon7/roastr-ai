const { createClient } = require('@supabase/supabase-js');
const { logger } = require('./../../utils/logger'); // Issue #971: Added for console.log replacement
const QueueService = require('../../services/queueService');
const CostControlService = require('../../services/costControl');

/**
 * Multi-Tenant Integration Base Class
 * 
 * Enhanced base class for all social media platform integrations in the multi-tenant architecture.
 * Provides common functionality including:
 * - Multi-tenant database operations
 * - Queue management for processing workflows
 * - Cost control and usage tracking
 * - Error handling and logging
 * - Rate limiting and retry logic
 * - Platform-specific configuration management
 */
class MultiTenantIntegration {
  constructor(platformName, options = {}) {
    this.platformName = platformName;
    this.enabled = process.env[`ENABLED_${platformName.toUpperCase()}`] === 'true';
    
    // Configuration
    this.config = {
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 5000,
      rateLimit: options.rateLimit || 100, // requests per hour
      batchSize: options.batchSize || 10,
      supportDirectPosting: options.supportDirectPosting !== false, // Default true
      supportModeration: options.supportModeration !== false, // Default true
      ...options
    };
    
    // Initialize connections
    this.initializeConnections();
    
    // Rate limiting
    this.rateLimitTokens = this.config.rateLimit;
    this.rateLimitReset = Date.now() + 3600000; // 1 hour
    
    // Error tracking
    this.errorCount = 0;
    this.lastError = null;
    this.lastSuccessful = null;
    
    // Metrics
    this.metrics = {
      commentsProcessed: 0,
      responsesGenerated: 0,
      responsesPosted: 0,
      moderationActionsPerformed: 0,
      errorsEncountered: 0,
      lastActivity: null
    };
  }
  
  /**
   * Initialize database, queue, and cost control connections
   */
  initializeConnections() {
    // Supabase connection
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (this.supabaseUrl && this.supabaseKey) {
      this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
    }
    
    // Queue service
    this.queueService = new QueueService();
    
    // Cost control service
    this.costControl = new CostControlService();
  }
  
  /**
   * Initialize the integration
   */
  async initialize() {
    if (!this.enabled) {
      this.log('info', `Integration ${this.platformName} is disabled`);
      return;
    }
    
    this.log('info', `Initializing ${this.platformName} integration`);
    
    try {
      // Initialize queue service
      if (this.queueService) {
        await this.queueService.initialize();
      }
      
      // Validate configuration
      if (!this.validateConfiguration()) {
        throw new Error(`${this.platformName} integration is not properly configured`);
      }
      
      // Platform-specific setup
      await this.setupPlatformSpecific();
      
      this.log('info', `${this.platformName} integration initialized successfully`);
      this.lastSuccessful = new Date().toISOString();
      
    } catch (error) {
      this.log('error', `Failed to initialize ${this.platformName} integration`, { error: error.message });
      this.errorCount++;
      this.lastError = error;
      throw error;
    }
  }
  
  // ============================================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ============================================================================
  
  /**
   * Platform-specific setup (to be implemented by subclasses)
   */
  async setupPlatformSpecific() {
    throw new Error(`setupPlatformSpecific must be implemented by ${this.platformName} integration`);
  }
  
  /**
   * Fetch comments/mentions from the platform
   * Must be implemented by subclasses
   */
  async fetchComments(params = {}) {
    throw new Error(`fetchComments must be implemented by ${this.platformName} integration`);
  }
  
  /**
   * Post response to the platform (if supported)
   * Must be implemented by subclasses that support direct posting
   */
  async postResponse(commentId, responseText, options = {}) {
    if (!this.config.supportDirectPosting) {
      throw new Error(`${this.platformName} does not support direct posting`);
    }
    throw new Error(`postResponse must be implemented by ${this.platformName} integration`);
  }
  
  /**
   * Perform moderation action (if supported)
   * Must be implemented by subclasses that support moderation
   */
  async performModerationAction(action, targetId, options = {}) {
    if (!this.config.supportModeration) {
      throw new Error(`${this.platformName} does not support moderation actions`);
    }
    throw new Error(`performModerationAction must be implemented by ${this.platformName} integration`);
  }
  
  /**
   * Validate platform-specific configuration
   * Should be overridden by subclasses
   */
  validateConfiguration() {
    // Basic validation - check if enabled
    return this.enabled;
  }
  
  // ============================================================================
  // MULTI-TENANT OPERATIONS
  // ============================================================================
  
  /**
   * Process comments for an organization
   */
  async processCommentsForOrganization(organizationId, params = {}) {
    this.log('info', 'Starting comment processing', { organizationId, params });
    
    try {
      // Check if organization can perform operations (cost control)
      const costCheck = await this.costControl.canPerformOperation(organizationId, 'fetch_comments');
      if (!costCheck.allowed) {
        throw new Error(`Operation not allowed: ${costCheck.reason}`);
      }
      
      // Fetch comments from platform
      const comments = await this.fetchComments(params);
      
      let processed = 0;
      let queued = 0;
      
      for (const comment of comments.comments || []) {
        try {
          // Normalize comment data
          const normalizedComment = this.normalizeComment(comment);
          
          // Store comment in database
          await this.storeComment(normalizedComment, organizationId);
          processed++;
          
          // Queue for toxicity analysis
          await this.queueForAnalysis(normalizedComment, organizationId);
          queued++;
          
          // Record usage
          await this.costControl.recordUsage(
            organizationId,
            this.platformName,
            'fetch_comment'
          );
          
        } catch (error) {
          this.log('error', 'Failed to process individual comment', {
            error: error.message,
            commentId: comment.id
          });
          this.errorCount++;
        }
      }
      
      this.metrics.commentsProcessed += processed;
      this.metrics.lastActivity = new Date().toISOString();
      
      this.log('info', 'Comment processing completed', {
        organizationId,
        processed,
        queued,
        hasMore: comments.hasMore || false
      });
      
      return {
        success: true,
        processed,
        queued,
        hasMore: comments.hasMore || false,
        nextToken: comments.nextToken
      };
      
    } catch (error) {
      this.log('error', 'Comment processing failed', {
        organizationId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Store comment in database with multi-tenant support
   */
  async storeComment(comment, organizationId) {
    if (!this.supabase) {
      throw new Error('Database not available');
    }
    
    // Check if comment already exists
    const { data: existingComment } = await this.supabase
      .from('comments')
      .select('id')
      .eq('id', comment.id)
      .eq('organization_id', organizationId)
      .single();
    
    if (existingComment) {
      return { stored: false, duplicate: true };
    }
    
    const commentData = {
      id: comment.id,
      organization_id: organizationId,
      platform: this.platformName,
      text: comment.text,
      author_id: comment.author_id,
      author_name: comment.author_name,
      created_at: comment.created_at,
      platform_data: comment.platform_data || {},
      metrics: comment.metrics || {},
      parent_comment_id: comment.parent_comment_id,
      thread_id: comment.thread_id,
      language: comment.language,
      extracted_at: new Date().toISOString()
    };
    
    const { data, error } = await this.supabase
      .from('comments')
      .insert(commentData)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to store comment: ${error.message}`);
    }
    
    return { stored: true, data };
  }
  
  /**
   * Queue comment for toxicity analysis
   */
  async queueForAnalysis(comment, organizationId, priority = 3) {
    if (!this.queueService) {
      throw new Error('Queue service not available');
    }
    
    const jobData = {
      organization_id: organizationId,
      platform: this.platformName,
      comment_id: comment.id,
      text: comment.text,
      author_id: comment.author_id,
      metadata: {
        platform_data: comment.platform_data,
        metrics: comment.metrics,
        language: comment.language
      }
    };
    
    return await this.queueService.addJob('analyze_toxicity', jobData, priority);
  }
  
  /**
   * Queue response generation after toxicity analysis
   */
  async queueResponseGeneration(comment, organizationId, toxicityData, priority = 4) {
    if (!this.queueService) {
      throw new Error('Queue service not available');
    }
    
    const jobData = {
      organization_id: organizationId,
      platform: this.platformName,
      comment_id: comment.id,
      text: comment.text,
      author_id: comment.author_id,
      toxicity_score: toxicityData.toxicity_score,
      toxicity_categories: toxicityData.toxicity_categories,
      metadata: {
        platform_data: comment.platform_data,
        analysis_method: toxicityData.analysis_method,
        can_post_directly: this.config.supportDirectPosting
      }
    };
    
    return await this.queueService.addJob('generate_reply', jobData, priority);
  }
  
  /**
   * Queue response posting (if platform supports it)
   */
  async queueResponsePost(roastId, commentId, organizationId, priority = 4) {
    if (!this.config.supportDirectPosting) {
      this.log('info', 'Platform does not support direct posting, storing for manual review', {
        roastId,
        commentId,
        platform: this.platformName
      });
      return { success: true, manual_review: true };
    }
    
    if (!this.queueService) {
      throw new Error('Queue service not available');
    }
    
    const jobData = {
      organization_id: organizationId,
      platform: this.platformName,
      roast_id: roastId,
      reply_to_comment_id: commentId,
      metadata: {
        can_post_directly: true
      }
    };
    
    return await this.queueService.addJob('post_response', jobData, priority);
  }
  
  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  /**
   * Rate limiting check
   */
  async checkRateLimit() {
    const now = Date.now();
    
    // Reset tokens if hour has passed
    if (now >= this.rateLimitReset) {
      this.rateLimitTokens = this.config.rateLimit;
      this.rateLimitReset = now + 3600000;
    }
    
    if (this.rateLimitTokens <= 0) {
      const waitTime = this.rateLimitReset - now;
      throw new Error(`Rate limit exceeded for ${this.platformName}. Try again in ${Math.ceil(waitTime/60000)} minutes`);
    }
    
    this.rateLimitTokens--;
  }
  
  /**
   * Handle errors with retry logic
   */
  async withRetry(operation, retries = null) {
    const maxRetries = retries || this.config.maxRetries;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        this.errorCount++;
        this.lastError = error;
        
        if (attempt === maxRetries) {
          this.log('error', `Operation failed after ${maxRetries} attempts`, {
            error: error.message,
            attempt
          });
          break;
        }
        
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        this.log('warn', `Operation failed, retrying in ${delay}ms`, {
          error: error.message,
          attempt,
          nextAttemptIn: delay
        });
        
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }
  
  /**
   * Normalize comment data to standard format
   */
  normalizeComment(rawComment) {
    return {
      id: rawComment.id || rawComment.comment_id,
      text: rawComment.text || rawComment.content || rawComment.message || '',
      author_id: rawComment.author_id || rawComment.user_id || rawComment.from?.id || rawComment.user?.id,
      author_name: rawComment.author_name || rawComment.username || rawComment.from?.name || rawComment.user?.name,
      created_at: rawComment.created_at || rawComment.timestamp || rawComment.created_time || new Date().toISOString(),
      platform_data: rawComment,
      metrics: rawComment.metrics || this.extractMetrics(rawComment),
      parent_comment_id: rawComment.parent_id || rawComment.reply_to_id || rawComment.in_reply_to,
      thread_id: rawComment.thread_id || rawComment.conversation_id || rawComment.post_id,
      language: rawComment.language || rawComment.lang || 'unknown'
    };
  }
  
  /**
   * Extract metrics from raw comment data
   */
  extractMetrics(rawComment) {
    return {
      likes: rawComment.likes || rawComment.like_count || rawComment.reactions?.like || 0,
      replies: rawComment.replies || rawComment.reply_count || rawComment.responses || 0,
      shares: rawComment.shares || rawComment.share_count || rawComment.retweets || 0,
      views: rawComment.views || rawComment.view_count || 0
    };
  }
  
  /**
   * Get integration statistics for an organization
   */
  async getStatistics(organizationId, days = 30) {
    if (!this.supabase) {
      return null;
    }
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    try {
      const { data: comments, error: commentsError } = await this.supabase
        .from('comments')
        .select('id, created_at, toxicity_score, language')
        .eq('organization_id', organizationId)
        .eq('platform', this.platformName)
        .gte('created_at', startDate.toISOString());
      
      if (commentsError) {
        throw new Error(`Failed to get comments stats: ${commentsError.message}`);
      }
      
      const { data: roasts, error: roastsError } = await this.supabase
        .from('roasts')
        .select('id, created_at, tokens_used, cost_cents, posted_at')
        .eq('organization_id', organizationId)
        .eq('platform', this.platformName)
        .gte('created_at', startDate.toISOString());
      
      if (roastsError) {
        throw new Error(`Failed to get roasts stats: ${roastsError.message}`);
      }
      
      // Language distribution
      const languages = {};
      comments.forEach(comment => {
        const lang = comment.language || 'unknown';
        languages[lang] = (languages[lang] || 0) + 1;
      });
      
      return {
        platform: this.platformName,
        organization_id: organizationId,
        period_days: days,
        statistics: {
          comments_processed: comments.length,
          toxic_comments: comments.filter(c => c.toxicity_score > 0.7).length,
          roasts_generated: roasts.length,
          roasts_posted: roasts.filter(r => r.posted_at).length,
          pending_manual_review: roasts.filter(r => !r.posted_at && !this.config.supportDirectPosting).length,
          total_tokens_used: roasts.reduce((sum, r) => sum + (r.tokens_used || 0), 0),
          total_cost_cents: roasts.reduce((sum, r) => sum + (r.cost_cents || 0), 0),
          avg_toxicity: comments.length > 0 
            ? comments.reduce((sum, c) => sum + (c.toxicity_score || 0), 0) / comments.length 
            : 0,
          language_distribution: languages
        },
        platform_features: {
          supports_direct_posting: this.config.supportDirectPosting,
          supports_moderation: this.config.supportModeration
        }
      };
      
    } catch (error) {
      this.log('error', 'Failed to get statistics', { 
        organizationId, 
        error: error.message 
      });
      return null;
    }
  }
  
  /**
   * Health check
   */
  async healthCheck() {
    const health = {
      platform: this.platformName,
      enabled: this.enabled,
      configured: this.validateConfiguration(),
      features: {
        direct_posting: this.config.supportDirectPosting,
        moderation: this.config.supportModeration
      },
      rate_limit_remaining: this.rateLimitTokens,
      error_count: this.errorCount,
      last_error: this.lastError?.message,
      last_successful: this.lastSuccessful,
      metrics: this.metrics,
      status: 'healthy'
    };
    
    if (this.errorCount > 10) {
      health.status = 'degraded';
    }
    
    if (!this.validateConfiguration()) {
      health.status = 'misconfigured';
    }
    
    if (this.lastError && (!this.lastSuccessful || this.lastError.timestamp > this.lastSuccessful)) {
      health.status = 'error';
    }
    
    return health;
  }
  
  /**
   * Logging utility
   */
  log(level, message, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      platform: this.platformName,
      message,
      ...metadata
    };
    
    logger.info(`[${level.toUpperCase()}] [${this.platformName.toUpperCase()}] ${JSON.stringify(logEntry)}`);
  }
  
  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Graceful shutdown
   */
  async shutdown() {
    this.log('info', `Shutting down ${this.platformName} integration`);
    
    if (this.queueService) {
      await this.queueService.shutdown();
    }
    
    this.log('info', `${this.platformName} integration shut down complete`);
  }
}

module.exports = MultiTenantIntegration;