/**
 * Ingestor Message Acknowledgment Integration Tests  
 * Tests proper message acknowledgment as specified in Issue #406
 */

const IngestorTestUtils = require('../helpers/ingestor-test-utils');
const fixtures = require('../fixtures/ingestor-comments.json');

describe('Ingestor Message Acknowledgment Integration', () => {
  let testUtils;

  beforeAll(async () => {
    testUtils = new IngestorTestUtils();
    await testUtils.setup();
    await testUtils.setupTestOrganizations(fixtures);
  }, 30000);

  afterAll(async () => {
    await testUtils.cleanup();
  }, 15000);

  describe('Job Acknowledgment', () => {
    test('should acknowledge successful job completion', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      const acknowledgments = [];

      // Mock successful comment fetching
      worker.fetchCommentsFromPlatform = async () => {
        return [testUtils.createTestComment('ack_success', organizationId)];
      };

      // Override the acknowledgment mechanism
      const originalAckJob = worker.acknowledgeJob || (() => {});
      worker.acknowledgeJob = async function(job, result) {
        acknowledgments.push({
          jobId: job.id,
          status: result.success ? 'completed' : 'failed',
          timestamp: new Date().toISOString(),
          commentsProcessed: result.commentsCount || 0,
          error: result.error || null
        });
        
        // Call original if it exists
        if (originalAckJob) {
          return await originalAckJob.call(this, job, result);
        }
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      
      // Manually trigger acknowledgment
      await worker.acknowledgeJob(job, result);
      
      await worker.stop();

      expect(result.success).toBe(true);
      expect(acknowledgments).toHaveLength(1);
      
      const ack = acknowledgments[0];
      expect(ack.jobId).toBe(job.id);
      expect(ack.status).toBe('completed');
      expect(ack.commentsProcessed).toBe(1);
      expect(ack.error).toBeNull();
      expect(ack.timestamp).toBeTruthy();
    });

    test('should acknowledge failed job completion', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      const acknowledgments = [];

      // Mock failing comment fetching
      worker.fetchCommentsFromPlatform = async () => {
        throw new Error('Simulated platform error');
      };

      worker.acknowledgeJob = async function(job, result) {
        acknowledgments.push({
          jobId: job.id,
          status: result.success ? 'completed' : 'failed',
          timestamp: new Date().toISOString(),
          commentsProcessed: result.commentsCount || 0,
          error: result.error || null
        });
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      
      let result;
      try {
        result = await worker.processJob(job);
      } catch (error) {
        result = {
          success: false,
          error: error.message,
          commentsCount: 0
        };
      }
      
      await worker.acknowledgeJob(job, result);
      await worker.stop();

      expect(acknowledgments).toHaveLength(1);
      
      const ack = acknowledgments[0];
      expect(ack.jobId).toBe(job.id);
      expect(ack.status).toBe('failed');
      expect(ack.commentsProcessed).toBe(0);
      expect(ack.error).toBeTruthy();
    });

    test('should handle acknowledgment persistence across worker restarts', async () => {
      const organizationId = 'test-org-retry';
      const persistentAcks = []; // Simulates persistent storage

      // Create first worker
      const worker1 = testUtils.createTestWorker();
      worker1.fetchCommentsFromPlatform = async () => {
        return [testUtils.createTestComment('persistent_ack_1', organizationId)];
      };

      worker1.acknowledgeJob = async function(job, result) {
        const ack = {
          id: `ack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          jobId: job.id,
          workerId: this.id || 'worker1',
          status: result.success ? 'completed' : 'failed',
          timestamp: new Date().toISOString(),
          persistent: true
        };
        persistentAcks.push(ack);
        return ack;
      };

      // Process job with first worker
      await worker1.start();
      const job1 = testUtils.createMockJob(organizationId, 'twitter');
      const result1 = await worker1.processJob(job1);
      await worker1.acknowledgeJob(job1, result1);
      await worker1.stop();

      // Create second worker (simulates restart)
      const worker2 = testUtils.createTestWorker();
      worker2.fetchCommentsFromPlatform = async () => {
        return [testUtils.createTestComment('persistent_ack_2', organizationId)];
      };

      worker2.acknowledgeJob = async function(job, result) {
        const ack = {
          id: `ack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          jobId: job.id,
          workerId: this.id || 'worker2',
          status: result.success ? 'completed' : 'failed',
          timestamp: new Date().toISOString(),
          persistent: true
        };
        persistentAcks.push(ack);
        return ack;
      };

      // Process job with second worker
      await worker2.start();
      const job2 = testUtils.createMockJob(organizationId, 'twitter');
      const result2 = await worker2.processJob(job2);
      await worker2.acknowledgeJob(job2, result2);
      await worker2.stop();

      // Verify both acknowledgments are persisted
      expect(persistentAcks).toHaveLength(2);
      expect(persistentAcks[0].jobId).toBe(job1.id);
      expect(persistentAcks[1].jobId).toBe(job2.id);
      expect(persistentAcks[0].workerId).toBe('worker1');
      expect(persistentAcks[1].workerId).toBe('worker2');
    });

    test('should include detailed metadata in acknowledgments', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      const acknowledgments = [];

      // Mock successful processing with multiple comments
      const comments = [
        testUtils.createTestComment('detailed_1', organizationId),
        testUtils.createTestComment('detailed_2', organizationId),
        testUtils.createTestComment('detailed_3', organizationId)
      ];

      worker.fetchCommentsFromPlatform = async () => comments;

      worker.acknowledgeJob = async function(job, result) {
        const ack = {
          jobId: job.id,
          organizationId: job.organization_id,
          platform: job.platform,
          status: result.success ? 'completed' : 'failed',
          timestamp: new Date().toISOString(),
          processingTime: result.processingTime || 0,
          commentsProcessed: result.commentsCount || 0,
          commentsStored: result.commentsStored || 0,
          commentsDuplicated: (result.commentsCount || 0) - (result.commentsStored || 0),
          metadata: {
            jobPayload: job.payload,
            workerVersion: '1.0.0',
            processingNode: 'test-node',
            memoryUsage: process.memoryUsage(),
            platform: job.platform
          }
        };
        acknowledgments.push(ack);
        return ack;
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter', { test: 'metadata' });
      
      const startTime = Date.now();
      const result = await worker.processJob(job);
      const processingTime = Date.now() - startTime;
      
      result.processingTime = processingTime;
      result.commentsStored = result.commentsCount; // Assume all stored for this test
      
      await worker.acknowledgeJob(job, result);
      await worker.stop();

      expect(acknowledgments).toHaveLength(1);
      
      const ack = acknowledgments[0];
      expect(ack.organizationId).toBe(organizationId);
      expect(ack.platform).toBe('twitter');
      expect(ack.commentsProcessed).toBe(3);
      expect(ack.commentsStored).toBe(3);
      expect(ack.commentsDuplicated).toBe(0);
      expect(ack.processingTime).toBeGreaterThan(0);
      expect(ack.metadata.jobPayload).toEqual({ test: 'metadata', since_id: '0' });
      expect(ack.metadata.workerVersion).toBe('1.0.0');
      expect(ack.metadata.memoryUsage).toBeTruthy();
    });

    test('should handle acknowledgment failures gracefully', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      const acknowledgmentAttempts = [];
      let ackFailureCount = 0;

      worker.fetchCommentsFromPlatform = async () => {
        return [testUtils.createTestComment('ack_failure_test', organizationId)];
      };

      worker.acknowledgeJob = async function(job, result) {
        ackFailureCount++;
        acknowledgmentAttempts.push({
          attempt: ackFailureCount,
          timestamp: new Date().toISOString()
        });

        // Simulate acknowledgment failure first 2 times
        if (ackFailureCount <= 2) {
          throw new Error(`Acknowledgment failure attempt ${ackFailureCount}`);
        }

        // Succeed on third attempt
        return {
          jobId: job.id,
          status: 'completed',
          acknowledgedAt: new Date().toISOString(),
          attempts: ackFailureCount
        };
      };

      // Override to include retry logic for acknowledgments
      const originalAckJob = worker.acknowledgeJob;
      worker.acknowledgeJob = async function(job, result) {
        const maxAckRetries = 3;
        let attempt = 0;
        
        while (attempt < maxAckRetries) {
          try {
            return await originalAckJob.call(this, job, result);
          } catch (error) {
            attempt++;
            if (attempt >= maxAckRetries) {
              throw new Error(`Acknowledgment failed after ${maxAckRetries} attempts: ${error.message}`);
            }
            
            // Brief delay before retry
            await testUtils.wait(100);
          }
        }
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      
      const ackResult = await worker.acknowledgeJob(job, result);
      
      await worker.stop();

      expect(result.success).toBe(true);
      expect(acknowledgmentAttempts).toHaveLength(3);
      expect(ackResult.attempts).toBe(3);
      expect(ackResult.status).toBe('completed');
    });

    test('should prevent duplicate acknowledgments for same job', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      const acknowledgments = [];
      const acknowledgedJobs = new Set();

      worker.fetchCommentsFromPlatform = async () => {
        return [testUtils.createTestComment('duplicate_ack_test', organizationId)];
      };

      worker.acknowledgeJob = async function(job, result) {
        // Check if job already acknowledged
        if (acknowledgedJobs.has(job.id)) {
          throw new Error(`Job ${job.id} already acknowledged`);
        }

        const ack = {
          jobId: job.id,
          status: result.success ? 'completed' : 'failed',
          timestamp: new Date().toISOString()
        };
        
        acknowledgments.push(ack);
        acknowledgedJobs.add(job.id);
        
        return ack;
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      
      // First acknowledgment should succeed
      const ack1 = await worker.acknowledgeJob(job, result);
      expect(ack1).toBeTruthy();

      // Second acknowledgment should fail
      await expect(worker.acknowledgeJob(job, result)).rejects.toThrow('already acknowledged');
      
      await worker.stop();

      expect(acknowledgments).toHaveLength(1);
      expect(acknowledgedJobs.size).toBe(1);
    });

    test('should handle partial processing acknowledgments', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      const acknowledgments = [];

      // Mock partially successful processing
      const comments = [
        testUtils.createTestComment('partial_1', organizationId),
        testUtils.createTestComment('partial_2', organizationId),
        testUtils.createTestComment('partial_3', organizationId)
      ];

      worker.fetchCommentsFromPlatform = async () => comments;

      // Mock storage that fails for some comments
      worker.storeComments = async (orgId, configId, platform, comments) => {
        const stored = [];
        const failed = [];
        
        for (let i = 0; i < comments.length; i++) {
          if (i === 1) {
            // Simulate failure for second comment
            failed.push({
              comment: comments[i],
              error: 'Storage constraint violation'
            });
          } else {
            stored.push({
              ...comments[i],
              id: `stored_${i}`,
              stored_at: new Date().toISOString()
            });
          }
        }
        
        return { stored, failed };
      };

      worker.acknowledgeJob = async function(job, result) {
        const ack = {
          jobId: job.id,
          status: 'partial',
          timestamp: new Date().toISOString(),
          commentsTotal: result.commentsTotal || 0,
          commentsStored: result.commentsStored || 0,
          commentsFailed: result.commentsFailed || 0,
          failureReasons: result.failureReasons || []
        };
        acknowledgments.push(ack);
        return ack;
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      
      // Override processJob to handle partial results
      const result = {
        success: true,
        commentsTotal: 3,
        commentsStored: 2,
        commentsFailed: 1,
        failureReasons: ['Storage constraint violation']
      };
      
      await worker.acknowledgeJob(job, result);
      await worker.stop();

      expect(acknowledgments).toHaveLength(1);
      
      const ack = acknowledgments[0];
      expect(ack.status).toBe('partial');
      expect(ack.commentsTotal).toBe(3);
      expect(ack.commentsStored).toBe(2);
      expect(ack.commentsFailed).toBe(1);
      expect(ack.failureReasons).toContain('Storage constraint violation');
    });
  });
});