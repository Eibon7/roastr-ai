const FetchCommentsWorker = require('./FetchCommentsWorker');
const { logger } = require('./../utils/logger'); // Issue #971: Added for console.log replacement
const AnalyzeToxicityWorker = require('./AnalyzeToxicityWorker');
const GenerateReplyWorker = require('./GenerateReplyWorker');
const ShieldActionWorker = require('./ShieldActionWorker');
const BillingWorker = require('./BillingWorker');
const StyleProfileWorker = require('./StyleProfileWorker');
const PublisherWorker = require('./PublisherWorker');

/**
 * Worker Manager for Roastr.ai Multi-Tenant Architecture
 * 
 * Manages lifecycle and coordination of all worker types:
 * - FetchCommentsWorker: Retrieves comments from platforms
 * - AnalyzeToxicityWorker: Analyzes comment toxicity
 * - GenerateReplyWorker: Creates roast responses
 * - ShieldActionWorker: Executes Shield protection actions
 * - BillingWorker: Processes billing events and notifications
 * - StyleProfileWorker: Extracts and refreshes user style profiles (Pro/Plus)
 * 
 * Features:
 * - Graceful startup and shutdown
 * - Health monitoring and statistics
 * - Dynamic worker scaling
 * - Error handling and recovery
 */
class WorkerManager {
  constructor(options = {}) {
    this.options = {
      enabledWorkers: ['fetch_comments', 'analyze_toxicity', 'generate_reply', 'shield_action', 'billing'],
      workerConfig: {},
      healthCheckInterval: 30000, // 30 seconds
      ...options
    };
    
    this.workers = new Map();
    this.isRunning = false;
    this.startTime = null;
    this.healthCheckTimer = null;
    
    // Worker class mapping
    this.workerClasses = {
      'fetch_comments': FetchCommentsWorker,
      'analyze_toxicity': AnalyzeToxicityWorker,
      'generate_reply': GenerateReplyWorker,
      'shield_action': ShieldActionWorker,
      'billing': BillingWorker,
      'style_profile': StyleProfileWorker,
      'post_response': PublisherWorker
    };
    
    this.log('info', 'Worker Manager initialized', {
      enabledWorkers: this.options.enabledWorkers,
      availableWorkers: Object.keys(this.workerClasses)
    });
  }
  
  /**
   * Start all configured workers
   */
  async start() {
    if (this.isRunning) {
      throw new Error('Worker Manager is already running');
    }
    
    this.log('info', 'Starting Worker Manager');
    this.startTime = Date.now();
    
    try {
      // Start each enabled worker type
      for (const workerType of this.options.enabledWorkers) {
        await this.startWorker(workerType);
      }
      
      this.isRunning = true;
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.log('info', 'Worker Manager started successfully', {
        workersStarted: this.workers.size,
        workerTypes: Array.from(this.workers.keys())
      });
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
    } catch (error) {
      this.log('error', 'Failed to start Worker Manager', { error: error.message });
      await this.stop(); // Clean up any partially started workers
      throw error;
    }
  }
  
  /**
   * Stop all workers gracefully
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }
    
    this.log('info', 'Stopping Worker Manager gracefully');
    this.isRunning = false;
    
    // Stop health monitoring
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    // Stop all workers
    const stopPromises = Array.from(this.workers.values()).map(worker => 
      worker.stop().catch(error => 
        this.log('error', 'Error stopping worker', { 
          workerName: worker.workerName, 
          error: error.message 
        })
      )
    );
    
    await Promise.all(stopPromises);
    this.workers.clear();
    
    const uptime = Date.now() - this.startTime;
    this.log('info', 'Worker Manager stopped', { uptime });
  }
  
  /**
   * Start a specific worker type
   */
  async startWorker(workerType) {
    const WorkerClass = this.workerClasses[workerType];
    
    if (!WorkerClass) {
      throw new Error(`Unknown worker type: ${workerType}`);
    }
    
    this.log('info', `Starting ${workerType} worker`);
    
    try {
      const workerConfig = this.options.workerConfig[workerType] || {};
      const worker = new WorkerClass(workerConfig);
      
      await worker.start();
      this.workers.set(workerType, worker);
      
      this.log('info', `${workerType} worker started successfully`, {
        workerName: worker.workerName
      });
      
    } catch (error) {
      this.log('error', `Failed to start ${workerType} worker`, {
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Stop a specific worker type
   */
  async stopWorker(workerType) {
    const worker = this.workers.get(workerType);
    
    if (!worker) {
      throw new Error(`Worker ${workerType} is not running`);
    }
    
    this.log('info', `Stopping ${workerType} worker`);
    
    try {
      await worker.stop();
      this.workers.delete(workerType);
      
      this.log('info', `${workerType} worker stopped successfully`);
      
    } catch (error) {
      this.log('error', `Failed to stop ${workerType} worker`, {
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Restart a specific worker type
   */
  async restartWorker(workerType) {
    this.log('info', `Restarting ${workerType} worker`);
    
    try {
      if (this.workers.has(workerType)) {
        await this.stopWorker(workerType);
      }
      
      await this.startWorker(workerType);
      
      this.log('info', `${workerType} worker restarted successfully`);
      
    } catch (error) {
      this.log('error', `Failed to restart ${workerType} worker`, {
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.options.healthCheckInterval);
  }
  
  /**
   * Perform health check on all workers
   */
  async performHealthCheck() {
    const healthReport = {
      timestamp: new Date().toISOString(),
      managerUptime: Date.now() - this.startTime,
      totalWorkers: this.workers.size,
      healthyWorkers: 0,
      workers: {}
    };
    
    // Perform detailed health checks on each worker
    for (const [workerType, worker] of this.workers.entries()) {
      try {
        const workerHealth = await worker.healthcheck();
        healthReport.workers[workerType] = workerHealth;
        
        if (workerHealth.status === 'healthy') {
          healthReport.healthyWorkers++;
        }
        
        // Log unhealthy workers
        if (workerHealth.status === 'unhealthy' || workerHealth.status === 'error') {
          this.log('warn', `Unhealthy worker detected`, {
            workerType,
            workerName: worker.workerName,
            status: workerHealth.status,
            checks: workerHealth.checks
          });
        }
      } catch (error) {
        this.log('error', `Failed to perform health check on ${workerType}`, {
          error: error.message
        });
        
        healthReport.workers[workerType] = {
          status: 'error',
          error: error.message,
          workerType,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    // Determine overall health status
    if (healthReport.healthyWorkers === 0 && healthReport.totalWorkers > 0) {
      healthReport.overallStatus = 'unhealthy';
    } else if (healthReport.healthyWorkers < healthReport.totalWorkers) {
      healthReport.overallStatus = 'warning';
    } else {
      healthReport.overallStatus = 'healthy';
    }
    
    // Log summary (debug level to avoid spam)
    if (process.env.DEBUG === 'true') {
      this.log('debug', 'Health check completed', healthReport);
    }
    
    return healthReport;
  }
  
  /**
   * Get comprehensive statistics
   */
  getStats() {
    const stats = {
      managerStatus: {
        isRunning: this.isRunning,
        startTime: this.startTime,
        uptime: this.startTime ? Date.now() - this.startTime : 0,
        totalWorkers: this.workers.size,
        enabledWorkers: this.options.enabledWorkers
      },
      workers: {}
    };
    
    for (const [workerType, worker] of this.workers.entries()) {
      stats.workers[workerType] = worker.getStats();
    }
    
    return stats;
  }
  
  /**
   * Get summary metrics
   */
  getSummary() {
    let totalProcessed = 0;
    let totalFailed = 0;
    let totalCurrent = 0;
    
    for (const worker of this.workers.values()) {
      const workerStats = worker.getStats();
      totalProcessed += workerStats.processedJobs;
      totalFailed += workerStats.failedJobs;
      totalCurrent += workerStats.currentJobs;
    }
    
    return {
      isRunning: this.isRunning,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      workersCount: this.workers.size,
      totalJobsProcessed: totalProcessed,
      totalJobsFailed: totalFailed,
      currentJobsProcessing: totalCurrent,
      successRate: totalProcessed > 0 ? 
        ((totalProcessed - totalFailed) / totalProcessed * 100).toFixed(2) + '%' : 'N/A'
    };
  }
  
  /**
   * Get comprehensive health status
   * This is a public method for external access to health checks
   */
  async getHealthStatus() {
    return await this.performHealthCheck();
  }
  
  /**
   * Add a new worker type dynamically
   */
  async addWorker(workerType, WorkerClass, config = {}) {
    if (this.workerClasses[workerType]) {
      throw new Error(`Worker type ${workerType} already exists`);
    }
    
    this.log('info', `Adding new worker type: ${workerType}`);
    
    this.workerClasses[workerType] = WorkerClass;
    
    if (this.isRunning) {
      await this.startWorker(workerType);
    }
  }
  
  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGQUIT'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        this.log('info', `Received ${signal}, shutting down Worker Manager`);
        try {
          await this.stop();
          process.exit(0);
        } catch (error) {
          this.log('error', 'Error during graceful shutdown', { error: error.message });
          process.exit(1);
        }
      });
    });
    
    process.on('uncaughtException', async (error) => {
      this.log('error', 'Uncaught exception in Worker Manager', { error: error.message });
      await this.stop();
      process.exit(1);
    });
    
    process.on('unhandledRejection', async (reason) => {
      this.log('error', 'Unhandled promise rejection in Worker Manager', { reason });
      await this.stop();
      process.exit(1);
    });
  }
  
  /**
   * Logging utility
   */
  log(level, message, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: 'WorkerManager',
      message,
      ...metadata
    };
    
    logger.info(`[${level.toUpperCase()}] ${JSON.stringify(logEntry)}`);
  }
}

module.exports = WorkerManager;