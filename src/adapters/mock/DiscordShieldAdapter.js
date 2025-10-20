const { ShieldAdapter, ModerationInput, ModerationResult, CapabilityMap } = require('../ShieldAdapter');

/**
 * Mock Discord Shield Adapter
 * 
 * Simulates Discord API moderation capabilities including message deletion,
 * user timeouts, and bans based on research.
 */
class DiscordShieldAdapter extends ShieldAdapter {
  constructor(config = {}) {
    super('discord', config);
    this.mockLatency = config.mockLatency || { min: 150, max: 600 };
    this.failureRate = config.failureRate !== undefined ? config.failureRate : 0.04; // 4% failure rate
    this.globalRateLimit = {
      requests: 0,
      resetTime: Date.now() + 1000, // Reset every second
      limit: 50 // 50 requests per second global
    };
  }

  async initialize() {
    await this.simulateLatency();
    
    // Check for required config
    if (!this.config.skipValidation && !process.env.DISCORD_BOT_TOKEN) {
      throw new Error('Missing Discord bot token configuration');
    }

    this.client = {
      connected: true,
      apiVersion: '10',
      endpoint: 'https://discord.com/api/v10',
      guilds: ['mock_guild_123456789'],
      permissions: {
        MANAGE_MESSAGES: true,
        BAN_MEMBERS: true,
        MODERATE_MEMBERS: true,
        KICK_MEMBERS: true
      }
    };
    
    this.isInitialized = true;
    this.log('info', 'Discord Shield Adapter initialized (MOCK)');
  }

  async hideComment(input) {
    // In Discord, "hiding" a comment means deleting the message
    const result = await this.deleteMessage(input);
    // Ensure action is consistently named for contract compliance
    if (result.action === 'delete_message') {
      result.action = 'hide_comment';
    }
    return result;
  }

  async deleteMessage(input) {
    this.validateInput(input, ['commentId']);
    
    const startTime = Date.now();
    
    try {
      await this.checkRateLimit();
      await this.simulateLatency();
      
      if (this.shouldSimulateFailure()) {
        throw new Error('Discord API: Missing Access');
      }

      // Simulate permission check
      if (!this.client.permissions.MANAGE_MESSAGES) {
        throw new Error('Bot lacks MANAGE_MESSAGES permission');
      }

      // Mock successful message deletion
      const result = this.createSuccessResult('delete_message', {
        messageId: input.commentId,
        channelId: input.metadata.channelId || 'mock_channel_123',
        endpoint: 'DELETE /channels/{channel_id}/messages/{message_id}',
        deleted: true,
        note: 'Message permanently deleted from channel'
      }, Date.now() - startTime);

      this.log('info', 'Message deleted successfully (MOCK)', {
        messageId: input.commentId,
        userId: input.userId
      });

      return result;

    } catch (error) {
      this.log('error', 'Failed to delete message (MOCK)', {
        messageId: input.commentId,
        error: error.message
      });
      
      return this.createErrorResult('delete_message', error, Date.now() - startTime);
    }
  }

  async reportUser(input) {
    this.validateInput(input, ['userId']);
    
    const startTime = Date.now();
    
    try {
      await this.simulateLatency();
      
      // Discord doesn't have API for reporting users to Discord
      const result = this.createSuccessResult('report_user', {
        userId: input.userId,
        platform: 'discord',
        method: 'manual_review_required',
        alternative: 'timeout_or_ban',
        note: 'Discord user reporting must be done through the client interface. Consider timeout or ban instead.',
        reportUrl: 'https://support.discord.com/hc/en-us/requests/new'
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
    // In Discord, "blocking" means banning from the server
    return await this.banUser(input);
  }

  async banUser(input) {
    this.validateInput(input, ['userId']);
    
    const startTime = Date.now();
    
    try {
      await this.checkRateLimit();
      await this.simulateLatency();
      
      if (this.shouldSimulateFailure()) {
        throw new Error('Discord API: Unknown Guild');
      }

      // Simulate permission check
      if (!this.client.permissions.BAN_MEMBERS) {
        throw new Error('Bot lacks BAN_MEMBERS permission');
      }

      // Mock successful ban
      const guildId = input.metadata.guildId || this.client.guilds[0];
      const deleteMessageDays = input.metadata.deleteMessageDays || 7;
      
      const result = this.createSuccessResult('ban_user', {
        userId: input.userId,
        guildId: guildId,
        deleteMessageDays: deleteMessageDays,
        reason: input.reason || 'Shield: Inappropriate behavior',
        endpoint: 'PUT /guilds/{guild_id}/bans/{user_id}',
        banned: true,
        note: `User banned from server with ${deleteMessageDays} days of message history deleted`
      }, Date.now() - startTime);

      this.log('info', 'User banned successfully (MOCK)', {
        userId: input.userId,
        guildId: guildId,
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
    // In Discord, "unblocking" means unbanning from the server
    return await this.unbanUser(input);
  }

  async unbanUser(input) {
    this.validateInput(input, ['userId']);
    
    const startTime = Date.now();
    
    try {
      await this.checkRateLimit();
      await this.simulateLatency();
      
      if (this.shouldSimulateFailure()) {
        throw new Error('Discord API: Member not found');
      }

      // Simulate permission check
      if (!this.client.permissions.BAN_MEMBERS) {
        throw new Error('Bot lacks BAN_MEMBERS permission');
      }

      // Mock successful unban
      const guildId = input.metadata.guildId || this.client.guilds[0];
      
      const result = this.createSuccessResult('unban_user', {
        userId: input.userId,
        guildId: guildId,
        endpoint: 'DELETE /guilds/{guild_id}/bans/{user_id}',
        unbanned: true,
        note: 'User can now rejoin the server'
      }, Date.now() - startTime);

      this.log('info', 'User unbanned successfully (MOCK)', {
        userId: input.userId,
        guildId: guildId
      });

      return result;

    } catch (error) {
      return this.createErrorResult('unban_user', error, Date.now() - startTime);
    }
  }

  /**
   * Discord-specific: Timeout a user (prevents them from participating)
   */
  async timeoutUser(input, duration = '10m') {
    this.validateInput(input, ['userId']);
    
    const startTime = Date.now();
    
    try {
      await this.checkRateLimit();
      await this.simulateLatency();
      
      if (!this.client.permissions.MODERATE_MEMBERS) {
        throw new Error('Bot lacks MODERATE_MEMBERS permission');
      }

      // Parse duration to ISO 8601 timestamp
      const timeoutUntil = this.parseTimeoutDuration(duration);
      const guildId = input.metadata.guildId || this.client.guilds[0];
      
      const result = this.createSuccessResult('timeout_user', {
        userId: input.userId,
        guildId: guildId,
        timeoutUntil: timeoutUntil,
        duration: duration,
        endpoint: 'PATCH /guilds/{guild_id}/members/{user_id}',
        reason: input.reason || 'Shield: Temporary timeout for rule violation',
        note: 'User cannot send messages, react, or join voice channels during timeout'
      }, Date.now() - startTime);

      this.log('info', 'User timed out successfully (MOCK)', {
        userId: input.userId,
        duration: duration,
        until: timeoutUntil
      });

      return result;

    } catch (error) {
      return this.createErrorResult('timeout_user', error, Date.now() - startTime);
    }
  }

  capabilities() {
    return new CapabilityMap({
      hideComment: true,   // ✅ Via message deletion
      reportUser: false,   // ❌ No API, manual only
      blockUser: true,     // ✅ Via ban API
      unblockUser: true,   // ✅ Via unban API
      platform: 'discord',
      rateLimits: {
        global: '50 requests/second',
        deleteMessage: 'Per endpoint limits',
        banUser: 'Per endpoint limits',
        timeoutUser: 'Per endpoint limits',
        note: 'Rate limits can be complex with burst allowances'
      },
      scopes: [
        'Bot permissions required:',
        'MANAGE_MESSAGES (for deleting)',
        'BAN_MEMBERS (for ban/unban)',
        'MODERATE_MEMBERS (for timeouts)',
        'KICK_MEMBERS (for kicks)'
      ],
      fallbacks: {
        reportUser: 'timeout_user',     // If can't report, timeout instead
        hideComment: 'timeout_user',    // If can't delete message, timeout user
        blockUser: 'timeout_user'       // If can't ban, timeout instead
      },
      additionalActions: {
        timeoutUser: true,              // Discord-specific timeout
        kickUser: true,                 // Kick (not ban) user
        removeFromVoice: true           // Remove from voice channels
      }
    });
  }

  isRateLimitError(error) {
    return error.message.includes('rate limit') || 
           error.message.includes('Rate limited') ||
           error.message.includes('429') ||
           error.status === 429;
  }

  /**
   * Check Discord's global rate limit
   */
  async checkRateLimit() {
    const now = Date.now();
    
    // Reset counter if time window has passed
    if (now >= this.globalRateLimit.resetTime) {
      this.globalRateLimit.requests = 0;
      this.globalRateLimit.resetTime = now + 1000;
    }
    
    // Check if we're at the limit
    if (this.globalRateLimit.requests >= this.globalRateLimit.limit) {
      const waitTime = this.globalRateLimit.resetTime - now;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.globalRateLimit.requests++;
  }

  /**
   * Parse timeout duration to ISO 8601 timestamp
   */
  parseTimeoutDuration(duration) {
    const now = new Date();
    const match = duration.match(/^(\d+)([smhd])$/);
    
    if (!match) {
      // Default to 10 minutes
      return new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    }
    
    const [, amount, unit] = match;
    const multipliers = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };
    
    const milliseconds = parseInt(amount) * (multipliers[unit] || 60000);
    return new Date(now.getTime() + milliseconds).toISOString();
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

module.exports = DiscordShieldAdapter;