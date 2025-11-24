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

    try {
      await worker.start();

      // Process the job
      const job = {
        payload: {
          organization_id: organizationId,
          platform: 'twitter',
          integration_config_id: integrationConfigId,
          since_id: '0'
        }
      };

      const result = await worker.processJob(job);

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.commentsCount).toBe(1);

      // Verify deduplication by processing same job again (without restarting worker)
      const result2 = await worker.processJob(job);

      // Should not add duplicate
      expect(result2.success).toBe(true);
      expect(result2.commentsCount).toBe(0); // No new comments added
    } catch (error) {
      console.error('Test error:', error);
      console.error('Stack:', error.stack);
      throw error;
    } finally {
      // CODERABBIT FIX: Ensure worker cleanup in try/finally to prevent Jest handle leaks
      await worker.stop();
    }
  });
});
