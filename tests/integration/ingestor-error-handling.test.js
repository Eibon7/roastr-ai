const IngestorTestUtils = require('../helpers/ingestor-test-utils');
const fixtures = require('../fixtures/ingestor-comments.json');

describe('Ingestor Error Handling Integration Tests', () => {
  let testUtils;

  beforeAll(async () => {
    testUtils = new IngestorTestUtils();
    await testUtils.setup();
    await testUtils.setupTestOrganizations(fixtures);
  }, 30000);

  afterAll(async () => {
    await testUtils.cleanup();
  }, 15000);

  beforeEach(async () => {
    await testUtils.cleanupTestData();
    await testUtils.setupTestOrganizations(fixtures);
  });

  describe('Transient Error Handling', () => {
    test('should retry transient network errors', async () => {
      const organizationId = 'test-org-retry';
      const integrationConfigId = 'config-youtube-retry';
      const comment = fixtures.retryComments[0]; // transient failure comment

      const worker = testUtils.createTestWorker({
        maxRetries: 3,
        retryDelay: 50
      });

      let attemptCount = 0;
      const errorTypes = ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT'];

      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        
        if (attemptCount <= 3) {
          const error = new Error(`Network error: ${errorTypes[attemptCount - 1]}`);
          error.code = errorTypes[attemptCount - 1];
          throw error;
        }
        
        return [comment];
      };

      let result;
      try {
        await worker.start();

        const job = {
          organization_id: organizationId,
          platform: 'youtube',
          integration_config_id: integrationConfigId,
          payload: { video_ids: ['test_video_1'] }
        };

        result = await worker.processJob(job);
      } finally {
        // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
        await worker.stop();
      }

      // Should eventually succeed after retries
      expect(result.success).toBe(true);
      expect(result.commentsCount).toBe(1);
      expect(attemptCount).toBe(4); // 3 failures + 1 success

      // Verify comment was stored
      const storedComments = await testUtils.getCommentsByOrganization(organizationId);
      expect(storedComments).toHaveLength(1);
      expect(storedComments[0].platform_comment_id).toBe(comment.platform_comment_id);
    });

    test('should handle timeout errors with appropriate retries', async () => {
      const organizationId = 'test-org-retry';
      const integrationConfigId = 'config-twitter-dedup';
      const comment = fixtures.acknowledgmentComments[0];

      const worker = testUtils.createTestWorker({
        maxRetries: 3,
        retryDelay: 100
      });

      let attemptCount = 0;
      const timeoutAttempts = [];

      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        timeoutAttempts.push(Date.now());
        
        if (attemptCount <= 2) {
          const error = new Error('Request timeout');
          error.code = 'ETIMEDOUT';
          error.timeout = true;
          throw error;
        }
        
        return [comment];
      };

      let result;
      try {
        await worker.start();

        const job = {
          organization_id: organizationId,
          platform: 'twitter',
          integration_config_id: integrationConfigId,
          payload: { since_id: '0' }
        };

        result = await worker.processJob(job);
      } finally {
        // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
        await worker.stop();
      }

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3);

      // Verify retry intervals for timeout errors
      const intervals = [];
      for (let i = 1; i < timeoutAttempts.length; i++) {
        intervals.push(timeoutAttempts[i] - timeoutAttempts[i - 1]);
      }

      // Should have appropriate backoff between retries
      intervals.forEach(interval => {
        expect(interval).toBeGreaterThan(80); // At least base retry delay
      });
    });

    test('should handle rate limiting as transient error', async () => {
      const organizationId = 'test-org-retry';
      const integrationConfigId = 'config-twitter-dedup';
      const comment = fixtures.acknowledgmentComments[0];

      const worker = testUtils.createTestWorker({
        maxRetries: 3,
        retryDelay: 50
      });

      let attemptCount = 0;
      const rateLimitAttempts = [];

      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        rateLimitAttempts.push({
          attempt: attemptCount,
          timestamp: Date.now()
        });
        
        if (attemptCount <= 2) {
          const error = new Error('Rate limit exceeded');
          error.statusCode = 429;
          error.headers = {
            'x-rate-limit-reset': Math.floor(Date.now() / 1000) + 60,
            'retry-after': '1'
          };
          throw error;
        }
        
        return [comment];
      };

      let result;
      try {
        await worker.start();

        const job = {
          organization_id: organizationId,
          platform: 'twitter',
          integration_config_id: integrationConfigId,
          payload: { since_id: '0' }
        };

        result = await worker.processJob(job);
      } finally {
        // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
        await worker.stop();
      }

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3);

      // Should have retried rate limit errors
      expect(rateLimitAttempts).toHaveLength(3);
      
      // Verify appropriate spacing between attempts
      for (let i = 1; i < rateLimitAttempts.length; i++) {
        const interval = rateLimitAttempts[i].timestamp - rateLimitAttempts[i - 1].timestamp;
        expect(interval).toBeGreaterThan(40); // Should respect retry delay
      }
    });

    test('should differentiate between recoverable and non-recoverable network errors', async () => {
      const organizationId = 'test-org-retry';
      const integrationConfigId = 'config-youtube-retry';

      const worker = testUtils.createTestWorker({
        maxRetries: 2,
        retryDelay: 50
      });

      // Test recoverable errors (should retry)
      let recoverableAttempts = 0;
      worker.fetchCommentsFromPlatform = async (platform, config, payload) => {
        if (payload.test_case === 'recoverable') {
          recoverableAttempts++;
          if (recoverableAttempts <= 2) {
            const error = new Error('Temporary service unavailable');
            error.statusCode = 503;
            throw error;
          }
          return [fixtures.retryComments[0]];
        }
        
        if (payload.test_case === 'non_recoverable') {
          const error = new Error('SSL certificate verification failed');
          error.code = 'CERT_INVALID';
          throw error;
        }
      };

      try {
        await worker.start();

        // Test recoverable error
        const recoverableJob = {
          organization_id: organizationId,
          platform: 'youtube',
          integration_config_id: integrationConfigId,
          payload: { test_case: 'recoverable', video_ids: ['test_video_1'] }
        };

        const recoverableResult = await worker.processJob(recoverableJob);
        expect(recoverableResult.success).toBe(true);
        expect(recoverableAttempts).toBe(3); // Should have retried

        // Test non-recoverable error
        const nonRecoverableJob = {
          organization_id: organizationId,
          platform: 'youtube',
          integration_config_id: integrationConfigId,
          payload: { test_case: 'non_recoverable', video_ids: ['test_video_2'] }
        };

        await expect(worker.processJob(nonRecoverableJob)).rejects.toThrow('SSL certificate verification failed');
      } finally {
        // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
        await worker.stop();
      }
    });
  });

  describe('Permanent Error Handling', () => {
    test('should not retry authentication errors', async () => {
      const organizationId = 'test-org-retry';
      const integrationConfigId = 'config-youtube-retry';

      const worker = testUtils.createTestWorker({
        maxRetries: 3,
        retryDelay: 50
      });

      let attemptCount = 0;
      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        const error = new Error('Invalid API key');
        error.statusCode = 401;
        error.code = 'UNAUTHORIZED';
        throw error;
      };

      try {
        await worker.start();

        const job = {
          organization_id: organizationId,
          platform: 'youtube',
          integration_config_id: integrationConfigId,
          payload: { video_ids: ['test_video_1'] }
        };

        await expect(worker.processJob(job)).rejects.toThrow('Invalid API key');
      } finally {
        // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
        await worker.stop();
      }

      // Should not have retried authentication error
      expect(attemptCount).toBe(1);
    });

    test('should not retry forbidden/permission errors', async () => {
      const organizationId = 'test-org-retry';
      const integrationConfigId = 'config-twitter-dedup';

      const worker = testUtils.createTestWorker({
        maxRetries: 3,
        retryDelay: 50
      });

      let attemptCount = 0;
      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        const error = new Error('Insufficient permissions to access this resource');
        error.statusCode = 403;
        error.code = 'FORBIDDEN';
        throw error;
      };

      try {
        await worker.start();

        const job = {
          organization_id: organizationId,
          platform: 'twitter',
          integration_config_id: integrationConfigId,
          payload: { since_id: '0' }
        };

        await expect(worker.processJob(job)).rejects.toThrow('Insufficient permissions');
      } finally {
        // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
        await worker.stop();
      }

      expect(attemptCount).toBe(1);
    });

    test('should not retry malformed request errors', async () => {
      const organizationId = 'test-org-retry';
      const integrationConfigId = 'config-youtube-retry';

      const worker = testUtils.createTestWorker({
        maxRetries: 3,
        retryDelay: 50
      });

      let attemptCount = 0;
      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        const error = new Error('Invalid request format');
        error.statusCode = 400;
        error.code = 'BAD_REQUEST';
        throw error;
      };

      try {
        await worker.start();

        const job = {
          organization_id: organizationId,
          platform: 'youtube',
          integration_config_id: integrationConfigId,
          payload: { video_ids: ['invalid_video_id_format'] }
        };

        await expect(worker.processJob(job)).rejects.toThrow('Invalid request format');
      } finally {
        // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
        await worker.stop();
      }

      expect(attemptCount).toBe(1);
    });

    test('should not retry resource not found errors', async () => {
      const organizationId = 'test-org-retry';
      const integrationConfigId = 'config-youtube-retry';

      const worker = testUtils.createTestWorker({
        maxRetries: 3,
        retryDelay: 50
      });

      let attemptCount = 0;
      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        const error = new Error('Video not found');
        error.statusCode = 404;
        error.code = 'NOT_FOUND';
        throw error;
      };

      try {
        await worker.start();

        const job = {
          organization_id: organizationId,
          platform: 'youtube',
          integration_config_id: integrationConfigId,
          payload: { video_ids: ['nonexistent_video'] }
        };

        await expect(worker.processJob(job)).rejects.toThrow('Video not found');
      } finally {
        // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
        await worker.stop();
      }

      expect(attemptCount).toBe(1);
    });
  });

  describe('Error Classification', () => {
    test('should correctly classify HTTP status codes', async () => {
      const organizationId = 'test-org-retry';
      const integrationConfigId = 'config-twitter-dedup';

      const testCases = [
        { status: 500, shouldRetry: true, description: 'Internal Server Error' },
        { status: 502, shouldRetry: true, description: 'Bad Gateway' },
        { status: 503, shouldRetry: true, description: 'Service Unavailable' },
        { status: 504, shouldRetry: true, description: 'Gateway Timeout' },
        { status: 400, shouldRetry: false, description: 'Bad Request' },
        { status: 401, shouldRetry: false, description: 'Unauthorized' },
        { status: 403, shouldRetry: false, description: 'Forbidden' },
        { status: 404, shouldRetry: false, description: 'Not Found' },
        { status: 422, shouldRetry: false, description: 'Unprocessable Entity' }
      ];

      const worker = testUtils.createTestWorker({
        maxRetries: 2,
        retryDelay: 50
      });

      try {
        await worker.start();

        for (const testCase of testCases) {
          let attemptCount = 0;
          
          worker.fetchCommentsFromPlatform = async () => {
            attemptCount++;
            const error = new Error(testCase.description);
            error.statusCode = testCase.status;
            throw error;
          };

          const job = {
            organization_id: organizationId,
            platform: 'twitter',
            integration_config_id: integrationConfigId,
            payload: { test_status: testCase.status }
          };

          await expect(worker.processJob(job)).rejects.toThrow(testCase.description);

          if (testCase.shouldRetry) {
            expect(attemptCount).toBeGreaterThan(1);
          } else {
            expect(attemptCount).toBe(1);
          }
        }
      } finally {
        // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
        await worker.stop();
      }
    });

    test('should handle mixed error scenarios in batch processing', async () => {
      const organizationId = 'test-org-retry';
      const integrationConfigId = 'config-youtube-retry';

      const worker = testUtils.createTestWorker({
        maxRetries: 2,
        retryDelay: 50
      });

      const errorScenarios = [
        { type: 'success', shouldSucceed: true },
        { type: 'transient', shouldRetry: true, shouldSucceed: false },
        { type: 'permanent', shouldRetry: false, shouldSucceed: false },
        { type: 'eventual_success', shouldRetry: true, shouldSucceed: true }
      ];

      const results = [];
      const attemptCounts = {};

      worker.fetchCommentsFromPlatform = async (platform, config, payload) => {
        const scenario = payload.scenario;
        attemptCounts[scenario] = (attemptCounts[scenario] || 0) + 1;

        switch (scenario) {
          case 'success':
            return [fixtures.retryComments[0]];
            
          case 'transient':
            throw new Error('Persistent transient error');
            
          case 'permanent':
            const permError = new Error('Permanent error');
            permError.statusCode = 401;
            throw permError;
            
          case 'eventual_success':
            if (attemptCounts[scenario] <= 2) {
              throw new Error('Transient error - will succeed');
            }
            return [fixtures.retryComments[0]];
            
          default:
            throw new Error('Unknown scenario');
        }
      };

      try {
        await worker.start();

        for (const scenario of errorScenarios) {
          const job = {
            organization_id: organizationId,
            platform: 'youtube',
            integration_config_id: integrationConfigId,
            payload: { scenario: scenario.type, video_ids: ['test_video'] }
          };

          try {
            const result = await worker.processJob(job);
            results.push({ scenario: scenario.type, success: true, result });
          } catch (error) {
            results.push({ scenario: scenario.type, success: false, error: error.message });
          }
        }
      } finally {
        // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
        await worker.stop();
      }

      // Verify results match expectations
      expect(results[0].success).toBe(true); // success
      expect(results[1].success).toBe(false); // transient (max retries exceeded)
      expect(results[2].success).toBe(false); // permanent
      expect(results[3].success).toBe(true); // eventual_success

      // Verify attempt counts
      expect(attemptCounts['success']).toBe(1);
      expect(attemptCounts['transient']).toBe(3); // 1 + 2 retries
      expect(attemptCounts['permanent']).toBe(1); // No retries
      expect(attemptCounts['eventual_success']).toBe(3); // Succeeded on 3rd attempt
    });
  });

  describe('Error Recovery and State Management', () => {
    test('should maintain consistent state after error recovery', async () => {
      const organizationId = 'test-org-retry';
      const integrationConfigId = 'config-twitter-dedup';
      const comment = fixtures.acknowledgmentComments[0];

      const worker = testUtils.createTestWorker({
        maxRetries: 3,
        retryDelay: 50
      });

      let attemptCount = 0;
      const stateChecks = [];

      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        
        // Check state before potential failure
        const preState = {
          attempt: attemptCount,
          workerRunning: worker.isRunning,
          processedJobs: worker.processedJobs
        };
        stateChecks.push(preState);

        if (attemptCount <= 2) {
          throw new Error(`Transient failure #${attemptCount}`);
        }
        
        return [comment];
      };

      let result;
      try {
        await worker.start();

        const job = {
          organization_id: organizationId,
          platform: 'twitter',
          integration_config_id: integrationConfigId,
          payload: { since_id: '0' }
        };

        result = await worker.processJob(job);
      } finally {
        // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
        await worker.stop();
      }

      expect(result.success).toBe(true);

      // Verify worker maintained consistent state throughout retries
      stateChecks.forEach(state => {
        expect(state.workerRunning).toBe(true);
        expect(state.processedJobs).toBeGreaterThanOrEqual(0);
      });

      // Verify final state is correct
      expect(worker.processedJobs).toBe(1);
      expect(worker.failedJobs).toBe(0); // Should not count as failed since it eventually succeeded
    });

    test('should handle database errors during comment storage', async () => {
      const organizationId = 'test-org-retry';
      const integrationConfigId = 'config-twitter-dedup';
      const comment = fixtures.acknowledgmentComments[0];

      const worker = testUtils.createTestWorker({
        maxRetries: 2,
        retryDelay: 50
      });

      let fetchCount = 0;
      let storeAttempts = 0;

      // Mock successful fetch but failing store
      worker.fetchCommentsFromPlatform = async () => {
        fetchCount++;
        return [comment];
      };

      // Mock store failure
      const originalStoreComments = worker.storeComments;
      worker.storeComments = async (...args) => {
        storeAttempts++;
        if (storeAttempts <= 2) {
          throw new Error('Database connection failed');
        }
        return originalStoreComments.call(worker, ...args);
      };

      let result;
      try {
        await worker.start();

        const job = {
          organization_id: organizationId,
          platform: 'twitter',
          integration_config_id: integrationConfigId,
          payload: { since_id: '0' }
        };

        result = await worker.processJob(job);
      } finally {
        // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
        await worker.stop();
      }

      expect(result.success).toBe(true);
      expect(fetchCount).toBe(1); // Should fetch only once
      expect(storeAttempts).toBe(3); // Should retry store operation

      // Verify comment was eventually stored
      const storedComments = await testUtils.getCommentsByOrganization(organizationId);
      expect(storedComments).toHaveLength(1);
    });

    test('should handle partial batch failures gracefully', async () => {
      const organizationId = 'test-org-retry';
      const integrationConfigId = 'config-youtube-retry';
      
      const batchComments = [
        { ...fixtures.retryComments[0], platform_comment_id: 'batch_1' },
        { ...fixtures.retryComments[0], platform_comment_id: 'batch_2' },
        { ...fixtures.retryComments[0], platform_comment_id: 'batch_3' }
      ];

      const worker = testUtils.createTestWorker({
        maxRetries: 2,
        retryDelay: 50
      });

      worker.fetchCommentsFromPlatform = async () => batchComments;

      // Mock partial storage failure
      const originalStoreComments = worker.storeComments;
      worker.storeComments = async (orgId, configId, platform, comments) => {
        // Simulate failure for second comment
        const processedComments = [];
        
        for (const comment of comments) {
          if (comment.platform_comment_id === 'batch_2') {
            // Skip the problematic comment (simulate constraint violation)
            continue;
          }
          
          const stored = await originalStoreComments.call(
            worker, 
            orgId, 
            configId, 
            platform, 
            [comment]
          );
          processedComments.push(...stored);
        }
        
        return processedComments;
      };

      let result;
      try {
        await worker.start();

        const job = {
          organization_id: organizationId,
          platform: 'youtube',
          integration_config_id: integrationConfigId,
          payload: { video_ids: ['test_video'] }
        };

        result = await worker.processJob(job);
      } finally {
        // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
        await worker.stop();
      }

      expect(result.success).toBe(true);
      expect(result.commentsCount).toBe(2); // Should store 2 out of 3 comments

      // Verify only successful comments were stored
      const storedComments = await testUtils.getCommentsByOrganization(organizationId);
      expect(storedComments).toHaveLength(2);
      
      const commentIds = storedComments.map(c => c.platform_comment_id);
      expect(commentIds).toContain('batch_1');
      expect(commentIds).toContain('batch_3');
      expect(commentIds).not.toContain('batch_2');
    });
  });
});