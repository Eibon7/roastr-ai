/**
 * Ingestor Test Utilities - Support functions for integration testing
 * Implements comprehensive testing framework for FetchCommentsWorker
 */

const FetchCommentsWorker = require('../../src/workers/FetchCommentsWorker');
const { mockMode } = require('../../src/config/mockMode');
const { logger } = require('../../src/utils/logger');

class IngestorTestUtils {
  constructor() {
    this.workers = [];
    this.setupComplete = false;
  }

  /**
   * Setup test environment
   */
  async setup() {
    try {
      logger.info('Setting up IngestorTestUtils');
      this.setupComplete = true;
    } catch (error) {
      logger.error('Failed to setup IngestorTestUtils', { error: error.message });
      throw error;
    }
  }

  /**
   * Cleanup test environment  
   */
  async cleanup() {
    try {
      // Stop all workers
      for (const worker of this.workers) {
        if (worker && typeof worker.stop === 'function') {
          await worker.stop();
        }
      }
      this.workers = [];
      
      logger.info('IngestorTestUtils cleanup completed');
    } catch (error) {
      logger.error('Error during IngestorTestUtils cleanup', { error: error.message });
    }
  }

  /**
   * Setup test organizations based on fixtures
   */
  async setupTestOrganizations(fixtures) {
    if (!fixtures || !fixtures.organizations) {
      logger.warn('No organizations in fixtures');
      return;
    }

    // In mock mode, we don't need to actually create organizations
    // The mock client will handle the responses
    if (mockMode.isMockMode) {
      logger.info('Mock mode: skipping organization setup', {
        organizationCount: fixtures.organizations.length
      });
      return;
    }

    // In real mode, we would setup actual organizations
    logger.info('Setting up test organizations', {
      organizationCount: fixtures.organizations.length
    });
  }

  /**
   * Create a test worker instance
   */
  createTestWorker() {
    const worker = new FetchCommentsWorker();
    this.workers.push(worker);
    
    // Override the platform API to mock responses
    worker.fetchCommentsFromPlatform = async (platform, config, lastSyncId) => {
      return []; // Mock empty response by default
    };

    // Override storage method for testing
    worker.storeComments = async (orgId, configId, platform, comments) => {
      return comments.map((comment, index) => ({
        ...comment,
        id: `stored_${Date.now()}_${index}`,
        stored_at: new Date().toISOString()
      }));
    };

    return worker;
  }

  /**
   * Assert exponential backoff timing
   */
  async assertExponentialBackoff(delays, expectedPattern = [100, 200, 400]) {
    const tolerance = 0.2; // 20% tolerance
    
    for (let i = 0; i < expectedPattern.length && i < delays.length; i++) {
      const expected = expectedPattern[i];
      const actual = delays[i];
      const minExpected = expected * (1 - tolerance);
      const maxExpected = expected * (1 + tolerance);
      
      if (actual < minExpected || actual > maxExpected) {
        throw new Error(
          `Exponential backoff failed at step ${i}: expected ${expected}ms ±20%, got ${actual}ms`
        );
      }
    }
    
    logger.info('Exponential backoff validation passed', {
      expectedPattern,
      actualDelays: delays
    });
  }

  /**
   * Create mock job data
   */
  createMockJob(organizationId, platform = 'twitter', payload = {}) {
    return {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      organization_id: organizationId,
      platform,
      integration_config_id: `config-${platform}-${organizationId}`,
      payload: {
        since_id: '0',
        ...payload
      },
      created_at: new Date().toISOString(),
      status: 'pending',
      priority: 1
    };
  }

  /**
   * Validate comment structure
   */
  validateCommentStructure(comment) {
    const requiredFields = [
      'platform_comment_id',
      'platform_user_id', 
      'platform_username',
      'original_text',
      'platform'
    ];

    for (const field of requiredFields) {
      if (!comment[field]) {
        throw new Error(`Comment missing required field: ${field}`);
      }
    }

    return true;
  }

  /**
   * Wait for specified delay
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Measure execution time
   */
  async measureTime(asyncFn) {
    const start = Date.now();
    const result = await asyncFn();
    const duration = Date.now() - start;
    return { result, duration };
  }

  /**
   * Assert worker state
   */
  assertWorkerState(worker, expectedState) {
    if (worker.state !== expectedState) {
      throw new Error(`Worker state assertion failed: expected ${expectedState}, got ${worker.state}`);
    }
  }

  /**
   * Create test comment data
   */
  createTestComment(platformCommentId, organizationId, platform = 'twitter') {
    return {
      platform_comment_id: platformCommentId,
      platform_user_id: `user_${Date.now()}`,
      platform_username: `testuser_${Math.random().toString(36).substr(2, 5)}`,
      original_text: `Test comment ${platformCommentId}`,
      platform,
      organization_id: organizationId,
      metadata: {
        test: true,
        created_at: new Date().toISOString()
      }
    };
  }

  /**
   * Generate test fixtures for deduplication
   */
  generateDuplicateComments(organizationId, platform = 'twitter', count = 3) {
    const baseCommentId = `duplicate_${Date.now()}`;
    return Array.from({ length: count }, (_, index) => 
      this.createTestComment(baseCommentId, organizationId, platform)
    );
  }

  /**
   * Generate ordered test comments
   */
  generateOrderedComments(organizationId, count = 5, platform = 'twitter') {
    return Array.from({ length: count }, (_, index) => {
      const comment = this.createTestComment(`ordered_${index}`, organizationId, platform);
      comment.created_at = new Date(Date.now() + index * 1000).toISOString();
      return comment;
    });
  }

  /**
   * Simulate network error
   */
  createNetworkError(message = 'Network timeout') {
    const error = new Error(message);
    error.code = 'NETWORK_ERROR';
    error.isTransient = true;
    return error;
  }

  /**
   * Simulate auth error
   */
  createAuthError(message = 'Authentication failed') {
    const error = new Error(message);
    error.code = 'AUTH_ERROR';
    error.isTransient = false;
    return error;
  }

  /**
   * Get test statistics
   */
  getTestStats() {
    return {
      workersCreated: this.workers.length,
      setupComplete: this.setupComplete,
      mockModeEnabled: mockMode.isMockMode
    };
  }
}

module.exports = IngestorTestUtils;