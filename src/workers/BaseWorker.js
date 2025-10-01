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
    this.lastActivityTime = null;
    this.processingTimes = [];
    this.maxProcessingTimeSamples = 100; // Keep last 100 samples
    
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
        // Safety check: ensure currentJobs is properly initialized
        if (this.currentJobs && this.currentJobs.size === 0) {
          clearInterval(checkInterval);
          if (timeoutHandle) clearTimeout(timeoutHandle);
          resolve();
        } else if (!this.currentJobs) {
          // If currentJobs was never initialized (processingLoop never ran), resolve immediately
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
    
    // TODO: Implement cleanup timeout to prevent hanging cleanup operations
    // TODO: Add cleanup verification tests that check for resource leaks
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
      
      // Execute the job with retry logic
      const result = await this.executeJobWithRetry(job);
      
      const processingTime = Date.now() - startTime;
      
      // Track processing time for health metrics
      this.processingTimes.push(processingTime);
      if (this.processingTimes.length > this.maxProcessingTimeSamples) {
        this.processingTimes.shift(); // Remove oldest sample
      }
      
      // Update activity time
      this.updateActivityTime();
      
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
   * Execute job with retry logic and exponential backoff
   */
  async executeJobWithRetry(job) {
    let lastError = null;
    const maxAttempts = this.config.maxRetries + 1; // Total attempts = initial + retries
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.log('debug', 'Job attempt', { 
          jobId: job.id, 
          attempt, 
          maxAttempts 
        });
        
        // Execute the job (implemented by subclasses)
        const result = await this._processJobInternal(job);
        
        // Success - return result
        if (attempt > 1) {
          this.log('info', 'Job succeeded after retry', { 
            jobId: job.id, 
            attempt,
            totalAttempts: attempt
          });
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          this.log('warn', 'Non-retryable error encountered', {
            jobId: job.id,
            attempt,
            error: error.message
          });
          throw error;
        }
        
        // If this was the last attempt, throw the error
        if (attempt >= maxAttempts) {
          this.log('error', 'Job failed after all retry attempts', {
            jobId: job.id,
            totalAttempts: attempt,
            maxAttempts,
            error: error.message
          });
          throw error;
        }
        
        // Calculate exponential backoff delay
        const delay = this.calculateRetryDelay(attempt);
        
        this.log('warn', 'Job attempt failed, retrying', {
          jobId: job.id,
          attempt,
          maxAttempts,
          nextRetryIn: delay,
          error: error.message
        });
        
        // Wait before retry
        await this.sleep(delay);
      }
    }
    
    // This should not be reached, but just in case
    throw lastError;
  }
  
  /**
   * Determine if an error is retryable
   */
  isRetryableError(error) {
    // Don't retry permanent errors
    const permanentErrorPatterns = [
      /invalid.*authentication/i,
      /unauthorized/i,
      /401/,
      /403/,
      /api.*key.*invalid/i,
      /forbidden/i
    ];
    
    const errorMessage = error.message || '';
    
    for (const pattern of permanentErrorPatterns) {
      if (pattern.test(errorMessage)) {
        return false;
      }
    }
    
    // Retry transient errors
    const retryablePatterns = [
      /network/i,
      /connection/i,
      /timeout/i,
      /econnreset/i,
      /rate.*limit/i,
      /429/,
      /500/,
      /502/,
      /503/,
      /504/
    ];
    
    for (const pattern of retryablePatterns) {
      if (pattern.test(errorMessage)) {
        return true;
      }
    }
    
    // Default to retryable for unknown errors
    return true;
  }
  
  /**
   * Calculate exponential backoff delay
   */
  calculateRetryDelay(attempt) {
    const baseDelay = this.config.retryDelay || 1000;
    const maxDelay = this.config.maxRetryDelay || 30000;
    
    // Exponential backoff: baseDelay * (2 ^ (attempt - 1))
    const delay = baseDelay * Math.pow(2, attempt - 1);
    
    // Cap at maximum delay
    return Math.min(delay, maxDelay);
  }
  
  /**
   * Internal job processing method (to be implemented by subclasses)
   */
  async _processJobInternal(job) {
    throw new Error('_processJobInternal method must be implemented by subclass');
  }

  /**
   * Process a single job (default implementation uses retry wrapper)
   */
  async processJob(job) {
    return await this.executeJobWithRetry(job);
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

    // Always increment failed jobs counter, regardless of queue service success
    this.failedJobs++;

    try {
      await this.queueService.failJob(job, error);
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
    // Skip setup in test environment to prevent EventEmitter leaks
    if (process.env.NODE_ENV === 'test' || process.env.IS_TEST === '1') {
      return;
    }
    
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
  
  /**
   * Perform health check
   * Returns detailed health status of the worker
   */
  async healthcheck() {
    const health = {
      status: 'unknown',
      workerType: this.workerType,
      workerName: this.workerName,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks: {
        running: { status: 'unknown', message: '' },
        database: { status: 'unknown', message: '' },
        queue: { status: 'unknown', message: '' },
        processing: { status: 'unknown', message: '' },
        performance: { status: 'unknown', message: '' }
      },
      metrics: {
        processedJobs: this.processedJobs,
        failedJobs: this.failedJobs,
        currentJobs: this.currentJobs ? this.currentJobs.size : 0,
        successRate: this.processedJobs > 0 
          ? ((this.processedJobs - this.failedJobs) / this.processedJobs * 100).toFixed(2) + '%' 
          : 'N/A',
        lastActivity: this.lastActivityTime || null,
        avgProcessingTime: this.getAverageProcessingTime()
      },
      details: {}
    };
    
    try {
      // Check if worker is running
      health.checks.running.status = this.isRunning ? 'healthy' : 'unhealthy';
      health.checks.running.message = this.isRunning ? 'Worker is running' : 'Worker is stopped';
      
      // Check database connection
      if (mockMode.isMockMode) {
        health.checks.database.status = 'healthy';
        health.checks.database.message = 'Mock mode - database check skipped';
      } else {
        try {
          const { error } = await this.supabase
            .from('organizations')
            .select('id')
            .limit(1)
            .single();
          
          health.checks.database.status = error ? 'unhealthy' : 'healthy';
          health.checks.database.message = error ? `Database error: ${error.message}` : 'Database connection OK';
        } catch (err) {
          health.checks.database.status = 'unhealthy';
          health.checks.database.message = `Database check failed: ${err.message}`;
        }
      }
      
      // Check queue connection
      if (mockMode.isMockMode) {
        health.checks.queue.status = 'healthy';
        health.checks.queue.message = 'Mock mode - queue check skipped';
      } else {
        try {
          // Check if queue service is initialized
          if (this.queueService && typeof this.queueService.getNextJob === 'function') {
            health.checks.queue.status = 'healthy';
            health.checks.queue.message = 'Queue service is operational';
          } else {
            health.checks.queue.status = 'unhealthy';
            health.checks.queue.message = 'Queue service not properly initialized';
          }
        } catch (err) {
          health.checks.queue.status = 'unhealthy';
          health.checks.queue.message = `Queue check failed: ${err.message}`;
        }
      }
      
      // Check processing health
      const timeSinceLastActivity = this.lastActivityTime 
        ? Date.now() - this.lastActivityTime 
        : null;
      
      if (this.processedJobs === 0 && this.failedJobs === 0) {
        health.checks.processing.status = 'healthy';
        health.checks.processing.message = 'No jobs processed yet';
      } else if (timeSinceLastActivity && timeSinceLastActivity > 300000) { // 5 minutes
        health.checks.processing.status = 'warning';
        health.checks.processing.message = `No activity for ${Math.round(timeSinceLastActivity / 1000 / 60)} minutes`;
      } else {
        health.checks.processing.status = 'healthy';
        health.checks.processing.message = 'Processing normally';
      }
      
      // Check performance metrics
      const failureRate = this.processedJobs > 0 
        ? (this.failedJobs / this.processedJobs * 100) 
        : 0;
      
      if (failureRate > 50) {
        health.checks.performance.status = 'unhealthy';
        health.checks.performance.message = `High failure rate: ${failureRate.toFixed(2)}%`;
      } else if (failureRate > 20) {
        health.checks.performance.status = 'warning';
        health.checks.performance.message = `Elevated failure rate: ${failureRate.toFixed(2)}%`;
      } else {
        health.checks.performance.status = 'healthy';
        health.checks.performance.message = 'Performance metrics within normal range';
      }
      
      // Add worker-specific health details (to be overridden by subclasses)
      if (typeof this.getSpecificHealthDetails === 'function') {
        health.details = await this.getSpecificHealthDetails();
      }
      
      // Determine overall health status
      const statuses = Object.values(health.checks).map(check => check.status);
      if (statuses.includes('unhealthy')) {
        health.status = 'unhealthy';
      } else if (statuses.includes('warning')) {
        health.status = 'warning';
      } else {
        health.status = 'healthy';
      }
      
    } catch (error) {
      health.status = 'error';
      health.error = error.message;
      this.log('error', 'Health check failed', { error: error.message });
    }
    
    return health;
  }
  
  /**
   * Track activity time for health monitoring
   */
  updateActivityTime() {
    this.lastActivityTime = Date.now();
  }
  
  /**
   * Get average processing time
   */
  getAverageProcessingTime() {
    if (!this.processingTimes || this.processingTimes.length === 0) {
      return 'N/A';
    }
    
    const avg = this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
    return `${Math.round(avg)}ms`;
  }
}

module.exports = BaseWorker;