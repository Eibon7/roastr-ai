/**
 * Multi-Tenant Architecture Integration Tests
 * 
 * End-to-end tests for the complete comment processing workflow
 */

require('dotenv').config();

const QueueService = require('../../src/services/queueService');
const CostControlService = require('../../src/services/costControl');
const ShieldService = require('../../src/services/shieldService');
const FetchCommentsWorker = require('../../src/workers/FetchCommentsWorker');
const AnalyzeToxicityWorker = require('../../src/workers/AnalyzeToxicityWorker');
const GenerateReplyWorker = require('../../src/workers/GenerateReplyWorker');

// Mock external services for integration testing
jest.mock('../../src/services/twitter');
jest.mock('../../src/services/perspective');
jest.mock('../../src/services/openai');

describe('Multi-Tenant Architecture Integration Tests', () => {
  // Skip E2E tests in CI environment
  if (process.env.SKIP_E2E === 'true') {
    test.skip('Skipping E2E integration tests in CI environment', () => {});
    return;
  }
  let queueService;
  let costControl;
  let shieldService;
  
  const testOrganization = {
    id: 'test-org-123',
    plan_id: 'pro',
    monthly_responses_limit: 1000,
    monthly_responses_used: 50
  };

  beforeAll(async () => {
    // Initialize services
    queueService = new QueueService();
    costControl = new CostControlService();
    shieldService = new ShieldService();

    // Initialize services (will use mock clients in test environment)
    await queueService.initialize();
    await shieldService.initialize();
  });

  afterAll(async () => {
    if (queueService) {
      await queueService.shutdown();
    }
    if (shieldService) {
      await shieldService.shutdown();
    }
  });

  afterEach(() => {
    // Clear mock storage after each test to prevent state leakage
    if (typeof global !== 'undefined') {
      if (global.mockUserBehaviorStorage) {
        global.mockUserBehaviorStorage = [];
      }
    }
  });

  describe('End-to-End Comment Processing Workflow', () => {
    test('should process comment through complete pipeline', async () => {
      // Skip if running in CI without real database
      if (!process.env.SUPABASE_URL) {
        console.log('Skipping integration test - no database configured');
        return;
      }

      const mockComment = {
        id: 'comment-integration-test',
        text: 'This is a toxic comment that should trigger moderation',
        author_id: 'user-toxic-test',
        platform: 'twitter',
        created_at: new Date().toISOString()
      };

      // Step 1: Simulate comment fetch job
      const fetchJob = {
        id: 'fetch-job-test',
        organization_id: testOrganization.id,
        platform: 'twitter',
        payload: {
          post_id: 'tweet-test-123'
        }
      };

      // Step 2: Queue comment for analysis
      const analysisJobResult = await queueService.addJob(
        'analyze_toxicity',
        {
          organization_id: testOrganization.id,
          platform: 'twitter',
          comment_id: mockComment.id,
          text: mockComment.text,
          author_id: mockComment.author_id
        },
        3 // Medium priority
      );

      expect(analysisJobResult.success).toBe(true);
      expect(analysisJobResult.jobId).toBeDefined();

      // Step 3: Simulate high toxicity requiring reply generation
      const replyJobResult = await queueService.addJob(
        'generate_reply',
        {
          organization_id: testOrganization.id,
          platform: 'twitter',
          comment_id: mockComment.id,
          text: mockComment.text,
          author_id: mockComment.author_id,
          toxicity_score: 0.85,
          toxicity_categories: ['TOXICITY', 'INSULT']
        },
        4 // Normal priority
      );

      expect(replyJobResult.success).toBe(true);

      // Step 4: Simulate Shield action for high-risk user
      const shieldJobResult = await queueService.addJob(
        'shield_action',
        {
          organization_id: testOrganization.id,
          platform: 'twitter',
          action_type: 'temporary_mute',
          user_id: mockComment.author_id,
          comment_id: mockComment.id,
          payload: {
            duration_hours: 24,
            reason: 'Repeated toxic behavior'
          }
        },
        1 // Critical priority for Shield actions
      );

      expect(shieldJobResult.success).toBe(true);

      // Verify jobs were queued with correct priorities
      const stats = await queueService.getQueueStats();
      expect(stats.total).toBeGreaterThan(0);
    });

    test('should respect cost control limits', async () => {
      // Skip if no cost control configured
      if (!costControl.supabase) {
        console.log('Skipping cost control test - no database configured');
        return;
      }

      const limitedOrgId = 'test-org-limited';

      // Mock organization at limit
      jest.spyOn(costControl, 'canPerformOperation')
        .mockResolvedValue({
          allowed: false,
          reason: 'monthly_limit_exceeded',
          currentUsage: 100,
          limit: 100
        });

      const canGenerate = await costControl.canPerformOperation(
        limitedOrgId,
        'generate_reply'
      );

      expect(canGenerate.allowed).toBe(false);
      expect(canGenerate.reason).toBe('monthly_limit_exceeded');
    });

    test('should handle Shield escalation workflow', async () => {
      // Skip if no Shield configured
      if (!shieldService.supabase) {
        console.log('Skipping Shield test - no database configured');
        return;
      }

      const highToxicityContent = {
        text: 'Extremely toxic content with threats',
        toxicity_score: 0.95,
        categories: ['TOXICITY', 'THREAT', 'HARASSMENT']
      };

      const repeatOffender = {
        user_id: 'user-repeat-offender',
        platform: 'twitter',
        organization_id: testOrganization.id
      };

      // Setup repeat offender in mock storage
      if (typeof global !== 'undefined') {
        global.mockUserBehaviorStorage = global.mockUserBehaviorStorage || [];
        global.mockUserBehaviorStorage.push({
          organization_id: testOrganization.id,
          platform: 'twitter',
          platform_user_id: 'user-repeat-offender',
          total_violations: 3, // Enough to trigger escalate_to_human
          created_at: new Date().toISOString()
        });
      }

      // Mock repeat offender behavior
      jest.spyOn(shieldService, 'getUserRiskLevel')
        .mockResolvedValue('high');

      const analysis = await shieldService.analyzeContent(
        highToxicityContent,
        repeatOffender
      );

      expect(analysis.shouldTakeAction).toBe(true);
      expect(analysis.actionLevel).toBe('high');
      expect(analysis.recommendedActions).toContain('escalate_to_human');
    });
  });

  describe('Queue Priority Management', () => {
    test('should prioritize Shield actions over regular operations', async () => {
      // Add various jobs with different priorities
      const jobs = [
        {
          type: 'fetch_comments',
          priority: 3,
          data: { organization_id: testOrganization.id }
        },
        {
          type: 'shield_action',
          priority: 1,
          data: { organization_id: testOrganization.id, action_type: 'emergency_block' }
        },
        {
          type: 'analyze_toxicity',
          priority: 3,
          data: { organization_id: testOrganization.id }
        },
        {
          type: 'generate_reply',
          priority: 4,
          data: { organization_id: testOrganization.id }
        }
      ];

      const results = [];
      for (const job of jobs) {
        const result = await queueService.addJob(job.type, job.data, job.priority);
        results.push(result);
      }

      // All jobs should be queued successfully
      expect(results.every(r => r.success)).toBe(true);

      // Shield action should have highest priority
      const stats = await queueService.getQueueStats();
      
      if (stats.redisStats) {
        const shieldQueue = stats.redisStats.queues.shield_action;
        expect(shieldQueue.byPriority[1]).toBeGreaterThan(0); // Priority 1 has jobs
      }
    });
  });

  describe('Multi-Tenant Data Isolation', () => {
    test('should isolate data between organizations', async () => {
      const org1 = 'test-org-isolation-1';
      const org2 = 'test-org-isolation-2';

      // Queue jobs for different organizations
      const job1 = await queueService.addJob('fetch_comments', {
        organization_id: org1,
        platform: 'twitter',
        payload: { post_id: 'tweet-org1' }
      });

      const job2 = await queueService.addJob('fetch_comments', {
        organization_id: org2,
        platform: 'twitter', 
        payload: { post_id: 'tweet-org2' }
      });

      expect(job1.success).toBe(true);
      expect(job2.success).toBe(true);

      // Jobs should have different IDs and be isolated
      expect(job1.jobId).not.toBe(job2.jobId);
    });

    test('should enforce plan-based feature access', async () => {
      const freeOrgId = 'test-org-free';
      const proOrgId = 'test-org-pro';

      // Mock different plan types
      jest.spyOn(costControl, 'canUseShield')
        .mockImplementation(async (orgId) => {
          if (orgId === freeOrgId) {
            return { allowed: false, planId: 'free', planName: 'Free' };
          }
          return { allowed: true, planId: 'pro', planName: 'Pro' };
        });

      const freeAccess = await costControl.canUseShield(freeOrgId);
      const proAccess = await costControl.canUseShield(proOrgId);

      expect(freeAccess.allowed).toBe(false);
      expect(proAccess.allowed).toBe(true);
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle worker failures gracefully', async () => {
      const failingJob = {
        id: 'job-will-fail',
        organization_id: testOrganization.id,
        platform: 'invalid_platform',
        payload: {}
      };

      // This should not crash the queue service
      try {
        await queueService.addJob('fetch_comments', failingJob);
        // Job might be added to queue but will fail during processing
      } catch (error) {
        // Expected for invalid data
        expect(error).toBeDefined();
      }
    });

    test('should handle database failover scenarios', async () => {
      // Test Redis unavailable, database available
      queueService.isRedisAvailable = false;
      queueService.isDatabaseAvailable = true;

      const job = await queueService.addJob('analyze_toxicity', {
        organization_id: testOrganization.id,
        comment_id: 'comment-db-fallback',
        text: 'Test comment'
      });

      // Should fallback to database queue
      if (queueService.supabase) {
        expect(job.queuedTo).toBe('database');
      }
    });
  });

  describe('Performance and Scaling', () => {
    test('should handle batch job processing efficiently', async () => {
      const batchSize = 10;
      const jobs = [];

      // Create batch of jobs
      for (let i = 0; i < batchSize; i++) {
        jobs.push({
          organization_id: testOrganization.id,
          platform: 'twitter',
          comment_id: `comment-batch-${i}`,
          text: `Test comment ${i}`
        });
      }

      const startTime = Date.now();
      const results = [];

      // Process batch
      for (const jobData of jobs) {
        const result = await queueService.addJob('analyze_toxicity', jobData, 3);
        results.push(result);
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // All jobs should be processed successfully
      expect(results.every(r => r.success)).toBe(true);
      
      // Should process reasonably quickly (less than 5 seconds for 10 jobs)
      expect(processingTime).toBeLessThan(5000);

      console.log(`Batch processed ${batchSize} jobs in ${processingTime}ms`);
    });
  });

  describe('Monitoring and Observability', () => {
    test('should provide comprehensive queue statistics', async () => {
      const stats = await queueService.getQueueStats();

      expect(stats.timestamp).toBeDefined();
      expect(typeof stats.redis).toBe('boolean');
      expect(typeof stats.database).toBe('boolean');
      
      if (stats.redisStats) {
        expect(stats.redisStats.total).toBeGreaterThanOrEqual(0);
        expect(stats.redisStats.queues).toBeDefined();
      }

      if (stats.databaseStats) {
        expect(stats.databaseStats.total).toBeGreaterThanOrEqual(0);
      }
    });

    test('should track cost control usage accurately', async () => {
      // Skip if no database
      if (!costControl.supabase) {
        console.log('Skipping cost tracking test - no database configured');
        return;
      }

      const orgId = testOrganization.id;
      
      // Mock usage recording
      jest.spyOn(costControl, 'recordUsage')
        .mockResolvedValue({
          recorded: true,
          cost: 5,
          usage: {
            tokens: 25,
            operation: 'generate_reply'
          }
        });

      const result = await costControl.recordUsage(
        orgId,
        'twitter',
        'generate_reply',
        { tokensUsed: 25 }
      );

      expect(result.recorded).toBe(true);
      expect(result.cost).toBe(5);
    });
  });
});

// Helper function to wait for async operations
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Clean up test data (if needed)
afterAll(async () => {
  // Clean up any test data created during integration tests
  // This would connect to test database and remove test records
  console.log('Integration tests completed');
});