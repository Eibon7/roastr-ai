const MultiTenantIntegration = require('../base/MultiTenantIntegration');

/**
 * Discord Integration Service
 * 
 * Handles Discord server integration for:
 * - Server message monitoring
 * - Direct message responses
 * - Slash command support
 * - Role-based permissions
 */
class DiscordService extends MultiTenantIntegration {
  constructor(options = {}) {
    super('discord', {
      rateLimit: 100,
      supportDirectPosting: true,
      supportModeration: true,
      ...options
    });
    
    this.botToken = process.env.DISCORD_BOT_TOKEN;
    this.clientId = process.env.DISCORD_CLIENT_ID;
    this.guildId = process.env.DISCORD_GUILD_ID;
    this.monitoredChannels = (process.env.DISCORD_MONITORED_CHANNELS || '').split(',').filter(Boolean);
    
    // Discord-specific settings
    this.triggerWords = (process.env.DISCORD_TRIGGER_WORDS || 'roast,burn,insult,comeback,bot').split(',');
    this.mentionTrigger = process.env.DISCORD_MENTION_TRIGGER !== 'false'; // Respond to mentions by default
    this.dmEnabled = process.env.DISCORD_DM_ENABLED === 'true';
    this.slashCommands = process.env.DISCORD_SLASH_COMMANDS === 'true';
    
    this.client = null;
  }
  
  /**
   * Authenticate with Discord API
   */
  async authenticate() {
    this.log('info', 'Authenticating with Discord API');
    
    if (!this.botToken) {
      throw new Error('Discord bot token not configured');
    }
    
    try {
      const { Client, GatewayIntentBits } = require('discord.js');
      
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.DirectMessages
        ]
      });
      
      // Set up event handlers
      this.setupEventHandlers();
      
      // Login to Discord
      await this.client.login(this.botToken);
      
      this.log('info', 'Discord authentication successful', {
        username: this.client.user.username,
        id: this.client.user.id
      });
      
      return {
        success: true,
        username: this.client.user.username,
        id: this.client.user.id
      };
      
    } catch (error) {
      this.log('error', 'Discord authentication failed', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Initialize Discord service
   */
  async initialize() {
    this.log('info', 'Initializing Discord service');
    
    if (!this.enabled) {
      this.log('warn', 'Discord integration is disabled');
      return { success: false, reason: 'disabled' };
    }
    
    try {
      await this.authenticate();
      
      // Register slash commands if enabled
      if (this.slashCommands) {
        await this.registerSlashCommands();
      }
      
      return { success: true };
      
    } catch (error) {
      this.log('error', 'Failed to initialize Discord service', { error: error.message });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Setup Discord event handlers
   */
  setupEventHandlers() {
    this.client.on('ready', () => {
      this.log('info', `Discord bot logged in as ${this.client.user.tag}`);
    });
    
    this.client.on('messageCreate', async (message) => {
      await this.handleMessage(message);
    });
    
    this.client.on('interactionCreate', async (interaction) => {
      await this.handleInteraction(interaction);
    });
    
    this.client.on('error', (error) => {
      this.log('error', 'Discord client error', { error: error.message });
    });
  }
  
  /**
   * Handle incoming Discord message
   */
  async handleMessage(message) {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Check if message is in monitored channels
    if (this.monitoredChannels.length > 0 && 
        !this.monitoredChannels.includes(message.channel.id)) {
      return;
    }
    
    // Check if bot is mentioned
    const isMentioned = message.mentions.has(this.client.user);
    
    // Check if message contains trigger words
    const containsTrigger = this.triggerWords.some(word =>
      message.content.toLowerCase().includes(word.toLowerCase())
    );
    
    // Decide whether to respond
    if (!isMentioned && !containsTrigger) {
      return;
    }
    
    await this.processMessage(message);
  }
  
  /**
   * Handle Discord slash command interactions
   */
  async handleInteraction(interaction) {
    if (!interaction.isChatInputCommand()) return;
    
    switch (interaction.commandName) {
      case 'roast':
        await this.handleRoastCommand(interaction);
        break;
      case 'settings':
        await this.handleSettingsCommand(interaction);
        break;
      default:
        await interaction.reply({ 
          content: 'Unknown command!', 
          ephemeral: true 
        });
    }
  }
  
  /**
   * Process Discord message for roast generation
   */
  async processMessage(message) {
    try {
      this.log('info', 'Processing Discord message', {
        messageId: message.id,
        author: message.author.username,
        channel: message.channel.name || 'DM',
        guild: message.guild?.name || 'Direct Message'
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
      const roastResponse = await this.generateRoast(message.content);
      
      if (!roastResponse || !roastResponse.roast) {
        this.log('warn', 'Failed to generate roast response');
        return { error: 'Failed to generate response' };
      }
      
      // Post response
      const postResult = await this.postResponse(message, roastResponse.roast);
      
      return {
        success: true,
        messageId: message.id,
        response: roastResponse.roast,
        posted: postResult.success
      };
      
    } catch (error) {
      this.log('error', 'Error processing Discord message', {
        messageId: message.id,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Handle /roast slash command
   */
  async handleRoastCommand(interaction) {
    const targetMessage = interaction.options.getString('message') || 
      'Your request for a roast';
    
    try {
      // Generate roast
      const roastResponse = await this.generateRoast(targetMessage);
      
      if (!roastResponse || !roastResponse.roast) {
        await interaction.reply({
          content: 'Sorry, I couldn\'t come up with a good roast right now. Try again!',
          ephemeral: true
        });
        return;
      }
      
      await interaction.reply({
        content: roastResponse.roast
      });
      
      // Update rate limit tracking
      await this.updateRateLimit();
      
    } catch (error) {
      this.log('error', 'Error handling roast command', { error: error.message });
      
      await interaction.reply({
        content: 'Oops! Something went wrong while generating your roast.',
        ephemeral: true
      });
    }
  }
  
  /**
   * Handle /settings slash command
   */
  async handleSettingsCommand(interaction) {
    // Check if user has permissions to change settings
    if (!interaction.member.permissions.has('MANAGE_GUILD')) {
      await interaction.reply({
        content: 'You need Manage Server permissions to change bot settings.',
        ephemeral: true
      });
      return;
    }
    
    // TODO: Implement settings management UI
    await interaction.reply({
      content: `Current settings:\n- Tone: ${this.tone}\n- Humor: ${this.humorType}\n- Frequency: ${this.responseFrequency}\n\nSettings management coming soon!`,
      ephemeral: true
    });
  }
  
  /**
   * Post response to Discord
   */
  async postResponse(originalMessage, responseText) {
    this.log('info', 'Posting Discord response', {
      messageId: originalMessage.id,
      responseLength: responseText.length
    });
    
    try {
      const sentMessage = await originalMessage.reply(responseText);
      
      this.log('info', 'Discord response posted successfully', {
        responseId: sentMessage.id,
        originalMessageId: originalMessage.id
      });
      
      // Update rate limit tracking
      await this.updateRateLimit();
      
      return {
        success: true,
        responseId: sentMessage.id,
        platform: 'discord'
      };
      
    } catch (error) {
      this.log('error', 'Failed to post Discord response', {
        messageId: originalMessage.id,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Register slash commands with Discord
   */
  async registerSlashCommands() {
    try {
      const { REST, Routes } = require('discord.js');
      
      const commands = [
        {
          name: 'roast',
          description: 'Get a roast for a message or topic',
          options: [{
            name: 'message',
            type: 3, // STRING
            description: 'The message or topic to roast',
            required: false
          }]
        },
        {
          name: 'settings',
          description: 'View or modify bot settings (Admin only)',
          default_member_permissions: '32' // MANAGE_GUILD
        }
      ];
      
      const rest = new REST().setToken(this.botToken);
      
      if (this.guildId) {
        // Register guild-specific commands (faster updates)
        await rest.put(
          Routes.applicationGuildCommands(this.clientId, this.guildId),
          { body: commands }
        );
        
        this.log('info', 'Discord slash commands registered for guild', {
          guildId: this.guildId,
          commands: commands.length
        });
      } else {
        // Register global commands (takes up to 1 hour to update)
        await rest.put(
          Routes.applicationCommands(this.clientId),
          { body: commands }
        );
        
        this.log('info', 'Discord slash commands registered globally', {
          commands: commands.length
        });
      }
      
    } catch (error) {
      this.log('error', 'Failed to register Discord slash commands', { 
        error: error.message 
      });
    }
  }
  
  /**
   * Listen for Discord messages (real-time via WebSocket)
   */
  async listenForMentions() {
    this.log('info', 'Discord real-time listener is active via WebSocket');
    
    // Discord uses real-time WebSocket connection, no polling needed
    return {
      success: true,
      message: 'Real-time Discord listener active',
      monitoredChannels: this.monitoredChannels.length || 'all',
      triggerWords: this.triggerWords
    };
  }
  
  /**
   * Run batch processing (Discord doesn't need batch mode - uses real-time)
   */
  async runBatch() {
    if (!this.enabled) {
      return { success: false, reason: 'Discord integration disabled' };
    }
    
    // Discord operates in real-time, so batch mode just reports status
    return {
      success: true,
      platform: 'discord',
      message: 'Discord operates in real-time mode',
      isConnected: this.client?.readyAt !== null,
      guilds: this.client?.guilds?.cache?.size || 0
    };
  }
  
  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.client) {
      this.log('info', 'Disconnecting Discord client');
      await this.client.destroy();
      this.client = null;
    }
  }
}

module.exports = DiscordService;