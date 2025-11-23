const FetchCommentsWorker = require('./src/workers/FetchCommentsWorker');
const fixtures = require('./tests/fixtures/ingestor-comments.json');

async function testDeduplication() {
  try {
    // Clear storage
    global.mockCommentStorage = [];

    console.log('=== Testing Worker Deduplication ===');

    const worker = new FetchCommentsWorker({
      maxRetries: 3,
      retryDelay: 100,
      pollInterval: 50
    });

    const comment = fixtures.duplicateComments[0];
    console.log('Test comment:', comment.platform_comment_id);

    // Mock the platform API to return the comment
    worker.fetchCommentsFromPlatform = async () => {
      console.log(
        'fetchCommentsFromPlatform called, returning comment:',
        comment.platform_comment_id
      );
      return [comment];
    };

    await worker.start();

    const job = {
      payload: {
        organization_id: 'test-org-dedup',
        platform: 'twitter',
        integration_config_id: 'config-twitter-dedup',
        since_id: '0'
      }
    };

    console.log('\n--- First Job Execution ---');
    const result1 = await worker.processJob(job);
    console.log('First result:', {
      success: result1.success,
      commentsCount: result1.commentsCount,
      summary: result1.summary
    });
    console.log('Storage after first job:', global.mockCommentStorage.length);

    console.log('\n--- Second Job Execution ---');
    const result2 = await worker.processJob(job);
    console.log('Second result:', {
      success: result2.success,
      commentsCount: result2.commentsCount,
      summary: result2.summary
    });
    console.log('Storage after second job:', global.mockCommentStorage.length);

    await worker.stop();

    console.log('\n--- Final Analysis ---');
    console.log('Expected: First job = 1 comment, Second job = 0 comments');
    console.log(
      'Actual: First job =',
      result1.commentsCount,
      'comments, Second job =',
      result2.commentsCount,
      'comments'
    );
    console.log('Test passed:', result1.commentsCount === 1 && result2.commentsCount === 0);
  } catch (error) {
    console.error('Error in test:', error.message);
    console.error('Stack:', error.stack);
  }
}

testDeduplication();
