const BaseWorker = require('./BaseWorker');
const ShieldActionExecutorService = require('../services/shieldActionExecutor');
const ShieldPersistenceService = require('../services/shieldPersistenceService');
const CostControlService = require('../services/costControl');

/**
 * Shield Action Worker
 * 
 * Background worker for executing Shield moderation actions across platforms.
 * Uses the unified ShieldActionExecutorService with circuit breaker, retry logic,
 * and fallback strategies as specified in Issue 361.
 * 
 * Processes jobs from the shield_action queue and executes:
 * - hideComment: Hide/delete toxic comments
 * - reportUser: Report users to platform moderation
 * - blockUser: Block toxic users
 * - unblockUser: Unblock users (reversal)
 */
class ShieldActionWorker extends BaseWorker {
  constructor(options = {}) {
    super('shield_action', {
      maxConcurrency: 3, // Moderate concurrency for Shield actions
      pollInterval: 2000, // 2 second polling for Shield actions
      maxRetries: 1, // Let ShieldActionExecutor handle retries
      priority: 1, // High priority for Shield actions
      ...options
    });
    
    // Initialize services
    this.actionExecutor = new ShieldActionExecutorService({
      maxRetries: 3,
      baseDelay: 500,
      maxDelay: 30000,
      failureThreshold: 5,
      recoveryTimeout: 60000
    });
    
    this.persistenceService = new ShieldPersistenceService();
    this.costControl = new CostControlService();
    
    // Worker metrics
    this.workerMetrics = {
      totalProcessed: 0,
      successfulActions: 0,
      failedActions: 0,
      fallbackActions: 0,
      averageProcessingTime: 0,
      lastActionTime: null
    };
  }
  
  /**
   * Get worker-specific health details
   */
  async getSpecificHealthDetails() {
    const executorMetrics = this.actionExecutor.getMetrics();
    const circuitBreakerStatus = this.actionExecutor.getCircuitBreakerStatus();
    const adapterCapabilities = this.actionExecutor.getAdapterCapabilities();
    
    return {
      workerMetrics: this.workerMetrics,
      actionExecutor: {
        metrics: executorMetrics,
        circuitBreakers: circuitBreakerStatus,
        supportedPlatforms: Object.keys(adapterCapabilities)
      },
      platformCapabilities: adapterCapabilities,
      persistence: {
        connected: !!this.persistenceService,
        status: 'operational'
      },
      costControl: {
        enabled: !!this.costControl,
        status: 'operational'
      }
    };
  }
  
  /**
   * Process Shield action job
   * 
   * Executes Shield moderation actions using the unified action executor.
   * Job payload should contain:
   * - organizationId: Organization ID
   * - userId: User ID (optional)
   * - platform: Platform name (twitter, youtube, discord, twitch)
   * - accountRef: Platform account reference  
   * - externalCommentId: Platform-specific comment/message ID
   * - externalAuthorId: Platform-specific author ID
   * - externalAuthorUsername: Author username
   * - action: Action to execute (hideComment, reportUser, blockUser, unblockUser)
   * - reason: Reason for action
   * - originalText: Original comment text (optional, for GDPR)
   * - metadata: Additional metadata
   */
  async processJob(job) {
    const startTime = Date.now();
    const payload = job.payload || job;
    
    const {
      organizationId,
      userId = null,
      platform,
      accountRef,
      externalCommentId,
      externalAuthorId,
      externalAuthorUsername,
      action,
      reason = 'Shield automated action',
      originalText = null,
      metadata = {}
    } = payload;
    
    // Validate required fields
    if (!organizationId || !platform || !externalCommentId || !externalAuthorId || !action) {
      throw new Error('Missing required Shield action parameters');
    }
    
    this.log('info', 'Processing Shield action job', {
      organizationId,
      platform,
      externalCommentId,
      externalAuthorId,
      action
    });
    
    try {
      // Execute action using the unified executor
      const result = await this.actionExecutor.executeAction({
        organizationId,
        userId,
        platform,
        accountRef,
        externalCommentId,
        externalAuthorId,
        externalAuthorUsername,
        action,
        reason,
        originalText,
        metadata: {
          ...metadata,
          jobId: job.id,
          workerId: this.workerId,
          queueName: this.queueName
        }
      });
      
      // Record usage for cost control
      await this.recordUsage(organizationId, platform, action, result, startTime);
      
      // Update worker metrics
      this.updateWorkerMetrics(true, result.fallback, Date.now() - startTime);
      
      this.log('info', 'Shield action completed successfully', {
        organizationId,
        platform,
        action,
        success: result.success,
        fallback: result.fallback,
        requiresManualReview: result.requiresManualReview,
        processingTimeMs: Date.now() - startTime
      });
      
      return {
        success: true,
        summary: `Shield action executed: ${action} on ${platform}`,
        platform,
        action: result.fallback || action,
        originalAction: result.originalAction || action,
        fallback: result.fallback,
        requiresManualReview: result.requiresManualReview || false,
        executionTime: result.executionTime,
        details: result.details
      };
      
    } catch (error) {
      // Update worker metrics
      this.updateWorkerMetrics(false, false, Date.now() - startTime);
      
      this.log('error', 'Shield action job failed', {
        organizationId,
        platform,
        externalCommentId,
        action,
        error: error.message,
        processingTimeMs: Date.now() - startTime
      });
      
      throw error;
    }
  }
  
  /**
   * Record usage for cost control
   */
  async recordUsage(organizationId, platform, action, result, startTime) {
    try {
      await this.costControl.recordUsage(
        organizationId,
        platform,
        'shield_action',
        {
          action,
          success: result.success,
          fallback: result.fallback,
          requiresManualReview: result.requiresManualReview || false,
          executionTime: result.executionTime || (Date.now() - startTime),
          platform,
          timestamp: new Date().toISOString()
        },
        null, // userId - not applicable for shield actions
        1 // quantity
      );
    } catch (error) {
      this.log('error', 'Failed to record Shield action usage', {
        organizationId,
        platform,
        action,
        error: error.message
      });
    }
  }
  
  /**
   * Update worker metrics
   */
  updateWorkerMetrics(success, isFallback, processingTime) {
    this.workerMetrics.totalProcessed++;
    this.workerMetrics.lastActionTime = new Date().toISOString();
    
    if (success) {
      this.workerMetrics.successfulActions++;
    } else {
      this.workerMetrics.failedActions++;
    }
    
    if (isFallback) {
      this.workerMetrics.fallbackActions++;
    }
    
    // Update average processing time
    const currentAvg = this.workerMetrics.averageProcessingTime;
    const totalProcessed = this.workerMetrics.totalProcessed;
    
    this.workerMetrics.averageProcessingTime = 
      ((currentAvg * (totalProcessed - 1)) + processingTime) / totalProcessed;
  }
  
  /**
   * Get worker metrics
   */
  getWorkerMetrics() {
    return {
      ...this.workerMetrics,
      actionExecutorMetrics: this.actionExecutor.getMetrics(),
      circuitBreakerStatus: this.actionExecutor.getCircuitBreakerStatus()
    };
  }
}

module.exports = ShieldActionWorker;