const IngestorTestUtils = require('../helpers/ingestor-test-utils');
const fixtures = require('../fixtures/ingestor-comments.json');

describe('Ingestor Mock Mode Test', () => {
  let testUtils;

  beforeAll(async () => {
    testUtils = new IngestorTestUtils();
    await testUtils.setup();
    await testUtils.setupTestOrganizations(fixtures);
  }, 30000);

  afterAll(async () => {
    await testUtils.cleanup();
  }, 15000);

  test('should work in mock mode', async () => {
    const organizationId = 'test-org-dedup';
    const integrationConfigId = 'config-twitter-dedup';
    const comment = fixtures.duplicateComments[0];

    // Create worker
    const worker = testUtils.createTestWorker();

    // Mock the platform API to return the comment
    worker.fetchCommentsFromPlatform = async () => [comment];

    // Mock the storeComments method to simulate deduplication
    const storedComments = [];
    worker.storeComments = async (orgId, configId, platform, comments) => {
      for (const comment of comments) {
        // Check if comment already exists in our mock storage
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
        }
      }
      return storedComments.filter(c => c.organization_id === orgId);
    };

    try {
      await worker.start();

      // Process the job
      const job = {
        organization_id: organizationId,
        platform: 'twitter',
        integration_config_id: integrationConfigId,
        payload: { since_id: '0' }
      };

      const result = await worker.processJob(job);

      await worker.stop();

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.commentsCount).toBe(1);

      // Verify deduplication by processing same job again
      await worker.start();
      const result2 = await worker.processJob(job);
      await worker.stop();

      // Should not add duplicate
      expect(result2.success).toBe(true);
      expect(result2.commentsCount).toBe(0); // No new comments added
    } catch (error) {
      console.error('Test error:', error);
      console.error('Stack:', error.stack);
      throw error;
    }
  });
});