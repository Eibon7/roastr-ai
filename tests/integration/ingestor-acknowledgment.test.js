const IngestorTestUtils = require('../helpers/ingestor-test-utils');
const fixtures = require('../fixtures/ingestor-comments.json');

describe('Ingestor Message Acknowledgment Integration Tests', () => {
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

  describe('Successful Job Acknowledgment', () => {
    test('should acknowledge jobs correctly after successful processing', async () => {
      const organizationId = 'test-org-dedup';
      const integrationConfigId = 'config-twitter-dedup';
      const comment = fixtures.acknowledgmentComments[0]; // success comment

      // Create job in queue
      const jobs = await testUtils.createTestJobs('fetch_comments', [{
        organization_id: organizationId,
        platform: 'twitter',
        integration_config_id: integrationConfigId,
        comment_data: comment
      }]);

      expect(jobs).toHaveLength(1);
      const job = jobs[0];

      // Create worker
      const worker = testUtils.createTestWorker();

      // Mock successful comment fetching
      worker.fetchCommentsFromPlatform = async () => [comment];

      let result;
      try {
        await worker.start();

        // Process the job
        result = await worker.processJob(job);
      } finally {
        await worker.stop();
      }

      // Verify successful processing
      expect(result.success).toBe(true);
      expect(result.commentsCount).toBe(1);

      // Check job was marked as completed in queue
      const completedJobs = await testUtils.getJobsByType('fetch_comments');
      const completedJob = completedJobs.find(j => j.id === job.id);
      
      expect(completedJob).toBeDefined();
      expect(completedJob.status).toBe('completed');
      expect(completedJob.completed_at).toBeTruthy();
      expect(completedJob.result).toBeTruthy();

      // Verify comments were stored
      const storedComments = await testUtils.getCommentsByOrganization(organizationId);
      expect(storedComments).toHaveLength(1);
      expect(storedComments[0].platform_comment_id).toBe(comment.platform_comment_id);
    });

    test('should acknowledge multiple jobs in sequence', async () => {
      const organizationId = 'test-org-dedup';
      const integrationConfigId = 'config-twitter-dedup';
      const comments = fixtures.acknowledgmentComments;

      // Create multiple jobs
      const jobPayloads = comments.map(comment => ({
        organization_id: organizationId,
        platform: 'twitter',
        integration_config_id: integrationConfigId,
        comment_data: comment
      }));

      const jobs = await testUtils.createTestJobs('fetch_comments', jobPayloads);
      expect(jobs).toHaveLength(comments.length);

      const worker = testUtils.createTestWorker();

      // Mock to return different comment based on job payload
      worker.fetchCommentsFromPlatform = async (platform, config, payload) => {
        const commentData = payload.comment_data || comments[0];
        return [commentData];
      };

      const results = [];
      try {
        await worker.start();
        
        // Process all jobs
        for (const job of jobs) {
          const result = await worker.processJob(job);
          results.push(result);
        }
      } finally {
        await worker.stop();
      }

      // Verify all jobs were processed successfully
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.commentsCount).toBe(1);
      });

      // Check all jobs were acknowledged
      const completedJobs = await testUtils.getJobsByType('fetch_comments');
      const acknowledgedJobs = completedJobs.filter(j => j.status === 'completed');
      
      expect(acknowledgedJobs).toHaveLength(jobs.length);

      // Verify all have completion timestamps and results
      acknowledgedJobs.forEach(job => {
        expect(job.completed_at).toBeTruthy();
        expect(job.result).toBeTruthy();
      });

      // Verify all comments were stored
      const storedComments = await testUtils.getCommentsByOrganization(organizationId);
      expect(storedComments).toHaveLength(comments.length);
    });

    test('should preserve acknowledgment across worker restarts', async () => {
      const organizationId = 'test-org-dedup';
      const integrationConfigId = 'config-twitter-dedup';
      const comment = fixtures.acknowledgmentComments[0];

      // Create job
      const jobs = await testUtils.createTestJobs('fetch_comments', [{
        organization_id: organizationId,
        platform: 'twitter',
        integration_config_id: integrationConfigId,
        comment_data: comment
      }]);

      const job = jobs[0];

      // First worker processes and acknowledges
      const worker1 = testUtils.createTestWorker();
      worker1.fetchCommentsFromPlatform = async () => [comment];

      try {
        await worker1.start();
        await worker1.processJob(job);
      } finally {
        await worker1.stop();
      }

      // Verify acknowledgment persisted
      let completedJobs = await testUtils.getJobsByType('fetch_comments');
      let completedJob = completedJobs.find(j => j.id === job.id);
      expect(completedJob.status).toBe('completed');

      // Second worker should not reprocess acknowledged job
      const worker2 = testUtils.createTestWorker();
      worker2.fetchCommentsFromPlatform = async () => {
        throw new Error('Should not be called for acknowledged job');
      };

      let nextJob;
      try {
        await worker2.start();

        // Try to get next job - should not return the already completed one
        nextJob = await worker2.getNextJob();
      } finally {
        await worker2.stop();
      }

      expect(nextJob).toBeNull(); // No pending jobs

      // Verify job remains acknowledged
      completedJobs = await testUtils.getJobsByType('fetch_comments');
      completedJob = completedJobs.find(j => j.id === job.id);
      expect(completedJob.status).toBe('completed');
    });
  });

  describe('Failed Job Acknowledgment', () => {
    test('should properly handle failed job acknowledgment', async () => {
      const organizationId = 'test-org-retry';
      const integrationConfigId = 'config-youtube-retry';
      const comment = fixtures.retryComments[1]; // permanent failure comment

      // Create job
      const jobs = await testUtils.createTestJobs('fetch_comments', [{
        organization_id: organizationId,
        platform: 'youtube',
        integration_config_id: integrationConfigId,
        comment_data: comment
      }], { maxAttempts: 2 });

      const job = jobs[0];

      const worker = testUtils.createTestWorker({
        maxRetries: 2
      });

      // Mock persistent failure
      worker.fetchCommentsFromPlatform = async () => {
        throw new Error('Persistent platform failure');
      };

      try {
        await worker.start();

        // Should fail after retries
        await expect(worker.processJob(job)).rejects.toThrow('Persistent platform failure');
      } finally {
        await worker.stop();
      }

      // Check job was marked as failed
      const failedJobs = await testUtils.getJobsByType('fetch_comments');
      const failedJob = failedJobs.find(j => j.id === job.id);
      
      expect(failedJob).toBeDefined();
      expect(failedJob.status).toBe('failed');
      expect(failedJob.completed_at).toBeTruthy();
      expect(failedJob.error_message).toContain('Persistent platform failure');

      // Verify no comments were stored due to failure
      const storedComments = await testUtils.getCommentsByOrganization(organizationId);
      expect(storedComments).toHaveLength(0);
    });

    test('should acknowledge after successful retry', async () => {
      const organizationId = 'test-org-dedup';
      const integrationConfigId = 'config-twitter-dedup';
      const comment = fixtures.acknowledgmentComments[1]; // retry_then_success

      const jobs = await testUtils.createTestJobs('fetch_comments', [{
        organization_id: organizationId,
        platform: 'twitter',
        integration_config_id: integrationConfigId,
        comment_data: comment
      }], { maxAttempts: 3 });

      const job = jobs[0];

      const worker = testUtils.createTestWorker({
        maxRetries: 3,
        retryDelay: 50
      });

      // Fail first 2 attempts, succeed on 3rd
      let attemptCount = 0;
      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error(`Transient failure #${attemptCount}`);
        }
        return [comment];
      };

      let result;
      try {
        await worker.start();

        result = await worker.processJob(job);
      } finally {
        await worker.stop();
      }

      // Should succeed after retries
      expect(result.success).toBe(true);
      expect(result.commentsCount).toBe(1);
      expect(attemptCount).toBe(3);

      // Check job was acknowledged as completed (not failed)
      const completedJobs = await testUtils.getJobsByType('fetch_comments');
      const completedJob = completedJobs.find(j => j.id === job.id);
      
      expect(completedJob).toBeDefined();
      expect(completedJob.status).toBe('completed');
      expect(completedJob.completed_at).toBeTruthy();
      expect(completedJob.result).toBeTruthy();

      // Verify comment was stored
      const storedComments = await testUtils.getCommentsByOrganization(organizationId);
      expect(storedComments).toHaveLength(1);
    });
  });

  describe('Acknowledgment Timing and Performance', () => {
    test('should acknowledge jobs promptly after completion', async () => {
      const organizationId = 'test-org-dedup';
      const integrationConfigId = 'config-twitter-dedup';
      const comment = fixtures.acknowledgmentComments[0];

      const jobs = await testUtils.createTestJobs('fetch_comments', [{
        organization_id: organizationId,
        platform: 'twitter',
        integration_config_id: integrationConfigId,
        comment_data: comment
      }]);

      const job = jobs[0];

      const worker = testUtils.createTestWorker();
      worker.fetchCommentsFromPlatform = async () => [comment];

      let startTime, endTime;
      try {
        await worker.start();

        startTime = Date.now();
        await worker.processJob(job);
        endTime = Date.now();
      } finally {
        await worker.stop();
      }

      const processingTime = endTime - startTime;

      // Check job was acknowledged quickly (within processing time + small buffer)
      const completedJobs = await testUtils.getJobsByType('fetch_comments');
      const completedJob = completedJobs.find(j => j.id === job.id);
      
      expect(completedJob.status).toBe('completed');
      
      const completedAt = new Date(completedJob.completed_at);
      const ackTime = completedAt.getTime() - startTime;
      
      // Acknowledgment should happen within processing time + 100ms buffer
      expect(ackTime).toBeLessThanOrEqual(processingTime + 100);
    });

    test('should handle concurrent job acknowledgments correctly', async () => {
      const organizationId = 'test-org-dedup';
      const integrationConfigId = 'config-twitter-dedup';

      // Create multiple concurrent jobs
      const concurrentJobs = [];
      for (let i = 0; i < 5; i++) {
        const comment = {
          ...fixtures.acknowledgmentComments[0],
          platform_comment_id: `concurrent_${i}`,
          original_text: `Concurrent comment ${i}`
        };

        const jobs = await testUtils.createTestJobs('fetch_comments', [{
          organization_id: organizationId,
          platform: 'twitter',
          integration_config_id: integrationConfigId,
          comment_data: comment
        }]);

        concurrentJobs.push({ job: jobs[0], comment });
      }

      const worker = testUtils.createTestWorker({
        maxConcurrency: 3 // Allow concurrent processing
      });

      worker.fetchCommentsFromPlatform = async (platform, config, payload) => {
        // Simulate some processing time
        await testUtils.sleep(50);
        return [payload.comment_data];
      };

      let results;
      try {
        await worker.start();

        // Process all jobs concurrently
        const promises = concurrentJobs.map(({ job }) => worker.processJob(job));
        results = await Promise.all(promises);
      } finally {
        await worker.stop();
      }

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.commentsCount).toBe(1);
      });

      // All should be acknowledged
      const completedJobs = await testUtils.getJobsByType('fetch_comments');
      const acknowledgedJobs = completedJobs.filter(j => j.status === 'completed');
      
      expect(acknowledgedJobs).toHaveLength(concurrentJobs.length);

      // Verify completion times exist (may have same timestamp if processed very fast)
      const completionTimes = acknowledgedJobs.map(j => j.completed_at);
      acknowledgedJobs.forEach(job => {
        expect(job.completed_at).toBeTruthy();
      });

      // Verify all comments were stored
      const storedComments = await testUtils.getCommentsByOrganization(organizationId);
      expect(storedComments).toHaveLength(concurrentJobs.length);
    });
  });

  describe('Acknowledgment Error Handling', () => {
    test('should handle acknowledgment failures gracefully', async () => {
      const organizationId = 'test-org-dedup';
      const integrationConfigId = 'config-twitter-dedup';
      const comment = fixtures.acknowledgmentComments[0];

      const jobs = await testUtils.createTestJobs('fetch_comments', [{
        organization_id: organizationId,
        platform: 'twitter',
        integration_config_id: integrationConfigId,
        comment_data: comment
      }]);

      const job = jobs[0];

      const worker = testUtils.createTestWorker();
      worker.fetchCommentsFromPlatform = async () => [comment];

      // Mock acknowledgment failure
      const originalMarkJobCompleted = worker.markJobCompleted;
      worker.markJobCompleted = async (job, result, processingTime) => {
        throw new Error('Simulated acknowledgment failure');
      };

      let result;
      try {
        await worker.start();

        // Job processing should still succeed despite ack failure
        result = await worker.processJob(job);
        expect(result.success).toBe(true);
      } finally {
        await worker.stop();
      }

      // Restore original method for cleanup
      worker.markJobCompleted = originalMarkJobCompleted;

      // Verify comments were still stored despite ack failure
      const storedComments = await testUtils.getCommentsByOrganization(organizationId);
      expect(storedComments).toHaveLength(1);
    });
  });
});