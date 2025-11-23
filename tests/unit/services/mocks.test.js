/**
 * Test the shared mock utilities
 */

const {
  generateId,
  createMockComment,
  createMockToxicComment,
  createMockCleanComment,
  createMockTwitterComment,
  createMockYouTubeComment,
  createMockFetchCommentsJob,
  createMockAnalyzeToxicityJob,
  createMockGenerateReplyJob,
  createMockShieldActionJob,
  createMockAnalysis,
  createMockPerspectiveAnalysis,
  createMockOpenAIAnalysis,
  createMockOrgSettings,
  createMockUser,
  createMockFetchCommentsResponse,
  createMockRoastGeneration,
  createMockShieldAnalysis,
  createMockShieldExecution,
  createMockError,
  createMockAPIError,
  createMockSupabaseResponse,
  createMockSupabaseSelect,
  createMockCostCheck,
  createMockQueueResponse
} = require('../../utils/mocks');

describe('Mock Utilities', () => {
  describe('generateId', () => {
    test('should generate unique IDs with prefix', () => {
      const id1 = generateId('test');
      const id2 = generateId('test');

      expect(id1).toMatch(/^test-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^test-\d+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    test('should use default prefix', () => {
      const id = generateId();
      expect(id).toMatch(/^test-\d+-[a-z0-9]+$/);
    });
  });

  describe('Comment Generators', () => {
    test('createMockComment should create basic comment structure', () => {
      const comment = createMockComment();

      expect(comment).toHaveProperty('id');
      expect(comment).toHaveProperty('text', 'Test comment content');
      expect(comment).toHaveProperty('author_id', 'user-123');
      expect(comment).toHaveProperty('created_at');
      expect(comment).toHaveProperty('metrics');
      expect(comment).toHaveProperty('platform', 'twitter');
      expect(comment).toHaveProperty('language', 'en');
    });

    test('createMockComment should accept overrides', () => {
      const comment = createMockComment({
        text: 'Custom text',
        platform: 'youtube',
        metrics: { likes: 100 }
      });

      expect(comment.text).toBe('Custom text');
      expect(comment.platform).toBe('youtube');
      expect(comment.metrics.likes).toBe(100);
    });

    test('createMockToxicComment should have toxicity data', () => {
      const comment = createMockToxicComment();

      expect(comment.toxicity_score).toBe(0.85);
      expect(comment.toxicity_categories).toEqual(['TOXICITY', 'INSULT']);
      expect(comment.text).toBe('You are such an idiot');
    });

    test('createMockCleanComment should have low toxicity', () => {
      const comment = createMockCleanComment();

      expect(comment.toxicity_score).toBe(0.12);
      expect(comment.toxicity_categories).toEqual([]);
      expect(comment.text).toBe('This is a nice and respectful comment');
    });
  });

  describe('Platform-Specific Generators', () => {
    test('createMockTwitterComment should have Twitter structure', () => {
      const comment = createMockTwitterComment();

      expect(comment.platform).toBe('twitter');
      expect(comment.id).toMatch(/^tweet-/);
      expect(comment).toHaveProperty('public_metrics');
      expect(comment.public_metrics).toHaveProperty('like_count');
    });

    test('createMockYouTubeComment should have YouTube structure', () => {
      const comment = createMockYouTubeComment();

      expect(comment.platform).toBe('youtube');
      expect(comment.id).toMatch(/^yt_comment-/);
      expect(comment).toHaveProperty('snippet');
      expect(comment.snippet).toHaveProperty('textDisplay');
    });
  });

  describe('Job Generators', () => {
    test('createMockFetchCommentsJob should create fetch job', () => {
      const job = createMockFetchCommentsJob();

      expect(job.job_type).toBe('fetch_comments');
      expect(job).toHaveProperty('payload');
      expect(job).toHaveProperty('organization_id', 'org-123');
    });

    test('createMockAnalyzeToxicityJob should create analysis job', () => {
      const job = createMockAnalyzeToxicityJob();

      expect(job.job_type).toBe('analyze_toxicity');
      expect(job).toHaveProperty('comment_id');
      expect(job).toHaveProperty('text');
    });
  });

  describe('Analysis Generators', () => {
    test('createMockPerspectiveAnalysis should have Perspective structure', () => {
      const analysis = createMockPerspectiveAnalysis();

      expect(analysis.success).toBe(true);
      expect(analysis).toHaveProperty('scores');
      expect(analysis.scores).toHaveProperty('TOXICITY');
      expect(analysis).toHaveProperty('categories');
    });

    test('createMockOpenAIAnalysis should have OpenAI structure', () => {
      const analysis = createMockOpenAIAnalysis();

      expect(analysis.success).toBe(true);
      expect(analysis.flagged).toBe(true);
      expect(analysis).toHaveProperty('categories');
      expect(analysis).toHaveProperty('category_scores');
    });
  });

  describe('Organization and User Generators', () => {
    test('createMockOrgSettings should create organization settings', () => {
      const settings = createMockOrgSettings();

      expect(settings.id).toBe('org-123');
      expect(settings).toHaveProperty('roast_tone', 'sarcastic');
      expect(settings).toHaveProperty('language', 'es');
      expect(settings).toHaveProperty('auto_post', false);
    });

    test('createMockUser should create user data', () => {
      const user = createMockUser();

      expect(user.id).toMatch(/^user-/);
      expect(user).toHaveProperty('username', 'testuser');
      expect(user).toHaveProperty('platform', 'twitter');
      expect(user).toHaveProperty('organization_id', 'org-123');
    });
  });

  describe('Response Generators', () => {
    test('createMockFetchCommentsResponse should create fetch response', () => {
      const comments = [createMockComment(), createMockComment()];
      const response = createMockFetchCommentsResponse(comments);

      expect(response.comments).toEqual(comments);
      expect(response.total).toBe(2);
      expect(response).toHaveProperty('hasMore', false);
    });

    test('createMockRoastGeneration should create roast data', () => {
      const roast = createMockRoastGeneration();

      expect(roast).toHaveProperty('text');
      expect(roast).toHaveProperty('tone', 'sarcastic');
      expect(roast).toHaveProperty('tokens_used', 25);
      expect(roast).toHaveProperty('cost_cents', 5);
    });
  });

  describe('Error Generators', () => {
    test('createMockError should create basic error', () => {
      const error = createMockError('Test error message');

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('TEST_ERROR');
    });

    test('createMockAPIError should create API error', () => {
      const error = createMockAPIError(404, 'Not Found');

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Not Found');
      expect(error.status).toBe(404);
      expect(error).toHaveProperty('response');
    });
  });

  describe('Service Response Generators', () => {
    test('createMockCostCheck should create cost control response', () => {
      const check = createMockCostCheck();

      expect(check.allowed).toBe(true);
      expect(check).toHaveProperty('currentUsage', 50);
      expect(check).toHaveProperty('limit', 100);
    });

    test('createMockCostCheck should handle disallowed case', () => {
      const check = createMockCostCheck(false, { reason: 'limit_exceeded' });

      expect(check.allowed).toBe(false);
      expect(check.reason).toBe('limit_exceeded');
    });

    test('createMockQueueResponse should create queue response', () => {
      const response = createMockQueueResponse();

      expect(response.success).toBe(true);
      expect(response.jobId).toMatch(/^job-/);
      expect(response).toHaveProperty('queueSize', 10);
    });
  });
});
