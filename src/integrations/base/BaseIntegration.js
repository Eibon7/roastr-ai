class BaseIntegration {
  constructor(config) {
    this.config = config;
    this.platform = this.constructor.name.replace('Service', '').toLowerCase();
    this.debug = process.env.DEBUG === 'true';
    
    // Common tracking
    this.metrics = {
      commentsProcessed: 0,
      responsesGenerated: 0,
      errorsEncountered: 0,
      lastActivity: null
    };
  }

  /**
   * Debug logging utility
   */
  debugLog(message, ...args) {
    if (this.debug) {
      console.log(`[${this.platform.toUpperCase()}-DEBUG] ${new Date().toISOString()}: ${message}`, ...args);
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
   * Common method with default implementation - Can be overridden
   */
  async processComment(comment, tone = 'sarcastic') {
    try {
      this.debugLog(`Processing comment: ${comment.text?.substring(0, 50)}...`);
      
      // Update metrics
      this.metrics.commentsProcessed++;
      this.metrics.lastActivity = new Date().toISOString();
      
      // Placeholder for common processing logic
      // This would include:
      // - Content filtering
      // - Toxicity analysis
      // - Rate limiting checks
      
      console.log(`📝 [${this.platform.toUpperCase()}] Comment processed successfully`);
      return true;
      
    } catch (error) {
      this.metrics.errorsEncountered++;
      console.error(`❌ [${this.platform.toUpperCase()}] Error processing comment:`, error.message);
      throw error;
    }
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
    const missing = requiredFields.filter(field => !this.config[field]);
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
      console.log(`🚀 Initializing ${this.platform} integration...`);
      
      // Authenticate with platform
      await this.authenticate();
      
      console.log(`✅ ${this.platform} integration initialized successfully`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to initialize ${this.platform} integration:`, error.message);
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log(`🛑 Shutting down ${this.platform} integration...`);
    
    // Platform-specific cleanup would go here
    // This method can be overridden by specific integrations
    
    console.log(`✅ ${this.platform} integration shut down successfully`);
  }
}

module.exports = BaseIntegration;