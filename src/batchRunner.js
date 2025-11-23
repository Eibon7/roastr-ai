#!/usr/bin/env node

const IntegrationManager = require('./integrations/integrationManager');

/**
 * Batch runner for all Roastr.ai integrations
 * This script runs all active integrations once and exits
 */
class BatchRunner {
  constructor() {
    this.integrationManager = new IntegrationManager();
    this.debug = process.env.DEBUG === 'true';
  }

  /**
   * Debug logging utility
   */
  debugLog(message, ...args) {
    if (this.debug) {
      console.log(`[BATCH-RUNNER] ${new Date().toISOString()}: ${message}`, ...args);
    }
  }

  /**
   * Run batch processing for all integrations
   */
  async run() {
    try {
      console.log('🚀 Starting Roastr.ai Batch Runner...');
      const startTime = Date.now();

      // Initialize all integrations
      this.debugLog('Initializing integrations...');
      const initResult = await this.integrationManager.initializeIntegrations();

      if (initResult.success === 0) {
        console.log('⚠️ No integrations were successfully initialized');
        process.exit(0);
      }

      console.log(
        `✅ Initialized ${initResult.success} integrations (${initResult.failed} failed)`
      );

      // Run batch processing
      this.debugLog('Starting batch processing...');
      const batchResult = await this.integrationManager.runBatch();

      // Graceful shutdown
      this.debugLog('Shutting down integrations...');
      await this.integrationManager.shutdown();

      // Final summary
      const totalTime = Date.now() - startTime;
      console.log(`🏁 Batch Runner completed in ${totalTime}ms`);
      console.log(
        `📊 Final stats: ${batchResult.success}/${batchResult.processed} integrations successful`
      );

      // Exit with appropriate code
      const exitCode = batchResult.failed > 0 ? 1 : 0;
      process.exit(exitCode);
    } catch (error) {
      console.error('❌ Critical error in Batch Runner:', error.message);

      if (this.debug) {
        console.error('Stack trace:', error.stack);
      }

      // Attempt graceful shutdown
      try {
        await this.integrationManager.shutdown();
      } catch (shutdownError) {
        console.error('❌ Error during shutdown:', shutdownError.message);
      }

      process.exit(1);
    }
  }

  /**
   * Handle process signals for graceful shutdown
   */
  setupSignalHandlers() {
    const signals = ['SIGINT', 'SIGTERM'];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

        try {
          await this.integrationManager.shutdown();
          console.log('✅ Shutdown complete');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during shutdown:', error.message);
          process.exit(1);
        }
      });
    });
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  const runner = new BatchRunner();

  // Setup signal handlers for graceful shutdown
  runner.setupSignalHandlers();

  // Run the batch processor
  runner.run().catch((error) => {
    console.error('❌ Unhandled error in batch runner:', error.message);
    process.exit(1);
  });
}

module.exports = BatchRunner;
