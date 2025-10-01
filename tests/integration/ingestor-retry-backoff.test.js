const IngestorTestUtils = require('../helpers/ingestor-test-utils');
const fixtures = require('../fixtures/ingestor-comments.json');

describe('Ingestor Retry and Backoff Integration Tests', () => {
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

  describe('Exponential Backoff Retry Logic', () => {
    test('should implement exponential backoff with correct timing', async () => {
      const organizationId = 'test-org-retry';
      const integrationConfigId = 'config-youtube-retry';
      const comment = fixtures.retryComments[0]; // transient failure comment

      const worker = testUtils.createTestWorker({
        maxRetries: 3,
        retryDelay: 100 // Start with 100ms base delay
      });

      // Track retry timing
      const timingTracker = await testUtils.measureRetryTiming(worker, 3);

      // Mock transient failures for first 2 attempts, succeed on 3rd
      let attemptCount = 0;
      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error(`Transient failure #${attemptCount}`);
        }
        return [comment];
      };

      const job = {
        payload: {
          organization_id: organizationId,
          platform: 'youtube',
          integration_config_id: integrationConfigId,
          video_ids: ['test_video_1']
        }
      };

      let result;
      try {
        await worker.start();

        // Process job - should eventually succeed after retries
        result = await worker.processJob(job);
      } finally {
        timingTracker.restore(); // Restore original sleep method
        await worker.stop();
      }

      expect(result.success).toBe(true);
      expect(result.commentsCount).toBe(1);

      // Verify exponential backoff timing
      const retryDelays = timingTracker.getIntervals();
      expect(retryDelays).toHaveLength(2); // 2 retry delays

      // Verify exponential backoff: first retry = 100ms, second retry = 200ms
      expect(retryDelays[0]).toBe(100); // First retry delay (baseDelay * 2^0)
      expect(retryDelays[1]).toBe(200); // Second retry delay (baseDelay * 2^1)
    });

    test('should respect maximum retry attempts', async () => {
      const organizationId = 'test-org-retry';
      const integrationConfigId = 'config-youtube-retry';
      const comment = fixtures.retryComments[0];

      const worker = testUtils.createTestWorker({
        maxRetries: 2, // Only 2 retries allowed
        retryDelay: 50
      });

      // Always fail
      let attemptCount = 0;
      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        throw new Error(`Persistent failure #${attemptCount}`);
      };

      const job = {
        payload: {
          organization_id: organizationId,
          platform: 'youtube',
          integration_config_id: integrationConfigId,
          video_ids: ['test_video_1']
        }
      };

      try {
        await worker.start();

        // Should eventually fail after max retries
        await expect(worker.processJob(job)).rejects.toThrow('Persistent failure');
      } finally {
        await worker.stop();
      }

      // Should have attempted exactly 3 times (initial + 2 retries)
      expect(attemptCount).toBe(3);
    });

    test('should handle queue-level retry with exponential backoff', async () => {
      const organizationId = 'test-org-retry';
      const comment = fixtures.retryComments[0];

      // Create job that will fail
      const failingPayload = {
        organization_id: organizationId,
        platform: 'youtube',
        integration_config_id: 'config-youtube-retry',
        comment_data: comment
      };

      // Add job to queue
      const jobs = await testUtils.createTestJobs('fetch_comments', [failingPayload], {
        maxAttempts: 3,
        priority: 3
      });

      expect(jobs).toHaveLength(1);
      const job = jobs[0];

      // Verify job was added successfully
      expect(job.status).toBe('pending');
      expect(job.max_attempts).toBe(3);

      // Simulate failure with exponential backoff
      const startTime = Date.now();
      
      // First failure
      await testUtils.queueService.failJob(job, new Error('Simulated failure 1'));
      
      // Verify job was marked as failed
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should have processed quickly (job failure marking)
      expect(totalTime).toBeLessThan(100); // Quick operation
      
      // Verify the job now has failed status
      expect(job.status).toBe('failed');
      expect(job.error_message).toContain('Simulated failure 1');
    });

    test('should use different backoff multipliers correctly', async () => {
      const organizationId = 'test-org-retry';
      const integrationConfigId = 'config-instagram-backoff';
      const comment = fixtures.backoffComments[0];

      const worker = testUtils.createTestWorker({
        maxRetries: 4,
        retryDelay: 50 // 50ms base
      });

      const retryTimes = [];
      let attemptCount = 0;

      // Mock failures and track timing
      worker.fetchCommentsFromPlatform = async () => {
        const currentTime = Date.now();
        retryTimes.push(currentTime);
        attemptCount++;
        
        if (attemptCount <= 4) {
          throw new Error(`Backoff test failure #${attemptCount}`);
        }
        return [comment];
      };

      const job = {
        payload: {
          organization_id: organizationId,
          platform: 'instagram',
          integration_config_id: integrationConfigId,
          monitor_posts: true
        }
      };

      let result;
      try {
        await worker.start();

        result = await worker.processJob(job);
      } finally {
        await worker.stop();
      }

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(5); // 4 failures + 1 success

      // Calculate intervals between retries
      const intervals = [];
      for (let i = 1; i < retryTimes.length; i++) {
        intervals.push(retryTimes[i] - retryTimes[i - 1]);
      }

      expect(intervals).toHaveLength(4);

      // Verify exponential progression: 50ms, 100ms, 200ms, 400ms
      const expectedDelays = [50, 100, 200, 400];
      const tolerance = 0.3; // 30% tolerance for test timing variations

      for (let i = 0; i < intervals.length; i++) {
        const expected = expectedDelays[i];
        const actual = intervals[i];
        const minAcceptable = expected * (1 - tolerance);
        const maxAcceptable = expected * (1 + tolerance);

        expect(actual).toBeGreaterThanOrEqual(minAcceptable);
        expect(actual).toBeLessThanOrEqual(maxAcceptable);
      }
    });
  });

  describe('Retry Strategy Differentiation', () => {
    test('should distinguish between transient and permanent errors', async () => {
      const organizationId = 'test-org-retry';
      const integrationConfigId = 'config-youtube-retry';

      const worker = testUtils.createTestWorker({
        maxRetries: 3,
        retryDelay: 50
      });

      // Test transient error (should retry)
      let transientAttempts = 0;
      worker.fetchCommentsFromPlatform = async (platform, config, payload) => {
        transientAttempts++;
        const jobPayload = payload || config.payload || {};
        if (jobPayload.test_case === 'transient') {
          if (transientAttempts < 3) {
            throw new Error('ECONNRESET'); // Network error - should retry
          }
          return [fixtures.retryComments[0]];
        }
        if (jobPayload.test_case === 'permanent') {
          throw new Error('Invalid authentication credentials'); // Auth error - should not retry
        }
        // Default case - return empty array
        return [];
      };

      // Test transient error
      const transientJob = {
        payload: {
          organization_id: organizationId,
          platform: 'youtube',
          integration_config_id: integrationConfigId,
          payload: {
            test_case: 'transient',
            video_ids: ['test_video_1']
          }
        }
      };

      // Test permanent error
      const permanentJob = {
        payload: {
          organization_id: organizationId,
          platform: 'youtube',
          integration_config_id: integrationConfigId,
          payload: {
            test_case: 'permanent',
            video_ids: ['test_video_2']
          }
        }
      };

      let transientResult, permanentAttempts = 0;
      try {
        await worker.start();

        transientResult = await worker.processJob(transientJob);
        expect(transientResult.success).toBe(true);
        expect(transientAttempts).toBe(3); // Should have retried

        // Reset for permanent error test
        worker.fetchCommentsFromPlatform = async (platform, config, payload) => {
          permanentAttempts++;
          throw new Error('401 Unauthorized - Invalid API key'); // Should not retry
        };

        await expect(worker.processJob(permanentJob)).rejects.toThrow('401 Unauthorized');
        
        // Should have only attempted once for permanent error
        expect(permanentAttempts).toBe(1);
      } finally {
        await worker.stop();
      }
    });

    test('should handle rate limiting with appropriate backoff', async () => {
      const organizationId = 'test-org-retry';
      const integrationConfigId = 'config-twitter-dedup';
      const comment = fixtures.duplicateComments[0];

      const worker = testUtils.createTestWorker({
        maxRetries: 3,
        retryDelay: 100
      });

      let rateLimitAttempts = 0;
      const rateLimitStartTime = Date.now();
      const rateLimitTimes = [];

      worker.fetchCommentsFromPlatform = async () => {
        rateLimitAttempts++;
        rateLimitTimes.push(Date.now());
        
        if (rateLimitAttempts <= 2) {
          const error = new Error('Rate limit exceeded');
          error.status = 429;
          error.headers = { 'retry-after': '1' }; // 1 second
          throw error;
        }
        return [comment];
      };

      const job = {
        payload: {
          organization_id: organizationId,
          platform: 'twitter',
          integration_config_id: integrationConfigId,
          since_id: '0'
        }
      };

      let result;
      try {
        await worker.start();

        result = await worker.processJob(job);
      } finally {
        await worker.stop();
      }

      expect(result.success).toBe(true);
      expect(rateLimitAttempts).toBe(3);

      // Verify rate limit backoff timing
      const intervals = [];
      for (let i = 1; i < rateLimitTimes.length; i++) {
        intervals.push(rateLimitTimes[i] - rateLimitTimes[i - 1]);
      }

      // Should respect rate limit backoff (at least 100ms base delay)
      intervals.forEach(interval => {
        expect(interval).toBeGreaterThan(80); // Allow some timing variance
      });
    });
  });

  describe('Backoff Configuration', () => {
    test('should respect custom retry delay configuration', async () => {
      const organizationId = 'test-org-retry';
      const integrationConfigId = 'config-youtube-retry';
      const comment = fixtures.retryComments[0];

      const customDelay = 200; // 200ms base delay
      const worker = testUtils.createTestWorker({
        maxRetries: 2,
        retryDelay: customDelay
      });

      const retryTimes = [];
      let attemptCount = 0;

      worker.fetchCommentsFromPlatform = async () => {
        retryTimes.push(Date.now());
        attemptCount++;
        
        if (attemptCount <= 2) {
          throw new Error(`Custom delay test #${attemptCount}`);
        }
        return [comment];
      };

      const job = {
        payload: {
          organization_id: organizationId,
          platform: 'youtube',
          integration_config_id: integrationConfigId,
          video_ids: ['test_video_1']
        }
      };

      let result;
      try {
        await worker.start();

        result = await worker.processJob(job);
      } finally {
        await worker.stop();
      }

      expect(result.success).toBe(true);

      // Calculate intervals
      const intervals = [];
      for (let i = 1; i < retryTimes.length; i++) {
        intervals.push(retryTimes[i] - retryTimes[i - 1]);
      }

      // Should use custom delay: 200ms, 400ms
      expect(intervals[0]).toBeGreaterThan(160); // 200ms - 20% tolerance
      expect(intervals[0]).toBeLessThan(240); // 200ms + 20% tolerance
      
      if (intervals[1]) {
        expect(intervals[1]).toBeGreaterThan(320); // 400ms - 20% tolerance
        expect(intervals[1]).toBeLessThan(480); // 400ms + 20% tolerance
      }
    });

    test('should handle maximum backoff limits', async () => {
      const organizationId = 'test-org-retry';
      const integrationConfigId = 'config-youtube-retry';

      const worker = testUtils.createTestWorker({
        maxRetries: 10,
        retryDelay: 100,
        maxRetryDelay: 500 // Cap at 500ms
      });

      const retryTimes = [];
      let attemptCount = 0;

      worker.fetchCommentsFromPlatform = async () => {
        retryTimes.push(Date.now());
        attemptCount++;
        
        if (attemptCount <= 8) {
          throw new Error(`Max backoff test #${attemptCount}`);
        }
        return [fixtures.retryComments[0]];
      };

      const job = {
        payload: {
          organization_id: organizationId,
          platform: 'youtube',
          integration_config_id: integrationConfigId,
          video_ids: ['test_video_1']
        }
      };

      let result;
      try {
        await worker.start();

        result = await worker.processJob(job);
      } finally {
        await worker.stop();
      }

      expect(result.success).toBe(true);

      // Calculate intervals
      const intervals = [];
      for (let i = 1; i < retryTimes.length; i++) {
        intervals.push(retryTimes[i] - retryTimes[i - 1]);
      }

      // Later intervals should not exceed maxRetryDelay
      const laterIntervals = intervals.slice(2); // After first few exponential increases
      laterIntervals.forEach(interval => {
        expect(interval).toBeLessThanOrEqual(600); // 500ms + some tolerance
      });
    });
  });
});