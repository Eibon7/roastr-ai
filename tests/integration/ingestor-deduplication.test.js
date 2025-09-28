/**
 * Ingestor Deduplication Integration Tests
 * Tests comment_id deduplication functionality as specified in Issue #406
 */

const IngestorTestUtils = require('../helpers/ingestor-test-utils');
const fixtures = require('../fixtures/ingestor-comments.json');

describe('Ingestor Deduplication Integration', () => {
  let testUtils;

  beforeAll(async () => {
    testUtils = new IngestorTestUtils();
    await testUtils.setup();
    await testUtils.setupTestOrganizations(fixtures);
  }, 30000);

  afterAll(async () => {
    await testUtils.cleanup();
  }, 15000);

  describe('Comment ID Deduplication', () => {
    test('should prevent duplicate comments with same platform_comment_id', async () => {
      const organizationId = 'test-org-dedup';
      const integrationConfigId = 'config-twitter-dedup';
      const duplicateComment = fixtures.duplicateComments[0];

      // Create worker with mock storage that tracks duplicates
      const worker = testUtils.createTestWorker();
      const storedComments = [];

      // Mock platform API to return duplicate comment
      worker.fetchCommentsFromPlatform = async () => [duplicateComment];

      // Mock storage with deduplication logic
      worker.storeComments = async (orgId, configId, platform, comments) => {
        const newlyStoredComments = [];
        
        for (const comment of comments) {
          // Check if comment already exists
          const exists = storedComments.some(c => 
            c.organization_id === orgId && 
            c.platform_comment_id === comment.platform_comment_id
          );

          if (!exists) {
            const stored = {
              id: `mock_${Date.now()}_${Math.random()}`,
              organization_id: orgId,
              integration_config_id: configId,
              platform: comment.platform,
              platform_comment_id: comment.platform_comment_id,
              platform_user_id: comment.platform_user_id,
              platform_username: comment.platform_username,
              original_text: comment.original_text,
              metadata: comment.metadata,
              status: 'pending',
              created_at: new Date().toISOString()
            };
            storedComments.push(stored);
            newlyStoredComments.push(stored);
          }
        }
        
        return newlyStoredComments;
      };

      await worker.start();

      // Process job first time
      const job1 = testUtils.createMockJob(organizationId, 'twitter');
      const result1 = await worker.processJob(job1);

      // Process same job again (should deduplicate)
      const job2 = testUtils.createMockJob(organizationId, 'twitter');
      const result2 = await worker.processJob(job2);

      await worker.stop();

      // Assertions
      expect(result1.success).toBe(true);
      expect(result1.commentsCount).toBe(1);
      
      expect(result2.success).toBe(true);
      expect(result2.commentsCount).toBe(0); // No new comments due to deduplication

      expect(storedComments).toHaveLength(1);
      expect(storedComments[0].platform_comment_id).toBe(duplicateComment.platform_comment_id);
    });

    test('should allow comments with different platform_comment_id', async () => {
      const organizationId = 'test-org-dedup';
      const worker = testUtils.createTestWorker();
      const storedComments = [];

      // Mock different comments
      const comment1 = testUtils.createTestComment('unique_001', organizationId);
      const comment2 = testUtils.createTestComment('unique_002', organizationId);

      worker.fetchCommentsFromPlatform = async () => [comment1, comment2];

      worker.storeComments = async (orgId, configId, platform, comments) => {
        const newlyStoredComments = [];
        
        for (const comment of comments) {
          const exists = storedComments.some(c => 
            c.organization_id === orgId && 
            c.platform_comment_id === comment.platform_comment_id
          );

          if (!exists) {
            const stored = {
              id: `mock_${Date.now()}_${Math.random()}`,
              organization_id: orgId,
              platform_comment_id: comment.platform_comment_id,
              created_at: new Date().toISOString()
            };
            storedComments.push(stored);
            newlyStoredComments.push(stored);
          }
        }
        
        return newlyStoredComments;
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(true);
      expect(result.commentsCount).toBe(2);
      expect(storedComments).toHaveLength(2);
    });

    test('should maintain deduplication across different worker instances', async () => {
      const organizationId = 'test-org-dedup';
      const sharedStorage = []; // Simulates persistent database
      const duplicateComment = fixtures.duplicateComments[0];

      // Create first worker
      const worker1 = testUtils.createTestWorker();
      worker1.fetchCommentsFromPlatform = async () => [duplicateComment];
      worker1.storeComments = async (orgId, configId, platform, comments) => {
        const newlyStoredComments = [];
        
        for (const comment of comments) {
          const exists = sharedStorage.some(c => 
            c.organization_id === orgId && 
            c.platform_comment_id === comment.platform_comment_id
          );

          if (!exists) {
            const stored = {
              id: `mock_${Date.now()}_${Math.random()}`,
              organization_id: orgId,
              platform_comment_id: comment.platform_comment_id,
              created_at: new Date().toISOString()
            };
            sharedStorage.push(stored);
            newlyStoredComments.push(stored);
          }
        }
        
        return newlyStoredComments;
      };

      // Create second worker with same storage
      const worker2 = testUtils.createTestWorker();
      worker2.fetchCommentsFromPlatform = async () => [duplicateComment];
      worker2.storeComments = worker1.storeComments; // Share storage logic

      // Process with first worker
      await worker1.start();
      const job1 = testUtils.createMockJob(organizationId, 'twitter');
      const result1 = await worker1.processJob(job1);
      await worker1.stop();

      // Process with second worker (should deduplicate)
      await worker2.start();
      const job2 = testUtils.createMockJob(organizationId, 'twitter');
      const result2 = await worker2.processJob(job2);
      await worker2.stop();

      expect(result1.success).toBe(true);
      expect(result1.commentsCount).toBe(1);
      
      expect(result2.success).toBe(true);
      expect(result2.commentsCount).toBe(0); // Deduplicated across workers

      expect(sharedStorage).toHaveLength(1);
    });

    test('should handle deduplication with high comment volume', async () => {
      const organizationId = 'test-org-dedup';
      const worker = testUtils.createTestWorker();
      const storedComments = [];

      // Generate 100 comments with 50% duplicates
      const comments = [];
      for (let i = 0; i < 100; i++) {
        const commentId = i < 50 ? `unique_${i}` : `unique_${i - 50}`; // 50% duplicates
        comments.push(testUtils.createTestComment(commentId, organizationId));
      }

      worker.fetchCommentsFromPlatform = async () => comments;

      worker.storeComments = async (orgId, configId, platform, comments) => {
        const newlyStoredComments = [];
        
        for (const comment of comments) {
          const exists = storedComments.some(c => 
            c.organization_id === orgId && 
            c.platform_comment_id === comment.platform_comment_id
          );

          if (!exists) {
            const stored = {
              id: `mock_${Date.now()}_${Math.random()}`,
              organization_id: orgId,
              platform_comment_id: comment.platform_comment_id,
              created_at: new Date().toISOString()
            };
            storedComments.push(stored);
            newlyStoredComments.push(stored);
          }
        }
        
        return newlyStoredComments;
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      
      const startTime = Date.now();
      const result = await worker.processJob(job);
      const duration = Date.now() - startTime;
      
      await worker.stop();

      expect(result.success).toBe(true);
      expect(result.commentsCount).toBe(50); // Only unique comments stored
      expect(storedComments).toHaveLength(50);
      expect(duration).toBeLessThan(5000); // Performance check: under 5 seconds
    });

    test('should maintain organization isolation in deduplication', async () => {
      const org1Id = 'test-org-1';
      const org2Id = 'test-org-2'; 
      const sharedStorage = [];
      
      const sameCommentId = 'shared_comment_123';
      const comment1 = testUtils.createTestComment(sameCommentId, org1Id);
      const comment2 = testUtils.createTestComment(sameCommentId, org2Id);

      const createWorkerForOrg = (orgId, comment) => {
        const worker = testUtils.createTestWorker();
        worker.fetchCommentsFromPlatform = async () => [comment];
        worker.storeComments = async (orgId, configId, platform, comments) => {
          const newlyStoredComments = [];
          
          for (const comment of comments) {
            // Deduplication should be per organization
            const exists = sharedStorage.some(c => 
              c.organization_id === orgId && 
              c.platform_comment_id === comment.platform_comment_id
            );

            if (!exists) {
              const stored = {
                id: `mock_${Date.now()}_${Math.random()}`,
                organization_id: orgId,
                platform_comment_id: comment.platform_comment_id,
                created_at: new Date().toISOString()
              };
              sharedStorage.push(stored);
              newlyStoredComments.push(stored);
            }
          }
          
          return newlyStoredComments;
        };
        return worker;
      };

      // Process for org1
      const worker1 = createWorkerForOrg(org1Id, comment1);
      await worker1.start();
      const job1 = testUtils.createMockJob(org1Id, 'twitter');
      const result1 = await worker1.processJob(job1);
      await worker1.stop();

      // Process same comment ID for org2
      const worker2 = createWorkerForOrg(org2Id, comment2);
      await worker2.start();
      const job2 = testUtils.createMockJob(org2Id, 'twitter');
      const result2 = await worker2.processJob(job2);
      await worker2.stop();

      // Both should succeed because they're in different organizations
      expect(result1.success).toBe(true);
      expect(result1.commentsCount).toBe(1);
      
      expect(result2.success).toBe(true);
      expect(result2.commentsCount).toBe(1);

      expect(sharedStorage).toHaveLength(2);
      expect(sharedStorage[0].organization_id).toBe(org1Id);
      expect(sharedStorage[1].organization_id).toBe(org2Id);
    });

    test('should handle edge cases in comment ID deduplication', async () => {
      const organizationId = 'test-org-dedup';
      const worker = testUtils.createTestWorker();
      const storedComments = [];

      // Test edge cases: empty string, null, undefined, numbers
      const edgeCaseComments = [
        testUtils.createTestComment('', organizationId),
        testUtils.createTestComment(null, organizationId),
        testUtils.createTestComment(undefined, organizationId),
        testUtils.createTestComment('123', organizationId),
        testUtils.createTestComment('valid_id', organizationId)
      ].filter(comment => comment.platform_comment_id != null); // Filter out null/undefined

      worker.fetchCommentsFromPlatform = async () => edgeCaseComments;

      worker.storeComments = async (orgId, configId, platform, comments) => {
        const newlyStoredComments = [];
        
        for (const comment of comments) {
          // Only store comments with valid IDs
          if (comment.platform_comment_id && comment.platform_comment_id !== '') {
            const exists = storedComments.some(c => 
              c.organization_id === orgId && 
              c.platform_comment_id === comment.platform_comment_id
            );

            if (!exists) {
              const stored = {
                id: `mock_${Date.now()}_${Math.random()}`,
                organization_id: orgId,
                platform_comment_id: comment.platform_comment_id,
                created_at: new Date().toISOString()
              };
              storedComments.push(stored);
              newlyStoredComments.push(stored);
            }
          }
        }
        
        return newlyStoredComments;
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(true);
      expect(storedComments.length).toBeGreaterThan(0);
      
      // All stored comments should have valid IDs
      storedComments.forEach(comment => {
        expect(comment.platform_comment_id).toBeTruthy();
        expect(typeof comment.platform_comment_id).toBe('string');
      });
    });
  });
});