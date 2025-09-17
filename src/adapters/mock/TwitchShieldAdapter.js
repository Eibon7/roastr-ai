const { ShieldAdapter, ModerationInput, ModerationResult, CapabilityMap } = require('../ShieldAdapter');

/**
 * Mock Twitch Shield Adapter
 * 
 * Simulates Twitch API moderation capabilities based on research.
 * Focuses on user timeouts and bans, with limited message-level actions.
 */
class TwitchShieldAdapter extends ShieldAdapter {
  constructor(config = {}) {
    super('twitch', config);
    this.mockLatency = config.mockLatency || { min: 80, max: 400 };
    this.failureRate = config.failureRate || 0.02; // 2% failure rate
    this.rateLimits = {
      moderation: {
        requests: 0,
        resetTime: Date.now() + 60000, // Reset every minute
        limit: 100 // 100 moderation actions per minute
      }
    };
  }

  async initialize() {
    await this.simulateLatency();
    
    // Check for required config
    const requiredConfig = ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET'];
    const missing = requiredConfig.filter(key => !process.env[key] && !this.config[key]);
    
    if (missing.length > 0 && !this.config.skipValidation) {
      throw new Error(`Missing Twitch configuration: ${missing.join(', ')}`);
    }

    this.client = {
      connected: true,
      apiVersion: 'helix',
      endpoint: 'https://api.twitch.tv/helix',
      channelId: process.env.TWITCH_CHANNEL_ID || 'mock_channel_123456789',
      permissions: {
        'moderator:manage:banned_users': true,
        'moderator:manage:chat_messages': false, // Limited message deletion
        'channel:moderate': true
      }
    };
    
    this.isInitialized = true;
    this.log('info', 'Twitch Shield Adapter initialized (MOCK)');
  }

  async hideComment(input) {
    this.validateInput(input, ['commentId']);
    
    const startTime = Date.now();
    
    try {
      await this.simulateLatency();
      
      // Twitch has very limited message deletion capabilities
      // Only for specific chat scenarios
      const result = this.createSuccessResult('hide_comment', {
        messageId: input.commentId,
        channelId: this.client.channelId,
        platform: 'twitch',
        method: 'timeout_user_alternative',
        note: 'Twitch does not support message deletion. Consider timeout/ban instead.',
        alternative: 'timeout_user',
        apiLimitation: 'Chat messages cannot be individually deleted via API'
      }, Date.now() - startTime, true); // requiresManualReview = true

      this.log('info', 'Comment hide queued for manual review (MOCK)', {
        commentId: input.commentId,
        reason: 'API limitation'
      });

      return result;

    } catch (error) {
      this.log('error', 'Failed to hide comment (MOCK)', {
        commentId: input.commentId,
        error: error.message
      });
      
      return this.createErrorResult('hide_comment', error, Date.now() - startTime);
    }
  }

  async reportUser(input) {
    this.validateInput(input, ['userId']);
    
    const startTime = Date.now();
    
    try {
      await this.simulateLatency();
      
      // Twitch doesn't have API for user reporting
      const result = this.createSuccessResult('report_user', {
        userId: input.userId,
        platform: 'twitch',
        method: 'manual_review_required',
        reportUrl: 'https://www.twitch.tv/user/report',
        note: 'Twitch user reporting must be done through web interface or Creator Dashboard',
        alternative: 'timeout_or_ban'
      }, Date.now() - startTime, true);

      this.log('info', 'User report queued for manual review (MOCK)', {
        userId: input.userId,
        reason: input.reason
      });

      return result;

    } catch (error) {
      return this.createErrorResult('report_user', error, Date.now() - startTime);
    }
  }

  async blockUser(input) {
    // In Twitch, "blocking" means banning from the channel
    return await this.banUser(input);
  }

  async banUser(input) {
    this.validateInput(input, ['userId']);
    
    const startTime = Date.now();
    
    try {
      await this.checkRateLimit();
      await this.simulateLatency();
      
      if (this.shouldSimulateFailure()) {
        throw new Error('Twitch API: Insufficient scope');
      }

      // Simulate permission check
      if (!this.client.permissions['moderator:manage:banned_users']) {
        throw new Error('Missing required scope: moderator:manage:banned_users');
      }

      // Mock successful ban
      const result = this.createSuccessResult('ban_user', {
        userId: input.userId,
        channelId: this.client.channelId,
        reason: input.reason || 'Shield: Inappropriate behavior',
        endpoint: 'POST /moderation/bans',
        banned: true,
        permanent: true,
        note: 'User permanently banned from channel'
      }, Date.now() - startTime);

      this.log('info', 'User banned successfully (MOCK)', {
        userId: input.userId,
        channelId: this.client.channelId,
        reason: input.reason
      });

      return result;

    } catch (error) {
      this.log('error', 'Failed to ban user (MOCK)', {
        userId: input.userId,
        error: error.message
      });
      
      return this.createErrorResult('ban_user', error, Date.now() - startTime);
    }
  }

  async unblockUser(input) {
    // In Twitch, "unblocking" means unbanning from the channel
    return await this.unbanUser(input);
  }

  async unbanUser(input) {
    this.validateInput(input, ['userId']);
    
    const startTime = Date.now();
    
    try {
      await this.checkRateLimit();
      await this.simulateLatency();
      
      if (this.shouldSimulateFailure()) {
        throw new Error('Twitch API: User not found');
      }

      // Simulate permission check
      if (!this.client.permissions['moderator:manage:banned_users']) {
        throw new Error('Missing required scope: moderator:manage:banned_users');
      }

      // Mock successful unban
      const result = this.createSuccessResult('unban_user', {
        userId: input.userId,
        channelId: this.client.channelId,
        endpoint: 'DELETE /moderation/bans',
        unbanned: true,
        note: 'User can now participate in chat again'
      }, Date.now() - startTime);

      this.log('info', 'User unbanned successfully (MOCK)', {
        userId: input.userId,
        channelId: this.client.channelId
      });

      return result;

    } catch (error) {
      return this.createErrorResult('unban_user', error, Date.now() - startTime);
    }
  }

  /**
   * Twitch-specific: Timeout a user (temporary ban)
   */
  async timeoutUser(input, duration = '10m') {
    this.validateInput(input, ['userId']);
    
    const startTime = Date.now();
    
    try {
      await this.checkRateLimit();
      await this.simulateLatency();
      
      if (!this.client.permissions['moderator:manage:banned_users']) {
        throw new Error('Missing required scope: moderator:manage:banned_users');
      }

      // Parse duration to seconds
      const durationSeconds = this.parseTimeoutDuration(duration);
      
      const result = this.createSuccessResult('timeout_user', {
        userId: input.userId,
        channelId: this.client.channelId,
        duration: duration,
        durationSeconds: durationSeconds,
        endpoint: 'POST /moderation/bans',
        reason: input.reason || 'Shield: Temporary timeout for rule violation',
        note: 'User temporarily banned from chat'
      }, Date.now() - startTime);

      this.log('info', 'User timed out successfully (MOCK)', {
        userId: input.userId,
        duration: duration,
        seconds: durationSeconds
      });

      return result;

    } catch (error) {
      return this.createErrorResult('timeout_user', error, Date.now() - startTime);
    }
  }

  capabilities() {
    return new CapabilityMap({
      hideComment: false,  // ❌ No message deletion API
      reportUser: false,   // ❌ No API, manual only
      blockUser: true,     // ✅ Via ban API
      unblockUser: true,   // ✅ Via unban API
      platform: 'twitch',
      rateLimits: {
        moderation: '100 requests/minute',
        bans: 'Per endpoint limits',
        note: 'Rate limits are generous for moderation actions'
      },
      scopes: [
        'moderator:manage:banned_users (for bans/timeouts)',
        'channel:moderate (general moderation)',
        'moderator:manage:chat_messages (limited message actions)'
      ],
      fallbacks: {
        hideComment: 'timeout_user',     // If can't delete message, timeout user
        reportUser: 'timeout_user',      // If can't report, timeout instead
        blockUser: 'timeout_user'        // Timeout before permanent ban
      },
      additionalActions: {
        timeoutUser: true,               // Twitch-specific timeout
        slowMode: true,                  // Chat slow mode
        followersOnly: true,             // Followers-only chat
        subscribersOnly: true            // Subscribers-only chat
      },
      apiSpecifics: {
        maxTimeoutDuration: '1209600 seconds (14 days)',
        minTimeoutDuration: '1 second',
        messageDeletion: 'Very limited, mostly for recent messages',
        modScope: 'Requires moderator status in the channel'
      }
    });
  }

  isRateLimitError(error) {
    return error.message.includes('rate limit') || 
           error.message.includes('Too Many Requests') ||
           error.message.includes('429') ||
           error.status === 429;
  }

  /**
   * Check Twitch moderation rate limit
   */
  async checkRateLimit() {
    const now = Date.now();
    
    // Reset counter if time window has passed
    if (now >= this.rateLimits.moderation.resetTime) {
      this.rateLimits.moderation.requests = 0;
      this.rateLimits.moderation.resetTime = now + 60000; // 1 minute
    }
    
    // Check if we're at the limit
    if (this.rateLimits.moderation.requests >= this.rateLimits.moderation.limit) {
      const waitTime = this.rateLimits.moderation.resetTime - now;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.rateLimits.moderation.requests++;
  }

  /**
   * Parse timeout duration to seconds (Twitch expects seconds)
   */
  parseTimeoutDuration(duration) {
    const match = duration.match(/^(\d+)([smhd])$/);
    
    if (!match) {
      // Default to 10 minutes
      return 600;
    }
    
    const [, amount, unit] = match;
    const multipliers = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400
    };
    
    const seconds = parseInt(amount) * (multipliers[unit] || 60);
    
    // Twitch has limits: 1 second to 1209600 seconds (14 days)
    return Math.min(Math.max(seconds, 1), 1209600);
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

module.exports = TwitchShieldAdapter;