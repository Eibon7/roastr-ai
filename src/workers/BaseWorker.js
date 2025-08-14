const { createClient } = require('@supabase/supabase-js');
const QueueService = require('../services/queueService');
const { mockMode } = require('../config/mockMode');

/**
 * Base Worker Class for Roastr.ai Multi-Tenant Architecture
 * 
 * Provides common functionality for all worker types:
 * - Queue management with Redis/Upstash
 * - Database operations with Supabase
 * - Error handling and retry logic
 * - Job processing lifecycle
 */
class BaseWorker {
  constructor(workerType, options = {}) {
    this.workerType = workerType;
    this.workerName = `${workerType}-worker-${Date.now()}`;
    this.isRunning = false;
    this.processedJobs = 0;
    this.failedJobs = 0;
    this.startTime = Date.now();
    
    // Configuration
    this.config = {
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 5000,
      maxConcurrency: options.maxConcurrency || 3,
      pollInterval: options.pollInterval || 1000,
      gracefulShutdownTimeout: options.gracefulShutdownTimeout || 30000,
      ...options
    };
    
    // Initialize connections
    this.initializeConnections();
    
    // Graceful shutdown handling
    this.setupGracefulShutdown();
  }
  
  /**
   * Initialize database and queue connections
   */
  initializeConnections() {
    if (mockMode.isMockMode) {
      // Use mock clients in mock mode
      this.supabase = mockMode.generateMockSupabaseClient();
      this.queueService = {
        initialize: async () => {},
        getNextJob: async () => null,
        completeJob: async () => {},
        failJob: async () => {},
        shutdown: async () => {}
      };
    } else {
      // Supabase connection
      this.supabaseUrl = process.env.SUPABASE_URL;
      this.supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
      
      if (!this.supabaseUrl || !this.supabaseKey) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
      }
      
      this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
      
      // Initialize unified queue service
      this.queueService = new QueueService();
    }
  }
  
  /**
   * Start the worker
   */
  async start() {
    if (this.isRunning) {
      throw new Error(`Worker ${this.workerName} is already running`);
    }
    
    this.log('info', 'Starting worker', {
      workerType: this.workerType,
      config: {
        ...this.config,
        // Don't log sensitive config
        supabaseUrl: this.supabaseUrl ? 'configured' : 'missing',
        redisUrl: this.redis ? 'configured' : 'missing'
      }
    });
    
    this.isRunning = true;
    
    try {
      // Test connections
      await this.testConnections();
      
      // Start processing loop
      this.processingLoop();
      
      this.log('info', 'Worker started successfully');
      
    } catch (error) {
      this.log('error', 'Failed to start worker', { error: error.message });
      this.isRunning = false;
      throw error;
    }
  }
  
  /**
   * Stop the worker gracefully
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }
    
    this.log('info', 'Stopping worker gracefully');
    this.isRunning = false;
    
    // Wait for current jobs to complete with proper cleanup
    let checkInterval;
    let timeoutHandle;
    
    const stopPromise = new Promise((resolve) => {
      checkInterval = setInterval(() => {
        if (this.currentJobs.size === 0) {
          clearInterval(checkInterval);
          if (timeoutHandle) clearTimeout(timeoutHandle);
          resolve();
        }
      }, 100);
    });
    
    // Force stop after timeout
    const timeoutPromise = new Promise((resolve) => {
      timeoutHandle = setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, this.config.gracefulShutdownTimeout);
    });
    
    await Promise.race([stopPromise, timeoutPromise]);
    
    // Close connections
    if (this.queueService) {
      await this.queueService.shutdown();
    }
    
    this.log('info', 'Worker stopped', {
      processedJobs: this.processedJobs,
      failedJobs: this.failedJobs,
      uptime: Date.now() - this.startTime
    });
  }
  
  /**
   * Test database and queue connections
   */
  async testConnections() {
    if (mockMode.isMockMode) {
      // Skip connection tests in mock mode
      this.log('info', 'Skipping connection tests in mock mode');
      return;
    }
    
    // Test Supabase connection
    const { error: dbError } = await this.supabase
      .from('organizations')
      .select('id')
      .limit(1);
    
    if (dbError) {
      throw new Error(`Database connection failed: ${dbError.message}`);
    }
    
    // Initialize and test queue service
    try {
      await this.queueService.initialize();
    } catch (error) {
      throw new Error(`Queue service initialization failed: ${error.message}`);
    }
  }
  
  /**
   * Main processing loop
   */
  async processingLoop() {
    this.currentJobs = new Map();
    
    while (this.isRunning) {
      try {
        // Check if we can process more jobs
        if (this.currentJobs.size >= this.config.maxConcurrency) {
          await this.sleep(this.config.pollInterval);
          continue;
        }
        
        // Get next job from queue
        const job = await this.getNextJob();
        
        if (!job) {
          await this.sleep(this.config.pollInterval);
          continue;
        }
        
        // Process job asynchronously
        this.processJobAsync(job);
        
      } catch (error) {
        this.log('error', 'Error in processing loop', { error: error.message });
        await this.sleep(this.config.pollInterval * 2); // Longer delay on error
      }
    }
  }
  
  /**
   * Get next job from queue (using QueueService)
   */
  async getNextJob() {
    try {
      return await this.queueService.getNextJob(this.workerType, {
        timeout: 1 // 1 second timeout for non-blocking
      });
    } catch (error) {
      this.log('error', 'Failed to get job from queue', { error: error.message });
      return null;
    }
  }
  
  /**
   * Process job asynchronously
   */
  async processJobAsync(job) {
    const jobId = job.id || `temp-${Date.now()}`;
    this.currentJobs.set(jobId, job);
    
    try {
      this.log('info', 'Processing job', { 
        jobId, 
        jobType: job.job_type || job.type,
        organizationId: job.organization_id
      });
      
      const startTime = Date.now();
      
      // Execute the job (implemented by subclasses)
      const result = await this.processJob(job);
      
      const processingTime = Date.now() - startTime;
      
      // Mark job as completed
      await this.markJobCompleted(job, result, processingTime);
      
      this.processedJobs++;
      
      this.log('info', 'Job completed', {
        jobId,
        processingTime,
        result: result?.summary || 'success'
      });
      
    } catch (error) {
      await this.handleJobError(job, error);
    } finally {
      this.currentJobs.delete(jobId);
    }
  }
  
  /**
   * Process a single job (to be implemented by subclasses)
   */
  async processJob(job) {
    throw new Error('processJob method must be implemented by subclass');
  }
  
  /**
   * Mark job as completed
   */
  async markJobCompleted(job, result, processingTime) {
    try {
      await this.queueService.completeJob(job, {
        result,
        processingTime,
        completedBy: this.workerName
      });
    } catch (error) {
      this.log('error', 'Failed to mark job as completed', { 
        jobId: job.id, 
        error: error.message 
      });
    }
  }
  
  /**
   * Handle job processing error
   */
  async handleJobError(job, error) {
    const jobId = job.id || 'unknown';
    
    this.log('error', 'Job processing failed', {
      jobId,
      error: error.message,
      attempts: job.attempts || 0
    });
    
    try {
      await this.queueService.failJob(job, error);
      this.failedJobs++;
    } catch (failureError) {
      this.log('error', 'Failed to handle job error', {
        jobId,
        error: failureError.message
      });
    }
  }
  
  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGQUIT'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        this.log('info', `Received ${signal}, shutting down gracefully`);
        await this.stop();
        process.exit(0);
      });
    });
    
    process.on('uncaughtException', (error) => {
      this.log('error', 'Uncaught exception', { error: error.message });
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason) => {
      this.log('error', 'Unhandled promise rejection', { reason });
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
      worker: this.workerName,
      workerType: this.workerType,
      message,
      ...metadata
    };
    
    console.log(`[${level.toUpperCase()}] ${JSON.stringify(logEntry)}`);
  }
  
  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get worker statistics
   */
  getStats() {
    return {
      workerName: this.workerName,
      workerType: this.workerType,
      isRunning: this.isRunning,
      processedJobs: this.processedJobs,
      failedJobs: this.failedJobs,
      currentJobs: this.currentJobs.size,
      uptime: Date.now() - this.startTime,
      config: this.config
    };
  }
}

module.exports = BaseWorker;