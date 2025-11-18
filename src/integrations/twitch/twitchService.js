const BaseIntegration = require('../base/BaseIntegration');

/**
 * Twitch Integration Service
 * 
 * Handles Twitch streaming platform integration for:
 * - Chat message monitoring
 * - Subscriber/follower interactions
 * - Channel point rewards
 * - Moderation commands
 */
class TwitchService extends BaseIntegration {
  constructor(config) {
    super({
      platform: 'twitch',
      enabled: process.env.TWITCH_ENABLED === 'true',
      tone: process.env.TWITCH_TONE || 'playful',
      // Issue #868: Removed humorType (deprecated - tone is now sole selector)
      responseFrequency: parseFloat(process.env.TWITCH_RESPONSE_FREQUENCY) || 0.4,
      maxResponsesPerHour: parseInt(process.env.TWITCH_MAX_RESPONSES_PER_HOUR) || 20,
      ...config
    });
    
    this.clientId = process.env.TWITCH_CLIENT_ID;
    this.clientSecret = process.env.TWITCH_CLIENT_SECRET;
    this.accessToken = process.env.TWITCH_ACCESS_TOKEN;
    this.refreshToken = process.env.TWITCH_REFRESH_TOKEN;
    this.channelName = process.env.TWITCH_CHANNEL_NAME;
    this.botUsername = process.env.TWITCH_BOT_USERNAME;
    
    // Twitch-specific settings
    this.triggerWords = (process.env.TWITCH_TRIGGER_WORDS || 'roast,burn,savage,bot,rekt').split(',');
    this.subscriberOnly = process.env.TWITCH_SUBSCRIBER_ONLY === 'true';
    this.modOnly = process.env.TWITCH_MOD_ONLY === 'true';
    this.channelPointsEnabled = process.env.TWITCH_CHANNEL_POINTS_ENABLED === 'true';
    this.commandPrefix = process.env.TWITCH_COMMAND_PREFIX || '!';
    
    this.chatClient = null;
    this.apiClient = null;
  }
  
  /**
   * Authenticate with Twitch API and IRC
   */
  async authenticate() {
    this.log('info', 'Authenticating with Twitch API and IRC');
    
    if (!this.clientId || !this.accessToken) {
      throw new Error('Twitch credentials not configured');
    }
    
    try {
      // Initialize Twitch API client
      const { ApiClient } = require('@twurple/api');
      const { StaticAuthProvider } = require('@twurple/auth');
      
      const authProvider = new StaticAuthProvider(this.clientId, this.accessToken);
      this.apiClient = new ApiClient({ authProvider });
      
      // Verify token and get user info
      const tokenInfo = await this.apiClient.getTokenInfo();
      const user = await this.apiClient.users.getUserByName(this.channelName);
      
      this.log('info', 'Twitch authentication successful', {
        userId: tokenInfo.userId,
        channelName: this.channelName,
        scopes: tokenInfo.scopes
      });
      
      return {
        success: true,
        userId: tokenInfo.userId,
        channelName: this.channelName,
        channelId: user.id
      };
      
    } catch (error) {
      this.log('error', 'Twitch authentication failed', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Initialize Twitch service
   */
  async initialize() {
    this.log('info', 'Initializing Twitch service');
    
    if (!this.enabled) {
      this.log('warn', 'Twitch integration is disabled');
      return { success: false, reason: 'disabled' };
    }
    
    try {
      await this.authenticate();
      await this.connectToChat();
      
      return { success: true };
      
    } catch (error) {
      this.log('error', 'Failed to initialize Twitch service', { error: error.message });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Connect to Twitch IRC chat
   */
  async connectToChat() {
    try {
      const { ChatClient } = require('@twurple/chat');
      const { StaticAuthProvider } = require('@twurple/auth');
      
      const authProvider = new StaticAuthProvider(this.clientId, this.accessToken, ['chat:read', 'chat:edit']);
      
      this.chatClient = new ChatClient({
        authProvider,
        channels: [this.channelName]
      });
      
      // Set up chat event handlers
      this.setupChatHandlers();
      
      // Connect to chat
      await this.chatClient.connect();
      
      this.log('info', 'Connected to Twitch chat', {
        channel: this.channelName
      });
      
    } catch (error) {
      this.log('error', 'Failed to connect to Twitch chat', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Setup Twitch chat event handlers
   */
  setupChatHandlers() {
    this.chatClient.onMessage(async (channel, user, text, msg) => {
      await this.handleChatMessage(channel, user, text, msg);
    });
    
    this.chatClient.onSub((channel, user) => {
      this.log('info', 'New subscriber', { channel, user });
    });
    
    this.chatClient.onResub((channel, user, subInfo) => {
      this.log('info', 'Resubscriber', { 
        channel, 
        user, 
        months: subInfo.months 
      });
    });
    
    this.chatClient.onSubGift((channel, user, subInfo) => {
      this.log('info', 'Gift sub', { 
        channel, 
        gifter: user, 
        recipient: subInfo.displayName 
      });
    });
    
    this.chatClient.onRaid((channel, user, raidInfo) => {
      this.log('info', 'Channel raid', {
        channel,
        raider: user,
        viewers: raidInfo.viewerCount
      });
    });
  }
  
  /**
   * Handle incoming chat message
   */
  async handleChatMessage(channel, user, text, messageInfo) {
    try {
      // Skip own messages
      if (user === this.botUsername) return;
      
      // Check subscriber requirement
      if (this.subscriberOnly && !messageInfo.userInfo.isSubscriber && !messageInfo.userInfo.isMod) {
        return;
      }
      
      // Check mod requirement
      if (this.modOnly && !messageInfo.userInfo.isMod && !messageInfo.userInfo.isBroadcaster) {
        return;
      }
      
      // Check for commands
      if (text.startsWith(this.commandPrefix)) {
        await this.handleCommand(channel, user, text, messageInfo);
        return;
      }
      
      // Check if message contains trigger words
      const containsTrigger = this.triggerWords.some(word =>
        text.toLowerCase().includes(word.toLowerCase())
      );
      
      // Check if bot is mentioned
      const isMentioned = text.toLowerCase().includes(this.botUsername?.toLowerCase() || 'roastbot');
      
      if (containsTrigger || isMentioned) {
        await this.processChatMessage(channel, user, text, messageInfo);
      }
      
    } catch (error) {
      this.log('error', 'Error handling Twitch chat message', {
        error: error.message,
        user,
        text: text.substring(0, 50)
      });
    }
  }
  
  /**
   * Handle Twitch chat commands
   */
  async handleCommand(channel, user, text, messageInfo) {
    const command = text.toLowerCase().split(' ')[0].substring(1); // Remove ! prefix
    const args = text.split(' ').slice(1);
    
    switch (command) {
      case 'roast':
        await this.handleRoastCommand(channel, user, args, messageInfo);
        break;
      case 'roastme':
        await this.handleRoastMeCommand(channel, user, args, messageInfo);
        break;
      case 'roaststats':
        await this.handleStatsCommand(channel, user, args, messageInfo);
        break;
      default:
        // Unknown command - ignore or provide help
        break;
    }
  }
  
  /**
   * Handle !roast command
   */
  async handleRoastCommand(channel, user, args, messageInfo) {
    try {
      const target = args.length > 0 ? args.join(' ') : 
        'your request for a roast';
      
      // Check rate limits
      if (!(await this.checkRateLimit())) {
        await this.chatClient.say(channel, 
          `@${user} Hold up! I'm roasting too fast. Give me a moment to cool down! 🔥`);
        return;
      }
      
      // Generate roast
      const roastResponse = await this.generateRoast(target);
      
      if (!roastResponse || !roastResponse.roast) {
        await this.chatClient.say(channel, 
          `@${user} Sorry, I couldn't come up with a good roast right now. My creativity is buffering! 📡`);
        return;
      }
      
      // Post roast to chat
      await this.chatClient.say(channel, `@${user} ${roastResponse.roast}`);
      
      // Update rate limit tracking
      await this.updateRateLimit();
      
      this.log('info', 'Roast command executed', {
        user,
        channel,
        target: target.substring(0, 30)
      });
      
    } catch (error) {
      this.log('error', 'Error handling roast command', { error: error.message });
      
      await this.chatClient.say(channel, 
        `@${user} Oops! Something went wrong while generating your roast. Try again!`);
    }
  }
  
  /**
   * Handle !roastme command
   */
  async handleRoastMeCommand(channel, user, args, messageInfo) {
    const roastTarget = `${user}'s request to be roasted`;
    
    // Generate self-deprecating roast
    const roastResponse = await this.generateRoast(roastTarget);
    
    if (roastResponse?.roast) {
      await this.chatClient.say(channel, `@${user} ${roastResponse.roast}`);
      await this.updateRateLimit();
    }
  }
  
  /**
   * Handle !roaststats command
   */
  async handleStatsCommand(channel, user, args, messageInfo) {
    // TODO: Implement roast statistics
    await this.chatClient.say(channel, 
      `@${user} Roast stats coming soon! 📊`);
  }
  
  /**
   * Process regular chat message for roast generation
   */
  async processChatMessage(channel, user, text, messageInfo) {
    try {
      this.log('info', 'Processing Twitch chat message', {
        user,
        channel,
        isSubscriber: messageInfo.userInfo.isSubscriber,
        isMod: messageInfo.userInfo.isMod
      });
      
      // Check response frequency
      if (Math.random() > this.responseFrequency) {
        this.log('info', 'Skipping message based on response frequency');
        return { skipped: true, reason: 'frequency' };
      }
      
      // Check rate limits
      if (!(await this.checkRateLimit())) {
        this.log('warn', 'Rate limit reached, skipping message');
        return { skipped: true, reason: 'rate_limit' };
      }
      
      // Generate roast response
      const roastResponse = await this.generateRoast(text);
      
      if (!roastResponse || !roastResponse.roast) {
        this.log('warn', 'Failed to generate roast response');
        return { error: 'Failed to generate response' };
      }
      
      // Post response to chat
      await this.chatClient.say(channel, `@${user} ${roastResponse.roast}`);
      
      // Update rate limit tracking
      await this.updateRateLimit();
      
      return {
        success: true,
        user,
        response: roastResponse.roast
      };
      
    } catch (error) {
      this.log('error', 'Error processing Twitch chat message', {
        user,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Listen for chat messages (real-time via IRC)
   */
  async listenForMentions() {
    this.log('info', 'Twitch chat listener is active via IRC');
    
    // Twitch uses real-time IRC connection, no polling needed
    return {
      success: true,
      message: 'Real-time Twitch chat listener active',
      channel: this.channelName,
      triggerWords: this.triggerWords,
      commands: [`${this.commandPrefix}roast`, `${this.commandPrefix}roastme`]
    };
  }
  
  /**
   * Post response to Twitch chat
   */
  async postResponse(originalMessage, responseText) {
    // This method signature matches BaseIntegration but for Twitch
    // the actual posting happens in processChatMessage
    
    this.log('info', 'Posting Twitch chat response');
    
    try {
      await this.chatClient.say(this.channelName, responseText);
      
      return {
        success: true,
        platform: 'twitch'
      };
      
    } catch (error) {
      this.log('error', 'Failed to post Twitch response', { error: error.message });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Run batch processing (Twitch doesn't need batch mode - uses real-time)
   */
  async runBatch() {
    if (!this.enabled) {
      return { success: false, reason: 'Twitch integration disabled' };
    }
    
    // Twitch operates in real-time, so batch mode just reports status
    return {
      success: true,
      platform: 'twitch',
      message: 'Twitch operates in real-time mode',
      isConnected: this.chatClient?.isConnected || false,
      channel: this.channelName
    };
  }
  
  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.chatClient) {
      this.log('info', 'Disconnecting Twitch chat client');
      await this.chatClient.quit();
      this.chatClient = null;
    }
  }
}

module.exports = TwitchService;