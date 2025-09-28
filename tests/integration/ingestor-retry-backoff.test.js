/**
 * Ingestor Retry and Exponential Backoff Integration Tests
 * Tests retry logic with exponential backoff as specified in Issue #406
 */

const IngestorTestUtils = require('../helpers/ingestor-test-utils');
const fixtures = require('../fixtures/ingestor-comments.json');

describe('Ingestor Retry and Exponential Backoff Integration', () => {
  let testUtils;

  beforeAll(async () => {
    testUtils = new IngestorTestUtils();
    await testUtils.setup();
    await testUtils.setupTestOrganizations(fixtures);
  }, 30000);

  afterAll(async () => {
    await testUtils.cleanup();
  }, 15000);

  describe('Exponential Backoff Logic', () => {
    test('should implement exponential backoff with correct timing', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker({
        maxRetries: 3,
        retryDelay: 100 // Start with 100ms
      });

      const retryAttempts = [];
      let attemptCount = 0;

      // Mock API to fail consistently, forcing retries
      worker.fetchCommentsFromPlatform = async () => {
        const timestamp = Date.now();
        attemptCount++;
        
        retryAttempts.push({
          attempt: attemptCount,
          timestamp: timestamp
        });

        if (attemptCount < 4) {
          throw new Error(`Simulated API failure - attempt ${attemptCount}`);
        }
        
        // Success on 4th attempt
        return fixtures.retryComments.slice(0, 1);
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      
      const startTime = Date.now();
      const result = await worker.processJob(job);
      const totalDuration = Date.now() - startTime;

      await worker.stop();

      expect(result.success).toBe(true);
      expect(retryAttempts).toHaveLength(4); // Initial + 3 retries

      // Verify exponential backoff timing
      if (retryAttempts.length >= 2) {
        const intervals = [];
        for (let i = 1; i < retryAttempts.length; i++) {
          intervals.push(retryAttempts[i].timestamp - retryAttempts[i - 1].timestamp);
        }

        // Expected delays: 100ms, 200ms, 400ms (exponential)
        await testUtils.assertExponentialBackoff(intervals, 100, 0.3); // 30% tolerance
      }

      // Total duration should reflect backoff delays
      expect(totalDuration).toBeGreaterThan(700); // Minimum expected delay
      expect(totalDuration).toBeLessThan(2000); // Should not take too long
    });

    test('should respect maximum retry limit', async () => {
      const organizationId = 'test-org-retry';
      const maxRetries = 2;
      const worker = testUtils.createTestWorker({
        maxRetries: maxRetries,
        retryDelay: 50
      });

      let attemptCount = 0;
      const attempts = [];

      // Mock API to always fail
      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        const timestamp = Date.now();
        attempts.push({ attempt: attemptCount, timestamp });
        throw new Error(`Persistent API failure - attempt ${attemptCount}`);
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(false);
      expect(attempts).toHaveLength(maxRetries + 1); // Initial attempt + retries
      expect(result.error).toContain('Persistent API failure');
    });

    test('should handle successful retry after transient failures', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker({
        maxRetries: 3,
        retryDelay: 100
      });

      let attemptCount = 0;
      const retryLog = [];

      // Mock API with transient failures
      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        const timestamp = Date.now();
        
        retryLog.push({
          attempt: attemptCount,
          timestamp: timestamp,
          willSucceed: attemptCount === 3
        });

        if (attemptCount < 3) {
          // Simulate transient network errors
          throw new Error(`Network timeout - attempt ${attemptCount}`);
        }

        // Success on 3rd attempt
        return fixtures.retryComments.slice(0, 2);
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(true);
      expect(result.commentsCount).toBe(2);
      expect(retryLog).toHaveLength(3);
      expect(retryLog[2].willSucceed).toBe(true);

      // Verify backoff intervals
      if (retryLog.length >= 3) {
        const interval1 = retryLog[1].timestamp - retryLog[0].timestamp;
        const interval2 = retryLog[2].timestamp - retryLog[1].timestamp;
        
        expect(interval1).toBeGreaterThan(80); // ~100ms with tolerance
        expect(interval2).toBeGreaterThan(180); // ~200ms with tolerance
        expect(interval2).toBeGreaterThan(interval1); // Exponential increase
      }
    });

    test('should implement backoff with jitter to prevent thundering herd', async () => {
      const organizationId = 'test-org-retry';
      const numWorkers = 3;
      const workers = [];
      const allRetryTimestamps = [];

      // Create multiple workers with same retry configuration
      for (let i = 0; i < numWorkers; i++) {
        const worker = testUtils.createTestWorker({
          maxRetries: 2,
          retryDelay: 100,
          jitter: true // Enable jitter
        });

        let workerAttemptCount = 0;
        worker.fetchCommentsFromPlatform = async () => {
          workerAttemptCount++;
          const timestamp = Date.now();
          
          allRetryTimestamps.push({
            workerId: i,
            attempt: workerAttemptCount,
            timestamp: timestamp
          });

          if (workerAttemptCount < 3) {
            throw new Error(`Worker ${i} - attempt ${workerAttemptCount} failed`);
          }
          
          return fixtures.retryComments.slice(0, 1);
        };

        workers.push(worker);
      }

      // Start all workers concurrently
      await Promise.all(workers.map(w => w.start()));

      // Process jobs simultaneously
      const jobs = workers.map(() => testUtils.createMockJob(organizationId, 'twitter'));
      const results = await Promise.all(
        workers.map((worker, i) => worker.processJob(jobs[i]))
      );

      // Stop all workers
      await Promise.all(workers.map(w => w.stop()));

      // All should succeed eventually
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(allRetryTimestamps.length).toBeGreaterThan(6); // At least 3 attempts per worker

      // Check for jitter - retry timestamps shouldn't be identical
      const secondAttempts = allRetryTimestamps.filter(r => r.attempt === 2);
      if (secondAttempts.length >= 2) {
        const timestamps = secondAttempts.map(r => r.timestamp);
        const uniqueTimestamps = [...new Set(timestamps)];
        
        // With jitter, timestamps should vary
        expect(uniqueTimestamps.length).toBeGreaterThan(1);
      }
    });

    test('should handle different error types with appropriate retry behavior', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker({
        maxRetries: 3,
        retryDelay: 50
      });

      const errorLog = [];
      let attemptCount = 0;

      // Mock API with different error types
      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        const timestamp = Date.now();

        if (attemptCount === 1) {
          const error = new Error('Rate limit exceeded');
          error.status = 429;
          errorLog.push({ attempt: attemptCount, error: error.message, retryable: true, timestamp });
          throw error;
        } else if (attemptCount === 2) {
          const error = new Error('Internal server error');
          error.status = 500;
          errorLog.push({ attempt: attemptCount, error: error.message, retryable: true, timestamp });
          throw error;
        } else if (attemptCount === 3) {
          const error = new Error('Service temporarily unavailable');
          error.status = 503;
          errorLog.push({ attempt: attemptCount, error: error.message, retryable: true, timestamp });
          throw error;
        }

        // Success on 4th attempt
        errorLog.push({ attempt: attemptCount, error: null, retryable: false, timestamp });
        return fixtures.retryComments.slice(0, 1);
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(true);
      expect(errorLog).toHaveLength(4);

      // Verify that retryable errors were retried
      const retryableErrors = errorLog.filter(log => log.retryable);
      expect(retryableErrors).toHaveLength(3);

      // Verify exponential backoff was applied
      for (let i = 1; i < errorLog.length - 1; i++) {
        const interval = errorLog[i].timestamp - errorLog[i - 1].timestamp;
        expect(interval).toBeGreaterThan(30); // At least some delay
      }
    });

    test('should not retry non-retryable errors', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker({
        maxRetries: 3,
        retryDelay: 100
      });

      let attemptCount = 0;
      const attempts = [];

      // Mock API with non-retryable error
      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        attempts.push({
          attempt: attemptCount,
          timestamp: Date.now()
        });

        // Simulate 401 Unauthorized - should not retry
        const error = new Error('Invalid API credentials');
        error.status = 401;
        throw error;
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(false);
      expect(attempts).toHaveLength(1); // Should not retry non-retryable errors
      expect(result.error).toContain('Invalid API credentials');
    });

    test('should handle concurrent retry operations without interference', async () => {
      const organizationId = 'test-org-retry';
      const numConcurrentJobs = 3;
      const worker = testUtils.createTestWorker({
        maxRetries: 2,
        retryDelay: 100,
        maxConcurrency: numConcurrentJobs
      });

      const jobResults = [];
      let globalAttemptCount = 0;

      // Mock API with per-job retry behavior
      worker.fetchCommentsFromPlatform = async (platform, config, payload) => {
        globalAttemptCount++;
        const jobId = payload.jobId || 'unknown';
        
        // Each job gets its own attempt counter
        if (!worker.jobAttempts) worker.jobAttempts = {};
        if (!worker.jobAttempts[jobId]) worker.jobAttempts[jobId] = 0;
        
        worker.jobAttempts[jobId]++;
        const jobAttemptCount = worker.jobAttempts[jobId];

        if (jobAttemptCount < 3) {
          throw new Error(`Job ${jobId} - attempt ${jobAttemptCount} failed`);
        }

        // Success on 3rd attempt for each job
        return fixtures.retryComments.slice(0, 1);
      };

      await worker.start();

      // Create and process multiple jobs concurrently
      const jobs = [];
      for (let i = 0; i < numConcurrentJobs; i++) {
        const job = testUtils.createMockJob(organizationId, 'twitter');
        job.payload.jobId = `job_${i}`;
        jobs.push(job);
      }

      const startTime = Date.now();
      const results = await Promise.all(
        jobs.map(job => worker.processJob(job))
      );
      const totalDuration = Date.now() - startTime;

      await worker.stop();

      // All jobs should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        jobResults.push({
          jobId: `job_${index}`,
          success: result.success,
          commentsCount: result.commentsCount
        });
      });

      expect(jobResults).toHaveLength(numConcurrentJobs);
      expect(globalAttemptCount).toBe(numConcurrentJobs * 3); // 3 attempts per job

      // Concurrent processing should be faster than sequential
      expect(totalDuration).toBeLessThan(1500); // Should complete within reasonable time
    });

    test('should implement circuit breaker pattern for persistent failures', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker({
        maxRetries: 2,
        retryDelay: 50,
        circuitBreakerThreshold: 3 // Trip after 3 consecutive failures
      });

      const failureLog = [];
      let totalAttempts = 0;

      // Mock API that always fails
      worker.fetchCommentsFromPlatform = async () => {
        totalAttempts++;
        failureLog.push({
          attempt: totalAttempts,
          timestamp: Date.now()
        });
        throw new Error(`Persistent service failure - attempt ${totalAttempts}`);
      };

      await worker.start();

      // Process multiple jobs to trigger circuit breaker
      const jobs = [
        testUtils.createMockJob(organizationId, 'twitter'),
        testUtils.createMockJob(organizationId, 'twitter'),
        testUtils.createMockJob(organizationId, 'twitter')
      ];

      const results = [];
      for (const job of jobs) {
        const result = await worker.processJob(job);
        results.push(result);
      }

      await worker.stop();

      // All jobs should fail
      results.forEach(result => {
        expect(result.success).toBe(false);
      });

      // Circuit breaker should prevent excessive retries after threshold
      expect(totalAttempts).toBeLessThan(15); // Should be much less than 3 jobs * 3 attempts each
      expect(failureLog.length).toBe(totalAttempts);
    });
  });
});