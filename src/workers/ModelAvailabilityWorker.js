/**
 * Model Availability Worker
 * Daily background job to check GPT-5 availability and update model preferences
 * Issue #326: Automatic GPT-5 detection
 */

const { getModelAvailabilityService } = require('../services/modelAvailabilityService');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

class ModelAvailabilityWorker {
  constructor() {
    this.serviceName = 'ModelAvailabilityWorker';
    this.intervalMs = 24 * 60 * 60 * 1000; // 24 hours
    this.isRunning = false;
    this.intervalId = null;
    this.modelService = getModelAvailabilityService();
  }

  /**
   * Start the worker with periodic checks
   */
  start() {
    if (this.isRunning) {
      logger.warn('ModelAvailabilityWorker already running');
      return;
    }

    logger.info('🚀 Starting ModelAvailabilityWorker', {
      intervalHours: this.intervalMs / (60 * 60 * 1000),
      service: this.serviceName
    });

    // Run initial check
    this.runCheck();

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.runCheck();
    }, this.intervalMs);

    this.isRunning = true;
  }

  /**
   * Stop the worker
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('⏹️ Stopped ModelAvailabilityWorker');
  }

  /**
   * Run a single availability check
   */
  async runCheck() {
    const startTime = Date.now();

    try {
      logger.info('🔍 Running model availability check...', {
        worker: this.serviceName,
        timestamp: new Date().toISOString()
      });

      // Force refresh model availability
      const status = await this.modelService.forceRefresh();

      const processingTime = Date.now() - startTime;

      // Log results
      logger.info('✅ Model availability check completed', {
        worker: this.serviceName,
        processingTimeMs: processingTime,
        gpt5Available: status.gpt5Available,
        modelsChecked: Object.keys(status.models || {}).length,
        nextCheck: status.nextCheck
      });

      // Special logging if GPT-5 becomes available
      if (status.gpt5Available) {
        logger.info('🎉 GPT-5 IS NOW AVAILABLE! All paid plans will automatically use GPT-5.', {
          worker: this.serviceName,
          timestamp: new Date().toISOString(),
          impact: 'Paid plans (Starter, Pro, Plus, Custom) now use GPT-5',
          models: status.models
        });

        // Optionally send notification (could be implemented later)
        await this.notifyGPT5Available(status);
      }

      return status;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error('❌ Model availability check failed', {
        worker: this.serviceName,
        error: error.message,
        stack: error.stack,
        processingTimeMs: processingTime
      });

      throw error;
    }
  }

  /**
   * Get current worker status
   */
  getStatus() {
    return {
      serviceName: this.serviceName,
      isRunning: this.isRunning,
      intervalMs: this.intervalMs,
      intervalHours: this.intervalMs / (60 * 60 * 1000),
      nextCheck: this.intervalId ? new Date(Date.now() + this.intervalMs) : null
    };
  }

  /**
   * Run manual check (for admin use)
   */
  async runManualCheck() {
    logger.info('🔧 Running manual model availability check', {
      worker: this.serviceName,
      trigger: 'manual'
    });

    return await this.runCheck();
  }

  /**
   * Get model usage statistics
   */
  async getStats() {
    try {
      return await this.modelService.getModelStats();
    } catch (error) {
      logger.error('Failed to get model stats', {
        worker: this.serviceName,
        error: error.message
      });
      return {};
    }
  }

  /**
   * Notify when GPT-5 becomes available (placeholder for future implementation)
   */
  async notifyGPT5Available(status) {
    try {
      // Future: Could send notifications via:
      // - Email to admins
      // - Slack webhook
      // - Discord webhook
      // - Database notification

      logger.info('📢 GPT-5 availability notification sent', {
        worker: this.serviceName,
        status: status,
        notificationChannels: ['logs'] // Expand as needed
      });

      // For now, just log to system
      // In the future, could implement actual notification sending
    } catch (error) {
      logger.error('Failed to send GPT-5 notification', {
        worker: this.serviceName,
        error: error.message
      });
    }
  }
}

// Export both the class and a singleton instance
let workerInstance = null;

/**
 * Get the singleton worker instance
 */
function getModelAvailabilityWorker() {
  if (!workerInstance) {
    workerInstance = new ModelAvailabilityWorker();
  }
  return workerInstance;
}

/**
 * Start the model availability worker (used in main app)
 */
function startModelAvailabilityWorker() {
  const worker = getModelAvailabilityWorker();
  worker.start();
  return worker;
}

/**
 * Stop the model availability worker
 */
function stopModelAvailabilityWorker() {
  if (workerInstance) {
    workerInstance.stop();
  }
}

// CLI support for standalone execution
if (require.main === module) {
  logger.info('🏃 Running ModelAvailabilityWorker standalone...');

  const worker = getModelAvailabilityWorker();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('📟 Received SIGINT, shutting down worker...');
    worker.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('📟 Received SIGTERM, shutting down worker...');
    worker.stop();
    process.exit(0);
  });

  // Start the worker
  worker.start();

  // Log status every 30 minutes in standalone mode
  setInterval(
    () => {
      const status = worker.getStatus();
      logger.info('⚡ ModelAvailabilityWorker status', status);
    },
    30 * 60 * 1000
  );

  logger.info('✅ ModelAvailabilityWorker started in standalone mode');
  logger.info('💡 Use Ctrl+C to stop');
}

module.exports = {
  ModelAvailabilityWorker,
  getModelAvailabilityWorker,
  startModelAvailabilityWorker,
  stopModelAvailabilityWorker
};
