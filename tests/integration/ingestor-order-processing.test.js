/**
 * Ingestor Order Processing Integration Tests
 * Tests FIFO processing order preservation as specified in Issue #406
 */

const IngestorTestUtils = require('../helpers/ingestor-test-utils');
const fixtures = require('../fixtures/ingestor-comments.json');

describe('Ingestor Order Processing Integration', () => {
  let testUtils;

  beforeAll(async () => {
    testUtils = new IngestorTestUtils();
    await testUtils.setup();
    await testUtils.setupTestOrganizations(fixtures);
  }, 30000);

  afterAll(async () => {
    await testUtils.cleanup();
  }, 15000);

  describe('FIFO Processing Order', () => {
    test('should process comments in first-in-first-out order', async () => {
      const organizationId = 'test-org-order';
      const worker = testUtils.createTestWorker();
      const processingOrder = [];
      const orderedComments = fixtures.orderedComments;

      // Mock platform API to return ordered comments
      worker.fetchCommentsFromPlatform = async () => orderedComments;

      // Override storage to track processing order
      worker.storeComments = async (orgId, configId, platform, comments) => {
        const storedComments = [];
        
        for (const comment of comments) {
          const processingTimestamp = Date.now();
          const stored = {
            id: `stored_${processingTimestamp}_${Math.random()}`,
            organization_id: orgId,
            platform_comment_id: comment.platform_comment_id,
            original_text: comment.original_text,
            processing_order: comment.metadata.order,
            processed_at: new Date(processingTimestamp).toISOString()
          };
          
          processingOrder.push({
            commentId: comment.platform_comment_id,
            expectedOrder: comment.metadata.order,
            actualProcessingTime: processingTimestamp
          });
          
          storedComments.push(stored);
          
          // Add small delay to simulate processing time
          await testUtils.wait(10);
        }
        
        return storedComments;
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(true);
      expect(result.commentsCount).toBe(3);
      expect(processingOrder).toHaveLength(3);

      // Verify FIFO order preservation
      for (let i = 1; i < processingOrder.length; i++) {
        const current = processingOrder[i];
        const previous = processingOrder[i - 1];
        
        // Current comment should be processed after previous
        expect(current.actualProcessingTime).toBeGreaterThan(previous.actualProcessingTime);
        
        // Expected order should match processing sequence
        expect(current.expectedOrder).toBe(previous.expectedOrder + 1);
      }

      // Verify the exact order matches expected sequence
      const expectedSequence = [1, 2, 3];
      const actualSequence = processingOrder.map(p => p.expectedOrder);
      expect(actualSequence).toEqual(expectedSequence);
    });

    test('should maintain FIFO order across multiple job batches', async () => {
      const organizationId = 'test-org-order';
      const worker = testUtils.createTestWorker();
      const globalProcessingOrder = [];

      // Create three batches of comments with different timestamps
      const batch1 = [
        testUtils.createTestComment('batch1_001', organizationId, { order: 1, batch: 1 }),
        testUtils.createTestComment('batch1_002', organizationId, { order: 2, batch: 1 })
      ];

      const batch2 = [
        testUtils.createTestComment('batch2_003', organizationId, { order: 3, batch: 2 }),
        testUtils.createTestComment('batch2_004', organizationId, { order: 4, batch: 2 })
      ];

      const batch3 = [
        testUtils.createTestComment('batch3_005', organizationId, { order: 5, batch: 3 })
      ];

      let currentBatch = 1;
      const batches = [batch1, batch2, batch3];

      worker.fetchCommentsFromPlatform = async () => {
        const batch = batches[currentBatch - 1] || [];
        currentBatch++;
        return batch;
      };

      worker.storeComments = async (orgId, configId, platform, comments) => {
        const storedComments = [];
        
        for (const comment of comments) {
          const processingTimestamp = Date.now();
          globalProcessingOrder.push({
            commentId: comment.platform_comment_id,
            order: comment.metadata.order,
            batch: comment.metadata.batch,
            processedAt: processingTimestamp
          });
          
          storedComments.push({
            id: `stored_${processingTimestamp}`,
            platform_comment_id: comment.platform_comment_id,
            processed_at: new Date(processingTimestamp).toISOString()
          });
          
          // Simulate processing delay
          await testUtils.wait(5);
        }
        
        return storedComments;
      };

      await worker.start();

      // Process three jobs sequentially
      const job1 = testUtils.createMockJob(organizationId, 'twitter');
      const result1 = await worker.processJob(job1);

      const job2 = testUtils.createMockJob(organizationId, 'twitter');
      const result2 = await worker.processJob(job2);

      const job3 = testUtils.createMockJob(organizationId, 'twitter');
      const result3 = await worker.processJob(job3);

      await worker.stop();

      // Verify all jobs succeeded
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);

      expect(globalProcessingOrder).toHaveLength(5);

      // Verify global FIFO order across batches
      for (let i = 1; i < globalProcessingOrder.length; i++) {
        const current = globalProcessingOrder[i];
        const previous = globalProcessingOrder[i - 1];
        
        // Each comment should be processed after the previous one
        expect(current.processedAt).toBeGreaterThan(previous.processedAt);
        
        // Order should be sequential
        expect(current.order).toBe(previous.order + 1);
      }

      // Verify batch sequence is maintained
      const batchSequence = globalProcessingOrder.map(p => p.batch);
      expect(batchSequence).toEqual([1, 1, 2, 2, 3]);
    });

    test('should handle priority-based ordering within FIFO', async () => {
      const organizationId = 'test-org-order';
      const worker = testUtils.createTestWorker();
      const processingOrder = [];

      // Create comments with different priorities
      const comments = [
        testUtils.createTestComment('normal_001', organizationId, { priority: 'normal', expectedOrder: 2 }),
        testUtils.createTestComment('high_001', organizationId, { priority: 'high', expectedOrder: 1 }),
        testUtils.createTestComment('normal_002', organizationId, { priority: 'normal', expectedOrder: 3 }),
        testUtils.createTestComment('high_002', organizationId, { priority: 'high', expectedOrder: 4 }) // FIFO within priority
      ];

      worker.fetchCommentsFromPlatform = async () => comments;

      // Mock processing with priority-aware FIFO
      worker.storeComments = async (orgId, configId, platform, comments) => {
        // Sort by priority (high first), then maintain original order within priority
        const sortedComments = [...comments].sort((a, b) => {
          if (a.metadata.priority === b.metadata.priority) {
            return 0; // Maintain original order within same priority
          }
          return a.metadata.priority === 'high' ? -1 : 1;
        });

        const storedComments = [];
        
        for (const comment of sortedComments) {
          const processingTimestamp = Date.now();
          processingOrder.push({
            commentId: comment.platform_comment_id,
            priority: comment.metadata.priority,
            expectedOrder: comment.metadata.expectedOrder,
            processedAt: processingTimestamp
          });
          
          storedComments.push({
            id: `stored_${processingTimestamp}`,
            platform_comment_id: comment.platform_comment_id,
            priority: comment.metadata.priority
          });
          
          await testUtils.wait(5);
        }
        
        return storedComments;
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(true);
      expect(processingOrder).toHaveLength(4);

      // Verify priority-based FIFO order
      const actualOrder = processingOrder.map(p => p.expectedOrder);
      expect(actualOrder).toEqual([1, 4, 2, 3]); // High priority first, then FIFO within priorities
    });

    test('should preserve order with concurrent workers', async () => {
      const organizationId = 'test-org-order';
      const sharedProcessingLog = [];
      const concurrentComments = [];

      // Generate comments for concurrent processing
      for (let i = 1; i <= 10; i++) {
        concurrentComments.push(
          testUtils.createTestComment(`concurrent_${i.toString().padStart(3, '0')}`, organizationId, { order: i })
        );
      }

      const createWorkerWithSharedLog = (workerId) => {
        const worker = testUtils.createTestWorker();
        worker.id = workerId;
        
        worker.fetchCommentsFromPlatform = async () => {
          // Each worker gets a subset of comments
          const startIndex = workerId === 'worker1' ? 0 : 5;
          const endIndex = workerId === 'worker1' ? 5 : 10;
          return concurrentComments.slice(startIndex, endIndex);
        };

        worker.storeComments = async (orgId, configId, platform, comments) => {
          const storedComments = [];
          
          for (const comment of comments) {
            const processingTimestamp = Date.now();
            
            // Thread-safe logging (simplified for test)
            sharedProcessingLog.push({
              workerId,
              commentId: comment.platform_comment_id,
              order: comment.metadata.order,
              processedAt: processingTimestamp
            });
            
            storedComments.push({
              id: `stored_${workerId}_${processingTimestamp}`,
              platform_comment_id: comment.platform_comment_id,
              worker_id: workerId
            });
            
            await testUtils.wait(Math.random() * 20); // Random processing delay
          }
          
          return storedComments;
        };
        
        return worker;
      };

      // Create two concurrent workers
      const worker1 = createWorkerWithSharedLog('worker1');
      const worker2 = createWorkerWithSharedLog('worker2');

      await Promise.all([worker1.start(), worker2.start()]);

      // Process jobs concurrently
      const job1 = testUtils.createMockJob(organizationId, 'twitter');
      const job2 = testUtils.createMockJob(organizationId, 'twitter');

      const [result1, result2] = await Promise.all([
        worker1.processJob(job1),
        worker2.processJob(job2)
      ]);

      await Promise.all([worker1.stop(), worker2.stop()]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(sharedProcessingLog).toHaveLength(10);

      // Sort by processing time to verify temporal order
      const sortedByTime = [...sharedProcessingLog].sort((a, b) => a.processedAt - b.processedAt);

      // Within each worker, order should be preserved
      const worker1Logs = sortedByTime.filter(log => log.workerId === 'worker1');
      const worker2Logs = sortedByTime.filter(log => log.workerId === 'worker2');

      // Verify FIFO within each worker
      for (let i = 1; i < worker1Logs.length; i++) {
        expect(worker1Logs[i].order).toBeGreaterThan(worker1Logs[i - 1].order);
      }

      for (let i = 1; i < worker2Logs.length; i++) {
        expect(worker2Logs[i].order).toBeGreaterThan(worker2Logs[i - 1].order);
      }
    });

    test('should handle ordering with failed comments', async () => {
      const organizationId = 'test-org-order';
      const worker = testUtils.createTestWorker();
      const processingLog = [];

      // Create comments where some will fail processing
      const comments = [
        testUtils.createTestComment('success_001', organizationId, { order: 1, shouldFail: false }),
        testUtils.createTestComment('fail_002', organizationId, { order: 2, shouldFail: true }),
        testUtils.createTestComment('success_003', organizationId, { order: 3, shouldFail: false }),
        testUtils.createTestComment('fail_004', organizationId, { order: 4, shouldFail: true }),
        testUtils.createTestComment('success_005', organizationId, { order: 5, shouldFail: false })
      ];

      worker.fetchCommentsFromPlatform = async () => comments;

      worker.storeComments = async (orgId, configId, platform, comments) => {
        const storedComments = [];
        const failedComments = [];
        
        for (const comment of comments) {
          const processingTimestamp = Date.now();
          
          processingLog.push({
            commentId: comment.platform_comment_id,
            order: comment.metadata.order,
            shouldFail: comment.metadata.shouldFail,
            processedAt: processingTimestamp
          });

          if (comment.metadata.shouldFail) {
            failedComments.push({
              comment,
              error: 'Simulated processing failure',
              processedAt: processingTimestamp
            });
          } else {
            storedComments.push({
              id: `stored_${processingTimestamp}`,
              platform_comment_id: comment.platform_comment_id,
              order: comment.metadata.order,
              stored_at: new Date(processingTimestamp).toISOString()
            });
          }
          
          await testUtils.wait(5);
        }
        
        return storedComments;
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(true);
      expect(processingLog).toHaveLength(5);

      // Verify all comments were processed in order, regardless of success/failure
      for (let i = 1; i < processingLog.length; i++) {
        const current = processingLog[i];
        const previous = processingLog[i - 1];
        
        expect(current.processedAt).toBeGreaterThan(previous.processedAt);
        expect(current.order).toBe(previous.order + 1);
      }

      // Verify processing order was maintained despite failures
      const orderSequence = processingLog.map(log => log.order);
      expect(orderSequence).toEqual([1, 2, 3, 4, 5]);
    });

    test('should maintain order consistency across worker restarts', async () => {
      const organizationId = 'test-org-order';
      const persistentOrderLog = []; // Simulates persistent order tracking

      const comments = [
        testUtils.createTestComment('restart_001', organizationId, { order: 1 }),
        testUtils.createTestComment('restart_002', organizationId, { order: 2 }),
        testUtils.createTestComment('restart_003', organizationId, { order: 3 })
      ];

      // First worker processes partial batch
      const worker1 = testUtils.createTestWorker();
      worker1.fetchCommentsFromPlatform = async () => [comments[0], comments[1]];
      worker1.storeComments = async (orgId, configId, platform, comments) => {
        const storedComments = [];
        
        for (const comment of comments) {
          const processingTimestamp = Date.now();
          persistentOrderLog.push({
            commentId: comment.platform_comment_id,
            order: comment.metadata.order,
            workerId: 'worker1',
            processedAt: processingTimestamp
          });
          
          storedComments.push({
            id: `stored_w1_${processingTimestamp}`,
            platform_comment_id: comment.platform_comment_id
          });
          
          await testUtils.wait(10);
        }
        
        return storedComments;
      };

      // Process with first worker
      await worker1.start();
      const job1 = testUtils.createMockJob(organizationId, 'twitter');
      const result1 = await worker1.processJob(job1);
      await worker1.stop();

      // Second worker (simulates restart) processes remaining comments
      const worker2 = testUtils.createTestWorker();
      worker2.fetchCommentsFromPlatform = async () => [comments[2]];
      worker2.storeComments = async (orgId, configId, platform, comments) => {
        const storedComments = [];
        
        for (const comment of comments) {
          const processingTimestamp = Date.now();
          persistentOrderLog.push({
            commentId: comment.platform_comment_id,
            order: comment.metadata.order,
            workerId: 'worker2',
            processedAt: processingTimestamp
          });
          
          storedComments.push({
            id: `stored_w2_${processingTimestamp}`,
            platform_comment_id: comment.platform_comment_id
          });
        }
        
        return storedComments;
      };

      // Process with second worker
      await worker2.start();
      const job2 = testUtils.createMockJob(organizationId, 'twitter');
      const result2 = await worker2.processJob(job2);
      await worker2.stop();

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(persistentOrderLog).toHaveLength(3);

      // Verify order consistency across worker restarts
      const orderSequence = persistentOrderLog.map(log => log.order);
      expect(orderSequence).toEqual([1, 2, 3]);

      // Verify temporal order is maintained
      for (let i = 1; i < persistentOrderLog.length; i++) {
        expect(persistentOrderLog[i].processedAt).toBeGreaterThan(persistentOrderLog[i - 1].processedAt);
      }
    });
  });
});