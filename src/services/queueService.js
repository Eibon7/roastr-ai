const { Redis } = require('@upstash/redis');
const { createClient } = require('@supabase/supabase-js');
const { mockMode } = require('../config/mockMode');
const { v4: uuidv4 } = require('uuid');
const advancedLogger = require('../utils/advancedLogger');

/**
 * Queue Service for Roastr.ai Multi-Tenant Architecture
 *
 * Provides unified queue management for Redis/Upstash and database fallback:
 * - High-performance Redis queues for production
 * - Database-based queues for development/fallback
 * - Priority queue management
 * - Dead letter queue handling
 * - Queue monitoring and statistics
 */
class QueueService {
  /**
   * UUID v4 regex for correlation ID validation (Issue #417)
   * Validates format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   * where x is any hex digit and y is one of [89ab]
   */
  static UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  /**
   * Validate correlation ID format (Issue #417)
   * @param {string|undefined} correlationId - Correlation ID to validate
   * @throws {Error} If correlation ID is invalid
   * @returns {boolean} True if valid or undefined (will be auto-generated)
   */
  static validateCorrelationId(correlationId) {
    // Allow undefined/null - will be auto-generated
    if (correlationId === undefined || correlationId === null || correlationId === '') {
      return true;
    }

    // Type check
    if (typeof correlationId !== 'string') {
      throw new Error(`Invalid correlation ID: must be a string, got ${typeof correlationId}`);
    }

    // Format check - must be UUID v4
    if (!QueueService.UUID_V4_REGEX.test(correlationId)) {
      throw new Error(
        `Invalid correlation ID format: expected UUID v4, got "${correlationId}". ` +
        `Valid format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
      );
    }

    return true;
  }

  constructor(options = {}) {
    this.options = {
      preferRedis: process.env.QUEUE_PREFER_REDIS !== 'false',
      redisUrl: process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL,
      redisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
      deadLetterQueueEnabled: process.env.QUEUE_DLQ_ENABLED !== 'false',
      maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES) || 3,
      retryDelay: parseInt(process.env.QUEUE_RETRY_DELAY) || 5000,
      ...options
    };
    
    this.redis = null;
    this.supabase = null;
    this.isRedisAvailable = false;
    
    // Queue name prefixes for organization
    this.queuePrefix = 'roastr:jobs';
    this.dlqPrefix = 'roastr:dlq';
    this.metricsPrefix = 'roastr:metrics';
    
    // Priority levels mapping
    this.priorityQueues = {
      1: 'critical',   // Shield critical actions
      2: 'high',       // Shield high-priority
      3: 'medium',     // Normal toxicity analysis
      4: 'normal',     // Standard processing
      5: 'low'         // Background tasks
    };
    
    this.initialize();
  }
  
  /**
   * Initialize Redis and database connections
   */
  async initialize() {
    try {
      // Initialize mock Supabase client in mock mode
      if (mockMode.isMockMode) {
        this.supabase = mockMode.generateMockSupabaseClient();
        this.isDatabaseAvailable = true;
        this.isRedisAvailable = false;
        this.log('info', 'Queue Service initialized in mock mode with mock Supabase client');
        return;
      }
      
      // Initialize Redis connection
      if (this.options.preferRedis && this.options.redisUrl) {
        await this.initializeRedis();
      }
      
      // Initialize Supabase connection for fallback
      await this.initializeDatabase();
      
      this.log('info', 'Queue Service initialized', {
        redisAvailable: this.isRedisAvailable,
        databaseAvailable: !!this.supabase,
        preferredMode: this.isRedisAvailable ? 'redis' : 'database'
      });
      
    } catch (error) {
      this.log('error', 'Failed to initialize Queue Service', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Initialize Redis connection (Upstash REST SDK)
   * Upstash SDK is stateless (HTTP-based), no persistent connection needed
   */
  async initializeRedis() {
    try {
      // Initialize Upstash Redis client (REST-based, stateless)
      if (this.options.redisUrl && this.options.redisToken) {
        this.redis = new Redis({
          url: this.options.redisUrl,
          token: this.options.redisToken
        });
      } else {
        throw new Error('Upstash Redis credentials not configured');
      }

      // Test connection with a simple ping
      await this.redis.ping();
      this.isRedisAvailable = true;

      this.log('info', 'Upstash Redis initialized successfully', {
        url: this.options.redisUrl
      });

    } catch (error) {
      this.log('warn', 'Redis initialization failed, using database fallback', {
        error: error.message
      });
      this.isRedisAvailable = false;
    }
  }
  
  /**
   * Initialize Supabase database connection
   */
  async initializeDatabase() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);

    // Test database connection
    try {
      const { error } = await this.supabase
        .from('job_queue')
        .select('id')
        .limit(1);

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found, which is OK
        // Safely extract error message from Supabase error object
        let errorMessage = 'Unknown database error';
        try {
          errorMessage = error.message || error.code || error.hint || 'Supabase connection error';
        } catch (e) {
          errorMessage = 'Error extracting Supabase error details';
        }
        throw new Error(`Database connection failed: ${errorMessage}`);
      }
    } catch (err) {
      // Handle any errors during connection test
      throw new Error(`Database connection failed: ${err.message || err}`);
    }
  }
  
  /**
   * Add job to queue with priority support
   * @returns {Promise<{success: boolean, jobId?: string, error?: string}>} Result with success flag and jobId
   */
  async addJob(jobType, payload, options = {}) {
    // Validate externally-provided correlation IDs (Issue #417)
    QueueService.validateCorrelationId(options.correlationId);
    QueueService.validateCorrelationId(payload.correlationId);

    // Generate or extract correlation ID for observability (Issue #417)
    const correlationId = options.correlationId || payload.correlationId || uuidv4();

    const job = {
      id: this.generateJobId(),
      job_type: jobType,
      organization_id: payload.organization_id,
      priority: options.priority || 5,
      payload: {
        ...payload,
        correlationId // Ensure correlation ID is in payload for worker access
      },
      max_attempts: options.maxAttempts || this.options.maxRetries,
      scheduled_at: options.delay ?
        new Date(Date.now() + options.delay).toISOString() :
        new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    try {
      let result;
      let queuedTo;

      if (this.isRedisAvailable) {
        result = await this.addJobToRedis(job, options);
        queuedTo = 'redis';
      } else {
        result = await this.addJobToDatabase(job);
        queuedTo = 'database';
      }

      // Log job enqueue with correlation context (Issue #417)
      advancedLogger.logJobLifecycle('QueueService', job.id, 'enqueued', {
        correlationId,
        tenantId: payload.organization_id,
        userId: payload.user_id,
        commentId: payload.comment_id,
        jobType,
        queuedTo,
        priority: job.priority
      });

      // Return consistent format with all fields
      return {
        success: true,
        jobId: job.id,
        job: result,
        queuedTo
      };

    } catch (error) {
      // Log error with correlation context (Issue #417)
      advancedLogger.logJobLifecycle('QueueService', job.id, 'failed', {
        correlationId,
        tenantId: payload.organization_id,
        userId: payload.user_id,
        commentId: payload.comment_id,
        jobType,
        error: error.message
      });

      // Try fallback if primary method fails
      try {
        let fallbackResult;
        let fallbackQueue;

        if (this.isRedisAvailable) {
          this.log('info', 'Trying database fallback for job addition');
          fallbackResult = await this.addJobToDatabase(job);
          fallbackQueue = 'database';
        } else if (this.redis) {
          this.log('info', 'Trying Redis fallback for job addition');
          fallbackResult = await this.addJobToRedis(job, options);
          fallbackQueue = 'redis';
        } else {
          // No fallback available
          return {
            success: false,
            error: error.message || 'Failed to add job to queue'
          };
        }

        // Fallback succeeded
        return {
          success: true,
          jobId: job.id,
          job: fallbackResult,
          queuedTo: fallbackQueue
        };
      } catch (fallbackError) {
        // Both primary and fallback failed
        return {
          success: false,
          error: fallbackError.message || error.message || 'Failed to add job to queue'
        };
      }
    }
  }
  
  /**
   * Add job to Redis queue with priority
   */
  async addJobToRedis(job, options = {}) {
    const queueKey = this.getQueueKey(job.job_type, job.priority);
    
    // Add job to priority queue
    await this.redis.lpush(queueKey, JSON.stringify(job));
    
    // Set expiration for scheduled jobs
    if (options.delay) {
      const delayKey = `${this.queuePrefix}:delayed:${job.id}`;
      await this.redis.setex(delayKey, Math.ceil(options.delay / 1000), JSON.stringify(job));
    }
    
    // Track metrics
    await this.incrementMetric('jobs_added', job.job_type);
    
    this.log('debug', 'Job added to Redis queue', {
      jobId: job.id,
      jobType: job.job_type,
      queueKey,
      priority: job.priority
    });
    
    return job;
  }
  
  /**
   * Add job to database queue
   */
  async addJobToDatabase(job) {
    const { data, error } = await this.supabase
      .from('job_queue')
      .insert([{
        id: job.id,
        organization_id: job.organization_id,
        job_type: job.job_type,
        priority: job.priority,
        payload: job.payload,
        max_attempts: job.max_attempts,
        scheduled_at: job.scheduled_at,
        status: 'pending'
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    this.log('debug', 'Job added to database queue', {
      jobId: job.id,
      jobType: job.job_type,
      priority: job.priority
    });
    
    return data;
  }
  
  /**
   * Get next job from queue
   */
  async getNextJob(jobType, options = {}) {
    try {
      if (this.isRedisAvailable) {
        return await this.getJobFromRedis(jobType, options);
      } else {
        return await this.getJobFromDatabase(jobType, options);
      }
      
    } catch (error) {
      this.log('error', 'Failed to get job from queue', {
        jobType,
        error: error.message
      });
      
      // Try fallback
      if (this.isRedisAvailable) {
        this.log('info', 'Trying database fallback for job retrieval');
        return await this.getJobFromDatabase(jobType, options);
      } else if (this.redis) {
        this.log('info', 'Trying Redis fallback for job retrieval');
        return await this.getJobFromRedis(jobType, options);
      }
      
      throw error;
    }
  }
  
  /**
   * Get job from Redis queue (priority-based)
   */
  async getJobFromRedis(jobType, options = {}) {
    const timeout = options.timeout || 1; // 1 second blocking timeout
    
    // Check priority queues in order (1=highest priority, 5=lowest)
    for (let priority = 1; priority <= 5; priority++) {
      const queueKey = this.getQueueKey(jobType, priority);
      
      try {
        // Non-blocking check for immediate jobs
        const jobData = await this.redis.rpop(queueKey);
        
        if (jobData) {
          const job = JSON.parse(jobData);
          
          // Check if job is scheduled for future
          if (job.scheduled_at && new Date(job.scheduled_at) > new Date()) {
            // Put it back and continue
            await this.redis.rpush(queueKey, jobData);
            continue;
          }
          
          await this.incrementMetric('jobs_processed', jobType);
          
          this.log('debug', 'Job retrieved from Redis queue', {
            jobId: job.id,
            jobType: job.job_type,
            priority
          });
          
          return job;
        }
      } catch (error) {
        this.log('warn', 'Error checking Redis queue priority', { priority, error: error.message });
      }
    }
    
    // No jobs found
    return null;
  }
  
  /**
   * Get job from database queue
   */
  async getJobFromDatabase(jobType, options = {}) {
    try {
      const { data: job, error } = await this.supabase
        .from('job_queue')
        .select('*')
        .eq('job_type', jobType)
        .eq('status', 'pending')
        .lte('scheduled_at', new Date().toISOString())
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') { // Not found is OK
        throw error;
      }
      
      if (job) {
        // Mark as processing
        const { error: updateError } = await this.supabase
          .from('job_queue')
          .update({
            status: 'processing',
            started_at: new Date().toISOString()
          })
          .eq('id', job.id);
        
        if (updateError) {
          this.log('warn', 'Failed to mark job as processing', { 
            jobId: job.id, 
            error: updateError.message 
          });
        }
        
        this.log('debug', 'Job retrieved from database queue', {
          jobId: job.id,
          jobType: job.job_type,
          priority: job.priority
        });
      }
      
      return job;
      
    } catch (error) {
      this.log('error', 'Failed to get job from database', { 
        jobType, 
        error: error.message 
      });
      return null;
    }
  }
  
  /**
   * Mark job as completed
   */
  async completeJob(job, result = {}) {
    try {
      if (this.isRedisAvailable && job.id) {
        await this.completeJobInRedis(job, result);
      }
      
      if (job.id && this.supabase) {
        await this.completeJobInDatabase(job, result);
      }
      
      await this.incrementMetric('jobs_completed', job.job_type);
      
    } catch (error) {
      this.log('error', 'Failed to mark job as completed', {
        jobId: job.id,
        error: error.message
      });
    }
  }
  
  /**
   * Complete job in Redis (add to completed set with TTL)
   */
  async completeJobInRedis(job, result) {
    const completedKey = `${this.queuePrefix}:completed:${job.job_type}`;
    const jobResult = {
      ...job,
      result,
      completed_at: new Date().toISOString()
    };
    
    // Store completed job with 24-hour TTL
    await this.redis.setex(
      `${completedKey}:${job.id}`,
      86400,
      JSON.stringify(jobResult)
    );
  }
  
  /**
   * Complete job in database
   */
  async completeJobInDatabase(job, result) {
    const { error } = await this.supabase
      .from('job_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result: result
      })
      .eq('id', job.id);
    
    if (error) {
      throw error;
    }
  }
  
  /**
   * Mark job as failed and handle retries
   */
  async failJob(job, error, options = {}) {
    const attempts = (job.attempts || 0) + 1;
    const maxAttempts = job.max_attempts || this.options.maxRetries;
    
    try {
      if (attempts >= maxAttempts) {
        // Move to dead letter queue
        if (this.options.deadLetterQueueEnabled) {
          await this.moveToDeadLetterQueue(job, error);
        }
        
        // Mark as permanently failed
        await this.markJobAsFailed(job, error);
        await this.incrementMetric('jobs_failed', job.job_type);
        
      } else {
        // Retry job
        await this.retryJob(job, attempts, error);
        await this.incrementMetric('jobs_retried', job.job_type);
      }
      
    } catch (failureError) {
      this.log('error', 'Failed to handle job failure', {
        jobId: job.id,
        error: failureError.message
      });
    }
  }
  
  /**
   * Retry failed job with exponential backoff
   */
  async retryJob(job, attempts, error) {
    const retryDelay = this.options.retryDelay * Math.pow(2, attempts - 1);
    const scheduledAt = new Date(Date.now() + retryDelay);
    
    const retryJob = {
      ...job,
      attempts,
      scheduled_at: scheduledAt.toISOString(),
      last_error: error.message
    };
    
    // Add back to queue with delay
    await this.addJob(job.job_type, retryJob.payload, {
      priority: job.priority,
      maxAttempts: job.max_attempts,
      delay: retryDelay
    });
    
    this.log('info', 'Job scheduled for retry', {
      jobId: job.id,
      attempts,
      retryDelay,
      scheduledAt: scheduledAt.toISOString()
    });
  }
  
  /**
   * Move job to dead letter queue
   */
  async moveToDeadLetterQueue(job, error) {
    const dlqKey = `${this.dlqPrefix}:${job.job_type}`;
    const dlqJob = {
      ...job,
      failed_at: new Date().toISOString(),
      final_error: error.message,
      attempts: job.attempts || 1
    };
    
    if (this.isRedisAvailable) {
      await this.redis.lpush(dlqKey, JSON.stringify(dlqJob));
      // Keep DLQ items for 7 days
      await this.redis.expire(dlqKey, 604800);
    }
    
    this.log('warn', 'Job moved to dead letter queue', {
      jobId: job.id,
      jobType: job.job_type,
      attempts: dlqJob.attempts
    });
  }
  
  /**
   * Mark job as permanently failed
   */
  async markJobAsFailed(job, error) {
    if (job.id && this.supabase) {
      const { error: updateError } = await this.supabase
        .from('job_queue')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error.message
        })
        .eq('id', job.id);
      
      if (updateError) {
        this.log('error', 'Failed to mark job as failed in database', {
          jobId: job.id,
          error: updateError.message
        });
      }
    }
  }
  
  /**
   * Get queue statistics
   */
  async getQueueStats(jobType = null) {
    // Return mock stats in mock mode
    if (mockMode.isMockMode) {
      return {
        timestamp: new Date().toISOString(),
        redis: false,
        database: true,
        pending: 0,
        active: 0,
        completed: 5,
        failed: 0,
        total: 5,
        queues: jobType ? { [jobType]: { pending: 0, active: 0 } } : {}
      };
    }

    const stats = {
      timestamp: new Date().toISOString(),
      redis: this.isRedisAvailable,
      database: !!this.supabase
    };
    
    try {
      if (this.isRedisAvailable) {
        stats.redisStats = await this.getRedisStats(jobType);
      }
      
      if (this.supabase) {
        stats.databaseStats = await this.getDatabaseStats(jobType);
      }
      
      return stats;
      
    } catch (error) {
      this.log('error', 'Failed to get queue stats', { error: error.message });
      return { ...stats, error: error.message };
    }
  }
  
  /**
   * Get Redis queue statistics
   */
  async getRedisStats(jobType) {
    const stats = { queues: {}, total: 0 };
    
    const jobTypes = jobType ? [jobType] : 
      ['fetch_comments', 'analyze_toxicity', 'generate_reply', 'shield_action'];
    
    for (const type of jobTypes) {
      stats.queues[type] = { byPriority: {}, total: 0 };
      
      for (let priority = 1; priority <= 5; priority++) {
        const queueKey = this.getQueueKey(type, priority);
        const length = await this.redis.llen(queueKey);
        
        stats.queues[type].byPriority[priority] = length;
        stats.queues[type].total += length;
        stats.total += length;
      }
    }
    
    return stats;
  }
  
  /**
   * Get database queue statistics
   */
  async getDatabaseStats(jobType) {
    const conditions = jobType ? [['job_type', 'eq', jobType]] : [];
    
    const { data: stats, error } = await this.supabase
      .from('job_queue')
      .select('job_type, status, priority')
      .apply(conditions);
    
    if (error) throw error;
    
    const result = { byType: {}, byStatus: {}, byPriority: {}, total: stats.length };
    
    stats.forEach(job => {
      // By type
      result.byType[job.job_type] = (result.byType[job.job_type] || 0) + 1;
      
      // By status
      result.byStatus[job.status] = (result.byStatus[job.status] || 0) + 1;
      
      // By priority
      result.byPriority[job.priority] = (result.byPriority[job.priority] || 0) + 1;
    });
    
    return result;
  }
  
  /**
   * Increment metric counter
   */
  async incrementMetric(metric, jobType) {
    if (!this.isRedisAvailable) return;
    
    try {
      const key = `${this.metricsPrefix}:${metric}:${jobType}`;
      await this.redis.incr(key);
      await this.redis.expire(key, 86400); // 24 hour TTL
    } catch (error) {
      // Metrics are non-critical, so just log and continue
      this.log('debug', 'Failed to increment metric', { metric, jobType, error: error.message });
    }
  }
  
  /**
   * Generate unique job ID
   */
  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get Redis queue key for job type and priority
   */
  getQueueKey(jobType, priority = 5) {
    return `${this.queuePrefix}:${jobType}:p${priority}`;
  }
  
  /**
   * Graceful shutdown
   * Note: Upstash Redis (REST SDK) is stateless and doesn't require disconnection
   */
  async shutdown() {
    this.log('info', 'Shutting down Queue Service');

    // Upstash Redis (REST SDK) is stateless - no disconnect needed
    // Supabase client doesn't need explicit shutdown
  }
  
  /**
   * Logging utility - Uses Winston advancedLogger for structured logging
   * Supports correlation context for end-to-end traceability (Issue #417)
   */
  log(level, message, metadata = {}) {
    const logData = {
      service: 'QueueService',
      ...metadata
    };

    // Use Winston logger based on level
    switch (level) {
      case 'error':
        advancedLogger.queueLogger.error(message, logData);
        break;
      case 'warn':
        advancedLogger.queueLogger.warn(message, logData);
        break;
      case 'debug':
        advancedLogger.queueLogger.debug(message, logData);
        break;
      default:
        advancedLogger.queueLogger.info(message, logData);
    }
  }
}

module.exports = QueueService;