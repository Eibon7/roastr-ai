const { logger } = require('../utils/logger');
const { ModerationInput, ModerationResult } = require('../adapters/ShieldAdapter');
const ShieldPersistenceService = require('./shieldPersistenceService');

// Import platform adapters
const TwitterShieldAdapter = require('../adapters/mock/TwitterShieldAdapter');
const YouTubeShieldAdapter = require('../adapters/mock/YouTubeShieldAdapter');
const DiscordShieldAdapter = require('../adapters/mock/DiscordShieldAdapter');
const TwitchShieldAdapter = require('../adapters/mock/TwitchShieldAdapter');

/**
 * Shield Action Executor Service
 *
 * Unified interface for executing Shield moderation actions across platforms.
 * Implements retry logic, circuit breaker, fallback strategies, and audit logging
 * as specified in Issue 361.
 */
class ShieldActionExecutorService {
  constructor(config = {}) {
    this.logger = config.logger || logger;
    this.persistenceService = config.persistenceService || new ShieldPersistenceService();

    // Circuit breaker configuration
    this.circuitBreakers = new Map();
    this.circuitBreakerConfig = {
      failureThreshold: config.failureThreshold || 5, // Open after 5 consecutive failures
      recoveryTimeout: config.recoveryTimeout || 60000, // 1 minute recovery time
      ...config.circuitBreaker
    };

    // Retry configuration
    this.retryConfig = {
      maxRetries: config.maxRetries || 3,
      baseDelay: config.baseDelay || 500, // 500ms base delay
      maxDelay: config.maxDelay || 30000, // 30 seconds max delay
      ...config.retry
    };

    // Metrics tracking - initialize before adapters
    this.metrics = {
      totalActions: 0,
      successfulActions: 0,
      failedActions: 0,
      fallbackActions: 0,
      byPlatform: {},
      byAction: {},
      circuitBreakerTrips: 0
    };

    // Platform adapters
    this.adapters = new Map();
    this.initializeAdapters(config.adapters || {});

    this.logger.info('Shield Action Executor initialized', {
      supportedPlatforms: Array.from(this.adapters.keys()),
      circuitBreakerConfig: this.circuitBreakerConfig,
      retryConfig: this.retryConfig
    });
  }

  /**
   * Initialize platform adapters
   */
  initializeAdapters(adapterConfigs) {
    const adapters = {
      twitter: TwitterShieldAdapter,
      youtube: YouTubeShieldAdapter,
      discord: DiscordShieldAdapter,
      twitch: TwitchShieldAdapter
    };

    for (const [platform, AdapterClass] of Object.entries(adapters)) {
      try {
        const config = adapterConfigs[platform] || {};

        // Skip validation in test/mock mode
        if (process.env.NODE_ENV === 'test' || process.env.ENABLE_MOCK_MODE === 'true') {
          config.skipValidation = true;
        }

        const adapter = new AdapterClass(config);
        this.adapters.set(platform, adapter);

        // Initialize circuit breaker for this platform
        this.circuitBreakers.set(platform, {
          state: 'closed', // closed, open, half-open
          failureCount: 0,
          lastFailureTime: null,
          nextAttemptTime: null
        });

        // Initialize metrics for this platform
        this.metrics.byPlatform[platform] = {
          total: 0,
          successful: 0,
          failed: 0,
          fallbacks: 0,
          circuitBreakerTrips: 0
        };

        this.logger.debug(`${platform} adapter initialized`);
      } catch (error) {
        this.logger.error(`Failed to initialize ${platform} adapter`, {
          error: error.message
        });
      }
    }
  }

  /**
   * Execute a Shield action with retry, circuit breaker, and fallback
   */
  async executeAction({
    organizationId,
    userId = null,
    platform,
    accountRef,
    externalCommentId,
    externalAuthorId,
    externalAuthorUsername,
    action, // hideComment, reportUser, blockUser, unblockUser
    reason,
    originalText = null,
    metadata = {}
  }) {
    const startTime = Date.now();

    try {
      // Validate inputs
      this.validateActionInput({
        organizationId,
        platform,
        externalCommentId,
        externalAuthorId,
        action
      });

      // Get platform adapter
      const adapter = this.adapters.get(platform);
      if (!adapter) {
        throw new Error(`No adapter available for platform: ${platform}`);
      }

      // Create moderation input
      const moderationInput = new ModerationInput({
        platform,
        commentId: externalCommentId,
        userId: externalAuthorId,
        username: externalAuthorUsername,
        reason,
        orgId: organizationId,
        metadata
      });

      // Check if action is supported
      const capabilities = adapter.capabilities();
      if (!this.isActionSupported(action, capabilities)) {
        return await this.handleUnsupportedAction(
          adapter,
          action,
          capabilities,
          moderationInput,
          startTime
        );
      }

      // Execute action with circuit breaker and retry
      const result = await this.executeWithResiliency(
        platform,
        adapter,
        action,
        moderationInput,
        startTime
      );

      // Record successful action (don't let recording errors break the flow)
      try {
        await this.recordAction({
          organizationId,
          userId,
          platform,
          accountRef,
          externalCommentId,
          externalAuthorId,
          externalAuthorUsername,
          originalText,
          action,
          result,
          processingTimeMs: Date.now() - startTime
        });
      } catch (recordError) {
        this.logger.error('Failed to record successful action', {
          organizationId,
          platform,
          action,
          error: recordError.message
        });
      }

      // Update metrics
      this.updateMetrics(platform, action, true, false);

      this.logger.info('Shield action executed successfully', {
        organizationId,
        platform,
        action,
        externalAuthorId,
        processingTimeMs: Date.now() - startTime
      });

      return result;
    } catch (error) {
      // Update metrics
      this.updateMetrics(platform, action, false, false);

      this.logger.error('Shield action execution failed', {
        organizationId,
        platform,
        action,
        externalAuthorId,
        error: error.message,
        processingTimeMs: Date.now() - startTime
      });

      // Record failed action (don't let recording errors mask the original error)
      try {
        await this.recordAction({
          organizationId,
          userId,
          platform,
          accountRef,
          externalCommentId,
          externalAuthorId,
          externalAuthorUsername,
          originalText,
          action,
          result: {
            success: false,
            action,
            error: error.message,
            executionTime: Date.now() - startTime
          },
          processingTimeMs: Date.now() - startTime
        });
      } catch (recordError) {
        this.logger.error('Failed to record failed action', {
          organizationId,
          platform,
          action,
          originalError: error.message,
          recordError: recordError.message
        });
      }

      throw error;
    }
  }

  /**
   * Execute action with circuit breaker and retry logic
   */
  async executeWithResiliency(platform, adapter, action, moderationInput, startTime) {
    const circuitBreaker = this.circuitBreakers.get(platform);

    // Check circuit breaker state
    if (this.isCircuitBreakerOpen(circuitBreaker)) {
      this.logger.warn('Circuit breaker is open, rejecting action', {
        platform,
        action,
        failureCount: circuitBreaker.failureCount
      });
      throw new Error(`Circuit breaker is open for platform: ${platform}`);
    }

    let lastError;
    let attempt = 0;

    while (attempt <= this.retryConfig.maxRetries) {
      try {
        // Initialize adapter if needed
        if (!adapter.isReady()) {
          await adapter.initialize();
        }

        // Execute the action
        const result = await this.executeAdapterAction(adapter, action, moderationInput);

        // Check if the action actually succeeded
        // Issue #1020: Add defensive check for undefined result
        if (!result || !result.success) {
          throw new Error((result && result.error) || 'Action execution failed');
        }

        // Success - reset circuit breaker
        this.resetCircuitBreaker(platform);

        return result;
      } catch (error) {
        lastError = error;
        attempt++;

        this.logger.warn('Shield action attempt failed', {
          platform,
          action,
          attempt,
          maxRetries: this.retryConfig.maxRetries,
          error: error.message
        });

        // Update circuit breaker
        this.recordCircuitBreakerFailure(platform);

        // If this was the last attempt, don't delay
        if (attempt > this.retryConfig.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff and jitter to reduce thundering herd
        const baseDelay = Math.min(
          this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
          this.retryConfig.maxDelay
        );

        // Add jitter: random variation between 0.5x and 1.5x of base delay
        const jitterFactor = 0.5 + Math.random(); // 0.5 to 1.5
        const delay = Math.floor(baseDelay * jitterFactor);

        this.logger.debug('Retrying Shield action after delay', {
          platform,
          action,
          attempt,
          delayMs: delay
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Execute specific adapter action with consistent naming
   */
  async executeAdapterAction(adapter, action, moderationInput) {
    switch (action) {
      case 'hideComment':
        return await adapter.hideComment(moderationInput);
      case 'reportUser':
        return await adapter.reportUser(moderationInput);
      case 'blockUser':
        return await adapter.blockUser(moderationInput);
      case 'unblockUser':
        return await adapter.unblockUser(moderationInput);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Handle unsupported actions with fallback strategy
   */
  async handleUnsupportedAction(adapter, action, capabilities, moderationInput, startTime) {
    const fallbackAction = this.getFallbackAction(action, capabilities);

    if (!fallbackAction) {
      // Enhanced audit logging for manual review path
      const auditContext = {
        organizationId: moderationInput.orgId,
        platform: adapter.getPlatform(),
        originalAction: action,
        externalCommentId: moderationInput.commentId,
        externalAuthorId: moderationInput.userId,
        reason: moderationInput.reason,
        capabilitiesCheck: capabilities,
        timestamp: new Date().toISOString(),
        requiresManualReview: true
      };

      this.logger.warn('Action escalated to manual review - platform API limitation', auditContext);

      // Record manual review requirement in audit trail
      try {
        await this.recordManualReviewEscalation(
          moderationInput,
          action,
          adapter.getPlatform(),
          startTime
        );
      } catch (auditError) {
        this.logger.error('Failed to record manual review escalation', {
          organizationId: moderationInput.orgId,
          platform: adapter.getPlatform(),
          action,
          error: auditError.message
        });
        // Don't let audit logging failure prevent the manual review result
      }

      const result = {
        success: true,
        action,
        requiresManualReview: true,
        fallback: 'manual_review',
        details: {
          platform: adapter.getPlatform(),
          originalAction: action,
          reason: 'Action not supported by platform API',
          manualInstructions: this.getManualInstructions(adapter.getPlatform(), action),
          auditTrail: {
            escalatedAt: new Date().toISOString(),
            escalationReason: 'platform_api_limitation',
            capabilitiesChecked: capabilities
          }
        },
        executionTime: Date.now() - startTime
      };

      // Update metrics for manual review path (count as successful fallback)
      this.updateMetrics(adapter.getPlatform(), action, true, true);

      // Log manual review action specifically
      this.logger.info('Shield action requires manual review', {
        organizationId: moderationInput.orgId,
        platform: adapter.getPlatform(),
        action,
        externalCommentId: moderationInput.commentId,
        externalAuthorId: moderationInput.userId,
        reason: 'Platform API limitation - no automated action available',
        manualInstructions: this.getManualInstructions(adapter.getPlatform(), action),
        escalationContext: auditContext
      });

      return result;
    }

    // Execute fallback action through resiliency patterns
    this.logger.info('Executing fallback action through resiliency layer', {
      platform: adapter.getPlatform(),
      originalAction: action,
      fallbackAction,
      organizationId: moderationInput.orgId
    });

    // Route fallback through the same resiliency patterns as primary actions
    try {
      const result = await this.executeWithResiliency(
        adapter.getPlatform(),
        adapter,
        fallbackAction,
        moderationInput,
        startTime
      );

      // Mark as fallback (ensure result is a plain object we can modify)
      if (result && typeof result === 'object') {
        result.fallback = fallbackAction;
        result.originalAction = action;
        result.details = result.details || {};
        result.details.fallbackExecuted = true;
        result.details.fallbackReason = 'original_action_unsupported';
      }

      // Update metrics for fallback execution
      this.updateMetrics(adapter.getPlatform(), action, result && result.success, true);

      return result;
    } catch (fallbackError) {
      // Issue #1020: If fallback also fails, escalate to manual review
      this.logger.warn('Fallback action failed, escalating to manual review', {
        platform: adapter.getPlatform(),
        originalAction: action,
        fallbackAction,
        error: fallbackError.message
      });

      // Record manual review escalation
      try {
        await this.recordManualReviewEscalation(
          moderationInput,
          action,
          adapter.getPlatform(),
          startTime
        );
      } catch (auditError) {
        this.logger.error('Failed to record manual review escalation after fallback failure', {
          error: auditError.message
        });
      }

      const result = {
        success: true,
        action,
        requiresManualReview: true,
        fallback: 'manual_review',
        details: {
          platform: adapter.getPlatform(),
          originalAction: action,
          attemptedFallback: fallbackAction,
          reason: 'Both primary and fallback actions failed',
          manualInstructions: this.getManualInstructions(adapter.getPlatform(), action)
        }
      };

      // Update metrics for failed fallback
      this.updateMetrics(adapter.getPlatform(), action, false, true);

      return result;
    }
  }

  /**
   * Get fallback action based on platform capabilities
   */
  getFallbackAction(action, capabilities) {
    const fallbacks = capabilities.fallbacks || {};

    // Check if there's an explicit fallback defined (including null)
    if (action in fallbacks) {
      const fallbackAction = fallbacks[action];

      // Explicit null means "no fallback, require manual review"
      if (fallbackAction === null) {
        return null;
      }

      // Use explicit fallback if the action is supported
      if (this.isActionSupported(fallbackAction, capabilities)) {
        return fallbackAction;
      }
    }

    // Default fallback logic (only if no explicit fallback is defined)
    switch (action) {
      case 'reportUser':
        if (capabilities.blockUser) return 'blockUser';
        if (capabilities.hideComment) return 'hideComment';
        break;
      case 'hideComment':
        if (capabilities.blockUser) return 'blockUser';
        break;
    }

    return null;
  }

  /**
   * Check if action is supported by platform
   */
  isActionSupported(action, capabilities) {
    switch (action) {
      case 'hideComment':
        return capabilities.hideComment;
      case 'reportUser':
        return capabilities.reportUser;
      case 'blockUser':
        return capabilities.blockUser;
      case 'unblockUser':
        return capabilities.unblockUser;
      default:
        return false;
    }
  }

  /**
   * Record action in persistence layer with GDPR-compliant conditional PII storage
   */
  async recordAction({
    organizationId,
    userId,
    platform,
    accountRef,
    externalCommentId,
    externalAuthorId,
    externalAuthorUsername,
    originalText,
    action,
    result,
    processingTimeMs
  }) {
    try {
      // Determine if this action involves content that requires PII storage
      const isContentBasedAction = this.isContentBasedAction(action, result);

      const eventData = {
        organizationId,
        userId,
        platform,
        accountRef,
        externalCommentId,
        externalAuthorId,
        externalAuthorUsername,
        // GDPR compliance: Only store original text for content-based actions
        originalText: isContentBasedAction ? originalText : null,
        toxicityScore: null, // Not available in this context
        toxicityLabels: [],
        actionTaken: result.fallback || action,
        actionReason: `Shield action executed by action executor`,
        actionStatus: result.success ? 'executed' : 'failed',
        actionDetails: {
          originalAction: result.originalAction || action,
          fallbackUsed: !!result.fallback,
          requiresManualReview: result.requiresManualReview || false,
          platformDetails: result.details || {},
          executionTime: result.executionTime || processingTimeMs,
          contentBased: isContentBasedAction,
          gdprCompliant: true
        },
        processedBy: 'shield_action_executor',
        processingTimeMs,
        metadata: {
          executor: 'ShieldActionExecutorService',
          version: '1.0',
          timestamp: new Date().toISOString(),
          gdprCompliance: {
            piiStored: isContentBasedAction,
            reason: isContentBasedAction ? 'content_moderation' : 'user_action_only'
          }
        }
      };

      await this.persistenceService.recordShieldEvent(eventData);
    } catch (error) {
      this.logger.error('Failed to record Shield action', {
        organizationId,
        externalCommentId,
        action,
        error: error.message
      });
    }
  }

  /**
   * Record manual review escalation with enhanced audit logging
   */
  async recordManualReviewEscalation(moderationInput, action, platform, startTime) {
    try {
      const escalationData = {
        organizationId: moderationInput.orgId,
        userId: null, // Manual review doesn't have executing user
        platform,
        accountRef: null,
        externalCommentId: moderationInput.commentId,
        externalAuthorId: moderationInput.userId,
        externalAuthorUsername: moderationInput.username,
        originalText: null, // No PII storage for manual review escalations
        toxicityScore: null,
        toxicityLabels: [],
        actionTaken: 'manual_review_required',
        actionReason: `Action '${action}' escalated to manual review - platform API limitation`,
        actionStatus: 'escalated',
        actionDetails: {
          originalAction: action,
          escalationReason: 'platform_api_limitation',
          requiresManualReview: true,
          platformDetails: {
            platform,
            escalatedAt: new Date().toISOString(),
            escalationType: 'api_limitation'
          },
          executionTime: Date.now() - startTime,
          contentBased: false,
          gdprCompliant: true
        },
        processedBy: 'shield_action_executor',
        processingTimeMs: Date.now() - startTime,
        metadata: {
          executor: 'ShieldActionExecutorService',
          escalationType: 'manual_review',
          version: '1.0',
          timestamp: new Date().toISOString(),
          gdprCompliance: {
            piiStored: false,
            reason: 'escalation_only'
          }
        }
      };

      await this.persistenceService.recordShieldEvent(escalationData);

      this.logger.info('Manual review escalation recorded', {
        organizationId: moderationInput.orgId,
        platform,
        originalAction: action,
        externalCommentId: moderationInput.commentId
      });
    } catch (error) {
      this.logger.error('Failed to record manual review escalation', {
        organizationId: moderationInput.orgId,
        platform,
        action,
        error: error.message
      });
      // Don't throw - this is audit logging and shouldn't prevent the manual review flow
    }
  }

  /**
   * Determine if an action is content-based and requires PII storage for GDPR compliance
   */
  isContentBasedAction(action, result) {
    // Content-based actions that require original text for moderation context
    const contentBasedActions = ['hideComment', 'reportContent'];

    // Check if this is a content-based action or requires manual review of content
    const isContentAction = contentBasedActions.includes(action);
    const requiresContentReview =
      result?.requiresManualReview && result?.details?.escalationReason === 'content_violation';

    return isContentAction || requiresContentReview;
  }

  /**
   * Circuit breaker management
   */
  isCircuitBreakerOpen(circuitBreaker) {
    if (circuitBreaker.state === 'closed') {
      return false;
    }

    if (circuitBreaker.state === 'open') {
      // Check if recovery time has elapsed
      if (Date.now() >= circuitBreaker.nextAttemptTime) {
        circuitBreaker.state = 'half-open';
        this.logger.info('Circuit breaker transitioning to half-open state');
        return false;
      }
      return true;
    }

    // half-open state - allow one attempt
    return false;
  }

  recordCircuitBreakerFailure(platform) {
    const circuitBreaker = this.circuitBreakers.get(platform);

    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = Date.now();

    // If circuit breaker is in half-open state and fails, immediately reopen
    if (circuitBreaker.state === 'half-open') {
      circuitBreaker.state = 'open';
      circuitBreaker.nextAttemptTime = Date.now() + this.circuitBreakerConfig.recoveryTimeout;

      this.metrics.circuitBreakerTrips++;

      // Ensure platform metrics exist before incrementing
      if (!this.metrics.byPlatform[platform]) {
        this.metrics.byPlatform[platform] = {
          total: 0,
          successful: 0,
          failed: 0,
          fallbacks: 0,
          circuitBreakerTrips: 0
        };
      }
      this.metrics.byPlatform[platform].circuitBreakerTrips++;

      this.logger.warn('Circuit breaker reopened after half-open failure', {
        platform,
        failureCount: circuitBreaker.failureCount,
        recoveryTimeoutMs: this.circuitBreakerConfig.recoveryTimeout
      });
      return;
    }

    // Normal failure tracking - open circuit breaker if threshold reached
    if (circuitBreaker.failureCount >= this.circuitBreakerConfig.failureThreshold) {
      circuitBreaker.state = 'open';
      circuitBreaker.nextAttemptTime = Date.now() + this.circuitBreakerConfig.recoveryTimeout;

      this.metrics.circuitBreakerTrips++;

      // Ensure platform metrics exist before incrementing
      if (!this.metrics.byPlatform[platform]) {
        this.metrics.byPlatform[platform] = {
          total: 0,
          successful: 0,
          failed: 0,
          fallbacks: 0,
          circuitBreakerTrips: 0
        };
      }
      this.metrics.byPlatform[platform].circuitBreakerTrips++;

      this.logger.warn('Circuit breaker opened', {
        platform,
        failureCount: circuitBreaker.failureCount,
        recoveryTimeoutMs: this.circuitBreakerConfig.recoveryTimeout
      });
    }
  }

  resetCircuitBreaker(platform) {
    const circuitBreaker = this.circuitBreakers.get(platform);

    circuitBreaker.state = 'closed';
    circuitBreaker.failureCount = 0;
    circuitBreaker.lastFailureTime = null;
    circuitBreaker.nextAttemptTime = null;
  }

  /**
   * Update metrics
   */
  updateMetrics(platform, action, success, isFallback) {
    this.metrics.totalActions++;

    if (success) {
      this.metrics.successfulActions++;
    } else {
      this.metrics.failedActions++;
    }

    if (isFallback) {
      this.metrics.fallbackActions++;
    }

    // Platform metrics - ensure they exist
    if (!this.metrics.byPlatform[platform]) {
      this.metrics.byPlatform[platform] = {
        total: 0,
        successful: 0,
        failed: 0,
        fallbacks: 0,
        circuitBreakerTrips: 0
      };
    }

    this.metrics.byPlatform[platform].total++;
    if (success) {
      this.metrics.byPlatform[platform].successful++;
    } else {
      this.metrics.byPlatform[platform].failed++;
    }
    if (isFallback) {
      this.metrics.byPlatform[platform].fallbacks++;
    }

    // Action metrics
    if (!this.metrics.byAction[action]) {
      this.metrics.byAction[action] = { total: 0, successful: 0, failed: 0, fallbacks: 0 };
    }

    this.metrics.byAction[action].total++;
    if (success) {
      this.metrics.byAction[action].successful++;
    } else {
      this.metrics.byAction[action].failed++;
    }
    if (isFallback) {
      this.metrics.byAction[action].fallbacks++;
    }
  }

  /**
   * Get manual instructions for unsupported actions
   */
  getManualInstructions(platform, action) {
    const instructions = {
      twitter: {
        reportUser: 'Visit https://help.twitter.com/forms/report to report this user manually',
        hideComment: 'Use Twitter web interface to hide the reply manually'
      },
      youtube: {
        reportUser: 'Use YouTube Studio to report this user manually',
        blockUser: 'Block user through YouTube Studio interface'
      },
      discord: {
        reportUser: 'Report user to Discord through the web interface'
      },
      twitch: {
        reportUser: 'Report user through Twitch moderation interface',
        hideComment: 'Delete message through Twitch chat moderation'
      }
    };

    return instructions[platform]?.[action] || 'Manual action required through platform interface';
  }

  /**
   * Validate action input
   */
  validateActionInput({ organizationId, platform, externalCommentId, externalAuthorId, action }) {
    if (!organizationId) {
      throw new Error('organizationId is required');
    }

    if (!platform) {
      throw new Error('platform is required');
    }

    if (!externalCommentId) {
      throw new Error('externalCommentId is required');
    }

    if (!externalAuthorId) {
      throw new Error('externalAuthorId is required');
    }

    if (!action) {
      throw new Error('action is required');
    }

    const validActions = ['hideComment', 'reportUser', 'blockUser', 'unblockUser'];
    if (!validActions.includes(action)) {
      throw new Error(`Invalid action: ${action}. Valid actions: ${validActions.join(', ')}`);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    const status = {};

    for (const [platform, breaker] of this.circuitBreakers.entries()) {
      status[platform] = {
        state: breaker.state,
        failureCount: breaker.failureCount,
        lastFailureTime: breaker.lastFailureTime,
        nextAttemptTime: breaker.nextAttemptTime
      };
    }

    return status;
  }

  /**
   * Get adapter capabilities
   */
  getAdapterCapabilities() {
    const capabilities = {};

    for (const [platform, adapter] of this.adapters.entries()) {
      capabilities[platform] = adapter.capabilities();
    }

    return capabilities;
  }
}

module.exports = ShieldActionExecutorService;
