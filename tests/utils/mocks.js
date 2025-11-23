/**
 * Shared Mock Data Generators for Worker Tests
 *
 * Centralized mock data creation to reduce duplication and improve consistency
 */

/**
 * Generate unique IDs for test data
 */
const generateId = (prefix = 'test') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Comment Data Generators
 */
const createMockComment = (overrides = {}) => ({
  id: generateId('comment'),
  text: 'Test comment content',
  author_id: 'user-123',
  created_at: new Date().toISOString(),
  metrics: { likes: 5, replies: 2, retweets: 1 },
  platform: 'twitter',
  language: 'en',
  ...overrides
});

const createMockToxicComment = (overrides = {}) =>
  createMockComment({
    text: 'You are such an idiot',
    toxicity_score: 0.85,
    toxicity_categories: ['TOXICITY', 'INSULT'],
    ...overrides
  });

const createMockCleanComment = (overrides = {}) =>
  createMockComment({
    text: 'This is a nice and respectful comment',
    toxicity_score: 0.12,
    toxicity_categories: [],
    ...overrides
  });

/**
 * Twitter-specific comment data
 */
const createMockTwitterComment = (overrides = {}) =>
  createMockComment({
    platform: 'twitter',
    id: generateId('tweet'),
    public_metrics: {
      like_count: 5,
      reply_count: 2,
      retweet_count: 1,
      quote_count: 0
    },
    ...overrides
  });

/**
 * YouTube-specific comment data
 */
const createMockYouTubeComment = (overrides = {}) =>
  createMockComment({
    platform: 'youtube',
    id: generateId('yt_comment'),
    snippet: {
      textDisplay: overrides.text || 'Test YouTube comment',
      authorChannelId: { value: overrides.author_id || 'channel_123' },
      publishedAt: new Date().toISOString(),
      likeCount: 10
    },
    ...overrides
  });

/**
 * Job Data Generators
 */
const createMockJob = (overrides = {}) => ({
  id: generateId('job'),
  organization_id: 'org-123',
  platform: 'twitter',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  status: 'pending',
  priority: 3,
  retry_count: 0,
  max_retries: 3,
  ...overrides
});

const createMockFetchCommentsJob = (overrides = {}) =>
  createMockJob({
    job_type: 'fetch_comments',
    payload: {
      post_id: 'tweet-456',
      since_id: '100',
      max_results: 50
    },
    ...overrides
  });

const createMockAnalyzeToxicityJob = (overrides = {}) =>
  createMockJob({
    job_type: 'analyze_toxicity',
    comment_id: generateId('comment'),
    text: 'Test comment for analysis',
    author_id: 'user-456',
    ...overrides
  });

const createMockGenerateReplyJob = (overrides = {}) =>
  createMockJob({
    job_type: 'generate_reply',
    comment_id: generateId('comment'),
    text: 'This is a stupid post',
    author_id: 'user-789',
    toxicity_score: 0.85,
    toxicity_categories: ['TOXICITY', 'INSULT'],
    ...overrides
  });

const createMockShieldActionJob = (overrides = {}) =>
  createMockJob({
    job_type: 'shield_action',
    action_type: 'warning',
    user_id: 'user-456',
    comment_id: generateId('comment'),
    payload: {
      warning_message: 'Please keep comments respectful',
      toxicity_score: 0.75,
      categories: ['TOXICITY']
    },
    ...overrides
  });

/**
 * Analysis Result Generators
 */
const createMockAnalysis = (overrides = {}) => ({
  success: true,
  toxicity_score: 0.75,
  categories: ['TOXICITY', 'INSULT'],
  method: 'perspective_api',
  confidence: 0.9,
  analyzed_at: new Date().toISOString(),
  ...overrides
});

const createMockPerspectiveAnalysis = (overrides = {}) => ({
  success: true,
  scores: {
    TOXICITY: 0.78,
    SEVERE_TOXICITY: 0.23,
    IDENTITY_ATTACK: 0.15,
    INSULT: 0.85,
    PROFANITY: 0.45,
    THREAT: 0.12
  },
  categories: ['TOXICITY', 'INSULT'],
  ...overrides
});

const createMockOpenAIAnalysis = (overrides = {}) => ({
  success: true,
  flagged: true,
  categories: {
    harassment: true,
    hate: false,
    violence: false,
    sexual: false
  },
  category_scores: {
    harassment: 0.85,
    hate: 0.12,
    violence: 0.05,
    sexual: 0.02
  },
  ...overrides
});

/**
 * Organization and User Data Generators
 */
const createMockOrgSettings = (overrides = {}) => ({
  id: 'org-123',
  name: 'Test Organization',
  roast_tone: 'sarcastic',
  roast_humor_type: 'witty',
  language: 'es',
  auto_post: false,
  shield_enabled: true,
  cost_limit_monthly: 100,
  created_at: new Date().toISOString(),
  ...overrides
});

const createMockUser = (overrides = {}) => ({
  id: generateId('user'),
  username: 'testuser',
  platform: 'twitter',
  organization_id: 'org-123',
  is_active: true,
  reputation_score: 0.5,
  violation_count: 0,
  created_at: new Date().toISOString(),
  ...overrides
});

/**
 * Platform Response Generators
 */
const createMockFetchCommentsResponse = (comments = [], overrides = {}) => ({
  comments,
  nextToken: null,
  hasMore: false,
  total: comments.length,
  rate_limit_remaining: 100,
  ...overrides
});

const createMockRoastGeneration = (overrides = {}) => ({
  text: 'Innovador: has reinventado el arte de escribir comentarios tontos.',
  tone: 'sarcastic',
  humor_type: 'witty',
  language: 'es',
  tokens_used: 25,
  cost_cents: 5,
  model: 'gpt-4',
  created_at: new Date().toISOString(),
  ...overrides
});

/**
 * Shield Action Data Generators
 */
const createMockShieldAnalysis = (overrides = {}) => ({
  shouldTakeAction: true,
  actionLevel: 'medium',
  recommendedActions: ['warning', 'content_removal'],
  userRisk: 'medium',
  confidence: 0.8,
  reasoning: 'High toxicity score with repeated violations',
  ...overrides
});

const createMockShieldExecution = (overrides = {}) => ({
  success: true,
  actionsExecuted: ['warning', 'content_removal'],
  execution_time_ms: 150,
  platform_responses: {
    warning: { success: true, message_id: 'dm-123' },
    content_removal: { success: true, removal_id: 'removal-456' }
  },
  ...overrides
});

/**
 * Error Generators for testing failure scenarios
 */
const createMockError = (message = 'Test error', code = 'TEST_ERROR') => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const createMockAPIError = (status = 500, message = 'API Error') => {
  const error = new Error(message);
  error.status = status;
  error.response = { status, data: { error: message } };
  return error;
};

/**
 * Database Mock Generators
 */
const createMockSupabaseResponse = (data = null, error = null) => ({
  data,
  error,
  status: error ? 400 : 200,
  statusText: error ? 'Bad Request' : 'OK'
});

const createMockSupabaseSelect = (data = []) => ({
  select: jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue(createMockSupabaseResponse(data.length ? data[0] : null))
    })
  })
});

/**
 * Cost Control Mock Data
 */
const createMockCostCheck = (allowed = true, overrides = {}) => ({
  allowed,
  currentUsage: 50,
  limit: 100,
  remaining: 50,
  resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  reason: allowed ? null : 'monthly_limit_exceeded',
  ...overrides
});

/**
 * Queue Service Mock Data
 */
const createMockQueueResponse = (success = true, overrides = {}) => ({
  success,
  jobId: success ? generateId('job') : null,
  error: success ? null : 'Queue service unavailable',
  queueSize: 10,
  estimatedWaitTime: 30,
  ...overrides
});

module.exports = {
  // Utilities
  generateId,

  // Comment generators
  createMockComment,
  createMockToxicComment,
  createMockCleanComment,
  createMockTwitterComment,
  createMockYouTubeComment,

  // Job generators
  createMockJob,
  createMockFetchCommentsJob,
  createMockAnalyzeToxicityJob,
  createMockGenerateReplyJob,
  createMockShieldActionJob,

  // Analysis generators
  createMockAnalysis,
  createMockPerspectiveAnalysis,
  createMockOpenAIAnalysis,

  // Organization & User generators
  createMockOrgSettings,
  createMockUser,

  // Platform response generators
  createMockFetchCommentsResponse,
  createMockRoastGeneration,

  // Shield generators
  createMockShieldAnalysis,
  createMockShieldExecution,

  // Error generators
  createMockError,
  createMockAPIError,

  // Database generators
  createMockSupabaseResponse,
  createMockSupabaseSelect,

  // Service response generators
  createMockCostCheck,
  createMockQueueResponse
};
