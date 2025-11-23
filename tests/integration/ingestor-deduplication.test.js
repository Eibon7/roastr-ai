const IngestorTestUtils = require('../helpers/ingestor-test-utils');
const fixtures = require('../fixtures/ingestor-comments.json');

describe('Ingestor Deduplication Integration Tests', () => {
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
    // Clean up any existing test data
    await testUtils.cleanupTestData();
    await testUtils.setupTestOrganizations(fixtures);
  });

  describe('Comment ID Deduplication', () => {
    test('should prevent duplicate comments with same platform_comment_id', async () => {
      const organizationId = 'test-org-dedup';
      const integrationConfigId = 'config-twitter-dedup';
      const duplicateComments = fixtures.duplicateComments;

      // Create worker
      const worker = testUtils.createTestWorker();

      // Mock the Twitter API to return our duplicate comments
      worker.fetchCommentsFromPlatform = async () => duplicateComments;

      let result;
      try {
        // Start worker
        await worker.start();

        // Create a fetch job
        const job = {
          payload: {
            organization_id: organizationId,
            platform: 'twitter',
            integration_config_id: integrationConfigId,
            since_id: '0'
          }
        };

        // Process the job
        result = await worker.processJob(job);
      } finally {
        // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
        await worker.stop();
      }

      // Verify only one comment was stored despite two being fetched
      expect(result.success).toBe(true);
      expect(result.commentsCount).toBe(1);

      // Verify in database
      const storedComments = await testUtils.getCommentsByOrganization(organizationId);
      expect(storedComments).toHaveLength(1);

      // Verify the comment is the correct one
      const storedComment = storedComments[0];
      expect(storedComment.platform_comment_id).toBe('1234567890');
      expect(storedComment.original_text).toBe('This is a test comment for deduplication');

      // Verify count in database
      const count = await testUtils.countCommentsByPlatformId(organizationId, '1234567890');
      expect(count).toBe(1);
    });

    test('should handle reprocessing of same comments without duplicates', async () => {
      const organizationId = 'test-org-dedup';
      const integrationConfigId = 'config-twitter-dedup';
      const comment = fixtures.duplicateComments[0];

      // First, manually insert the comment
      await testUtils.insertTestComments(organizationId, integrationConfigId, [comment]);

      // Verify it exists
      let exists = await testUtils.commentExists(organizationId, comment.platform_comment_id);
      expect(exists).toBe(true);

      // Create worker
      const worker = testUtils.createTestWorker();

      // Mock the API to return the same comment again
      worker.fetchCommentsFromPlatform = async () => [comment];

      let result;
      try {
        await worker.start();

        // Process job again
        const job = {
          payload: {
            organization_id: organizationId,
            platform: 'twitter',
            integration_config_id: integrationConfigId,
            since_id: '0'
          }
        };

        result = await worker.processJob(job);
      } finally {
        await worker.stop();
      }

      // Should report 0 new comments since it's a duplicate
      expect(result.success).toBe(true);
      expect(result.commentsCount).toBe(0);

      // Verify still only one comment in database
      const count = await testUtils.countCommentsByPlatformId(
        organizationId,
        comment.platform_comment_id
      );
      expect(count).toBe(1);

      const allComments = await testUtils.getCommentsByOrganization(organizationId);
      expect(allComments).toHaveLength(1);
    });

    test('should allow same platform_comment_id across different organizations', async () => {
      const comment = fixtures.duplicateComments[0];

      // Create two different organizations
      const org1 = 'test-org-dedup';
      const org2 = 'test-org-order'; // Reuse another test org

      const config1 = 'config-twitter-dedup';
      const config2 = 'config-twitter-order';

      // Insert same comment for both organizations
      await testUtils.insertTestComments(org1, config1, [comment]);
      await testUtils.insertTestComments(org2, config2, [comment]);

      // Verify both exist
      const comments1 = await testUtils.getCommentsByOrganization(org1);
      const comments2 = await testUtils.getCommentsByOrganization(org2);

      expect(comments1).toHaveLength(1);
      expect(comments2).toHaveLength(1);

      // Both should have the same platform_comment_id but different organization_id
      expect(comments1[0].platform_comment_id).toBe(comment.platform_comment_id);
      expect(comments2[0].platform_comment_id).toBe(comment.platform_comment_id);
      expect(comments1[0].organization_id).toBe(org1);
      expect(comments2[0].organization_id).toBe(org2);
    });

    test('should handle database constraint violations gracefully', async () => {
      const organizationId = 'test-org-dedup';
      const integrationConfigId = 'config-twitter-dedup';
      const comment = fixtures.duplicateComments[0];

      // Create worker
      const worker = testUtils.createTestWorker();

      // Mock to return comment multiple times
      worker.fetchCommentsFromPlatform = async () => [comment, comment, comment];

      await worker.start();

      const job = {
        payload: {
          organization_id: organizationId,
          platform: 'twitter',
          integration_config_id: integrationConfigId,
          since_id: '0'
        }
      };

      // Should not throw despite receiving duplicates
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(true);
      expect(result.commentsCount).toBe(1); // Only one stored despite three received

      // Verify database state
      const storedComments = await testUtils.getCommentsByOrganization(organizationId);
      expect(storedComments).toHaveLength(1);
    });

    test('should preserve deduplication across multiple fetch operations', async () => {
      const organizationId = 'test-org-dedup';
      const integrationConfigId = 'config-twitter-dedup';
      const comment = fixtures.duplicateComments[0];

      const worker = testUtils.createTestWorker();

      // First fetch
      worker.fetchCommentsFromPlatform = async () => [comment];
      await worker.start();

      const job = {
        payload: {
          organization_id: organizationId,
          platform: 'twitter',
          integration_config_id: integrationConfigId,
          since_id: '0'
        }
      };

      // Process first time
      let result = await worker.processJob(job);
      expect(result.commentsCount).toBe(1);

      // Second fetch with same comment
      result = await worker.processJob(job);
      expect(result.commentsCount).toBe(0); // Duplicate detected

      // Third fetch with same comment
      result = await worker.processJob(job);
      expect(result.commentsCount).toBe(0); // Still duplicate

      await worker.stop();

      // Final verification
      const finalCount = await testUtils.countCommentsByPlatformId(
        organizationId,
        comment.platform_comment_id
      );
      expect(finalCount).toBe(1);
    });
  });

  describe('Deduplication Performance', () => {
    test('should efficiently handle large batches with duplicates', async () => {
      const organizationId = 'test-org-dedup';
      const integrationConfigId = 'config-twitter-dedup';

      // Create batch with mixed unique and duplicate comments
      const baseComment = fixtures.duplicateComments[0];
      const largeBatch = [];

      // Add 10 unique comments
      for (let i = 0; i < 10; i++) {
        largeBatch.push({
          ...baseComment,
          platform_comment_id: `unique_${i}`,
          original_text: `Unique comment ${i}`
        });
      }

      // Add 5 duplicates of the first comment
      for (let i = 0; i < 5; i++) {
        largeBatch.push({
          ...baseComment,
          platform_comment_id: 'unique_0', // Duplicate of first
          original_text: 'Unique comment 0'
        });
      }

      const worker = testUtils.createTestWorker();
      worker.fetchCommentsFromPlatform = async () => largeBatch;

      await worker.start();

      const startTime = Date.now();

      const job = {
        payload: {
          organization_id: organizationId,
          platform: 'twitter',
          integration_config_id: integrationConfigId,
          since_id: '0'
        }
      };

      const result = await worker.processJob(job);

      const processingTime = Date.now() - startTime;

      await worker.stop();

      // Should process in reasonable time (less than 2 seconds)
      expect(processingTime).toBeLessThan(2000);

      // Should store only unique comments
      expect(result.commentsCount).toBe(10); // 10 unique despite 15 total

      const storedComments = await testUtils.getCommentsByOrganization(organizationId);
      expect(storedComments).toHaveLength(10);

      // Verify no duplicates by platform_comment_id
      const platformIds = storedComments.map((c) => c.platform_comment_id);
      const uniqueIds = [...new Set(platformIds)];
      expect(uniqueIds).toHaveLength(10);
    });
  });
});
