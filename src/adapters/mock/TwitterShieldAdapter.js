const { ShieldAdapter, ModerationInput, ModerationResult, CapabilityMap } = require('../ShieldAdapter');

/**
 * Mock Twitter/X Shield Adapter
 * 
 * Simulates Twitter API moderation capabilities based on the research
 * from the platform capabilities matrix.
 */
class TwitterShieldAdapter extends ShieldAdapter {
  constructor(config = {}) {
    super('twitter', config);
    this.mockLatency = config.mockLatency || { min: 100, max: 500 };
    this.failureRate = config.failureRate !== undefined ? config.failureRate : 0.05; // 5% failure rate
  }

  async initialize() {
    // Simulate API connection setup
    await this.simulateLatency();
    
    // Check for required config
    const requiredEnvVars = ['TWITTER_BEARER_TOKEN', 'TWITTER_APP_KEY'];
    const missing = requiredEnvVars.filter(env => !process.env[env] && !this.config[env]);
    
    if (missing.length > 0 && !this.config.skipValidation) {
      throw new Error(`Missing Twitter configuration: ${missing.join(', ')}`);
    }

    this.client = {
      connected: true,
      apiVersion: '2.0',
      endpoint: 'https://api.x.com/2'
    };
    
    this.isInitialized = true;
    this.log('info', 'Twitter Shield Adapter initialized (MOCK)');
  }

  async hideComment(input) {
    this.validateInput(input, ['commentId']);
    
    const startTime = Date.now();
    
    try {
      await this.simulateLatency();
      
      // Simulate potential API failures
      if (this.shouldSimulateFailure()) {
        throw new Error('Twitter API rate limit exceeded');
      }

      // Mock successful hide operation using PUT /tweets/:id/hidden
      const result = this.createSuccessResult('hideComment', {
        tweetId: input.commentId,
        hidden: true,
        endpoint: 'PUT /tweets/:id/hidden',
        apiVersion: 'v2'
      }, Date.now() - startTime);

      this.log('info', 'Comment hidden successfully (MOCK)', {
        commentId: input.commentId,
        userId: input.userId
      });

      return result;

    } catch (error) {
      this.log('error', 'Failed to hide comment (MOCK)', {
        commentId: input.commentId,
        error: error.message
      });

      return this.createErrorResult('hideComment', error, Date.now() - startTime);
    }
  }

  async reportUser(input) {
    this.validateInput(input, ['userId']);
    
    const startTime = Date.now();
    
    try {
      await this.simulateLatency();
      
      // Twitter doesn't have an API for reporting - this requires manual action
      const result = this.createSuccessResult('reportUser', {
        userId: input.userId,
        platform: 'twitter',
        method: 'manual_review_required',
        reportUrl: `https://help.twitter.com/forms/report`,
        note: 'Twitter reporting must be done through web interface'
      }, Date.now() - startTime, true); // requiresManualReview = true

      this.log('info', 'User report queued for manual review (MOCK)', {
        userId: input.userId,
        reason: input.reason
      });

      return result;

    } catch (error) {
      return this.createErrorResult('reportUser', error, Date.now() - startTime);
    }
  }

  async blockUser(input) {
    this.validateInput(input, ['userId']);
    
    const startTime = Date.now();
    
    try {
      await this.simulateLatency();
      
      if (this.shouldSimulateFailure()) {
        throw new Error('Twitter API authentication failed');
      }

      // Mock successful block operation using POST /blocks/create
      const result = this.createSuccessResult('blockUser', {
        userId: input.userId,
        blocked: true,
        endpoint: 'POST /blocks/create',
        apiVersion: 'v1.1',
        note: 'User will not appear in mentions or timeline'
      }, Date.now() - startTime);

      this.log('info', 'User blocked successfully (MOCK)', {
        userId: input.userId,
        username: input.username
      });

      return result;

    } catch (error) {
      this.log('error', 'Failed to block user (MOCK)', {
        userId: input.userId,
        error: error.message
      });

      return this.createErrorResult('blockUser', error, Date.now() - startTime);
    }
  }

  async unblockUser(input) {
    this.validateInput(input, ['userId']);
    
    const startTime = Date.now();
    
    try {
      await this.simulateLatency();
      
      if (this.shouldSimulateFailure()) {
        throw new Error('Twitter API quota exceeded');
      }

      // Mock successful unblock operation using POST /blocks/destroy
      const result = this.createSuccessResult('unblockUser', {
        userId: input.userId,
        blocked: false,
        endpoint: 'POST /blocks/destroy',
        apiVersion: 'v1.1'
      }, Date.now() - startTime);

      this.log('info', 'User unblocked successfully (MOCK)', {
        userId: input.userId
      });

      return result;

    } catch (error) {
      return this.createErrorResult('unblockUser', error, Date.now() - startTime);
    }
  }

  capabilities() {
    return new CapabilityMap({
      hideComment: true,  // ✅ Via hide replies API
      reportUser: false,  // ❌ No API, manual only
      blockUser: true,    // ✅ Via blocks API
      unblockUser: true,  // ✅ Via blocks API
      platform: 'twitter',
      rateLimits: {
        hideComment: '300 requests/15min',
        blockUser: '300 requests/15min',
        unblockUser: '300 requests/15min',
        cost: '$100/month minimum (Basic tier)'
      },
      scopes: [
        'tweet.write',
        'users.write',
        'OAuth 1.0a or OAuth 2.0'
      ],
      fallbacks: {
        reportUser: 'blockUser', // If can't report, block instead
        hideComment: 'blockUser' // If can't hide, block instead
      }
    });
  }

  isRateLimitError(error) {
    return error.message.includes('rate limit') || 
           error.message.includes('Too Many Requests') ||
           error.status === 429;
  }

  /**
   * Simulate API latency
   */
  async simulateLatency() {
    const delay = Math.random() * 
      (this.mockLatency.max - this.mockLatency.min) + 
      this.mockLatency.min;
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Simulate random API failures
   */
  shouldSimulateFailure() {
    return Math.random() < this.failureRate;
  }
}

module.exports = TwitterShieldAdapter;