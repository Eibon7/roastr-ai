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
        addJob: async (jobType, payload, options = {}) => ({
          id: `mock_job_${Date.now()}`,
          job_type: jobType,
          organization_id: payload.organization_id,
          priority: options.priority || 5,
          payload,
          max_attempts: options.maxAttempts || 3,
          created_at: new Date().toISOString()
        }),
        getNextJob: async () => null,
        completeJob: async () => {},
        failJob: async () => {},
        getQueueStats: async () => ({
          timestamp: new Date().toISOString(),
          redis: false,
          database: true,
          databaseStats: { byStatus: { pending: 0, completed: 5, failed: 0 } }
        }),
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
    // Stop all workers
    for (const worker of this.workers) {
      if (worker.isRunning) {
        await worker.stop();
      }
    }
    this.workers = [];

    // Clean up queue service
    if (this.queueService) {
      await this.queueService.shutdown();
    }

    // Clean up test data from database
    await this.cleanupTestData();

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
      // In mock mode, actually insert into global storage
      const storage = global.mockCommentStorage || [];
      const insertedComments = [];
      
      for (const comment of comments) {
        const newComment = {
          id: `mock_comment_${storage.length + 1}`,
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
        };
        
        storage.push(newComment);
        insertedComments.push(newComment);
      }
      
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
  async commentExists(organizationId, platformCommentId, platform = 'twitter') {
    const { data, error } = await this.supabase
      .from('comments')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('platform', platform)
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
  async countCommentsByPlatformId(organizationId, platformCommentId, platform = 'twitter') {
    const { data, error } = await this.supabase
      .from('comments')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('platform', platform)
      .eq('platform_comment_id', platformCommentId);

    if (error) {
      throw new Error(`Failed to count comments: ${error.message}`);
    }

    return data ? data.length : 0;
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
    const retryTimes = [];
    const originalHandleJobError = worker.handleJobError;

    worker.handleJobError = async function(job, error) {
      retryTimes.push(Date.now());
      return originalHandleJobError.call(this, job, error);
    };

    return {
      getRetryTimes: () => retryTimes,
      getIntervals: () => {
        const intervals = [];
        for (let i = 1; i < retryTimes.length; i++) {
          intervals.push(retryTimes[i] - retryTimes[i - 1]);
        }
        return intervals;
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
   * Create a mock job for testing
   */
  createMockJob(organizationId, platform, additionalPayload = {}) {
    return {
      id: `mock_job_${Date.now()}`,
      payload: {
        organization_id: organizationId,
        platform: platform,
        integration_config_id: `config-${platform}-${organizationId}`,
        since_id: '0',
        ...additionalPayload
      }
    };
  }

  /**
   * Create a test comment for testing
   */
  createTestComment(platformCommentId, organizationId, metadata = {}) {
    return {
      platform_comment_id: platformCommentId,
      platform: 'twitter',
      platform_user_id: `user_${Math.random().toString(36).substr(2, 9)}`,
      platform_username: `testuser_${Math.random().toString(36).substr(2, 5)}`,
      original_text: `Test comment ${platformCommentId}`,
      metadata: metadata,
      created_at: new Date().toISOString()
    };
  }

  /**
   * Wait utility for testing timing
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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