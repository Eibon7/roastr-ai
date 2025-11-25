class BaseIntegration {
  constructor(config) {
    this.config = config;
    this.platform = this.constructor.name.replace('Service', '').toLowerCase();
    this.debug = process.env.DEBUG === 'true';

    // Initialize advanced logger and reincidence detector
    this.advancedLogger = require('../../utils/advancedLogger');
    const { logger } = require('./../../utils/logger'); // Issue #971: Added for console.log replacement
    this.ReincidenceDetector = require('../../services/reincidenceDetector');
    this.reincidenceDetector = new this.ReincidenceDetector();

    // Get current Roastr mode
    this.roastrMode = process.env.ROASTR_MODE || 'normal';

    // Response frequency (0.0 to 1.0)
    this.responseFrequency = config.responseFrequency || 1.0;

    // Common tracking
    this.metrics = {
      commentsProcessed: 0,
      responsesGenerated: 0,
      responsesSkipped: 0,
      errorsEncountered: 0,
      autoActionsTaken: 0,
      lastActivity: null
    };
  }

  /**
   * Debug logging utility
   */
  debugLog(message, ...args) {
    if (this.debug) {
      logger.info(
        `[${this.platform.toUpperCase()}-DEBUG] ${new Date().toISOString()}: ${message}`,
        ...args
      );
    }
  }

  /**
   * Abstract methods - Must be implemented by each integration
   */
  async authenticate() {
    throw new Error(`${this.platform}: Must implement authenticate() method`);
  }

  async listenForMentions() {
    throw new Error(`${this.platform}: Must implement listenForMentions() method`);
  }

  async postResponse(parentId, response) {
    throw new Error(`${this.platform}: Must implement postResponse() method`);
  }

  /**
   * Check if we should respond based on frequency setting
   */
  shouldRespondBasedOnFrequency() {
    if (this.responseFrequency >= 1.0) {
      return true; // Always respond
    }

    return Math.random() <= this.responseFrequency;
  }

  /**
   * Analyze comment severity for Shield mode
   */
  analyzeCommentSeverity(text) {
    // Simple severity analysis - can be enhanced with ML models
    const lowerText = text.toLowerCase();

    // Critical severity indicators
    const criticalWords = ['threat', 'kill', 'die', 'suicide', 'harm'];
    if (criticalWords.some((word) => lowerText.includes(word))) {
      return 'critical';
    }

    // High severity indicators
    const highSeverityWords = ['hate', 'racist', 'nazi', 'terrorist'];
    if (highSeverityWords.some((word) => lowerText.includes(word))) {
      return 'high';
    }

    // Medium severity indicators
    const mediumWords = ['idiot', 'stupid', 'moron', 'loser'];
    if (mediumWords.some((word) => lowerText.includes(word))) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Enhanced comment processing with Shield support
   */
  async processComment(comment, tone = 'sarcastic') {
    try {
      this.debugLog(`Processing comment: ${comment.text?.substring(0, 50)}...`);

      // Update metrics
      this.metrics.commentsProcessed++;
      this.metrics.lastActivity = new Date().toISOString();

      // Check response frequency
      if (!this.shouldRespondBasedOnFrequency()) {
        this.debugLog('Skipping response due to frequency setting');
        this.metrics.responsesSkipped++;
        await this.advancedLogger.logIntegration(
          this.platform,
          'info',
          'Response skipped due to frequency setting',
          { commentId: comment.id, frequency: this.responseFrequency }
        );
        return false;
      }

      // Record user interaction for reincidence detection
      const severity = this.analyzeCommentSeverity(comment.text);
      await this.reincidenceDetector.recordInteraction(
        this.platform,
        comment.userId || comment.author,
        comment.username || comment.author,
        comment.text,
        severity
      );

      // Check for auto-actions in Shield mode
      if (this.roastrMode === 'shield') {
        const autoAction = this.reincidenceDetector.shouldTakeAutoAction(
          this.platform,
          comment.userId || comment.author,
          severity
        );

        if (autoAction) {
          await this.executeAutoAction(comment, autoAction, severity);
          this.metrics.autoActionsTaken++;
        }
      }

      // Log the comment processing
      await this.advancedLogger.logIntegration(
        this.platform,
        'info',
        'Comment processed successfully',
        {
          commentId: comment.id,
          userId: comment.userId || comment.author,
          severity,
          mode: this.roastrMode
        }
      );

      logger.info(`📝 [${this.platform.toUpperCase()}] Comment processed successfully`);
      return true;
    } catch (error) {
      this.metrics.errorsEncountered++;
      logger.error(`❌ [${this.platform.toUpperCase()}] Error processing comment:`, error.message);

      await this.advancedLogger.logIntegration(this.platform, 'error', 'Error processing comment', {
        error: error.message,
        commentId: comment.id
      });

      throw error;
    }
  }

  /**
   * Execute automatic action for Shield mode
   */
  async executeAutoAction(comment, action, severity) {
    try {
      this.debugLog(`Executing auto action: ${action} for user ${comment.author}`);

      // Log the action
      await this.reincidenceDetector.recordAutoAction(
        this.platform,
        comment.userId || comment.author,
        comment.username || comment.author,
        action,
        `Severity: ${severity}, auto-action triggered`,
        severity
      );

      // Platform-specific implementation should override this
      await this.performAutoAction(comment, action);
    } catch (error) {
      logger.error(`❌ Error executing auto action ${action}:`, error.message);
      throw error;
    }
  }

  /**
   * Platform-specific auto action implementation - Override in subclasses
   */
  async performAutoAction(comment, action) {
    // Default implementation - just log
    logger.info(`🛡️ [${this.platform.toUpperCase()}] Auto-action: ${action} (not implemented)`);
  }

  /**
   * Generate roast with tone support
   * Issue #868: Removed humorType parameter (deprecated - tone is now sole selector)
   */
  async generateRoastWithTone(text, tone) {
    try {
      const RoastGeneratorReal = require('../../services/roastGeneratorReal');
      const generator = new RoastGeneratorReal();

      // Create custom prompt based on tone only
      const customPrompt = this.createTonePrompt(tone);
      const roast = await generator.generateRoastWithPrompt(text, customPrompt);

      // Log roast generation
      await this.advancedLogger.logRoast(
        this.platform,
        this.roastrMode,
        'unknown_user', // Will be filled by subclass
        text,
        roast,
        tone,
        {} // Issue #868: Removed humorType from metadata
      );

      return roast;
    } catch (error) {
      logger.error(`❌ Error generating roast with tone:`, error.message);
      throw error;
    }
  }

  /**
   * Create tone-specific prompt
   * Issue #868: Removed humorType parameter (deprecated - tone is now sole selector)
   */
  createTonePrompt(tone) {
    const basePrompt = 'You are Roastr.ai, specialized in creating humorous roast responses.';

    let toneInstruction = '';
    switch (tone) {
      case 'sarcastic':
        toneInstruction = 'Use sharp sarcasm but avoid explicit insults.';
        break;
      case 'ironic':
        toneInstruction = 'Use sophisticated irony and elegant wordplay.';
        break;
      case 'absurd':
        toneInstruction = 'Use absurd humor and unexpected comparisons.';
        break;
      default:
        toneInstruction = 'Use witty and clever humor.';
    }

    // Issue #868: Removed humorType logic - tone is now the sole determinant of style

    return `${basePrompt} ${toneInstruction} Keep responses short (1-2 sentences) and appropriate. Respond in the same language as the input.`;
  }

  /**
   * Get integration metrics
   */
  getMetrics() {
    return {
      platform: this.platform,
      ...this.metrics,
      uptime: process.uptime()
    };
  }

  /**
   * Validate required configuration
   */
  validateConfig(requiredFields) {
    const missing = requiredFields.filter((field) => !this.config[field]);
    if (missing.length > 0) {
      throw new Error(`${this.platform}: Missing required configuration: ${missing.join(', ')}`);
    }
    return true;
  }

  /**
   * Common initialization logic
   */
  async initialize() {
    try {
      logger.info(`🚀 Initializing ${this.platform} integration...`);

      // Authenticate with platform
      await this.authenticate();

      logger.info(`✅ ${this.platform} integration initialized successfully`);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to initialize ${this.platform} integration:`, error.message);
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info(`🛑 Shutting down ${this.platform} integration...`);

    // Platform-specific cleanup would go here
    // This method can be overridden by specific integrations

    logger.info(`✅ ${this.platform} integration shut down successfully`);
  }
}

module.exports = BaseIntegration;
