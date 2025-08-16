const BaseWorker = require('./BaseWorker');
const ShieldService = require('../services/shieldService');

/**
 * Shield Action Worker
 * 
 * Dedicated worker for executing Shield protection actions:
 * - Platform-specific moderation actions (mute, block, ban)
 * - Automated response to high-toxicity content
 * - User behavior escalation handling
 * - Integration with platform APIs for enforcement
 */
class ShieldActionWorker extends BaseWorker {
  constructor(options = {}) {
    super('shield_action', {
      maxConcurrency: 2, // Limited concurrency for Shield actions
      pollInterval: 1000, // Fast response for Shield
      maxRetries: 3,
      ...options
    });
    
    this.shieldService = new ShieldService();
    this.platformClients = new Map();
    
    // Initialize platform clients for Shield actions
    this.initializePlatformClients();
  }
  
  /**
   * Get worker-specific health details
   */
  async getSpecificHealthDetails() {
    const details = {
      platformClients: {},
      shieldStats: {
        totalActions: this.totalActions || 0,
        byType: this.actionsByType || {},
        byPlatform: this.actionsByPlatform || {},
        successRate: this.successRate || 'N/A',
        lastAction: this.lastActionTime || null
      },
      escalations: {
        total: this.totalEscalations || 0,
        autoBlocks: this.autoBlocks || 0,
        reportsFiled: this.reportsFiled || 0,
        manualReviewQueue: this.manualReviewQueue || 0
      },
      performance: {
        avgActionTime: this.avgActionTime || 'N/A',
        queuedActions: this.queuedActions || 0,
        failedActions: this.failedActions || 0
      }
    };
    
    // Check each platform client status
    for (const [platform, client] of this.platformClients.entries()) {
      details.platformClients[platform] = {
        initialized: !!client,
        status: client ? 'available' : 'not configured',
        lastUsed: this[`last${platform}Use`] || null
      };
    }
    
    // Add Shield service status
    details.shieldService = {
      enabled: !!this.shieldService,
      mode: this.shieldService?.mode || 'unknown',
      ruleCount: this.shieldService?.ruleCount || 0
    };
    
    return details;
  }
  
  /**
   * Initialize clients for different platforms
   */
  initializePlatformClients() {
    // Twitter client for Shield actions
    if (process.env.TWITTER_BEARER_TOKEN) {
      const { TwitterApi } = require('twitter-api-v2');
      this.platformClients.set('twitter', new TwitterApi(process.env.TWITTER_BEARER_TOKEN, {
        appKey: process.env.TWITTER_APP_KEY,
        appSecret: process.env.TWITTER_APP_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET
      }));
    }
    
    // Discord client for Shield actions
    if (process.env.DISCORD_BOT_TOKEN) {
      const { Client, GatewayIntentBits } = require('discord.js');
      const discordClient = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.GuildModeration
        ]
      });
      
      // Store promise to login later when needed
      this.platformClients.set('discord', discordClient);
    }
    
    // Twitch client for Shield actions
    if (process.env.TWITCH_CLIENT_ID && process.env.TWITCH_ACCESS_TOKEN) {
      const { ApiClient } = require('@twurple/api');
      const { StaticAuthProvider } = require('@twurple/auth');
      
      const authProvider = new StaticAuthProvider(
        process.env.TWITCH_CLIENT_ID, 
        process.env.TWITCH_ACCESS_TOKEN
      );
      
      this.platformClients.set('twitch', new ApiClient({ authProvider }));
    }
  }
  
  /**
   * Process Shield action job
   */
  async processJob(job) {
    const { 
      comment_id,
      organization_id, 
      platform, 
      platform_user_id,
      platform_username,
      action,
      duration,
      shield_mode 
    } = job.payload || job;
    
    if (!shield_mode) {
      throw new Error('Shield action job must be in Shield mode');
    }
    
    this.log('info', 'Processing Shield action', {
      commentId: comment_id,
      platform,
      platformUserId: platform_user_id,
      action,
      duration
    });
    
    try {
      // Execute platform-specific action
      const result = await this.executePlatformAction(
        platform,
        action,
        platform_user_id,
        platform_username,
        duration,
        comment_id
      );
      
      // Record action in database
      await this.recordShieldAction(
        organization_id,
        comment_id,
        platform,
        platform_user_id,
        action,
        result
      );
      
      // Update user behavior
      await this.updateUserBehavior(
        organization_id,
        platform,
        platform_user_id,
        action,
        result.success
      );
      
      return {
        success: true,
        summary: `Shield action executed: ${action} on ${platform}`,
        platform,
        action,
        result: result.success,
        details: result.details
      };
      
    } catch (error) {
      this.log('error', 'Shield action failed', {
        commentId: comment_id,
        platform,
        action,
        error: error.message
      });
      
      // Record failed action
      await this.recordShieldAction(
        organization_id,
        comment_id,
        platform,
        platform_user_id,
        action,
        { success: false, error: error.message }
      );
      
      throw error;
    }
  }
  
  /**
   * Execute platform-specific Shield action
   */
  async executePlatformAction(platform, action, userId, username, duration, commentId) {
    const client = this.platformClients.get(platform);
    
    if (!client) {
      throw new Error(`No ${platform} client configured for Shield actions`);
    }
    
    switch (platform) {
      case 'twitter':
        return await this.executeTwitterAction(client, action, userId, username, duration);
      case 'discord':
        return await this.executeDiscordAction(client, action, userId, username, duration);
      case 'twitch':
        return await this.executeTwitchAction(client, action, userId, username, duration);
      case 'youtube':
        return await this.executeYouTubeAction(client, action, userId, username, commentId);
      default:
        throw new Error(`Shield actions not implemented for platform: ${platform}`);
    }
  }
  
  /**
   * Execute Twitter Shield action
   */
  async executeTwitterAction(client, action, userId, username, duration) {
    try {
      switch (action) {
        case 'reply_warning':
          // Reply with warning message
          const warningTweet = await client.v2.reply(
            `@${username} This comment violates our community guidelines. Please keep discussions respectful.`,
            commentId // This would need to be the original tweet ID
          );
          
          return {
            success: true,
            details: { tweetId: warningTweet.data.id, type: 'warning_reply' }
          };
          
        case 'mute_user':
          // Mute user (requires elevated API access)
          await client.v1.createMute(userId);
          
          return {
            success: true,
            details: { type: 'user_muted', duration, userId }
          };
          
        case 'block_user':
          // Block user
          await client.v1.createBlock(userId);
          
          return {
            success: true,
            details: { type: 'user_blocked', userId }
          };
          
        case 'report_user':
          // Report user (this would typically be done through web interface)
          // For now, we'll log it for manual review
          return {
            success: true,
            details: { type: 'user_reported', requiresManualReview: true, userId }
          };
          
        default:
          throw new Error(`Unknown Twitter Shield action: ${action}`);
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: { platform: 'twitter', action, userId }
      };
    }
  }
  
  /**
   * Execute Discord Shield action
   */
  async executeDiscordAction(client, action, userId, username, duration) {
    try {
      // Ensure Discord client is logged in
      if (!client.readyAt) {
        await client.login(process.env.DISCORD_BOT_TOKEN);
        await new Promise(resolve => client.once('ready', resolve));
      }
      
      const guild = client.guilds.cache.first(); // Get the main guild
      if (!guild) {
        throw new Error('No Discord guild found');
      }
      
      const member = await guild.members.fetch(userId);
      if (!member) {
        throw new Error(`User ${userId} not found in guild`);
      }
      
      switch (action) {
        case 'send_warning_dm':
          // Send warning via DM
          await member.send(
            'Your recent message violates our community guidelines. Please keep discussions respectful.'
          );
          
          return {
            success: true,
            details: { type: 'warning_dm_sent', userId }
          };
          
        case 'timeout_user':
          // Timeout user (Discord's built-in timeout)
          const timeoutMs = this.parseDuration(duration);
          await member.timeout(timeoutMs, 'Shield: Toxic behavior detected');
          
          return {
            success: true,
            details: { type: 'user_timeout', duration, userId }
          };
          
        case 'remove_voice_permissions':
          // Remove voice channel permissions
          const voiceChannels = guild.channels.cache.filter(ch => ch.type === 'GUILD_VOICE');
          
          for (const [, channel] of voiceChannels) {
            await channel.permissionOverwrites.create(userId, {
              Speak: false,
              Connect: false
            });
          }
          
          return {
            success: true,
            details: { type: 'voice_permissions_removed', userId }
          };
          
        case 'kick_user':
          // Kick user from server
          await member.kick('Shield: Severe toxic behavior detected');
          
          return {
            success: true,
            details: { type: 'user_kicked', userId }
          };
          
        case 'report_to_moderators':
          // Send report to moderators channel
          const modChannel = guild.channels.cache.find(ch => 
            ch.name.includes('mod') && ch.type === 'GUILD_TEXT'
          );
          
          if (modChannel) {
            await modChannel.send(
              `🚨 Shield Alert: User <@${userId}> flagged for toxic behavior. Manual review required.`
            );
          }
          
          return {
            success: true,
            details: { type: 'reported_to_moderators', userId }
          };
          
        default:
          throw new Error(`Unknown Discord Shield action: ${action}`);
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: { platform: 'discord', action, userId }
      };
    }
  }
  
  /**
   * Execute Twitch Shield action
   */
  async executeTwitchAction(client, action, userId, username, duration) {
    try {
      const channelId = process.env.TWITCH_CHANNEL_ID;
      
      if (!channelId) {
        throw new Error('Twitch channel ID not configured');
      }
      
      switch (action) {
        case 'timeout_user':
          // Timeout user in chat
          const timeoutSeconds = this.parseDurationToSeconds(duration);
          await client.moderation.banUser(channelId, {
            userId: userId,
            duration: timeoutSeconds,
            reason: 'Shield: Toxic behavior detected'
          });
          
          return {
            success: true,
            details: { type: 'user_timeout', duration, userId }
          };
          
        case 'ban_user':
          // Permanently ban user
          await client.moderation.banUser(channelId, {
            userId: userId,
            reason: 'Shield: Severe toxic behavior'
          });
          
          return {
            success: true,
            details: { type: 'user_banned', userId }
          };
          
        case 'report_to_twitch':
          // Create report to Twitch (limited API support)
          return {
            success: true,
            details: { 
              type: 'reported_to_twitch', 
              requiresManualReview: true,
              userId 
            }
          };
          
        default:
          throw new Error(`Unknown Twitch Shield action: ${action}`);
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: { platform: 'twitch', action, userId }
      };
    }
  }
  
  /**
   * Execute YouTube Shield action
   */
  async executeYouTubeAction(client, action, userId, username, commentId) {
    try {
      // Note: YouTube API has limited moderation capabilities
      
      switch (action) {
        case 'reply_warning':
          // Reply with warning (if API access available)
          return {
            success: true,
            details: { 
              type: 'warning_reply_pending',
              requiresManualReview: true,
              commentId 
            }
          };
          
        case 'report_comment':
          // Report comment to YouTube
          return {
            success: true,
            details: { 
              type: 'comment_reported',
              requiresManualReview: true,
              commentId 
            }
          };
          
        default:
          return {
            success: false,
            error: `YouTube Shield action '${action}' requires manual execution`,
            details: { platform: 'youtube', action, userId }
          };
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: { platform: 'youtube', action, userId }
      };
    }
  }
  
  /**
   * Record Shield action in database
   */
  async recordShieldAction(organizationId, commentId, platform, userId, action, result) {
    try {
      await this.supabase
        .from('app_logs')
        .insert({
          organization_id: organizationId,
          level: result.success ? 'info' : 'error',
          category: 'shield_action',
          message: `Shield action ${result.success ? 'executed' : 'failed'}: ${action}`,
          platform,
          metadata: {
            commentId,
            userId,
            action,
            result,
            executedAt: new Date().toISOString()
          }
        });
        
    } catch (error) {
      this.log('error', 'Failed to record Shield action', {
        commentId,
        error: error.message
      });
    }
  }
  
  /**
   * Update user behavior after Shield action
   */
  async updateUserBehavior(organizationId, platform, userId, action, success) {
    if (!success) return;
    
    try {
      const actionRecord = {
        action,
        date: new Date().toISOString(),
        success,
        executedBy: 'shield_worker'
      };
      
      const { error } = await this.supabase
        .from('user_behaviors')
        .upsert({
          organization_id: organizationId,
          platform,
          platform_user_id: userId,
          actions_taken: [actionRecord], // Will be merged with existing
          is_blocked: ['block_user', 'ban_user', 'kick_user'].includes(action),
          last_seen_at: new Date().toISOString()
        }, {
          onConflict: 'organization_id,platform,platform_user_id',
          ignoreDuplicates: false
        });
      
      if (error) throw error;
      
    } catch (error) {
      this.log('error', 'Failed to update user behavior after Shield action', {
        userId,
        error: error.message
      });
    }
  }
  
  /**
   * Parse duration string to milliseconds
   */
  parseDuration(duration) {
    if (!duration) return 600000; // 10 minutes default
    
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 600000;
    
    const [, amount, unit] = match;
    const multipliers = {
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000
    };
    
    return parseInt(amount) * (multipliers[unit] || 60000);
  }
  
  /**
   * Parse duration string to seconds
   */
  parseDurationToSeconds(duration) {
    return Math.floor(this.parseDuration(duration) / 1000);
  }
}

module.exports = ShieldActionWorker;