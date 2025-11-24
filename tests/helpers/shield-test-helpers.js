/**
 * Shield Test Helpers - Issue #408
 *
 * Utility functions and mocks for Shield integration testing
 */

const testData = require('../fixtures/shield-test-data.json');

/**
 * Mock Supabase client for Shield testing
 */
function createMockSupabaseClient() {
  const mockSelect = jest.fn().mockResolvedValue({
    data: null,
    error: null
  });

  const mockInsert = jest.fn().mockResolvedValue({
    data: [{ id: 'mock_id' }],
    error: null
  });

  const mockUpsert = jest.fn().mockResolvedValue({
    data: [{ id: 'mock_id' }],
    error: null
  });

  const mockUpdate = jest.fn().mockResolvedValue({
    data: [{ id: 'mock_id' }],
    error: null
  });

  return {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => mockSelect),
          order: jest.fn(() => ({
            limit: jest.fn(() => mockSelect)
          }))
        })),
        gte: jest.fn(() => ({
          lte: jest.fn(() => mockSelect)
        })),
        order: jest.fn(() => ({
          limit: jest.fn(() => mockSelect)
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => mockInsert)
        }))
      })),
      upsert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => mockUpsert)
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => mockUpdate)
      }))
    }))
  };
}

/**
 * Mock Queue Service for Shield testing
 */
function createMockQueueService() {
  return {
    addJob: jest.fn().mockResolvedValue({ id: 'job_123' }),
    getJob: jest.fn().mockResolvedValue(null),
    completeJob: jest.fn().mockResolvedValue(),
    shutdown: jest.fn().mockResolvedValue()
  };
}

/**
 * Mock platform clients for Shield Action Worker testing
 */
function createMockPlatformClients() {
  const clients = new Map();

  // Twitter client mock
  clients.set('twitter', {
    v2: {
      hideReply: jest.fn().mockResolvedValue({ data: { hidden: true } }),
      blockUser: jest.fn().mockResolvedValue({ data: { blocked: true } }),
      reportUser: jest.fn().mockResolvedValue({ data: { reported: true } }),
      muteUser: jest.fn().mockResolvedValue({ data: { muted: true } })
    }
  });

  // Discord client mock
  clients.set('discord', {
    guilds: {
      cache: {
        get: jest.fn(() => ({
          members: {
            ban: jest.fn().mockResolvedValue({ success: true }),
            kick: jest.fn().mockResolvedValue({ success: true }),
            timeout: jest.fn().mockResolvedValue({ success: true })
          },
          channels: {
            cache: {
              get: jest.fn(() => ({
                messages: {
                  delete: jest.fn().mockResolvedValue({ success: true })
                }
              }))
            }
          }
        }))
      }
    }
  });

  // YouTube client mock
  clients.set('youtube', {
    commentThreads: {
      update: jest.fn().mockResolvedValue({ data: { id: 'comment_updated' } })
    },
    channels: {
      update: jest.fn().mockResolvedValue({ data: { id: 'channel_blocked' } })
    }
  });

  return clients;
}

/**
 * Generate test comment with specified toxicity level
 */
function generateTestComment(toxicityLevel, overrides = {}) {
  const baseComments = testData.comments[`${toxicityLevel}_toxicity`];
  if (!baseComments || baseComments.length === 0) {
    throw new Error(`No test data for toxicity level: ${toxicityLevel}`);
  }

  const baseComment = baseComments[0];

  return {
    id: `comment_${Date.now()}`,
    organization_id: 'org_test',
    platform: 'twitter',
    platform_user_id: 'user_test',
    platform_username: 'testuser',
    original_text: baseComment.original_text,
    ...overrides
  };
}

/**
 * Generate analysis result for specified toxicity level
 */
function generateAnalysisResult(toxicityLevel, overrides = {}) {
  const baseComments = testData.comments[`${toxicityLevel}_toxicity`];
  if (!baseComments || baseComments.length === 0) {
    throw new Error(`No test data for toxicity level: ${toxicityLevel}`);
  }

  const baseComment = baseComments[0];

  return {
    severity_level: baseComment.severity_level,
    toxicity_score: baseComment.toxicity_score,
    categories: baseComment.categories,
    ...overrides
  };
}

/**
 * Generate user behavior data for specified offender type
 */
function generateUserBehavior(offenderType, overrides = {}) {
  const baseUser = testData.users[`${offenderType}_offender`];
  if (!baseUser) {
    throw new Error(`No test data for offender type: ${offenderType}`);
  }

  return {
    organization_id: 'org_test',
    platform: 'twitter',
    platform_user_id: baseUser.platform_user_id,
    platform_username: baseUser.platform_username,
    total_violations: baseUser.total_violations,
    actions_taken: baseUser.actions_taken,
    first_seen_at: '2024-08-01T00:00:00Z',
    last_seen_at: new Date().toISOString(),
    created_at: '2024-08-01T00:00:00Z',
    updated_at: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Validate Shield action result structure
 */
function validateShieldResult(result, expectedAction = null) {
  expect(result).toHaveProperty('shieldActive');
  expect(result).toHaveProperty('shouldGenerateResponse');
  expect(result).toHaveProperty('actions');
  expect(result).toHaveProperty('userBehavior');
  expect(result).toHaveProperty('priority');

  // Core requirement: Shield actions must NEVER generate responses
  expect(result.shouldGenerateResponse).toBe(false);

  if (result.shieldActive) {
    expect(result.actions).toHaveProperty('primary');
    expect(result.actions).toHaveProperty('severity');
    expect(result.actions).toHaveProperty('offenseLevel');

    if (expectedAction) {
      expect(result.actions.primary).toBe(expectedAction);
    }
  }

  return true;
}

/**
 * Validate offender registration data structure
 */
function validateOffenderRegistration(mockUpsertCall) {
  expect(mockUpsertCall).toHaveBeenCalledWith(
    expect.objectContaining({
      organization_id: expect.any(String),
      platform: expect.any(String),
      platform_user_id: expect.any(String),
      actions_taken: expect.any(Array)
    }),
    expect.any(Object)
  );

  return true;
}

/**
 * Validate escalation matrix compliance
 */
function validateEscalationMatrix(severity, offenseLevel, actualAction) {
  const expectedAction = testData.escalation_matrix.severity_mapping[severity][offenseLevel];
  if (expectedAction) {
    expect(actualAction).toBe(expectedAction);
  }

  return true;
}

/**
 * Create test job for Shield Action Worker
 */
function createTestJob(platform = 'twitter', action = 'hideComment', overrides = {}) {
  return {
    id: `job_${Date.now()}`,
    payload: {
      comment_id: 'comment_test',
      organization_id: 'org_test',
      platform,
      platform_user_id: 'user_test',
      platform_username: 'testuser',
      action,
      duration: null,
      shield_mode: true,
      reason: 'Shield automated action',
      ...overrides
    }
  };
}

/**
 * Setup complete Shield test environment
 */
function setupShieldTestEnvironment() {
  const mockSupabase = createMockSupabaseClient();
  const mockQueueService = createMockQueueService();
  const mockPlatformClients = createMockPlatformClients();

  return {
    mockSupabase,
    mockQueueService,
    mockPlatformClients,
    testData
  };
}

/**
 * Cleanup Shield test environment
 */
async function cleanupShieldTestEnvironment(services = {}) {
  const { shieldService, shieldWorker } = services;

  if (shieldService && shieldService.shutdown) {
    await shieldService.shutdown();
  }

  if (shieldWorker && shieldWorker.shutdown) {
    await shieldWorker.shutdown();
  }

  jest.clearAllMocks();
}

module.exports = {
  createMockSupabaseClient,
  createMockQueueService,
  createMockPlatformClients,
  generateTestComment,
  generateAnalysisResult,
  generateUserBehavior,
  validateShieldResult,
  validateOffenderRegistration,
  validateEscalationMatrix,
  createTestJob,
  setupShieldTestEnvironment,
  cleanupShieldTestEnvironment,
  testData
};
