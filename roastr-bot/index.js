#!/usr/bin/env node

/**
 * Roastr.ai Twitter Bot - Main Entry Point
 * 
 * This bot monitors Twitter mentions and automatically responds with AI-generated roasts.
 * 
 * Features:
 * - Real-time mention monitoring
 * - AI-powered roast generation via Roastr.ai API
 * - Anti-spam and anti-loop filtering
 * - Debug mode support
 * - Dry run mode for testing
 * - Future-ready for multi-account support
 * 
 * Usage:
 *   node index.js
 * 
 * Environment Variables:
 *   DEBUG=true|false - Enable/disable debug logging
 *   DRY_RUN=true|false - Enable dry run mode (no actual tweets)
 *   MENTION_POLL_INTERVAL_MS - Polling interval in milliseconds
 */

require('dotenv').config();

const TwitterService = require('./services/twitterService');
const RoastService = require('./services/roastService');
const logger = require('./utils/logger');

class RoastrBot {
  constructor() {
    this.isRunning = false;
    this.pollInterval = null;
    this.twitterService = null;
    this.roastService = null;
    
    // Configuration from environment
    this.config = {
      pollIntervalMs: parseInt(process.env.MENTION_POLL_INTERVAL_MS) || 30000,
      isDryRun: process.env.DRY_RUN === 'true',
      isDebug: process.env.DEBUG === 'true'
    };

    logger.info('🤖 Roastr.ai Twitter Bot inicializándose...');
    logger.debug('⚙️ Configuración:', this.config);
  }

  /**
   * Initialize all services
   */
  async initialize() {
    try {
      logger.info('🚀 Inicializando servicios...');

      // Initialize Twitter service
      this.twitterService = new TwitterService();
      await this.twitterService.initialize();

      // Initialize Roast service
      this.roastService = new RoastService();

      // Test connections
      await this._testConnections();

      logger.info('✅ Todos los servicios inicializados correctamente');
      return true;
    } catch (error) {
      logger.error('❌ Error durante la inicialización:', error.message);
      throw error;
    }
  }

  /**
   * Test all service connections
   * @private
   */
  async _testConnections() {
    logger.debug('🔍 Probando conexiones...');

    const twitterOk = await this.twitterService.testConnection();
    const roastOk = await this.roastService.testConnection();

    if (!twitterOk) {
      throw new Error('Twitter API connection failed');
    }

    if (!roastOk) {
      throw new Error('Roast API connection failed');
    }

    logger.debug('✅ Todas las conexiones funcionando');
  }

  /**
   * Start the bot
   */
  async start() {
    try {
      if (this.isRunning) {
        logger.warn('⚠️ Bot ya está ejecutándose');
        return;
      }

      logger.info('🚀 Iniciando Roastr.ai Twitter Bot...');
      
      if (this.config.isDryRun) {
        logger.info('🧪 MODO DRY RUN ACTIVADO - No se enviarán tweets reales');
      }

      this.isRunning = true;

      // Start the polling loop
      await this._startPolling();

      logger.info(`✅ Bot iniciado - Monitoreando menciones cada ${this.config.pollIntervalMs}ms`);
    } catch (error) {
      logger.error('❌ Error al iniciar el bot:', error.message);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the bot
   */
  async stop() {
    try {
      if (!this.isRunning) {
        logger.info('ℹ️ Bot ya estaba detenido');
        return;
      }

      logger.info('🛑 Deteniendo bot...');
      
      this.isRunning = false;
      
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }

      logger.info('✅ Bot detenido correctamente');
    } catch (error) {
      logger.error('❌ Error al detener el bot:', error.message);
      throw error;
    }
  }

  /**
   * Start the mention polling loop
   * @private
   */
  async _startPolling() {
    // Initial poll
    await this._pollMentions();

    // Set up interval for continuous polling
    this.pollInterval = setInterval(async () => {
      if (this.isRunning) {
        try {
          await this._pollMentions();
        } catch (error) {
          logger.error('❌ Error en polling de menciones:', error.message);
          // Continue polling despite errors
        }
      }
    }, this.config.pollIntervalMs);
  }

  /**
   * Poll for new mentions and process them
   * @private
   */
  async _pollMentions() {
    try {
      logger.debug('🔍 Buscando nuevas menciones...');

      // Get mentions from Twitter
      const mentions = await this.twitterService.getMentions();
      
      if (mentions.length === 0) {
        logger.debug('📭 No hay nuevas menciones');
        return;
      }

      // Filter mentions that should be processed
      const filteredMentions = this.twitterService.filterMentions(mentions);
      
      if (filteredMentions.length === 0) {
        logger.debug('🚫 No hay menciones válidas para procesar');
        return;
      }

      logger.info(`📬 Procesando ${filteredMentions.length} menciones nuevas`);

      // Process each filtered mention
      for (const mention of filteredMentions) {
        try {
          await this._processMention(mention);
          
          // Add delay between processing to avoid rate limits
          await this._sleep(2000);
        } catch (error) {
          logger.error(`❌ Error procesando mención ${mention.id}:`, error.message);
          // Continue with next mention
        }
      }
    } catch (error) {
      logger.error('❌ Error en _pollMentions:', error.message);
      throw error;
    }
  }

  /**
   * Process a single mention
   * @param {object} mention - Twitter mention object
   * @private
   */
  async _processMention(mention) {
    try {
      logger.debug(`🔄 Procesando mención ${mention.id}...`);

      // Process the mention to extract clean text
      const processedMention = this.twitterService.processMention(mention);
      
      if (!processedMention.cleanText || processedMention.cleanText.length < 3) {
        logger.debug(`⏭️ Mención ${mention.id} no tiene suficiente contenido para roast`);
        return;
      }

      // Generate roast
      logger.debug(`🔥 Generando roast para: "${processedMention.cleanText}"`);
      const roast = await this.roastService.generateRoast(processedMention.cleanText);

      // Reply with the roast
      const reply = await this.twitterService.replyToMention(mention.id, roast);

      // Log success
      const stats = this.getStats();
      logger.info(`✅ Mención ${mention.id} procesada exitosamente`);
      logger.debug('📊 Stats:', stats);

      return reply;
    } catch (error) {
      logger.error(`❌ Error procesando mención ${mention.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Get bot statistics
   * @returns {object} Current bot statistics
   */
  getStats() {
    const twitterStats = this.twitterService ? this.twitterService.getStats() : {};
    const roastConfig = this.roastService ? this.roastService.getConfig() : {};

    return {
      isRunning: this.isRunning,
      config: this.config,
      uptime: process.uptime(),
      twitter: twitterStats,
      roast: roastConfig,
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Graceful shutdown handler
   * @private
   */
  async _setupGracefulShutdown() {
    const shutdown = async (signal) => {
      logger.info(`📡 Received ${signal}, shutting down gracefully...`);
      
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during shutdown:', error.message);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('❌ Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    // Create bot instance
    const bot = new RoastrBot();
    
    // Setup graceful shutdown
    await bot._setupGracefulShutdown();

    // Initialize services
    await bot.initialize();

    // Start the bot
    await bot.start();

    // Keep the process alive and show periodic stats
    setInterval(() => {
      if (bot.isRunning) {
        const stats = bot.getStats();
        logger.debug('📊 Bot Stats:', {
          uptime: `${Math.floor(stats.uptime / 60)}m ${Math.floor(stats.uptime % 60)}s`,
          processedMentions: stats.twitter.processedMentions,
          memoryUsage: `${Math.round(stats.memory.heapUsed / 1024 / 1024)}MB`
        });
      }
    }, 300000); // Every 5 minutes

  } catch (error) {
    logger.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Export for testing or programmatic use
module.exports = RoastrBot;

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    logger.error('❌ Startup failed:', error.message);
    process.exit(1);
  });
}