const { createClient } = require('@supabase/supabase-js');
const FetchCommentsWorker = require('../../src/workers/FetchCommentsWorker');
const QueueService = require('../../src/services/queueService');

/**
 * Utility functions for Ingestor integration tests
 * Provides setup, cleanup, and assertion helpers
 */
class IngestorTestUtils {
  constructor() {
    this.supabase = null;
    this.queueService = null;
    this.workers = [];
    this.setupComplete = false;
    this.mockStoredComments = [];
    this.mockStoredJobs = [];
    
    // Set up global mock storage for stateful testing
    if (typeof global !== 'undefined') {
      global.mockCommentStorage = global.mockCommentStorage || [];
    }
  }

  /**
   * Initialize test environment
   */
  async setup() {
    if (this.setupComplete) return;

    // Check if we're in mock mode
    const { mockMode } = require('../../src/config/mockMode');
    
    if (mockMode.isMockMode) {
      // Use mock clients in mock mode
      this.supabase = mockMode.generateMockSupabaseClient();
      this.queueService = {
        initialize: async () => {},
        addJob: async (jobType, payload, options = {}) => {
          const job = {
            id: `mock_job_${Date.now()}_${Math.random()}`,
            job_type: jobType,
            organization_id: payload.organization_id,
            priority: options.priority || 5,
            payload,
            max_attempts: options.maxAttempts || 3,
            status: 'pending',
            created_at: new Date().toISOString(),
            completed_at: null,
            error_message: null
          };
          this.mockStoredJobs.push(job);
          return job;
        },
        getNextJob: async () => {
          const pendingJobs = this.mockStoredJobs.filter(job => job.status === 'pending');
          return pendingJobs.length > 0 ? pendingJobs[0] : null;
        },
        completeJob: async (job, resultData = {}) => {
          if (process.env.DEBUG_E2E) {
            console.log('🔍 completeJob called:', {
              jobId: job?.id,
              existingCount: this.mockStoredJobs.length,
              resultData: JSON.stringify(resultData).substring(0, 100)
            });
          }
          const existingJob = this.mockStoredJobs.find(j => j.id === job.id);
          if (existingJob) {
            existingJob.status = 'completed';
            existingJob.completed_at = new Date().toISOString();
            existingJob.result = resultData.result || resultData;
            existingJob.processing_time = resultData.processingTime;
            existingJob.completed_by = resultData.completedBy;
            if (process.env.DEBUG_E2E) {
              console.log('✅ Updated existing job in storage:', existingJob.id, 'status:', existingJob.status);
            }
          } else if (process.env.DEBUG_E2E) {
            console.log('⚠️  Job not found in storage:', job?.id);
          }
          // Also update the job object passed in
          if (job) {
            job.status = 'completed';
            job.completed_at = new Date().toISOString();
            job.result = resultData.result || resultData;
            job.processing_time = resultData.processingTime;
            job.completed_by = resultData.completedBy;
            if (process.env.DEBUG_E2E) {
              console.log('✅ Updated job object status:', job.status);
            }
          }
        },
        failJob: async (job, error) => {
          const existingJob = this.mockStoredJobs.find(j => j.id === job.id);
          if (existingJob) {
            existingJob.status = 'failed';
            existingJob.completed_at = new Date().toISOString();
            existingJob.error_message = error?.message || error?.toString() || 'Unknown error';
            existingJob.failed_at = new Date().toISOString();
          }
          // Also update the job object passed in
          if (job) {
            job.status = 'failed';
            job.completed_at = new Date().toISOString();
            job.error_message = error?.message || error?.toString() || 'Unknown error';
            job.failed_at = new Date().toISOString();
          }
        },
        getQueueStats: async () => {
          const completed = this.mockStoredJobs.filter(j => j.status === 'completed').length;
          const failed = this.mockStoredJobs.filter(j => j.status === 'failed').length;
          const pending = this.mockStoredJobs.filter(j => j.status === 'pending').length;
          
          return {
            timestamp: new Date().toISOString(),
            redis: false,
            database: true,
            databaseStats: { byStatus: { pending, completed, failed } }
          };
        },
        shutdown: async () => {}
      };
    } else {
      // Initialize Supabase client for real integration tests
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase credentials required for integration tests');
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);

      // Initialize queue service
      this.queueService = new QueueService();
      await this.queueService.initialize();
    }

    this.setupComplete = true;
  }

  /**
   * Clean up test environment
   */
  async cleanup() {
    // Stop all workers immediately
    const stopPromises = this.workers.map(async (worker) => {
      try {
        if (worker.isRunning) {
          worker.isRunning = false; // Force stop the processing loop
          await worker.stop();
        }
      } catch (error) {
        console.warn('Error stopping worker:', error.message);
      }
    });
    
    await Promise.all(stopPromises);
    this.workers = [];

    // Clean up queue service
    if (this.queueService && typeof this.queueService.shutdown === 'function') {
      try {
        await this.queueService.shutdown();
      } catch (error) {
        console.warn('Error shutting down queue service:', error.message);
      }
    }

    // Clean up test data from database
    await this.cleanupTestData();

    // Clear any global storage
    if (typeof global !== 'undefined') {
      global.mockCommentStorage = [];
      global.mockJobStorage = [];
      global.mockOrgStorage = [];
      global.mockConfigStorage = [];
    }

    this.setupComplete = false;
  }

  /**
   * Create a test worker with mock configurations
   */
  createTestWorker(options = {}) {
    const worker = new FetchCommentsWorker({
      maxRetries: 3,
      retryDelay: 100, // Shorter delay for tests
      pollInterval: 50, // Faster polling for tests
      ...options
    });

    // Override the worker's queue service with our test queue service
    worker.queueService = this.queueService;
    
    // Override the processing loop to prevent infinite polling in tests
    const originalProcessingLoop = worker.processingLoop;
    worker.processingLoop = async function() {
      // Don't run the processing loop in tests - we'll call processJob directly
      return;
    };

    this.workers.push(worker);
    return worker;
  }

  /**
   * Setup test organizations and integration configs
   */
  async setupTestOrganizations(fixtures) {
    const { mockMode } = require('../../src/config/mockMode');
    
    if (mockMode.isMockMode) {
      // In mock mode, just return success
      return;
    }

    const { organizations, integrationConfigs } = fixtures;

    // Insert test organizations
    for (const org of organizations) {
      const { error: orgError } = await this.supabase
        .from('organizations')
        .upsert([org], { onConflict: 'id' });

      if (orgError) {
        throw new Error(`Failed to setup organization ${org.id}: ${orgError.message}`);
      }
    }

    // Insert integration configs
    for (const config of integrationConfigs) {
      const { error: configError } = await this.supabase
        .from('integration_configs')
        .upsert([config], { onConflict: 'id' });

      if (configError) {
        throw new Error(`Failed to setup integration config ${config.id}: ${configError.message}`);
      }
    }
  }

  /**
   * Insert test comments directly to database
   */
  async insertTestComments(organizationId, integrationConfigId, comments) {
    const { mockMode } = require('../../src/config/mockMode');
    
    if (mockMode.isMockMode) {
      // In mock mode, store data in global storage and return it
      const storage = global.mockCommentStorage || [];
      const insertedComments = comments.map((comment, index) => ({
        id: `mock_comment_${storage.length + index}`,
        organization_id: organizationId,
        integration_config_id: integrationConfigId,
        platform: comment.platform,
        platform_comment_id: comment.platform_comment_id,
        platform_user_id: comment.platform_user_id,
        platform_username: comment.platform_username,
        original_text: comment.original_text,
        metadata: comment.metadata,
        status: 'pending',
        created_at: new Date().toISOString()
      }));
      
      // Add to global storage for persistence in mock mode
      storage.push(...insertedComments);
      global.mockCommentStorage = storage;
      
      return insertedComments;
    }

    const commentsToInsert = comments.map(comment => ({
      organization_id: organizationId,
      integration_config_id: integrationConfigId,
      platform: comment.platform,
      platform_comment_id: comment.platform_comment_id,
      platform_user_id: comment.platform_user_id,
      platform_username: comment.platform_username,
      original_text: comment.original_text,
      metadata: comment.metadata,
      status: 'pending',
      created_at: new Date().toISOString()
    }));

    const { data, error } = await this.supabase
      .from('comments')
      .insert(commentsToInsert)
      .select();

    if (error) {
      throw new Error(`Failed to insert test comments: ${error.message}`);
    }

    return data;
  }

  /**
   * Create test jobs in queue
   */
  async createTestJobs(jobType, payloads, options = {}) {
    const jobs = [];

    for (const payload of payloads) {
      const job = await this.queueService.addJob(jobType, payload, {
        priority: options.priority || 5,
        maxAttempts: options.maxAttempts || 3,
        delay: options.delay || 0
      });
      jobs.push(job);
    }

    return jobs;
  }

  /**
   * Get comments from database by organization
   */
  async getCommentsByOrganization(organizationId) {
    const { mockMode } = require('../../src/config/mockMode');
    
    if (mockMode.isMockMode) {
      // Return mock data from global storage
      const storage = global.mockCommentStorage || [];
      return storage.filter(comment => comment.organization_id === organizationId);
    }

    const { data, error } = await this.supabase
      .from('comments')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get comments: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get jobs from queue by type
   */
  async getJobsByType(jobType) {
    const { mockMode } = require('../../src/config/mockMode');
    
    if (mockMode.isMockMode) {
      // Return mock job data with proper structure
      return this.mockStoredJobs.filter(job => job.job_type === jobType).map(job => ({
        ...job,
        status: job.status || 'completed',
        completed_at: job.completed_at || new Date().toISOString(),
        error_message: job.error_message || null
      }));
    }

    const { data, error } = await this.supabase
      .from('job_queue')
      .select('*')
      .eq('job_type', jobType)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get jobs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Check if comment exists in database by platform_comment_id
   */
  async commentExists(organizationId, platformCommentId) {
    const { mockMode } = require('../../src/config/mockMode');
    
    if (mockMode.isMockMode) {
      const storage = global.mockCommentStorage || [];
      const exists = storage.some(comment => 
        comment.organization_id === organizationId &&
        comment.platform_comment_id === platformCommentId
      );
      return exists;
    }

    const { data, error } = await this.supabase
      .from('comments')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('platform_comment_id', platformCommentId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      throw new Error(`Failed to check comment existence: ${error.message}`);
    }

    return !!data;
  }

  /**
   * Count comments by organization and platform_comment_id
   */
  async countCommentsByPlatformId(organizationId, platformCommentId) {
    const { mockMode } = require('../../src/config/mockMode');
    
    if (mockMode.isMockMode) {
      const storage = global.mockCommentStorage || [];
      return storage.filter(c => 
        c.organization_id === organizationId && 
        c.platform_comment_id === platformCommentId
      ).length;
    }

    const { count, error } = await this.supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('platform_comment_id', platformCommentId);

    if (error) {
      throw new Error(`Failed to count comments: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Get queue statistics for testing
   */
  async getQueueStats(jobType) {
    return await this.queueService.getQueueStats(jobType);
  }

  /**
   * Wait for jobs to be processed
   */
  async waitForJobProcessing(jobType, expectedCount, timeoutMs = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const jobs = await this.getJobsByType(jobType);
      const completedJobs = jobs.filter(job => 
        job.status === 'completed' || job.status === 'failed'
      );

      if (completedJobs.length >= expectedCount) {
        return completedJobs;
      }

      await this.sleep(100); // Check every 100ms
    }

    throw new Error(`Timeout waiting for job processing. Expected ${expectedCount} jobs to complete within ${timeoutMs}ms`);
  }

  /**
   * Simulate platform API failures for testing retry logic
   */
  mockPlatformFailure(worker, platform, failureType = 'transient', failureCount = 2) {
    const originalMethod = worker.fetchCommentsFromPlatform;
    let failureCounter = 0;

    worker.fetchCommentsFromPlatform = async function(platformName, config, payload) {
      if (platformName === platform && failureCounter < failureCount) {
        failureCounter++;
        
        if (failureType === 'transient') {
          throw new Error(`Simulated transient failure #${failureCounter}`);
        } else if (failureType === 'permanent') {
          throw new Error(`Simulated permanent failure: Invalid data format`);
        }
      }

      return originalMethod.call(this, platformName, config, payload);
    };

    return () => {
      worker.fetchCommentsFromPlatform = originalMethod;
    };
  }

  /**
   * Measure retry timing for backoff testing
   */
  async measureRetryTiming(worker, expectedRetries = 3) {
    const retryDelays = [];
    const originalCalculateRetryDelay = worker.calculateRetryDelay;

    // Override calculateRetryDelay to track actual delay values
    worker.calculateRetryDelay = function(attempt) {
      const delay = originalCalculateRetryDelay.call(this, attempt);
      retryDelays.push(delay);
      return delay;
    };

    return {
      getRetryDelays: () => retryDelays,
      getIntervals: () => {
        // Return the actual delays calculated for each retry
        return retryDelays;
      },
      restore: () => {
        worker.calculateRetryDelay = originalCalculateRetryDelay;
      }
    };
  }

  /**
   * Clean up test data from database
   */
  async cleanupTestData() {
    const { mockMode } = require('../../src/config/mockMode');

    if (mockMode.isMockMode) {
      // Clear global mock storage
      if (typeof global !== 'undefined') {
        global.mockCommentStorage = [];
        global.mockJobStorage = [];
        global.mockOrgStorage = [];
        global.mockConfigStorage = [];
      }
      // Also clear instance storage
      this.mockStoredComments = [];
      this.mockStoredJobs = [];
      return;
    }
    
    if (!this.supabase) return;

    try {
      // Clean up test comments
      await this.supabase
        .from('comments')
        .delete()
        .like('organization_id', 'test-org-%');

      // Clean up test jobs
      await this.supabase
        .from('job_queue')
        .delete()
        .like('organization_id', 'test-org-%');

      // Clean up test integration configs
      await this.supabase
        .from('integration_configs')
        .delete()
        .like('organization_id', 'test-org-%');

      // Clean up test organizations
      await this.supabase
        .from('organizations')
        .delete()
        .like('id', 'test-org-%');

    } catch (error) {
      console.warn('Failed to cleanup test data:', error.message);
    }
  }

  /**
   * Sleep utility for timing tests
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Assert exponential backoff timing
   */
  assertExponentialBackoff(intervals, baseDelay = 100, tolerance = 0.2) {
    for (let i = 0; i < intervals.length; i++) {
      const expectedDelay = baseDelay * Math.pow(2, i);
      const actualDelay = intervals[i];
      const minAcceptable = expectedDelay * (1 - tolerance);
      const maxAcceptable = expectedDelay * (1 + tolerance);

      if (actualDelay < minAcceptable || actualDelay > maxAcceptable) {
        throw new Error(
          `Backoff timing assertion failed at interval ${i}: ` +
          `expected ${expectedDelay}ms ±${tolerance * 100}%, got ${actualDelay}ms`
        );
      }
    }
  }

  /**
   * Assert job order preservation
   */
  assertJobOrder(jobs, expectedOrder) {
    if (jobs.length !== expectedOrder.length) {
      throw new Error(`Job count mismatch: expected ${expectedOrder.length}, got ${jobs.length}`);
    }

    for (let i = 0; i < jobs.length; i++) {
      const actualId = jobs[i].platform_comment_id || jobs[i].payload?.platform_comment_id;
      const expectedId = expectedOrder[i];

      if (actualId !== expectedId) {
        throw new Error(
          `Job order assertion failed at position ${i}: ` +
          `expected ${expectedId}, got ${actualId}`
        );
      }
    }
  }
}

module.exports = IngestorTestUtils;