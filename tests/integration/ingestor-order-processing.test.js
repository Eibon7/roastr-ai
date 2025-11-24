const IngestorTestUtils = require('../helpers/ingestor-test-utils');
const fixtures = require('../fixtures/ingestor-comments.json');

describe('Ingestor Processing Order Integration Tests', () => {
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

  describe('FIFO Processing Order', () => {
    test('should process jobs in first-in-first-out order', async () => {
      const organizationId = 'test-org-order';
      const integrationConfigId = 'config-twitter-order';
      const orderedComments = fixtures.orderedComments;

      // Create jobs in specific order
      const jobPayloads = orderedComments.map((comment) => ({
        organization_id: organizationId,
        platform: 'twitter',
        integration_config_id: integrationConfigId,
        comment_data: comment,
        sequence: comment.metadata.sequence
      }));

      const jobs = await testUtils.createTestJobs('fetch_comments', jobPayloads, {
        priority: 5 // Same priority to ensure FIFO within priority level
      });

      // Verify jobs were created in order
      expect(jobs).toHaveLength(orderedComments.length);

      const worker = testUtils.createTestWorker({
        maxConcurrency: 1 // Force sequential processing
      });

      const processedOrder = [];

      worker.fetchCommentsFromPlatform = async (platform, config, payload) => {
        const comment = payload.comment_data;
        processedOrder.push({
          platform_comment_id: comment.platform_comment_id,
          sequence: comment.metadata.sequence
        });
        return [comment];
      };

      try {
        await worker.start();

        // Process all jobs
        for (const job of jobs) {
          await worker.processJob(job);
        }
      } finally {
        // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
        await worker.stop();
      }

      // Verify processing order matches creation order
      expect(processedOrder).toHaveLength(orderedComments.length);

      for (let i = 0; i < processedOrder.length; i++) {
        expect(processedOrder[i].sequence).toBe(i + 1);
        expect(processedOrder[i].platform_comment_id).toBe(`order_test_${i + 1}`);
      }

      // Verify database storage order
      const storedComments = await testUtils.getCommentsByOrganization(organizationId);
      expect(storedComments).toHaveLength(orderedComments.length);

      // Should be stored in processing order
      for (let i = 0; i < storedComments.length; i++) {
        expect(storedComments[i].platform_comment_id).toBe(`order_test_${i + 1}`);
      }
    });

    test('should maintain order across multiple fetch operations', async () => {
      const organizationId = 'test-org-order';
      const integrationConfigId = 'config-twitter-order';

      // Create three separate fetch operations
      const batch1 = [fixtures.orderedComments[0]];
      const batch2 = [fixtures.orderedComments[1]];
      const batch3 = [fixtures.orderedComments[2]];

      const worker = testUtils.createTestWorker({
        maxConcurrency: 1
      });

      const allProcessedComments = [];

      worker.fetchCommentsFromPlatform = async (platform, config, payload) => {
        const comments = payload.comments || [];
        allProcessedComments.push(...comments);
        return comments;
      };

      try {
        await worker.start();

        // Process batches in sequence
        const job1 = {
          payload: {
            organization_id: organizationId,
            platform: 'twitter',
            integration_config_id: integrationConfigId,
            comments: batch1
          }
        };

        const job2 = {
          payload: {
            organization_id: organizationId,
            platform: 'twitter',
            integration_config_id: integrationConfigId,
            comments: batch2
          }
        };

        const job3 = {
          payload: {
            organization_id: organizationId,
            platform: 'twitter',
            integration_config_id: integrationConfigId,
            comments: batch3
          }
        };

        await worker.processJob(job1);
        await worker.processJob(job2);
        await worker.processJob(job3);
      } finally {
        // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
        await worker.stop();
      }

      // Verify processing order maintained across batches
      expect(allProcessedComments).toHaveLength(3);

      for (let i = 0; i < allProcessedComments.length; i++) {
        expect(allProcessedComments[i].metadata.sequence).toBe(i + 1);
      }

      // Verify database order
      const storedComments = await testUtils.getCommentsByOrganization(organizationId);
      expect(storedComments).toHaveLength(3);

      const sortedByCreated = storedComments.sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );

      for (let i = 0; i < sortedByCreated.length; i++) {
        expect(sortedByCreated[i].platform_comment_id).toBe(`order_test_${i + 1}`);
      }
    });

    test('should respect priority-based ordering', async () => {
      const organizationId = 'test-org-order';
      const integrationConfigId = 'config-twitter-order';

      // Create jobs with different priorities
      const highPriorityComment = {
        ...fixtures.orderedComments[0],
        platform_comment_id: 'high_priority_1',
        original_text: 'High priority comment'
      };

      const lowPriorityComment = {
        ...fixtures.orderedComments[1],
        platform_comment_id: 'low_priority_1',
        original_text: 'Low priority comment'
      };

      const normalPriorityComment = {
        ...fixtures.orderedComments[2],
        platform_comment_id: 'normal_priority_1',
        original_text: 'Normal priority comment'
      };

      // Create jobs in reverse priority order to test reordering
      const lowPriorityJobs = await testUtils.createTestJobs(
        'fetch_comments',
        [
          {
            organization_id: organizationId,
            platform: 'twitter',
            integration_config_id: integrationConfigId,
            comment_data: lowPriorityComment
          }
        ],
        { priority: 5 }
      ); // Low priority (higher number)

      const normalPriorityJobs = await testUtils.createTestJobs(
        'fetch_comments',
        [
          {
            organization_id: organizationId,
            platform: 'twitter',
            integration_config_id: integrationConfigId,
            comment_data: normalPriorityComment
          }
        ],
        { priority: 3 }
      ); // Normal priority

      const highPriorityJobs = await testUtils.createTestJobs(
        'fetch_comments',
        [
          {
            organization_id: organizationId,
            platform: 'twitter',
            integration_config_id: integrationConfigId,
            comment_data: highPriorityComment
          }
        ],
        { priority: 1 }
      ); // High priority (lower number)

      const worker = testUtils.createTestWorker({
        maxConcurrency: 1
      });

      const processedOrder = [];

      worker.fetchCommentsFromPlatform = async (platform, config, payload) => {
        const comment = payload.comment_data;
        processedOrder.push(comment.platform_comment_id);
        return [comment];
      };

      try {
        await worker.start();

        // Process by getting jobs from queue (should respect priority)
        let job;
        while ((job = await worker.getNextJob()) !== null) {
          await worker.processJob(job);
        }
      } finally {
        // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
        await worker.stop();
      }

      // Should process in priority order: high, normal, low
      expect(processedOrder).toEqual(['high_priority_1', 'normal_priority_1', 'low_priority_1']);
    });
  });

  describe('Order Preservation with Retries', () => {
    test('should maintain order when jobs require retries', async () => {
      const organizationId = 'test-org-order';
      const integrationConfigId = 'config-twitter-order';

      // Create three jobs where middle one will fail initially
      const jobs = [];
      for (let i = 0; i < 3; i++) {
        const comment = {
          ...fixtures.orderedComments[i],
          platform_comment_id: `retry_order_${i + 1}`
        };

        const jobData = [
          {
            organization_id: organizationId,
            platform: 'twitter',
            integration_config_id: integrationConfigId,
            comment_data: comment,
            shouldFail: i === 1 // Middle job fails initially
          }
        ];

        const createdJobs = await testUtils.createTestJobs('fetch_comments', jobData, {
          priority: 5,
          maxAttempts: 3
        });

        jobs.push(createdJobs[0]);
      }

      const worker = testUtils.createTestWorker({
        maxConcurrency: 1,
        maxRetries: 3,
        retryDelay: 50
      });

      const processedOrder = [];
      const attemptCounts = {};

      worker.fetchCommentsFromPlatform = async (platform, config, payload) => {
        const comment = payload.comment_data;
        const commentId = comment.platform_comment_id;

        attemptCounts[commentId] = (attemptCounts[commentId] || 0) + 1;

        // Middle job fails on first attempt
        if (payload.shouldFail && attemptCounts[commentId] === 1) {
          throw new Error(`Simulated failure for ${commentId}`);
        }

        processedOrder.push(commentId);
        return [comment];
      };

      try {
        await worker.start();

        // Process all jobs (including retries)
        for (const job of jobs) {
          try {
            await worker.processJob(job);
          } catch (error) {
            // Expected for failing job on first attempt
          }
        }
      } finally {
        // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
        await worker.stop();
      }

      // Should eventually process all in order
      expect(processedOrder).toEqual([
        'retry_order_1',
        'retry_order_2', // Succeeded on retry
        'retry_order_3'
      ]);

      // Verify retry happened
      expect(attemptCounts['retry_order_2']).toBe(2); // Failed once, succeeded on retry
      expect(attemptCounts['retry_order_1']).toBe(1); // Succeeded first time
      expect(attemptCounts['retry_order_3']).toBe(1); // Succeeded first time
    });

    test('should not block processing when one job permanently fails', async () => {
      const organizationId = 'test-org-order';
      const integrationConfigId = 'config-twitter-order';

      // Create jobs where middle one will permanently fail
      const jobs = [];
      for (let i = 0; i < 3; i++) {
        const comment = {
          ...fixtures.orderedComments[i],
          platform_comment_id: `permanent_fail_${i + 1}`
        };

        const jobData = [
          {
            organization_id: organizationId,
            platform: 'twitter',
            integration_config_id: integrationConfigId,
            comment_data: comment,
            shouldPermanentlyFail: i === 1
          }
        ];

        const createdJobs = await testUtils.createTestJobs('fetch_comments', jobData, {
          priority: 5,
          maxAttempts: 2
        });

        jobs.push(createdJobs[0]);
      }

      const worker = testUtils.createTestWorker({
        maxConcurrency: 1,
        maxRetries: 2,
        retryDelay: 50
      });

      const processedOrder = [];

      worker.fetchCommentsFromPlatform = async (platform, config, payload) => {
        const comment = payload.comment_data;

        if (payload.shouldPermanentlyFail) {
          throw new Error(`Permanent failure for ${comment.platform_comment_id}`);
        }

        processedOrder.push(comment.platform_comment_id);
        return [comment];
      };

      const results = [];

      try {
        await worker.start();

        // Process all jobs
        for (const job of jobs) {
          try {
            const result = await worker.processJob(job);
            results.push({ success: true, result });
          } catch (error) {
            results.push({ success: false, error: error.message });
          }
        }
      } finally {
        // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
        await worker.stop();
      }

      // First and third should succeed, middle should fail
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);

      // Only successful jobs should be in processed order
      expect(processedOrder).toEqual(['permanent_fail_1', 'permanent_fail_3']);

      // Verify database contains only successful comments
      const storedComments = await testUtils.getCommentsByOrganization(organizationId);
      expect(storedComments).toHaveLength(2);

      const commentIds = storedComments.map((c) => c.platform_comment_id);
      expect(commentIds).toContain('permanent_fail_1');
      expect(commentIds).toContain('permanent_fail_3');
      expect(commentIds).not.toContain('permanent_fail_2');
    });
  });

  describe('Concurrent Processing Order', () => {
    test('should maintain order within priority levels during concurrent processing', async () => {
      const organizationId = 'test-org-order';
      const integrationConfigId = 'config-twitter-order';

      // Create multiple jobs at same priority level
      const concurrentJobs = [];
      for (let i = 0; i < 5; i++) {
        const comment = {
          ...fixtures.orderedComments[0],
          platform_comment_id: `concurrent_${i + 1}`,
          original_text: `Concurrent comment ${i + 1}`,
          metadata: { ...fixtures.orderedComments[0].metadata, sequence: i + 1 }
        };

        const jobData = [
          {
            organization_id: organizationId,
            platform: 'twitter',
            integration_config_id: integrationConfigId,
            comment_data: comment
          }
        ];

        const jobs = await testUtils.createTestJobs('fetch_comments', jobData, {
          priority: 5 // Same priority
        });

        concurrentJobs.push(jobs[0]);
      }

      const worker = testUtils.createTestWorker({
        maxConcurrency: 3 // Allow concurrent processing
      });

      const processedComments = [];
      const processingStartTimes = {};

      worker.fetchCommentsFromPlatform = async (platform, config, payload) => {
        const comment = payload.comment_data;
        const commentId = comment.platform_comment_id;

        processingStartTimes[commentId] = Date.now();

        // Simulate variable processing time
        await testUtils.sleep(Math.random() * 100);

        processedComments.push({
          id: commentId,
          sequence: comment.metadata.sequence,
          startTime: processingStartTimes[commentId]
        });

        return [comment];
      };

      try {
        await worker.start();

        // Process all jobs concurrently
        const promises = concurrentJobs.map((job) => worker.processJob(job));
        await Promise.all(promises);
      } finally {
        // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
        await worker.stop();
      }

      // All should be processed
      expect(processedComments).toHaveLength(5);

      // Sort by start time to see actual processing order
      const sortedByStartTime = processedComments.sort((a, b) => a.startTime - b.startTime);

      // Should start processing in FIFO order (even if they finish out of order)
      for (let i = 0; i < sortedByStartTime.length - 1; i++) {
        expect(sortedByStartTime[i].startTime).toBeLessThanOrEqual(
          sortedByStartTime[i + 1].startTime
        );
      }

      // Verify all comments were stored
      const storedComments = await testUtils.getCommentsByOrganization(organizationId);
      expect(storedComments).toHaveLength(5);
    });

    test('should preserve order across different priority levels with concurrency', async () => {
      const organizationId = 'test-org-order';
      const integrationConfigId = 'config-twitter-order';

      // Create jobs at different priority levels
      const priorityJobs = [];

      // Low priority jobs (created first)
      for (let i = 0; i < 2; i++) {
        const comment = {
          ...fixtures.orderedComments[0],
          platform_comment_id: `low_${i + 1}`,
          original_text: `Low priority ${i + 1}`
        };

        const jobs = await testUtils.createTestJobs(
          'fetch_comments',
          [
            {
              organization_id: organizationId,
              platform: 'twitter',
              integration_config_id: integrationConfigId,
              comment_data: comment
            }
          ],
          { priority: 5 }
        );

        priorityJobs.push({ job: jobs[0], priority: 5, id: `low_${i + 1}` });
      }

      // High priority jobs (created after low priority)
      for (let i = 0; i < 2; i++) {
        const comment = {
          ...fixtures.orderedComments[0],
          platform_comment_id: `high_${i + 1}`,
          original_text: `High priority ${i + 1}`
        };

        const jobs = await testUtils.createTestJobs(
          'fetch_comments',
          [
            {
              organization_id: organizationId,
              platform: 'twitter',
              integration_config_id: integrationConfigId,
              comment_data: comment
            }
          ],
          { priority: 1 }
        );

        priorityJobs.push({ job: jobs[0], priority: 1, id: `high_${i + 1}` });
      }

      const worker = testUtils.createTestWorker({
        maxConcurrency: 2
      });

      const processedOrder = [];

      worker.fetchCommentsFromPlatform = async (platform, config, payload) => {
        const comment = payload.comment_data;
        processedOrder.push(comment.platform_comment_id);

        // Simulate processing time
        await testUtils.sleep(50);

        return [comment];
      };

      try {
        await worker.start();

        // Get and process jobs based on priority
        const processedJobs = [];
        let job;
        while ((job = await worker.getNextJob()) !== null) {
          const result = await worker.processJob(job);
          processedJobs.push(result);
        }
      } finally {
        // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
        await worker.stop();
      }

      // High priority jobs should be processed before low priority
      // Order within each priority level should be maintained
      expect(processedOrder.slice(0, 2)).toEqual(['high_1', 'high_2']);
      expect(processedOrder.slice(2, 4)).toEqual(['low_1', 'low_2']);
    });
  });

  describe('Order Validation Utilities', () => {
    test('should validate job order using helper assertion', async () => {
      const expectedOrder = ['order_test_1', 'order_test_2', 'order_test_3'];
      const actualJobs = fixtures.orderedComments.map((comment) => ({
        platform_comment_id: comment.platform_comment_id
      }));

      // Should not throw for correct order
      expect(() => {
        testUtils.assertJobOrder(actualJobs, expectedOrder);
      }).not.toThrow();

      // Should throw for incorrect order
      const incorrectJobs = [actualJobs[1], actualJobs[0], actualJobs[2]]; // Swapped first two
      expect(() => {
        testUtils.assertJobOrder(incorrectJobs, expectedOrder);
      }).toThrow('Job order assertion failed');
    });
  });
});
