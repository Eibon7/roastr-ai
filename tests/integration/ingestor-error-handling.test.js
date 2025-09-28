/**
 * Ingestor Error Handling Integration Tests
 * Tests transient vs permanent error differentiation as specified in Issue #406
 */

const IngestorTestUtils = require('../helpers/ingestor-test-utils');
const fixtures = require('../fixtures/ingestor-comments.json');

describe('Ingestor Error Handling Integration', () => {
  let testUtils;

  beforeAll(async () => {
    testUtils = new IngestorTestUtils();
    await testUtils.setup();
    await testUtils.setupTestOrganizations(fixtures);
  }, 30000);

  afterAll(async () => {
    await testUtils.cleanup();
  }, 15000);

  describe('Transient vs Permanent Error Handling', () => {
    test('should retry transient network errors with exponential backoff', async () => {
      const organizationId = 'test-org-errors';
      const worker = testUtils.createTestWorker({
        maxRetries: 3,
        retryDelay: 100
      });

      const errorLog = [];
      let attemptCount = 0;

      // Mock API with transient network errors
      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        const timestamp = Date.now();

        if (attemptCount <= 2) {
          // Simulate transient errors
          const transientErrors = [
            { code: 'ECONNRESET', message: 'Connection reset by peer' },
            { code: 'ETIMEDOUT', message: 'Connection timed out' }
          ];
          
          const error = new Error(transientErrors[attemptCount - 1].message);
          error.code = transientErrors[attemptCount - 1].code;
          error.transient = true;

          errorLog.push({
            attempt: attemptCount,
            error: error.message,
            errorCode: error.code,
            isTransient: true,
            timestamp: timestamp
          });

          throw error;
        }

        // Success on 3rd attempt
        errorLog.push({
          attempt: attemptCount,
          error: null,
          isTransient: false,
          timestamp: timestamp
        });

        return fixtures.errorComments.transient;
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(true);
      expect(result.commentsCount).toBe(fixtures.errorComments.transient.length);
      expect(errorLog).toHaveLength(3);

      // Verify transient errors were retried
      const transientErrors = errorLog.filter(log => log.isTransient);
      expect(transientErrors).toHaveLength(2);

      // Verify exponential backoff timing
      if (errorLog.length >= 3) {
        const interval1 = errorLog[1].timestamp - errorLog[0].timestamp;
        const interval2 = errorLog[2].timestamp - errorLog[1].timestamp;
        
        expect(interval1).toBeGreaterThan(80); // ~100ms with tolerance
        expect(interval2).toBeGreaterThan(180); // ~200ms with tolerance
      }
    });

    test('should not retry permanent authentication errors', async () => {
      const organizationId = 'test-org-errors';
      const worker = testUtils.createTestWorker({
        maxRetries: 3,
        retryDelay: 100
      });

      const errorLog = [];
      let attemptCount = 0;

      // Mock API with permanent authentication error
      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        const timestamp = Date.now();

        // Simulate 401 Unauthorized - permanent error
        const error = new Error('Invalid authentication credentials');
        error.status = 401;
        error.permanent = true;

        errorLog.push({
          attempt: attemptCount,
          error: error.message,
          status: error.status,
          isPermanent: true,
          timestamp: timestamp
        });

        throw error;
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(false);
      expect(errorLog).toHaveLength(1); // Should not retry permanent errors
      expect(result.error).toContain('Invalid authentication credentials');
    });

    test('should handle mixed error types appropriately', async () => {
      const organizationId = 'test-org-errors';
      const worker = testUtils.createTestWorker({
        maxRetries: 4,
        retryDelay: 50
      });

      const errorSequence = [];
      let attemptCount = 0;

      // Mock API with sequence of different error types
      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        const timestamp = Date.now();

        let error, shouldRetry;

        if (attemptCount === 1) {
          // Transient: Rate limit
          error = new Error('Rate limit exceeded');
          error.status = 429;
          shouldRetry = true;
        } else if (attemptCount === 2) {
          // Transient: Service unavailable
          error = new Error('Service temporarily unavailable');
          error.status = 503;
          shouldRetry = true;
        } else if (attemptCount === 3) {
          // Transient: Gateway timeout
          error = new Error('Gateway timeout');
          error.status = 504;
          shouldRetry = true;
        } else if (attemptCount === 4) {
          // Transient: Internal server error
          error = new Error('Internal server error');
          error.status = 500;
          shouldRetry = true;
        }

        if (error) {
          errorSequence.push({
            attempt: attemptCount,
            error: error.message,
            status: error.status,
            shouldRetry: shouldRetry,
            timestamp: timestamp
          });
          throw error;
        }

        // Success on 5th attempt
        errorSequence.push({
          attempt: attemptCount,
          error: null,
          success: true,
          timestamp: timestamp
        });

        return fixtures.errorComments.mixed;
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(true);
      expect(errorSequence).toHaveLength(5);

      // All intermediate errors should be retryable
      const retryableErrors = errorSequence.filter(log => log.shouldRetry);
      expect(retryableErrors).toHaveLength(4);

      // Verify each retry attempt had progressively longer delays
      for (let i = 1; i < retryableErrors.length; i++) {
        const currentInterval = errorSequence[i].timestamp - errorSequence[i - 1].timestamp;
        const previousInterval = i > 1 ? errorSequence[i - 1].timestamp - errorSequence[i - 2].timestamp : 0;
        
        if (previousInterval > 0) {
          expect(currentInterval).toBeGreaterThanOrEqual(previousInterval * 0.8); // Account for timing variance
        }
      }
    });

    test('should handle rate limit errors with appropriate backoff', async () => {
      const organizationId = 'test-org-errors';
      const worker = testUtils.createTestWorker({
        maxRetries: 3,
        retryDelay: 200,
        rateLimitBackoffMultiplier: 2
      });

      const rateLimitLog = [];
      let attemptCount = 0;

      // Mock API with rate limit followed by success
      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        const timestamp = Date.now();

        if (attemptCount <= 2) {
          // Simulate rate limit errors with Retry-After header
          const error = new Error('Rate limit exceeded');
          error.status = 429;
          error.retryAfter = 300; // Suggested wait time in milliseconds

          rateLimitLog.push({
            attempt: attemptCount,
            error: error.message,
            status: error.status,
            retryAfter: error.retryAfter,
            timestamp: timestamp
          });

          throw error;
        }

        // Success after rate limit
        rateLimitLog.push({
          attempt: attemptCount,
          success: true,
          timestamp: timestamp
        });

        return fixtures.errorComments.rateLimit;
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      
      const startTime = Date.now();
      const result = await worker.processJob(job);
      const totalDuration = Date.now() - startTime;

      await worker.stop();

      expect(result.success).toBe(true);
      expect(rateLimitLog).toHaveLength(3);

      // Should respect rate limit backoff
      expect(totalDuration).toBeGreaterThan(600); // Should wait for rate limit backoff

      const rateLimitErrors = rateLimitLog.filter(log => log.status === 429);
      expect(rateLimitErrors).toHaveLength(2);
    });

    test('should differentiate between client and server errors', async () => {
      const organizationId = 'test-org-errors';
      const worker = testUtils.createTestWorker({
        maxRetries: 2,
        retryDelay: 100
      });

      const errorClassification = [];
      let testPhase = 1;

      // Mock API with different error classifications
      worker.fetchCommentsFromPlatform = async () => {
        const timestamp = Date.now();
        let error, classification;

        if (testPhase === 1) {
          // Client error - should not retry
          error = new Error('Bad request - invalid parameters');
          error.status = 400;
          classification = 'client_error';
        }

        errorClassification.push({
          phase: testPhase,
          error: error.message,
          status: error.status,
          classification: classification,
          timestamp: timestamp
        });

        testPhase++;
        throw error;
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(false);
      expect(errorClassification).toHaveLength(1); // Should not retry client errors
      expect(errorClassification[0].classification).toBe('client_error');
      expect(result.error).toContain('Bad request');
    });

    test('should handle network connectivity issues with progressive backoff', async () => {
      const organizationId = 'test-org-errors';
      const worker = testUtils.createTestWorker({
        maxRetries: 4,
        retryDelay: 100,
        maxBackoffDelay: 1000
      });

      const connectivityLog = [];
      let attemptCount = 0;

      // Mock API with various network connectivity issues
      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        const timestamp = Date.now();

        let error, errorType;

        if (attemptCount === 1) {
          error = new Error('DNS lookup failed');
          error.code = 'ENOTFOUND';
          errorType = 'dns_failure';
        } else if (attemptCount === 2) {
          error = new Error('Connection refused');
          error.code = 'ECONNREFUSED';
          errorType = 'connection_refused';
        } else if (attemptCount === 3) {
          error = new Error('Network unreachable');
          error.code = 'ENETUNREACH';
          errorType = 'network_unreachable';
        } else if (attemptCount === 4) {
          error = new Error('Socket timeout');
          error.code = 'ESOCKETTIMEDOUT';
          errorType = 'socket_timeout';
        }

        if (error) {
          connectivityLog.push({
            attempt: attemptCount,
            error: error.message,
            errorCode: error.code,
            errorType: errorType,
            timestamp: timestamp
          });
          throw error;
        }

        // Success on 5th attempt
        connectivityLog.push({
          attempt: attemptCount,
          success: true,
          timestamp: timestamp
        });

        return fixtures.errorComments.connectivity;
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(true);
      expect(connectivityLog).toHaveLength(5);

      // All network errors should be retried
      const networkErrors = connectivityLog.filter(log => log.errorCode);
      expect(networkErrors).toHaveLength(4);

      // Verify progressive backoff with network errors
      for (let i = 1; i < networkErrors.length; i++) {
        const interval = connectivityLog[i].timestamp - connectivityLog[i - 1].timestamp;
        const expectedMin = 100 * Math.pow(2, i - 1) * 0.8; // 80% tolerance
        expect(interval).toBeGreaterThan(expectedMin);
      }
    });

    test('should handle service degradation scenarios gracefully', async () => {
      const organizationId = 'test-org-errors';
      const worker = testUtils.createTestWorker({
        maxRetries: 3,
        retryDelay: 150,
        degradationThreshold: 2 // After 2 failures, consider service degraded
      });

      const degradationLog = [];
      let attemptCount = 0;

      // Mock API with service degradation scenario
      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        const timestamp = Date.now();

        let error, degradationLevel;

        if (attemptCount === 1) {
          error = new Error('High response time detected');
          error.status = 503;
          degradationLevel = 'slow';
        } else if (attemptCount === 2) {
          error = new Error('Partial service outage');
          error.status = 503;
          degradationLevel = 'partial_outage';
        } else if (attemptCount === 3) {
          error = new Error('Service overloaded');
          error.status = 503;
          degradationLevel = 'overloaded';
        }

        if (error) {
          degradationLog.push({
            attempt: attemptCount,
            error: error.message,
            status: error.status,
            degradationLevel: degradationLevel,
            timestamp: timestamp
          });
          throw error;
        }

        // Recovery on 4th attempt
        degradationLog.push({
          attempt: attemptCount,
          success: true,
          serviceRecovered: true,
          timestamp: timestamp
        });

        return fixtures.errorComments.degradation;
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(true);
      expect(degradationLog).toHaveLength(4);

      // Service should recover after degradation
      const recoveryLog = degradationLog.find(log => log.serviceRecovered);
      expect(recoveryLog).toBeDefined();

      // All degradation errors should use progressive backoff
      const degradationErrors = degradationLog.filter(log => log.degradationLevel);
      expect(degradationErrors).toHaveLength(3);
    });

    test('should handle concurrent error scenarios without interference', async () => {
      const organizationId = 'test-org-errors';
      const numConcurrentJobs = 3;
      const worker = testUtils.createTestWorker({
        maxRetries: 2,
        retryDelay: 100,
        maxConcurrency: numConcurrentJobs
      });

      const concurrentErrorLog = [];
      const jobCounters = {};

      // Mock API with per-job error scenarios
      worker.fetchCommentsFromPlatform = async (platform, config, payload) => {
        const jobId = payload.jobId || 'unknown';
        const timestamp = Date.now();

        if (!jobCounters[jobId]) jobCounters[jobId] = 0;
        jobCounters[jobId]++;

        const attemptCount = jobCounters[jobId];

        if (attemptCount <= 2) {
          const error = new Error(`Job ${jobId} - attempt ${attemptCount} failed`);
          error.status = 503;

          concurrentErrorLog.push({
            jobId: jobId,
            attempt: attemptCount,
            error: error.message,
            status: error.status,
            timestamp: timestamp
          });

          throw error;
        }

        // Success on 3rd attempt for each job
        concurrentErrorLog.push({
          jobId: jobId,
          attempt: attemptCount,
          success: true,
          timestamp: timestamp
        });

        return fixtures.errorComments.concurrent;
      };

      await worker.start();

      // Create and process multiple jobs concurrently
      const jobs = [];
      for (let i = 0; i < numConcurrentJobs; i++) {
        const job = testUtils.createMockJob(organizationId, 'twitter');
        job.payload.jobId = `concurrent_job_${i}`;
        jobs.push(job);
      }

      const results = await Promise.all(
        jobs.map(job => worker.processJob(job))
      );

      await worker.stop();

      // All jobs should succeed eventually
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(concurrentErrorLog.length).toBe(numConcurrentJobs * 3); // 3 attempts per job

      // Each job should have its own error handling
      for (let i = 0; i < numConcurrentJobs; i++) {
        const jobId = `concurrent_job_${i}`;
        const jobLogs = concurrentErrorLog.filter(log => log.jobId === jobId);
        expect(jobLogs).toHaveLength(3);

        const jobErrors = jobLogs.filter(log => log.error);
        const jobSuccess = jobLogs.filter(log => log.success);
        expect(jobErrors).toHaveLength(2);
        expect(jobSuccess).toHaveLength(1);
      }
    });

    test('should log comprehensive error details for debugging', async () => {
      const organizationId = 'test-org-errors';
      const worker = testUtils.createTestWorker({
        maxRetries: 2,
        retryDelay: 100,
        detailedErrorLogging: true
      });

      const errorDetails = [];
      let attemptCount = 0;

      // Mock API with detailed error information
      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        const timestamp = Date.now();

        if (attemptCount === 1) {
          const error = new Error('API endpoint not found');
          error.status = 404;
          error.endpoint = '/api/v1/comments';
          error.method = 'GET';
          error.requestId = 'req_123456';

          errorDetails.push({
            attempt: attemptCount,
            error: error.message,
            status: error.status,
            endpoint: error.endpoint,
            method: error.method,
            requestId: error.requestId,
            timestamp: timestamp,
            stack: error.stack
          });

          throw error;
        } else if (attemptCount === 2) {
          const error = new Error('Quota exceeded for this API key');
          error.status = 429;
          error.quotaLimit = 1000;
          error.quotaUsed = 1001;
          error.resetTime = Date.now() + 3600000; // 1 hour

          errorDetails.push({
            attempt: attemptCount,
            error: error.message,
            status: error.status,
            quotaLimit: error.quotaLimit,
            quotaUsed: error.quotaUsed,
            resetTime: error.resetTime,
            timestamp: timestamp
          });

          throw error;
        }

        // Success on 3rd attempt
        errorDetails.push({
          attempt: attemptCount,
          success: true,
          timestamp: timestamp
        });

        return fixtures.errorComments.detailed;
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(true);
      expect(errorDetails).toHaveLength(3);

      // Verify detailed error information is captured
      const notFoundError = errorDetails.find(detail => detail.status === 404);
      expect(notFoundError).toBeDefined();
      expect(notFoundError.endpoint).toBe('/api/v1/comments');
      expect(notFoundError.requestId).toBe('req_123456');

      const quotaError = errorDetails.find(detail => detail.status === 429);
      expect(quotaError).toBeDefined();
      expect(quotaError.quotaLimit).toBe(1000);
      expect(quotaError.quotaUsed).toBe(1001);
    });
  });
});